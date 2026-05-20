'use strict';

/**
 * @controller ServiceCatalogController
 *
 * HTTP layer para el catálogo de servicios ONESHOT y sus solicitudes.
 * NO toca la colección `services` legacy.
 */

const serviceCatalogService = require('../services/ServiceCatalogService');

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
  const { serviceId, serviceCode, notes } = req.body || {};
  console.log('[ServiceCatalogController] requestService →', {
    userId: req.user.id, serviceId, serviceCode,
  });

  try {
    const result = await serviceCatalogService.requestService(req.user.id, {
      serviceId, serviceCode, notes,
    });
    return res.status(201).json(result);
  } catch (err) {
    console.error('[ServiceCatalogController] requestService →', err.message);
    return res.status(statusFromError(err)).json({ error: err.message });
  }
}

// ════════════════════════════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/service-requests
async function adminListRequests(req, res) {
  const { status } = req.query || {};
  try {
    const result = await serviceCatalogService.listAllRequests({ status });
    return res.json(result);
  } catch (err) {
    console.error('[ServiceCatalogController] adminListRequests →', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/service-requests/:id/approve
async function adminApproveRequest(req, res) {
  const { id } = req.params;
  try {
    const result = await serviceCatalogService.approveRequest(id, { adminId: req.user.id });
    return res.json(result);
  } catch (err) {
    console.error('[ServiceCatalogController] adminApproveRequest →', err.message);
    return res.status(statusFromError(err)).json({ error: err.message });
  }
}

// PATCH /api/admin/service-requests/:id/reject
async function adminRejectRequest(req, res) {
  const { id } = req.params;
  const { reason } = req.body || {};
  try {
    const result = await serviceCatalogService.rejectRequest(id, {
      adminId: req.user.id,
      reason,
    });
    return res.json(result);
  } catch (err) {
    console.error('[ServiceCatalogController] adminRejectRequest →', err.message);
    return res.status(statusFromError(err)).json({ error: err.message });
  }
}

module.exports = {
  getCatalog,
  requestService,
  adminListRequests,
  adminApproveRequest,
  adminRejectRequest,
};
