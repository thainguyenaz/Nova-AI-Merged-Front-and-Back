// Project Scope Guard Middleware (Express-compatible)
// Enforces project_id isolation to prevent cross-project bleed.

function createProjectScopeGuard(config) {
  const { projectId, allowedRepoRoots = [], allowedSharePointRoots = [], allowedDatabases = [] } = config;

  return function projectScopeGuard(req, res, next) {
    const reqProjectId = req.headers['x-project-id'] || req.body?.project_id || req.query?.project_id;

    if (!reqProjectId) {
      return res.status(400).json({ error: 'PROJECT_ID_REQUIRED' });
    }

    if (reqProjectId !== projectId) {
      return res.status(403).json({ error: 'PROJECT_SCOPE_VIOLATION', expected: projectId, got: reqProjectId });
    }

    const targetRepo = req.body?.target_repo || '';
    const targetSpPath = req.body?.sharepoint_path || '';
    const targetDb = req.body?.database || '';

    if (targetRepo && allowedRepoRoots.length && !allowedRepoRoots.some(r => targetRepo.startsWith(r))) {
      return res.status(403).json({ error: 'REPO_SCOPE_VIOLATION', target: targetRepo });
    }

    if (targetSpPath && allowedSharePointRoots.length && !allowedSharePointRoots.some(r => targetSpPath.startsWith(r))) {
      return res.status(403).json({ error: 'SHAREPOINT_SCOPE_VIOLATION', target: targetSpPath });
    }

    if (targetDb && allowedDatabases.length && !allowedDatabases.includes(targetDb)) {
      return res.status(403).json({ error: 'DB_SCOPE_VIOLATION', target: targetDb });
    }

    return next();
  };
}

module.exports = { createProjectScopeGuard };
