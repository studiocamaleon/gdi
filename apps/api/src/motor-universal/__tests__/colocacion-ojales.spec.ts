import {
  calcularCantidadOjales,
  calcularOjalesPorPieza,
  parsearParamsColocacionOjales,
} from '../colocacion-ojales';
import { congelarMedidaVisible } from '../job-context-metrics';
import { aplicarMutacionPre } from '../modificaciones-pre';
import type { JobContext, LadoPieza } from '../tipos';

const CUATRO_LADOS: LadoPieza[] = [
  'superior',
  'inferior',
  'izquierdo',
  'derecho',
];

function params(over: Partial<Parameters<typeof calcularOjalesPorPieza>[2]> = {}) {
  return {
    separacionMaxMm: 500,
    lados: CUATRO_LADOS,
    esquinasSiempre: true,
    ...over,
  };
}

function lona(cantidad = 1): JobContext {
  const jc: JobContext = {
    cantidad,
    piezas: [{ cantidad, anchoMm: 1500, altoMm: 1000 }],
    medidaCustomMm: { anchoMm: 1500, altoMm: 1000 },
  };
  congelarMedidaVisible(jc);
  return jc;
}

describe('parsearParamsColocacionOjales', () => {
  it('lee separación y lados, y asume esquinas siempre', () => {
    expect(
      parsearParamsColocacionOjales({
        separacionMaxMm: 500,
        lados: ['derecho', 'superior'],
      }),
    ).toEqual({
      separacionMaxMm: 500,
      lados: ['superior', 'derecho'],
      esquinasSiempre: true,
    });
  });

  it('respeta esquinasSiempre en false', () => {
    expect(
      parsearParamsColocacionOjales({
        separacionMaxMm: 500,
        lados: ['superior'],
        esquinasSiempre: false,
      })?.esquinasSiempre,
    ).toBe(false);
  });

  it('devuelve null si falta separación o lados', () => {
    expect(parsearParamsColocacionOjales({ lados: ['superior'] })).toBeNull();
    expect(parsearParamsColocacionOjales({ separacionMaxMm: 500 })).toBeNull();
    expect(
      parsearParamsColocacionOjales({ separacionMaxMm: 0, lados: ['superior'] }),
    ).toBeNull();
    expect(parsearParamsColocacionOjales(null)).toBeNull();
  });
});

describe('calcularOjalesPorPieza', () => {
  /**
   * Caso B del diseño: lona 1500×1000, ojales cada 50cm en los 4 lados.
   *   horizontales: ceil(1500/500)=3 tramos → 4 posiciones c/u → 8
   *   verticales:   ceil(1000/500)=2 tramos → 3 posiciones c/u → 6
   *   esquinas compartidas                                     → −4
   *                                                      TOTAL = 10
   */
  it('caso B del diseño: 4 lados cada 500mm = 10 ojales', () => {
    expect(calcularOjalesPorPieza(1500, 1000, params())).toBe(10);
  });

  /** Caso C del diseño: sin lados adyacentes, no hay esquina que descontar. */
  it('caso C del diseño: sólo los verticales = 6 ojales', () => {
    expect(
      calcularOjalesPorPieza(
        1500,
        1000,
        params({ lados: ['izquierdo', 'derecho'] }),
      ),
    ).toBe(6);
  });

  it('un solo lado cuenta sus dos extremos', () => {
    // ceil(1500/500)=3 tramos → 4 posiciones, sin esquinas compartidas.
    expect(
      calcularOjalesPorPieza(1500, 1000, params({ lados: ['superior'] })),
    ).toBe(4);
  });

  it('dos lados adyacentes comparten una sola esquina', () => {
    // superior 4 + izquierdo 3 = 7, menos la esquina superior-izquierda.
    expect(
      calcularOjalesPorPieza(
        1500,
        1000,
        params({ lados: ['superior', 'izquierdo'] }),
      ),
    ).toBe(6);
  });

  it('la separación es un MÁXIMO: un lado no múltiplo redondea hacia arriba', () => {
    // 1200mm cada 500 → ceil(2.4)=3 tramos → 4 ojales, separados 400mm reales.
    expect(
      calcularOjalesPorPieza(1200, 1000, params({ lados: ['superior'] })),
    ).toBe(4);
  });

  it('sin esquinasSiempre coloca sólo los intermedios', () => {
    // horizontales: 3 tramos → 2 intermedios c/u → 4
    // verticales:   2 tramos → 1 intermedio  c/u → 2
    expect(
      calcularOjalesPorPieza(1500, 1000, params({ esquinasSiempre: false })),
    ).toBe(6);
  });

  it('un lado más corto que la separación igual lleva sus dos extremos', () => {
    expect(
      calcularOjalesPorPieza(300, 1000, params({ lados: ['superior'] })),
    ).toBe(2);
  });

  it('devuelve 0 con medidas inválidas', () => {
    expect(calcularOjalesPorPieza(0, 1000, params())).toBe(0);
  });
});

describe('calcularCantidadOjales', () => {
  it('multiplica por la cantidad de paños', () => {
    expect(calcularCantidadOjales(lona(3), params())).toBe(30);
  });

  it('suma piezas de medidas distintas', () => {
    const jc: JobContext = {
      cantidad: 2,
      piezas: [
        { cantidad: 1, anchoMm: 1500, altoMm: 1000 },
        { cantidad: 2, anchoMm: 1000, altoMm: 1000 },
      ],
    };
    congelarMedidaVisible(jc);

    // 1500×1000 → 10 ; 1000×1000 → (3+3+3+3) − 4 = 8, por 2 paños = 16
    expect(calcularCantidadOjales(jc, params())).toBe(26);
  });

  /**
   * La regla de oro, y el motivo por el que este módulo no puede leer
   * `piezaPerimetroTotalM`: el ojal va al borde terminado.
   */
  it('mide sobre la VISIBLE aunque un refuerzo previo haya agrandado el material', () => {
    const jc = lona();

    aplicarMutacionPre(
      jc,
      { subTipo: 'refuerzo', lados: CUATRO_LADOS, demasiaMm: 40 },
      { rutaPasoId: 'rp-1', nombrePaso: 'Refuerzo perimetral' },
    );

    // El material quedó en 1580×1080, pero los ojales se cuentan sobre
    // 1500×1000. Con 1580×1080 darían 12, no 10.
    expect(jc.piezas![0]).toMatchObject({ anchoMm: 1580, altoMm: 1080 });
    expect(calcularCantidadOjales(jc, params())).toBe(10);
  });

  it('devuelve 0 sin piezas', () => {
    expect(calcularCantidadOjales({ cantidad: 1 }, params())).toBe(0);
  });
});
