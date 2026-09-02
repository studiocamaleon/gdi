import { MAX_GRID_MULTI_INSTANCES, nestGrid2DMulti } from './grid-2d-multi';

const sheet = { kind: 'sheet' as const, widthMm: 100, heightMm: 100 };

describe('nestGrid2DMulti', () => {
  it('rechaza todo el layout si una pieza desborda la placa', () => {
    const result = nestGrid2DMulti(
      [
        { id: 'valida', widthMm: 20, heightMm: 20, quantity: 1 },
        { id: 'imposible', widthMm: 120, heightMm: 20, quantity: 1 },
      ],
      sheet,
      { allowRotation: false },
    );

    expect(result.placements).toEqual([]);
    expect(result.substrates).toEqual([]);
  });

  it('acepta una pieza que entra únicamente rotada', () => {
    const result = nestGrid2DMulti(
      [{ id: 'rotada', widthMm: 120, heightMm: 80, quantity: 1 }],
      { kind: 'sheet', widthMm: 100, heightMm: 130 },
      { allowRotation: true },
    );

    expect(result.placements).toHaveLength(1);
    expect(result.placements[0]).toMatchObject({
      widthMm: 80,
      heightMm: 120,
      rotated: true,
    });
  });

  it('corta de forma segura cantidades que no pueden representarse', () => {
    const result = nestGrid2DMulti(
      [
        {
          id: 'masivo',
          widthMm: 1,
          heightMm: 1,
          quantity: MAX_GRID_MULTI_INSTANCES + 1,
        },
      ],
      sheet,
    );

    expect(result.placements).toEqual([]);
    expect(result.substrates).toEqual([]);
  });

  it('optimiza sobre el lado largo sin depender del orden ancho/alto', () => {
    const pieces = [
      { id: 'principal', widthMm: 700, heightMm: 400, quantity: 1 },
      { id: 'secundaria', widthMm: 500, heightMm: 400, quantity: 1 },
    ];
    const options = {
      allowRotation: true,
      separationHMm: 6,
      separationVMm: 6,
    };
    const margins = { leftMm: 5, rightMm: 5, topMm: 5, bottomMm: 5 };

    const apaisada = nestGrid2DMulti(
      pieces,
      { kind: 'sheet', widthMm: 1300, heightMm: 900, margins },
      options,
    );
    const vertical = nestGrid2DMulti(
      pieces.map((piece) => ({
        ...piece,
        widthMm: piece.heightMm,
        heightMm: piece.widthMm,
      })),
      { kind: 'sheet', widthMm: 900, heightMm: 1300, margins },
      options,
    );

    expect(apaisada.perSubstrate[0].consumedLengthMm).toBe(710);
    expect(vertical.perSubstrate[0].consumedLengthMm).toBe(710);
    expect(apaisada.placements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pieceId: 'principal',
          widthMm: 700,
          heightMm: 400,
          rotated: false,
        }),
        expect.objectContaining({
          pieceId: 'secundaria',
          widthMm: 500,
          heightMm: 400,
          rotated: false,
        }),
      ]),
    );
    expect(apaisada.substrates).toHaveLength(vertical.substrates.length);
    expect(
      apaisada.placements.map((placement) => ({
        pieceId: placement.pieceId,
        xMm: placement.yMm,
        yMm: placement.xMm,
        widthMm: placement.heightMm,
        heightMm: placement.widthMm,
      })),
    ).toEqual(
      vertical.placements.map((placement) => ({
        pieceId: placement.pieceId,
        xMm: placement.xMm,
        yMm: placement.yMm,
        widthMm: placement.widthMm,
        heightMm: placement.heightMm,
      })),
    );
  });
});
