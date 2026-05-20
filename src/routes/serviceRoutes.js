'use strict';

/**
 * serviceRoutes.js
 *
 * Rutas del CATÁLOGO de servicios ONESHOT y sus solicitudes.
 * Aditivo — no toca `/user/services` legacy (sigue en userRoutes.js,
 * ahora extendido para devolver además los oneshots aprobados/pending).
 *
 * Endpoints:
 *   GET    /api/services/catalog                       público
 *   POST   /api/user/services/request                  requireAuth
 *   GET    /api/admin/service-requests                 requireAuth + requireAdmin
 *   PATCH  /api/admin/service-requests/:id/approve     requireAuth + requireAdmin
 *   PATCH  /api/admin/service-requests/:id/reject      requireAuth + requireAdmin
 */

const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const ctrl = require('../controller/ServiceCatalogController');

const router = Router();

// ── Público ─────────────────────────────────────────────────────────
router.get('/services/catalog', ctrl.getCatalog);

// ── Usuario autenticado ─────────────────────────────────────────────
router.post('/user/services/request', requireAuth, ctrl.requestService);

// ── Admin ───────────────────────────────────────────────────────────
router.get('/admin/service-requests',                requireAuth, requireAdmin, ctrl.adminListRequests);
router.patch('/admin/service-requests/:id/approve',  requireAuth, requireAdmin, ctrl.adminApproveRequest);
router.patch('/admin/service-requests/:id/reject',   requireAuth, requireAdmin, ctrl.adminRejectRequest);

module.exports = router;
