# Nova RBAC Route Matrix

| Route | Roles Allowed |
|---|---|
| GET /api/catalog/business-types | admin, clinician, scheduler |
| GET /api/catalog/services | admin, clinician, scheduler |
| GET /api/patients | admin, clinician, scheduler |
| POST /api/patients | admin, clinician, scheduler |
| GET /api/appointments | admin, clinician, scheduler |
| POST /api/appointments | admin, scheduler |
| GET /api/encounters | admin, clinician |
| POST /api/encounters | admin, clinician |
| GET /api/audit-logs | admin |

Enforced in `app/middleware/rbac.js`.
