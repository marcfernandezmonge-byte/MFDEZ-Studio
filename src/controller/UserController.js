'use strict';

/**
 * UserController.js
 * Controlador para rutas de usuario y admin.
 *
 * Usa req.user inyectado por requireAuth — NO extrae el token manualmente.
 * Eso era la causa del 500: UserServices._getUserFromAuthHeader()
 * hacía una segunda verificación que fallaba si el token ya venía validado.
 */

const userRepository           = require('../repository/UserRepository');
const serviceRepository        = require('../repository/ServiceRepository');
const serviceRequestRepository = require('../repository/ServiceRequestRepository');
const planRequestRepository    = require('../repository/PlanRequestRepository');
const userServices             = require('../services/UserServices');
const entitlementService       = require('../services/EntitlementService');
const authService              = require('../services/AuthService');

// Formato canónico de precios mostrados al usuario.
// Produce "€1.800", "€8.500 / temporada", "€15.000 / año" — idéntico al
// formato que se ve en /servicios. Todas las superficies (Mis Servicios,
// admin, snapshots) consumen este helper para garantizar consistencia.
function formatCatalogPrice(price, currency, interval) {
  if (price === undefined || price === null || price === '') return '';
  const numFmt = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 0,
  });
  const base = numFmt.format(price);
  // 'project' = entregable one-time → sin sufijo, igual que en /servicios.
  const INTERVAL_LABEL = { season: 'temporada', year: 'año', month: 'mes', project: null };
  const label = interval
    ? (INTERVAL_LABEL[interval] !== undefined ? INTERVAL_LABEL[interval] : interval)
    : null;
  return label ? `${base} / ${label}` : base;
}

// Mapea el estado interno de un serviceRequest al status que ve el frontend
// en la lista de "mis servicios". Mantiene el vocabulario existente
// (active/pending/...) para no romper el render legacy.
function mapOneshotStatus(status) {
  switch (status) {
    case 'approved':  return 'active';
    case 'completed': return 'completed';
    case 'pending':   return 'pending';
    case 'rejected':  return 'rejected';
    case 'cancelled': return 'cancelled';
    default:          return status || 'unknown';
  }
}

function oneshotToServiceShape(req) {
  const snap = req.serviceSnapshot || {};
  const price = formatCatalogPrice(snap.price, snap.currency, null);
  return {
    id:        req.id,
    name:      snap.name || 'Servicio',
    type:      'Servicio puntual',
    status:    mapOneshotStatus(req.status),
    price,
    startDate: req.decidedAt || req.requestedAt || null,
    endDate:   req.completedAt || null,
    events:    null,
    // Campos extra (no rompen al cliente legacy, sólo enriquecen)
    kind:        'oneshot',
    requestId:   req.id,
    requestedAt: req.requestedAt || null,
    decidedAt:   req.decidedAt || null,
    rawStatus:   req.status,
    notes:       req.notes || '',
  };
}

// Mapea el estado interno de un planRequest al vocabulario del frontend.
// planRequests usan 'active' para aprobado; aquí lo conservamos.
function mapPlanStatus(status) {
  switch (status) {
    case 'active':    return 'active';
    case 'completed': return 'completed';
    case 'pending':   return 'pending';
    case 'rejected':  return 'rejected';
    case 'cancelled': return 'cancelled';
    case 'expired':   return 'expired';
    default:          return status || 'unknown';
  }
}

function planRequestToServiceShape(req) {
  const snap = req.planSnapshot || {};
  const price = formatCatalogPrice(snap.price, snap.currency, snap.interval);
  return {
    id:        req.id,
    name:      snap.name || req.planCode || 'Plan',
    type:      'Plan principal',
    status:    mapPlanStatus(req.status),
    price,
    startDate: req.startDate || req.decidedAt || req.requestedAt || null,
    endDate:   req.endDate || req.completedAt || null,
    events:    null,
    kind:        'plan',
    requestId:   req.id,
    requestedAt: req.requestedAt || null,
    decidedAt:   req.decidedAt || null,
    rawStatus:   req.status,
    notes:       req.notes || '',
  };
}

// Estados de planRequest visibles en "Mis Servicios". Filtramos los
// terminales (rejected/cancelled/expired) para que no contaminen la lista
// activa; el panel de admin sigue mostrándolos como histórico.
const PLAN_VISIBLE_STATUSES = new Set(['pending', 'active', 'completed']);

// ══════════════════════════════════════════════════════════════════
//  GET /api/me
//  Devuelve la identidad autenticada con datos FRESCOS desde MongoDB.
//  El rol viene de la BD — el frontend NO debe inferirlo de localStorage.
//  Rol normalizado: cualquier valor ≠ 'admin' se devuelve como 'client'.
// ══════════════════════════════════════════════════════════════════
async function getMe(req, res) {
  console.log('[UserController] getMe → userId:', req.user.id);

  try {
    const user = await userRepository.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json({
      user: {
        id:           String(user.id || user._id),
        name:         user.name || user.username || 'Usuario',
        email:        user.email,
        role:         user.role === 'admin' ? 'admin' : 'client',
        isSubscribed: Boolean(user.isSubscribed),
      },
    });
  } catch (err) {
    console.error('[UserController] getMe → ERROR:', err.message);
    return res.status(500).json({ error: 'Error al obtener identidad', detail: err.message });
  }
}

// ══════════════════════════════════════════════════════════════════
//  GET /api/user/services
// ══════════════════════════════════════════════════════════════════
async function getServices(req, res) {
  console.log('[UserController] getServices → userId:', req.user.id);

  try {
    // 1. Servicios LEGACY de la colección `services` (formato y comportamiento
    //    intactos para no romper el frontend actual).
    const legacy = await serviceRepository.getServicesForUser(req.user.id);
    const legacyMarked = legacy.map((s) => ({ ...s, kind: s.kind || 'legacy' }));

    // 2. Servicios ONESHOT del usuario desde `serviceRequests`. Cualquier
    //    estado se incluye — los expirados/rechazados también, como histórico.
    let oneshots = [];
    try {
      const reqs = await serviceRequestRepository.findAllForUser(req.user.id);
      oneshots = reqs.map(oneshotToServiceShape);
    } catch (err) {
      // No queremos que un fallo en la nueva colección rompa el endpoint
      // legacy. Logueamos y seguimos con los servicios clásicos.
      console.error('[UserController] getServices → oneshots ERROR:', err.message);
    }

    // 3. PLANES PRINCIPALES (packs branding) del usuario desde `planRequests`.
    //    AGREGACIÓN DE PRESENTACIÓN: el frontend renderiza un único listado
    //    "Mis Servicios" que combina entitlements + servicios + planes.
    //    Aquí emitimos los planes con la MISMA shape que los oneshots para
    //    reusar el renderer existente — no se crean entitlements falsos,
    //    no se duplican colecciones, no se altera el flujo de aprobación.
    let plans = [];
    try {
      const planReqs = await planRequestRepository.findAllForUser(req.user.id);
      plans = planReqs
        .filter((r) => PLAN_VISIBLE_STATUSES.has(r.status))
        .map(planRequestToServiceShape);
    } catch (err) {
      console.error('[UserController] getServices → plans ERROR:', err.message);
    }

    // Orden de presentación: planes primero (compromiso de mayor duración),
    // luego servicios puntuales, luego histórico legacy.
    const services = [...plans, ...oneshots, ...legacyMarked];

    // 4. Entitlements derivados de servicios aprobados. Capa SEPARADA — no
    //    altera el array `services` y, si falla, no rompe la respuesta.
    let entitlements = [];
    try {
      entitlements = await entitlementService.listForUser(req.user.id);
    } catch (err) {
      console.error('[UserController] getServices → entitlements ERROR:', err.message);
    }

    console.log('[UserController] getServices →',
      `plans=${plans.length} oneshots=${oneshots.length} legacy=${legacyMarked.length} total=${services.length} entitlements=${entitlements.length}`);

    return res.json({ services, entitlements });

  } catch (err) {
    // Causa más común del 500: la colección "services" no existe en MongoDB
    // o getServicesForUser no acepta un string (esperaba el objeto User completo)
    console.error('[UserController] getServices → ERROR:', err.message, err.stack);
    return res.status(500).json({
      error: 'Error al obtener servicios',
      detail: err.message,
    });
  }
}

// ══════════════════════════════════════════════════════════════════
//  GET /api/user/membership
// ══════════════════════════════════════════════════════════════════
async function getMembership(req, res) {
  console.log('[UserController] getMembership → userId:', req.user.id);

  try {
    const membership = await userRepository.getMembershipByUserId(req.user.id);

    console.log('[UserController] getMembership → resultado:', membership
      ? { active: membership.active, plan: membership.plan }
      : 'null (usuario sin membresía)'
    );

    return res.json({ membership });

  } catch (err) {
    console.error('[UserController] getMembership → ERROR:', err.message, err.stack);
    return res.status(500).json({
      error: 'Error al obtener membresía',
      detail: err.message,
    });
  }
}

// ══════════════════════════════════════════════════════════════════
//  GET /api/admin/users
// ══════════════════════════════════════════════════════════════════
async function getAdminUsers(req, res) {
  console.log('[UserController] getAdminUsers → solicitado por:', req.user.email);

  try {
    const users = await userRepository.findAll();

    console.log('[UserController] getAdminUsers → total usuarios:', users.length);

    return res.json({
      users: users.map((u) => ({
        id:        String(u.id || u._id),
        name:      u.name || u.username || 'Usuario',
        email:     u.email,
        role:      u.role === 'admin' ? 'admin' : 'client',
        createdAt: u.createdAt,
        active:    u.active !== false,
      })),
    });

  } catch (err) {
    console.error('[UserController] getAdminUsers → ERROR:', err.message, err.stack);
    return res.status(500).json({ error: 'Error al obtener usuarios', detail: err.message });
  }
}

// ══════════════════════════════════════════════════════════════════
//  GET /api/admin/club-members
// ══════════════════════════════════════════════════════════════════
async function getAdminClubMembers(req, res) {
  console.log('[UserController] getAdminClubMembers');

  try {
    const users = await userRepository.findAll();

    const members = users.map((u) => {
      const b = u.billingInfo || {};
      const since   = b.since   || u.createdAt || new Date().toISOString();
      const renewal = b.renewal || addOneYear(since);

      return {
        id:      String(u.id || u._id),
        name:    u.name || u.username || 'Usuario',
        email:   u.email,
        plan:    b.plan    || "Collector's Club · 15€/mes",
        since,
        renewal,
        active:  Boolean(u.isSubscribed),
      };
    });

    const activeCount = members.filter((m) => m.active).length;

    console.log('[UserController] getAdminClubMembers → miembros activos:', activeCount);

    return res.json({ members, revenueMonth: activeCount * 15 });

  } catch (err) {
    console.error('[UserController] getAdminClubMembers → ERROR:', err.message, err.stack);
    return res.status(500).json({ error: 'Error al obtener miembros', detail: err.message });
  }
}

// ══════════════════════════════════════════════════════════════════
//  PATCH /api/admin/club-members/:id/toggle
// ══════════════════════════════════════════════════════════════════
async function toggleClubMemberStatus(req, res) {
  const { id }    = req.params;
  const { active } = req.body;

  console.log('[UserController] toggleClubMemberStatus → id:', id, 'active:', active);

  if (active === undefined) {
    return res.status(400).json({ error: 'Campo "active" requerido en el body' });
  }

  try {
    const updated = await userRepository.setMembershipStatus(id, Boolean(active));
    if (!updated) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json({
      member: {
        id:     String(updated.id || updated._id),
        name:   updated.name || updated.username || 'Usuario',
        active: Boolean(updated.isSubscribed),
      },
    });

  } catch (err) {
    console.error('[UserController] toggleClubMemberStatus → ERROR:', err.message);
    return res.status(500).json({ error: 'Error al actualizar membresía', detail: err.message });
  }
}

// ── Helper ──────────────────────────────────────────────────────
function addOneYear(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}

// ══════════════════════════════════════════════════════════════════
//  POST /api/user/subscribe
// ══════════════════════════════════════════════════════════════════
async function subscribeUser(req, res) {
  console.log('[UserController] subscribeUser → userId:', req.user.id);
  try {
    const result = await userServices.subscribeUser(req.user.id, req.body || {});
    let token = null;
    try {
      const refreshed = await authService.refreshTokenForUser(req.user.id);
      token = refreshed.token;
    } catch (e) {
      console.warn('[UserController] subscribeUser refreshToken →', e.message);
    }
    return res.status(201).json({ ...result, token });
  } catch (err) {
    // Respeta err.status si el service lo definió (p.ej. 402 Payment Required,
    // 409 Conflict). Solo cae al heurístico legacy si no hay status explícito.
    const status = Number.isInteger(err.status)
      ? err.status
      : (err.message && err.message.includes('activa') ? 409 : 500);
    return res.status(status).json({ error: err.message });
  }
}

// ══════════════════════════════════════════════════════════════════
//  GET /api/user/subscription
// ══════════════════════════════════════════════════════════════════
async function getUserSubscription(req, res) {
  console.log('[UserController] getUserSubscription → userId:', req.user.id);
  try {
    const result = await userServices.getUserSubscription(req.user.id);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ══════════════════════════════════════════════════════════════════
//  POST /api/user/cancel-subscription
// ══════════════════════════════════════════════════════════════════
async function cancelSubscription(req, res) {
  console.log('[UserController] cancelSubscription → userId:', req.user.id);
  try {
    const result = await userServices.cancelSubscription(req.user.id);
    return res.json(result);
  } catch (err) {
    const status = err.message.includes('activa') ? 409 : 500;
    return res.status(status).json({ error: err.message });
  }
}

// ══════════════════════════════════════════════════════════════════
//  PATCH /api/user/password
//  Cambio de contraseña del usuario autenticado.
//  Body: { currentPassword, newPassword }
// ══════════════════════════════════════════════════════════════════
async function changePassword(req, res) {
  console.log('[UserController] changePassword → userId:', req.user.id);

  const { currentPassword, newPassword } = req.body || {};

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'currentPassword y newPassword son obligatorios' });
  }
  if (!currentPassword.trim() || !newPassword.trim()) {
    return res.status(400).json({ error: 'Las contraseñas no pueden estar vacías' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual' });
  }

  try {
    const user = await userRepository.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const ok = await authService.comparePassword(currentPassword, user.password);
    if (!ok) return res.status(401).json({ error: 'La contraseña actual no es correcta' });

    const newHash = await authService.hashPassword(newPassword);
    const updated = await userRepository.updatePassword(req.user.id, newHash);
    if (!updated) return res.status(500).json({ error: 'No se pudo actualizar la contraseña' });

    return res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('[UserController] changePassword → ERROR:', err.message);
    return res.status(500).json({ error: 'Error al cambiar la contraseña', detail: err.message });
  }
}

// ══════════════════════════════════════════════════════════════════
//  DELETE /api/user/delete-account
// ══════════════════════════════════════════════════════════════════
async function deleteAccount(req, res) {
  console.log('[UserController] deleteAccount → userId:', req.user.id);
  try {
    const result = await userServices.deleteUser(req.user.id);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getMe,
  getServices, getMembership,
  getAdminUsers, getAdminClubMembers, toggleClubMemberStatus,
  subscribeUser, getUserSubscription, cancelSubscription, deleteAccount,
  changePassword,
};