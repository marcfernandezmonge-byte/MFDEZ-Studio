/**
 * @domain User
 * Entidad del dominio. Mapea el esquema MongoDB de la colección `users`.
 *
 * Campos:
 *   _id          — ObjectId de MongoDB (string cuando se serializa)
 *   username     — nombre de usuario visible
 *   email        — único en la colección
 *   password     — SIEMPRE hasheado con bcrypt en persistencia
 *   role         — 'admin' | 'user'
 *   isSubscribed — false por defecto; true al suscribirse al Club
 *   createdAt    — ISO 8601
 *   billingInfo  — SOLO existe si isSubscribed === true
 *
 * SEGURIDAD: toPublicProfile() nunca devuelve password, cvv ni cardNumber.
 */

'use strict';

class User {
  constructor({
    _id,
    id,
    username,
    name,
    email,
    password,
    role         = 'user',
    isSubscribed = false,
    billingInfo  = null,
    createdAt    = new Date().toISOString(),
  }) {
    this._id         = _id  || null;
    this.id          = id   || (_id ? _id.toString() : undefined);

    // Soportar tanto `username` (nuevo esquema) como `name` (esquema anterior)
    this.username    = username || name || '';
    this.name        = this.username;

    this.email       = email;
    this.password    = password;
    this.role        = role;
    this.isSubscribed = isSubscribed;
    this.createdAt   = createdAt;
    this.billingInfo = isSubscribed ? (billingInfo || null) : null;
  }

  /**
   * Representación pública. NUNCA incluye password, cvv ni cardNumber.
   */
  toPublicProfile() {
    const profile = {
      id:           this.id,
      username:     this.username,
      name:         this.name,
      email:        this.email,
      role:         this.role,
      isSubscribed: this.isSubscribed,
      createdAt:    this.createdAt,
    };

    if (this.isSubscribed && this.billingInfo) {
      profile.billingInfo = {
        cardHolder:     this.billingInfo.cardHolder     || '',
        billingAddress: this.billingInfo.billingAddress || '',
        expiryDate:     this.billingInfo.expiryDate     || '',
        // cardNumber y cvv NUNCA se devuelven
      };
    }

    return profile;
  }

  /** Documento listo para MongoDB (incluye billingInfo completo). */
  toMongoDoc() {
    const doc = {
      username:     this.username,
      email:        this.email,
      password:     this.password,
      role:         this.role,
      isSubscribed: this.isSubscribed,
      createdAt:    this.createdAt,
    };
    if (this.isSubscribed && this.billingInfo) {
      doc.billingInfo = this.billingInfo;
    }
    return doc;
  }
}

module.exports = User;