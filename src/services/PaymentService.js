'use strict';

/**
 * @service PaymentService
 *
 * Pasarela de pago SIMULADA. No habla con Stripe/PayPal: si los datos
 * de tarjeta pasan validación (Luhn + caducidad + CVC + holder), el pago
 * se considera confirmado.
 *
 * Responsabilidades:
 *   - Validar la tarjeta vía PaymentPolicy.
 *   - Persistir un `Payment` confirmado con SOLO la metadata segura
 *     (brand, last4, expMonth, expYear, holder). PAN y CVC nunca tocan BD.
 *   - Para purposes con efecto colateral (ej. `club_subscription`),
 *     disparar la activación correspondiente en el mismo flujo,
 *     pasando el `paymentRef` como prueba de pago.
 *
 * Naming:
 *   - "Activación automática del rol de Collector's Club" se materializa
 *     como `users.isSubscribed = true` (estado de Club existente).
 *     NO se altera `users.role` (que sigue siendo 'admin'|'client').
 */

const policy             = require('../domain/PaymentPolicy');
const paymentRepository  = require('../repository/PaymentRepository');

const CLUB_AMOUNT_EUR = 15; // Collector's Club · 15€ / mes

class PaymentService {

  /**
   * Pago simulado.
   *
   * @param {Object} args
   * @param {string} args.userId
   * @param {'club_subscription'|'service_request'|'generic'} args.purpose
   * @param {{number, expMonth, expYear, cvc, holder}} args.card
   * @param {number} [args.amount]   — si no se da, se infiere por purpose
   * @param {string} [args.currency] — 'EUR' por defecto
   * @param {Object} [args.meta]     — { planCode, serviceCode, ... }
   *
   * @returns {Promise<{ payment, sideEffect }>}
   * @throws  Error con err.status=400 si la tarjeta no valida.
   */
  async simulateCharge({ userId, purpose, card, amount, currency = 'EUR', meta = null } = {}) {
    if (!userId) {
      const err = new Error('Usuario no autenticado'); err.status = 401; throw err;
    }
    if (!card || typeof card !== 'object') {
      const err = new Error('Datos de tarjeta requeridos'); err.status = 400; throw err;
    }

    const { ok, brand, errors } = policy.validateCard(card);
    // Log diagnóstico SIN PAN ni CVC — solo brand y last4 para depurar
    // rechazos de tarjeta sin filtrar datos sensibles a los logs.
    const _last4 = String(card?.number || '').replace(/\D+/g, '').slice(-4);
    console.log('[PaymentService] validateCard →', {
      userId, purpose, brand, last4: _last4, ok, errors,
      expMonth: card?.expMonth, expYear: card?.expYear,
      holderLen: String(card?.holder || '').trim().length,
    });
    if (!ok) {
      const err = new Error(`Datos de tarjeta inválidos: ${errors.join(', ')}`);
      err.status = 400;
      err.fields = errors;
      throw err;
    }

    const safeCard = policy.sanitizeCardForStorage(card);
    safeCard.brand = brand; // ya derivado por validateCard

    const finalAmount = Number.isFinite(amount) ? Number(amount) :
                        (purpose === 'club_subscription' ? CLUB_AMOUNT_EUR : 0);

    const payment = await paymentRepository.create({
      userId,
      purpose,
      amount:   finalAmount,
      currency,
      status:   'confirmed',
      card:     safeCard,
      meta,
    });

    return { payment };
  }

  /**
   * Verifica que un `paymentRef` (id de payment) sea válido para un usuario
   * y propósito concretos. Lo usan los endpoints que activan estado a partir
   * de un pago confirmado.
   *
   * @returns {Promise<Object|null>} payment público, o null si no es válido.
   */
  async getValidPaymentFor(userId, paymentRef, expectedPurpose) {
    if (!paymentRef) return null;
    const p = await paymentRepository.findById(paymentRef);
    if (!p) return null;
    if (String(p.userId) !== String(userId)) return null;
    if (p.status !== 'confirmed') return null;
    if (expectedPurpose && p.purpose !== expectedPurpose) return null;
    return p;
  }
}

module.exports = new PaymentService();
