'use strict';

/**
 * authMiddleware.js
 * Colocar en: src/middleware/authMiddleware.js
 *
 * Extrae y verifica el JWT del header Authorization.
 * Añade req.user = { id, email, role } para los controllers.
 *
 * Causas comunes de 401:
 *  1. Header no llega   → CORS bloqueando preflight OPTIONS
 *  2. Bug en frontend   → headers: { headers: { Authorization } }  ← DETECTADO
 *  3. Token expirado    → regenerar haciendo login
 *  4. Secret distinto   → JWT_SECRET en .env ≠ al usado al firmar
 */

const authService = require('../services/AuthService');

/**
 * Middleware de autenticación estándar.
 * Uso: router.get('/ruta', requireAuth, controller)
 */
async function requireAuth(req, res, next) {
  // ─── 1. Extraer el header ──────────────────────────────────────────────
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  console.log(`[requireAuth] ${req.method} ${req.path}`);
  console.log('[requireAuth] Authorization header:', authHeader ? `${authHeader.slice(0, 30)}...` : 'AUSENTE');

  if (!authHeader) {
    console.warn('[requireAuth] ✗ Header Authorization ausente → 401');
    return res.status(401).json({
      error: 'No autenticado',
      detail: 'Falta el header Authorization: Bearer <token>',
    });
  }

  // ─── 2. Extraer el token ───────────────────────────────────────────────
  // Formato esperado: "Bearer eyJhbGciOiJIUzI1NiJ9..."
  if (!authHeader.startsWith('Bearer ')) {
    console.warn('[requireAuth] ✗ Formato incorrecto → esperado "Bearer <token>"');
    return res.status(401).json({
      error: 'Formato de token inválido',
      detail: 'El header debe tener formato: Authorization: Bearer <token>',
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    console.warn('[requireAuth] ✗ Token vacío tras "Bearer "');
    return res.status(401).json({ error: 'Token vacío' });
  }

  // ─── 3. Verificar el token ────────────────────────────────────────────
  try {
    const payload = await authService.verifyToken(token);

    // Añadir usuario a la request para que los controllers lo usen
    req.user = {
      id:    String(payload.id || payload.sub),
      email: payload.email,
      role:  payload.role || 'user',
    };

    console.log('[requireAuth] ✓ Autenticado:', req.user);
    next();

  } catch (err) {
    console.error('[requireAuth] ✗ Error verificando token:', err.message);
    return res.status(err.status || 401).json({
      error: err.message || 'Token inválido',
    });
  }
}

/**
 * Middleware de autorización admin.
 * Úsalo DESPUÉS de requireAuth.
 * Uso: router.get('/admin/ruta', requireAuth, requireAdmin, controller)
 */
function requireAdmin(req, res, next) {
  console.log('[requireAdmin] rol del usuario:', req.user?.role);

  if (!req.user || req.user.role !== 'admin') {
    console.warn('[requireAdmin] ✗ Acceso denegado — rol requerido: admin');
    return res.status(403).json({ error: 'Acceso denegado: se requiere rol admin' });
  }

  console.log('[requireAdmin] ✓ Admin verificado');
  next();
}

module.exports = { requireAuth, requireAdmin };