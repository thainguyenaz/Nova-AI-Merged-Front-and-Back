module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Nova Medspa Backend API',
    version: '0.2.0',
    description: 'Tenant/facility scoped backend with PostgreSQL schema, strict route RBAC, and append-only tamper-evident audit logs.'
  },
  servers: [{ url: 'http://localhost:3002' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer' },
      tenantId: { type: 'apiKey', in: 'header', name: 'x-tenant-id' },
      facilityId: { type: 'apiKey', in: 'header', name: 'x-facility-id' }
    }
  },
  paths: {
    '/health': { get: { summary: 'Health check' } },
    '/api/auth/token': { post: { summary: 'Issue demo token by username from users table/adapter' } },
    '/api/catalog/business-types': { get: { summary: 'List medspa business types', security: [{ bearerAuth: [] }] } },
    '/api/catalog/services': { get: { summary: 'List services (filter by businessType)', security: [{ bearerAuth: [] }] } },
    '/api/patients': {
      get: { summary: 'List patients (admin|clinician|scheduler)', security: [{ bearerAuth: [] }] },
      post: { summary: 'Create patient (admin|clinician|scheduler)', security: [{ bearerAuth: [] }] }
    },
    '/api/appointments': {
      get: { summary: 'List appointments (admin|clinician|scheduler)', security: [{ bearerAuth: [] }] },
      post: { summary: 'Create appointment (admin|scheduler)', security: [{ bearerAuth: [] }] }
    },
    '/api/encounters': {
      get: { summary: 'List encounters (admin|clinician)', security: [{ bearerAuth: [] }] },
      post: { summary: 'Create encounter (admin|clinician)', security: [{ bearerAuth: [] }] }
    },
    '/api/audit-logs': {
      get: {
        summary: 'List append-only audit logs (admin only)',
        description: 'No update/delete endpoint. Rows are hash-chained and immutable.',
        security: [{ bearerAuth: [] }]
      }
    }
  }
};
