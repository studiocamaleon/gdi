/**
 * A.1.1 — Determinism check
 *
 * Ejecuta una cotización dos veces con el mismo input y compara resultados.
 * Si los resultados difieren, hay fuentes de no-determinismo en el motor que
 * harán que los golden tests sean flaky.
 *
 * Uso: desde apps/api/ corré:
 *   npx ts-node --transpile-only scripts/check-determinism.ts
 *
 * El script persiste dos snapshots nuevos en la DB (del endpoint cotizar).
 * Se pueden limpiar después con:
 *   DELETE FROM "CotizacionProductoSnapshot" WHERE "createdAt" > '2026-04-17T22:00:00Z';
 */
import { PrismaService } from '../src/prisma/prisma.service';
import { ProductosServiciosService } from '../src/productos-servicios/productos-servicios.service';
import type { CurrentAuth } from '../src/auth/auth.types';

const AUTH: CurrentAuth = {
  userId: '2bb149b0-1005-4075-b44f-908764d5e79e',
  sessionId: 'determinism-check-session',
  tenantId: '0e7937a0-c093-4cdd-bc5e-fe4de1385ce8',
  membershipId: 'dd920f84-8819-45bd-b4db-6531fc2d0ed0',
  role: 'ADMINISTRADOR' as CurrentAuth['role'],
  email: 'admin@gdi-demo.local',
};

// Tarjetas de Visita - Estandar 9x5 (motor digital/láser)
const VARIANTE_ID = '947969f5-442f-4ede-b43b-26df9a3a4e8a';
const PAYLOAD = {
  cantidad: 500,
  seleccionesBase: [{ dimension: 'caras', valor: 'doble_faz' }],
};

type DiffEntry = { path: string; a: unknown; b: unknown };

function diffDeep(a: unknown, b: unknown, path = ''): DiffEntry[] {
  if (a === b) return [];
  if (typeof a !== typeof b) return [{ path, a, b }];
  if (a === null || b === null) return [{ path, a, b }];
  if (typeof a !== 'object') return [{ path, a, b }];

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return [{ path: `${path}.length`, a: a.length, b: b.length }];
    return a.flatMap((item, i) => diffDeep(item, b[i], `${path}[${i}]`));
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
  return [...keys].flatMap((key) => diffDeep(aObj[key], bObj[key], path ? `${path}.${key}` : key));
}

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const service = new ProductosServiciosService(prisma);

  console.log('Corrida 1...');
  const result1 = await service.cotizarVariante(AUTH, VARIANTE_ID, PAYLOAD as any);
  console.log('Corrida 2...');
  const result2 = await service.cotizarVariante(AUTH, VARIANTE_ID, PAYLOAD as any);

  const diffs = diffDeep(result1, result2);

  if (diffs.length === 0) {
    console.log('\n✅ RESULTADOS IDÉNTICOS — los motores son deterministas en el output.');
  } else {
    console.log(`\n⚠️  ${diffs.length} diferencias entre las dos corridas:`);
    for (const d of diffs.slice(0, 30)) {
      const strA = JSON.stringify(d.a);
      const strB = JSON.stringify(d.b);
      const shortA = strA && strA.length > 80 ? strA.slice(0, 77) + '...' : strA;
      const shortB = strB && strB.length > 80 ? strB.slice(0, 77) + '...' : strB;
      console.log(`  ${d.path}: ${shortA}  !=  ${shortB}`);
    }
    if (diffs.length > 30) console.log(`  ... y ${diffs.length - 30} más`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
