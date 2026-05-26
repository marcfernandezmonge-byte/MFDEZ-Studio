/**
 * @repository UserRepository
 * Responsabilidad exclusiva: acceso a datos de usuarios en MongoDB.
 *
 * Toda operación de BD pasa por aquí — services nunca tocan getDB() directamente.
 *
 * Colección: users
 *
 * ─── GUÍA DE MIGRACIÓN ───────────────────────────────────────────────────────
 * Este repositorio ya es la versión MongoDB. Para volver a in-memory,
 * reemplazar las queries por operaciones sobre el array `users` de Db.js.
 * La firma de los métodos es idéntica.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { ObjectId }  = require('mongodb');
const { getDB }     = require('../persistence/mongoClient');
const User          = require('../domain/User');

class UserRepository {

  /** @returns {Promise<import('mongodb').Collection>} */
  async _col() {
    const db = await getDB();
    return db.collection('users');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Inserta un nuevo usuario y lo devuelve con el _id asignado por Mongo.
   *
   * Backward-compatible: las llamadas existentes (register local) pasan
   * `{ name, email, password }` y obtienen `provider='local'` por defecto.
   * Las llamadas OAuth pasan `{ provider: 'google', googleId, avatar }`
   * y omiten `password` (puede quedar como `null`).
   *
   * @param {{
   *   username?: string,
   *   name?: string,
   *   email: string,
   *   password?: string | null,
   *   role?: string,
   *   provider?: 'local' | 'google',
   *   googleId?: string | null,
   *   avatar?: string | null,
   * }} data
   * @returns {Promise<User>}
   */
  async save({
    username,
    name,
    email,
    password = null,
    role     = 'client',
    provider = 'local',
    googleId = null,
    avatar   = null,
  }) {
    const col = await this._col();

    const doc = {
      username:     username || name || '',
      email:        email.toLowerCase(),
      password,                       // null para OAuth — User domain lo soporta
      role,
      provider,
      googleId,
      avatar,
      isSubscribed: false,
      createdAt:    new Date().toISOString(),
    };

    const result = await col.insertOne(doc);
    return new User({ ...doc, _id: result.insertedId });
  }

  /**
   * Alias semántico de save() — más expresivo para registro.
   */
  async createUser(data) {
    return this.save(data);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // READ
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Busca por email (case-insensitive).
   * @param {string} email
   * @returns {Promise<User | null>}
   */
  async findByEmail(email) {
    const col = await this._col();
    const doc = await col.findOne({ email: email.toLowerCase() });
    return doc ? new User({ ...doc, _id: doc._id }) : null;
  }

  /**
   * Busca por ID (acepta string o ObjectId).
   * @param {string|import('mongodb').ObjectId} id
   * @returns {Promise<User | null>}
   */
  async findById(id) {
    const col = await this._col();
    let oid;
    try {
      oid = id instanceof ObjectId ? id : new ObjectId(String(id));
    } catch {
      return null; // ID con formato inválido
    }
    const doc = await col.findOne({ _id: oid });
    return doc ? new User({ ...doc, _id: doc._id }) : null;
  }

  /**
   * Devuelve todos los usuarios (admin).
   * @returns {Promise<User[]>}
   */
  async findAll() {
    const col  = await this._col();
    const docs = await col.find({}).toArray();
    return docs.map(d => new User({ ...d, _id: d._id }));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UPDATE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Actualiza campos del usuario.
   * @param {string} id
   * @param {object} data — campos a actualizar (nunca incluir password aquí)
   * @returns {Promise<boolean>}
   */
  async updateUser(id, data) {
    const col    = await this._col();
    let oid;
    try { oid = new ObjectId(String(id)); } catch { return false; }

    // Prevenir actualización accidental de campos sensibles por esta vía
    const { password: _, _id: __, ...safeData } = data;

    const result = await col.updateOne({ _id: oid }, { $set: safeData });
    return result.matchedCount > 0;
  }

  /**
   * Actualiza la contraseña hasheada de un usuario.
   * @param {string} id
   * @param {string} newHashedPassword — ya hasheada con bcrypt
   * @returns {Promise<boolean>}
   */
  async updatePassword(id, newHashedPassword) {
    const col = await this._col();
    let oid;
    try { oid = new ObjectId(String(id)); } catch { return false; }

    const result = await col.updateOne(
      { _id: oid },
      { $set: { password: newHashedPassword } }
    );
    return result.matchedCount > 0;
  }

  /**
   * Activa la suscripción y guarda billingInfo.
   *
   * SEGURIDAD (defensa en profundidad):
   *   - Este método FILTRA campos sensibles (cardNumber/cvv/cvc/pan/etc.)
   *     antes de persistir. La fuente legítima de datos de tarjeta es
   *     `PaymentService` + `PaymentRepository`, que solo guardan
   *     `{brand, last4, expMonth, expYear, holder}`.
   *   - Aunque el caller pase un objeto con PAN/CVV, NO se persistirá.
   *
   * @param {string} id
   * @param {Object} billingInfo — solo campos permitidos quedan persistidos.
   * @returns {Promise<User | null>}
   */
  async updateSubscription(id, billingInfo) {
    const col = await this._col();
    let oid;
    try { oid = new ObjectId(String(id)); } catch { return null; }

    const safe = _sanitizeBillingInfo(billingInfo);

    await col.updateOne(
      { _id: oid },
      { $set: { isSubscribed: true, billingInfo: safe } }
    );

    return this.findById(id);
  }

  async getMembershipByUserId(id) {
    const user = await this.findById(id);
    if (!user) return null;

    const billingInfo = user.billingInfo || {};
    const since = billingInfo.since || user.createdAt || new Date().toISOString();
    const renewal = billingInfo.renewal || this._addOneYear(since);

    return {
      active: Boolean(user.isSubscribed),
      tier: "Collector's Club",
      since,
      renewal,
      plan: billingInfo.plan || "Collector's Club · 15€/mes",
      status: user.isSubscribed ? 'active' : 'inactive',
      benefits: ['Acceso anticipado', 'Descuentos VIP'],
    };
  }

  async setMembershipStatus(id, active) {
    const col = await this._col();
    let oid;
    try { oid = new ObjectId(String(id)); } catch { return null; }

    const existing = await this.findById(id);
    if (!existing) return null;

    const nextBillingInfo = active
      ? {
          ...(existing.billingInfo || {}),
          plan: (existing.billingInfo && existing.billingInfo.plan) || "Collector's Club · 15€/mes",
          since: (existing.billingInfo && existing.billingInfo.since) || new Date().toISOString(),
          renewal: this._addOneYear(
            (existing.billingInfo && existing.billingInfo.since) || new Date().toISOString()
          ),
        }
      : null;

    await col.updateOne(
      { _id: oid },
      {
        $set: {
          isSubscribed: Boolean(active),
          billingInfo: nextBillingInfo,
        },
      }
    );

    return this.findById(id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DELETE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteUser(id) {
    const col = await this._col();
    let oid;
    try { oid = new ObjectId(String(id)); } catch { return false; }

    const result = await col.deleteOne({ _id: oid });
    return result.deletedCount > 0;
  }

  /**
   * Suscribe al usuario: activa isSubscribed y guarda billingInfo + fechas.
   * Acepta metadatos seguros del pago (paymentRef + cardBrand + cardLast4),
   * generados por PaymentService a partir de un Payment confirmado.
   *
   * NUNCA acepta cardNumber/cvv aunque vengan en `options`: `updateSubscription`
   * los filtra defensivamente.
   *
   * @param {string} id
   * @param {{ plan?: string, paymentRef?: string, cardBrand?: string, cardLast4?: string }} options
   * @returns {Promise<User | null>}
   */
  async subscribeUser(id, options = {}) {
    const now = new Date().toISOString();
    const billingInfo = {
      plan:       options.plan       || "Collector's Club · 15€/mes",
      since:      now,
      renewal:    this._addOneYear(now),
      paymentRef: options.paymentRef || null,
      cardBrand:  options.cardBrand  || null,
      cardLast4:  options.cardLast4  || null,
    };
    return this.updateSubscription(id, billingInfo);
  }

  /**
   * Cancela la suscripción: pone isSubscribed a false y borra billingInfo.
   * @param {string} id
   * @returns {Promise<User | null>}
   */
  async cancelSubscription(id) {
    return this.setMembershipStatus(id, false);
  }

  _addOneYear(dateString) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString();
  }
}

/**
 * Whitelist de campos permitidos en `users.billingInfo`.
 * Cualquier otro campo (cardNumber, cvv, cvc, pan, ...) se descarta.
 */
const BILLING_ALLOWED = [
  'plan', 'since', 'renewal',
  'paymentRef', 'cardBrand', 'cardLast4',
];

function _sanitizeBillingInfo(billingInfo) {
  if (!billingInfo || typeof billingInfo !== 'object') return null;
  const out = {};
  for (const key of BILLING_ALLOWED) {
    if (billingInfo[key] !== undefined) out[key] = billingInfo[key];
  }
  return out;
}

module.exports = new UserRepository();