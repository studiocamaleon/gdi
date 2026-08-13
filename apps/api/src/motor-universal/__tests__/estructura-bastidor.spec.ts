import {
  calcularEstructuraBastidor,
  parsearParamsEstructuraBastidor,
} from '../estructura-bastidor';
import type { JobContext } from '../tipos';

const ctx = (
  anchoMm: number,
  altoMm: number,
  profundidadMm?: number,
): JobContext =>
  ({
    cantidad: 1,
    piezas: [{ anchoMm, altoMm }],
    ...(profundidadMm ? { profundidadMm } : {}),
  }) as unknown as JobContext;

describe('Estructura de bastidor (F1 cartelería)', () => {
  // El caso canónico del prototipo: backlight 2,40 × 1,20 × 0,18 m,
  // refuerzos verticales cada 100 cm, sin horizontales, con cenefa.
  const paramsBacklight = parsearParamsEstructuraBastidor({
    tipoBastidor: 'doble',
    sepRefuerzoVcm: 100,
    sepRefuerzoHcm: 0,
    cenefa: true,
    solapaCenefaCm: 2,
    pintura: true,
  });

  it('backlight 2,4×1,2×0,18: perfil, refuerzos y soldadura (caño default 40×40)', () => {
    const r = calcularEstructuraBastidor(ctx(2400, 1200, 180), paramsBacklight)!;
    // refuerzosV = floor((240 − 1) / 100) = 2
    expect(r.refuerzosV).toBe(2);
    expect(r.refuerzosH).toBe(0);
    // Largos de CORTE reales con caño 40×40 (lado 0,04):
    //   largueros 4×2,4 + parantes 4×(1,2−0,08) + conectores 4×(0,18−0,08)
    //   = 9,6 + 4,48 + 0,4 = 14,48
    expect(r.mlPerimetro).toBeCloseTo(14.48, 2);
    // refuerzos SOLO en el contramarco (el frente lleva la lona): 2 × 1,12
    expect(r.mlRefuerzos).toBeCloseTo(2.24, 2);
    // 2 conectores por refuerzo: 2·2 × 0,10 = 0,40
    expect(r.mlConectores).toBeCloseTo(0.4, 2);
    expect(r.mlTotal).toBeCloseTo(17.12, 2);
    // soldadura = 8 vértices + 2·2 refuerzos + 2·2 conectores = 16
    expect(r.puntosSoldadura).toBe(16);
  });

  it('el caso de la herrería: 100×80 en caño 20×20 corta 2 de 100 y 2 de 76', () => {
    const perfil20 = { ladoM: 0.02, desarrolloM: 0.08 };
    const simple = calcularEstructuraBastidor(
      ctx(1000, 800),
      parsearParamsEstructuraBastidor({ tipoBastidor: 'simple', sepRefuerzoVcm: 0 }),
      perfil20,
    )!;
    expect(simple.despieceMm.sort((a, b) => b - a)).toEqual([1000, 1000, 760, 760]);

    // Backlight de 10 cm de profundidad: 4×100, 4×76 y conectores de 6 cm
    // (10 − 2×2). El refuerzo va SOLO atrás (adelante apoya la lona) y se
    // vincula al frente con 2 conectores.
    const doble = calcularEstructuraBastidor(
      ctx(1000, 800, 100),
      parsearParamsEstructuraBastidor({ tipoBastidor: 'doble', sepRefuerzoVcm: 50 }),
      perfil20,
    )!;
    expect(doble.refuerzosV).toBe(1);
    const conteo = new Map<number, number>();
    for (const mm of doble.despieceMm) conteo.set(mm, (conteo.get(mm) ?? 0) + 1);
    expect(conteo.get(1000)).toBe(4); // largueros
    expect(conteo.get(760)).toBe(4 + 1); // parantes + refuerzo del contramarco
    expect(conteo.get(60)).toBe(4 + 2); // esquinas + 2 conectores del refuerzo
  });

  it('el lado del caño sale de la variante (seccion "20×20 mm")', () => {
    const { parsearPerfilEstructural } = require('../estructura-bastidor');
    expect(
      parsearPerfilEstructural({ seccion: '20×20 mm', desarrolloSeccion: 0.08 }),
    ).toEqual({ ladoM: 0.02, desarrolloM: 0.08 });
    // Sin desarrollo declarado: perímetro de la sección (4 lados).
    expect(parsearPerfilEstructural({ seccion: '30×30 mm' })).toEqual({
      ladoM: 0.03,
      desarrolloM: 0.12,
    });
    // Sin atributos: default 40×40 histórico.
    expect(parsearPerfilEstructural(null)).toEqual({
      ladoM: 0.04,
      desarrolloM: 0.16,
    });
  });

  it('la cenefa desarrolla profundidad + 2 solapas con 8% de desperdicio', () => {
    const r = calcularEstructuraBastidor(ctx(2400, 1200, 180), paramsBacklight)!;
    // desarrollo = 0,18 + 2×0,02 = 0,22 m → 22 cm
    expect(r.cenefaDesarrolloCm).toBeCloseTo(22, 1);
    // m² = 2·(2,4+1,2) × 0,22 × 1,08 = 1,7107
    expect(r.cenefaM2).toBeCloseTo(1.711, 2);
  });

  it('frontlight simple: un solo marco, sin conectores ni cenefa', () => {
    const params = parsearParamsEstructuraBastidor({
      tipoBastidor: 'simple',
      sepRefuerzoVcm: 100,
      cenefa: true, // aunque la pidan, sin profundidad no hay cenefa
    });
    const r = calcularEstructuraBastidor(ctx(3000, 1000), params)!;
    // perímetro = 2·3 + 2·(1−0,08) = 7,84 · refuerzos = 2 × 0,92 = 1,84
    expect(r.mlPerimetro).toBeCloseTo(7.84, 2);
    expect(r.mlRefuerzos).toBeCloseTo(1.84, 2);
    expect(r.mlConectores).toBe(0);
    expect(r.cenefaM2).toBe(0);
    // soldadura = 4 vértices + 2·2 = 8
    expect(r.puntosSoldadura).toBe(8);
  });

  it('el cajón doble sin profundidad no se puede calcular (lo diagnostica el guard)', () => {
    expect(
      calcularEstructuraBastidor(ctx(2400, 1200), paramsBacklight),
    ).toBeNull();
  });

  it('la profundidad puede venir fija del paso si el comercial no la carga', () => {
    const params = parsearParamsEstructuraBastidor({
      tipoBastidor: 'doble',
      sepRefuerzoVcm: 0,
      profundidadMm: 150,
    });
    const r = calcularEstructuraBastidor(ctx(1000, 1000), params)!;
    expect(r.profundidadM).toBeCloseTo(0.15, 3);
    // JobContext tiene prioridad sobre el param
    const r2 = calcularEstructuraBastidor(ctx(1000, 1000, 200), params)!;
    expect(r2.profundidadM).toBeCloseTo(0.2, 3);
  });

  it('sin refuerzos configurados no hay barras ni cruces', () => {
    const params = parsearParamsEstructuraBastidor({
      tipoBastidor: 'simple',
      sepRefuerzoVcm: 0,
      sepRefuerzoHcm: 0,
      pintura: false,
    });
    const r = calcularEstructuraBastidor(ctx(1000, 500), params)!;
    expect(r.refuerzosV).toBe(0);
    expect(r.mlRefuerzos).toBe(0);
    expect(r.puntosSoldadura).toBe(4);
    // §15: la pintura_m2 se deriva SIEMPRE (el paso opcional decide si cobra).
    expect(r.pinturaM2).toBeGreaterThan(0);
  });

  it('un cartel que mide exactamente la separación no gana refuerzo de más', () => {
    // 100 cm con separación 100 → floor(99/100) = 0 barras (el marco alcanza)
    const params = parsearParamsEstructuraBastidor({
      tipoBastidor: 'simple',
      sepRefuerzoVcm: 100,
    });
    const r = calcularEstructuraBastidor(ctx(1000, 500), params)!;
    expect(r.refuerzosV).toBe(0);
  });
});

describe('Regla de oro: se mide sobre la medida VISIBLE', () => {
  it('la demasía de tensado de la lona NO agranda el bastidor', () => {
    // La lona creció a 2,6×1,4 por la demasía, pero el cartel sigue siendo
    // 2,4×1,2: el bastidor se suelda a la medida terminada.
    const jc = {
      cantidad: 1,
      piezas: [{ anchoMm: 2600, altoMm: 1400 }],
      piezasVisibles: [{ cantidad: 1, anchoMm: 2400, altoMm: 1200 }],
      profundidadMm: 180,
      mutacionesAplicadas: [{ subTipo: 'refuerzo' }],
    } as never;
    const r = calcularEstructuraBastidor(
      jc,
      parsearParamsEstructuraBastidor({ tipoBastidor: 'doble', sepRefuerzoVcm: 100 }),
    )!;
    expect(r.anchoM).toBeCloseTo(2.4, 3);
    expect(r.mlPerimetro).toBeCloseTo(14.48, 2);
  });
});

describe('Barras enteras (compra real, no ml teóricos)', () => {
  const { calcularBarrasNecesarias } = require('../estructura-bastidor');
  const paramsRef = parsearParamsEstructuraBastidor({
    tipoBastidor: 'doble',
    sepRefuerzoVcm: 100,
  });

  it('el caso que desarma el ceil ingenuo: 4 tramos de 1,8 m en barras de 3 m', () => {
    // ceil(7,2 / 3) = 3 mentiría: en cada barra entra UN tramo de 1,8.
    const r = calcularBarrasNecesarias([1800, 1800, 1800, 1800], 3000)!;
    expect(r.barras).toBe(4);
  });

  it('empaqueta tramos chicos en los sobrantes (first-fit decreasing)', () => {
    // 2,4 + 0,5 entran juntos en una barra de 3 m.
    const r = calcularBarrasNecesarias([2400, 2400, 500, 500], 3000)!;
    expect(r.barras).toBe(2);
  });

  it('el kerf del corte se descuenta del aprovechamiento', () => {
    // 3 tramos de 1000 en barra de 3000: con kerf 5 no entran los tres.
    const r = calcularBarrasNecesarias([1000, 1000, 1000], 3000, 5)!;
    expect(r.barras).toBe(2);
  });

  it('un tramo más largo que la barra no se puede cortar', () => {
    expect(calcularBarrasNecesarias([3500], 3000)).toBeNull();
  });

  it('el despiece del backlight 2,4×1,2×0,18 cierra contra el total de ml', () => {
    const r = calcularEstructuraBastidor(ctx(2400, 1200, 180), paramsRef)!;
    const sumaDespiece = r.despieceMm.reduce((a: number, b: number) => a + b, 0) / 1000;
    expect(sumaDespiece).toBeCloseTo(r.mlTotal, 2);
    // Despiece real: 4×2400 + (4 parantes + 2 refuerzos)×1120 + 8×100.
    // En barras de 6 m el packing cierra en 3 (menos caño que antes: los
    // refuerzos ya no se duplican en el frente).
    const barras = calcularBarrasNecesarias(r.despieceMm, 6000)!;
    expect(barras.barras).toBe(3);
  });
});

describe('Estructura de bastidor — geometría derivada (Ola #1)', () => {
  it('interior útil = medida menos el caño de cada lado (100×80 en 20×20 → 96×76)', () => {
    const perfil20 = { ladoM: 0.02, desarrolloM: 0.08 };
    const r = calcularEstructuraBastidor(
      ctx(1000, 800),
      parsearParamsEstructuraBastidor({ tipoBastidor: 'simple', sepRefuerzoVcm: 0 }),
      perfil20,
    )!;
    expect(r.interiorAnchoM).toBeCloseTo(0.96, 3);
    expect(r.interiorAltoM).toBeCloseTo(0.76, 3);
  });

  it('rectángulo de fondo = medida del cartel', () => {
    const r = calcularEstructuraBastidor(
      ctx(2400, 1200, 180),
      parsearParamsEstructuraBastidor({ tipoBastidor: 'doble' }),
    )!;
    expect(r.fondoAnchoM).toBeCloseTo(2.4, 3);
    expect(r.fondoAltoM).toBeCloseTo(1.2, 3);
  });

  it('cenefa: una tira por lado, largo = lado, ancho = desarrollo (D + 2·solapa)', () => {
    const r = calcularEstructuraBastidor(
      ctx(1000, 500, 180),
      parsearParamsEstructuraBastidor({ tipoBastidor: 'doble', solapaCenefaCm: 2 }),
    )!;
    expect(r.cenefaTiras).toHaveLength(4);
    const largos = r.cenefaTiras.map((t) => t.largoM).sort((a, b) => b - a);
    expect(largos).toEqual([1, 1, 0.5, 0.5]);
    // desarrollo = 0,18 + 2×0,02 = 0,22
    r.cenefaTiras.forEach((t) => expect(t.anchoM).toBeCloseTo(0.22, 3));
  });

  it('sin cajón (simple) no hay tiras de cenefa', () => {
    const r = calcularEstructuraBastidor(
      ctx(1000, 500),
      parsearParamsEstructuraBastidor({ tipoBastidor: 'simple' }),
    )!;
    expect(r.cenefaTiras).toEqual([]);
  });

  it('lona bruta perimetral = visible + demasía de agarre por lado (default 10 cm)', () => {
    const r = calcularEstructuraBastidor(
      ctx(1000, 500, 180),
      parsearParamsEstructuraBastidor({ tipoBastidor: 'doble' }),
    )!;
    // 1,0 + 2×0,10 = 1,20 · 0,5 + 0,20 = 0,70. La profundidad NO entra.
    expect(r.lonaBrutaAnchoM).toBeCloseTo(1.2, 3);
    expect(r.lonaBrutaAltoM).toBeCloseTo(0.7, 3);
  });

  it('lona bruta contramarco (canvas) suma la profundidad además del agarre', () => {
    const r = calcularEstructuraBastidor(
      ctx(1000, 500, 180),
      parsearParamsEstructuraBastidor({
        tipoBastidor: 'doble',
        montajeLona: 'contramarco',
        demasiaAgarreCm: 10,
      }),
    )!;
    // extra = D + agarre = 0,18 + 0,10 = 0,28 por lado
    expect(r.lonaBrutaAnchoM).toBeCloseTo(1.56, 3);
    expect(r.lonaBrutaAltoM).toBeCloseTo(1.06, 3);
  });
});
