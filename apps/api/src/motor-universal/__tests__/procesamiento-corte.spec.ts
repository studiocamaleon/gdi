import { registrarCortesDelLote } from '../registrar-corte-lote';
import { demandaDesdeTiempo } from '../../eta/motor/demanda-humana';
import { consolidarCortesRegistrados } from '../consolidar-cortes-registrados';
import { escenarioHerramientas } from './fixtures/operaciones-corte';
import {
  recalcularOperacionesCongeladas,
  prepararProcesamientoCorte,
  calcularProcesamientoCorte,
  type PlanOperacionesCorte,
} from '../procesamiento-corte';
import {
  aplicarRepartoCorte,
  planificarRepartoCorte,
} from '../repartir-operaciones-corte';
import { MotorUniversalService } from '../motor.service';
import type { ErrorMotor } from '../tipos';
import {
  runNestingForPaso,
  type NestingDispatchOpts,
} from '../nesting-dispatcher';
import { resolverProblemaNestingIrregular } from '../geometria-vectorial/contrato-nesting';
import {
  erroresConfiguracionCorte,
  erroresPerfilCorte,
} from '../../maquinaria/procesamiento-corte';

describe('cotización por recorridos, herramientas y material', () => {
  it('conserva hendido y medio corte al enviar una interpretación individual al worker', async () => {
    const s = escenarioHerramientas(2);
    const pieza = s.ctx.geometriaVectorial!.piezas[0];
    // El fixture de tiempos no necesita una matriz; el traslado real del
    // nesting sí conserva las coordenadas de la interpretación original.
    pieza.fabricacion!.transformacion = [1, 0, 0, 1, 0, 0];
    const ctx = {
      ...s.ctx,
      modoCotizacionVectorial: 'svg' as const,
      disenoVectorialFuente: {
        schemaVersion: 2 as const,
        nombreArchivo: 'troquel.dxf',
        svg: '<svg viewBox="0 0 100 100"><path d="M0 0H100V100H0Z"/></svg>',
        anchoFinalMm: 100,
      },
      geometriaVectorial: {
        ...s.ctx.geometriaVectorial!,
        hashFuente: 'troquel-interpretado',
        piezas: [
          {
            ...pieza,
            anchoMm: 100,
            altoMm: 100,
            areaMm2: 10000,
            perimetroMm: 400,
          },
        ],
      },
    };
    s.paso.paramsPasoJson = {
      ...s.paso.paramsPasoJson,
      usarDisenoVectorial: true,
    };
    s.paso.slots = [];
    s.paso.maquina!.anchoUtil = 1000;
    s.paso.maquina!.largoUtil = 1000;
    const material = {
      ...s.material,
      subfamilia: 'SUSTRATO_RIGIDO',
      precioReferencia: 100,
      atributosVarianteJson: {
        ...s.material.atributosVarianteJson,
        anchoMm: 1000,
        altoMm: 1000,
      },
    };
    const worker = {
      resolverProblemaParaCotizacion: jest.fn(async ({ problema }) =>
        resolverProblemaNestingIrregular(problema),
      ),
      resolverParaCotizacion: jest.fn(async () => {
        throw new Error('El SVG de la silueta perdió sus operaciones');
      }),
    };
    const motor = Object.assign(
      Object.create(MotorUniversalService.prototype),
      {
        analisisVectorialAsync: worker,
        capacidadesPlan: { exigir: async () => undefined },
      },
    ) as { opcionesNesting: (tenantId: string) => NestingDispatchOpts };
    const plan = await runNestingForPaso(
      s.paso,
      ctx,
      material,
      motor.opcionesNesting('tenant'),
    );
    const calculado = calcularProcesamientoCorte(
      s.paso,
      ctx,
      prepararProcesamientoCorte(s.paso, ctx, material),
      plan,
    );
    expect(calculado.operaciones.map((o) => [o.operacion, o.metros])).toEqual(
      s.calcular().operaciones.map((o) => [o.operacion, o.metros]),
    );
    expect(worker.resolverProblemaParaCotizacion).toHaveBeenCalledTimes(1);
    expect(worker.resolverParaCotizacion).not.toHaveBeenCalled();
  });
  it('estima placas totales, pasadas y entradas sin multiplicarlas por la cantidad comercial', () => {
    const s = escenarioHerramientas();
    s.perfiles[0].detalleJson = {
      ...s.perfiles[0].detalleJson,
      entradaSeg: 3,
    } as (typeof s.perfiles)[0]['detalleJson'];
    const ctx = {
      cantidad: 50,
      modoCotizacionVectorial: 'placas' as const,
      placasVectorialesManuales: 2,
      metrosCortePorPlacaVectorial: 15,
      entradasCortePorPlacaVectorial: 4,
    };
    const plan: PlanOperacionesCorte = {
      algorithm: 'manual-vector-estimate-v1',
      placements: [],
      substrates: [{ kind: 'sheet', widthMm: 1000, heightMm: 1000, count: 2 }],
    };
    const preparar = () => prepararProcesamientoCorte(s.paso, ctx, s.material);
    const r = calcularProcesamientoCorte(s.paso, ctx, preparar(), plan);
    expect(r.placas).toBe(2);
    expect(r.operaciones[0]).toMatchObject({
      metros: 30,
      metrosProcesados: 60,
      entradas: 8,
    });
    expect(r.recorridoMin).toBeCloseTo(30.8);
    expect(() =>
      prepararProcesamientoCorte(
        s.paso,
        { ...ctx, entradasCortePorPlacaVectorial: undefined },
        s.material,
      ),
    ).toThrow(/entradas de corte/);
    expect(() =>
      calcularProcesamientoCorte(
        s.paso,
        { ...ctx, placasVectorialesManuales: 3 },
        preparar(),
        plan,
      ),
    ).toThrow(/placas declaradas/);
  });
  it('consolida corte rectangular con los perfiles congelados y rechaza la pérdida de piezas', () => {
    const s = escenarioHerramientas(2);
    const ctx = {
      cantidad: 2,
      modoCotizacionVectorial: 'medidas' as const,
      piezas: [{ anchoMm: 100, altoMm: 100, cantidad: 2 }],
    };
    const plan: PlanOperacionesCorte = {
      ...s.plan,
      algorithm: 'grid-2d-single',
      placements: s.plan.placements.map((p) => ({ ...p, meta: undefined })),
    };
    const original = calcularProcesamientoCorte(
      s.paso,
      ctx,
      prepararProcesamientoCorte(s.paso, ctx, s.material),
      plan,
    );
    expect(original.operaciones[0].metros).toBeCloseTo(0.8);
    expect(
      recalcularOperacionesCongeladas([original], plan).operaciones,
    ).toEqual(original.operaciones);
    expect(() =>
      recalcularOperacionesCongeladas([original], {
        ...plan,
        placements: plan.placements.slice(0, 1),
      }),
    ).toThrow(/demanda/);
  });
  it('elegir archivo requiere geometría aunque queden medidas de una cotización anterior', () => {
    const s = escenarioHerramientas();
    expect(() =>
      prepararProcesamientoCorte(
        s.paso,
        {
          cantidad: 1,
          modoCotizacionVectorial: 'svg',
          piezas: [{ anchoMm: 100, altoMm: 100, cantidad: 1 }],
        },
        s.material,
      ),
    ).toThrow(/vectoriales/);
  });
  it.each([1, 10, 50])(
    'mide cada entidad una vez para %i copias sin cobrar referencias ni depender del nombre de capa',
    (cantidad) => {
      const s = escenarioHerramientas(cantidad),
        r = s.calcular();
      expect(r.operaciones.map((o) => o.operacion)).toEqual([
        'HENDIDO',
        'CORTE_PARCIAL',
        'CORTE_COMPLETO',
      ]);
      r.operaciones.forEach((o, i) =>
        expect(o.metros).toBeCloseTo([0.2, 0.1, 0.4][i] * cantidad),
      );
      expect(r.recorridoMin).toBeCloseTo(0.55 * cantidad);
      expect(r.desgasteCosto).toBeCloseTo(1.8 * cantidad);
      expect(r.fasesRun!.reduce((n, f) => n + f.minutos, 0)).toBeCloseTo(
        r.runMin,
      );
      expect(
        r
          .fasesRun!.filter((f) => !f.operario)
          .reduce((n, f) => n + f.minutos, 0),
      ).toBeCloseTo(r.recorridoMin);
      expect(
        r
          .fasesRun!.filter((f) => f.operario)
          .reduce((n, f) => n + f.minutos, 0),
      ).toBeCloseTo(r.manejoMin + r.ajustesMin + r.cambiosMin);
      expect(
        r.operaciones
          .flatMap((o) => o.fuentes)
          .every(
            (f) =>
              f.geometriaId === 'geom-1' && f.archivoHash === 'hash-original',
          ),
      ).toBe(true);
    },
  );
  it('cuenta cambios físicos por placa y no confunde dos recetas de la misma cuchilla con herramientas distintas', () => {
    const s = escenarioHerramientas(2, 2);
    expect(s.calcular()).toMatchObject({
      cambiosHerramienta: 0,
      activaciones: 4,
      manejoMin: 3,
    });
    s.configuracion.posiciones = 1;
    s.configuracion.herramientas[1].posicion = 1;
    s.configuracion.herramientas[1].montada = false;
    expect(s.calcular()).toMatchObject({
      cambiosHerramienta: 4,
      cambiosMin: 12.04,
    });
  });
  it('la velocidad efectiva no vuelve a multiplicar las pasadas pero sí registra el desgaste físico', () => {
    const s = escenarioHerramientas();
    s.perfiles[0].detalleJson.modoVelocidad = 'PROCESO_COMPLETO';
    expect(s.calcular().recorridoMin).toBeCloseTo(0.35);
    expect(s.calcular().desgasteCosto).toBeCloseTo(1.8);
  });
  it('descuenta líneas comunes sólo del corte completo', () => {
    const s = escenarioHerramientas();
    s.plan.commonLine = {
      aplicado: true,
      ahorroRecorridoMm: 100,
    } as typeof s.plan.commonLine;
    expect(s.calcular().recorridoMin).toBeCloseTo(0.45);
    expect(s.calcular().operaciones.map((o) => o.ahorroRecorridoM)).toEqual([
      0, 0, 0.1,
    ]);
  });
  it.each(['material', 'espesor', 'ambiguedad', 'herramienta'] as const)(
    'bloquea una selección incompatible: %s',
    (caso) => {
      const s = escenarioHerramientas();
      if (caso === 'material') s.material.materiaPrimaId = 'ajeno';
      if (caso === 'espesor') s.material.atributosVarianteJson.espesorMm = 20;
      if (caso === 'ambiguedad')
        s.paso.perfilesDisponibles!.push({
          ...s.paso.perfilesDisponibles![0],
          id: 'duplicado',
        });
      if (caso === 'herramienta')
        s.configuracion.herramientas[0].activo = false;
      expect(() => s.calcular()).toThrow();
    },
  );
  it('una elección explícita resuelve perfiles solapados y sigue validando el material', () => {
    const s = escenarioHerramientas();
    s.paso.perfilesDisponibles!.push({
      ...s.paso.perfilesDisponibles![0],
      id: 'alternativo',
    });
    s.paso.paramsPasoJson = {
      cotizarOperacionesVectoriales: true,
      perfilesOperacionCorte: { CORTE_COMPLETO: 'alternativo' },
    };
    expect(
      s.calcular().operaciones.find((o) => o.operacion === 'CORTE_COMPLETO')
        ?.perfilId,
    ).toBe('alternativo');
    s.material.materiaPrimaId = 'ajeno';
    expect(() => s.calcular()).toThrow();
  });
  it.each(['autonoma', 'con_operario', null] as const)(
    'el motor conserva preparación, costo y redondeo con operación %s',
    (operacionMaquina) => {
      const s = escenarioHerramientas(2);
      s.paso.maquina!.parametrosTecnicosJson = {
        ...s.paso.maquina!.parametrosTecnicosJson,
        operacionMaquina,
      };
      s.paso.procesamientoCorteCosteado = s.calcular();
      const motor = Object.create(
        MotorUniversalService.prototype,
      ) as MotorUniversalService;
      const errores: ErrorMotor[] = [];
      const t = motor['calcularTiempo'](
        s.paso,
        s.ctx,
        errores,
        new Map([['cc', { tarifa: 60 }]]),
        '2026-09',
      );
      expect(errores).toEqual([]);
      expect(t).toMatchObject({
        setupMin: 5,
        cleanupMin: 2,
        totalMin: 11,
        costo: 11,
      });
      expect(t.runMin).toBeCloseTo(3.22);
      expect(t.demandaHumana!.verificada).toBe(operacionMaquina !== null);
      expect(
        t
          .demandaHumana!.fases.filter(
            (f: { personas: number }) => f.personas === 0,
          )
          .reduce((n: number, f: { minutos: number }) => n + f.minutos, 0),
      ).toBeCloseTo(operacionMaquina === 'autonoma' ? 1.1 : 0);
    },
  );
  it('rechaza planes que pierden piezas y conserva la cotización frente a ediciones posteriores', () => {
    const s = escenarioHerramientas(2);
    const original = s.calcular();
    s.configuracion.herramientas[0].nombre = 'Nombre posterior';
    s.perfiles[0].productivityValue = 900;
    const r = recalcularOperacionesCongeladas([original], s.plan);
    expect(r.operaciones).toEqual(original.operaciones);
    expect(original.configuracion.herramientas[0].nombre).toBe(
      'Cuchilla de prueba',
    );
    s.plan.placements.pop();
    expect(() => recalcularOperacionesCongeladas([original], s.plan)).toThrow(
      /demanda/,
    );
  });
  it('consolida dos trabajos sobre una placa sin duplicar preparación, carga, ajustes o redondeo', () => {
    const a = escenarioHerramientas(),
      b = escenarioHerramientas();
    const pasos = [a.ejecutado(), b.ejecutado()];
    const plan = {
      ...a.plan,
      placements: [...a.plan.placements, ...b.plan.placements],
    };
    const lote = recalcularOperacionesCongeladas(
      pasos.map((p) => p.tiempo!.procesamientoCorte!),
      plan,
    );
    const repartos = planificarRepartoCorte(lote, pasos, [1, 1], 'lote');
    pasos.forEach((p, i) => {
      p.costoTotal += aplicarRepartoCorte(p, repartos[i]);
    });
    expect(pasos.reduce((s, p) => s + p.tiempo!.totalMin, 0)).toBe(11);
    expect(pasos.reduce((s, p) => s + p.costoTotal, 0)).toBeCloseTo(14.6);
    expect(pasos[0].tiempo!.procesamientoCorte!.participacion?.porcentaje).toBe(
      50,
    );
    for (const paso of pasos) {
      const demanda = demandaDesdeTiempo(paso.tiempo)!;
      expect(demanda.verificada).toBe(true);
      expect(demanda.fases.reduce((n, f) => n + f.minutos, 0)).toBeCloseTo(
        paso.tiempo!.totalMin,
      );
    }
  });
  it('valida capacidades y evita sumar maniobras dos veces con velocidad efectiva', () => {
    const s = escenarioHerramientas();
    expect(erroresConfiguracionCorte(s.configuracion, 'MESA_DE_CORTE')).toEqual(
      [],
    );
    expect(
      erroresConfiguracionCorte(s.configuracion, 'CORTE_LASER').length,
    ).toBeGreaterThan(0);
    expect(
      erroresPerfilCorte(
        {
          ...s.perfiles[0],
          detalleJson: {
            ...s.perfiles[0].detalleJson,
            modoVelocidad: 'PROCESO_COMPLETO',
            entradaSeg: 3,
          },
        },
        s.configuracion,
      ),
    ).toContain(
      'La velocidad efectiva ya incluye maniobras; quitá el tiempo adicional por entrada.',
    );
  });
});

describe('tandas de corte registradas en la impresión', () => {
  const preparar = () => {
    const s = escenarioHerramientas();
    const componentes = ['A', 'B'].map((codigo) => {
      const paso = s.ejecutado();
      paso.rutaPasoId = `corte-${codigo}`;
      paso.nestingResult!.layoutRegistradoLoteId = 'impresion';
      paso.nestingResult!.placements[0].meta = {
        ...(paso.nestingResult!.placements[0].meta as object),
        componenteCodigo: codigo,
      };
      return {
        codigo,
        productoId: 'producto',
        politicaEjecucion: 'INDEPENDIENTE',
        cantidad: 1,
        costoTotal: paso.costoTotal,
        costoUnitario: paso.costoTotal,
        pasos: [paso],
      };
    }) as import('../tipos').ComponenteFabricadoCosteado[];
    const origen = {
      id: 'impresion',
      materialVarianteId: 'variante',
      materialNombre: 'Corrugado',
      participantes: componentes.map((c) => ({
        componenteCodigo: c.codigo,
        areaUtilMm2: 10000,
      })),
      nestingResult: {
        ...componentes[0].pasos![0].nestingResult!,
        placements: componentes.flatMap(
          (c) => c.pasos![0].nestingResult!.placements,
        ),
      },
    } as import('../tipos').LoteNestingCompuestoSnapshot;
    return { componentes, origen };
  };
  it('cobra un único trabajo con los recorridos de todos los participantes y conserva las herramientas en el lote', () => {
    const { componentes, origen } = preparar();
    const [grupo] = consolidarCortesRegistrados(origen, componentes);
    expect(grupo.lote!.duracionEstimadaMin).toBe(11);
    expect(grupo.lote!.procesamientoCorte!.runMin).toBeCloseTo(3.22);
    expect(grupo.lote!.costoTotalAsignado).toBeCloseTo(14.6);
    expect(componentes.reduce((s, c) => s + c.costoTotal, 0)).toBeCloseTo(14.6);
  });
  it('conserva dos operaciones separadas si cambia una receta, aunque coincidan máquina y perfil principal', () => {
    const { componentes, origen } = preparar();
    componentes[1].pasos![0].tiempo!.procesamientoCorte!.firmaConfiguracion =
      'otra-receta';
    const antes = JSON.stringify(componentes);
    expect(consolidarCortesRegistrados(origen, componentes)).toEqual([]);
    expect(JSON.stringify(componentes)).toBe(antes);
  });
});

it('recalcula carga, registro y ajustes cuando la impresión distribuye el corte entre más placas', () => {
  const s = escenarioHerramientas(2),
    paso = s.ejecutado();
  paso.nestingResult!.placements.forEach(
    (p) => (p.meta = { ...(p.meta as object), layoutHeredadoDe: 'print' }),
  );
  const componente = {
    codigo: 'A',
    productoId: 'producto',
    politicaEjecucion: 'INDEPENDIENTE',
    cantidad: 2,
    costoTotal: paso.costoTotal,
    costoUnitario: paso.costoTotal / 2,
    pasos: [paso],
  } as import('../tipos').ComponenteFabricadoCosteado;
  const placements = paso.nestingResult!.placements.map((p, i) => ({
    ...p,
    substrateIndex: i,
  }));
  const lote = {
    id: 'impresion',
    participantes: [
      { componenteCodigo: 'A', rutaPasoId: 'print', pasoClave: 'cfg-print' },
    ],
    nestingResult: {
      ...paso.nestingResult!,
      cantidadCalculada: 2,
      substrates: [{ kind: 'sheet', count: 2, widthMm: 1000, heightMm: 1000 }],
      placements,
      solucionNesting: {
        problema: {
          demandas: [
            {
              id: 'pieza',
              propietario: { componenteCodigo: 'A', pasoClave: 'cfg-print' },
            },
          ],
        },
      },
    },
  } as unknown as import('../tipos').LoteNestingCompuestoSnapshot;
  registrarCortesDelLote(lote, [componente]);
  expect(paso.tiempo!.totalMin).toBe(13);
  expect(paso.tiempo!.runMin).toBeCloseTo(5.34);
  expect(componente.costoTotal).toBeCloseTo(16.6);
  expect(componente.costoUnitario).toBeCloseTo(8.3);
});
