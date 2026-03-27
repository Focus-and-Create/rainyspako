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

    _pool: [],         // 전체 복습 풀
    _recentPool: [],   // 최근 3스테이지 단어 풀
    _curriculum: [],   // 아직 소개되지 않은 단어 큐
    _newWord: null,    // 현재 학습 중인 새 단어
    _mastery: {},      // { spanish: 정답횟수 }
    _newWordStreak: {}, // { spanish: 연속 정답횟수 }
    _graduatedWords: {}, // { spanish: true } 현재 curriculum에서 졸업 처리된 단어
    _pairCounter: 0,

    _cards: [],
    _selected: null,
    _matchedCount: 0,
    _locked: false,
    _isRefilling: false,
    _container: null,
    _curriculumStageId: null,
    _sorted: false,
    _matchMode: 'fast',  // 'fast' = 새 단어 2개, 'review' = 복습 집중
    _refillMode: 'flow', // 'flow' = 5쌍 제거 시 리필, 'clear' = 전부 제거 시 리필
    _newWords: [],       // fast 모드에서 현재 학습 중인 새 단어들

    NEW_WORD_MASTERY: 3,
    REFILL_DELAY_MS: 1200,
    STORAGE_KEY: 'spanish_rain_match_progress_v1',

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
        this._recentPool = [];
        this._curriculum = [];
        this._mastery = {};
        this._newWordStreak = {};
        this._graduatedWords = {};
        this._newWord = null;
        this._newWords = [];
        this._pairCounter = 0;
        this._curriculumStageId = null;

        // 클리어한 스테이지를 순서대로 수집
        const clearedStages = [];  // [{worldId, stageNum, words}]
        let hasClearedAny = false;

        for (const world of CONFIG.WORLDS) {
            for (let s = 1; s <= world.stages; s++) {
                const stageId = getStageId(world.id, s);
                const result = Storage.getStageResult(stageId);
                if (result && result.stars >= 1) {
                    hasClearedAny = true;
                    const stageWords = WordManager.getStageWords(world.id, s);
                    clearedStages.push({ worldId: world.id, stageNum: s, words: stageWords });
                } else if (this._curriculum.length === 0) {
                    // 첫 미클리어 스테이지 → curriculum
                    const stageWords = WordManager.getStageWords(world.id, s);
                    this._curriculumStageId = `${world.id}-${s}`;
                    for (const w of stageWords) {
                        if (w.es && this._getPair(w)) this._curriculum.push(w);
                    }
                }
            }
        }

        if (!hasClearedAny) {
            const starter = WordManager.getStageWords(1, 1);
            clearedStages.push({ worldId: 1, stageNum: 1, words: starter });
        }

        // 최근 3스테이지 vs 나머지 분리
        const recentCount = 3;
        const recentStages = clearedStages.slice(-recentCount);
        const olderStages = clearedStages.slice(0, -recentCount);

        const seen = new Set();

        // 최근 3스테이지 → _recentPool
        for (const stage of recentStages) {
            for (const w of stage.words) {
                if (w.es && !seen.has(w.es) && this._getPair(w)) {
                    seen.add(w.es);
                    this._recentPool.push(w);
                }
            }
        }

        // 나머지 → _pool (전체 복습)
        for (const stage of olderStages) {
            for (const w of stage.words) {
                if (w.es && !seen.has(w.es) && this._getPair(w)) {
                    seen.add(w.es);
                    this._pool.push(w);
                }
            }
        }

        // curriculum에서 pool/recent과 중복 제거
        this._curriculum = this._curriculum.filter(w => !seen.has(w.es));

        this._restoreProgressState();

        // 첫 번째 새 단어 소개
        if (!this._newWord) this._introduceNextWord();
    },

    _introduceNextWord: function() {
        this._newWords = [];
        if (this._matchMode === 'review' || this._curriculum.length === 0) {
            this._newWord = null;
            this._saveProgressState();
            return;
        }
        // fast 모드: 2개씩 소개
        const count = this._matchMode === 'fast' ? 2 : 1;
        for (let i = 0; i < count && this._curriculum.length > 0; i++) {
            const nextWord = this._curriculum.shift();
            this._newWords.push(nextWord);
            if (nextWord && nextWord.es && typeof this._newWordStreak[nextWord.es] !== 'number') {
                this._newWordStreak[nextWord.es] = 0;
            }
        }
        this._newWord = this._newWords[0]; // 호환용
        this._saveProgressState();
        console.log(`매치 가랑비: 새 단어 소개 → ${this._newWords.map(w => w.es).join(', ')}`);
    },

    _restoreProgressState: function() {
        if (!this._curriculumStageId) return;
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return;
            const saved = JSON.parse(raw);
            if (!saved || saved.curriculumStageId !== this._curriculumStageId) return;

            const curriculumMap = {};
            this._curriculum.forEach(w => { curriculumMap[w.es] = w; });
            const restoredMastery = {};
            const savedMastery = saved.mastery || {};
            Object.keys(savedMastery).forEach(es => {
                if (curriculumMap[es] || (this._pool.some(w => w.es === es)) || (this._recentPool.some(w => w.es === es))) {
                    restoredMastery[es] = savedMastery[es];
                }
            });
            this._mastery = restoredMastery;
            this._newWordStreak = {};
            this._graduatedWords = {};

            // 이전 세션에서 졸업한 새 단어는 curriculum에서 제거하고 복습 풀로 유지
            const savedGraduatedEs = Array.isArray(saved.graduatedEs) ? saved.graduatedEs : [];
            savedGraduatedEs.forEach(es => {
                if (!es) return;
                this._graduatedWords[es] = true;
                if (curriculumMap[es]) {
                    this._pool.push(curriculumMap[es]);
                    delete curriculumMap[es];
                }
            });

            const nextCurriculum = [];
            const savedCurriculumEs = Array.isArray(saved.curriculumEs) ? saved.curriculumEs : [];
            savedCurriculumEs.forEach(es => {
                if (curriculumMap[es]) {
                    nextCurriculum.push(curriculumMap[es]);
                    delete curriculumMap[es];
                }
            });
            Object.values(curriculumMap).forEach(w => nextCurriculum.push(w));
            this._curriculum = nextCurriculum;

            // 새 단어 목록 복원
            const savedNewWords = Array.isArray(saved.newWordEsList) ? saved.newWordEsList
                : saved.newWordEs ? [saved.newWordEs] : [];
            const savedStreak = saved.newWordStreak || {};
            this._newWords = [];
            for (const es of savedNewWords) {
                const idx = this._curriculum.findIndex(w => w.es === es);
                if (idx >= 0) {
                    this._newWords.push(this._curriculum[idx]);
                    this._curriculum.splice(idx, 1);
                    this._newWordStreak[es] = Math.max(0, savedStreak[es] || 0);
                }
            }
            this._newWord = this._newWords[0] || null;
        } catch (e) {
            console.warn('매치 가랑비 진행도 복원 실패:', e);
        }
    },

    _saveProgressState: function() {
        if (!this._curriculumStageId) return;
        try {
            const payload = {
                curriculumStageId: this._curriculumStageId,
                newWordEs: this._newWord ? this._newWord.es : null,
                newWordEsList: this._newWords.map(w => w.es),
                curriculumEs: this._curriculum.map(w => w.es),
                graduatedEs: Object.keys(this._graduatedWords),
                mastery: this._mastery,
                newWordStreak: this._newWordStreak
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
        } catch (e) {
            console.warn('매치 가랑비 진행도 저장 실패:', e);
        }
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
     * @param {number} n - 뽑을 개수
     * @param {Set<string>} exclude - 제외할 단어 es Set
     */
    _drawWeighted: function(n, exclude = new Set(), pool = null) {
        const source = pool || this._pool;
        if (source.length === 0) return [];
        const result = [];
        const used = new Set(exclude);
        for (let i = 0; i < n; i++) {
            const candidates = source.filter(w => !used.has(w.es));
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

    /**
     * 현재 모드/상태에 맞춰 리필 단어를 뽑기
     * @param {number} total - 총 뽑을 쌍 수
     * @param {Set<string>} exclude - 제외 단어
     * @returns {Array} 선택된 단어 배열
     */
    _composeWords: function(total, exclude) {
        const words = [];
        const used = new Set(exclude);

        // 1) 새 단어 (fast: 2쌍, review: 0쌍)
        for (const nw of this._newWords) {
            if (nw && this._getPair(nw) && !used.has(nw.es)) {
                words.push(nw);
                used.add(nw.es);
            }
        }

        // 2) 최근 3스테이지에서 2쌍
        const recentTarget = Math.min(2, total - words.length);
        const fromRecent = this._drawWeighted(recentTarget, used, this._recentPool);
        for (const w of fromRecent) { words.push(w); used.add(w.es); }

        // 3) 전체 복습 풀에서 나머지
        const reviewTarget = total - words.length;
        // 전체 풀(pool + recentPool)에서 뽑기 (recent이 부족하면 여기서 보충)
        const allPool = [...this._pool, ...this._recentPool];
        const fromReview = this._drawWeighted(reviewTarget, used, allPool);
        for (const w of fromReview) { words.push(w); used.add(w.es); }

        // 풀이 작은 초기 구간에서는 exclude 때문에 5쌍을 못 채울 수 있음.
        // 이때는 중복 허용으로라도 슬롯을 채워 리필이 멈추지 않게 한다.
        if (words.length < total) {
            const fallbackPool = [...this._recentPool, ...this._pool]
                .filter(w => w && w.es && this._getPair(w));

            if (fallbackPool.length > 0) {
                while (words.length < total) {
                    const pick = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
                    words.push(pick);
                }
            }
        }

        return words;
    },

    /** 처음 20장 딜: 모드에 따라 새 단어 포함 + 최근/복습 혼합 */
    _deal: function() {
        const words = this._composeWords(10, new Set());
        this._cards = this._makePairCards(words);
        this._matchedCount = 0;
        this._selected = null;
        this._locked = false;
        this._isRefilling = false;
    },

    /** 리필: 5쌍 = 1 새 단어 + 2 최근 + 2 복습 (보드 잔여와 중복 없음) */
    _refill: function() {
        this._selected = null;
        const exclude = new Set();
        for (const c of this._cards) {
            if (!c.matched) exclude.add(c.es);
        }
        const words = this._composeWords(this.HALF, exclude);
        let newCards = this._makePairCards(words);
        const matchedSlots = [];
        const shouldAnimateRefill = !this._sorted;
        for (let i = 0; i < this._cards.length; i++) {
            if (this._cards[i].matched) matchedSlots.push(i);
        }
        if (this._sorted) {
            newCards = this._arrangeCardsForSortedSlots(newCards, matchedSlots);
        }
        if (newCards.length > matchedSlots.length) {
            newCards = newCards.slice(0, matchedSlots.length);
        }

        // newCards가 부족하면 슬롯 수에 맞춤 (빈 슬롯 방지)
        let ni = 0;
        for (let si = 0; si < matchedSlots.length; si++) {
            const slot = matchedSlots[si];
            if (ni < newCards.length) {
                this._cards[slot] = newCards[ni++];
            } else {
                // 카드가 부족하면 빈 카드가 아닌 matched 해제 상태의 더미 생성
                this._cards[slot] = { ...this._cards[slot], matched: false };
            }
        }

        this._matchedCount = 0;

        // 리필 시에는 정렬 여부와 관계없이 매칭된 슬롯만 갱신
        // (미매칭 카드의 위치/인덱스 절대 고정)
        for (const slot of matchedSlots) {
            this._updateCard(slot);
        }

        // 비정렬 모드에서는 리필된 슬롯만 페이드인
        if (shouldAnimateRefill) {
            for (const slot of matchedSlots) {
                const el = this._container && this._container.querySelector(`[data-idx="${slot}"]`);
                if (el) {
                    el.classList.remove('mc-matched');
                    el.classList.add('mc-refill-in');
                    el.addEventListener('animationend', function handler() {
                        el.classList.remove('mc-refill-in');
                        el.removeEventListener('animationend', handler);
                    }, { once: true });
                }
            }
        }

        this._isRefilling = false;
        this._locked = false;
    },

    _arrangeCardsForSortedSlots: function(cards, matchedSlots) {
        const tgtCards = cards.filter(c => c.type === 'tgt');
        const srcCards = cards.filter(c => c.type === 'src');
        const extraCards = cards.filter(c => c.type !== 'tgt' && c.type !== 'src');
        const arranged = [];
        for (const slot of matchedSlots) {
            const expectedType = this._cards[slot]?.type;
            if (expectedType === 'tgt') {
                arranged.push(tgtCards.length > 0 ? tgtCards.shift() : (srcCards.shift() || extraCards.shift()));
            } else if (expectedType === 'src') {
                arranged.push(srcCards.length > 0 ? srcCards.shift() : (tgtCards.shift() || extraCards.shift()));
            } else {
                const col = slot % this.COLS;
                arranged.push(col < 2
                    ? (tgtCards.shift() || srcCards.shift() || extraCards.shift())
                    : (srcCards.shift() || tgtCards.shift() || extraCards.shift()));
            }
        }
        return arranged.filter(Boolean);
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
            if (this._isNewCard(card)) el.classList.add('mc-new');
            el.dataset.idx = idx;
            el.textContent = card.text;
            this._container.appendChild(el);
        });
    },

    /** 새 단어 카드인지 판별 (src 쪽만) */
    _isNewCard: function(card) {
        if (card.type !== 'src') return false;
        return this._newWords.some(w => w && card.es === w.es);
    },

    _updateCard: function(idx) {
        if (!this._container) return;
        const el = this._container.querySelector(`[data-idx="${idx}"]`);
        if (!el) return;
        const card = this._cards[idx];
        el.className = 'mc' + (card.type === 'tgt' ? ' mc-tgt' : ' mc-src');
        if (card.matched) el.classList.add('mc-matched');
        if (this._isNewCard(card)) el.classList.add('mc-new');
        if (idx === this._selected) el.classList.add('mc-selected');
        el.textContent = card.text;
    },

    // =========================================
    // 정렬 & 모드
    // =========================================

    /** 정렬 토글: 뜻(왼쪽) / 단어(오른쪽) 분리 배치 */
    toggleSort: function() {
        this._sorted = !this._sorted;
        if (this._sorted) {
            this._applySortedLayout();
        } else {
            // 셔플 복원
            const unmatched = this._cards.filter(c => !c.matched);
            const matched = this._cards.filter(c => c.matched);
            const shuffled = this._shuffle(unmatched);
            let ui = 0, mi = 0;
            for (let i = 0; i < this._cards.length; i++) {
                if (this._cards[i].matched) {
                    this._cards[i] = matched[mi++];
                } else {
                    this._cards[i] = shuffled[ui++];
                }
            }
        }
        this._selected = null;
        this._render();
    },

    _applySortedLayout: function() {
        const tgtCards = [];
        const srcCards = [];
        const matchedCards = [];
        for (const c of this._cards) {
            if (c.matched) { matchedCards.push(c); continue; }
            if (c.type === 'tgt') tgtCards.push(c);
            else srcCards.push(c);
        }
        // 왼쪽 2열(뜻), 오른쪽 2열(단어), 각각 셔플
        const tgtShuffled = this._shuffle(tgtCards);
        const srcShuffled = this._shuffle(srcCards);
        const sorted = new Array(this.COLS * this.ROWS);
        let ti = 0, si = 0, mi = 0;
        for (let row = 0; row < this.ROWS; row++) {
            for (let col = 0; col < this.COLS; col++) {
                const idx = row * this.COLS + col;
                if (col < 2) {
                    sorted[idx] = ti < tgtShuffled.length ? tgtShuffled[ti++] : (mi < matchedCards.length ? matchedCards[mi++] : this._cards[idx]);
                } else {
                    sorted[idx] = si < srcShuffled.length ? srcShuffled[si++] : (mi < matchedCards.length ? matchedCards[mi++] : this._cards[idx]);
                }
            }
        }
        this._cards = sorted;
    },

    /** 학습 모드 변경 */
    setMatchMode: function(mode) {
        if (mode !== 'fast' && mode !== 'review') return;
        this._matchMode = mode;
        // 모드 변경 시 재초기화
        if (this._container) {
            this._buildPool();
            this._deal();
            this._render();
        }
    },

    setRefillMode: function(mode) {
        if (mode !== 'flow' && mode !== 'clear') return;
        this._refillMode = mode;
    },

    // =========================================
    // 입력 처리
    // =========================================

    handleClick: function(idx) {
        const card = this._cards[idx];

        if (this._locked) {
            if (!this._isRefilling || card.matched) return;
            const prev = this._selected;
            if (prev === idx) {
                this._selected = null;
                this._updateCard(idx);
                return;
            }
            this._selected = idx;
            this._updateCard(idx);
            if (prev !== null && prev !== idx) this._updateCard(prev);
            return;
        }

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
                    const isCurrentNewWord = this._newWords.some(w => w && w.es === wordEs);
                    if (isCurrentNewWord) {
                        this._newWordStreak[wordEs] = (this._newWordStreak[wordEs] || 0) + 1;
                    }
                    this._saveProgressState();

                    // 새 단어 졸업 체크
                    const graduatingIdx = this._newWords.findIndex(w => w && w.es === wordEs && (this._newWordStreak[wordEs] || 0) >= this.NEW_WORD_MASTERY);
                    if (graduatingIdx >= 0) {
                        const graduated = this._newWords[graduatingIdx];
                        this._pool.push(graduated);
                        this._newWords.splice(graduatingIdx, 1);
                        delete this._newWordStreak[graduated.es];
                        this._graduatedWords[graduated.es] = true;
                        console.log(`매치 가랑비: "${graduated.es}" 졸업 → 기존 풀 합류`);
                        if (this._newWords.length === 0) {
                            this._introduceNextWord();
                        }
                        this._newWord = this._newWords[0] || null;
                        this._saveProgressState();
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

                const shouldRefill = this._refillMode === 'clear'
                    ? this._cards.every(c => c.matched)
                    : this._matchedCount >= this.HALF;
                if (shouldRefill) {
                    this._locked = true;
                    this._isRefilling = true;
                    setTimeout(() => {
                        this._refill();
                    }, this.REFILL_DELAY_MS);
                }
            } else {
                // 오답
                const wrongWords = [prevCard?.es, card?.es].filter(Boolean);
                for (const wrongEs of wrongWords) {
                    if (this._newWords.some(w => w && w.es === wrongEs)) {
                        this._newWordStreak[wrongEs] = 0;
                    }
                }
                if (wrongWords.length > 0) this._saveProgressState();
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
