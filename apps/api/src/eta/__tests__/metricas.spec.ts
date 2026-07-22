import {
  descomponerCiclo,
  percentil,
  resumirPrecision,
  type FilaPrecision,
  type PasoCierre,
} from '../metricas';

const t = (h: number, m = 0) => new Date(2026, 6, 20, h, m);
const paso = (over: Partial<PasoCierre>): PasoCierre => ({
  iniciadoEl: null,
  completadoEl: null,
  tiempoRealMin: null,
  tipoEjecucion: 'interno',
  ...over,
});

describe('descomponerCiclo', () => {
  it('sin timestamps → ciclo vacío (OT vieja)', () => {
    const c = descomponerCiclo([paso({ tiempoRealMin: 60 })]);
    expect(c.finReal).toBeNull();
    expect(c.cicloTotalMin).toBeNull();
    expect(c.flowEfficiencyPct).toBeNull();
  });

  it('descompone ciclo, trabajo y espera; traslado siempre null', () => {
    // 2 pasos: 9:00–9:30 (30 min trabajo) y 11:00–11:30 (30 min). Ciclo total
    // 9:00→11:30 = 150 min; trabajo 60; espera residual 90.
    const c = descomponerCiclo([
      paso({ iniciadoEl: t(9), completadoEl: t(9, 30), tiempoRealMin: 30 }),
      paso({ iniciadoEl: t(11), completadoEl: t(11, 30), tiempoRealMin: 30 }),
    ]);
    expect(c.finReal).toEqual(t(11, 30));
    expect(c.cicloTotalMin).toBe(150);
    expect(c.trabajoRealMin).toBe(60);
    expect(c.esperaCicloMin).toBe(90);
    expect(c.trasladoMin).toBeNull();
    expect(c.flowEfficiencyPct).toBe(40); // 60/150
  });

  it('separa el tiempo de proveedor del trabajo interno', () => {
    // Interno 9:00–10:00 (60 min) + tercerizado 10:00–14:00 (240 min lead).
    const c = descomponerCiclo([
      paso({ iniciadoEl: t(9), completadoEl: t(10), tiempoRealMin: 60 }),
      paso({
        iniciadoEl: t(10),
        completadoEl: t(14),
        tipoEjecucion: 'tercerizado',
        tiempoRealMin: 999, // debe ignorarse: el proveedor no aporta trabajo interno
      }),
    ]);
    expect(c.cicloTotalMin).toBe(300);
    expect(c.trabajoRealMin).toBe(60);
    expect(c.proveedorMin).toBe(240);
    expect(c.esperaCicloMin).toBe(0); // 300 - 60 - 240
  });

  it('el residual de espera nunca es negativo', () => {
    // Pasos con solapamiento raro: trabajo declarado > ciclo. No debe dar < 0.
    const c = descomponerCiclo([
      paso({ iniciadoEl: t(9), completadoEl: t(9, 10), tiempoRealMin: 999 }),
    ]);
    expect(c.esperaCicloMin).toBe(0);
  });
});

describe('percentil', () => {
  it('interpola linealmente', () => {
    expect(percentil([10, 20, 30, 40], 0.5)).toBe(25);
    expect(percentil([10, 20, 30, 40], 0.9)).toBeCloseTo(37, 5);
  });
  it('un solo valor', () => {
    expect(percentil([42], 0.9)).toBe(42);
  });
});

describe('resumirPrecision', () => {
  const fila = (errorMin: number | null, sinEstimar = false): FilaPrecision => ({
    errorMin,
    sinEstimar,
  });

  it('sin muestras cerradas', () => {
    const r = resumirPrecision([]);
    expect(r.cerradas).toBe(0);
    expect(r.muestras).toBe(0);
    expect(r.maeMin).toBeNull();
    expect(r.coberturaPct).toBe(0);
  });

  it('cobertura excluye las sin estimar del error pero las cuenta', () => {
    // 3 cerradas: 2 con error, 1 sin estimar.
    const r = resumirPrecision([fila(60), fila(-60), fila(null, true)]);
    expect(r.cerradas).toBe(3);
    expect(r.muestras).toBe(2);
    expect(r.sinEstimar).toBe(1);
    expect(r.coberturaPct).toBeCloseTo(66.7, 1);
  });

  it('MAE, sesgo y % dentro de rango', () => {
    // Errores (min): +30, -30, +300 (5h tarde), -1500 (>1día temprano).
    const r = resumirPrecision([fila(30), fila(-30), fila(300), fila(-1500)]);
    expect(r.maeMin).toBe(465); // (30+30+300+1500)/4
    expect(r.sesgoMin).toBe(-300); // (30-30+300-1500)/4
    expect(r.dentro4hPct).toBe(50); // |30|,|30| ≤ 240 → 2 de 4
    expect(r.dentro1dPct).toBe(75); // todos menos el -1500
    expect(r.tardePct).toBe(50); // 30 y 300 son > 0
  });
});
