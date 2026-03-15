const router = require('express').Router();
const { repo } = require('../../db');

/**
 * GET /api/inventory
 * Returns demo inventory items for the current industry context.
 * Industry is resolved from X-Nova-Industry header (via context middleware).
 */
router.get('/', async (req, res, next) => {
  try {
    const industry = req.context?.industry || null;
    const tenantId = req.context?.tenantId || null;
    const items = await repo.listInventory({ industry, tenantId });
    console.log(`[Inventory] GET /api/inventory industry=${industry} tenant=${tenantId} → ${items.length} items`);
    res.json({
      data: items,
      meta: {
        industry: industry || 'medspa',
        count: items.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/inventory/:industry
 * Returns inventory for a specific industry — BUT still respects the tenant context.
 * Real users (non-demo tenants) always get empty data regardless of industry param.
 */
router.get('/:industry', async (req, res, next) => {
  try {
    const industry = req.params.industry;
    // Always pass tenantId from context so real users get blank data
    const tenantId = req.context?.tenantId || null;
    const items = await repo.listInventory({ industry, tenantId });
    console.log(`[Inventory] GET /api/inventory/${industry} tenant=${tenantId} → ${items.length} items`);
    res.json({
      data: items,
      meta: {
        industry,
        count: items.length
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
