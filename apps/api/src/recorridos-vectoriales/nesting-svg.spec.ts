import { crearSvgPlacaDesdeNesting } from './nesting-svg';

describe('crearSvgPlacaDesdeNesting', () => {
  it('conserva los huecos como subcontornos de la misma pieza', () => {
    const svg = crearSvgPlacaDesdeNesting(
      {
        algorithm: 'irregular-svg-v1',
        substrates: [{ kind: 'sheet', widthMm: 1200, heightMm: 600 }],
        placements: [
          {
            pieceId: 'letra-p',
            substrateIndex: 0,
            meta: {
              contornos: [
                {
                  puntos: [
                    { x: 10, y: 10 },
                    { x: 100, y: 10 },
                    { x: 100, y: 100 },
                    { x: 10, y: 100 },
                  ],
                },
                {
                  esHueco: true,
                  puntos: [
                    { x: 30, y: 30 },
                    { x: 60, y: 30 },
                    { x: 60, y: 60 },
                    { x: 30, y: 60 },
                  ],
                },
              ],
            },
          },
        ],
      },
      0,
    );

    expect(svg.match(/<path\b/g)).toHaveLength(1);
    expect(svg.match(/\bM/g)).toHaveLength(2);
    expect(svg).toContain('fill-rule="evenodd"');
  });

  it('agrupa los contornos contenidos de una composición original', () => {
    const svg = crearSvgPlacaDesdeNesting(
      {
        estrategiaDisposicion: 'composicion_original',
        substrates: [{ kind: 'sheet', widthMm: 1200, heightMm: 600 }],
        placements: [
          {
            pieceId: 'aro',
            substrateIndex: 0,
            meta: {
              contornos: [
                {
                  puntos: [
                    { x: 10, y: 10 },
                    { x: 100, y: 10 },
                    { x: 100, y: 100 },
                    { x: 10, y: 100 },
                  ],
                },
                {
                  esHueco: true,
                  puntos: [
                    { x: 20, y: 20 },
                    { x: 90, y: 20 },
                    { x: 90, y: 90 },
                    { x: 20, y: 90 },
                  ],
                },
              ],
            },
          },
          {
            pieceId: 'isla-interior',
            substrateIndex: 0,
            meta: {
              contornos: [
                {
                  puntos: [
                    { x: 40, y: 40 },
                    { x: 70, y: 40 },
                    { x: 70, y: 70 },
                    { x: 40, y: 70 },
                  ],
                },
              ],
            },
          },
        ],
      },
      0,
    );

    expect(svg.match(/data-piece-id="composicion-placa-1"/g)).toHaveLength(2);
  });
});
