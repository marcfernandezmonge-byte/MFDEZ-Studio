'use strict';

/**
 * @domain EntitlementPolicy
 *
 * Tabla central que decide, para cada `category` del catálogo de servicios,
 * qué entitlementKey se crea al aprobar la solicitud y por cuántos días
 * tiene validez por defecto.
 *
 * Mantener esta tabla como ÚNICA fuente de verdad. Si añades una categoría
 * nueva al catálogo, añade su entrada aquí también.
 *
 * Importante (guardrails §0 del plan):
 *   - Estos entitlements NO sustituyen `user.role` ('admin'|'client').
 *   - NO se mezclan con la membresía Collectors Club (`isSubscribed`).
 *   - Solo describen "qué servicio tiene contratado y vigente un usuario".
 */

const FALLBACK_KEY = 'ent_generic';
const FALLBACK_VALIDITY_DAYS = 90;

const POLICY = Object.freeze({
  branding:   { entitlementKey: 'ent_branding',   defaultValidityDays: 180 },
  web:        { entitlementKey: 'ent_web',        defaultValidityDays: 365 },
  photo:      { entitlementKey: 'ent_photo',      defaultValidityDays: 30  },
  consulting: { entitlementKey: 'ent_consulting', defaultValidityDays: 60  },
});

function forCategory(category) {
  const key = String(category || '').toLowerCase();
  return POLICY[key] || { entitlementKey: FALLBACK_KEY, defaultValidityDays: FALLBACK_VALIDITY_DAYS };
}

/**
 * Calcula validFrom / validUntil a partir del momento de concesión.
 * Si defaultValidityDays es null/0, validUntil queda en null (sin expiración).
 */
function computeValidity(grantedAtISO, category) {
  const { defaultValidityDays } = forCategory(category);
  const from = grantedAtISO ? new Date(grantedAtISO) : new Date();
  const validFrom = from.toISOString();
  if (!defaultValidityDays || defaultValidityDays <= 0) {
    return { validFrom, validUntil: null };
  }
  const until = new Date(from.getTime() + defaultValidityDays * 24 * 60 * 60 * 1000);
  return { validFrom, validUntil: until.toISOString() };
}

module.exports = {
  POLICY,
  FALLBACK_KEY,
  FALLBACK_VALIDITY_DAYS,
  forCategory,
  computeValidity,
};
