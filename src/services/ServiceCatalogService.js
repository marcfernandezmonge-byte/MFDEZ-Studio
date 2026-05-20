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

class ServiceCatalogService {

  async getCatalog() {
    const services = await serviceCatalogRepository.findAllActive();
    return { services };
  }

  async getUserRequests(userId) {
    const requests = await serviceRequestRepository.findAllForUser(userId);
    return { requests };
  }

  async requestService(userId, { serviceId, serviceCode, notes } = {}) {
    if (!userId) throw new Error('Usuario no autenticado');

    let service = null;
    if (serviceId)   service = await serviceCatalogRepository.findById(serviceId);
    if (!service && serviceCode) service = await serviceCatalogRepository.findByCode(serviceCode);

    if (!service) {
      const err = new Error('Servicio no encontrado');
      err.status = 404;
      throw err;
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
    });

    return { request: created };
  }

  async listAllRequests({ status } = {}) {
    const requests = await serviceRequestRepository.findAll({ status });
    return { requests };
  }

  async approveRequest(requestId, { adminId } = {}) {
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
    const updated = await serviceRequestRepository.approve(requestId, { adminId });
    return { request: updated };
  }

  async rejectRequest(requestId, { adminId, reason } = {}) {
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
    const updated = await serviceRequestRepository.reject(requestId, { adminId, reason });
    return { request: updated };
  }
}

module.exports = new ServiceCatalogService();
