'use strict';

/**
 * @service MessageService
 *
 * ─── CAMBIO ACOPLADO A LA CORRECCIÓN DEL CONTROLLER ─────────────────────────
 * Los métodos públicos ahora aceptan el objeto `user` (req.user puesto por el
 * authMiddleware) en lugar del authHeader crudo.
 * Esto elimina la doble decodificación del token que existía antes.
 *
 * Nuevo método:
 *   saveMessageFromUser(user, nombre, mensaje) — llamado desde create()
 *
 * Estados: nuevo → leido → archivado  (archivado → nuevo bloqueado)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const messageRepository = require('../repository/MessageRepository');

const ESTADOS_VALIDOS = ['nuevo', 'leido', 'archivado'];

class MessageService {

  // POST /messages — cualquier usuario autenticado
  async saveMessageFromUser(user, nombre, mensaje) {
    if (!nombre || nombre.trim().length < 2) {
      throw new Error('El nombre debe tener al menos 2 caracteres');
    }
    if (!mensaje || mensaje.trim().length < 5) {
      throw new Error('El mensaje debe tener al menos 5 caracteres');
    }
    if (!user || !user.id) {
      throw new Error('Token inválido: usuario no identificado');
    }

    console.log(`[MessageService] saveMessageFromUser userId=${user.id}`);

    await messageRepository.save({
      userId:    user.id,
      userEmail: user.email,
      nombre:    nombre.trim(),
      mensaje:   mensaje.trim(),
      sender:    'user',
      role:      user.role || 'user',
    });

    return { message: 'Mensaje enviado correctamente' };
  }

  // GET /messages — admin
  async getAllMessages(user, estado = null) {
    this._assertAdmin(user);

    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
      throw new Error(`Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`);
    }

    const all      = await messageRepository.findAll();
    const messages = estado ? all.filter(m => m.estado === estado) : all;
    const counts   = await messageRepository.countByEstado();

    return { messages, counts };
  }

  // PATCH /messages/:id/read — admin
  async markAsRead(user, id) {
    this._assertAdmin(user);
    const msg = await this._findById(id);

    if (msg.estado === 'archivado') {
      throw new Error('No se puede marcar como leído un mensaje archivado.');
    }
    if (msg.estado === 'leido') return { message: msg };

    const updated = await messageRepository.updateEstado(id, 'leido', {
      leidoEn: new Date().toISOString(),
    });
    return { message: updated };
  }

  // PATCH /messages/:id/archive — admin
  async archiveMessage(user, id) {
    this._assertAdmin(user);
    const msg = await this._findById(id);

    if (msg.estado === 'archivado') throw new Error('El mensaje ya está archivado');

    const extras = { archivadoEn: new Date().toISOString() };
    if (!msg.leidoEn) extras.leidoEn = new Date().toISOString();

    return { message: await messageRepository.updateEstado(id, 'archivado', extras) };
  }

  // PATCH /messages/:id/unarchive — admin
  async unarchiveMessage(user, id) {
    this._assertAdmin(user);
    const msg = await this._findById(id);

    if (msg.estado !== 'archivado') {
      throw new Error(`Solo se pueden desarchivar mensajes archivados. Estado actual: ${msg.estado}`);
    }

    return { message: await messageRepository.updateEstado(id, 'leido', { archivadoEn: null }) };
  }

  // GET /messages/admin — admin
  async getAdminInbox(user) {
    this._assertAdmin(user);
    return { users: await messageRepository.findConversationSummaries() };
  }

  // GET /messages/user/:userId — admin
  async getConversationByUserId(user, userId) {
    this._assertAdmin(user);
    return { messages: await messageRepository.findByUserId(userId) };
  }

  // GET /messages/me — usuario autenticado
  async getUserInbox(user) {
    const authUser = this._assertAuthenticated(user);
    return { messages: await messageRepository.findUserInboxByUserId(authUser.id) };
  }

  // GET /messages/me/:messageId — usuario autenticado
  async getUserMessageDetail(user, messageId) {
    const authUser = this._assertAuthenticated(user);

    if (!messageId) {
      throw new Error('messageId es obligatorio');
    }

    const thread = await messageRepository.findUserMessageThread(authUser.id, messageId);
    if (!thread) {
      throw new Error(`Mensaje con id "${messageId}" no encontrado`);
    }

    return { thread };
  }

  // POST /messages/admin/reply — admin
  async replyAsAdmin(user, userId, message) {
    this._assertAdmin(user);

    if (!message || !message.trim()) throw new Error('El mensaje no puede estar vacío');
    if (!userId)                     throw new Error('userId es obligatorio');

    const conversation = await messageRepository.findByUserId(userId);
    const userEmail    = conversation[0]?.userEmail || '';

    return { message: await messageRepository.save({
      userId,
      userEmail,
      nombre:  user.name || 'Admin',
      mensaje: message.trim(),
      sender:  'admin',
      role:    'admin',
    })};
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  _assertAdmin(user) {
    if (!user || user.role !== 'admin') {
      throw new Error('Acceso denegado: se requiere rol admin');
    }
    return user;
  }

  _assertAuthenticated(user) {
    if (!user || !user.id) {
      throw new Error('Token inválido: usuario no identificado');
    }
    return user;
  }

  async _findById(id) {
    const msg = await messageRepository.findById(id);
    if (!msg) throw new Error(`Mensaje con id "${id}" no encontrado`);
    return msg;
  }
}

module.exports = new MessageService();
