function requireContext(req, res, next) {
  const tenantId = req.header('x-tenant-id');
  const facilityId = req.header('x-facility-id');
  if (!tenantId || !facilityId) {
    return res.status(400).json({ error: 'TENANT_OR_FACILITY_MISSING' });
  }

  if (req.user && req.user.tenantId && (req.user.tenantId !== tenantId || req.user.facilityId !== facilityId)) {
    return res.status(403).json({ error: 'CONTEXT_FORBIDDEN' });
  }

  req.context = {
    tenantId,
    facilityId,
    userId: req.user?.userId || null,
    role: req.user?.role || null
  };

  // Also propagate role to req.user for RBAC middleware
  if (req.user && !req.user.role && req.context.role) {
    req.user.role = req.context.role;
  }

  next();
}

module.exports = { requireContext };
