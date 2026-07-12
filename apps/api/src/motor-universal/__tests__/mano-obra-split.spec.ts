/**
 * Tests del desdoblado de tarifa: mano de obra (SUELDOS + CARGAS) sólo se
 * cobra sobre setup/cleanup/tiempoFijo en pasos con máquina, no sobre el
 * runtime autónomo. En pasos sin máquina el operario hace el run → cobra todo.
 *
 * Ver docs/hora-hombre-setup-cleanup-diseno.md
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
  tarifaManoObra?: number;
  minutosOperario?: number;
  dotacionOperarios?: number;
  costoMaquina?: number;
  costoManoObra?: number;
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

describe('Motor — mano de obra en setup/cleanup, no en el run de máquina', () => {
  it('paso CON máquina: la MO se cobra sólo sobre setup+cleanup, no sobre el run', () => {
    const paso = pasoBase({
      maquina: {
        id: 'maq-1',
        codigo: 'M1',
        nombre: 'Impresora',
        plantilla: 'PLANA',
        centroCostoPrincipalId: 'cc-maq',
        centroCostoPrincipalNombre: 'Impresión',
      },
    });
    const tarifas = new Map<string, unknown>([
      ['cc-maq', { tarifa: 6000, manoObra: 2000 }], // máquina = 4000/h
    ]);

    const t = calcular(paso, tarifas);

    expect(t.totalMin).toBe(75); // 10 setup + 60 run + 5 cleanup
    expect(t.minutosOperario).toBe(15); // sólo setup + cleanup (run excluido)
    expect(t.costoMaquina).toBeCloseTo((75 / 60) * 4000); // 5000
    expect(t.costoManoObra).toBeCloseTo((15 / 60) * 2000); // 500
    expect(t.costo).toBeCloseTo(5500);
    // vs. tarifa mezclada legacy (75/60 × 6000 = 7500): saca run × MO/h = 2000
    expect(t.costo).toBeLessThan((75 / 60) * 6000);
  });

  it('paso SIN máquina: la MO se cobra sobre todo el tiempo (retro-compatible)', () => {
    const paso = pasoBase({
      centroCostoId: 'cc-man',
      centroCosto: { id: 'cc-man', codigo: 'CC-M', nombre: 'Manual' },
    });
    const tarifas = new Map<string, unknown>([
      ['cc-man', { tarifa: 6000, manoObra: 6000 }], // centro de pura mano de obra
    ]);

    const t = calcular(paso, tarifas);

    expect(t.totalMin).toBe(75);
    expect(t.minutosOperario).toBe(75); // todo el tiempo
    expect(t.costo).toBeCloseTo((75 / 60) * 6000); // idéntico a hoy
  });

  it('tarifa sin componente de MO (tarifas viejas): idéntico a la tarifa mezclada', () => {
    const paso = pasoBase({
      maquina: {
        id: 'maq-1',
        codigo: 'M1',
        nombre: 'Impresora',
        plantilla: 'PLANA',
        centroCostoPrincipalId: 'cc-maq',
        centroCostoPrincipalNombre: 'Impresión',
      },
    });
    const tarifas = new Map<string, unknown>([
      ['cc-maq', { tarifa: 6000, manoObra: 0 }],
    ]);

    const t = calcular(paso, tarifas);

    expect(t.costo).toBeCloseTo((75 / 60) * 6000);
    expect(t.costoManoObra).toBe(0);
  });

  it('dotación: N operarios multiplican sólo la mano de obra, no la máquina', () => {
    const paso = pasoBase({
      maquina: {
        id: 'maq-1',
        codigo: 'M1',
        nombre: 'Impresora',
        plantilla: 'PLANA',
        centroCostoPrincipalId: 'cc-maq',
        centroCostoPrincipalNombre: 'Impresión',
      },
      dotacionOperarios: 2,
    });
    const tarifas = new Map<string, unknown>([
      ['cc-maq', { tarifa: 6000, manoObra: 2000 }], // máquina = 4000/h
    ]);

    const t = calcular(paso, tarifas);

    expect(t.dotacionOperarios).toBe(2);
    // Máquina sin cambios: 75 min × 4000/h.
    expect(t.costoMaquina).toBeCloseTo((75 / 60) * 4000);
    // Mano de obra × 2: setup+cleanup (15 min) × 2000/h × 2 operarios.
    expect(t.costoManoObra).toBeCloseTo((15 / 60) * 2000 * 2);
    expect(t.costo).toBeCloseTo(6000);
  });
});
