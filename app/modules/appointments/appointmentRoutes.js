const router = require('express').Router();
const { repo } = require('../../db');
const { requireRoutePermission } = require('../../middleware/rbac');
const { recordAudit } = require('../audit/auditService');

router.get('/', requireRoutePermission('GET /api/appointments'), async (req, res, next) => {
  try {
    const data = await repo.listAppointments(req.context);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRoutePermission('POST /api/appointments'), async (req, res, next) => {
  try {
    const appt = await repo.createAppointment({
      tenantId: req.context.tenantId,
      facilityId: req.context.facilityId,
      patientId: req.body.patientId,
      startsAt: req.body.startsAt,
      serviceId: req.body.serviceId,
      status: req.body.status || 'booked'
    });
    await recordAudit(req, 'appointment.create', 'appointment', appt.id, { patientId: req.body.patientId, serviceId: req.body.serviceId });
    res.status(201).json({ data: appt });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
