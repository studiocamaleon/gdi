import {
  outputsCanonicosConocidos,
  outputsReferenciadosPorRegla,
  variablesDeRegla,
} from '../validacion-pre-pasada';

describe('outputsCanonicosConocidos', () => {
  it('junta los outputs que declaran las familias', () => {
    const outputs = outputsCanonicosConocidos();
    expect(outputs.has('pliegos_calculados')).toBe(true);
    expect(outputs.has('trabajos_manuales_realizados')).toBe(true);
    expect(outputs.has('ojales_colocados')).toBe(true);
    // Un campo del comercial NO es un output canónico.
    expect(outputs.has('cantidad')).toBe(false);
  });
});

describe('variablesDeRegla', () => {
  it('encuentra variables en cualquier nivel', () => {
    const regla = {
      and: [
        { '==': [{ var: 'uso' }, 'exterior'] },
        { '>': [{ var: 'cantidad' }, 10] },
      ],
    };
    expect(variablesDeRegla(regla).sort()).toEqual(['cantidad', 'uso']);
  });

  it('soporta la forma con default `{var: ["x", 0]}`', () => {
    expect(variablesDeRegla({ '>': [{ var: ['m2_calculados', 0] }, 5] })).toEqual(
      ['m2_calculados'],
    );
  });

  it('sin variables devuelve vacío', () => {
    expect(variablesDeRegla(null)).toEqual([]);
    expect(variablesDeRegla({ '==': [1, 1] })).toEqual([]);
  });
});

describe('outputsReferenciadosPorRegla', () => {
  /** El caso seguro: la regla mira datos que el comercial cargó. */
  it('una regla sobre datos del comercial no referencia outputs', () => {
    expect(
      outputsReferenciadosPorRegla({
        '==': [{ var: 'uso' }, 'exterior'],
      }),
    ).toEqual([]);
  });

  /**
   * El caso peligroso: en la pre-pasada `pliegos_calculados` todavía no existe,
   * la regla daría falso y el refuerzo no se aplicaría en silencio.
   */
  it('detecta una regla que mira un output canónico', () => {
    expect(
      outputsReferenciadosPorRegla({
        '>': [{ var: 'pliegos_calculados' }, 10],
      }),
    ).toEqual(['pliegos_calculados']);
  });

  it('detecta también una ruta con punto', () => {
    expect(
      outputsReferenciadosPorRegla({
        '>': [{ var: 'm2_calculados.total' }, 1],
      }),
    ).toEqual(['m2_calculados']);
  });

  it('reporta cada output una sola vez', () => {
    expect(
      outputsReferenciadosPorRegla({
        and: [
          { '>': [{ var: 'm2_calculados' }, 1] },
          { '<': [{ var: 'm2_calculados' }, 9] },
        ],
      }),
    ).toEqual(['m2_calculados']);
  });
});
