/**
 * integrationService.js
 * Tests connectivity to external APIs: QBO, Twilio, Mailchimp, Google Business, OpenAI
 * Each tester returns: { ok: bool, status: string, message: string, latencyMs: number }
 */

const https = require('https');
const http = require('http');

/** Generic HTTP GET helper (no heavy deps required) */
function httpGet(urlStr, headers = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const url = new URL(urlStr);
    const lib = url.protocol === 'https:' ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: { 'User-Agent': 'Nova-Integration-Tester/1.0', ...headers },
      timeout: 8000,
    };
    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body, latencyMs: Date.now() - start }));
    });
    req.on('error', (err) => reject({ error: err.message, latencyMs: Date.now() - start }));
    req.on('timeout', () => { req.destroy(); reject({ error: 'Request timed out', latencyMs: Date.now() - start }); });
    req.end();
  });
}

/** Generic HTTP POST helper */
function httpPost(urlStr, bodyStr, headers = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const url = new URL(urlStr);
    const lib = url.protocol === 'https:' ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'User-Agent': 'Nova-Integration-Tester/1.0',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...headers,
      },
      timeout: 8000,
    };
    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body, latencyMs: Date.now() - start }));
    });
    req.on('error', (err) => reject({ error: err.message, latencyMs: Date.now() - start }));
    req.on('timeout', () => { req.destroy(); reject({ error: 'Request timed out', latencyMs: Date.now() - start }); });
    req.write(bodyStr);
    req.end();
  });
}

// ─────────────────────────────────────────────
// 1. QuickBooks Online (QBO)
// ─────────────────────────────────────────────
async function testQBO() {
  const clientId     = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  const realmId      = process.env.QBO_REALM_ID;
  const accessToken  = process.env.QBO_ACCESS_TOKEN;

  const missing = [];
  if (!clientId)     missing.push('QBO_CLIENT_ID');
  if (!clientSecret) missing.push('QBO_CLIENT_SECRET');
  if (!realmId)      missing.push('QBO_REALM_ID');
  if (!accessToken)  missing.push('QBO_ACCESS_TOKEN');
  if (missing.length) {
    return { ok: false, status: 'MISSING_CREDENTIALS', message: `Missing env vars: ${missing.join(', ')}`, latencyMs: 0 };
  }

  try {
    const env = process.env.QBO_SANDBOX === 'true' ? 'sandbox-quickbooks' : 'quickbooks';
    const url = `https://${env}.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}`;
    const result = await httpGet(url, { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' });
    if (result.statusCode === 200) {
      return { ok: true, status: 'CONNECTED', message: 'QBO API reachable and authorized', latencyMs: result.latencyMs };
    } else if (result.statusCode === 401) {
      return { ok: false, status: 'UNAUTHORIZED', message: 'QBO token invalid or expired. Refresh OAuth tokens.', latencyMs: result.latencyMs };
    } else {
      return { ok: false, status: `HTTP_${result.statusCode}`, message: `Unexpected status ${result.statusCode}`, latencyMs: result.latencyMs };
    }
  } catch (err) {
    return { ok: false, status: 'ERROR', message: err.error || String(err), latencyMs: err.latencyMs || 0 };
  }
}

// ─────────────────────────────────────────────
// 2. Twilio
// ─────────────────────────────────────────────
async function testTwilio() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;

  const missing = [];
  if (!accountSid) missing.push('TWILIO_ACCOUNT_SID');
  if (!authToken)  missing.push('TWILIO_AUTH_TOKEN');
  if (missing.length) {
    return { ok: false, status: 'MISSING_CREDENTIALS', message: `Missing env vars: ${missing.join(', ')}`, latencyMs: 0 };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const result = await httpGet(url, { Authorization: `Basic ${basicAuth}` });
    if (result.statusCode === 200) {
      const data = JSON.parse(result.body);
      return { ok: true, status: 'CONNECTED', message: `Twilio account active: ${data.friendly_name || accountSid}`, latencyMs: result.latencyMs };
    } else if (result.statusCode === 401) {
      return { ok: false, status: 'UNAUTHORIZED', message: 'Twilio credentials invalid.', latencyMs: result.latencyMs };
    } else {
      return { ok: false, status: `HTTP_${result.statusCode}`, message: `Unexpected status ${result.statusCode}`, latencyMs: result.latencyMs };
    }
  } catch (err) {
    return { ok: false, status: 'ERROR', message: err.error || String(err), latencyMs: err.latencyMs || 0 };
  }
}

// ─────────────────────────────────────────────
// 3. Mailchimp
// ─────────────────────────────────────────────
async function testMailchimp() {
  const apiKey = process.env.MAILCHIMP_API_KEY;

  if (!apiKey) {
    return { ok: false, status: 'MISSING_CREDENTIALS', message: 'Missing env var: MAILCHIMP_API_KEY', latencyMs: 0 };
  }

  // Extract datacenter from key format: <key>-<dc>
  const parts = apiKey.split('-');
  const dc = parts[parts.length - 1];
  if (!dc || dc === apiKey) {
    return { ok: false, status: 'INVALID_KEY_FORMAT', message: 'MAILCHIMP_API_KEY must be in format <key>-<datacenter> e.g. abc123-us6', latencyMs: 0 };
  }

  try {
    const url = `https://${dc}.api.mailchimp.com/3.0/ping`;
    const basicAuth = Buffer.from(`anystring:${apiKey}`).toString('base64');
    const result = await httpGet(url, { Authorization: `Basic ${basicAuth}` });
    if (result.statusCode === 200) {
      return { ok: true, status: 'CONNECTED', message: `Mailchimp API reachable (dc: ${dc})`, latencyMs: result.latencyMs };
    } else if (result.statusCode === 401) {
      return { ok: false, status: 'UNAUTHORIZED', message: 'Mailchimp API key invalid.', latencyMs: result.latencyMs };
    } else {
      return { ok: false, status: `HTTP_${result.statusCode}`, message: `Unexpected status ${result.statusCode}`, latencyMs: result.latencyMs };
    }
  } catch (err) {
    return { ok: false, status: 'ERROR', message: err.error || String(err), latencyMs: err.latencyMs || 0 };
  }
}

// ─────────────────────────────────────────────
// 4. Google Business Profile (My Business API)
// ─────────────────────────────────────────────
async function testGoogleBusiness() {
  const accessToken = process.env.GOOGLE_BUSINESS_ACCESS_TOKEN;
  const accountId   = process.env.GOOGLE_BUSINESS_ACCOUNT_ID;

  const missing = [];
  if (!accessToken) missing.push('GOOGLE_BUSINESS_ACCESS_TOKEN');
  if (missing.length) {
    return { ok: false, status: 'MISSING_CREDENTIALS', message: `Missing env vars: ${missing.join(', ')} (also needs GOOGLE_BUSINESS_ACCOUNT_ID optionally)`, latencyMs: 0 };
  }

  try {
    // List accounts endpoint — minimal permission check
    const url = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
    const result = await httpGet(url, { Authorization: `Bearer ${accessToken}` });
    if (result.statusCode === 200) {
      const data = JSON.parse(result.body);
      const count = (data.accounts || []).length;
      return { ok: true, status: 'CONNECTED', message: `Google Business API reachable. Found ${count} account(s).`, latencyMs: result.latencyMs };
    } else if (result.statusCode === 401) {
      return { ok: false, status: 'UNAUTHORIZED', message: 'Google Business token invalid or expired. Re-authorize OAuth.', latencyMs: result.latencyMs };
    } else if (result.statusCode === 403) {
      return { ok: false, status: 'FORBIDDEN', message: 'Google Business API access denied. Check OAuth scopes.', latencyMs: result.latencyMs };
    } else {
      return { ok: false, status: `HTTP_${result.statusCode}`, message: `Unexpected status ${result.statusCode}`, latencyMs: result.latencyMs };
    }
  } catch (err) {
    return { ok: false, status: 'ERROR', message: err.error || String(err), latencyMs: err.latencyMs || 0 };
  }
}

// ─────────────────────────────────────────────
// 5. OpenAI
// ─────────────────────────────────────────────
async function testOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return { ok: false, status: 'MISSING_CREDENTIALS', message: 'Missing env var: OPENAI_API_KEY', latencyMs: 0 };
  }

  try {
    const url = 'https://api.openai.com/v1/models';
    const result = await httpGet(url, { Authorization: `Bearer ${apiKey}` });
    if (result.statusCode === 200) {
      const data = JSON.parse(result.body);
      const modelCount = (data.data || []).length;
      return { ok: true, status: 'CONNECTED', message: `OpenAI API reachable. ${modelCount} model(s) accessible.`, latencyMs: result.latencyMs };
    } else if (result.statusCode === 401) {
      return { ok: false, status: 'UNAUTHORIZED', message: 'OpenAI API key invalid.', latencyMs: result.latencyMs };
    } else if (result.statusCode === 429) {
      return { ok: false, status: 'RATE_LIMITED', message: 'OpenAI rate limit hit. Key is valid but quota exceeded.', latencyMs: result.latencyMs };
    } else {
      return { ok: false, status: `HTTP_${result.statusCode}`, message: `Unexpected status ${result.statusCode}`, latencyMs: result.latencyMs };
    }
  } catch (err) {
    return { ok: false, status: 'ERROR', message: err.error || String(err), latencyMs: err.latencyMs || 0 };
  }
}

// ─────────────────────────────────────────────
// Run all tests
// ─────────────────────────────────────────────
async function testAll() {
  const [qbo, twilio, mailchimp, googleBusiness, openai] = await Promise.allSettled([
    testQBO(),
    testTwilio(),
    testMailchimp(),
    testGoogleBusiness(),
    testOpenAI(),
  ]);

  const unwrap = (r, name) => r.status === 'fulfilled' ? r.value : { ok: false, status: 'EXCEPTION', message: r.reason?.message || String(r.reason), latencyMs: 0 };

  return {
    timestamp: new Date().toISOString(),
    results: {
      qbo:            { name: 'QuickBooks Online', ...unwrap(qbo) },
      twilio:         { name: 'Twilio SMS/Voice', ...unwrap(twilio) },
      mailchimp:      { name: 'Mailchimp Email', ...unwrap(mailchimp) },
      googleBusiness: { name: 'Google Business Profile', ...unwrap(googleBusiness) },
      openai:         { name: 'OpenAI', ...unwrap(openai) },
    },
  };
}

module.exports = { testAll, testQBO, testTwilio, testMailchimp, testGoogleBusiness, testOpenAI };
