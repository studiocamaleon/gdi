import {
  calcularAreaPiezasM2,
  calcularPerimetroPiezasM,
  congelarMedidaVisible,
  recalcularMetricasDerivadasPiezas,
} from '../job-context-metrics';
import type { JobContext } from '../tipos';

describe('calcularPerimetroPiezasM', () => {
  it('calcula el perímetro rectangular total de piezas en metros', () => {
    expect(
      calcularPerimetroPiezasM({
        piezas: [
          { cantidad: 2, anchoMm: 1000, altoMm: 500 },
          { cantidad: 1, anchoMm: 200, altoMm: 300 },
        ],
      }),
    ).toBeCloseTo(7, 6);
  });

  it('respeta un perímetro explícito por pieza cuando existe', () => {
    expect(
      calcularPerimetroPiezasM({
        piezas: [{ cantidad: 3, anchoMm: 1000, altoMm: 500, perimetroMm: 2500 }],
      }),
    ).toBeCloseTo(7.5, 6);
  });
});

describe('calcularAreaPiezasM2', () => {
  it('calcula el área total en m² respetando la cantidad de cada pieza', () => {
    expect(
      calcularAreaPiezasM2({
        piezas: [
          { cantidad: 2, anchoMm: 1000, altoMm: 500 },
          { cantidad: 1, anchoMm: 2000, altoMm: 1000 },
        ],
      }),
    ).toBeCloseTo(3, 6);
  });

  it('ignora piezas con medidas inválidas', () => {
    expect(
      calcularAreaPiezasM2({
        piezas: [
          { cantidad: 1, anchoMm: 1000, altoMm: 1000 },
          { cantidad: 1, anchoMm: 0, altoMm: 500 },
        ],
      }),
    ).toBeCloseTo(1, 6);
  });
});

describe('congelarMedidaVisible', () => {
  it('congela piezas y medida custom tal como las pidió el cliente', () => {
    const jc: JobContext = {
      cantidad: 1,
      piezas: [{ cantidad: 1, anchoMm: 1500, altoMm: 1000 }],
      medidaCustomMm: { anchoMm: 1500, altoMm: 1000 },
    };

    congelarMedidaVisible(jc);

    expect(jc.piezasVisibles).toEqual([
      { cantidad: 1, anchoMm: 1500, altoMm: 1000 },
    ]);
    expect(jc.medidaVisibleMm).toEqual({ anchoMm: 1500, altoMm: 1000 });
  });

  it('la copia visible NO comparte referencia con las piezas mutables', () => {
    const jc: JobContext = {
      cantidad: 1,
      piezas: [{ cantidad: 1, anchoMm: 1500, altoMm: 1000 }],
    };

    congelarMedidaVisible(jc);
    // Simula lo que hará un paso PRE en la etapa B.
    jc.piezas![0].altoMm = 1200;

    expect(jc.piezasVisibles![0].altoMm).toBe(1000);
  });

  it('es autoritativa: descarta un valor visible llegado desde el cliente', () => {
    const jc: JobContext = {
      cantidad: 1,
      piezas: [{ cantidad: 1, anchoMm: 1500, altoMm: 1000 }],
      medidaVisibleMm: { anchoMm: 10, altoMm: 10 },
      piezasVisibles: [{ cantidad: 99, anchoMm: 10, altoMm: 10 }],
    };

    congelarMedidaVisible(jc);

    expect(jc.medidaVisibleMm).toEqual({ anchoMm: 1500, altoMm: 1000 });
    expect(jc.piezasVisibles).toEqual([
      { cantidad: 1, anchoMm: 1500, altoMm: 1000 },
    ]);
  });
});

describe('recalcularMetricasDerivadasPiezas', () => {
  /**
   * Caso A del diseño: lona 1500×1000 visible con bolsillo superior e inferior
   * de 100mm. El material pasa a 1500×1200 (+20% de área).
   * Ver docs/modificaciones-fisicas-lona-diseno.md §4.
   */
  it('pisa las métricas que venían del frontend con la medida ya mutada', () => {
    const jc: JobContext = {
      cantidad: 1,
      piezas: [{ cantidad: 1, anchoMm: 1500, altoMm: 1000 }],
      medidaCustomMm: { anchoMm: 1500, altoMm: 1000 },
      // Lo que calculó el frontend sobre la medida PRE-mutación.
      piezaAreaTotalM2: 1.5,
      piezaPerimetroTotalM: 5,
    };
    congelarMedidaVisible(jc);

    jc.piezas![0].altoMm = 1200; // bolsillo sup + inf, 100mm cada uno
    recalcularMetricasDerivadasPiezas(jc);

    expect(jc.piezaAreaTotalM2).toBeCloseTo(1.8, 6);
    expect(jc.piezaPerimetroTotalM).toBeCloseTo(5.4, 6);
    expect(jc.piezaAnchoMaxMm).toBe(1500);
    expect(jc.piezaAltoMaxMm).toBe(1200);
    // La medida visible no se toca: es la que miden ojales y soldadura.
    expect(jc.piezasVisibles).toEqual([
      { cantidad: 1, anchoMm: 1500, altoMm: 1000 },
    ]);
  });

  /**
   * Caso B del diseño: refuerzo de 40mm en los 4 lados → 1580×1080.
   */
  it('acompaña la medida custom cuando hay una sola pieza', () => {
    const jc: JobContext = {
      cantidad: 1,
      piezas: [{ cantidad: 1, anchoMm: 1500, altoMm: 1000 }],
      medidaCustomMm: { anchoMm: 1500, altoMm: 1000 },
    };
    congelarMedidaVisible(jc);

    jc.piezas![0].anchoMm = 1580;
    jc.piezas![0].altoMm = 1080;
    recalcularMetricasDerivadasPiezas(jc);

    expect(jc.medidaCustomMm).toEqual({ anchoMm: 1580, altoMm: 1080 });
    expect(jc.medidaVisibleMm).toEqual({ anchoMm: 1500, altoMm: 1000 });
    expect(jc.piezaAreaTotalM2).toBeCloseTo(1.7064, 6);
    expect(jc.piezaPerimetroTotalM).toBeCloseTo(5.32, 6);
  });

  it('no toca la medida custom cuando hay varias piezas', () => {
    const jc: JobContext = {
      cantidad: 2,
      piezas: [
        { cantidad: 1, anchoMm: 1500, altoMm: 1000 },
        { cantidad: 1, anchoMm: 800, altoMm: 600 },
      ],
      medidaCustomMm: { anchoMm: 1500, altoMm: 1000 },
    };

    recalcularMetricasDerivadasPiezas(jc);

    expect(jc.medidaCustomMm).toEqual({ anchoMm: 1500, altoMm: 1000 });
    expect(jc.piezaAreaTotalM2).toBeCloseTo(1.98, 6);
  });

  it('es un no-op cuando no hay piezas', () => {
    const jc: JobContext = { cantidad: 1, piezaAreaTotalM2: 42 };

    recalcularMetricasDerivadasPiezas(jc);

    expect(jc.piezaAreaTotalM2).toBe(42);
  });
});
