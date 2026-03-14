/**
 * Smoke test: Calendar Enhancements
 * Tests: login, providers, seed-demo, reassign, event-triggers
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASS = 'Nova2024!';

let passed = 0;
let failed = 0;
let token = null;

async function apiFetch(path, opts = {}) {
  const url = BASE_URL + path;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      'X-Tenant-Id': 'tenant-a',
      'X-Facility-Id': 'facility-main',
      ...(opts.headers || {})
    }
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json)}`);
  return json;
}

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}${detail ? ' — ' + detail : ''}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function run() {
  console.log(`\n🧪 Calendar Enhancement Smoke Test`);
  console.log(`   Target: ${BASE_URL}\n`);

  // 1. Health
  console.log('1. Health check');
  const health = await apiFetch('/api/health');
  assert('health ok', health.ok === true);

  // 2. Login
  console.log('2. Login as admin');
  const login = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS })
  });
  token = login.accessToken;
  assert('login returns token', !!token);
  assert('login returns role=admin', login.user?.role === 'admin', login.user?.role);

  // 3. Providers
  console.log('3. List Providers');
  const provs = await apiFetch('/api/appointments/providers');
  assert('returns 5 providers', provs.data.length === 5, `got ${provs.data.length}`);
  assert('providers have color', provs.data.every(p => p.color), 'all have color');
  assert('providers have avatar', provs.data.every(p => p.avatar), 'all have avatar');

  // 4. Seed Demo
  console.log('4. Seed Demo Appointments');
  const seed = await apiFetch('/api/appointments/seed-demo', { method: 'POST' });
  assert('seeded > 15 appointments', seed.data.seeded >= 15, `seeded=${seed.data.seeded}`);

  // 5. List Appointments
  console.log('5. List Appointments');
  const appts = await apiFetch('/api/appointments');
  assert('has appointments', appts.data.length > 0, `count=${appts.data.length}`);
  const firstAppt = appts.data[0];
  assert('appointments have patient_name', !!firstAppt.patient_name);
  assert('appointments have provider_name', !!firstAppt.provider_name);
  assert('appointments have service_name', !!firstAppt.service_name);
  assert('appointments have service_color', !!firstAppt.service_color);

  // 6. Reassign Appointment
  console.log('6. Reassign Appointment (Drag-Drop)');
  const targetAppt = appts.data[0];
  const providers = provs.data;
  const newProvider = providers.find(p => p.id !== targetAppt.provider_id);
  assert('found different provider to reassign to', !!newProvider);

  const reassign = await apiFetch(`/api/appointments/${targetAppt.id}/reassign`, {
    method: 'PATCH',
    body: JSON.stringify({ newProviderId: newProvider.id })
  });
  assert('reassign returns updated appt', !!reassign.data);
  assert('reassign updates provider_name', reassign.data.provider_name === newProvider.name, reassign.data.provider_name);
  assert('reassign meta has prevProvider', !!reassign.meta.prevProviderName);
  assert('reassign meta has newProvider', !!reassign.meta.newProviderName);

  // 7. Event Triggers
  console.log('7. Event Triggers (Email/SMS)');
  const triggers = await apiFetch('/api/appointments/event-triggers');
  assert('event triggers fired', triggers.data.length > 0, `count=${triggers.data.length}`);
  const hasEmail = triggers.data.some(t => t.type === 'email');
  const hasSms = triggers.data.some(t => t.type === 'sms');
  assert('email trigger fired', hasEmail);
  assert('sms trigger fired', hasSms);

  // 8. Calendar page accessible
  console.log('8. Calendar page route');
  const calRes = await fetch(BASE_URL + '/calendar');
  assert('calendar.html serves with 200', calRes.status === 200, `status=${calRes.status}`);
  const calHtml = await calRes.text();
  assert('calendar has drag-drop code', calHtml.includes('dragstart'), 'dragstart handler present');
  assert('calendar has reassign modal', calHtml.includes('reassignModal'), 'reassign modal present');
  assert('calendar has provider chips', calHtml.includes('provider-chip'), 'provider filter bar present');

  // Summary
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log(`🎉 All tests passed!\n`);
  } else {
    console.log(`⚠️  ${failed} test(s) failed\n`);
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
