import {
  FuenteVectorialError,
  normalizarFuenteVectorial,
} from './fuente-vectorial';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analizarSvgFabricacion } from './svg-parser';

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
  const exhibidor = readFileSync(
    join(__dirname, 'fixtures/exhibidor-capa-congelada.dxf'),
    'utf8',
  );

  it('excluye el rectángulo de la capa congelada y mide sólo el exhibidor visible', () => {
    const result = normalizarFuenteVectorial({
      contenido: exhibidor,
      nombreArchivo: 'exhibidor.dxf',
    });
    expect(result.svg).toContain('GRAFICA');
    expect(result.svg).not.toContain('CORTE_2');
    expect(result.anchoSugeridoMm).toBeCloseTo(293.065124512);
    expect(result.altoSugeridoMm).toBeCloseTo(499.436212891);
    expect(result.unidadDetectada).toBeNull();
    expect(result.medidasOriginales).toEqual({
      ancho: result.anchoSugeridoMm,
      alto: result.altoSugeridoMm,
    });
    expect(result.diagnosticos.map((d) => d.codigo)).toEqual([
      'dxf_capas_ocultas_omitidas',
      'dxf_unidad_no_declarada',
    ]);
    const geometria = analizarSvgFabricacion({
      svg: result.svg,
      anchoFinalMm: (result.anchoSugeridoMm * 25.4) / 72,
    }).geometria;
    expect(geometria.piezas).toHaveLength(1);
    expect(geometria.anchoMm).toBeCloseTo(103.387, 2);
    expect(geometria.altoMm).toBeCloseTo(176.19, 2);
  });

  it.each([
    { nombre: 'apagada', flags: 0, color: -7, visible: false },
    { nombre: 'bloqueada', flags: 4, color: 7, visible: true },
    { nombre: 'visible', flags: 0, color: 7, visible: true },
  ])(
    'respeta la capa $nombre sin confundir bloqueo con visibilidad',
    ({ flags, color, visible }) => {
      const contenido = exhibidor.replace(
        /(2\r?\nCORTE_2\r?\n\s*70\r?\n)\s*1(\r?\n\s*62\r?\n)\s*7/,
        `$1${flags}$2${color}`,
      );
      expect(contenido).not.toBe(exhibidor);
      const result = normalizarFuenteVectorial({
        contenido,
        nombreArchivo: 'exhibidor.dxf',
      });
      expect(result.svg.includes('CORTE_2')).toBe(visible);
      expect(result.anchoSugeridoMm).toBeCloseTo(
        visible ? 462.34349 : 293.06512,
      );
    },
  );

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
