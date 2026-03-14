const { addAudit } = require('./auditModel');
const { redactObject } = require('../../lib/redaction');

function recordAudit(req, action, resourceType, resourceId, metadata = {}) {
  return addAudit({
    tenantId: req.context.tenantId,
    facilityId: req.context.facilityId,
    actorUserId: req.user.userId,
    actorRole: req.user.role,
    action,
    resourceType,
    resourceId,
    metadata: redactObject(metadata),
    at: new Date().toISOString()
  });
}

module.exports = { recordAudit };
