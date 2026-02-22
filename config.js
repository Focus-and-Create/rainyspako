/**
 * config.js
 * 게임 전역 설정값
 * 모든 조정 가능한 상수를 한 곳에서 관리
 */

const CONFIG = {
    // =========================================
    // 캔버스 설정
    // =========================================
    CANVAS: {
        WIDTH: 800,                    // 게임 캔버스 너비 (px)
        HEIGHT: 600,                   // 게임 캔버스 높이 (px)
        BACKGROUND_COLOR: '#0f172a',   // 게임 배경색 (딥 네이비)
        DEATH_LINE_Y: 550              // 이 Y좌표 아래로 떨어지면 단어 놓침
    },

    // =========================================
    // 월드 설정
    // =========================================
    WORLDS: [
        { id: 1,  name: 'Fundamentos',   nameKo: '기초',     stages: 20, baseSpeed: 0.3,  speedIncrement: 0.015, color: '#4a9c6d' },
        { id: 2,  name: 'Vida Cotidiana', nameKo: '일상생활', stages: 20, baseSpeed: 0.35, speedIncrement: 0.018, color: '#c9a227' },
        { id: 3,  name: 'Personas',       nameKo: '사람',     stages: 20, baseSpeed: 0.4,  speedIncrement: 0.02,  color: '#a23b72' },
        { id: 4,  name: 'Naturaleza',     nameKo: '자연',     stages: 20, baseSpeed: 0.45, speedIncrement: 0.02,  color: '#2e86ab' },
        { id: 5,  name: 'Ciudad',         nameKo: '도시',     stages: 20, baseSpeed: 0.5,  speedIncrement: 0.022, color: '#e07a5f' },
        { id: 6,  name: 'Comida',         nameKo: '음식',     stages: 20, baseSpeed: 0.55, speedIncrement: 0.022, color: '#81b29a' },
        { id: 7,  name: 'Trabajo',        nameKo: '직업',     stages: 20, baseSpeed: 0.6,  speedIncrement: 0.025, color: '#f2cc8f' },
        { id: 8,  name: 'Ocio',           nameKo: '여가',     stages: 20, baseSpeed: 0.65, speedIncrement: 0.025, color: '#6d6875' },
        { id: 9,  name: 'Sociedad',       nameKo: '사회',     stages: 20, baseSpeed: 0.7,  speedIncrement: 0.028, color: '#e63946' },
        { id: 10, name: 'Ciencia',        nameKo: '과학',     stages: 20, baseSpeed: 0.75, speedIncrement: 0.03,  color: '#457b9d' }
    ],

    // =========================================
    // 스테이지 설정
    // =========================================
    STAGE: {
        WORDS_PER_STAGE: 15,           // 스테이지당 학습 단어 수
        WORDS_TO_CLEAR: 20,            // 클리어에 필요한 정답 수 (같은 단어 반복 포함)
        MAX_ACTIVE_WORDS: 3,           // 동시에 화면에 표시되는 최대 단어 수
        SPAWN_INTERVAL_MS: 2000,       // 새 단어 생성 간격 (밀리초)
        MIN_SPAWN_INTERVAL_MS: 800     // 최소 생성 간격 (속도 증가 시)
    },

    // =========================================
    // 라이프 및 점수 설정
    // =========================================
    GAME: {
        INITIAL_LIVES: 3,              // 시작 라이프 수
        BASE_SCORE: 100,               // 기본 정답 점수
        COMBO_MULTIPLIER: 0.1,         // 콤보당 점수 배율 증가 (10%)
        MAX_COMBO_MULTIPLIER: 3.0,     // 최대 콤보 배율
        SPEED_BONUS_THRESHOLD: 3000,   // 빠른 정답 보너스 기준 (밀리초)
        SPEED_BONUS_POINTS: 50         // 빠른 정답 추가 점수
    },

    // =========================================
    // 별점 기준
    // =========================================
    STARS: {
        THREE_STAR_ACCURACY: 100,      // 3성: 정확도 100%
        THREE_STAR_TIME_BONUS: true,   // 3성: 시간 보너스 필요
        TWO_STAR_ACCURACY: 90,         // 2성: 정확도 90% 이상
        ONE_STAR_ACCURACY: 0           // 1성: 클리어만 하면 됨
    },

    // =========================================
    // 복습 시스템
    // =========================================
    REVIEW: {
        WRONG_WORD_FREQUENCY_BOOST: 2, // 틀린 단어 출현 빈도 배율
        REVIEW_STAGE_INTERVAL: 5,      // N 스테이지마다 복습 스테이지
        MIN_WRONG_FOR_REVIEW: 3        // 복습 스테이지 생성 최소 틀린 단어 수
    },

    // =========================================
    // 렌더링 설정
    // =========================================
    RENDER: {
        FONT_FAMILY: "'Noto Sans KR', sans-serif",
        WORD_FONT_SIZE: 22,            // 떨어지는 단어 폰트 크기
        INPUT_FONT_SIZE: 24,           // 입력창 폰트 크기
        WORD_COLOR: '#f1f5f9',         // 단어 기본 색상
        WORD_MATCHED_COLOR: '#34d399', // 매칭된 글자 색상 (에메랄드)
        WORD_SHADOW_COLOR: 'rgba(0, 0, 0, 0.4)'
    },

    // =========================================
    // 스테이지 맵 설정
    // =========================================
    MAP: {
        NODE_RADIUS: 26,               // 스테이지 노드 반지름
        NODE_SPACING_X: 80,            // 노드 간 X 간격
        NODE_SPACING_Y: 100,           // 노드 간 Y 간격
        PATH_COLOR: 'rgba(255, 255, 255, 0.08)', // 경로 선 색상
        PATH_WIDTH: 3,                 // 경로 선 두께
        LOCKED_COLOR: '#1e293b',       // 잠긴 스테이지 색상
        UNLOCKED_COLOR: '#334155',     // 잠금해제 스테이지 색상
        CURRENT_COLOR: '#fbbf24'       // 현재 스테이지 강조 색상
    },

    // =========================================
    // 로컬 스토리지 키
    // =========================================
    STORAGE_KEYS: {
        PROGRESS: 'spanish_rain_progress',
        WRONG_WORDS: 'spanish_rain_wrong_words',
        STATS: 'spanish_rain_stats',
        SETTINGS: 'spanish_rain_settings'
    }
};

// =========================================
// 유틸리티 함수
// =========================================

/**
 * 월드 ID로 월드 설정 가져오기
 * @param {number} worldId - 월드 ID (1, 2, 3)
 * @returns {Object|null} 월드 설정 객체
 */
function getWorldConfig(worldId) {
    // 배열 인덱스는 0부터 시작하므로 -1
    return CONFIG.WORLDS[worldId - 1] || null;
}

/**
 * 스테이지 ID 문자열 생성
 * @param {number} worldId - 월드 ID
 * @param {number} stageNum - 스테이지 번호
 * @returns {string} "1-5" 형태의 스테이지 ID
 */
function getStageId(worldId, stageNum) {
    return `${worldId}-${stageNum}`;
}

/**
 * 스테이지 ID 파싱
 * @param {string} stageId - "1-5" 형태의 스테이지 ID
 * @returns {{worldId: number, stageNum: number}} 파싱된 객체
 */
function parseStageId(stageId) {
    // 스테이지 ID를 '-' 기준으로 분리
    const parts = stageId.split('-');
    return {
        worldId: parseInt(parts[0], 10),
        stageNum: parseInt(parts[1], 10)
    };
}

/**
 * 해당 스테이지의 속도 계산
 * @param {number} worldId - 월드 ID
 * @param {number} stageNum - 스테이지 번호
 * @param {number} progressRatio - 스테이지 내 진행률 (0~1)
 * @returns {number} 계산된 속도
 */
function calculateSpeed(worldId, stageNum, progressRatio) {
    // 월드 설정 가져오기
    const world = getWorldConfig(worldId);
    
    // 월드를 찾지 못하면 기본값 반환
    if (!world) {
        return 0.5;
    }
    
    // 기본 속도 + (스테이지 번호에 따른 증가) + (진행률에 따른 증가)
    const stageBonus = (stageNum - 1) * 0.02;
    const progressBonus = progressRatio * world.speedIncrement * 10;
    
    return world.baseSpeed + stageBonus + progressBonus;
}

// 모듈 내보내기 (ES6 모듈 사용 시)
// export { CONFIG, getWorldConfig, getStageId, parseStageId, calculateSpeed };
