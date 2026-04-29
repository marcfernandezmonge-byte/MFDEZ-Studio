'use strict';

/**
 * @persistence Db
 * Almacenamiento en memoria para desarrollo / fallback.
 *
 * ─── BUG CORREGIDO ───────────────────────────────────────────────────────────
 * La línea  console.log(messages.length)  estaba en el cuerpo del módulo,
 * fuera de cualquier función. En Node.js los módulos se evalúan una vez al
 * cargarlos con require(). Ese console.log se ejecutaba automáticamente
 * al arrancar el servidor, ensuciando los logs con un "0" sin contexto.
 * Corrección: eliminado.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NOTA: Con MongoDB activo, MessageRepository usa mongoClient en lugar de
 * estos arrays. Db.js sigue siendo útil para tests unitarios y como
 * fallback si Mongo no está disponible.
 */

const { randomUUID } = require('crypto');

const users          = [];
const messages       = [];
const recoveryTokens = new Map();

let _currentId = 1;

function getNextId()   { return _currentId++; }
function generateUUID() { return randomUUID(); }

module.exports = {
  users,
  messages,
  recoveryTokens,
  getNextId,
  generateUUID,
};