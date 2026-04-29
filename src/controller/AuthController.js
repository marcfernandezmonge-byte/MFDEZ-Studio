/**
 * @controller AuthController
 * Responsabilidad: recibir la request, validar el input y devolver la respuesta HTTP.
 *
 * NO contiene lógica de negocio.
 * NO accede a la BD directamente.
 * Delega TODO el procesamiento en AuthService.
 *
 * ─── GUÍA DE MIGRACIÓN a Express ─────────────────────────────────────────────
 * Cuando se añada Express, los métodos de este controller no cambian.
 * Solo cambia cómo se llaman desde las rutas:
 *   router.post('/login',            (req, res) => authController.login(req, res))
 *   router.post('/register',         (req, res) => authController.register(req, res))
 *   router.post('/recover-password', (req, res) => authController.recoverPassword(req, res))
 * ─────────────────────────────────────────────────────────────────────────────
 */

const authService = require('../services/AuthService');

class AuthController {

  // ══════════════════════════════════════════════════════════════════════════
  // POST /api/auth/login
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Body:  { email, password }
   * 200:   { token }
   * 400:   { message }  ← input inválido
   * 401:   { message }  ← credenciales incorrectas
   * 500:   { message }  ← error inesperado
   */
async login(req, res) {
  try {
    const { email, password } = req.body || {};

    const validationError = this._validateCredentials(email, password);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const { token, user } = await authService.login(email, password);

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isSubscribed: user.isSubscribed,
      },
    });
  } catch (error) {
    if (error.message === 'Credenciales incorrectas') {
      return res.status(401).json({ message: error.message });
    }
    console.error('[AuthController.login]', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}
  // ══════════════════════════════════════════════════════════════════════════
  // POST /api/auth/register
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Body:  { name, email, password }
   * 201:   { success: true, user: { id, name, email }, token }
   * 400:   { success: false, message }  ← input inválido o email ya registrado
   * 500:   { success: false, message }  ← error inesperado
   */
  async register(req, res) {
    try {
      const { name, email, password } = req.body;

      // ── Validación de name ────────────────────────────────────────────
      const nameError = this._validateName(name);
      if (nameError) {
        return res.status(400).json({ success: false, message: nameError });
      }

      // ── Validación de email + password ────────────────────────────────
      const credError = this._validateCredentials(email, password);
      if (credError) {
        return res.status(400).json({ success: false, message: credError });
      }

      const { token, user } = await authService.register(name.trim(), email, password);

      return res.status(201).json({
        success: true,
        user:  {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isSubscribed: user.isSubscribed,
        },
        token,
      });

    } catch (error) {
      if (error.message === 'El email ya está registrado') {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error('[AuthController.register]', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // POST /api/auth/recover-password
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Body:  { email }
   * 200:   { message }  — respuesta genérica (no revela si el email existe)
   * 400:   { message }  ← input inválido
   * 404:   { message }  ← email no encontrado
   * 500:   { message }  ← error inesperado
   */
  async recoverPassword(req, res) {
    try {
      const { email } = req.body;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: 'El campo email es obligatorio' });
      }
      if (!this._isValidEmail(email)) {
        return res.status(400).json({ message: 'El formato del email no es válido' });
      }

      const result = await authService.recoverPassword(email);
      return res.status(200).json(result);

    } catch (error) {
      if (error.message === 'No existe ninguna cuenta con ese email') {
        return res.status(404).json({ message: error.message });
      }
      console.error('[AuthController.recoverPassword]', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Métodos privados de validación
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Valida el campo name para el registro.
   * @param {*} name
   * @returns {string|null} Mensaje de error o null si es válido
   */
  _validateName(name) {
    if (!name || typeof name !== 'string') {
      return 'El campo nombre es obligatorio';
    }
    if (name.trim().length < 2) {
      return 'El nombre debe tener al menos 2 caracteres';
    }
    return null;
  }

  /**
   * Valida email + password para login y register.
   * @returns {string|null} Mensaje de error o null si es válido
   */
  _validateCredentials(email, password) {
    if (!email || typeof email !== 'string') {
      return 'El campo email es obligatorio';
    }
    if (!this._isValidEmail(email)) {
      return 'El formato del email no es válido';
    }
    if (!password || typeof password !== 'string') {
      return 'El campo password es obligatorio';
    }
    if (password.length < 4) {
      return 'El password debe tener al menos 4 caracteres';
    }
    return null;
  }

  /**
   * @param {string} email
   * @returns {boolean}
   */
  _isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

module.exports = new AuthController();
