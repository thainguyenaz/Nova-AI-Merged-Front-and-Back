const { Pool } = require('pg');
const { randomUUID } = require('crypto');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
      max: Number(process.env.DB_POOL_MAX || 10)
    });
  }
  return pool;
}

async function q(text, params) {
  const res = await getPool().query(text, params);
  return res.rows;
}

// ─── Event trigger log (in-memory for postgres mode too) ─────────────────────
const eventTriggerLog = [];

function fireEventTrigger(type, payload) {
  const entry = { id: randomUUID(), type, ...payload, fired_at: new Date().toISOString() };
  eventTriggerLog.push(entry);
  console.log(`[EventTrigger] ${type.toUpperCase()} ▶ ${JSON.stringify(payload)}`);
  return entry;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function getUserByToken(token) {
  const rows = await q(`SELECT u.*, r.code AS role
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE u.token = $1 AND u.active = true
    LIMIT 1`, [token]);
  return rows[0] || null;
}

async function getUserByUsername(username) {
  const rows = await q(`SELECT u.*, r.code AS role
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE u.username = $1 AND u.active = true
    LIMIT 1`, [username]);
  return rows[0] || null;
}

async function getUserByEmail(email) {
  const rows = await q(`SELECT u.*, COALESCE(r.code, u.role) AS role
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.email = $1 LIMIT 1`, [email]);
  return rows[0] || null;
}

async function getUserById(userId) {
  const rows = await q(`SELECT u.*, COALESCE(r.code, u.role) AS role
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.id = $1 LIMIT 1`, [userId]);
  return rows[0] || null;
}

async function createUser({ email, password, firstName, lastName, industryType }) {
  const rows = await q(
    'INSERT INTO users (email, password, first_name, last_name, industry_type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [email, password, firstName || '', lastName || '', industryType || 'medspa']
  );
  return rows[0];
}

async function updateUserIndustry(userId, industryType) {
  const rows = await q(
    'UPDATE users SET industry_type = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [industryType, userId]
  );
  return rows[0] || null;
}

async function getUserIndustry(userId) {
  const rows = await q(
    'SELECT id, email, first_name, last_name, industry_type FROM users WHERE id = $1',
    [userId]
  );
  return rows[0] || null;
}

async function saveRefreshToken(userId, token) {
  await q('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
  await q('INSERT INTO refresh_tokens (user_id, token) VALUES ($1, $2)', [userId, token]);
}

async function getRefreshToken(userId) {
  const rows = await q('SELECT token FROM refresh_tokens WHERE user_id = $1', [userId]);
  return rows[0]?.token || null;
}

async function revokeRefreshToken(userId) {
  await q('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
}

// ─── Providers ────────────────────────────────────────────────────────────────
async function listProviders({ tenantId, facilityId }) {
  return q(`SELECT * FROM providers
    WHERE tenant_id=$1 AND facility_id=$2 AND active=true
    ORDER BY name ASC`, [tenantId, facilityId]);
}

async function getProvider(id) {
  const rows = await q('SELECT * FROM providers WHERE id=$1', [id]);
  return rows[0] || null;
}

// ─── Patients ─────────────────────────────────────────────────────────────────
// Industry → tenant/facility mapping for context-aware queries
const INDUSTRY_TENANT_MAP = {
  medspa:      { tenantId: 'tenant-a',       facilityId: 'facility-main'    },
  barber:      { tenantId: 'tenant-barber',  facilityId: 'facility-barber'  },
  barbershop:  { tenantId: 'tenant-barber',  facilityId: 'facility-barber'  },
  salon:       { tenantId: 'tenant-salon',   facilityId: 'facility-salon'   },
  hair_salon:  { tenantId: 'tenant-salon',   facilityId: 'facility-salon'   },
  spa:         { tenantId: 'tenant-spa',     facilityId: 'facility-spa'     },
  day_spa:     { tenantId: 'tenant-spa',     facilityId: 'facility-spa'     },
  clinic:      { tenantId: 'tenant-clinic',  facilityId: 'facility-clinic'  },
  esthetics:   { tenantId: 'tenant-clinic',  facilityId: 'facility-clinic'  },
  fitness:     { tenantId: 'tenant-fitness', facilityId: 'facility-fitness' },
  weight_loss: { tenantId: 'tenant-fitness', facilityId: 'facility-fitness' },
  peptide_hrt: { tenantId: 'tenant-peptide', facilityId: 'facility-peptide' },
  nail_salon:  { tenantId: 'tenant-a',       facilityId: 'facility-main'    }
};

function resolveIndustryContext(context) {
  if (context.industry && INDUSTRY_TENANT_MAP[context.industry]) {
    return INDUSTRY_TENANT_MAP[context.industry];
  }
  return { tenantId: context.tenantId, facilityId: context.facilityId };
}

async function listPatients(context) {
  const { tenantId, facilityId } = resolveIndustryContext(context);
  return q('SELECT * FROM patients WHERE tenant_id=$1 AND facility_id=$2 ORDER BY created_at DESC', [tenantId, facilityId]);
}

async function createPatient({ tenantId, facilityId, mrn, firstName, lastName, dob }) {
  const rows = await q(`INSERT INTO patients (tenant_id, facility_id, mrn, first_name, last_name, dob)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [tenantId, facilityId, mrn, firstName, lastName, dob]);
  return rows[0];
}

// ─── Appointments ─────────────────────────────────────────────────────────────
async function listAppointments(context) {
  const { tenantId, facilityId } = resolveIndustryContext(context);
  return q(`SELECT a.*,
      CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
      pr.name AS provider_name,
      s.name AS service_name,
      s.color AS service_color,
      COALESCE(s.duration_min, 30) AS duration_min
    FROM appointments a
    LEFT JOIN patients p ON p.id = a.patient_id
    LEFT JOIN providers pr ON pr.id = a.provider_id
    LEFT JOIN services s ON s.id = a.service_id
    WHERE a.tenant_id=$1 AND a.facility_id=$2
    ORDER BY a.starts_at ASC`, [tenantId, facilityId]);
}

async function createAppointment({ tenantId, facilityId, patientId, startsAt, serviceId, providerId, status, notes }) {
  // Look up patient/provider/service for denormalized fields
  const [pts, provs, svcs] = await Promise.all([
    q('SELECT * FROM patients WHERE id=$1', [patientId]),
    providerId ? q('SELECT * FROM providers WHERE id=$1', [providerId]) : Promise.resolve([]),
    serviceId ? q('SELECT * FROM services WHERE id=$1', [serviceId]) : Promise.resolve([])
  ]);
  const patient = pts[0]; const provider = provs[0]; const service = svcs[0];

  const rows = await q(`INSERT INTO appointments
    (tenant_id, facility_id, patient_id, provider_id, starts_at, service_id, status, notes,
     patient_name, provider_name, service_name, service_color, duration_min)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      tenantId, facilityId, patientId, providerId || null, startsAt,
      serviceId || null, status || 'booked', notes || null,
      patient ? `${patient.first_name} ${patient.last_name}` : null,
      provider ? provider.name : null,
      service ? service.name : null,
      service ? service.color : null,
      service ? service.duration_min : 30
    ]);

  const appt = rows[0];

  // Fire event triggers
  if (patient?.email) {
    fireEventTrigger('email', {
      to: patient.email,
      subject: `Appointment Confirmed: ${service?.name || 'Service'}`,
      body: `Hi ${patient.first_name}, your appointment is confirmed for ${new Date(startsAt).toLocaleString()} with ${provider?.name || 'your provider'}.`
    });
  }

  return appt;
}

async function reassignAppointment({ appointmentId, newProviderId, actorUserId, actorRole }) {
  const appts = await q('SELECT * FROM appointments WHERE id=$1', [appointmentId]);
  if (!appts.length) throw new Error('Appointment not found');
  const appt = appts[0];

  const provs = await q('SELECT * FROM providers WHERE id=$1', [newProviderId]);
  if (!provs.length) throw new Error('Provider not found');
  const newProvider = provs[0];

  const prevProviderId = appt.provider_id;
  const prevProviderName = appt.provider_name;

  const updated = await q(`UPDATE appointments
    SET provider_id=$1, provider_name=$2, updated_at=NOW()
    WHERE id=$3 RETURNING *`,
    [newProviderId, newProvider.name, appointmentId]);

  const updatedAppt = updated[0];

  // Fire event triggers
  const pts = await q('SELECT * FROM patients WHERE id=$1', [appt.patient_id]);
  const patient = pts[0];
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

  console.log(`[Reassign] Appointment ${appointmentId}: ${prevProviderName} → ${newProvider.name}`);

  return {
    appointment: updatedAppt,
    prevProviderId,
    prevProviderName,
    newProviderId,
    newProviderName: newProvider.name
  };
}

async function seedDemoAppointments({ tenantId, facilityId }) {
  // Delete existing appointments for this facility
  const del = await q('DELETE FROM appointments WHERE tenant_id=$1 AND facility_id=$2 RETURNING id', [tenantId, facilityId]);
  const before = del.length;

  // Fetch providers, services, patients
  const [provList, svcList, ptList] = await Promise.all([
    listProviders({ tenantId, facilityId }),
    q('SELECT * FROM services WHERE tenant_id=$1 AND facility_id=$2 AND active=true', [tenantId, facilityId]),
    listPatients({ tenantId, facilityId })
  ]);

  if (!provList.length || !svcList.length || !ptList.length) {
    return { seeded: 0, total: 0, error: 'Missing providers/services/patients' };
  }

  const statuses = ['booked', 'booked', 'confirmed', 'confirmed', 'checked_in'];
  const today = new Date();
  let seeded = 0;
  const insertPromises = [];

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

      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const startsAt = `${dateStr}T${String(hour).padStart(2,'0')}:00:00Z`;
      const patient = ptList[Math.floor(Math.random() * ptList.length)];
      const provider = provList[Math.floor(Math.random() * provList.length)];
      const service = svcList[Math.floor(Math.random() * svcList.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      insertPromises.push(q(`INSERT INTO appointments
        (tenant_id, facility_id, patient_id, provider_id, starts_at, service_id, status,
         patient_name, provider_name, service_name, service_color, duration_min)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [
          tenantId, facilityId,
          patient.id, provider.id, startsAt, service.id, status,
          `${patient.first_name} ${patient.last_name}`,
          provider.name, service.name,
          service.color || '#6B7280',
          service.duration_min || 30
        ]));
      seeded++;
    }
  }

  await Promise.all(insertPromises);
  const countRows = await q('SELECT COUNT(*) FROM appointments WHERE tenant_id=$1 AND facility_id=$2', [tenantId, facilityId]);
  console.log(`[Seed] Re-seeded ${seeded} demo appointments.`);
  return { seeded, total: parseInt(countRows[0].count) };
}

async function listEventTriggers({ tenantId, facilityId, limit = 50 }) {
  return eventTriggerLog.slice(-limit).reverse();
}

// ─── Encounters ───────────────────────────────────────────────────────────────
async function listEncounters({ tenantId, facilityId }) {
  return q('SELECT * FROM encounters WHERE tenant_id=$1 AND facility_id=$2 ORDER BY created_at DESC', [tenantId, facilityId]);
}

async function createEncounter({ tenantId, facilityId, patientId, appointmentId, serviceId, clinicianId, notes }) {
  const rows = await q(`INSERT INTO encounters (tenant_id, facility_id, patient_id, appointment_id, service_id, clinician_id, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [tenantId, facilityId, patientId, appointmentId || null, serviceId || null, clinicianId, notes || null]);
  return rows[0];
}

// ─── Audit ─────────────────────────────────────────────────────────────────────
async function listAuditLogs({ tenantId, facilityId }) {
  return q('SELECT * FROM audit_logs WHERE tenant_id=$1 AND facility_id=$2 ORDER BY seq ASC', [tenantId, facilityId]);
}

async function appendAuditLog({ tenantId, facilityId, actorUserId, actorRole, action, resourceType, resourceId, metadata }) {
  const rows = await q(`INSERT INTO audit_logs
    (tenant_id, facility_id, actor_user_id, actor_role, action, resource_type, resource_id, metadata_json)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
    RETURNING *`, [tenantId, facilityId, actorUserId || 'system', actorRole || 'system', action, resourceType, resourceId || null, JSON.stringify(metadata || {})]);
  return rows[0];
}

// ─── Inventory (static demo data, same as memoryAdapter) ─────────────────────
const DEMO_INVENTORY = {
  medspa: [
    {id:'ms01',name:'Botox Cosmetic 100U',brand:'Allergan/AbbVie',cat:'🧬 Neurotoxin',sku:'BTX-100U',unit:'Vial 100U',qty:12,reorder:4,cost:580,retail:0,lot:'AG-2024-B1',batch:'BTX-24-A',exp:'2025-06-30',status:'ok',notes:'Refrigerate 2-8°C'},
    {id:'ms02',name:'Juvederm Ultra Plus XC 1ml',brand:'Allergan',cat:'💉 Dermal Filler',sku:'JVD-UPXC-1ML',unit:'Syringe 1ml',qty:8,reorder:3,cost:180,retail:650,lot:'AG-2024-J1',batch:'FIL-24-A',exp:'2025-09-01',status:'ok',notes:''},
    {id:'ms03',name:'Restylane Lyft 1ml',brand:'Galderma',cat:'💉 Dermal Filler',sku:'RST-LYFT-1ML',unit:'Syringe 1ml',qty:6,reorder:3,cost:195,retail:700,lot:'GD-2024-R1',batch:'FIL-24-B',exp:'2025-08-15',status:'ok',notes:''},
    {id:'ms04',name:'Sculptra Aesthetic 150mg',brand:'Galderma',cat:'💉 Dermal Filler',sku:'SCPTR-150',unit:'Vial 150mg',qty:4,reorder:2,cost:325,retail:900,lot:'GD-2024-S1',batch:'FIL-24-C',exp:'2025-12-31',status:'ok',notes:'Reconstitute 48h prior'},
    {id:'ms05',name:'Dysport 300U',brand:'Ipsen',cat:'🧬 Neurotoxin',sku:'DYS-300U',unit:'Vial 300U',qty:5,reorder:2,cost:320,retail:0,lot:'IP-2024-D1',batch:'BTX-24-B',exp:'2025-07-31',status:'ok',notes:''},
    {id:'ms06',name:'Numbing Cream — LMX4 30g',brand:'Ferndale',cat:'🧴 Topicals',sku:'LMX4-30G',unit:'Tube 30g',qty:15,reorder:5,cost:22,retail:45,lot:'FN-2024-L1',batch:'TOP-24-A',exp:'2026-01-01',status:'ok',notes:''},
    {id:'ms07',name:'Hyaluronidase 1500IU',brand:'Vitrase',cat:'🧬 Neurotoxin',sku:'HYAL-1500',unit:'Vial',qty:4,reorder:2,cost:85,retail:0,lot:'VT-2024-H1',batch:'BTX-24-C',exp:'2025-10-31',status:'ok',notes:'Emergency reversal agent'},
    {id:'ms08',name:'HydraFacial Solution Kit',brand:'BeautyHealth',cat:'✨ Skin Treatments',sku:'HYDRA-KIT',unit:'Kit',qty:6,reorder:2,cost:120,retail:0,lot:'BH-2024-K1',batch:'SKN-24-A',exp:'2026-03-01',status:'ok',notes:''},
    {id:'ms09',name:'Syringes 1ml Luer-Lock — 100 Pack',brand:'BD',cat:'🔬 Injection Supplies',sku:'SYR-1ML-LL-100',unit:'Box 100',qty:10,reorder:3,cost:28,retail:0,lot:'BD-2024-S1',batch:'INJ-24-A',exp:'2027-01-01',status:'ok',notes:''},
    {id:'ms10',name:'Cannula 25G x 50mm — 10 Pack',brand:'TSK',cat:'🔬 Injection Supplies',sku:'CAN-25G-50-10',unit:'Pack 10',qty:8,reorder:3,cost:42,retail:0,lot:'TS-2024-C1',batch:'INJ-24-B',exp:'2027-01-01',status:'ok',notes:''}
  ],
  peptide_hrt: [
    {id:'ph01',name:'BPC-157 5mg Vial',brand:'Compounded',cat:'🧬 Peptide Therapy',sku:'BPC157-5MG',unit:'Vial 5mg',qty:15,reorder:5,cost:55,retail:180,lot:'CMP-2024-BP1',batch:'PEP-24-A',exp:'2025-12-31',status:'ok',notes:'Refrigerate 2-8°C'},
    {id:'ph02',name:'Sermorelin 9mg Vial',brand:'Compounded',cat:'🧬 Peptide Therapy',sku:'SERM-9MG',unit:'Vial 9mg',qty:12,reorder:4,cost:65,retail:220,lot:'CMP-2024-SE1',batch:'PEP-24-B',exp:'2025-11-30',status:'ok',notes:'GH secretagogue'},
    {id:'ph03',name:'Ipamorelin/CJC-1295 Blend Vial',brand:'Compounded',cat:'🧬 Peptide Therapy',sku:'IPA-CJC-BLD',unit:'Vial 10mg',qty:10,reorder:4,cost:75,retail:280,lot:'CMP-2024-IC1',batch:'PEP-24-C',exp:'2025-12-31',status:'ok',notes:''},
    {id:'ph04',name:'Testosterone Cypionate 200mg/ml (10ml Vial)',brand:'Compounded',cat:'⚗️ Hormone Replacement',sku:'TEST-CYP-200-10ML',unit:'Vial 10ml',qty:10,reorder:4,cost:68,retail:185,lot:'CMP-2024-TC1',batch:'HRT-24-A',exp:'2025-10-31',status:'ok',notes:'Refrigerate'},
    {id:'ph05',name:'Testosterone Cream 200mg/ml (100g)',brand:'Compounded',cat:'⚗️ Hormone Replacement',sku:'TEST-CRM-200',unit:'Tube 100g',qty:8,reorder:3,cost:55,retail:145,lot:'CMP-2024-TCR1',batch:'HRT-24-B',exp:'2025-10-31',status:'ok',notes:'Transdermal'},
    {id:'ph06',name:'DHEA 50mg Capsules (60 Cap)',brand:'Compounded',cat:'⚗️ Hormone Replacement',sku:'DHEA-50MG-60C',unit:'Bottle 60 Caps',qty:10,reorder:4,cost:22,retail:55,lot:'CMP-2024-D1',batch:'HRT-24-C',exp:'2026-04-01',status:'ok',notes:''},
    {id:'ph07',name:'Progesterone 200mg Capsules (30 Cap)',brand:'Compounded',cat:'⚗️ Hormone Replacement',sku:'PROG-200MG-30C',unit:'Bottle 30 Caps',qty:8,reorder:3,cost:38,retail:85,lot:'CMP-2024-PR1',batch:'HRT-24-D',exp:'2026-02-28',status:'ok',notes:'Bioidentical'},
    {id:'ph08',name:'Syringes 1ml + Needles Kit — 50 Pack',brand:'BD',cat:'🔬 Injection Supplies',sku:'SYR-NDL-KIT-50',unit:'Box 50',qty:12,reorder:4,cost:32,retail:0,lot:'BD-2024-SN1',batch:'INJ-24-A',exp:'2027-01-01',status:'ok',notes:''},
    {id:'ph09',name:'Bacteriostatic Water 30ml',brand:'Hospira',cat:'🔬 Injection Supplies',sku:'BACT-H2O-30ML',unit:'Vial 30ml',qty:15,reorder:5,cost:18,retail:0,lot:'HO-2024-B1',batch:'INJ-24-B',exp:'2026-06-01',status:'ok',notes:'Peptide reconstitution'},
    {id:'ph10',name:'Thymosin Beta-4 (TB-500) 5mg Vial',brand:'Compounded',cat:'🧬 Peptide Therapy',sku:'TB500-5MG',unit:'Vial 5mg',qty:8,reorder:3,cost:72,retail:240,lot:'CMP-2024-TB1',batch:'PEP-24-D',exp:'2025-12-31',status:'ok',notes:'Recovery peptide'},
    {id:'ph11',name:'Lab Order Kit — Hormone Panel',brand:'LabCorp',cat:'🩸 Lab Supplies',sku:'LAB-HRM-KIT',unit:'Kit',qty:20,reorder:8,cost:12,retail:0,lot:'LC-2024-L1',batch:'LAB-24-A',exp:'',status:'ok',notes:'Test requisition pads'},
    {id:'ph12',name:'Estradiol Cypionate 5mg/ml (5ml Vial)',brand:'Compounded',cat:'⚗️ Hormone Replacement',sku:'ESTR-CYP-5-5ML',unit:'Vial 5ml',qty:6,reorder:2,cost:55,retail:140,lot:'CMP-2024-EC1',batch:'HRT-24-E',exp:'2025-10-31',status:'ok',notes:'Female HRT'},
    {id:'ph13',name:'Alcohol Wipes — 100 Pack',brand:'BD',cat:'🧤 Disposables & PPE',sku:'ALCWIPE-100',unit:'Box 100',qty:12,reorder:4,cost:8,retail:0,lot:'BD-2024-AW1',batch:'PPE-24-A',exp:'2027-01-01',status:'ok',notes:''},
    {id:'ph14',name:'Sharps Container 1.4L',brand:'BD',cat:'🧤 Disposables & PPE',sku:'SHARP-1.4L',unit:'Unit',qty:6,reorder:2,cost:5,retail:0,lot:'BD-2024-SC1',batch:'PPE-24-B',exp:'',status:'ok',notes:''},
    {id:'ph15',name:'MK-677 (Ibutamoren) 25mg Capsules (30 Cap)',brand:'Compounded',cat:'🧬 Peptide Therapy',sku:'MK677-25MG-30C',unit:'Bottle 30 Caps',qty:8,reorder:3,cost:45,retail:130,lot:'CMP-2024-MK1',batch:'PEP-24-E',exp:'2026-03-01',status:'ok',notes:'Oral GH secretagogue'}
  ],
  barber: [
    {id:'bb01',name:'Clippers — Wahl Senior',brand:'Wahl',cat:'✂️ Cutting Equipment',sku:'CLIP-WAHL-SR',unit:'Unit',qty:4,reorder:2,cost:75,retail:0,lot:'WH-2024-C1',batch:'EQ-24-A',exp:'',status:'ok',notes:''},
    {id:'bb02',name:'Clippers — Andis Master',brand:'Andis',cat:'✂️ Cutting Equipment',sku:'CLIP-AND-MST',unit:'Unit',qty:3,reorder:1,cost:90,retail:0,lot:'AN-2024-C1',batch:'EQ-24-B',exp:'',status:'ok',notes:''},
    {id:'bb03',name:'Shaving Cream — Classic Lather 400g',brand:'Taylor of Old Bond Street',cat:'🪒 Shave Supplies',sku:'SHAVE-CRM-400',unit:'Tub 400g',qty:10,reorder:4,cost:22,retail:38,lot:'TB-2024-S1',batch:'SH-24-A',exp:'2026-09-01',status:'ok',notes:''},
    {id:'bb04',name:'Beard Oil — Cedarwood 60ml',brand:'Beardbrand',cat:'🧔 Beard Care',sku:'BRDOIL-CED-60',unit:'Bottle 60ml',qty:15,reorder:5,cost:16,retail:30,lot:'BB-2024-O1',batch:'BC-24-A',exp:'2026-08-01',status:'ok',notes:'Best seller'},
    {id:'bb05',name:'Pomade — High Hold 120g',brand:'Layrite',cat:'💈 Styling Products',sku:'POM-HH-120',unit:'Jar 120g',qty:18,reorder:6,cost:14,retail:26,lot:'LY-2024-P1',batch:'ST-24-A',exp:'2027-01-01',status:'ok',notes:'Top seller'},
    {id:'bb06',name:'Neck Strips — 5 Rolls',brand:'Fromm',cat:'🧤 Disposables & PPE',sku:'NECK-5R',unit:'Pack 5 Rolls',qty:10,reorder:3,cost:12,retail:0,lot:'FR-2024-N1',batch:'PPE-24-A',exp:'',status:'ok',notes:''},
    {id:'bb07',name:'Aftershave Balm 150ml',brand:'Proraso',cat:'🪒 Shave Supplies',sku:'AFTSV-BAL-150',unit:'Bottle 150ml',qty:12,reorder:4,cost:14,retail:28,lot:'PR-2024-A1',batch:'SH-24-C',exp:'2026-11-01',status:'ok',notes:''},
    {id:'bb08',name:'Clipper Oil 120ml',brand:'Andis',cat:'✂️ Cutting Equipment',sku:'CLIP-OIL-120',unit:'Bottle 120ml',qty:6,reorder:2,cost:8,retail:0,lot:'AN-2024-OIL1',batch:'EQ-24-D',exp:'',status:'ok',notes:''}
  ],
  salon: [
    {id:'hs01',name:'Permanent Hair Color — Redken',brand:'Redken',cat:'🎨 Color & Lightener',sku:'CLR-REK',unit:'Pack 12',qty:5,reorder:2,cost:85,retail:0,lot:'RK-2024-C1',batch:'CLR-24-A',exp:'2026-06-01',status:'ok',notes:''},
    {id:'hs02',name:'Toner — Redken Shades EQ',brand:'Redken',cat:'🎨 Color & Lightener',sku:'TON-REK-SEQ',unit:'Pack 6',qty:4,reorder:2,cost:65,retail:0,lot:'RK-2024-T1',batch:'CLR-24-B',exp:'2026-06-01',status:'ok',notes:''},
    {id:'hs03',name:'Balayage Lightener Powder 500g',brand:'Wella',cat:'🎨 Color & Lightener',sku:'BLAY-PWDR-500',unit:'Bag 500g',qty:6,reorder:2,cost:42,retail:0,lot:'WE-2024-B1',batch:'CLR-24-C',exp:'2026-09-01',status:'ok',notes:''},
    {id:'hs04',name:'Developer 20-Vol 1L',brand:'Wella',cat:'🎨 Color & Lightener',sku:'DEV-20V-1L',unit:'Bottle 1L',qty:8,reorder:3,cost:18,retail:0,lot:'WE-2024-D1',batch:'CLR-24-D',exp:'2026-12-01',status:'ok',notes:''},
    {id:'hs05',name:'Shampoo — Kerastase Bain Satin 1L',brand:'Kerastase',cat:'🧴 Retail Products',sku:'SHP-KER-1L',unit:'Bottle 1L',qty:6,reorder:2,cost:45,retail:88,lot:'KE-2024-S1',batch:'RET-24-A',exp:'2026-08-01',status:'ok',notes:''}
  ],
  spa: [
    {id:'sp01',name:'Massage Oil — Lavender 1L',brand:'Biotone',cat:'💆 Massage Supplies',sku:'MASS-LAV-1L',unit:'Bottle 1L',qty:8,reorder:3,cost:22,retail:45,lot:'BT-2024-A1',batch:'SP-24-A',exp:'2026-06-01',status:'ok',notes:'Best seller'},
    {id:'sp02',name:'Hot Stone Set (45 Basalt Stones)',brand:'InSPAration',cat:'🪨 Hot Stone Therapy',sku:'STONE-45',unit:'Set',qty:4,reorder:2,cost:85,retail:0,lot:'IS-2024-S1',batch:'HS-24-A',exp:'',status:'ok',notes:''},
    {id:'sp03',name:'Hydrating Facial Mask — 30 Pack',brand:'Éminence Organic',cat:'✨ Facial Supplies',sku:'MASK-CLAY-30',unit:'Pack 30',qty:4,reorder:2,cost:65,retail:0,lot:'EM-2024-M1',batch:'FA-24-B',exp:'2025-12-31',status:'ok',notes:''},
    {id:'sp04',name:'Exfoliating Body Scrub 1kg',brand:'Cuccio',cat:'🛁 Body Treatment',sku:'SCRUB-1KG',unit:'Container 1kg',qty:6,reorder:2,cost:38,retail:72,lot:'CU-2024-B1',batch:'BT-24-A',exp:'2026-03-01',status:'ok',notes:''},
    {id:'sp05',name:'Aromatherapy Essential Oil — Eucalyptus 100ml',brand:'Edens Garden',cat:'🌿 Aromatherapy',sku:'AROM-EUC-100',unit:'Bottle 100ml',qty:10,reorder:4,cost:15,retail:28,lot:'EG-2024-A1',batch:'AR-24-A',exp:'2027-01-01',status:'ok',notes:''}
  ],
  clinic: [
    {id:'cl01',name:'Exam Gloves — Nitrile Medium 100/box',brand:'Kimberly-Clark',cat:'🧤 PPE & Exam Supplies',sku:'GLV-NIT-M-100',unit:'Box 100',qty:15,reorder:5,cost:12,retail:0,lot:'KC-2024-G1',batch:'PPE-24-A',exp:'2027-01-01',status:'ok',notes:''},
    {id:'cl02',name:'Blood Pressure Cuff — Adult',brand:'Omron',cat:'🔧 Equipment',sku:'BP-CUFF-ADU',unit:'Unit',qty:4,reorder:2,cost:65,retail:0,lot:'OM-2024-B1',batch:'EQ-24-A',exp:'',status:'ok',notes:''},
    {id:'cl03',name:'Tongue Depressors — 500/box',brand:'Puritan',cat:'🧤 PPE & Exam Supplies',sku:'TONG-DEP-500',unit:'Box 500',qty:8,reorder:3,cost:8,retail:0,lot:'PU-2024-T1',batch:'PPE-24-B',exp:'',status:'ok',notes:''},
    {id:'cl04',name:'Flu Rapid Test Kit — 25 Tests',brand:'QuickVue',cat:'🩺 Diagnostics',sku:'FLU-TEST-25',unit:'Pack 25',qty:5,reorder:2,cost:85,retail:0,lot:'QV-2024-F1',batch:'DX-24-A',exp:'2025-10-31',status:'ok',notes:''},
    {id:'cl05',name:'Surgical Masks — 50 Pack',brand:'3M',cat:'🧤 PPE & Exam Supplies',sku:'MASK-SURG-50',unit:'Pack 50',qty:20,reorder:8,cost:14,retail:0,lot:'3M-2024-M1',batch:'PPE-24-C',exp:'2027-01-01',status:'ok',notes:''}
  ],
  fitness: [
    {id:'ft01',name:'Resistance Bands Set (5 Levels)',brand:'TheraBand',cat:'💪 Training Equipment',sku:'RES-BAND-5',unit:'Set',qty:8,reorder:3,cost:28,retail:55,lot:'TB-2024-R1',batch:'EQ-24-A',exp:'',status:'ok',notes:''},
    {id:'ft02',name:'Foam Roller 36"',brand:'GRID',cat:'💪 Training Equipment',sku:'FOAM-36',unit:'Unit',qty:6,reorder:2,cost:35,retail:65,lot:'GR-2024-F1',batch:'EQ-24-B',exp:'',status:'ok',notes:''},
    {id:'ft03',name:'Yoga Mat 6mm',brand:'Manduka',cat:'🧘 Yoga Supplies',sku:'MAT-6MM',unit:'Unit',qty:10,reorder:4,cost:55,retail:95,lot:'MN-2024-M1',batch:'YOG-24-A',exp:'',status:'ok',notes:''},
    {id:'ft04',name:'Protein Powder — Whey Vanilla 2lb',brand:'Optimum Nutrition',cat:'🥤 Supplements',sku:'PROT-WHY-V-2',unit:'Container 2lb',qty:8,reorder:3,cost:32,retail:55,lot:'ON-2024-P1',batch:'SUP-24-A',exp:'2026-06-01',status:'ok',notes:''},
    {id:'ft05',name:'Disinfectant Spray — 32oz',brand:'Lysol',cat:'🧼 Cleaning Supplies',sku:'DIS-SPR-32',unit:'Bottle 32oz',qty:12,reorder:4,cost:8,retail:0,lot:'LY-2024-D1',batch:'CLN-24-A',exp:'2026-12-01',status:'ok',notes:''}
  ]
};
DEMO_INVENTORY.barbershop  = DEMO_INVENTORY.barber;
DEMO_INVENTORY.hair_salon  = DEMO_INVENTORY.salon;
DEMO_INVENTORY.day_spa     = DEMO_INVENTORY.spa;
DEMO_INVENTORY.esthetics   = DEMO_INVENTORY.clinic;
DEMO_INVENTORY.weight_loss = DEMO_INVENTORY.fitness;
DEMO_INVENTORY.nail_salon  = DEMO_INVENTORY.spa;

async function listInventory({ industry }) {
  const key = industry || 'medspa';
  return DEMO_INVENTORY[key] || DEMO_INVENTORY.medspa;
}

module.exports = {
  getUserByToken,
  getUserByUsername,
  getUserByEmail,
  getUserById,
  createUser,
  updateUserIndustry,
  getUserIndustry,
  saveRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  listProviders,
  getProvider,
  listInventory,
  listPatients,
  createPatient,
  listAppointments,
  createAppointment,
  reassignAppointment,
  seedDemoAppointments,
  listEventTriggers,
  listEncounters,
  createEncounter,
  listAuditLogs,
  appendAuditLog
};
