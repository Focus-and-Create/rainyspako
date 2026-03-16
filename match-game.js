/**
 * match-game.js
 * 단어 짝 잇기 미니게임
 * 4×5 카드 그리드, 스페인어↔한국어 짝 맞추기
 * 절반(5쌍) 매칭되면 새 단어로 리필
 */

const MatchGame = {
    COLS: 4,
    ROWS: 5,
    HALF: 5,       // 이 수만큼 맞추면 리필

    _pool: [],         // 전체 단어 풀 (셔플됨)
    _poolIdx: 0,
    _pairCounter: 0,   // 고유 pairId 발급용

    _cards: [],        // 현재 보드 (20개)
    _selected: null,   // 선택된 카드 인덱스
    _matchedCount: 0,  // 이번 라운드에서 맞춘 쌍 수
    _locked: false,    // 오답 처리 중 입력 잠금

    _container: null,

    // =========================================
    // 초기화
    // =========================================

    /**
     * @param {HTMLElement} container - .match-grid 요소
     */
    init: function(container) {
        this._container = container;
        this._buildPool();
        this._deal();
        this._render();
    },

    /** WordManager에서 모든 단어를 수집해 셔플 */
    _buildPool: function() {
        const words = [];
        for (const worldId in WordManager._wordData) {
            const stages = WordManager._wordData[worldId];
            if (!Array.isArray(stages)) continue;
            for (const stage of stages) {
                if (!Array.isArray(stage.words)) continue;
                for (const w of stage.words) {
                    if (w.es && w.ko) words.push({ es: w.es, ko: w.ko });
                }
            }
        }
        // 중복 제거 (es 기준)
        const seen = new Set();
        const unique = [];
        for (const w of words) {
            if (!seen.has(w.es)) { seen.add(w.es); unique.push(w); }
        }
        this._pool = this._shuffle(unique);
        this._poolIdx = 0;
        this._pairCounter = 0;
    },

    _shuffle: function(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    },

    /** 풀에서 n쌍 뽑기 (끝에 달하면 재셔플해서 순환) */
    _draw: function(n) {
        const result = [];
        for (let i = 0; i < n; i++) {
            if (this._poolIdx >= this._pool.length) {
                this._pool = this._shuffle(this._pool);
                this._poolIdx = 0;
            }
            result.push(this._pool[this._poolIdx++]);
        }
        return result;
    },

    /** 단어쌍 배열로 카드 20장 만들고 셔플 */
    _makePairCards: function(pairs) {
        const cards = [];
        for (const pair of pairs) {
            const pid = this._pairCounter++;
            cards.push({ pairId: pid, type: 'es', text: pair.es, matched: false });
            cards.push({ pairId: pid, type: 'ko', text: pair.ko, matched: false });
        }
        return this._shuffle(cards);
    },

    /** 처음 20장 딜 */
    _deal: function() {
        const pairs = this._draw(10);
        this._cards = this._makePairCards(pairs);
        this._matchedCount = 0;
        this._selected = null;
        this._locked = false;
    },

    /**
     * 절반 맞췄을 때: 매칭된 10자리에 새 5쌍(10장) 채워 넣기
     * 남은 5쌍은 제자리 유지
     */
    _refill: function() {
        const newPairs = this._draw(this.HALF);
        const newCards = this._makePairCards(newPairs);
        // 새 카드를 셔플 후 매칭된 슬롯에 순서대로 끼워넣기
        let ni = 0;
        for (let i = 0; i < this._cards.length; i++) {
            if (this._cards[i].matched) {
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
            el.className = 'mc' + (card.type === 'ko' ? ' mc-ko' : ' mc-es');
            if (card.matched) el.classList.add('mc-matched');
            el.dataset.idx = idx;
            el.textContent = card.text;
            this._container.appendChild(el);
        });
    },

    /** 특정 카드 요소만 갱신 (전체 리렌더 없이) */
    _updateCard: function(idx) {
        if (!this._container) return;
        const el = this._container.querySelector(`[data-idx="${idx}"]`);
        if (!el) return;
        const card = this._cards[idx];
        el.className = 'mc' + (card.type === 'ko' ? ' mc-ko' : ' mc-es');
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

        // 이미 선택된 카드 재클릭 → 선택 해제
        if (this._selected === idx) {
            this._selected = null;
            this._updateCard(idx);
            return;
        }

        if (this._selected === null) {
            // 첫 번째 카드 선택
            this._selected = idx;
            this._updateCard(idx);
        } else {
            // 두 번째 카드 선택 → 검사
            const prev = this._selected;
            const prevCard = this._cards[prev];
            this._selected = null;

            if (prevCard.pairId === card.pairId && prevCard.type !== card.type) {
                // 정답!
                prevCard.matched = true;
                card.matched = true;
                this._updateCard(prev);
                this._updateCard(idx);
                this._matchedCount++;

                if (this._matchedCount >= this.HALF) {
                    // 0.35초 후 리필 (매칭 애니메이션 끝난 뒤)
                    this._locked = true;
                    setTimeout(() => {
                        this._refill();
                        this._render();
                    }, 350);
                }
            } else {
                // 오답: 빨간 플래시 후 둘 다 선택 해제
                this._locked = true;
                const prevEl = this._container?.querySelector(`[data-idx="${prev}"]`);
                const curEl = this._container?.querySelector(`[data-idx="${idx}"]`);
                [prevEl, curEl].forEach(el => { if (el) el.classList.add('mc-wrong'); });
                setTimeout(() => {
                    [prevEl, curEl].forEach(el => { if (el) el.classList.remove('mc-wrong'); });
                    this._locked = false;
                }, 500);
            }
        }
    },
};
