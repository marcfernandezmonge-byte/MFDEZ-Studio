'use strict';

/**
 * @repository ServiceRequestRepository
 *
 * Solicitudes ONESHOT por usuario.
 * Colección MongoDB: `serviceRequests`
 *
 * Estados:
 *   pending    → recién solicitado, esperando admin
 *   approved   → aceptado, en ejecución
 *   rejected   → rechazado por admin
 *   completed  → entregado / cerrado
 *   cancelled  → cancelado por el usuario
 *
 * A diferencia de los planes principales, un usuario PUEDE tener varias
 * solicitudes simultáneas (cada servicio es independiente).
 *
 * Documento:
 *   {
 *     _id, userId(ObjectId), serviceId(ObjectId), serviceCode,
 *     serviceSnapshot: { name, price, currency, category },
 *     status, notes,
 *     requestedAt, decidedAt, decidedBy, completedAt,
 *   }
 */

const { ObjectId } = require('mongodb');
const { getDB }    = require('../persistence/mongoClient');

class ServiceRequestRepository {

  async _col() {
    const db = await getDB();
    return db.collection('serviceRequests');
  }

  async create({ userId, serviceId, serviceCode, serviceSnapshot, notes }) {
    const col = await this._col();
    const now = new Date().toISOString();

    const doc = {
      userId:          new ObjectId(String(userId)),
      serviceId:       new ObjectId(String(serviceId)),
      serviceCode:     serviceCode || null,
      serviceSnapshot: serviceSnapshot || null,
      status:          'pending',
      notes:           notes || '',
      requestedAt:     now,
      decidedAt:       null,
      decidedBy:       null,
      completedAt:     null,
    };

    const result = await col.insertOne(doc);
    return this._toPublic({ ...doc, _id: result.insertedId });
  }

  async findById(id) {
    let oid;
    try { oid = new ObjectId(String(id)); } catch { return null; }
    const col = await this._col();
    const doc = await col.findOne({ _id: oid });
    return doc ? this._toPublic(doc) : null;
  }

  async findAllForUser(userId) {
    let oid;
    try { oid = new ObjectId(String(userId)); } catch { return []; }
    const col = await this._col();
    const docs = await col
      .find({ userId: oid })
      .sort({ requestedAt: -1 })
      .toArray();
    return docs.map((d) => this._toPublic(d));
  }

  /** Para el panel de admin: todas las requests. */
  async findAll({ status } = {}) {
    const col = await this._col();
    const query = status ? { status } : {};
    const docs = await col
      .find(query)
      .sort({ requestedAt: -1 })
      .toArray();
    return docs.map((d) => this._toPublic(d));
  }

  async approve(id, { adminId } = {}) {
    let oid;
    try { oid = new ObjectId(String(id)); } catch { return null; }
    const col = await this._col();
    const now = new Date().toISOString();
    const result = await col.findOneAndUpdate(
      { _id: oid },
      {
        $set: {
          status:    'approved',
          decidedAt: now,
          decidedBy: adminId ? new ObjectId(String(adminId)) : null,
        },
      },
      { returnDocument: 'after' }
    );
    const doc = result && (result.value || result);
    return doc && doc._id ? this._toPublic(doc) : null;
  }

  async reject(id, { adminId, reason } = {}) {
    let oid;
    try { oid = new ObjectId(String(id)); } catch { return null; }
    const col = await this._col();
    const now = new Date().toISOString();
    const update = {
      status:    'rejected',
      decidedAt: now,
      decidedBy: adminId ? new ObjectId(String(adminId)) : null,
    };
    if (reason) update.notes = reason;
    const result = await col.findOneAndUpdate(
      { _id: oid },
      { $set: update },
      { returnDocument: 'after' }
    );
    const doc = result && (result.value || result);
    return doc && doc._id ? this._toPublic(doc) : null;
  }

  _toPublic(doc) {
    return {
      id:              String(doc._id),
      userId:          doc.userId ? String(doc.userId) : null,
      serviceId:       doc.serviceId ? String(doc.serviceId) : null,
      serviceCode:     doc.serviceCode || null,
      serviceSnapshot: doc.serviceSnapshot || null,
      status:          doc.status,
      notes:           doc.notes || '',
      requestedAt:     doc.requestedAt || null,
      decidedAt:       doc.decidedAt || null,
      decidedBy:       doc.decidedBy ? String(doc.decidedBy) : null,
      completedAt:     doc.completedAt || null,
    };
  }
}

module.exports = new ServiceRequestRepository();
