const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware');

const router = express.Router();
router.use(requireAuth);

// =========================================
// 전체 유저 데이터 조회 (로그인 시 동기화)
// =========================================
router.get('/data', (req, res) => {
    const db = getDb();
    const userId = req.user.id;

    const stageResults = db.prepare(
        'SELECT stage_id, stars, best_score, last_accuracy FROM stage_results WHERE user_id = ?'
    ).all(userId);

    const stats = db.prepare(
        'SELECT total_games, total_score, total_correct, total_wrong, current_streak, last_played, wrong_words FROM user_stats WHERE user_id = ?'
    ).get(userId);

    const jump = db.prepare(
        'SELECT used_today, last_date FROM jump_usage WHERE user_id = ?'
    ).get(userId);

    res.json({
        stageResults,
        stats: stats || null,
        jumpUsage: jump || null
    });
});

// =========================================
// 스테이지 결과 저장
// =========================================
router.post('/stage', (req, res) => {
    const db = getDb();
    const { stageId, stars, bestScore, lastAccuracy } = req.body;
    if (!stageId) return res.status(400).json({ error: 'stageId required' });

    db.prepare(`
        INSERT INTO stage_results (user_id, stage_id, stars, best_score, last_accuracy, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT (user_id, stage_id) DO UPDATE SET
            stars = MAX(stars, excluded.stars),
            best_score = MAX(best_score, excluded.best_score),
            last_accuracy = excluded.last_accuracy,
            updated_at = excluded.updated_at
    `).run(req.user.id, stageId, stars ?? 0, bestScore ?? 0, lastAccuracy ?? null);

    res.json({ ok: true });
});

// =========================================
// 통계 저장
// =========================================
router.post('/stats', (req, res) => {
    const db = getDb();
    const { totalGames, totalScore, totalCorrect, totalWrong, currentStreak, lastPlayed, wrongWords } = req.body;

    db.prepare(`
        INSERT INTO user_stats (user_id, total_games, total_score, total_correct, total_wrong, current_streak, last_played, wrong_words, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT (user_id) DO UPDATE SET
            total_games = excluded.total_games,
            total_score = excluded.total_score,
            total_correct = excluded.total_correct,
            total_wrong = excluded.total_wrong,
            current_streak = excluded.current_streak,
            last_played = excluded.last_played,
            wrong_words = excluded.wrong_words,
            updated_at = excluded.updated_at
    `).run(
        req.user.id,
        totalGames || 0, totalScore || 0, totalCorrect || 0, totalWrong || 0,
        currentStreak || 0, lastPlayed || null,
        JSON.stringify(wrongWords || [])
    );

    res.json({ ok: true });
});

// =========================================
// 닉네임 변경
// =========================================
router.post('/profile', (req, res) => {
    const { username } = req.body;
    if (!username?.trim()) return res.status(400).json({ error: 'username required' });

    const db = getDb();
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username.trim(), req.user.id);
    res.json({ ok: true });
});

// =========================================
// 점프 사용 현황 저장
// =========================================
router.post('/jump', (req, res) => {
    const { usedToday, lastDate } = req.body;
    const db = getDb();

    db.prepare(`
        INSERT INTO jump_usage (user_id, used_today, last_date)
        VALUES (?, ?, ?)
        ON CONFLICT (user_id) DO UPDATE SET
            used_today = excluded.used_today,
            last_date = excluded.last_date
    `).run(req.user.id, usedToday ?? 0, lastDate ?? '');

    res.json({ ok: true });
});

// =========================================
// 로컬 데이터 일괄 업로드 (첫 로그인 시 마이그레이션)
// =========================================
router.post('/migrate', (req, res) => {
    const db = getDb();
    const userId = req.user.id;
    const { stageResults, stats, jumpUsage, wrongWords } = req.body;

    // 기존 서버 데이터가 있으면 마이그레이션 스킵
    const existing = db.prepare('SELECT COUNT(*) as cnt FROM stage_results WHERE user_id = ?').get(userId);
    if (existing.cnt > 0) {
        return res.json({ skipped: true, reason: '서버에 이미 데이터가 있습니다' });
    }

    const insertStage = db.prepare(`
        INSERT OR IGNORE INTO stage_results (user_id, stage_id, stars, best_score, last_accuracy)
        VALUES (?, ?, ?, ?, ?)
    `);

    const migrate = db.transaction(() => {
        // 스테이지 결과 마이그레이션
        if (stageResults?.length) {
            for (const r of stageResults) {
                insertStage.run(userId, r.stageId, r.stars || 0, r.bestScore || 0, r.lastAccuracy ?? null);
            }
        }
        // 통계 마이그레이션
        if (stats) {
            db.prepare(`
                INSERT OR REPLACE INTO user_stats
                (user_id, total_games, total_score, total_correct, total_wrong, current_streak, last_played, wrong_words)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                userId,
                stats.totalGames || 0, stats.totalScore || 0,
                stats.totalCorrect || 0, stats.totalWrong || 0,
                stats.currentStreak || 0, stats.lastPlayed || null,
                JSON.stringify(wrongWords || [])
            );
        }
        // 점프 마이그레이션
        if (jumpUsage) {
            db.prepare(`
                INSERT OR REPLACE INTO jump_usage (user_id, used_today, last_date)
                VALUES (?, ?, ?)
            `).run(userId, jumpUsage.usedToday || 0, jumpUsage.lastDate || '');
        }
    });

    migrate();
    res.json({ ok: true, migrated: true });
});

module.exports = router;
