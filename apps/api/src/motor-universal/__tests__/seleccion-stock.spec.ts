import { Prisma } from '@prisma/client';
import { MotorUniversalService } from '../motor.service';
import {
  DisponibilidadCotizacion,
  contextoStockCotizacion,
  necesidadesDePasos,
} from '../disponibilidad-materiales';
import type {
  CotizacionResultado,
  ErrorMotor,
  JobContext,
  PasoCargado,
  PasoEjecutado,
} from '../tipos';
import type { PrismaService } from '../../prisma/prisma.service';

const variante = (id: string) => ({
  id,
  sku: id,
  materiaPrimaNombre: 'Acrílico',
  materiaPrimaTemplateId: 'sustrato_rigido_v1',
  subfamilia: 'SUSTRATO_RIGIDO',
  unidadStock: 'M2',
  precioReferencia: id === 'a' ? 100 : 200,
  contextoUnidades: {
    unidadStock: 'M2',
    unidadUso: 'M2',
    unidadCompra: 'PLACA',
    unidadPrecio: 'M2',
    templateId: 'sustrato_rigido_v1',
    atributos: { anchoMm: 1220, altoMm: 1220 },
  },
  atributosVarianteJson: { anchoMm: 1220, altoMm: 1220 },
});
function paso(politica = 'SOLO_DISPONIBLES'): PasoCargado {
  return {
    rutaPasoId: 'corte',
    rutaPasoOrden: 1,
    configPasoId: 'corte',
    familiaCodigo: 'corte_laser',
    mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
    modoActivacion: 'OBLIGATORIO',
    modoTiempo: 'T-4',
    tiempoFijoOverrideMin: 0,
    setupOverrideMin: 0,
    cleanupOverrideMin: 0,
    paramsPasoJson: {
      nestingConfig: {
        margins: { leftMm: 5, rightMm: 5, topMm: 5, bottomMm: 5 },
        allowRotation: true,
      },
    },
    multiplicadoresActivos: [],
    cargosDirectosPaso: [],
    maquinasCandidatas: [],
    slots: [
      {
        slotCodigo: 'sustrato_corte',
        modoSeleccion: 'MOTOR_ELIGE_AUTO',
        politicaStock: politica,
        criterioMotorAuto: 'MENOR_COSTO',
        formula: 'por_unidad_productiva',
        aplicaMultiCaras: false,
        mermaAdicionalPct: 0,
        candidatos: [
          {
            materiaPrimaId: 'acrilico',
            defaultVarianteId: 'a',
            variantes: [{ varianteId: 'a' }, { varianteId: 'b' }],
          },
        ],
      },
    ],
    maquina: {
      id: 'laser',
      nombre: 'Láser',
      plantilla: 'CORTE_LASER',
      anchoUtil: 1300,
      largoUtil: 1300,
      parametrosTecnicosJson: {},
      consumibles: [],
      componentesDesgaste: [],
    },
  } as unknown as PasoCargado;
}
function fixture(
  saldos: Record<string, number> = { a: 0, b: 10 },
  reservado = 0,
  previos: ConstructorParameters<typeof DisponibilidadCotizacion>[2] = [],
) {
  const tx = {
    materiaPrimaVariante: {
      findFirst: jest
        .fn()
        .mockResolvedValue({
          unidadStock: 'M2',
          materiaPrima: { unidadStock: 'M2' },
        }),
    },
    stockMateriaPrimaVariante: {
      findMany: jest.fn(async ({ where }) => [
        {
          ubicacionId: 'deposito',
          cantidadDisponible: new Prisma.Decimal(saldos[where.varianteId] ?? 0),
        },
      ]),
    },
    reservaMaterialOt: {
      findMany: jest.fn(async ({ where }) => [
        {
          ubicacionId: 'deposito',
          cantidad: new Prisma.Decimal(reservado),
          necesidad: { varianteId: where.necesidad.varianteId.in[0] },
        },
      ]),
    },
  };
  const prisma = {
    $transaction: jest.fn((fn) => fn(tx)),
  } as unknown as PrismaService;
  const stock = new DisponibilidadCotizacion(prisma, 'tenant', previos);
  const motor = Object.create(MotorUniversalService.prototype) as any;
  motor.capacidadesPlan = { puedeOperar: jest.fn().mockResolvedValue(true) };
  motor.cargarVariantePorId = jest.fn(async (_tenant, id) => variante(id));
  const contexto = (): JobContext => ({
    cantidad: 1,
    modoCotizacionVectorial: 'medidas',
    piezas: [{ anchoMm: 200, altoMm: 300, cantidad: 1 }],
  });
  async function ejecutar(p = paso(), jc = contexto()) {
    const errores: ErrorMotor[] = [];
    const resultado: PasoEjecutado = await contextoStockCotizacion.run(
      stock,
      () => motor.ejecutarPaso('tenant', p, jc, errores, new Map(), '2026-09'),
    );
    return { resultado, errores };
  }
  return { stock, ejecutar, motor, prisma, tx, contexto };
}

describe('Selección automática según stock libre real', () => {
  it('descarta la placa agotada y cuenta la placa entera aunque cotice por m² útil', async () => {
    const f = fixture();
    const { resultado, errores } = await f.ejecutar();
    expect(errores.filter((e) => e.severidad === 'ERROR')).toEqual([]);
    expect(resultado.materiales?.[0].materialVarianteId).toBe('b');
    expect(resultado.materiales?.[0].cantidad).toBeCloseTo(0.06);
    expect(necesidadesDePasos([resultado])[0].cantidad).toBeCloseTo(1.4884);
    expect(resultado.materiales?.[0].seleccionStock?.estado).toBe('disponible');
    expect(f.tx.stockMateriaPrimaVariante.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant' }),
      }),
    );
  });
  it('descarta existencia positiva insuficiente', async () => {
    expect(
      (await fixture({ a: 0.1, b: 10 }).ejecutar()).resultado.materiales?.[0]
        .materialVarianteId,
    ).toBe('b');
  });
  it('descuenta reservas de otras OTs', async () => {
    expect(
      (await fixture({ a: 2, b: 10 }, 1).ejecutar()).resultado.materiales?.[0]
        .materialVarianteId,
    ).toBe('b');
  });
  it('mantiene TODAS sin consultar stock', async () => {
    const f = fixture({ a: 0, b: 0 });
    const { resultado, errores } = await f.ejecutar(paso('TODAS'));
    expect(errores.filter((e) => e.severidad === 'ERROR')).toEqual([]);
    expect(resultado.materiales?.[0].materialVarianteId).toBe('a');
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });
  it('priorizar permite cotizar con reposición y avisa', async () => {
    const { resultado, errores } = await fixture({ a: 0, b: 0 }).ejecutar(
      paso('PREFERIR_DISPONIBLES'),
    );
    expect(resultado.materiales?.[0].materialVarianteId).toBe('a');
    expect(errores).toContainEqual(
      expect.objectContaining({
        codigo: 'material_auto_requiere_reposicion',
        severidad: 'WARNING',
      }),
    );
  });
  it('sólo disponibles pide decisión si ninguna alcanza', async () => {
    expect((await fixture({ a: 0, b: 0 }).ejecutar()).errores).toContainEqual(
      expect.objectContaining({
        codigo: 'material_auto_sin_stock_suficiente',
        severidad: 'ERROR',
      }),
    );
  });
  it('recomienda con el criterio del motor, sin usar el predeterminado ni autorizar la reposición', async () => {
    const f = fixture({ a: 0, b: 0 });
    f.motor.cargarVariantePorId.mockImplementation(async (_tenant: string, id: string) => ({
      ...variante(id), precioReferencia: id === 'b' ? 50 : 100,
    }));
    const p = paso();
    p.configPasoId = 'config-corte';
    const { resultado, errores } = await f.ejecutar(p);
    expect(resultado.materiales ?? []).toEqual([]);
    expect(errores).toContainEqual(expect.objectContaining({
      codigo: 'material_auto_sin_stock_suficiente',
      severidad: 'ERROR',
      contexto: expect.objectContaining({
        configPasoId: 'config-corte', slotCodigo: 'sustrato_corte', recomendadoVarianteId: 'b',
        alternativas: expect.arrayContaining([expect.objectContaining({ id: 'b', alcanza: false })]),
      }),
    }));
  });
  it('permite elegir explícitamente un material agotado', async () => {
    const f = fixture({ a: 0, b: 0 });
    const { resultado, errores } = await f.ejecutar(paso(), {
      ...f.contexto(),
      slotMateriales: { corte_sustrato_corte: 'a' },
    });
    expect(errores.filter((e) => e.severidad === 'ERROR')).toEqual([]);
    expect(resultado.materiales?.[0].materialVarianteId).toBe('a');
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });
  it('no usa dos veces el mismo stock entre pasos/componentes', async () => {
    const f = fixture({ a: 1.5, b: 2 });
    expect(
      (await f.ejecutar()).resultado.materiales?.[0].materialVarianteId,
    ).toBe('a');
    expect(
      (await f.ejecutar()).resultado.materiales?.[0].materialVarianteId,
    ).toBe('b');
  });
  it('incluye demanda de otros ítems de la propuesta', async () => {
    const f = fixture({ a: 2, b: 3 }, 0, [
      { varianteId: 'a', cantidad: 1, unidad: 'm2' },
    ]);
    expect(
      (await f.ejecutar()).resultado.materiales?.[0].materialVarianteId,
    ).toBe('b');
  });
  it('incluye merma', async () => {
    const f = fixture({ a: 1.5, b: 3 });
    const p = paso();
    p.slots[0].mermaAdicionalPct = 10;
    const { resultado } = await f.ejecutar(p);
    expect(resultado.materiales?.[0].materialVarianteId).toBe('b');
    expect(necesidadesDePasos([resultado])[0].cantidad).toBeGreaterThan(1.4884);
  });
  it('no considera unidades o cantidades desconocidas como disponibles', async () => {
    const f = fixture({ a: 100, b: 100 }, 0, [
      { varianteId: 'a', cantidad: null, unidad: 'm2' },
    ]);
    expect(
      (await f.ejecutar()).resultado.materiales?.[0].materialVarianteId,
    ).toBe('b');
    expect((await f.stock.evaluarCantidad('b', 1, 'kg')).alcanza).toBe(false);
  });
  it('verifica el consumo final conjunto', async () => {
    const f = fixture({ a: 1.5, b: 0 });
    const { resultado } = await f.ejecutar();
    const total = {
      pasos: [resultado],
      componentesFabricados: [
        { codigo: 'extra', pasos: [structuredClone(resultado)] },
      ],
    } as unknown as CotizacionResultado;
    expect(await f.stock.validar(total)).toContainEqual(
      expect.objectContaining({
        codigo: 'material_auto_sin_stock_suficiente',
        contexto: expect.objectContaining({
          configPasoId: 'corte', slotCodigo: 'sustrato_corte', recomendadoVarianteId: 'a',
          alternativas: expect.arrayContaining([expect.objectContaining({ id: 'a', alcanza: false, necesario: 2.9768 })]),
        }),
      }),
    );
  });
  it('elige un ancho de rollo con stock y calcula su largo físico con merma', async () => {
    const f = fixture({ a: 0, b: 10 });
    f.motor.cargarVariantePorId.mockImplementation(
      async (_t: string, id: string) => {
        const attrs = {
          anchoMm: id === 'a' ? 1520 : 1370,
          largoRolloMm: 50000,
        };
        return {
          ...variante(id),
          materiaPrimaNombre: 'Vinilo',
          materiaPrimaTemplateId: 'sustrato_rollo_flexible_v1',
          subfamilia: 'SUSTRATO_ROLLO_FLEXIBLE',
          atributosVarianteJson: attrs,
          contextoUnidades: {
            unidadStock: 'M2',
            unidadUso: 'M2',
            unidadCompra: 'ROLLO',
            templateId: 'sustrato_rollo_flexible_v1',
            atributos: attrs,
          },
        };
      },
    );
    const p = paso();
    p.familiaCodigo = 'impresion_por_area';
    p.mecanismoCantidad = 'CALCULADO_POR_PASO';
    p.slots[0].slotCodigo = 'sustrato_principal';
    p.slots[0].mermaAdicionalPct = 10;
    p.paramsPasoJson = {
      nestingConfig: {
        algorithm: 'maxrects-rollo',
        margins: {
          leftMm: 10,
          rightMm: 10,
          startMm: 100,
          endMm: 100,
          topMm: 100,
          bottomMm: 100,
        },
        allowRotation: false,
      },
    };
    Object.assign(p.maquina!, {
      plantilla: 'IMPRESORA_GRAN_FORMATO_POR_AREA',
      anchoUtil: 1800,
      parametrosTecnicosJson: { geometria: 'ROLLO', anchoMaxRolloMm: 1800 },
    });
    const { resultado, errores } = await f.ejecutar(p, {
      cantidad: 1,
      modoColor_corte: 'SIN_IMPRESION',
      piezas: [{ anchoMm: 1250, altoMm: 800, cantidad: 1 }],
    });
    expect(errores.filter((e) => e.severidad === 'ERROR')).toEqual([]);
    expect(resultado.materiales?.[0].materialVarianteId).toBe('b');
    expect(resultado.nestingResult?.substrates[0]).toMatchObject({
      kind: 'roll',
      widthMm: 1370,
    });
    expect(necesidadesDePasos([resultado])[0].cantidad).toBeCloseTo(
      0.8 * 1.37 * 1.1,
    );
    expect(
      resultado.materiales?.[0].opcionesNestingRollo?.map(
        (v) => v.materialVarianteId,
      ),
    ).toEqual(['b']);
  });

  it('requiere existencias habilitadas', async () => {
    const f = fixture();
    f.motor.capacidadesPlan.puedeOperar.mockResolvedValue(false);
    expect((await f.ejecutar()).errores).toContainEqual(
      expect.objectContaining({ codigo: 'seleccion_stock_no_disponible' }),
    );
  });
});
