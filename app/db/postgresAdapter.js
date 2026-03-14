const { Pool } = require('pg');

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

async function listPatients({ tenantId, facilityId }) {
  return q('SELECT * FROM patients WHERE tenant_id=$1 AND facility_id=$2 ORDER BY created_at DESC', [tenantId, facilityId]);
}

async function createPatient({ tenantId, facilityId, mrn, firstName, lastName, dob }) {
  const rows = await q(`INSERT INTO patients (tenant_id, facility_id, mrn, first_name, last_name, dob)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [tenantId, facilityId, mrn, firstName, lastName, dob]);
  return rows[0];
}

async function listAppointments({ tenantId, facilityId }) {
  return q('SELECT * FROM appointments WHERE tenant_id=$1 AND facility_id=$2 ORDER BY starts_at ASC', [tenantId, facilityId]);
}

async function createAppointment({ tenantId, facilityId, patientId, startsAt, serviceId, status }) {
  const rows = await q(`INSERT INTO appointments (tenant_id, facility_id, patient_id, starts_at, service_id, status)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [tenantId, facilityId, patientId, startsAt, serviceId, status || 'booked']);
  return rows[0];
}

async function listEncounters({ tenantId, facilityId }) {
  return q('SELECT * FROM encounters WHERE tenant_id=$1 AND facility_id=$2 ORDER BY created_at DESC', [tenantId, facilityId]);
}

async function createEncounter({ tenantId, facilityId, patientId, appointmentId, serviceId, clinicianId, notes }) {
  const rows = await q(`INSERT INTO encounters (tenant_id, facility_id, patient_id, appointment_id, service_id, clinician_id, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [tenantId, facilityId, patientId, appointmentId || null, serviceId || null, clinicianId, notes || null]);
  return rows[0];
}

async function listAuditLogs({ tenantId, facilityId }) {
  return q('SELECT * FROM audit_logs WHERE tenant_id=$1 AND facility_id=$2 ORDER BY seq ASC', [tenantId, facilityId]);
}

async function appendAuditLog({ tenantId, facilityId, actorUserId, actorRole, action, resourceType, resourceId, metadata }) {
  const rows = await q(`INSERT INTO audit_logs
    (tenant_id, facility_id, actor_user_id, actor_role, action, resource_type, resource_id, metadata_json)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
    RETURNING *`, [tenantId, facilityId, actorUserId, actorRole, action, resourceType, resourceId || null, JSON.stringify(metadata || {})]);
  return rows[0];
}

async function getUserByEmail(email) {
  const rows = await q('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

async function getUserById(userId) {
  const rows = await q('SELECT * FROM users WHERE id = $1', [userId]);
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

// ── Onboarding (in-memory store — sessions are ephemeral, no PG table needed for v1) ──
const { randomUUID } = require('crypto');
const onboardingSessions = [];
function nowStr() { return new Date().toISOString(); }

async function createOnboardingSession({ userId }) {
  const session = {
    id: randomUUID(), user_id: userId || null, status: 'in_progress', current_step: 1,
    steps: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null },
    created_at: nowStr(), updated_at: nowStr(),
  };
  onboardingSessions.push(session);
  return session;
}

async function getOnboardingSession(id) {
  return onboardingSessions.find(s => s.id === id) || null;
}

async function updateOnboardingStep(id, step, data) {
  const session = onboardingSessions.find(s => s.id === id);
  if (!session) return null;
  session.steps[step] = data;
  session.current_step = Math.max(session.current_step, Number(step));
  session.updated_at = nowStr();
  return session;
}

async function finalizeOnboarding(id) {
  const session = onboardingSessions.find(s => s.id === id);
  if (!session) return null;
  const steps = session.steps;
  const companyInfo = steps[2] || {};
  const tenantId = randomUUID();
  const facilityId = randomUUID();
  // TODO: INSERT into tenants/facilities/users tables when schema is extended
  session.status = 'completed';
  session.completed_at = nowStr();
  session.provisioned = { tenantId, facilityId, staffCount: ((steps[4] || {}).staff || []).length };
  session.updated_at = nowStr();
  return {
    session, tenantId, facilityId,
    staffCount: session.provisioned.staffCount,
    demoDataLoaded: !!((steps[6] || {}).loadDemo),
  };
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
  listPatients,
  createPatient,
  listAppointments,
  createAppointment,
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
