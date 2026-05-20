'use strict';

/**
 * @controller PlanController
 *
 * HTTP layer para PLANES PRINCIPALES y sus solicitudes.
 * NO toca la membresía legacy (Collector's Club).
 */

const planService = require('../services/PlanService');

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
  const { planId, planCode, notes } = req.body || {};
  console.log('[PlanController] requestPlan →', { userId: req.user.id, planId, planCode });

  try {
    const result = await planService.requestPlan(req.user.id, { planId, planCode, notes });
    return res.status(201).json(result);
  } catch (err) {
    console.error('[PlanController] requestPlan →', err.message);
    return res.status(statusFromError(err)).json({ error: err.message });
  }
}

// ════════════════════════════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/plans
async function adminListRequests(req, res) {
  const { status } = req.query || {};
  try {
    const result = await planService.listAllRequests({ status });
    return res.json(result);
  } catch (err) {
    console.error('[PlanController] adminListRequests →', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/plans/:id/approve
async function adminApproveRequest(req, res) {
  const { id } = req.params;
  const { startDate, endDate } = req.body || {};
  try {
    const result = await planService.approveRequest(id, {
      adminId: req.user.id,
      startDate,
      endDate,
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
  const { reason } = req.body || {};
  try {
    const result = await planService.rejectRequest(id, {
      adminId: req.user.id,
      reason,
    });
    return res.json(result);
  } catch (err) {
    console.error('[PlanController] adminRejectRequest →', err.message);
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
};
