/**
 * game.js
 * 게임 코어 로직
 * 게임 루프, 렌더링, 충돌 감지, 점수/콤보 시스템
 */

const Game = {
    // =========================================
    // 캔버스 및 컨텍스트 (초기화만, 카드 모드에선 미사용)
    // =========================================

    /** @type {HTMLCanvasElement} */
    canvas: null,

    /** @type {CanvasRenderingContext2D} */
    ctx: null,

    // =========================================
    // 게임 상태
    // =========================================

    state: {
        isRunning: false,
        isPaused: false,
        isGameOver: false,
        worldId: 1,
        stageNum: 1,
        mode: 'es-to-ko',
        score: 0,
        lives: 3,
        combo: 0,
        maxCombo: 0,
        correctCount: 0,
        wrongCount: 0,
        targetWords: 18,
        startTime: 0,
        elapsedTime: 0,
        speedModifier: 1.0
    },

    // =========================================
    // 카드 모드 상태
    // =========================================

    /** @type {Array<Object>} 카드 큐 (순서대로 보여줄 단어 목록) */
    _cardQueue: [],

    /** @type {number} 현재 카드 인덱스 */
    _cardIdx: 0,

    /** @type {Object|null} 현재 보여주는 단어 */
    _currentWord: null,

    /** @type {boolean} 힌트 표시 중 (입력 잠금) */
    _showingHint: false,

    // =========================================
    // 공용 오브젝트
    // =========================================

    /** @type {Array} 단어 풀 */
    wordPool: [],

    /** @type {string} 현재 사용자 입력 */
    currentInput: '',

    /** @type {number} 다음 단어 ID */
    nextWordId: 1,

    /** @type {number|null} requestAnimationFrame ID (미사용) */
    animationId: null,

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
    // 모드 유틸
    // =========================================

    /**
     * 모드에 따라 단어 카드에 표시할 텍스트 반환
     * es-to-ko / es-to-en → 스페인어 표시
     * ko-to-es / en-to-es → 각각 한국어 / 영어 표시
     */
    getDisplayText: function(word) {
        const mode = this.state.mode;
        if (mode === 'ko-to-es') return word.korean;
        if (mode === 'en-to-es') return word.english || word.spanish;
        return word.spanish; // es-to-ko, es-to-en
    },

    /**
     * 모드에 따라 정답 텍스트 반환 (사용자가 입력해야 하는 값)
     */
    getAnswerText: function(word) {
        const mode = this.state.mode;
        if (mode === 'es-to-ko' || mode === 'ko-to-es') return word.korean;
        if (mode === 'es-to-en' || mode === 'en-to-es') return word.english || '';
        return word.korean;
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
        // 상태 초기화
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
            speedModifier: 1.0
        };

        // 카드 상태 초기화
        this._cardQueue = [];
        this._cardIdx = 0;
        this._currentWord = null;
        this._showingHint = false;
        this.currentInput = '';
        this.nextWordId = 1;

        // 단어 풀 생성
        if (customPool) {
            this.wordPool = customPool;
        } else if (WordManager.isBossStage(worldId, stageNum)) {
            this.wordPool = WordManager.createBossPool(worldId, stageNum);
        } else if (WordManager.isReviewStage(worldId, stageNum)) {
            this.wordPool = WordManager.createReviewPool();
            if (this.wordPool.length === 0) {
                this.wordPool = WordManager.createWordPool(worldId, stageNum);
            }
        } else {
            this.wordPool = WordManager.createWordPool(worldId, stageNum);
        }

        // 카드 큐 빌드 후 첫 카드 표시
        this._buildCardQueue();
        this._showCard();

        console.log(`Game: ${customPool ? 'Review' : `스테이지 ${worldId}-${stageNum}`} 시작 (카드 모드, ${this._cardQueue.length}장)`);
    },
    
    pause: function() {
        if (this.state.isPaused || !this.state.isRunning) return;
        this.state.isPaused = true;
        console.log('Game: 일시정지');
    },

    resume: function() {
        if (!this.state.isPaused || !this.state.isRunning) return;
        this.state.isPaused = false;
        console.log('Game: 재개');
    },

    stop: function() {
        this.state.isRunning = false;
        this._showingHint = false;
        console.log('Game: 종료');
    },

    // =========================================
    // 카드 모드 핵심 로직
    // =========================================

    /**
     * wordPool에서 카드 큐 생성 (중복 제거, 셔플, targetWords개)
     */
    _buildCardQueue: function() {
        const seen = new Set();
        const unique = [];
        for (const w of this.wordPool) {
            if (!seen.has(w.es)) {
                seen.add(w.es);
                unique.push({
                    id: this.nextWordId++,
                    spanish: w.es,
                    korean: w.ko,
                    english: w.en || '',
                    isReview: w.isReview || false,
                    spawnTime: 0
                });
            }
        }
        // 셔플
        for (let i = unique.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [unique[i], unique[j]] = [unique[j], unique[i]];
        }
        this._cardQueue = unique.slice(0, this.state.targetWords);
        this.state.targetWords = this._cardQueue.length;
    },

    /**
     * 현재 카드 인덱스의 단어를 DOM에 표시
     */
    _showCard: function() {
        if (this._cardIdx >= this._cardQueue.length) {
            this.handleStageClear();
            return;
        }

        this._currentWord = this._cardQueue[this._cardIdx];
        this._currentWord.spawnTime = performance.now();

        const wordEl = document.getElementById('card-word');
        const hintEl = document.getElementById('card-hint');
        const progressEl = document.getElementById('card-progress');

        if (wordEl) wordEl.textContent = this.getDisplayText(this._currentWord);
        if (hintEl) {
            hintEl.textContent = '';
            hintEl.className = 'card-hint hidden';
        }
        if (progressEl) {
            progressEl.textContent = `${this._cardIdx + 1} / ${this._cardQueue.length}`;
        }

        if (this.onStateUpdate) this.onStateUpdate(this.getDisplayState());
    },

    /**
     * 카드 모드 정답 확인
     */
    _checkCardAnswer: function() {
        if (!this._currentWord || this._showingHint) return;
        if (this.currentInput.trim() === '') return;

        const answer = this.getAnswerText(this._currentWord);
        const isCorrect = this.answersMatch(answer, this.currentInput);
        this.currentInput = '';

        const hintEl = document.getElementById('card-hint');

        if (isCorrect) {
            this.handleCorrectAnswer(this._currentWord);
            if (hintEl) {
                hintEl.textContent = `✓ ${answer}`;
                hintEl.className = 'card-hint card-hint-correct';
            }
            if (this.onStateUpdate) this.onStateUpdate(this.getDisplayState());
            this._showingHint = true;
            setTimeout(() => {
                if (!this.state.isRunning) return;
                this._showingHint = false;
                this._cardIdx++;
                this._showCard();
            }, 500);
        } else {
            // 오답: 감점, 라이프 감소, 정답 힌트 표시 후 다음 카드
            const penalty = Math.floor(CONFIG.GAME.BASE_SCORE * 0.5);
            this.state.score = Math.max(0, this.state.score - penalty);
            this.state.lives = Math.max(0, this.state.lives - 1);
            this.state.combo = 0;
            this.state.wrongCount++;
            Storage.recordWrongWord(this._currentWord.spanish, this._currentWord.korean);

            if (hintEl) {
                hintEl.textContent = `✗  ${answer}`;
                hintEl.className = 'card-hint card-hint-wrong';
            }
            if (this.onStateUpdate) this.onStateUpdate(this.getDisplayState());

            if (this.state.lives <= 0) {
                this._showingHint = true;
                setTimeout(() => this.handleGameOver(), 1200);
                return;
            }

            this._showingHint = true;
            setTimeout(() => {
                if (!this.state.isRunning) return;
                this._showingHint = false;
                this._cardIdx++;
                this._showCard();
            }, 1200);
        }
    },

    // =========================================
    // 입력 처리
    // =========================================
    
    /**
     * 키 입력 처리
     */
    handleKeyInput: function(key) {
        if (!this.state.isRunning || this.state.isPaused) return;
        if (key === 'Backspace') {
            this.currentInput = this.currentInput.slice(0, -1);
        } else if (key === 'Enter') {
            this.checkAnswer();
        } else if (key.length === 1) {
            this.currentInput += key;
        }
    },

    /**
     * 직접 입력값 설정 (모바일 IME용)
     */
    setInput: function(value) {
        this.currentInput = value;
    },
    
    /**
     * 정답 체크 (카드 모드)
     */
    checkAnswer: function() {
        if (!this.state.isRunning || this.state.isPaused) return;
        this._checkCardAnswer();
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
     * 영어 숫자 단어 ↔ 아라비아 숫자 매핑
     */
    ENGLISH_NUMBERS: {
        'zero': '0',
        'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
        'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
        'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
        'fourteen': '14', 'fifteen': '15', 'sixteen': '16',
        'seventeen': '17', 'eighteen': '18', 'nineteen': '19',
        'twenty': '20', 'thirty': '30', 'forty': '40', 'fifty': '50',
        'sixty': '60', 'seventy': '70', 'eighty': '80', 'ninety': '90',
        'one hundred': '100', 'a hundred': '100',
        'one thousand': '1000', 'a thousand': '1000'
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

        // 영어 숫자 단어 ↔ 아라비아 숫자
        // 예: answer="twelve", input="12"
        const answerAsDigitEn = this.ENGLISH_NUMBERS[normAnswer];
        if (answerAsDigitEn !== undefined && answerAsDigitEn === normInput) return true;
        const inputAsDigitEn = this.ENGLISH_NUMBERS[normInput];
        if (inputAsDigitEn !== undefined && inputAsDigitEn === normAnswer) return true;

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
    // 상태 조회
    // =========================================

    /**
     * UI 표시용 상태 가져오기
     * @returns {Object} 표시용 상태 객체
     */
    getDisplayState: function() {
        const total = this._cardQueue.length || 1;
        return {
            score: this.state.score,
            lives: this.state.lives,
            combo: this.state.combo,
            progress: Math.min(Math.round((this._cardIdx / total) * 100), 100),
            currentInput: this.currentInput,
            isRunning: this.state.isRunning,
            isPaused: this.state.isPaused,
            speedModifier: 1.0
        };
    }
};

// 모듈 내보내기 (ES6 모듈 사용 시)
// export { Game };
