'use strict';

/**
 * @repository ServiceEntitlementRepository
 *
 * Capa de persistencia para entitlements de servicio.
 * Colección MongoDB: `serviceEntitlements`
 *
 * Aditivo (guardrails §0):
 *   - NO toca `users`, `services` legacy ni Collectors Club.
 *   - Se genera al aprobar una `serviceRequest`; idempotente por `requestId`.
 *
 * Documento:
 *   {
 *     _id,
 *     userId         (ObjectId, ref users),
 *     requestId      (ObjectId, ref serviceRequests, ÚNICO),
 *     serviceCode    (String, p. ej. 'logo-design'),
 *     category       (String, p. ej. 'branding'),
 *     entitlementKey (String, p. ej. 'ent_branding'),
 *     serviceSnapshot{ name, price, currency, category },
 *     status         ('active'|'expired'|'cancelled'|'completed'),
 *     validFrom      (ISO),
 *     validUntil     (ISO | null),
 *     grantedAt      (ISO),
 *     grantedBy      (ObjectId admin),
 *     revokedAt      (ISO | null),
 *     revokedBy      (ObjectId | null),
 *     notes          (String),
 *   }
 */

const { ObjectId } = require('mongodb');
const { getDB }    = require('../persistence/mongoClient');

const COLLECTION = 'serviceEntitlements';

class ServiceEntitlementRepository {

  constructor() {
    this._indexesEnsured = false;
  }

  async _col() {
    const db  = await getDB();
    const col = db.collection(COLLECTION);
    if (!this._indexesEnsured) {
      try {
        await Promise.all([
          col.createIndex({ requestId: 1 }, { unique: true, name: 'uniq_requestId' }),
          col.createIndex({ userId: 1, status: 1 }, { name: 'user_status' }),
          col.createIndex({ entitlementKey: 1 },    { name: 'by_key' }),
        ]);
      } catch (err) {
        console.warn('[ServiceEntitlementRepository] createIndex warn:', err.message);
      }
      this._indexesEnsured = true;
    }
    return col;
  }

  async findByRequestId(requestId) {
    let oid;
    try { oid = new ObjectId(String(requestId)); } catch { return null; }
    const col = await this._col();
    const doc = await col.findOne({ requestId: oid });
    return doc ? this._toPublic(doc) : null;
  }

  async findById(id) {
    let oid;
    try { oid = new ObjectId(String(id)); } catch { return null; }
    const col = await this._col();
    const doc = await col.findOne({ _id: oid });
    return doc ? this._toPublic(doc) : null;
  }

  /**
   * Inserta un nuevo entitlement. Idempotente por requestId:
   * si ya existe uno para ese requestId, devuelve el existente sin error.
   */
  async create(input) {
    const col = await this._col();
    const now = new Date().toISOString();

    const doc = {
      userId:          new ObjectId(String(input.userId)),
      requestId:       new ObjectId(String(input.requestId)),
      serviceCode:     input.serviceCode || null,
      category:        input.category || null,
      entitlementKey:  input.entitlementKey,
      serviceSnapshot: input.serviceSnapshot || null,
      status:          input.status || 'active',
      validFrom:       input.validFrom || now,
      validUntil:      input.validUntil || null,
      grantedAt:       input.grantedAt || now,
      grantedBy:       input.grantedBy ? new ObjectId(String(input.grantedBy)) : null,
      revokedAt:       null,
      revokedBy:       null,
      notes:           input.notes || '',
    };

    try {
      const result = await col.insertOne(doc);
      return this._toPublic({ ...doc, _id: result.insertedId });
    } catch (err) {
      // Índice único de requestId → otro grant simultáneo ya creó el doc.
      if (err && err.code === 11000) {
        const existing = await col.findOne({ requestId: doc.requestId });
        return existing ? this._toPublic(existing) : null;
      }
      throw err;
    }
  }

  async findAllForUser(userId, { statuses } = {}) {
    let oid;
    try { oid = new ObjectId(String(userId)); } catch { return []; }
    const col   = await this._col();
    const query = { userId: oid };
    if (Array.isArray(statuses) && statuses.length) {
      query.status = { $in: statuses };
    }
    const docs = await col.find(query).sort({ grantedAt: -1 }).toArray();
    return docs.map((d) => this._toPublic(d));
  }

  async findAllAdmin({ status, userId, category } = {}) {
    const col   = await this._col();
    const query = {};
    if (status)   query.status = status;
    if (category) query.category = category;
    if (userId) {
      try { query.userId = new ObjectId(String(userId)); } catch { /* ignore */ }
    }
    const docs = await col.find(query).sort({ grantedAt: -1 }).toArray();
    return docs.map((d) => this._toPublic(d));
  }

  async updateStatus(id, status) {
    let oid;
    try { oid = new ObjectId(String(id)); } catch { return null; }
    const col = await this._col();
    const result = await col.findOneAndUpdate(
      { _id: oid },
      { $set: { status } },
      { returnDocument: 'after' }
    );
    const doc = result && (result.value || result);
    return doc && doc._id ? this._toPublic(doc) : null;
  }

  async revoke(id, { adminId, reason } = {}) {
    let oid;
    try { oid = new ObjectId(String(id)); } catch { return null; }
    const col = await this._col();
    const now = new Date().toISOString();
    const set = {
      status:    'cancelled',
      revokedAt: now,
      revokedBy: adminId ? new ObjectId(String(adminId)) : null,
    };
    if (reason) set.notes = reason;
    const result = await col.findOneAndUpdate(
      { _id: oid },
      { $set: set },
      { returnDocument: 'after' }
    );
    const doc = result && (result.value || result);
    return doc && doc._id ? this._toPublic(doc) : null;
  }

  async markExpiredBefore(nowISO) {
    const col = await this._col();
    const result = await col.updateMany(
      { status: 'active', validUntil: { $ne: null, $lt: nowISO } },
      { $set: { status: 'expired' } }
    );
    return { modifiedCount: result.modifiedCount || 0 };
  }

  _toPublic(doc) {
    return {
      id:              String(doc._id),
      userId:          doc.userId ? String(doc.userId) : null,
      requestId:       doc.requestId ? String(doc.requestId) : null,
      serviceCode:     doc.serviceCode || null,
      category:        doc.category || null,
      entitlementKey:  doc.entitlementKey,
      serviceSnapshot: doc.serviceSnapshot || null,
      status:          doc.status,
      validFrom:       doc.validFrom || null,
      validUntil:      doc.validUntil || null,
      grantedAt:       doc.grantedAt || null,
      grantedBy:       doc.grantedBy ? String(doc.grantedBy) : null,
      revokedAt:       doc.revokedAt || null,
      revokedBy:       doc.revokedBy ? String(doc.revokedBy) : null,
      notes:           doc.notes || '',
    };
  }
}

module.exports = new ServiceEntitlementRepository();
