import {
  FuenteVectorialError,
  normalizarFuenteVectorial,
} from './fuente-vectorial';

const dxfRectangulo = (unidad = 4) =>
  [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$INSUNITS',
    '70',
    String(unidad),
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
    '0',
    'LWPOLYLINE',
    '90',
    '4',
    '70',
    '1',
    '10',
    '0',
    '20',
    '0',
    '10',
    '100',
    '20',
    '0',
    '10',
    '100',
    '20',
    '50',
    '10',
    '0',
    '20',
    '50',
    '0',
    'ENDSEC',
    '0',
    'EOF',
  ].join('\n');

const dxfRectanguloConLineas = [
  '0',
  'SECTION',
  '2',
  'HEADER',
  '9',
  '$INSUNITS',
  '70',
  '4',
  '0',
  'ENDSEC',
  '0',
  'SECTION',
  '2',
  'ENTITIES',
  ...[
    [0, 0, 100, 0],
    [100, 50, 0, 50],
    [100, 0, 100, 50],
    [0, 50, 0, 0],
  ].flatMap(([x1, y1, x2, y2]) => [
    '0',
    'LINE',
    '8',
    'CORTE',
    '10',
    String(x1),
    '20',
    String(y1),
    '11',
    String(x2),
    '21',
    String(y2),
  ]),
  '0',
  'ENDSEC',
  '0',
  'EOF',
].join('\n');

describe('normalizarFuenteVectorial', () => {
  it('convierte un DXF milimétrico a la fuente canónica usada por GrafoNest', () => {
    const result = normalizarFuenteVectorial({
      contenido: dxfRectangulo(),
      nombreArchivo: 'rectangulo.dxf',
    });

    expect(result.formatoOrigen).toBe('DXF');
    expect(result.unidadDetectada).toBe('mm');
    expect(result.anchoSugeridoMm).toBeCloseTo(100);
    expect(result.altoSugeridoMm).toBeCloseTo(50);
    expect(result.relacionAltoAncho).toBeCloseTo(0.5);
    expect(result.svg).toContain('<svg');
  });

  it('respeta las unidades declaradas por el DXF', () => {
    const result = normalizarFuenteVectorial({
      contenido: dxfRectangulo(5),
      nombreArchivo: 'rectangulo.dxf',
    });

    expect(result.unidadDetectada).toBe('cm');
    expect(result.anchoSugeridoMm).toBeCloseTo(1_000);
    expect(result.altoSugeridoMm).toBeCloseTo(500);
  });

  it('reconstruye un contorno cerrado exportado como entidades LINE', () => {
    const result = normalizarFuenteVectorial({
      contenido: dxfRectanguloConLineas,
      nombreArchivo: 'lineas-separadas.dxf',
    });

    expect(result.relacionAltoAncho).toBeCloseTo(0.5);
    expect(result.svg).toMatch(/<path d="[^"]+Z"/);
  });

  it('conserva SVG existente sin migrar recetas', () => {
    const svg = '<svg viewBox="0 0 20 10"><path d="M0 0H20V10H0Z"/></svg>';
    const result = normalizarFuenteVectorial({
      contenido: svg,
      nombreArchivo: 'pieza.svg',
    });

    expect(result.formatoOrigen).toBe('SVG');
    expect(result.svg).toBe(svg);
    expect(result.relacionAltoAncho).toBeCloseTo(0.5);
  });

  it('rechaza extensiones que no son vectoriales', () => {
    expect(() =>
      normalizarFuenteVectorial({
        contenido: 'contenido',
        nombreArchivo: 'pieza.pdf',
      }),
    ).toThrow(FuenteVectorialError);
  });
});
