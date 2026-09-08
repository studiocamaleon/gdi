import { ControlConsolidacionProduccion } from '../consolidacion-produccion';

const control = (aristas: string[][]) =>
  new ControlConsolidacionProduccion(
    aristas.map(([desdeClave, haciaClave]) => ({ desdeClave, haciaClave })),
  );

describe('precedencias de operaciones compartidas', () => {
  it.each([
    [['a', 'b']],
    [
      ['a', 'control'],
      ['control', 'otro'],
      ['otro', 'b'],
    ],
  ])('rechaza dependencias directas y transitivas (%j)', (...aristas) => {
    expect(control(aristas).motivoIncompatible(['a', 'b'])).toMatch(
      /precedencias/,
    );
  });

  it('acepta impresión y corte de ramas paralelas', () => {
    const grafo = control([
      ['inicio', 'i1'],
      ['inicio', 'i2'],
      ['i1', 'c1'],
      ['i2', 'c2'],
      ['c1', 'final'],
      ['c2', 'final'],
    ]);
    grafo.confirmar(['i1', 'i2']);
    expect(grafo.motivoIncompatible(['c1', 'c2'])).toBeUndefined();
    grafo.confirmar(['c1', 'c2']);
  });

  it('detecta ciclos conjuntos aunque cada grupo por separado sea válido', () => {
    const aristas = [
      ['i1', 'c1'],
      ['c2', 'i2'],
    ];
    const grafo = control(aristas);
    expect(control(aristas).motivoIncompatible(['c1', 'c2'])).toBeUndefined();
    grafo.confirmar(['i1', 'i2']);
    expect(grafo.motivoIncompatible(['c1', 'c2'])).toMatch(/precedencias/);
  });
});
