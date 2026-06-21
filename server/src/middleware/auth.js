const { verifyToken } = require('../config/jwt');

// Requires a valid Bearer token. Attaches req.userId.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.id;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
  }
}

// Optional auth: attaches req.userId if a valid token is present, else continues.
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      req.userId = verifyToken(token).id;
    } catch (_) {
      // ignore invalid token for optional routes
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
