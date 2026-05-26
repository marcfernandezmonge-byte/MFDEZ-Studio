'use strict';

/**
 * @repository PaymentRepository
 *
 * Persistencia de pagos (SIMULADOS).
 * Colección MongoDB: `payments`.
 *
 * GUARDRAILS:
 *   - Esta colección JAMÁS debe contener `cardNumber` ni `cvc/cvv` ni `pan`.
 *   - El service que llama (PaymentService) usa `PaymentPolicy.sanitizeCardForStorage`
 *     para reducir la tarjeta a `{brand, last4, expMonth, expYear, holder}` antes
 *     de pasarla aquí.
 *   - Si en el futuro alguien añade un campo sensible al doc, romper build.
 *
 * Documento:
 *   {
 *     _id, userId(ObjectId), purpose ('club_subscription'|'service_request'|...),
 *     amount(Number), currency(String, default 'EUR'),
 *     status('confirmed'|'failed'|'refunded'),
 *     card: { brand, last4, expMonth, expYear, holder },
 *     simulated(true),                  // marca explícita: NO es pago real
 *     createdAt(ISO), confirmedAt(ISO),
 *     meta(Object|null),                // p. ej. { planCode, serviceCode }
 *   }
 */

const { ObjectId } = require('mongodb');
const { getDB }    = require('../persistence/mongoClient');

const COLLECTION = 'payments';
const FORBIDDEN_KEYS = ['cardNumber', 'pan', 'number', 'cvv', 'cvc', 'cardCVC', 'cardCvv'];

class PaymentRepository {

  constructor() {
    this._indexesEnsured = false;
  }

  async _col() {
    const db  = await getDB();
    const col = db.collection(COLLECTION);
    if (!this._indexesEnsured) {
      try {
        await Promise.all([
          col.createIndex({ userId: 1, createdAt: -1 }, { name: 'user_recent' }),
          col.createIndex({ status: 1 },                { name: 'by_status' }),
        ]);
      } catch (err) {
        console.warn('[PaymentRepository] createIndex warn:', err.message);
      }
      this._indexesEnsured = true;
    }
    return col;
  }

  _assertSafeCard(card) {
    if (!card || typeof card !== 'object') return;
    for (const key of FORBIDDEN_KEYS) {
      if (key in card) {
        throw new Error(`PaymentRepository: campo prohibido en card.${key}. Sanitiza antes de persistir.`);
      }
    }
  }

  async create(input) {
    this._assertSafeCard(input?.card);

    const now = new Date().toISOString();
    const doc = {
      userId:      new ObjectId(String(input.userId)),
      purpose:     String(input.purpose || 'generic'),
      amount:      Number.isFinite(input.amount) ? Number(input.amount) : 0,
      currency:    String(input.currency || 'EUR').toUpperCase(),
      status:      String(input.status || 'confirmed'),
      card: {
        brand:    input.card?.brand    || 'unknown',
        last4:    String(input.card?.last4 || '').slice(-4),
        expMonth: input.card?.expMonth ?? null,
        expYear:  input.card?.expYear  ?? null,
        holder:   String(input.card?.holder || '').slice(0, 60),
      },
      simulated:   true,
      createdAt:   now,
      confirmedAt: input.status === 'confirmed' ? now : null,
      meta:        input.meta || null,
    };

    const col = await this._col();
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

  async findByUser(userId, { purpose, status } = {}) {
    let oid;
    try { oid = new ObjectId(String(userId)); } catch { return []; }
    const query = { userId: oid };
    if (purpose) query.purpose = purpose;
    if (status)  query.status  = status;
    const col   = await this._col();
    const docs  = await col.find(query).sort({ createdAt: -1 }).toArray();
    return docs.map((d) => this._toPublic(d));
  }

  _toPublic(doc) {
    return {
      id:          String(doc._id),
      userId:      doc.userId ? String(doc.userId) : null,
      purpose:     doc.purpose,
      amount:      doc.amount,
      currency:    doc.currency,
      status:      doc.status,
      card:        doc.card || null,
      simulated:   Boolean(doc.simulated),
      createdAt:   doc.createdAt || null,
      confirmedAt: doc.confirmedAt || null,
      meta:        doc.meta || null,
    };
  }
}

module.exports = new PaymentRepository();
