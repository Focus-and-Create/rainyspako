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
    
    /** @type {Object} 현재 선택된 스테이지 정보 */
    selectedStage: {
        worldId: 1,
        stageNum: 1
    },
    
    /** @type {string} 현재 게임 모드 */
    currentMode: 'es-to-ko',

    // =========================================
    // DOM 요소 참조
    // =========================================
    
    elements: {
        // 화면 컨테이너
        loadingScreen: null,
        loginScreen: null,
        mapScreen: null,
        gameScreen: null,
        resultScreen: null,
        
        // 캔버스
        mapCanvas: null,
        gameCanvas: null,
        
        // 게임 UI
        scoreDisplay: null,
        livesDisplay: null,
        comboDisplay: null,
        progressBar: null,
        inputField: null,
        pauseBtn: null,
        
        // 결과 화면
        resultStars: null,
        resultScore: null,
        resultAccuracy: null,
        resultCombo: null,
        nextBtn: null,
        retryBtn: null,
        mapBtn: null,
        
        // 스테이지 선택 모달
        stageModal: null,
        modeSelect: null,
        startBtn: null,
        closeModalBtn: null,

        // 로그인 화면
        usernameInput: null,
        loginBtn: null,
        loginBackBtn: null,

        // 적응형 속도 배지
        slowModeBadge: null
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
        console.log('App: 초기화 시작');
        
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
            // 로딩 화면에 에러 메시지 표시
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
        
        // 맵 초기화
        StageMap.init(this.elements.mapCanvas);
        StageMap.onStageSelect = (worldId, stageNum) => {
            this.showStageModal(worldId, stageNum);
        };
        
        // 게임 초기화
        Game.init(this.elements.gameCanvas);
        Game.onStageClear = (result) => this.showResult(result, true);
        Game.onGameOver = (result) => this.showResult(result, false);
        Game.onStateUpdate = (state) => this.updateGameUI(state);
        
        // 프로필 확인 → 없으면 로그인 화면, 있으면 맵으로
        const profile = Storage.getProfile();
        if (!profile || !profile.username) {
            this.showScreen('login');
        } else {
            this.showScreen('map');
        }

        console.log('App: 초기화 완료');
    },
    
    /**
     * DOM 요소 캐싱
     */
    cacheElements: function() {
        // 화면 컨테이너
        this.elements.loadingScreen = document.getElementById('loading-screen');
        this.elements.loginScreen = document.getElementById('login-screen');
        this.elements.mapScreen = document.getElementById('map-screen');
        this.elements.gameScreen = document.getElementById('game-screen');
        this.elements.resultScreen = document.getElementById('result-screen');
        
        // 캔버스
        this.elements.mapCanvas = document.getElementById('map-canvas');
        this.elements.gameCanvas = document.getElementById('game-canvas');
        
        // 게임 UI
        this.elements.scoreDisplay = document.getElementById('score-display');
        this.elements.livesDisplay = document.getElementById('lives-display');
        this.elements.comboDisplay = document.getElementById('combo-display');
        this.elements.progressBar = document.getElementById('progress-bar');
        this.elements.inputField = document.getElementById('input-field');
        this.elements.pauseBtn = document.getElementById('pause-btn');
        this.elements.exitGameBtn = document.getElementById('exit-game-btn');
        
        // 결과 화면
        this.elements.resultStars = document.getElementById('result-stars');
        this.elements.resultScore = document.getElementById('result-score');
        this.elements.resultAccuracy = document.getElementById('result-accuracy');
        this.elements.resultCombo = document.getElementById('result-combo');
        this.elements.nextBtn = document.getElementById('next-btn');
        this.elements.retryBtn = document.getElementById('retry-btn');
        this.elements.mapBtn = document.getElementById('map-btn');
        
        // 스테이지 선택 모달
        this.elements.stageModal = document.getElementById('stage-modal');
        this.elements.modeSelect = document.getElementById('mode-select');
        this.elements.startBtn = document.getElementById('start-btn');
        this.elements.closeModalBtn = document.getElementById('close-modal-btn');
        this.elements.modalTitle = document.getElementById('modal-title');

        // 로그인 화면
        this.elements.usernameInput = document.getElementById('username-input');
        this.elements.loginBtn = document.getElementById('login-btn');
        this.elements.loginBackBtn = document.getElementById('login-back-btn');

        // 적응형 속도 배지
        this.elements.slowModeBadge = document.getElementById('slow-mode-badge');
        this.elements.statsModeSelect = document.getElementById('stats-mode-select');
    },
    
    /**
     * 이벤트 리스너 바인딩
     */
    bindEvents: function() {
        // 로그인 버튼
        if (this.elements.loginBtn) {
            this.elements.loginBtn.addEventListener('click', () => {
                this.handleLoginSubmit();
            });
        }

        // 로그인 입력 필드 - 엔터로 제출
        if (this.elements.usernameInput) {
            this.elements.usernameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleLoginSubmit();
                }
            });
        }

        // 로그인 화면 돌아가기 버튼
        if (this.elements.loginBackBtn) {
            this.elements.loginBackBtn.addEventListener('click', () => {
                this.showScreen('map');
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
        
        // 게임 종료 (맵으로 돌아가기) 버튼
        if (this.elements.exitGameBtn) {
            this.elements.exitGameBtn.addEventListener('click', () => {
                Game.stop();
                this.showScreen('map');
            });
        }

        // 일시정지 버튼
        if (this.elements.pauseBtn) {
            this.elements.pauseBtn.addEventListener('click', () => {
                this.togglePause();
            });
        }
        
        // 결과 화면 버튼들
        if (this.elements.nextBtn) {
            this.elements.nextBtn.addEventListener('click', () => {
                this.startNextStage();
            });
        }
        
        if (this.elements.retryBtn) {
            this.elements.retryBtn.addEventListener('click', () => {
                this.retryStage();
            });
        }
        
        if (this.elements.mapBtn) {
            this.elements.mapBtn.addEventListener('click', () => {
                this.showScreen('map');
            });
        }
        
        // 모달 버튼들
        if (this.elements.startBtn) {
            this.elements.startBtn.addEventListener('click', () => {
                this.startSelectedStage();
            });
        }
        
        if (this.elements.closeModalBtn) {
            this.elements.closeModalBtn.addEventListener('click', () => {
                this.hideStageModal();
            });
        }
        
        // 모드 선택
        if (this.elements.modeSelect) {
            this.elements.modeSelect.addEventListener('change', (e) => {
                this.applyModeSetting(e.target.value);
            });
        }

        if (this.elements.statsModeSelect) {
            this.elements.statsModeSelect.addEventListener('change', (e) => {
                this.applyModeSetting(e.target.value);
            });
        }

        // Stats 버튼
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

        const statsResumeBtn = document.getElementById('stats-resume-btn');
        if (statsResumeBtn) {
            statsResumeBtn.addEventListener('click', () => {
                this.hideStatsModal();
            });
        }

        const statsShareBtn = document.getElementById('stats-share-btn');
        if (statsShareBtn) {
            statsShareBtn.addEventListener('click', async () => {
                await this.shareStatsSummary();
            });
        }

        const statsChangeNameBtn = document.getElementById('stats-change-name-btn');
        if (statsChangeNameBtn) {
            statsChangeNameBtn.addEventListener('click', () => {
                this.hideStatsModal();
                this.openLoginForEdit();
            });
        }
    },

    /**
     * 학습 모드 설정 적용 및 저장
     * @param {string} mode
     */
    applyModeSetting: function(mode) {
        const allowed = ['es-to-ko', 'ko-to-es', 'es-to-en', 'en-to-es'];
        const nextMode = allowed.includes(mode) ? mode : 'es-to-ko';

        this.currentMode = nextMode;
        Storage.setSetting('mode', nextMode);

        if (this.elements.modeSelect) this.elements.modeSelect.value = nextMode;
        if (this.elements.statsModeSelect) this.elements.statsModeSelect.value = nextMode;
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
        this.elements.mapScreen?.classList.add('hidden');
        this.elements.gameScreen?.classList.add('hidden');
        this.elements.resultScreen?.classList.add('hidden');

        // 해당 화면 표시
        switch (screen) {
            case 'loading':
                this.elements.loadingScreen?.classList.remove('hidden');
                break;

            case 'login':
                this.elements.loginScreen?.classList.remove('hidden');
                if (!this._loginIsEditing) {
                    // 기본 상태로 초기화
                    const subtitle = document.getElementById('login-subtitle');
                    if (subtitle) subtitle.textContent = '스페인어 단어 비를 피해라!';
                    const btn = this.elements.loginBtn;
                    if (btn) btn.textContent = '시작하기';
                    this.elements.loginBackBtn?.classList.add('hidden');
                }
                setTimeout(() => this.elements.usernameInput?.focus(), 80);
                break;

            case 'map':
                this.elements.mapScreen?.classList.remove('hidden');
                // 맵 렌더링
                StageMap.render();
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
        
        console.log(`App: 화면 전환 -> ${screen}`);
    },

    // =========================================
    // 로그인 / 프로필
    // =========================================

    /**
     * 로그인 폼 제출 처리
     */
    handleLoginSubmit: function() {
        const input = this.elements.usernameInput;
        const raw = input ? input.value.trim() : '';
        const username = raw || 'Player';

        Storage.saveProfile({ username });

        // 돌아가기 버튼 숨기기
        this.elements.loginBackBtn?.classList.add('hidden');
        this._loginIsEditing = false;

        this.showScreen('map');
    },

    /**
     * 닉네임 변경 모드로 로그인 화면 열기
     */
    openLoginForEdit: function() {
        this._loginIsEditing = true;

        const subtitle = document.getElementById('login-subtitle');
        const btn = this.elements.loginBtn;
        const input = this.elements.usernameInput;

        if (subtitle) subtitle.textContent = '닉네임을 변경합니다';
        if (btn) btn.textContent = '변경하기';

        const profile = Storage.getProfile();
        if (input) input.value = profile ? (profile.username || '') : '';

        this.elements.loginBackBtn?.classList.remove('hidden');

        this.showScreen('login');
    },

    // =========================================
    // 스테이지 선택 모달
    // =========================================
    
    /**
     * 스테이지 선택 모달 표시
     * @param {number} worldId - 월드 ID
     * @param {number} stageNum - 스테이지 번호
     */
    showStageModal: function(worldId, stageNum) {
        // 선택 정보 저장
        this.selectedStage = { worldId, stageNum };
        
        // 모달 제목 업데이트
        const world = getWorldConfig(worldId);
        if (this.elements.modalTitle) {
            const category = WordManager.getStageCategory(worldId, stageNum);
            if (WordManager.isBossStage(worldId, stageNum)) {
                this.elements.modalTitle.textContent = `Stage ${worldId}-${stageNum} · BOSS · ${category}`;
            } else if (WordManager.isReviewStage(worldId, stageNum)) {
                this.elements.modalTitle.textContent = `Stage ${worldId}-${stageNum} · Review`;
            } else {
                this.elements.modalTitle.textContent = `Stage ${worldId}-${stageNum} · ${category}`;
            }
        }
        
        // 복습 스테이지 표시
        const isReview = WordManager.isReviewStage(worldId, stageNum);
        const reviewBadge = document.getElementById('review-badge');
        if (reviewBadge) {
            reviewBadge.classList.toggle('hidden', !isReview);
        }
        
        // 베스트 기록 표시
        const stageId = getStageId(worldId, stageNum);
        const result = Storage.getStageResult(stageId);
        const bestScore = document.getElementById('best-score');
        if (bestScore) {
            if (result) {
                bestScore.textContent = `Best: ${result.bestScore}점`;
            } else {
                bestScore.textContent = 'First Try!';
            }
        }
        
        // 현재 학습 모드 반영
        if (this.elements.modeSelect) {
            this.elements.modeSelect.value = this.currentMode;
        }

        // 모달 표시
        this.elements.stageModal?.classList.remove('hidden');
    },
    
    /**
     * 스테이지 선택 모달 숨기기
     */
    hideStageModal: function() {
        this.elements.stageModal?.classList.add('hidden');
    },

    // =========================================
    // 게임 제어
    // =========================================
    
    /**
     * 선택된 스테이지 시작
     */
    startSelectedStage: function() {
        // 모달 숨기기
        this.hideStageModal();

        // 단어 참조 패널 채우기
        this.populateWordPanels(
            this.selectedStage.worldId,
            this.selectedStage.stageNum
        );

        // 게임 화면으로 전환
        this.showScreen('game');

        // 입력 필드 초기화
        if (this.elements.inputField) {
            this.elements.inputField.value = '';
        }

        // 게임 시작
        Game.startStage(
            this.selectedStage.worldId,
            this.selectedStage.stageNum,
            this.currentMode
        );
    },

    /**
     * 단어 참조 패널 채우기 (단어 + 뜻 표시)
     * @param {number} worldId - 월드 ID
     * @param {number} stageNum - 스테이지 번호
     */
    populateWordPanels: function(worldId, stageNum) {
        const words = WordManager.getStageWords(worldId, stageNum);
        const leftList = document.getElementById('word-list-left');
        const rightList = document.getElementById('word-list-right');
        if (!leftList || !rightList) return;

        // 단어를 반으로 나눠서 양쪽 패널에 배치
        const mid = Math.ceil(words.length / 2);
        const leftWords = words.slice(0, mid);
        const rightWords = words.slice(mid);

        const mode = this.currentMode || 'es-to-ko';
        const buildHTML = (wordArr) => wordArr.map(w => {
            let left, right;
            if (mode === 'es-to-ko') { left = w.es; right = w.ko; }
            else if (mode === 'ko-to-es') { left = w.ko; right = w.es; }
            else if (mode === 'es-to-en') { left = w.es; right = w.en || ''; }
            else { left = w.en || ''; right = w.es; } // en-to-es
            return `<div class="word-pair"><span class="word-es">${left}</span><span class="word-arrow">→</span><span class="word-ko">${right}</span></div>`;
        }).join('');

        leftList.innerHTML = buildHTML(leftWords);
        rightList.innerHTML = buildHTML(rightWords);
    },
    
    /**
     * 현재 스테이지 재시도
     */
    retryStage: function() {
        // 단어 패널 채우기
        this.populateWordPanels(
            this.selectedStage.worldId,
            this.selectedStage.stageNum
        );

        // 게임 화면으로 전환
        this.showScreen('game');

        // 입력 필드 초기화
        if (this.elements.inputField) {
            this.elements.inputField.value = '';
        }

        // 게임 시작
        Game.startStage(
            this.selectedStage.worldId,
            this.selectedStage.stageNum,
            this.currentMode
        );
    },
    
    /**
     * 다음 스테이지 시작
     */
    startNextStage: function() {
        const { worldId, stageNum } = this.selectedStage;
        const world = getWorldConfig(worldId);
        
        // 다음 스테이지 계산
        let nextWorldId = worldId;
        let nextStageNum = stageNum + 1;
        
        // 월드의 마지막 스테이지였으면 다음 월드로
        if (nextStageNum > world.stages) {
            nextWorldId += 1;
            nextStageNum = 1;
            
            // 마지막 월드였으면 맵으로 돌아가기
            if (nextWorldId > CONFIG.WORLDS.length) {
                alert('축하합니다! 모든 스테이지를 클리어했습니다!');
                this.showScreen('map');
                return;
            }
        }
        
        // 다음 스테이지 선택
        this.selectedStage = {
            worldId: nextWorldId,
            stageNum: nextStageNum
        };
        
        // 단어 패널 채우기
        this.populateWordPanels(nextWorldId, nextStageNum);

        // 게임 화면으로 전환
        this.showScreen('game');

        // 입력 필드 초기화
        if (this.elements.inputField) {
            this.elements.inputField.value = '';
        }

        // 게임 시작
        Game.startStage(nextWorldId, nextStageNum, this.currentMode);
    },
    
    /**
     * 일시정지 토글
     */
    togglePause: function() {
        if (Game.state.isPaused) {
            Game.resume();
            if (this.elements.pauseBtn) {
                this.elements.pauseBtn.textContent = 'II';
            }
        } else {
            Game.pause();
            if (this.elements.pauseBtn) {
                this.elements.pauseBtn.textContent = '▶';
            }
        }
    },

    // =========================================
    // 키보드 입력 처리
    // =========================================
    
    /**
     * 게임 중 키보드 입력 처리
     * @param {KeyboardEvent} e - 키보드 이벤트
     */
    handleGameKeydown: function(e) {
        // ESC: 일시정지
        if (e.key === 'Escape') {
            this.togglePause();
            return;
        }

        // 일시정지 중에는 다른 입력 무시
        if (Game.state.isPaused) {
            return;
        }

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
        
        // 입력 필드 동기화
        if (this.elements.inputField &&
            document.activeElement !== this.elements.inputField) {
            this.elements.inputField.value = state.currentInput;
        }

        // 적응형 속도 배지
        if (this.elements.slowModeBadge) {
            const mod = state.speedModifier || 1.0;
            if (mod < 1.0) {
                let label;
                if (mod <= 0.5)      label = '🐢 연습 모드 ×0.5 — 천천히 익혀봐요!';
                else if (mod <= 0.65) label = '🐢 연습 모드 ×0.65 — 조금 더 연습!';
                else                  label = '🐢 연습 모드 ×0.8 — 거의 다 왔어요!';
                this.elements.slowModeBadge.textContent = label;
                this.elements.slowModeBadge.classList.remove('hidden');
            } else {
                this.elements.slowModeBadge.classList.add('hidden');
            }
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
        if (greeting) greeting.textContent = `${username}님, 오늘도 화이팅!`;

        const stats = Storage.getStats();

        const totalGames = stats.totalGames || 0;
        const totalScore = stats.totalScore || 0;
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

        // 진행률 계산
        const totalStages = CONFIG.WORLDS.reduce((sum, w) => sum + w.stages, 0);
        let clearedCount = 0;
        CONFIG.WORLDS.forEach(w => {
            for (let s = 1; s <= w.stages; s++) {
                const stageId = getStageId(w.id, s);
                const result = Storage.getStageResult(stageId);
                if (result && result.stars > 0) clearedCount++;
            }
        });
        document.getElementById('stats-cleared-count').textContent = clearedCount;
        document.getElementById('stats-total-stages').textContent = totalStages;
        const progressPct = totalStages > 0 ? Math.round((clearedCount / totalStages) * 100) : 0;
        document.getElementById('stats-progress-fill').style.width = `${progressPct}%`;

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

        if (this.elements.statsModeSelect) {
            this.elements.statsModeSelect.value = this.currentMode;
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
        const text = `Spanish Rain 성과
- Games: ${totalGames}
- Accuracy: ${accuracy}
- Streak: ${streak}
- Stage: ${progress}`;

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
            let starsHtml = '';
            for (let i = 0; i < 3; i++) {
                const isFilled = isCleared && i < result.stars;
                starsHtml += `<span class="star ${isFilled ? 'filled' : ''}">${isFilled ? '★' : '☆'}</span>`;
            }
            this.elements.resultStars.innerHTML = starsHtml;
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
        
        // 리뷰 모드 여부 확인
        const isReview = result.isReviewMode;

        // 다음 버튼 표시/숨기기 (리뷰 모드에서는 항상 숨김)
        if (this.elements.nextBtn) {
            this.elements.nextBtn.classList.toggle('hidden', !isCleared || isReview);
        }

        // 결과 타이틀
        const resultTitle = document.getElementById('result-title');
        if (resultTitle) {
            if (isReview) {
                resultTitle.textContent = isCleared ? 'Review Complete!' : 'Review Over';
            } else {
                resultTitle.textContent = isCleared ? 'Stage Clear!' : 'Game Over';
            }
            resultTitle.classList.toggle('cleared', isCleared);
            resultTitle.classList.toggle('failed', !isCleared);
        }
    }
};

// =========================================
// 앱 시작
// =========================================

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
