/**
 * Quote regression suite — A.1 (red de seguridad pre-migración)
 *
 * Por cada fixture en __fixtures__/quote-cases/<motor>/<caso>.input.json:
 *   1. Corre el método de cotización correspondiente.
 *   2. Normaliza el resultado (elimina snapshotId, createdAt, cotizacionId).
 *   3. Compara con el golden (<caso>.expected.json).
 *
 * Si algún cambio en el código rompe un cálculo, el test falla y muestra el diff.
 *
 * Para regenerar los goldens (luego de un cambio intencional):
 *   cd apps/api && npx ts-node --transpile-only scripts/generate-goldens.ts
 *
 * Requiere que el container de postgres `gdi-saas-postgres` esté corriendo
 * con la DB poblada con los productos y variantes referenciados en los fixtures.
 *
 * NOTA: estos tests ejecutan contra la DB de desarrollo y cada corrida persiste
 * snapshots en CotizacionProductoSnapshot. Eso es un costo conocido; se puede
 * limpiar con DELETE basado en `createdAt` reciente.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { ProductosServiciosService } from './productos-servicios.service';
import type { CurrentAuth } from '../auth/auth.types';

const FIXTURES_ROOT = path.join(__dirname, '__fixtures__', 'quote-cases');

const AUTH: CurrentAuth = {
  userId: '2bb149b0-1005-4075-b44f-908764d5e79e',
  sessionId: 'quote-regression-session',
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

function discoverFixtures(): Array<{ motor: string; name: string; inputPath: string; expectedPath: string }> {
  const results: Array<{ motor: string; name: string; inputPath: string; expectedPath: string }> = [];
  if (!fs.existsSync(FIXTURES_ROOT)) return results;
  const motors = fs.readdirSync(FIXTURES_ROOT).filter((d) =>
    fs.statSync(path.join(FIXTURES_ROOT, d)).isDirectory(),
  );
  for (const motor of motors) {
    const motorDir = path.join(FIXTURES_ROOT, motor);
    const files = fs.readdirSync(motorDir).filter((f) => f.endsWith('.input.json'));
    for (const file of files) {
      const inputPath = path.join(motorDir, file);
      const expectedPath = inputPath.replace(/\.input\.json$/, '.expected.json');
      const name = file.replace(/\.input\.json$/, '');
      if (fs.existsSync(expectedPath)) {
        results.push({ motor, name, inputPath, expectedPath });
      }
    }
  }
  return results;
}

describe('Quote regression suite (A.1 golden tests)', () => {
  let prisma: PrismaService;
  let service: ProductosServiciosService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new ProductosServiciosService(prisma);
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  const fixtures = discoverFixtures();

  if (fixtures.length === 0) {
    it('no fixtures found — regression suite is empty', () => {
      expect(fixtures.length).toBeGreaterThan(0);
    });
    return;
  }

  describe.each(
    // Agrupamos por motor para output más prolijo
    Array.from(new Set(fixtures.map((f) => f.motor))).sort(),
  )('motor: %s', (motor) => {
    const casos = fixtures.filter((f) => f.motor === motor);

    it.each(casos.map((c) => [c.name, c.inputPath, c.expectedPath] as const))(
      '%s',
      async (_name, inputPath, expectedPath) => {
        const input = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as FixtureInput;
        const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8')) as unknown;

        let result: unknown;
        if (input.method === 'cotizarVariante') {
          if (!input.varianteId) throw new Error('Falta varianteId');
          result = await service.cotizarVariante(AUTH, input.varianteId, input.payload as never);
        } else if (input.method === 'cotizarRigidPrintedByProducto') {
          if (!input.productoId) throw new Error('Falta productoId');
          result = await service.cotizarRigidPrintedByProducto(
            AUTH,
            input.productoId,
            input.payload as never,
          );
        } else {
          throw new Error(`Método desconocido: ${(input as FixtureInput).method}`);
        }

        const actual = stripNonDeterministic(result);
        expect(actual).toEqual(expected);
      },
      60000, // timeout por caso: 60s (cotización puede tardar algunos segundos)
    );
  });
});
