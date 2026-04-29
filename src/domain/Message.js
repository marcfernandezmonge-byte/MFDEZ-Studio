/**
 * @domain Message
 * Entidad del dominio que representa un mensaje de contacto.
 *
 * Estados posibles: nuevo → leido → archivado
 * La transición archivado → nuevo está bloqueada por el servicio.
 */

'use strict';

class Message {
  /**
   * @param {object} params
   * @param {string}  params.id           — UUID generado por Db.generateUUID()
   * @param {number}  params.userId       — ID del usuario remitente
   * @param {string}  params.userEmail    — Email del remitente (del token)
   * @param {string}  params.nombre       — Nombre visible del remitente
   * @param {string}  params.mensaje      — Cuerpo del mensaje
   * @param {string}  [params.fecha]      — ISO 8601 (default: ahora)
   * @param {string}  [params.estado]     — 'nuevo' | 'leido' | 'archivado'
   * @param {string}  [params.leidoEn]    — ISO 8601 o null
   * @param {string}  [params.archivadoEn] — ISO 8601 o null
   */
  constructor({
    id,
    userId,
    userEmail,
    nombre,
    mensaje,
    fecha       = new Date().toISOString(),
    estado      = 'nuevo',
    leidoEn     = null,
    archivadoEn = null,
  }) {
    this.id          = id;
    this.userId      = userId;
    this.userEmail   = userEmail;
    this.nombre      = nombre;
    this.mensaje     = mensaje;
    this.fecha       = fecha;
    this.estado      = estado;
    this.leidoEn     = leidoEn;
    this.archivadoEn = archivadoEn;
  }

  /**
   * Representación pública del mensaje (sin datos sensibles futuros).
   */
  toJSON() {
    return {
      id:          this.id,
      userId:      this.userId,
      userEmail:   this.userEmail,
      nombre:      this.nombre,
      mensaje:     this.mensaje,
      fecha:       this.fecha,
      estado:      this.estado,
      leidoEn:     this.leidoEn,
      archivadoEn: this.archivadoEn,
    };
  }
}

module.exports = Message;