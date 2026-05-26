'use strict';

/**
 * @controller ServiceCatalogController
 *
 * HTTP layer para el catálogo de servicios ONESHOT y sus solicitudes.
 * NO toca la colección `services` legacy.
 */

const serviceCatalogService = require('../services/ServiceCatalogService');
const userRepository        = require('../repository/UserRepository');

/** Enriquece cada request con datos públicos del usuario solicitante. */
async function _enrichWithUsers(requests) {
  const ids = Array.from(new Set(requests.map((r) => r.userId).filter(Boolean)));
  const users = await Promise.all(ids.map((id) => userRepository.findById(id).catch(() => null)));
  const byId = new Map();
  users.forEach((u) => { if (u && (u.id || u._id)) byId.set(String(u.id || u._id), u); });
  return requests.map((r) => {
    const u = r.userId ? byId.get(String(r.userId)) : null;
    return {
      ...r,
      user: u ? {
        id:       String(u.id || u._id),
        email:    u.email,
        username: u.username || u.name || '',
      } : null,
    };
  });
}

function statusFromError(err) {
  if (err && Number.isInteger(err.status)) return err.status;
  if (err && /no encontrad/i.test(err.message || '')) return 404;
  if (err && /(activo|pendiente|ya est)/i.test(err.message || '')) return 409;
  return 500;
}

// ════════════════════════════════════════════════════════════════════
// USUARIO
// ════════════════════════════════════════════════════════════════════

// GET /api/services/catalog
async function getCatalog(_req, res) {
  try {
    const result = await serviceCatalogService.getCatalog();
    return res.json(result);
  } catch (err) {
    console.error('[ServiceCatalogController] getCatalog →', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/user/services/request
async function requestService(req, res) {
  const { serviceId, serviceCode, notes, card } = req.body || {};
  console.log('[ServiceCatalogController] requestService →', {
    userId:       req.user.id,
    serviceId,
    serviceCode,
    cardProvided: Boolean(card),
  });

  try {
    const result = await serviceCatalogService.requestService(req.user.id, {
      serviceId, serviceCode, notes, card,
    });
    return res.status(201).json(result);
  } catch (err) {
    console.error('[ServiceCatalogController] requestService →', err.message);
    return res.status(statusFromError(err)).json({ error: err.message, fields: err.fields || undefined });
  }
}

// ════════════════════════════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/service-requests
async function adminListRequests(req, res) {
  const { status } = req.query || {};
  try {
    const result   = await serviceCatalogService.listAllRequests({ status });
    const enriched = await _enrichWithUsers(result.requests || []);
    return res.json({ requests: enriched });
  } catch (err) {
    console.error('[ServiceCatalogController] adminListRequests →', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/service-requests/:id/approve
async function adminApproveRequest(req, res) {
  const { id } = req.params;
  const { adminNotes } = req.body || {};
  try {
    const result = await serviceCatalogService.approveRequest(id, {
      adminId: req.user.id,
      adminNotes,
    });
    return res.json(result);
  } catch (err) {
    console.error('[ServiceCatalogController] adminApproveRequest →', err.message);
    return res.status(statusFromError(err)).json({ error: err.message });
  }
}

// PATCH /api/admin/service-requests/:id/reject
async function adminRejectRequest(req, res) {
  const { id } = req.params;
  const { reason, adminNotes } = req.body || {};
  try {
    const result = await serviceCatalogService.rejectRequest(id, {
      adminId: req.user.id,
      reason,
      adminNotes,
    });
    return res.json(result);
  } catch (err) {
    console.error('[ServiceCatalogController] adminRejectRequest →', err.message);
    return res.status(statusFromError(err)).json({ error: err.message });
  }
}

// PATCH /api/admin/service-requests/:id/complete
async function adminCompleteRequest(req, res) {
  const { id } = req.params;
  const { adminNotes } = req.body || {};
  try {
    const result = await serviceCatalogService.completeRequest(id, {
      adminId: req.user.id,
      adminNotes,
    });
    return res.json(result);
  } catch (err) {
    console.error('[ServiceCatalogController] adminCompleteRequest →', err.message);
    return res.status(statusFromError(err)).json({ error: err.message });
  }
}

module.exports = {
  getCatalog,
  requestService,
  adminListRequests,
  adminApproveRequest,
  adminRejectRequest,
  adminCompleteRequest,
};
