const { repo } = require('../../db');

async function addAudit(event) { return repo.appendAuditLog(event); }
async function listAudits(context) { return repo.listAuditLogs(context); }

module.exports = { addAudit, listAudits };
