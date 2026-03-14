CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS facilities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  username TEXT UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, facility_id, code)
);

CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  mrn TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, facility_id, mrn)
);

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  starts_at TIMESTAMPTZ NOT NULL,
  service_id UUID REFERENCES services(id),
  status TEXT NOT NULL DEFAULT 'booked',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  appointment_id UUID REFERENCES appointments(id),
  service_id UUID REFERENCES services(id),
  clinician_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  actor_user_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  seq BIGINT NOT NULL,
  previous_hash TEXT,
  hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, facility_id, seq)
);

CREATE OR REPLACE FUNCTION audit_logs_compute_hash() RETURNS TRIGGER AS $$
DECLARE
  prev_seq BIGINT;
  prev_hash_val TEXT;
BEGIN
  SELECT seq, hash INTO prev_seq, prev_hash_val
  FROM audit_logs
  WHERE tenant_id = NEW.tenant_id AND facility_id = NEW.facility_id
  ORDER BY seq DESC
  LIMIT 1;

  NEW.seq := COALESCE(prev_seq, 0) + 1;
  NEW.previous_hash := prev_hash_val;
  NEW.hash := encode(digest(
      NEW.tenant_id || '|' || NEW.facility_id || '|' || NEW.seq || '|' ||
      NEW.action || '|' || NEW.resource_type || '|' || COALESCE(NEW.resource_id, '') || '|' ||
      COALESCE(NEW.metadata_json::text, '{}') || '|' || COALESCE(prev_hash_val, ''),
      'sha256'
    ),
    'hex'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_compute_hash ON audit_logs;
CREATE TRIGGER trg_audit_logs_compute_hash
BEFORE INSERT ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION audit_logs_compute_hash();

CREATE OR REPLACE FUNCTION prevent_audit_log_changes() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_changes();

DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_changes();

INSERT INTO tenants (id, name) VALUES ('tenant-a', 'Tenant A') ON CONFLICT (id) DO NOTHING;
INSERT INTO facilities (id, tenant_id, name) VALUES ('facility-main', 'tenant-a', 'Main Facility') ON CONFLICT (id) DO NOTHING;
INSERT INTO roles (code, name) VALUES
  ('admin', 'Administrator'),
  ('clinician', 'Clinician'),
  ('scheduler', 'Scheduler')
ON CONFLICT (code) DO NOTHING;

INSERT INTO users (email, password, first_name, last_name, username, active) VALUES
  ('admin@example.com', '$2b$10$Jl.JmQJKqQZqQZqQZqQZq.qQZqQZqQZqQZqQZqQZqQZqQZqQZqQZqQ', 'Admin', 'User', 'admin', true),
  ('clinician@example.com', '$2b$10$Jl.JmQJKqQZqQZqQZqQZq.qQZqQZqQZqQZqQZqQZqQZqQZqQZqQZqQ', 'Clinician', 'User', 'clinician', true),
  ('scheduler@example.com', '$2b$10$Jl.JmQJKqQZqQZqQZqQZq.qQZqQZqQZqQZqQZqQZqQZqQZqQZqQZqQ', 'Scheduler', 'User', 'scheduler', true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE u.username='admin' AND r.code='admin'
ON CONFLICT DO NOTHING;
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE u.username='clinician' AND r.code='clinician'
ON CONFLICT DO NOTHING;
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE u.username='scheduler' AND r.code='scheduler'
ON CONFLICT DO NOTHING;
