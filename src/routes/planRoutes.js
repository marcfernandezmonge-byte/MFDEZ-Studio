'use strict';

/**
 * planRoutes.js
 *
 * Rutas de PLANES PRINCIPALES (packs) y sus solicitudes.
 *
 * Sustituye el stub previo (`VERSION MARC TEST 12345`) que solo hacía eco
 * sin persistir nada — causaba que "contratar pack" en el frontend pareciera
 * funcionar mientras en BD no quedaba ningún registro.
 *
 * Endpoints:
 *   GET    /api/plans                              público
 *   GET    /api/user/plan                          requireAuth
 *   POST   /api/user/plan/request                  requireAuth
 *   GET    /api/admin/plans                        requireAuth + requireAdmin
 *   PATCH  /api/admin/plans/:id/approve            requireAuth + requireAdmin
 *   PATCH  /api/admin/plans/:id/reject             requireAuth + requireAdmin
 *
 * Nota: el modelo es "solicitud → admin aprueba". NO hay cobro automático.
 * El copy del frontend debe reflejar esto (ver servicios.html).
 */

const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const ctrl = require('../controller/PlanController');

const router = Router();

router.get('/plans',                                          ctrl.getCatalog);
router.get('/user/plan',                  requireAuth,        ctrl.getUserPlan);
router.post('/user/plan/request',         requireAuth,        ctrl.requestPlan);

router.get('/admin/plans',                requireAuth, requireAdmin, ctrl.adminListRequests);
router.patch('/admin/plans/:id/approve',  requireAuth, requireAdmin, ctrl.adminApproveRequest);
router.patch('/admin/plans/:id/reject',   requireAuth, requireAdmin, ctrl.adminRejectRequest);
router.patch('/admin/plans/:id/complete', requireAuth, requireAdmin, ctrl.adminCompleteRequest);

module.exports = router;
