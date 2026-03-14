const { randomUUID, createHash } = require('crypto');

function now() { return new Date().toISOString(); }

const state = {
  tenants: [{ id: 'tenant-a', name: 'Tenant A', created_at: now() }],
  facilities: [{ id: 'facility-main', tenant_id: 'tenant-a', name: 'Main Facility', created_at: now() }],
  roles: [
    { id: 'role-admin', code: 'admin', name: 'Administrator' },
    { id: 'role-clinician', code: 'clinician', name: 'Clinician' },
    { id: 'role-scheduler', code: 'scheduler', name: 'Scheduler' }
  ],
  users: [
    { id: 'u-admin', tenant_id: 'tenant-a', facility_id: 'facility-main', username: 'admin', token: 'admin-token', active: true },
    { id: 'u-clinician', tenant_id: 'tenant-a', facility_id: 'facility-main', username: 'clinician', token: 'clinician-token', active: true },
    { id: 'u-scheduler', tenant_id: 'tenant-a', facility_id: 'facility-main', username: 'scheduler', token: 'scheduler-token', active: true }
  ],
  user_roles: [
    { user_id: 'u-admin', role_code: 'admin' },
    { user_id: 'u-clinician', role_code: 'clinician' },
    { user_id: 'u-scheduler', role_code: 'scheduler' }
  ],
  services: [
    { id: 'svc-botox', tenant_id: 'tenant-a', facility_id: 'facility-main', code: 'BOTOX', name: 'Botox', business_type: 'injectables', active: true },
    { id: 'svc-hydrafacial', tenant_id: 'tenant-a', facility_id: 'facility-main', code: 'HYDRAFACIAL', name: 'HydraFacial', business_type: 'skin', active: true }
  ],
  patients: [],
  appointments: [],
  encounters: [],
  audit_logs: []
};

function withTimestamps(rec) {
  return { ...rec, created_at: now(), updated_at: now() };
}

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

async function listAppointments({ tenantId, facilityId }) {
  return state.appointments.filter(a => a.tenant_id === tenantId && a.facility_id === facilityId);
}

async function createAppointment({ tenantId, facilityId, patientId, startsAt, serviceId, status }) {
  const row = withTimestamps({
    id: randomUUID(), tenant_id: tenantId, facility_id: facilityId,
    patient_id: patientId, starts_at: startsAt, service_id: serviceId, status: status || 'booked'
  });
  state.appointments.push(row);
  return row;
}

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

module.exports = {
  getUserByToken,
  getUserByUsername,
  listPatients,
  createPatient,
  listAppointments,
  createAppointment,
  listEncounters,
  createEncounter,
  listAuditLogs,
  appendAuditLog
};
