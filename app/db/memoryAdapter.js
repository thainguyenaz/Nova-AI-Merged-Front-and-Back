const { randomUUID, createHash } = require('crypto');

function now() { return new Date().toISOString(); }

// ─── Event Trigger Log (simulates email/SMS) ──────────────────────────────────
const eventTriggerLog = [];

function fireEventTrigger(type, payload) {
  const entry = {
    id: randomUUID(),
    type, // 'email' | 'sms'
    ...payload,
    fired_at: now()
  };
  eventTriggerLog.push(entry);
  console.log(`[EventTrigger] ${type.toUpperCase()} ▶ ${JSON.stringify(payload)}`);
  return entry;
}

// ─── Seed State ───────────────────────────────────────────────────────────────
const state = {
  onboarding_sessions: [],
  tenants: [
    { id: 'tenant-a', name: 'Glow Med Spa', industry_type: 'medspa', created_at: now() },
    { id: 'tenant-barber', name: 'Kings & Cuts Barbershop', industry_type: 'barber', created_at: now() },
    { id: 'tenant-salon', name: 'Luxe Hair Salon', industry_type: 'salon', created_at: now() },
    { id: 'tenant-spa', name: 'Serenity Day Spa', industry_type: 'spa', created_at: now() },
    { id: 'tenant-clinic', name: 'Apex Medical Clinic', industry_type: 'clinic', created_at: now() },
    { id: 'tenant-fitness', name: 'Iron & Flow Fitness', industry_type: 'fitness', created_at: now() }
  ],
  facilities: [
    { id: 'facility-main', tenant_id: 'tenant-a', name: 'Glow Med Spa - Scottsdale', created_at: now() },
    { id: 'facility-barber', tenant_id: 'tenant-barber', name: 'Kings & Cuts - Main Shop', created_at: now() },
    { id: 'facility-salon', tenant_id: 'tenant-salon', name: 'Luxe Hair - Downtown', created_at: now() },
    { id: 'facility-spa', tenant_id: 'tenant-spa', name: 'Serenity Spa - Main', created_at: now() },
    { id: 'facility-clinic', tenant_id: 'tenant-clinic', name: 'Apex Clinic - Primary Care', created_at: now() },
    { id: 'facility-fitness', tenant_id: 'tenant-fitness', name: 'Iron & Flow - Main Studio', created_at: now() }
  ],
  roles: [
    { id: 'role-admin', code: 'admin', name: 'Administrator' },
    { id: 'role-clinician', code: 'clinician', name: 'Clinician' },
    { id: 'role-scheduler', code: 'scheduler', name: 'Scheduler' }
  ],
  users: [
    { id: 'u-admin', tenant_id: 'tenant-a', facility_id: 'facility-main', username: 'admin', email: 'admin@example.com', password: '$2b$10$placeholder', token: 'admin-token', industry_type: 'medspa', first_name: 'Admin', last_name: 'User', active: true },
    { id: 'u-clinician', tenant_id: 'tenant-a', facility_id: 'facility-main', username: 'clinician', email: 'clinician@example.com', password: '$2b$10$placeholder', token: 'clinician-token', industry_type: 'medspa', first_name: 'Clinician', last_name: 'User', active: true },
    { id: 'u-scheduler', tenant_id: 'tenant-a', facility_id: 'facility-main', username: 'scheduler', email: 'scheduler@example.com', password: '$2b$10$placeholder', token: 'scheduler-token', industry_type: 'medspa', first_name: 'Scheduler', last_name: 'User', active: true }
  ],
  refresh_tokens: {},
  user_roles: [
    { user_id: 'u-admin', role_code: 'admin' },
    { user_id: 'u-clinician', role_code: 'clinician' },
    { user_id: 'u-scheduler', role_code: 'scheduler' }
  ],
  services: [
    { id: 'svc-botox', tenant_id: 'tenant-a', facility_id: 'facility-main', code: 'BOTOX', name: 'Botox', business_type: 'injectables', active: true, color: '#8B5CF6', duration_min: 30 },
    { id: 'svc-hydrafacial', tenant_id: 'tenant-a', facility_id: 'facility-main', code: 'HYDRAFACIAL', name: 'HydraFacial', business_type: 'skin', active: true, color: '#06B6D4', duration_min: 60 },
    { id: 'svc-filler', tenant_id: 'tenant-a', facility_id: 'facility-main', code: 'FILLER', name: 'Dermal Filler', business_type: 'injectables', active: true, color: '#EC4899', duration_min: 45 },
    { id: 'svc-laser', tenant_id: 'tenant-a', facility_id: 'facility-main', code: 'LASER', name: 'Laser Treatment', business_type: 'laser', active: true, color: '#F59E0B', duration_min: 60 },
    { id: 'svc-chemical-peel', tenant_id: 'tenant-a', facility_id: 'facility-main', code: 'CHEM_PEEL', name: 'Chemical Peel', business_type: 'skin', active: true, color: '#10B981', duration_min: 45 },
    // ── Spa services ──
    { id: 'svc-spa-swedish', tenant_id: 'tenant-spa', facility_id: 'facility-spa', code: 'SWEDISH_60', name: 'Full Body Massage', business_type: 'massage', active: true, color: '#6366F1', duration_min: 60 },
    { id: 'svc-spa-facial', tenant_id: 'tenant-spa', facility_id: 'facility-spa', code: 'FACIAL', name: 'Facial', business_type: 'skin', active: true, color: '#EC4899', duration_min: 60 },
    { id: 'svc-spa-aromatherapy', tenant_id: 'tenant-spa', facility_id: 'facility-spa', code: 'AROMA', name: 'Aromatherapy', business_type: 'massage', active: true, color: '#14B8A6', duration_min: 60 },
    { id: 'svc-spa-hotstone', tenant_id: 'tenant-spa', facility_id: 'facility-spa', code: 'HOT_STONE', name: 'Hot Stone Massage', business_type: 'massage', active: true, color: '#F59E0B', duration_min: 90 },
    { id: 'svc-spa-bodyscrub', tenant_id: 'tenant-spa', facility_id: 'facility-spa', code: 'BODY_SCRUB', name: 'Body Scrub', business_type: 'body', active: true, color: '#10B981', duration_min: 45 },
    // ── Barber services ──
    { id: 'svc-barber-fade', tenant_id: 'tenant-barber', facility_id: 'facility-barber', code: 'FADE', name: 'Fade', business_type: 'haircut', active: true, color: '#6366F1', duration_min: 30 },
    { id: 'svc-barber-beardtrim', tenant_id: 'tenant-barber', facility_id: 'facility-barber', code: 'BEARD_TRIM', name: 'Beard Trim', business_type: 'grooming', active: true, color: '#F97316', duration_min: 20 },
    { id: 'svc-barber-hotshave', tenant_id: 'tenant-barber', facility_id: 'facility-barber', code: 'HOT_SHAVE', name: 'Hot Shave', business_type: 'grooming', active: true, color: '#FB923C', duration_min: 30 },
    { id: 'svc-barber-haircut', tenant_id: 'tenant-barber', facility_id: 'facility-barber', code: 'MENS_CUT', name: "Men's Haircut", business_type: 'haircut', active: true, color: '#14B8A6', duration_min: 30 },
    { id: 'svc-barber-kidscut', tenant_id: 'tenant-barber', facility_id: 'facility-barber', code: 'KIDS_CUT', name: 'Kids Cut', business_type: 'haircut', active: true, color: '#10B981', duration_min: 20 },
    // ── Salon services ──
    { id: 'svc-salon-color', tenant_id: 'tenant-salon', facility_id: 'facility-salon', code: 'FULL_COLOR', name: 'Full Color', business_type: 'color', active: true, color: '#EC4899', duration_min: 90 },
    { id: 'svc-salon-highlights', tenant_id: 'tenant-salon', facility_id: 'facility-salon', code: 'HIGHLIGHTS', name: 'Highlights', business_type: 'color', active: true, color: '#F59E0B', duration_min: 90 },
    { id: 'svc-salon-balayage', tenant_id: 'tenant-salon', facility_id: 'facility-salon', code: 'BALAYAGE', name: 'Balayage', business_type: 'color', active: true, color: '#6366F1', duration_min: 120 },
    { id: 'svc-salon-blowout', tenant_id: 'tenant-salon', facility_id: 'facility-salon', code: 'BLOWOUT', name: 'Blowout', business_type: 'style', active: true, color: '#14B8A6', duration_min: 45 },
    { id: 'svc-salon-trim', tenant_id: 'tenant-salon', facility_id: 'facility-salon', code: 'TRIM_STYLE', name: 'Trim & Style', business_type: 'style', active: true, color: '#10B981', duration_min: 45 },
    // ── Clinic services ──
    { id: 'svc-clinic-consultation', tenant_id: 'tenant-clinic', facility_id: 'facility-clinic', code: 'CONSULT', name: 'Consultation', business_type: 'clinical', active: true, color: '#6366F1', duration_min: 30 },
    { id: 'svc-clinic-physical', tenant_id: 'tenant-clinic', facility_id: 'facility-clinic', code: 'PHYSICAL', name: 'Physical Exam', business_type: 'clinical', active: true, color: '#14B8A6', duration_min: 45 },
    { id: 'svc-clinic-labwork', tenant_id: 'tenant-clinic', facility_id: 'facility-clinic', code: 'LAB_WORK', name: 'Lab Work', business_type: 'diagnostic', active: true, color: '#F59E0B', duration_min: 20 },
    { id: 'svc-clinic-followup', tenant_id: 'tenant-clinic', facility_id: 'facility-clinic', code: 'FOLLOW_UP', name: 'Follow-Up Visit', business_type: 'clinical', active: true, color: '#10B981', duration_min: 30 },
    { id: 'svc-clinic-urgent', tenant_id: 'tenant-clinic', facility_id: 'facility-clinic', code: 'URGENT', name: 'Urgent Care Visit', business_type: 'clinical', active: true, color: '#EC4899', duration_min: 30 },
    // ── Fitness services ──
    { id: 'svc-fitness-pt60', tenant_id: 'tenant-fitness', facility_id: 'facility-fitness', code: 'PT_60', name: 'Personal Training 60min', business_type: 'training', active: true, color: '#6366F1', duration_min: 60 },
    { id: 'svc-fitness-pt30', tenant_id: 'tenant-fitness', facility_id: 'facility-fitness', code: 'PT_30', name: 'Personal Training 30min', business_type: 'training', active: true, color: '#F97316', duration_min: 30 },
    { id: 'svc-fitness-group', tenant_id: 'tenant-fitness', facility_id: 'facility-fitness', code: 'GROUP_FIT', name: 'Group Fitness Class', business_type: 'class', active: true, color: '#14B8A6', duration_min: 60 },
    { id: 'svc-fitness-yoga', tenant_id: 'tenant-fitness', facility_id: 'facility-fitness', code: 'YOGA', name: 'Yoga Class', business_type: 'class', active: true, color: '#10B981', duration_min: 60 },
    { id: 'svc-fitness-nutrition', tenant_id: 'tenant-fitness', facility_id: 'facility-fitness', code: 'NUTRITION', name: 'Nutrition Consultation', business_type: 'wellness', active: true, color: '#EC4899', duration_min: 45 }
  ],
  providers: [
    { id: 'prov-1', tenant_id: 'tenant-a', facility_id: 'facility-main', name: 'Dr. Sarah Chen', role: 'MD', specialty: 'injectables', color: '#6366F1', avatar: 'SC', active: true },
    { id: 'prov-2', tenant_id: 'tenant-a', facility_id: 'facility-main', name: 'Dr. Marco Rivera', role: 'NP', specialty: 'laser', color: '#F97316', avatar: 'MR', active: true },
    { id: 'prov-3', tenant_id: 'tenant-a', facility_id: 'facility-main', name: 'Ava Thompson', role: 'Esthetician', specialty: 'skin', color: '#14B8A6', avatar: 'AT', active: true },
    { id: 'prov-4', tenant_id: 'tenant-a', facility_id: 'facility-main', name: 'Dr. Priya Patel', role: 'MD', specialty: 'injectables', color: '#E879F9', avatar: 'PP', active: true },
    { id: 'prov-5', tenant_id: 'tenant-a', facility_id: 'facility-main', name: 'Jake Morales', role: 'Tech', specialty: 'laser', color: '#FB923C', avatar: 'JM', active: true },
    // ── Spa providers ──
    { id: 'prov-spa-1', tenant_id: 'tenant-spa', facility_id: 'facility-spa', name: 'Anna Kowalski', role: 'Massage Therapist', specialty: 'massage', color: '#6366F1', avatar: 'AK', active: true },
    { id: 'prov-spa-2', tenant_id: 'tenant-spa', facility_id: 'facility-spa', name: 'Linda Park', role: 'Esthetician', specialty: 'skin', color: '#EC4899', avatar: 'LP', active: true },
    { id: 'prov-spa-3', tenant_id: 'tenant-spa', facility_id: 'facility-spa', name: 'Mei Zhang', role: 'Massage Therapist', specialty: 'massage', color: '#14B8A6', avatar: 'MZ', active: true },
    // ── Barber providers ──
    { id: 'prov-barber-1', tenant_id: 'tenant-barber', facility_id: 'facility-barber', name: 'Marcus Johnson', role: 'Barber', specialty: 'fade', color: '#6366F1', avatar: 'MJ', active: true },
    { id: 'prov-barber-2', tenant_id: 'tenant-barber', facility_id: 'facility-barber', name: 'Devon Williams', role: 'Master Barber', specialty: 'grooming', color: '#F97316', avatar: 'DW', active: true },
    { id: 'prov-barber-3', tenant_id: 'tenant-barber', facility_id: 'facility-barber', name: 'Keisha Brown', role: 'Barber', specialty: 'haircut', color: '#14B8A6', avatar: 'KB', active: true },
    // ── Salon providers ──
    { id: 'prov-salon-1', tenant_id: 'tenant-salon', facility_id: 'facility-salon', name: 'Jessica Laurent', role: 'Stylist', specialty: 'color', color: '#EC4899', avatar: 'JL', active: true },
    { id: 'prov-salon-2', tenant_id: 'tenant-salon', facility_id: 'facility-salon', name: 'Chloe Bennett', role: 'Senior Stylist', specialty: 'balayage', color: '#6366F1', avatar: 'CB', active: true },
    { id: 'prov-salon-3', tenant_id: 'tenant-salon', facility_id: 'facility-salon', name: 'Amy Chen', role: 'Stylist', specialty: 'style', color: '#14B8A6', avatar: 'AC', active: true },
    // ── Clinic providers ──
    { id: 'prov-clinic-1', tenant_id: 'tenant-clinic', facility_id: 'facility-clinic', name: 'Dr. Robert Chen', role: 'MD', specialty: 'primary care', color: '#6366F1', avatar: 'RC', active: true },
    { id: 'prov-clinic-2', tenant_id: 'tenant-clinic', facility_id: 'facility-clinic', name: 'Patricia Mills', role: 'NP', specialty: 'general', color: '#14B8A6', avatar: 'PM', active: true },
    { id: 'prov-clinic-3', tenant_id: 'tenant-clinic', facility_id: 'facility-clinic', name: 'Sandra Lopez', role: 'PA', specialty: 'urgent care', color: '#F59E0B', avatar: 'SL', active: true },
    // ── Fitness providers ──
    { id: 'prov-fitness-1', tenant_id: 'tenant-fitness', facility_id: 'facility-fitness', name: 'Alex Rivera', role: 'Personal Trainer', specialty: 'strength', color: '#6366F1', avatar: 'AR', active: true },
    { id: 'prov-fitness-2', tenant_id: 'tenant-fitness', facility_id: 'facility-fitness', name: 'Jordan Blake', role: 'Yoga Instructor', specialty: 'yoga', color: '#10B981', avatar: 'JB', active: true },
    { id: 'prov-fitness-3', tenant_id: 'tenant-fitness', facility_id: 'facility-fitness', name: 'Morgan Hayes', role: 'Nutritionist', specialty: 'nutrition', color: '#EC4899', avatar: 'MH', active: true }
  ],
  patients: [
    { id: 'pt-1', tenant_id: 'tenant-a', facility_id: 'facility-main', mrn: 'MRN-001', first_name: 'Emma', last_name: 'Wilson', dob: '1988-05-14', email: 'emma.wilson@email.com', phone: '602-555-0101', created_at: now(), updated_at: now() },
    { id: 'pt-2', tenant_id: 'tenant-a', facility_id: 'facility-main', mrn: 'MRN-002', first_name: 'Olivia', last_name: 'Martinez', dob: '1992-09-22', email: 'olivia.m@email.com', phone: '602-555-0102', created_at: now(), updated_at: now() },
    { id: 'pt-3', tenant_id: 'tenant-a', facility_id: 'facility-main', mrn: 'MRN-003', first_name: 'Liam', last_name: 'Johnson', dob: '1985-03-07', email: 'liam.j@email.com', phone: '602-555-0103', created_at: now(), updated_at: now() },
    { id: 'pt-4', tenant_id: 'tenant-a', facility_id: 'facility-main', mrn: 'MRN-004', first_name: 'Sophia', last_name: 'Lee', dob: '1995-11-30', email: 'sophia.lee@email.com', phone: '602-555-0104', created_at: now(), updated_at: now() },
    { id: 'pt-5', tenant_id: 'tenant-a', facility_id: 'facility-main', mrn: 'MRN-005', first_name: 'Noah', last_name: 'Brown', dob: '1990-07-18', email: 'noah.b@email.com', phone: '602-555-0105', created_at: now(), updated_at: now() },
    { id: 'pt-6', tenant_id: 'tenant-a', facility_id: 'facility-main', mrn: 'MRN-006', first_name: 'Ava', last_name: 'Davis', dob: '1987-12-05', email: 'ava.d@email.com', phone: '602-555-0106', created_at: now(), updated_at: now() },
    { id: 'pt-7', tenant_id: 'tenant-a', facility_id: 'facility-main', mrn: 'MRN-007', first_name: 'Isabella', last_name: 'Garcia', dob: '1993-04-25', email: 'isabella.g@email.com', phone: '602-555-0107', created_at: now(), updated_at: now() },
    { id: 'pt-8', tenant_id: 'tenant-a', facility_id: 'facility-main', mrn: 'MRN-008', first_name: 'Mason', last_name: 'Taylor', dob: '1991-08-12', email: 'mason.t@email.com', phone: '602-555-0108', created_at: now(), updated_at: now() },
    // ── Spa patients ──
    { id: 'pt-spa-1', tenant_id: 'tenant-spa', facility_id: 'facility-spa', mrn: 'SPA-001', first_name: 'Victoria', last_name: 'Hughes', dob: '1980-04-19', email: 'v.hughes@email.com', phone: '602-555-0201', created_at: now(), updated_at: now() },
    { id: 'pt-spa-2', tenant_id: 'tenant-spa', facility_id: 'facility-spa', mrn: 'SPA-002', first_name: 'Natalie', last_name: 'Foster', dob: '1975-08-07', email: 'n.foster@email.com', phone: '602-555-0202', created_at: now(), updated_at: now() },
    { id: 'pt-spa-3', tenant_id: 'tenant-spa', facility_id: 'facility-spa', mrn: 'SPA-003', first_name: 'Grace', last_name: 'Lee', dob: '2000-03-25', email: 'g.lee@email.com', phone: '602-555-0203', created_at: now(), updated_at: now() },
    { id: 'pt-spa-4', tenant_id: 'tenant-spa', facility_id: 'facility-spa', mrn: 'SPA-004', first_name: 'Heather', last_name: 'Scott', dob: '1965-12-11', email: 'h.scott@email.com', phone: '602-555-0204', created_at: now(), updated_at: now() },
    { id: 'pt-spa-5', tenant_id: 'tenant-spa', facility_id: 'facility-spa', mrn: 'SPA-005', first_name: 'Donna', last_name: 'Price', dob: '1991-06-29', email: 'd.price@email.com', phone: '602-555-0205', created_at: now(), updated_at: now() },
    // ── Barber patients ──
    { id: 'pt-bar-1', tenant_id: 'tenant-barber', facility_id: 'facility-barber', mrn: 'BAR-001', first_name: 'Tyler', last_name: 'Moore', dob: '1995-06-12', email: 't.moore@email.com', phone: '602-555-0301', created_at: now(), updated_at: now() },
    { id: 'pt-bar-2', tenant_id: 'tenant-barber', facility_id: 'facility-barber', mrn: 'BAR-002', first_name: 'James', last_name: 'Rivera', dob: '1988-02-28', email: 'j.rivera@email.com', phone: '602-555-0302', created_at: now(), updated_at: now() },
    { id: 'pt-bar-3', tenant_id: 'tenant-barber', facility_id: 'facility-barber', mrn: 'BAR-003', first_name: 'Ethan', last_name: 'Clark', dob: '2010-08-14', email: 'e.clark@email.com', phone: '602-555-0303', created_at: now(), updated_at: now() },
    { id: 'pt-bar-4', tenant_id: 'tenant-barber', facility_id: 'facility-barber', mrn: 'BAR-004', first_name: 'Andre', last_name: 'Thompson', dob: '1975-12-03', email: 'a.thompson@email.com', phone: '602-555-0304', created_at: now(), updated_at: now() },
    { id: 'pt-bar-5', tenant_id: 'tenant-barber', facility_id: 'facility-barber', mrn: 'BAR-005', first_name: 'Carlos', last_name: 'Mendez', dob: '2001-04-20', email: 'c.mendez@email.com', phone: '602-555-0305', created_at: now(), updated_at: now() },
    // ── Salon patients ──
    { id: 'pt-sal-1', tenant_id: 'tenant-salon', facility_id: 'facility-salon', mrn: 'SAL-001', first_name: 'Sophia', last_name: 'Anderson', dob: '1993-05-16', email: 's.anderson@email.com', phone: '602-555-0401', created_at: now(), updated_at: now() },
    { id: 'pt-sal-2', tenant_id: 'tenant-salon', facility_id: 'facility-salon', mrn: 'SAL-002', first_name: 'Emma', last_name: 'Davis', dob: '1987-09-24', email: 'e.davis@email.com', phone: '602-555-0402', created_at: now(), updated_at: now() },
    { id: 'pt-sal-3', tenant_id: 'tenant-salon', facility_id: 'facility-salon', mrn: 'SAL-003', first_name: 'Olivia', last_name: 'Wilson', dob: '2000-01-08', email: 'o.wilson@email.com', phone: '602-555-0403', created_at: now(), updated_at: now() },
    { id: 'pt-sal-4', tenant_id: 'tenant-salon', facility_id: 'facility-salon', mrn: 'SAL-004', first_name: 'Ava', last_name: 'Martinez', dob: '1970-11-30', email: 'a.martinez@email.com', phone: '602-555-0404', created_at: now(), updated_at: now() },
    { id: 'pt-sal-5', tenant_id: 'tenant-salon', facility_id: 'facility-salon', mrn: 'SAL-005', first_name: 'Isabella', last_name: 'Garcia', dob: '1996-07-04', email: 'i.garcia@email.com', phone: '602-555-0405', created_at: now(), updated_at: now() },
    // ── Clinic patients ──
    { id: 'pt-cln-1', tenant_id: 'tenant-clinic', facility_id: 'facility-clinic', mrn: 'CLN-001', first_name: 'Michael', last_name: 'Johnson', dob: '1960-02-14', email: 'm.johnson@email.com', phone: '602-555-0501', created_at: now(), updated_at: now() },
    { id: 'pt-cln-2', tenant_id: 'tenant-clinic', facility_id: 'facility-clinic', mrn: 'CLN-002', first_name: 'Barbara', last_name: 'Smith', dob: '1955-09-03', email: 'b.smith@email.com', phone: '602-555-0502', created_at: now(), updated_at: now() },
    { id: 'pt-cln-3', tenant_id: 'tenant-clinic', facility_id: 'facility-clinic', mrn: 'CLN-003', first_name: 'William', last_name: 'Brown', dob: '1978-11-22', email: 'w.brown@email.com', phone: '602-555-0503', created_at: now(), updated_at: now() },
    { id: 'pt-cln-4', tenant_id: 'tenant-clinic', facility_id: 'facility-clinic', mrn: 'CLN-004', first_name: 'Susan', last_name: 'Taylor', dob: '1945-05-30', email: 's.taylor@email.com', phone: '602-555-0504', created_at: now(), updated_at: now() },
    { id: 'pt-cln-5', tenant_id: 'tenant-clinic', facility_id: 'facility-clinic', mrn: 'CLN-005', first_name: 'Richard', last_name: 'Davis', dob: '1988-08-16', email: 'r.davis@email.com', phone: '602-555-0505', created_at: now(), updated_at: now() },
    // ── Fitness patients ──
    { id: 'pt-fit-1', tenant_id: 'tenant-fitness', facility_id: 'facility-fitness', mrn: 'FIT-001', first_name: 'Chris', last_name: 'Evans', dob: '1990-07-15', email: 'c.evans@email.com', phone: '602-555-0601', created_at: now(), updated_at: now() },
    { id: 'pt-fit-2', tenant_id: 'tenant-fitness', facility_id: 'facility-fitness', mrn: 'FIT-002', first_name: 'Taylor', last_name: 'Swift', dob: '1999-12-13', email: 't.swift@email.com', phone: '602-555-0602', created_at: now(), updated_at: now() },
    { id: 'pt-fit-3', tenant_id: 'tenant-fitness', facility_id: 'facility-fitness', mrn: 'FIT-003', first_name: 'Sam', last_name: 'Wilson', dob: '1985-04-04', email: 's.wilson@email.com', phone: '602-555-0603', created_at: now(), updated_at: now() },
    { id: 'pt-fit-4', tenant_id: 'tenant-fitness', facility_id: 'facility-fitness', mrn: 'FIT-004', first_name: 'Jamie', last_name: 'Lee', dob: '2003-09-08', email: 'j.lee@email.com', phone: '602-555-0604', created_at: now(), updated_at: now() },
    { id: 'pt-fit-5', tenant_id: 'tenant-fitness', facility_id: 'facility-fitness', mrn: 'FIT-005', first_name: 'Robin', last_name: 'Stone', dob: '1975-01-25', email: 'r.stone@email.com', phone: '602-555-0605', created_at: now(), updated_at: now() }
  ],
  appointments: [],
  encounters: [],
  audit_logs: [],
  event_trigger_log: eventTriggerLog
};

// ─── Seed demo appointments for this week + next week (all industry tenants) ──
(function seedAllDemoAppointments() {
  const INDUSTRY_TENANTS = [
    { tenantId: 'tenant-a',       facilityId: 'facility-main'    },
    { tenantId: 'tenant-barber',  facilityId: 'facility-barber'  },
    { tenantId: 'tenant-salon',   facilityId: 'facility-salon'   },
    { tenantId: 'tenant-spa',     facilityId: 'facility-spa'     },
    { tenantId: 'tenant-clinic',  facilityId: 'facility-clinic'  },
    { tenantId: 'tenant-fitness', facilityId: 'facility-fitness' }
  ];
  const statuses = ['booked', 'booked', 'booked', 'confirmed', 'confirmed', 'checked_in'];
  const today = new Date();

  for (const { tenantId, facilityId } of INDUSTRY_TENANTS) {
    const provIds = state.providers.filter(p => p.tenant_id === tenantId && p.facility_id === facilityId).map(p => p.id);
    const svcIds  = state.services.filter(s => s.tenant_id === tenantId && s.facility_id === facilityId).map(s => s.id);
    const ptIds   = state.patients.filter(p => p.tenant_id === tenantId && p.facility_id === facilityId).map(p => p.id);

    if (!provIds.length || !svcIds.length || !ptIds.length) continue;

    // seed 7 days starting from yesterday
    for (let dayOffset = -1; dayOffset <= 7; dayOffset++) {
      const d = new Date(today);
      d.setDate(d.getDate() + dayOffset);
      if (d.getDay() === 0 || d.getDay() === 6) continue; // skip weekends

      const count = 3 + Math.floor(Math.random() * 3); // 3-5 per day
      const usedSlots = new Set();

      for (let i = 0; i < count; i++) {
        let hour;
        do { hour = 9 + Math.floor(Math.random() * 8); } while (usedSlots.has(hour));
        usedSlots.add(hour);

        const dateStr = d.toISOString().split('T')[0];
        const startsAt = `${dateStr}T${String(hour).padStart(2, '0')}:00:00.000Z`;
        const patientId  = ptIds[Math.floor(Math.random() * ptIds.length)];
        const providerId = provIds[Math.floor(Math.random() * provIds.length)];
        const serviceId  = svcIds[Math.floor(Math.random() * svcIds.length)];
        const status     = statuses[Math.floor(Math.random() * statuses.length)];

        const patient  = state.patients.find(p => p.id === patientId);
        const service  = state.services.find(s => s.id === serviceId);
        const provider = state.providers.find(p => p.id === providerId);

        state.appointments.push({
          id: randomUUID(),
          tenant_id: tenantId,
          facility_id: facilityId,
          patient_id: patientId,
          provider_id: providerId,
          service_id: serviceId,
          starts_at: startsAt,
          duration_min: service.duration_min,
          status,
          notes: null,
          patient_name: `${patient.first_name} ${patient.last_name}`,
          provider_name: provider.name,
          service_name: service.name,
          service_color: service.color,
          created_at: now(),
          updated_at: now()
        });
      }
    }
  }
  console.log(`[Seed] Generated ${state.appointments.length} demo appointments across all industry tenants.`);
})();

// ─── Helpers ─────────────────────────────────────────────────────────────────
function withTimestamps(rec) {
  return { ...rec, created_at: now(), updated_at: now() };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function getUserByToken(token) {
  const user = state.users.find(u => u.token === token && u.active);
  if (!user) return null;
  const role = state.user_roles.find(r => r.user_id === user.id)?.role_code || null;
  return { ...user, role };
}

async function getUserByUsername(username) {
  const user = state.users.find(u => u.username === username && u.active);
  if (!user) return null;
  const role = state.user_roles.find(r => r.user_id === user.id)?.role_code || null;
  return { ...user, role };
}

async function getUserByEmail(email) {
  return state.users.find(u => u.email === email) || null;
}

async function getUserById(userId) {
  return state.users.find(u => u.id === userId) || null;
}

async function createUser({ email, password, firstName, lastName, industryType }) {
  const { randomUUID: uuid } = require('crypto');
  const user = withTimestamps({
    id: randomUUID(),
    email,
    password,
    first_name: firstName || '',
    last_name: lastName || '',
    username: email.split('@')[0],
    industry_type: industryType || 'medspa',
    active: true,
    token: null
  });
  state.users.push(user);
  return user;
}

async function saveRefreshToken(userId, token) {
  state.refresh_tokens[userId] = token;
}

async function getRefreshToken(userId) {
  return state.refresh_tokens[userId] || null;
}

async function revokeRefreshToken(userId) {
  delete state.refresh_tokens[userId];
}

// ─── Industry ──────────────────────────────────────────────────────────────────
async function updateUserIndustry(userId, industryType) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return null;
  user.industry_type = industryType;
  user.updated_at = now();
  return user;
}

async function getUserIndustry(userId) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return null;
  return { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, industry_type: user.industry_type };
}

// ─── Providers ───────────────────────────────────────────────────────────────
async function listProviders({ tenantId, facilityId }) {
  return state.providers.filter(p => p.tenant_id === tenantId && p.facility_id === facilityId && p.active);
}

async function getProvider(id) {
  return state.providers.find(p => p.id === id) || null;
}

// ─── Patients ────────────────────────────────────────────────────────────────
async function listPatients({ tenantId, facilityId }) {
  return state.patients.filter(p => p.tenant_id === tenantId && p.facility_id === facilityId);
}

async function createPatient({ tenantId, facilityId, mrn, firstName, lastName, dob }) {
  const row = withTimestamps({
    id: randomUUID(), tenant_id: tenantId, facility_id: facilityId,
    mrn, first_name: firstName, last_name: lastName, dob
  });
  state.patients.push(row);
  return row;
}

// ─── Appointments ─────────────────────────────────────────────────────────────
async function listAppointments({ tenantId, facilityId }) {
  return state.appointments.filter(a => a.tenant_id === tenantId && a.facility_id === facilityId);
}

async function createAppointment({ tenantId, facilityId, patientId, startsAt, serviceId, providerId, status, notes }) {
  const patient = state.patients.find(p => p.id === patientId);
  const service = state.services.find(s => s.id === serviceId);
  const provider = state.providers.find(p => p.id === providerId);

  const row = withTimestamps({
    id: randomUUID(),
    tenant_id: tenantId,
    facility_id: facilityId,
    patient_id: patientId,
    provider_id: providerId || null,
    service_id: serviceId,
    starts_at: startsAt,
    duration_min: service?.duration_min || 30,
    status: status || 'booked',
    notes: notes || null,
    patient_name: patient ? `${patient.first_name} ${patient.last_name}` : null,
    provider_name: provider ? provider.name : null,
    service_name: service ? service.name : null,
    service_color: service ? service.color : '#6B7280'
  });
  state.appointments.push(row);

  // Fire event triggers
  if (patient?.email) {
    fireEventTrigger('email', {
      to: patient.email,
      subject: `Appointment Confirmed: ${service?.name || 'Service'}`,
      body: `Hi ${patient.first_name}, your appointment is confirmed for ${new Date(startsAt).toLocaleString()} with ${provider?.name || 'your provider'}.`
    });
  }
  if (patient?.phone) {
    fireEventTrigger('sms', {
      to: patient.phone,
      body: `Nova Med Spa: Hi ${patient.first_name}! Appt confirmed ${new Date(startsAt).toLocaleDateString()} with ${provider?.name || 'provider'}. Reply STOP to cancel.`
    });
  }

  return row;
}

async function reassignAppointment({ appointmentId, newProviderId, actorUserId, actorRole }) {
  const appt = state.appointments.find(a => a.id === appointmentId);
  if (!appt) throw new Error('Appointment not found');

  const oldProvider = state.providers.find(p => p.id === appt.provider_id);
  const newProvider = state.providers.find(p => p.id === newProviderId);
  if (!newProvider) throw new Error('Provider not found');

  const prevProviderId = appt.provider_id;
  const prevProviderName = appt.provider_name;

  appt.provider_id = newProviderId;
  appt.provider_name = newProvider.name;
  appt.updated_at = now();

  // Fire event triggers for reassignment
  const patient = state.patients.find(p => p.id === appt.patient_id);
  if (patient?.email) {
    fireEventTrigger('email', {
      to: patient.email,
      subject: `Appointment Update — Provider Changed`,
      body: `Hi ${patient.first_name}, your appointment on ${new Date(appt.starts_at).toLocaleString()} has been reassigned from ${prevProviderName || 'previous provider'} to ${newProvider.name}.`
    });
  }
  if (patient?.phone) {
    fireEventTrigger('sms', {
      to: patient.phone,
      body: `Nova Med Spa: Your appt on ${new Date(appt.starts_at).toLocaleDateString()} is now with ${newProvider.name}. Questions? Call us.`
    });
  }

  console.log(`[Reassign] Appointment ${appointmentId}: ${prevProviderName} → ${newProvider.name} (by ${actorRole})`);

  return { appointment: appt, prevProviderId, prevProviderName, newProviderId, newProviderName: newProvider.name };
}

async function seedDemoAppointments({ tenantId, facilityId }) {
  // Remove existing demo appointments for this tenant/facility
  const before = state.appointments.length;
  state.appointments = state.appointments.filter(a => !(a.tenant_id === tenantId && a.facility_id === facilityId));

  const provIds = state.providers.filter(p => p.tenant_id === tenantId && p.facility_id === facilityId).map(p => p.id);
  const svcIds = state.services.filter(s => s.tenant_id === tenantId && s.facility_id === facilityId).map(s => s.id);
  const ptIds = state.patients.filter(p => p.tenant_id === tenantId && p.facility_id === facilityId).map(p => p.id);
  const statuses = ['booked', 'booked', 'confirmed', 'confirmed', 'checked_in'];

  const today = new Date();
  let seeded = 0;

  for (let dayOffset = -1; dayOffset <= 7; dayOffset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const count = 3 + Math.floor(Math.random() * 3);
    const usedSlots = new Set();

    for (let i = 0; i < count; i++) {
      let hour;
      do { hour = 9 + Math.floor(Math.random() * 8); } while (usedSlots.has(hour));
      usedSlots.add(hour);

      const dateStr = d.toISOString().split('T')[0];
      const startsAt = `${dateStr}T${String(hour).padStart(2, '0')}:00:00.000Z`;
      const patientId = ptIds[Math.floor(Math.random() * ptIds.length)];
      const providerId = provIds[Math.floor(Math.random() * provIds.length)];
      const serviceId = svcIds[Math.floor(Math.random() * svcIds.length)];

      const patient = state.patients.find(p => p.id === patientId);
      const service = state.services.find(s => s.id === serviceId);
      const provider = state.providers.find(p => p.id === providerId);

      state.appointments.push({
        id: randomUUID(),
        tenant_id: tenantId,
        facility_id: facilityId,
        patient_id: patientId,
        provider_id: providerId,
        service_id: serviceId,
        starts_at: startsAt,
        duration_min: service.duration_min,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        notes: null,
        patient_name: `${patient.first_name} ${patient.last_name}`,
        provider_name: provider.name,
        service_name: service.name,
        service_color: service.color,
        created_at: now(),
        updated_at: now()
      });
      seeded++;
    }
  }

  console.log(`[Seed] Re-seeded ${seeded} demo appointments (was ${before}).`);
  return { seeded, total: state.appointments.length };
}

async function listEventTriggers({ tenantId, facilityId, limit = 50 }) {
  return eventTriggerLog.slice(-limit).reverse();
}

// ─── Encounters ───────────────────────────────────────────────────────────────
async function listEncounters({ tenantId, facilityId }) {
  return state.encounters.filter(e => e.tenant_id === tenantId && e.facility_id === facilityId);
}

async function createEncounter({ tenantId, facilityId, patientId, appointmentId, serviceId, clinicianId, notes }) {
  const row = withTimestamps({
    id: randomUUID(), tenant_id: tenantId, facility_id: facilityId,
    patient_id: patientId, appointment_id: appointmentId || null, service_id: serviceId || null,
    clinician_id: clinicianId, notes: notes || null
  });
  state.encounters.push(row);
  return row;
}

// ─── Audit ─────────────────────────────────────────────────────────────────────
async function listAuditLogs({ tenantId, facilityId }) {
  return state.audit_logs.filter(a => a.tenant_id === tenantId && a.facility_id === facilityId)
    .sort((a, b) => a.seq - b.seq);
}

async function appendAuditLog(event) {
  const chain = state.audit_logs
    .filter(a => a.tenant_id === event.tenantId && a.facility_id === event.facilityId)
    .sort((a, b) => b.seq - a.seq)[0];
  const seq = (chain?.seq || 0) + 1;
  const previousHash = chain?.hash || null;
  const payload = JSON.stringify(event.metadata || {});
  const hash = createHash('sha256').update(`${event.tenantId}|${event.facilityId}|${seq}|${event.action}|${event.resourceType}|${event.resourceId || ''}|${payload}|${previousHash || ''}`).digest('hex');
  const row = {
    id: randomUUID(),
    tenant_id: event.tenantId,
    facility_id: event.facilityId,
    actor_user_id: event.actorUserId,
    actor_role: event.actorRole,
    action: event.action,
    resource_type: event.resourceType,
    resource_id: event.resourceId || null,
    metadata_json: event.metadata || {},
    seq,
    previous_hash: previousHash,
    hash,
    created_at: now()
  };
  state.audit_logs.push(row);
  return row;
}

// ── Onboarding Session CRUD ──────────────────────────────────────────────────

async function createOnboardingSession({ userId }) {
  const session = {
    id: randomUUID(),
    user_id: userId || null,
    status: 'in_progress',
    current_step: 1,
    steps: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null },
    created_at: now(),
    updated_at: now(),
  };
  state.onboarding_sessions.push(session);
  return session;
}

async function getOnboardingSession(id) {
  return state.onboarding_sessions.find(s => s.id === id) || null;
}

async function updateOnboardingStep(id, step, data) {
  const session = state.onboarding_sessions.find(s => s.id === id);
  if (!session) return null;
  session.steps[step] = data;
  session.current_step = Math.max(session.current_step, Number(step));
  session.updated_at = now();
  return session;
}

async function finalizeOnboarding(id) {
  const session = state.onboarding_sessions.find(s => s.id === id);
  if (!session) return null;
  const steps = session.steps;

  const companyInfo = steps[2] || {};
  const tenantId = randomUUID();
  const facilityId = randomUUID();
  const businessType = (steps[1] || {}).type || 'medspa';

  const tenant = withTimestamps({
    id: tenantId,
    name: companyInfo.companyName || 'My Business',
    industry_type: businessType,
    phone: companyInfo.phone || null,
    email: companyInfo.email || null,
    address: companyInfo.address || null,
    city: companyInfo.city || null,
    state: companyInfo.state || null,
    zip: companyInfo.zip || null,
    website: companyInfo.website || null,
    inventory_config: steps[3] || {},
    api_connections: steps[5] || {},
  });
  state.tenants.push(tenant);

  const facility = withTimestamps({
    id: facilityId,
    tenant_id: tenantId,
    name: companyInfo.companyName || 'Main Location',
  });
  state.facilities.push(facility);

  // Staff
  const staffList = (steps[4] || {}).staff || [];
  const createdStaff = [];
  for (const member of staffList) {
    const u = withTimestamps({
      id: randomUUID(),
      tenant_id: tenantId,
      facility_id: facilityId,
      username: member.email || `staff-${randomUUID().slice(0, 8)}`,
      first_name: member.firstName || '',
      last_name: member.lastName || '',
      email: member.email || null,
      role: member.role || 'staff',
      token: `tok-${randomUUID()}`,
      active: true,
    });
    state.users.push(u);
    createdStaff.push(u);
  }

  // Demo data
  const demoData = steps[6] || {};
  if (demoData.loadDemo) {
    const demoPatients = [
      { mrn: 'DEMO-001', first_name: 'Jane', last_name: 'Doe', dob: '1985-04-12' },
      { mrn: 'DEMO-002', first_name: 'John', last_name: 'Smith', dob: '1979-09-30' },
      { mrn: 'DEMO-003', first_name: 'Emily', last_name: 'Chen', dob: '1992-01-17' },
    ];
    for (const p of demoPatients) {
      state.patients.push(withTimestamps({ id: randomUUID(), tenant_id: tenantId, facility_id: facilityId, ...p }));
    }
    const demoServices = [
      { code: 'BOTOX', name: 'Botox Treatment' }, { code: 'FILLER', name: 'Dermal Filler' },
      { code: 'FACIAL', name: 'HydraFacial' }, { code: 'LASER', name: 'Laser Hair Removal' },
    ];
    for (const svc of demoServices) {
      state.services.push(withTimestamps({
        id: randomUUID(), tenant_id: tenantId, facility_id: facilityId,
        code: svc.code, name: svc.name, business_type: businessType, active: true,
      }));
    }
  }

  session.status = 'completed';
  session.completed_at = now();
  session.provisioned = { tenantId, facilityId, staffCount: createdStaff.length };
  session.updated_at = now();

  return { session, tenantId, facilityId, staffCount: createdStaff.length, demoDataLoaded: !!(demoData.loadDemo) };
}

module.exports = {
  getUserByToken,
  getUserByUsername,
  getUserByEmail,
  getUserById,
  createUser,
  saveRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  updateUserIndustry,
  getUserIndustry,
  listPatients,
  createPatient,
  listProviders,
  getProvider,
  listAppointments,
  createAppointment,
  reassignAppointment,
  seedDemoAppointments,
  listEventTriggers,
  listEncounters,
  createEncounter,
  listAuditLogs,
  appendAuditLog,
  // Onboarding
  createOnboardingSession,
  getOnboardingSession,
  updateOnboardingStep,
  finalizeOnboarding,
};
