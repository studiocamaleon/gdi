/**
 * P3.a.3 — Red de seguridad pre-retiro de motores v1.
 *
 * Corre cada golden fixture del v1 (quote-regression) a través del super motor
 * universal y reporta el diff de total + unitario. No falla (sólo loguea) —
 * su propósito es identificar divergencias para cerrarlas antes de P3.b.
 *
 * Ejecución:
 *   cd apps/api && npx jest super-vs-v1.parity --verbose
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductosServiciosService } from '../productos-servicios.service';
import type { CurrentAuth } from '../../auth/auth.types';
import type { CotizacionCanonica } from '../dto/cotizacion-canonica.dto';

const FIXTURES_ROOT = path.join(
  __dirname,
  '..',
  '__fixtures__',
  'quote-cases',
);

const AUTH: CurrentAuth = {
  userId: '2bb149b0-1005-4075-b44f-908764d5e79e',
  sessionId: 'super-vs-v1-parity',
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

type Resultado = {
  motor: string;
  caso: string;
  totalV1: number | null;
  totalSuper: number | null;
  unitarioV1: number | null;
  unitarioSuper: number | null;
  diffTotalPct: number | null;
  errorSuper?: string;
};

// Tolerancia aceptable para que un caso se considere "en paridad".
const DIFF_ACEPTABLE_PCT = 5;

function discoverFixtures() {
  const out: Array<{ motor: string; name: string; inputPath: string; expectedPath: string }> = [];
  if (!fs.existsSync(FIXTURES_ROOT)) return out;
  for (const motor of fs.readdirSync(FIXTURES_ROOT)) {
    const motorDir = path.join(FIXTURES_ROOT, motor);
    if (!fs.statSync(motorDir).isDirectory()) continue;
    for (const f of fs.readdirSync(motorDir).filter((x) => x.endsWith('.input.json'))) {
      const inputPath = path.join(motorDir, f);
      const expectedPath = inputPath.replace(/\.input\.json$/, '.expected.json');
      if (fs.existsSync(expectedPath)) {
        out.push({ motor, name: f.replace(/\.input\.json$/, ''), inputPath, expectedPath });
      }
    }
  }
  return out;
}

describe('P3.a.3 · Paridad super motor vs v1 (golden fixtures)', () => {
  let prisma: PrismaService;
  let service: ProductosServiciosService;
  const resultados: Resultado[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new ProductosServiciosService(prisma);
  });

  afterAll(async () => {
    console.log('\n════════ P3.a.3 · super motor vs v1 (golden fixtures) ════════');
    console.log(
      'Motor/Caso'.padEnd(60) +
        'total v1'.padStart(12) +
        'total super'.padStart(14) +
        'diff %'.padStart(10),
    );
    console.log('─'.repeat(96));
    const byMotor = new Map<string, Resultado[]>();
    for (const r of resultados) {
      const list = byMotor.get(r.motor) ?? [];
      list.push(r);
      byMotor.set(r.motor, list);
    }
    for (const [motor, arr] of [...byMotor.entries()].sort()) {
      for (const r of arr) {
        const caso = `[${motor}] ${r.caso}`.slice(0, 59).padEnd(60);
        const v1 = r.totalV1 != null ? `$${r.totalV1.toFixed(0)}`.padStart(12) : '—'.padStart(12);
        const su =
          r.totalSuper != null
            ? `$${r.totalSuper.toFixed(0)}`.padStart(14)
            : (r.errorSuper ? 'ERROR' : '—').padStart(14);
        const pct =
          r.diffTotalPct != null
            ? `${r.diffTotalPct > 0 ? '+' : ''}${r.diffTotalPct.toFixed(1)}%`.padStart(10)
            : '—'.padStart(10);
        console.log(caso + v1 + su + pct);
      }
    }
    console.log('─'.repeat(96));
    const conSuper = resultados.filter((r) => r.totalSuper != null);
    const paridad = conSuper.filter(
      (r) => r.diffTotalPct != null && Math.abs(r.diffTotalPct) <= DIFF_ACEPTABLE_PCT,
    );
    const errores = resultados.filter((r) => r.errorSuper != null);
    console.log(
      `Paridad (diff ≤ ${DIFF_ACEPTABLE_PCT}%): ${paridad.length}/${resultados.length}`,
    );
    console.log(`Super motor con error: ${errores.length}/${resultados.length}`);
    if (errores.length > 0) {
      console.log('\nErrores:');
      for (const e of errores.slice(0, 5)) {
        console.log(`  [${e.motor}] ${e.caso}: ${e.errorSuper}`);
      }
    }
    console.log('══════════════════════════════════════════════════════════════\n');
    await prisma.$disconnect();
  });

  const fixtures = discoverFixtures();
  if (fixtures.length === 0) {
    it('no fixtures found — paridad vacía', () => {
      expect(fixtures.length).toBeGreaterThan(0);
    });
    return;
  }

  const motors = Array.from(new Set(fixtures.map((f) => f.motor))).sort();
  describe.each(motors)('motor: %s', (motor) => {
    const casos = fixtures.filter((f) => f.motor === motor);
    it.each(casos.map((c) => [c.name, c.inputPath, c.expectedPath] as const))(
      '%s',
      async (name, inputPath, expectedPath) => {
        const input = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as FixtureInput;
        const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8')) as {
          total?: number;
          unitario?: number;
        };

        const totalV1 = typeof expected.total === 'number' ? expected.total : null;
        const unitarioV1 =
          typeof expected.unitario === 'number' ? expected.unitario : null;

        let totalSuper: number | null = null;
        let unitarioSuper: number | null = null;
        let errorSuper: string | undefined;

        // Los fixtures con `method: cotizarRigidPrintedByProducto` cotizan por
        // producto, no por variante. El super motor hoy sólo tiene dispatcher
        // por variante — los salteamos como "no aplicable".
        if (input.method !== 'cotizarVariante' || !input.varianteId) {
          resultados.push({
            motor,
            caso: name,
            totalV1,
            totalSuper: null,
            unitarioV1,
            unitarioSuper: null,
            diffTotalPct: null,
            errorSuper: 'método no soportado en super motor (cotizarRigidPrintedByProducto)',
          });
          // No fallamos el test — sólo reportamos.
          expect(true).toBe(true);
          return;
        }

        try {
          const r = (await service.cotizarVarianteV2(
            AUTH,
            input.varianteId,
            input.payload as never,
            { forceMotor: 'universal' },
          )) as CotizacionCanonica;
          totalSuper = r.total;
          unitarioSuper = r.unitario;
        } catch (err) {
          errorSuper = err instanceof Error ? err.message : String(err);
        }

        const diffTotalPct =
          totalV1 != null && totalSuper != null && totalV1 !== 0
            ? ((totalSuper - totalV1) / totalV1) * 100
            : null;

        resultados.push({
          motor,
          caso: name,
          totalV1,
          totalSuper,
          unitarioV1,
          unitarioSuper,
          diffTotalPct,
          errorSuper,
        });

        // No hacemos hard assertion — sólo reportamos. El test sirve de
        // radar, no de gate bloqueante. Un dashboard posterior decide cuándo
        // estamos listos para P3.b.
        expect(true).toBe(true);
      },
      60000,
    );
  });
});
