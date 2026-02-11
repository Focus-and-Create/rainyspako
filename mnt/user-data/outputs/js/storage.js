/**
 * storage.js
 * localStorage 래퍼 모듈
 * 학습 기록, 틀린 단어, 통계 데이터 관리
 */

const Storage = {
    // =========================================
    // 초기화
    // =========================================
    
    /**
     * 스토리지 초기화 - 첫 실행 시 기본 데이터 구조 생성
     */
    init: function() {
        // 진행 상황 데이터가 없으면 초기화
        if (!this._get(CONFIG.STORAGE_KEYS.PROGRESS)) {
            this._set(CONFIG.STORAGE_KEYS.PROGRESS, {});
        }
        
        // 틀린 단어 데이터가 없으면 초기화
        if (!this._get(CONFIG.STORAGE_KEYS.WRONG_WORDS)) {
            this._set(CONFIG.STORAGE_KEYS.WRONG_WORDS, []);
        }
        
        // 통계 데이터가 없으면 초기화
        if (!this._get(CONFIG.STORAGE_KEYS.STATS)) {
            this._set(CONFIG.STORAGE_KEYS.STATS, {
                totalScore: 0,           // 총 누적 점수
                totalGames: 0,           // 총 플레이 횟수
                totalCorrect: 0,         // 총 정답 수
                totalWrong: 0,           // 총 오답 수
                currentStreak: 0,        // 현재 연속 플레이 일수
                lastPlayDate: null       // 마지막 플레이 날짜
            });
        }
        
        // 설정 데이터가 없으면 초기화
        if (!this._get(CONFIG.STORAGE_KEYS.SETTINGS)) {
            this._set(CONFIG.STORAGE_KEYS.SETTINGS, {
                mode: 'es-to-ko',        // 기본 모드: 스페인어 보고 한국어 입력
                soundEnabled: true,      // 효과음 활성화
                musicEnabled: false      // 배경음악 비활성화
            });
        }
    },

    // =========================================
    // 저수준 스토리지 접근
    // =========================================
    
    /**
     * localStorage에서 데이터 읽기
     * @param {string} key - 스토리지 키
     * @returns {*} 파싱된 데이터 또는 null
     */
    _get: function(key) {
        try {
            // localStorage에서 문자열 가져오기
            const data = localStorage.getItem(key);
            
            // 데이터가 없으면 null 반환
            if (data === null) {
                return null;
            }
            
            // JSON 파싱하여 반환
            return JSON.parse(data);
        } catch (error) {
            // 파싱 에러 시 콘솔 경고 후 null 반환
            console.warn(`Storage._get 에러 (${key}):`, error);
            return null;
        }
    },
    
    /**
     * localStorage에 데이터 저장
     * @param {string} key - 스토리지 키
     * @param {*} value - 저장할 데이터 (JSON 직렬화 가능해야 함)
     * @returns {boolean} 저장 성공 여부
     */
    _set: function(key, value) {
        try {
            // JSON 문자열로 변환하여 저장
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            // 저장 실패 시 (용량 초과 등) 콘솔 에러
            console.error(`Storage._set 에러 (${key}):`, error);
            return false;
        }
    },

    // =========================================
    // 스테이지 진행 상황 관리
    // =========================================
    
    /**
     * 스테이지 결과 저장
     * @param {string} stageId - "1-5" 형태의 스테이지 ID
     * @param {number} stars - 획득한 별 수 (1-3)
     * @param {number} score - 획득 점수
     * @returns {boolean} 저장 성공 여부
     */
    saveStageResult: function(stageId, stars, score) {
        // 현재 진행 상황 가져오기
        const progress = this._get(CONFIG.STORAGE_KEYS.PROGRESS) || {};
        
        // 기존 기록 가져오기
        const existing = progress[stageId];
        
        // 새 기록이 더 좋을 때만 업데이트 (별 우선, 점수 차선)
        if (!existing || stars > existing.stars || 
            (stars === existing.stars && score > existing.bestScore)) {
            progress[stageId] = {
                stars: stars,
                bestScore: score,
                clearedAt: new Date().toISOString()
            };
        }
        
        // 저장
        return this._set(CONFIG.STORAGE_KEYS.PROGRESS, progress);
    },
    
    /**
     * 스테이지 결과 조회
     * @param {string} stageId - 스테이지 ID
     * @returns {{stars: number, bestScore: number, clearedAt: string}|null}
     */
    getStageResult: function(stageId) {
        // 진행 상황 데이터 가져오기
        const progress = this._get(CONFIG.STORAGE_KEYS.PROGRESS) || {};
        
        // 해당 스테이지 결과 반환 (없으면 null)
        return progress[stageId] || null;
    },
    
    /**
     * 스테이지 잠금 해제 여부 확인
     * @param {number} worldId - 월드 ID
     * @param {number} stageNum - 스테이지 번호
     * @returns {boolean} 잠금 해제 여부
     */
    isStageUnlocked: function(worldId, stageNum) {
        // 첫 번째 스테이지는 항상 잠금 해제
        if (worldId === 1 && stageNum === 1) {
            return true;
        }
        
        // 이전 스테이지 ID 계산
        let prevWorldId = worldId;
        let prevStageNum = stageNum - 1;
        
        // 월드의 첫 스테이지인 경우, 이전 월드의 마지막 스테이지 확인
        if (prevStageNum < 1) {
            prevWorldId = worldId - 1;
            
            // 이전 월드가 없으면 잠금 해제 (월드 1의 스테이지 1)
            if (prevWorldId < 1) {
                return true;
            }
            
            // 이전 월드의 스테이지 수 가져오기
            const prevWorld = getWorldConfig(prevWorldId);
            prevStageNum = prevWorld ? prevWorld.stages : 20;
        }
        
        // 이전 스테이지 클리어 여부 확인
        const prevStageId = getStageId(prevWorldId, prevStageNum);
        const prevResult = this.getStageResult(prevStageId);
        
        // 이전 스테이지가 1성 이상이면 잠금 해제
        return prevResult !== null && prevResult.stars >= 1;
    },
    
    /**
     * 현재 진행 가능한 마지막 스테이지 가져오기
     * @returns {{worldId: number, stageNum: number}} 현재 진행 위치
     */
    getCurrentProgress: function() {
        // 모든 월드와 스테이지를 순회하며 잠금 해제된 마지막 스테이지 찾기
        let lastUnlocked = { worldId: 1, stageNum: 1 };
        
        // 월드 순회
        for (const world of CONFIG.WORLDS) {
            // 스테이지 순회
            for (let stage = 1; stage <= world.stages; stage++) {
                // 잠금 해제된 스테이지면 갱신
                if (this.isStageUnlocked(world.id, stage)) {
                    lastUnlocked = { worldId: world.id, stageNum: stage };
                } else {
                    // 잠긴 스테이지를 만나면 이전 것 반환
                    return lastUnlocked;
                }
            }
        }
        
        // 모든 스테이지 해제 시 마지막 스테이지 반환
        return lastUnlocked;
    },

    // =========================================
    // 틀린 단어 관리
    // =========================================
    
    /**
     * 틀린 단어 기록 추가/갱신
     * @param {string} spanish - 스페인어 단어
     * @param {string} korean - 한국어 뜻
     */
    recordWrongWord: function(spanish, korean) {
        // 틀린 단어 목록 가져오기
        const wrongWords = this._get(CONFIG.STORAGE_KEYS.WRONG_WORDS) || [];
        
        // 이미 존재하는 단어인지 확인
        const existingIndex = wrongWords.findIndex(w => w.es === spanish);
        
        if (existingIndex >= 0) {
            // 기존 기록 갱신: 횟수 증가, 날짜 업데이트
            wrongWords[existingIndex].wrongCount += 1;
            wrongWords[existingIndex].lastWrong = new Date().toISOString();
        } else {
            // 새 기록 추가
            wrongWords.push({
                es: spanish,
                ko: korean,
                wrongCount: 1,
                lastWrong: new Date().toISOString()
            });
        }
        
        // 저장
        this._set(CONFIG.STORAGE_KEYS.WRONG_WORDS, wrongWords);
    },
    
    /**
     * 단어 정답 처리 (틀린 횟수 감소)
     * @param {string} spanish - 스페인어 단어
     */
    recordCorrectWord: function(spanish) {
        // 틀린 단어 목록 가져오기
        const wrongWords = this._get(CONFIG.STORAGE_KEYS.WRONG_WORDS) || [];
        
        // 해당 단어 찾기
        const existingIndex = wrongWords.findIndex(w => w.es === spanish);
        
        if (existingIndex >= 0) {
            // 틀린 횟수 감소
            wrongWords[existingIndex].wrongCount -= 1;
            
            // 0 이하가 되면 목록에서 제거
            if (wrongWords[existingIndex].wrongCount <= 0) {
                wrongWords.splice(existingIndex, 1);
            }
            
            // 저장
            this._set(CONFIG.STORAGE_KEYS.WRONG_WORDS, wrongWords);
        }
    },
    
    /**
     * 모든 틀린 단어 가져오기
     * @returns {Array<{es: string, ko: string, wrongCount: number, lastWrong: string}>}
     */
    getWrongWords: function() {
        return this._get(CONFIG.STORAGE_KEYS.WRONG_WORDS) || [];
    },
    
    /**
     * 복습이 필요한 단어 가져오기 (wrongCount 기준 정렬)
     * @param {number} limit - 가져올 최대 개수
     * @returns {Array} 틀린 횟수 기준 정렬된 단어 배열
     */
    getWordsForReview: function(limit = 10) {
        // 틀린 단어 목록 가져오기
        const wrongWords = this.getWrongWords();
        
        // 틀린 횟수 기준 내림차순 정렬
        wrongWords.sort((a, b) => b.wrongCount - a.wrongCount);
        
        // 상위 N개만 반환
        return wrongWords.slice(0, limit);
    },

    // =========================================
    // 통계 관리
    // =========================================
    
    /**
     * 게임 결과로 통계 업데이트
     * @param {number} score - 획득 점수
     * @param {number} correct - 정답 수
     * @param {number} wrong - 오답 수
     */
    updateStats: function(score, correct, wrong) {
        // 통계 데이터 가져오기
        const stats = this._get(CONFIG.STORAGE_KEYS.STATS) || {};
        
        // 누적 값 업데이트
        stats.totalScore = (stats.totalScore || 0) + score;
        stats.totalGames = (stats.totalGames || 0) + 1;
        stats.totalCorrect = (stats.totalCorrect || 0) + correct;
        stats.totalWrong = (stats.totalWrong || 0) + wrong;
        
        // 연속 플레이 스트릭 계산
        const today = new Date().toDateString();
        const lastPlay = stats.lastPlayDate;
        
        if (lastPlay) {
            // 어제 플레이했으면 스트릭 증가
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (lastPlay === yesterday.toDateString()) {
                stats.currentStreak = (stats.currentStreak || 0) + 1;
            } else if (lastPlay !== today) {
                // 오늘도 어제도 아니면 스트릭 리셋
                stats.currentStreak = 1;
            }
            // 오늘 이미 플레이했으면 스트릭 유지
        } else {
            // 첫 플레이
            stats.currentStreak = 1;
        }
        
        // 마지막 플레이 날짜 갱신
        stats.lastPlayDate = today;
        
        // 저장
        this._set(CONFIG.STORAGE_KEYS.STATS, stats);
    },
    
    /**
     * 통계 데이터 조회
     * @returns {Object} 통계 객체
     */
    getStats: function() {
        return this._get(CONFIG.STORAGE_KEYS.STATS) || {
            totalScore: 0,
            totalGames: 0,
            totalCorrect: 0,
            totalWrong: 0,
            currentStreak: 0,
            lastPlayDate: null
        };
    },

    // =========================================
    // 설정 관리
    // =========================================
    
    /**
     * 설정값 가져오기
     * @param {string} key - 설정 키 (mode, soundEnabled 등)
     * @returns {*} 설정값
     */
    getSetting: function(key) {
        // 설정 데이터 가져오기
        const settings = this._get(CONFIG.STORAGE_KEYS.SETTINGS) || {};
        return settings[key];
    },
    
    /**
     * 설정값 저장
     * @param {string} key - 설정 키
     * @param {*} value - 설정값
     */
    setSetting: function(key, value) {
        // 설정 데이터 가져오기
        const settings = this._get(CONFIG.STORAGE_KEYS.SETTINGS) || {};
        
        // 값 설정
        settings[key] = value;
        
        // 저장
        this._set(CONFIG.STORAGE_KEYS.SETTINGS, settings);
    },

    // =========================================
    // 데이터 초기화
    // =========================================
    
    /**
     * 모든 데이터 삭제 (주의: 복구 불가)
     */
    clearAll: function() {
        // 모든 키 삭제
        localStorage.removeItem(CONFIG.STORAGE_KEYS.PROGRESS);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.WRONG_WORDS);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.STATS);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.SETTINGS);
        
        // 재초기화
        this.init();
    }
};

// 모듈 내보내기 (ES6 모듈 사용 시)
// export { Storage };
