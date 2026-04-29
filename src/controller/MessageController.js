'use strict';

/**
 * @controller MessageController
 *
 * ─── BUGS CORREGIDOS ─────────────────────────────────────────────────────────
 *
 * BUG 4 — Controladores extraen authHeader manualmente ignorando req.user
 *   El authMiddleware ya verificó el token y puso el usuario en req.user.
 *   Sin embargo, cada método del controller volvía a extraer el authHeader
 *   y se lo pasaba al servicio para que lo volviese a decodificar.
 *   Esto duplicaba el trabajo, generaba dos puntos de fallo y hacía que
 *   los errores de autenticación llegasen desde el servicio en lugar del
 *   middleware, con mensajes inconsistentes.
 *   Corrección: leer req.user directamente; pasarlo al servicio como objeto.
 *   Los métodos del servicio que aceptaban authHeader se adaptan para
 *   aceptar también req.user (con el patrón de compatibilidad abajo).
 *
 * BUG 5 — index() usaba `new URL(req.url, 'http://localhost')` para leer ?estado=
 *   Con Express, req.url es la ruta relativa al punto de montaje del router,
 *   y el query string ya está parseado en req.query.
 *   new URL(req.url, ...) funcionaba en el servidor http nativo anterior
 *   pero no es necesario ni idiomático en Express.
 *   Corrección: const estado = req.query.estado || null;
 * ─────────────────────────────────────────────────────────────────────────────
 */

const messageService = require('../services/MessageService');

class MessageController {

  // ── POST /api/messages — crear mensaje (usuario autenticado) ────────────────
  async create(req, res) {
    try {
      const { nombre, mensaje } = req.body;

      // BUG 4 corregido: usar req.user inyectado por requireAuth
      const result = await messageService.saveMessageFromUser(req.user, nombre, mensaje);
      return res.status(201).json({ success: true, message: result.message });

    } catch (error) {
      return this._handleError(res, error, 'create');
    }
  }

  // ── GET /api/messages — listar mensajes (admin) ─────────────────────────────
  async index(req, res) {
    try {
      // BUG 5 corregido: req.query en lugar de new URL()
      const estado = req.query.estado || null;

      // BUG 4 corregido: pasar req.user directamente
      const result = await messageService.getAllMessages(req.user, estado);

      return res.status(200).json({
        success:  true,
        messages: result.messages,
        counts:   result.counts,
        total:    result.messages.length,
      });

    } catch (error) {
      return this._handleError(res, error, 'index');
    }
  }

  // ── PATCH /api/messages/:id/read ────────────────────────────────────────────
  async read(req, res) {
    try {
      const result = await messageService.markAsRead(req.user, req.params.id);
      return res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      return this._handleError(res, error, 'read');
    }
  }

  // ── PATCH /api/messages/:id/archive ────────────────────────────────────────
  async archive(req, res) {
    try {
      const result = await messageService.archiveMessage(req.user, req.params.id);
      return res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      return this._handleError(res, error, 'archive');
    }
  }

  // ── PATCH /api/messages/:id/unarchive ──────────────────────────────────────
  async unarchive(req, res) {
    try {
      const result = await messageService.unarchiveMessage(req.user, req.params.id);
      return res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      return this._handleError(res, error, 'unarchive');
    }
  }

  // ── GET /api/messages/admin — resumen de conversaciones ─────────────────────
  async adminInbox(req, res) {
    try {
      const result = await messageService.getAdminInbox(req.user);
      return res.status(200).json(result);
    } catch (error) {
      return this._handleError(res, error, 'adminInbox');
    }
  }

  // ── GET /api/messages/user/:userId — conversación completa ──────────────────
  async userConversation(req, res) {
    try {
      const result = await messageService.getConversationByUserId(req.user, req.params.userId);
      return res.status(200).json(result);
    } catch (error) {
      return this._handleError(res, error, 'userConversation');
    }
  }

  // —— GET /api/messages/me — resumen de mensajes del usuario ————————————————
  async userInbox(req, res) {
    try {
      const result = await messageService.getUserInbox(req.user);
      return res.status(200).json(result);
    } catch (error) {
      return this._handleError(res, error, 'userInbox');
    }
  }

  // —— GET /api/messages/me/:messageId — detalle del mensaje del usuario —————————
  async userMessageDetail(req, res) {
    try {
      const result = await messageService.getUserMessageDetail(req.user, req.params.messageId);
      return res.status(200).json(result);
    } catch (error) {
      return this._handleError(res, error, 'userMessageDetail');
    }
  }

  // ── POST /api/messages/admin/reply — respuesta del admin ────────────────────
  async adminReply(req, res) {
    try {
      const { userId, message } = req.body || {};
      const result = await messageService.replyAsAdmin(req.user, userId, message);
      return res.status(201).json(result);
    } catch (error) {
      return this._handleError(res, error, 'adminReply');
    }
  }

  // ── Error handler centralizado ───────────────────────────────────────────────
  _handleError(res, error, method) {
    const msg = error.message || '';

    if (msg.includes('Token') || msg.includes('autenticado') || msg.includes('vacío')) {
      return res.status(401).json({ success: false, message: msg });
    }
    if (msg.includes('Acceso denegado')) {
      return res.status(403).json({ success: false, message: msg });
    }
    if (msg.includes('no encontrado')) {
      return res.status(404).json({ success: false, message: msg });
    }
    if (
      msg.includes('Estado')    || msg.includes('estado')    ||
      msg.includes('caracteres')|| msg.includes('archivado') ||
      msg.includes('leído')     || msg.includes('inválido')  ||
      msg.includes('ya está')   || msg.includes('vacío')
    ) {
      return res.status(400).json({ success: false, message: msg });
    }

    console.error(`[MessageController.${method}]`, error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = new MessageController();
