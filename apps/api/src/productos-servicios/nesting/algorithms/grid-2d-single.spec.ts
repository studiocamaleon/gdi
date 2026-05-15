import { nestGrid2DSingle } from './grid-2d-single';

describe('nestGrid2DSingle', () => {
  it('respeta demasía por pieza derivada como margen exterior y separación interna', () => {
    const pieceBleedMm = 2;
    const result = nestGrid2DSingle(
      { id: 'pieza_principal', widthMm: 90, heightMm: 50, quantity: 1 },
      {
        kind: 'sheet',
        widthMm: 210,
        heightMm: 297,
        margins: {
          leftMm: pieceBleedMm,
          rightMm: pieceBleedMm,
          topMm: pieceBleedMm,
          bottomMm: pieceBleedMm,
        },
      },
      {
        separationHMm: pieceBleedMm * 2,
        separationVMm: pieceBleedMm * 2,
        allowRotation: false,
      },
    );

    expect(result.metrics.piezasPorSustrato).toBe(10);
    expect(result.metrics.columnas).toBe(2);
    expect(result.metrics.filas).toBe(5);
    expect(result.placements[0]).toMatchObject({ xMm: 2, yMm: 2 });
    expect(result.placements[1]).toMatchObject({ xMm: 96, yMm: 2 });
    expect(result.placements[2]).toMatchObject({ xMm: 2, yMm: 56 });
  });
});
