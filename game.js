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

    /** @type {Array<Object>} 화면에 표시할 피드백 메시지들 */
    feedbacks: [],

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

        // HiDPI 캔버스 설정 (Retina 디스플레이 지원)
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = CONFIG.CANVAS.WIDTH * dpr;
        this.canvas.height = CONFIG.CANVAS.HEIGHT * dpr;
        this.ctx.scale(dpr, dpr);

        // 폰트 설정
        this.ctx.font = `${CONFIG.RENDER.WORD_FONT_SIZE}px ${CONFIG.RENDER.FONT_FAMILY}`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        console.log('Game: 초기화 완료 (DPR:', dpr + ')');
    },

    // =========================================
    // 게임 시작/종료
    // =========================================
    
    /**
     * 스테이지 시작
     * @param {number} worldId - 월드 ID
     * @param {number} stageNum - 스테이지 번호
     * @param {string} mode - 게임 모드 ('es-to-ko' 또는 'ko-to-es')
     * @param {Array|null} customPool - 커스텀 단어 풀 (복습 모드용)
     */
    startStage: function(worldId, stageNum, mode = 'es-to-ko', customPool = null) {
        // 적응형 속도 계수: 최근 정확도가 낮으면 느리게 시작
        let speedModifier = 1.0;
        if (!customPool) {
            const prevResult = Storage.getStageResult(getStageId(worldId, stageNum));
            if (prevResult && prevResult.lastAccuracy !== null && prevResult.lastAccuracy !== undefined) {
                const acc = prevResult.lastAccuracy;
                if (acc < 60)      speedModifier = 0.50;
                else if (acc < 75) speedModifier = 0.65;
                else if (acc < 85) speedModifier = 0.80;
                // acc >= 85: 1.0 (정상 속도)
            }
        }

        // 상태 초기화
        const worldConfig = getWorldConfig(worldId);
        this.state = {
            isRunning: true,
            isPaused: false,
            isGameOver: false,
            isReviewMode: customPool !== null,
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
            currentSpeed: worldConfig ? worldConfig.baseSpeed : 0.4,
            speedModifier: speedModifier
        };

        // 게임 오브젝트 초기화
        this.activeWords = [];
        this.currentInput = '';
        this.nextWordId = 1;
        this.feedbacks = [];

        // 단어 풀 생성
        if (customPool) {
            // 커스텀 풀 (Quick Review 등)
            this.wordPool = customPool;
        } else if (WordManager.isBossStage(worldId, stageNum)) {
            // 에피소드 보스: 누적 100단어 기반 회상
            this.wordPool = WordManager.createBossPool(worldId, stageNum);
        } else if (WordManager.isReviewStage(worldId, stageNum)) {
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

        console.log(`Game: ${customPool ? 'Review' : `스테이지 ${worldId}-${stageNum}`} 시작 (모드: ${mode})`);
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
        
        // 속도 업데이트 (진행에 따라 증가, 적응형 계수 적용)
        this.state.currentSpeed = calculateSpeed(
            this.state.worldId,
            this.state.stageNum,
            progressRatio
        ) * (this.state.speedModifier || 1.0);
        
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

        // 정규화된 입력 (구두점·공백 제거)
        const normInput = this.normalizeForMatch(this.currentInput);

        // 각 단어의 매칭 상태 업데이트
        this.activeWords.forEach(word => {
            // 비교할 정답
            const answer = isEsToKo ? word.korean : word.spanish;
            const normAnswer = this.normalizeForMatch(answer);

            // 현재 입력이 정답의 시작 부분과 일치하는지 확인
            if (normInput.length > 0 && normAnswer.startsWith(normInput)) {
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
            return this.answersMatch(answer, this.currentInput);
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
    // 답안 정규화 유틸리티
    // =========================================

    /**
     * 스페인어 숫자 단어 ↔ 아라비아 숫자 매핑
     */
    SPANISH_NUMBERS: {
        'cero': '0',
        'uno': '1', 'una': '1',
        'dos': '2', 'tres': '3', 'cuatro': '4', 'cinco': '5',
        'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9',
        'diez': '10', 'once': '11', 'doce': '12', 'trece': '13',
        'catorce': '14', 'quince': '15',
        'dieciséis': '16', 'dieciseis': '16',
        'diecisiete': '17', 'dieciocho': '18', 'diecinueve': '19',
        'veinte': '20',
        'veintiuno': '21', 'veintiún': '21', 'veintiun': '21',
        'veintidós': '22', 'veintidos': '22',
        'veintitrés': '23', 'veintitres': '23',
        'veinticuatro': '24', 'veinticinco': '25',
        'veintiséis': '26', 'veintiseis': '26',
        'veintisiete': '27', 'veintiocho': '28', 'veintinueve': '29',
        'treinta': '30', 'cuarenta': '40', 'cincuenta': '50',
        'sesenta': '60', 'setenta': '70', 'ochenta': '80', 'noventa': '90',
        'cien': '100', 'ciento': '100',
        'doscientos': '200', 'doscientas': '200',
        'trescientos': '300', 'trescientas': '300',
        'cuatrocientos': '400', 'cuatrocientas': '400',
        'quinientos': '500', 'quinientas': '500',
        'seiscientos': '600', 'seiscientas': '600',
        'setecientos': '700', 'setecientas': '700',
        'ochocientos': '800', 'ochocientas': '800',
        'novecientos': '900', 'novecientas': '900',
        'mil': '1000'
    },

    /**
     * 답안 정규화 (구두점 제거, 공백 정리, 소문자 변환)
     * @param {string} text
     * @returns {string}
     */
    normalizeForMatch: function(text) {
        return text
            .replace(/[¡¿!?.,;:'"]/g, '')  // 구두점 제거
            .replace(/\s+/g, ' ')            // 여러 공백 → 단일 공백
            .trim()
            .toLowerCase();
    },

    /**
     * 한국어 숫자 단어 ↔ 아라비아 숫자 매핑
     * (한자어 수사 + 고유어 수사 둘 다 지원)
     */
    KOREAN_NUMBERS: {
        // 한자어 (sino-Korean)
        '일': '1', '이': '2', '삼': '3', '사': '4', '오': '5',
        '육': '6', '칠': '7', '팔': '8', '구': '9', '십': '10',
        '십일': '11', '십이': '12', '십삼': '13', '십사': '14', '십오': '15',
        '십육': '16', '십칠': '17', '십팔': '18', '십구': '19',
        '이십': '20', '이십일': '21', '이십이': '22', '이십삼': '23',
        '이십사': '24', '이십오': '25', '이십육': '26', '이십칠': '27',
        '이십팔': '28', '이십구': '29',
        '삼십': '30', '사십': '40', '오십': '50',
        '육십': '60', '칠십': '70', '팔십': '80', '구십': '90',
        '백': '100', '이백': '200', '삼백': '300', '사백': '400',
        '오백': '500', '육백': '600', '칠백': '700', '팔백': '800', '구백': '900',
        '천': '1000',
        // 고유어 (native Korean 1~20)
        '하나': '1', '둘': '2', '셋': '3', '넷': '4', '다섯': '5',
        '여섯': '6', '일곱': '7', '여덟': '8', '아홉': '9', '열': '10',
        '열하나': '11', '열둘': '12', '열셋': '13', '열넷': '14', '열다섯': '15',
        '열여섯': '16', '열일곱': '17', '열여덟': '18', '열아홉': '19',
        '스물': '20', '스물하나': '21', '스물둘': '22',
    },

    /**
     * 두 답안이 동일한지 비교 (정규화 + 숫자 변환 적용)
     * @param {string} answer - 정답
     * @param {string} input - 사용자 입력
     * @returns {boolean}
     */
    answersMatch: function(answer, input) {
        const normAnswer = this.normalizeForMatch(answer);
        const normInput = this.normalizeForMatch(input);

        // 정규화 후 일치
        if (normAnswer === normInput) return true;

        // 스페인어 숫자 단어 ↔ 아라비아 숫자
        const answerAsDigitEs = this.SPANISH_NUMBERS[normAnswer];
        if (answerAsDigitEs !== undefined && answerAsDigitEs === normInput) return true;
        const inputAsDigitEs = this.SPANISH_NUMBERS[normInput];
        if (inputAsDigitEs !== undefined && inputAsDigitEs === normAnswer) return true;

        // 한국어 숫자 단어 ↔ 아라비아 숫자
        // 예: answer="십팔", input="18"  또는  answer="열여덟", input="18"
        const answerAsDigitKo = this.KOREAN_NUMBERS[normAnswer];
        if (answerAsDigitKo !== undefined && answerAsDigitKo === normInput) return true;
        const inputAsDigitKo = this.KOREAN_NUMBERS[normInput];
        if (inputAsDigitKo !== undefined && inputAsDigitKo === normAnswer) return true;

        return false;
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

        // 피드백 메시지 표시 (화면에 있는 단어 중 가장 가까운 것의 뜻 보여주기)
        const isEsToKo = this.state.mode === 'es-to-ko';
        if (this.activeWords.length > 0) {
            // 현재 입력과 가장 가까운 단어 찾기
            const hints = this.activeWords.map(w => {
                const display = isEsToKo ? w.spanish : w.korean;
                const answer = isEsToKo ? w.korean : w.spanish;
                return `${display} = ${answer}`;
            }).join('  |  ');

            this.feedbacks.push({
                text: hints,
                y: CONFIG.CANVAS.HEIGHT - 100,
                alpha: 1.0,
                time: performance.now()
            });
        }

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

        // 놓친 단어 피드백 표시
        this.feedbacks.push({
            text: `${word.spanish} = ${word.korean}`,
            y: CONFIG.CANVAS.DEATH_LINE_Y - 30,
            alpha: 1.0,
            time: performance.now()
        });

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

        // 결과 저장 (리뷰 모드가 아닐 때만 스테이지 결과 저장)
        if (!this.state.isReviewMode) {
            const stageId = getStageId(this.state.worldId, this.state.stageNum);
            Storage.saveStageResult(stageId, stars, this.state.score, this.calculateAccuracy());
        }

        // 통계 업데이트 (항상)
        Storage.updateStats(
            this.state.score,
            this.state.correctCount,
            this.state.wrongCount
        );

        console.log(`${this.state.isReviewMode ? '복습' : '스테이지'} 클리어! 별 ${stars}개, 점수 ${this.state.score}`);

        // 콜백 호출
        if (this.onStageClear) {
            this.onStageClear({
                worldId: this.state.worldId,
                stageNum: this.state.stageNum,
                stars: stars,
                score: this.state.score,
                maxCombo: this.state.maxCombo,
                accuracy: this.calculateAccuracy(),
                elapsedTime: this.state.elapsedTime,
                isReviewMode: this.state.isReviewMode
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
                wrongCount: this.state.wrongCount,
                isReviewMode: this.state.isReviewMode
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
        const W = CONFIG.CANVAS.WIDTH;
        const H = CONFIG.CANVAS.HEIGHT;

        // 배경 그라데이션 (밝고 발랄한 파스텔)
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#fff9e7');
        bgGrad.addColorStop(0.45, '#fff0f8');
        bgGrad.addColorStop(1, '#eef4ff');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // 미세한 격자 패턴 (깊이감)
        ctx.strokeStyle = 'rgba(160, 100, 200, 0.04)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 80) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        }

        // 데스라인 표시 (그라데이션 경고 영역)
        const deathY = CONFIG.CANVAS.DEATH_LINE_Y;
        const dangerGrad = ctx.createLinearGradient(0, deathY - 40, 0, deathY);
        dangerGrad.addColorStop(0, 'rgba(244, 67, 54, 0)');
        dangerGrad.addColorStop(1, 'rgba(244, 67, 54, 0.09)');
        ctx.fillStyle = dangerGrad;
        ctx.fillRect(0, deathY - 40, W, 40);

        // 데스라인
        ctx.strokeStyle = 'rgba(244, 67, 54, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(0, deathY);
        ctx.lineTo(W, deathY);
        ctx.stroke();
        ctx.setLineDash([]);

        // 떨어지는 단어들 렌더링
        this.renderWords();

        // 피드백 메시지 렌더링
        this.renderFeedbacks();

        // 현재 입력 표시
        this.renderInput();
    },
    
    /**
     * 단어 렌더링
     */
    renderWords: function() {
        const ctx = this.ctx;
        const isEsToKo = this.state.mode === 'es-to-ko';

        // 각 단어 렌더링
        this.activeWords.forEach(word => {
            const displayText = isEsToKo ? word.spanish : word.korean;
            const fontSize = CONFIG.RENDER.WORD_FONT_SIZE;

            // 배경 캡슐
            ctx.font = `bold ${fontSize}px ${CONFIG.RENDER.FONT_FAMILY}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const textWidth = ctx.measureText(displayText).width;
            const capsuleW = textWidth + 28;
            const capsuleH = fontSize + 16;
            const capsuleX = word.x - capsuleW / 2;
            const capsuleY = word.y - capsuleH / 2;
            const capsuleR = capsuleH / 2;

            // 캡슐 배경색 결정 (밝은 테마)
            let bgColor, borderColor, textColor;
            if (word.isReview) {
                bgColor = 'rgba(255, 193, 7, 0.18)';
                borderColor = 'rgba(255, 152, 0, 0.65)';
                textColor = '#e65100';
            } else if (word.matched.length > 0) {
                bgColor = 'rgba(0, 184, 148, 0.15)';
                borderColor = 'rgba(0, 184, 148, 0.7)';
                textColor = '#00695c';
            } else {
                bgColor = 'rgba(255, 255, 255, 0.82)';
                borderColor = 'rgba(160, 100, 200, 0.38)';
                textColor = '#1a1040';
            }

            // 캡슐 그리기 (둥근 사각형)
            ctx.beginPath();
            ctx.moveTo(capsuleX + capsuleR, capsuleY);
            ctx.lineTo(capsuleX + capsuleW - capsuleR, capsuleY);
            ctx.arcTo(capsuleX + capsuleW, capsuleY, capsuleX + capsuleW, capsuleY + capsuleR, capsuleR);
            ctx.arcTo(capsuleX + capsuleW, capsuleY + capsuleH, capsuleX + capsuleW - capsuleR, capsuleY + capsuleH, capsuleR);
            ctx.lineTo(capsuleX + capsuleR, capsuleY + capsuleH);
            ctx.arcTo(capsuleX, capsuleY + capsuleH, capsuleX, capsuleY + capsuleR, capsuleR);
            ctx.arcTo(capsuleX, capsuleY, capsuleX + capsuleR, capsuleY, capsuleR);
            ctx.closePath();

            ctx.fillStyle = bgColor;
            ctx.fill();
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // 텍스트 그리기
            ctx.fillStyle = textColor;
            ctx.fillText(displayText, word.x, word.y);
        });
    },
    
    /**
     * 현재 입력 렌더링
     */
    renderInput: function() {
        const ctx = this.ctx;
        const W = CONFIG.CANVAS.WIDTH;
        const H = CONFIG.CANVAS.HEIGHT;

        // 입력창 영역
        const inputY = H - 50;
        const inputWidth = 320;
        const inputHeight = 42;
        const inputX = (W - inputWidth) / 2;
        const radius = inputHeight / 2;

        // 둥근 입력창 배경
        ctx.beginPath();
        ctx.moveTo(inputX + radius, inputY - inputHeight / 2);
        ctx.lineTo(inputX + inputWidth - radius, inputY - inputHeight / 2);
        ctx.arcTo(inputX + inputWidth, inputY - inputHeight / 2, inputX + inputWidth, inputY, radius);
        ctx.arcTo(inputX + inputWidth, inputY + inputHeight / 2, inputX + inputWidth - radius, inputY + inputHeight / 2, radius);
        ctx.lineTo(inputX + radius, inputY + inputHeight / 2);
        ctx.arcTo(inputX, inputY + inputHeight / 2, inputX, inputY, radius);
        ctx.arcTo(inputX, inputY - inputHeight / 2, inputX + radius, inputY - inputHeight / 2, radius);
        ctx.closePath();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.fill();

        // 테두리 (입력이 있으면 accent 색상)
        if (this.currentInput) {
            ctx.strokeStyle = 'rgba(233, 30, 140, 0.55)';
            ctx.lineWidth = 2;
        } else {
            ctx.strokeStyle = 'rgba(160, 100, 200, 0.28)';
            ctx.lineWidth = 1.5;
        }
        ctx.stroke();

        // 입력 텍스트
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (this.currentInput) {
            ctx.font = `bold ${CONFIG.RENDER.INPUT_FONT_SIZE}px ${CONFIG.RENDER.FONT_FAMILY}`;
            ctx.fillStyle = '#1a1040';
            ctx.fillText(this.currentInput, W / 2, inputY);
        } else {
            ctx.font = `${CONFIG.RENDER.INPUT_FONT_SIZE - 4}px ${CONFIG.RENDER.FONT_FAMILY}`;
            ctx.fillStyle = 'rgba(155, 138, 176, 0.7)';
            const placeholder = this.state.mode === 'es-to-ko'
                ? '한국어로 입력하세요'
                : 'Escribe en español';
            ctx.fillText(placeholder, W / 2, inputY);
        }
    },

    /**
     * 피드백 메시지 렌더링
     */
    renderFeedbacks: function() {
        const ctx = this.ctx;
        const now = performance.now();

        // 만료된 피드백 제거 (2.5초 후 사라짐)
        this.feedbacks = this.feedbacks.filter(f => now - f.time < 2500);

        this.feedbacks.forEach(f => {
            const elapsed = now - f.time;
            f.alpha = Math.max(0, 1 - elapsed / 2500);
            f.y -= 0.25;

            ctx.save();
            ctx.globalAlpha = f.alpha;

            // 배경 박스
            ctx.font = `bold 14px ${CONFIG.RENDER.FONT_FAMILY}`;
            const textWidth = ctx.measureText(f.text).width;
            const boxW = textWidth + 24;
            const boxH = 30;
            const boxX = CONFIG.CANVAS.WIDTH / 2 - boxW / 2;
            const boxY = f.y - boxH / 2;
            const boxR = 6;

            ctx.beginPath();
            ctx.moveTo(boxX + boxR, boxY);
            ctx.lineTo(boxX + boxW - boxR, boxY);
            ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + boxR, boxR);
            ctx.arcTo(boxX + boxW, boxY + boxH, boxX + boxW - boxR, boxY + boxH, boxR);
            ctx.lineTo(boxX + boxR, boxY + boxH);
            ctx.arcTo(boxX, boxY + boxH, boxX, boxY + boxR, boxR);
            ctx.arcTo(boxX, boxY, boxX + boxR, boxY, boxR);
            ctx.closePath();

            ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // 텍스트
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#fca5a5';
            ctx.fillText(f.text, CONFIG.CANVAS.WIDTH / 2, f.y);
            ctx.restore();
        });
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
