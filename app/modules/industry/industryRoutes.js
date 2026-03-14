const router = require('express').Router();
const industryConfig = require('../../data/industry-config.json');
const demoDatasets = require('../../data/demo-datasets.json');

/**
 * GET /api/industry/config
 * Returns full industry config: all industries, terminology, labels
 */
router.get('/config', (req, res) => {
  res.json({
    industries: industryConfig.industries,
    validValues: industryConfig.validValues,
    defaultIndustry: industryConfig.defaultIndustry
  });
});

/**
 * GET /api/industry/config/:industryType
 * Returns config for a specific industry
 */
router.get('/config/:industryType', (req, res) => {
  const { industryType } = req.params;
  const industry = industryConfig.industries[industryType];
  if (!industry) {
    return res.status(404).json({
      error: 'INDUSTRY_NOT_FOUND',
      validValues: industryConfig.validValues
    });
  }
  res.json({ industryType, ...industry });
});

/**
 * GET /api/industry/terminology/:industryType
 * Returns just the terminology mapping for a given industry
 */
router.get('/terminology/:industryType', (req, res) => {
  const { industryType } = req.params;
  const industry = industryConfig.industries[industryType];
  if (!industry) {
    return res.status(404).json({
      error: 'INDUSTRY_NOT_FOUND',
      validValues: industryConfig.validValues
    });
  }
  res.json({
    industryType,
    label: industry.label,
    icon: industry.icon,
    terminology: industry.terminology
  });
});

/**
 * GET /api/industry/demo-datasets
 * Returns all demo dataset definitions (no sensitive data, for demo seed UI)
 */
router.get('/demo-datasets', (req, res) => {
  const summary = demoDatasets.datasets.map(d => ({
    id: d.id,
    industry: d.industry,
    tenantName: d.tenant.name,
    facilityName: d.facility.name,
    patientCount: d.patients.length,
    serviceCount: d.services.length,
    sampleRevenue: d.sampleRevenue
  }));
  res.json({ data: summary });
});

/**
 * GET /api/industry/demo-datasets/:industryType
 * Returns demo dataset for a specific industry
 */
router.get('/demo-datasets/:industryType', (req, res) => {
  const { industryType } = req.params;
  const dataset = demoDatasets.datasets.find(d => d.industry === industryType);
  if (!dataset) {
    return res.status(404).json({
      error: 'DATASET_NOT_FOUND',
      validValues: industryConfig.validValues
    });
  }
  res.json({ data: dataset });
});

/**
 * GET /api/industry/labels
 * Returns all industry labels for selector UI
 */
router.get('/labels', (req, res) => {
  const labels = industryConfig.validValues.map(key => ({
    value: key,
    label: industryConfig.industries[key].label,
    icon: industryConfig.industries[key].icon,
    color: industryConfig.industries[key].color,
    description: industryConfig.industries[key].description
  }));
  res.json({ data: labels });
});

module.exports = router;
