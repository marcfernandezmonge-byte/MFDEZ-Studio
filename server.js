'use strict';

console.log('[BOOT] SERVER REAL:', __filename);

/**
 * server.js
 *
 * ─── BUG CORREGIDO ───────────────────────────────────────────────────────────
 * connectDB() nunca se llamaba antes de app.listen().
 * MessageRepository hace await getDB() en cada operación. Si MongoDB
 * no estaba conectado al arrancar, la primera petición intentaba conectar
 * en caliente. Esto funcionaba en happy path, pero cualquier error de red
 * al arrancar no se detectaba hasta la primera request, devolviendo un 500
 * críptico en lugar de fallar al inicio con un mensaje claro.
 * Corrección: llamar connectDB() antes de app.listen() con manejo de error.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { connectDB } = require('./src/persistence/mongoClient');

const authRoutes = require('./src/routes/AuthRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const userRoutes = require('./src/routes/userRoutes');
const planRoutes = require('./src/routes/planRoutes');
const serviceRoutes = require('./src/routes/serviceRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5501',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    console.warn('[CORS] Origen bloqueado:', origin);
    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Request logger ────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} | Origin: ${req.headers.origin || 'n/a'}`);
  next();
});

// ── Rutas ─────────────────────────────────────────────────────────────────────
console.log('[BOOT] Montando rutas /api');
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', messageRoutes);
app.use('/api', planRoutes);
app.use('/api', serviceRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ── Error handler global ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[GlobalError]', req.method, req.path, '→', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    path: req.path,
    method: req.method,
  });
});

// ── Arranque — esperar conexión Mongo ANTES de escuchar ──────────────────────
async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`\n✅ Servidor corriendo en http://localhost:${PORT}`);
      console.log(`   Orígenes CORS: ${ALLOWED_ORIGINS.join(', ')}\n`);
    });
  } catch (err) {
    console.error('❌ Error al conectar con MongoDB:', err.message);
    process.exit(1);
  }
}

start();

module.exports = app;