/**
 * Onboarding Wizard API Routes
 * POST /api/onboarding/start       - Create/reset an onboarding session
 * PUT  /api/onboarding/:id/step    - Save progress for a step
 * GET  /api/onboarding/:id         - Get current session state
 * POST /api/onboarding/:id/complete- Finalize and provision into DB
 */
const router = require('express').Router();
const { repo } = require('../../db');

// ── POST /api/onboarding/start ──────────────────────────────────────────────
router.post('/start', async (req, res, next) => {
  try {
    const { userId } = req.body || {};
    const session = await repo.createOnboardingSession({ userId: userId || null });
    res.status(201).json({ ok: true, session });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/onboarding/:id ─────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const session = await repo.getOnboardingSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' });
    res.json(session);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/onboarding/:id/step ────────────────────────────────────────────
router.put('/:id/step', async (req, res, next) => {
  try {
    const { step, data } = req.body || {};
    if (!step || !data) return res.status(400).json({ error: 'STEP_AND_DATA_REQUIRED' });
    const session = await repo.updateOnboardingStep(req.params.id, step, data);
    if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' });
    res.json({ ok: true, session });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/onboarding/:id/complete ───────────────────────────────────────
router.post('/:id/complete', async (req, res, next) => {
  try {
    const session = await repo.getOnboardingSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' });
    if (session.status === 'completed') {
      return res.json({ ok: true, message: 'Already completed', session });
    }

    const result = await repo.finalizeOnboarding(req.params.id);
    res.json({ ok: true, result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
