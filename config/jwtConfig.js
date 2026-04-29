/**
 * @config jwtConfig.js
 * Configuración centralizada para la generación y verificación de tokens.
 *
 * ─── GUÍA DE MIGRACIÓN ───────────────────────────────────────────────────────
 * Cuando se añada `jsonwebtoken`, este archivo ya tiene todo lo necesario:
 *   jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
 *   jwt.verify(token, JWT_SECRET)
 * Solo hay que importar `jwt` y usarlo en authService.js.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * En producción, JWT_SECRET debe venir de una variable de entorno segura,
 * nunca hardcodeada en el código fuente.
 */

const jwtConfig = {
  /**
   * Clave secreta para firmar/verificar tokens.
   * TODO: mover a variable de entorno → process.env.JWT_SECRET
   */
  secret: process.env.JWT_SECRET || 'mfdezstudio_dev_secret_changeme',

  /**
   * Tiempo de expiración del token.
   * Formato compatible con la librería `jsonwebtoken`: '1h', '7d', etc.
   */
  expiresIn: process.env.JWT_EXPIRES_IN || '1h',

  /**
   * Algoritmo a usar cuando se integre jsonwebtoken.
   * @see https://github.com/auth0/node-jsonwebtoken#algorithms-supported
   */
  algorithm: 'HS256',
};

module.exports = jwtConfig;