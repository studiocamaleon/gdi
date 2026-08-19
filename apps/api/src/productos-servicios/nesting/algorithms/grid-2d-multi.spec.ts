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
});
