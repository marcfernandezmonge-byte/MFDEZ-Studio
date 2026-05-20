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
const userServices             = require('../services/UserServices');

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
  const price = (snap.price !== undefined && snap.price !== null)
    ? `${snap.price}${snap.currency ? ' ' + snap.currency : ''}`
    : '';
  return {
    id:        req.id,
    name:      snap.name || 'Servicio',
    type:      'Oneshot',
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

    const services = [...legacyMarked, ...oneshots];
    console.log('[UserController] getServices →',
      `legacy=${legacyMarked.length} oneshots=${oneshots.length} total=${services.length}`);

    return res.json({ services });

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
        role:      u.role || 'user',
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
    return res.status(201).json(result);
  } catch (err) {
    const status = err.message.includes('activa') ? 409 : 500;
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
  getServices, getMembership,
  getAdminUsers, getAdminClubMembers, toggleClubMemberStatus,
  subscribeUser, getUserSubscription, cancelSubscription, deleteAccount,
};