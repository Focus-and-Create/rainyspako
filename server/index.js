require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const path = require('path');
const { initDb } = require('./db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// 정적 파일 서빙 (프로젝트 루트)
app.use(express.static(path.join(__dirname, '..')));

// API 라우트
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

// SPA 폴백
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

initDb();
app.listen(PORT, () => {
    console.log(`Spanish Rain 서버 시작: http://localhost:${PORT}`);
    console.log(`Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? '설정됨' : '미설정 (이메일 로그인만 사용 가능)'}`);
});
