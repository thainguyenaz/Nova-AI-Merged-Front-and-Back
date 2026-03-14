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

const app = express();
app.use(express.json({ limit: '1mb' }));

// ========== SERVE FRONTEND STATIC FILES FIRST ==========
const frontendPath = path.join(__dirname, '../public-frontend');
app.use(express.static(frontendPath));

// ========== HEALTH ENDPOINTS ==========
app.get('/health', (req, res) => res.json({ ok: true, service: 'nova-merged', version: '0.1.0' }));
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'nova-merged', version: '0.1.0' }));

// ========== API ROUTES ==========
app.use('/api/auth', authRoutes);
app.use('/api', requireAuth, requireContext, secureRequestLogger);
app.use('/api/catalog', catalogRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/encounters', encounterRoutes);
app.use('/api/audit-logs', auditRoutes);

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
