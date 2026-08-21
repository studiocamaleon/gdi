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
