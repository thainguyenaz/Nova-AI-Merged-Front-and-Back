const jwt = require('jsonwebtoken');

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

    // Attach user to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { requireAuth };
