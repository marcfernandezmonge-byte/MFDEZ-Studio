'use strict';

/**
 * @controller PaymentController
 *
 * HTTP layer para la pasarela de pago SIMULADA.
 * Endpoint:
 *   POST /api/payments/simulate    requireAuth
 *
 * Comportamiento:
 *   1. Valida la tarjeta (Luhn + caducidad + CVC + holder) vía PaymentService.
 *   2. Crea un Payment confirmado (sin PAN, sin CVC en BD).
 *   3. Si `purpose === 'club_subscription'`, ACTIVA AUTOMÁTICAMENTE el estado
 *      Collector's Club (`users.isSubscribed = true`) pasando el `paymentRef`.
 *      Esta activación ocurre en el mismo flujo, sin clic manual, sin endpoint
 *      suelto sin pago.
 *   4. Devuelve `{ payment, subscription }` para que el frontend confirme con
 *      datos REALES (last4, brand) en lugar de un setTimeout decorativo.
 */

const paymentService = require('../services/PaymentService');
const userServices   = require('../services/UserServices');
const authService    = require('../services/AuthService');

function _status(err) {
  if (err && Number.isInteger(err.status)) return err.status;
  return 500;
}

// POST /api/payments/simulate
async function simulate(req, res) {
  const { purpose, card, meta } = req.body || {};
  console.log('[PaymentController] simulate →', {
    userId: req.user.id,
    purpose,
    cardBrandHint: card?.number ? '***' + String(card.number).replace(/\D/g, '').slice(-4) : null,
  });

  try {
    const { payment } = await paymentService.simulateCharge({
      userId:  req.user.id,
      purpose: purpose || 'generic',
      card,
      meta,
    });

    // Activación automática según purpose. Hoy solo `club_subscription`.
    let subscription = null;
    let subscriptionWarn = null;
    let alreadySubscribed = false;
    if (payment && payment.purpose === 'club_subscription') {
      try {
        const result = await userServices.subscribeUser(req.user.id, {
          paymentRef: payment.id,
        });
        subscription = result?.subscription || result || null;
      } catch (err) {
        // 409 → ya estaba activa. No es un fallo: el frontend debe verlo como
        // éxito idempotente (devolvemos la membresía actual + warn informativo).
        console.warn('[PaymentController] subscribeUser tras pago →', err.message);
        subscriptionWarn = err.message;
        if (err.status === 409) {
          alreadySubscribed = true;
          try {
            const current = await userServices.getUserSubscription(req.user.id);
            subscription = current?.subscription || null;
          } catch (e) {
            console.warn('[PaymentController] getUserSubscription →', e.message);
          }
        }
      }
    }

    // Re-emite el JWT con isSubscribed actualizado. El frontend lo guarda en
    // localStorage para que cualquier siguiente request (Vault, dashboard,
    // refresh) viaje con el claim correcto sin necesidad de re-login.
    let token = null;
    if (subscription && subscription.active) {
      try {
        const refreshed = await authService.refreshTokenForUser(req.user.id);
        token = refreshed.token;
      } catch (err) {
        console.warn('[PaymentController] refreshToken →', err.message);
      }
    }

    console.log('[PaymentController] simulate → response', {
      userId: req.user.id,
      paymentId: payment?.id,
      paymentStatus: payment?.status,
      subscriptionActive: Boolean(subscription?.active),
      tokenRotated: Boolean(token),
      alreadySubscribed,
    });
    return res.status(201).json({
      payment,
      subscription,
      subscriptionWarn,
      alreadySubscribed,
      token,
    });
  } catch (err) {
    console.error('[PaymentController] simulate →', err.message);
    return res.status(_status(err)).json({
      error:  err.message,
      fields: err.fields || undefined,
    });
  }
}

module.exports = { simulate };
