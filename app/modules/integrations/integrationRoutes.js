/**
 * integrationRoutes.js
 * Routes for API connection testing dashboard.
 * Mounted at: /api/integrations
 */

const express = require('express');
const router = express.Router();
const {
  testAll,
  testQBO,
  testTwilio,
  testMailchimp,
  testGoogleBusiness,
  testOpenAI,
} = require('./integrationService');

// Rate-limit guard: track last call per integration (in-memory, per process)
const lastCall = {};
const MIN_INTERVAL_MS = 5000; // 5s between calls per integration

function rateGuard(key, fn) {
  return async (req, res) => {
    const now = Date.now();
    if (lastCall[key] && now - lastCall[key] < MIN_INTERVAL_MS) {
      return res.status(429).json({ error: 'Too many requests. Wait 5 seconds between tests.' });
    }
    lastCall[key] = now;
    try {
      const result = await fn();
      res.json(result);
    } catch (err) {
      res.status(500).json({ ok: false, status: 'EXCEPTION', message: err.message });
    }
  };
}

// ── GET /api/integrations/status ──
// Returns status of all integrations at once
router.get('/status', rateGuard('all', testAll));

// ── POST /api/integrations/test/:service ──
// Test a single integration by name
router.post('/test/:service', async (req, res) => {
  const { service } = req.params;
  const now = Date.now();
  const key = `single_${service}`;

  if (lastCall[key] && now - lastCall[key] < MIN_INTERVAL_MS) {
    return res.status(429).json({ error: 'Too many requests. Wait 5 seconds between tests.' });
  }
  lastCall[key] = now;

  const testers = {
    qbo:            testQBO,
    twilio:         testTwilio,
    mailchimp:      testMailchimp,
    googlebusiness: testGoogleBusiness,
    openai:         testOpenAI,
  };

  const tester = testers[service.toLowerCase()];
  if (!tester) {
    return res.status(404).json({ error: `Unknown service: ${service}. Valid: qbo, twilio, mailchimp, googlebusiness, openai` });
  }

  try {
    const result = await tester();
    res.json({ timestamp: new Date().toISOString(), service, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, status: 'EXCEPTION', message: err.message });
  }
});

// ── GET /api/integrations/credentials ──
// Documents required env vars for each integration (no secrets exposed)
router.get('/credentials', (req, res) => {
  res.json({
    integrations: [
      {
        name: 'QuickBooks Online (QBO)',
        key: 'qbo',
        required_env_vars: [
          { var: 'QBO_CLIENT_ID',     description: 'OAuth2 Client ID from Intuit Developer portal' },
          { var: 'QBO_CLIENT_SECRET', description: 'OAuth2 Client Secret from Intuit Developer portal' },
          { var: 'QBO_REALM_ID',      description: 'Company ID / Realm ID from QBO (visible in URL when logged in)' },
          { var: 'QBO_ACCESS_TOKEN',  description: 'OAuth2 Access Token (short-lived, must be refreshed)' },
        ],
        optional_env_vars: [
          { var: 'QBO_REFRESH_TOKEN', description: 'OAuth2 Refresh Token for renewing access tokens' },
          { var: 'QBO_SANDBOX',       description: 'Set to "true" to use sandbox.quickbooks.api.intuit.com' },
        ],
        docs: 'https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0',
        setup_notes: 'Create an app at https://developer.intuit.com. Use Authorization Code flow. Tokens expire ~1 hour; use refresh token to renew.',
      },
      {
        name: 'Twilio',
        key: 'twilio',
        required_env_vars: [
          { var: 'TWILIO_ACCOUNT_SID', description: 'Account SID from Twilio Console dashboard' },
          { var: 'TWILIO_AUTH_TOKEN',  description: 'Auth Token from Twilio Console dashboard' },
        ],
        optional_env_vars: [
          { var: 'TWILIO_FROM_NUMBER', description: 'Verified Twilio phone number for sending SMS/calls' },
          { var: 'TWILIO_MESSAGING_SERVICE_SID', description: 'Messaging Service SID (if using pools/campaigns)' },
        ],
        docs: 'https://www.twilio.com/docs/usage/api',
        setup_notes: 'Find Account SID + Auth Token at https://console.twilio.com. For production, consider using API Keys instead of Auth Token.',
      },
      {
        name: 'Mailchimp',
        key: 'mailchimp',
        required_env_vars: [
          { var: 'MAILCHIMP_API_KEY', description: 'API Key from Mailchimp Account > Extras > API keys. Format: <key>-<datacenter> e.g. abc123-us6' },
        ],
        optional_env_vars: [
          { var: 'MAILCHIMP_LIST_ID',     description: 'Audience/List ID for default subscriber list' },
          { var: 'MAILCHIMP_SERVER_PREFIX', description: 'Datacenter prefix (auto-extracted from API key, e.g. us6)' },
        ],
        docs: 'https://mailchimp.com/developer/marketing/api/',
        setup_notes: 'Generate API key at mailchimp.com > Account > Extras > API Keys. The datacenter (e.g. us6) is embedded in the key after the dash.',
      },
      {
        name: 'Google Business Profile',
        key: 'googlebusiness',
        required_env_vars: [
          { var: 'GOOGLE_BUSINESS_ACCESS_TOKEN', description: 'OAuth2 Access Token with scope: https://www.googleapis.com/auth/business.manage' },
        ],
        optional_env_vars: [
          { var: 'GOOGLE_BUSINESS_ACCOUNT_ID',   description: 'Google Business account ID (e.g. accounts/123456789)' },
          { var: 'GOOGLE_BUSINESS_LOCATION_ID',  description: 'Specific location ID for reviews/posts (e.g. locations/987654321)' },
          { var: 'GOOGLE_CLIENT_ID',             description: 'OAuth2 Client ID from Google Cloud Console' },
          { var: 'GOOGLE_CLIENT_SECRET',         description: 'OAuth2 Client Secret from Google Cloud Console' },
          { var: 'GOOGLE_REFRESH_TOKEN',         description: 'OAuth2 Refresh Token for renewing access tokens' },
        ],
        docs: 'https://developers.google.com/my-business/reference/rest',
        setup_notes: 'Enable "Business Profile API" + "My Business Account Management API" in Google Cloud Console. Use OAuth2 Authorization Code flow with scope: https://www.googleapis.com/auth/business.manage',
      },
      {
        name: 'OpenAI',
        key: 'openai',
        required_env_vars: [
          { var: 'OPENAI_API_KEY', description: 'API Key from https://platform.openai.com/api-keys. Format: sk-...' },
        ],
        optional_env_vars: [
          { var: 'OPENAI_ORG_ID',     description: 'Organization ID for billing separation (optional)' },
          { var: 'OPENAI_MODEL',      description: 'Default model to use (e.g. gpt-4o, gpt-4o-mini)' },
          { var: 'OPENAI_MAX_TOKENS', description: 'Default max tokens per completion' },
        ],
        docs: 'https://platform.openai.com/docs/api-reference',
        setup_notes: 'Create API key at platform.openai.com. Add billing and usage limits. Never commit the key — use environment variables or a secrets manager.',
      },
    ],
  });
});

module.exports = router;
