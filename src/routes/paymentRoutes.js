'use strict';

/**
 * paymentRoutes.js
 *
 * Pasarela SIMULADA. No habla con Stripe; valida tarjeta y, si purpose lo
 * requiere, activa el estado correspondiente (p. ej. Collector's Club).
 *
 * Endpoints:
 *   POST /api/payments/simulate     requireAuth
 */

const { Router } = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const ctrl = require('../controller/PaymentController');

const router = Router();

router.post('/payments/simulate', requireAuth, ctrl.simulate);

module.exports = router;
