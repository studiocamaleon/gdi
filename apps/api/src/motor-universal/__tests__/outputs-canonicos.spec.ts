import { calcularOutputsCanonicos } from '../outputs-canonicos';

describe('calcularOutputsCanonicos - cortes_calculados', () => {
  const familia = {
    outputsCanonicos: ['cortes_calculados'],
  };

  function outputsForGrid(pieceBleedMm: number) {
    return calcularOutputsCanonicos(familia as never, {
      paso: {} as never,
      jobContext: {},
      nestingDispatch: {
        algorithm: 'grid-2d-single',
        metricasRaw: {
          columnas: 2,
          filas: 5,
        },
        visualConfig: {
          pieceBleedMm,
        },
      } as never,
      cantidadEfectiva: 0,
    });
  }

  it('calcula cortes de guillotina sin demasía', () => {
    expect(outputsForGrid(0).cortes_calculados).toMatchObject({
      columnas: 2,
      filas: 5,
      demasiaMm: 0,
      cortesTotales: 9,
      formula: 'columnas + filas + 2',
    });
  });

  it('calcula cortes de guillotina con demasía', () => {
    expect(outputsForGrid(2).cortes_calculados).toMatchObject({
      columnas: 2,
      filas: 5,
      demasiaMm: 2,
      cortesTotales: 14,
      formula: '2 * columnas + 2 * filas',
    });
  });
});
