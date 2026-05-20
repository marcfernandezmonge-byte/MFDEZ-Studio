'use strict';

/**
 * @repository ServiceCatalogRepository
 *
 * Catálogo de SERVICIOS ONESHOT (puntuales, no recurrentes).
 * Colección MongoDB: `servicesCatalog`
 *
 * NOTA: distinto de la colección `services` (legacy, gestionada por
 * ServiceRepository.js), que almacena los servicios ya contratados por el
 * usuario. Esta colección es sólo el catálogo público.
 *
 * Si la colección está vacía la primera vez que se lee, se siembra con un
 * set por defecto para que el frontend pueda renderizar sin configuración
 * manual.
 */

const { ObjectId } = require('mongodb');
const { getDB }    = require('../persistence/mongoClient');

const DEFAULT_SERVICES = [
  {
    code: 'logo-design',
    name: 'Diseño de Logo',
    description: 'Identidad visual a medida con entregables vectoriales.',
    price: 350,
    currency: 'EUR',
    category: 'branding',
    active: true,
  },
  {
    code: 'web-landing',
    name: 'Landing Page',
    description: 'Página única optimizada para conversión.',
    price: 800,
    currency: 'EUR',
    category: 'web',
    active: true,
  },
  {
    code: 'photo-session',
    name: 'Sesión Fotográfica',
    description: 'Producción y dirección de fotografía de producto.',
    price: 600,
    currency: 'EUR',
    category: 'photo',
    active: true,
  },
  {
    code: 'creative-consult',
    name: 'Consultoría Creativa',
    description: 'Sesión 1:1 de estrategia y dirección de marca.',
    price: 180,
    currency: 'EUR',
    category: 'consulting',
    active: true,
  },
];

class ServiceCatalogRepository {

  async _col() {
    const db = await getDB();
    return db.collection('servicesCatalog');
  }

  async _ensureSeed() {
    const col = await this._col();
    const count = await col.countDocuments({});
    if (count > 0) return;

    const now = new Date().toISOString();
    const docs = DEFAULT_SERVICES.map((s) => ({
      ...s,
      createdAt: now,
      updatedAt: now,
    }));
    await col.insertMany(docs);
    console.log('[ServiceCatalogRepository] catálogo sembrado:', docs.length);
  }

  async findAllActive() {
    await this._ensureSeed();
    const col = await this._col();
    const docs = await col.find({ active: { $ne: false } }).toArray();
    return docs.map(this._toPublic);
  }

  async findById(id) {
    let oid;
    try { oid = new ObjectId(String(id)); } catch { return null; }
    const col = await this._col();
    const doc = await col.findOne({ _id: oid });
    return doc ? this._toPublic(doc) : null;
  }

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
      category:    doc.category || 'general',
      active:      doc.active !== false,
      createdAt:   doc.createdAt || null,
      updatedAt:   doc.updatedAt || null,
    };
  }
}

module.exports = new ServiceCatalogRepository();
