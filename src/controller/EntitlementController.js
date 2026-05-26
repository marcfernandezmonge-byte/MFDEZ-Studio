'use strict';

/**
 * @controller EntitlementController
 *
 * HTTP layer para gestión admin de entitlements de servicio.
 * Capa separada (guardrails §0): no toca rol de cuenta ni Collectors Club.
 *
 * Endpoints:
 *   GET   /api/admin/entitlements                    requireAuth + requireAdmin
 *   PATCH /api/admin/entitlements/:id/revoke         requireAuth + requireAdmin
 *   PATCH /api/admin/entitlements/:id/complete       requireAuth + requireAdmin
 */

const entitlementService = require('../services/EntitlementService');
const userRepository     = require('../repository/UserRepository');

async function _enrichWithUsers(entitlements) {
  const ids = Array.from(new Set(entitlements.map((e) => e.userId).filter(Boolean)));
  const users = await Promise.all(ids.map((id) => userRepository.findById(id).catch(() => null)));
  const byId = new Map();
  users.forEach((u) => { if (u && u.id) byId.set(String(u.id), u); });
  return entitlements.map((e) => {
    const u = e.userId ? byId.get(String(e.userId)) : null;
    return {
      ...e,
      user: u ? { id: u.id, email: u.email, username: u.username } : null,
    };
  });
}

function _status(err) {
  if (err && Number.isInteger(err.status)) return err.status;
  if (err && /no encontrad/i.test(err.message || '')) return 404;
  return 500;
}

// GET /api/admin/entitlements?userId=&status=&category=
async function adminList(req, res) {
  const { userId, status, category } = req.query || {};
  try {
    const items     = await entitlementService.listForAdmin({ userId, status, category });
    const enriched  = await _enrichWithUsers(items);
    return res.json({ entitlements: enriched });
  } catch (err) {
    console.error('[EntitlementController] adminList →', err.message);
    return res.status(_status(err)).json({ error: err.message });
  }
}

// PATCH /api/admin/entitlements/:id/revoke
async function adminRevoke(req, res) {
  const { id } = req.params;
  const { reason } = req.body || {};
  try {
    const updated = await entitlementService.revoke(id, { adminId: req.user.id, reason });
    if (!updated) return res.status(404).json({ error: 'Entitlement no encontrado' });
    return res.json({ entitlement: updated });
  } catch (err) {
    console.error('[EntitlementController] adminRevoke →', err.message);
    return res.status(_status(err)).json({ error: err.message });
  }
}

// PATCH /api/admin/entitlements/:id/complete
async function adminComplete(req, res) {
  const { id } = req.params;
  try {
    const updated = await entitlementService.complete(id);
    if (!updated) return res.status(404).json({ error: 'Entitlement no encontrado' });
    return res.json({ entitlement: updated });
  } catch (err) {
    console.error('[EntitlementController] adminComplete →', err.message);
    return res.status(_status(err)).json({ error: err.message });
  }
}

module.exports = { adminList, adminRevoke, adminComplete };
