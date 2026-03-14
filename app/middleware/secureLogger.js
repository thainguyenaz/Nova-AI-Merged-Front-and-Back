const { redactObject } = require('../lib/redaction');

function secureRequestLogger(req, res, next) {
  const safeBody = redactObject(req.body || {});
  const safeQuery = redactObject(req.query || {});
  console.log(JSON.stringify({
    msg: 'request',
    method: req.method,
    path: req.path,
    query: safeQuery,
    body: safeBody,
    tenantId: req.header('x-tenant-id') || null,
    facilityId: req.header('x-facility-id') || null,
    actor: req.user?.userId || null
  }));
  next();
}

module.exports = { secureRequestLogger };
