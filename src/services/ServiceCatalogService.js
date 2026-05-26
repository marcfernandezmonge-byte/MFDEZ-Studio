'use strict';

/**
 * @service ServiceCatalogService
 *
 * Casos de uso del CATÁLOGO de servicios oneshot y sus solicitudes.
 * Aditivo: NO toca la colección `services` legacy ni la membresía.
 *
 * Reglas:
 *   - Un usuario puede tener varias solicitudes simultáneas (independientes).
 *   - El admin aprueba/rechaza solicitudes pendientes.
 */

const serviceCatalogRepository = require('../repository/ServiceCatalogRepository');
const serviceRequestRepository = require('../repository/ServiceRequestRepository');
const entitlementService       = require('./EntitlementService');
const paymentService           = require('./PaymentService');

class ServiceCatalogService {

  async getCatalog() {
    const services = await serviceCatalogRepository.findAllActive();
    return { services };
  }

  async getUserRequests(userId) {
    const requests = await serviceRequestRepository.findAllForUser(userId);
    return { requests };
  }

  async requestService(userId, { serviceId, serviceCode, notes, card } = {}) {
    if (!userId) throw new Error('Usuario no autenticado');

    let service = null;
    if (serviceId)   service = await serviceCatalogRepository.findById(serviceId);
    if (!service && serviceCode) service = await serviceCatalogRepository.findByCode(serviceCode);

    if (!service) {
      const err = new Error('Servicio no encontrado');
      err.status = 404;
      throw err;
    }

    // Paso de pago (SIMULADO). Si el frontend envía `card`, validamos y
    // creamos un Payment confirmado ANTES de la request. Compatible con
    // peticiones legacy sin card (queda paymentId=null).
    let payment = null;
    if (card && typeof card === 'object') {
      const result = await paymentService.simulateCharge({
        userId,
        purpose: 'service_request',
        card,
        amount: Number.isFinite(service.price) ? Number(service.price) : 0,
        currency: service.currency || 'EUR',
        meta: { serviceCode: service.code, serviceId: service.id, intent: 'request' },
      });
      payment = result.payment;
    }

    const created = await serviceRequestRepository.create({
      userId,
      serviceId:   service.id,
      serviceCode: service.code,
      serviceSnapshot: {
        name:     service.name,
        price:    service.price,
        currency: service.currency,
        category: service.category,
      },
      notes,
      paymentId:       payment ? payment.id : null,
      paymentSnapshot: payment ? { ...payment.card, status: payment.status, amount: payment.amount, currency: payment.currency } : null,
    });

    return { request: created, payment };
  }

  async listAllRequests({ status } = {}) {
    const requests = await serviceRequestRepository.findAll({ status });
    return { requests };
  }

  async approveRequest(requestId, { adminId, adminNotes } = {}) {
    const existing = await serviceRequestRepository.findById(requestId);
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
    const updated = await serviceRequestRepository.approve(requestId, { adminId, adminNotes });

    // Materializa el entitlement asociado. Si falla (BD intermitente, etc.),
    // la aprobación NO se revierte — se expone el warning y queda disponible
    // el endpoint de reintento admin (ver EntitlementController fase 2/3).
    let entitlement     = null;
    let entitlementWarn = null;
    try {
      entitlement = await entitlementService.grantFromRequest(updated, { adminId });
    } catch (err) {
      console.error('[ServiceCatalogService] grantFromRequest →', err.message);
      entitlementWarn = err.message;
    }

    return { request: updated, entitlement, entitlementWarn };
  }

  async rejectRequest(requestId, { adminId, reason, adminNotes } = {}) {
    const existing = await serviceRequestRepository.findById(requestId);
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
    const updated = await serviceRequestRepository.reject(requestId, { adminId, reason, adminNotes });
    return { request: updated };
  }

  /** Admin: marcar como completada (desde approved o pending). */
  async completeRequest(requestId, { adminId, adminNotes } = {}) {
    const existing = await serviceRequestRepository.findById(requestId);
    if (!existing) {
      const err = new Error('Solicitud no encontrada');
      err.status = 404;
      throw err;
    }
    if (!['approved', 'pending'].includes(existing.status)) {
      const err = new Error(`No se puede completar una solicitud en estado "${existing.status}"`);
      err.status = 409;
      throw err;
    }
    const updated = await serviceRequestRepository.complete(requestId, { adminId, adminNotes });
    return { request: updated };
  }
}

module.exports = new ServiceCatalogService();
