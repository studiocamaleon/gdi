/**
 * Tests de tiempo manual por paso (Etapa A).
 *
 * Ver docs/tiempo-manual-por-paso-diseno.md: el comercial estima el tiempo
 * del paso al cotizar (`jobContext.tiempoManualMin_<configPasoId>`, minutos)
 * cuando el paso lo habilita en `paramsPasoJson.tiempoManual`. Gana sobre
 * cualquier modoTiempo, no multiplica, reemplaza al tiempoFijo y suma
 * setup/cleanup.
 *
 * Tests unitarios sin DB: se invoca `calcularTiempo` directo sobre el
 * prototype (mismo patrón que minimos-comerciales.spec.ts).
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
  costo: number;
  origenTiempo?: 'manual_comercial' | 'calculado';
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

const TARIFA_HORA = 6000;
const CONFIG_PASO_ID = 'cfg-tiempo-manual';
const CLAVE_MANUAL = `tiempoManualMin_${CONFIG_PASO_ID}`;

function basePaso(overrides: Partial<PasoCargado> = {}): PasoCargado {
  return {
    rutaPasoId: 'rp-1',
    rutaPasoOrden: 1,
    familiaCodigo: 'diseno_grafico',
    nombreVisible: 'Diseño gráfico',
    configPasoId: CONFIG_PASO_ID,
    modoActivacion: 'OBLIGATORIO',
    condicionActivacionJson: null,
    modoTiempo: 'T-1',
    mecanismoCantidad: 'DIRECT_FROM_JOBCONTEXT',
    mecanismoCantidadConfigJson: null,
    multiplicadoresActivos: [],
    paramsPasoJson: null,
    maquinaM1Id: null,
    perfilM1Id: null,
    centroCostoId: 'cc-manual',
    setupOverrideMin: null,
    cleanupOverrideMin: null,
    tiempoFijoOverrideMin: null,
    centroCosto: { id: 'cc-manual', codigo: 'CC-M', nombre: 'Centro manual' },
    ...overrides,
  };
}

function calcular(
  paso: PasoCargado,
  jobContext: JobContext,
  errores: ErrorMotor[] = [],
) {
  const service = createService();
  const tarifas = new Map<string, unknown>([
    ['cc-manual', { tarifa: TARIFA_HORA, manoObra: 0 }],
  ]);
  return service.calcularTiempo(paso, jobContext, errores, tarifas, '2026-07');
}

describe('Motor — tiempo manual por paso', () => {
  it('T-1: el valor manual reemplaza al tiempo fijo y marca el origen', () => {
    const paso = basePaso({
      tiempoFijoOverrideMin: 5,
      paramsPasoJson: { tiempoManual: { habilitado: true } },
    });
    const tiempo = calcular(paso, { cantidad: 1, [CLAVE_MANUAL]: 120 });

    expect(tiempo.runMin).toBe(120);
    expect(tiempo.tiempoFijoMin).toBe(0); // no cuenta doble
    expect(tiempo.totalMin).toBe(120);
    expect(tiempo.origenTiempo).toBe('manual_comercial');
    expect(tiempo.costo).toBeCloseTo((120 / 60) * TARIFA_HORA);
  });

  it('T-1 sin valor ingresado (no obligatorio): comportamiento actual intacto', () => {
    const errores: ErrorMotor[] = [];
    const paso = basePaso({
      tiempoFijoOverrideMin: 5,
      paramsPasoJson: { tiempoManual: { habilitado: true } },
    });
    const tiempo = calcular(paso, { cantidad: 1 }, errores);

    expect(tiempo.runMin).toBe(0);
    expect(tiempo.tiempoFijoMin).toBe(5);
    expect(tiempo.totalMin).toBe(5);
    expect(tiempo.origenTiempo).toBeUndefined();
    expect(errores).toEqual([]);
  });

  it('paso sin tiempoManual en params: ignora la clave del jobContext', () => {
    const paso = basePaso({ tiempoFijoOverrideMin: 5 });
    const tiempo = calcular(paso, { cantidad: 1, [CLAVE_MANUAL]: 120 });

    expect(tiempo.totalMin).toBe(5);
    expect(tiempo.origenTiempo).toBeUndefined();
  });

  it('setup y cleanup se suman al tiempo manual (no dependen del trabajo)', () => {
    const paso = basePaso({
      setupOverrideMin: 10,
      cleanupOverrideMin: 5,
      tiempoFijoOverrideMin: 99,
      paramsPasoJson: { tiempoManual: { habilitado: true } },
    });
    const tiempo = calcular(paso, { cantidad: 1, [CLAVE_MANUAL]: 30 });

    expect(tiempo.setupMin).toBe(10);
    expect(tiempo.cleanupMin).toBe(5);
    expect(tiempo.totalMin).toBe(45); // 10 + 30 + 5, sin los 99 fijos
  });

  it('redondea el total hacia arriba (Math.ceil) como cualquier paso', () => {
    const paso = basePaso({
      paramsPasoJson: { tiempoManual: { habilitado: true } },
    });
    const tiempo = calcular(paso, { cantidad: 1, [CLAVE_MANUAL]: 30.4 });

    expect(tiempo.runMin).toBeCloseTo(30.4);
    expect(tiempo.totalMin).toBe(31);
  });

  it('obligatorio sin valor: corta con tiempo_manual_requerido', () => {
    const errores: ErrorMotor[] = [];
    const paso = basePaso({
      paramsPasoJson: { tiempoManual: { habilitado: true, obligatorio: true } },
    });
    calcular(paso, { cantidad: 1 }, errores);

    expect(errores).toHaveLength(1);
    expect(errores[0].codigo).toBe('tiempo_manual_requerido');
    expect(errores[0].severidad).toBe('ERROR');
    expect(errores[0].rutaPasoId).toBe('rp-1');
    expect(errores[0].contexto).toMatchObject({
      configPasoId: CONFIG_PASO_ID,
      clave: CLAVE_MANUAL,
    });
  });

  it.each([[0], [-5], ['abc' as unknown as number]])(
    'valor inválido %p: cae al cálculo estándar sin error (no obligatorio)',
    (valorInvalido) => {
      const errores: ErrorMotor[] = [];
      const paso = basePaso({
        tiempoFijoOverrideMin: 5,
        paramsPasoJson: { tiempoManual: { habilitado: true } },
      });
      const tiempo = calcular(
        paso,
        { cantidad: 1, [CLAVE_MANUAL]: valorInvalido },
        errores,
      );

      expect(tiempo.totalMin).toBe(5);
      expect(tiempo.origenTiempo).toBeUndefined();
      expect(errores).toEqual([]);
    },
  );

  it('obligatorio con valor inválido: también corta con error', () => {
    const errores: ErrorMotor[] = [];
    const paso = basePaso({
      paramsPasoJson: { tiempoManual: { habilitado: true, obligatorio: true } },
    });
    calcular(paso, { cantidad: 1, [CLAVE_MANUAL]: 0 }, errores);

    expect(errores.map((e) => e.codigo)).toEqual(['tiempo_manual_requerido']);
  });

  describe('T-3 con máquina y perfil (caso corte láser)', () => {
    const pasoT3 = (params: Record<string, unknown> | null) =>
      basePaso({
        familiaCodigo: 'plotter_corte',
        nombreVisible: 'Corte láser',
        modoTiempo: 'T-3',
        multiplicadoresActivos: ['caras'],
        paramsPasoJson: params,
        maquinaM1Id: 'maq-laser',
        maquina: {
          id: 'maq-laser',
          codigo: 'LASER-1',
          nombre: 'Láser CO2',
          plantilla: 'laser',
          centroCostoPrincipalId: 'cc-manual',
          centroCostoPrincipalNombre: 'Centro manual',
        },
        perfil: {
          id: 'perfil-laser',
          nombre: 'Corte estándar',
          productivityValue: 60, // 60 unidades/hora
          productivityUnit: 'UNIDADES_H',
          setupMin: 3,
          cleanupMin: 0,
        },
      });

    it('baseline sin tiempo manual: productividad del perfil + multiplicador caras', () => {
      const tiempo = calcular(pasoT3(null), { cantidad: 100, caras: 2 });

      // (100 × 2 caras) / 60 u/h × 60 = 200 min + 3 setup
      expect(tiempo.runMin).toBeCloseTo(200);
      expect(tiempo.totalMin).toBe(203);
    });

    it('el tiempo manual gana sobre la productividad y NO se multiplica por caras', () => {
      const paso = pasoT3({ tiempoManual: { habilitado: true } });
      const simple = calcular(paso, {
        cantidad: 100,
        caras: 1,
        [CLAVE_MANUAL]: 40,
      });
      const doble = calcular(paso, {
        cantidad: 100,
        caras: 2,
        [CLAVE_MANUAL]: 40,
      });

      expect(simple.runMin).toBe(40);
      expect(doble.runMin).toBe(40); // estimación absoluta: caras no duplica
      expect(simple.totalMin).toBe(43); // setup del perfil se suma igual
      expect(doble.totalMin).toBe(43);
      expect(doble.origenTiempo).toBe('manual_comercial');
    });
  });

  describe('T-2: convivencia con el legacy campoHorasJobContext', () => {
    const pasoT2 = (params: Record<string, unknown>) =>
      basePaso({
        familiaCodigo: 'embalaje',
        nombreVisible: 'Embalaje',
        modoTiempo: 'T-2',
        paramsPasoJson: params,
      });

    it('legacy solo: sigue leyendo horas del jobContext', () => {
      const paso = pasoT2({ campoHorasJobContext: 'horasRip' });
      const tiempo = calcular(paso, { cantidad: 1, horasRip: 2 });

      expect(tiempo.runMin).toBe(120);
      expect(tiempo.origenTiempo).toBeUndefined(); // legacy no marca origen
    });

    it('ambos mecanismos: tiempoManual (minutos) gana sobre el legacy (horas)', () => {
      const paso = pasoT2({
        campoHorasJobContext: 'horasRip',
        tiempoManual: { habilitado: true },
      });
      const tiempo = calcular(paso, {
        cantidad: 1,
        horasRip: 2,
        [CLAVE_MANUAL]: 30,
      });

      expect(tiempo.runMin).toBe(30);
      expect(tiempo.origenTiempo).toBe('manual_comercial');
    });
  });
});
