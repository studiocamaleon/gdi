/**
 * Niveles del paso: el motor resuelve cuál corre y aplica sus overrides sobre
 * el paso ANTES de calcular, para que el resto vea un solo origen de verdad.
 * Ver docs/cargos-por-paso-analisis-y-plan.md §8.
 */
import {
  NIVEL_PERSONALIZADO,
  aplicarNivelAlPaso,
  leerNivelesPaso,
  nivelPasoKey,
  resolverNivelPaso,
} from '../niveles-paso';

const PARAMS = {
  productivityValue: 4,
  tiemposExtra: [
    { id: 'traslado', etiqueta: 'Traslado', minutos: 90, dotacion: 2 },
  ],
  niveles: {
    etiqueta: '¿Dónde se coloca?',
    opciones: [
      {
        codigo: 'taller',
        nombre: 'En taller',
        esDefault: true,
        overrides: { tiemposExtraMin: { traslado: 0 } },
      },
      {
        codigo: 'zona_2',
        nombre: 'Zona 2',
        overrides: { tiemposExtraMin: { traslado: 240 }, dotacion: 2 },
      },
    ],
  },
};

const PASO = {
  configPasoId: 'cfg-1',
  paramsPasoJson: PARAMS,
  dotacionOperarios: 1,
  tiempoFijoOverrideMin: null,
};

describe('resolverNivelPaso', () => {
  it('sin elección corre el marcado por defecto', () => {
    expect(resolverNivelPaso(PARAMS, 'cfg-1', {})?.codigo).toBe('taller');
  });

  it('gana el que eligió el comercial', () => {
    expect(
      resolverNivelPaso(PARAMS, 'cfg-1', {
        [nivelPasoKey('cfg-1')]: 'zona_2',
      })?.codigo,
    ).toBe('zona_2');
  });

  it('un código que ya no existe cae al default en vez de romper', () => {
    expect(
      resolverNivelPaso(PARAMS, 'cfg-1', {
        [nivelPasoKey('cfg-1')]: 'zona_borrada',
      })?.codigo,
    ).toBe('taller');
  });

  it('"Personalizado" corre SIN nivel: el tiempo lo puso el comercial', () => {
    // Si cayera al default, sus overrides se aplicarían por la espalda a un
    // trabajo cuyo tiempo el comercial cargó a mano.
    expect(
      resolverNivelPaso(PARAMS, 'cfg-1', {
        [nivelPasoKey('cfg-1')]: NIVEL_PERSONALIZADO,
      }),
    ).toBeNull();
  });

  it('sin niveles declarados no hay nivel que resolver', () => {
    expect(resolverNivelPaso({ productivityValue: 4 }, 'cfg-1', {})).toBeNull();
  });
});

describe('aplicarNivelAlPaso', () => {
  it('pisa los minutos del bloque por id y deja el resto intacto', () => {
    const paso = aplicarNivelAlPaso(PASO, {
      [nivelPasoKey('cfg-1')]: 'zona_2',
    });
    const params = paso.paramsPasoJson as Record<string, unknown>;
    const bloques = params.tiemposExtra as Array<Record<string, unknown>>;
    expect(bloques[0].minutos).toBe(240);
    expect(bloques[0].dotacion).toBe(2);
    expect(params.productivityValue).toBe(4);
    expect(paso.dotacionOperarios).toBe(2);
  });

  it('un bloque en 0 es un override legítimo ("en taller no hay traslado")', () => {
    const paso = aplicarNivelAlPaso(PASO, {});
    const bloques = (paso.paramsPasoJson as Record<string, unknown>)
      .tiemposExtra as Array<Record<string, unknown>>;
    expect(bloques[0].minutos).toBe(0);
  });

  it('no muta el paso cargado', () => {
    aplicarNivelAlPaso(PASO, { [nivelPasoKey('cfg-1')]: 'zona_2' });
    const original = (PASO.paramsPasoJson as Record<string, unknown>)
      .tiemposExtra as Array<Record<string, unknown>>;
    expect(original[0].minutos).toBe(90);
    expect(PASO.dotacionOperarios).toBe(1);
  });

  it('con "Personalizado" el paso queda como está', () => {
    const paso = aplicarNivelAlPaso(PASO, {
      [nivelPasoKey('cfg-1')]: NIVEL_PERSONALIZADO,
    });
    expect(paso).toBe(PASO);
  });
});

describe('leerNivelesPaso', () => {
  it('un solo nivel no es una decisión', () => {
    expect(
      leerNivelesPaso({
        niveles: { opciones: [{ codigo: 'a', nombre: 'A' }] },
      }),
    ).toBeNull();
  });

  it('descarta códigos duplicados en vez de ofrecer dos opciones iguales', () => {
    const config = leerNivelesPaso({
      niveles: {
        opciones: [
          { codigo: 'a', nombre: 'A' },
          { codigo: 'a', nombre: 'A bis' },
          { codigo: 'b', nombre: 'B' },
        ],
      },
    });
    expect(config?.opciones.map((o) => o.codigo)).toEqual(['a', 'b']);
  });
});
