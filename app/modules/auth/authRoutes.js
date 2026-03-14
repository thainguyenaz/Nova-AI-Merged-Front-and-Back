const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { repo } = require('../../db');
const { requireAuth: requireAuthMiddleware } = require('../../middleware/auth');

const JWT_SECRET = process.env.NOVA_JWT_SECRET || 'dev-secret-key';
const JWT_EXPIRY = '1h';
const REFRESH_EXPIRY = '7d';

/**
 * POST /api/auth/signup
 * Create a new user account
 */
router.post('/signup', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'EMAIL_PASSWORD_REQUIRED' });
    }

    // Check if user exists
    const existing = await repo.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'USER_EXISTS' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await repo.createUser({
      email,
      password: hashedPassword,
      firstName: firstName || '',
      lastName: lastName || '',
    });

    // Issue tokens
    const accessToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
    });
    const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, JWT_SECRET, {
      expiresIn: REFRESH_EXPIRY,
    });

    // Save refresh token to DB
    await repo.saveRefreshToken(user.id, refreshToken);

    res.status(201).json({
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      accessToken,
      refreshToken,
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Authenticate and receive tokens
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'EMAIL_PASSWORD_REQUIRED' });
    }

    // Find user
    const user = await repo.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }

    // Issue tokens
    const accessToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
    });
    const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, JWT_SECRET, {
      expiresIn: REFRESH_EXPIRY,
    });

    // Save refresh token to DB
    await repo.saveRefreshToken(user.id, refreshToken);

    res.json({
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      accessToken,
      refreshToken,
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'REFRESH_TOKEN_REQUIRED' });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'INVALID_REFRESH_TOKEN' });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'INVALID_TOKEN_TYPE' });
    }

    // Check if token exists in DB
    const savedToken = await repo.getRefreshToken(decoded.userId);
    if (!savedToken || savedToken !== refreshToken) {
      return res.status(401).json({ error: 'REFRESH_TOKEN_REVOKED' });
    }

    // Get user
    const user = await repo.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'USER_NOT_FOUND' });
    }

    // Issue new tokens
    const newAccessToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
    });
    const newRefreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, JWT_SECRET, {
      expiresIn: REFRESH_EXPIRY,
    });

    // Save new refresh token
    await repo.saveRefreshToken(user.id, newRefreshToken);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Get current user (protected route)
 */
router.get('/me', requireAuthMiddleware, async (req, res, next) => {
  try {
    // Token already validated by JWT middleware in main app
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const user = await repo.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Invalidate refresh token
 */
router.post('/logout', requireAuthMiddleware, async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    // Revoke refresh token
    await repo.revokeRefreshToken(userId);

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
