/**
 * match-game.js
 * 단어 짝 잇기 미니게임
 * 4×5 카드 그리드, 스페인어↔한국어 짝 맞추기
 * 가랑비 모델: 리필 5쌍 중 1쌍은 새 단어, 나머지는 가중치 기반 복습
 */

const MatchGame = {
    COLS: 4,
    ROWS: 5,
    HALF: 5,       // 5쌍(10장) 소거 시 리필

    _pool: [],         // 이미 소개된 단어 풀 (가중치 기반 출제)
    _curriculum: [],   // 아직 소개되지 않은 단어 큐
    _newWord: null,    // 현재 학습 중인 새 단어
    _mastery: {},      // { spanish: 정답횟수 }
    _pairCounter: 0,

    _cards: [],
    _selected: null,
    _matchedCount: 0,
    _locked: false,
    _container: null,

    NEW_WORD_MASTERY: 3,

    // =========================================
    // 초기화
    // =========================================

    init: function(container) {
        this._container = container;
        this._buildPool();
        this._deal();
        this._render();
    },

    _getPair: function(w) {
        const mode = (typeof App !== 'undefined' && App.currentMode) ? App.currentMode : 'es-to-ko';
        if (mode === 'es-to-ko') return w.ko ? { src: w.es, tgt: w.ko } : null;
        if (mode === 'ko-to-es') return w.ko ? { src: w.ko, tgt: w.es } : null;
        if (mode === 'es-to-en') return w.en ? { src: w.es, tgt: w.en } : null;
        if (mode === 'en-to-es') return w.en ? { src: w.en, tgt: w.es } : null;
        return w.ko ? { src: w.es, tgt: w.ko } : null;
    },

    /**
     * 클리어한 스테이지 단어 → pool, 다음 스테이지 단어 → curriculum
     */
    _buildPool: function() {
        this._pool = [];
        this._curriculum = [];
        this._mastery = {};
        this._newWord = null;
        this._pairCounter = 0;

        const poolWords = [];
        let hasClearedAny = false;
        let lastCleared = null;

        for (const world of CONFIG.WORLDS) {
            for (let s = 1; s <= world.stages; s++) {
                const stageId = getStageId(world.id, s);
                const result = Storage.getStageResult(stageId);
                const cleared = result && result.stars >= 1;
                if (!cleared) {
                    // 첫 미클리어 스테이지의 단어 → curriculum
                    if (!lastCleared || (lastCleared && this._curriculum.length === 0)) {
                        const stageWords = WordManager.getStageWords(world.id, s);
                        for (const w of stageWords) {
                            if (w.es && this._getPair(w)) {
                                this._curriculum.push(w);
                            }
                        }
                    }
                    continue;
                }
                hasClearedAny = true;
                lastCleared = { worldId: world.id, stageNum: s };
                const stageWords = WordManager.getStageWords(world.id, s);
                for (const w of stageWords) {
                    if (w.es) poolWords.push(w);
                }
            }
        }

        if (!hasClearedAny) {
            const starter = WordManager.getStageWords(1, 1);
            for (const w of starter) {
                if (w.es) poolWords.push(w);
            }
        }

        // 중복 제거 + 페어 가능한 것만
        const seen = new Set();
        for (const w of poolWords) {
            if (!seen.has(w.es) && this._getPair(w)) {
                seen.add(w.es);
                this._pool.push(w);
            }
        }
        // curriculum에서 pool과 중복 제거
        this._curriculum = this._curriculum.filter(w => !seen.has(w.es));

        // 첫 번째 새 단어 소개
        this._introduceNextWord();
    },

    _introduceNextWord: function() {
        if (this._curriculum.length === 0) {
            this._newWord = null;
            return;
        }
        this._newWord = this._curriculum.shift();
        console.log(`매치 가랑비: 새 단어 소개 → ${this._newWord.es}`);
    },

    _shuffle: function(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    },

    /**
     * 가중치 기반 단어 뽑기: 많이 맞힌 단어는 덜 나옴
     */
    _drawWeighted: function(n) {
        if (this._pool.length === 0) return [];
        const result = [];
        const used = new Set();
        for (let i = 0; i < n; i++) {
            // 아직 안 뽑힌 단어만 대상
            const candidates = this._pool.filter(w => !used.has(w.es));
            if (candidates.length === 0) break;
            const weights = candidates.map(w => 1 / (1 + (this._mastery[w.es] || 0)));
            const total = weights.reduce((a, b) => a + b, 0);
            let r = Math.random() * total;
            let picked = candidates[candidates.length - 1];
            for (let j = 0; j < candidates.length; j++) {
                r -= weights[j];
                if (r <= 0) { picked = candidates[j]; break; }
            }
            result.push(picked);
            used.add(picked.es);
        }
        return result;
    },

    _makePairCards: function(words) {
        const cards = [];
        for (const w of words) {
            const pair = this._getPair(w);
            if (!pair) continue;
            const pid = this._pairCounter++;
            cards.push({ pairId: pid, type: 'src', text: pair.src, es: w.es, matched: false });
            cards.push({ pairId: pid, type: 'tgt', text: pair.tgt, es: w.es, matched: false });
        }
        return this._shuffle(cards);
    },

    /** 처음 20장 딜: 9쌍 기존 + 1쌍 새 단어 */
    _deal: function() {
        const words = [];
        // 새 단어 1쌍
        if (this._newWord && this._getPair(this._newWord)) {
            words.push(this._newWord);
        }
        // 나머지는 기존 풀에서
        const fromPool = this._drawWeighted(10 - words.length);
        words.push(...fromPool);
        this._cards = this._makePairCards(words);
        this._matchedCount = 0;
        this._selected = null;
        this._locked = false;
    },

    /** 리필: 5쌍 중 1쌍은 새 단어, 4쌍은 기존 풀 (가중치 기반) */
    _refill: function() {
        const words = [];
        // 새 단어 1쌍
        if (this._newWord && this._getPair(this._newWord)) {
            words.push(this._newWord);
        }
        // 나머지 기존 풀에서
        const fromPool = this._drawWeighted(this.HALF - words.length);
        words.push(...fromPool);
        const newCards = this._makePairCards(words);
        let ni = 0;
        for (let i = 0; i < this._cards.length; i++) {
            if (this._cards[i].matched && ni < newCards.length) {
                this._cards[i] = newCards[ni++];
            }
        }
        this._matchedCount = 0;
        this._selected = null;
        this._locked = false;
    },

    // =========================================
    // 렌더링
    // =========================================

    _render: function() {
        if (!this._container) return;
        this._container.innerHTML = '';
        this._cards.forEach((card, idx) => {
            const el = document.createElement('div');
            el.className = 'mc' + (card.type === 'tgt' ? ' mc-tgt' : ' mc-src');
            if (card.matched) el.classList.add('mc-matched');
            el.dataset.idx = idx;
            el.textContent = card.text;
            this._container.appendChild(el);
        });
    },

    _updateCard: function(idx) {
        if (!this._container) return;
        const el = this._container.querySelector(`[data-idx="${idx}"]`);
        if (!el) return;
        const card = this._cards[idx];
        el.className = 'mc' + (card.type === 'tgt' ? ' mc-tgt' : ' mc-src');
        if (card.matched) el.classList.add('mc-matched');
        if (idx === this._selected) el.classList.add('mc-selected');
        el.textContent = card.text;
    },

    // =========================================
    // 입력 처리
    // =========================================

    handleClick: function(idx) {
        if (this._locked) return;
        const card = this._cards[idx];
        if (card.matched) return;

        if (this._selected === idx) {
            this._selected = null;
            this._updateCard(idx);
            return;
        }

        if (this._selected === null) {
            this._selected = idx;
            this._updateCard(idx);
        } else {
            const prev = this._selected;
            const prevCard = this._cards[prev];
            this._selected = null;

            if (prevCard.pairId === card.pairId && prevCard.type !== card.type) {
                // 정답
                prevCard.matched = true;
                card.matched = true;
                this._updateCard(prev);
                this._updateCard(idx);
                this._matchedCount++;

                // mastery 추적
                const wordEs = card.es || prevCard.es;
                if (wordEs) {
                    this._mastery[wordEs] = (this._mastery[wordEs] || 0) + 1;

                    // 새 단어 졸업 체크
                    if (this._newWord && wordEs === this._newWord.es
                        && this._mastery[wordEs] >= this.NEW_WORD_MASTERY) {
                        this._pool.push(this._newWord);
                        console.log(`매치 가랑비: "${this._newWord.es}" 졸업 → 기존 풀 합류`);
                        this._introduceNextWord();
                    }
                }

                // 점수 지급
                if (typeof Game !== 'undefined' && Game.state) {
                    Game.state.score = (Game.state.score || 0) + CONFIG.GAME.BASE_SCORE * 2;
                    Game.sessionScore = Game.state.score;
                    Storage.setGlobalScore(Game.state.score);
                    if (typeof App !== 'undefined' && App.elements && App.elements.scoreDisplay) {
                        App.elements.scoreDisplay.textContent = Game.state.score.toLocaleString();
                    }
                }

                if (this._matchedCount >= this.HALF) {
                    this._locked = true;
                    setTimeout(() => {
                        this._refill();
                        this._render();
                    }, 600);
                }
            } else {
                // 오답
                if (typeof Game !== 'undefined' && Game.state) {
                    const penalty = CONFIG.GAME.BASE_SCORE;
                    Game.state.score = Math.max(Game.sessionScore, Game.state.score - penalty);
                    Storage.setGlobalScore(Game.state.score);
                    if (typeof App !== 'undefined' && App.elements && App.elements.scoreDisplay) {
                        App.elements.scoreDisplay.textContent = Game.state.score.toLocaleString();
                    }
                }
                this._locked = true;
                const prevEl = this._container?.querySelector(`[data-idx="${prev}"]`);
                const curEl = this._container?.querySelector(`[data-idx="${idx}"]`);
                prevEl?.classList.remove('mc-selected');
                [prevEl, curEl].forEach(el => { if (el) el.classList.add('mc-wrong'); });
                setTimeout(() => {
                    [prevEl, curEl].forEach(el => { if (el) el.classList.remove('mc-wrong'); });
                    this._locked = false;
                }, 500);
            }
        }
    },
};
