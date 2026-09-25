const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'iac_default_jwt_secret_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_TICKET = process.env.JWT_TICKET || 'iac_default_ticket_secret_key_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'iac_default_refresh_secret_key_2026';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

const signAccessToken = (userId) => {
    return jwt.sign(
        { id: userId },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
};

const signAccessTicket = (userId, duration) => {
    return jwt.sign(
        { id: userId },
        JWT_TICKET,
        { expiresIn: duration }
    );
};

const signRefreshToken = (userId) => {
    return jwt.sign(
        { id: userId },
        JWT_REFRESH_SECRET,
        { expiresIn: JWT_REFRESH_EXPIRES_IN }
    );
};

const verifyAccessToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
};

const verifyRefreshToken = (token) => {
    return jwt.verify(token, JWT_REFRESH_SECRET);
};

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, signAccessTicket };