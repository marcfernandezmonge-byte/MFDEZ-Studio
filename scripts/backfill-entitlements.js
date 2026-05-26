'use strict';

/**
 * scripts/backfill-entitlements.js
 *
 * Recorre todas las `serviceRequests` con `status: 'approved'` y crea un
 * entitlement en `serviceEntitlements` si todavía no existe uno para esa
 * request. Es IDEMPOTENTE: la unicidad por `requestId` en el repositorio
 * impide duplicados, así que ejecutarlo varias veces es seguro.
 *
 * Uso (PowerShell o Bash):
 *   node scripts/backfill-entitlements.js
 *
 * No modifica `users` ni `services` legacy ni nada de Collectors Club.
 */

require('dotenv').config();

const { connectDB, closeDB } = require('../src/persistence/mongoClient');
const serviceRequestRepository = require('../src/repository/ServiceRequestRepository');
const entitlementService       = require('../src/services/EntitlementService');

async function main() {
  console.log('[backfill] Conectando a MongoDB…');
  await connectDB();

  const requests = await serviceRequestRepository.findAll({ status: 'approved' });
  console.log(`[backfill] Encontradas ${requests.length} requests aprobadas`);

  let created = 0;
  let skipped = 0;
  let failed  = 0;

  for (const r of requests) {
    try {
      const before = await entitlementService.listForUser(r.userId);
      const had    = before.some((e) => e.requestId === r.id);
      const grant  = await entitlementService.grantFromRequest(r, { adminId: r.decidedBy || null });
      if (had) {
        skipped++;
      } else if (grant && grant.id) {
        created++;
        console.log(`[backfill]  + ${grant.entitlementKey}  user=${r.userId}  req=${r.id}`);
      } else {
        failed++;
      }
    } catch (err) {
      failed++;
      console.error(`[backfill]  ! request=${r.id} → ${err.message}`);
    }
  }

  console.log(`[backfill] Hecho. created=${created} skipped=${skipped} failed=${failed}`);

  if (typeof closeDB === 'function') {
    try { await closeDB(); } catch { /* ignore */ }
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[backfill] FATAL:', err);
  process.exit(2);
});
