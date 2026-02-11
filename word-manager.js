/**
 * word-manager.js
 * 단어 데이터 로딩 및 관리
 * 스테이지별 단어 선택, 복습 단어 빈도 조절
 */

const WordManager = {
    // =========================================
    // 상태
    // =========================================
    
    /** @type {Object<string, Array>} 월드별 로드된 단어 데이터 */
    _wordData: {},
    
    /** @type {boolean} 데이터 로드 완료 여부 */
    _isLoaded: false,

    // =========================================
    // 데이터 로딩
    // =========================================
    
    /**
     * 모든 월드의 단어 데이터 로드
     * @returns {Promise<boolean>} 로드 성공 여부
     */
    loadAll: async function() {
        try {
            // 각 월드의 JSON 파일 경로 (CONFIG.WORLDS에서 동적 생성)
            const files = CONFIG.WORLDS.map(w => ({
                worldId: w.id,
                path: `world${w.id}.json`
            }));
            
            // 병렬로 모든 파일 로드
            const loadPromises = files.map(async (file) => {
                // fetch로 JSON 파일 요청
                const response = await fetch(file.path);
                
                // 응답 실패 시 에러 발생
                if (!response.ok) {
                    throw new Error(`${file.path} 로드 실패: ${response.status}`);
                }
                
                // JSON 파싱
                const data = await response.json();
                
                // 월드 데이터 저장
                this._wordData[file.worldId] = data.stages;
            });
            
            // 모든 로드 완료 대기
            await Promise.all(loadPromises);
            
            // 로드 완료 플래그 설정
            this._isLoaded = true;
            
            console.log('WordManager: 모든 단어 데이터 로드 완료');
            return true;
            
        } catch (error) {
            console.error('WordManager: 단어 데이터 로드 실패', error);
            return false;
        }
    },
    
    /**
     * 데이터 로드 여부 확인
     * @returns {boolean}
     */
    isLoaded: function() {
        return this._isLoaded;
    },

    // =========================================
    // 스테이지 단어 조회
    // =========================================
    
    /**
     * 특정 스테이지의 단어 목록 가져오기
     * @param {number} worldId - 월드 ID (1, 2, 3)
     * @param {number} stageNum - 스테이지 번호 (1-20)
     * @returns {Array<{es: string, ko: string}>} 단어 배열
     */
    getStageWords: function(worldId, stageNum) {
        // 데이터 로드 확인
        if (!this._isLoaded) {
            console.warn('WordManager: 데이터가 아직 로드되지 않음');
            return [];
        }
        
        // 월드 데이터 확인
        const worldData = this._wordData[worldId];
        if (!worldData) {
            console.warn(`WordManager: 월드 ${worldId} 데이터 없음`);
            return [];
        }
        
        // 스테이지 데이터 확인 (배열 인덱스는 0부터)
        const stageData = worldData[stageNum - 1];
        if (!stageData) {
            console.warn(`WordManager: 스테이지 ${worldId}-${stageNum} 데이터 없음`);
            return [];
        }
        
        // 단어 배열 반환
        return stageData.words || [];
    },

    // =========================================
    // 게임용 단어 선택
    // =========================================
    
    /**
     * 게임에 사용할 단어 풀 생성 (복습 단어 빈도 조절 포함)
     * @param {number} worldId - 월드 ID
     * @param {number} stageNum - 스테이지 번호
     * @returns {Array<{es: string, ko: string, isReview: boolean}>} 가중치 적용된 단어 풀
     */
    createWordPool: function(worldId, stageNum) {
        // 스테이지 기본 단어 가져오기
        const stageWords = this.getStageWords(worldId, stageNum);
        
        // 결과 배열 (각 단어를 기본 1회 포함)
        const pool = stageWords.map(word => ({
            es: word.es,
            ko: word.ko,
            isReview: false
        }));
        
        // 틀린 단어 목록 가져오기
        const wrongWords = Storage.getWrongWords();
        
        // 스테이지 단어 중 틀린 적 있는 단어 찾기
        stageWords.forEach(word => {
            // 틀린 단어 목록에서 검색
            const wrongRecord = wrongWords.find(w => w.es === word.es);
            
            if (wrongRecord) {
                // 틀린 횟수만큼 추가 (빈도 증가)
                const extraCount = Math.min(
                    wrongRecord.wrongCount * CONFIG.REVIEW.WRONG_WORD_FREQUENCY_BOOST,
                    10  // 최대 10회까지만 추가
                );
                
                for (let i = 0; i < extraCount; i++) {
                    pool.push({
                        es: word.es,
                        ko: word.ko,
                        isReview: true
                    });
                }
            }
        });
        
        return pool;
    },
    
    /**
     * 단어 풀에서 랜덤하게 단어 선택
     * @param {Array} pool - createWordPool로 생성된 단어 풀
     * @param {Array<string>} exclude - 제외할 스페인어 단어 목록 (현재 화면에 있는 것들)
     * @returns {{es: string, ko: string, isReview: boolean}|null} 선택된 단어 또는 null
     */
    pickRandomWord: function(pool, exclude = []) {
        // 제외 목록에 없는 단어만 필터링
        const available = pool.filter(word => !exclude.includes(word.es));
        
        // 사용 가능한 단어가 없으면 null
        if (available.length === 0) {
            return null;
        }
        
        // 랜덤 인덱스로 선택
        const randomIndex = Math.floor(Math.random() * available.length);
        return available[randomIndex];
    },

    // =========================================
    // 복습 스테이지 생성
    // =========================================
    
    /**
     * 복습 스테이지 여부 확인
     * @param {number} worldId - 월드 ID
     * @param {number} stageNum - 스테이지 번호
     * @returns {boolean} 복습 스테이지 여부
     */
    isReviewStage: function(worldId, stageNum) {
        // N 스테이지마다 복습 스테이지 (5, 10, 15, 20)
        return stageNum % CONFIG.REVIEW.REVIEW_STAGE_INTERVAL === 0;
    },
    
    /**
     * 복습 스테이지용 단어 풀 생성
     * @returns {Array<{es: string, ko: string, isReview: boolean}>} 복습 단어 풀
     */
    createReviewPool: function() {
        // 복습 필요 단어 가져오기 (최대 10개)
        const reviewWords = Storage.getWordsForReview(10);
        
        // 복습할 단어가 부족하면 빈 배열 반환
        if (reviewWords.length < CONFIG.REVIEW.MIN_WRONG_FOR_REVIEW) {
            console.log('WordManager: 복습할 단어가 충분하지 않음');
            return [];
        }
        
        // 단어 풀 생성 (각 단어를 틀린 횟수에 비례하여 추가)
        const pool = [];
        
        reviewWords.forEach(word => {
            // 기본 1회 + 틀린 횟수만큼 추가
            const count = 1 + word.wrongCount;
            
            for (let i = 0; i < count; i++) {
                pool.push({
                    es: word.es,
                    ko: word.ko,
                    isReview: true
                });
            }
        });
        
        return pool;
    },

    // =========================================
    // 유틸리티
    // =========================================
    
    /**
     * 전체 단어 수 반환
     * @returns {number} 로드된 총 단어 수
     */
    getTotalWordCount: function() {
        // 로드되지 않았으면 0
        if (!this._isLoaded) {
            return 0;
        }
        
        let count = 0;
        
        // 모든 월드의 모든 스테이지 단어 수 합산
        Object.values(this._wordData).forEach(worldStages => {
            worldStages.forEach(stage => {
                count += stage.words ? stage.words.length : 0;
            });
        });
        
        return count;
    },
    
    /**
     * 특정 월드의 모든 단어 가져오기 (통계/검색용)
     * @param {number} worldId - 월드 ID
     * @returns {Array<{es: string, ko: string, stage: number}>} 월드의 모든 단어
     */
    getAllWorldWords: function(worldId) {
        // 데이터 확인
        if (!this._isLoaded || !this._wordData[worldId]) {
            return [];
        }
        
        const result = [];
        
        // 모든 스테이지 순회
        this._wordData[worldId].forEach((stage, index) => {
            // 각 단어에 스테이지 번호 추가
            stage.words.forEach(word => {
                result.push({
                    es: word.es,
                    ko: word.ko,
                    stage: index + 1
                });
            });
        });
        
        return result;
    }
};

// 모듈 내보내기 (ES6 모듈 사용 시)
// export { WordManager };
