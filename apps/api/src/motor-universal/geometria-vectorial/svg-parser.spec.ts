import { analizarSvgFabricacion, SvgFabricacionError } from './svg-parser';

describe('analizarSvgFabricacion', () => {
  it('convierte curvas y huecos a geometría canónica escalada', () => {
    const svg = `
      <svg viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" d="M0 0H100V50H0Z M20 10H40V30H20Z" />
        <path d="M60 10 C80 0 90 20 80 40 C70 50 50 35 60 10 Z" />
      </svg>`;
    const result = analizarSvgFabricacion({ svg, anchoFinalMm: 200 });

    expect(result.geometria.anchoMm).toBe(200);
    expect(result.geometria.altoMm).toBe(100);
    expect(result.geometria.piezas).toHaveLength(2);
    expect(result.geometria.piezas[0].contornos.some((c) => c.esHueco)).toBe(
      true,
    );
    expect(result.geometria.perimetroTotalMm).toBeGreaterThan(600);
    expect(result.geometria.hashFuente).toHaveLength(64);
  });

  it('rechaza texto no convertido a curvas', () => {
    expect(() =>
      analizarSvgFabricacion({
        svg: '<svg viewBox="0 0 10 10"><text x="0" y="5">A</text></svg>',
        anchoFinalMm: 100,
      }),
    ).toThrow(SvgFabricacionError);
  });

  it('rechaza una altura que deformaría el vector', () => {
    expect(() =>
      analizarSvgFabricacion({
        svg: '<svg viewBox="0 0 100 50"><rect width="100" height="50" /></svg>',
        anchoFinalMm: 200,
        altoFinalMm: 150,
      }),
    ).toThrow('No se deforma el diseño automáticamente');
  });

  it('cierra subtrazados rellenos aunque el exportador omita Z', () => {
    const svg = `
      <svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 0H40V40H0 M60 0H100V40H60" />
      </svg>`;

    const result = analizarSvgFabricacion({ svg, anchoFinalMm: 100 });
    expect(result.geometria.piezas).toHaveLength(2);
    expect(result.geometria.areaTotalMm2).toBeCloseTo(3_200, 3);
  });

  it('conserva el origen de cada pieza dentro de la composición completa', () => {
    const svg = `
      <svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="10" width="20" height="20" />
        <rect x="80" y="10" width="20" height="20" />
      </svg>`;

    const result = analizarSvgFabricacion({ svg, anchoFinalMm: 100 });

    expect(result.geometria.piezas).toHaveLength(2);
    expect(result.geometria.piezas[0]).toMatchObject({
      origenXmm: 0,
      origenYmm: 0,
    });
    expect(result.geometria.piezas[1]).toMatchObject({
      origenXmm: 80,
      origenYmm: 0,
    });
  });

  it('identifica objetos seleccionables aunque el SVG no tenga colores ni ids', () => {
    const svg = `
      <svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="40" height="40" />
        <circle cx="80" cy="20" r="20" />
      </svg>`;

    const result = analizarSvgFabricacion({ svg, anchoFinalMm: 100 });

    expect(result.geometria.piezas.map((pieza) => pieza.objetoFuente)).toEqual([
      {
        id: 'objeto-1',
        grupoRuta: [],
        orden: 0,
      },
      {
        id: 'objeto-2',
        grupoRuta: [],
        orden: 1,
      },
    ]);
  });

  it('conserva color, etiqueta y grupos como ayudas opcionales de selección', () => {
    const svg = `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <g id="base" fill="#111111">
          <path id="silueta" d="M0 0H100V100H0Z" />
        </g>
        <g id="frente">
          <circle aria-label="isotipo" fill="#ffb43c" cx="50" cy="50" r="30" />
        </g>
      </svg>`;

    const result = analizarSvgFabricacion({ svg, anchoFinalMm: 100 });

    expect(result.geometria.piezas[0].objetoFuente).toEqual({
      id: 'objeto-1',
      etiqueta: 'silueta',
      grupoRuta: ['base'],
      colorRelleno: '#111111',
      orden: 0,
    });
    expect(result.geometria.piezas[1].objetoFuente).toEqual({
      id: 'objeto-2',
      etiqueta: 'isotipo',
      grupoRuta: ['frente'],
      colorRelleno: '#ffb43c',
      orden: 1,
    });
  });

  it('mantiene el orden visual aunque se intercalen tipos de elementos', () => {
    const svg = `
      <svg viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg">
        <rect id="primero" x="0" width="30" height="40" />
        <path id="segundo" d="M40 0H70V40H40Z" />
        <circle id="tercero" cx="100" cy="20" r="20" />
      </svg>`;

    const result = analizarSvgFabricacion({ svg, anchoFinalMm: 120 });

    expect(
      result.geometria.piezas.map(
        (pieza) => pieza.objetoFuente?.etiqueta,
      ),
    ).toEqual(['primero', 'segundo', 'tercero']);
  });

  it('agrupa subtrazados del mismo objeto para seleccionarlos juntos', () => {
    const svg = `
      <svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg">
        <path id="letras" d="M0 0H40V40H0Z M60 0H100V40H60Z" />
      </svg>`;

    const result = analizarSvgFabricacion({ svg, anchoFinalMm: 100 });

    expect(result.geometria.piezas).toHaveLength(2);
    expect(
      new Set(
        result.geometria.piezas.map(
          (pieza) => pieza.objetoFuente?.id,
        ),
      ),
    ).toEqual(new Set(['objeto-1']));
  });

  it('no cierra automáticamente un path que sólo tiene trazo', () => {
    const svg = `
      <svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg">
        <path fill="none" stroke="black" d="M0 0H40V40H0" />
      </svg>`;

    expect(() => analizarSvgFabricacion({ svg, anchoFinalMm: 100 })).toThrow(
      'no contiene contornos cerrados',
    );
  });

  it('simplifica vectores con muchos nodos sin rechazar una geometría válida', () => {
    const puntos = Array.from({ length: 20_000 }, (_, index) => {
      const angle = (index / 20_000) * Math.PI * 2;
      return `${(500 + Math.cos(angle) * 480).toFixed(3)},${(
        500 +
        Math.sin(angle) * 480
      ).toFixed(3)}`;
    }).join(' ');
    const svg = `<svg viewBox="0 0 1000 1000"><polygon points="${puntos}" /></svg>`;

    const result = analizarSvgFabricacion({ svg, anchoFinalMm: 1_000 });
    const totalPuntos = result.geometria.piezas.reduce(
      (total, pieza) =>
        total + pieza.contornos.reduce((sum, c) => sum + c.puntos.length, 0),
      0,
    );

    expect(totalPuntos).toBeLessThanOrEqual(8_000);
    expect(result.diagnosticos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: 'vector_simplificado' }),
      ]),
    );
    expect(result.geometria.areaTotalMm2).toBeCloseTo(Math.PI * 500 ** 2, -3);
  });
});
