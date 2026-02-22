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
        
        // 캔버스 크기 설정
        this.canvas.width = CONFIG.CANVAS.WIDTH;
        this.canvas.height = CONFIG.CANVAS.HEIGHT;
        
        // 이벤트 리스너 등록
        this.setupEventListeners();
        
        // 노드 위치 계산
        this.calculateNodePositions();
        
        console.log('StageMap: 초기화 완료');
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
    
    /**
     * 스테이지 노드 위치 계산
     */
    calculateNodePositions: function() {
        this.nodePositions = [];
        
        // 현재 월드 설정 가져오기
        const world = getWorldConfig(this.currentWorldId);
        if (!world) return;
        
        // 맵 설정
        const startY = 100;                           // 시작 Y 위치
        const spacing = CONFIG.MAP.NODE_SPACING_Y;    // 노드 간 Y 간격
        const centerX = CONFIG.CANVAS.WIDTH / 2;      // 중앙 X
        const waveAmplitude = 80;                     // 좌우 흔들림 폭
        
        // 각 스테이지의 노드 위치 계산
        for (let i = 1; i <= world.stages; i++) {
            // 지그재그 패턴으로 X 좌표 계산
            const waveOffset = Math.sin((i - 1) * 0.5) * waveAmplitude;
            
            const node = {
                worldId: this.currentWorldId,
                stageNum: i,
                x: centerX + waveOffset,
                y: startY + (i - 1) * spacing,
                radius: CONFIG.MAP.NODE_RADIUS
            };
            
            this.nodePositions.push(node);
        }
        
        // 최대 스크롤 값 계산
        const totalHeight = startY + world.stages * spacing;
        this.maxScrollY = Math.max(0, totalHeight - CONFIG.CANVAS.HEIGHT + 100);
        
        // 스크롤을 현재 진행 위치로 이동
        this.scrollToCurrentProgress();
    },
    
    /**
     * 현재 진행 위치로 스크롤
     */
    scrollToCurrentProgress: function() {
        // 현재 진행 상황 가져오기
        const progress = Storage.getCurrentProgress();
        
        // 현재 월드가 맞으면 해당 스테이지로 스크롤
        if (progress.worldId === this.currentWorldId) {
            const targetNode = this.nodePositions.find(
                n => n.stageNum === progress.stageNum
            );
            
            if (targetNode) {
                // 노드가 화면 중앙에 오도록 스크롤
                this.scrollY = Math.max(
                    0,
                    Math.min(
                        targetNode.y - CONFIG.CANVAS.HEIGHT / 2,
                        this.maxScrollY
                    )
                );
            }
        }
    },

    // =========================================
    // 이벤트 처리
    // =========================================
    
    /**
     * 클릭 이벤트 처리
     * @param {MouseEvent} e - 마우스 이벤트
     */
    handleClick: function(e) {
        // 캔버스 내 좌표 계산
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top + this.scrollY;
        
        // 월드 전환 화살표 체크 (넓은 클릭 영역)
        if (y < 80) {
            // 이전 월드 화살표
            if (x < 80 && this.currentWorldId > 1) {
                this.prevWorld();
                return;
            }
            // 다음 월드 화살표
            if (x > CONFIG.CANVAS.WIDTH - 80 && this.currentWorldId < CONFIG.WORLDS.length) {
                this.nextWorld();
                return;
            }
        }
        
        // 클릭된 노드 찾기
        const clickedNode = this.nodePositions.find(node => {
            const dx = x - node.x;
            const dy = y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance <= node.radius + 15; // 넉넉한 클릭 영역
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
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top + this.scrollY;

        let isOverClickable = false;

        // 월드 전환 화살표 체크
        if (y - this.scrollY < 60) {
            if (x < 70 && this.currentWorldId > 1) isOverClickable = true;
            if (x > CONFIG.CANVAS.WIDTH - 70 && this.currentWorldId < CONFIG.WORLDS.length) isOverClickable = true;
        }

        // 노드 호버 체크
        if (!isOverClickable) {
            const hovered = this.nodePositions.find(node => {
                const dx = x - node.x;
                const dy = y - node.y;
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

        // 배경 그라데이션
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#080b1a');
        bgGrad.addColorStop(0.5, '#0f172a');
        bgGrad.addColorStop(1, '#111827');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // 스크롤 변환 적용
        ctx.save();
        ctx.translate(0, -this.scrollY);

        // 경로 그리기
        this.renderPaths();

        // 노드 그리기
        this.renderNodes();

        // 변환 복원
        ctx.restore();

        // 상하 페이드 (위쪽)
        const topFade = ctx.createLinearGradient(0, 0, 0, 80);
        topFade.addColorStop(0, '#080b1a');
        topFade.addColorStop(1, 'rgba(8, 11, 26, 0)');
        ctx.fillStyle = topFade;
        ctx.fillRect(0, 0, W, 80);

        // 상하 페이드 (아래쪽)
        const botFade = ctx.createLinearGradient(0, H - 40, 0, H);
        botFade.addColorStop(0, 'rgba(8, 11, 26, 0)');
        botFade.addColorStop(1, '#080b1a');
        ctx.fillStyle = botFade;
        ctx.fillRect(0, H - 40, W, 40);

        // 월드 헤더 (고정 위치)
        this.renderWorldHeader(world);
    },
    
    /**
     * 경로 렌더링
     */
    renderPaths: function() {
        const ctx = this.ctx;

        // 노드가 2개 미만이면 경로 없음
        if (this.nodePositions.length < 2) return;

        // 배경 경로 (어둡게)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = CONFIG.MAP.PATH_WIDTH + 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        this._drawPathCurve(ctx);
        ctx.stroke();

        // 메인 경로
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = CONFIG.MAP.PATH_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        this._drawPathCurve(ctx);
        ctx.stroke();

        // 클리어된 구간은 accent 색상으로 오버레이
        const world = getWorldConfig(this.currentWorldId);
        if (world) {
            let lastClearedIdx = -1;
            for (let i = 0; i < this.nodePositions.length; i++) {
                const stageId = getStageId(this.nodePositions[i].worldId, this.nodePositions[i].stageNum);
                const result = Storage.getStageResult(stageId);
                if (result && result.stars > 0) {
                    lastClearedIdx = i;
                }
            }
            if (lastClearedIdx >= 0) {
                ctx.save();
                ctx.strokeStyle = world.color + '40'; // 25% opacity
                ctx.lineWidth = CONFIG.MAP.PATH_WIDTH;
                ctx.lineCap = 'round';
                // 클리어된 구간만 그리기
                ctx.beginPath();
                ctx.moveTo(this.nodePositions[0].x, this.nodePositions[0].y);
                for (let i = 1; i <= lastClearedIdx; i++) {
                    const prev = this.nodePositions[i - 1];
                    const curr = this.nodePositions[i];
                    const midY = (prev.y + curr.y) / 2;
                    ctx.bezierCurveTo(prev.x, midY, curr.x, midY, curr.x, curr.y);
                }
                ctx.stroke();
                ctx.restore();
            }
        }
    },

    /**
     * 경로 곡선 헬퍼
     */
    _drawPathCurve: function(ctx) {
        ctx.beginPath();
        ctx.moveTo(this.nodePositions[0].x, this.nodePositions[0].y);
        for (let i = 1; i < this.nodePositions.length; i++) {
            const prev = this.nodePositions[i - 1];
            const curr = this.nodePositions[i];
            const midY = (prev.y + curr.y) / 2;
            ctx.bezierCurveTo(prev.x, midY, curr.x, midY, curr.x, curr.y);
        }
    },
    
    /**
     * 노드 렌더링
     */
    renderNodes: function() {
        const ctx = this.ctx;
        const world = getWorldConfig(this.currentWorldId);

        this.nodePositions.forEach(node => {
            const isUnlocked = Storage.isStageUnlocked(node.worldId, node.stageNum);
            const stageId = getStageId(node.worldId, node.stageNum);
            const result = Storage.getStageResult(stageId);
            const isReview = WordManager.isReviewStage(node.worldId, node.stageNum);
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
                ctx.arc(node.x, node.y, node.radius + 10, 0, Math.PI * 2);
                const glow = ctx.createRadialGradient(node.x, node.y, node.radius, node.x, node.y, node.radius + 12);
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
                ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
                const glow = ctx.createRadialGradient(node.x, node.y, node.radius - 2, node.x, node.y, node.radius + 6);
                glow.addColorStop(0, world.color + '20');
                glow.addColorStop(1, world.color + '00');
                ctx.fillStyle = glow;
                ctx.fill();
                ctx.restore();
            }

            // 노드 원 (그라데이션)
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            if (isUnlocked) {
                const nodeGrad = ctx.createLinearGradient(node.x, node.y - node.radius, node.x, node.y + node.radius);
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
            ctx.font = `bold 15px ${CONFIG.RENDER.FONT_FAMILY}`;
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.stageNum.toString(), node.x, node.y);

            // 별점 표시 (클리어한 경우)
            if (result && result.stars > 0) {
                this.renderStars(node.x, node.y + node.radius + 14, result.stars);
            }

            // 잠금 아이콘 (잠긴 경우)
            if (!isUnlocked) {
                this.renderLockIcon(node.x, node.y - node.radius - 10);
            }

            // 복습 스테이지 표시
            if (isReview && isUnlocked) {
                this.renderReviewBadge(node.x + node.radius, node.y - node.radius);
            }

            // 카테고리 라벨
            {
                const labelY = result && result.stars > 0
                    ? node.y + node.radius + 28
                    : node.y + node.radius + 18;
                const categoryLabel = isReview
                    ? '복습 스테이지'
                    : WordManager.getStageCategory(node.worldId, node.stageNum);

                ctx.font = `11px ${CONFIG.RENDER.FONT_FAMILY}`;
                ctx.fillStyle = isReview ? '#fca5a5' : (isUnlocked ? '#64748b' : '#334155');
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
        const size = 5;
        const gap = 13;
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
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        const badgeGrad = ctx.createLinearGradient(x, y - 10, x, y + 10);
        badgeGrad.addColorStop(0, '#ef4444');
        badgeGrad.addColorStop(1, '#dc2626');
        ctx.fillStyle = badgeGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = `bold 11px ${CONFIG.RENDER.FONT_FAMILY}`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('R', x, y);
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
