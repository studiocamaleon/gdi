/**
 * Etapa B — el tamaño del pliego (A4/A3) es un input POR COTIZACIÓN.
 * Mismo documento cotizado como A4 y como A3: el pliego de impresión cambia
 * (⇒ factorA4 ⇒ clicks), y en ambos casos pliegos = hojas físicas (1 pose/pliego).
 *
 * Corre contra gdi_saas_test (DB aislada, test/jest-setup-db.ts).
 */
import { PrismaClient } from '@prisma/client';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import {
  provisionarPlantillaCentroCopiado,
  CC_PRODUCTO_CODIGO,
} from '../provisionar-plantilla';
import { runtimePliegoImpresion, piezaDocumento, PliegoDim } from '../pliegos';

const A4: PliegoDim = { preset: 'A4', anchoMm: 210, altoMm: 297 };
const A3: PliegoDim = { preset: 'A3', anchoMm: 297, altoMm: 420 };

const prisma = new PrismaClient();

let tenantId: string;
let motor: MotorUniversalService;
let productoId: string;
let configPasoId: string;
let maquinaId: string;
let modoColor: 'BN' | 'CMYK';
let papelVarianteId: string;

beforeAll(async () => {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'gdi-demo' } });
  tenantId = tenant?.id ?? '';
  if (!tenantId) return;

  motor = new MotorUniversalService(
    prisma as never,
    new AplicarPrecioService(),
    new PreciosEspecialesClientesService(prisma as never),
  );

  await provisionarPlantillaCentroCopiado(prisma, tenantId);

  const producto = await prisma.producto.findUniqueOrThrow({
    where: { tenantId_codigo: { tenantId, codigo: CC_PRODUCTO_CODIGO } },
    include: {
      rutasAlternativas: {
        include: { configPasos: { include: { maquinasCandidatas: true } } },
      },
    },
  });
  productoId = producto.id;
  const cp = producto.rutasAlternativas[0].configPasos[0];
  configPasoId = cp.id;
  const pref =
    cp.maquinasCandidatas.find((c) => c.esPreferida) ?? cp.maquinasCandidatas[0];
  maquinaId = pref.maquinaId;
  modoColor = pref.modoColorAllowedModes.includes('CMYK') ? 'CMYK' : 'BN';

  const papel = await prisma.materiaPrima.findFirstOrThrow({
    where: { tenantId, subfamilia: 'SUSTRATO_HOJA' },
    include: { variantes: { where: { activo: true } } },
    orderBy: { nombre: 'asc' },
  });
  papelVarianteId = papel.variantes[0].id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function cotizarDoc(pliego: PliegoDim, hojas: number) {
  const jobContext = {
    cantidad: hojas,
    caras: 1,
    piezas: [piezaDocumento(pliego, hojas)],
    modoColor,
    slotMateriales: { [`${configPasoId}_sustrato_principal`]: papelVarianteId },
    [`maquinaSeleccionada_${configPasoId}`]: maquinaId,
    // Etapa B: el pliego viaja por el runtime del jobContext.
    ...runtimePliegoImpresion(configPasoId, pliego),
  } as unknown as Parameters<MotorUniversalService['cotizar']>[0]['jobContext'];

  const r = await motor.cotizar({
    tenantId,
    productoId,
    periodo: '2026-03',
    jobContext,
  });
  if (!r.exitoso)
    console.error(`ERRORES (${pliego.preset}):`, JSON.stringify(r.errores, null, 2));
  const imp = r.cotizacion!.pasos.find(
    (p) => p.familiaCodigo === 'impresion_por_hoja',
  )!;
  const outs = imp.outputsCanonicos as Record<string, unknown>;
  return {
    exitoso: r.exitoso,
    pliegos: outs.pliegos_impresos as number,
    anchoMm: Number(outs.pliego_impresion_ancho_mm),
    altoMm: Number(outs.pliego_impresion_alto_mm),
    areaM2: Number(outs.pliego_impresion_area_m2),
  };
}

it('A4 y A3: el pliego cambia por cotización, pliegos = hojas en ambos', async () => {
  if (!tenantId) return;
  const a4 = await cotizarDoc(A4, 6);
  const a3 = await cotizarDoc(A3, 6);

  expect(a4.exitoso).toBe(true);
  expect(a3.exitoso).toBe(true);

  // 1 pose por pliego ⇒ pliegos = hojas, independientemente del tamaño.
  expect(a4.pliegos).toBe(6);
  expect(a3.pliegos).toBe(6);

  // El pliego efectivo cambió: A3 ≈ 2× el área de A4 (⇒ factorA4 = 2 ⇒ 2 clicks).
  expect(a3.anchoMm).toBeGreaterThan(a4.anchoMm);
  const ratio = a3.areaM2 / a4.areaM2;
  expect(ratio).toBeGreaterThan(1.9);
  expect(ratio).toBeLessThan(2.1);
});
