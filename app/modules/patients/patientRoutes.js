const router = require('express').Router();
const { repo } = require('../../db');
const { requireRoutePermission } = require('../../middleware/rbac');
const { recordAudit } = require('../audit/auditService');

router.get('/', requireRoutePermission('GET /api/patients'), async (req, res, next) => {
  try {
    const data = await repo.listPatients(req.context);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRoutePermission('POST /api/patients'), async (req, res, next) => {
  try {
    const patient = await repo.createPatient({
      tenantId: req.context.tenantId,
      facilityId: req.context.facilityId,
      mrn: req.body.mrn,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      dob: req.body.dob
    });
    await recordAudit(req, 'patient.create', 'patient', patient.id, { mrn: req.body.mrn, firstName: req.body.firstName, lastName: req.body.lastName, dob: req.body.dob });
    res.status(201).json({ data: patient });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
