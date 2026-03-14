-- Migration 002: Industry Type System
-- Adds industry_type to users and tenants, and creates industry demo data

-- Create industry_type enum
DO $$ BEGIN
  CREATE TYPE industry_type AS ENUM (
    'medspa',
    'barber',
    'salon',
    'spa',
    'clinic',
    'fitness'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add industry_type to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS industry_type TEXT DEFAULT 'medspa';

-- Add industry_type to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS industry_type TEXT DEFAULT 'medspa';

-- -----------------------------------------------------------------------
-- Demo Tenant 1: MedSpa (existing tenant-a promoted, plus new ones)
-- -----------------------------------------------------------------------
UPDATE tenants SET industry_type = 'medspa' WHERE id = 'tenant-a';

-- Demo Tenant 2: Barber Shop
INSERT INTO tenants (id, name, industry_type) VALUES ('tenant-barber', 'Kings & Cuts Barbershop', 'barber')
  ON CONFLICT (id) DO UPDATE SET industry_type = 'barber';
INSERT INTO facilities (id, tenant_id, name) VALUES ('facility-barber', 'tenant-barber', 'Kings & Cuts - Main Shop')
  ON CONFLICT (id) DO NOTHING;

-- Demo Tenant 3: Hair Salon
INSERT INTO tenants (id, name, industry_type) VALUES ('tenant-salon', 'Luxe Hair Salon', 'salon')
  ON CONFLICT (id) DO UPDATE SET industry_type = 'salon';
INSERT INTO facilities (id, tenant_id, name) VALUES ('facility-salon', 'tenant-salon', 'Luxe Hair - Downtown')
  ON CONFLICT (id) DO NOTHING;

-- Demo Tenant 4: Day Spa
INSERT INTO tenants (id, name, industry_type) VALUES ('tenant-spa', 'Serenity Day Spa', 'spa')
  ON CONFLICT (id) DO UPDATE SET industry_type = 'spa';
INSERT INTO facilities (id, tenant_id, name) VALUES ('facility-spa', 'tenant-spa', 'Serenity Spa - Main')
  ON CONFLICT (id) DO NOTHING;

-- Demo Tenant 5: Medical Clinic
INSERT INTO tenants (id, name, industry_type) VALUES ('tenant-clinic', 'Apex Medical Clinic', 'clinic')
  ON CONFLICT (id) DO UPDATE SET industry_type = 'clinic';
INSERT INTO facilities (id, tenant_id, name) VALUES ('facility-clinic', 'tenant-clinic', 'Apex Clinic - Primary Care')
  ON CONFLICT (id) DO NOTHING;

-- Demo Tenant 6: Fitness Studio
INSERT INTO tenants (id, name, industry_type) VALUES ('tenant-fitness', 'Iron & Flow Fitness', 'fitness')
  ON CONFLICT (id) DO UPDATE SET industry_type = 'fitness';
INSERT INTO facilities (id, tenant_id, name) VALUES ('facility-fitness', 'tenant-fitness', 'Iron & Flow - Main Studio')
  ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------
-- Demo Services per industry
-- -----------------------------------------------------------------------

-- MedSpa services (tenant-a already has botox/hydrafacial from init)
INSERT INTO services (tenant_id, facility_id, code, name, business_type, active) VALUES
  ('tenant-a', 'facility-main', 'FILLER', 'Dermal Fillers', 'injectables', true),
  ('tenant-a', 'facility-main', 'LASER', 'Laser Hair Removal', 'laser', true),
  ('tenant-a', 'facility-main', 'PEEL', 'Chemical Peel', 'skin', true),
  ('tenant-a', 'facility-main', 'COOL', 'CoolSculpting', 'body', true),
  ('tenant-a', 'facility-main', 'IV', 'IV Therapy', 'wellness', true)
ON CONFLICT (tenant_id, facility_id, code) DO NOTHING;

-- Barber services
INSERT INTO services (tenant_id, facility_id, code, name, business_type, active) VALUES
  ('tenant-barber', 'facility-barber', 'HAIRCUT', 'Men''s Haircut', 'cuts', true),
  ('tenant-barber', 'facility-barber', 'BEARD', 'Beard Trim & Shape', 'grooming', true),
  ('tenant-barber', 'facility-barber', 'FADE', 'Fade', 'cuts', true),
  ('tenant-barber', 'facility-barber', 'SHAVE', 'Hot Towel Shave', 'shave', true),
  ('tenant-barber', 'facility-barber', 'KIDS', 'Kids Cut', 'cuts', true),
  ('tenant-barber', 'facility-barber', 'COLOR', 'Color & Toner', 'color', true)
ON CONFLICT (tenant_id, facility_id, code) DO NOTHING;

-- Salon services
INSERT INTO services (tenant_id, facility_id, code, name, business_type, active) VALUES
  ('tenant-salon', 'facility-salon', 'BLOWOUT', 'Blowout', 'styling', true),
  ('tenant-salon', 'facility-salon', 'HAIRCOLOR', 'Full Color', 'color', true),
  ('tenant-salon', 'facility-salon', 'HIGHLIGHTS', 'Highlights', 'color', true),
  ('tenant-salon', 'facility-salon', 'TRIM', 'Trim & Style', 'cuts', true),
  ('tenant-salon', 'facility-salon', 'KERATIN', 'Keratin Treatment', 'treatment', true),
  ('tenant-salon', 'facility-salon', 'BALAYAGE', 'Balayage', 'color', true)
ON CONFLICT (tenant_id, facility_id, code) DO NOTHING;

-- Spa services
INSERT INTO services (tenant_id, facility_id, code, name, business_type, active) VALUES
  ('tenant-spa', 'facility-spa', 'MASSAGE60', 'Swedish Massage 60min', 'massage', true),
  ('tenant-spa', 'facility-spa', 'MASSAGE90', 'Deep Tissue 90min', 'massage', true),
  ('tenant-spa', 'facility-spa', 'FACIAL', 'Signature Facial', 'facial', true),
  ('tenant-spa', 'facility-spa', 'SCRUB', 'Body Scrub', 'body', true),
  ('tenant-spa', 'facility-spa', 'MANI', 'Manicure', 'nails', true),
  ('tenant-spa', 'facility-spa', 'PEDI', 'Pedicure', 'nails', true)
ON CONFLICT (tenant_id, facility_id, code) DO NOTHING;

-- Clinic services
INSERT INTO services (tenant_id, facility_id, code, name, business_type, active) VALUES
  ('tenant-clinic', 'facility-clinic', 'WELLVISIT', 'Annual Wellness Visit', 'primary_care', true),
  ('tenant-clinic', 'facility-clinic', 'URGENT', 'Urgent Care Visit', 'urgent_care', true),
  ('tenant-clinic', 'facility-clinic', 'LABWORK', 'Lab Work', 'diagnostics', true),
  ('tenant-clinic', 'facility-clinic', 'VACCINE', 'Vaccination', 'preventive', true),
  ('tenant-clinic', 'facility-clinic', 'FOLLOWUP', 'Follow-Up Visit', 'primary_care', true),
  ('tenant-clinic', 'facility-clinic', 'SPECIALIST', 'Specialist Referral', 'specialist', true)
ON CONFLICT (tenant_id, facility_id, code) DO NOTHING;

-- Fitness services
INSERT INTO services (tenant_id, facility_id, code, name, business_type, active) VALUES
  ('tenant-fitness', 'facility-fitness', 'PT60', 'Personal Training 60min', 'personal_training', true),
  ('tenant-fitness', 'facility-fitness', 'PT30', 'Personal Training 30min', 'personal_training', true),
  ('tenant-fitness', 'facility-fitness', 'GROUP', 'Group Fitness Class', 'group_class', true),
  ('tenant-fitness', 'facility-fitness', 'YOGA', 'Yoga Class', 'group_class', true),
  ('tenant-fitness', 'facility-fitness', 'ASSESS', 'Fitness Assessment', 'assessment', true),
  ('tenant-fitness', 'facility-fitness', 'NUTRITION', 'Nutrition Consultation', 'wellness', true)
ON CONFLICT (tenant_id, facility_id, code) DO NOTHING;
