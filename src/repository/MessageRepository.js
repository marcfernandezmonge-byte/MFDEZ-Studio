'use strict';

const { randomUUID } = require('crypto');

const Message = require('../domain/Message');
const { getDB } = require('../persistence/mongoClient');

class MessageRepository {
  async _col() {
    const db = await getDB();
    return db.collection('usersMessages');
  }

  async save({ userId, userEmail, nombre, mensaje, sender = 'user', role = 'user' }) {
    const collection = await this._col();
    const timestamp = new Date().toISOString();

    const entity = new Message({
      id: randomUUID(),
      userId: String(userId),
      userEmail,
      nombre: nombre.trim(),
      mensaje: mensaje.trim(),
      fecha: timestamp,
      estado: sender === 'admin' ? 'leido' : 'nuevo',
      leidoEn: sender === 'admin' ? timestamp : null,
    });

    const doc = {
      ...entity.toJSON(),
      sender,
      role,
      createdAt: entity.fecha,
      date: entity.fecha,
      message: entity.mensaje,
      content: entity.mensaje,
    };

    await collection.insertOne(doc);
    return doc;
  }

  async findAll() {
    const collection = await this._col();
    return collection
      .find({ sender: { $ne: 'admin' } })
      .sort({ fecha: -1 })
      .toArray();
  }

  async findById(id) {
    const collection = await this._col();
    return collection.findOne({ id: String(id) });
  }

  async countByEstado() {
    const messages = await this.findAll();
    return {
      nuevo: messages.filter((message) => message.estado === 'nuevo').length,
      leido: messages.filter((message) => message.estado === 'leido').length,
      archivado: messages.filter((message) => message.estado === 'archivado').length,
      total: messages.length,
    };
  }

  async updateEstado(id, estado, extraFields = {}) {
    const collection = await this._col();
    await collection.updateOne(
      { id: String(id) },
      { $set: { estado, ...extraFields } }
    );
    return this.findById(id);
  }

  async findConversationSummaries() {
    const collection = await this._col();
    return collection.aggregate([
      { $sort: { fecha: -1 } },
      {
        $group: {
          _id: '$userId',
          userId: { $first: '$userId' },
          userEmail: { $first: '$userEmail' },
          role: { $first: '$role' },
          lastMessage: { $first: '$mensaje' },
          lastDate: { $first: '$fecha' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$sender', 'user'] },
                    { $eq: ['$estado', 'nuevo'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { lastDate: -1 } },
    ]).toArray();
  }

  async findByUserId(userId) {
    const collection = await this._col();
    return collection
      .find({ userId: String(userId) })
      .sort({ fecha: 1 })
      .toArray();
  }

  async findUserInboxByUserId(userId) {
    const conversation = await this.findByUserId(userId);
    const threads = this._buildUserThreads(conversation);

    return threads
      .slice()
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .map((thread) => ({
        id: thread.id,
        fecha: thread.fecha,
        estado: thread.estado,
        responded: thread.responded,
        aviso: thread.aviso,
        preview: thread.mensaje,
        responsesCount: thread.responses.length,
        respondedAt: thread.respondedAt,
      }));
  }

  async findUserMessageThread(userId, messageId) {
    const conversation = await this.findByUserId(userId);
    const threads = this._buildUserThreads(conversation);
    return threads.find((thread) => thread.id === String(messageId)) || null;
  }

  _buildUserThreads(messages) {
    const threads = [];
    let activeThread = null;

    messages.forEach((message) => {
      if (message.sender === 'user') {
        activeThread = {
          id: String(message.id),
          userId: String(message.userId),
          userEmail: message.userEmail || '',
          nombre: message.nombre || '',
          mensaje: message.mensaje || message.message || '',
          fecha: message.fecha || message.createdAt || message.date || null,
          estado: 'sin_responder',
          responded: false,
          aviso: null,
          respondedAt: null,
          responses: [],
        };

        threads.push(activeThread);
        return;
      }

      if (message.sender === 'admin' && activeThread) {
        activeThread.responded = true;
        activeThread.estado = 'respondido';
        activeThread.aviso = 'Tienes una respuesta del administrador';
        activeThread.respondedAt = message.fecha || message.createdAt || message.date || activeThread.respondedAt;
        activeThread.responses.push({
          id: String(message.id),
          mensaje: message.mensaje || message.message || '',
          fecha: message.fecha || message.createdAt || message.date || null,
          nombre: message.nombre || 'Admin',
        });
      }
    });

    return threads;
  }
}

module.exports = new MessageRepository();
