/**
 * A.1 — Generador de goldens
 *
 * Lee los .input.json de __fixtures__/quote-cases/<motor>/ y, por cada uno:
 * 1. Llama al método de cotización que corresponde.
 * 2. Normaliza el resultado (elimina snapshotId, createdAt, cotizacionId).
 * 3. Escribe <caso>.expected.json junto al input.
 *
 * Uso: desde apps/api/ corré:
 *   npx ts-node --transpile-only scripts/generate-goldens.ts
 *   npx ts-node --transpile-only scripts/generate-goldens.ts --motor digital
 *   npx ts-node --transpile-only scripts/generate-goldens.ts --case D01
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProductosServiciosService } from '../src/productos-servicios/productos-servicios.service';
import type { CurrentAuth } from '../src/auth/auth.types';

const FIXTURES_ROOT = path.join(
  __dirname,
  '..',
  'src',
  'productos-servicios',
  '__fixtures__',
  'quote-cases',
);

const AUTH: CurrentAuth = {
  userId: '2bb149b0-1005-4075-b44f-908764d5e79e',
  sessionId: 'golden-generator-session',
  tenantId: '0e7937a0-c093-4cdd-bc5e-fe4de1385ce8',
  membershipId: 'dd920f84-8819-45bd-b4db-6531fc2d0ed0',
  role: 'ADMINISTRADOR' as CurrentAuth['role'],
  email: 'admin@gdi-demo.local',
};

type FixtureInput = {
  description: string;
  method: 'cotizarVariante' | 'cotizarRigidPrintedByProducto';
  varianteId?: string;
  productoId?: string;
  payload: Record<string, unknown>;
};

// Campos que varían entre corridas y no forman parte del cálculo.
// Se eliminan del resultado antes de comparar con el golden.
const NON_DETERMINISTIC_KEYS = new Set(['snapshotId', 'createdAt', 'cotizacionId']);

function stripNonDeterministic(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripNonDeterministic);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (NON_DETERMINISTIC_KEYS.has(k)) continue;
    out[k] = stripNonDeterministic(v);
  }
  return out;
}

async function discoverFixtures(): Promise<
  Array<{ absPath: string; motor: string; name: string; input: FixtureInput }>
> {
  const results: Array<{ absPath: string; motor: string; name: string; input: FixtureInput }> = [];
  const motors = fs.readdirSync(FIXTURES_ROOT).filter((d) =>
    fs.statSync(path.join(FIXTURES_ROOT, d)).isDirectory(),
  );
  for (const motor of motors) {
    const motorDir = path.join(FIXTURES_ROOT, motor);
    const files = fs.readdirSync(motorDir).filter((f) => f.endsWith('.input.json'));
    for (const file of files) {
      const absPath = path.join(motorDir, file);
      const name = file.replace(/\.input\.json$/, '');
      const input = JSON.parse(fs.readFileSync(absPath, 'utf8')) as FixtureInput;
      results.push({ absPath, motor, name, input });
    }
  }
  return results;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const filter: { motor?: string; case?: string } = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--motor') filter.motor = args[i + 1];
    if (args[i] === '--case') filter.case = args[i + 1];
  }
  return filter;
}

async function main() {
  const filter = parseArgs();
  const fixtures = await discoverFixtures();

  const filtered = fixtures.filter((f) => {
    if (filter.motor && f.motor !== filter.motor) return false;
    if (filter.case && !f.name.startsWith(filter.case)) return false;
    return true;
  });

  if (filtered.length === 0) {
    console.log('No se encontraron fixtures que coincidan.');
    return;
  }

  console.log(`Generando goldens para ${filtered.length} fixture(s)...`);

  const prisma = new PrismaService();
  await prisma.$connect();
  const service = new ProductosServiciosService(prisma);

  let ok = 0;
  let fail = 0;
  const errors: Array<{ name: string; error: string }> = [];

  for (const fixture of filtered) {
    const label = `[${fixture.motor}/${fixture.name}]`;
    try {
      let result: unknown;
      if (fixture.input.method === 'cotizarVariante') {
        if (!fixture.input.varianteId) throw new Error('Falta varianteId');
        result = await service.cotizarVariante(
          AUTH,
          fixture.input.varianteId,
          fixture.input.payload as never,
        );
      } else if (fixture.input.method === 'cotizarRigidPrintedByProducto') {
        if (!fixture.input.productoId) throw new Error('Falta productoId');
        result = await service.cotizarRigidPrintedByProducto(
          AUTH,
          fixture.input.productoId,
          fixture.input.payload as never,
        );
      } else {
        throw new Error(`Método desconocido: ${(fixture.input as FixtureInput).method}`);
      }

      const normalized = stripNonDeterministic(result);
      const expectedPath = fixture.absPath.replace(/\.input\.json$/, '.expected.json');
      const content = JSON.stringify(normalized, null, 2) + '\n';
      fs.writeFileSync(expectedPath, content, 'utf8');
      console.log(`${label} OK — ${path.basename(expectedPath)}`);
      ok++;
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.log(`${label} ERROR — ${msg}`);
      errors.push({ name: `${fixture.motor}/${fixture.name}`, error: msg });
      fail++;
    }
  }

  await prisma.$disconnect();

  console.log(`\nResultado: ${ok} OK, ${fail} errores.`);
  if (errors.length > 0) {
    console.log('\nErrores detallados:');
    for (const e of errors) console.log(`  ${e.name}: ${e.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
