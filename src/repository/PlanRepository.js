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

// ─── CANONICAL CATALOG ────────────────────────────────────────────────
// Fuente única de verdad para PRECIOS de planes. Debe coincidir EXACTAMENTE
// con lo mostrado en /servicios (servicios.html, sección Paquetes). Si la
// página de marketing cambia un precio, este array es donde se actualiza.
//
// El método `_ensureSeed()` hace upsert por `code` — al reiniciar el server
// los precios canónicos se propagan a la colección `plans` sin requerir
// intervención manual en Mongo.
const DEFAULT_PLANS = [
  {
    code: 'starter',
    name: 'Pack Branding',
    description: 'Identidad visual profesional para tu equipo o piloto.',
    price: 1800,
    currency: 'EUR',
    interval: 'project',
    features: [
      'Identidad visual completa (logo, escudo, dorsales)',
      'Paleta, tipografías y patrones',
      'Manual de Marca PDF 20 páginas',
      'Plantillas redes sociales',
      'Creatividades de carrera (pódium, pole, fastest lap…)',
    ],
    active: true,
  },
  {
    code: 'studio',
    name: 'Pack Temporada',
    description: 'Cobertura completa durante toda la temporada en circuito.',
    price: 8500,
    currency: 'EUR',
    interval: 'season',
    features: [
      'Todo el Pack Branding incluido',
      '8 eventos de carrera cubiertos',
      '2 días foto + vídeo por cita',
      '15 fotos editadas por evento',
      '3 reels por evento',
      'Vídeo recap de temporada',
    ],
    active: true,
  },
  {
    code: 'atelier',
    name: 'Pack Marca Completa',
    description: 'Comunicación externalizada al 100% con soporte 365 días.',
    price: 15000,
    currency: 'EUR',
    interval: 'year',
    features: [
      'Incluye Packs Branding + Temporada',
      'Web completa (home, piloto, calendario, galería, contacto)',
      'Dirección de comunicación',
      'Reporte anual de marca',
      'Soporte continuo 365 días',
    ],
    active: true,
  },
];

class PlanRepository {

  async _col() {
    const db = await getDB();
    return db.collection('plans');
  }

  /**
   * Sincroniza el catálogo canónico con MongoDB.
   * Idempotente — upsert por `code`:
   *   - si el plan no existe → se crea con los valores canónicos
   *   - si existe con valores antiguos → se actualizan a los canónicos
   *   - documentos personalizados (con otros `code`) no se tocan
   *
   * Esto resuelve el caso real en producción donde la colección quedó
   * sembrada con valores obsoletos (49 / 149 / 349) y los precios visibles
   * en /servicios no coincidían con los `planSnapshot` persistidos.
   *
   * NOTA: las requests YA creadas (planRequests) mantienen su `planSnapshot`
   * histórico intacto — sólo las solicitudes NUEVAS usarán los valores
   * canónicos actualizados.
   */
  async _ensureSeed() {
    const col = await this._col();
    const now = new Date().toISOString();
    let created = 0;
    let updated = 0;

    for (const p of DEFAULT_PLANS) {
      const result = await col.updateOne(
        { code: p.code },
        {
          $set: {
            name:        p.name,
            description: p.description,
            price:       p.price,
            currency:    p.currency,
            interval:    p.interval,
            features:    p.features,
            active:      p.active,
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
      console.log(`[PlanRepository] catálogo sincronizado: +${created} creados, ~${updated} actualizados`);
    }
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
    await this._ensureSeed();
    let oid;
    try { oid = new ObjectId(String(id)); } catch { return null; }
    const col = await this._col();
    const doc = await col.findOne({ _id: oid });
    return doc ? this._toPublic(doc) : null;
  }

  /** Busca por code (slug). */
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
      interval:    doc.interval || 'month',
      features:    Array.isArray(doc.features) ? doc.features : [],
      active:      doc.active !== false,
      createdAt:   doc.createdAt || null,
      updatedAt:   doc.updatedAt || null,
    };
  }
}

module.exports = new PlanRepository();
