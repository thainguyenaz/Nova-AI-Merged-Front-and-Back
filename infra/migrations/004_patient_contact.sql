-- Migration 004: Add contact fields to patients + update demo patient data

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Update demo patients with contact info
UPDATE patients SET email = 'emma.wilson@email.com',   phone = '602-555-0101' WHERE mrn = 'MRN-001' AND tenant_id = 'tenant-a';
UPDATE patients SET email = 'olivia.m@email.com',      phone = '602-555-0102' WHERE mrn = 'MRN-002' AND tenant_id = 'tenant-a';
UPDATE patients SET email = 'liam.j@email.com',        phone = '602-555-0103' WHERE mrn = 'MRN-003' AND tenant_id = 'tenant-a';
UPDATE patients SET email = 'sophia.lee@email.com',    phone = '602-555-0104' WHERE mrn = 'MRN-004' AND tenant_id = 'tenant-a';
UPDATE patients SET email = 'noah.b@email.com',        phone = '602-555-0105' WHERE mrn = 'MRN-005' AND tenant_id = 'tenant-a';
UPDATE patients SET email = 'ava.d@email.com',         phone = '602-555-0106' WHERE mrn = 'MRN-006' AND tenant_id = 'tenant-a';
UPDATE patients SET email = 'isabella.g@email.com',    phone = '602-555-0107' WHERE mrn = 'MRN-007' AND tenant_id = 'tenant-a';
UPDATE patients SET email = 'mason.t@email.com',       phone = '602-555-0108' WHERE mrn = 'MRN-008' AND tenant_id = 'tenant-a';
