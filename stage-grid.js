/**
 * stage-grid.js
 * 스테이지 카드 그리드 렌더러
 * 캔버스 맵 대신 DOM 카드 목록으로 스테이지 표시
 */

const StageGrid = {
    _container: null,

    /** @type {Function|null} 스테이지 선택 콜백 (worldId, stageNum) */
    onStageSelect: null,

    init: function(container) {
        this._container = container;
    },

    render: function() {
        if (!this._container) return;
        this._container.innerHTML = '';

        for (const world of CONFIG.WORLDS) {
            this._container.appendChild(this._buildWorldSection(world));
        }
    },

    _buildWorldSection: function(world) {
        const section = document.createElement('div');
        section.className = 'sg-world';

        const header = document.createElement('div');
        header.className = 'sg-world-header';
        header.style.setProperty('--wc', world.color);
        const dot = document.createElement('span');
        dot.className = 'sg-world-dot';
        header.appendChild(dot);
        const nameEl = document.createElement('span');
        nameEl.className = 'sg-world-name';
        nameEl.textContent = world.nameKo;
        header.appendChild(nameEl);
        const sub = document.createElement('span');
        sub.className = 'sg-world-sub';
        sub.textContent = world.name;
        header.appendChild(sub);
        section.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'sg-grid';
        for (let s = 1; s <= world.stages; s++) {
            grid.appendChild(this._buildCard(world, s));
        }
        section.appendChild(grid);
        return section;
    },

    _buildCard: function(world, stageNum) {
        const stageId = getStageId(world.id, stageNum);
        const result   = Storage.getStageResult(stageId);
        const unlocked = Storage.isStageUnlocked(world.id, stageNum);
        const isBoss   = WordManager.isBossStage(world.id, stageNum);
        const isReview = WordManager.isReviewStage(world.id, stageNum);
        const stars    = result ? result.stars : 0;
        const category = isReview ? '복습' : isBoss ? 'BOSS' : WordManager.getStageCategory(world.id, stageNum);

        const card = document.createElement('div');
        card.className = 'sg-card'
            + (unlocked  ? ''          : ' sg-locked')
            + (result    ? ' sg-done'  : '')
            + (isBoss    ? ' sg-boss'  : '');
        card.style.setProperty('--wc', world.color);

        const top = document.createElement('div');
        top.className = 'sg-card-top';
        const num = document.createElement('span');
        num.className = 'sg-num';
        num.textContent = world.id + '-' + stageNum;
        top.appendChild(num);
        if (isBoss || isReview) {
            const badge = document.createElement('span');
            badge.className = 'sg-badge';
            badge.textContent = isBoss ? 'B' : 'R';
            top.appendChild(badge);
        }
        card.appendChild(top);

        const cat = document.createElement('div');
        cat.className = 'sg-cat';
        cat.textContent = category;
        card.appendChild(cat);

        const starsDiv = document.createElement('div');
        starsDiv.className = 'sg-stars';
        for (let i = 1; i <= 3; i++) {
            const s = document.createElement('span');
            if (i <= stars) s.className = 'on';
            s.textContent = '★';
            starsDiv.appendChild(s);
        }
        card.appendChild(starsDiv);

        if (!unlocked) {
            const lock = document.createElement('div');
            lock.className = 'sg-lock';
            lock.textContent = '🔒';
            card.appendChild(lock);
        }

        card.addEventListener('click', () => {
            this.onStageSelect?.(world.id, stageNum);
        });

        return card;
    },
};
