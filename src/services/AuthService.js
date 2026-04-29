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
const jwtConfig      = require('../../config/jwtConfig');
const userRepository = require('../repository/UserRepository');

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
        role:         user.role || 'user',
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
      role: 'user',
    });

    const token = this.generateToken(newUser);
    console.log('[AuthService] register → OK, userId:', String(newUser.id || newUser._id));

    return {
      token,
      user: {
        id:           String(newUser.id || newUser._id),
        name:         newUser.name || newUser.username || name,
        email:        newUser.email,
        role:         newUser.role || 'user',
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
  //  generateToken(user)
  //  Firma el JWT con id, email y role en el payload.
  // ══════════════════════════════════════════════════════════════════
  generateToken(user) {
    const payload = {
      id:    String(user.id || user._id),
      email: user.email,
      role:  user.role || 'user',
    };

    console.log('[AuthService] generateToken → payload:', payload);

    return jwt.sign(payload, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
      algorithm: jwtConfig.algorithm,
    });
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