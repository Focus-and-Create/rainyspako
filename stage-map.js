/**
 * stage-map.js
 * 보드게임 스타일 스테이지 맵 UI
 * 각 칸이 스테이지인 보드게임 형태 렌더링
 */

const StageMap = {
    // =========================================
    // 캔버스 및 컨텍스트
    // =========================================

    /** @type {HTMLCanvasElement} */
    canvas: null,

    /** @type {CanvasRenderingContext2D} */
    ctx: null,

    // =========================================
    // 상태
    // =========================================

    /** @type {number} 현재 표시 중인 월드 ID */
    currentWorldId: 1,

    /** @type {number} 스크롤 오프셋 (Y) */
    scrollY: 0,

    /** @type {number} 최대 스크롤 값 */
    maxScrollY: 0,

    /** @type {Array<Object>} 계산된 타일 위치들 */
    tilePositions: [],

    /** @type {number} 현재 호버 중인 타일 인덱스 (-1이면 없음) */
    hoveredTileIdx: -1,

    // =========================================
    // 콜백
    // =========================================

    /** @type {Function|null} 스테이지 선택 콜백 */
    onStageSelect: null,

    /** @type {Function|null} 월드 변경 콜백 */
    onWorldChange: null,

    // =========================================
    // 초기화
    // =========================================

    /**
     * 맵 초기화
     * @param {HTMLCanvasElement} canvas - 맵 캔버스 요소
     */
    init: function(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // HiDPI 캔버스 설정
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = CONFIG.CANVAS.WIDTH * dpr;
        this.canvas.height = CONFIG.CANVAS.HEIGHT * dpr;
        this.ctx.scale(dpr, dpr);

        this.setupEventListeners();
        this.calculateTilePositions();

        console.log('StageMap: 보드게임 맵 초기화 완료 (DPR:', dpr + ')');
    },

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners: function() {
        this.canvas.addEventListener('click', (e) => {
            this.handleClick(e);
        });

        this.canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.handleScroll(e.deltaY);
        });

        // 터치 스크롤 (모바일)
        let touchStartY = 0;

        this.canvas.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touchY = e.touches[0].clientY;
            const deltaY = touchStartY - touchY;
            this.handleScroll(deltaY);
            touchStartY = touchY;
        });
    },

    // =========================================
    // 타일 위치 계산
    // =========================================

    /**
     * 보드게임 타일 위치 계산 (뱀 형태 보드게임 레이아웃)
     */
    calculateTilePositions: function() {
        this.tilePositions = [];

        const world = getWorldConfig(this.currentWorldId);
        if (!world) return;

        const totalStages = world.stages;
        const cols = CONFIG.MAP.COLS;
        const tileSize = CONFIG.MAP.TILE_SIZE;
        const gap = CONFIG.MAP.TILE_GAP;
        const topY = CONFIG.MAP.TOP_Y;

        const totalBoardWidth = cols * tileSize + (cols - 1) * gap;
        const startX = (CONFIG.CANVAS.WIDTH - totalBoardWidth) / 2;

        for (let i = 0; i < totalStages; i++) {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const isReversed = row % 2 !== 0;
            const actualCol = isReversed ? (cols - 1 - col) : col;

            const x = startX + actualCol * (tileSize + gap);
            const y = topY + row * (tileSize + gap);

            // 타일 색상 할당 (순환 팔레트)
            const colorIdx = i % CONFIG.MAP.TILE_COLORS.length;

            this.tilePositions.push({
                worldId: this.currentWorldId,
                stageNum: i + 1,
                x: x,
                y: y,
                width: tileSize,
                height: tileSize,
                colorIdx: colorIdx
            });
        }

        const rows = Math.ceil(totalStages / cols);
        const contentHeight = topY + rows * (tileSize + gap) + 60;
        this.maxScrollY = Math.max(0, contentHeight - CONFIG.CANVAS.HEIGHT);
        this.scrollY = Math.min(this.scrollY, this.maxScrollY);
    },

    // =========================================
    // 이벤트 처리
    // =========================================

    /**
     * CSS 좌표를 논리 좌표로 변환
     */
    _toLogical: function(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = CONFIG.CANVAS.WIDTH / rect.width;
        const scaleY = CONFIG.CANVAS.HEIGHT / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    },

    /**
     * 클릭 이벤트 처리
     */
    handleClick: function(e) {
        const { x, y } = this._toLogical(e);

        // 월드 전환 화살표 체크 (헤더 영역, 고정)
        if (y < 70) {
            if (x < 65 && this.currentWorldId > 1) {
                this.prevWorld();
                return;
            }
            if (x > CONFIG.CANVAS.WIDTH - 65 && this.currentWorldId < CONFIG.WORLDS.length) {
                this.nextWorld();
                return;
            }
        }

        // 스크롤 적용된 좌표 (Y만 스크롤 적용)
        const sy = y + this.scrollY;

        const clicked = this.tilePositions.find(tile => {
            return x >= tile.x && x <= tile.x + tile.width &&
                   sy >= tile.y && sy <= tile.y + tile.height;
        });

        if (clicked) {
            this.handleTileClick(clicked);
        }
    },

    /**
     * 마우스 이동 처리
     */
    handleMouseMove: function(e) {
        const { x, y } = this._toLogical(e);
        let isOverClickable = false;
        let newHoveredIdx = -1;

        // 월드 전환 화살표 체크
        if (y < 70) {
            if (x < 65 && this.currentWorldId > 1) isOverClickable = true;
            if (x > CONFIG.CANVAS.WIDTH - 65 && this.currentWorldId < CONFIG.WORLDS.length) isOverClickable = true;
        }

        if (!isOverClickable) {
            const sy = y + this.scrollY;
            this.tilePositions.forEach((tile, idx) => {
                if (x >= tile.x && x <= tile.x + tile.width &&
                    sy >= tile.y && sy <= tile.y + tile.height) {
                    if (Storage.isStageUnlocked(tile.worldId, tile.stageNum)) {
                        isOverClickable = true;
                        newHoveredIdx = idx;
                    }
                }
            });
        }

        if (newHoveredIdx !== this.hoveredTileIdx) {
            this.hoveredTileIdx = newHoveredIdx;
            this.render();
        }

        this.canvas.style.cursor = isOverClickable ? 'pointer' : 'default';
    },

    /**
     * 타일 클릭 처리
     */
    handleTileClick: function(tile) {
        const isUnlocked = Storage.isStageUnlocked(tile.worldId, tile.stageNum);

        if (isUnlocked) {
            console.log(`StageMap: 스테이지 ${tile.worldId}-${tile.stageNum} 선택`);
            if (this.onStageSelect) {
                this.onStageSelect(tile.worldId, tile.stageNum);
            }
        } else {
            console.log(`StageMap: 스테이지 ${tile.worldId}-${tile.stageNum} 잠김`);
        }
    },

    /**
     * 스크롤 처리
     */
    handleScroll: function(deltaY) {
        this.scrollY += deltaY * 0.5;
        this.scrollY = Math.max(0, Math.min(this.scrollY, this.maxScrollY));
        this.render();
    },

    // =========================================
    // 월드 전환
    // =========================================

    setWorld: function(worldId) {
        const world = getWorldConfig(worldId);
        if (!world) return;

        this.currentWorldId = worldId;
        this.scrollY = 0;
        this.hoveredTileIdx = -1;
        this.calculateTilePositions();
        this.render();

        if (this.onWorldChange) {
            this.onWorldChange(worldId);
        }
    },

    nextWorld: function() {
        if (this.currentWorldId < CONFIG.WORLDS.length) {
            this.setWorld(this.currentWorldId + 1);
        }
    },

    prevWorld: function() {
        if (this.currentWorldId > 1) {
            this.setWorld(this.currentWorldId - 1);
        }
    },

    // =========================================
    // 렌더링
    // =========================================

    /**
     * 맵 렌더링
     */
    render: function() {
        const ctx = this.ctx;
        const W = CONFIG.CANVAS.WIDTH;
        const H = CONFIG.CANVAS.HEIGHT;
        const world = getWorldConfig(this.currentWorldId);

        // 배경
        this.renderBackground(world);

        // 보드게임 경로 (타일 연결선)
        this.renderBoardPaths();

        // 보드게임 타일들
        this.renderTiles();

        // 헤더 오버레이
        this.renderHeaderOverlay();

        // 월드 헤더 (고정)
        this.renderWorldHeader(world);
    },

    /**
     * 배경 렌더링
     */
    renderBackground: function(world) {
        const ctx = this.ctx;
        const W = CONFIG.CANVAS.WIDTH;
        const H = CONFIG.CANVAS.HEIGHT;

        // 보드게임 배경 (따뜻한 어두운 톤)
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#151932');
        bgGrad.addColorStop(0.5, '#1a1f3a');
        bgGrad.addColorStop(1, '#12162e');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // 보드 느낌의 격자 무늬 배경 (체스판 느낌)
        ctx.save();
        ctx.globalAlpha = 0.03;
        const gridSize = 40;
        for (let gx = 0; gx < W; gx += gridSize) {
            for (let gy = 0; gy < H; gy += gridSize) {
                if ((Math.floor(gx / gridSize) + Math.floor(gy / gridSize)) % 2 === 0) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(gx, gy, gridSize, gridSize);
                }
            }
        }
        ctx.restore();

        // 분위기 컬러 오브
        ctx.save();
        const orb = ctx.createRadialGradient(W * 0.5, H * 0.3, 30, W * 0.5, H * 0.3, 300);
        orb.addColorStop(0, world.color + '20');
        orb.addColorStop(1, world.color + '00');
        ctx.fillStyle = orb;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    },

    /**
     * 보드게임 경로 렌더링 (타일 사이를 잇는 점선/실선)
     */
    renderBoardPaths: function() {
        const ctx = this.ctx;
        if (this.tilePositions.length < 2) return;

        const tileSize = CONFIG.MAP.TILE_SIZE;
        const world = getWorldConfig(this.currentWorldId);

        for (let i = 1; i < this.tilePositions.length; i++) {
            const prev = this.tilePositions[i - 1];
            const curr = this.tilePositions[i];

            const prevCX = prev.x + tileSize / 2;
            const prevCY = prev.y + tileSize / 2 - this.scrollY;
            const currCX = curr.x + tileSize / 2;
            const currCY = curr.y + tileSize / 2 - this.scrollY;

            // 화면 밖이면 스킵
            if (prevCY < -50 && currCY < -50) continue;
            if (prevCY > CONFIG.CANVAS.HEIGHT + 50 && currCY > CONFIG.CANVAS.HEIGHT + 50) continue;

            // 클리어 여부 체크
            const prevStageId = getStageId(prev.worldId, prev.stageNum);
            const prevResult = Storage.getStageResult(prevStageId);
            const isCleared = prevResult && prevResult.stars > 0;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(prevCX, prevCY);

            // 같은 행이면 직선, 다른 행이면 곡선
            const cols = CONFIG.MAP.COLS;
            const prevRow = Math.floor((i - 1) / cols);
            const currRow = Math.floor(i / cols);

            if (prevRow !== currRow) {
                // 행 전환: U턴 커브
                const midY = (prevCY + currCY) / 2;
                ctx.bezierCurveTo(prevCX, midY, currCX, midY, currCX, currCY);
            } else {
                ctx.lineTo(currCX, currCY);
            }

            if (isCleared) {
                ctx.strokeStyle = world.color + '80';
                ctx.lineWidth = 4;
                ctx.setLineDash([]);
            } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
                ctx.lineWidth = 3;
                ctx.setLineDash([8, 6]);
            }
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
    },

    /**
     * 보드게임 타일 렌더링
     */
    renderTiles: function() {
        const ctx = this.ctx;
        const world = getWorldConfig(this.currentWorldId);
        const tileSize = CONFIG.MAP.TILE_SIZE;
        const radius = CONFIG.MAP.TILE_RADIUS;

        this.tilePositions.forEach((tile, idx) => {
            const drawX = tile.x;
            const drawY = tile.y - this.scrollY;

            // 화면 밖이면 스킵
            if (drawY < -tileSize - 10 || drawY > CONFIG.CANVAS.HEIGHT + 10) return;

            const isUnlocked = Storage.isStageUnlocked(tile.worldId, tile.stageNum);
            const stageId = getStageId(tile.worldId, tile.stageNum);
            const result = Storage.getStageResult(stageId);
            const isReview = WordManager.isReviewStage(tile.worldId, tile.stageNum);
            const isBoss = WordManager.isBossStage(tile.worldId, tile.stageNum);
            const progress = Storage.getCurrentProgress();
            const isCurrent = progress.worldId === tile.worldId &&
                             progress.stageNum === tile.stageNum;
            const isHovered = idx === this.hoveredTileIdx;
            const isCleared = result && result.stars > 0;

            // 타일 색상 결정
            let tileColor, borderColor, textColor, shadowColor;

            if (!isUnlocked) {
                tileColor = CONFIG.MAP.LOCKED_COLOR;
                borderColor = CONFIG.MAP.LOCKED_BORDER;
                textColor = '#666b80';
                shadowColor = 'rgba(0,0,0,0.3)';
            } else if (isCurrent) {
                tileColor = CONFIG.MAP.TILE_COLORS[tile.colorIdx];
                borderColor = '#FFD700';
                textColor = '#1a1a2e';
                shadowColor = 'rgba(255, 215, 0, 0.5)';
            } else if (isCleared) {
                tileColor = CONFIG.MAP.TILE_COLORS[tile.colorIdx];
                borderColor = this._darkenColor(CONFIG.MAP.TILE_COLORS[tile.colorIdx], 0.15);
                textColor = '#1a1a2e';
                shadowColor = this._hexToRgba(CONFIG.MAP.TILE_COLORS[tile.colorIdx], 0.3);
            } else {
                tileColor = CONFIG.MAP.TILE_COLORS[tile.colorIdx];
                borderColor = this._darkenColor(CONFIG.MAP.TILE_COLORS[tile.colorIdx], 0.2);
                textColor = '#1a1a2e';
                shadowColor = this._hexToRgba(CONFIG.MAP.TILE_COLORS[tile.colorIdx], 0.2);
            }

            ctx.save();

            // 현재 위치 글로우 효과
            if (isCurrent) {
                ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
                ctx.shadowBlur = 20;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
            }

            // 호버 시 약간 확대 효과 (translate로 시뮬레이션)
            let offsetX = 0, offsetY = 0, scale = 1;
            if (isHovered && isUnlocked) {
                scale = 1.05;
                offsetX = -(tileSize * 0.05) / 2;
                offsetY = -(tileSize * 0.05) / 2;
            }

            const tx = drawX + offsetX;
            const ty = drawY + offsetY;
            const tw = tileSize * scale;
            const th = tileSize * scale;

            // 타일 그림자
            if (isUnlocked) {
                ctx.shadowColor = shadowColor;
                ctx.shadowBlur = isCurrent ? 20 : 8;
                ctx.shadowOffsetY = 3;
            }

            // 타일 본체 (둥근 사각형)
            this._roundRect(ctx, tx, ty, tw, th, radius);

            if (isUnlocked) {
                // 그라데이션으로 입체감
                const tileGrad = ctx.createLinearGradient(tx, ty, tx, ty + th);
                tileGrad.addColorStop(0, this._lightenColor(tileColor, 0.15));
                tileGrad.addColorStop(0.5, tileColor);
                tileGrad.addColorStop(1, this._darkenColor(tileColor, 0.15));
                ctx.fillStyle = tileGrad;
            } else {
                ctx.fillStyle = tileColor;
            }
            ctx.fill();

            // 그림자 리셋
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            // 테두리
            this._roundRect(ctx, tx, ty, tw, th, radius);
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = isCurrent ? 3 : 2;
            ctx.stroke();

            // 타일 상단 하이라이트 (빛 반사 효과)
            if (isUnlocked) {
                ctx.save();
                ctx.beginPath();
                this._roundRect(ctx, tx + 3, ty + 3, tw - 6, th * 0.35, radius - 2);
                ctx.clip();
                const highlight = ctx.createLinearGradient(tx, ty, tx, ty + th * 0.4);
                highlight.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
                highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = highlight;
                ctx.fillRect(tx, ty, tw, th * 0.4);
                ctx.restore();
            }

            // START 배지 (1번 스테이지)
            if (tile.stageNum === 1) {
                this._renderStartBadge(ctx, tx + tw / 2, ty - 8);
            }

            // 스테이지 번호
            if (isUnlocked) {
                ctx.font = `bold ${Math.round(18 * scale)}px ${CONFIG.RENDER.FONT_FAMILY}`;
                ctx.fillStyle = textColor;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                if (isBoss) {
                    // 보스 스테이지: 크라운 아이콘 + 번호
                    this._renderCrown(ctx, tx + tw / 2, ty + th * 0.28, 10 * scale, textColor);
                    ctx.font = `bold ${Math.round(14 * scale)}px ${CONFIG.RENDER.FONT_FAMILY}`;
                    ctx.fillStyle = textColor;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(tile.stageNum.toString(), tx + tw / 2, ty + th * 0.63);
                } else {
                    ctx.fillText(tile.stageNum.toString(), tx + tw / 2, ty + th * 0.42);
                }
            } else {
                // 잠금 아이콘 (캔버스 드로잉)
                this._renderLockIcon(ctx, tx + tw / 2, ty + th * 0.45, 10 * scale);
            }

            // 별점 (클리어한 경우)
            if (isCleared) {
                this._renderTileStars(ctx, tx + tw / 2, ty + th - 14 * scale, result.stars, scale);
            }

            // 카테고리 라벨 (타일 아래)
            if (isUnlocked && !isCleared) {
                const category = isBoss
                    ? 'BOSS'
                    : WordManager.getStageCategory(tile.worldId, tile.stageNum);
                const shortCategory = category.length > 6 ? category.substring(0, 6) + '..' : category;
                ctx.font = `9px ${CONFIG.RENDER.FONT_FAMILY}`;
                ctx.fillStyle = isBoss ? '#fbbf24' : '#8892b0';
                ctx.textAlign = 'center';
                ctx.fillText(shortCategory, tx + tw / 2, ty + th + 12);
            }

            // 복습 배지
            if (isReview && isUnlocked) {
                this._renderBadge(ctx, tx + tw - 6, ty + 6, 'R', '#ef4444', '#dc2626');
            }

            // 보스 배지
            if (isBoss && isUnlocked) {
                this._renderBadge(ctx, tx + 6, ty + 6, 'B', '#fbbf24', '#f59e0b');
            }

            // 현재 위치 화살표 인디케이터
            if (isCurrent) {
                this._renderCurrentArrow(ctx, tx + tw / 2, ty - 16);
            }

            ctx.restore();
        });
    },

    /**
     * 헤더 오버레이 (노드 위에 그라데이션)
     */
    renderHeaderOverlay: function() {
        const ctx = this.ctx;
        const W = CONFIG.CANVAS.WIDTH;

        const headerFade = ctx.createLinearGradient(0, 0, 0, 80);
        headerFade.addColorStop(0, 'rgba(21, 25, 50, 0.98)');
        headerFade.addColorStop(0.7, 'rgba(21, 25, 50, 0.85)');
        headerFade.addColorStop(1, 'rgba(21, 25, 50, 0)');
        ctx.fillStyle = headerFade;
        ctx.fillRect(0, 0, W, 80);
    },

    /**
     * 월드 헤더 렌더링
     */
    renderWorldHeader: function(world) {
        const ctx = this.ctx;
        const W = CONFIG.CANVAS.WIDTH;

        // 보드게임 제목 스타일
        ctx.font = `bold 20px ${CONFIG.RENDER.FONT_FAMILY}`;
        ctx.fillStyle = world.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`World ${world.id}: ${world.name}`, W / 2, 26);

        // 한국어 부제
        ctx.font = `12px ${CONFIG.RENDER.FONT_FAMILY}`;
        ctx.fillStyle = '#64748b';
        ctx.fillText(world.nameKo, W / 2, 45);

        // 이전/다음 월드 화살표
        const arrowY = 30;

        if (this.currentWorldId > 1) {
            this._renderArrowButton(ctx, 35, arrowY, 'left');
        }

        if (this.currentWorldId < CONFIG.WORLDS.length) {
            this._renderArrowButton(ctx, W - 35, arrowY, 'right');
        }
    },

    // =========================================
    // 렌더링 헬퍼
    // =========================================

    /**
     * 둥근 사각형 경로
     */
    _roundRect: function(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    },

    /**
     * START 배지 렌더링
     */
    _renderStartBadge: function(ctx, x, y) {
        ctx.save();
        ctx.font = `bold 10px ${CONFIG.RENDER.FONT_FAMILY}`;
        const text = 'START';
        const tw = ctx.measureText(text).width + 14;
        const th = 18;

        // 배지 배경
        this._roundRect(ctx, x - tw / 2, y - th / 2, tw, th, 9);
        const grad = ctx.createLinearGradient(x - tw / 2, y - th / 2, x + tw / 2, y + th / 2);
        grad.addColorStop(0, '#10b981');
        grad.addColorStop(1, '#059669');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 텍스트
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);
        ctx.restore();
    },

    /**
     * 타일 내 별점 렌더링
     */
    _renderTileStars: function(ctx, x, y, stars, scale) {
        const starSize = 5 * scale;
        const gap = starSize * 2 + 3;
        const startX = x - gap;

        for (let i = 0; i < 3; i++) {
            const sx = startX + i * gap;
            const isFilled = i < stars;

            this._drawStar(ctx, sx, y, starSize, 5);

            if (isFilled) {
                ctx.fillStyle = '#FFD700';
                ctx.fill();
                ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
                ctx.shadowBlur = 4;
                ctx.fill();
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
    },

    /**
     * 별 모양 경로 헬퍼
     */
    _drawStar: function(ctx, cx, cy, radius, points) {
        const inner = radius * 0.45;
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const r = i % 2 === 0 ? radius : inner;
            const angle = (Math.PI / points) * i - Math.PI / 2;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
    },

    /**
     * 크라운 아이콘 렌더링
     */
    _renderCrown: function(ctx, x, y, size, color) {
        ctx.save();
        ctx.beginPath();
        const w = size * 1.6;
        const h = size;
        ctx.moveTo(x - w/2, y + h/2);
        ctx.lineTo(x - w/2, y - h/4);
        ctx.lineTo(x - w/4, y + h/8);
        ctx.lineTo(x, y - h/2);
        ctx.lineTo(x + w/4, y + h/8);
        ctx.lineTo(x + w/2, y - h/4);
        ctx.lineTo(x + w/2, y + h/2);
        ctx.closePath();
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    },

    /**
     * 잠금 아이콘 렌더링
     */
    _renderLockIcon: function(ctx, x, y, size) {
        ctx.save();
        const bodyW = size * 1.2;
        const bodyH = size * 0.9;
        const bx = x - bodyW / 2;
        const by = y;

        // 자물쇠 몸통
        this._roundRect(ctx, bx, by, bodyW, bodyH, 2);
        ctx.fillStyle = '#555b75';
        ctx.fill();

        // 자물쇠 고리
        ctx.beginPath();
        ctx.arc(x, by, size * 0.45, Math.PI, 0);
        ctx.strokeStyle = '#555b75';
        ctx.lineWidth = size * 0.2;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
    },

    /**
     * 배지 렌더링 (R/B 등)
     */
    _renderBadge: function(ctx, x, y, letter, color1, color2) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        const grad = ctx.createLinearGradient(x, y - 9, x, y + 9);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = `bold 9px ${CONFIG.RENDER.FONT_FAMILY}`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter, x, y);
        ctx.restore();
    },

    /**
     * 현재 위치 화살표
     */
    _renderCurrentArrow: function(ctx, x, y) {
        ctx.save();
        // 아래쪽 화살표 (삼각형)
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 6);
        ctx.lineTo(x + 8, y - 6);
        ctx.lineTo(x, y + 4);
        ctx.closePath();
        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = 'rgba(255, 215, 0, 0.7)';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.restore();
    },

    /**
     * 화살표 버튼 렌더링
     */
    _renderArrowButton: function(ctx, x, y, direction) {
        ctx.save();
        // 배경 원
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 화살표
        ctx.beginPath();
        if (direction === 'left') {
            ctx.moveTo(x + 5, y - 6);
            ctx.lineTo(x - 5, y);
            ctx.lineTo(x + 5, y + 6);
        } else {
            ctx.moveTo(x - 5, y - 6);
            ctx.lineTo(x + 5, y);
            ctx.lineTo(x - 5, y + 6);
        }
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
    },

    /**
     * 색상 밝게 만들기
     */
    _lightenColor: function(hex, amount) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + (255 - parseInt(hex.substr(0, 2), 16)) * amount);
        const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + (255 - parseInt(hex.substr(2, 2), 16)) * amount);
        const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + (255 - parseInt(hex.substr(4, 2), 16)) * amount);
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    },

    /**
     * 색상 어둡게 만들기
     */
    _darkenColor: function(hex, amount) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - amount));
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - amount));
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - amount));
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    },

    /**
     * HEX 색상을 RGBA로 변환
     */
    _hexToRgba: function(hex, alpha) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
};
