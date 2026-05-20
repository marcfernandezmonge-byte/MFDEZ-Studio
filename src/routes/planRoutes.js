'use strict';

console.log('[BOOT] planRoutes cargado - VERSION MARC TEST 12345');

const { Router } = require('express');
const router = Router();

router.get('/plans', (req, res) => {
  console.log('[HIT] GET /api/plans - VERSION MARC TEST 12345');
  res.send('PLAN ROUTES OK - VERSION MARC TEST 12345');
});

router.post('/user/plan/request', (req, res) => {
  console.log('[HIT] POST /api/user/plan/request - VERSION MARC TEST 12345');
  res.json({
    ok: true,
    version: 'VERSION MARC TEST 12345',
    body: req.body || null
  });
});

module.exports = router;