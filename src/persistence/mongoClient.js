/**
 * @persistence mongoClient.js
 * Conexión singleton a MongoDB Atlas.
 *
 * Patrón:  llamar a connectDB() una vez al arrancar el servidor.
 *          Después, getDB() devuelve la instancia ya conectada.
 *
 * ─── GUÍA DE MIGRACIÓN ───────────────────────────────────────────────────────
 * Las variables de entorno se leen desde .env (cargado por dotenv en server.js):
 *   MONGO_URI  — connection string completo de Atlas
 *   DB_NAME    — nombre de la base de datos (default: MFDEZStudio)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { MongoClient } = require('mongodb');

let _client = null;
let _db     = null;

/**
 * Conecta a MongoDB Atlas y almacena la instancia.
 * Idempotente: si ya está conectado, no hace nada.
 *
 * @returns {Promise<import('mongodb').Db>}
 */
async function connectDB() {
  if (_db) return _db;

  const uri    = process.env.MONGO_URI;
  const dbName = process.env.DB_NAME || 'MFDEZStudio';

  if (!uri) {
    throw new Error('[mongoClient] MONGO_URI no está definido en las variables de entorno.');
  }

  _client = new MongoClient(uri);
  await _client.connect();

  _db = _client.db(dbName);

  console.log(`✓ MongoDB connected to ${dbName}`);
  return _db;
}

/**
 * Devuelve la instancia de la base de datos.
 * Conecta automáticamente si todavía no se ha llamado a connectDB().
 *
 * @returns {Promise<import('mongodb').Db>}
 */
async function getDB() {
  if (!_db) await connectDB();
  return _db;
}

/**
 * Cierra la conexión (útil en tests o en shutdown graceful).
 */
async function closeDB() {
  if (_client) {
    await _client.close();
    _client = null;
    _db     = null;
    console.log('MongoDB connection closed.');
  }
}

module.exports = { connectDB, getDB, closeDB };