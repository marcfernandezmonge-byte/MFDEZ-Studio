'use strict';

/**
 * entitlementRoutes.js
 *
 * Rutas admin para entitlements de servicio.
 * Aditivo — no toca rutas existentes ni montaje de auth/club.
 *
 * Endpoints:
 *   GET    /api/admin/entitlements                  requireAuth + requireAdmin
 *   PATCH  /api/admin/entitlements/:id/revoke       requireAuth + requireAdmin
 *   PATCH  /api/admin/entitlements/:id/complete     requireAuth + requireAdmin
 */

const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const ctrl = require('../controller/EntitlementController');

const router = Router();

router.get('/admin/entitlements',                requireAuth, requireAdmin, ctrl.adminList);
router.patch('/admin/entitlements/:id/revoke',   requireAuth, requireAdmin, ctrl.adminRevoke);
router.patch('/admin/entitlements/:id/complete', requireAuth, requireAdmin, ctrl.adminComplete);

module.exports = router;
