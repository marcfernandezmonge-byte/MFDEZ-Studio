'use strict';

/**
 * @service EntitlementService
 *
 * Casos de uso de entitlements de servicio. Capa SEPARADA del rol de cuenta
 * (`users.role`) y de la membresía Collectors Club (`users.isSubscribed`).
 * No los toca ni los consulta.
 *
 * Flujo principal: cuando un admin aprueba una `serviceRequest`,
 * `ServiceCatalogService.approveRequest` invoca `grantFromRequest` aquí.
 * Es idempotente: re-aprobar (o backfill) no duplica.
 */

const entitlementRepository = require('../repository/ServiceEntitlementRepository');
const policy                = require('../domain/EntitlementPolicy');

class EntitlementService {

  /**
   * Crea un entitlement a partir de una serviceRequest aprobada.
   * @param {Object} request — objeto público devuelto por ServiceRequestRepository
   * @param {Object} opts.adminId — admin que aprueba
   * @returns {Promise<Object>} entitlement creado (o existente si ya había uno).
   */
  async grantFromRequest(request, { adminId } = {}) {
    if (!request || !request.id || !request.userId) {
      throw new Error('Request inválida para grantFromRequest');
    }

    const existing = await entitlementRepository.findByRequestId(request.id);
    if (existing) return existing;

    const snap     = request.serviceSnapshot || {};
    const category = snap.category || null;
    const { entitlementKey }       = policy.forCategory(category);
    const grantedAt                = new Date().toISOString();
    const { validFrom, validUntil } = policy.computeValidity(grantedAt, category);

    return entitlementRepository.create({
      userId:          request.userId,
      requestId:       request.id,
      serviceCode:     request.serviceCode || snap.code || null,
      category,
      entitlementKey,
      serviceSnapshot: snap,
      status:          'active',
      validFrom,
      validUntil,
      grantedAt,
      grantedBy:       adminId || null,
    });
  }

  /**
   * Lista entitlements de un usuario, aplicando expiración defensiva on-the-fly.
   * El barrido persistente está en `expireDue()`.
   */
  async listForUser(userId) {
    const items = await entitlementRepository.findAllForUser(userId);
    const now   = Date.now();
    return items.map((e) => {
      if (e.status === 'active' && e.validUntil) {
        const exp = Date.parse(e.validUntil);
        if (Number.isFinite(exp) && exp < now) {
          return { ...e, status: 'expired' };
        }
      }
      return e;
    });
  }

  async listForAdmin(filters = {}) {
    return entitlementRepository.findAllAdmin(filters);
  }

  async revoke(entitlementId, { adminId, reason } = {}) {
    return entitlementRepository.revoke(entitlementId, { adminId, reason });
  }

  async complete(entitlementId) {
    return entitlementRepository.updateStatus(entitlementId, 'completed');
  }

  /**
   * Marca como `expired` todos los entitlements activos cuyo validUntil ya pasó.
   * Llamable por endpoint admin o cron.
   */
  async expireDue() {
    const now = new Date().toISOString();
    return entitlementRepository.markExpiredBefore(now);
  }
}

module.exports = new EntitlementService();
