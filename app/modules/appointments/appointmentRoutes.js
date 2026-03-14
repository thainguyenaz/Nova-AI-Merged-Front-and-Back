const router = require('express').Router();
const { repo } = require('../../db');
const { requireRoutePermission } = require('../../middleware/rbac');
const { recordAudit } = require('../audit/auditService');

// ─── List Appointments ────────────────────────────────────────────────────────
router.get('/', requireRoutePermission('GET /api/appointments'), async (req, res, next) => {
  try {
    const data = await repo.listAppointments(req.context);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

// ─── Create Appointment ───────────────────────────────────────────────────────
router.post('/', requireRoutePermission('POST /api/appointments'), async (req, res, next) => {
  try {
    const appt = await repo.createAppointment({
      tenantId: req.context.tenantId,
      facilityId: req.context.facilityId,
      patientId: req.body.patientId,
      providerId: req.body.providerId,
      startsAt: req.body.startsAt,
      serviceId: req.body.serviceId,
      status: req.body.status || 'booked',
      notes: req.body.notes
    });
    await recordAudit(req, 'appointment.create', 'appointment', appt.id, {
      patientId: req.body.patientId,
      providerId: req.body.providerId,
      serviceId: req.body.serviceId
    });
    res.status(201).json({ data: appt });
  } catch (error) {
    next(error);
  }
});

// ─── Reassign Appointment (Drag-Drop) ─────────────────────────────────────────
router.patch('/:id/reassign', requireRoutePermission('POST /api/appointments'), async (req, res, next) => {
  try {
    const { newProviderId } = req.body;
    if (!newProviderId) {
      return res.status(400).json({ error: 'newProviderId is required' });
    }

    const result = await repo.reassignAppointment({
      appointmentId: req.params.id,
      newProviderId,
      actorUserId: req.context.userId,
      actorRole: req.context.role
    });

    await recordAudit(req, 'appointment.reassign', 'appointment', req.params.id, {
      prevProviderId: result.prevProviderId,
      prevProviderName: result.prevProviderName,
      newProviderId: result.newProviderId,
      newProviderName: result.newProviderName
    });

    res.json({ data: result.appointment, meta: result });
  } catch (error) {
    if (error.message === 'Appointment not found') return res.status(404).json({ error: error.message });
    if (error.message === 'Provider not found') return res.status(404).json({ error: error.message });
    next(error);
  }
});

// ─── Seed Demo Appointments ───────────────────────────────────────────────────
router.post('/seed-demo', requireRoutePermission('POST /api/appointments'), async (req, res, next) => {
  try {
    const result = await repo.seedDemoAppointments({
      tenantId: req.context.tenantId,
      facilityId: req.context.facilityId
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// ─── List Providers ───────────────────────────────────────────────────────────
router.get('/providers', requireRoutePermission('GET /api/appointments'), async (req, res, next) => {
  try {
    const data = await repo.listProviders(req.context);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

// ─── Event Trigger Log ────────────────────────────────────────────────────────
router.get('/event-triggers', requireRoutePermission('GET /api/appointments'), async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const data = await repo.listEventTriggers({ ...req.context, limit });
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
