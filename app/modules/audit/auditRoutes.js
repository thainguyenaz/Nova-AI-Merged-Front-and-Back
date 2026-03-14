const router = require('express').Router();
const { requireRoutePermission } = require('../../middleware/rbac');
const { listAudits } = require('./auditModel');

router.get('/', requireRoutePermission('GET /api/audit-logs'), async (req, res, next) => {
  try {
    const rows = await listAudits({ tenantId: req.context.tenantId, facilityId: req.context.facilityId });
    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
