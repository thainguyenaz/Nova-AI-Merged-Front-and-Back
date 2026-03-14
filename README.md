# Nova Backend (HIPAA-conscious Scaffold)

Node/Express backend for Nova medspa ops with tenant/facility isolation, PostgreSQL schema/migrations, strict RBAC, and immutable audit pipeline.

## Phase 2 security/data upgrades

- **PostgreSQL migration**: `infra/migrations/001_init.sql`
  - Tables: `tenants`, `facilities`, `users`, `roles`, `user_roles`, `services`, `patients`, `appointments`, `encounters`, `audit_logs`
- **Repository layer**:
  - `app/db/postgresAdapter.js` (real DB)
  - `app/db/memoryAdapter.js` (local smoke fallback)
  - `app/db/index.js` selects adapter via `DB_DRIVER`
- **Strict RBAC**: route/method policy matrix in `app/middleware/rbac.js`
- **Immutable audit logs**:
  - append-only read/write pattern in API (no update/delete route)
  - DB triggers prevent UPDATE/DELETE
  - per-tenant/facility hash chain (`seq`, `previous_hash`, `hash`) for tamper evidence

## API routes

Public:
- `GET /health`
- `GET /openapi.json`
- `POST /api/auth/token`

Protected (`Authorization: Bearer <token>`, `x-tenant-id`, `x-facility-id`):
- `GET /api/catalog/business-types`
- `GET /api/catalog/services?businessType=injectables`
- `GET|POST /api/patients`
- `GET|POST /api/appointments`
- `GET|POST /api/encounters`
- `GET /api/audit-logs` (admin only)

## RBAC matrix (least privilege)

- `catalog:*` → admin, clinician, scheduler
- `patients:read/create` → admin, clinician, scheduler
- `appointments:read` → admin, clinician, scheduler
- `appointments:create` → admin, scheduler
- `encounters:read/create` → admin, clinician
- `audit_logs:read` → admin only

## Environment

See `.env.example` for DB and security variables.

Key vars:
- `DB_DRIVER=postgres` in real environments
- `DATABASE_URL=postgres://...`
- `DB_SSL`, `DB_POOL_MAX`
- `SECURITY_STRICT_RBAC=true`
- `AUDIT_APPEND_ONLY=true`
- `PHI_LOG_REDACTION=true`

## HIPAA notes

This repository is **HIPAA-conscious**, not a complete HIPAA program. Production requires:
1. BAA-backed infrastructure/services
2. TLS 1.2+ in transit and managed encryption at rest
3. Access review + least privilege IAM around DB and backups
4. Centralized SIEM/SOC monitoring for audit log anomalies
5. PHI minimization in app logs (redaction is enabled in middleware)
6. Incident response + breach notification runbook

## Run

```bash
npm install
npm start
```

## Run migrations (Postgres)

```bash
DB_DRIVER=postgres DATABASE_URL=postgres://user:pass@host:5432/nova npm run migrate
```

## Smoke test

```bash
npm run smoke
```

Expected output includes `SMOKE_TEST_PASS`.
