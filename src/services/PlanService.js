'use strict';

/**
 * @service PlanService
 *
 * Casos de uso de PLANES PRINCIPALES y sus solicitudes.
 * Aditivo: NO toca la membresía legacy (Collector's Club).
 *
 * Reglas:
 *   - Un usuario sólo puede tener UNA request en estado `pending` o `active`.
 *   - Los estados `rejected`, `expired`, `cancelled` quedan visibles como
 *     histórico.
 *   - El admin aprueba/rechaza solicitudes pendientes.
 */

const planRepository        = require('../repository/PlanRepository');
const planRequestRepository = require('../repository/PlanRequestRepository');

class PlanService {

  /** Catálogo público de planes activos. */
  async getCatalog() {
    const plans = await planRepository.findAllActive();
    return { plans };
  }

  /**
   * Estado del plan del usuario: el vigente (pending o active) + histórico.
   */
  async getUserPlan(userId) {
    const [current, history] = await Promise.all([
      planRequestRepository.findCurrentForUser(userId),
      planRequestRepository.findAllForUser(userId),
    ]);
    return {
      current,
      history,
    };
  }

  /**
   * Crea una solicitud de plan principal.
   * Body: { planId? , planCode?, notes? }
   *
   * @throws Error('Ya tienes un plan activo o pendiente') si ya hay uno.
   * @throws Error('Plan no encontrado') si planId/planCode no existe.
   */
  async requestPlan(userId, { planId, planCode, notes } = {}) {
    if (!userId) throw new Error('Usuario no autenticado');

    // Invariante: 1 sólo plan vigente
    if (await planRequestRepository.hasActiveOrPending(userId)) {
      const err = new Error('Ya tienes un plan activo o pendiente');
      err.status = 409;
      throw err;
    }

    let plan = null;
    if (planId)   plan = await planRepository.findById(planId);
    if (!plan && planCode) plan = await planRepository.findByCode(planCode);

    if (!plan) {
      const err = new Error('Plan no encontrado');
      err.status = 404;
      throw err;
    }

    const created = await planRequestRepository.create({
      userId,
      planId:   plan.id,
      planCode: plan.code,
      planSnapshot: {
        name:     plan.name,
        price:    plan.price,
        currency: plan.currency,
        interval: plan.interval,
      },
      notes,
    });

    return { request: created };
  }

  /** Admin: todas las solicitudes (filtrable por status). */
  async listAllRequests({ status } = {}) {
    const requests = await planRequestRepository.findAll({ status });
    return { requests };
  }

  /** Admin: aprobar una solicitud. */
  async approveRequest(requestId, { adminId, startDate, endDate } = {}) {
    const existing = await planRequestRepository.findById(requestId);
    if (!existing) {
      const err = new Error('Solicitud no encontrada');
      err.status = 404;
      throw err;
    }
    if (existing.status !== 'pending') {
      const err = new Error(`La solicitud ya está en estado "${existing.status}"`);
      err.status = 409;
      throw err;
    }

    const updated = await planRequestRepository.approve(requestId, {
      adminId, startDate, endDate,
    });
    return { request: updated };
  }

  /** Admin: rechazar una solicitud. */
  async rejectRequest(requestId, { adminId, reason } = {}) {
    const existing = await planRequestRepository.findById(requestId);
    if (!existing) {
      const err = new Error('Solicitud no encontrada');
      err.status = 404;
      throw err;
    }
    if (existing.status !== 'pending') {
      const err = new Error(`La solicitud ya está en estado "${existing.status}"`);
      err.status = 409;
      throw err;
    }

    const updated = await planRequestRepository.reject(requestId, {
      adminId, reason,
    });
    return { request: updated };
  }
}

module.exports = new PlanService();
