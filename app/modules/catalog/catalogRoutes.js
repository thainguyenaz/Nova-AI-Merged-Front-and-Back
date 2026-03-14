const router = require('express').Router();
const taxonomy = require('../../data/frontend-service-taxonomy.json');
const { requireRoutePermission } = require('../../middleware/rbac');

router.get('/business-types', requireRoutePermission('GET /api/catalog/business-types'), (req, res) => {
  const { industry } = req.query;
  if (industry && taxonomy.byIndustry[industry]) {
    return res.json({ data: Object.keys(taxonomy.byIndustry[industry].categories) });
  }
  res.json({ data: Object.keys(taxonomy.businessTypes) });
});

router.get('/services', requireRoutePermission('GET /api/catalog/services'), (req, res) => {
  const { businessType, industry } = req.query;

  // Industry-aware lookup
  if (industry && taxonomy.byIndustry[industry]) {
    const indCatalog = taxonomy.byIndustry[industry];
    if (!businessType) {
      return res.json({
        data: indCatalog.categories,
        meta: {
          industry,
          label: indCatalog.label,
          clientLabel: indCatalog.clientLabel,
          serviceLabel: indCatalog.serviceLabel,
          inventoryLabel: indCatalog.inventoryLabel,
          providerLabel: indCatalog.providerLabel,
          inventoryCategories: indCatalog.inventoryCategories
        }
      });
    }
    const services = indCatalog.categories[businessType] || [];
    return res.json({ data: { [businessType]: services }, meta: { industry, serviceLabel: indCatalog.serviceLabel } });
  }

  // Legacy fallback
  if (!businessType) return res.json({ data: taxonomy.businessTypes });
  const services = taxonomy.businessTypes[businessType] || [];
  res.json({ data: { [businessType]: services } });
});

/**
 * GET /api/catalog/industry-taxonomy
 * Returns full taxonomy for a given industry
 */
router.get('/industry-taxonomy', requireRoutePermission('GET /api/catalog/services'), (req, res) => {
  const { industry } = req.query;
  if (!industry) {
    return res.json({ data: taxonomy.byIndustry });
  }
  const indData = taxonomy.byIndustry[industry];
  if (!indData) {
    return res.status(404).json({ error: 'INDUSTRY_NOT_FOUND', validValues: Object.keys(taxonomy.byIndustry) });
  }
  res.json({ data: indData });
});

module.exports = router;
