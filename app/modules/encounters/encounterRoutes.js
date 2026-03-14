const router = require('express').Router();
const { repo } = require('../../db');
const { requireRoutePermission } = require('../../middleware/rbac');
const { recordAudit } = require('../audit/auditService');

router.get('/', requireRoutePermission('GET /api/encounters'), async (req, res, next) => {
  try {
    const data = await repo.listEncounters(req.context);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRoutePermission('POST /api/encounters'), async (req, res, next) => {
  try {
    const encounter = await repo.createEncounter({
      tenantId: req.context.tenantId,
      facilityId: req.context.facilityId,
      patientId: req.body.patientId,
      appointmentId: req.body.appointmentId,
      serviceId: req.body.serviceId,
      clinicianId: req.body.clinicianId,
      notes: req.body.notes
    });
    await recordAudit(req, 'encounter.create', 'encounter', encounter.id, { patientId: req.body.patientId, serviceId: req.body.serviceId, notes: req.body.notes });
    res.status(201).json({ data: encounter });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
