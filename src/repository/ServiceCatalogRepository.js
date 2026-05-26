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

// ─── CANONICAL CATALOG ────────────────────────────────────────────────
// Fuente única de verdad para PRECIOS de servicios puntuales. Debe coincidir
// con lo mostrado en /servicios (servicios.html, sección Servicios Puntuales).
// El precio aquí es el "Desde €X" — los sub-items específicos se acuerdan en
// la propuesta tras la solicitud.
//
// Nombres y categorías alineados con los `data-service-label` del HTML para
// que los snapshots persistidos coincidan exactamente con lo que el usuario
// vio antes de solicitar.
const DEFAULT_SERVICES = [
  {
    code: 'photo-session',
    name: 'Fin de Semana Carrera',
    description: 'Cobertura foto y vídeo de un fin de semana de carrera. Desde "Solo fotografía".',
    price: 650,
    currency: 'EUR',
    category: 'photo',
    active: true,
  },
  {
    code: 'logo-design',
    name: 'Diseño Rápido',
    description: 'Piezas gráficas puntuales: posts, stories, pódium, banners.',
    price: 80,
    currency: 'EUR',
    category: 'branding',
    active: true,
  },
  {
    code: 'special-shoot',
    name: 'Shoots Especiales',
    description: 'Media Day, sponsor activation, retrato piloto, shooting coche.',
    price: 350,
    currency: 'EUR',
    category: 'photo',
    active: true,
  },
  {
    code: 'web-landing',
    name: 'Digital / Web',
    description: 'Landing sponsor, web de equipo o e-commerce de prints.',
    price: 800,
    currency: 'EUR',
    category: 'web',
    active: true,
  },
  {
    code: 'creative-consult',
    name: 'Proyecto a medida',
    description: 'Briefing creativo y propuesta personalizada (presupuesto orientativo tras revisión).',
    price: 0,
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

  /**
   * Sincroniza el catálogo canónico con MongoDB.
   * Idempotente — upsert por `code`. Ver PlanRepository._ensureSeed.
   *
   * Las requests YA creadas (serviceRequests) mantienen su `serviceSnapshot`
   * histórico intacto — sólo las solicitudes NUEVAS usarán los precios
   * canónicos actualizados.
   */
  async _ensureSeed() {
    const col = await this._col();
    const now = new Date().toISOString();
    let created = 0;
    let updated = 0;

    for (const s of DEFAULT_SERVICES) {
      const result = await col.updateOne(
        { code: s.code },
        {
          $set: {
            name:        s.name,
            description: s.description,
            price:       s.price,
            currency:    s.currency,
            category:    s.category,
            active:      s.active,
            updatedAt:   now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );
      if (result.upsertedCount) created++;
      else if (result.modifiedCount) updated++;
    }

    if (created || updated) {
      console.log(`[ServiceCatalogRepository] catálogo sincronizado: +${created} creados, ~${updated} actualizados`);
    }
  }

  async findAllActive() {
    await this._ensureSeed();
    const col = await this._col();
    const docs = await col.find({ active: { $ne: false } }).toArray();
    return docs.map(this._toPublic);
  }

  async findById(id) {
    await this._ensureSeed();
    let oid;
    try { oid = new ObjectId(String(id)); } catch { return null; }
    const col = await this._col();
    const doc = await col.findOne({ _id: oid });
    return doc ? this._toPublic(doc) : null;
  }

  async findByCode(code) {
    if (!code) return null;
    await this._ensureSeed();
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
