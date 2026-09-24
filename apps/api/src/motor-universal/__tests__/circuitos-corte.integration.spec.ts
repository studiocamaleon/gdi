import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { MotorUniversalService } from '../motor.service';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import { MaquinariaService } from '../../maquinaria/maquinaria.service';
import { configuracionCorteInicial } from '../../maquinaria/procesamiento-corte';
import {
  emitirCotizacionF4,
  ejecutarOrdenF4,
  serviciosRecorridoF4,
} from '../../../test/soporte-recorridos-f4';
import type { JobContext } from '../tipos';

const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><path d="M0 0H200V50H100V100H0Z"/></svg>';
type Caso = {
  familia: 'cnc' | 'troquelado_digital' | 'corte_laser' | 'plotter_corte';
  herramientas: boolean;
  impresion: boolean;
  modo: 'medidas' | 'svg' | 'placas';
};

/** Catálogo completo y efímero: nunca agrega máquinas ni órdenes a desarrollo. */
async function preparar(tx: Prisma.TransactionClient, caso: Caso) {
  const rollo = caso.familia === 'plotter_corte';
  const { id: tenantId } = await tx.tenant.findUniqueOrThrow({
    where: { slug: 'gdi-demo' },
  });
  const base = await tx.producto.findFirstOrThrow({
    where: { tenantId, codigo: 'RIGIDO-CUSTOM' },
  });
  const tarifa = await tx.centroCostoTarifaPeriodo.findFirstOrThrow({
    where: { tenantId, estado: 'PUBLICADA', periodo: '2026-06' },
  });
  const planta = await tx.planta.findFirstOrThrow({ where: { tenantId } });
  const mp = await tx.materiaPrima.findFirstOrThrow({
    where: {
      tenantId,
      subfamilia: rollo ? 'SUSTRATO_ROLLO_FLEXIBLE' : 'SUSTRATO_RIGIDO',
      activo: true,
    },
  });
  const variante = await tx.materiaPrimaVariante.create({
    data: {
      tenantId,
      materiaPrimaId: mp.id,
      sku: `QA-CORTE-${randomUUID()}`,
      nombreVariante: 'QA · Placa 1000 × 1000 × 3 mm',
      precioReferencia: 1000,
      unidadStock: 'M2',
      unidadCompra: 'M2',
      atributosVarianteJson: rollo
        ? { ancho: 1, largo: 50, anchoMm: 1000, largoRolloMm: 50000 }
        : { anchoMm: 1000, altoMm: 1000, largoMm: 1000, espesorMm: 3 },
    },
  });
  const { prisma } = serviciosRecorridoF4(tx);
  const servicio = new MaquinariaService(prisma as never);
  const user = await tx.user.findFirstOrThrow();
  const actor = { tenantId, userId: user.id, email: user.email } as never;
  const plantilla = {
    cnc: 'router_cnc',
    troquelado_digital: 'mesa_de_corte',
    corte_laser: 'corte_laser',
    plotter_corte: 'plotter_de_corte',
  }[caso.familia];
  const tipo =
    caso.familia === 'cnc'
      ? 'FRESA'
      : caso.familia === 'corte_laser'
        ? 'LASER'
        : 'CUCHILLA';
  const configuracion = {
    ...configuracionCorteInicial(),
    preparacionMin: 5,
    limpiezaMin: 2,
    cargaDescargaPlacaMin: 1,
    herramientas: [
      {
        id: 'corte',
        nombre: 'QA · Herramienta',
        tipo,
        activo: true,
        posicion: 1,
        montada: true,
        operaciones: ['CORTE_COMPLETO'],
        espesorMaxMm: 10,
        desgaste: { modo: 'INCLUIDO_CENTRO' },
      },
    ],
  };
  const maquina = await servicio.create(actor, {
    nombre: `QA · ${caso.familia}`,
    plantilla,
    plantaId: planta.id,
    centroCostoPrincipalId: tarifa.centroCostoId,
    estado: 'activa',
    estadoConfiguracion: 'lista',
    activo: true,
    geometriaTrabajo:
      caso.familia === 'cnc' ? 'volumen' : rollo ? 'rollo' : 'plano',
    unidadProduccionPrincipal: rollo
      ? 'm2_h'
      : caso.familia === 'corte_laser'
        ? 'mm_s'
        : caso.familia === 'cnc'
          ? 'mm_min'
          : 'm2',
    anchoUtil: rollo ? 1600 : 1000,
    largoUtil: 1000,
    altoUtil: 100,
    espesorMaximo: 10,
    parametrosTecnicos: caso.herramientas
      ? { procesamientoCorte: configuracion }
      : rollo
        ? { geometria: 'ROLLO', modosOperacionSoportados: ['ROLLO', 'HOJAS'] }
        : {},
    perfilesOperativos: [
      {
        nombre: 'QA · Corte 3 mm',
        tipoPerfil: caso.familia === 'cnc' ? 'mecanizado' : 'corte',
        activo: true,
        productivityValue: rollo ? 10 : 1000,
        productivityUnit: rollo ? 'm2_h' : 'mm_min',
        setupMin: caso.herramientas ? 0 : 5,
        detalle: caso.herramientas
          ? {
              procesamientoCorteVersion: 1,
              herramientaId: 'corte',
              operacionCorte: 'CORTE_COMPLETO',
              material: [mp.id],
              espesorMinMm: 3,
              espesorMaxMm: 3,
              modoVelocidad: 'POR_PASADA',
              pasadas: 2,
              anchoCorteMm: 0,
            }
          : rollo
            ? {}
            : {
                tipoOperacion: 'CORTE',
                material: [mp.id],
                espesorMinMm: 3,
                espesorMaxMm: 3,
              },
      },
    ],
    consumibles: [],
    componentesDesgaste: caso.herramientas
      ? []
      : [
          {
            nombre: 'QA · Fresa',
            tipo: 'fresa',
            unidadDesgaste: 'horas',
            vidaUtilEstimada: 100,
            precioUnitario: 1,
            activo: true,
          },
        ],
  } as never);
  expect(maquina.diagnosticoConfiguracion.faltantes).toEqual([]);
  expect(maquina.estadoConfiguracion).toBe('lista');
  const tinta = caso.impresion
    ? await tx.materiaPrimaVariante.findFirstOrThrow({
        where: {
          tenantId,
          materiaPrima: {
            nombre: { contains: 'Tinta', mode: 'insensitive' },
            activo: true,
          },
          activo: true,
        },
      })
    : null;
  const perfilUvId = randomUUID();
  const impresora = caso.impresion
    ? await servicio.create(actor, {
        nombre: 'QA · Impresora UV',
        plantilla: 'impresora_gran_formato_por_area',
        plantaId: planta.id,
        centroCostoPrincipalId: tarifa.centroCostoId,
        estado: 'activa',
        estadoConfiguracion: 'lista',
        activo: true,
        geometriaTrabajo: 'plano',
        unidadProduccionPrincipal: 'm2_h',
        anchoUtil: 1000,
        largoUtil: 1000,
        parametrosTecnicos: {
          geometria: rollo ? 'ROLLO' : 'MESA_EXTENSORA',
          tecnologia: 'UV',
          margenesNoImprimiblesMm: { izq: 0, der: 0, sup: 0, inf: 0 },
        },
        perfilesOperativos: [
          {
            id: perfilUvId,
            nombre: 'QA · CMYK',
            tipoPerfil: 'impresion',
            activo: true,
            productivityValue: 10,
            productivityUnit: 'm2_h',
            detalle: { colores: 'CMYK' },
          },
        ],
        consumibles: ['cian', 'magenta', 'amarillo', 'negro'].map((color) => ({
          nombre: `QA · ${color}`,
          perfilOperativoId: perfilUvId,
          materiaPrimaVarianteId: tinta!.id,
          tipo: 'tinta',
          unidad: 'ml',
          consumoBase: 1,
          activo: true,
          detalle: { color },
        })),
        componentesDesgaste: [
          {
            nombre: 'QA · Cabezal',
            tipo: 'cabezal',
            unidadDesgaste: 'horas',
            vidaUtilEstimada: 100,
            precioUnitario: 1,
            activo: true,
          },
        ],
      } as never)
    : null;
  if (impresora)
    expect(impresora.diagnosticoConfiguracion.faltantes).toEqual([]);
  const producto = await tx.producto.create({
    data: {
      tenantId,
      codigo: `QA-${randomUUID()}`,
      nombre: 'QA · Rígido impreso y cortado',
      subcategoriaComercialId: base.subcategoriaComercialId,
      dimensionesRequeridas: [],
      modoMedidas: 'LIBRE',
      atributosComercialesJson: {
        geometriasComerciales: {
          version: 1,
          modo: 'AMBAS',
          fuentes: [],
          permitirCotizacionManual: true,
        },
      },
      precioConfigJson: {
        metodoCalculo: 'por_margen',
        detalle: { marginPct: 25 },
      },
    },
  });
  const ruta = await tx.ruta.create({
    data: {
      tenantId,
      codigo: `QA-${randomUUID()}`,
      nombre: 'QA · Impresión y corte',
    },
  });
  const pImpresion = impresora
    ? await tx.rutaPaso.create({
        data: {
          tenantId,
          rutaId: ruta.id,
          orden: 0,
          familiaCodigo: 'impresion_por_area',
          nombreVisible: 'Imprimir',
        },
      })
    : null;
  const pCorte = await tx.rutaPaso.create({
    data: {
      tenantId,
      rutaId: ruta.id,
      orden: 1,
      familiaCodigo: caso.familia,
      nombreVisible: 'Cortar',
    },
  });
  await tx.rutaVersion.create({
    data: {
      tenantId,
      rutaId: ruta.id,
      version: 1,
      snapshotJson: json({ pasos: [pImpresion, pCorte].filter(Boolean) }),
    },
  });
  const alternativa = await tx.productoRutaAlternativa.create({
    data: {
      tenantId,
      productoId: producto.id,
      rutaId: ruta.id,
      rutaVersion: 1,
      nombre: ruta.nombre,
      esPreferida: true,
    },
  });
  const nestingConfig = {
    margins: { leftMm: 5, rightMm: 5, topMm: 5, bottomMm: 5, startMm: 5, endMm: 5 },
    separationHMm: 5,
    separationVMm: 5,
    pieceBleedMm: 0,
    allowRotation: true,
    costing: { strategy: 'simple' },
  };
  if (impresora && pImpresion) {
    const c = await tx.productoConfigPaso.create({
      data: {
        tenantId,
        productoRutaAlternativaId: alternativa.id,
        rutaPasoId: pImpresion.id,
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-3',
        mecanismoCantidad: 'CALCULADO_POR_PASO',
        maquinaM1Id: impresora.id,
        perfilM1Id: impresora.perfilesOperativos[0].id,
        paramsPasoJson: { nestingConfig },
      },
    });
    await tx.productoConfigPasoSlotMaterial.create({
      data: {
        tenantId,
        productoConfigPasoId: c.id,
        slotCodigo: 'sustrato_principal',
        modoSeleccion: 'HARDCODED',
        materialVarianteId: variante.id,
      },
    });
  }
  const corte = await tx.productoConfigPaso.create({
    data: {
      tenantId,
      productoRutaAlternativaId: alternativa.id,
      rutaPasoId: pCorte.id,
      modoActivacion: 'OBLIGATORIO',
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      maquinaM1Id: maquina.id,
      perfilM1Id: caso.herramientas ? null : maquina.perfilesOperativos[0].id,
      paramsPasoJson: {
        usarDisenoVectorial: true,
        cotizarOperacionesVectoriales: caso.herramientas,
        nestingConfig,
      },
    },
  });
  await tx.productoConfigPasoSlotMaterial.create({
    data: {
      tenantId,
      productoConfigPasoId: corte.id,
      slotCodigo: 'sustrato_corte',
      ...(pImpresion
        ? {
            modoSeleccion: 'HEREDA_DE_PASO',
            heredaDeRutaPasoId: pImpresion.id,
            heredaDeSlotCodigo: 'sustrato_principal',
          }
        : { modoSeleccion: 'HARDCODED', materialVarianteId: variante.id }),
    },
  });
  const motor = new MotorUniversalService(
    prisma as never,
    new AplicarPrecioService(),
    new PreciosEspecialesClientesService(prisma as never),
  );
  return { tenantId, producto, motor, maquina, variante };
}

describe('aceptación: rígidos CNC/mesa/láser, solos y después de UV', () => {
  const db = new PrismaClient();
  afterAll(() => db.$disconnect());
  const casos: Caso[] = [
    ...(['cnc', 'troquelado_digital', 'corte_laser'] as const).flatMap(
      (familia) =>
        (['medidas', 'svg', 'placas'] as const).flatMap((modo) =>
          [false, true].map((impresion) => ({
            familia,
            modo,
            impresion,
            herramientas: true,
          })),
        ),
    ),
    ...(['medidas', 'svg', 'placas'] as const).map((modo) => ({
      familia: 'cnc' as const,
      modo,
      impresion: false,
      herramientas: false,
    })),
    ...[false, true].map((impresion) => ({
      familia: 'plotter_corte' as const,
      modo: 'medidas' as const,
      impresion,
      herramientas: false,
    })),
  ];
  it.each(casos)(
    '$familia · $modo · UV=$impresion · herramientas=$herramientas',
    async (caso) => {
      const rollback = new Error('rollback QA corte');
      try {
        await db.$transaction(
          async (tx) => {
            const s = await preparar(tx, caso);
            const cantidad = 50;
            const jobContext: JobContext = {
              cantidad,
              modoCotizacionVectorial: caso.modo,
              ...(caso.modo === 'medidas'
                ? {
                    medidaCustomMm: { anchoMm: 200, altoMm: 100 },
                    piezas: [{ anchoMm: 200, altoMm: 100, cantidad }],
                  }
                : caso.modo === 'svg'
                  ? {
                      disenoVectorialFuente: {
                        schemaVersion: 1 as const,
                        svg,
                        nombreArchivo: 'QA-L.svg',
                        anchoFinalMm: 200,
                      },
                    }
                  : {
                      placasVectorialesManuales: 2,
                      metrosCortePorPlacaVectorial: 15,
                    }),
            };
            const guardada = await s.motor.cotizarYGuardar({
              tenantId: s.tenantId,
              productoId: s.producto.id,
              periodo: '2026-06',
              jobContext,
            });
            expect(
              guardada.result.errores.filter((e) => e.severidad === 'ERROR'),
            ).toEqual([]);
            expect(guardada.result.exitoso).toBe(true);
            const pasos = guardada.result.cotizacion!.pasos;
            const corte = pasos.at(-1)!;
            const nesting = corte.nestingResult!;
            expect(corte.tiempo!.totalMin).toBeGreaterThan(0);
            expect(nesting.cantidadCalculada).toBeGreaterThan(0);
            if (caso.herramientas) {
              expect(
                corte.tiempo!.procesamientoCorte!.operaciones.map(
                  (o) => o.operacion,
                ),
              ).toEqual(['CORTE_COMPLETO']);
              expect(
                corte.tiempo!.procesamientoCorte!.operaciones[0].metros,
              ).toBeCloseTo(30);
              expect(
                corte.tiempo!.procesamientoCorte!.operaciones[0]
                  .metrosProcesados,
              ).toBeCloseTo(60);
            }
            if (caso.modo === 'placas') {
              expect(nesting.algorithm).toBe('manual-vector-estimate-v1');
              expect(nesting.placements).toHaveLength(0);
              expect(nesting.cantidadCalculada).toBe(2);
            } else expect(nesting.placements).toHaveLength(cantidad);
            if (caso.impresion) {
              expect(
                corte.materiales?.filter(
                  (m) => m.materialVarianteId === s.variante.id,
                ),
              ).toHaveLength(0);
              const impreso = pasos[0].nestingResult!;
              const posiciones = (n: typeof nesting) =>
                n.placements.map((p) => [
                  p.substrateIndex,
                  p.xMm,
                  p.yMm,
                  p.rotated,
                ]);
              expect(posiciones(nesting)).toEqual(posiciones(impreso));
              expect(nesting.substrates).toEqual(impreso.substrates);
            }
            const totalMaterial = pasos
              .flatMap((p) => p.materiales ?? [])
              .filter((m) => m.materialVarianteId === s.variante.id)
              .reduce((total, m) => total + m.costoTotal, 0);
            expect(totalMaterial).toBeCloseTo(
              nesting.cantidadCalculada * 1000,
              2,
            );
            const { orden, ordenes, auth } = await emitirCotizacionF4(
              tx,
              guardada,
            );
            const { orden: terminada } = await ejecutarOrdenF4(
              tx,
              ordenes,
              auth,
              orden.id,
            );
            expect(terminada.estado).toBe('finalizada');
            throw rollback;
          },
          { timeout: 30000 },
        );
        throw new Error('La prueba debe revertirse');
      } catch (error) {
        if (error !== rollback) throw error;
      }
    },
    45000,
  );
});
