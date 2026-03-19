const router = require('express').Router();
const { repo } = require('../../db');
const { requireRoutePermission } = require('../../middleware/rbac');

/**
 * GET /api/catalog/services/list
 * Returns the list of services for the current tenant/facility.
 * This is used by the POS to show only relevant services.
 */
router.get('/list', requireRoutePermission('GET /api/catalog/services'), async (req, res, next) => {
  try {
    const data = await repo.listServices(req.context);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
