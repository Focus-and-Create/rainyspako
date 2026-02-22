/**
 * stage-map.js
 * 스테이지 맵 UI
 * 캔디크러시 스타일 경로 맵 렌더링
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
    
    /** @type {Array<Object>} 계산된 노드 위치들 */
    nodePositions: [],
    
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
        // 캔버스 및 컨텍스트 저장
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // HiDPI 캔버스 설정 (Retina 디스플레이 지원)
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = CONFIG.CANVAS.WIDTH * dpr;
        this.canvas.height = CONFIG.CANVAS.HEIGHT * dpr;
        this.ctx.scale(dpr, dpr);

        // 이벤트 리스너 등록
        this.setupEventListeners();

        // 노드 위치 계산
        this.calculateNodePositions();

        console.log('StageMap: 초기화 완료 (DPR:', dpr + ')');
    },
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners: function() {
        // 클릭 이벤트
        this.canvas.addEventListener('click', (e) => {
            this.handleClick(e);
        });

        // 마우스 이동 (커서 변경)
        this.canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });

        // 마우스 휠 스크롤
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
    // 노드 위치 계산
    // =========================================
    
    /** @type {number} 한 행당 노드 수 */
    COLS: 3,

    /**
     * 스테이지 노드 위치 계산 (세로 스크롤 가능한 유연한 뱀 형태)
     */
    calculateNodePositions: function() {
        this.nodePositions = [];

        const world = getWorldConfig(this.currentWorldId);
        if (!world) return;

        const totalStages = world.stages;
        const cols = this.COLS;
        const rows = Math.ceil(totalStages / cols);

        const W = CONFIG.CANVAS.WIDTH;
        const H = CONFIG.CANVAS.HEIGHT;
        const padX = 120;
        const topY = 120;
        const rowSpacing = 84;
        const colSpacing = cols > 1 ? (W - padX * 2) / (cols - 1) : 0;

        for (let i = 0; i < totalStages; i++) {
            const row = Math.floor(i / cols);
            const col = i % cols;
            const isReversed = row % 2 !== 0;
            const actualCol = isReversed ? (cols - 1 - col) : col;

            const laneOffset = Math.sin((row + actualCol * 0.5) * 0.8) * 14;
            const waveX = Math.cos((row * 0.65) + actualCol) * 10;

            this.nodePositions.push({
                worldId: this.currentWorldId,
                stageNum: i + 1,
                x: padX + actualCol * colSpacing + waveX,
                y: topY + row * rowSpacing + laneOffset,
                radius: CONFIG.MAP.NODE_RADIUS
            });
        }

        const contentHeight = topY + Math.max(0, rows - 1) * rowSpacing + 120;
        this.maxScrollY = Math.max(0, contentHeight - H);
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
     * @param {MouseEvent} e - 마우스 이벤트
     */
    handleClick: function(e) {
        const { x, y } = this._toLogical(e);

        // 월드 전환 화살표 체크 (헤더 영역, 고정)
        if (y < 65) {
            if (x < 65 && this.currentWorldId > 1) {
                this.prevWorld();
                return;
            }
            if (x > CONFIG.CANVAS.WIDTH - 65 && this.currentWorldId < CONFIG.WORLDS.length) {
                this.nextWorld();
                return;
            }
        }

        // 스크롤 적용된 좌표로 노드 찾기
        const sy = y + this.scrollY;

        const clickedNode = this.nodePositions.find(node => {
            const dx = x - node.x;
            const dy = sy - node.y;
            return Math.sqrt(dx * dx + dy * dy) <= node.radius + 15;
        });

        if (clickedNode) {
            this.handleNodeClick(clickedNode);
        }
    },

    /**
     * 마우스 이동 처리 (커서 변경)
     * @param {MouseEvent} e - 마우스 이벤트
     */
    handleMouseMove: function(e) {
        const { x, y } = this._toLogical(e);
        let isOverClickable = false;

        // 월드 전환 화살표 체크
        if (y < 65) {
            if (x < 65 && this.currentWorldId > 1) isOverClickable = true;
            if (x > CONFIG.CANVAS.WIDTH - 65 && this.currentWorldId < CONFIG.WORLDS.length) isOverClickable = true;
        }

        // 노드 호버 체크
        if (!isOverClickable) {
            const sy = y + this.scrollY;
            const hovered = this.nodePositions.find(node => {
                const dx = x - node.x;
                const dy = sy - node.y;
                return Math.sqrt(dx * dx + dy * dy) <= node.radius + 15;
            });
            if (hovered && Storage.isStageUnlocked(hovered.worldId, hovered.stageNum)) {
                isOverClickable = true;
            }
        }

        this.canvas.style.cursor = isOverClickable ? 'pointer' : 'default';
    },

    /**
     * 노드 클릭 처리
     * @param {Object} node - 클릭된 노드
     */
    handleNodeClick: function(node) {
        // 잠금 해제 여부 확인
        const isUnlocked = Storage.isStageUnlocked(node.worldId, node.stageNum);
        
        if (isUnlocked) {
            console.log(`StageMap: 스테이지 ${node.worldId}-${node.stageNum} 선택`);
            
            // 콜백 호출
            if (this.onStageSelect) {
                this.onStageSelect(node.worldId, node.stageNum);
            }
        } else {
            console.log(`StageMap: 스테이지 ${node.worldId}-${node.stageNum} 잠김`);
        }
    },
    
    /**
     * 스크롤 처리
     * @param {number} deltaY - 스크롤 양
     */
    handleScroll: function(deltaY) {
        // 스크롤 적용 (부드럽게)
        this.scrollY += deltaY * 0.5;
        
        // 범위 제한
        this.scrollY = Math.max(0, Math.min(this.scrollY, this.maxScrollY));
        
        // 다시 렌더링
        this.render();
    },

    // =========================================
    // 월드 전환
    // =========================================
    
    /**
     * 월드 변경
     * @param {number} worldId - 변경할 월드 ID
     */
    setWorld: function(worldId) {
        // 유효한 월드인지 확인
        const world = getWorldConfig(worldId);
        if (!world) {
            console.warn(`StageMap: 유효하지 않은 월드 ID: ${worldId}`);
            return;
        }
        
        // 월드 변경
        this.currentWorldId = worldId;
        
        // 스크롤 리셋
        this.scrollY = 0;
        
        // 노드 위치 재계산
        this.calculateNodePositions();
        
        // 렌더링
        this.render();
        
        // 콜백 호출
        if (this.onWorldChange) {
            this.onWorldChange(worldId);
        }
        
        console.log(`StageMap: 월드 ${worldId} (${world.name})로 변경`);
    },
    
    /**
     * 다음 월드로 이동
     */
    nextWorld: function() {
        if (this.currentWorldId < CONFIG.WORLDS.length) {
            this.setWorld(this.currentWorldId + 1);
        }
    },
    
    /**
     * 이전 월드로 이동
     */
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

        // 배경 그라데이션 (조금 더 밝고 컬러풀)
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#1a1b4b');
        bgGrad.addColorStop(0.45, '#1e293b');
        bgGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // 컬러 오브(분위기 레이어)
        this.renderAtmosphere(world);

        // 경로 그리기
        this.renderPaths();

        // 노드 그리기
        this.renderNodes();

        // 헤더 배경 (노드 위에 오버레이)
        const headerFade = ctx.createLinearGradient(0, 0, 0, 70);
        headerFade.addColorStop(0, 'rgba(8, 11, 26, 0.95)');
        headerFade.addColorStop(1, 'rgba(8, 11, 26, 0)');
        ctx.fillStyle = headerFade;
        ctx.fillRect(0, 0, W, 70);

        // 월드 헤더 (고정 위치)
        this.renderWorldHeader(world);
    },
    
    /**
     * 맵 분위기용 컬러 오브 렌더링
     * @param {Object} world
     */
    renderAtmosphere: function(world) {
        const ctx = this.ctx;
        const W = CONFIG.CANVAS.WIDTH;
        const H = CONFIG.CANVAS.HEIGHT;

        ctx.save();

        const orb1 = ctx.createRadialGradient(W * 0.2, H * 0.2, 20, W * 0.2, H * 0.2, 220);
        orb1.addColorStop(0, world.color + '55');
        orb1.addColorStop(1, world.color + '00');
        ctx.fillStyle = orb1;
        ctx.fillRect(0, 0, W, H);

        const orb2 = ctx.createRadialGradient(W * 0.8, H * 0.7, 30, W * 0.8, H * 0.7, 260);
        orb2.addColorStop(0, 'rgba(99, 102, 241, 0.30)');
        orb2.addColorStop(1, 'rgba(99, 102, 241, 0)');
        ctx.fillStyle = orb2;
        ctx.fillRect(0, 0, W, H);

        ctx.restore();
    },

    /**
     * 경로 렌더링 (뱀 레이아웃)
     */
    renderPaths: function() {
        const ctx = this.ctx;
        if (this.nodePositions.length < 2) return;

        // 배경 경로 (글로우)
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        this._drawSnakePath(ctx);
        ctx.stroke();
        ctx.restore();

        // 메인 경로
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        this._drawSnakePath(ctx);
        ctx.stroke();
        ctx.restore();

        // 클리어된 구간 오버레이
        const world = getWorldConfig(this.currentWorldId);
        if (world) {
            let lastClearedIdx = -1;
            for (let i = 0; i < this.nodePositions.length; i++) {
                const stageId = getStageId(this.nodePositions[i].worldId, this.nodePositions[i].stageNum);
                const result = Storage.getStageResult(stageId);
                if (result && result.stars > 0) lastClearedIdx = i;
            }
            if (lastClearedIdx >= 0) {
                ctx.save();
                ctx.strokeStyle = world.color + '40';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                this._drawSnakePath(ctx, lastClearedIdx);
                ctx.stroke();
                ctx.restore();
            }
        }
    },

    /**
     * 뱀 형태 경로 그리기 헬퍼
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} [endIdx] - 여기까지만 그림 (미지정 시 전체)
     */
    _drawSnakePath: function(ctx, endIdx) {
        const cols = this.COLS;
        const last = endIdx !== undefined ? endIdx : this.nodePositions.length - 1;

        ctx.beginPath();
        ctx.moveTo(this.nodePositions[0].x, this.nodePositions[0].y - this.scrollY);

        for (let i = 1; i <= last; i++) {
            const prev = this.nodePositions[i - 1];
            const curr = this.nodePositions[i];
            const isRowTransition = Math.floor((i - 1) / cols) !== Math.floor(i / cols);

            if (isRowTransition) {
                // 행 사이 U턴: 부드러운 S커브
                const midY = ((prev.y - this.scrollY) + (curr.y - this.scrollY)) / 2;
                ctx.bezierCurveTo(prev.x, midY, curr.x, midY, curr.x, curr.y - this.scrollY);
            } else {
                // 같은 행: 살짝 아치형 커브
                const midX = (prev.x + curr.x) / 2;
                const curveAmt = -8;
                ctx.quadraticCurveTo(midX, ((prev.y - this.scrollY) + (curr.y - this.scrollY)) / 2 + curveAmt, curr.x, curr.y - this.scrollY);
            }
        }
    },
    
    /**
     * 노드 렌더링
     */
    renderNodes: function() {
        const ctx = this.ctx;
        const world = getWorldConfig(this.currentWorldId);

        this.nodePositions.forEach(node => {
            const drawY = node.y - this.scrollY;
            if (drawY < 74 || drawY > CONFIG.CANVAS.HEIGHT + 40) {
                return;
            }

            const isUnlocked = Storage.isStageUnlocked(node.worldId, node.stageNum);
            const stageId = getStageId(node.worldId, node.stageNum);
            const result = Storage.getStageResult(stageId);
            const isReview = WordManager.isReviewStage(node.worldId, node.stageNum);
            const isBoss = WordManager.isBossStage(node.worldId, node.stageNum);
            const progress = Storage.getCurrentProgress();
            const isCurrent = progress.worldId === node.worldId &&
                             progress.stageNum === node.stageNum;

            // 노드 색상 결정
            let nodeColor, borderColor, textColor;
            if (!isUnlocked) {
                nodeColor = '#1e293b';
                borderColor = '#334155';
                textColor = '#475569';
            } else if (isCurrent) {
                nodeColor = '#fbbf24';
                borderColor = '#fde68a';
                textColor = '#1e1b0e';
            } else if (result && result.stars > 0) {
                nodeColor = world.color;
                borderColor = world.color + 'cc';
                textColor = '#ffffff';
            } else {
                nodeColor = '#334155';
                borderColor = '#94a3b8';
                textColor = '#f1f5f9';
            }

            // 현재 위치 글로우
            if (isCurrent) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(node.x, drawY, node.radius + 10, 0, Math.PI * 2);
                const glow = ctx.createRadialGradient(node.x, drawY, node.radius, node.x, drawY, node.radius + 12);
                glow.addColorStop(0, 'rgba(251, 191, 36, 0.25)');
                glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
                ctx.fillStyle = glow;
                ctx.fill();
                ctx.restore();
            }

            // 클리어된 노드 글로우
            if (result && result.stars > 0 && !isCurrent) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(node.x, drawY, node.radius + 6, 0, Math.PI * 2);
                const glow = ctx.createRadialGradient(node.x, drawY, node.radius - 2, node.x, drawY, node.radius + 6);
                glow.addColorStop(0, world.color + '20');
                glow.addColorStop(1, world.color + '00');
                ctx.fillStyle = glow;
                ctx.fill();
                ctx.restore();
            }

            // 노드 원 (그라데이션)
            ctx.beginPath();
            ctx.arc(node.x, drawY, node.radius, 0, Math.PI * 2);
            if (isUnlocked) {
                const nodeGrad = ctx.createLinearGradient(node.x, drawY - node.radius, node.x, drawY + node.radius);
                nodeGrad.addColorStop(0, nodeColor);
                nodeGrad.addColorStop(1, this._darkenColor(nodeColor, 0.2));
                ctx.fillStyle = nodeGrad;
            } else {
                ctx.fillStyle = nodeColor;
            }
            ctx.fill();

            // 테두리
            if (isReview && isUnlocked) {
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2.5;
            } else {
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = 2;
            }
            ctx.stroke();

            // 스테이지 번호 텍스트
            ctx.font = `bold 13px ${CONFIG.RENDER.FONT_FAMILY}`;
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.stageNum.toString(), node.x, drawY);

            // 별점 표시 (클리어한 경우)
            if (result && result.stars > 0) {
                this.renderStars(node.x, drawY + node.radius + 11, result.stars);
            }

            // 잠금 아이콘 (잠긴 경우)
            if (!isUnlocked) {
                this.renderLockIcon(node.x, drawY - node.radius - 8);
            }

            // 복습 스테이지 표시
            if (isReview && isUnlocked) {
                this.renderReviewBadge(node.x + node.radius - 2, drawY - node.radius + 2);
            }

            // 보스 스테이지 표시
            if (isBoss && isUnlocked) {
                this.renderBossBadge(node.x - node.radius + 1, drawY - node.radius + 2);
            }

            // 카테고리 라벨 (컴팩트)
            {
                const labelY = result && result.stars > 0
                    ? drawY + node.radius + 22
                    : drawY + node.radius + 14;
                const categoryLabel = isBoss
                    ? 'BOSS'
                    : (isReview ? '복습' : WordManager.getStageCategory(node.worldId, node.stageNum));

                ctx.font = `10px ${CONFIG.RENDER.FONT_FAMILY}`;
                ctx.fillStyle = isBoss ? '#fbbf24' : (isReview ? '#fca5a5' : (isUnlocked ? '#94a3b8' : '#334155'));
                ctx.textAlign = 'center';
                ctx.fillText(categoryLabel, node.x, labelY);
            }
        });
    },

    /**
     * 색상 어둡게 만들기 헬퍼
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
     * 별점 렌더링 (실제 별 모양)
     * @param {number} x - 중심 X 좌표
     * @param {number} y - Y 좌표
     * @param {number} stars - 별 개수 (1-3)
     */
    renderStars: function(x, y, stars) {
        const ctx = this.ctx;
        const size = 4;
        const gap = 11;
        const startX = x - gap;

        for (let i = 0; i < 3; i++) {
            const starX = startX + i * gap;
            const isFilled = i < stars;

            this._drawStar(ctx, starX, y, size, 5);

            if (isFilled) {
                ctx.fillStyle = '#fbbf24';
                ctx.fill();
                // 글로우
                ctx.shadowColor = 'rgba(251, 191, 36, 0.6)';
                ctx.shadowBlur = 4;
                ctx.fill();
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = '#1e293b';
                ctx.fill();
                ctx.strokeStyle = '#334155';
                ctx.lineWidth = 1;
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
     * 잠금 아이콘 렌더링
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     */
    renderLockIcon: function(x, y) {
        const ctx = this.ctx;
        const bodyW = 10, bodyH = 7, bodyR = 2;
        const bx = x - bodyW / 2, by = y - 2;

        // 자물쇠 몸통 (둥근 사각형)
        ctx.beginPath();
        ctx.moveTo(bx + bodyR, by);
        ctx.lineTo(bx + bodyW - bodyR, by);
        ctx.arcTo(bx + bodyW, by, bx + bodyW, by + bodyR, bodyR);
        ctx.arcTo(bx + bodyW, by + bodyH, bx + bodyW - bodyR, by + bodyH, bodyR);
        ctx.lineTo(bx + bodyR, by + bodyH);
        ctx.arcTo(bx, by + bodyH, bx, by + bodyR, bodyR);
        ctx.arcTo(bx, by, bx + bodyR, by, bodyR);
        ctx.closePath();
        ctx.fillStyle = '#475569';
        ctx.fill();

        // 자물쇠 고리
        ctx.beginPath();
        ctx.arc(x, y - 3, 4.5, Math.PI, 0);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
    },
    
    /**
     * 복습 배지 렌더링
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     */
    renderReviewBadge: function(x, y) {
        const ctx = this.ctx;

        // R 배지
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        const badgeGrad = ctx.createLinearGradient(x, y - 8, x, y + 8);
        badgeGrad.addColorStop(0, '#ef4444');
        badgeGrad.addColorStop(1, '#dc2626');
        ctx.fillStyle = badgeGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = `bold 9px ${CONFIG.RENDER.FONT_FAMILY}`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('R', x, y);
    },

    /**
     * 보스 배지 렌더링
     * @param {number} x
     * @param {number} y
     */
    renderBossBadge: function(x, y) {
        const ctx = this.ctx;

        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        const badgeGrad = ctx.createLinearGradient(x, y - 8, x, y + 8);
        badgeGrad.addColorStop(0, '#fbbf24');
        badgeGrad.addColorStop(1, '#f59e0b');
        ctx.fillStyle = badgeGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = `bold 8px ${CONFIG.RENDER.FONT_FAMILY}`;
        ctx.fillStyle = '#111827';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('B', x, y);
    },
    
    /**
     * 월드 헤더 렌더링
     * @param {Object} world - 월드 설정 객체
     */
    renderWorldHeader: function(world) {
        const ctx = this.ctx;
        const W = CONFIG.CANVAS.WIDTH;

        // 월드 이름
        ctx.font = `bold 22px ${CONFIG.RENDER.FONT_FAMILY}`;
        ctx.fillStyle = world.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`World ${world.id}: ${world.name}`, W / 2, 28);

        // 한국어 부제
        ctx.font = `13px ${CONFIG.RENDER.FONT_FAMILY}`;
        ctx.fillStyle = '#64748b';
        ctx.fillText(world.nameKo, W / 2, 48);

        // 이전/다음 월드 화살표
        const arrowY = 32;

        if (this.currentWorldId > 1) {
            // 배경 원
            ctx.beginPath();
            ctx.arc(35, arrowY, 20, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            ctx.stroke();
            // 화살표
            ctx.beginPath();
            ctx.moveTo(40, arrowY - 7);
            ctx.lineTo(30, arrowY);
            ctx.lineTo(40, arrowY + 7);
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
        }

        if (this.currentWorldId < CONFIG.WORLDS.length) {
            ctx.beginPath();
            ctx.arc(W - 35, arrowY, 20, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            ctx.stroke();
            // 화살표
            ctx.beginPath();
            ctx.moveTo(W - 40, arrowY - 7);
            ctx.lineTo(W - 30, arrowY);
            ctx.lineTo(W - 40, arrowY + 7);
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
        }
    },
};

// 모듈 내보내기 (ES6 모듈 사용 시)
// export { StageMap };
