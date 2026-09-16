import { registrarCortesDelLote } from '../registrar-corte-lote';
import { demandaDesdeTiempo } from '../../eta/motor/demanda-humana';
import { consolidarCortesRegistrados } from '../consolidar-cortes-registrados';
import { escenarioHerramientas } from './fixtures/operaciones-corte';
import { recalcularOperacionesCongeladas } from '../procesamiento-corte';
import {
  aplicarRepartoCorte,
  planificarRepartoCorte,
} from '../repartir-operaciones-corte';
import { MotorUniversalService } from '../motor.service';
import type { ErrorMotor } from '../tipos';
import {
  erroresConfiguracionCorte,
  erroresPerfilCorte,
} from '../../maquinaria/procesamiento-corte';

describe('cotización por recorridos, herramientas y material', () => {
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
