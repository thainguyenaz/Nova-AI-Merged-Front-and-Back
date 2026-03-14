-- Migration 003: Calendar Enhancements
-- Adds providers table, extends appointments, seeds demo data

-- ── Providers table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS providers (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'provider',
  specialty   TEXT,
  color       TEXT NOT NULL DEFAULT '#6366F1',
  avatar      TEXT NOT NULL DEFAULT '??',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Extend appointments table ─────────────────────────────────────────────────
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS provider_id   TEXT REFERENCES providers(id),
  ADD COLUMN IF NOT EXISTS duration_min  INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS notes         TEXT,
  ADD COLUMN IF NOT EXISTS patient_name  TEXT,
  ADD COLUMN IF NOT EXISTS provider_name TEXT,
  ADD COLUMN IF NOT EXISTS service_name  TEXT,
  ADD COLUMN IF NOT EXISTS service_color TEXT;

-- Extend services table with color + duration
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS color        TEXT NOT NULL DEFAULT '#6B7280',
  ADD COLUMN IF NOT EXISTS duration_min INT NOT NULL DEFAULT 30;

-- ── Seed providers ─────────────────────────────────────────────────────────────
INSERT INTO providers (id, tenant_id, facility_id, name, role, specialty, color, avatar) VALUES
  ('prov-1', 'tenant-a', 'facility-main', 'Dr. Sarah Chen',    'MD',           'injectables', '#6366F1', 'SC'),
  ('prov-2', 'tenant-a', 'facility-main', 'Dr. Marco Rivera',  'NP',           'laser',       '#F97316', 'MR'),
  ('prov-3', 'tenant-a', 'facility-main', 'Ava Thompson',      'Esthetician',  'skin',        '#14B8A6', 'AT'),
  ('prov-4', 'tenant-a', 'facility-main', 'Dr. Priya Patel',   'MD',           'injectables', '#E879F9', 'PP'),
  ('prov-5', 'tenant-a', 'facility-main', 'Jake Morales',      'Tech',         'laser',       '#FB923C', 'JM')
ON CONFLICT (id) DO NOTHING;

-- ── Update services with colors + durations ───────────────────────────────────
INSERT INTO services (tenant_id, facility_id, code, name, business_type, active, color, duration_min) VALUES
  ('tenant-a', 'facility-main', 'BOTOX',      'Botox',            'injectables', true, '#8B5CF6', 30),
  ('tenant-a', 'facility-main', 'HYDRAFACIAL','HydraFacial',      'skin',        true, '#06B6D4', 60),
  ('tenant-a', 'facility-main', 'FILLER',     'Dermal Filler',    'injectables', true, '#EC4899', 45),
  ('tenant-a', 'facility-main', 'LASER',      'Laser Treatment',  'laser',       true, '#F59E0B', 60),
  ('tenant-a', 'facility-main', 'CHEM_PEEL',  'Chemical Peel',    'skin',        true, '#10B981', 45)
ON CONFLICT (tenant_id, facility_id, code) DO UPDATE
  SET color = EXCLUDED.color, duration_min = EXCLUDED.duration_min;

-- ── Seed demo patients (if missing) ──────────────────────────────────────────
INSERT INTO patients (tenant_id, facility_id, mrn, first_name, last_name, dob) VALUES
  ('tenant-a', 'facility-main', 'MRN-001', 'Emma',     'Wilson',   '1988-05-14'),
  ('tenant-a', 'facility-main', 'MRN-002', 'Olivia',   'Martinez', '1992-09-22'),
  ('tenant-a', 'facility-main', 'MRN-003', 'Liam',     'Johnson',  '1985-03-07'),
  ('tenant-a', 'facility-main', 'MRN-004', 'Sophia',   'Lee',      '1995-11-30'),
  ('tenant-a', 'facility-main', 'MRN-005', 'Noah',     'Brown',    '1990-07-18'),
  ('tenant-a', 'facility-main', 'MRN-006', 'Ava',      'Davis',    '1987-12-05'),
  ('tenant-a', 'facility-main', 'MRN-007', 'Isabella', 'Garcia',   '1993-04-25'),
  ('tenant-a', 'facility-main', 'MRN-008', 'Mason',    'Taylor',   '1991-08-12')
ON CONFLICT (tenant_id, facility_id, mrn) DO NOTHING;

-- ── Ensure admin user has known password ─────────────────────────────────────
-- Password: Nova2024!
UPDATE users
SET password = '$2b$10$jiTaOOOycQTUM30gfjscpuytvDCaBzeL9so7D0QNvUeFMi6L3qyEe'
WHERE username = 'admin';

-- ── Add role column to users if missing ─────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;
UPDATE users u SET role = r.code
FROM user_roles ur JOIN roles r ON r.id = ur.role_id
WHERE ur.user_id = u.id AND u.role IS NULL;

-- Ensure admin user has admin role in user_roles table (safeguard)
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.username = 'admin' AND r.code = 'admin'
ON CONFLICT DO NOTHING;
