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
    const items = await repo.listInventory({ industry });
    console.log(`[Inventory] GET /api/inventory industry=${industry} → ${items.length} items`);
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
 * Returns inventory for a specific industry (explicit URL param override).
 */
router.get('/:industry', async (req, res, next) => {
  try {
    const industry = req.params.industry;
    const items = await repo.listInventory({ industry });
    console.log(`[Inventory] GET /api/inventory/${industry} → ${items.length} items`);
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
