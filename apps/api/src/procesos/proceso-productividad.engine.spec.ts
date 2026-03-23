import {
  ModoProductividadProceso,
  Prisma,
  UnidadProceso,
} from '@prisma/client';
import {
  evaluateProductividad,
  validateProductividadRulesByMode,
} from './proceso-productividad.engine';

describe('proceso-productividad.engine', () => {
  it('valida que modo fija requiere productividad base', () => {
    const errors = validateProductividadRulesByMode({
      modoProductividad: ModoProductividadProceso.FIJA,
      productividadBase: null,
      reglaVelocidadJson: null,
      reglaMermaJson: null,
    });

    expect(errors.some((item) => item.field === 'productividadBase')).toBe(
      true,
    );
  });

  it('calcula run con regla formula_v1', () => {
    const result = evaluateProductividad({
      modoProductividad: ModoProductividadProceso.FORMULA,
      productividadBase: new Prisma.Decimal(100),
      reglaVelocidadJson: {
        tipo: 'formula_v1',
        expresion: {
          op: 'mul',
          args: [{ var: 'PB' }, { var: 'factor_material' }],
        },
        variables: {
          factor_material: {
            source: 'context',
            key: 'material.factor',
            default: 1,
          },
        },
      },
      reglaMermaJson: null,
      runMin: null,
      unidadTiempo: UnidadProceso.MINUTO,
      mermaRunPct: null,
      mermaSetup: null,
      cantidadObjetivoSalida: 1000,
      contexto: {
        material: {
          factor: 0.5,
        },
      },
    });

    expect(result.productividadAplicada).toBe(50);
    expect(result.runMin).toBe(20);
    expect(result.warnings).toHaveLength(0);
  });

  it('calcula run con regla tabla_v1 y fallback a productividad base', () => {
    const result = evaluateProductividad({
      modoProductividad: ModoProductividadProceso.TABLA,
      productividadBase: new Prisma.Decimal(80),
      reglaVelocidadJson: {
        tipo: 'tabla_v1',
        ejes: [{ key: 'tirada', type: 'number_range' }],
        filas: [
          {
            tirada: { min: 1, max: 100 },
            productividad: 40,
          },
        ],
        fallback: { type: 'productividad_base' },
      },
      reglaMermaJson: null,
      runMin: null,
      unidadTiempo: UnidadProceso.MINUTO,
      mermaRunPct: null,
      mermaSetup: null,
      cantidadObjetivoSalida: 200,
      contexto: {
        tirada: 200,
      },
    });

    expect(result.productividadAplicada).toBe(80);
    expect(result.runMin).toBe(2.5);
  });

  it('usa run manual cuando la regla es invalida', () => {
    const result = evaluateProductividad({
      modoProductividad: ModoProductividadProceso.FORMULA,
      productividadBase: new Prisma.Decimal(10),
      reglaVelocidadJson: {
        tipo: 'formula_v1',
        expresion: 'invalida',
      },
      reglaMermaJson: null,
      runMin: new Prisma.Decimal(12),
      unidadTiempo: UnidadProceso.MINUTO,
      mermaRunPct: null,
      mermaSetup: null,
      cantidadObjetivoSalida: 100,
      contexto: {},
    });

    expect(result.productividadAplicada).toBe(10);
    expect(result.runMin).toBe(10);
    expect(result.warnings).toContain(
      'Regla de velocidad formula invalida. Se usa productividad base como fallback.',
    );
  });

  it('usa productividad base sin warning cuando el modo variable no tiene regla avanzada', () => {
    const result = evaluateProductividad({
      modoProductividad: ModoProductividadProceso.FORMULA,
      productividadBase: new Prisma.Decimal(8),
      reglaVelocidadJson: null,
      reglaMermaJson: null,
      runMin: null,
      unidadTiempo: UnidadProceso.MINUTO,
      mermaRunPct: null,
      mermaSetup: null,
      cantidadObjetivoSalida: 40,
      contexto: {},
    });

    expect(result.productividadAplicada).toBe(8);
    expect(result.runMin).toBe(5);
    expect(result.warnings).toEqual([]);
  });

  it('aplica regla de merma formula_v1', () => {
    const result = evaluateProductividad({
      modoProductividad: ModoProductividadProceso.FIJA,
      productividadBase: new Prisma.Decimal(100),
      reglaVelocidadJson: null,
      reglaMermaJson: {
        tipo: 'formula_v1',
        target: 'merma_run_pct',
        expresion: {
          op: 'mul',
          args: [{ var: 'MERMA_RUN_PCT' }, { const: 2 }],
        },
      },
      runMin: null,
      unidadTiempo: UnidadProceso.MINUTO,
      mermaRunPct: new Prisma.Decimal(5),
      mermaSetup: new Prisma.Decimal(10),
      cantidadObjetivoSalida: 100,
      contexto: {},
    });

    expect(result.mermaRunPctAplicada).toBe(10);
    expect(result.cantidadRun).toBe(120);
    expect(result.runMin).toBe(1.2);
  });
});
