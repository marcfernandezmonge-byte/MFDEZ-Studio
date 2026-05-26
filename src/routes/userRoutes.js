'use strict';

/**
 * userRoutes.js
 * Colocar en: src/routes/userRoutes.js
 *
 * Patrón correcto:
 *   1. requireAuth extrae y verifica el token → inyecta req.user
 *   2. requireAdmin comprueba el rol sobre req.user
 *   3. El controller usa req.user.id directamente — SIN re-verificar el token
 *
 * Esto elimina la doble verificación que causaba el 500 en UserServices.
 */

const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');
const ctrl = require('../controller/UserController');

const router = Router();

// ── Identidad autenticada ────────────────────────────────────────
// GET /api/me — fuente única de verdad para rol del usuario en el frontend.
router.get('/me', requireAuth, ctrl.getMe);

// ── Usuario autenticado ──────────────────────────────────────────
// GET /api/user/services
router.get('/user/services', requireAuth, ctrl.getServices);

// GET /api/user/membership
router.get('/user/membership', requireAuth, ctrl.getMembership);

// ── Suscripción ──────────────────────────────────────────────────
// POST /api/user/subscribe
router.post('/user/subscribe', requireAuth, ctrl.subscribeUser);

// GET /api/user/subscription
router.get('/user/subscription', requireAuth, ctrl.getUserSubscription);

// POST /api/user/cancel-subscription
router.post('/user/cancel-subscription', requireAuth, ctrl.cancelSubscription);

// DELETE /api/user/delete-account
router.delete('/user/delete-account', requireAuth, ctrl.deleteAccount);

// PATCH /api/user/password — cambio de contraseña del usuario autenticado
router.patch('/user/password', requireAuth, ctrl.changePassword);

// ── Admin ────────────────────────────────────────────────────────
// GET /api/admin/users
router.get('/admin/users', requireAuth, requireAdmin, ctrl.getAdminUsers);

// GET /api/admin/club-members
router.get('/admin/club-members', requireAuth, requireAdmin, ctrl.getAdminClubMembers);

// PATCH /api/admin/club-members/:id/toggle
router.patch('/admin/club-members/:id/toggle', requireAuth, requireAdmin, ctrl.toggleClubMemberStatus);

module.exports = router;