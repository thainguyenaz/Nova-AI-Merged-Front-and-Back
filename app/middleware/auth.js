const jwt = require('jsonwebtoken');
const { repo } = require('../db');

const JWT_SECRET = process.env.NOVA_JWT_SECRET || 'dev-secret-key';

async function requireAuth(req, res, next) {
  try {
    const auth = req.header('authorization') || '';
    const token = auth.replace('Bearer ', '').trim();

    if (!token) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'INVALID_TOKEN' });
    }

    // Build req.user — include role from JWT if present, else look up from DB
    let role = decoded.role || null;
    let userId = decoded.userId;

    if (!role && userId) {
      try {
        const user = await repo.getUserById(userId);
        role = user?.role || null;
      } catch (_) { /* DB unavailable, proceed without role */ }
    }

    req.user = {
      userId,
      email: decoded.email,
      role,
      tenantId: decoded.tenantId || null,
      facilityId: decoded.facilityId || null
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { requireAuth, JWT_SECRET };
