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
async function listPatients({ tenantId, facilityId }) {
  return q('SELECT * FROM patients WHERE tenant_id=$1 AND facility_id=$2 ORDER BY created_at DESC', [tenantId, facilityId]);
}

async function createPatient({ tenantId, facilityId, mrn, firstName, lastName, dob }) {
  const rows = await q(`INSERT INTO patients (tenant_id, facility_id, mrn, first_name, last_name, dob)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [tenantId, facilityId, mrn, firstName, lastName, dob]);
  return rows[0];
}

// ─── Appointments ─────────────────────────────────────────────────────────────
async function listAppointments({ tenantId, facilityId }) {
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
