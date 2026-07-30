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

  // El run de la guillotina sale de los cortes, no de la productividad: si
  // publicamos un objeto con cortesTotales 0, el paso cuesta 0 minutos y
  // nadie se entera. Sin grilla no publicamos nada, y la validación
  // EXISTS_OUTPUT del paso corta la cotización.
  it('no publica cortes si el acomodo no dejó una grilla', () => {
    const outputs = calcularOutputsCanonicos(familia as never, {
      paso: {} as never,
      jobContext: {},
      nestingDispatch: {
        algorithm: 'grid-2d-single',
        // Es lo que deja el acomodo por área: colocó las piezas libremente.
        metricasRaw: { columnas: undefined, filas: undefined },
        visualConfig: { pieceBleedMm: 0 },
      } as never,
      cantidadEfectiva: 0,
    });

    expect(outputs.cortes_calculados).toBeNull();
  });

  it('tampoco los publica si el acomodo fue multi-medida', () => {
    const outputs = calcularOutputsCanonicos(familia as never, {
      paso: {} as never,
      jobContext: {},
      nestingDispatch: {
        algorithm: 'grid-2d-multi',
        metricasRaw: {},
        visualConfig: { pieceBleedMm: 0 },
      } as never,
      // Distinto de cero a propósito: si el output cae al fallback defensivo
      // del final, publica ESTE número y la guillotina lo lee como cortes.
      cantidadEfectiva: 50,
    });

    expect(outputs.cortes_calculados).toBeNull();
  });

  it('no publica cortes si el paso no hizo imposición propia', () => {
    // Impresión que hereda los pliegos de pre-prensa: declara el output
    // pero no corrió nesting. Si publicara algo, pisaría los cortes reales
    // que ya calculó pre-prensa.
    const outputs = calcularOutputsCanonicos(familia as never, {
      paso: {} as never,
      jobContext: {},
      nestingDispatch: null,
      cantidadEfectiva: 50,
    });

    expect(outputs.cortes_calculados).toBeNull();
  });
});
