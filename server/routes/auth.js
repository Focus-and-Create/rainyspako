const express = require('express');
const bcrypt = require('bcrypt');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { getDb } = require('../db');
const { requireAuth, setTokenCookie } = require('../middleware');

const router = express.Router();

// Google OAuth 설정 (환경변수가 있을 때만 활성화)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback'
    }, (accessToken, refreshToken, profile, done) => {
        try {
            const db = getDb();
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('Google 계정에서 이메일을 가져올 수 없습니다'));

            const username = profile.displayName || email.split('@')[0];

            // 기존 유저 확인 (google_id 또는 email로)
            let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.id);
            if (!user) {
                user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
                if (user) {
                    // 이메일로 가입된 계정에 구글 연동
                    db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(profile.id, user.id);
                } else {
                    // 신규 가입
                    const result = db.prepare(
                        'INSERT INTO users (email, google_id, username) VALUES (?, ?, ?)'
                    ).run(email, profile.id, username);
                    user = { id: result.lastInsertRowid, email, username };
                }
            }
            done(null, user);
        } catch (err) {
            done(err);
        }
    }));
}

// =========================================
// 회원가입
// =========================================
router.post('/register', async (req, res) => {
    const { email, password, username } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: '올바른 이메일 형식이 아닙니다' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다' });
    }

    try {
        const db = getDb();
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) return res.status(409).json({ error: '이미 사용 중인 이메일입니다' });

        const hash = await bcrypt.hash(password, 10);
        const name = username?.trim() || email.split('@')[0];
        const result = db.prepare(
            'INSERT INTO users (email, password_hash, username) VALUES (?, ?, ?)'
        ).run(email, hash, name);

        const user = { id: result.lastInsertRowid, email, username: name };
        setTokenCookie(res, user);
        res.json({ user });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// =========================================
// 로그인
// =========================================
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요' });
    }

    try {
        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user || !user.password_hash) {
            return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
        }

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });

        const payload = { id: user.id, email: user.email, username: user.username };
        setTokenCookie(res, payload);
        res.json({ user: payload });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: '서버 오류가 발생했습니다' });
    }
});

// =========================================
// 로그아웃
// =========================================
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ ok: true });
});

// =========================================
// 현재 로그인 유저 정보
// =========================================
router.get('/me', requireAuth, (req, res) => {
    const db = getDb();
    const user = db.prepare('SELECT id, email, username FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
});

// =========================================
// Google OAuth
// =========================================
router.get('/google', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
        return res.status(501).json({ error: 'Google OAuth가 서버에 설정되지 않았습니다' });
    }
    passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/?auth=failed' }),
    (req, res) => {
        const user = req.user;
        setTokenCookie(res, { id: user.id, email: user.email, username: user.username });
        res.redirect('/');
    }
);

// =========================================
// Google 설정 여부 확인 (프론트엔드용)
// =========================================
router.get('/providers', (req, res) => {
    res.json({
        google: !!process.env.GOOGLE_CLIENT_ID
    });
});

module.exports = router;
