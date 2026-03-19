const POLICY = {
  'GET /api/catalog/business-types': ['admin', 'clinician', 'scheduler'],
  'GET /api/catalog/services': ['admin', 'clinician', 'scheduler'],
  'GET /api/patients': ['admin', 'clinician', 'scheduler'],
  'POST /api/patients': ['admin', 'clinician', 'scheduler'],
  'GET /api/appointments': ['admin', 'clinician', 'scheduler'],
  'POST /api/appointments': ['admin', 'scheduler'],
  'GET /api/encounters': ['admin', 'clinician'],
  'POST /api/encounters': ['admin', 'clinician'],
  'GET /api/audit-logs': ['admin'],
  'GET /api/inventory': ['admin', 'clinician', 'scheduler']
};

function requireRoutePermission(routeKey) {
  const allowed = POLICY[routeKey] || [];
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' });
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'ROLE_FORBIDDEN', route: routeKey, allowed });
    }
    return next();
  };
}

module.exports = { requireRoutePermission, POLICY };
