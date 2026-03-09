/**
 * auth-client.js
 * 프론트엔드 인증 클라이언트
 * 서버 API와 통신하여 로그인/회원가입/데이터 동기화 처리
 */

const AuthClient = {
    /** @type {{id:number, email:string, username:string}|null} */
    _user: null,

    /** @type {boolean} Google OAuth 활성화 여부 */
    _googleEnabled: false,

    // =========================================
    // 초기화
    // =========================================

    /**
     * 서버에서 현재 로그인 상태 및 설정 확인
     * @returns {Promise<{id,email,username}|null>}
     */
    async init() {
        // Google OAuth 활성화 여부 확인
        try {
            const pRes = await fetch('/api/auth/providers');
            if (pRes.ok) {
                const { google } = await pRes.json();
                this._googleEnabled = !!google;
            }
        } catch { /* ignore */ }

        // 현재 세션 확인
        return this.fetchMe();
    },

    /**
     * /api/auth/me 로 현재 유저 확인
     */
    async fetchMe() {
        try {
            const res = await fetch('/api/auth/me');
            if (!res.ok) { this._user = null; return null; }
            const { user } = await res.json();
            this._user = user;
            return user;
        } catch {
            this._user = null;
            return null;
        }
    },

    // =========================================
    // 인증
    // =========================================

    /**
     * 이메일/비밀번호 로그인
     * @throws {Error} 실패 시 한국어 에러 메시지
     */
    async login(email, password) {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '로그인에 실패했습니다');
        this._user = data.user;
        return data.user;
    },

    /**
     * 이메일/비밀번호 회원가입
     * @throws {Error} 실패 시 한국어 에러 메시지
     */
    async register(email, password, username) {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, username })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '회원가입에 실패했습니다');
        this._user = data.user;
        return data.user;
    },

    /**
     * 로그아웃
     */
    async logout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        this._user = null;
    },

    /**
     * Google OAuth 로그인 (페이지 이동)
     */
    loginWithGoogle() {
        window.location.href = '/api/auth/google';
    },

    // =========================================
    // 상태 조회
    // =========================================

    getUser() { return this._user; },
    isLoggedIn() { return !!this._user; },
    isGoogleEnabled() { return this._googleEnabled; },

    // =========================================
    // 데이터 동기화
    // =========================================

    /**
     * 로그인 후 서버 데이터를 localStorage로 복원
     * 서버에 데이터가 없고 로컬에 데이터가 있으면 서버로 마이그레이션
     */
    async syncAfterLogin() {
        try {
            const res = await fetch('/api/user/data');
            if (!res.ok) return;
            const { stageResults, stats, jumpUsage } = await res.json();

            const hasServerData = stageResults?.length > 0 || stats !== null;

            if (!hasServerData) {
                // 첫 로그인: 로컬 데이터를 서버로 마이그레이션
                await this._migrateLocalToServer();
            } else {
                // 기존 계정: 서버 데이터를 로컬로 복원
                this._restoreToLocalStorage(stageResults, stats, jumpUsage);
            }

            // 프로필 동기화
            if (this._user) {
                localStorage.setItem('profile', JSON.stringify({ username: this._user.username }));
            }
        } catch (err) {
            console.warn('AuthClient: 동기화 실패', err);
        }
    },

    /**
     * 로컬 데이터를 서버로 업로드 (첫 로그인 마이그레이션)
     */
    async _migrateLocalToServer() {
        const stageResults = this._collectLocalStageResults();
        const rawStats = localStorage.getItem('stats');
        const stats = rawStats ? JSON.parse(rawStats) : null;
        const rawJump = localStorage.getItem('jumpUsage');
        const jumpUsage = rawJump ? JSON.parse(rawJump) : null;
        const rawWrong = localStorage.getItem('wrongWords');
        const wrongWords = rawWrong ? JSON.parse(rawWrong) : [];

        if (stageResults.length === 0 && !stats) return; // 로컬 데이터 없음

        try {
            await fetch('/api/user/migrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stageResults, stats, jumpUsage, wrongWords })
            });
            console.log('AuthClient: 로컬 데이터 마이그레이션 완료');
        } catch (err) {
            console.warn('AuthClient: 마이그레이션 실패', err);
        }
    },

    /**
     * localStorage에서 스테이지 결과 수집
     */
    _collectLocalStageResults() {
        const results = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('stage_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    results.push({
                        stageId: key.replace('stage_', ''),
                        stars: data.stars || 0,
                        bestScore: data.bestScore || 0,
                        lastAccuracy: data.lastAccuracy ?? null
                    });
                } catch { /* skip */ }
            }
        }
        return results;
    },

    /**
     * 서버 데이터를 localStorage로 복원
     */
    _restoreToLocalStorage(stageResults, stats, jumpUsage) {
        // 스테이지 결과 복원
        if (stageResults?.length) {
            stageResults.forEach(r => {
                localStorage.setItem(`stage_${r.stage_id}`, JSON.stringify({
                    stars: r.stars,
                    bestScore: r.best_score,
                    lastAccuracy: r.last_accuracy
                }));
            });
        }

        // 통계 복원
        if (stats) {
            localStorage.setItem('stats', JSON.stringify({
                totalGames: stats.total_games,
                totalScore: stats.total_score,
                totalCorrect: stats.total_correct,
                totalWrong: stats.total_wrong,
                currentStreak: stats.current_streak,
                lastPlayed: stats.last_played
            }));
            if (stats.wrong_words) {
                localStorage.setItem('wrongWords', stats.wrong_words);
            }
        }

        // 점프 사용 복원
        if (jumpUsage) {
            localStorage.setItem('jumpUsage', JSON.stringify({
                usedToday: jumpUsage.used_today,
                lastDate: jumpUsage.last_date
            }));
        }
    },

    /**
     * 스테이지 결과를 서버에 비동기 저장 (fire-and-forget)
     */
    syncStageResult(stageId, stars, bestScore, lastAccuracy) {
        if (!this._user) return;
        fetch('/api/user/stage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stageId, stars, bestScore, lastAccuracy })
        }).catch(err => console.warn('AuthClient: stage sync failed', err));
    },

    /**
     * 통계를 서버에 비동기 저장 (fire-and-forget)
     */
    syncStats(stats, wrongWords) {
        if (!this._user) return;
        fetch('/api/user/stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...stats, wrongWords })
        }).catch(err => console.warn('AuthClient: stats sync failed', err));
    },

    /**
     * 점프 사용 현황을 서버에 비동기 저장 (fire-and-forget)
     */
    syncJumpUsage(usedToday, lastDate) {
        if (!this._user) return;
        fetch('/api/user/jump', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usedToday, lastDate })
        }).catch(err => console.warn('AuthClient: jump sync failed', err));
    },

    /**
     * 닉네임을 서버에 비동기 저장 (fire-and-forget)
     */
    syncProfile(username) {
        if (!this._user) return;
        fetch('/api/user/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        }).catch(err => console.warn('AuthClient: profile sync failed', err));
    }
};
