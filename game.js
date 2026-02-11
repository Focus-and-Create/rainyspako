/**
 * game.js
 * 게임 코어 로직
 * 게임 루프, 렌더링, 충돌 감지, 점수/콤보 시스템
 */

const Game = {
    // =========================================
    // 캔버스 및 컨텍스트
    // =========================================
    
    /** @type {HTMLCanvasElement} */
    canvas: null,
    
    /** @type {CanvasRenderingContext2D} */
    ctx: null,

    // =========================================
    // 게임 상태
    // =========================================
    
    state: {
        isRunning: false,              // 게임 실행 중 여부
        isPaused: false,               // 일시정지 여부
        isGameOver: false,             // 게임 오버 여부
        
        // 현재 스테이지 정보
        worldId: 1,
        stageNum: 1,
        mode: 'es-to-ko',              // 'es-to-ko' 또는 'ko-to-es'
        
        // 게임 진행 상태
        score: 0,                      // 현재 점수
        lives: 3,                      // 남은 라이프
        combo: 0,                      // 현재 콤보
        maxCombo: 0,                   // 최대 콤보
        correctCount: 0,               // 정답 수
        wrongCount: 0,                 // 오답 수
        
        // 클리어 조건
        targetWords: 15,               // 클리어에 필요한 정답 수
        
        // 시간 추적
        startTime: 0,                  // 게임 시작 시간
        elapsedTime: 0,                // 경과 시간 (밀리초)
        lastSpawnTime: 0,              // 마지막 단어 생성 시간
        
        // 현재 속도 (스테이지 진행에 따라 증가)
        currentSpeed: 0.5
    },

    // =========================================
    // 게임 오브젝트
    // =========================================
    
    /** @type {Array<Object>} 화면에 떨어지는 단어들 */
    activeWords: [],
    
    /** @type {Array} 단어 풀 (가중치 적용된 선택 대상) */
    wordPool: [],
    
    /** @type {string} 현재 사용자 입력 */
    currentInput: '',
    
    /** @type {number} 다음 단어 ID */
    nextWordId: 1,

    // =========================================
    // 애니메이션
    // =========================================
    
    /** @type {number|null} requestAnimationFrame ID */
    animationId: null,
    
    /** @type {number} 이전 프레임 시간 */
    lastFrameTime: 0,

    // =========================================
    // 콜백
    // =========================================
    
    /** @type {Function|null} 게임 오버 콜백 */
    onGameOver: null,
    
    /** @type {Function|null} 스테이지 클리어 콜백 */
    onStageClear: null,
    
    /** @type {Function|null} 상태 업데이트 콜백 (UI 갱신용) */
    onStateUpdate: null,

    // =========================================
    // 초기화
    // =========================================
    
    /**
     * 게임 초기화
     * @param {HTMLCanvasElement} canvas - 게임 캔버스 요소
     */
    init: function(canvas) {
        // 캔버스 및 컨텍스트 저장
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // 캔버스 크기 설정
        this.canvas.width = CONFIG.CANVAS.WIDTH;
        this.canvas.height = CONFIG.CANVAS.HEIGHT;
        
        // 폰트 설정
        this.ctx.font = `${CONFIG.RENDER.WORD_FONT_SIZE}px ${CONFIG.RENDER.FONT_FAMILY}`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        console.log('Game: 초기화 완료');
    },

    // =========================================
    // 게임 시작/종료
    // =========================================
    
    /**
     * 스테이지 시작
     * @param {number} worldId - 월드 ID
     * @param {number} stageNum - 스테이지 번호
     * @param {string} mode - 게임 모드 ('es-to-ko' 또는 'ko-to-es')
     */
    startStage: function(worldId, stageNum, mode = 'es-to-ko') {
        // 상태 초기화
        this.state = {
            isRunning: true,
            isPaused: false,
            isGameOver: false,
            worldId: worldId,
            stageNum: stageNum,
            mode: mode,
            score: 0,
            lives: CONFIG.GAME.INITIAL_LIVES,
            combo: 0,
            maxCombo: 0,
            correctCount: 0,
            wrongCount: 0,
            targetWords: CONFIG.STAGE.WORDS_TO_CLEAR,
            startTime: performance.now(),
            elapsedTime: 0,
            lastSpawnTime: 0,
            currentSpeed: getWorldConfig(worldId).baseSpeed
        };
        
        // 게임 오브젝트 초기화
        this.activeWords = [];
        this.currentInput = '';
        this.nextWordId = 1;
        
        // 단어 풀 생성
        if (WordManager.isReviewStage(worldId, stageNum)) {
            // 복습 스테이지
            this.wordPool = WordManager.createReviewPool();
            
            // 복습 단어가 부족하면 일반 스테이지로 진행
            if (this.wordPool.length === 0) {
                this.wordPool = WordManager.createWordPool(worldId, stageNum);
            }
        } else {
            // 일반 스테이지
            this.wordPool = WordManager.createWordPool(worldId, stageNum);
        }
        
        // 게임 루프 시작
        this.lastFrameTime = performance.now();
        this.gameLoop();
        
        console.log(`Game: 스테이지 ${worldId}-${stageNum} 시작 (모드: ${mode})`);
    },
    
    /**
     * 게임 일시정지
     */
    pause: function() {
        // 이미 정지 상태면 무시
        if (this.state.isPaused || !this.state.isRunning) {
            return;
        }
        
        this.state.isPaused = true;
        
        // 애니메이션 중지
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        console.log('Game: 일시정지');
    },
    
    /**
     * 게임 재개
     */
    resume: function() {
        // 정지 상태가 아니면 무시
        if (!this.state.isPaused || !this.state.isRunning) {
            return;
        }
        
        this.state.isPaused = false;
        
        // 시간 보정 (정지 시간 제외)
        this.lastFrameTime = performance.now();
        
        // 게임 루프 재개
        this.gameLoop();
        
        console.log('Game: 재개');
    },
    
    /**
     * 게임 종료
     */
    stop: function() {
        this.state.isRunning = false;
        
        // 애니메이션 중지
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        console.log('Game: 종료');
    },

    // =========================================
    // 게임 루프
    // =========================================
    
    /**
     * 메인 게임 루프
     */
    gameLoop: function() {
        // 실행 중이 아니거나 정지 상태면 중단
        if (!this.state.isRunning || this.state.isPaused) {
            return;
        }
        
        // 현재 시간
        const now = performance.now();
        
        // 델타 타임 계산 (프레임 간 시간차, 초 단위)
        const deltaTime = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;
        
        // 경과 시간 업데이트
        this.state.elapsedTime = now - this.state.startTime;
        
        // 게임 로직 업데이트
        this.update(deltaTime, now);
        
        // 렌더링
        this.render();
        
        // UI 상태 콜백 호출
        if (this.onStateUpdate) {
            this.onStateUpdate(this.getDisplayState());
        }
        
        // 다음 프레임 예약
        this.animationId = requestAnimationFrame(() => this.gameLoop());
    },
    
    /**
     * 게임 로직 업데이트
     * @param {number} deltaTime - 프레임 간 시간차 (초)
     * @param {number} now - 현재 시간 (밀리초)
     */
    update: function(deltaTime, now) {
        // 스테이지 진행률 계산 (0~1)
        const progressRatio = this.state.correctCount / this.state.targetWords;
        
        // 속도 업데이트 (진행에 따라 증가)
        this.state.currentSpeed = calculateSpeed(
            this.state.worldId,
            this.state.stageNum,
            progressRatio
        );
        
        // 새 단어 생성 체크
        this.trySpawnWord(now);
        
        // 단어 위치 업데이트
        this.updateWords(deltaTime);
        
        // 클리어 조건 체크
        if (this.state.correctCount >= this.state.targetWords) {
            this.handleStageClear();
        }
    },
    
    /**
     * 단어 생성 시도
     * @param {number} now - 현재 시간
     */
    trySpawnWord: function(now) {
        // 진행률에 따른 생성 간격 계산
        const progressRatio = this.state.correctCount / this.state.targetWords;
        const spawnInterval = Math.max(
            CONFIG.STAGE.MIN_SPAWN_INTERVAL_MS,
            CONFIG.STAGE.SPAWN_INTERVAL_MS * (1 - progressRatio * 0.5)
        );
        
        // 생성 간격 체크
        if (now - this.state.lastSpawnTime < spawnInterval) {
            return;
        }
        
        // 최대 동시 단어 수 체크
        if (this.activeWords.length >= CONFIG.STAGE.MAX_ACTIVE_WORDS) {
            return;
        }
        
        // 현재 화면의 단어 목록 (중복 방지)
        const currentWords = this.activeWords.map(w => w.spanish);
        
        // 랜덤 단어 선택
        const word = WordManager.pickRandomWord(this.wordPool, currentWords);
        
        // 선택 가능한 단어가 없으면 스킵
        if (!word) {
            return;
        }
        
        // X 좌표 랜덤 계산 (여백 고려)
        const margin = 100;
        const x = margin + Math.random() * (CONFIG.CANVAS.WIDTH - margin * 2);
        
        // 단어 오브젝트 생성
        const wordObj = {
            id: this.nextWordId++,
            spanish: word.es,
            korean: word.ko,
            x: x,
            y: -30,                        // 화면 위에서 시작
            speed: this.state.currentSpeed,
            matched: '',                   // 매칭된 글자
            isReview: word.isReview,       // 복습 단어 여부
            spawnTime: now                 // 생성 시간 (속도 보너스 계산용)
        };
        
        // 활성 단어 목록에 추가
        this.activeWords.push(wordObj);
        
        // 생성 시간 기록
        this.state.lastSpawnTime = now;
    },
    
    /**
     * 단어 위치 업데이트
     * @param {number} deltaTime - 프레임 간 시간차
     */
    updateWords: function(deltaTime) {
        // 제거할 단어 인덱스 추적
        const toRemove = [];
        
        // 모든 활성 단어 순회
        this.activeWords.forEach((word, index) => {
            // Y 좌표 업데이트 (속도 * 60fps 기준 보정)
            word.y += word.speed * deltaTime * 60;
            
            // 데스라인 도달 체크
            if (word.y >= CONFIG.CANVAS.DEATH_LINE_Y) {
                // 단어 놓침 처리
                this.handleMissedWord(word);
                toRemove.push(index);
            }
        });
        
        // 놓친 단어 제거 (역순으로 제거해야 인덱스 유지)
        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.activeWords.splice(toRemove[i], 1);
        }
    },

    // =========================================
    // 입력 처리
    // =========================================
    
    /**
     * 키 입력 처리
     * @param {string} key - 입력된 키
     */
    handleKeyInput: function(key) {
        // 게임 실행 중이 아니면 무시
        if (!this.state.isRunning || this.state.isPaused) {
            return;
        }
        
        // 백스페이스 처리
        if (key === 'Backspace') {
            this.currentInput = this.currentInput.slice(0, -1);
            this.updateMatchedState();
            return;
        }
        
        // 엔터 처리 (현재 입력 확정)
        if (key === 'Enter') {
            this.checkAnswer();
            return;
        }
        
        // 일반 문자 입력 (한 글자씩)
        if (key.length === 1) {
            this.currentInput += key;
            this.updateMatchedState();
        }
    },
    
    /**
     * 직접 입력값 설정 (모바일 IME용)
     * @param {string} value - 입력값
     */
    setInput: function(value) {
        this.currentInput = value;
        this.updateMatchedState();
    },
    
    /**
     * 매칭 상태 업데이트
     */
    updateMatchedState: function() {
        // 모드에 따라 비교 대상 결정
        const isEsToKo = this.state.mode === 'es-to-ko';
        
        // 각 단어의 매칭 상태 업데이트
        this.activeWords.forEach(word => {
            // 비교할 정답
            const answer = isEsToKo ? word.korean : word.spanish;
            
            // 현재 입력이 정답의 시작 부분과 일치하는지 확인
            if (answer.startsWith(this.currentInput)) {
                word.matched = this.currentInput;
            } else {
                word.matched = '';
            }
        });
    },
    
    /**
     * 정답 체크
     */
    checkAnswer: function() {
        // 입력이 비어있으면 무시
        if (this.currentInput.trim() === '') {
            return;
        }
        
        // 모드에 따라 비교 대상 결정
        const isEsToKo = this.state.mode === 'es-to-ko';
        
        // 정답인 단어 찾기
        const matchIndex = this.activeWords.findIndex(word => {
            const answer = isEsToKo ? word.korean : word.spanish;
            return answer === this.currentInput;
        });
        
        if (matchIndex >= 0) {
            // 정답 처리
            const word = this.activeWords[matchIndex];
            this.handleCorrectAnswer(word);
            
            // 단어 제거
            this.activeWords.splice(matchIndex, 1);
        } else {
            // 오답 처리
            this.handleWrongAnswer();
        }
        
        // 입력 초기화
        this.currentInput = '';
        this.updateMatchedState();
    },

    // =========================================
    // 정답/오답 처리
    // =========================================
    
    /**
     * 정답 처리
     * @param {Object} word - 정답인 단어 오브젝트
     */
    handleCorrectAnswer: function(word) {
        // 콤보 증가
        this.state.combo += 1;
        
        // 최대 콤보 갱신
        if (this.state.combo > this.state.maxCombo) {
            this.state.maxCombo = this.state.combo;
        }
        
        // 점수 계산
        let points = CONFIG.GAME.BASE_SCORE;
        
        // 콤보 보너스 적용
        const comboMultiplier = Math.min(
            1 + (this.state.combo - 1) * CONFIG.GAME.COMBO_MULTIPLIER,
            CONFIG.GAME.MAX_COMBO_MULTIPLIER
        );
        points = Math.floor(points * comboMultiplier);
        
        // 속도 보너스 (빠르게 맞췄을 때)
        const answerTime = performance.now() - word.spawnTime;
        if (answerTime < CONFIG.GAME.SPEED_BONUS_THRESHOLD) {
            points += CONFIG.GAME.SPEED_BONUS_POINTS;
        }
        
        // 점수 추가
        this.state.score += points;
        
        // 정답 카운트 증가
        this.state.correctCount += 1;
        
        // 틀린 단어였다면 복습 기록 갱신
        Storage.recordCorrectWord(word.spanish);
        
        console.log(`정답: ${word.spanish} (+${points}점, 콤보 ${this.state.combo})`);
    },
    
    /**
     * 오답 처리
     */
    handleWrongAnswer: function() {
        // 콤보 리셋
        this.state.combo = 0;
        
        // 오답 카운트 증가
        this.state.wrongCount += 1;
        
        console.log('오답');
    },
    
    /**
     * 단어 놓침 처리
     * @param {Object} word - 놓친 단어 오브젝트
     */
    handleMissedWord: function(word) {
        // 라이프 감소
        this.state.lives -= 1;
        
        // 콤보 리셋
        this.state.combo = 0;
        
        // 오답 카운트 증가
        this.state.wrongCount += 1;
        
        // 틀린 단어 기록
        Storage.recordWrongWord(word.spanish, word.korean);
        
        console.log(`놓침: ${word.spanish} (라이프 ${this.state.lives})`);
        
        // 게임 오버 체크
        if (this.state.lives <= 0) {
            this.handleGameOver();
        }
    },

    // =========================================
    // 게임 종료 처리
    // =========================================
    
    /**
     * 스테이지 클리어 처리
     */
    handleStageClear: function() {
        // 게임 정지
        this.stop();
        
        // 별점 계산
        const stars = this.calculateStars();
        
        // 결과 저장
        const stageId = getStageId(this.state.worldId, this.state.stageNum);
        Storage.saveStageResult(stageId, stars, this.state.score);
        
        // 통계 업데이트
        Storage.updateStats(
            this.state.score,
            this.state.correctCount,
            this.state.wrongCount
        );
        
        console.log(`스테이지 클리어! 별 ${stars}개, 점수 ${this.state.score}`);
        
        // 콜백 호출
        if (this.onStageClear) {
            this.onStageClear({
                worldId: this.state.worldId,
                stageNum: this.state.stageNum,
                stars: stars,
                score: this.state.score,
                maxCombo: this.state.maxCombo,
                accuracy: this.calculateAccuracy(),
                elapsedTime: this.state.elapsedTime
            });
        }
    },
    
    /**
     * 게임 오버 처리
     */
    handleGameOver: function() {
        // 상태 설정
        this.state.isGameOver = true;
        
        // 게임 정지
        this.stop();
        
        // 통계 업데이트 (점수는 저장하지 않음)
        Storage.updateStats(
            0,
            this.state.correctCount,
            this.state.wrongCount
        );
        
        console.log('게임 오버');
        
        // 콜백 호출
        if (this.onGameOver) {
            this.onGameOver({
                worldId: this.state.worldId,
                stageNum: this.state.stageNum,
                score: this.state.score,
                correctCount: this.state.correctCount,
                wrongCount: this.state.wrongCount
            });
        }
    },

    // =========================================
    // 점수 계산
    // =========================================
    
    /**
     * 정확도 계산
     * @returns {number} 정확도 (0-100)
     */
    calculateAccuracy: function() {
        // 총 시도 횟수
        const total = this.state.correctCount + this.state.wrongCount;
        
        // 시도 없으면 100%
        if (total === 0) {
            return 100;
        }
        
        // 정확도 계산
        return Math.round((this.state.correctCount / total) * 100);
    },
    
    /**
     * 별점 계산
     * @returns {number} 별 개수 (1-3)
     */
    calculateStars: function() {
        const accuracy = this.calculateAccuracy();
        
        // 3성: 100% 정확도
        if (accuracy >= CONFIG.STARS.THREE_STAR_ACCURACY) {
            return 3;
        }
        
        // 2성: 90% 이상
        if (accuracy >= CONFIG.STARS.TWO_STAR_ACCURACY) {
            return 2;
        }
        
        // 1성: 클리어
        return 1;
    },

    // =========================================
    // 렌더링
    // =========================================
    
    /**
     * 화면 렌더링
     */
    render: function() {
        const ctx = this.ctx;
        
        // 배경 클리어
        ctx.fillStyle = CONFIG.CANVAS.BACKGROUND_COLOR;
        ctx.fillRect(0, 0, CONFIG.CANVAS.WIDTH, CONFIG.CANVAS.HEIGHT);
        
        // 데스라인 표시 (희미하게)
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(0, CONFIG.CANVAS.DEATH_LINE_Y);
        ctx.lineTo(CONFIG.CANVAS.WIDTH, CONFIG.CANVAS.DEATH_LINE_Y);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // 떨어지는 단어들 렌더링
        this.renderWords();
        
        // 현재 입력 표시
        this.renderInput();
    },
    
    /**
     * 단어 렌더링
     */
    renderWords: function() {
        const ctx = this.ctx;
        const isEsToKo = this.state.mode === 'es-to-ko';
        
        // 폰트 설정
        ctx.font = `${CONFIG.RENDER.WORD_FONT_SIZE}px ${CONFIG.RENDER.FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 각 단어 렌더링
        this.activeWords.forEach(word => {
            // 표시할 텍스트 (모드에 따라)
            const displayText = isEsToKo ? word.spanish : word.korean;
            
            // 그림자 효과
            ctx.shadowColor = CONFIG.RENDER.WORD_SHADOW_COLOR;
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            
            // 매칭 상태에 따른 색상
            if (word.matched.length > 0) {
                // 매칭된 부분은 초록색
                ctx.fillStyle = CONFIG.RENDER.WORD_MATCHED_COLOR;
            } else {
                // 기본 흰색
                ctx.fillStyle = CONFIG.RENDER.WORD_COLOR;
            }
            
            // 복습 단어는 약간 다른 스타일 (밑줄)
            if (word.isReview) {
                ctx.fillStyle = '#ffd700'; // 금색
            }
            
            // 텍스트 그리기
            ctx.fillText(displayText, word.x, word.y);
            
            // 그림자 효과 리셋
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        });
    },
    
    /**
     * 현재 입력 렌더링
     */
    renderInput: function() {
        const ctx = this.ctx;
        
        // 입력창 배경
        const inputY = CONFIG.CANVAS.HEIGHT - 50;
        const inputWidth = 300;
        const inputHeight = 40;
        const inputX = (CONFIG.CANVAS.WIDTH - inputWidth) / 2;
        
        // 배경 박스
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(inputX, inputY - inputHeight / 2, inputWidth, inputHeight);
        
        // 테두리
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(inputX, inputY - inputHeight / 2, inputWidth, inputHeight);
        
        // 입력 텍스트
        ctx.font = `${CONFIG.RENDER.INPUT_FONT_SIZE}px ${CONFIG.RENDER.FONT_FAMILY}`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 입력이 있으면 표시, 없으면 플레이스홀더
        if (this.currentInput) {
            ctx.fillText(this.currentInput, CONFIG.CANVAS.WIDTH / 2, inputY);
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            const placeholder = this.state.mode === 'es-to-ko' 
                ? '한국어로 입력하세요' 
                : 'Escribe en español';
            ctx.fillText(placeholder, CONFIG.CANVAS.WIDTH / 2, inputY);
        }
    },

    // =========================================
    // 상태 조회
    // =========================================
    
    /**
     * UI 표시용 상태 가져오기
     * @returns {Object} 표시용 상태 객체
     */
    getDisplayState: function() {
        return {
            score: this.state.score,
            lives: this.state.lives,
            combo: this.state.combo,
            progress: Math.min(
                Math.round((this.state.correctCount / this.state.targetWords) * 100),
                100
            ),
            currentInput: this.currentInput,
            isRunning: this.state.isRunning,
            isPaused: this.state.isPaused
        };
    }
};

// 모듈 내보내기 (ES6 모듈 사용 시)
// export { Game };
