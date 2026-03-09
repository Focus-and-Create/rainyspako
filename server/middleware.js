const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30일

function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

function setTokenCookie(res, payload) {
    const token = signToken(payload);
    res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
        secure: process.env.NODE_ENV === 'production'
    });
    return token;
}

function requireAuth(req, res, next) {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.clearCookie('token');
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

module.exports = { setTokenCookie, requireAuth };
