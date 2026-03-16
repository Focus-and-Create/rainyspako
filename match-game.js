/**
 * match-game.js
 * 단어 짝 잇기 미니게임
 * 4×5 카드 그리드, 스페인어↔한국어 짝 맞추기
 * 커리큘럼 순서대로 단어 출제, 절반(5쌍) 매칭되면 리필
 */

const MatchGame = {
    COLS: 4,
    ROWS: 5,
    HALF: 5,       // 이 수만큼 맞추면 리필

    _pool: [],         // 커리큘럼 순서 단어 풀
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

    /**
     * 현재 모드에서 카드 한 쌍의 텍스트를 반환
     * @returns {{ src: string, tgt: string } | null}
     */
    _getPair: function(w) {
        const mode = (typeof App !== 'undefined' && App.currentMode) ? App.currentMode : 'es-to-ko';
        if (mode === 'es-to-ko') return w.ko ? { src: w.es, tgt: w.ko } : null;
        if (mode === 'ko-to-es') return w.ko ? { src: w.ko, tgt: w.es } : null;
        if (mode === 'es-to-en') return w.en ? { src: w.es, tgt: w.en } : null;
        if (mode === 'en-to-es') return w.en ? { src: w.en, tgt: w.es } : null;
        return w.ko ? { src: w.es, tgt: w.ko } : null;
    },

    /**
     * 클리어한 스테이지의 단어를 커리큘럼 순서대로 수집
     * 아직 하나도 안 클리어했으면 1-1 단어 사용
     */
    _buildPool: function() {
        const words = [];
        let hasClearedAny = false;

        for (const world of CONFIG.WORLDS) {
            for (let s = 1; s <= world.stages; s++) {
                const stageId = getStageId(world.id, s);
                const result = Storage.getStageResult(stageId);
                const cleared = result && result.stars >= 1;
                if (!cleared) continue;

                hasClearedAny = true;
                const stageWords = WordManager.getStageWords(world.id, s);
                for (const w of stageWords) {
                    if (w.es) words.push(w);
                }
            }
        }

        if (!hasClearedAny) {
            const starter = WordManager.getStageWords(1, 1);
            for (const w of starter) {
                if (w.es) words.push(w);
            }
        }

        // 중복 제거 (es 기준) + 현재 모드로 페어 생성 가능한 것만
        const seen = new Set();
        const unique = [];
        for (const w of words) {
            if (!seen.has(w.es) && this._getPair(w)) {
                seen.add(w.es);
                unique.push(w);
            }
        }

        this._pool = unique;
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

    /** 풀에서 n쌍 뽑기 (끝에 달하면 처음부터 순환) */
    _draw: function(n) {
        const result = [];
        for (let i = 0; i < n; i++) {
            if (this._pool.length === 0) break;
            if (this._poolIdx >= this._pool.length) this._poolIdx = 0;
            result.push(this._pool[this._poolIdx++]);
        }
        return result;
    },

    /** 단어쌍 배열로 카드 20장 만들고 셔플 */
    _makePairCards: function(words) {
        const cards = [];
        for (const w of words) {
            const pair = this._getPair(w);
            if (!pair) continue;
            const pid = this._pairCounter++;
            cards.push({ pairId: pid, type: 'src', text: pair.src, matched: false });
            cards.push({ pairId: pid, type: 'tgt', text: pair.tgt, matched: false });
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
            el.className = 'mc' + (card.type === 'tgt' ? ' mc-tgt' : ' mc-src');
            if (card.matched) el.classList.add('mc-matched');
            el.dataset.idx = idx;
            el.textContent = card.text;
            this._container.appendChild(el);
        });
    },

    /** 특정 카드 요소만 갱신 */
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
                    this._locked = true;
                    setTimeout(() => {
                        this._refill();
                        this._render();
                    }, 900);
                }
            } else {
                // 오답: 두 카드 모두 강조 해제 + 빨간 플래시
                this._locked = true;
                const prevEl = this._container?.querySelector(`[data-idx="${prev}"]`);
                const curEl = this._container?.querySelector(`[data-idx="${idx}"]`);
                // mc-selected 제거 후 mc-wrong 표시
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
