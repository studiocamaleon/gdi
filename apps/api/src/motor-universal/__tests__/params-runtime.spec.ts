import {
  camposEditablesComercial,
  paramsEfectivos,
} from '../params-runtime';

const PASO_REFUERZO = {
  subTipo: 'refuerzo',
  lados: ['superior', 'inferior', 'izquierdo', 'derecho'],
  demasiaMm: 40,
  camposEditablesComercial: ['lados'],
};

describe('camposEditablesComercial', () => {
  it('lee los campos que el modelador dejó abiertos', () => {
    expect(camposEditablesComercial(PASO_REFUERZO)).toEqual(['lados']);
  });

  it('sin declaración, ninguno', () => {
    expect(camposEditablesComercial({ lados: ['superior'] })).toEqual([]);
    expect(camposEditablesComercial(null)).toEqual([]);
  });

  it('descarta valores que no son strings', () => {
    expect(
      camposEditablesComercial({ camposEditablesComercial: ['lados', 3, null] }),
    ).toEqual(['lados']);
  });
});

describe('paramsEfectivos', () => {
  it('sin elección del comercial queda la sugerencia del modelador', () => {
    expect(paramsEfectivos(PASO_REFUERZO, {})).toMatchObject({
      lados: ['superior', 'inferior', 'izquierdo', 'derecho'],
      demasiaMm: 40,
    });
  });

  it('el comercial pisa el campo abierto', () => {
    expect(
      paramsEfectivos(PASO_REFUERZO, { lados: ['superior', 'inferior'] }),
    ).toMatchObject({ lados: ['superior', 'inferior'], demasiaMm: 40 });
  });

  /**
   * El punto de la whitelist: sin esto cualquiera podría cambiar por API la
   * demasía o el sub-tipo, que el modelador quiso fijos.
   */
  it('IGNORA un campo que el modelador NO abrió', () => {
    const r = paramsEfectivos(PASO_REFUERZO, {
      demasiaMm: 5,
      subTipo: 'bolsillo',
    });
    expect(r.demasiaMm).toBe(40);
    expect(r.subTipo).toBe('refuerzo');
  });

  it('sin campos abiertos, el runtime no toca nada', () => {
    const sinAbrir = { lados: ['superior'], demasiaMm: 40 };
    expect(paramsEfectivos(sinAbrir, { lados: [] })).toEqual(sinAbrir);
  });

  it('null o undefined dejan la sugerencia', () => {
    expect(paramsEfectivos(PASO_REFUERZO, { lados: null }).lados).toEqual([
      'superior',
      'inferior',
      'izquierdo',
      'derecho',
    ]);
  });

  /** Vaciar los lados es una ELECCIÓN: se respeta y el motor corta después. */
  it('respeta un array vacío elegido por el comercial', () => {
    expect(paramsEfectivos(PASO_REFUERZO, { lados: [] }).lados).toEqual([]);
  });

  it('no muta el objeto original', () => {
    const original = { ...PASO_REFUERZO };
    paramsEfectivos(original, { lados: ['superior'] });
    expect(original.lados).toEqual([
      'superior',
      'inferior',
      'izquierdo',
      'derecho',
    ]);
  });
});
