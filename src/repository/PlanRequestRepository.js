'use strict';

/**
 * @repository PlanRequestRepository
 *
 * Solicitudes de PLAN PRINCIPAL por usuario.
 * Colección MongoDB: `planRequests`
 *
 * Estados:
 *   pending    → recién solicitado, esperando admin
 *   active     → aprobado, vigente
 *   rejected   → rechazado por admin
 *   expired    → vencido por fecha (visible como histórico)
 *   cancelled  → cancelado por el usuario
 *
 * INVARIANTE: un usuario sólo puede tener UN documento en estado
 * `pending` o `active` simultáneamente. El resto son histórico.
 *
 * Documento:
 *   {
 *     _id, userId(ObjectId), planId(ObjectId), planCode,
 *     planSnapshot: { name, price, currency, interval },
 *     status, notes,
 *     requestedAt, decidedAt, decidedBy, startDate, endDate,
 *   }
 */

const { ObjectId } = require('mongodb');
const { getDB }    = require('../persistence/mongoClient');

const ACTIVE_LIKE = ['pending', 'active'];

class PlanRequestRepository {

  async _col() {
    const db = await getDB();
    return db.collection('planRequests');
  }

  /** Inserta una nueva request. Devuelve el doc creado. */
  async create({ userId, planId, planCode, planSnapshot, notes }) {
    const col = await this._col();
    const now = new Date().toISOString();

    const doc = {
      userId:       new ObjectId(String(userId)),
      planId:       new ObjectId(String(planId)),
      planCode:     planCode || null,
      planSnapshot: planSnapshot || null,
      status:       'pending',
      notes:        notes || '',
      requestedAt:  now,
      decidedAt:    null,
      decidedBy:    null,
      startDate:    null,
      endDate:      null,
    };

    const result = await col.insertOne(doc);
    return this._toPublic({ ...doc, _id: result.insertedId });
  }

  /** Devuelve el plan vigente (pending o active) del usuario, o null. */
  async findCurrentForUser(userId) {
    let oid;
    try { oid = new ObjectId(String(userId)); } catch { return null; }
    const col = await this._col();
    const doc = await col.findOne({
      userId: oid,
      status: { $in: ACTIVE_LIKE },
    });
    return doc ? this._toPublic(doc) : null;
  }

  /** Todas las requests del usuario (incluye histórico). */
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

  /** Para el panel de admin: todas las requests (cualquier user). */
  async findAll({ status } = {}) {
    const col = await this._col();
    const query = status ? { status } : {};
    const docs = await col
      .find(query)
      .sort({ requestedAt: -1 })
      .toArray();
    return docs.map((d) => this._toPublic(d));
  }

  async findById(id) {
    let oid;
    try { oid = new ObjectId(String(id)); } catch { return null; }
    const col = await this._col();
    const doc = await col.findOne({ _id: oid });
    return doc ? this._toPublic(doc) : null;
  }

  /** Aprueba una request → status='active', startDate=now. */
  async approve(id, { adminId, startDate, endDate } = {}) {
    let oid;
    try { oid = new ObjectId(String(id)); } catch { return null; }
    const col = await this._col();
    const now = new Date().toISOString();
    const update = {
      status:    'active',
      decidedAt: now,
      decidedBy: adminId ? new ObjectId(String(adminId)) : null,
      startDate: startDate || now,
      endDate:   endDate || null,
    };
    const result = await col.findOneAndUpdate(
      { _id: oid },
      { $set: update },
      { returnDocument: 'after' }
    );
    const doc = result && (result.value || result);
    return doc && doc._id ? this._toPublic(doc) : null;
  }

  /** Rechaza una request → status='rejected'. */
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

  /** Helper para chequear la invariante antes de crear. */
  async hasActiveOrPending(userId) {
    const current = await this.findCurrentForUser(userId);
    return Boolean(current);
  }

  _toPublic(doc) {
    return {
      id:           String(doc._id),
      userId:       doc.userId ? String(doc.userId) : null,
      planId:       doc.planId ? String(doc.planId) : null,
      planCode:     doc.planCode || null,
      planSnapshot: doc.planSnapshot || null,
      status:       doc.status,
      notes:        doc.notes || '',
      requestedAt:  doc.requestedAt || null,
      decidedAt:    doc.decidedAt || null,
      decidedBy:    doc.decidedBy ? String(doc.decidedBy) : null,
      startDate:    doc.startDate || null,
      endDate:      doc.endDate || null,
    };
  }
}

module.exports = new PlanRequestRepository();
