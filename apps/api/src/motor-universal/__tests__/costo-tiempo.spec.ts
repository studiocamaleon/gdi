/**
 * Tests del costo de tiempo: el paso paga la fracción de la capacidad del
 * centro que ocupó, a la tarifa del centro. Una sola tarifa, sin desglose de
 * mano de obra.
 *
 * Hasta 2026-07-28 la mano de obra se descontaba del run de las máquinas.
 * Se revirtió porque era irrecuperable: ver
 * docs/hora-hombre-setup-cleanup-diseno.md §Reversión.
 *
 * Unitario sin DB: se invoca `calcularTiempo` directo sobre el prototype.
 */

import { MotorUniversalService } from '../motor.service';
import type { ErrorMotor, JobContext, PasoCargado } from '../tipos';

type TiempoPaso = {
  setupMin: number;
  runMin: number;
  cleanupMin: number;
  tiempoFijoMin: number;
  totalMin: number;
  tarifaHora?: number;
  dotacionOperarios?: number;
  costo: number;
};

type MotorConPrivados = {
  calcularTiempo: (
    paso: PasoCargado,
    jobContext: JobContext,
    errores: ErrorMotor[],
    tarifasMap: Map<string, unknown>,
    periodo: string,
    nestingDispatch?: unknown,
    materialPreliminar?: unknown,
  ) => TiempoPaso;
};

function createService(): MotorConPrivados {
  return Object.create(
    MotorUniversalService.prototype,
  ) as unknown as MotorConPrivados;
}

function calcular(
  paso: PasoCargado,
  tarifas: Map<string, unknown>,
  jobContext: JobContext = { cantidad: 1 },
) {
  return createService().calcularTiempo(paso, jobContext, [], tarifas, '2026-07');
}

// Paso T-2 con `horasEstimadas` = 1 → run determinístico de 60 min, sin DB.
function pasoBase(overrides: Partial<PasoCargado> = {}): PasoCargado {
  return {
    rutaPasoId: 'rp-1',
    rutaPasoOrden: 1,
    familiaCodigo: 'terminacion',
    nombreVisible: 'Paso',
    configPasoId: 'cfg-1',
    modoActivacion: 'OBLIGATORIO',
    condicionActivacionJson: null,
    modoTiempo: 'T-2',
    mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
    mecanismoCantidadConfigJson: null,
    multiplicadoresActivos: [],
    paramsPasoJson: { horasEstimadas: 1 },
    maquinaM1Id: null,
    perfilM1Id: null,
    centroCostoId: null,
    setupOverrideMin: 10,
    cleanupOverrideMin: 5,
    tiempoFijoOverrideMin: null,
    ...overrides,
  };
}

describe('Motor — el tiempo se cobra a la tarifa del centro', () => {
  const maquina = {
    id: 'maq-1',
    codigo: 'M1',
    nombre: 'Impresora',
    plantilla: 'PLANA',
    centroCostoPrincipalId: 'cc-maq',
    centroCostoPrincipalNombre: 'Impresión',
  };

  it('paso CON máquina: cobra todo el tiempo ocupado, run incluido', () => {
    const paso = pasoBase({ maquina });
    const tarifas = new Map<string, unknown>([
      ['cc-maq', { tarifa: 6000, manoObra: 2000 }],
    ]);

    const t = calcular(paso, tarifas);

    expect(t.totalMin).toBe(75); // 10 setup + 60 run + 5 cleanup
    // El run no se descuenta: el sueldo que el centro absorbió sólo se
    // recupera si se reparte entre todas las horas que el centro vende.
    expect(t.costo).toBeCloseTo((75 / 60) * 6000); // 7500
  });

  it('paso SIN máquina: mismo criterio, la tarifa entera por el tiempo', () => {
    const paso = pasoBase({
      centroCostoId: 'cc-man',
      centroCosto: { id: 'cc-man', codigo: 'CC-M', nombre: 'Manual' },
    });
    const tarifas = new Map<string, unknown>([
      ['cc-man', { tarifa: 6000, manoObra: 6000 }],
    ]);

    const t = calcular(paso, tarifas);

    expect(t.costo).toBeCloseTo((75 / 60) * 6000);
  });

  it('la componente de mano de obra de la tarifa ya no altera el costo', () => {
    const paso = pasoBase({ maquina });
    const conMO = calcular(
      paso,
      new Map<string, unknown>([['cc-maq', { tarifa: 6000, manoObra: 2000 }]]),
    );
    const sinMO = calcular(
      paso,
      new Map<string, unknown>([['cc-maq', { tarifa: 6000, manoObra: 0 }]]),
    );

    expect(conMO.costo).toBeCloseTo(sinMO.costo);
  });

  it('dotación con máquina: no multiplica — la máquina es una sola', () => {
    const paso = pasoBase({ maquina, dotacionOperarios: 2 });
    const tarifas = new Map<string, unknown>([
      ['cc-maq', { tarifa: 6000, manoObra: 2000 }],
    ]);

    const t = calcular(paso, tarifas);

    expect(t.dotacionOperarios).toBe(2);
    expect(t.costo).toBeCloseTo((75 / 60) * 6000);
  });

  it('dotación sin máquina: multiplica — la capacidad son horas-hombre', () => {
    const paso = pasoBase({
      centroCostoId: 'cc-man',
      centroCosto: { id: 'cc-man', codigo: 'CC-M', nombre: 'Manual' },
      dotacionOperarios: 2,
    });
    const tarifas = new Map<string, unknown>([
      ['cc-man', { tarifa: 6000, manoObra: 6000 }],
    ]);

    const t = calcular(paso, tarifas);

    // Dos personas 75 min consumen 150 min de las horas del centro.
    expect(t.costo).toBeCloseTo((75 / 60) * 6000 * 2);
  });
});
