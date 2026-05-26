'use strict';

/**
 * @controller PlanController
 *
 * HTTP layer para PLANES PRINCIPALES y sus solicitudes.
 * NO toca la membresía legacy (Collector's Club).
 */

const planService    = require('../services/PlanService');
const userRepository = require('../repository/UserRepository');

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

// GET /api/plans
async function getCatalog(_req, res) {
  try {
    const result = await planService.getCatalog();
    return res.json(result);
  } catch (err) {
    console.error('[PlanController] getCatalog →', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/user/plan
async function getUserPlan(req, res) {
  try {
    const result = await planService.getUserPlan(req.user.id);
    return res.json(result);
  } catch (err) {
    console.error('[PlanController] getUserPlan →', err.message);
    return res.status(statusFromError(err)).json({ error: err.message });
  }
}

// POST /api/user/plan/request
async function requestPlan(req, res) {
  const { planId, planCode, notes, card } = req.body || {};
  console.log('[PlanController] requestPlan →', {
    userId:  req.user.id,
    planId,
    planCode,
    cardProvided: Boolean(card),
  });

  try {
    const result = await planService.requestPlan(req.user.id, { planId, planCode, notes, card });
    return res.status(201).json(result);
  } catch (err) {
    console.error('[PlanController] requestPlan →', err.message);
    return res.status(statusFromError(err)).json({ error: err.message, fields: err.fields || undefined });
  }
}

// ════════════════════════════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/plans
async function adminListRequests(req, res) {
  const { status } = req.query || {};
  try {
    const result   = await planService.listAllRequests({ status });
    const enriched = await _enrichWithUsers(result.requests || []);
    return res.json({ requests: enriched });
  } catch (err) {
    console.error('[PlanController] adminListRequests →', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/plans/:id/approve
async function adminApproveRequest(req, res) {
  const { id } = req.params;
  const { startDate, endDate, adminNotes } = req.body || {};
  try {
    const result = await planService.approveRequest(id, {
      adminId: req.user.id,
      startDate,
      endDate,
      adminNotes,
    });
    return res.json(result);
  } catch (err) {
    console.error('[PlanController] adminApproveRequest →', err.message);
    return res.status(statusFromError(err)).json({ error: err.message });
  }
}

// PATCH /api/admin/plans/:id/reject
async function adminRejectRequest(req, res) {
  const { id } = req.params;
  const { reason, adminNotes } = req.body || {};
  try {
    const result = await planService.rejectRequest(id, {
      adminId: req.user.id,
      reason,
      adminNotes,
    });
    return res.json(result);
  } catch (err) {
    console.error('[PlanController] adminRejectRequest →', err.message);
    return res.status(statusFromError(err)).json({ error: err.message });
  }
}

// PATCH /api/admin/plans/:id/complete
async function adminCompleteRequest(req, res) {
  const { id } = req.params;
  const { adminNotes } = req.body || {};
  try {
    const result = await planService.completeRequest(id, {
      adminId: req.user.id,
      adminNotes,
    });
    return res.json(result);
  } catch (err) {
    console.error('[PlanController] adminCompleteRequest →', err.message);
    return res.status(statusFromError(err)).json({ error: err.message });
  }
}

module.exports = {
  getCatalog,
  getUserPlan,
  requestPlan,
  adminListRequests,
  adminApproveRequest,
  adminRejectRequest,
  adminCompleteRequest,
};
