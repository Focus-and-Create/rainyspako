const Database = require('better-sqlite3');
const path = require('path');

let db;

function getDb() {
    if (!db) {
        db = new Database(path.join(__dirname, '../spanish-rain.db'));
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
    }
    return db;
}

function initDb() {
    const db = getDb();
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            google_id TEXT UNIQUE,
            username TEXT NOT NULL DEFAULT 'Player',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS stage_results (
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            stage_id TEXT NOT NULL,
            stars INTEGER DEFAULT 0,
            best_score INTEGER DEFAULT 0,
            last_accuracy INTEGER,
            updated_at TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (user_id, stage_id)
        );

        CREATE TABLE IF NOT EXISTS user_stats (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            total_games INTEGER DEFAULT 0,
            total_score INTEGER DEFAULT 0,
            total_correct INTEGER DEFAULT 0,
            total_wrong INTEGER DEFAULT 0,
            current_streak INTEGER DEFAULT 0,
            last_played TEXT,
            wrong_words TEXT DEFAULT '[]',
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS jump_usage (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            used_today INTEGER DEFAULT 0,
            last_date TEXT DEFAULT ''
        );
    `);
    console.log('DB 초기화 완료');
}

module.exports = { getDb, initDb };
