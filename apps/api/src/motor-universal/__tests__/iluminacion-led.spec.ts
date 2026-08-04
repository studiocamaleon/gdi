import {
  calcularIluminacionLed,
  parsearAtributosModuloLed,
  parsearParamsIluminacionLed,
} from '../iluminacion-led';
import type { JobContext } from '../tipos';

const ctx = (extra: Record<string, unknown> = {}): JobContext =>
  ({
    cantidad: 1,
    piezas: [{ anchoMm: 2400, altoMm: 1200 }],
    ...extra,
  }) as unknown as JobContext;

// Módulo estándar del prototipo: 12V, 0,72 W, cubre 0,0625 m² (25×25 cm).
// Claves canónicas de la plantilla (la unidad vive en `unit`, no en la clave).
const MODULO = parsearAtributosModuloLed({
  cobertura: 0.0625,
  paso: 100,
  potencia: 0.72,
})!;

describe('Iluminación LED (F1 cartelería)', () => {
  it('sembrado por área: backlight 2,4×1,2 con módulo estándar', () => {
    const r = calcularIluminacionLed(
      ctx(),
      parsearParamsIluminacionLed({ modoSembrado: 'area' }),
      MODULO,
    )!;
    // 2,88 m² / 0,0625 = 46,08 → 47 módulos
    expect(r.modulos).toBe(47);
    expect(r.watts).toBeCloseTo(33.84, 1);
    // ×1,3 de margen → la fuente tiene que cumplir ~44 W
    expect(r.wattsRequeridos).toBeCloseTo(43.99, 1);
  });

  it('la densidad multiplica el sembrado (1,5 = 50% más módulos)', () => {
    const r = calcularIluminacionLed(
      ctx(),
      parsearParamsIluminacionLed({ modoSembrado: 'area', densidad: 1.5 }),
      MODULO,
    )!;
    // 2,88 / (0,0625/1,5) = 69,12 → 70
    expect(r.modulos).toBe(70);
  });

  it('sembrado por recorrido: los módulos siguen el trazo (corpóreas)', () => {
    const r = calcularIluminacionLed(
      ctx(),
      parsearParamsIluminacionLed({ modoSembrado: 'recorrido' }),
      MODULO,
    )!;
    // perímetro 2·(2,4+1,2) = 7,2 m / 100 mm = 72 módulos
    expect(r.modulos).toBe(72);
  });

  it('el override de perímetro del configurador manda sobre el rectángulo', () => {
    // Una corpórea con forma libre: perímetro real 4,1 m aunque el bounding
    // box diga 7,2 m.
    const r = calcularIluminacionLed(
      ctx({ piezaPerimetroTotalM: 4.1 }),
      parsearParamsIluminacionLed({ modoSembrado: 'recorrido' }),
      MODULO,
    )!;
    expect(r.modulos).toBe(41);
  });

  it('el override de área manda en el sembrado por área', () => {
    const r = calcularIluminacionLed(
      ctx({ piezaAreaTotalM2: 1.0 }),
      parsearParamsIluminacionLed({ modoSembrado: 'area' }),
      MODULO,
    )!;
    expect(r.modulos).toBe(16);
  });

  it('nunca menos de 2 módulos', () => {
    const chico = {
      ...ctx(),
      piezas: [{ anchoMm: 100, altoMm: 100 }],
    } as unknown as JobContext;
    const r = calcularIluminacionLed(
      chico,
      parsearParamsIluminacionLed({ modoSembrado: 'area' }),
      MODULO,
    )!;
    expect(r.modulos).toBe(2);
  });

  it('sin cobertura en la variante, el sembrado por área no puede calcular', () => {
    const soloRecorrido = parsearAtributosModuloLed({ paso: 100, potencia: 1 })!;
    expect(
      calcularIluminacionLed(
        ctx(),
        parsearParamsIluminacionLed({ modoSembrado: 'area' }),
        soloRecorrido,
      ),
    ).toBeNull();
  });

  it('una variante sin atributos LED no parsea (el guard avisa)', () => {
    expect(parsearAtributosModuloLed({})).toBeNull();
    expect(parsearAtributosModuloLed(null)).toBeNull();
  });

  it('el cable estima perímetro ×1,4 más 12 cm por módulo', () => {
    const r = calcularIluminacionLed(
      ctx(),
      parsearParamsIluminacionLed({ modoSembrado: 'area' }),
      MODULO,
    )!;
    expect(r.cableMl).toBeCloseTo(7.2 * 1.4 + 47 * 0.12, 2);
  });
});

describe('compatibilidad con claves legadas (datos cargados a mano)', () => {
  it('acepta coberturaM2/pasoMm/wattsModulo como sinónimos', () => {
    const m = parsearAtributosModuloLed({ coberturaM2: 0.09, pasoMm: 80, wattsModulo: 1.2 })!;
    expect(m.coberturaM2).toBe(0.09);
    expect(m.pasoMm).toBe(80);
    expect(m.wattsModulo).toBe(1.2);
  });
});

describe('Regla de oro: los LEDs se siembran sobre el cartel terminado', () => {
  it('con mutación, ignora los overrides de material y usa la visible', () => {
    const jc = {
      cantidad: 1,
      piezas: [{ anchoMm: 2600, altoMm: 1400 }],
      piezasVisibles: [{ cantidad: 1, anchoMm: 2400, altoMm: 1200 }],
      piezaAreaTotalM2: 3.64, // recalculado sobre el MATERIAL mutado
      mutacionesAplicadas: [{ subTipo: 'refuerzo' }],
    } as never;
    const r = calcularIluminacionLed(
      jc,
      parsearParamsIluminacionLed({ modoSembrado: 'area' }),
      MODULO,
    )!;
    // 2,88 m² visibles / 0,0625 = 46,08 → 47 (no 59 del material mutado)
    expect(r.modulos).toBe(47);
  });
});
