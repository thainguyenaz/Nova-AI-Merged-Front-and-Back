function requireContext(req, res, next) {
  const tenantId = req.header('x-tenant-id');
  const facilityId = req.header('x-facility-id');
  if (!tenantId || !facilityId) {
    return res.status(400).json({ error: 'TENANT_OR_FACILITY_MISSING' });
  }

  if (req.user && (req.user.tenantId !== tenantId || req.user.facilityId !== facilityId)) {
    return res.status(403).json({ error: 'CONTEXT_FORBIDDEN' });
  }

  req.context = { tenantId, facilityId };
  next();
}

module.exports = { requireContext };
