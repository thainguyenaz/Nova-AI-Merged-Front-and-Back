const { spawn } = require('child_process');

const PORT = process.env.PORT || 3102;
const BASE = `http://127.0.0.1:${PORT}`;

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  return { status: res.status, body: await res.json() };
}

async function run() {
  const server = spawn('node', ['app/server.js'], {
    env: { ...process.env, PORT: String(PORT) },
    cwd: process.cwd(),
    stdio: 'inherit'
  });

  try {
    await wait(700);
    const health = await req('/health');
    if (health.status !== 200) throw new Error('health failed');

    const tokenRes = await req('/api/auth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin' })
    });

    const headers = {
      'content-type': 'application/json',
      authorization: `Bearer ${tokenRes.body.accessToken}`,
      'x-tenant-id': 'tenant-a',
      'x-facility-id': 'facility-main'
    };

    const catalog = await req('/api/catalog/business-types', { headers });
    if (catalog.status !== 200) throw new Error('catalog failed');

    const patient = await req('/api/patients', {
      method: 'POST',
      headers,
      body: JSON.stringify({ mrn: 'MRN-100', firstName: 'Jane', lastName: 'Doe', dob: '1991-01-01' })
    });
    if (patient.status !== 201) throw new Error('patient create failed');

    const audits = await req('/api/audit-logs', { headers });
    if (audits.status !== 200) throw new Error('audit list failed');

    console.log('SMOKE_TEST_PASS');
  } finally {
    server.kill('SIGTERM');
  }
}

run().catch(err => {
  console.error('SMOKE_TEST_FAIL', err.message);
  process.exit(1);
});
