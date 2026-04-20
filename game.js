/**
 * game.js
 * 게임 코어 로직
 * "가랑비" 모델: 스테이지 경계 없이 연속 플레이, 복습+새 단어가 자연스럽게 흐름
 */

let _audioCtx = null;

function _initAudio() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!_audioCtx || _audioCtx.state === 'closed') {
            _audioCtx = new AudioCtx();
        }
        if (_audioCtx.state === 'suspended') _audioCtx.resume();
    } catch(e) {}
}

function speakSpanish(text) {
    console.log('[speakSpanish] called:', text, 'synth:', !!window.speechSynthesis);
    if (!window.speechSynthesis) return;
    const synth = window.speechSynthesis;

    function doSpeak() {
        synth.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        const voices = synth.getVoices();
        const esVoice = voices.find(v => /^es/i.test(v.lang));
        console.log('[speakSpanish] voices:', voices.length, 'esVoice:', esVoice?.name);
        if (esVoice) utt.voice = esVoice;
        utt.lang = esVoice ? esVoice.lang : 'es';
        utt.rate = 0.85;
        utt.volume = 1;
        synth.speak(utt);
    }

    const voices = synth.getVoices();
    if (voices.length > 0) {
        doSpeak();
    } else {
        synth.onvoiceschanged = () => { synth.onvoiceschanged = null; doSpeak(); };
        setTimeout(doSpeak, 300);
    }
}

function playErrorSound() {
    console.log('[playErrorSound] called, ctx state:', _audioCtx?.state);
    try {
        if (!_audioCtx || _audioCtx.state === 'closed') _initAudio();
        if (!_audioCtx) return;
        if (_audioCtx.state === 'suspended') _audioCtx.resume();
        const ctx = _audioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 220;
        gain.gain.value = 0.4;
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
        osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch(e){} };
    } catch(e) {
        console.error('[playErrorSound]', e);
    }
}

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
        /** 다음 스테이지 진행까지 남은 정답 수 추적용 */
        waveCorrect: 0,
        targetWords: 18,
        startTime: 0,
        elapsedTime: 0,
        speedModifier: 1.0
    },

    // =========================================
    // 카드 모드 상태
    // =========================================

    /** 전체 누적 점수 (절대 초기화되지 않음, localStorage 영속) */
    sessionScore: 0,

    /** 이번 스테이지 시작 시점의 점수 (통계 델타 계산용) */
    _stageStartScore: 0,

    /** @type {Array<Object>} 카드 큐 (순서대로 보여줄 단어 목록) */
    _cardQueue: [],

    /** @type {number} 현재 카드 인덱스 */
    _cardIdx: 0,

    /** @type {Object|null} 현재 보여주는 단어 */
    _currentWord: null,

    /** @type {boolean} 현재 카드에서 이미 오답 처리했는지 (중복 감점 방지) */
    _wrongOnCurrent: false,

    /** @type {boolean} 힌트 표시 중 (입력 잠금) */
    _showingHint: false,

    // =========================================
    // 가랑비 학습 상태
    // =========================================

    /** 세션 내 단어별 정답 횟수 { spanish: count } */
    _mastery: {},

    /** 아직 소개되지 않은 단어 큐 (커리큘럼 순서) */
    _curriculum: [],

    /** 이미 소개된 단어 풀 (가중치 기반 출제) */
    _knownPool: [],

    /** 현재 학습 중인 새 단어 (3번 맞히면 졸업) */
    _newWord: null,

    /** 최근 졸업한 단어 (최대 10개, 가중치 부스트) */
    _recentGrads: [],

    /** 새 단어 졸업에 필요한 정답 수 */
    NEW_WORD_MASTERY: 3,

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
        // 캔버스는 카드 모드에서 사용하지 않으므로 없어도 무방
        this.canvas = canvas || null;
        this.ctx = null;

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
     * 커리큘럼 자동 세션 시작 (스테이지 선택 없이)
     * @param {string} mode - 게임 모드
     */
    startAutoSession: function(mode = 'es-to-ko') {
        const stage = WordManager.findCurrentStage();
        this.startStage(stage.worldId, stage.stageNum, mode);
    },

    /**
     * 스테이지 시작
     * @param {number} worldId - 월드 ID
     * @param {number} stageNum - 스테이지 번호
     * @param {string} mode - 게임 모드 ('es-to-ko' 또는 'ko-to-es')
     * @param {Array|null} customPool - 커스텀 단어 풀 (복습 모드용)
     */
    startStage: function(worldId, stageNum, mode = 'es-to-ko', customPool = null) {
        // 처음 호출 시 localStorage에서 누적 점수 복원
        if (!this._scoreLoaded) {
            this.sessionScore = Storage.getGlobalScore();
            this._scoreLoaded = true;
        }
        this._stageStartScore = this.sessionScore;
        _initAudio();

        // 상태 초기화
        this.state = {
            isRunning: true,
            isPaused: false,
            isGameOver: false,
            isReviewMode: customPool !== null,
            worldId: worldId,
            stageNum: stageNum,
            mode: mode,
            score: this.sessionScore,
            lives: CONFIG.GAME.INITIAL_LIVES,
            combo: 0,
            maxCombo: 0,
            correctCount: 0,
            wrongCount: 0,
            waveCorrect: 0,
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

        // 가랑비 학습 상태 초기화
        this._mastery = {};
        this._curriculum = [];
        this._knownPool = [];
        this._newWord = null;
        this._recentGrads = [];

        // 단어 풀 생성 → knownPool에 넣기
        const pool = customPool || WordManager.createWordPool(worldId, stageNum);
        const seen = new Set();
        for (const w of pool) {
            if (!seen.has(w.es)) {
                seen.add(w.es);
                this._knownPool.push(w);
            }
        }
        // wordPool은 호환성을 위해 유지
        this.wordPool = this._knownPool;

        // 첫 번째 새 단어 소개 (커리큘럼이 있으면)
        this._introduceNextWord();

        // 카드 큐 빌드 후 첫 카드 표시
        this._buildCardQueue();
        this._firstRender = true;
        this._showCard();

    },

    pause: function() {
        if (this.state.isPaused || !this.state.isRunning) return;
        this.state.isPaused = true;
    },

    resume: function() {
        if (!this.state.isPaused || !this.state.isRunning) return;
        this.state.isPaused = false;
    },

    stop: function() {
        this.state.isRunning = false;
        this._showingHint = false;
    },

    // =========================================
    // 카드 모드 핵심 로직
    // =========================================

    /**
     * 초기 카드 큐 생성 (16장을 _pickNextWord로 채움)
     */
    _buildCardQueue: function() {
        this._cardQueue = [];
        for (let i = 0; i < 16; i++) {
            this._cardQueue.push(this._makeCard(this._pickNextWord()));
        }
    },

    /** 단어 객체 → 카드 객체 변환 */
    _makeCard: function(w) {
        return {
            id: this.nextWordId++,
            spanish: w.es,
            korean: w.ko,
            english: w.en || '',
            isReview: w.isReview || false,
            isNew: w._isNew || false,
            spawnTime: 0
        };
    },

    /**
     * 가중치 기반 다음 단어 선택
     * - 새 단어(학습 중): ~30% 확률로 등장
     * - 기존 단어: 가중치 = 1 / (1 + 맞힌횟수) → 많이 맞힌 단어일수록 덜 나옴
     */
    _pickNextWord: function() {
        // 새 단어가 학습 중이면 30% 확률로 새 단어 출제
        if (this._newWord && Math.random() < 0.3) {
            return { ...this._newWord, _isNew: true };
        }

        // knownPool에서 가중치 기반 랜덤 선택
        const pool = this._knownPool;
        if (pool.length === 0) {
            return this._newWord || { es: '...', ko: '...', en: '' };
        }

        // 최근 졸업 단어 Set (가중치 3배 부스트)
        const recentSet = new Set(this._recentGrads);
        const weights = pool.map(w => {
            const base = 1 / (1 + (this._mastery[w.es] || 0));
            return recentSet.has(w.es) ? base * 3 : base;
        });
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (let i = 0; i < pool.length; i++) {
            r -= weights[i];
            if (r <= 0) return pool[i];
        }
        return pool[pool.length - 1];
    },

    /**
     * 커리큘럼에서 다음 새 단어를 소개
     */
    _introduceNextWord: function() {
        if (this._curriculum.length === 0) {
            this._newWord = null;
            return;
        }
        this._newWord = this._curriculum.shift();
    },

    /**
     * 카드 그리드 렌더링
     */
    _showCard: function() {
        // 남은 카드가 16장 미만이면 _pickNextWord로 채움
        while (this._cardQueue.length - this._cardIdx < 16) {
            this._cardQueue.push(this._makeCard(this._pickNextWord()));
        }

        if (this._cardIdx >= this._cardQueue.length) {
            return;
        }

        this._currentWord = this._cardQueue[this._cardIdx];
        this._currentWord.spawnTime = performance.now();
        this._wrongOnCurrent = false;

        const container = document.getElementById('card-grid');
        if (!container) return;

        // 4×4 = 16칸 항상 채움 (남은 카드가 16장 미만이면 빈 칸으로 패딩)
        const windowEnd = Math.min(this._cardIdx + 16, this._cardQueue.length);
        const visible = this._cardQueue.slice(this._cardIdx, windowEnd);
        while (visible.length < 16) visible.push(null);

        const stagger = this._firstRender;
        container.innerHTML = visible.map((card, i) => {
            if (!card) return `<div class="cg cg-empty"></div>`;
            let cls = i === 0 ? 'cg cg-active' : 'cg cg-upcoming';
            if (card.isNew) cls += ' cg-new';
            if (stagger) cls += ' cg-stagger-in';
            const text = this.getDisplayText(card);
            // 3~4행(인덱스 8-15): 단어와 뜻 병기
            const hint = i >= 8 ? `<span class="cg-hint">${this._esc(this.getAnswerText(card))}</span>` : '';
            const delay = stagger ? ` style="animation-delay:${i * 30}ms"` : '';
            return `<div class="${cls}"${delay}><span class="cg-word">${this._esc(text)}</span>${hint}</div>`;
        }).join('');

        if (stagger) {
            this._firstRender = false;
            container.querySelectorAll('.cg-stagger-in').forEach(el => {
                el.addEventListener('animationend', function handler() {
                    el.classList.remove('cg-stagger-in');
                    el.style.animationDelay = '';
                    el.removeEventListener('animationend', handler);
                }, { once: true });
            });
        }

        if (this.onStateUpdate) this.onStateUpdate(this.getDisplayState());
    },

    /** HTML 특수문자 이스케이프 */
    _esc: function(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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

        const activeCard = document.querySelector('.cg-active');

        if (isCorrect) {
            speakSpanish(this._currentWord.spanish);
            this.handleCorrectAnswer(this._currentWord);
            if (activeCard) {
                activeCard.classList.replace('cg-active', 'cg-ok');
                activeCard.querySelector('.cg-word').textContent = `✓ ${answer}`;
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
            // 오답: 첫 번째만 감점/기록, 이후엔 그냥 재시도
            if (!this._wrongOnCurrent) {
                const penalty = Math.floor(CONFIG.GAME.BASE_SCORE * 1.5);
                this.state.score = Math.max(this._stageStartScore, this.state.score - penalty);
                this.state.combo = 0;
                this.state.wrongCount++;
                Storage.recordWrongWord(this._currentWord.spanish, this._currentWord.korean);
                this._wrongOnCurrent = true;
            }

            playErrorSound();
            if (activeCard) {
                activeCard.classList.replace('cg-active', 'cg-wrong');
                activeCard.querySelector('.cg-word').textContent = `✗ ${answer}`;
            }
            if (this.onStateUpdate) this.onStateUpdate(this.getDisplayState());

            // 정답 보여주고 같은 카드 다시 활성화 (다음 카드로 안 넘어감)
            this._showingHint = true;
            setTimeout(() => {
                if (!this.state.isRunning) return;
                this._showingHint = false;
                const card = document.querySelector('.cg-wrong');
                if (card) {
                    card.classList.replace('cg-wrong', 'cg-active');
                    card.querySelector('.cg-word').textContent = this.getDisplayText(this._currentWord);
                }
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
            .replace(/\s/g, '')              // 공백 전부 제거 (띄어쓰기 무시)
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

        // 점수 계산 (카드 모드: 기본 3배)
        let points = CONFIG.GAME.BASE_SCORE * 3;

        // 콤보 보너스 적용
        const comboMultiplier = Math.min(
            1 + (this.state.combo - 1) * CONFIG.GAME.COMBO_MULTIPLIER,
            CONFIG.GAME.MAX_COMBO_MULTIPLIER
        );
        points = Math.floor(points * comboMultiplier);

        // 속도 보너스 (빠르게 맞췄을 때)
        const answerTime = performance.now() - word.spawnTime;
        if (answerTime < CONFIG.GAME.SPEED_BONUS_THRESHOLD) {
            points += CONFIG.GAME.SPEED_BONUS_POINTS * 3;
        }

        // 점수 추가
        this.state.score += points;

        // 정답 카운트 증가
        this.state.correctCount += 1;
        this.state.waveCorrect += 1;

        // mastery 추적
        this._mastery[word.spanish] = (this._mastery[word.spanish] || 0) + 1;

        // 틀린 단어였다면 복습 기록 갱신
        Storage.recordCorrectWord(word.spanish);

        // 새 단어 졸업 체크: 3번 맞히면 knownPool에 합류 → 다음 새 단어 소개
        if (this._newWord && word.spanish === this._newWord.es
            && this._mastery[word.spanish] >= this.NEW_WORD_MASTERY) {
            this._knownPool.push(this._newWord);
            // 최근 졸업 링버퍼에 추가 (최대 10개)
            this._recentGrads.push(this._newWord.es);
            if (this._recentGrads.length > 10) this._recentGrads.shift();
            this._introduceNextWord();
        }

        // 누적 점수 영속 저장
        this.sessionScore = this.state.score;
        Storage.setGlobalScore(this.state.score);

        // 가랑비 진행: targetWords(18)개 맞출 때마다 조용히 스테이지 저장 → 다음 단어 커리큘럼에 추가
        if (this.state.waveCorrect >= this.state.targetWords) {
            this._advanceWave();
        }

    },

    /**
     * 조용한 스테이지 진행 — 게임을 멈추지 않고 현재 스테이지를 저장하고
     * 다음 스테이지 단어를 풀에 합침 (가랑비에 젖듯)
     */
    _advanceWave: function() {
        const { worldId, stageNum } = this.state;

        // 현재 스테이지 결과 조용히 저장
        if (!this.state.isReviewMode) {
            const stageId = getStageId(worldId, stageNum);
            const accuracy = this.calculateAccuracy();
            const stars = this.calculateStars();
            Storage.saveStageResult(stageId, stars, this.state.score, accuracy);

            // 통계 업데이트
            const stagePoints = this.state.score - this._stageStartScore;
            Storage.updateStats(stagePoints, this.state.targetWords, this.state.wrongCount);
        }

        // 다음 스테이지 찾기
        const next = WordManager.findNextStage(worldId, stageNum);

        // 다음 스테이지의 신규 단어만 커리큘럼에 추가 (중복 제거)
        const nextWords = WordManager.getStageWords(next.worldId, next.stageNum);
        const knownSet = new Set(this._knownPool.map(w => w.es));
        const currSet = new Set(this._curriculum.map(w => w.es));
        if (this._newWord) { knownSet.add(this._newWord.es); currSet.add(this._newWord.es); }
        for (const w of nextWords) {
            if (w.es && !knownSet.has(w.es) && !currSet.has(w.es)) {
                this._curriculum.push({
                    es: w.es, ko: w.ko,
                    en: w.en || '',
                    isReview: false
                });
            }
        }

        // 새 단어가 없으면 소개 시작
        if (!this._newWord) {
            this._introduceNextWord();
        }

        // 상태 갱신
        this.state.worldId = next.worldId;
        this.state.stageNum = next.stageNum;
        this.state.waveCorrect = 0;
        this.state.wrongCount = 0;
        this._stageStartScore = this.state.score;

    },
    

    // =========================================
    // 게임 종료 처리 (유저가 화면을 나갈 때만)
    // =========================================

    /**
     * 게임 오버 처리
     */
    handleGameOver: function() {
        // 상태 설정
        this.state.isGameOver = true;
        
        // 게임 정지
        this.stop();
        
        // 점수는 게임 오버에도 유지 (localStorage에 영속)
        this.sessionScore = this.state.score;
        Storage.setGlobalScore(this.state.score);

        // 통계 업데이트 (정답/오답 수만)
        Storage.updateStats(
            0,
            this.state.correctCount,
            this.state.wrongCount
        );
        
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
        const target = this.state.targetWords || 1;
        return {
            score: this.state.score,
            lives: this.state.lives,
            combo: this.state.combo,
            // waveCorrect 기반 진행도 (0~99%, 100%에 도달하면 _advanceWave가 리셋)
            progress: Math.min(Math.round((this.state.waveCorrect / target) * 100), 99),
            currentInput: this.currentInput,
            isRunning: this.state.isRunning,
            isPaused: this.state.isPaused,
            speedModifier: 1.0,
            worldId: this.state.worldId,
            stageNum: this.state.stageNum,
            waveCorrect: this.state.waveCorrect,
            targetWords: target,
        };
    }
};

// 모듈 내보내기 (ES6 모듈 사용 시)
// export { Game };
