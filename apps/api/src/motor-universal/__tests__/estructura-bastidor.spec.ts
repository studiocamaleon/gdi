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

  it('backlight 2,4×1,2×0,18: perfil, refuerzos y soldadura como el prototipo', () => {
    const r = calcularEstructuraBastidor(ctx(2400, 1200, 180), paramsBacklight)!;
    // refuerzosV = floor((240 − 1) / 100) = 2
    expect(r.refuerzosV).toBe(2);
    expect(r.refuerzosH).toBe(0);
    // perímetro = 2·(2·(2,4+1,2)) + 4·0,18 = 14,4 + 0,72 = 15,12
    expect(r.mlPerimetro).toBeCloseTo(15.12, 2);
    // refuerzos = 2 barras × 1,2 alto × 2 marcos = 4,8
    expect(r.mlRefuerzos).toBeCloseTo(4.8, 2);
    // conectores = 2 × 0,18 = 0,36
    expect(r.mlConectores).toBeCloseTo(0.36, 2);
    expect(r.mlTotal).toBeCloseTo(20.28, 2);
    // soldadura = 8 vértices + 2·2 refuerzos + 2·2 conectores = 16
    expect(r.puntosSoldadura).toBe(16);
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
    // perímetro = 2·(3+1) = 8 · refuerzosV = floor(299/100) = 2 → 2×1 = 2
    expect(r.mlPerimetro).toBeCloseTo(8, 2);
    expect(r.mlRefuerzos).toBeCloseTo(2, 2);
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
    expect(r.mlPerimetro).toBeCloseTo(15.12, 2);
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
    // En barras de 6 m: despiece [2,4×4 + 1,2×4(marcos) + 1,2×4(refuerzos) + 0,18×6]
    const barras = calcularBarrasNecesarias(r.despieceMm, 6000)!;
    expect(barras.barras).toBe(4);
  });
});
