'use strict';

/**
 * @repository PlanRepository
 *
 * Catálogo de PLANES PRINCIPALES comerciales (no membresía Collector's Club).
 * Colección MongoDB: `plans`
 *
 * Diseño additivo — la membresía legacy (`isSubscribed`, `billingInfo`) sigue
 * funcionando aparte y no se toca desde aquí.
 *
 * Si la colección está vacía la primera vez que se lee, se siembra con un set
 * por defecto para que el frontend pueda renderizar sin configuración manual.
 *
 * Estructura de un plan:
 *   {
 *     _id, code, name, description, price, currency, interval,
 *     features: [string], active, createdAt, updatedAt
 *   }
 */

const { ObjectId } = require('mongodb');
const { getDB }    = require('../persistence/mongoClient');

const DEFAULT_PLANS = [
  {
    code: 'starter',
    name: 'Starter',
    description: 'Plan inicial para proyectos pequeños.',
    price: 49,
    currency: 'EUR',
    interval: 'month',
    features: [
      'Soporte por email',
      'Hasta 2 proyectos activos',
      'Entrega estándar',
    ],
    active: true,
  },
  {
    code: 'studio',
    name: 'Studio',
    description: 'Plan recomendado para marcas en crecimiento.',
    price: 149,
    currency: 'EUR',
    interval: 'month',
    features: [
      'Soporte prioritario',
      'Proyectos ilimitados',
      'Revisiones mensuales',
      'Branding y dirección de arte',
    ],
    active: true,
  },
  {
    code: 'atelier',
    name: 'Atelier',
    description: 'Plan integral con acompañamiento creativo continuo.',
    price: 349,
    currency: 'EUR',
    interval: 'month',
    features: [
      'Dirección creativa dedicada',
      'Reuniones semanales',
      'Producción audiovisual',
      'Acceso a sesiones privadas',
    ],
    active: true,
  },
];

class PlanRepository {

  async _col() {
    const db = await getDB();
    return db.collection('plans');
  }

  /** Siembra el catálogo si está vacío. Idempotente. */
  async _ensureSeed() {
    const col = await this._col();
    const count = await col.countDocuments({});
    if (count > 0) return;

    const now = new Date().toISOString();
    const docs = DEFAULT_PLANS.map((p) => ({
      ...p,
      createdAt: now,
      updatedAt: now,
    }));
    await col.insertMany(docs);
    console.log('[PlanRepository] catálogo sembrado:', docs.length);
  }

  /** Devuelve todos los planes activos del catálogo. */
  async findAllActive() {
    await this._ensureSeed();
    const col = await this._col();
    const docs = await col.find({ active: { $ne: false } }).toArray();
    return docs.map(this._toPublic);
  }

  /** Busca un plan por su ObjectId. */
  async findById(id) {
    let oid;
    try { oid = new ObjectId(String(id)); } catch { return null; }
    const col = await this._col();
    const doc = await col.findOne({ _id: oid });
    return doc ? this._toPublic(doc) : null;
  }

  /** Busca por code (slug). */
  async findByCode(code) {
    if (!code) return null;
    const col = await this._col();
    const doc = await col.findOne({ code: String(code).toLowerCase() });
    return doc ? this._toPublic(doc) : null;
  }

  _toPublic(doc) {
    return {
      id:          String(doc._id),
      code:        doc.code,
      name:        doc.name,
      description: doc.description || '',
      price:       doc.price,
      currency:    doc.currency || 'EUR',
      interval:    doc.interval || 'month',
      features:    Array.isArray(doc.features) ? doc.features : [],
      active:      doc.active !== false,
      createdAt:   doc.createdAt || null,
      updatedAt:   doc.updatedAt || null,
    };
  }
}

module.exports = new PlanRepository();
