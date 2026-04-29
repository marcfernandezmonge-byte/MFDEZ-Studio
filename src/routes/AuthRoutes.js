/**
 * @routes AuthRoutes
 * Responsabilidad: definir los endpoints de autenticación y delegar en el controller.
 *
 * Actúa como router minimalista compatible con http.createServer(),
 * diseñado para ser sustituido por un Express Router sin tocar nada más.
 *
 * ─── GUÍA DE MIGRACIÓN a Express ─────────────────────────────────────────────
 * Reemplazar este archivo por:
 *
 *   const router = require('express').Router();
 *   const authController = require('../controller/AuthController');
 *
 *   router.post('/login',            (req, res) => authController.login(req, res));
 *   router.post('/register',         (req, res) => authController.register(req, res));
 *   router.post('/recover-password', (req, res) => authController.recoverPassword(req, res));
 *
 *   module.exports = router;
 *
 * Y en server.js:
 *   app.use('/api/auth', authRoutes);
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Tabla de rutas de autenticación.
 * @type {Array<{ method: string, path: string, handler: Function }>}
 */

/*const AUTH_ROUTES = [
  {
    method:  'POST',
    path:    '/api/auth/login',
    handler: (req, res) => authController.login(req, res),
  },
  {
    method:  'POST',
    path:    '/api/auth/register',
    handler: (req, res) => authController.register(req, res),
  },
  {
    method:  'POST',
    path:    '/api/auth/recover-password',
    handler: (req, res) => authController.recoverPassword(req, res),
  },
];*/

/**
 * Intenta hacer match de la request con alguna ruta registrada.
 * @param {string} method - Método HTTP ('POST', 'GET', …)
 * @param {string} url    - URL de la request (puede incluir query string)
 * @returns {{ handler: Function } | null}
 */
/*function matchRoute(method, url) {
  const cleanUrl = url.split('?')[0];

  return AUTH_ROUTES.find(
    (r) => r.method === method.toUpperCase() && r.path === cleanUrl
  ) || null;
}

module.exports = { matchRoute };*/
const express = require('express');
const router = express.Router();
const authController = require('../controller/AuthController');

router.post('/auth/login', (req, res) => authController.login(req, res));
router.post('/auth/register', (req, res) => authController.register(req, res));
router.post('/auth/recover-password', (req, res) => authController.recoverPassword(req, res));

module.exports = router;