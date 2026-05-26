'use strict';

/**
 * AuthService.js — src/services/AuthService.js
 *
 * CAUSA DEL ERROR "authService.login is not a function":
 *   La versión anterior solo tenía métodos JWT auxiliares (hashPassword,
 *   comparePassword, generateToken, verifyToken). AuthController llama a
 *   authService.login(), authService.register() y authService.recoverPassword()
 *   que no existían → TypeError → Express devuelve 500.
 *
 * REQUISITOS: npm install jsonwebtoken bcrypt
 */

const jwt            = require('jsonwebtoken');
const bcrypt         = require('bcrypt');
const { OAuth2Client } = require('google-auth-library');
const jwtConfig      = require('../../config/jwtConfig');
const userRepository = require('../repository/UserRepository');

// Cliente Google compartido. CLIENT_ID lazy → permite arrancar el servidor
// aunque GOOGLE_CLIENT_ID aún no esté configurado; sólo falla cuando se
// intente verificar un token de Google.
let _googleClient = null;
function getGoogleClient() {
  if (_googleClient) return _googleClient;
  _googleClient = new OAuth2Client();
  return _googleClient;
}

class AuthService {

  // ══════════════════════════════════════════════════════════════════
  //  login(email, password)
  //  Llamado por: AuthController.login()
  //  Devuelve: { token, user }
  // ══════════════════════════════════════════════════════════════════
  async login(email, password) {
    console.log('[AuthService] login → email:', email);

    const user = await userRepository.findByEmail(email);
    if (!user) {
      console.warn('[AuthService] login → usuario no encontrado:', email);
      throw new Error('Credenciales incorrectas');
    }

    const passwordOk = await bcrypt.compare(password, user.password);
    if (!passwordOk) {
      console.warn('[AuthService] login → contraseña incorrecta para:', email);
      throw new Error('Credenciales incorrectas');
    }

    const token = this.generateToken(user);
    console.log('[AuthService] login → OK, userId:', String(user.id || user._id));

    return {
      token,
      user: {
        id:           String(user.id || user._id),
        name:         user.name || user.username || 'Usuario',
        email:        user.email,
        role:         user.role === 'admin' ? 'admin' : 'client',
        isSubscribed: Boolean(user.isSubscribed),
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  register(name, email, password)
  //  Llamado por: AuthController.register()
  //  Devuelve: { token, user }
  // ══════════════════════════════════════════════════════════════════
  async register(name, email, password) {
    console.log('[AuthService] register → email:', email);

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new Error('El email ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await userRepository.save({
      name,
      username: name,
      email,
      password: hashedPassword,
      role: 'client',
    });

    const token = this.generateToken(newUser);
    console.log('[AuthService] register → OK, userId:', String(newUser.id || newUser._id));

    return {
      token,
      user: {
        id:           String(newUser.id || newUser._id),
        name:         newUser.name || newUser.username || name,
        email:        newUser.email,
        role:         newUser.role === 'admin' ? 'admin' : 'client',
        isSubscribed: false,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  recoverPassword(email)
  //  Llamado por: AuthController.recoverPassword()
  //  Verifica que el email existe. Para envío real: integrar nodemailer.
  // ══════════════════════════════════════════════════════════════════
  async recoverPassword(email) {
    console.log('[AuthService] recoverPassword → email:', email);

    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('No existe ninguna cuenta con ese email');
    }

    // TODO: generar token de reset y enviar email con nodemailer
    console.log('[AuthService] recoverPassword → usuario encontrado:', user.email);

    return {
      message: 'Si el email existe, recibirás instrucciones para recuperar tu contraseña.',
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  loginWithGoogle(credential)
  //  Llamado por: AuthController.googleLogin()
  //
  //  Flujo:
  //    1. verifyIdToken contra Google con audience = GOOGLE_CLIENT_ID
  //       → Google valida firma, issuer (accounts.google.com), exp.
  //    2. Email verificado obligatorio (sub también).
  //    3. Buscar usuario por email:
  //         · Si existe       → conservar TODOS sus campos (rol incluido).
  //                              Se actualiza googleId/avatar/provider si
  //                              faltan, sin tocar rol ni password.
  //         · Si no existe   → crear con role='client', sin password.
  //    4. Emitir JWT con la MISMA estructura que login local.
  // ══════════════════════════════════════════════════════════════════
  async loginWithGoogle(credential) {
    console.log('[AuthService] loginWithGoogle → credential len:', credential?.length || 0);

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      const err = new Error('Google Sign-In no configurado (GOOGLE_CLIENT_ID ausente)');
      err.status = 500;
      throw err;
    }
    if (!credential || typeof credential !== 'string') {
      const err = new Error('Credencial de Google inválida');
      err.status = 400;
      throw err;
    }

    // Verificación contra Google (firma + issuer + audience + exp).
    let payload;
    try {
      const ticket = await getGoogleClient().verifyIdToken({
        idToken:  credential,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch (e) {
      console.warn('[AuthService] loginWithGoogle → verifyIdToken FAILED:', e.message);
      const err = new Error('Token de Google inválido o expirado');
      err.status = 401;
      throw err;
    }

    // Defensa en profundidad: aunque google-auth-library ya valida `iss` y
    // `aud`, lo re-comprobamos por si una versión futura cambia el default.
    const validIssuers = new Set(['accounts.google.com', 'https://accounts.google.com']);
    if (!payload || !validIssuers.has(payload.iss)) {
      const err = new Error('Issuer no permitido');
      err.status = 401;
      throw err;
    }
    if (payload.aud !== clientId) {
      const err = new Error('Audience no permitida');
      err.status = 401;
      throw err;
    }
    if (!payload.email || !payload.email_verified) {
      const err = new Error('La cuenta de Google no tiene email verificado');
      err.status = 401;
      throw err;
    }

    const email    = String(payload.email).toLowerCase();
    const googleId = String(payload.sub);
    const name     = payload.name || payload.given_name || email.split('@')[0];
    const avatar   = payload.picture || null;

    // Find-or-create — NUNCA confiamos en el email del frontend, sólo en el
    // payload verificado por Google.
    let user = await userRepository.findByEmail(email);

    if (!user) {
      user = await userRepository.save({
        name,
        email,
        password: null,           // OAuth → sin password local
        role:     'client',       // nuevos usuarios siempre 'client'
        provider: 'google',
        googleId,
        avatar,
      });
      console.log('[AuthService] loginWithGoogle → usuario creado:', email);
    } else {
      // Usuario existente: NO degradar rol, NO tocar password.
      // Solo enriquecemos con metadatos de Google si faltan.
      const patch = {};
      if (!user.googleId)              patch.googleId = googleId;
      if (!user.provider)              patch.provider = user.password ? 'local' : 'google';
      if (!user.avatar && avatar)      patch.avatar   = avatar;
      if (Object.keys(patch).length) {
        await userRepository.updateUser(String(user.id || user._id), patch);
      }
      console.log('[AuthService] loginWithGoogle → usuario existente:', email, '| role:', user.role);
    }

    const token = this.generateToken(user);
    return {
      token,
      user: {
        id:           String(user.id || user._id),
        name:         user.name || user.username || name,
        email:        user.email,
        role:         user.role === 'admin' ? 'admin' : 'client',
        isSubscribed: Boolean(user.isSubscribed),
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  generateToken(user)
  //  Firma el JWT con id, email y role en el payload.
  // ══════════════════════════════════════════════════════════════════
  generateToken(user) {
    const payload = {
      id:           String(user.id || user._id),
      email:        user.email,
      role:         user.role === 'admin' ? 'admin' : 'client',
      isSubscribed: Boolean(user.isSubscribed),
    };

    console.log('[AuthService] generateToken → payload:', payload);

    return jwt.sign(payload, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
      algorithm: jwtConfig.algorithm,
    });
  }

  // Re-emite un JWT con el estado más reciente del usuario.
  // Lo invoca PaymentController tras activar la suscripción para que el
  // frontend reciba un token coherente con isSubscribed=true.
  async refreshTokenForUser(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });
    return {
      token: this.generateToken(user),
      user: {
        id:           String(user.id || user._id),
        name:         user.name || user.username || 'Usuario',
        email:        user.email,
        role:         user.role === 'admin' ? 'admin' : 'client',
        isSubscribed: Boolean(user.isSubscribed),
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  verifyToken(token)
  //  Usado por authMiddleware y MessageService.
  //  Devuelve el payload decodificado o lanza error con .status = 401.
  // ══════════════════════════════════════════════════════════════════
  async verifyToken(token) {
    console.log('[AuthService] verifyToken → token:', token ? `${token.slice(0, 20)}...` : 'VACÍO');

    if (!token) {
      throw Object.assign(new Error('Token no proporcionado'), { status: 401 });
    }

    try {
      const payload = jwt.verify(token, jwtConfig.secret, {
        algorithms: [jwtConfig.algorithm],
      });

      console.log('[AuthService] verifyToken → OK:', {
        id:    payload.id || payload.sub,
        email: payload.email,
        role:  payload.role,
        exp:   payload.exp ? new Date(payload.exp * 1000).toISOString() : 'sin exp',
      });

      return payload;

    } catch (err) {
      console.error('[AuthService] verifyToken → ERROR:', err.name, err.message);

      if (err.name === 'TokenExpiredError') {
        throw Object.assign(new Error('Token expirado, inicia sesión de nuevo'), { status: 401 });
      }
      if (err.name === 'JsonWebTokenError') {
        throw Object.assign(new Error('Token inválido'), { status: 401 });
      }
      throw Object.assign(new Error('Error verificando token'), { status: 401 });
    }
  }

  // ── Helpers internos ─────────────────────────────────────────────
  async hashPassword(password) {
    return bcrypt.hash(password, 10);
  }

  async comparePassword(plain, hash) {
    return bcrypt.compare(plain, hash);
  }

  /*
  async verificarUserRole(user){
  const user = await userRepository.findByEmail(email);
    if (!user) {
      console.warn('[AuthService] login → usuario no encontrado:', email);
      throw new Error('Credenciales incorrectas');
    }
      --> obtengo el rol del user.
      
  
  }


  */
}

module.exports = new AuthService();