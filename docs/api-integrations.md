# Nova — API Integrations Guide

> **Dashboard URL:** `/integrations.html` (served from the app)  
> **API Endpoint:** `/api/integrations/status` (GET — test all)  
> **API Endpoint:** `/api/integrations/test/:service` (POST — test one)  
> **API Endpoint:** `/api/integrations/credentials` (GET — docs JSON)

---

## Overview

Nova integrates with 5 external APIs. Each integration has:
- A server-side connection tester (`app/modules/integrations/integrationService.js`)
- REST endpoints for triggering tests (`app/modules/integrations/integrationRoutes.js`)
- A live status dashboard (`public-frontend/integrations.html`)

---

## 1. QuickBooks Online (QBO)

**Purpose:** Billing, invoicing, payment tracking

| Env Var | Required | Description |
|---|---|---|
| `QBO_CLIENT_ID` | ✅ | OAuth2 Client ID from Intuit Developer portal |
| `QBO_CLIENT_SECRET` | ✅ | OAuth2 Client Secret from Intuit Developer portal |
| `QBO_REALM_ID` | ✅ | Company ID visible in QBO URL when logged in |
| `QBO_ACCESS_TOKEN` | ✅ | OAuth2 Access Token (expires ~1 hour) |
| `QBO_REFRESH_TOKEN` | optional | Used to renew access token without re-auth |
| `QBO_SANDBOX` | optional | Set `true` for sandbox/testing environment |

**Setup Steps:**
1. Create app at https://developer.intuit.com
2. Use Authorization Code OAuth2 flow
3. Request scopes: `com.intuit.quickbooks.accounting`
4. After auth, store both `access_token` and `refresh_token`
5. Implement token refresh before expiry (poll or check on each API call)

**Docs:** https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0

---

## 2. Twilio (SMS / Voice)

**Purpose:** SMS appointment reminders, patient notifications, 2FA

| Env Var | Required | Description |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | ✅ | Account SID from Twilio Console |
| `TWILIO_AUTH_TOKEN` | ✅ | Auth Token from Twilio Console |
| `TWILIO_FROM_NUMBER` | optional | Verified Twilio phone number (E.164 format: +1XXXXXXXXXX) |
| `TWILIO_MESSAGING_SERVICE_SID` | optional | Messaging Service SID for pools/A2P 10DLC campaigns |

**Setup Steps:**
1. Sign up at https://console.twilio.com
2. Find Account SID + Auth Token on the main dashboard
3. Buy a phone number or set up a Messaging Service
4. For production: Use API Keys instead of Auth Token (more secure)
5. For A2P 10DLC (US SMS): register Brand + Campaign before sending

**Docs:** https://www.twilio.com/docs/usage/api

---

## 3. Mailchimp (Email Marketing)

**Purpose:** Patient newsletters, promotions, automated email flows

| Env Var | Required | Description |
|---|---|---|
| `MAILCHIMP_API_KEY` | ✅ | API Key (format: `<key>-<datacenter>` e.g. `abc123-us6`) |
| `MAILCHIMP_LIST_ID` | optional | Default Audience/List ID for subscriptions |
| `MAILCHIMP_SERVER_PREFIX` | optional | Datacenter prefix, auto-extracted from key (e.g. `us6`) |

**Setup Steps:**
1. Log into Mailchimp → Account → Extras → API Keys
2. Click "Create A Key"
3. Copy the full key — the suffix after `-` is your datacenter (e.g. `-us6`)
4. Get your Audience ID: Audience → Settings → Audience name and defaults

**Docs:** https://mailchimp.com/developer/marketing/api/

---

## 4. Google Business Profile

**Purpose:** Review management, posting updates, location info

| Env Var | Required | Description |
|---|---|---|
| `GOOGLE_BUSINESS_ACCESS_TOKEN` | ✅ | OAuth2 Access Token with `business.manage` scope |
| `GOOGLE_CLIENT_ID` | optional | OAuth2 Client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | optional | OAuth2 Client Secret from Google Cloud Console |
| `GOOGLE_REFRESH_TOKEN` | optional | Refresh token for renewing access |
| `GOOGLE_BUSINESS_ACCOUNT_ID` | optional | Account ID (e.g. `accounts/123456789`) |
| `GOOGLE_BUSINESS_LOCATION_ID` | optional | Location ID for reviews/posts (e.g. `locations/987654321`) |

**Setup Steps:**
1. Go to https://console.cloud.google.com
2. Create a project, enable APIs:
   - **My Business Account Management API**
   - **My Business Business Information API**
   - **My Business Reviews API** (if needed)
3. Create OAuth2 credentials (Web Application type)
4. Authorize with scope: `https://www.googleapis.com/auth/business.manage`
5. Use OAuth Playground or custom flow to get tokens

**Docs:** https://developers.google.com/my-business/reference/rest

---

## 5. OpenAI

**Purpose:** AI features — chatbot, summaries, appointment assistant, notes drafting

| Env Var | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | ✅ | API Key from https://platform.openai.com/api-keys (format: `sk-...`) |
| `OPENAI_ORG_ID` | optional | Organization ID for billing separation |
| `OPENAI_MODEL` | optional | Default model (e.g. `gpt-4o`, `gpt-4o-mini`) |
| `OPENAI_MAX_TOKENS` | optional | Default max tokens per completion |

**Setup Steps:**
1. Create account at https://platform.openai.com
2. Add billing at https://platform.openai.com/account/billing
3. Create API key at https://platform.openai.com/api-keys
4. Set usage limits to avoid unexpected charges
5. Never commit the key — use env vars or a secrets manager

**Docs:** https://platform.openai.com/docs/api-reference

---

## Testing the Connections

### Via Dashboard (UI)
Open `/integrations.html` in your browser. Click **"⚡ Test Connection"** on any card, or **"↻ Test All"** to check all at once.

### Via API (curl)
```bash
# Test all integrations
curl http://localhost:3002/api/integrations/status

# Test a single integration
curl -X POST http://localhost:3002/api/integrations/test/qbo
curl -X POST http://localhost:3002/api/integrations/test/twilio
curl -X POST http://localhost:3002/api/integrations/test/mailchimp
curl -X POST http://localhost:3002/api/integrations/test/googlebusiness
curl -X POST http://localhost:3002/api/integrations/test/openai

# Get credentials documentation (JSON)
curl http://localhost:3002/api/integrations/credentials
```

### Response Format
```json
{
  "ok": true,
  "status": "CONNECTED",
  "message": "OpenAI API reachable. 42 model(s) accessible.",
  "latencyMs": 312
}
```

**Status values:**
| Status | Meaning |
|---|---|
| `CONNECTED` | ✅ Credentials valid, API reachable |
| `MISSING_CREDENTIALS` | ⚪ Env vars not set |
| `UNAUTHORIZED` | 🔴 Credentials invalid or expired |
| `RATE_LIMITED` | 🟡 Quota exceeded |
| `FORBIDDEN` | 🔴 Scope/permission missing |
| `ERROR` | 🔴 Network or unexpected error |

---

## Security Notes

- **Never commit credentials** to Git. All secrets go in `.env` (gitignored).
- **Never share tokens over chat/Slack.** Use a secrets manager for production.
- **Rotate tokens regularly.** OAuth tokens should use refresh flows.
- **Use sandbox environments** during development (`QBO_SANDBOX=true`).
- **Set usage limits** on OpenAI to cap spend.

---

*Generated by Jarvis — Nova Integration Agent 3*
