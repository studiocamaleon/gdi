/**
 * Derivadores geométricos — specs del catálogo y su contrato
 * (docs/derivadores-geometricos-diseno.md §3).
 *
 * Las matemáticas finas viven en los specs de cada helper
 * (estructura-bastidor.spec, iluminacion-led.spec, colocacion-ojales.spec);
 * acá se prueba el CONTRATO: que el catálogo rutea, que las magnitudes
 * publicadas son las que las familias mapean, y que el null (sin datos)
 * se propaga para que el guard genérico corte.
 */
import { existeDerivador, runDerivador } from '../derivadores';
import {
  derivacionesDelJobContext,
  KEY_DERIVACIONES_POR_PASO,
} from '../derivadores/tipos';
import { resolverFamilia } from '../../productos-servicios/pasos/familias';
import type { JobContext } from '../tipos';

/** El caso validado del prototipo (doc §10): backlight 2,40×1,20×0,18. */
const JOB_BACKLIGHT = {
  cantidad: 1,
  piezas: [{ cantidad: 1, anchoMm: 2400, altoMm: 1200 }],
  profundidadMm: 180,
} as unknown as JobContext;

describe('catálogo de derivadores', () => {
  it('las familias que declaran derivador apuntan a códigos que existen', () => {
    for (const codigo of [
      'estructura_bastidor',
      'iluminacion_led',
      'colocacion_ojales',
    ] as const) {
      const familia = resolverFamilia(codigo);
      expect(familia?.derivador).toBeDefined();
      expect(existeDerivador(familia!.derivador!.codigo)).toBe(true);
    }
  });

  it('un código desconocido devuelve null (no explota)', () => {
    expect(runDerivador('no_existe', JOB_BACKLIGHT, {})).toBeNull();
  });

  it('toda magnitud mapeada por una familia existe en el resultado de su derivador', () => {
    // bastidor_rectangular con el caso del prototipo
    const bastidor = runDerivador('bastidor_rectangular', JOB_BACKLIGHT, {
      tipoBastidor: 'doble',
      sepRefuerzoVcm: 100,
      sepRefuerzoHcm: 0,
    });
    const familiaB = resolverFamilia('estructura_bastidor')!;
    for (const magnitud of Object.values(familiaB.derivador!.outputs ?? {})) {
      expect(bastidor!.magnitudes).toHaveProperty(magnitud);
    }
    // sembrado_led con un módulo estándar
    const led = runDerivador(
      'sembrado_led',
      JOB_BACKLIGHT,
      { modoSembrado: 'area', densidad: 1 },
      { cobertura: 0.0625, potencia: 0.72 },
    );
    const familiaL = resolverFamilia('iluminacion_led')!;
    for (const magnitud of Object.values(familiaL.derivador!.outputs ?? {})) {
      expect(led!.magnitudes).toHaveProperty(magnitud);
    }
  });
});


describe('unidades del trabajo: dos carteles idénticos duplican los consumos', () => {
  const JOB_X2 = {
    cantidad: 2,
    piezas: [{ cantidad: 2, anchoMm: 2400, altoMm: 1200 }],
    profundidadMm: 180,
  } as unknown as JobContext;

  it('bastidor: magnitudes ×2, despiece repetido, traza por cartel', () => {
    const x1 = runDerivador('bastidor_rectangular', JOB_BACKLIGHT, {})!;
    const x2 = runDerivador('bastidor_rectangular', JOB_X2, {})!;
    expect(x2.magnitudes.mlTotal).toBeCloseTo(x1.magnitudes.mlTotal * 2, 6);
    expect(x2.magnitudes.puntosSoldadura).toBe(x1.magnitudes.puntosSoldadura * 2);
    expect(x2.magnitudes.cenefaM2).toBeCloseTo(x1.magnitudes.cenefaM2 * 2, 6);
    expect(x2.despieces!.perfil_estructural.length).toBe(
      x1.despieces!.perfil_estructural.length * 2,
    );
    // La traza dibuja UN cartel (el 3D no cambia) y anota las unidades.
    expect(x2.traza!.unidades).toBe(2);
    expect((x2.traza!.estructura as { despieceMm: number[] }).despieceMm.length).toBe(
      x1.despieces!.perfil_estructural.length,
    );
  });

  it('sembrado LED: módulos/cable ×2, watts de la FUENTE por cartel', () => {
    const modulo = { paso: 250, potencia: 0.72 };
    const x1 = runDerivador('sembrado_led', JOB_BACKLIGHT, {}, modulo)!;
    const x2 = runDerivador('sembrado_led', JOB_X2, {}, modulo)!;
    expect(x2.magnitudes.modulos).toBe(x1.magnitudes.modulos * 2);
    expect(x2.magnitudes.cableMl).toBeCloseTo(x1.magnitudes.cableMl * 2, 6);
    // Cada cartel lleva SU fuente: el driver de selección no se duplica.
    expect(x2.magnitudes.wattsRequeridos).toBeCloseTo(
      x1.magnitudes.wattsRequeridos,
      6,
    );
  });
});

describe('bastidor_rectangular', () => {
  it('deriva el caso validado del prototipo: 20,28 ml y 16 soldaduras', () => {
    const r = runDerivador('bastidor_rectangular', JOB_BACKLIGHT, {
      tipoBastidor: 'doble',
      sepRefuerzoVcm: 100,
      sepRefuerzoHcm: 0,
    });
    expect(r).not.toBeNull();
    // Largos de corte reales con el caño default 40×40 (sin material en el
    // slot): parantes/conectores descuentan el lado, el refuerzo va sólo en
    // el contramarco y lleva 2 conectores.
    expect(r!.magnitudes.mlTotal).toBeCloseTo(17.12, 2);
    expect(r!.magnitudes.puntosSoldadura).toBe(16);
    expect(r!.magnitudes.cenefaM2).toBeCloseTo(1.71, 2);
    // El despiece para comprar barras enteras viaja por el resultado.
    expect(r!.despieces?.perfil_estructural?.length).toBeGreaterThan(0);
    const mlDespiece = r!.despieces!.perfil_estructural.reduce(
      (acc, mm) => acc + mm,
      0,
    );
    expect(mlDespiece / 1000).toBeCloseTo(r!.magnitudes.mlTotal, 1);
  });

  it('cajón doble sin profundidad → null (el guard corta, no hay $0 silencioso)', () => {
    const sinProfundidad = {
      cantidad: 1,
      piezas: [{ cantidad: 1, anchoMm: 2400, altoMm: 1200 }],
    } as unknown as JobContext;
    expect(
      runDerivador('bastidor_rectangular', sinProfundidad, {
        tipoBastidor: 'doble',
      }),
    ).toBeNull();
  });
});

describe('sembrado_led', () => {
  it('deriva 47 módulos para el backlight con módulo de 0,0625 m²', () => {
    const r = runDerivador(
      'sembrado_led',
      JOB_BACKLIGHT,
      { modoSembrado: 'area', densidad: 1 },
      { cobertura: 0.0625, potencia: 0.72 },
    );
    expect(r).not.toBeNull();
    expect(r!.magnitudes.modulos).toBe(47);
    expect(r!.magnitudes.watts).toBeCloseTo(33.84, 2);
    // Watts requeridos ×1,3: lo que la fuente tiene que cumplir (selector
    // MENOR_CAPACIDAD_QUE_CUMPLA).
    expect(r!.magnitudes.wattsRequeridos).toBeCloseTo(43.99, 1);
    expect(r!.magnitudes.cableMl).toBeGreaterThan(0);
  });

  it('módulo sin cobertura ni paso → null', () => {
    expect(
      runDerivador(
        'sembrado_led',
        JOB_BACKLIGHT,
        { modoSembrado: 'area', densidad: 1 },
        { potencia: 0.72 },
      ),
    ).toBeNull();
  });
});

describe('layout_ojales', () => {
  it('deriva cantidad y traza del caso del diseño: 1500×1000 c/500 = 10 ojales', () => {
    const job = {
      cantidad: 1,
      piezas: [{ cantidad: 1, anchoMm: 1500, altoMm: 1000 }],
    } as unknown as JobContext;
    const r = runDerivador('layout_ojales', job, {
      separacionMaxMm: 500,
      lados: ['superior', 'inferior', 'izquierdo', 'derecho'],
    });
    expect(r).not.toBeNull();
    expect(r!.magnitudes.ojales).toBe(10);
    // La traza lleva el layout para el visor de nesting.
    const layout = r!.traza?.ojalesLayout as Array<{
      posiciones: unknown[];
    }>;
    expect(layout).toHaveLength(1);
    expect(layout[0].posiciones).toHaveLength(10);
  });

  it('sin separación ni lados → null', () => {
    expect(runDerivador('layout_ojales', JOB_BACKLIGHT, {})).toBeNull();
  });

  it('sólo esquinas deriva cuatro ojales sin separación ni lados', () => {
    const r = runDerivador('layout_ojales', JOB_BACKLIGHT, {
      modoDistribucion: 'solo_esquinas',
    });
    expect(r?.magnitudes.ojales).toBe(4);
    expect(r?.traza?.ojalesConfig).toMatchObject({
      modoDistribucion: 'solo_esquinas',
      separacionMaxMm: 0,
    });
  });
});

describe('cache de derivaciones en el JobContext', () => {
  it('se crea una sola vez y sobrevive al shallow copy (duplicado por caras)', () => {
    const job = { cantidad: 1 } as unknown as JobContext;
    const cache = derivacionesDelJobContext(job);
    cache['paso-1'] = { magnitudes: { mlTotal: 7 } };
    // Shallow copy como duplicarJobContextPorCaras: comparte la referencia.
    const dup = { ...(job as unknown as Record<string, unknown>) };
    const cacheDup = derivacionesDelJobContext(dup as unknown as JobContext);
    expect(cacheDup['paso-1']?.magnitudes.mlTotal).toBe(7);
    // Lo que un paso escribe en el duplicado se ve desde el original.
    cacheDup['paso-2'] = { magnitudes: { modulos: 47 } };
    expect(
      derivacionesDelJobContext(job)['paso-2']?.magnitudes.modulos,
    ).toBe(47);
    expect(
      (job as unknown as Record<string, unknown>)[KEY_DERIVACIONES_POR_PASO],
    ).toBe(
      (dup as unknown as Record<string, unknown>)[KEY_DERIVACIONES_POR_PASO],
    );
  });
});
