// Maps X-Nova-Industry header values to the canonical tenant/facility for demo data
const INDUSTRY_CONTEXT_MAP = {
  medspa:      { tenantId: 'tenant-a',       facilityId: 'facility-main'    },
  barber:      { tenantId: 'tenant-barber',  facilityId: 'facility-barber'  },
  barbershop:  { tenantId: 'tenant-barber',  facilityId: 'facility-barber'  },
  salon:       { tenantId: 'tenant-salon',   facilityId: 'facility-salon'   },
  hair_salon:  { tenantId: 'tenant-salon',   facilityId: 'facility-salon'   },
  spa:         { tenantId: 'tenant-spa',     facilityId: 'facility-spa'     },
  day_spa:     { tenantId: 'tenant-spa',     facilityId: 'facility-spa'     },
  clinic:      { tenantId: 'tenant-clinic',  facilityId: 'facility-clinic'  },
  esthetics:   { tenantId: 'tenant-clinic',  facilityId: 'facility-clinic'  },
  fitness:     { tenantId: 'tenant-fitness', facilityId: 'facility-fitness' },
  weight_loss: { tenantId: 'tenant-fitness', facilityId: 'facility-fitness' },
  peptide_hrt: { tenantId: 'tenant-peptide', facilityId: 'facility-peptide' },
  nail_salon:  { tenantId: 'tenant-a',       facilityId: 'facility-main'    }
};

// Pre-seeded demo tenant IDs — these use the industry mapping (shared demo data)
const DEMO_TENANT_IDS = new Set([
  'tenant-a', 'tenant-barber', 'tenant-salon', 'tenant-spa',
  'tenant-clinic', 'tenant-fitness', 'tenant-peptide'
]);

function requireContext(req, res, next) {
  const industry = (req.header('x-nova-industry') || '').toLowerCase() || null;

  let tenantId = req.header('x-tenant-id');
  let facilityId = req.header('x-facility-id');

  // ── Real user with their own tenant (non-demo) ──────────────────────────────
  // If the JWT contains a tenantId that is NOT a pre-seeded demo tenant,
  // use the user's own tenant — do NOT redirect them to demo data.
  if (
    req.user &&
    req.user.tenantId &&
    !DEMO_TENANT_IDS.has(req.user.tenantId)
  ) {
    tenantId = req.user.tenantId;
    facilityId = req.user.facilityId || facilityId;
    console.log(`[Context] Real user tenant → tenant=${tenantId} facility=${facilityId}`);
  } else if (industry && INDUSTRY_CONTEXT_MAP[industry]) {
    // ── Demo / unauthenticated: map industry header to shared demo tenant ───
    const mapped = INDUSTRY_CONTEXT_MAP[industry];
    tenantId = mapped.tenantId;
    facilityId = mapped.facilityId;
    console.log(`[Context] X-Nova-Industry=${industry} → tenant=${tenantId} facility=${facilityId} (demo)`);
  }

  if (!tenantId || !facilityId) {
    return res.status(400).json({ error: 'TENANT_OR_FACILITY_MISSING' });
  }

  req.context = {
    tenantId,
    facilityId,
    industry: industry || null,
    userId: req.user?.userId || null,
    role: req.user?.role || null
  };

  // Also propagate role to req.user for RBAC middleware
  if (req.user && !req.user.role && req.context.role) {
    req.user.role = req.context.role;
  }

  next();
}

module.exports = { requireContext };
