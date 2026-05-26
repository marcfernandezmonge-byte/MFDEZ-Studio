'use strict';

/**
 * @domain PaymentPolicy
 *
 * Reglas de validación de datos de tarjeta + sanitización para almacenamiento.
 *
 * IMPORTANTE — guardrails:
 *   - Este módulo NUNCA debe devolver el PAN completo ni el CVC en su salida.
 *   - `sanitizeCardForStorage()` es la ÚNICA forma autorizada de pasar datos
 *     de tarjeta a la capa de persistencia. Solo expone `brand`, `last4`,
 *     `expMonth`, `expYear` y `holder`.
 *   - Cualquier otra ruta que persista PAN/CVC es un bug.
 *
 * Modo de operación: PAGO SIMULADO.
 *   No se contacta con ninguna pasarela real. La validación es la única
 *   barrera. Si los datos pasan validación, el pago se considera "confirmado".
 *   No usar este código contra dinero real sin cambiar a Stripe/Adyen.
 */

const BRANDS = [
  { name: 'visa',       re: /^4\d{12}(\d{3})?(\d{3})?$/ },
  { name: 'mastercard', re: /^(5[1-5]\d{14}|2(2[2-9]\d{12}|[3-6]\d{13}|7[01]\d{12}|720\d{12}))$/ },
  { name: 'amex',       re: /^3[47]\d{13}$/ },
  { name: 'discover',   re: /^6(?:011|5\d{2})\d{12}$/ },
];

function _digits(s) {
  return String(s == null ? '' : s).replace(/\D+/g, '');
}

/** Algoritmo de Luhn. Devuelve true si el número es estructuralmente válido. */
function luhnValid(cardNumber) {
  const d = _digits(cardNumber);
  // Rango 13-19 cubre todas las redes reales (Visa 13/16/19, MC 16, Amex 15,
  // Discover 16, JCB 16-19, UnionPay 16-19). Sin BIN whitelist: cualquier
  // número que pase Luhn y caiga aquí es aceptado por la pasarela simulada.
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = parseInt(d.charAt(i), 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function brandFromNumber(cardNumber) {
  const d = _digits(cardNumber);
  const found = BRANDS.find((b) => b.re.test(d));
  return found ? found.name : 'unknown';
}

/**
 * Valida mes (1-12) y año (>= año actual y, si año == actual, mes >= mes actual).
 * Acepta año de 2 dígitos (20YY) o 4 dígitos.
 */
function validateExpiry(expMonth, expYear) {
  const m = parseInt(expMonth, 10);
  let   y = parseInt(expYear, 10);
  if (!Number.isInteger(m) || m < 1 || m > 12) return false;
  if (!Number.isInteger(y)) return false;
  if (y < 100) y += 2000;
  const now = new Date();
  const curY = now.getUTCFullYear();
  const curM = now.getUTCMonth() + 1;
  if (y < curY) return false;
  if (y === curY && m < curM) return false;
  if (y > curY + 20) return false; // sanity
  return true;
}

/** CVC: 3 dígitos (4 para Amex). */
function validateCVC(cvc, brand) {
  const d = _digits(cvc);
  if (brand === 'amex') return d.length === 4;
  return d.length === 3 || d.length === 4;
}

/** Holder: 2-60 chars, sin dígitos ni símbolos extraños. */
function validateHolder(holder) {
  const s = String(holder || '').trim();
  if (s.length < 2 || s.length > 60) return false;
  return /^[\p{L}\p{M}'.\- ]+$/u.test(s);
}

/**
 * Valida un objeto tarjeta completo. Devuelve { ok, brand, errors[] }.
 * NO devuelve el PAN ni el CVC.
 */
function validateCard(card) {
  const errors = [];
  const number = _digits(card?.number);
  const brand  = brandFromNumber(number);

  if (!luhnValid(number))                                     errors.push('cardNumber');
  if (!validateExpiry(card?.expMonth, card?.expYear))         errors.push('expiry');
  if (!validateCVC(card?.cvc, brand))                         errors.push('cvc');
  if (!validateHolder(card?.holder))                          errors.push('holder');

  return { ok: errors.length === 0, brand, errors };
}

/**
 * Devuelve la PROYECCIÓN SEGURA para persistir. Solo metadata no sensible.
 * Si recibe campos sensibles los descarta silenciosamente.
 */
function sanitizeCardForStorage(card) {
  const number = _digits(card?.number);
  const brand  = brandFromNumber(number);
  const last4  = number.slice(-4);
  let expYear  = parseInt(card?.expYear, 10);
  if (expYear < 100) expYear += 2000;
  return {
    brand,
    last4,
    expMonth: parseInt(card?.expMonth, 10) || null,
    expYear:  Number.isInteger(expYear) ? expYear : null,
    holder:   String(card?.holder || '').trim().slice(0, 60),
  };
}

module.exports = {
  luhnValid,
  brandFromNumber,
  validateExpiry,
  validateCVC,
  validateHolder,
  validateCard,
  sanitizeCardForStorage,
};
