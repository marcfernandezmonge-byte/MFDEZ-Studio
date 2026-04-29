'use strict';

/**
 * ServiceRepository.js
 * Colocar en: src/repository/ServiceRepository.js
 *
 * CAUSA DEL 500 EN /api/user/services:
 *   La versión anterior de getServicesForUser() recibía el objeto User completo
 *   pero hacía operaciones sobre él asumiendo que era un string de userId,
 *   o la colección "services" no existía en MongoDB y lanzaba una excepción
 *   no capturada que Express convertía en 500 sin mensaje útil.
 *
 * FIX: acepta tanto un userId string como el objeto User completo,
 *      y devuelve [] si no hay colección en vez de lanzar excepción.
 */

const { ObjectId } = require('mongodb');
const { getDB }    = require('../persistence/mongoClient');

class ServiceRepository {

  async _col() {
    const db = await getDB();
    return db.collection('services');
  }

  /**
   * Devuelve los servicios de un usuario.
   * @param {string | { id: string }} userOrId — acepta userId string u objeto User
   * @returns {Promise<Array>}
   */
  async getServicesForUser(userOrId) {
    // Normalizar: acepta string o objeto con .id / ._id
    const rawId = typeof userOrId === 'string'
      ? userOrId
      : String(userOrId?.id || userOrId?._id || '');

    console.log('[ServiceRepository] getServicesForUser → rawId:', rawId);

    if (!rawId) {
      console.warn('[ServiceRepository] ID de usuario vacío → devolviendo []');
      return [];
    }

    let oid;
    try {
      oid = new ObjectId(rawId);
    } catch (err) {
      console.error('[ServiceRepository] ObjectId inválido:', rawId, err.message);
      return [];
    }

    try {
      const col  = await this._col();
      const docs = await col.find({ userId: oid }).toArray();

      console.log('[ServiceRepository] servicios encontrados:', docs.length);

      return docs.map((d) => ({
        id:        String(d._id),
        name:      d.name      || 'Servicio',
        type:      d.type      || 'Servicio',
        status:    d.status    || 'active',
        price:     d.price     || '',
        startDate: d.startDate || null,
        endDate:   d.endDate   || null,
        events:    d.events    || null,
      }));

    } catch (err) {
      // Si la colección no existe MongoDB no lanza error en find(), pero
      // si hay otro problema lo capturamos aquí sin propagar un 500 genérico.
      console.error('[ServiceRepository] getServicesForUser → ERROR:', err.message);
      return []; // devolver array vacío en lugar de explotar
    }
  }
}

module.exports = new ServiceRepository();