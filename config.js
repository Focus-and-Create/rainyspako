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
        WIDTH: 1000,                   // 게임 캔버스 너비 (px)
        HEIGHT: 700,                   // 게임 캔버스 높이 (px)
        BACKGROUND_COLOR: '#fff9e7',   // 게임 배경색 (밝은 크림)
        DEATH_LINE_Y: 645              // 이 Y좌표 아래로 떨어지면 단어 놓침
    },

    // =========================================
    // 월드 설정
    // =========================================
    WORLDS: [
        { id: 1,  name: 'Supervivencia',  nameKo: '생존·기초기능어', stages: 33, baseSpeed: 0.3,  speedIncrement: 0.015, color: '#4a9c6d' },
        { id: 2,  name: 'Personas',       nameKo: '사람·가족',      stages: 33, baseSpeed: 0.35, speedIncrement: 0.018, color: '#c9a227' },
        { id: 3,  name: 'Casa y Lugar',   nameKo: '집·위치',        stages: 33, baseSpeed: 0.4,  speedIncrement: 0.02,  color: '#a23b72' },
        { id: 4,  name: 'Comida y Compra',nameKo: '음식·쇼핑',      stages: 33, baseSpeed: 0.45, speedIncrement: 0.02,  color: '#2e86ab' },
        { id: 5,  name: 'Escuela y Trabajo', nameKo: '학교·일상동사', stages: 33, baseSpeed: 0.5,  speedIncrement: 0.022, color: '#e07a5f' },
        { id: 6,  name: 'Ciudad y Tránsito', nameKo: '도시·교통',     stages: 33, baseSpeed: 0.55, speedIncrement: 0.022, color: '#81b29a' },
        { id: 7,  name: 'Viaje y Problemas', nameKo: '여행·문제해결',  stages: 33, baseSpeed: 0.6,  speedIncrement: 0.025, color: '#f2cc8f' },
        { id: 8,  name: 'Salud',          nameKo: '건강·병원',       stages: 33, baseSpeed: 0.65, speedIncrement: 0.025, color: '#6d6875' },
        { id: 9,  name: 'Opinión y Emoción', nameKo: '취미·감정·의견', stages: 33, baseSpeed: 0.7,  speedIncrement: 0.028, color: '#e63946' },
        { id: 10, name: 'Sociedad y Naturaleza', nameKo: '사회·자연·추상', stages: 33, baseSpeed: 0.75, speedIncrement: 0.03,  color: '#457b9d' }
    ],

    // =========================================
    // 스테이지 설정
    // =========================================
    STAGE: {
        WORDS_PER_STAGE: 10,           // 스테이지당 신규 표제어 수
        WORDS_TO_CLEAR: 18,            // 클리어에 필요한 정답 수 (복습 포함)
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
        REVIEW_STAGE_INTERVAL: 11,     // 에피소드 보스 스테이지 간격 (10+1)
        MIN_WRONG_FOR_REVIEW: 5        // 오답 기반 복습 단어 최소 기준
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
    // 스테이지 맵 설정 (보드게임 스타일 - 외곽 경로)
    // =========================================
    MAP: {
        TILE_SIZE: 66,                 // 보드게임 타일 크기 (px)
        TILE_GAP: 6,                   // 타일 간 간격
        TILE_RADIUS: 12,               // 타일 둥근 모서리
        BOARD_COLS: 10,                // 보드 가로 칸 수
        BOARD_ROWS: 7,                 // 보드 세로 칸 수
        TOP_Y: 80,                     // 상단 여백 (헤더 아래)
        // 보드게임 타일 컬러 팔레트 (밝고 다채로운 파스텔톤)
        TILE_COLORS: [
            '#FF6B8A', '#FFB347', '#87CEEB', '#98FB98',
            '#DDA0DD', '#F0E68C', '#FF7F7F', '#7EC8E3',
            '#FFDAB9', '#B5EAD7', '#C7CEEA', '#FFD1DC'
        ],
        LOCKED_COLOR: '#3a3f55',       // 잠긴 타일 색상
        LOCKED_BORDER: '#555b75',      // 잠긴 타일 테두리
        CURRENT_GLOW: '#FFD700',       // 현재 스테이지 글로우
        BG_BOARD_COLOR: '#1a1f36'      // 보드 배경색
    },

    // =========================================
    // 로컬 스토리지 키
    // =========================================
    STORAGE_KEYS: {
        PROGRESS: 'spanish_rain_progress',
        WRONG_WORDS: 'spanish_rain_wrong_words',
        STATS: 'spanish_rain_stats',
        SETTINGS: 'spanish_rain_settings',
        PROFILE: 'spanish_rain_profile'
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
