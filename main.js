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
        closeModalBtn: null
    },

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
        
        // 맵 화면으로 전환
        this.showScreen('map');
        
        console.log('App: 초기화 완료');
    },
    
    /**
     * DOM 요소 캐싱
     */
    cacheElements: function() {
        // 화면 컨테이너
        this.elements.loadingScreen = document.getElementById('loading-screen');
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
    },
    
    /**
     * 이벤트 리스너 바인딩
     */
    bindEvents: function() {
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
            
            // 엔터 키 처리
            this.elements.inputField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    Game.checkAnswer();
                    this.elements.inputField.value = '';
                }
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
                this.currentMode = e.target.value;
            });
        }
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
        this.elements.mapScreen?.classList.add('hidden');
        this.elements.gameScreen?.classList.add('hidden');
        this.elements.resultScreen?.classList.add('hidden');
        
        // 해당 화면 표시
        switch (screen) {
            case 'loading':
                this.elements.loadingScreen?.classList.remove('hidden');
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
            this.elements.modalTitle.textContent = 
                `Stage ${worldId}-${stageNum}`;
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
     * 단어 참조 패널 채우기
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

        const buildHTML = (wordArr) => wordArr.map(w =>
            `<div class="word-pair"><span class="word-es">${w.es}</span><span class="word-arrow">&rarr;</span><span class="word-ko">${w.ko}</span></div>`
        ).join('');

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
        
        // 다음 버튼 표시/숨기기
        if (this.elements.nextBtn) {
            this.elements.nextBtn.classList.toggle('hidden', !isCleared);
        }
        
        // 결과 타이틀
        const resultTitle = document.getElementById('result-title');
        if (resultTitle) {
            resultTitle.textContent = isCleared ? 'Stage Clear!' : 'Game Over';
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
