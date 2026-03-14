const router = require('express').Router();
const taxonomy = require('../../data/frontend-service-taxonomy.json');
const { requireRoutePermission } = require('../../middleware/rbac');

router.get('/business-types', requireRoutePermission('GET /api/catalog/business-types'), (req, res) => {
  res.json({ data: Object.keys(taxonomy.businessTypes) });
});

router.get('/services', requireRoutePermission('GET /api/catalog/services'), (req, res) => {
  const businessType = req.query.businessType;
  if (!businessType) return res.json({ data: taxonomy.businessTypes });
  const services = taxonomy.businessTypes[businessType] || [];
  res.json({ data: { [businessType]: services } });
});

module.exports = router;
