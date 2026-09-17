import { crearSvgPlacaDesdeNesting } from './nesting-svg';

describe('crearSvgPlacaDesdeNesting', () => {
  it('incluye los cortes interiores importados como operaciones y excluye hendido y referencias', () => {
    const exterior = [
      { x: 10, y: 10 },
      { x: 100, y: 10 },
      { x: 100, y: 100 },
      { x: 10, y: 100 },
    ];
    const interior = [
      { x: 30, y: 30 },
      { x: 60, y: 30 },
      { x: 60, y: 60 },
      { x: 30, y: 60 },
    ];
    const svg = crearSvgPlacaDesdeNesting(
      {
        substrates: [{ kind: 'sheet', widthMm: 1200, heightMm: 600 }],
        placements: [
          {
            pieceId: 'letra',
            meta: {
              contornos: [{ puntos: exterior }],
              operaciones: [
                { tipo: 'CORTE_INTERIOR', cerrada: true, puntos: interior },
                {
                  tipo: 'HENDIDO',
                  cerrada: false,
                  puntos: [
                    { x: 40, y: 50 },
                    { x: 50, y: 50 },
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
    expect(svg).toContain('M30 30');
    expect(svg).not.toContain('M40 50');
  });
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
