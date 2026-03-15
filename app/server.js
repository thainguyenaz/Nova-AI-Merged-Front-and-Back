require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const path = require('path');
const { repo, driver } = require('./db');

console.log('[Server] DB Driver:', driver);

const { requireAuth } = require('./middleware/auth');
const { requireContext } = require('./middleware/context');
const { secureRequestLogger } = require('./middleware/secureLogger');

const authRoutes = require('./modules/auth/authRoutes');
const patientRoutes = require('./modules/patients/patientRoutes');
const appointmentRoutes = require('./modules/appointments/appointmentRoutes');
const encounterRoutes = require('./modules/encounters/encounterRoutes');
const catalogRoutes = require('./modules/catalog/catalogRoutes');
const auditRoutes = require('./modules/audit/auditRoutes');
const industryRoutes = require('./modules/industry/industryRoutes');
const integrationRoutes = require('./modules/integrations/integrationRoutes');
const onboardingRoutes = require('./modules/onboarding/onboardingRoutes');
const inventoryRoutes = require('./modules/inventory/inventoryRoutes');

const app = express();
app.use(express.json({ limit: '1mb' }));

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Tenant-Id, X-Facility-Id, X-Nova-Industry');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ========== SERVE FRONTEND STATIC FILES FIRST ==========
const frontendPath = path.join(__dirname, '../public-frontend');
app.use(express.static(frontendPath));

// ========== HEALTH ENDPOINTS ==========
app.get('/health', (req, res) => res.json({ ok: true, service: 'nova-merged', version: '0.1.0' }));
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'nova-merged', version: '0.1.0' }));

// ========== API ROUTES ==========
app.use('/api/auth', authRoutes);
// Industry routes are public (no auth required — needed for selector UI)
app.use('/api/industry', industryRoutes);
// Integration status routes are admin/ops endpoints — no PHI, mounted before requireAuth
app.use('/api/integrations', integrationRoutes);
// Onboarding wizard — public, pre-auth flow for new tenant setup
app.use('/api/onboarding', onboardingRoutes);
app.use('/api', requireAuth, requireContext, secureRequestLogger);
app.use('/api/catalog', catalogRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/encounters', encounterRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/inventory', inventoryRoutes);

// ========== CALENDAR PAGE ROUTE ================================
app.get('/calendar', (req, res) => {
  res.sendFile(path.join(frontendPath, 'calendar.html'));
});

// ========== FALLBACK TO FRONTEND (React Router) ==========
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ========== ERROR HANDLER ==========
app.use((err, req, res, next) => {
  console.error('server_error', err.message);
  res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
});

const port = Number(process.env.PORT || 3002);
app.listen(port, () => console.log(`✅ Nova MERGED (frontend + backend) listening on :${port}`));
