const jwt = require('jsonwebtoken');
const config = require('../config');

const COOKIE = 'token';

// Reads the login cookie (if any) and sets req.user. Never blocks the request.
function attachUser(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE];
  if (token) {
    try {
      const p = jwt.verify(token, config.jwtSecret);
      req.user = { id: p.id, role: p.role, name: p.name };
    } catch (e) {
      // expired or tampered: treat as logged out
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that.' });
    }
    next();
  };
}

// "Remember me" = 30 day cookie, otherwise a session cookie that expires with the browser.
function setAuthCookie(res, user, remember) {
  const days = remember ? 30 : 1;
  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.full_name },
    config.jwtSecret,
    { expiresIn: `${days}d` }
  );
  const opts = {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    path: '/',
  };
  if (remember) opts.maxAge = days * 24 * 60 * 60 * 1000;
  res.cookie(COOKIE, token, opts);
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/' });
}

module.exports = { attachUser, requireAuth, requireRole, setAuthCookie, clearAuthCookie };
