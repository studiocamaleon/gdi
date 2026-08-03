/**
 * Verificación de la Etapa A del TPV Centro de copiado: el producto plantilla
 * "Impresión de documento" cotiza correctamente contra el motor real, con la
 * aritmética del adaptador (documento de N páginas → hojas físicas) simulada a
 * mano (el adaptador se implementa en la Etapa C).
 *
 * Corre contra la DB aislada de test (gdi_saas_test, forzada por
 * test/jest-setup-db.ts) — nunca toca la base dev ni integraciones vivas.
 */
import { PrismaClient } from '@prisma/client';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import {
  provisionarPlantillaCentroCopiado,
  CC_PRODUCTO_CODIGO,
} from '../provisionar-plantilla';

const prisma = new PrismaClient();

let tenantId: string;
let motor: MotorUniversalService;
let productoId: string;
let configPasoId: string;
let papelVarianteId: string;
/** Candidata preferida disponible en el seed (en test DB hay una sola láser). */
let maquinaPrefId: string;
let modoColorPref: 'BN' | 'CMYK';
/** Ruteo por color, sólo si el seed tiene máquina de color Y de B/N distintas. */
let maquinaColorId: string | null = null;
let maquinaBnId: string | null = null;

beforeAll(async () => {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'gdi-demo' } });
  tenantId = tenant?.id ?? '';
  if (!tenantId) return;

  motor = new MotorUniversalService(
    prisma as never,
    new AplicarPrecioService(),
    new PreciosEspecialesClientesService(prisma as never),
  );

  // Provisión idempotente y race-safe (varios specs corren en paralelo sobre la
  // misma DB de test y comparten el plantilla).
  await provisionarPlantillaCentroCopiado(prisma, tenantId);

  const producto = await prisma.producto.findUniqueOrThrow({
    where: { tenantId_codigo: { tenantId, codigo: CC_PRODUCTO_CODIGO } },
    include: {
      rutasAlternativas: {
        include: {
          configPasos: {
            include: {
              maquinasCandidatas: true,
              rutaPaso: { select: { familiaCodigo: true } },
            },
          },
        },
      },
    },
  });
  productoId = producto.id;
  // La ruta puede tener un 2º paso opcional (anillado) si un spec de anillado corre
  // en paralelo sobre la ruta compartida: tomar SIEMPRE el de impresión.
  const cp =
    producto.rutasAlternativas[0].configPasos.find(
      (c) => c.rutaPaso?.familiaCodigo === 'impresion_por_hoja',
    ) ?? producto.rutasAlternativas[0].configPasos[0];
  configPasoId = cp.id;

  const candidatas = cp.maquinasCandidatas;
  const pref = candidatas.find((c) => c.esPreferida) ?? candidatas[0];
  maquinaPrefId = pref.maquinaId;
  modoColorPref = pref.modoColorAllowedModes.includes('CMYK') ? 'CMYK' : 'BN';
  maquinaColorId =
    candidatas.find((c) => c.modoColorAllowedModes.includes('CMYK'))
      ?.maquinaId ?? null;
  maquinaBnId =
    candidatas.find((c) => c.modoColorAllowedModes.includes('BN'))?.maquinaId ??
    null;

  // Papel: cualquiera de SUSTRATO_HOJA del seed (el test DB no trae "Papel obra").
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

function jobDocumento(opts: {
  hojas: number;
  caras: 1 | 2;
  modoColor: 'BN' | 'CMYK';
  maquinaId: string;
}) {
  // El adaptador (Etapa C) produce esto: piezas del tamaño del pliego (algo
  // menor que A4 para forzar 1 pose/pliego ⇒ pliegos = hojas), cantidad = hojas.
  return {
    cantidad: opts.hojas,
    caras: opts.caras,
    piezas: [{ cantidad: opts.hojas, anchoMm: 200, altoMm: 287 }],
    modoColor: opts.modoColor,
    slotMateriales: {
      [`${configPasoId}_sustrato_principal`]: papelVarianteId,
    },
    [`maquinaSeleccionada_${configPasoId}`]: opts.maquinaId,
  } as unknown as Parameters<MotorUniversalService['cotizar']>[0]['jobContext'];
}

async function cotizar(job: ReturnType<typeof jobDocumento>) {
  return motor.cotizar({
    tenantId,
    productoId,
    periodo: '2026-03',
    jobContext: job,
  });
}

function pasoImpresion(r: Awaited<ReturnType<typeof cotizar>>) {
  return r.cotizacion!.pasos.find(
    (p) => p.familiaCodigo === 'impresion_por_hoja',
  )!;
}

const sustratoCantidad = (r: Awaited<ReturnType<typeof cotizar>>) =>
  pasoImpresion(r).materiales!.find(
    (m) => m.slotCodigo === 'sustrato_principal',
  )?.cantidad ?? 0;

it('documento doble faz: pliegos = hojas físicas (12 págs × 2 copias, doble faz ⇒ 12 hojas)', async () => {
  if (!tenantId) return;
  const r = await cotizar(
    jobDocumento({
      hojas: 12,
      caras: 2,
      modoColor: modoColorPref,
      maquinaId: maquinaPrefId,
    }),
  );
  if (!r.exitoso)
    console.error('ERRORES MOTOR:', JSON.stringify(r.errores, null, 2));
  expect(r.exitoso).toBe(true);
  const outs = pasoImpresion(r).outputsCanonicos as Record<string, unknown>;
  expect(outs.pliegos_impresos).toBe(12);
  expect(sustratoCantidad(r)).toBeGreaterThan(0); // papel consumido (por formato de compra)
});

it('el papel se cuenta por hoja física, no por carilla (invariante a las caras)', async () => {
  if (!tenantId) return;
  // Mismas 12 hojas físicas: simple faz (12 carillas) vs doble faz (24 carillas).
  // El papel NO debe duplicarse por las caras.
  const simple = await cotizar(
    jobDocumento({ hojas: 12, caras: 1, modoColor: modoColorPref, maquinaId: maquinaPrefId }),
  );
  const doble = await cotizar(
    jobDocumento({ hojas: 12, caras: 2, modoColor: modoColorPref, maquinaId: maquinaPrefId }),
  );
  expect(simple.exitoso && doble.exitoso).toBe(true);
  expect(sustratoCantidad(doble)).toBe(sustratoCantidad(simple));
  expect(sustratoCantidad(simple)).toBeGreaterThan(0);
});

it('simple faz: pliegos = carillas (el doble que las mismas carillas a doble faz)', async () => {
  if (!tenantId) return;
  // 24 carillas simple faz ⇒ 24 hojas físicas
  const r = await cotizar(
    jobDocumento({
      hojas: 24,
      caras: 1,
      modoColor: modoColorPref,
      maquinaId: maquinaPrefId,
    }),
  );
  expect(r.exitoso).toBe(true);
  const outs = pasoImpresion(r).outputsCanonicos as Record<string, unknown>;
  expect(outs.pliegos_impresos).toBe(24);
});

it('color cuesta más que B/N (sólo si el seed tiene máquina de color y de B/N)', async () => {
  if (!tenantId) return;
  if (!maquinaColorId || !maquinaBnId || maquinaColorId === maquinaBnId) {
    // El seed de test tiene una sola láser: el ruteo por color se verifica
    // estructuralmente en dev (candidatas con modoColorAllowedModes). Skip.
    return;
  }
  const bn = await cotizar(
    jobDocumento({ hojas: 12, caras: 2, modoColor: 'BN', maquinaId: maquinaBnId }),
  );
  const color = await cotizar(
    jobDocumento({
      hojas: 12,
      caras: 2,
      modoColor: 'CMYK',
      maquinaId: maquinaColorId,
    }),
  );
  expect(bn.exitoso).toBe(true);
  expect(color.exitoso).toBe(true);
  expect(color.cotizacion!.costos.total).toBeGreaterThan(
    bn.cotizacion!.costos.total,
  );
});
