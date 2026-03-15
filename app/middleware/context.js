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

function requireContext(req, res, next) {
  const industry = (req.header('x-nova-industry') || '').toLowerCase() || null;

  // If X-Nova-Industry provided, resolve tenant/facility from industry map
  let tenantId = req.header('x-tenant-id');
  let facilityId = req.header('x-facility-id');

  if (industry && INDUSTRY_CONTEXT_MAP[industry]) {
    const mapped = INDUSTRY_CONTEXT_MAP[industry];
    tenantId = mapped.tenantId;
    facilityId = mapped.facilityId;
    console.log(`[Context] X-Nova-Industry=${industry} → tenant=${tenantId} facility=${facilityId}`);
  }

  if (!tenantId || !facilityId) {
    return res.status(400).json({ error: 'TENANT_OR_FACILITY_MISSING' });
  }

  if (req.user && req.user.tenantId && (req.user.tenantId !== tenantId || req.user.facilityId !== facilityId)) {
    // Allow industry override even if JWT tenant doesn't match (demo mode)
    if (!industry) {
      return res.status(403).json({ error: 'CONTEXT_FORBIDDEN' });
    }
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
