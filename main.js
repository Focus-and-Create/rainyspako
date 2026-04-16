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
        progressLabel: null,
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

        // 로그인/법적/네트워크 UI
        networkBanner: null,
        authStatus: null,
        registerConsent: null,
        openPrivacyBtn: null,
        openTermsBtn: null,
        legalModal: null,
        legalModalTitle: null,
        legalModalBody: null,
        closeLegalBtn: null,

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
        this._updateNetworkBanner();

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

        // Supabase 인증 확인 (5초 타임아웃)
        // 인증 SDK 로드 실패/설정 오류가 있어도 로딩 화면에 갇히지 않도록 안전 처리
        const authTimeout = new Promise(resolve => setTimeout(() => resolve(null), 5000));
        let user = null;
        try {
            const authInit = (typeof AuthClient !== 'undefined' && typeof AuthClient.init === 'function')
                ? AuthClient.init().catch((err) => {
                    console.warn('App: 인증 초기화 실패, 비로그인으로 계속 진행', err);
                    return null;
                })
                : Promise.resolve(null);
            user = await Promise.race([authInit, authTimeout]);
        } catch (err) {
            console.warn('App: 인증 확인 중 예외, 비로그인으로 계속 진행', err);
            user = null;
        }

        if (user) {
            // 로그인 상태: 서버 데이터 동기화 후 바로 게임 시작
            Storage.saveProfile({ username: user.username });
            const syncTimeout = new Promise(resolve => setTimeout(resolve, 5000));
            await Promise.race([AuthClient.syncAfterLogin(), syncTimeout]);
            this._startFreshGame();
        } else {
            // 미로그인/인증 실패/인증 타임아웃: 로그인 화면
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
        this.elements.progressLabel = document.getElementById('progress-label');
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

        // 로그인/법적/네트워크 UI
        this.elements.networkBanner = document.getElementById('network-banner');
        this.elements.authStatus = document.getElementById('auth-status');
        this.elements.registerConsent = document.getElementById('register-consent');
        this.elements.openPrivacyBtn = document.getElementById('open-privacy-btn');
        this.elements.openTermsBtn = document.getElementById('open-terms-btn');
        this.elements.legalModal = document.getElementById('legal-modal');
        this.elements.legalModalTitle = document.getElementById('legal-modal-title');
        this.elements.legalModalBody = document.getElementById('legal-modal-body');
        this.elements.closeLegalBtn = document.getElementById('close-legal-btn');

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
            this.elements.googleLoginBtn.addEventListener('click', async () => {
                const errorEl = document.getElementById('login-error');
                if (errorEl) errorEl.classList.add('hidden');
                this.elements.googleLoginBtn.disabled = true;
                try {
                    await AuthClient.loginWithGoogle();
                } catch (err) {
                    if (errorEl) {
                        errorEl.textContent = err.message || 'Google 로그인에 실패했습니다.';
                        errorEl.classList.remove('hidden');
                    }
                } finally {
                    this.elements.googleLoginBtn.disabled = false;
                }
            });
        }

        if (this.elements.openPrivacyBtn) {
            this.elements.openPrivacyBtn.addEventListener('click', () => this.openLegalModal('privacy'));
        }
        if (this.elements.openTermsBtn) {
            this.elements.openTermsBtn.addEventListener('click', () => this.openLegalModal('terms'));
        }
        if (this.elements.closeLegalBtn) {
            this.elements.closeLegalBtn.addEventListener('click', () => this.closeLegalModal());
        }
        this.elements.legalModal?.querySelector('.modal-backdrop')?.addEventListener('click', () => this.closeLegalModal());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elements.legalModal && !this.elements.legalModal.classList.contains('hidden')) {
                this.closeLegalModal();
            }
        });

        window.addEventListener('online', () => this._updateNetworkBanner());
        window.addEventListener('offline', () => this._updateNetworkBanner());

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
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            if (errorEl) { errorEl.textContent = '오프라인 상태입니다. 네트워크 연결 후 다시 시도해 주세요.'; errorEl.classList.remove('hidden'); }
            return;
        }
        if (this.elements.loginBtn) this.elements.loginBtn.disabled = true;

        try {
            const user = await AuthClient.login(email, password);
            Storage.saveProfile({ username: user.username });
            await AuthClient.syncAfterLogin();
            this._announceAuth('로그인 성공');
            this._startFreshGame();
        } catch (err) {
            this._announceAuth(err.message || '로그인 실패');
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

        if (!this.elements.registerConsent?.checked) {
            if (errorEl) {
                errorEl.textContent = '회원가입 전에 개인정보처리방침/이용약관 동의가 필요합니다.';
                errorEl.classList.remove('hidden');
            }
            return;
        }

        if (this.elements.registerBtn) this.elements.registerBtn.disabled = true;

        try {
            const user = await AuthClient.register(email, password, username);
            Storage.saveProfile({ username: user.username });
            await AuthClient.syncAfterLogin();
            this._announceAuth('회원가입 성공');
            this._startFreshGame();
        } catch (err) {
            this._announceAuth(err.message || '로그인 실패');
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

    _announceAuth: function(message) {
        if (this.elements.authStatus) this.elements.authStatus.textContent = message || '';
    },

    _updateNetworkBanner: function() {
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        this.elements.networkBanner?.classList.toggle('hidden', !offline);
        this.elements.loginBtn && (this.elements.loginBtn.disabled = offline);
        this.elements.registerBtn && (this.elements.registerBtn.disabled = offline);
        this.elements.googleLoginBtn && (this.elements.googleLoginBtn.disabled = offline);
        if (offline) this._announceAuth('오프라인 상태입니다. 네트워크 연결 후 다시 시도해 주세요.');
    },

    openLegalModal: function(type) {
        const docs = {
            privacy: {
                title: '개인정보처리방침',
                body: '<p>Rainy Spako는 이메일/학습 데이터를 처리합니다. (Rainy Spako processes email and learning data.)</p><ul><li>수집 항목 / Data: 이메일, 닉네임, 학습 기록</li><li>보관/파기 / Retention & Deletion: 삭제 요청 시 30일 내 파기</li><li>문의 / Contact: focre.help@gmail.com</li></ul>'
            },
            terms: {
                title: '이용약관',
                body: '<p>본 서비스는 스페인어 학습용 앱입니다. (This is a Spanish learning app.)</p><ul><li>계정 정보는 본인 책임으로 관리합니다. / Keep credentials secure.</li><li>비정상 트래픽은 제한될 수 있습니다. / Abusive traffic may be blocked.</li><li>문의 / Contact: focre.help@gmail.com</li></ul>'
            }
        };
        const doc = docs[type] || docs.privacy;
        if (this.elements.legalModalTitle) this.elements.legalModalTitle.textContent = doc.title;
        if (this.elements.legalModalBody) this.elements.legalModalBody.innerHTML = doc.body;
        this.elements.legalModal?.classList.remove('hidden');
    },

    closeLegalModal: function() {
        this.elements.legalModal?.classList.add('hidden');
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
        
        // 진행도 바 + 라벨
        if (this.elements.progressBar) {
            this.elements.progressBar.style.width = `${state.progress}%`;
        }
        if (this.elements.progressLabel) {
            this.elements.progressLabel.textContent =
                `W${state.worldId} · S${state.stageNum} · ${state.waveCorrect} / ${state.targetWords}`;
        }
        
        // 입력 필드 동기화 (카드 정답 후 초기화)
        if (this.elements.inputField && state.currentInput === '') {
            this.elements.inputField.value = '';
        }
    },
    
    // =========================================
    // 단어장 모달
    // =========================================

    /**
     * 단어장 모달 표시
     */
    showStatsModal: function() {
        // 닉네임 표시
        const profile = Storage.getProfile();
        const username = profile ? (profile.username || 'Player') : 'Player';
        const usernameDisplay = document.getElementById('stats-username-display');
        if (usernameDisplay) usernameDisplay.textContent = username;

        // 커리큘럼 진도율
        const clearedStages = Storage.getClearedStageCount();
        const totalStages = CONFIG.WORLDS.reduce((sum, w) => sum + w.stages, 0);
        const progressPct = totalStages > 0 ? Math.round((clearedStages / totalStages) * 100) : 0;
        document.getElementById('stats-cleared-count').textContent = clearedStages;
        document.getElementById('stats-total-stages').textContent = totalStages;
        document.getElementById('stats-progress-fill').style.width = `${progressPct}%`;
        const nextGoalEl = document.getElementById('stats-next-goal');
        if (nextGoalEl) nextGoalEl.textContent = `${progressPct}%`;

        // 단어 목록 렌더링
        this.renderWeakWords();
        this.renderLearnedWords();

        document.getElementById('stats-modal').classList.remove('hidden');
    },

    /**
     * 단어장 모달 숨기기
     */
    hideStatsModal: function() {
        document.getElementById('stats-modal').classList.add('hidden');
    },

    /**
     * 취약 단어 목록 렌더링 (wrongCount > 0인 단어)
     */
    renderWeakWords: function() {
        const container = document.getElementById('weak-words-list');
        const countEl = document.getElementById('weak-words-count');
        if (!container) return;

        const wrongWords = Storage.getWrongWords()
            .filter(w => w.wrongCount > 0)
            .sort((a, b) => b.wrongCount - a.wrongCount);

        if (countEl) countEl.textContent = `(${wrongWords.length})`;

        container.textContent = '';
        if (wrongWords.length === 0) {
            const p = document.createElement('p');
            p.className = 'wordbook-empty';
            p.textContent = '취약 단어가 없어요!';
            container.appendChild(p);
            return;
        }

        wrongWords.forEach((word) => {
            const chip = document.createElement('span');
            chip.className = 'wordbook-chip wordbook-chip-weak';
            const strong = document.createElement('strong');
            strong.textContent = word.es;
            const em = document.createElement('em');
            em.textContent = word.ko || '-';
            const badge = document.createElement('span');
            badge.className = 'wordbook-badge-weak';
            badge.textContent = `✕${word.wrongCount}`;
            chip.appendChild(strong);
            chip.appendChild(em);
            chip.appendChild(badge);
            container.appendChild(chip);
        });
    },

    /**
     * 배운 단어 목록 렌더링 (잠금해제된 스테이지의 단어, 숙련도 표시)
     */
    renderLearnedWords: function() {
        const container = document.getElementById('learned-words-list');
        const countEl = document.getElementById('learned-words-count');
        if (!container) return;

        // 취약 단어 set
        const wrongSet = new Map(
            Storage.getWrongWords().map(w => [w.es, w.wrongCount])
        );

        const learnedWords = [];
        const seen = new Set();

        CONFIG.WORLDS.forEach((world) => {
            for (let stage = 1; stage <= world.stages; stage++) {
                if (!Storage.isStageUnlocked(world.id, stage)) continue;
                const words = WordManager.getStageWords(world.id, stage) || [];
                words.forEach((word) => {
                    if (!word?.es || seen.has(word.es)) return;
                    seen.add(word.es);
                    learnedWords.push(word);
                });
            }
        });

        if (countEl) countEl.textContent = `(${learnedWords.length})`;

        container.textContent = '';
        if (learnedWords.length === 0) {
            const p = document.createElement('p');
            p.className = 'wordbook-empty';
            p.textContent = '아직 배운 단어가 없어요.';
            container.appendChild(p);
            return;
        }

        learnedWords.forEach((word) => {
            const isWeak = wrongSet.has(word.es) && wrongSet.get(word.es) > 0;
            const chip = document.createElement('span');
            chip.className = isWeak
                ? 'wordbook-chip wordbook-chip-weak'
                : 'wordbook-chip wordbook-chip-ok';
            const strong = document.createElement('strong');
            strong.textContent = word.es;
            const em = document.createElement('em');
            em.textContent = word.ko || '-';
            chip.appendChild(strong);
            chip.appendChild(em);
            container.appendChild(chip);
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
