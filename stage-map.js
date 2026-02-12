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
        const world = getWorldConfig(this.currentWorldId);
        
        // 배경 클리어
        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(0, 0, CONFIG.CANVAS.WIDTH, CONFIG.CANVAS.HEIGHT);
        
        // 스크롤 변환 적용
        ctx.save();
        ctx.translate(0, -this.scrollY);
        
        // 경로 그리기
        this.renderPaths();
        
        // 노드 그리기
        this.renderNodes();
        
        // 변환 복원
        ctx.restore();
        
        // 월드 헤더 (고정 위치)
        this.renderWorldHeader(world);
        
        // 스크롤 인디케이터
        this.renderScrollIndicator();
    },
    
    /**
     * 경로 렌더링
     */
    renderPaths: function() {
        const ctx = this.ctx;
        
        // 노드가 2개 미만이면 경로 없음
        if (this.nodePositions.length < 2) return;
        
        ctx.strokeStyle = CONFIG.MAP.PATH_COLOR;
        ctx.lineWidth = CONFIG.MAP.PATH_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // 경로 그리기 (베지어 곡선)
        ctx.beginPath();
        ctx.moveTo(this.nodePositions[0].x, this.nodePositions[0].y);
        
        for (let i = 1; i < this.nodePositions.length; i++) {
            const prev = this.nodePositions[i - 1];
            const curr = this.nodePositions[i];
            
            // 제어점 계산 (부드러운 곡선을 위해)
            const midY = (prev.y + curr.y) / 2;
            
            ctx.bezierCurveTo(
                prev.x, midY,
                curr.x, midY,
                curr.x, curr.y
            );
        }
        
        ctx.stroke();
    },
    
    /**
     * 노드 렌더링
     */
    renderNodes: function() {
        const ctx = this.ctx;
        const world = getWorldConfig(this.currentWorldId);
        
        this.nodePositions.forEach(node => {
            // 잠금 상태 확인
            const isUnlocked = Storage.isStageUnlocked(node.worldId, node.stageNum);
            
            // 클리어 정보 가져오기
            const stageId = getStageId(node.worldId, node.stageNum);
            const result = Storage.getStageResult(stageId);
            
            // 현재 진행 위치인지 확인
            const progress = Storage.getCurrentProgress();
            const isCurrent = progress.worldId === node.worldId && 
                             progress.stageNum === node.stageNum;
            
            // 노드 색상 결정
            let nodeColor;
            if (!isUnlocked) {
                nodeColor = CONFIG.MAP.LOCKED_COLOR;
            } else if (isCurrent) {
                nodeColor = CONFIG.MAP.CURRENT_COLOR;
            } else if (result) {
                nodeColor = world.color;
            } else {
                nodeColor = CONFIG.MAP.UNLOCKED_COLOR;
            }
            
            // 노드 원 그리기
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.fillStyle = nodeColor;
            ctx.fill();
            
            // 테두리 (복습 스테이지는 빨간 테두리)
            const isReview = WordManager.isReviewStage(node.worldId, node.stageNum);
            if (isReview && isUnlocked) {
                ctx.strokeStyle = '#ff6b6b';
                ctx.lineWidth = 3;
            } else {
                ctx.strokeStyle = isUnlocked ? '#ffffff' : '#333333';
                ctx.lineWidth = 2;
            }
            ctx.stroke();
            
            // 현재 위치 강조 (펄스 효과)
            if (isCurrent) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius + 5, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            
            // 스테이지 번호 텍스트
            ctx.font = 'bold 16px sans-serif';
            ctx.fillStyle = isUnlocked ? '#000000' : '#666666';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.stageNum.toString(), node.x, node.y);
            
            // 별점 표시 (클리어한 경우)
            if (result && result.stars > 0) {
                this.renderStars(node.x, node.y + node.radius + 15, result.stars);
            }
            
            // 잠금 아이콘 (잠긴 경우)
            if (!isUnlocked) {
                this.renderLockIcon(node.x, node.y - node.radius - 10);
            }
            
            // 복습 스테이지 표시
            if (WordManager.isReviewStage(node.worldId, node.stageNum) && isUnlocked) {
                this.renderReviewBadge(node.x + node.radius, node.y - node.radius);
            }
        });
    },
    
    /**
     * 별점 렌더링
     * @param {number} x - 중심 X 좌표
     * @param {number} y - Y 좌표
     * @param {number} stars - 별 개수 (1-3)
     */
    renderStars: function(x, y, stars) {
        const ctx = this.ctx;
        const starSize = 8;
        const gap = 12;
        const startX = x - gap;
        
        for (let i = 0; i < 3; i++) {
            const starX = startX + i * gap;
            const isFilled = i < stars;
            
            // 별 그리기 (간단한 원으로 대체)
            ctx.beginPath();
            ctx.arc(starX, y, starSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = isFilled ? '#ffd700' : '#333333';
            ctx.fill();
        }
    },
    
    /**
     * 잠금 아이콘 렌더링
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     */
    renderLockIcon: function(x, y) {
        const ctx = this.ctx;
        
        // 간단한 자물쇠 모양
        ctx.fillStyle = '#666666';
        ctx.fillRect(x - 5, y - 3, 10, 8);
        
        ctx.beginPath();
        ctx.arc(x, y - 5, 5, Math.PI, 0);
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 2;
        ctx.stroke();
    },
    
    /**
     * 복습 배지 렌더링
     * @param {number} x - X 좌표
     * @param {number} y - Y 좌표
     */
    renderReviewBadge: function(x, y) {
        const ctx = this.ctx;

        // R 배지 (더 크게)
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6b6b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.font = 'bold 12px sans-serif';
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
        
        // 헤더 배경
        const gradient = ctx.createLinearGradient(0, 0, 0, 60);
        gradient.addColorStop(0, 'rgba(13, 13, 26, 1)');
        gradient.addColorStop(1, 'rgba(13, 13, 26, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CONFIG.CANVAS.WIDTH, 60);
        
        // 월드 이름
        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = world.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`World ${world.id}: ${world.name}`, CONFIG.CANVAS.WIDTH / 2, 30);
        
        // 한국어 부제
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#888888';
        ctx.fillText(world.nameKo, CONFIG.CANVAS.WIDTH / 2, 50);
        
        // 이전/다음 월드 화살표 (큰 버튼)
        if (this.currentWorldId > 1) {
            // 배경 원
            ctx.beginPath();
            ctx.arc(35, 30, 22, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fill();
            ctx.font = 'bold 28px sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('<', 35, 30);
        }

        if (this.currentWorldId < CONFIG.WORLDS.length) {
            // 배경 원
            ctx.beginPath();
            ctx.arc(CONFIG.CANVAS.WIDTH - 35, 30, 22, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fill();
            ctx.font = 'bold 28px sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('>', CONFIG.CANVAS.WIDTH - 35, 30);
        }
    },
    
    /**
     * 스크롤 인디케이터 렌더링
     */
    renderScrollIndicator: function() {
        // 스크롤 필요 없으면 표시 안 함
        if (this.maxScrollY <= 0) return;
        
        const ctx = this.ctx;
        
        // 스크롤바 위치 계산
        const barHeight = 100;
        const barX = CONFIG.CANVAS.WIDTH - 10;
        const barY = 80;
        const trackHeight = CONFIG.CANVAS.HEIGHT - 160;
        
        // 트랙 (배경)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(barX, barY, 5, trackHeight);
        
        // 핸들 위치 계산
        const handleRatio = this.scrollY / this.maxScrollY;
        const handleY = barY + handleRatio * (trackHeight - barHeight);
        
        // 핸들
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(barX, handleY, 5, barHeight);
    }
};

// 모듈 내보내기 (ES6 모듈 사용 시)
// export { StageMap };
