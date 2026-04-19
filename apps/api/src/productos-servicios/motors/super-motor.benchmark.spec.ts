/**
 * SM.5.b — Benchmark super motor vs motores v2 específicos.
 *
 * No valida valores concretos (no es un test unitario). Corre la misma
 * cotización contra el super motor y el motor v2 específico de cada
 * producto seed, imprime la tabla de comparación, y falla solo si alguno
 * de los dos motores tira excepción.
 *
 * El output ayuda a decidir cuándo retirar los motores v2 específicos
 * (SM.5.c): cuando los diffs estén por debajo de un umbral aceptable
 * (5-10%) para el 80%+ de los productos.
 *
 * Uso:
 *   cd apps/api && npx jest super-motor.benchmark --verbose
 */
import { PrismaService } from '../../prisma/prisma.service';
import { ProductosServiciosService } from '../productos-servicios.service';
import type { CurrentAuth } from '../../auth/auth.types';
import type { CotizacionCanonica } from '../dto/cotizacion-canonica.dto';

const AUTH: CurrentAuth = {
  userId: '2bb149b0-1005-4075-b44f-908764d5e79e',
  sessionId: 'sm-benchmark',
  tenantId: '0e7937a0-c093-4cdd-bc5e-fe4de1385ce8',
  membershipId: 'dd920f84-8819-45bd-b4db-6531fc2d0ed0',
  role: 'ADMINISTRADOR' as CurrentAuth['role'],
  email: 'admin@gdi-demo.local',
};

// Productos seed con motor v2 piloto y ruta configurada.
// Cada entry: [descripcion, varianteId, payloadExtra]
const CASOS: Array<[string, string, Record<string, unknown>]> = [
  [
    'Tarjetas Visita Estandar 9x5 × 100 / simple_faz / CMYK',
    '947969f5-442f-4ede-b43b-26df9a3a4e8a',
    {
      cantidad: 100,
      seleccionesBase: [
        { dimension: 'caras', valor: 'simple_faz' },
        { dimension: 'tipo_impresion', valor: 'cmyk' },
      ],
    },
  ],
  [
    'Tarjetas Visita Estandar × 500 / doble_faz / CMYK',
    '947969f5-442f-4ede-b43b-26df9a3a4e8a',
    {
      cantidad: 500,
      seleccionesBase: [
        { dimension: 'caras', valor: 'doble_faz' },
        { dimension: 'tipo_impresion', valor: 'cmyk' },
      ],
    },
  ],
  [
    'Tarjetas × 250 / simple_faz / BN',
    '947969f5-442f-4ede-b43b-26df9a3a4e8a',
    {
      cantidad: 250,
      seleccionesBase: [
        { dimension: 'caras', valor: 'simple_faz' },
        { dimension: 'tipo_impresion', valor: 'bn' },
      ],
    },
  ],
];

type Resultado = {
  caso: string;
  totalV2: number | null;
  totalSuper: number | null;
  diffAbs: number | null;
  diffPct: number | null;
  pasosV2: number;
  pasosSuper: number;
  errorV2?: string;
  errorSuper?: string;
};

describe('SM.5.b · Super motor vs motores v2 específicos', () => {
  let prisma: PrismaService;
  let service: ProductosServiciosService;
  const resultados: Resultado[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new ProductosServiciosService(prisma);
  });

  afterAll(async () => {
    // Imprimir tabla de resultados al final.
    console.log('\n════════ SM.5.b · Comparación super motor vs v2 ════════');
    console.log('Caso'.padEnd(56) + 'total v2'.padStart(11) + 'total super'.padStart(13) + 'diff %'.padStart(10));
    console.log('─'.repeat(90));
    for (const r of resultados) {
      const caso = r.caso.slice(0, 55).padEnd(56);
      const v2 = r.totalV2 != null ? `$${r.totalV2.toFixed(0)}`.padStart(11) : 'ERROR'.padStart(11);
      const su = r.totalSuper != null ? `$${r.totalSuper.toFixed(0)}`.padStart(13) : 'ERROR'.padStart(13);
      const pct =
        r.diffPct != null
          ? `${r.diffPct > 0 ? '+' : ''}${r.diffPct.toFixed(1)}%`.padStart(10)
          : '—'.padStart(10);
      console.log(caso + v2 + su + pct);
    }
    console.log('─'.repeat(90));
    const okCount = resultados.filter(
      (r) => r.totalV2 != null && r.totalSuper != null && Math.abs(r.diffPct ?? 999) < 10,
    ).length;
    console.log(`Casos con diff < 10%: ${okCount}/${resultados.length}`);
    console.log('════════════════════════════════════════════════════════\n');
    await prisma.$disconnect();
  });

  it.each(CASOS)('%s', async (descripcion, varianteId, payloadExtra) => {
    const payload = {
      periodo: '2026-04',
      parametros: {},
      ...payloadExtra,
    } as never;

    // V2 específico (dispatcher con forceMode=V2).
    let totalV2: number | null = null;
    let pasosV2 = 0;
    let errorV2: string | undefined;
    try {
      const r = (await service.cotizarVarianteV2(AUTH, varianteId, payload, {
        forceMode: 'V2',
      })) as CotizacionCanonica;
      totalV2 = r.total;
      pasosV2 = r.pasos.length;
    } catch (err) {
      errorV2 = err instanceof Error ? err.message : String(err);
    }

    // Super motor.
    let totalSuper: number | null = null;
    let pasosSuper = 0;
    let errorSuper: string | undefined;
    try {
      const r = (await service.cotizarVarianteV2(AUTH, varianteId, payload, {
        forceMotor: 'universal',
      })) as CotizacionCanonica;
      totalSuper = r.total;
      pasosSuper = r.pasos.length;
    } catch (err) {
      errorSuper = err instanceof Error ? err.message : String(err);
    }

    const diffAbs = totalV2 != null && totalSuper != null ? totalSuper - totalV2 : null;
    const diffPct =
      totalV2 != null && totalSuper != null && totalV2 !== 0 ? (diffAbs! / totalV2) * 100 : null;

    resultados.push({
      caso: descripcion,
      totalV2,
      totalSuper,
      diffAbs,
      diffPct,
      pasosV2,
      pasosSuper,
      errorV2,
      errorSuper,
    });

    // Solo falla si ambos motores explotaron.
    if (errorV2 && errorSuper) {
      throw new Error(`Ambos motores fallaron.\nV2: ${errorV2}\nSuper: ${errorSuper}`);
    }
  });
});
