import {
  calcularCantidadOjales,
  calcularLayoutOjales,
  calcularOjalesPorPieza,
  calcularPosicionesOjales,
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
    distanciaBordeMm: 10,
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
      distanciaBordeMm: 10,
    });
  });

  it('respeta una distancia al borde propia', () => {
    expect(
      parsearParamsColocacionOjales({
        separacionMaxMm: 500,
        lados: ['superior'],
        distanciaBordeMm: 25,
      })?.distanciaBordeMm,
    ).toBe(25);
  });

  it('un valor inválido cae al default', () => {
    expect(
      parsearParamsColocacionOjales({
        separacionMaxMm: 500,
        lados: ['superior'],
        distanciaBordeMm: -5,
      })?.distanciaBordeMm,
    ).toBe(10);
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

describe('calcularPosicionesOjales', () => {
  /**
   * Coordenadas de la medida VISIBLE: (0,0) = esquina sup. izq. El ojal no se
   * perfora sobre el filo: va `distanciaBordeMm` hacia adentro.
   */
  it('reparte parejo sobre el lado y corre los ojales hacia adentro', () => {
    const pos = calcularPosicionesOjales(
      1500,
      1000,
      params({ lados: ['superior'] }),
    );
    expect(pos.map((p) => [p.xMm, p.yMm])).toEqual([
      [10, 10], // esquina: se corre en los DOS ejes
      [500, 10], // mitad de lado: sólo se aleja del borde superior
      [1000, 10],
      [1490, 10], // esquina opuesta
    ]);
  });

  it('las esquinas se corren en diagonal y las de lado en un solo eje', () => {
    const pos = calcularPosicionesOjales(1500, 1000, params());
    const claves = pos.map((p) => `${p.xMm}:${p.yMm}`);
    // Las 4 esquinas, movidas en ambos ejes.
    for (const esquina of ['10:10', '1490:10', '10:990', '1490:990']) {
      expect(claves).toContain(esquina);
    }
    // El del medio del lado izquierdo sólo se alejó del borde izquierdo.
    expect(claves).toContain('10:500');
  });

  it('las esquinas compartidas siguen contando UNA sola vez', () => {
    const pos = calcularPosicionesOjales(1500, 1000, params());
    expect(pos).toHaveLength(10);
    expect(new Set(pos.map((p) => `${p.xMm}:${p.yMm}`)).size).toBe(10);
  });

  it('toda posición queda a la distancia declarada de algún borde', () => {
    for (const p of calcularPosicionesOjales(1500, 1000, params())) {
      const pegadoAAlgunBorde =
        p.xMm === 10 || p.xMm === 1490 || p.yMm === 10 || p.yMm === 990;
      expect(pegadoAAlgunBorde).toBe(true);
      // Y siempre dentro de la pieza.
      expect(p.xMm).toBeGreaterThan(0);
      expect(p.xMm).toBeLessThan(1500);
      expect(p.yMm).toBeGreaterThan(0);
      expect(p.yMm).toBeLessThan(1000);
    }
  });

  it('con distancia 0 vuelve a caer sobre el filo', () => {
    const pos = calcularPosicionesOjales(
      1500,
      1000,
      params({ lados: ['superior'], distanciaBordeMm: 0 }),
    );
    expect(pos.map((p) => [p.xMm, p.yMm])).toEqual([
      [0, 0],
      [500, 0],
      [1000, 0],
      [1500, 0],
    ]);
  });

  it('en una pieza chica no se pasa del centro', () => {
    const pos = calcularPosicionesOjales(
      40,
      40,
      params({ lados: ['superior'], separacionMaxMm: 500, distanciaBordeMm: 50 }),
    );
    for (const p of pos) {
      expect(p.xMm).toBeLessThanOrEqual(20);
      expect(p.yMm).toBeLessThanOrEqual(20);
    }
  });

  it('con separación no múltiplo reparte parejo sin superar el máximo', () => {
    // 1200 cada 500 → 3 tramos de 400mm.
    const pos = calcularPosicionesOjales(
      1200,
      1000,
      params({ lados: ['superior'] }),
    );
    expect(pos.map((p) => p.xMm)).toEqual([10, 400, 800, 1190]);
  });

  it('sin esquinasSiempre no pone los extremos', () => {
    const pos = calcularPosicionesOjales(
      1500,
      1000,
      params({ lados: ['superior'], esquinasSiempre: false }),
    );
    expect(pos.map((p) => p.xMm)).toEqual([500, 1000]);
  });

  it('la cantidad se deriva de las posiciones', () => {
    const p = params();
    expect(calcularOjalesPorPieza(1500, 1000, p)).toBe(
      calcularPosicionesOjales(1500, 1000, p).length,
    );
  });
});

describe('calcularLayoutOjales', () => {
  it('publica el marco visible y las posiciones por pieza', () => {
    const layout = calcularLayoutOjales(lona(2), params());
    expect(layout).toHaveLength(1);
    expect(layout[0]).toMatchObject({
      anchoMm: 1500,
      altoMm: 1000,
      cantidad: 2,
    });
    expect(layout[0].posiciones).toHaveLength(10);
  });

  it('usa la VISIBLE aunque el material esté mutado', () => {
    const jc = lona();
    aplicarMutacionPre(
      jc,
      { subTipo: 'refuerzo', lados: CUATRO_LADOS, demasiaMm: 40 },
      { rutaPasoId: 'rp-1', nombrePaso: 'Refuerzo' },
    );

    const layout = calcularLayoutOjales(jc, params());
    expect(layout[0]).toMatchObject({ anchoMm: 1500, altoMm: 1000 });
  });

  it('sin piezas devuelve vacío', () => {
    expect(calcularLayoutOjales({ cantidad: 1 }, params())).toEqual([]);
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
