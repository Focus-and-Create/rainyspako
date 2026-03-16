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
        header.innerHTML =
            `<span class="sg-world-dot"></span>` +
            `<span class="sg-world-name">${world.nameKo}</span>` +
            `<span class="sg-world-sub">${world.name}</span>`;
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

        card.innerHTML =
            `<div class="sg-card-top">` +
                `<span class="sg-num">${world.id}-${stageNum}</span>` +
                (isBoss || isReview ? `<span class="sg-badge">${isBoss ? 'B' : 'R'}</span>` : '') +
            `</div>` +
            `<div class="sg-cat">${category}</div>` +
            `<div class="sg-stars">` +
                [1,2,3].map(i => `<span class="${i <= stars ? 'on' : ''}"'>★</span>`).join('') +
            `</div>` +
            (!unlocked ? `<div class="sg-lock">🔒</div>` : '');

        card.addEventListener('click', () => {
            this.onStageSelect?.(world.id, stageNum);
        });

        return card;
    },
};
