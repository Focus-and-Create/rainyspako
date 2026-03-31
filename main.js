/**
 * main.js
 * 앱 진입점
 * 화면 전환, 이벤트 바인딩, 초기화
 */

const App = {
    // =========================================
    // 화면 상태
    // =========================================
    
    /** @type {string} 현재 화면 ('loading'|'map'|'game'|'result') */
    currentScreen: 'loading',
    
    /** @type {string} 현재 게임 모드 */
    currentMode: 'es-to-ko',

    // =========================================
    // DOM 요소 참조
    // =========================================
    
    elements: {
        // 화면 컨테이너
        loadingScreen: null,
        loginScreen: null,
        gameScreen: null,
        resultScreen: null,

        // 게임 UI
        scoreDisplay: null,
        livesDisplay: null,
        comboDisplay: null,
        progressBar: null,
        inputField: null,
        cardZone: null,
        gameModeSelect: null,

        // 결과 화면
        resultStars: null,
        resultScore: null,
        resultAccuracy: null,
        resultCombo: null,
        nextBtn: null,
        retryBtn: null,

        // 통계 모달

        // 로그인 화면
        usernameInput: null,
        loginBtn: null,
        loginBackBtn: null,
        loginEmail: null,
        loginPassword: null,
        registerUsername: null,
        registerEmail: null,
        registerPassword: null,
        registerBtn: null,
        googleLoginBtn: null,
        loginSubmitEditBtn: null,
    },

    /** @type {boolean} 로그인 화면이 닉네임 변경 모드인지 여부 */
    _loginIsEditing: false,

    // =========================================
    // 초기화
    // =========================================
    
    /**
     * 앱 초기화
     */
    init: async function() {
        // DOM 요소 참조 가져오기
        this.cacheElements();

        // 이벤트 리스너 등록
        this.bindEvents();

        // 스토리지 초기화
        Storage.init();
        this.applyModeSetting(Storage.getSetting('mode') || 'es-to-ko');

        // 단어 데이터 로드
        const loaded = await WordManager.loadAll();

        if (!loaded) {
            console.error('App: 단어 데이터 로드 실패');
            const loadingText = document.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = '데이터 로드에 실패했습니다. 페이지를 새로고침해 주세요.';
            }
            const loadingProgress = document.querySelector('.loading-progress');
            if (loadingProgress) {
                loadingProgress.style.animationPlayState = 'paused';
            }
            return;
        }

        // 타입 모드는 비활성화: 항상 매치 뷰 고정
        this._matchViewOpen = true;
        Storage.setSetting('gameView', 'match');

        // 게임 초기화 (가랑비 모델: 스테이지 클리어 없이 연속 플레이)
        Game.init(null);
        Game.onGameOver  = () => { if (!this._matchViewOpen) this._startFreshGame(); };
        Game.onStateUpdate = (state) => this.updateGameUI(state);

        // Supabase 인증 확인
        const user = await AuthClient.init();
        if (user) {
            // 로그인 상태: 서버 데이터 동기화 후 바로 게임 시작
            Storage.saveProfile({ username: user.username });
            await AuthClient.syncAfterLogin();
            this._startFreshGame();
        } else {
            // 미로그인: 로그인 화면
            this.showScreen('login');
        }

    },
    
    /**
     * DOM 요소 캐싱
     */
    cacheElements: function() {
        // 화면 컨테이너
        this.elements.loadingScreen = document.getElementById('loading-screen');
        this.elements.loginScreen = document.getElementById('login-screen');
        this.elements.gameScreen = document.getElementById('game-screen');
        this.elements.resultScreen = document.getElementById('result-screen');

        // 게임 UI
        this.elements.scoreDisplay = document.getElementById('score-display');
        this.elements.livesDisplay = document.getElementById('lives-display');
        this.elements.comboDisplay = document.getElementById('combo-display');
        this.elements.progressBar = document.getElementById('progress-bar');
        this.elements.inputField = document.getElementById('input-field');
        this.elements.cardZone = document.getElementById('card-zone');
        this.elements.gameModeSelect = document.getElementById('game-mode-select');

        // 결과 화면
        this.elements.resultStars = document.getElementById('result-stars');
        this.elements.resultScore = document.getElementById('result-score');
        this.elements.resultAccuracy = document.getElementById('result-accuracy');
        this.elements.resultCombo = document.getElementById('result-combo');
        this.elements.nextBtn = document.getElementById('next-btn');
        this.elements.retryBtn = document.getElementById('retry-btn');

        // 통계 모달

        // 로그인 화면
        this.elements.usernameInput = document.getElementById('username-input');
        this.elements.loginBtn = document.getElementById('login-btn');
        this.elements.loginBackBtn = document.getElementById('login-back-btn');
        this.elements.loginEmail = document.getElementById('login-email');
        this.elements.loginPassword = document.getElementById('login-password');
        this.elements.registerUsername = document.getElementById('register-username');
        this.elements.registerEmail = document.getElementById('register-email');
        this.elements.registerPassword = document.getElementById('register-password');
        this.elements.registerBtn = document.getElementById('register-btn');
        this.elements.googleLoginBtn = document.getElementById('google-login-btn');
        this.elements.loginSubmitEditBtn = document.getElementById('login-submit-edit-btn');
    },
    
    /**
     * 이벤트 리스너 바인딩
     */
    bindEvents: function() {
        // 탭 전환
        document.getElementById('auth-tabs')?.addEventListener('click', (e) => {
            const tab = e.target.closest('.auth-tab');
            if (tab) this._switchAuthTab(tab.dataset.tab);
        });

        // 로그인 버튼
        if (this.elements.loginBtn) {
            this.elements.loginBtn.addEventListener('click', () => this.handleLogin());
        }
        // 엔터 키로 로그인
        [this.elements.loginEmail, this.elements.loginPassword].forEach(el => {
            el?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); this.handleLogin(); }
            });
        });

        // 회원가입 버튼
        if (this.elements.registerBtn) {
            this.elements.registerBtn.addEventListener('click', () => this.handleRegister());
        }
        [this.elements.registerEmail, this.elements.registerPassword].forEach(el => {
            el?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); this.handleRegister(); }
            });
        });

        // Google 로그인 버튼
        if (this.elements.googleLoginBtn) {
            this.elements.googleLoginBtn.addEventListener('click', () => {
                AuthClient.loginWithGoogle();
            });
        }

        // 닉네임 변경 제출 버튼
        if (this.elements.loginSubmitEditBtn) {
            this.elements.loginSubmitEditBtn.addEventListener('click', () => this.handleEditName());
        }
        if (this.elements.usernameInput) {
            this.elements.usernameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); this.handleEditName(); }
            });
        }

        // 돌아가기 버튼
        if (this.elements.loginBackBtn) {
            this.elements.loginBackBtn.addEventListener('click', () => {
                this._loginIsEditing = false;
                this._startFreshGame();
            });
        }

        // 키보드 입력 (게임용)
        document.addEventListener('keydown', (e) => {
            if (this.currentScreen === 'game') {
                this.handleGameKeydown(e);
            }
        });
        
        // 입력 필드 변경 (모바일 IME용)
        if (this.elements.inputField) {
            this.elements.inputField.addEventListener('input', (e) => {
                Game.setInput(e.target.value);
            });

            // 엔터 키 및 특수문자 단축키 처리
            this.elements.inputField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    Game.checkAnswer();
                    this.elements.inputField.value = '';
                    return;
                }

                // 특수문자 단축키 (스페인어 특수기호)
                if (e.ctrlKey) {
                    const specialCharMap = {
                        'n': e.shiftKey ? 'Ñ' : 'ñ',
                        'a': 'á',
                        'e': 'é',
                        'i': 'í',
                        'o': 'ó',
                        'u': e.shiftKey ? 'ü' : 'ú',
                    };
                    const lowerKey = e.key.toLowerCase();
                    if (specialCharMap[lowerKey]) {
                        e.preventDefault();
                        this.insertSpecialChar(specialCharMap[lowerKey]);
                    }
                }
            });
        }

        // 특수문자 버튼 바 이벤트
        const specialCharBar = document.getElementById('special-chars-bar');
        if (specialCharBar) {
            specialCharBar.addEventListener('click', (e) => {
                const btn = e.target.closest('.special-char-btn');
                if (btn) {
                    const char = btn.dataset.char;
                    this.insertSpecialChar(char);
                    // 포커스를 입력 필드로 복원
                    if (this.elements.inputField) {
                        this.elements.inputField.focus();
                    }
                }
            });
        }
        
        // 결과 화면 버튼들
        if (this.elements.nextBtn) {
            this.elements.nextBtn.addEventListener('click', () => {
                this._startFreshGame();
            });
        }

        if (this.elements.retryBtn) {
            this.elements.retryBtn.addEventListener('click', () => {
                this._retryGame();
            });
        }

        // 게임 헤더 모드 선택
        if (this.elements.gameModeSelect) {
            this.elements.gameModeSelect.addEventListener('change', (e) => {
                this.applyModeSetting(e.target.value);
                if (this._matchViewOpen) {
                    MatchGame.init(document.getElementById('match-grid'));
                } else {
                    this._startFreshGame();
                }
            });
        }

        const gameSettingsBtn = document.getElementById('game-settings-btn');
        const gameSettingsPanel = document.getElementById('game-settings-panel');
        if (gameSettingsBtn && gameSettingsPanel) {
            gameSettingsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const header = document.querySelector('.game-header');
                if (header) gameSettingsPanel.style.top = header.offsetHeight + 'px';
                gameSettingsPanel.classList.toggle('hidden');
            });
            document.addEventListener('click', (e) => {
                if (gameSettingsPanel.classList.contains('hidden')) return;
                if (!gameSettingsPanel.contains(e.target) && e.target !== gameSettingsBtn) {
                    gameSettingsPanel.classList.add('hidden');
                }
            });
        }

        // 짝 잇기 카드 클릭 (이벤트 위임)
        const matchGrid = document.getElementById('match-grid');
        if (matchGrid) {
            matchGrid.addEventListener('click', (e) => {
                const card = e.target.closest('.mc');
                if (card) MatchGame.handleClick(parseInt(card.dataset.idx, 10));
            });
        }

        // 매치 정렬 버튼
        const matchSortMessy = document.getElementById('match-sort-messy');
        const matchSortClean = document.getElementById('match-sort-clean');
        const setSortModeUI = (mode) => {
            const useClean = mode === 'clean';
            if (matchSortMessy) matchSortMessy.classList.toggle('match-mode-active', !useClean);
            if (matchSortClean) matchSortClean.classList.toggle('match-mode-active', useClean);
            MatchGame.setSorted(useClean);
            Storage.setSetting('matchSortMode', mode);
        };
        if (matchSortMessy) matchSortMessy.addEventListener('click', () => setSortModeUI('messy'));
        if (matchSortClean) matchSortClean.addEventListener('click', () => setSortModeUI('clean'));

        // 매치 학습 모드 버튼
        const matchModeFast = document.getElementById('match-mode-fast');
        const matchModeReview = document.getElementById('match-mode-review');
        const matchRefillFlow = document.getElementById('match-refill-flow');
        const matchRefillClear = document.getElementById('match-refill-clear');
        const setMatchModeUI = (mode) => {
            if (matchModeFast) matchModeFast.classList.toggle('match-mode-active', mode === 'fast');
            if (matchModeReview) matchModeReview.classList.toggle('match-mode-active', mode === 'review');
            MatchGame.setMatchMode(mode);
            Storage.setSetting('matchMode', mode);
        };
        const setRefillModeUI = (mode) => {
            if (matchRefillFlow) matchRefillFlow.classList.toggle('match-mode-active', mode === 'flow');
            if (matchRefillClear) matchRefillClear.classList.toggle('match-mode-active', mode === 'clear');
            MatchGame.setRefillMode(mode);
            Storage.setSetting('matchRefillMode', mode);
        };
        if (matchModeFast) matchModeFast.addEventListener('click', () => setMatchModeUI('fast'));
        if (matchModeReview) matchModeReview.addEventListener('click', () => setMatchModeUI('review'));
        if (matchRefillFlow) matchRefillFlow.addEventListener('click', () => setRefillModeUI('flow'));
        if (matchRefillClear) matchRefillClear.addEventListener('click', () => setRefillModeUI('clear'));

        setMatchModeUI(Storage.getSetting('matchMode') || 'fast');
        setRefillModeUI(Storage.getSetting('matchRefillMode') || 'flow');
        setSortModeUI(Storage.getSetting('matchSortMode') || 'messy');

        // Stats 버튼 (게임 헤더)
        const statsBtn = document.getElementById('stats-btn');
        if (statsBtn) {
            statsBtn.addEventListener('click', () => {
                this.showStatsModal();
            });
        }

        // Stats 모달 닫기 버튼들
        const closeStatsBtn = document.getElementById('close-stats-btn');
        if (closeStatsBtn) {
            closeStatsBtn.addEventListener('click', () => {
                this.hideStatsModal();
            });
        }
        const statsCloseAction = document.getElementById('stats-close-action');
        if (statsCloseAction) {
            statsCloseAction.addEventListener('click', () => {
                this.hideStatsModal();
            });
        }
        const statsProgressSection = document.querySelector('.stats-progress-section');
        if (statsProgressSection) {
            statsProgressSection.addEventListener('click', () => {
                const unlockedWordsBox = document.getElementById('stats-unlocked-words');
                if (!unlockedWordsBox) return;
                const isOpen = unlockedWordsBox.classList.toggle('hidden');
                statsProgressSection.classList.toggle('expanded', !isOpen);
            });
        }

        // 인라인 닉네임 편집
        const statsChangeNameBtn = document.getElementById('stats-change-name-btn');
        const statsUsernameDisplay = document.getElementById('stats-username-display');
        const statsNameInput = document.getElementById('stats-name-input');

        const saveInlineName = () => {
            const name = statsNameInput ? (statsNameInput.value.trim() || 'Player') : 'Player';
            Storage.saveProfile({ username: name });
            if (statsUsernameDisplay) {
                statsUsernameDisplay.textContent = name;
                statsUsernameDisplay.classList.remove('hidden');
            }
            if (statsNameInput) statsNameInput.classList.add('hidden');
            if (statsChangeNameBtn) statsChangeNameBtn.textContent = '✏';
        };

        if (statsChangeNameBtn) {
            statsChangeNameBtn.addEventListener('click', () => {
                const isEditing = statsNameInput && !statsNameInput.classList.contains('hidden');
                if (isEditing) {
                    saveInlineName();
                } else {
                    if (statsUsernameDisplay) statsUsernameDisplay.classList.add('hidden');
                    if (statsNameInput) {
                        statsNameInput.value = statsUsernameDisplay ? statsUsernameDisplay.textContent : '';
                        statsNameInput.classList.remove('hidden');
                        statsNameInput.focus();
                    }
                    statsChangeNameBtn.textContent = '✓';
                }
            });
        }

        if (statsNameInput) {
            statsNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); saveInlineName(); }
                if (e.key === 'Escape') {
                    statsNameInput.classList.add('hidden');
                    if (statsUsernameDisplay) statsUsernameDisplay.classList.remove('hidden');
                    if (statsChangeNameBtn) statsChangeNameBtn.textContent = '✏';
                }
            });
        }

    },

    /** @type {{worldId:number, stageNum:number}|null} 마지막으로 시작한 세션의 스테이지 */
    _lastAutoStage: null,

    /** @type {boolean} 짝 잇기 뷰가 열려 있는지 */
    _matchViewOpen: true,

    /**
     * 새 게임 세션 시작 (커리큘럼 자동 탐색)
     */
    _startFreshGame: function() {
        this.showScreen('game');
        if (this.elements.inputField) this.elements.inputField.value = '';
        Game.startAutoSession(this.currentMode);
        const globalScore = Storage.getGlobalScore();
        Game.state.score = globalScore;
        if (this.elements.scoreDisplay) this.elements.scoreDisplay.textContent = globalScore.toLocaleString();
        this._lastAutoStage = { worldId: Game.state.worldId, stageNum: Game.state.stageNum };
        this._syncGameViewUI();
        if (this._matchViewOpen) {
            Game.sessionScore = globalScore;
            Storage.incrementMatchSession();
            Game.stop();
            MatchGame.init(document.getElementById('match-grid'));
            MatchGame.setMatchMode(Storage.getSetting('matchMode') || 'fast');
            MatchGame.setRefillMode(Storage.getSetting('matchRefillMode') || 'flow');
        }
    },

    /**
     * 마지막 세션 재시도
     */
    _retryGame: function() {
        if (this._matchViewOpen) return;
        this.showScreen('game');
        if (this.elements.inputField) this.elements.inputField.value = '';
        if (this._lastAutoStage) {
            Game.startStage(this._lastAutoStage.worldId, this._lastAutoStage.stageNum, this.currentMode);
        } else {
            Game.startAutoSession(this.currentMode);
        }
    },

    /**
     * 타이핑 ↔ 짝 잇기 게임 뷰 전환
     */
    _toggleGameView: function() {
        this._matchViewOpen = !this._matchViewOpen;
        Storage.setSetting('gameView', this._matchViewOpen ? 'match' : 'typing');
        this._syncGameViewUI();
        if (this._matchViewOpen) {
            // 타이핑 → 매치: 현재 점수 보존 후 정지
            Game.sessionScore = Game.state.score;
            Storage.setGlobalScore(Game.state.score);
            Game.stop();
            MatchGame.init(document.getElementById('match-grid'));
            MatchGame.setMatchMode(Storage.getSetting('matchMode') || 'fast');
            MatchGame.setRefillMode(Storage.getSetting('matchRefillMode') || 'flow');
        } else {
            this._startFreshGame();
        }
    },

    _syncGameViewUI: function() {
        const typingView = document.getElementById('typing-view');
        const matchView  = document.getElementById('match-view');
        const inputArea  = document.querySelector('.input-container');
        const specialBar = document.getElementById('special-chars-bar');
        const progressCt = document.querySelector('.progress-container');

        typingView?.classList.toggle('hidden', this._matchViewOpen);
        matchView?.classList.toggle('hidden', !this._matchViewOpen);
        inputArea?.classList.toggle('hidden', this._matchViewOpen);
        specialBar?.classList.toggle('hidden', this._matchViewOpen);
        progressCt?.classList.toggle('hidden', this._matchViewOpen);

    },

    /**
     * 학습 언어 설정 적용 및 저장
     * @param {string} lang - 'ko' | 'en' (또는 레거시 'es-to-ko' 등)
     */
    applyModeSetting: function(lang) {
        // 레거시 값 변환
        if (lang === 'es-to-ko' || lang === 'ko-to-es') lang = 'ko';
        if (lang === 'es-to-en' || lang === 'en-to-es') lang = 'en';
        const uiLang = lang === 'en' ? 'en' : 'ko';

        this.currentMode = uiLang === 'en' ? 'es-to-en' : 'es-to-ko';
        Storage.setSetting('mode', uiLang);

        if (this.elements.gameModeSelect) this.elements.gameModeSelect.value = uiLang;
        this.updateUILanguage(uiLang);
    },

    /**
     * UI 표시 언어 전환 (한국어 ↔ 영어)
     * @param {string} lang - 'ko' | 'en'
     */
    updateUILanguage: function(lang) {
        const isEn = lang === 'en';

        // 입력 필드 플레이스홀더
        const inputField = document.getElementById('input-field');
        if (inputField) inputField.placeholder = isEn ? 'Type your answer' : '정답을 입력하세요';

        // 게임 설정 패널 레이블
        const labelMode   = document.getElementById('settings-label-mode');
        const labelRefill = document.getElementById('settings-label-refill');
        const labelSort   = document.getElementById('settings-label-sort');
        if (labelMode)   labelMode.textContent   = isEn ? 'Learning'  : '매치 학습';
        if (labelRefill) labelRefill.textContent = isEn ? 'Refill'    : '리필 방식';
        if (labelSort)   labelSort.textContent   = isEn ? 'Layout'    : '정렬';

        // 매치 모드 버튼
        const fastBtn   = document.getElementById('match-mode-fast');
        const reviewBtn = document.getElementById('match-mode-review');
        if (fastBtn)   fastBtn.textContent   = isEn ? 'Fast'   : '빠른 학습';
        if (reviewBtn) reviewBtn.textContent = isEn ? 'Review' : '복습';

        // 리필 버튼
        const flowBtn  = document.getElementById('match-refill-flow');
        const clearBtn = document.getElementById('match-refill-clear');
        if (flowBtn)  flowBtn.textContent  = isEn ? 'Flow'  : '흐름형';
        if (clearBtn) clearBtn.textContent = isEn ? 'Clear' : '클리어형';

        // 정렬 버튼
        const messyBtn = document.getElementById('match-sort-messy');
        const cleanBtn = document.getElementById('match-sort-clean');
        if (messyBtn) messyBtn.textContent = isEn ? 'Free' : '자유 배열';
        if (cleanBtn) cleanBtn.textContent = isEn ? 'Neat' : '정돈 배열';

        // 통계 모달 섹션
        const masteryTitle = document.getElementById('stats-mastery-title');
        const masteryUnit  = document.getElementById('stats-mastery-unit');
        const progressLeft = document.getElementById('stats-progress-label-left');
        if (masteryTitle) masteryTitle.textContent = isEn ? 'Curriculum Progress' : '커리큘럼 진도';
        if (masteryUnit)  masteryUnit.textContent  = isEn ? 'stages'             : '스테이지';
        if (progressLeft) progressLeft.textContent = isEn ? 'Completed'          : '완료 스테이지';
    },

    // =========================================
    // 화면 전환
    // =========================================
    
    /**
     * 화면 전환
     * @param {string} screen - 전환할 화면 이름
     */
    showScreen: function(screen) {
        // 모든 화면 숨기기
        this.elements.loadingScreen?.classList.add('hidden');
        this.elements.loginScreen?.classList.add('hidden');
        this.elements.gameScreen?.classList.add('hidden');
        this.elements.resultScreen?.classList.add('hidden');

        // 해당 화면 표시
        switch (screen) {
            case 'loading':
                this.elements.loadingScreen?.classList.remove('hidden');
                break;

            case 'login':
                this.elements.loginScreen?.classList.remove('hidden');
                if (this._loginIsEditing) {
                    // 닉네임 변경 모드
                    this._showLoginForm('edit');
                    const profile = Storage.getProfile();
                    if (this.elements.usernameInput) {
                        this.elements.usernameInput.value = profile?.username || '';
                    }
                    setTimeout(() => this.elements.usernameInput?.focus(), 80);
                } else {
                    this._showLoginForm('login');
                    setTimeout(() => this.elements.loginEmail?.focus(), 80);
                }
                break;

            case 'game':
                this.elements.gameScreen?.classList.remove('hidden');
                // 입력 필드 포커스
                this.elements.inputField?.focus();
                break;
                
            case 'result':
                this.elements.resultScreen?.classList.remove('hidden');
                break;
        }
        
        // 현재 화면 상태 업데이트
        this.currentScreen = screen;
        
    },

    // =========================================
    // 로그인 / 프로필
    // =========================================

    /**
     * 로그인 폼 표시 전환 (login | register | edit)
     */
    _showLoginForm: function(mode) {
        document.getElementById('form-login')?.classList.toggle('hidden', mode !== 'login');
        document.getElementById('form-register')?.classList.toggle('hidden', mode !== 'register');
        document.getElementById('form-edit-name')?.classList.toggle('hidden', mode !== 'edit');
        document.getElementById('auth-tabs')?.classList.toggle('hidden', mode === 'edit');

        // 탭 active 상태 동기화
        document.getElementById('tab-login')?.classList.toggle('active', mode === 'login');
        document.getElementById('tab-register')?.classList.toggle('active', mode === 'register');
    },

    /**
     * 탭 전환
     */
    _switchAuthTab: function(tab) {
        this._showLoginForm(tab);
        if (tab === 'login') setTimeout(() => this.elements.loginEmail?.focus(), 50);
        else setTimeout(() => this.elements.registerEmail?.focus(), 50);
    },

    /**
     * 이메일/비밀번호 로그인 처리
     */
    handleLogin: async function() {
        const email = this.elements.loginEmail?.value.trim();
        const password = this.elements.loginPassword?.value;
        const errorEl = document.getElementById('login-error');

        if (errorEl) errorEl.classList.add('hidden');
        if (this.elements.loginBtn) this.elements.loginBtn.disabled = true;

        try {
            const user = await AuthClient.login(email, password);
            Storage.saveProfile({ username: user.username });
            await AuthClient.syncAfterLogin();
            this._startFreshGame();
        } catch (err) {
            if (errorEl) { errorEl.textContent = err.message; errorEl.classList.remove('hidden'); }
        } finally {
            if (this.elements.loginBtn) this.elements.loginBtn.disabled = false;
        }
    },

    /**
     * 회원가입 처리
     */
    _sanitizeUsername: function(raw) {
        if (!raw || typeof raw !== 'string') return '';
        return raw.replace(/[<>&"'/\\]/g, '').trim().slice(0, 20);
    },

    handleRegister: async function() {
        const username = this._sanitizeUsername(this.elements.registerUsername?.value);
        const email = this.elements.registerEmail?.value.trim();
        const password = this.elements.registerPassword?.value;
        const errorEl = document.getElementById('register-error');

        if (errorEl) errorEl.classList.add('hidden');
        if (this.elements.registerBtn) this.elements.registerBtn.disabled = true;

        try {
            const user = await AuthClient.register(email, password, username);
            Storage.saveProfile({ username: user.username });
            await AuthClient.syncAfterLogin();
            this._startFreshGame();
        } catch (err) {
            if (errorEl) { errorEl.textContent = err.message; errorEl.classList.remove('hidden'); }
        } finally {
            if (this.elements.registerBtn) this.elements.registerBtn.disabled = false;
        }
    },

    /**
     * 닉네임 변경 처리
     */
    handleEditName: async function() {
        const input = this.elements.usernameInput;
        const username = this._sanitizeUsername(input?.value) || 'Player';

        Storage.saveProfile({ username }); // localStorage + 서버 동기화
        this._loginIsEditing = false;
        this._startFreshGame();
    },

    /**
     * 닉네임 변경 모드로 로그인 화면 열기
     */
    openLoginForEdit: function() {
        this._loginIsEditing = true;
        this.showScreen('login');
    },

    // =========================================
    // 키보드 입력 처리
    // =========================================
    
    /**
     * 게임 중 키보드 입력 처리
     * @param {KeyboardEvent} e - 키보드 이벤트
     */
    handleGameKeydown: function(e) {
        // 입력 필드가 포커스되어 있으면 직접 처리하지 않음
        if (document.activeElement === this.elements.inputField) {
            return;
        }

        // 게임에 키 입력 전달
        Game.handleKeyInput(e.key);
    },

    /**
     * 특수문자를 현재 입력 필드에 삽입
     * @param {string} char - 삽입할 특수문자
     */
    insertSpecialChar: function(char) {
        const field = this.elements.inputField;
        if (!field) return;

        const start = field.selectionStart;
        const end = field.selectionEnd;
        const current = field.value;

        // 커서 위치에 문자 삽입
        field.value = current.slice(0, start) + char + current.slice(end);

        // 커서를 삽입된 문자 뒤로 이동
        const newPos = start + char.length;
        field.setSelectionRange(newPos, newPos);

        // Game 상태 동기화
        Game.setInput(field.value);
    },

    // =========================================
    // UI 업데이트
    // =========================================
    
    /**
     * 게임 UI 업데이트
     * @param {Object} state - 게임 상태
     */
    updateGameUI: function(state) {
        // 점수
        if (this.elements.scoreDisplay) {
            this.elements.scoreDisplay.textContent = state.score.toLocaleString();
        }
        
        // 라이프 (하트로 표시)
        if (this.elements.livesDisplay) {
            let hearts = '';
            for (let i = 0; i < CONFIG.GAME.INITIAL_LIVES; i++) {
                hearts += i < state.lives ? '♥' : '♡';
            }
            this.elements.livesDisplay.textContent = hearts;
        }
        
        // 콤보
        if (this.elements.comboDisplay) {
            if (state.combo > 1) {
                this.elements.comboDisplay.textContent = `${state.combo} COMBO`;
                this.elements.comboDisplay.classList.remove('hidden');
            } else {
                this.elements.comboDisplay.classList.add('hidden');
            }
        }
        
        // 진행도 바
        if (this.elements.progressBar) {
            this.elements.progressBar.style.width = `${state.progress}%`;
        }
        
        // 입력 필드 동기화 (카드 정답 후 초기화)
        if (this.elements.inputField && state.currentInput === '') {
            this.elements.inputField.value = '';
        }
    },
    
    // =========================================
    // 통계 모달
    // =========================================

    /**
     * 통계 모달 표시
     */
    showStatsModal: function() {
        // 닉네임 표시
        const profile = Storage.getProfile();
        const username = profile ? (profile.username || 'Player') : 'Player';
        const usernameDisplay = document.getElementById('stats-username-display');
        if (usernameDisplay) usernameDisplay.textContent = username;
        const greeting = document.getElementById('stats-greeting');
        const isEn = Storage.getSetting('mode') === 'en';
        if (greeting) greeting.textContent = isEn ? `Keep it up, ${username}!` : `${username}님, 오늘도 화이팅!`;

        const stats = Storage.getStats();

        const totalGames = stats.totalGames || 0;
        const totalScore = stats.globalScore || 0;
        const totalCorrect = stats.totalCorrect || 0;
        const totalWrong = stats.totalWrong || 0;
        const streak = stats.currentStreak || 0;

        // 값 채우기
        document.getElementById('stats-total-games').textContent = totalGames;
        document.getElementById('stats-total-score').textContent = totalScore.toLocaleString();
        document.getElementById('stats-total-correct').textContent = totalCorrect.toLocaleString();
        document.getElementById('stats-total-wrong').textContent = totalWrong.toLocaleString();
        document.getElementById('stats-streak').textContent = `${streak} days`;

        // 정확도/비율 계산
        const total = totalCorrect + totalWrong;
        const accuracy = total > 0 ? Math.round((totalCorrect / total) * 100) : 0;
        document.getElementById('stats-accuracy').textContent = `${accuracy}%`;
        const ratio = totalWrong > 0 ? `${(totalCorrect / totalWrong).toFixed(1)}:1` : `${totalCorrect}:0`;
        document.getElementById('stats-ratio').textContent = ratio;

        // 커리큘럼 진도율: 완료된 스테이지 수 / 전체 스테이지 수
        const clearedStages = Storage.getClearedStageCount();
        const totalStages = CONFIG.WORLDS.reduce((sum, w) => sum + w.stages, 0);
        const progressPct = totalStages > 0 ? Math.round((clearedStages / totalStages) * 100) : 0;
        document.getElementById('stats-cleared-count').textContent = clearedStages;
        document.getElementById('stats-total-stages').textContent = totalStages;
        document.getElementById('stats-progress-fill').style.width = `${progressPct}%`;
        const nextGoalEl = document.getElementById('stats-next-goal');
        if (nextGoalEl) nextGoalEl.textContent = `${progressPct}%`;
        this.renderUnlockedWords();

        // 최근 활동 바(간이 시각화)
        const bars = document.querySelectorAll('#stats-week-bars .bar');
        if (bars.length > 0) {
            const seed = Math.max(1, totalGames + totalCorrect + streak);
            bars.forEach((bar, i) => {
                const wave = 24 + ((seed * (i + 3)) % 68);
                bar.style.height = `${wave}%`;
                bar.style.opacity = i === bars.length - 1 ? '1' : '0.72';
            });
        }
        // 모달 표시
        document.getElementById('stats-modal').classList.remove('hidden');
    },

    /**
     * 통계 공유 텍스트 복사/공유
     */
    shareStatsSummary: async function() {
        const totalGames = document.getElementById('stats-total-games')?.textContent || '0';
        const accuracy = document.getElementById('stats-accuracy')?.textContent || '0%';
        const streak = document.getElementById('stats-streak')?.textContent || '0';
        const progress = `${document.getElementById('stats-cleared-count')?.textContent || '0'}/${document.getElementById('stats-total-stages')?.textContent || '0'}`;
        const score = document.getElementById('stats-total-score')?.textContent || '0';
        const text = `Spanish Rain 성과
- Sessions: ${totalGames}
- Score: ${score}
- Accuracy: ${accuracy}
- Streak: ${streak}
- Mastery: ${progress} correct`;

        try {
            if (navigator.share) {
                await navigator.share({ title: 'Spanish Rain Stats', text });
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                alert('통계 요약이 클립보드에 복사되었습니다.');
            }
        } catch (err) {
            console.warn('Stats share skipped:', err);
        }
    },

    /**
     * 통계 모달 숨기기
     */
    hideStatsModal: function() {
        document.getElementById('stats-modal').classList.add('hidden');
        document.getElementById('stats-unlocked-words')?.classList.add('hidden');
        document.querySelector('.stats-progress-section')?.classList.remove('expanded');
    },

    /**
     * 잠금 해제 단어 목록 렌더링
     */
    renderUnlockedWords: function() {
        const unlockedWordsBox = document.getElementById('stats-unlocked-words');
        if (!unlockedWordsBox) return;

        const unlockedWords = [];
        const seen = new Set();

        CONFIG.WORLDS.forEach((world) => {
            for (let stage = 1; stage <= world.stages; stage++) {
                if (!Storage.isStageUnlocked(world.id, stage)) continue;
                const words = WordManager.getStageWords(world.id, stage) || [];
                words.forEach((word) => {
                    if (!word?.es || seen.has(word.es)) return;
                    seen.add(word.es);
                    unlockedWords.push(word);
                });
            }
        });

        if (unlockedWords.length === 0) {
            unlockedWordsBox.textContent = '';
            const emptyP = document.createElement('p');
            emptyP.className = 'stats-unlocked-empty';
            emptyP.textContent = '아직 해금된 단어가 없습니다.';
            unlockedWordsBox.appendChild(emptyP);
            return;
        }

        unlockedWordsBox.textContent = '';
        unlockedWords.forEach((word) => {
            const chip = document.createElement('span');
            chip.className = 'stats-word-chip';
            const strong = document.createElement('strong');
            strong.textContent = word.es;
            const em = document.createElement('em');
            em.textContent = word.ko || '-';
            chip.appendChild(strong);
            chip.appendChild(em);
            unlockedWordsBox.appendChild(chip);
        });
    },

    /**
     * 결과 화면 표시
     * @param {Object} result - 게임 결과
     * @param {boolean} isCleared - 클리어 여부
     */
    showResult: function(result, isCleared) {
        // 화면 전환
        this.showScreen('result');
        
        // 별점 표시
        if (this.elements.resultStars) {
            this.elements.resultStars.textContent = '';
            for (let i = 0; i < 3; i++) {
                const isFilled = isCleared && i < result.stars;
                const star = document.createElement('span');
                star.className = 'star' + (isFilled ? ' filled' : '');
                star.textContent = isFilled ? '★' : '☆';
                this.elements.resultStars.appendChild(star);
            }
        }
        
        // 점수
        if (this.elements.resultScore) {
            this.elements.resultScore.textContent = result.score.toLocaleString();
        }
        
        // 정확도
        if (this.elements.resultAccuracy) {
            const accuracy = result.accuracy || 
                Math.round((result.correctCount / (result.correctCount + result.wrongCount)) * 100) || 0;
            this.elements.resultAccuracy.textContent = `${accuracy}%`;
        }
        
        // 최대 콤보
        if (this.elements.resultCombo) {
            this.elements.resultCombo.textContent = result.maxCombo || 0;
        }
        
        // 결과 타이틀
        const resultTitle = document.getElementById('result-title');
        if (resultTitle) {
            resultTitle.textContent = isCleared ? 'Round Clear!' : 'Round Over';
            resultTitle.classList.toggle('cleared', isCleared);
            resultTitle.classList.toggle('failed', !isCleared);
        }

        this.elements.nextBtn?.classList.remove('hidden');
        this.elements.retryBtn?.classList.remove('hidden');
    }
};

// =========================================
// 앱 시작
// =========================================

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
