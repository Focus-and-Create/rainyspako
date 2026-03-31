/**
 * auth-client.js
 * Supabase 기반 인증 + 데이터 동기화 클라이언트
 */

const AuthClient = {
    /** @type {import('@supabase/supabase-js').SupabaseClient} */
    _sb: null,

    /** @type {{id:string, email:string, username:string}|null} */
    _user: null,

    // 클라이언트 UX 보호용 제한(보안 강제는 서버에서 처리 필요)
    _loginAttemptTimes: [],
    _LOGIN_WINDOW_MS: 60 * 1000,
    _MAX_LOGIN_ATTEMPTS: 5,

    // =========================================
    // 초기화
    // =========================================


    async _ensureClient() {
        if (this._sb) return;

        const sdk = (typeof window !== 'undefined' && window.supabase)
            ? window.supabase
            : (typeof supabase !== 'undefined' ? supabase : null);
        const url = (typeof SUPABASE_URL === 'string') ? SUPABASE_URL : '';
        const anonKey = (typeof SUPABASE_ANON_KEY === 'string') ? SUPABASE_ANON_KEY : '';

        if (!sdk || typeof sdk.createClient !== 'function' || !url || !anonKey) {
            throw new Error('로그인 서비스를 초기화할 수 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.');
        }

        this._sb = sdk.createClient(url, anonKey);
    },

    async init() {
        // Supabase 클라이언트 생성
        await this._ensureClient();

        // 기존 세션 확인
        const { data: { session } } = await this._sb.auth.getSession();
        if (session?.user) {
            await this._loadUserProfile(session.user);
        }

        // 인증 상태 변경 리스너
        this._sb.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT') {
                this._user = null;
            }
        });

        return this._user;
    },

    /**
     * auth.users에서 user_profiles 닉네임을 가져와 _user에 세팅
     */
    async _loadUserProfile(authUser) {
        const { data } = await this._sb
            .from('user_profiles')
            .select('username')
            .eq('user_id', authUser.id)
            .single();

        this._user = {
            id: authUser.id,
            email: authUser.email,
            username: data?.username || authUser.user_metadata?.full_name || authUser.email.split('@')[0]
        };
    },

    // =========================================
    // 인증
    // =========================================


    _checkAuthThrottle() {
        const now = Date.now();
        this._loginAttemptTimes = this._loginAttemptTimes.filter(ts => (now - ts) < this._LOGIN_WINDOW_MS);
        if (this._loginAttemptTimes.length >= this._MAX_LOGIN_ATTEMPTS) {
            const oldest = this._loginAttemptTimes[0];
            const waitSec = Math.max(1, Math.ceil((this._LOGIN_WINDOW_MS - (now - oldest)) / 1000));
            throw new Error(`요청이 너무 많습니다. ${waitSec}초 후 다시 시도해 주세요.`);
        }
        this._loginAttemptTimes.push(now);
    },

    async login(email, password) {
        this._checkAuthThrottle();
        await this._ensureClient();
        const { data, error } = await this._sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error(this._translateError(error));
        await this._loadUserProfile(data.user);
        return this._user;
    },

    async register(email, password, username) {
        this._checkAuthThrottle();
        await this._ensureClient();
        const { data, error } = await this._sb.auth.signUp({
            email,
            password,
            options: { data: { username: username || email.split('@')[0] } }
        });
        if (error) throw new Error(this._translateError(error));
        if (data.user) await this._loadUserProfile(data.user);
        return this._user;
    },

    async logout() {
        await this._ensureClient();
        await this._sb.auth.signOut();
        this._user = null;
    },

    async loginWithGoogle() {
        this._checkAuthThrottle();
        await this._ensureClient();
        const { error } = await this._sb.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.protocol + '//' + window.location.host + window.location.pathname }
        });
        if (error) throw new Error(this._translateError(error));
    },

    _safeParse(jsonStr) {
        if (!jsonStr) return null;
        try { return JSON.parse(jsonStr); }
        catch { return null; }
    },

    /**
     * Supabase 에러 메시지 한국어 변환
     */
    _translateError(error) {
        const msg = error.message || '';
        if (msg.includes('Invalid login')) return '이메일 또는 비밀번호가 올바르지 않습니다';
        if (msg.includes('already registered')) return '이미 사용 중인 이메일입니다';
        if (msg.includes('Password should be')) return '비밀번호는 6자 이상이어야 합니다';
        if (msg.includes('valid email')) return '올바른 이메일 형식이 아닙니다';
        if (msg.includes('Email not confirmed')) return '이메일 인증이 필요합니다. 받은 편지함을 확인해주세요';
        if (msg.includes('Unsupported provider')) return 'Google 로그인이 비활성화되어 있습니다. 관리자에게 문의해 주세요.';
        if (msg.includes('redirect_uri_mismatch')) return 'Google 로그인 리디렉션 주소가 올바르지 않습니다. 관리자 설정을 확인해 주세요.';
        if (msg.includes('popup_closed_by_user')) return 'Google 로그인 창이 닫혀 취소되었습니다.';
        return msg || '오류가 발생했습니다';
    },

    // =========================================
    // 상태 조회
    // =========================================

    getUser() { return this._user; },
    isLoggedIn() { return !!this._user; },
    isGoogleEnabled() { return true; }, // Supabase에서 Google 설정 시 항상 사용 가능

    // =========================================
    // 데이터 동기화
    // =========================================

    async syncAfterLogin() {
        if (!this._user) return;
        const userId = this._user.id;

        try {
            // 서버 데이터 조회
            const [stageRes, statsRes, jumpRes] = await Promise.all([
                this._sb.from('stage_results').select('*').eq('user_id', userId),
                this._sb.from('user_stats').select('*').eq('user_id', userId).single(),
                this._sb.from('jump_usage').select('*').eq('user_id', userId).single()
            ]);

            const stageResults = stageRes.data || [];
            const stats = statsRes.data;
            const jumpUsage = jumpRes.data;

            const hasServerData = stageResults.length > 0 || !!stats;

            if (!hasServerData) {
                await this._migrateLocalToServer(userId);
            } else {
                this._restoreToLocalStorage(stageResults, stats, jumpUsage);
            }

            // 프로필 동기화
            if (this._user) {
                localStorage.setItem('spanish_rain_profile', JSON.stringify({ username: this._user.username }));
            }
        } catch (err) {
            console.warn('AuthClient: 동기화 실패', err);
        }
    },

    async _migrateLocalToServer(userId) {
        const stageResults = this._collectLocalStageResults();
        const rawStats = localStorage.getItem('spanish_rain_stats');
        const stats = this._safeParse(rawStats);
        const rawJump = localStorage.getItem('spanish_rain_stage_jump');
        const jumpUsage = this._safeParse(rawJump);
        const rawWrong = localStorage.getItem('spanish_rain_wrong_words');
        const wrongWords = this._safeParse(rawWrong) || [];

        if (stageResults.length === 0 && !stats) return;

        try {
            // 스테이지 결과 마이그레이션
            if (stageResults.length > 0) {
                const rows = stageResults.map(r => ({
                    user_id: userId,
                    stage_id: r.stageId,
                    stars: r.stars,
                    best_score: r.bestScore,
                    last_accuracy: r.lastAccuracy
                }));
                await this._sb.from('stage_results').upsert(rows);
            }

            // 통계 마이그레이션
            if (stats) {
                await this._sb.from('user_stats').upsert({
                    user_id: userId,
                    total_games: stats.totalGames || 0,
                    total_score: stats.totalScore || 0,
                    total_correct: stats.totalCorrect || 0,
                    total_wrong: stats.totalWrong || 0,
                    current_streak: stats.currentStreak || 0,
                    last_played: stats.lastPlayDate || null,
                    wrong_words: wrongWords
                });
            }

            // 점프 마이그레이션
            if (jumpUsage) {
                await this._sb.from('jump_usage').upsert({
                    user_id: userId,
                    used_today: jumpUsage.used || 0,
                    last_date: jumpUsage.date || ''
                });
            }

        } catch (err) {
            console.warn('AuthClient: 마이그레이션 실패', err);
        }
    },

    _collectLocalStageResults() {
        const results = [];
        try {
            const raw = localStorage.getItem('spanish_rain_progress');
            if (!raw) return results;
            const progress = JSON.parse(raw);
            for (const [stageId, data] of Object.entries(progress)) {
                results.push({
                    stageId,
                    stars: data.stars || 0,
                    bestScore: data.bestScore || 0,
                    lastAccuracy: data.lastAccuracy ?? null
                });
            }
        } catch { /* skip */ }
        return results;
    },

    _restoreToLocalStorage(stageResults, stats, jumpUsage) {
        if (stageResults?.length) {
            const progress = {};
            stageResults.forEach(r => {
                progress[r.stage_id] = {
                    stars: r.stars,
                    bestScore: r.best_score,
                    lastAccuracy: r.last_accuracy
                };
            });
            localStorage.setItem('spanish_rain_progress', JSON.stringify(progress));
        }

        if (stats) {
            localStorage.setItem('spanish_rain_stats', JSON.stringify({
                totalGames: stats.total_games,
                totalScore: stats.total_score,
                globalScore: stats.total_score,
                totalCorrect: stats.total_correct,
                totalWrong: stats.total_wrong,
                currentStreak: stats.current_streak,
                lastPlayDate: stats.last_played
            }));
            if (stats.wrong_words) {
                localStorage.setItem('spanish_rain_wrong_words', JSON.stringify(stats.wrong_words));
            }
        }

        if (jumpUsage) {
            localStorage.setItem('spanish_rain_stage_jump', JSON.stringify({
                date: jumpUsage.last_date,
                used: jumpUsage.used_today
            }));
        }
    },

    // =========================================
    // Fire-and-forget 동기화 (storage.js에서 호출)
    // =========================================

    syncStageResult(stageId, stars, bestScore, lastAccuracy) {
        if (!this._user) return;
        this._sb.from('stage_results').upsert({
            user_id: this._user.id,
            stage_id: stageId,
            stars, best_score: bestScore, last_accuracy: lastAccuracy,
            updated_at: new Date().toISOString()
        }).then(({ error }) => {
            if (error) console.warn('AuthClient: stage sync failed', error);
        });
    },

    syncStats(stats, wrongWords) {
        if (!this._user) return;
        this._sb.from('user_stats').upsert({
            user_id: this._user.id,
            total_games: stats.totalGames,
            total_score: stats.totalScore,
            total_correct: stats.totalCorrect,
            total_wrong: stats.totalWrong,
            current_streak: stats.currentStreak,
            last_played: stats.lastPlayed,
            wrong_words: wrongWords || [],
            updated_at: new Date().toISOString()
        }).then(({ error }) => {
            if (error) console.warn('AuthClient: stats sync failed', error);
        });
    },

    syncJumpUsage(usedToday, lastDate) {
        if (!this._user) return;
        this._sb.from('jump_usage').upsert({
            user_id: this._user.id,
            used_today: usedToday,
            last_date: lastDate
        }).then(({ error }) => {
            if (error) console.warn('AuthClient: jump sync failed', error);
        });
    },

    syncProfile(username) {
        if (!this._user) return;
        this._sb.from('user_profiles').upsert({
            user_id: this._user.id,
            username,
            updated_at: new Date().toISOString()
        }).then(({ error }) => {
            if (error) console.warn('AuthClient: profile sync failed', error);
        });
    }
};
