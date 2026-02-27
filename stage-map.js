/**
 * stage-map.js
 * 보드게임 스타일 스테이지 맵 UI
 * 외곽선을 따라 타일이 배치되고, 가운데에 월드 주제가 표시됨
 */

const StageMap = {
    /** @type {HTMLCanvasElement} */
    canvas: null,
    /** @type {CanvasRenderingContext2D} */
    ctx: null,

    currentWorldId: 1,
    scrollY: 0,
    maxScrollY: 0,
    tilePositions: [],
    hoveredTileIdx: -1,

    /** @type {{startX:number, startY:number, boardW:number, boardH:number, innerX:number, innerY:number, innerW:number, innerH:number}|null} */
    boardInfo: null,

    onStageSelect: null,
    onWorldChange: null,

    // =========================================
    // 초기화
    // =========================================

    init: function(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = CONFIG.CANVAS.WIDTH * dpr;
        this.canvas.height = CONFIG.CANVAS.HEIGHT * dpr;
        this.ctx.scale(dpr, dpr);

        this.setupEventListeners();
        this.calculateTilePositions();

        console.log('StageMap: 보드게임 맵 초기화 완료');
    },

    setupEventListeners: function() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.handleScroll(e.deltaY);
        });

        let touchStartY = 0;
        this.canvas.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touchY = e.touches[0].clientY;
            this.handleScroll(touchStartY - touchY);
            touchStartY = touchY;
        });
    },

    // =========================================
    // 타일 위치 계산 (외곽 경로 레이아웃)
    // =========================================

    /**
     * 보드게임 외곽 경로를 생성한다.
     * 시계방향: 하단(좌→우) → 우측(하→상) → 상단(우→좌) → 좌측(상→하)
     * 외곽이 부족하면 안쪽으로 한 바퀴 더 돈다.
     */
    _generateBoardPath: function(cols, rows, totalNeeded) {
        const path = [];

        // --- 외곽 한 바퀴 ---
        // 하단: 좌→우
        for (let c = 0; c < cols; c++) {
            path.push({ col: c, row: rows - 1 });
        }
        // 우측: 하→상 (하단 우측 모서리 제외)
        for (let r = rows - 2; r >= 0; r--) {
            path.push({ col: cols - 1, row: r });
        }
        // 상단: 우→좌 (상단 우측 모서리 제외)
        for (let c = cols - 2; c >= 0; c--) {
            path.push({ col: c, row: 0 });
        }
        // 좌측: 상→하 (양 모서리 제외)
        for (let r = 1; r < rows - 1; r++) {
            path.push({ col: 0, row: r });
        }

        // --- 외곽으로 부족하면 안쪽 한 바퀴 ---
        if (path.length < totalNeeded && cols > 2 && rows > 2) {
            // 안쪽 하단: 좌→우
            for (let c = 1; c < cols - 1 && path.length < totalNeeded; c++) {
                path.push({ col: c, row: rows - 2 });
            }
            // 안쪽 우측: 하→상
            for (let r = rows - 3; r >= 1 && path.length < totalNeeded; r--) {
                path.push({ col: cols - 2, row: r });
            }
            // 안쪽 상단: 우→좌
            for (let c = cols - 3; c >= 1 && path.length < totalNeeded; c--) {
                path.push({ col: c, row: 1 });
            }
            // 안쪽 좌측: 상→하
            for (let r = 2; r < rows - 2 && path.length < totalNeeded; r++) {
                path.push({ col: 1, row: r });
            }
        }

        return path;
    },

    calculateTilePositions: function() {
        this.tilePositions = [];

        const world = getWorldConfig(this.currentWorldId);
        if (!world) return;

        const totalStages = world.stages;
        const tileSize = CONFIG.MAP.TILE_SIZE;
        const gap = CONFIG.MAP.TILE_GAP;
        const step = tileSize + gap;
        const cols = CONFIG.MAP.BOARD_COLS;
        const rows = CONFIG.MAP.BOARD_ROWS;
        const topY = CONFIG.MAP.TOP_Y;

        const boardW = cols * step - gap;
        const boardH = rows * step - gap;
        const startX = (CONFIG.CANVAS.WIDTH - boardW) / 2;
        const startY = topY;

        // 외곽 경로 생성
        const path = this._generateBoardPath(cols, rows, totalStages);

        // 타일 배치
        for (let i = 0; i < Math.min(totalStages, path.length); i++) {
            const pos = path[i];
            this.tilePositions.push({
                worldId: this.currentWorldId,
                stageNum: i + 1,
                x: startX + pos.col * step,
                y: startY + pos.row * step,
                width: tileSize,
                height: tileSize,
                colorIdx: i % CONFIG.MAP.TILE_COLORS.length
            });
        }

        // 보드 정보 (중앙 영역 렌더링용)
        this.boardInfo = {
            startX: startX,
            startY: startY,
            boardW: boardW,
            boardH: boardH,
            // 외곽 안쪽 영역
            innerX: startX + step,
            innerY: startY + step,
            innerW: (cols - 2) * step - gap,
            innerH: (rows - 2) * step - gap
        };

        // 스크롤
        const contentHeight = startY + boardH + 40;
        this.maxScrollY = Math.max(0, contentHeight - CONFIG.CANVAS.HEIGHT);
        this.scrollY = Math.min(this.scrollY, this.maxScrollY);
    },

    // =========================================
    // 이벤트 처리
    // =========================================

    _toLogical: function(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (CONFIG.CANVAS.WIDTH / rect.width),
            y: (e.clientY - rect.top) * (CONFIG.CANVAS.HEIGHT / rect.height)
        };
    },

    handleClick: function(e) {
        const { x, y } = this._toLogical(e);

        // 월드 전환 화살표
        if (y < 70) {
            if (x < 65 && this.currentWorldId > 1) { this.prevWorld(); return; }
            if (x > CONFIG.CANVAS.WIDTH - 65 && this.currentWorldId < CONFIG.WORLDS.length) { this.nextWorld(); return; }
        }

        const sy = y + this.scrollY;
        const clicked = this.tilePositions.find(t =>
            x >= t.x && x <= t.x + t.width && sy >= t.y && sy <= t.y + t.height
        );
        if (clicked) this.handleTileClick(clicked);
    },

    handleMouseMove: function(e) {
        const { x, y } = this._toLogical(e);
        let isOverClickable = false;
        let newHoveredIdx = -1;

        if (y < 70) {
            if (x < 65 && this.currentWorldId > 1) isOverClickable = true;
            if (x > CONFIG.CANVAS.WIDTH - 65 && this.currentWorldId < CONFIG.WORLDS.length) isOverClickable = true;
        }

        if (!isOverClickable) {
            const sy = y + this.scrollY;
            this.tilePositions.forEach((t, idx) => {
                if (x >= t.x && x <= t.x + t.width && sy >= t.y && sy <= t.y + t.height) {
                    if (Storage.isStageUnlocked(t.worldId, t.stageNum)) {
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

    handleTileClick: function(tile) {
        if (Storage.isStageUnlocked(tile.worldId, tile.stageNum)) {
            if (this.onStageSelect) this.onStageSelect(tile.worldId, tile.stageNum);
        }
    },

    handleScroll: function(deltaY) {
        this.scrollY = Math.max(0, Math.min(this.scrollY + deltaY * 0.5, this.maxScrollY));
        this.render();
    },

    // =========================================
    // 월드 전환
    // =========================================

    setWorld: function(worldId) {
        if (!getWorldConfig(worldId)) return;
        this.currentWorldId = worldId;
        this.scrollY = 0;
        this.hoveredTileIdx = -1;
        this.calculateTilePositions();
        this.render();
        if (this.onWorldChange) this.onWorldChange(worldId);
    },
    nextWorld: function() { if (this.currentWorldId < CONFIG.WORLDS.length) this.setWorld(this.currentWorldId + 1); },
    prevWorld: function() { if (this.currentWorldId > 1) this.setWorld(this.currentWorldId - 1); },

    // =========================================
    // 렌더링
    // =========================================

    render: function() {
        const world = getWorldConfig(this.currentWorldId);

        this.renderBackground(world);
        this.renderBoardPaths();
        this.renderTiles();
        this.renderBoardCenter(world);
        this.renderHeaderOverlay();
        this.renderWorldHeader(world);
    },

    renderBackground: function(world) {
        const ctx = this.ctx;
        const W = CONFIG.CANVAS.WIDTH;
        const H = CONFIG.CANVAS.HEIGHT;

        // 밝고 발랄한 파스텔 배경 (게임 화면과 동일 톤)
        const bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0,    '#fff9c4');
        bg.addColorStop(0.35, '#fce4ec');
        bg.addColorStop(0.7,  '#e3f2fd');
        bg.addColorStop(1,    '#e8f5e9');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // 미세 격자 (밝은 배경에 어두운 점)
        ctx.save();
        ctx.globalAlpha = 0.035;
        ctx.fillStyle = 'rgba(100, 60, 160, 1)';
        const gs = 40;
        for (let gx = 0; gx < W; gx += gs) {
            for (let gy = 0; gy < H; gy += gs) {
                if ((Math.floor(gx / gs) + Math.floor(gy / gs)) % 2 === 0) {
                    ctx.fillRect(gx, gy, gs, gs);
                }
            }
        }
        ctx.restore();

        // 분위기 오브 (월드 컬러 은은하게)
        ctx.save();
        const orb = ctx.createRadialGradient(W * 0.5, H * 0.5, 30, W * 0.5, H * 0.5, 350);
        orb.addColorStop(0, world.color + '30');
        orb.addColorStop(1, world.color + '00');
        ctx.fillStyle = orb;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    },

    /**
     * 보드 가운데 영역 (월드 주제 표시)
     */
    renderBoardCenter: function(world) {
        const ctx = this.ctx;
        const bi = this.boardInfo;
        if (!bi) return;

        const cx = bi.innerX + bi.innerW / 2;
        const cy = bi.innerY + bi.innerH / 2 - this.scrollY;

        // 가운데 배경 (살짝 밝은 톤)
        ctx.save();
        this._roundRect(ctx, bi.innerX, bi.innerY - this.scrollY, bi.innerW, bi.innerH, 14);
        const centerBg = ctx.createRadialGradient(cx, cy, 20, cx, cy, bi.innerW * 0.6);
        centerBg.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
        centerBg.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
        ctx.fillStyle = centerBg;
        ctx.fill();

        // 점선 테두리
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = 'rgba(160, 140, 200, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // 월드 아이콘 (컬러 원)
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy - 50, 28, 0, Math.PI * 2);
        const iconGrad = ctx.createLinearGradient(cx, cy - 78, cx, cy - 22);
        iconGrad.addColorStop(0, this._lightenColor(world.color, 0.2));
        iconGrad.addColorStop(1, world.color);
        ctx.fillStyle = iconGrad;
        ctx.shadowColor = this._hexToRgba(world.color, 0.4);
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // 월드 번호
        ctx.font = `bold 22px ${CONFIG.RENDER.FONT_FAMILY}`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(world.id.toString(), cx, cy - 50);
        ctx.restore();

        // 월드 이름
        ctx.font = `bold 24px ${CONFIG.RENDER.FONT_FAMILY}`;
        ctx.fillStyle = '#1a1040';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(world.name, cx, cy - 5);

        // 한국어 부제
        ctx.font = `14px ${CONFIG.RENDER.FONT_FAMILY}`;
        ctx.fillStyle = '#4a3870';
        ctx.fillText(world.nameKo, cx, cy + 22);

        // 진행률
        const totalStages = world.stages;
        let clearedCount = 0;
        for (let s = 1; s <= totalStages; s++) {
            const result = Storage.getStageResult(getStageId(world.id, s));
            if (result && result.stars > 0) clearedCount++;
        }

        // 진행률 바
        const barW = 140;
        const barH = 8;
        const barX = cx - barW / 2;
        const barY = cy + 50;

        // 배경
        this._roundRect(ctx, barX, barY, barW, barH, 4);
        ctx.fillStyle = 'rgba(160, 140, 200, 0.2)';
        ctx.fill();

        // 채움
        if (clearedCount > 0) {
            const fillW = (clearedCount / totalStages) * barW;
            this._roundRect(ctx, barX, barY, Math.max(fillW, barH), barH, 4);
            const barGrad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
            barGrad.addColorStop(0, world.color);
            barGrad.addColorStop(1, this._lightenColor(world.color, 0.3));
            ctx.fillStyle = barGrad;
            ctx.fill();
        }

        // 진행률 텍스트
        ctx.font = `bold 12px ${CONFIG.RENDER.FONT_FAMILY}`;
        ctx.fillStyle = '#9b8ab0';
        ctx.textAlign = 'center';
        ctx.fillText(`${clearedCount} / ${totalStages}`, cx, barY + barH + 16);

        // 주사위 아이콘 (장식)
        this._renderDice(ctx, cx - 80, cy + 45);
        this._renderDice(ctx, cx + 68, cy + 45);
    },

    /**
     * 경로 연결선 렌더링
     */
    renderBoardPaths: function() {
        const ctx = this.ctx;
        if (this.tilePositions.length < 2) return;

        const tileSize = CONFIG.MAP.TILE_SIZE;
        const world = getWorldConfig(this.currentWorldId);

        for (let i = 1; i < this.tilePositions.length; i++) {
            const prev = this.tilePositions[i - 1];
            const curr = this.tilePositions[i];

            const px = prev.x + tileSize / 2;
            const py = prev.y + tileSize / 2 - this.scrollY;
            const cx2 = curr.x + tileSize / 2;
            const cy2 = curr.y + tileSize / 2 - this.scrollY;

            if (py < -50 && cy2 < -50) continue;
            if (py > CONFIG.CANVAS.HEIGHT + 50 && cy2 > CONFIG.CANVAS.HEIGHT + 50) continue;

            const prevResult = Storage.getStageResult(getStageId(prev.worldId, prev.stageNum));
            const isCleared = prevResult && prevResult.stars > 0;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(px, py);

            // 직선이 아닌 경우 (대각선 이동) 곡선으로
            const dx = Math.abs(cx2 - px);
            const dy = Math.abs(cy2 - py);
            if (dx > 10 && dy > 10) {
                // 모서리 전환: L자 커브
                const midX = (px + cx2) / 2;
                const midY = (py + cy2) / 2;
                ctx.quadraticCurveTo(px, cy2, cx2, cy2);
            } else {
                ctx.lineTo(cx2, cy2);
            }

            if (isCleared) {
                ctx.strokeStyle = world.color + '60';
                ctx.lineWidth = 3;
                ctx.setLineDash([]);
            } else {
                ctx.strokeStyle = 'rgba(160, 140, 200, 0.3)';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
            }
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
    },

    /**
     * 타일 렌더링
     */
    renderTiles: function() {
        const ctx = this.ctx;
        const world = getWorldConfig(this.currentWorldId);
        const tileSize = CONFIG.MAP.TILE_SIZE;
        const radius = CONFIG.MAP.TILE_RADIUS;

        this.tilePositions.forEach((tile, idx) => {
            const drawY = tile.y - this.scrollY;
            if (drawY < -tileSize - 10 || drawY > CONFIG.CANVAS.HEIGHT + 10) return;

            const isUnlocked = Storage.isStageUnlocked(tile.worldId, tile.stageNum);
            const stageId = getStageId(tile.worldId, tile.stageNum);
            const result = Storage.getStageResult(stageId);
            const isBoss = WordManager.isBossStage(tile.worldId, tile.stageNum);
            const progress = Storage.getCurrentProgress();
            const isCurrent = progress.worldId === tile.worldId && progress.stageNum === tile.stageNum;
            const isHovered = idx === this.hoveredTileIdx;
            const isCleared = result && result.stars > 0;
            const isLast = tile.stageNum === world.stages;

            // 색상
            let tileColor, borderColor, textColor;
            if (!isUnlocked) {
                tileColor = CONFIG.MAP.LOCKED_COLOR;
                borderColor = CONFIG.MAP.LOCKED_BORDER;
                textColor = '#666b80';
            } else if (isCurrent) {
                tileColor = CONFIG.MAP.TILE_COLORS[tile.colorIdx];
                borderColor = '#FFD700';
                textColor = '#1a1a2e';
            } else {
                tileColor = CONFIG.MAP.TILE_COLORS[tile.colorIdx];
                borderColor = this._darkenColor(tileColor, 0.2);
                textColor = '#1a1a2e';
            }

            // 적응형: 클리어한 스테이지에 정확도 기반 테두리 색 적용
            let perfOverlay = null;  // rgba 오버레이 색
            let perfDot = null;      // 구석 도트 색
            if (isCleared && result.lastAccuracy !== null && result.lastAccuracy !== undefined && !isCurrent) {
                const acc = result.lastAccuracy;
                if (acc < 65) {
                    borderColor = '#f44336';
                    perfOverlay = 'rgba(244, 67, 54, 0.18)';
                    perfDot = '#f44336';
                } else if (acc < 80) {
                    borderColor = '#ff9800';
                    perfOverlay = 'rgba(255, 152, 0, 0.13)';
                    perfDot = '#ff9800';
                } else if (acc >= 90) {
                    borderColor = '#43a047';
                    perfDot = '#43a047';
                }
            }

            ctx.save();

            // 호버 확대
            let ox = 0, oy = 0, sc = 1;
            if (isHovered && isUnlocked) {
                sc = 1.08;
                ox = -(tileSize * 0.08) / 2;
                oy = -(tileSize * 0.08) / 2;
            }
            const tx = tile.x + ox;
            const ty = drawY + oy;
            const tw = tileSize * sc;
            const th = tileSize * sc;

            // 그림자
            if (isUnlocked) {
                ctx.shadowColor = isCurrent ? 'rgba(255,215,0,0.5)' : 'rgba(0,0,0,0.3)';
                ctx.shadowBlur = isCurrent ? 18 : 6;
                ctx.shadowOffsetY = 2;
            }

            // 타일 본체
            this._roundRect(ctx, tx, ty, tw, th, radius);
            if (isUnlocked) {
                const g = ctx.createLinearGradient(tx, ty, tx, ty + th);
                g.addColorStop(0, this._lightenColor(tileColor, 0.18));
                g.addColorStop(0.5, tileColor);
                g.addColorStop(1, this._darkenColor(tileColor, 0.12));
                ctx.fillStyle = g;
            } else {
                ctx.fillStyle = tileColor;
            }
            ctx.fill();
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            // 정확도 오버레이 (반투명 틴트)
            if (perfOverlay) {
                this._roundRect(ctx, tx, ty, tw, th, radius);
                ctx.fillStyle = perfOverlay;
                ctx.fill();
            }

            // 테두리
            this._roundRect(ctx, tx, ty, tw, th, radius);
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = isCurrent ? 3 : 1.5;
            ctx.stroke();

            // 하이라이트 (빛 반사)
            if (isUnlocked) {
                ctx.save();
                this._roundRect(ctx, tx + 2, ty + 2, tw - 4, th * 0.35, radius - 1);
                ctx.clip();
                const hl = ctx.createLinearGradient(tx, ty, tx, ty + th * 0.4);
                hl.addColorStop(0, 'rgba(255,255,255,0.35)');
                hl.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = hl;
                ctx.fillRect(tx, ty, tw, th * 0.4);
                ctx.restore();
            }

            // START / GOAL 배지
            if (tile.stageNum === 1) {
                this._renderBadgeLabel(ctx, tx + tw / 2, ty - 8, 'START', '#10b981', '#059669');
            }
            if (isLast) {
                this._renderBadgeLabel(ctx, tx + tw / 2, ty - 8, 'GOAL', '#f59e0b', '#d97706');
            }

            // 현재 위치 화살표
            if (isCurrent && tile.stageNum !== 1 && !isLast) {
                this._renderCurrentArrow(ctx, tx + tw / 2, ty - 10);
            }

            // 내용물: 번호 / 잠금 / 카테고리
            if (isUnlocked) {
                // 카테고리 (주제)
                const category = isBoss ? 'BOSS' : WordManager.getStageCategory(tile.worldId, tile.stageNum);
                const shortCat = category.length > 5 ? category.substring(0, 5) + '..' : category;

                if (isBoss) {
                    this._renderCrown(ctx, tx + tw / 2, ty + th * 0.22, 8 * sc);
                    ctx.font = `bold ${Math.round(11 * sc)}px ${CONFIG.RENDER.FONT_FAMILY}`;
                    ctx.fillStyle = textColor;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(tile.stageNum.toString(), tx + tw / 2, ty + th * 0.48);
                } else {
                    // 스테이지 번호
                    ctx.font = `bold ${Math.round(15 * sc)}px ${CONFIG.RENDER.FONT_FAMILY}`;
                    ctx.fillStyle = textColor;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(tile.stageNum.toString(), tx + tw / 2, ty + th * 0.32);

                    // 주제 텍스트 (타일 안에 작게)
                    ctx.font = `${Math.round(8 * sc)}px ${CONFIG.RENDER.FONT_FAMILY}`;
                    ctx.fillStyle = this._darkenColor(tileColor, 0.45);
                    ctx.fillText(shortCat, tx + tw / 2, ty + th * 0.55);
                }

                // 별점 (클리어)
                if (isCleared) {
                    this._renderTileStars(ctx, tx + tw / 2, ty + th - 10 * sc, result.stars, sc);
                }
            } else {
                // 잠금 아이콘
                this._renderLockIcon(ctx, tx + tw / 2, ty + th * 0.42, 9 * sc);
            }

            // 보스 배지
            if (isBoss && isUnlocked) {
                this._renderSmallBadge(ctx, tx + 5, ty + 5, 'B', '#fbbf24', '#f59e0b');
            }

            // 정확도 도트 (오른쪽 상단 구석)
            if (perfDot && !isBoss) {
                ctx.beginPath();
                ctx.arc(tx + tw - 6 * sc, ty + 6 * sc, 4 * sc, 0, Math.PI * 2);
                ctx.fillStyle = perfDot;
                ctx.fill();
            }

            ctx.restore();
        });
    },

    renderHeaderOverlay: function() {
        const ctx = this.ctx;
        const W = CONFIG.CANVAS.WIDTH;
        // 배경 상단 색상(#fff9c4)에 맞춘 밝은 오버레이
        const h = ctx.createLinearGradient(0, 0, 0, 75);
        h.addColorStop(0,    'rgba(255, 249, 200, 0.97)');
        h.addColorStop(0.65, 'rgba(255, 249, 200, 0.75)');
        h.addColorStop(1,    'rgba(255, 249, 200, 0)');
        ctx.fillStyle = h;
        ctx.fillRect(0, 0, W, 75);
    },

    renderWorldHeader: function(world) {
        const ctx = this.ctx;
        const W = CONFIG.CANVAS.WIDTH;

        ctx.font = `bold 18px ${CONFIG.RENDER.FONT_FAMILY}`;
        ctx.fillStyle = world.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`World ${world.id}`, W / 2, 24);

        ctx.font = `11px ${CONFIG.RENDER.FONT_FAMILY}`;
        ctx.fillStyle = '#4a3870';
        ctx.fillText(world.nameKo, W / 2, 42);

        if (this.currentWorldId > 1) this._renderArrowBtn(ctx, 35, 28, 'left');
        if (this.currentWorldId < CONFIG.WORLDS.length) this._renderArrowBtn(ctx, W - 35, 28, 'right');
    },

    // =========================================
    // 렌더링 헬퍼
    // =========================================

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

    _renderBadgeLabel: function(ctx, x, y, text, c1, c2) {
        ctx.save();
        ctx.font = `bold 9px ${CONFIG.RENDER.FONT_FAMILY}`;
        const tw = ctx.measureText(text).width + 12;
        const th = 16;
        this._roundRect(ctx, x - tw / 2, y - th / 2, tw, th, 8);
        const g = ctx.createLinearGradient(x - tw / 2, y, x + tw / 2, y);
        g.addColorStop(0, c1);
        g.addColorStop(1, c2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);
        ctx.restore();
    },

    _renderCurrentArrow: function(ctx, x, y) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x - 6, y - 5);
        ctx.lineTo(x + 6, y - 5);
        ctx.lineTo(x, y + 3);
        ctx.closePath();
        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = 'rgba(255,215,0,0.6)';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.restore();
    },

    _renderTileStars: function(ctx, x, y, stars, sc) {
        const sz = 4 * sc;
        const gap = sz * 2 + 2;
        const sx = x - gap;
        for (let i = 0; i < 3; i++) {
            this._drawStar(ctx, sx + i * gap, y, sz, 5);
            if (i < stars) {
                ctx.fillStyle = '#FFD700';
                ctx.fill();
            } else {
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.fill();
            }
        }
    },

    _drawStar: function(ctx, cx, cy, r, pts) {
        const inner = r * 0.45;
        ctx.beginPath();
        for (let i = 0; i < pts * 2; i++) {
            const rad = i % 2 === 0 ? r : inner;
            const angle = (Math.PI / pts) * i - Math.PI / 2;
            const x = cx + Math.cos(angle) * rad;
            const y = cy + Math.sin(angle) * rad;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
    },

    _renderCrown: function(ctx, x, y, sz) {
        ctx.save();
        const w = sz * 1.6, h = sz;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y + h / 2);
        ctx.lineTo(x - w / 2, y - h / 4);
        ctx.lineTo(x - w / 4, y + h / 8);
        ctx.lineTo(x, y - h / 2);
        ctx.lineTo(x + w / 4, y + h / 8);
        ctx.lineTo(x + w / 2, y - h / 4);
        ctx.lineTo(x + w / 2, y + h / 2);
        ctx.closePath();
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    },

    _renderLockIcon: function(ctx, x, y, sz) {
        ctx.save();
        const bw = sz * 1.1, bh = sz * 0.8;
        this._roundRect(ctx, x - bw / 2, y, bw, bh, 2);
        ctx.fillStyle = '#555b75';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, sz * 0.4, Math.PI, 0);
        ctx.strokeStyle = '#555b75';
        ctx.lineWidth = sz * 0.2;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
    },

    _renderSmallBadge: function(ctx, x, y, letter, c1, c2) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        const g = ctx.createLinearGradient(x, y - 8, x, y + 8);
        g.addColorStop(0, c1);
        g.addColorStop(1, c2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = `bold 8px ${CONFIG.RENDER.FONT_FAMILY}`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter, x, y);
        ctx.restore();
    },

    _renderArrowBtn: function(ctx, x, y, dir) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100, 60, 160, 0.12)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(100, 60, 160, 0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        if (dir === 'left') {
            ctx.moveTo(x + 4, y - 5);
            ctx.lineTo(x - 4, y);
            ctx.lineTo(x + 4, y + 5);
        } else {
            ctx.moveTo(x - 4, y - 5);
            ctx.lineTo(x + 4, y);
            ctx.lineTo(x - 4, y + 5);
        }
        ctx.strokeStyle = '#4a3870';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
    },

    /**
     * 주사위 아이콘 (장식용)
     */
    _renderDice: function(ctx, x, y) {
        ctx.save();
        const s = 18;
        this._roundRect(ctx, x - s / 2, y - s / 2, s, s, 3);
        ctx.fillStyle = 'rgba(160, 140, 200, 0.18)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(160, 140, 200, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 주사위 점
        ctx.fillStyle = 'rgba(100, 60, 160, 0.35)';
        const dots = [
            [x - 3, y - 3], [x + 3, y - 3],
            [x, y],
            [x - 3, y + 3], [x + 3, y + 3]
        ];
        dots.forEach(([dx, dy]) => {
            ctx.beginPath();
            ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    },

    // =========================================
    // 색상 유틸리티
    // =========================================

    _lightenColor: function(hex, amt) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + (255 - parseInt(hex.substr(0, 2), 16)) * amt);
        const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + (255 - parseInt(hex.substr(2, 2), 16)) * amt);
        const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + (255 - parseInt(hex.substr(4, 2), 16)) * amt);
        return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
    },

    _darkenColor: function(hex, amt) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - amt));
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - amt));
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - amt));
        return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
    },

    _hexToRgba: function(hex, a) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        return `rgba(${parseInt(hex.substr(0, 2), 16)},${parseInt(hex.substr(2, 2), 16)},${parseInt(hex.substr(4, 2), 16)},${a})`;
    }
};
