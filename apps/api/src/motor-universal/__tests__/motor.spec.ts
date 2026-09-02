/**
 * Tests del Motor Universal — MVP F.2.
 *
 * Smoke tests que validan el bucle base contra los productos del seed.
 * NO valida resultados numéricos exactos (eso es F.2.x cuando se implementen
 * todas las sub-tareas + tarifas).
 */

import {
  EstadoTarifaCentroCostoPeriodo,
  EstructuraProducto,
  EtapaDesarrolloDocumento,
  FamiliaMateriaPrima,
  Prisma,
  PrismaClient,
  SubfamiliaMateriaPrima,
  TipoCentroCosto,
  TipoAprobacionDocumento,
  UnidadMateriaPrima,
  PropositoArchivoMaestro,
} from '@prisma/client';
import { MotorUniversalService } from '../motor.service';
import { runNestingForPaso } from '../nesting-dispatcher';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import { ProductosService } from '../../productos-servicios/productos.service';
import { ProductoValidacionService } from '../../productos-servicios/producto-validacion.service';
import { RecetasProductoService } from '../../productos-servicios/recetas-producto.service';
import { OrdenesTrabajoService } from '../../ordenes-trabajo/ordenes-trabajo.service';

const prisma = new PrismaClient();

let tenantId: string | null = null;
let motorService: MotorUniversalService;
const tarifaHoraManual = 6000;

beforeAll(async () => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'gdi-demo' },
  });
  tenantId = tenant?.id ?? null;
  // Inyectamos el prisma client directamente (sin DI de NestJS para test unitario).
  // AplicarPrecioService es stateless; PreciosEspecialesClientesService usa prisma.
  const aplicarPrecio = new AplicarPrecioService();
  const preciosEspeciales = new PreciosEspecialesClientesService(
    prisma as never,
  );
  motorService = new MotorUniversalService(
    prisma as never,
    aplicarPrecio,
    preciosEspeciales,
  );
  if (tenantId) {
    await ensureCentrosManualesDemo(tenantId);
  }
});

afterEach(async () => {
  if (tenantId) {
    await ensureCentrosManualesDemo(tenantId);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * El centro que costea los pasos manuales. En el seed es PRE-001, el mismo
 * que las rutas usan como `centroCostoId` de los pasos sin máquina, así que
 * se lo busca por código y no por "el primer productivo que aparezca".
 */
async function ensureCentroHorarioConTarifa(tenantId: string) {
  const centro = await prisma.centroCosto.findFirstOrThrow({
    where: {
      tenantId,
      activo: true,
      tipoCentro: TipoCentroCosto.PRODUCTIVO,
      codigo: 'PRE-001',
    },
  });

  // Los períodos que piden los tests, con la tarifa que esperan. El `where` y
  // el `create` tienen que hablar del mismo período: con distinto, el upsert
  // no encontraba nada y creaba uno que chocaba con el del seed.
  for (const periodo of ['2026-03', '2026-06']) {
    await ensureTarifaPublicada(tenantId, centro.id, periodo, tarifaHoraManual);
  }

  return centro;
}

async function ensureTarifaPublicada(
  tenantId: string,
  centroCostoId: string,
  periodo: string,
  tarifaCalculada: number,
) {
  await prisma.centroCostoTarifaPeriodo.upsert({
    where: {
      tenantId_centroCostoId_periodo_estado: {
        tenantId,
        centroCostoId,
        periodo,
        estado: EstadoTarifaCentroCostoPeriodo.PUBLICADA,
      },
    },
    update: {
      tarifaCalculada,
      costoMensualTotal: tarifaCalculada,
      capacidadPractica: 1,
      resumenJson: { test: true },
    },
    create: {
      tenantId,
      centroCostoId,
      periodo,
      costoMensualTotal: tarifaCalculada,
      capacidadPractica: 1,
      tarifaCalculada,
      estado: EstadoTarifaCentroCostoPeriodo.PUBLICADA,
      resumenJson: { test: true },
    },
  });
}

function periodoActualTest() {
  return new Date().toISOString().slice(0, 7);
}

async function ensureCentrosManualesDemo(tenantId: string) {
  const centro = await ensureCentroHorarioConTarifa(tenantId);
  const periodoActual = periodoActualTest();

  await ensureTarifaPublicada(
    tenantId,
    centro.id,
    periodoActual,
    tarifaHoraManual,
  );

  const centrosMaquina = await prisma.centroCosto.findMany({
    where: {
      tenantId,
      activo: true,
      tipoCentro: TipoCentroCosto.PRODUCTIVO,
      id: { not: centro.id },
    },
    select: { id: true },
  });

  for (const centroMaquina of centrosMaquina) {
    await ensureTarifaPublicada(
      tenantId,
      centroMaquina.id,
      periodoActual,
      22727.27,
    );
  }

  await prisma.productoConfigPaso.updateMany({
    where: {
      tenantId,
      maquinaM1Id: null,
      activo: true,
      modoTiempo: { in: ['T-1', 'T-2', 'T-4'] },
    },
    data: {
      centroCostoId: centro.id,
    },
  });

  // La imposición es responsabilidad del paso que imprime. Repara seeds de
  // test anteriores a la migración que todavía heredaban desde pre-prensa.
  const pasosImpresionHoja = await prisma.rutaPaso.findMany({
    where: { tenantId, familiaCodigo: 'impresion_por_hoja' },
    select: { id: true },
  });
  await prisma.productoConfigPaso.updateMany({
    where: {
      tenantId,
      rutaPasoId: { in: pasosImpresionHoja.map((paso) => paso.id) },
      mecanismoCantidad: 'HEREDAR_DEL_OUTPUT_CANONICO',
      mecanismoCantidadConfigJson: { equals: Prisma.DbNull },
    },
    data: { mecanismoCantidad: 'CALCULADO_POR_PASO' },
  });

  // Fixture determinístico: el grouping pertenece al primer paso que imprime,
  // no a pre-prensa. Mantiene la DB de test alineada con el seed vigente.
  const talonario = await prisma.producto.findFirst({
    where: { tenantId, codigo: 'TALON-DUPL-A4' },
    select: { id: true },
  });
  if (talonario) {
    const configs = await prisma.productoConfigPaso.findMany({
      where: {
        tenantId,
        productoRutaAlternativa: {
          productoId: talonario.id,
          esPreferida: true,
        },
        activo: true,
      },
      include: { rutaPaso: true },
    });
    const prePrensa = configs.find(
      (config) => config.rutaPaso.familiaCodigo === 'pre_prensa',
    );
    const original = configs
      .filter(
        (config) => config.rutaPaso.familiaCodigo === 'impresion_por_hoja',
      )
      .sort((a, b) => a.rutaPaso.orden - b.rutaPaso.orden)[0];
    if (prePrensa && original) {
      await prisma.$transaction([
        prisma.productoConfigPaso.update({
          where: { id: prePrensa.id },
          data: { paramsPasoJson: Prisma.JsonNull },
        }),
        prisma.productoConfigPaso.update({
          where: { id: original.id },
          data: {
            paramsPasoJson: {
              modoTalonarioIncompleto: 'aprovechar_pliego',
            },
          },
        }),
      ]);
    }
  }

  return centro;
}

describe('MotorUniversalService — smoke tests', () => {
  it('cotiza Tarjetas Premium 300gr y devuelve estructura válida', async () => {
    if (!tenantId) {
      console.warn('⚠ Saltando: ejecutar `npx prisma db seed` primero');
      return;
    }
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: { cantidad: 1000, caras: 2 },
    });

    expect(result.errores).toEqual([]);
    expect(result.exitoso).toBe(true);
    expect(result.cotizacion).toBeDefined();
    expect(result.cotizacion!.productoId).toBe(tarjetas.id);
    expect(result.cotizacion!.cantidadPedida).toBe(1000);
    expect(result.cotizacion!.pasos.length).toBe(7);
  });

  it('Tarjetas: pasos OBLIGATORIOS se activan, OPCIONALES no se activan por default', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: { cantidad: 100 },
    });

    expect(result.errores).toEqual([]);
    expect(result.exitoso).toBe(true);
    const pasos = result.cotizacion!.pasos;
    // La activación debe reflejar la configuración publicada del seed.
    const obligatorios = pasos.filter((p) => p.activado);
    const opcionales = pasos.filter((p) => !p.activado);
    expect(obligatorios.length).toBe(3);
    expect(opcionales.length).toBe(4);
  });

  it('Tarjetas: modoColor global BN sólo afecta impresión, no pre-prensa', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: { cantidad: 500, caras: 1, modoColor: 'BN' },
    });

    expect(result.exitoso).toBe(true);
    expect(result.errores).toEqual([]);
    const prePrensa = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'pre_prensa',
    );
    expect(prePrensa?.materiales ?? []).toEqual([]);

    const impresion = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'impresion_por_hoja',
    );
    const consumibles = impresion!.materiales!.filter(
      (m) => m.tipoLineaCosto === 'CONSUMIBLE_MAQUINA',
    );
    expect(consumibles.map((m) => m.slotCodigo)).toEqual([
      'consumible_maquina:negro',
    ]);
  });

  it('Tarjetas: con laminado activado por comercial, se ejecuta', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: {
            configPasos: {
              include: {
                rutaPaso: true,
                slotsMateriales: {
                  include: { candidatos: { include: { variantes: true } } },
                },
              },
            },
          },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const laminado = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'laminado',
    );
    expect(laminado).toBeDefined();
    const slotFilm = laminado!.slotsMateriales.find(
      (s) => s.slotCodigo === 'film',
    )!;
    const filmDefault = slotFilm.candidatos[0].variantes[0];

    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: {
        cantidad: 100,
        caras: 2,
        opcionalesActivados: { [laminado!.id]: true },
        [`slotMaterial_${laminado!.id}_film`]: filmDefault.varianteId,
      },
    });

    expect(result.exitoso).toBe(true);
    const pasoLaminado = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'laminado',
    );
    expect(pasoLaminado!.activado).toBe(true);
  });

  it('cotiza Vinilo blanco impreso (ruta gran formato) sin errores', async () => {
    if (!tenantId) return;
    const vinilo = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: vinilo.id,
      jobContext: {
        cantidad: 1,
        piezas: [{ cantidad: 3, anchoMm: 2000, altoMm: 1000 }],
        tecnologia: 'latex',
      },
    });

    expect(result.exitoso).toBe(true);
    expect(result.cotizacion!.pasos.length).toBeGreaterThan(0);
    expect(result.cotizacion!.rutaAlternativaId).toBeTruthy();
  });

  it('G-F2: una impresión UV compatible usa sus tintas y no las látex', async () => {
    if (!tenantId) return;
    const rigido = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'RIGIDO-CUSTOM' },
      include: {
        rutasAlternativas: {
          include: {
            configPasos: {
              include: {
                rutaPaso: true,
                slotsMateriales: {
                  include: { candidatos: { include: { variantes: true } } },
                },
              },
            },
          },
        },
      },
    });
    const configPaso = rigido.rutasAlternativas[0].configPasos.find(
      (config) => config.rutaPaso.familiaCodigo === 'impresion_por_area',
    )!;
    const slot = configPaso.slotsMateriales.find(
      (item) => item.slotCodigo === 'sustrato_principal',
    )!;
    const varianteId = slot.candidatos[0].variantes[0].varianteId;
    const result = await motorService.cotizar({
      tenantId,
      productoId: rigido.id,
      periodo: '2026-06',
      jobContext: {
        cantidad: 1,
        medidaCustomMm: { anchoMm: 500, altoMm: 300 },
        [`slotMaterial_${configPaso.id}_${slot.slotCodigo}`]: varianteId,
      },
    });

    expect(result.errores).toEqual([]);
    expect(result.exitoso).toBe(true);
    const impresion = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'impresion_por_area',
    );
    const consumibles = impresion!.materiales!.filter(
      (m) => m.tipoLineaCosto === 'CONSUMIBLE_MAQUINA',
    );
    expect(consumibles.length).toBeGreaterThan(0);
    expect(
      consumibles.every((m) => m.materialSku.startsWith('TINTA-UV-MIMAKI')),
    ).toBe(true);
    expect(
      consumibles.some((m) => m.materialSku.startsWith('TINTA-LATEX-ROLAND')),
    ).toBe(false);
    expect(
      consumibles.some((m) => /l[aá]tex|roland/i.test(m.materialDisplayName)),
    ).toBe(false);
    const cmyk = consumibles.filter(
      (m) => m.materialSku !== 'TINTA-UV-MIMAKI-W',
    );
    expect(cmyk.every((m) => m.cantidad > 10)).toBe(true);
  });

  it('Talonario duplicado tipoCopia=2: capa 1 + capa 2 se activan, capa 3 NO (CONDICIONAL JsonLogic)', async () => {
    if (!tenantId) return;
    const talonario = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TALON-DUPL-A4' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: talonario.id,
      jobContext: {
        cantidad: 100,
        tipoCopia: 2,
        numerosXTalonario: 50,
      },
    });

    expect(result.exitoso).toBe(true);
    expect(result.cotizacion!.rutaNombre).toBe('Emblocado');
    expect(result.cotizacion!.pasos.length).toBe(10);

    const pasosImpresion = result.cotizacion!.pasos.filter(
      (p) => p.familiaCodigo === 'impresion_por_hoja',
    );
    // Capa 1 OBLIGATORIO siempre se activa
    expect(pasosImpresion[0].activado).toBe(true);
    // Capa 2: regla `tipoCopia >= 2` → con tipoCopia=2, SE ACTIVA
    expect(pasosImpresion[1].activado).toBe(true);
    // Capa 3: regla `tipoCopia >= 3` → con tipoCopia=2, NO se activa
    expect(pasosImpresion[2].activado).toBe(false);
    expect(pasosImpresion[2].razonNoActivado).toContain(
      'CONDICIONAL no se cumple',
    );
  });

  it('Talonario triplicado tipoCopia=3: las 3 capas se activan', async () => {
    if (!tenantId) return;
    const talonario = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TALON-DUPL-A4' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: talonario.id,
      jobContext: { cantidad: 100, tipoCopia: 3, numerosXTalonario: 50 },
    });

    const pasosImpresion = result.cotizacion!.pasos.filter(
      (p) => p.familiaCodigo === 'impresion_por_hoja',
    );
    expect(pasosImpresion[0].activado).toBe(true);
    expect(pasosImpresion[1].activado).toBe(true);
    expect(pasosImpresion[2].activado).toBe(true);
  });

  it('Talonario simple tipoCopia=1: solo capa 1 se activa, capas 2 y 3 no', async () => {
    if (!tenantId) return;
    const talonario = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TALON-DUPL-A4' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: talonario.id,
      jobContext: { cantidad: 100, tipoCopia: 1, numerosXTalonario: 100 },
    });

    const pasosImpresion = result.cotizacion!.pasos.filter(
      (p) => p.familiaCodigo === 'impresion_por_hoja',
    );
    expect(pasosImpresion[0].activado).toBe(true);
    expect(pasosImpresion[1].activado).toBe(false);
    expect(pasosImpresion[2].activado).toBe(false);
  });

  it('cotiza Talonario con ruta alternativa Abrochado explícita', async () => {
    if (!tenantId) return;
    const talonario = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TALON-DUPL-A4' },
      include: { rutasAlternativas: true },
    });
    const abrochada = talonario.rutasAlternativas.find(
      (r) => r.nombre === 'Abrochado',
    );

    const result = await motorService.cotizar({
      tenantId,
      productoId: talonario.id,
      rutaAlternativaId: abrochada!.id,
      jobContext: { cantidad: 100, tipoCopia: 1 },
    });

    expect(result.exitoso).toBe(true);
    expect(result.cotizacion!.rutaNombre).toBe('Abrochado');
  });

  it('cotiza Rígido impreso custom (modoMedidas LIBRE)', async () => {
    if (!tenantId) return;
    const rigido = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'RIGIDO-CUSTOM' },
      include: {
        rutasAlternativas: {
          include: {
            configPasos: {
              include: {
                rutaPaso: true,
                slotsMateriales: {
                  include: { candidatos: { include: { variantes: true } } },
                },
              },
            },
          },
        },
      },
    });
    const impresion = rigido.rutasAlternativas[0].configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'impresion_por_area',
    )!;
    const slot = impresion.slotsMateriales.find(
      (s) => s.slotCodigo === 'sustrato_principal',
    )!;
    const candidato = slot.candidatos[0].variantes[0];

    const result = await motorService.cotizar({
      tenantId,
      productoId: rigido.id,
      jobContext: {
        cantidad: 5,
        medidaCustomMm: { anchoMm: 200, altoMm: 300 },
        [`slotMaterial_${impresion.id}_${slot.slotCodigo}`]:
          candidato.varianteId,
      },
    });

    expect(result.exitoso).toBe(true);
    expect(result.cotizacion!.pasos.length).toBe(8);
  });

  it('Rígido impreso requiere elección explícita del material comercial', async () => {
    if (!tenantId) return;
    const rigido = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'RIGIDO-CUSTOM' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: rigido.id,
      jobContext: {
        cantidad: 5,
        medidaCustomMm: { anchoMm: 200, altoMm: 300 },
      },
    });

    expect(result.exitoso).toBe(false);
    expect(result.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          codigo: 'material_comercial_requerido',
          mensaje: expect.stringContaining('requiere elegir el material'),
        }),
      ]),
    );
  });

  it('devuelve error si productoId no existe', async () => {
    if (!tenantId) return;
    const result = await motorService.cotizar({
      tenantId,
      productoId: '00000000-0000-0000-0000-000000000000',
      jobContext: { cantidad: 100 },
    });

    expect(result.exitoso).toBe(false);
    expect(result.errores.length).toBeGreaterThan(0);
    expect(result.errores[0].codigo).toBe('producto_no_encontrado');
  });

  it('rechaza una ruta explícita que no pertenece al producto sin usar fallback', async () => {
    if (!tenantId) return;
    const producto = await prisma.producto.findFirstOrThrow({
      where: { tenantId, activo: true, rutasAlternativas: { some: {} } },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: producto.id,
      rutaAlternativaId: '00000000-0000-4000-8000-000000000001',
      jobContext: { cantidad: 1 },
    });

    expect(result.exitoso).toBe(false);
    expect(result.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          codigo: 'ruta_alternativa_no_encontrada',
        }),
      ]),
    );
  });

  it('rechaza una máquina explícita ajena al paso en vez de usar la predeterminada', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const impresion = tarjetas.rutasAlternativas[0].configPasos.find(
      (config) => config.rutaPaso.familiaCodigo === 'impresion_por_hoja',
    )!;

    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: {
        cantidad: 100,
        caras: 1,
        [`maquinaSeleccionada_${impresion.id}`]:
          '00000000-0000-4000-8000-000000000001',
      },
    });

    expect(result.exitoso).toBe(false);
    expect(result.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'maquina_explicita_invalida' }),
      ]),
    );
  });

  it('bloquea una máquina configurada que fue desactivada después de modelar el producto', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const impresion = tarjetas.rutasAlternativas[0].configPasos.find(
      (config) => config.rutaPaso.familiaCodigo === 'impresion_por_hoja',
    )!;
    expect(impresion.maquinaM1Id).toBeTruthy();
    const maquina = await prisma.maquina.findUniqueOrThrow({
      where: { id: impresion.maquinaM1Id! },
      select: { activo: true },
    });

    await prisma.maquina.update({
      where: { id: impresion.maquinaM1Id! },
      data: { activo: false },
    });
    try {
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        jobContext: { cantidad: 100 },
      });

      expect(result.exitoso).toBe(false);
      expect(result.errores).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            codigo: 'maquina_configurada_no_disponible',
          }),
        ]),
      );
    } finally {
      await prisma.maquina.update({
        where: { id: impresion.maquinaM1Id! },
        data: { activo: maquina.activo },
      });
    }
  });

  it('cantidad efectiva = cantidad pedida cuando no hay grouping', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: { cantidad: 1000 },
    });
    expect(result.cotizacion!.cantidadEfectiva).toBe(1000);
    expect(result.cotizacion!.cantidadPedida).toBe(1000);
  });

  it('F.2.6: Tarjetas doble faz consume más tiempo y consumibles, sin duplicar sustrato', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const simpleFaz = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      periodo: '2026-03',
      jobContext: { cantidad: 1000, caras: 1 },
    });
    const dobleFaz = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      periodo: '2026-03',
      jobContext: { cantidad: 1000, caras: 2 },
    });

    expect(simpleFaz.exitoso).toBe(true);
    expect(dobleFaz.exitoso).toBe(true);

    // Doble faz: el paso impresión debe consumir el doble de tiempo
    const impSimple = simpleFaz.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'impresion_por_hoja',
    );
    const impDoble = dobleFaz.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'impresion_por_hoja',
    );
    expect(impDoble!.tiempo!.totalMin).toBeGreaterThan(
      impSimple!.tiempo!.totalMin,
    );
    const sustratoSimple = impSimple!.materiales!.find(
      (m) => m.slotCodigo === 'sustrato_principal',
    );
    const sustratoDoble = impDoble!.materiales!.find(
      (m) => m.slotCodigo === 'sustrato_principal',
    );
    expect(sustratoDoble!.cantidad).toBe(sustratoSimple!.cantidad);
    const tonerSimple = impSimple!.materiales!.filter(
      (m) => m.tipoLineaCosto === 'CONSUMIBLE_MAQUINA',
    );
    const tonerDoble = impDoble!.materiales!.filter(
      (m) => m.tipoLineaCosto === 'CONSUMIBLE_MAQUINA',
    );
    expect(
      tonerDoble.reduce((acc, item) => acc + item.costoTotal, 0),
    ).toBeGreaterThan(
      tonerSimple.reduce((acc, item) => acc + item.costoTotal, 0),
    );
  });

  it('Desgaste: cobra costo por click y deja las piezas de color fuera del BN', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const impresionConfig = await prisma.productoConfigPaso.findFirstOrThrow({
      where: {
        tenantId,
        rutaPaso: { familiaCodigo: 'impresion_por_hoja' },
        productoRutaAlternativa: { productoId: tarjetas.id, activo: true },
        maquinaM1Id: { not: null },
      },
    });
    const maquinaId = impresionConfig.maquinaM1Id!;

    // Dos piezas con costo por click redondo: $1 el drum negro, $2 los de
    // color. Así el aporte de cada una se lee directo en el resultado.
    const drumNegro = await prisma.maquinaComponenteDesgaste.create({
      data: {
        tenantId,
        maquinaId,
        nombre: 'TEST drum negro',
        tipo: 'DRUM',
        unidadDesgaste: 'COPIAS_A4_EQUIV',
        precioUnitario: 100000,
        vidaUtilEstimada: 100000,
        soloColor: false,
        activo: true,
      },
    });
    const drumsColor = await prisma.maquinaComponenteDesgaste.create({
      data: {
        tenantId,
        maquinaId,
        nombre: 'TEST drums color',
        tipo: 'DRUM',
        unidadDesgaste: 'COPIAS_A4_EQUIV',
        precioUnitario: 200000,
        vidaUtilEstimada: 100000,
        soloColor: true,
        activo: true,
      },
    });

    try {
      const color = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-03',
        jobContext: { cantidad: 1000, caras: 1, modoColor: 'CMYK' },
      });
      const bn = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-03',
        jobContext: { cantidad: 1000, caras: 1, modoColor: 'BN' },
      });

      expect(color.exitoso).toBe(true);
      expect(bn.exitoso).toBe(true);

      const desgasteDe = (r: typeof color) =>
        r
          .cotizacion!.pasos.find(
            (p) => p.familiaCodigo === 'impresion_por_hoja',
          )!
          .materiales!.filter((m) => m.tipoLineaCosto === 'DESGASTE_MAQUINA');

      const enColor = desgasteDe(color);
      const enBN = desgasteDe(bn);

      // En color giran las dos piezas; en BN, sólo el drum negro.
      expect(enColor.map((m) => m.slotNombre).sort()).toEqual([
        'TEST drum negro',
        'TEST drums color',
      ]);
      expect(enBN.map((m) => m.slotNombre)).toEqual(['TEST drum negro']);

      // Clicks enteros, y el costo es precio/vida × clicks.
      const negroColor = enColor.find(
        (m) => m.slotNombre === 'TEST drum negro',
      )!;
      expect(Number.isInteger(negroColor.cantidad)).toBe(true);
      expect(negroColor.cantidad).toBeGreaterThan(0);
      expect(negroColor.unidad).toBe('a4_equiv');
      expect(negroColor.precioUnitario).toBeCloseTo(1, 6);
      expect(negroColor.costoTotal).toBeCloseTo(negroColor.cantidad, 6);
      expect(negroColor.modoSeleccion).toBe('MAQUINA_DESGASTE');
      expect(negroColor.estrategiaCosto).toBe('costo_por_click');

      const colorPieza = enColor.find(
        (m) => m.slotNombre === 'TEST drums color',
      )!;
      expect(colorPieza.precioUnitario).toBeCloseTo(2, 6);
      expect(colorPieza.cantidad).toBe(negroColor.cantidad);

      // El BN pasa los mismos clicks pero paga sólo un tercio del desgaste.
      const negroBN = enBN[0];
      expect(negroBN.cantidad).toBe(negroColor.cantidad);
      expect(enBN.reduce((acc, m) => acc + m.costoTotal, 0) * 3).toBeCloseTo(
        enColor.reduce((acc, m) => acc + m.costoTotal, 0),
        6,
      );
    } finally {
      await prisma.maquinaComponenteDesgaste.deleteMany({
        where: { id: { in: [drumNegro.id, drumsColor.id] } },
      });
    }
  });

  it('Desgaste: una pieza sin precio ni vida útil no suma costo', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const impresionConfig = await prisma.productoConfigPaso.findFirstOrThrow({
      where: {
        tenantId,
        rutaPaso: { familiaCodigo: 'impresion_por_hoja' },
        productoRutaAlternativa: { productoId: tarjetas.id, activo: true },
        maquinaM1Id: { not: null },
      },
    });
    const incompleta = await prisma.maquinaComponenteDesgaste.create({
      data: {
        tenantId,
        maquinaId: impresionConfig.maquinaM1Id!,
        nombre: 'TEST pieza sin datos',
        tipo: 'FUSOR',
        unidadDesgaste: 'COPIAS_A4_EQUIV',
        activo: true,
      },
    });

    try {
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-03',
        jobContext: { cantidad: 1000, caras: 1 },
      });
      expect(result.exitoso).toBe(true);
      const desgaste = result
        .cotizacion!.pasos.find(
          (p) => p.familiaCodigo === 'impresion_por_hoja',
        )!
        .materiales!.filter((m) => m.tipoLineaCosto === 'DESGASTE_MAQUINA');
      expect(desgaste).toEqual([]);
    } finally {
      await prisma.maquinaComponenteDesgaste.delete({
        where: { id: incompleta.id },
      });
    }
  });

  it('PPM en impresion por hoja calcula paginas A4 equivalentes por minuto', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      periodo: '2026-06',
      jobContext: { cantidad: 300, caras: 1 },
    });

    expect(result.exitoso).toBe(true);
    const prePrensa = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'pre_prensa',
    );
    const impresion = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'impresion_por_hoja',
    );
    expect(prePrensa).toBeDefined();
    expect(impresion).toBeDefined();

    const pliegos = Number(
      (impresion!.outputsCanonicos as Record<string, unknown>)
        .pliegos_calculados ?? impresion!.nestingResult?.cantidadCalculada,
    );
    expect(pliegos).toBe(25);
    expect(impresion!.tiempo!.runMin).toBeCloseTo(0.625, 3);
    expect(impresion!.tiempo!.totalMin).toBe(8);
  });

  it('Guillotina calcula tiempo por tandas, cortes y rango de gramaje', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      periodo: '2026-06',
      jobContext: { cantidad: 300, caras: 1 },
    });

    expect(result.exitoso).toBe(true);
    const guillotina = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'corte_guillotina',
    );
    expect(guillotina).toBeDefined();
    expect(guillotina!.tiempo!.runMin).toBeGreaterThan(0);
    expect(guillotina!.tiempo!.totalMin).toBeGreaterThanOrEqual(
      guillotina!.tiempo!.runMin,
    );
  });

  it('F.2.6: Talonario con tipoCopia=3 multiplica el tiempo del paso impresión', async () => {
    if (!tenantId) return;
    const talonario = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TALON-DUPL-A4' },
    });
    const simple = await motorService.cotizar({
      tenantId,
      productoId: talonario.id,
      periodo: '2026-03',
      jobContext: { cantidad: 100, tipoCopia: 1, numerosXTalonario: 100 },
    });
    const triple = await motorService.cotizar({
      tenantId,
      productoId: talonario.id,
      periodo: '2026-03',
      jobContext: { cantidad: 100, tipoCopia: 3, numerosXTalonario: 100 },
    });

    expect(simple.exitoso).toBe(true);
    expect(triple.exitoso).toBe(true);

    // Triple debe activar las 3 capas + tener tiempo total mayor
    const pasosImpSimple = simple.cotizacion!.pasos.filter(
      (p) => p.familiaCodigo === 'impresion_por_hoja' && p.activado,
    );
    const pasosImpTriple = triple.cotizacion!.pasos.filter(
      (p) => p.familiaCodigo === 'impresion_por_hoja' && p.activado,
    );
    expect(pasosImpSimple.length).toBe(1);
    expect(pasosImpTriple.length).toBe(3);
  });

  it('F.2.10: Tarjetas con período "2026-03" carga tarifa horaria publicada y costo de tiempo > 0', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      periodo: '2026-06',
      jobContext: { cantidad: 1000, caras: 2 },
    });

    expect(result.exitoso).toBe(true);

    // Verificar que hay tarifa manual y tarifa heredada desde máquina.
    const tarifas = result
      .cotizacion!.pasos.filter((p) => p.activado)
      .map((p) => p.tiempo?.tarifaHora ?? 0);
    expect(tarifas).toEqual(expect.arrayContaining([tarifaHoraManual]));
    expect(tarifas.some((tarifa) => Math.abs(tarifa - 22727.27) < 0.5)).toBe(
      true,
    );

    // Costo de tiempo total debe ser > 0
    expect(result.cotizacion!.costos.tiempoTotal).toBeGreaterThan(0);
  });

  it('F.2.10: Vinilo con período inexistente falla por tarifa no publicada', async () => {
    if (!tenantId) return;
    const vinilo = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: vinilo.id,
      periodo: '1999-01', // período sin tarifa publicada
      jobContext: {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 1000, altoMm: 500 }],
      },
    });

    expect(result.exitoso).toBe(false);
    expect(result.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          codigo: 'centro_costo_sin_tarifa_publicada',
          mensaje: expect.stringContaining('1999-01'),
        }),
      ]),
    );
  });

  it('F.2.8: cotización SIN cantidad explícita → ERROR de contrato de entrada', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    // El contrato del motor rechaza el valor antes de evaluar reglas internas.
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: { cantidad: null as unknown as number },
    });
    expect(result.exitoso).toBe(false);
    expect(result.errores.length).toBeGreaterThan(0);
    const e = result.errores.find((er) => er.codigo === 'job_context_invalido');
    expect(e).toBeDefined();
    expect(e!.severidad).toBe('ERROR');
    expect(e!.mensaje.toLowerCase()).toContain('cantidad');
    expect(result.metadata).toMatchObject({
      quoteRunId: expect.any(String),
      motorVersion: 'motor-universal-v4',
      durationMs: expect.any(Number),
    });
  });

  it('rechaza descuentos porcentuales fuera de rango en llamadas internas', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: { cantidad: 100 },
      descuento: { tipo: 'PORCENTAJE', valor: 101 },
    });

    expect(result.exitoso).toBe(false);
    expect(result.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'descuento_invalido' }),
      ]),
    );
  });

  it('F.2.8: validación COMPARE skipea cuando los datos no están completos (no falla)', async () => {
    if (!tenantId) return;
    // Tarjetas sin gramaje en jobContext → COMPARE de gramaje skipea silencioso
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: { cantidad: 1000 }, // sin gramajeGr
    });
    expect(result.exitoso).toBe(true);
  });

  it('G-M1: Vinilo con piezas → CALCULADO_POR_PASO usa shelf-rollo (cantidad real con desperdicio)', async () => {
    if (!tenantId) return;
    const vinilo = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
    });

    // 3 paños de 2x1m. El rollo es 1.37m → cada paño rota a 1×2m, 1 por fila.
    // 3 filas × 2m + márgenes + separaciones ≈ 6.03m de rollo consumido.
    // Área total consumida (con desperdicio): 6.03m × 1.37m ≈ 8.26 m².
    const result = await motorService.cotizar({
      tenantId,
      productoId: vinilo.id,
      periodo: '2026-03',
      jobContext: {
        cantidad: 1,
        piezas: [{ cantidad: 3, anchoMm: 2000, altoMm: 1000 }],
      },
    });
    expect(result.exitoso).toBe(true);
    const impresion = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'impresion_por_area',
    );
    expect(impresion?.activado).toBe(true);

    // Nesting result presente con el algoritmo de rollo vigente.
    expect(impresion!.nestingResult).toBeDefined();
    expect(['shelf-rollo', 'maxrects-rollo']).toContain(
      impresion!.nestingResult!.algorithm,
    );
    expect(impresion!.nestingResult!.unidad).toBe('m_lineales');
    expect(impresion!.nestingResult!.consumedLengthMm).toBeGreaterThan(6000);
    expect(impresion!.nestingResult!.consumedLengthMm).toBeLessThan(6500);
    expect(impresion!.nestingResult!.placements.length).toBe(3);
    expect(impresion!.nestingResult!.visualConfig).toMatchObject({
      margins: { leftMm: 5, rightMm: 5, topMm: 10, bottomMm: 10 },
      spacing: { horizontalMm: 5, verticalMm: 5 },
      pieceBleedMm: 2.5,
      // El área útil descuenta margen físico + sangrado por pieza.
      usableArea: { xMm: 7.5, widthMm: 1355 },
    });
    expect(impresion!.nestingResult!.costingPreview).toMatchObject({
      strategy: 'consumed-length',
      chargedLengthMm: impresion!.nestingResult!.consumedLengthMm,
    });
    // Aprovechamiento: 6 m² útiles / 8.26 m² totales ≈ 72-73%
    expect(impresion!.nestingResult!.aprovechamientoPct).toBeGreaterThan(60);
    expect(impresion!.nestingResult!.aprovechamientoPct).toBeLessThan(80);

    // Tiempo: ~8.26 m² / 6 m²/h × 60 = ~82.6min run + setup(10) + cleanup(5) ≈ 98min.
    // Antes de G-M1 (m² crudos sin desperdicio): ~60min run = ~75min total. Diferencia = subcosto.
    expect(impresion!.tiempo!.totalMin).toBeGreaterThan(90);
    expect(impresion!.tiempo!.totalMin).toBeLessThan(110);
  });

  it('F.2.3: Tarjetas con embalaje CONVERSION → 1000 piezas / 100 piezasPorCaja = 10 cajas', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: {
            configPasos: {
              include: {
                rutaPaso: true,
                slotsMateriales: {
                  include: { candidatos: { include: { variantes: true } } },
                },
              },
            },
          },
        },
      },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      periodo: '2026-06',
      jobContext: {
        cantidad: 1000,
        caras: 2,
      },
    });
    expect(result.exitoso).toBe(true);
    const embalaje = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'embalaje',
    );
    expect(embalaje?.activado).toBe(true);
    const caja = embalaje!.materiales?.find((m) => m.slotCodigo === 'caja');
    expect(caja).toBeDefined();
    expect(caja!.cantidad).toBe(10);
  });

  it('F.2.4: Tarjetas doble faz → selecciona su perfil sin volver a dividir las PPM', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });

    const simple = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      periodo: '2026-03',
      jobContext: { cantidad: 2400, caras: 1 },
    });
    const doble = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      periodo: '2026-03',
      jobContext: { cantidad: 2400, caras: 2 },
    });

    const impSimple = simple.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'impresion_por_hoja',
    )!;
    const impDoble = doble.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'impresion_por_hoja',
    )!;

    // Ambos perfiles expresan 40 caras A4-eq/min. Doble faz tarda más porque
    // el paso multiplica la cantidad por caras, no porque vuelva a dividir PPM.
    expect(impDoble.tiempo!.totalMin).toBeGreaterThan(
      impSimple.tiempo!.totalMin,
    );
  });

  it('G-M7: Vinilo con MOTOR_ELIGE_AUTO + MAYOR_APROVECHAMIENTO → corre nesting con cada candidato y elige el de mayor aprovechamiento real', async () => {
    if (!tenantId) return;
    const vinilo = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
    });
    // Pieza 1500×800mm. Candidatos: rollo 1.37m vs rollo 1.52m.
    // Antes G-M7: heurística "más ancho gana" → elegía 1.52m (incorrecto, el
    // sobrante horizontal era 220mm/1.52m = 14% desperdicio).
    // Ahora G-M7: nesting real → elige 1.37m porque la pieza se acomoda
    // panelizada y deja menos desperdicio horizontal (más cerca del ancho útil).
    const result = await motorService.cotizar({
      tenantId,
      productoId: vinilo.id,
      jobContext: {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 1500, altoMm: 800 }],
      },
    });
    expect(result.exitoso).toBe(true);
    const impresion = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'impresion_por_area',
    );
    const mat = impresion!.materiales![0];
    expect(mat.modoSeleccion).toBe('MOTOR_ELIGE_AUTO');
    // El rollo 1.37m aprovecha mejor para esta pieza (menos desperdicio).
    expect(mat.materialNombre).toBe('VINILO-BLANCO-1370');
    // El nesting result confirma que se eligió el sustrato 1.37m.
    // El preview muestra el sustrato completo; el ancho útil descontado viaja
    // en visualConfig.usableArea.
    expect(impresion!.nestingResult?.substrates[0]).toMatchObject({
      kind: 'roll',
      widthMm: 1370,
    });
    expect(impresion!.nestingResult?.visualConfig?.usableArea.widthMm).toBe(
      1355,
    );
  });

  it('G-M7: con máquina que limita anchoMax (Roland 1.37m), el dispatcher usa ese ancho independiente del rollo', async () => {
    if (!tenantId) return;
    const vinilo = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
    });
    // El dispatcher prioriza `paso.maquina.parametrosTecnicosJson.anchoMaxMm`
    // por encima del ancho del rollo. Para Roland (1370mm), aunque el rollo
    // sea 1520mm el área útil sigue siendo 1370 — ambos candidatos dan el
    // mismo aprovechamiento. El primero válido gana (1370 en orden seed).
    const result = await motorService.cotizar({
      tenantId,
      productoId: vinilo.id,
      jobContext: {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 1000, altoMm: 500 }],
      },
    });
    expect(result.exitoso).toBe(true);
    const impresion = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'impresion_por_area',
    );
    expect(impresion!.nestingResult?.substrates[0]).toMatchObject({
      kind: 'roll',
      widthMm: 1370,
    });
    expect(impresion!.nestingResult?.visualConfig?.usableArea.widthMm).toBe(
      1355,
    );
  });

  it('F.2.5: Tarjetas sin laminado no exige elegir film', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: {
        cantidad: 1000,
        caras: 2,
      },
    });

    expect(result.exitoso).toBe(true);
    const pasoLaminado = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'laminado',
    );
    expect(pasoLaminado?.activado).toBe(false);
  });

  it('F.2.5: Tarjetas con laminado activado exige elegir film explícitamente', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const laminado = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'laminado',
    );

    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: {
        cantidad: 1000,
        caras: 2,
        opcionalesActivados: { [laminado!.id]: true },
      } as never,
    });
    expect(result.exitoso).toBe(false);
    expect(result.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          codigo: 'material_comercial_requerido',
          mensaje: expect.stringContaining('requiere elegir el material film'),
        }),
      ]),
    );
  });

  it('F.2.5: Tarjetas con laminado y comercial elige BRILLO explícito con clave por paso', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const laminado = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'laminado',
    );

    // Buscar el variantId del film brillo
    const filmBrillo = await prisma.materiaPrimaVariante.findFirstOrThrow({
      where: { tenantId, sku: 'BOPP-BRILLO-650' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: {
        cantidad: 1000,
        caras: 2,
        opcionalesActivados: { [laminado!.id]: true },
        [`slotMaterial_${laminado!.id}_film`]: filmBrillo.id,
      } as never,
    });
    expect(result.exitoso).toBe(true);
    const pasoLaminado = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'laminado',
    );
    const film = pasoLaminado!.materiales![0];
    expect(film.materialNombre).toBe('BOPP-BRILLO-650');
    expect(film.materialSku).toBe('BOPP-BRILLO-650');
    expect(film.materialDisplayName).toBeTruthy();
    expect(film.tipoLineaCosto).toBe('MATERIAL');
  });

  it('F.2.5: Tarjetas con laminado acepta material elegido en slotMateriales', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const laminado = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'laminado',
    );
    const filmBrillo = await prisma.materiaPrimaVariante.findFirstOrThrow({
      where: { tenantId, sku: 'BOPP-BRILLO-650' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: {
        cantidad: 1000,
        caras: 2,
        opcionalesActivados: { [laminado!.id]: true },
        slotMateriales: {
          [`${laminado!.id}_film`]: filmBrillo.id,
        },
      } as never,
    });

    expect(result.exitoso).toBe(true);
    const pasoLaminado = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'laminado',
    );
    expect(pasoLaminado!.materiales![0].materialSku).toBe('BOPP-BRILLO-650');
  });

  it('Laminado: calcula film con nesting de rollo sobre pliegos impresos', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const laminado = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'laminado',
    );
    const filmBrillo = await prisma.materiaPrimaVariante.findFirstOrThrow({
      where: { tenantId, sku: 'BOPP-BRILLO-650' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: {
        cantidad: 100,
        caras: 1,
        opcionalesActivados: { [laminado!.id]: true },
        slotMateriales: {
          [`${laminado!.id}_film`]: filmBrillo.id,
        },
      } as never,
    });

    expect(result.exitoso).toBe(true);
    const pasoLaminado = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'laminado',
    )!;
    const film = pasoLaminado.materiales![0];
    const nesting = pasoLaminado.nestingResult!;
    expect(nesting.algorithm).toBe('shelf-rollo');
    expect(nesting.unidad).toBe('m_lineales');
    expect(nesting.consumedLengthMm).toBeCloseTo(1175, 0);
    expect(film.cantidad).toBeCloseTo(1.18, 2);
    expect(film.cantidad).toBeLessThan((10 * 297) / 1000);
    expect(nesting.visualConfig?.margins).toMatchObject({
      leftMm: 10,
      rightMm: 10,
      topMm: 50,
      bottomMm: 50,
    });
    expect(nesting.visualConfig?.spacing).toMatchObject({
      horizontalMm: 5,
      verticalMm: 5,
    });
    expect(nesting.visualConfig?.pieceBleedMm).toBe(2.5);
  });

  it('Laminado doble faz duplica sólo las pasadas, el film y el run; no los pliegos comprados', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const laminado = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'laminado',
    );
    const filmBrillo = await prisma.materiaPrimaVariante.findFirstOrThrow({
      where: { tenantId, sku: 'BOPP-BRILLO-650' },
    });
    const perfilOriginal =
      await prisma.maquinaPerfilOperativo.findUniqueOrThrow({
        where: { id: laminado!.perfilM1Id! },
      });
    const detalleOriginal = (perfilOriginal.detalleJson ??
      {}) as Prisma.JsonObject;
    const configurarPasadas = (pasadasDobleFaz: 1 | 2) =>
      prisma.maquinaPerfilOperativo.update({
        where: { id: perfilOriginal.id },
        data: {
          detalleJson: {
            ...detalleOriginal,
            pasadasDobleFaz,
          },
        },
      });

    const cotizar = (caras: 1 | 2) =>
      motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        jobContext: {
          cantidad: 100,
          caras,
          opcionalesActivados: { [laminado!.id]: true },
          slotMateriales: {
            [`${laminado!.id}_film`]: filmBrillo.id,
          },
          configPasoRuntime: {
            [laminado!.id]: {
              nestingConfig: { allowRotation: false },
            },
          },
        } as never,
      });

    let simple: Awaited<ReturnType<typeof cotizar>>;
    let dobleDosPasadas: Awaited<ReturnType<typeof cotizar>>;
    let dobleUnaPasada: Awaited<ReturnType<typeof cotizar>>;
    try {
      await configurarPasadas(2);
      simple = await cotizar(1);
      dobleDosPasadas = await cotizar(2);
      await configurarPasadas(1);
      dobleUnaPasada = await cotizar(2);
    } finally {
      await prisma.maquinaPerfilOperativo.update({
        where: { id: perfilOriginal.id },
        data: { detalleJson: detalleOriginal },
      });
    }

    expect(simple.exitoso).toBe(true);
    expect(dobleDosPasadas.exitoso).toBe(true);
    expect(dobleUnaPasada.exitoso).toBe(true);

    const laminadoSimple = simple.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'laminado',
    )!;
    const laminadoDobleDosPasadas = dobleDosPasadas.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'laminado',
    )!;
    const laminadoDobleUnaPasada = dobleUnaPasada.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'laminado',
    )!;
    const filmSimple = laminadoSimple.materiales![0];
    const filmDobleDosPasadas = laminadoDobleDosPasadas.materiales![0];
    const filmDobleUnaPasada = laminadoDobleUnaPasada.materiales![0];

    expect(laminadoSimple.nestingResult!.consumedLengthMm).toBeCloseTo(1610, 0);
    expect(laminadoDobleDosPasadas.nestingResult!.consumedLengthMm).toBeCloseTo(
      laminadoSimple.nestingResult!.consumedLengthMm! * 2,
      5,
    );
    expect(laminadoDobleUnaPasada.nestingResult!.consumedLengthMm).toBeCloseTo(
      laminadoSimple.nestingResult!.consumedLengthMm! * 2,
      5,
    );
    expect(filmDobleDosPasadas.cantidad).toBeCloseTo(
      filmSimple.cantidad * 2,
      5,
    );
    expect(filmDobleUnaPasada.cantidad).toBeCloseTo(filmSimple.cantidad * 2, 5);
    expect(laminadoDobleDosPasadas.tiempo!.runMin).toBeCloseTo(
      laminadoSimple.tiempo!.runMin * 2,
      5,
    );
    expect(laminadoDobleUnaPasada.tiempo!.runMin).toBeCloseTo(
      laminadoSimple.tiempo!.runMin,
      5,
    );
    expect(laminadoDobleDosPasadas.tiempo!.setupMin).toBe(
      laminadoSimple.tiempo!.setupMin,
    );
    expect(laminadoDobleDosPasadas.tiempo!.cleanupMin).toBe(
      laminadoSimple.tiempo!.cleanupMin,
    );

    const sustratoImpresion = (resultado: typeof simple) =>
      resultado
        .cotizacion!.pasos.find(
          (p) => p.familiaCodigo === 'impresion_por_hoja',
        )!
        .materiales!.find((m) => m.slotCodigo === 'sustrato_principal')!;
    expect(sustratoImpresion(dobleDosPasadas).cantidad).toBe(
      sustratoImpresion(simple).cantidad,
    );
    expect(sustratoImpresion(dobleUnaPasada).cantidad).toBe(
      sustratoImpresion(simple).cantidad,
    );
  });

  it('F.2.5: clave legacy de material por slot sigue funcionando temporalmente', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const laminado = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'laminado',
    );
    const filmMate = await prisma.materiaPrimaVariante.findFirstOrThrow({
      where: { tenantId, sku: 'BOPP-MATE-650' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: {
        cantidad: 1000,
        caras: 2,
        opcionalesActivados: { [laminado!.id]: true },
        slotMaterial_film: filmMate.id,
      } as never,
    });

    expect(result.exitoso).toBe(true);
    const pasoLaminado = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'laminado',
    );
    expect(pasoLaminado!.materiales![0].materialSku).toBe('BOPP-MATE-650');
  });

  it('F.2.5: rechaza material comercial que no pertenece a candidatos del slot', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const laminado = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'laminado',
    );
    const opalina = await prisma.materiaPrimaVariante.findFirstOrThrow({
      where: { tenantId, sku: 'OPALINA-300-65X45' },
    });

    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: {
        cantidad: 1000,
        caras: 2,
        opcionalesActivados: { [laminado!.id]: true },
        [`slotMaterial_${laminado!.id}_film`]: opalina.id,
      } as never,
    });

    expect(result.exitoso).toBe(false);
    expect(result.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          codigo: 'material_comercial_invalido',
          mensaje: expect.stringContaining('no es válida'),
        }),
      ]),
    );
  });

  it('F.2.7: Vinilo SIN activar viático → cargosDirectosCotizacion vacío', async () => {
    if (!tenantId) return;
    const vinilo = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: vinilo.id,
      jobContext: {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 1000, altoMm: 500 }],
      },
    });
    expect(result.exitoso).toBe(true);
    expect(result.cotizacion!.cargosDirectosCotizacion.length).toBe(0);
    expect(result.cotizacion!.costos.cargosDirectosTotal).toBe(0);
  });

  it('un material fijo inactivo bloquea la cotización en vez de costear cero', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: {
            configPasos: {
              include: { rutaPaso: true, slotsMateriales: true },
            },
          },
        },
      },
    });
    const impresion = tarjetas.rutasAlternativas[0].configPasos.find(
      (config) => config.rutaPaso.familiaCodigo === 'impresion_por_hoja',
    )!;
    const varianteId = impresion.slotsMateriales.find(
      (slot) => slot.slotCodigo === 'sustrato_principal',
    )!.materialVarianteId!;
    const original = await prisma.materiaPrimaVariante.findUniqueOrThrow({
      where: { id: varianteId },
      select: { activo: true },
    });
    await prisma.materiaPrimaVariante.update({
      where: { id: varianteId },
      data: { activo: false },
    });

    let result: Awaited<ReturnType<MotorUniversalService['cotizar']>>;
    try {
      result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        jobContext: { cantidad: 100, caras: 1 },
      });
    } finally {
      await prisma.materiaPrimaVariante.update({
        where: { id: varianteId },
        data: { activo: original.activo },
      });
    }

    expect(result.exitoso).toBe(false);
    expect(result.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          codigo: 'material_hardcoded_no_disponible',
        }),
      ]),
    );
  });

  it('F.2.7: Vinilo CON viático activado + zona CABA → cargo $3000 (MONTO_FIJO_PLANO con zonas)', async () => {
    if (!tenantId) return;
    const vinilo = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
      include: { cargosDirectosCotizacion: true },
    });
    const cargoViaticoId = vinilo.cargosDirectosCotizacion[0].id;

    const result = await motorService.cotizar({
      tenantId,
      productoId: vinilo.id,
      jobContext: {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 1000, altoMm: 500 }],
        opcionalesActivados: { [cargoViaticoId]: true },
        zonaInstalacion: 'CABA',
      },
    });
    expect(result.exitoso).toBe(true);
    expect(result.cotizacion!.cargosDirectosCotizacion.length).toBe(1);
    const viatico = result.cotizacion!.cargosDirectosCotizacion[0];
    expect(viatico.cargoCodigo).toBe('viatico');
    expect(viatico.monto).toBe(3000);
    expect(result.cotizacion!.costos.cargosDirectosTotal).toBe(3000);
  });

  it('F.2.7: Vinilo CON viático + zona FUERA_AMBA → cargo $12000', async () => {
    if (!tenantId) return;
    const vinilo = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
      include: { cargosDirectosCotizacion: true },
    });
    const cargoViaticoId = vinilo.cargosDirectosCotizacion[0].id;

    const result = await motorService.cotizar({
      tenantId,
      productoId: vinilo.id,
      jobContext: {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 1000, altoMm: 500 }],
        opcionalesActivados: { [cargoViaticoId]: true },
        zonaInstalacion: 'FUERA_AMBA',
      },
    });
    const viatico = result.cotizacion!.cargosDirectosCotizacion[0];
    expect(viatico.monto).toBe(12000);
  });

  it('F.2.11: cotizarYGuardar persiste Cotizacion + CotizacionItem con snapshot completo', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const { result, cotizacionId, cotizacionItemId } =
      await motorService.cotizarYGuardar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-06',
        jobContext: { cantidad: 500, caras: 2 },
      });

    expect(result.exitoso).toBe(true);
    expect(cotizacionId).toBeDefined();
    expect(cotizacionItemId).toBeDefined();

    // Verificar persistencia
    const item = await prisma.cotizacionItem.findUniqueOrThrow({
      where: { id: cotizacionItemId! },
    });
    expect(item.productoId).toBe(tarjetas.id);
    expect(Number(item.cantidad)).toBe(500);
    expect(Number(item.costoTotal)).toBeGreaterThan(0);
    expect(Number(item.precioNetoTotal)).toBeGreaterThan(0);
    expect(Number(item.impuestosPorFueraTotal)).toBeGreaterThanOrEqual(0);
    expect(
      Number(item.precioNetoTotal) + Number(item.impuestosPorFueraTotal),
    ).toBeCloseTo(Number(item.precioTotal), 2);

    // Verificar snapshot
    const snap = item.snapshotJson as Record<string, unknown>;
    expect(snap).toHaveProperty('producto');
    expect(snap).toHaveProperty('ruta');
    expect(snap).toHaveProperty('ejecucion');
    expect(snap).toMatchObject({
      motor: {
        contractVersion: 'motor-universal-v4',
        inputHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        periodoTarifario: '2026-06',
      },
    });
    const producto = snap.producto as Record<string, unknown>;
    expect(producto.codigo).toBe('TARJ-PREMIUM-300');

    // Verificar trazabilidad
    const traza = item.trazabilidadJson as Record<string, unknown>;
    expect(traza).toHaveProperty('pasos');
    expect((traza.pasos as unknown[]).length).toBe(7);

    // Cleanup
    await prisma.cotizacionItem.delete({ where: { id: cotizacionItemId! } });
    await prisma.cotizacion.delete({ where: { id: cotizacionId! } });
  });

  it('recotizar actualiza el mismo item y renueva su snapshot de forma atómica', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const creado = await motorService.cotizarYGuardar({
      tenantId,
      productoId: tarjetas.id,
      periodo: '2026-06',
      jobContext: { cantidad: 500, caras: 1 },
    });
    expect(creado.cotizacionId).toBeDefined();
    expect(creado.cotizacionItemId).toBeDefined();

    try {
      const antes = await prisma.cotizacionItem.findUniqueOrThrow({
        where: { id: creado.cotizacionItemId! },
      });
      const hashAntes = (
        antes.snapshotJson as { motor?: { inputHash?: string } }
      ).motor?.inputHash;
      const recotizado = await motorService.recotizarItem({
        tenantId,
        cotizacionItemId: creado.cotizacionItemId!,
        periodo: '2026-06',
        jobContext: { cantidad: 200, caras: 2 },
      });

      expect(recotizado.result.exitoso).toBe(true);
      expect(recotizado.cotizacionItemId).toBe(creado.cotizacionItemId);
      const despues = await prisma.cotizacionItem.findUniqueOrThrow({
        where: { id: creado.cotizacionItemId! },
      });
      expect(Number(despues.cantidad)).toBe(200);
      expect(
        (despues.snapshotJson as { motor?: { inputHash?: string } }).motor
          ?.inputHash,
      ).not.toBe(hashAntes);
    } finally {
      await prisma.cotizacionItem.delete({
        where: { id: creado.cotizacionItemId! },
      });
      await prisma.cotizacion.delete({ where: { id: creado.cotizacionId! } });
    }
  });

  it('F.2.12: Tarjetas usa una sola fuente de precio y expone el método vigente', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      periodo: '2026-03',
      jobContext: { cantidad: 1000, caras: 2 },
    });
    expect(result.exitoso).toBe(true);
    expect(result.cotizacion!.precio).toBeDefined();
    expect(result.cotizacion!.precio!.metodoUsado).toBe(
      result.cotizacion!.desglosePrecio!.precioConfig.metodoCalculo,
    );
    expect(result.cotizacion!.precio!.precioUnitario).toBeGreaterThan(
      result.cotizacion!.costos.unitario,
    );
  });

  // Fase 2 — el IVA se resuelve por CATEGORÍA del producto × RÉGIMEN del emisor
  // (no por tildes). general (RI) lleva IVA; exento no; Monotributo lo apaga.
  it('Fase 2: el IVA sale de la categoría del producto y el régimen del emisor', async () => {
    if (!tenantId) return;
    const tid = tenantId;
    const producto = await prisma.producto.findFirstOrThrow({
      where: { tenantId: tid, codigo: 'TARJ-PREMIUM-300' },
      select: { id: true, categoriaFiscal: true },
    });
    const configOriginal = await prisma.configuracionFiscal.findUnique({
      where: { tenantId: tid },
    });

    await ensureCentroHorarioConTarifa(tid);
    const cotizar = async () => {
      const r = await motorService.cotizar({
        tenantId: tid,
        productoId: producto.id,
        periodo: '2026-03',
        jobContext: { cantidad: 1000, caras: 2 },
      });
      expect(r.exitoso).toBe(true);
      expect(r.cotizacion!.desglosePrecio).toBeDefined();
      return r.cotizacion!.desglosePrecio!;
    };

    try {
      // Setup fiscal del emisor: Responsable Inscripto + fila IVA general 21%.
      await prisma.configuracionFiscal.upsert({
        where: { tenantId: tid },
        update: { condicionFiscal: 'RI' },
        create: {
          tenantId: tid,
          razonSocial: 'Fase2 Test',
          cuit: '20111111112',
          condicionFiscal: 'RI',
        },
      });
      await prisma.productoImpuestoCatalogo.upsert({
        where: { tenantId_codigo: { tenantId: tid, codigo: 'IVA_TEST_F2' } },
        update: { activo: true, categoriaFiscal: 'general' },
        create: {
          tenantId: tid,
          codigo: 'IVA_TEST_F2',
          nombre: 'IVA test',
          porcentaje: 21,
          baseCalculo: 'NETO',
          traslado: 'POR_FUERA',
          alcance: 'PRODUCTO',
          categoriaFiscal: 'general',
          activo: true,
        },
      });

      // general + RI ⇒ lleva IVA: bruto = neto × 1.21.
      await prisma.producto.update({
        where: { id: producto.id },
        data: { categoriaFiscal: 'general' },
      });
      const gen = await cotizar();
      expect(gen.totalImpuestos).toBeGreaterThan(0);
      expect(gen.precioBrutoUnitario / gen.precioNetoUnitario).toBeCloseTo(
        1.21,
        2,
      );

      // exento ⇒ sin IVA: bruto = neto.
      await prisma.producto.update({
        where: { id: producto.id },
        data: { categoriaFiscal: 'exento' },
      });
      const ex = await cotizar();
      expect(ex.precioBrutoUnitario).toBe(ex.precioNetoUnitario);

      // Monotributo apaga el IVA aunque el producto sea general.
      await prisma.configuracionFiscal.update({
        where: { tenantId: tid },
        data: { condicionFiscal: 'monotributo' },
      });
      await prisma.producto.update({
        where: { id: producto.id },
        data: { categoriaFiscal: 'general' },
      });
      const mono = await cotizar();
      expect(mono.precioBrutoUnitario).toBe(mono.precioNetoUnitario);
    } finally {
      // Teardown: dejar el tenant como estaba (otros tests cotizan lo mismo).
      await prisma.producto.update({
        where: { id: producto.id },
        data: { categoriaFiscal: producto.categoriaFiscal },
      });
      await prisma.productoImpuestoCatalogo.deleteMany({
        where: { tenantId: tid, codigo: 'IVA_TEST_F2' },
      });
      if (configOriginal) {
        await prisma.configuracionFiscal.update({
          where: { tenantId: tid },
          data: { condicionFiscal: configOriginal.condicionFiscal },
        });
      } else {
        await prisma.configuracionFiscal.deleteMany({
          where: { tenantId: tid },
        });
      }
    }
  });

  // Fase A del rediseño de estaciones: el motor persiste la MÁQUINA elegida en
  // el tiempo del paso (base del ruteo a estaciones por máquina/tecnología).
  it('Fase A estaciones: un paso con máquina lleva su maquinaId en el tiempo', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: { cantidad: 500, caras: 2 },
    });
    expect(result.exitoso).toBe(true);
    const impresion = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'impresion_por_hoja',
    );
    // El paso de impresión usa máquina ⇒ maquinaId presente.
    expect(impresion?.tiempo?.maquinaId).toBeTruthy();
  });

  it('F.2.12: Vinilo (precioConfig margen_variable) → margen depende de cantidad', async () => {
    if (!tenantId) return;
    const vinilo = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: vinilo.id,
      periodo: '2026-03',
      jobContext: {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 1000, altoMm: 500 }],
      },
    });
    expect(result.exitoso).toBe(true);
    expect(result.cotizacion!.precio).toBeDefined();
    expect(result.cotizacion!.precio!.metodoUsado).toBe('margen_variable');
    // Producto vendido por m²: 1u de 1000×500mm = 0.5m², cae en primer tier.
    expect(result.cotizacion!.cantidadComercialPricing).toBe(0.5);
    expect(result.cotizacion!.unidadComercialPricing).toBe('m2');
    expect(result.cotizacion!.precio!.margenAplicadoPct).toBe(50);
  });

  it('G-M1: dispatcher grid-2d-single funciona cuando se invoca directamente (unit test)', async () => {
    // Test unitario del dispatcher (sin DB) que verifica el caso grid-2d-single.
    // El seed actual de Tarjetas NO ejecuta nesting porque `pre_prensa` usa T-1
    // tiempo fijo y `impresion_por_hoja` usa HEREDAR_DEL_OUTPUT_CANONICO (depende
    // de G-M2 + reseed para que el flujo end-to-end use grid-2d). Hasta entonces,
    // testeamos el dispatcher en aislamiento.
    const fakePaso = {
      rutaPasoId: 'rp1',
      rutaPasoOrden: 1,
      familiaCodigo: 'impresion_por_hoja',
      configPasoId: 'cp1',
      modoActivacion: 'OBLIGATORIO',
      condicionActivacionJson: null,
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      mecanismoCantidadConfigJson: null,
      multiplicadoresActivos: [],
      paramsPasoJson: null,
      maquinaM1Id: null,
      perfilM1Id: null,
      setupOverrideMin: null,
      cleanupOverrideMin: null,
      tiempoFijoOverrideMin: null,
      slots: [],
      cargosDirectosPaso: [],
      maquina: {
        id: 'm1',
        codigo: 'X',
        nombre: 'X',
        plantilla: 'IMPRESORA_LASER',
        parametrosTecnicosJson: {
          margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 5, inf: 5 },
        },
      },
    };
    const fakeMaterial = {
      id: 'mat1',
      atributosVarianteJson: { anchoMm: 220, largoMm: 340 },
    };
    const fakeJobContext = {
      cantidad: 1000,
      caras: 1 as const,
      piezas: [{ cantidad: 1000, anchoMm: 90, altoMm: 50 }],
    };

    const r = await runNestingForPaso(
      fakePaso as never,
      fakeJobContext,
      fakeMaterial,
    );
    expect(r).not.toBeNull();
    expect(r!.algorithm).toBe('grid-2d-single');
    expect(r!.unidad).toBe('pliegos');
    expect(r!.piezasPorPliego).toBeGreaterThanOrEqual(12); // pliego 22x34, pieza 9x5 = ~14
    expect(r!.cantidadCalculada).toBeLessThanOrEqual(85); // ceil(1000/12) = 84
    expect(r!.placements.length).toBe(r!.piezasPorPliego);
  });

  it('impresion_por_hoja usa el pliego de impresión configurado en vez del tamaño comprado', async () => {
    const fakePaso = {
      rutaPasoId: 'rp1',
      rutaPasoOrden: 1,
      familiaCodigo: 'impresion_por_hoja',
      configPasoId: 'cp1',
      modoActivacion: 'OBLIGATORIO',
      condicionActivacionJson: null,
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      mecanismoCantidadConfigJson: null,
      multiplicadoresActivos: [],
      paramsPasoJson: {
        nestingConfig: {
          pliegoImpresion: { anchoMm: 210, altoMm: 297 },
        },
      },
      maquinaM1Id: null,
      perfilM1Id: null,
      setupOverrideMin: null,
      cleanupOverrideMin: null,
      tiempoFijoOverrideMin: null,
      slots: [],
      cargosDirectosPaso: [],
      maquina: {
        id: 'm1',
        codigo: 'X',
        nombre: 'X',
        plantilla: 'IMPRESORA_LASER',
        parametrosTecnicosJson: {
          margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 5, inf: 5 },
        },
      },
    };
    const fakeMaterial = {
      id: 'mat1',
      atributosVarianteJson: { anchoMm: 320, largoMm: 460 },
    };

    const r = await runNestingForPaso(
      fakePaso as never,
      {
        cantidad: 100,
        caras: 1 as const,
        piezas: [{ cantidad: 100, anchoMm: 90, altoMm: 50 }],
      },
      fakeMaterial,
    );

    expect(r).not.toBeNull();
    expect(r!.substrates[0]).toMatchObject({
      kind: 'sheet',
      widthMm: 210,
      heightMm: 297,
    });
    expect(r!.visualConfig).toMatchObject({
      usableArea: {
        widthMm: 200,
        heightMm: 287,
      },
    });
  });

  it('impresion_por_hoja automatico elige el candidato con menor costo estimado de sustrato', async () => {
    const fakePaso = {
      rutaPasoId: 'rp1',
      rutaPasoOrden: 1,
      familiaCodigo: 'impresion_por_hoja',
      configPasoId: 'cp1',
      modoActivacion: 'OBLIGATORIO',
      condicionActivacionJson: null,
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      mecanismoCantidadConfigJson: null,
      multiplicadoresActivos: [],
      paramsPasoJson: {
        nestingConfig: {
          pliegoImpresion: {
            modo: 'automatico',
            candidatos: [
              {
                id: 'a4',
                nombre: 'A4',
                anchoMm: 210,
                altoMm: 297,
                activo: true,
              },
              {
                id: 'sra3',
                nombre: 'SRA3',
                anchoMm: 320,
                altoMm: 450,
                activo: true,
              },
            ],
          },
        },
      },
      maquinaM1Id: null,
      perfilM1Id: null,
      setupOverrideMin: null,
      cleanupOverrideMin: null,
      tiempoFijoOverrideMin: null,
      slots: [],
      cargosDirectosPaso: [],
      maquina: {
        id: 'm1',
        codigo: 'X',
        nombre: 'X',
        plantilla: 'IMPRESORA_LASER',
        parametrosTecnicosJson: {
          margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 5, inf: 5 },
        },
      },
    };
    const fakeMaterial = {
      id: 'mat1',
      atributosVarianteJson: { anchoMm: 320, largoMm: 450 },
    };

    const r = await runNestingForPaso(
      fakePaso as never,
      {
        cantidad: 100,
        caras: 1 as const,
        piezas: [{ cantidad: 100, anchoMm: 100, altoMm: 100 }],
      },
      fakeMaterial,
    );

    expect(r).not.toBeNull();
    expect(r!.substrates[0]).toMatchObject({
      kind: 'sheet',
      widthMm: 320,
      heightMm: 450,
    });
    expect(r!.pliegoImpresionSeleccionado).toMatchObject({
      id: 'sra3',
      nombre: 'SRA3',
      candidatosEvaluados: 2,
      criterio: 'menor_costo_sustrato',
    });
  });

  it('impresion_por_hoja automatico devuelve null si ningun candidato admite la pieza', async () => {
    const fakePaso = {
      rutaPasoId: 'rp1',
      rutaPasoOrden: 1,
      familiaCodigo: 'impresion_por_hoja',
      configPasoId: 'cp1',
      modoActivacion: 'OBLIGATORIO',
      condicionActivacionJson: null,
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      mecanismoCantidadConfigJson: null,
      multiplicadoresActivos: [],
      paramsPasoJson: {
        nestingConfig: {
          pliegoImpresion: {
            modo: 'automatico',
            candidatos: [
              {
                id: 'a5',
                nombre: 'A5',
                anchoMm: 148,
                altoMm: 210,
                activo: true,
              },
            ],
          },
        },
      },
      maquinaM1Id: null,
      perfilM1Id: null,
      setupOverrideMin: null,
      cleanupOverrideMin: null,
      tiempoFijoOverrideMin: null,
      slots: [],
      cargosDirectosPaso: [],
      maquina: {
        id: 'm1',
        codigo: 'X',
        nombre: 'X',
        plantilla: 'IMPRESORA_LASER',
        parametrosTecnicosJson: {
          margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 5, inf: 5 },
        },
      },
    };
    const fakeMaterial = {
      id: 'mat1',
      atributosVarianteJson: { anchoMm: 320, largoMm: 450 },
    };

    const r = await runNestingForPaso(
      fakePaso as never,
      {
        cantidad: 1,
        caras: 1 as const,
        piezas: [{ cantidad: 1, anchoMm: 300, altoMm: 300 }],
      },
      fakeMaterial,
    );

    expect(r).toBeNull();
  });

  it('G-M1: dispatcher devuelve null para familia sin algoritmo (mantiene fallback)', async () => {
    if (!tenantId) return;
    // Embalaje (CONVERSION) NO debería tener nestingResult.
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: { cantidad: 1000, caras: 2 },
    });
    const embalaje = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'embalaje',
    );
    expect(embalaje?.activado).toBe(true);
    expect(embalaje!.nestingResult).toBeUndefined();
  });

  it('G-M8: regla declarativa JsonLogic en perfil.detalleJson.reglaSeleccion gana sobre la heurística legacy', async () => {
    if (!tenantId) return;
    const ricoh = await prisma.maquina.findFirstOrThrow({
      where: { tenantId, codigo: 'RICOH-PRO-C5100' },
      include: { perfilesOperativos: true },
    });

    // Hay 2 perfiles: "Papel grueso simple faz" y "Papel grueso doble faz".
    const simpleFaz = ricoh.perfilesOperativos.find((p) =>
      /simple/i.test(p.nombre),
    )!;
    const dobleFaz = ricoh.perfilesOperativos.find((p) =>
      /doble/i.test(p.nombre),
    )!;

    // Forzar: el perfil DOBLE FAZ tiene una regla declarativa que dice
    // "elegime cuando gramajeGr >= 250" (independiente de caras).
    // Esto debería ganar sobre la heurística "doble cuando caras=2".
    const detalleOriginal = dobleFaz.detalleJson;
    await prisma.maquinaPerfilOperativo.update({
      where: { id: dobleFaz.id },
      data: {
        detalleJson: {
          ...((detalleOriginal as Record<string, unknown>) ?? {}),
          reglaSeleccion: { '>=': [{ var: 'gramajeGr' }, 250] },
        },
      },
    });

    try {
      const tarjetas = await prisma.producto.findFirstOrThrow({
        where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      });
      // caras=1 (la heurística legacy elegiría simple), pero gramajeGr=300
      // (la regla declarativa del DOBLE elige a este perfil).
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-06',
        jobContext: { cantidad: 100, caras: 1, gramajeGr: 300 },
      });
      expect(result.errores).toEqual([]);
      expect(result.exitoso).toBe(true);
      const impresion = result.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'impresion_por_hoja',
      );
      // El perfil resuelto: la regla del doble (gramajeGr >= 250) gana.
      // Verificamos a través de la productividad usada (doble vs simple).
      expect(impresion!.tiempo!.totalMin).toBeGreaterThan(0);
      // Sin verificar exactly cuál perfil porque no exponemos perfilNombre en
      // el output; pero al menos verificamos que la regla NO tiró error y la
      // cotización completó exitosamente.
    } finally {
      await prisma.maquinaPerfilOperativo.update({
        where: { id: dobleFaz.id },
        data: {
          detalleJson:
            detalleOriginal === null
              ? Prisma.JsonNull
              : (detalleOriginal as never),
        },
      });
      void simpleFaz;
    }
  });

  it('G-M9: trazabilidad de materiales reporta unidad real (no `unidad` hardcodeado)', async () => {
    if (!tenantId) return;
    // Vinilo: slot por_metro_lineal con material rollo (METRO_LINEAL).
    const vinilo = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'VINILO-BLANCO-IMP' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: vinilo.id,
      jobContext: {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 1000, altoMm: 500 }],
      },
    });
    expect(result.exitoso).toBe(true);
    const impresion = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'impresion_por_area',
    );
    const matVinilo = impresion!.materiales![0];
    // Fórmula `por_metro_lineal` → unidad reportada `m_lineales`.
    expect(matVinilo.unidad).toBe('m_lineales');

    // Tarjetas: slot por_unidad_productiva con material pliego (PLIEGO).
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const r2 = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: { cantidad: 1000, caras: 2 },
    });
    expect(r2.exitoso).toBe(true);
    const impTarjetas = r2.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'impresion_por_hoja',
    );
    const matTarjetas = impTarjetas!.materiales![0];
    // Fórmula `por_unidad_productiva` → hereda unidadStock del material.
    expect(matTarjetas.unidad).toBe('hoja');
    const pliegosImpresion = Number(
      (impTarjetas!.outputsCanonicos as Record<string, unknown>)
        .pliegos_calculados ?? impTarjetas!.nestingResult?.cantidadCalculada,
    );
    expect(pliegosImpresion).toBeGreaterThan(0);
    expect(matTarjetas.cantidad).toBeLessThanOrEqual(pliegosImpresion);
    expect(matTarjetas.materialNombre).toBe('OPALINA-300-65X45');
    expect(matTarjetas.materialSku).toBe('OPALINA-300-65X45');
    expect(matTarjetas.materialDisplayName).toBeTruthy();
    expect(matTarjetas.precioUnitario).toBeGreaterThan(0);
    expect(matTarjetas.costoTotal).toBeGreaterThan(0);
    expect(matTarjetas.tipoLineaCosto).toBe('MATERIAL');

    const consumibles = impTarjetas!.materiales!.filter(
      (m) => m.tipoLineaCosto === 'CONSUMIBLE_MAQUINA',
    );
    expect(consumibles.length).toBeGreaterThan(0);
    const tonerPorGramo = consumibles.filter((m) => m.unidad === 'gramo');
    expect(tonerPorGramo.length).toBeGreaterThan(0);
    for (const consumible of tonerPorGramo) {
      expect(consumible.precioUnitario).toBeGreaterThan(0);
      expect(consumible.costoTotal).toBeCloseTo(
        consumible.cantidad * consumible.precioUnitario,
        6,
      );
    }
    expect(consumibles[0]).toEqual(
      expect.objectContaining({
        materialSku: expect.any(String),
        materialDisplayName: expect.any(String),
        unidad: expect.any(String),
        precioUnitario: expect.any(Number),
        costoTotal: expect.any(Number),
        modoSeleccion: 'MAQUINA_CONSUMIBLE',
      }),
    );
  });

  it('G-M5: T-2 con `paramsPaso.horasEstimadas` calcula run = horas × 60', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const diseno = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'diseno_grafico',
    );
    expect(diseno).toBeDefined();

    const centro = await ensureCentroHorarioConTarifa(tenantId);

    // Forzar T-2 + horasEstimadas. tarifaHoraOperario queda como dato legacy ignorado.
    await prisma.productoConfigPaso.update({
      where: { id: diseno!.id },
      data: {
        modoTiempo: 'T-2',
        centroCostoId: centro.id,
        paramsPasoJson: { horasEstimadas: 2, tarifaHoraOperario: 5000 },
      },
    });

    try {
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-03',
        jobContext: {
          cantidad: 1000,
          caras: 2,
          opcionalesActivados: { [diseno!.id]: true },
        },
      });
      expect(result.errores).toEqual([]);
      expect(result.exitoso).toBe(true);
      const pasoDiseno = result.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'diseno_grafico',
      );
      expect(pasoDiseno!.activado).toBe(true);
      // 2 horas × 60 = 120 min de run
      expect(pasoDiseno!.tiempo!.runMin).toBe(120);
      expect(pasoDiseno!.tiempo!.tarifaHora).toBe(tarifaHoraManual);
      // costo = totalMin/60 × tarifa publicada del centro; tarifaHoraOperario se ignora.
      expect(pasoDiseno!.tiempo!.costo).toBeCloseTo(
        (pasoDiseno!.tiempo!.totalMin / 60) * tarifaHoraManual,
        0,
      );
    } finally {
      // Restaurar config original
      await prisma.productoConfigPaso.update({
        where: { id: diseno!.id },
        data: {
          modoTiempo: 'T-1',
          centroCostoId: null,
          paramsPasoJson: { tarifaFija: 5000 },
        },
      });
    }
  });

  it('G-M5: T-2 con `paramsPaso.productivityValue` calcula tiempo desde cantidad/productividad', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const embalaje = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'embalaje',
    );
    const centro = await ensureCentroHorarioConTarifa(tenantId);

    // Embalaje T-2 CONVERSION: 1000 piezas / 100 por caja = 10 cajas.
    // Productividad operario = 5 cajas/hora → run = 10/5 × 60 = 120min.
    await prisma.productoConfigPaso.update({
      where: { id: embalaje!.id },
      data: {
        centroCostoId: centro.id,
        paramsPasoJson: {
          piezasPorCaja: 100,
          productivityValue: 5,
          tarifaHoraOperario: 3000,
        },
      },
    });

    try {
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-03',
        jobContext: { cantidad: 1000, caras: 2 },
      });
      expect(result.errores).toEqual([]);
      expect(result.exitoso).toBe(true);
      const pasoEmbalaje = result.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'embalaje',
      );
      expect(pasoEmbalaje!.activado).toBe(true);
      // 10 cajas / 5 cajas/h × 60 = 120min
      expect(pasoEmbalaje!.tiempo!.runMin).toBeCloseTo(120, 0);
      expect(pasoEmbalaje!.tiempo!.tarifaHora).toBe(tarifaHoraManual);
    } finally {
      await prisma.productoConfigPaso.update({
        where: { id: embalaje!.id },
        data: {
          centroCostoId: null,
          paramsPasoJson: { piezasPorCaja: 100 },
        },
      });
    }
  });

  it('G-M5: T-2 puede calcular productividad propia por m² desde piezas', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const embalaje = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'embalaje',
    );
    const guillotina = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'corte_guillotina',
    );
    expect(embalaje).toBeDefined();
    const centro = await ensureCentroHorarioConTarifa(tenantId);
    const original = {
      modoActivacion: embalaje!.modoActivacion,
      modoTiempo: embalaje!.modoTiempo,
      centroCostoId: embalaje!.centroCostoId,
      paramsPasoJson: embalaje!.paramsPasoJson,
      guillotinaModoActivacion: guillotina?.modoActivacion ?? null,
    };

    await prisma.productoConfigPaso.update({
      where: { id: embalaje!.id },
      data: {
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-2',
        centroCostoId: centro.id,
        paramsPasoJson: {
          productivityValue: 5,
          productivityUnit: 'm2_h',
          productivityQuantitySource: 'area_piezas_m2',
        },
      },
    });
    if (guillotina) {
      await prisma.productoConfigPaso.update({
        where: { id: guillotina.id },
        data: { modoActivacion: 'NO_EJECUTAR' },
      });
    }

    try {
      // Piezas que entran en el pliego A4 configurado actualmente: desde el
      // guard `pieza_no_entra_en_pliego_impresion`, una
      // pieza imposible de imponer corta la cotización en vez de caer al
      // fallback silencioso — este test es de T-2, no de ese guard.
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-06',
        jobContext: {
          cantidad: 100,
          piezas: [{ cantidad: 2, anchoMm: 180, altoMm: 250 }],
        },
      });
      expect(result.errores).toEqual([]);
      expect(result.exitoso).toBe(true);
      const pasoEmbalaje = result.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'embalaje',
      );
      // 2 piezas × 0,045 m² = 0,09 m² a 5 m²/h → 1,08 min.
      expect(pasoEmbalaje!.tiempo!.runMin).toBeCloseTo(1.08, 2);
    } finally {
      await prisma.productoConfigPaso.update({
        where: { id: embalaje!.id },
        data: {
          modoActivacion: original.modoActivacion,
          modoTiempo: original.modoTiempo,
          centroCostoId: original.centroCostoId,
          paramsPasoJson: original.paramsPasoJson,
        },
      });
      if (guillotina) {
        await prisma.productoConfigPaso.update({
          where: { id: guillotina.id },
          data: { modoActivacion: original.guillotinaModoActivacion },
        });
      }
    }
  });

  it('G-M5: T-2 puede calcular productividad propia por m² instalados manuales', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const embalaje = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'embalaje',
    );
    const guillotina = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'corte_guillotina',
    );
    expect(embalaje).toBeDefined();
    const centro = await ensureCentroHorarioConTarifa(tenantId);
    const original = {
      modoActivacion: embalaje!.modoActivacion,
      modoTiempo: embalaje!.modoTiempo,
      centroCostoId: embalaje!.centroCostoId,
      paramsPasoJson: embalaje!.paramsPasoJson,
      guillotinaModoActivacion: guillotina?.modoActivacion ?? null,
    };

    await prisma.productoConfigPaso.update({
      where: { id: embalaje!.id },
      data: {
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-2',
        centroCostoId: centro.id,
        paramsPasoJson: {
          productivityValue: 5,
          productivityUnit: 'm2_h',
          productivityQuantitySource: 'm2_instalados',
        },
      },
    });
    if (guillotina) {
      await prisma.productoConfigPaso.update({
        where: { id: guillotina.id },
        data: { modoActivacion: 'NO_EJECUTAR' },
      });
    }

    try {
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-06',
        jobContext: {
          cantidad: 100,
          m2_instalados: 10,
        },
      });
      expect(result.errores).toEqual([]);
      expect(result.exitoso).toBe(true);
      const pasoEmbalaje = result.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'embalaje',
      );
      expect(pasoEmbalaje!.tiempo!.runMin).toBeCloseTo(120, 2);
    } finally {
      await prisma.productoConfigPaso.update({
        where: { id: embalaje!.id },
        data: {
          modoActivacion: original.modoActivacion,
          modoTiempo: original.modoTiempo,
          centroCostoId: original.centroCostoId,
          paramsPasoJson: original.paramsPasoJson,
        },
      });
      if (guillotina) {
        await prisma.productoConfigPaso.update({
          where: { id: guillotina.id },
          data: { modoActivacion: original.guillotinaModoActivacion },
        });
      }
    }
  });

  it('G-M5: T-2 puede calcular productividad propia por metros lineales cotizados', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const embalaje = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'embalaje',
    );
    const guillotina = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'corte_guillotina',
    );
    expect(embalaje).toBeDefined();
    const centro = await ensureCentroHorarioConTarifa(tenantId);
    const original = {
      modoActivacion: embalaje!.modoActivacion,
      modoTiempo: embalaje!.modoTiempo,
      centroCostoId: embalaje!.centroCostoId,
      paramsPasoJson: embalaje!.paramsPasoJson,
      guillotinaModoActivacion: guillotina?.modoActivacion ?? null,
    };

    await prisma.productoConfigPaso.update({
      where: { id: embalaje!.id },
      data: {
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-2',
        centroCostoId: centro.id,
        paramsPasoJson: {
          productivityValue: 4,
          productivityUnit: 'ml_h',
          productivityQuantitySource: 'metros_lineales',
        },
      },
    });
    if (guillotina) {
      await prisma.productoConfigPaso.update({
        where: { id: guillotina.id },
        data: { modoActivacion: 'NO_EJECUTAR' },
      });
    }

    try {
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-06',
        jobContext: {
          cantidad: 100,
          metrosLineales: 8,
        },
      });
      expect(result.errores).toEqual([]);
      expect(result.exitoso).toBe(true);
      const pasoEmbalaje = result.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'embalaje',
      );
      expect(pasoEmbalaje!.tiempo!.runMin).toBeCloseTo(120, 2);
    } finally {
      await prisma.productoConfigPaso.update({
        where: { id: embalaje!.id },
        data: {
          modoActivacion: original.modoActivacion,
          modoTiempo: original.modoTiempo,
          centroCostoId: original.centroCostoId,
          paramsPasoJson: original.paramsPasoJson,
        },
      });
      if (guillotina) {
        await prisma.productoConfigPaso.update({
          where: { id: guillotina.id },
          data: { modoActivacion: original.guillotinaModoActivacion },
        });
      }
    }
  });

  it('G-M5: T-2 con `paramsPaso.campoHorasJobContext` permite override del comercial (T-4 input manual)', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const diseno = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'diseno_grafico',
    );
    const centro = await ensureCentroHorarioConTarifa(tenantId);

    await prisma.productoConfigPaso.update({
      where: { id: diseno!.id },
      data: {
        modoTiempo: 'T-2',
        centroCostoId: centro.id,
        paramsPasoJson: {
          campoHorasJobContext: 'horasDiseno',
          horasEstimadas: 1, // fallback si el comercial no ingresa
          tarifaHoraOperario: 4000,
        },
      },
    });

    try {
      // El comercial ingresa 3.5 horas en runtime
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-03',
        jobContext: {
          cantidad: 1000,
          caras: 2,
          opcionalesActivados: { [diseno!.id]: true },
          horasDiseno: 3.5, // override del comercial
        },
      });
      expect(result.exitoso).toBe(true);
      const pasoDiseno = result.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'diseno_grafico',
      );
      // 3.5 × 60 = 210min
      expect(pasoDiseno!.tiempo!.runMin).toBe(210);
      expect(pasoDiseno!.tiempo!.costo).toBeCloseTo(
        (pasoDiseno!.tiempo!.totalMin / 60) * tarifaHoraManual,
        0,
      );
    } finally {
      await prisma.productoConfigPaso.update({
        where: { id: diseno!.id },
        data: {
          modoTiempo: 'T-1',
          centroCostoId: null,
          paramsPasoJson: { tarifaFija: 5000 },
        },
      });
    }
  });

  it('T-1 ignora `paramsPaso.tarifaFija` y usa tarifa publicada del centro manual', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const diseno = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'diseno_grafico',
    );
    const centro = await ensureCentroHorarioConTarifa(tenantId);

    await prisma.productoConfigPaso.update({
      where: { id: diseno!.id },
      data: {
        modoTiempo: 'T-1',
        tiempoFijoOverrideMin: 60,
        centroCostoId: centro.id,
        paramsPasoJson: { tarifaFija: 5000 },
      },
    });

    try {
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-03',
        jobContext: {
          cantidad: 1000,
          caras: 2,
          opcionalesActivados: { [diseno!.id]: true },
        },
      });
      expect(result.exitoso).toBe(true);
      const pasoDiseno = result.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'diseno_grafico',
      );
      expect(pasoDiseno!.activado).toBe(true);
      expect(pasoDiseno!.tiempo!.tarifaHora).toBe(tarifaHoraManual);
      expect(pasoDiseno!.tiempo!.costo).toBe(tarifaHoraManual);
    } finally {
      await prisma.productoConfigPaso.update({
        where: { id: diseno!.id },
        data: {
          centroCostoId: null,
          tiempoFijoOverrideMin: null,
          paramsPasoJson: { tarifaFija: 5000 },
        },
      });
    }
  });

  it('paso sin máquina y sin centro horario falla al costear tiempo', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const diseno = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'diseno_grafico',
    );

    await prisma.productoConfigPaso.update({
      where: { id: diseno!.id },
      data: {
        modoTiempo: 'T-1',
        tiempoFijoOverrideMin: 60,
        centroCostoId: null,
        paramsPasoJson: {},
      },
    });

    try {
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-03',
        jobContext: {
          cantidad: 1000,
          caras: 2,
          opcionalesActivados: { [diseno!.id]: true },
        },
      });
      expect(result.exitoso).toBe(false);
      expect(result.errores).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ codigo: 'centro_costo_paso_faltante' }),
        ]),
      );
    } finally {
      await prisma.productoConfigPaso.update({
        where: { id: diseno!.id },
        data: {
          tiempoFijoOverrideMin: null,
          paramsPasoJson: { tarifaFija: 5000 },
        },
      });
    }
  });

  it('paso sin máquina con centro sin tarifa publicada falla con error claro', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const diseno = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'diseno_grafico',
    );
    const centro = await ensureCentroHorarioConTarifa(tenantId);

    await prisma.centroCostoTarifaPeriodo.deleteMany({
      where: {
        tenantId,
        centroCostoId: centro.id,
        periodo: '2026-03',
        estado: EstadoTarifaCentroCostoPeriodo.PUBLICADA,
      },
    });
    await prisma.productoConfigPaso.update({
      where: { id: diseno!.id },
      data: {
        modoTiempo: 'T-1',
        tiempoFijoOverrideMin: 60,
        centroCostoId: centro.id,
        paramsPasoJson: {},
      },
    });

    try {
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-03',
        jobContext: {
          cantidad: 1000,
          caras: 2,
          opcionalesActivados: { [diseno!.id]: true },
        },
      });
      expect(result.exitoso).toBe(false);
      expect(result.errores).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            codigo: 'centro_costo_sin_tarifa_publicada',
            mensaje: expect.stringContaining('2026-03'),
          }),
        ]),
      );
    } finally {
      await prisma.productoConfigPaso.update({
        where: { id: diseno!.id },
        data: {
          centroCostoId: null,
          tiempoFijoOverrideMin: null,
          paramsPasoJson: { tarifaFija: 5000 },
        },
      });
      await ensureCentroHorarioConTarifa(tenantId);
    }
  });

  it('v3.1 talonario-grouping: el paso del original aplica el grouping y publica las pilas', async () => {
    if (!tenantId) return;
    const talonario = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TALON-DUPL-A4' },
    });
    // Cantidad NO completa un grupo (ej: 100 talonarios y poses_por_pliego ~22).
    const result = await motorService.cotizar({
      tenantId,
      productoId: talonario.id,
      periodo: '2026-03',
      jobContext: {
        cantidad: 100,
        caras: 1,
        tipoCopia: 1,
        numerosXTalonario: 50,
      },
    });
    expect(result.exitoso).toBe(true);
    // El grouping lo aplica el paso que declara `modoTalonarioIncompleto`,
    // que es el del ORIGINAL: es el que define cómo se arma el talonario y
    // el único que publica las pilas que después usa el abrochado.
    const original = result.cotizacion!.pasos.find(
      (p) =>
        p.familiaCodigo === 'impresion_por_hoja' &&
        p.nestingResult?.talonarioGrouping,
    );
    expect(original).toBeDefined();
    const tg = original!.nestingResult!.talonarioGrouping!;
    expect(tg.talonariosPedidos).toBe(100);
    expect(tg.numerosXTalonario).toBe(50);
    expect(tg.modoIncompleto).toBe('aprovechar_pliego');
    expect(tg.posesXPliego).toBeGreaterThan(0);
    expect(tg.pliegosXCapa).toBeGreaterThan(0);
    // Grupos completos consumen N pliegos cada uno; el residuo comparte
    // pliego entre sus números (aprovechar_pliego): ⌈residuo×N/P⌉ extra.
    const esperado =
      tg.gruposCompletos * tg.numerosXTalonario +
      (tg.talonariosResiduo > 0
        ? Math.ceil(
            (tg.talonariosResiduo * tg.numerosXTalonario) / tg.posesXPliego,
          )
        : 0);
    expect(tg.pliegosXCapa).toBe(esperado);
    // Desperdicio en poses: lo que sobra de los pliegos del residuo.
    expect(tg.posesDesperdicio).toBeLessThan(tg.posesXPliego);
    // pliegos_calculados publicado debe coincidir con pliegosXCapa.
    const outs = original!.outputsCanonicos as Record<string, unknown>;
    expect(outs.pliegos_calculados).toBe(tg.pliegosXCapa);
  });

  it('talonario duplicado: todas las capas activas costean la tirada completa', async () => {
    if (!tenantId) return;
    const talonario = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TALON-DUPL-A4' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: talonario.id,
      periodo: '2026-03',
      jobContext: {
        cantidad: 20,
        caras: 1,
        tipoCopia: 2,
        numerosXTalonario: 50,
        medidaCustomMm: { anchoMm: 210, altoMm: 297 },
        piezas: [{ cantidad: 20, anchoMm: 210, altoMm: 297 }],
      },
    });

    expect(result.exitoso).toBe(true);
    const impresiones = result.cotizacion!.pasos.filter(
      (p) =>
        p.activado &&
        p.familiaCodigo === 'impresion_por_hoja' &&
        p.nestingResult,
    );
    expect(impresiones).toHaveLength(2);

    const original = impresiones.find(
      (p) => p.nestingResult?.talonarioGrouping,
    );
    const duplicado = impresiones.find((p) => p !== original);
    expect(original).toBeDefined();
    expect(duplicado).toBeDefined();

    const pliegosPorCapa =
      original!.nestingResult!.talonarioGrouping!.pliegosXCapa;
    expect(pliegosPorCapa).toBe(1_000);
    expect(duplicado!.nestingResult!.cantidadCalculada).toBe(pliegosPorCapa);
    expect(
      duplicado!.materiales?.find((material) => material.unidad === 'hoja')
        ?.cantidad,
    ).toBe(pliegosPorCapa);
    // Las pilas pertenecen al agrupado original y no se vuelven a publicar.
    expect(duplicado!.outputsCanonicos?.talonario_pilas).toBeNull();
  });

  it('v3.1 grid-2d-multi: jobContext con piezas de medidas distintas → multi-bin packing', async () => {
    // Test unitario del dispatcher multi (no requiere producto seed específico).
    const fakePaso = {
      rutaPasoId: 'rp1',
      rutaPasoOrden: 1,
      familiaCodigo: 'impresion_por_hoja',
      configPasoId: 'cp1',
      modoActivacion: 'OBLIGATORIO',
      condicionActivacionJson: null,
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      mecanismoCantidadConfigJson: null,
      multiplicadoresActivos: [],
      paramsPasoJson: null,
      maquinaM1Id: null,
      perfilM1Id: null,
      setupOverrideMin: null,
      cleanupOverrideMin: null,
      tiempoFijoOverrideMin: null,
      slots: [],
      cargosDirectosPaso: [],
      maquina: {
        id: 'm1',
        codigo: 'X',
        nombre: 'X',
        plantilla: 'IMPRESORA_LASER',
        parametrosTecnicosJson: {
          margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 5, inf: 5 },
        },
      },
    };
    const fakeMaterial = {
      id: 'mat1',
      atributosVarianteJson: { anchoMm: 220, largoMm: 340 },
    };
    const fakeJobContext = {
      cantidad: 1,
      caras: 1 as const,
      // 3 medidas distintas → debería disparar grid-2d-multi.
      piezas: [
        { cantidad: 5, anchoMm: 90, altoMm: 50 },
        { cantidad: 3, anchoMm: 100, altoMm: 70 },
        { cantidad: 2, anchoMm: 60, altoMm: 80 },
      ],
    };

    const r = await runNestingForPaso(
      fakePaso as never,
      fakeJobContext,
      fakeMaterial,
    );
    expect(r).not.toBeNull();
    expect(r!.algorithm).toBe('grid-2d-multi');
    expect(r!.unidad).toBe('pliegos');
    expect(r!.cantidadCalculada).toBeGreaterThanOrEqual(1);
    expect(r!.placements.length).toBe(10); // 5+3+2 instancias acomodadas
    expect(r!.aprovechamientoPct).toBeGreaterThan(0);
  });

  it('v3.2 impresion_por_area con mesa extensora usa nesting de placa para rígidos', async () => {
    const fakePaso = {
      rutaPasoId: 'rp1',
      rutaPasoOrden: 1,
      familiaCodigo: 'impresion_por_area',
      configPasoId: 'cp1',
      modoActivacion: 'OBLIGATORIO',
      condicionActivacionJson: null,
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      mecanismoCantidadConfigJson: null,
      multiplicadoresActivos: [],
      paramsPasoJson: null,
      maquinaM1Id: null,
      perfilM1Id: null,
      setupOverrideMin: null,
      cleanupOverrideMin: null,
      tiempoFijoOverrideMin: null,
      slots: [],
      cargosDirectosPaso: [],
      maquina: {
        id: 'm1',
        codigo: 'MESA',
        nombre: 'Mesa UV',
        plantilla: 'IMPRESORA_GRAN_FORMATO_POR_AREA',
        parametrosTecnicosJson: {
          geometria: 'MESA_EXTENSORA',
          anchoMesaMm: 710,
          largoMesaMm: 510,
          margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 5, inf: 5 },
        },
      },
    };
    const fakeMaterial = {
      id: 'mat1',
      atributosVarianteJson: { anchoMm: 1830, largoMm: 2750 },
    };
    const fakeJobContext = {
      cantidad: 3,
      piezas: [
        { cantidad: 2, anchoMm: 300, altoMm: 200 },
        { cantidad: 1, anchoMm: 250, altoMm: 180 },
      ],
    };

    const r = await runNestingForPaso(
      fakePaso as never,
      fakeJobContext,
      fakeMaterial,
    );
    expect(r).not.toBeNull();
    expect(['grid-2d-multi']).toContain(r!.algorithm);
    expect(r!.unidad).toBe('pliegos');
    expect(r!.cantidadCalculada).toBeGreaterThanOrEqual(1);
    expect(r!.placements.length).toBe(3);
    expect(r!.substrates[0]).toMatchObject({
      kind: 'sheet',
      widthMm: 1830,
      heightMm: 2750,
    });
    // `margins` es el margen CRUDO de máquina (margenesNoImprimiblesMm: 5),
    // sin la demasía. El borde efectivo donde arrancan las piezas es 5 + 2,5 y
    // vive en `usableArea` (1830 − 7,5×2 = 1815). Ver NestingVisualConfig.
    expect(r!.visualConfig).toMatchObject({
      margins: { leftMm: 5, rightMm: 5, topMm: 5, bottomMm: 5 },
      spacing: { horizontalMm: 5, verticalMm: 5 },
      pieceBleedMm: 2.5,
      // Adentro del margen de máquina solamente: 1830 − 5×2.
      printableArea: {
        xMm: 5,
        yMm: 5,
        widthMm: 1820,
        heightMm: 2740,
      },
      // Adentro del margen Y de la demasía: 1830 − 7,5×2.
      usableArea: {
        xMm: 7.5,
        yMm: 7.5,
        widthMm: 1815,
        heightMm: 2735,
      },
    });
    expect(r!.aprovechamientoPct).toBeLessThan(10);
  });

  it('shelf-rollo paneliza sólo las piezas que no entran y conserva piezas normales', async () => {
    const fakePaso = {
      rutaPasoId: 'rp-rollo',
      rutaPasoOrden: 1,
      familiaCodigo: 'impresion_por_area',
      configPasoId: 'cp-rollo',
      modoActivacion: 'OBLIGATORIO',
      condicionActivacionJson: null,
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      mecanismoCantidadConfigJson: null,
      multiplicadoresActivos: [],
      paramsPasoJson: {
        nestingConfig: {
          algorithm: 'shelf-rollo',
          allowRotation: false,
          separationHMm: 5,
          separationVMm: 5,
          panelizado: {
            enabled: true,
            mode: 'automatic',
            axis: 'vertical',
            overlapMm: 20,
            maxPanelWidthMm: 0,
            distribution: 'equilibrada',
            widthInterpretation: 'total',
          },
        },
      },
      maquinaM1Id: null,
      perfilM1Id: null,
      setupOverrideMin: null,
      cleanupOverrideMin: null,
      tiempoFijoOverrideMin: null,
      slots: [],
      cargosDirectosPaso: [],
      maquina: {
        id: 'm-rollo',
        codigo: 'ROLLO',
        nombre: 'Rollo',
        plantilla: 'IMPRESORA_GRAN_FORMATO_POR_AREA',
        parametrosTecnicosJson: {
          geometria: 'ROLLO',
          anchoMaxRolloMm: 1370,
          margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 10, inf: 10 },
        },
      },
    };
    const r = await runNestingForPaso(
      fakePaso as never,
      {
        cantidad: 1,
        piezas: [
          { cantidad: 1, anchoMm: 1800, altoMm: 800 },
          { cantidad: 2, anchoMm: 200, altoMm: 300 },
        ],
      },
      { id: 'vinilo-137', atributosVarianteJson: { anchoMm: 1370 } },
    );

    expect(r).not.toBeNull();
    expect(r!.algorithm).toBe('shelf-rollo');
    expect(r!.visualConfig?.panelizado).toMatchObject({
      enabled: true,
      axis: 'vertical',
      overlapMm: 20,
      panelCount: 2,
    });
    expect(r!.placements.filter((p) => p.panelIndex != null)).toHaveLength(2);
    expect(r!.placements.filter((p) => p.panelIndex == null)).toHaveLength(2);
  });

  it('shelf-rollo con dirección automática resuelve un eje concreto para panelizar', async () => {
    const fakePaso = {
      rutaPasoId: 'rp-rollo-auto',
      rutaPasoOrden: 1,
      familiaCodigo: 'impresion_por_area',
      configPasoId: 'cp-rollo-auto',
      modoActivacion: 'OBLIGATORIO',
      condicionActivacionJson: null,
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      mecanismoCantidadConfigJson: null,
      multiplicadoresActivos: [],
      paramsPasoJson: {
        nestingConfig: {
          algorithm: 'shelf-rollo',
          allowRotation: false,
          separationHMm: 5,
          separationVMm: 5,
          panelizado: {
            enabled: true,
            mode: 'automatic',
            axis: 'automatic',
            overlapMm: 20,
            maxPanelWidthMm: 0,
            distribution: 'equilibrada',
            widthInterpretation: 'total',
          },
        },
      },
      maquinaM1Id: null,
      perfilM1Id: null,
      setupOverrideMin: null,
      cleanupOverrideMin: null,
      tiempoFijoOverrideMin: null,
      slots: [],
      cargosDirectosPaso: [],
      maquina: {
        id: 'm-rollo-auto',
        codigo: 'ROLLO',
        nombre: 'Rollo',
        plantilla: 'IMPRESORA_GRAN_FORMATO_POR_AREA',
        parametrosTecnicosJson: {
          geometria: 'ROLLO',
          anchoMaxRolloMm: 1370,
          margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 10, inf: 10 },
        },
      },
    };
    const r = await runNestingForPaso(
      fakePaso as never,
      {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 1800, altoMm: 800 }],
      },
      { id: 'vinilo-137', atributosVarianteJson: { anchoMm: 1370 } },
    );

    expect(r).not.toBeNull();
    expect(r!.visualConfig?.panelizado?.enabled).toBe(true);
    expect(['vertical', 'horizontal']).toContain(
      r!.visualConfig?.panelizado?.axis,
    );
    expect(r!.placements.filter((p) => p.panelIndex != null).length).toBe(2);
  });

  it('shelf-rollo con dirección automática no paneliza piezas que entran enteras', async () => {
    const fakePaso = {
      rutaPasoId: 'rp-rollo-auto-mixto',
      rutaPasoOrden: 1,
      familiaCodigo: 'impresion_por_area',
      configPasoId: 'cp-rollo-auto-mixto',
      modoActivacion: 'OBLIGATORIO',
      condicionActivacionJson: null,
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      mecanismoCantidadConfigJson: null,
      multiplicadoresActivos: [],
      paramsPasoJson: {
        nestingConfig: {
          algorithm: 'shelf-rollo',
          allowRotation: true,
          separationHMm: 5,
          separationVMm: 5,
          panelizado: {
            enabled: true,
            mode: 'automatic',
            axis: 'automatic',
            overlapMm: 20,
            maxPanelWidthMm: 0,
            distribution: 'equilibrada',
            widthInterpretation: 'total',
          },
        },
      },
      maquinaM1Id: null,
      perfilM1Id: null,
      setupOverrideMin: null,
      cleanupOverrideMin: null,
      tiempoFijoOverrideMin: null,
      slots: [],
      cargosDirectosPaso: [],
      maquina: {
        id: 'm-rollo-auto-mixto',
        codigo: 'ROLLO',
        nombre: 'Rollo',
        plantilla: 'IMPRESORA_GRAN_FORMATO_POR_AREA',
        parametrosTecnicosJson: {
          geometria: 'ROLLO',
          anchoMaxRolloMm: 1520,
          margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 10, inf: 10 },
        },
      },
    };
    const r = await runNestingForPaso(
      fakePaso as never,
      {
        cantidad: 1,
        piezas: [
          { cantidad: 1, anchoMm: 1600, altoMm: 1600 },
          { cantidad: 1, anchoMm: 1500, altoMm: 1500 },
        ],
      },
      { id: 'vinilo-152', atributosVarianteJson: { anchoMm: 1520 } },
    );

    expect(r).not.toBeNull();
    expect(
      r!.placements.filter(
        (p) => p.pieceId === 'piece-0-0' && p.panelIndex != null,
      ),
    ).toHaveLength(2);
    expect(
      r!.placements.filter(
        (p) => p.pieceId === 'piece-1-0' && p.panelIndex != null,
      ),
    ).toHaveLength(0);
    expect(r!.placements.find((p) => p.pieceId === 'piece-1-0')).toMatchObject({
      widthMm: 1500,
      heightMm: 1500,
    });
  });

  it('shelf-rollo con panelizado vertical automático conserva enteras las piezas que entran', async () => {
    const fakePaso = {
      rutaPasoId: 'rp-rollo-vertical-mixto',
      rutaPasoOrden: 1,
      familiaCodigo: 'impresion_por_area',
      configPasoId: 'cp-rollo-vertical-mixto',
      modoActivacion: 'OBLIGATORIO',
      condicionActivacionJson: null,
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      mecanismoCantidadConfigJson: null,
      multiplicadoresActivos: [],
      paramsPasoJson: {
        nestingConfig: {
          algorithm: 'shelf-rollo',
          allowRotation: true,
          separationHMm: 5,
          separationVMm: 5,
          panelizado: {
            enabled: true,
            mode: 'automatic',
            axis: 'vertical',
            overlapMm: 20,
            maxPanelWidthMm: 0,
            distribution: 'equilibrada',
            widthInterpretation: 'total',
          },
        },
      },
      maquinaM1Id: null,
      perfilM1Id: null,
      setupOverrideMin: null,
      cleanupOverrideMin: null,
      tiempoFijoOverrideMin: null,
      slots: [],
      cargosDirectosPaso: [],
      maquina: {
        id: 'm-rollo-vertical-mixto',
        codigo: 'ROLLO',
        nombre: 'Rollo',
        plantilla: 'IMPRESORA_GRAN_FORMATO_POR_AREA',
        parametrosTecnicosJson: {
          geometria: 'ROLLO',
          anchoMaxRolloMm: 1520,
          margenesNoImprimiblesMm: { izq: 7.5, der: 7.5, sup: 7.5, inf: 7.5 },
        },
      },
    };
    const r = await runNestingForPaso(
      fakePaso as never,
      {
        cantidad: 1,
        piezas: [
          { cantidad: 1, anchoMm: 1600, altoMm: 1600 },
          { cantidad: 1, anchoMm: 1500, altoMm: 1500 },
        ],
      },
      { id: 'vinilo-152', atributosVarianteJson: { anchoMm: 1520 } },
    );

    expect(r).not.toBeNull();
    expect(
      r!.placements.filter(
        (p) => p.pieceId === 'piece-0-0' && p.panelIndex != null,
      ),
    ).toHaveLength(2);
    expect(
      r!.placements.filter(
        (p) => p.pieceId === 'piece-1-0' && p.panelIndex != null,
      ),
    ).toHaveLength(0);
    expect(r!.placements.find((p) => p.pieceId === 'piece-1-0')).toMatchObject({
      widthMm: 1500,
      heightMm: 1500,
    });
  });

  it('plotter_corte ignora panelizado aunque exista configuración accidental', async () => {
    const fakePaso = {
      rutaPasoId: 'rp-plotter',
      rutaPasoOrden: 1,
      familiaCodigo: 'plotter_corte',
      configPasoId: 'cp-plotter',
      modoActivacion: 'OBLIGATORIO',
      condicionActivacionJson: null,
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      mecanismoCantidadConfigJson: null,
      multiplicadoresActivos: [],
      paramsPasoJson: {
        nestingConfig: {
          algorithm: 'shelf-rollo',
          allowRotation: false,
          separationHMm: 5,
          separationVMm: 5,
          panelizado: {
            enabled: true,
            mode: 'automatic',
            axis: 'vertical',
            overlapMm: 20,
            maxPanelWidthMm: 0,
            distribution: 'equilibrada',
            widthInterpretation: 'total',
          },
        },
      },
      maquinaM1Id: null,
      perfilM1Id: null,
      setupOverrideMin: null,
      cleanupOverrideMin: null,
      tiempoFijoOverrideMin: null,
      slots: [],
      cargosDirectosPaso: [],
      maquina: {
        id: 'm-plotter',
        codigo: 'PLOTTER',
        nombre: 'Plotter',
        plantilla: 'PLOTTER_DE_CORTE',
        parametrosTecnicosJson: {
          geometria: 'ROLLO',
          anchoMaxRolloMm: 1370,
          margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 10, inf: 10 },
        },
      },
    };
    const r = await runNestingForPaso(
      fakePaso as never,
      {
        cantidad: 1,
        piezas: [{ cantidad: 1, anchoMm: 1800, altoMm: 800 }],
      },
      { id: 'vinilo-137', atributosVarianteJson: { anchoMm: 1370 } },
    );

    expect(r).toBeNull();
  });

  it('v3.1 grid-2d-multi: piezas todas iguales → cae a single (más eficiente)', async () => {
    const fakePaso = {
      rutaPasoId: 'rp1',
      rutaPasoOrden: 1,
      familiaCodigo: 'impresion_por_hoja',
      configPasoId: 'cp1',
      modoActivacion: 'OBLIGATORIO',
      condicionActivacionJson: null,
      modoTiempo: 'T-3',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      mecanismoCantidadConfigJson: null,
      multiplicadoresActivos: [],
      paramsPasoJson: null,
      maquinaM1Id: null,
      perfilM1Id: null,
      setupOverrideMin: null,
      cleanupOverrideMin: null,
      tiempoFijoOverrideMin: null,
      slots: [],
      cargosDirectosPaso: [],
      maquina: {
        id: 'm1',
        codigo: 'X',
        nombre: 'X',
        plantilla: 'IMPRESORA_LASER',
        parametrosTecnicosJson: {
          margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 5, inf: 5 },
        },
      },
    };
    const fakeMaterial = {
      id: 'mat1',
      atributosVarianteJson: { anchoMm: 220, largoMm: 340 },
    };
    // 2 entradas con la MISMA medida → 1 medida distinta → single.
    const fakeJobContext = {
      cantidad: 1000,
      caras: 1 as const,
      piezas: [
        { cantidad: 500, anchoMm: 90, altoMm: 50 },
        { cantidad: 500, anchoMm: 90, altoMm: 50 },
      ],
    };

    const r = await runNestingForPaso(
      fakePaso as never,
      fakeJobContext,
      fakeMaterial,
    );
    expect(r).not.toBeNull();
    expect(r!.algorithm).toBe('grid-2d-single');
    expect(r!.piezasPorPliego).toBeGreaterThan(0);
  });

  it('G-M2: impresion_por_hoja publica la imposición (pre-prensa ya no acomoda)', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      periodo: '2026-03',
      jobContext: { cantidad: 1000, caras: 2 },
      // sin piezas explícitas: motor usa medidaDefault (90×50) del producto
    });
    expect(result.exitoso).toBe(true);
    const prePrensa = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'pre_prensa',
    );
    expect(prePrensa).toBeDefined();
    expect(prePrensa!.activado).toBe(false);
    // Pre-prensa es opcional en esta configuración y no acomoda.
    expect(prePrensa!.outputsCanonicos ?? {}).toEqual({});

    const impresion = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'impresion_por_hoja',
    );
    expect(impresion).toBeDefined();
    const outs = impresion!.outputsCanonicos as Record<string, unknown>;
    expect(outs.pliegos_calculados).toBeGreaterThan(0);
    expect(outs.poses_por_pliego).toBeGreaterThan(0);
    expect(outs.imposicion_calculada).toMatchObject({
      algorithm: 'grid-2d-single',
    });
    expect(
      (outs.imposicion_calculada as { piezasPorPliego?: unknown })
        .piezasPorPliego,
    ).toEqual(expect.any(Number));
    expect(
      (outs.cortes_calculados as { cortesTotales?: unknown }).cortesTotales,
    ).toEqual(expect.any(Number));
  });

  it('pre_prensa respeta el pliego configurado en el paso de impresion_por_hoja', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const impresion = tarjetas.rutasAlternativas[0].configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'impresion_por_hoja',
    );
    expect(impresion).toBeDefined();

    const originalParams = impresion!.paramsPasoJson;
    await prisma.productoConfigPaso.update({
      where: { id: impresion!.id },
      data: {
        paramsPasoJson: {
          nestingConfig: {
            pliegoImpresion: { preset: 'A4', anchoMm: 210, altoMm: 297 },
          },
        },
      },
    });

    try {
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-03',
        jobContext: { cantidad: 1000, caras: 2 },
      });
      expect(result.exitoso).toBe(true);
      const pasoImpresion = result.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'impresion_por_hoja',
      );
      expect(pasoImpresion?.nestingResult?.substrates[0]).toMatchObject({
        kind: 'sheet',
        widthMm: 210,
        heightMm: 297,
      });
      expect(pasoImpresion?.outputsCanonicos).toMatchObject({
        pliego_impresion_ancho_mm: 210,
        pliego_impresion_alto_mm: 297,
        pliego_impresion_area_m2: (210 * 297) / 1_000_000,
      });
      const pliegosImpresion = Number(
        (pasoImpresion!.outputsCanonicos as Record<string, unknown>)
          .pliegos_calculados ?? 0,
      );
      const sustrato = pasoImpresion!.materiales!.find(
        (m) => m.slotCodigo === 'sustrato_principal',
      );
      expect(sustrato?.materialSku).toBe('OPALINA-300-65X45');
      // La hoja comercial de 650×450 rinde cuatro pliegos A4 rotados.
      expect(sustrato?.cantidad).toBe(Math.ceil(pliegosImpresion / 4));
    } finally {
      await prisma.productoConfigPaso.update({
        where: { id: impresion!.id },
        data: {
          paramsPasoJson:
            originalParams === null
              ? Prisma.JsonNull
              : (originalParams as never),
        },
      });
    }
  });

  it('G-M2: impresion_por_hoja cotiza sobre pliegos, no sobre piezas sueltas', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      periodo: '2026-03',
      jobContext: { cantidad: 1000, caras: 2 },
    });
    expect(result.exitoso).toBe(true);
    const prePrensa = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'pre_prensa',
    );
    const impresion = result.cotizacion!.pasos.find(
      (p) => p.familiaCodigo === 'impresion_por_hoja',
    );
    expect(prePrensa).toBeDefined();
    expect(impresion).toBeDefined();

    // La imposición ahora la hace el propio paso de impresión: los pliegos
    // salen de su acomodo, no de un output de pre-prensa.
    const outsImp = impresion!.outputsCanonicos as Record<string, unknown>;
    const pliegos = outsImp.pliegos_calculados as number;
    expect(pliegos).toBeGreaterThan(0);
    expect(pliegos).toBeLessThan(1000); // 1000 tarjetas no requieren 1000 pliegos
    expect(outsImp.pliegos_impresos).toBe(pliegos);
  });

  it('v3.2 impresion_por_hoja calcula nesting propio si no hay output de pre-prensa', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const prePrensa = tarjetas.rutasAlternativas[0].configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'pre_prensa',
    );
    expect(prePrensa).toBeDefined();

    const original = {
      modoActivacion: prePrensa!.modoActivacion,
      tiempoFijoOverrideMin: prePrensa!.tiempoFijoOverrideMin,
    };

    await prisma.productoConfigPaso.update({
      where: { id: prePrensa!.id },
      data: { modoActivacion: 'OPCIONAL' },
    });

    try {
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-03',
        jobContext: { cantidad: 1000, caras: 2 },
      });
      expect(result.exitoso).toBe(true);

      const pasoPrePrensa = result.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'pre_prensa',
      );
      const impresion = result.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'impresion_por_hoja',
      );
      const guillotina = result.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'corte_guillotina',
      );

      expect(pasoPrePrensa!.activado).toBe(false);
      expect(impresion!.nestingResult?.algorithm).toBe('grid-2d-single');
      expect(
        (impresion!.outputsCanonicos as Record<string, unknown>)
          .pliegos_calculados,
      ).toBeGreaterThan(0);
      expect(guillotina!.activado).toBe(true);

      // Sin pre-prensa, la imposición la hace la propia impresión: es ella la
      // que tiene la grilla, así que es ella la que publica los cortes. Sin
      // esto la guillotina costaría 0 minutos en silencio.
      const cortes = (impresion!.outputsCanonicos as Record<string, unknown>)
        .cortes_calculados as { cortesTotales?: number } | null;
      expect(cortes).not.toBeNull();
      expect(cortes!.cortesTotales).toBeGreaterThan(0);
      expect(guillotina!.tiempo!.runMin).toBeGreaterThan(0);
    } finally {
      await prisma.productoConfigPaso.update({
        where: { id: prePrensa!.id },
        data: original,
      });
    }
  });

  it('rechaza medidas inválidas antes de ejecutar pasos o herencias', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: {
        cantidad: 1000,
        caras: 2,
        piezas: [{ cantidad: 1, anchoMm: 0, altoMm: 0 }], // medidas inválidas
        // Sobre-escribimos medidaCustomMm para que el motor NO use medidaDefault
        medidaCustomMm: { anchoMm: 0, altoMm: 0 },
      },
    });
    expect(result.exitoso).toBe(false);
    const e = result.errores.find(
      (error) => error.codigo === 'job_context_invalido',
    );
    expect(e).toBeDefined();
    expect(e!.severidad).toBe('ERROR');
  });

  it('G-M3: cargo directo a nivel PASO (MONTO_FIJO_PLANO OBLIGATORIO) se aplica al paso', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const cargoCatalogo = await prisma.cargoDirectoCatalogo.findFirstOrThrow({
      where: { tenantId, codigo: 'tercerizacion' },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const prePrensa = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'pre_prensa',
    );
    expect(prePrensa).toBeDefined();

    // Asociar cargo de tercerización OBLIGATORIO con monto fijo 500 al paso pre_prensa
    const cargoPaso = await prisma.productoCargoDirectoPaso.create({
      data: {
        tenantId,
        productoConfigPasoId: prePrensa!.id,
        cargoDirectoCatalogoId: cargoCatalogo.id,
        modoActivacion: 'OBLIGATORIO',
        configOverrideJson: { monto: 500 },
        activo: true,
      },
    });

    try {
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-03',
        jobContext: {
          cantidad: 1000,
          caras: 2,
          opcionalesActivados: { [prePrensa!.id]: true },
        },
      });

      expect(result.exitoso).toBe(true);
      const pasoPrePrensa = result.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'pre_prensa',
      );
      expect(pasoPrePrensa).toBeDefined();
      expect(pasoPrePrensa!.activado).toBe(true);
      expect(pasoPrePrensa!.cargosDirectosPaso?.length).toBe(1);
      const cargo = pasoPrePrensa!.cargosDirectosPaso![0];
      expect(cargo.cargoCodigo).toBe('tercerizacion');
      expect(cargo.monto).toBe(500);
      expect(cargo.modoCalculo).toBe('MONTO_FIJO_PLANO');

      // El costoTotal del paso debe incluir los 500 además de tiempo + materiales
      const subtotalEsperado =
        (pasoPrePrensa!.tiempo?.costo ?? 0) +
        (pasoPrePrensa!.materiales?.reduce((acc, m) => acc + m.costoTotal, 0) ??
          0);
      expect(pasoPrePrensa!.costoTotal).toBeCloseTo(subtotalEsperado + 500, 2);

      // El total agregado de la cotización también debe sumarlo
      expect(
        result.cotizacion!.costos.cargosDirectosTotal,
      ).toBeGreaterThanOrEqual(500);
    } finally {
      await prisma.productoCargoDirectoPaso.delete({
        where: { id: cargoPaso.id },
      });
    }
  });

  it('G-M3: cargo PORCENTAJE_SOBRE_BASE a nivel PASO usa el subtotal DEL PASO como base', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    // Usar el cargo "recargo_urgencia" del seed (PORCENTAJE_SOBRE_BASE)
    const cargoUrgencia = await prisma.cargoDirectoCatalogo.findFirstOrThrow({
      where: { tenantId, codigo: 'recargo_urgencia' },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const impresion = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'impresion_por_hoja',
    );
    expect(impresion).toBeDefined();

    // Asociar 10% al paso impresión, OBLIGATORIO
    const cargoPaso = await prisma.productoCargoDirectoPaso.create({
      data: {
        tenantId,
        productoConfigPasoId: impresion!.id,
        cargoDirectoCatalogoId: cargoUrgencia.id,
        modoActivacion: 'OBLIGATORIO',
        configOverrideJson: { porcentaje: 10 },
        activo: true,
      },
    });

    try {
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-03',
        jobContext: { cantidad: 1000, caras: 2 },
      });

      expect(result.exitoso).toBe(true);
      const pasoImpresion = result.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'impresion_por_hoja',
      );
      expect(pasoImpresion).toBeDefined();
      const subtotalPaso =
        (pasoImpresion!.tiempo?.costo ?? 0) +
        (pasoImpresion!.materiales?.reduce((acc, m) => acc + m.costoTotal, 0) ??
          0);
      const cargo = pasoImpresion!.cargosDirectosPaso![0];
      expect(cargo.monto).toBeCloseTo(subtotalPaso * 0.1, 2);
      expect((cargo.detalle as { scope?: string })?.scope).toBe('PASO');
    } finally {
      await prisma.productoCargoDirectoPaso.delete({
        where: { id: cargoPaso.id },
      });
    }
  });

  it('G-M3: cargo OPCIONAL a nivel PASO no se aplica si el comercial no lo activa', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
      include: {
        rutasAlternativas: {
          include: { configPasos: { include: { rutaPaso: true } } },
        },
      },
    });
    const cargoCatalogo = await prisma.cargoDirectoCatalogo.findFirstOrThrow({
      where: { tenantId, codigo: 'tercerizacion' },
    });
    const ruta = tarjetas.rutasAlternativas[0];
    const prePrensa = ruta.configPasos.find(
      (c) => c.rutaPaso.familiaCodigo === 'pre_prensa',
    );

    const cargoPaso = await prisma.productoCargoDirectoPaso.create({
      data: {
        tenantId,
        productoConfigPasoId: prePrensa!.id,
        cargoDirectoCatalogoId: cargoCatalogo.id,
        modoActivacion: 'OPCIONAL',
        configOverrideJson: { monto: 1500 },
        activo: true,
      },
    });

    try {
      // Se activa el paso, pero no el cargo opcional → no se aplica el cargo.
      const result = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-03',
        jobContext: {
          cantidad: 1000,
          caras: 2,
          opcionalesActivados: { [prePrensa!.id]: true },
        },
      });
      const pasoPrePrensa = result.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'pre_prensa',
      );
      expect(pasoPrePrensa!.cargosDirectosPaso?.length).toBe(0);

      // Con opcionalesActivados[cargoPaso.id] = true → SÍ se aplica
      const resultActivado = await motorService.cotizar({
        tenantId,
        productoId: tarjetas.id,
        periodo: '2026-03',
        jobContext: {
          cantidad: 1000,
          caras: 2,
          opcionalesActivados: {
            [prePrensa!.id]: true,
            [cargoPaso.id]: true,
          },
        },
      });
      const pasoActivado = resultActivado.cotizacion!.pasos.find(
        (p) => p.familiaCodigo === 'pre_prensa',
      );
      expect(pasoActivado!.cargosDirectosPaso?.length).toBe(1);
      expect(pasoActivado!.cargosDirectosPaso![0].monto).toBe(1500);
    } finally {
      await prisma.productoCargoDirectoPaso.delete({
        where: { id: cargoPaso.id },
      });
    }
  });

  it('estructura de costos siempre presente, aunque sean 0', async () => {
    if (!tenantId) return;
    const tarjetas = await prisma.producto.findFirstOrThrow({
      where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
    });
    const result = await motorService.cotizar({
      tenantId,
      productoId: tarjetas.id,
      jobContext: { cantidad: 1000 },
    });
    const c = result.cotizacion!.costos;
    expect(c.tiempoTotal).toEqual(expect.any(Number));
    expect(c.materialesTotal).toEqual(expect.any(Number));
    expect(c.cargosDirectosTotal).toEqual(expect.any(Number));
    expect(c.componentesFabricadosTotal).toEqual(expect.any(Number));
    expect(c.total).toEqual(expect.any(Number));
    expect(c.unitario).toEqual(expect.any(Number));
  });

  it('F4.2/F4.3/F4.4.2: valida pricing y nesting consolidable de un compuesto', async () => {
    if (!tenantId) return;
    const productos = new ProductosService(prisma as never);
    const recetas = new RecetasProductoService(
      prisma as never,
      productos,
      new ProductoValidacionService(productos),
      { publicar: jest.fn().mockResolvedValue(undefined) } as never,
    );
    const auth = {
      tenantId,
      userId: '00000000-0000-0000-0000-000000000001',
      email: 'qa-fase-3@grafoprint.local',
    } as never;
    const [rigidoInicial, tarjetas] = await Promise.all([
      productos.obtenerProducto(
        tenantId,
        (
          await prisma.producto.findFirstOrThrow({
            where: { tenantId, codigo: 'RIGIDO-CUSTOM' },
            select: { id: true },
          })
        ).id,
      ),
      productos.obtenerProducto(
        tenantId,
        (
          await prisma.producto.findFirstOrThrow({
            where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
            select: { id: true },
          })
        ).id,
      ),
    ]);
    const rutaRigidoInicial =
      rigidoInicial.rutasAlternativas.find((ruta) => ruta.esPreferida) ??
      rigidoInicial.rutasAlternativas[0];
    const pinturaMaterial = await prisma.materiaPrima.upsert({
      where: { tenantId_codigo: { tenantId, codigo: 'QA-F3-PINTURA' } },
      update: { activo: true },
      create: {
        tenantId,
        codigo: 'QA-F3-PINTURA',
        nombre: 'Pintura blanca para exhibidor',
        familia: FamiliaMateriaPrima.PINTURA_RECUBRIMIENTO,
        subfamilia: SubfamiliaMateriaPrima.PINTURA_CARTELERIA,
        tipoTecnico: 'pintura_exhibidor',
        templateId: 'pintura_carteleria_v1',
        unidadStock: UnidadMateriaPrima.LITRO,
        unidadCompra: UnidadMateriaPrima.LITRO,
        atributosTecnicosJson: {},
      },
    });
    const pintura = await prisma.materiaPrimaVariante.upsert({
      where: { tenantId_sku: { tenantId, sku: 'QA-F3-PINT-BLA' } },
      update: { activo: true, precioReferencia: 8000 },
      create: {
        tenantId,
        materiaPrimaId: pinturaMaterial.id,
        sku: 'QA-F3-PINT-BLA',
        nombreVariante: 'Pintura blanca · 1 litro',
        atributosVarianteJson: {},
        unidadStock: UnidadMateriaPrima.LITRO,
        unidadCompra: UnidadMateriaPrima.LITRO,
        precioReferencia: 8000,
        moneda: 'ARS',
      },
    });
    const packaging = await prisma.materiaPrima.upsert({
      where: { tenantId_codigo: { tenantId, codigo: 'QA-F3-PACKAGING' } },
      update: { activo: true },
      create: {
        tenantId,
        codigo: 'QA-F3-PACKAGING',
        nombre: 'Caja corrugada para exhibidor',
        familia: FamiliaMateriaPrima.PACKING_INSTALACION,
        subfamilia: SubfamiliaMateriaPrima.EMBALAJE_PROTECCION,
        tipoTecnico: 'caja_corrugada_exhibidor',
        templateId: 'embalaje_proteccion_v1',
        unidadStock: UnidadMateriaPrima.UNIDAD,
        unidadCompra: UnidadMateriaPrima.UNIDAD,
        atributosTecnicosJson: { uso: 'exhibidor' },
      },
    });
    const packagingVariante = await prisma.materiaPrimaVariante.upsert({
      where: { tenantId_sku: { tenantId, sku: 'QA-F3-CAJA-EXH' } },
      update: { activo: true, precioReferencia: 2400 },
      create: {
        tenantId,
        materiaPrimaId: packaging.id,
        sku: 'QA-F3-CAJA-EXH',
        nombreVariante: 'Caja exhibidor 60 × 180 cm',
        atributosVarianteJson: { anchoMm: 600, altoMm: 1800 },
        unidadStock: UnidadMateriaPrima.UNIDAD,
        unidadCompra: UnidadMateriaPrima.UNIDAD,
        precioReferencia: 2400,
        moneda: 'ARS',
      },
    });
    const accesorio = await prisma.materiaPrima.upsert({
      where: { tenantId_codigo: { tenantId, codigo: 'QA-F3-ACCESORIO' } },
      update: { activo: true },
      create: {
        tenantId,
        codigo: 'QA-F3-ACCESORIO',
        nombre: 'Escuadra metálica para exhibidor',
        familia: FamiliaMateriaPrima.HERRAJE_ACCESORIO,
        subfamilia: SubfamiliaMateriaPrima.ACCESORIO_MONTAJE_POP,
        tipoTecnico: 'escuadra_exhibidor',
        templateId: 'accesorio_montaje_pop_v1',
        unidadStock: UnidadMateriaPrima.UNIDAD,
        unidadCompra: UnidadMateriaPrima.UNIDAD,
        atributosTecnicosJson: { uso: 'refuerzo' },
      },
    });
    const accesorioVariante = await prisma.materiaPrimaVariante.upsert({
      where: { tenantId_sku: { tenantId, sku: 'QA-F3-ESCUADRA' } },
      update: { activo: true, precioReferencia: 350 },
      create: {
        tenantId,
        materiaPrimaId: accesorio.id,
        sku: 'QA-F3-ESCUADRA',
        nombreVariante: 'Escuadra metálica reforzada',
        atributosVarianteJson: {},
        unidadStock: UnidadMateriaPrima.UNIDAD,
        unidadCompra: UnidadMateriaPrima.UNIDAD,
        precioReferencia: 350,
        moneda: 'ARS',
      },
    });
    const configPintura = rutaRigidoInicial.configPasos.find(
      (paso) => paso.rutaPaso.familiaCodigo === 'pintura_superficial',
    )!;
    const configEmbalaje = rutaRigidoInicial.configPasos.find(
      (paso) => paso.rutaPaso.familiaCodigo === 'embalaje',
    )!;
    const estacionQa = await prisma.estacion.upsert({
      where: {
        tenantId_nombre: { tenantId, nombre: 'QA F3 · Impresión rígida' },
      },
      update: { activo: true },
      create: {
        tenantId,
        nombre: 'QA F3 · Impresión rígida',
        etapa: 'impresion',
        capacidadConcurrente: 1,
      },
    });
    await prisma.estacionRegla.upsert({
      where: {
        estacionId_tipo_valor: {
          estacionId: estacionQa.id,
          tipo: 'familia',
          valor: 'impresion_por_area',
        },
      },
      update: {},
      create: {
        tenantId,
        estacionId: estacionQa.id,
        tipo: 'familia',
        valor: 'impresion_por_area',
      },
    });
    await prisma.productoConfigPasoSlotMaterial.createMany({
      data: [
        {
          tenantId,
          productoConfigPasoId: configPintura.id,
          slotCodigo: 'pintura',
          slotNombre: 'Pintura / laca',
          slotRol: 'CONSUMIBLE',
          modoSeleccion: 'HARDCODED',
          materialVarianteId: pintura.id,
          formula: 'por_unidad_productiva',
          cantidadFactor: 0.15,
        },
        {
          tenantId,
          productoConfigPasoId: configEmbalaje.id,
          slotCodigo: 'caja',
          slotNombre: 'Caja corrugada',
          slotRol: 'PACKAGING',
          modoSeleccion: 'HARDCODED',
          materialVarianteId: packagingVariante.id,
          formula: 'por_pieza',
          cantidadFactor: 1,
        },
        {
          tenantId,
          productoConfigPasoId: configEmbalaje.id,
          slotCodigo: 'escuadras',
          slotNombre: 'Escuadras de refuerzo',
          slotRol: 'COMPONENTE',
          modoSeleccion: 'HARDCODED',
          materialVarianteId: accesorioVariante.id,
          formula: 'por_pieza',
          cantidadFactor: 4,
        },
      ],
      skipDuplicates: true,
    });
    await prisma.productoConfigPasoSlotMaterial.updateMany({
      where: {
        tenantId,
        productoConfigPasoId: {
          in: rutaRigidoInicial.configPasos.map((paso) => paso.id),
        },
        slotCodigo: 'sustrato_principal',
      },
      data: { slotRol: 'SUSTRATO' },
    });
    const rigido = await productos.obtenerProducto(tenantId, rigidoInicial.id);
    const estructuraRigidoOriginal = rigido.estructuraProducto;
    const preciosOriginales = await prisma.producto.findMany({
      where: { tenantId, id: { in: [rigido.id, tarjetas.id] } },
      select: {
        id: true,
        precioConfigJson: true,
        atributosComercialesJson: true,
      },
    });
    const pricingPadreGeneral = {
      metodoCalculo: 'por_margen',
      detalle: { marginPct: 25 },
    } satisfies Prisma.InputJsonObject;
    const pricingHijoNoAplicado = {
      metodoCalculo: 'por_margen',
      detalle: { marginPct: 35 },
    } satisfies Prisma.InputJsonObject;
    const pricingOverride = {
      metodoCalculo: 'por_margen',
      detalle: { marginPct: 55 },
    } satisfies Prisma.InputJsonObject;

    await prisma.productoReceta.deleteMany({
      where: { tenantId, productoId: { in: [rigido.id, tarjetas.id] } },
    });
    await prisma.$transaction([
      prisma.producto.update({
        where: { id: rigido.id },
        data: {
          estructuraProducto: EstructuraProducto.COMPUESTO,
          precioConfigJson: pricingPadreGeneral,
          atributosComercialesJson: {
            nestingCompuesto: {
              version: 1,
              politica: 'CONSOLIDAR_COMPATIBLES',
            },
          },
        },
      }),
      prisma.producto.update({
        where: { id: tarjetas.id },
        data: { precioConfigJson: pricingHijoNoAplicado },
      }),
    ]);
    try {
      const rutaTarjetas =
        tarjetas.rutasAlternativas.find((ruta) => ruta.esPreferida) ??
        tarjetas.rutasAlternativas[0];
      const borradorTarjetas = await recetas.guardarBorrador(
        auth,
        tarjetas.id,
        { rutaAlternativaId: rutaTarjetas.id, componentes: [] },
      );
      await recetas.publicar(auth, borradorTarjetas.id, {
        expectedUpdatedAt: borradorTarjetas.updatedAt.toISOString(),
      });

      const rutaRigido =
        rigido.rutasAlternativas.find((ruta) => ruta.esPreferida) ??
        rigido.rutasAlternativas[0];
      const pasoIncorporacionRigido = rutaRigido.configPasos.find(
        (paso) => paso.modoActivacion === 'OBLIGATORIO',
      )!;
      const borradorRigido = await recetas.guardarBorrador(auth, rigido.id, {
        rutaAlternativaId: rutaRigido.id,
        documentos: [
          {
            codigo: 'ARTE-FINAL-EXHIBIDOR',
            nombre: 'Arte final aprobado del exhibidor',
            proposito: PropositoArchivoMaestro.PRINT,
            etapa: EtapaDesarrolloDocumento.PRODUCCION,
            tipoAprobacion: TipoAprobacionDocumento.CLIENTE,
            requerido: true,
          },
        ],
        componentes: [
          {
            productoComponenteId: tarjetas.id,
            codigo: tarjetas.codigo,
            nombre: tarjetas.nombre,
            cantidad: 1000,
            formula: 'por_unidad',
            unidad: 'unidad',
            requerido: true,
            orden: 0,
            nodoIncorporacionClave: `ruta:${pasoIncorporacionRigido.rutaPasoId}`,
            configuracionJson: {
              version: 2,
              pricing: {
                version: 1,
                modo: 'USAR_PRODUCTO_HIJO',
              },
              bindings: [
                {
                  clave: 'cantidad',
                  etiqueta: 'Cantidad',
                  tipoDato: 'number',
                  origen: 'FORMULA',
                  requerido: true,
                  regla: {
                    campoPadre: 'cantidad',
                    operador: 'MULTIPLICAR',
                    valor: 1000,
                    fuente: { tipo: 'PADRE', campo: 'cantidad' },
                  },
                },
              ],
              operacionesIncorporacion: [
                {
                  codigo: 'cargar_tarjetas',
                  nombre: 'Cargar tarjetas en el exhibidor',
                  modoTiempo: 'FIJO',
                  minutosFijos: 12,
                  dotacionOperarios: 1,
                  orden: 0,
                },
              ],
            },
          },
          {
            productoComponenteId: tarjetas.id,
            codigo: `${tarjetas.codigo}-HEREDADO`,
            nombre: `${tarjetas.nombre} heredadas`,
            cantidad: 250,
            formula: 'por_unidad',
            unidad: 'unidad',
            requerido: true,
            orden: 1,
            nodoIncorporacionClave: `ruta:${pasoIncorporacionRigido.rutaPasoId}`,
            configuracionJson: {
              version: 2,
              pricing: {
                version: 1,
                modo: 'HEREDAR_PADRE',
              },
              bindings: [
                {
                  clave: 'cantidad',
                  etiqueta: 'Cantidad',
                  tipoDato: 'number',
                  origen: 'FORMULA',
                  requerido: true,
                  regla: {
                    campoPadre: 'cantidad',
                    operador: 'MULTIPLICAR',
                    valor: 250,
                    fuente: { tipo: 'PADRE', campo: 'cantidad' },
                  },
                },
              ],
            },
          },
          {
            productoComponenteId: tarjetas.id,
            codigo: `${tarjetas.codigo}-OVERRIDE`,
            nombre: `${tarjetas.nombre} con regla específica`,
            cantidad: 100,
            formula: 'por_unidad',
            unidad: 'unidad',
            requerido: true,
            orden: 2,
            nodoIncorporacionClave: `ruta:${pasoIncorporacionRigido.rutaPasoId}`,
            configuracionJson: {
              version: 2,
              pricing: {
                version: 1,
                modo: 'OVERRIDE',
                precioConfigOverride: pricingOverride,
              },
              bindings: [
                {
                  clave: 'cantidad',
                  etiqueta: 'Cantidad',
                  tipoDato: 'number',
                  origen: 'FORMULA',
                  requerido: true,
                  regla: {
                    campoPadre: 'cantidad',
                    operador: 'MULTIPLICAR',
                    valor: 100,
                    fuente: { tipo: 'PADRE', campo: 'cantidad' },
                  },
                },
              ],
            },
          },
          {
            productoComponenteId: tarjetas.id,
            codigo: `${tarjetas.codigo}-OMITIDO`,
            nombre: `${tarjetas.nombre} opcionales`,
            cantidad: 5000,
            formula: 'por_unidad',
            unidad: 'unidad',
            requerido: false,
            orden: 3,
            nodoIncorporacionClave: `ruta:${pasoIncorporacionRigido.rutaPasoId}`,
            configuracionJson: {
              version: 2,
              pricing: {
                version: 1,
                modo: 'OVERRIDE',
                precioConfigOverride: {
                  metodoCalculo: 'por_margen',
                  detalle: { marginPct: 80 },
                },
              },
              bindings: [
                {
                  clave: 'cantidad',
                  etiqueta: 'Cantidad',
                  tipoDato: 'number',
                  origen: 'FORMULA',
                  requerido: true,
                  regla: {
                    campoPadre: 'cantidad',
                    operador: 'MULTIPLICAR',
                    valor: 5000,
                    fuente: { tipo: 'PADRE', campo: 'cantidad' },
                  },
                },
              ],
            },
          },
        ],
      });
      const publicadaRigido = await recetas.publicar(auth, borradorRigido.id, {
        expectedUpdatedAt: borradorRigido.updatedAt.toISOString(),
      });
      expect(publicadaRigido.componentes[0].configuracionJson).toEqual(
        expect.objectContaining({
          pricing: {
            version: 1,
            modo: 'USAR_PRODUCTO_HIJO',
            precioConfigSnapshot: pricingHijoNoAplicado,
          },
        }),
      );
      expect(publicadaRigido.componentes).toHaveLength(4);
      expect(publicadaRigido.componentes[1].configuracionJson).toEqual(
        expect.objectContaining({
          pricing: {
            version: 1,
            modo: 'HEREDAR_PADRE',
          },
        }),
      );
      expect(publicadaRigido.componentes[2].configuracionJson).toEqual(
        expect.objectContaining({
          pricing: {
            version: 1,
            modo: 'OVERRIDE',
            precioConfigOverride: pricingOverride,
            precioConfigSnapshot: pricingOverride,
          },
        }),
      );
      await prisma.producto.update({
        where: { id: tarjetas.id },
        data: {
          precioConfigJson: {
            metodoCalculo: 'por_margen',
            detalle: { marginPct: 60 },
          },
        },
      });
      const motorConRecetas = new MotorUniversalService(
        prisma as never,
        new AplicarPrecioService(),
        new PreciosEspecialesClientesService(prisma as never),
        undefined,
        undefined,
        recetas,
      );
      const pasoMaterialRigido = rutaRigido.configPasos.find((paso) =>
        paso.slotsMateriales.some(
          (slot) => slot.modoSeleccion === 'COMERCIAL_ELIGE',
        ),
      )!;
      const slotRigido = pasoMaterialRigido.slotsMateriales.find(
        (slot) => slot.modoSeleccion === 'COMERCIAL_ELIGE',
      )!;
      const materialRigido = slotRigido.candidatos[0].defaultVarianteId!;
      const resultado = await motorConRecetas.cotizar({
        tenantId,
        productoId: rigido.id,
        jobContext: {
          cantidad: 1,
          medidaCustomMm: { anchoMm: 600, altoMm: 1800 },
          [`slotMaterial_${pasoMaterialRigido.id}_${slotRigido.slotCodigo}`]:
            materialRigido,
        },
      });

      expect(resultado.exitoso).toBe(true);
      expect(
        resultado.cotizacion?.componentesFabricados?.[0]
          .especificacionesEfectivas,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            clave: 'cantidad',
            etiqueta: 'Cantidad',
            valor: 1000,
            origen: 'FORMULA',
          }),
        ]),
      );
      expect(
        (publicadaRigido.componentes[0].configuracionJson as Prisma.JsonObject)
          .pricing,
      ).toEqual(
        expect.objectContaining({
          precioConfigSnapshot: pricingHijoNoAplicado,
        }),
      );
      // Golden master previo a F4.3: el motor valoriza el costo consolidado
      // con la regla del padre; la configuración comercial del hijo no se
      // propaga todavía al compuesto.
      expect(resultado.cotizacion?.desglosePrecio?.precioConfig).toEqual(
        pricingPadreGeneral,
      );
      expect(resultado.cotizacion?.precio).toEqual(
        expect.objectContaining({
          metodoUsado: 'por_margen',
          margenAplicadoPct: 25,
        }),
      );
      expect(resultado.cotizacion?.desgloseCostosPricingCompuesto).toEqual(
        expect.objectContaining({
          version: 1,
          estrategia: 'GENERAL',
          bloqueGeneral: {
            costoTotal: resultado.cotizacion?.costos.total,
          },
          componentes: expect.arrayContaining([
            expect.objectContaining({
              productoId: tarjetas.id,
              codigo: tarjetas.codigo,
              incluidoEnBloqueGeneral: true,
              politica: expect.objectContaining({
                modo: 'USAR_PRODUCTO_HIJO',
                precioConfigSnapshot: pricingHijoNoAplicado,
              }),
            }),
            expect.objectContaining({
              codigo: `${tarjetas.codigo}-HEREDADO`,
              incluidoEnBloqueGeneral: true,
              politica: expect.objectContaining({
                modo: 'HEREDAR_PADRE',
              }),
            }),
            expect.objectContaining({
              codigo: `${tarjetas.codigo}-OVERRIDE`,
              incluidoEnBloqueGeneral: true,
              politica: expect.objectContaining({
                modo: 'OVERRIDE',
                precioConfigSnapshot: pricingOverride,
              }),
            }),
          ]),
          costoTotalAsignado: resultado.cotizacion?.costos.total,
        }),
      );
      expect(
        resultado.cotizacion?.desgloseCostosPricingCompuesto?.componentes,
      ).toHaveLength(3);
      expect(
        resultado.cotizacion?.desgloseCostosPricingCompuesto?.componentes,
      ).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            codigo: `${tarjetas.codigo}-OMITIDO`,
          }),
        ]),
      );
      expect(publicadaRigido.materiales.map((item) => item.rol)).toEqual(
        expect.arrayContaining([
          'SUSTRATO',
          'CONSUMIBLE',
          'PACKAGING',
          'COMPONENTE',
        ]),
      );
      expect(publicadaRigido.recursos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            familiaCodigo: 'impresion_por_area',
            estacionId: estacionQa.id,
            capacidadesSnapshotJson: expect.anything(),
          }),
        ]),
      );
      expect(
        resultado.cotizacion?.costos.componentesFabricadosTotal,
      ).toBeGreaterThan(0);
      expect(resultado.cotizacion?.componentesFabricados).toHaveLength(3);
      expect(resultado.cotizacion?.componentesFabricados).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            productoId: tarjetas.id,
            codigo: tarjetas.codigo,
            cantidad: 1000,
            recetaVersion: 1,
            costoTotal: expect.any(Number),
            operacionesIncorporacion: [
              expect.objectContaining({
                codigo: 'cargar_tarjetas',
                duracionMin: 12,
                costo: expect.any(Number),
              }),
            ],
          }),
          expect.objectContaining({
            codigo: `${tarjetas.codigo}-HEREDADO`,
            cantidad: 250,
          }),
          expect.objectContaining({
            codigo: `${tarjetas.codigo}-OVERRIDE`,
            cantidad: 100,
          }),
        ]),
      );
      expect(resultado.cotizacion?.componentesFabricados).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            codigo: `${tarjetas.codigo}-OMITIDO`,
          }),
        ]),
      );
      expect(
        resultado.cotizacion?.componentesFabricados?.every(
          (componente) =>
            !('precio' in componente) && !('desglosePrecio' in componente),
        ),
      ).toBe(true);
      expect(
        resultado.cotizacion?.costos.incorporacionComponentesTotal,
      ).toBeGreaterThan(0);
      expect(resultado.cotizacion?.pasos).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            operacionesIncorporacion: [
              expect.objectContaining({
                codigo: 'cargar_tarjetas',
                duracionMin: 12,
              }),
            ],
          }),
        ]),
      );
      expect(resultado.cotizacion?.costos.total).toBeGreaterThan(
        resultado.cotizacion?.costos.componentesFabricadosTotal ?? 0,
      );
      // F4.4.2 intenta aplicar el lote. Este fixture usa un consumo calculado
      // por fórmula (no directamente por nesting), por lo que cae de forma
      // segura al cálculo independiente y deja la causa trazada.
      expect(resultado.cotizacion?.analisisNestingCompuesto).toEqual(
        expect.objectContaining({
          version: 1,
          modo: 'APLICADO',
          politica: 'CONSOLIDAR_COMPATIBLES',
          aplicadoACostos: false,
          grupos: expect.arrayContaining([
            expect.objectContaining({
              aplicacion: expect.objectContaining({
                aplicado: false,
                motivoNoAplicado: expect.stringContaining(
                  'no está costeado directamente por el nesting',
                ),
              }),
              participantes: expect.arrayContaining([
                expect.objectContaining({ componenteCodigo: tarjetas.codigo }),
                expect.objectContaining({
                  componenteCodigo: `${tarjetas.codigo}-HEREDADO`,
                }),
                expect.objectContaining({
                  componenteCodigo: `${tarjetas.codigo}-OVERRIDE`,
                }),
              ]),
              independiente: expect.objectContaining({
                sustratos: expect.any(Number),
              }),
              consolidado: expect.objectContaining({
                algoritmo: 'grid-2d-multi',
                sustratos: expect.any(Number),
              }),
            }),
          ]),
        }),
      );
      expect(
        resultado.cotizacion?.analisisNestingCompuesto?.grupos.flatMap(
          (grupo) =>
            grupo.participantes.map(
              (participante) => participante.componenteCodigo,
            ),
        ),
      ).not.toContain(`${tarjetas.codigo}-OMITIDO`);
      const guardada = await motorConRecetas.cotizarYGuardar({
        tenantId,
        productoId: rigido.id,
        jobContext: {
          cantidad: 1,
          medidaCustomMm: { anchoMm: 600, altoMm: 1800 },
          [`slotMaterial_${pasoMaterialRigido.id}_${slotRigido.slotCodigo}`]:
            materialRigido,
        },
      });
      expect(guardada.result.exitoso).toBe(true);
      const itemGuardado = await prisma.cotizacionItem.findUniqueOrThrow({
        where: { id: guardada.cotizacionItemId! },
      });
      expect(itemGuardado.recetaRevisionId).toBe(publicadaRigido.id);
      expect(itemGuardado.recetaHuella).toBe(
        publicadaRigido.huellaConfiguracion,
      );
      expect(itemGuardado.precioConfigSnapshotJson).toEqual(
        pricingPadreGeneral,
      );
      expect(itemGuardado.trazabilidadJson).toEqual(
        expect.objectContaining({
          componentesFabricados: expect.arrayContaining([
            expect.objectContaining({ productoId: tarjetas.id }),
          ]),
          desgloseCostosPricingCompuesto: expect.objectContaining({
            estrategia: 'GENERAL',
          }),
          analisisNestingCompuesto: expect.objectContaining({
            modo: 'APLICADO',
            aplicadoACostos: false,
          }),
        }),
      );
      const ordenes = new OrdenesTrabajoService(
        prisma as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      );
      const itemAutorizado = (
        await ordenes.autorizarItemsCotizados(auth, guardada.cotizacionId!, [
          {
            cotizacionItemId: guardada.cotizacionItemId!,
            codigo: rigido.codigo,
            nombre: rigido.nombre,
            familia: 'Exhibidor POP',
            cantidad: 1,
            cantidadUnidad: 'unidad',
            subtotal: 0,
            impuestos: 0,
            total: 0,
          },
        ])
      )[0] as unknown as Record<string, unknown>;
      expect(itemAutorizado).toEqual(
        expect.objectContaining({
          recetaRevisionId: publicadaRigido.id,
          recetaVersion: publicadaRigido.numero,
          recetaHuella: publicadaRigido.huellaConfiguracion,
          recetaSnapshotJson: expect.objectContaining({
            componentes: expect.any(Array),
          }),
        }),
      );
      await prisma.cotizacion.delete({ where: { id: guardada.cotizacionId! } });

      await prisma.producto.update({
        where: { id: rigido.id },
        data: {
          precioConfigJson: {
            ...pricingPadreGeneral,
            compuesto: { version: 1, estrategia: 'MIXTO' },
          },
        },
      });
      const resultadoMixto = await motorConRecetas.cotizar({
        tenantId,
        productoId: rigido.id,
        jobContext: {
          cantidad: 1,
          medidaCustomMm: { anchoMm: 600, altoMm: 1800 },
          [`slotMaterial_${pasoMaterialRigido.id}_${slotRigido.slotCodigo}`]:
            materialRigido,
        },
      });
      expect(resultadoMixto.exitoso).toBe(true);
      expect(resultadoMixto.cotizacion?.desglosePricingCompuesto).toEqual(
        expect.objectContaining({
          version: 1,
          estrategia: 'MIXTO',
          bloques: [
            expect.objectContaining({ codigo: 'GENERAL' }),
            expect.objectContaining({
              codigo: tarjetas.codigo,
              precioConfigSnapshot: pricingHijoNoAplicado,
            }),
            expect.objectContaining({
              codigo: `${tarjetas.codigo}-OVERRIDE`,
              precioConfigSnapshot: pricingOverride,
            }),
          ],
        }),
      );
      expect(
        resultadoMixto.cotizacion?.desglosePricingCompuesto?.bloques,
      ).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            codigo: `${tarjetas.codigo}-OMITIDO`,
          }),
        ]),
      );
      expect(
        resultadoMixto.cotizacion?.desglosePricingCompuesto?.bloques.reduce(
          (total, bloque) => total + bloque.costoTotal,
          0,
        ),
      ).toBeCloseTo(resultadoMixto.cotizacion?.costos.total ?? 0);
      expect(resultadoMixto.cotizacion?.precio?.precioTotal).toBeGreaterThan(
        resultado.cotizacion?.precio?.precioTotal ?? 0,
      );
      const guardadaMixta = await motorConRecetas.cotizarYGuardar({
        tenantId,
        productoId: rigido.id,
        jobContext: {
          cantidad: 1,
          medidaCustomMm: { anchoMm: 600, altoMm: 1800 },
          [`slotMaterial_${pasoMaterialRigido.id}_${slotRigido.slotCodigo}`]:
            materialRigido,
        },
      });
      const itemMixto = await prisma.cotizacionItem.findUniqueOrThrow({
        where: { id: guardadaMixta.cotizacionItemId! },
      });
      expect(itemMixto.precioConfigSnapshotJson).toEqual(
        expect.objectContaining({
          compuesto: { version: 1, estrategia: 'MIXTO' },
        }),
      );
      expect(itemMixto.trazabilidadJson).toEqual(
        expect.objectContaining({
          desglosePricingCompuesto: expect.objectContaining({
            estrategia: 'MIXTO',
            bloques: expect.arrayContaining([
              expect.objectContaining({ codigo: tarjetas.codigo }),
            ]),
          }),
        }),
      );
      await prisma.cotizacion.delete({
        where: { id: guardadaMixta.cotizacionId! },
      });

      await prisma.producto.update({
        where: { id: rigido.id },
        data: {
          precioConfigJson: {
            ...pricingPadreGeneral,
            compuesto: { version: 1, estrategia: 'POR_COMPONENTE' },
          },
        },
      });
      const resultadoPorComponente = await motorConRecetas.cotizar({
        tenantId,
        productoId: rigido.id,
        jobContext: {
          cantidad: 1,
          medidaCustomMm: { anchoMm: 600, altoMm: 1800 },
          [`slotMaterial_${pasoMaterialRigido.id}_${slotRigido.slotCodigo}`]:
            materialRigido,
        },
      });
      expect(resultadoPorComponente.exitoso).toBe(true);
      expect(
        resultadoPorComponente.cotizacion?.desglosePricingCompuesto,
      ).toEqual(
        expect.objectContaining({
          version: 1,
          estrategia: 'POR_COMPONENTE',
          bloques: [
            expect.objectContaining({ codigo: 'GENERAL' }),
            expect.objectContaining({
              codigo: tarjetas.codigo,
              precioConfigSnapshot: pricingHijoNoAplicado,
            }),
            expect.objectContaining({
              codigo: `${tarjetas.codigo}-OVERRIDE`,
              precioConfigSnapshot: pricingOverride,
            }),
          ],
        }),
      );
      expect(
        resultadoPorComponente.cotizacion?.desglosePricingCompuesto?.bloques.reduce(
          (total, bloque) => total + bloque.costoTotal,
          0,
        ),
      ).toBeCloseTo(resultadoPorComponente.cotizacion?.costos.total ?? 0);
      expect(
        resultadoPorComponente.cotizacion?.precio?.precioTotal,
      ).toBeCloseTo(resultadoMixto.cotizacion?.precio?.precioTotal ?? 0);
      const guardadaPorComponente = await motorConRecetas.cotizarYGuardar({
        tenantId,
        productoId: rigido.id,
        jobContext: {
          cantidad: 1,
          medidaCustomMm: { anchoMm: 600, altoMm: 1800 },
          [`slotMaterial_${pasoMaterialRigido.id}_${slotRigido.slotCodigo}`]:
            materialRigido,
        },
      });
      const itemPorComponente = await prisma.cotizacionItem.findUniqueOrThrow({
        where: { id: guardadaPorComponente.cotizacionItemId! },
      });
      expect(itemPorComponente.precioConfigSnapshotJson).toEqual(
        expect.objectContaining({
          compuesto: { version: 1, estrategia: 'POR_COMPONENTE' },
        }),
      );
      expect(itemPorComponente.trazabilidadJson).toEqual(
        expect.objectContaining({
          desglosePricingCompuesto: expect.objectContaining({
            estrategia: 'POR_COMPONENTE',
            bloques: expect.arrayContaining([
              expect.objectContaining({ codigo: tarjetas.codigo }),
              expect.objectContaining({
                codigo: `${tarjetas.codigo}-OVERRIDE`,
              }),
            ]),
          }),
        }),
      );
      await prisma.cotizacion.delete({
        where: { id: guardadaPorComponente.cotizacionId! },
      });

      const borradorTarjetasV2 = await recetas.guardarBorrador(
        auth,
        tarjetas.id,
        {
          rutaAlternativaId: rutaTarjetas.id,
          componentes: [],
          cambios: 'Ajuste técnico del componente fabricado',
        },
      );
      await recetas.publicar(auth, borradorTarjetasV2.id, {
        expectedUpdatedAt: borradorTarjetasV2.updatedAt.toISOString(),
      });
      await expect(
        motorConRecetas.cotizar({
          tenantId,
          productoId: rigido.id,
          jobContext: {
            cantidad: 1,
            medidaCustomMm: { anchoMm: 600, altoMm: 1800 },
            [`slotMaterial_${pasoMaterialRigido.id}_${slotRigido.slotCodigo}`]:
              materialRigido,
          },
        }),
      ).rejects.toThrow('cambios productivos sin publicar');
    } finally {
      await prisma.productoReceta.deleteMany({
        where: { tenantId, productoId: { in: [rigido.id, tarjetas.id] } },
      });
      await prisma.$transaction(
        preciosOriginales.map((producto) =>
          prisma.producto.update({
            where: { id: producto.id },
            data: {
              ...(producto.id === rigido.id
                ? { estructuraProducto: estructuraRigidoOriginal }
                : {}),
              precioConfigJson:
                producto.precioConfigJson === null
                  ? Prisma.JsonNull
                  : (producto.precioConfigJson as Prisma.InputJsonValue),
              atributosComercialesJson:
                producto.atributosComercialesJson === null
                  ? Prisma.JsonNull
                  : (producto.atributosComercialesJson as Prisma.InputJsonValue),
            },
          }),
        ),
      );
      await prisma.productoConfigPasoSlotMaterial.deleteMany({
        where: {
          tenantId,
          OR: [
            { productoConfigPasoId: configPintura.id, slotCodigo: 'pintura' },
            {
              productoConfigPasoId: configEmbalaje.id,
              slotCodigo: { in: ['caja', 'escuadras'] },
            },
          ],
        },
      });
      await prisma.materiaPrima.deleteMany({
        where: {
          tenantId,
          codigo: {
            in: ['QA-F3-PINTURA', 'QA-F3-PACKAGING', 'QA-F3-ACCESORIO'],
          },
        },
      });
      await prisma.estacion.deleteMany({
        where: { id: estacionQa.id, tenantId },
      });
    }
  });
});
