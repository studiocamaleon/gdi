import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nestearGeometriaIrregular } from './nesting-irregular';
import { segmentarPiezasConEncastres } from './segmentacion-encastres';
import { analizarSvgFabricacion } from './svg-parser';
import type { GeometriaVectorialCanonica, PiezaVectorial } from './tipos';

const triangle: GeometriaVectorialCanonica = {
  schemaVersion: 1,
  anchoMm: 60,
  altoMm: 60,
  piezas: [
    {
      id: 'triangulo',
      anchoMm: 60,
      altoMm: 60,
      areaMm2: 1_800,
      perimetroMm: 204.85,
      contornos: [
        {
          esHueco: false,
          puntos: [
            { x: 0, y: 60 },
            { x: 30, y: 0 },
            { x: 60, y: 60 },
          ],
        },
      ],
    },
  ],
  areaTotalMm2: 1_800,
  perimetroTotalMm: 204.85,
  hashFuente: 'fixture',
};

describe('nestearGeometriaIrregular', () => {
  const composicionSeparada: GeometriaVectorialCanonica = {
    schemaVersion: 1,
    anchoMm: 100,
    altoMm: 20,
    piezas: [
      {
        id: 'izquierda',
        origenXmm: 0,
        origenYmm: 0,
        anchoMm: 20,
        altoMm: 20,
        areaMm2: 400,
        perimetroMm: 80,
        contornos: [
          {
            esHueco: false,
            puntos: [
              { x: 0, y: 0 },
              { x: 20, y: 0 },
              { x: 20, y: 20 },
              { x: 0, y: 20 },
            ],
          },
        ],
      },
      {
        id: 'derecha',
        origenXmm: 80,
        origenYmm: 0,
        anchoMm: 20,
        altoMm: 20,
        areaMm2: 400,
        perimetroMm: 80,
        contornos: [
          {
            esHueco: false,
            puntos: [
              { x: 0, y: 0 },
              { x: 20, y: 0 },
              { x: 20, y: 20 },
              { x: 0, y: 20 },
            ],
          },
        ],
      },
    ],
    areaTotalMm2: 800,
    perimetroTotalMm: 160,
    hashFuente: 'composicion-separada',
  };

  it('rechaza una pieza sobredimensionada cuando la tecnología no permite segmentarla', () => {
    expect(() =>
      nestearGeometriaIrregular({
        geometria: triangle,
        cantidad: 1,
        anchoPlacaMm: 50,
        altoPlacaMm: 50,
        permitirRotacion: true,
        permitirSegmentacion: false,
      }),
    ).toThrow(/no entra completa/i);
  });

  it('conserva posiciones y orientación cuando el SVG completo entra', () => {
    const result = nestearGeometriaIrregular({
      geometria: composicionSeparada,
      cantidad: 1,
      anchoPlacaMm: 120,
      altoPlacaMm: 60,
      margenMm: 5,
      permitirRotacion: true,
      preservarComposicionOriginalSiEntra: true,
    });

    expect(result.estrategiaDisposicion).toBe('composicion_original');
    expect(result.placas).toBe(1);
    expect(result.uniones).toHaveLength(0);
    expect(result.placements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pieceId: 'izquierda',
          xMm: 10,
          yMm: 20,
          rotacion: 0,
        }),
        expect.objectContaining({
          pieceId: 'derecha',
          xMm: 90,
          yMm: 20,
          rotacion: 0,
        }),
      ]),
    );
  });

  it('reserva un negativo completo por cada copia del cartel', () => {
    const result = nestearGeometriaIrregular({
      geometria: composicionSeparada,
      cantidad: 2,
      anchoPlacaMm: 120,
      altoPlacaMm: 60,
      margenMm: 5,
      preservarComposicionOriginalSiEntra: true,
    });

    expect(result.placas).toBe(2);
    expect(result.placements).toHaveLength(4);
    expect(
      new Set(result.placements.map((item) => item.substrateIndex)),
    ).toEqual(new Set([0, 1]));
  });

  it('vuelve al nesting optimizado cuando la composición completa no entra', () => {
    const result = nestearGeometriaIrregular({
      geometria: { ...composicionSeparada, anchoMm: 130 },
      cantidad: 1,
      anchoPlacaMm: 120,
      altoPlacaMm: 60,
      margenMm: 5,
      preservarComposicionOriginalSiEntra: true,
    });

    expect(result.estrategiaDisposicion).toBe('nesting_optimizado');
    expect(result.placements).toHaveLength(2);
    expect(result.placements[1].xMm).toBeLessThan(90);
  });

  it('acomoda copias completas y conserva cantidad comercial separada', () => {
    const result = nestearGeometriaIrregular({
      geometria: triangle,
      cantidad: 2,
      anchoPlacaMm: 120,
      altoPlacaMm: 60,
      separacionMm: 0,
      permitirRotacion: false,
    });

    expect(result.placas).toBe(1);
    expect(result.placements).toHaveLength(2);
    expect(result.aprovechamientoPct).toBe(50);
  });

  it('prefiere una orientación cardinal cuando inclinar no ahorra placas', () => {
    const result = nestearGeometriaIrregular({
      geometria: triangle,
      cantidad: 1,
      anchoPlacaMm: 100,
      altoPlacaMm: 100,
      permitirRotacion: true,
    });

    expect(result.placas).toBe(1);
    expect(result.placements[0].rotacion % 90).toBe(0);
  });

  it('conserva una rotación libre cuando es la única forma de evitar otra placa', () => {
    const diamante: GeometriaVectorialCanonica = {
      schemaVersion: 1,
      anchoMm: 100,
      altoMm: 100,
      piezas: [
        {
          id: 'diamante',
          anchoMm: 100,
          altoMm: 100,
          areaMm2: 5_000,
          perimetroMm: 282.843,
          contornos: [
            {
              esHueco: false,
              puntos: [
                { x: 50, y: 0 },
                { x: 100, y: 50 },
                { x: 50, y: 100 },
                { x: 0, y: 50 },
              ],
            },
          ],
        },
      ],
      areaTotalMm2: 5_000,
      perimetroTotalMm: 282.843,
      hashFuente: 'diamante',
    };
    const result = nestearGeometriaIrregular({
      geometria: diamante,
      cantidad: 1,
      anchoPlacaMm: 80,
      altoPlacaMm: 80,
      permitirRotacion: true,
    });

    expect(result.placas).toBe(1);
    expect(result.placements[0].rotacion % 90).not.toBe(0);
  });

  it('no descarta 180° cuando comparte caja exterior con 0°', () => {
    const medioRectangulo: GeometriaVectorialCanonica = {
      schemaVersion: 1,
      anchoMm: 80,
      altoMm: 50,
      piezas: [
        {
          id: 'triangulo-recto',
          anchoMm: 80,
          altoMm: 50,
          areaMm2: 2_000,
          perimetroMm: 224.34,
          contornos: [
            {
              esHueco: false,
              puntos: [
                { x: 0, y: 0 },
                { x: 80, y: 0 },
                { x: 0, y: 50 },
              ],
            },
          ],
        },
      ],
      areaTotalMm2: 2_000,
      perimetroTotalMm: 224.34,
      hashFuente: 'medio-rectangulo',
    };
    const result = nestearGeometriaIrregular({
      geometria: medioRectangulo,
      cantidad: 2,
      anchoPlacaMm: 80,
      altoPlacaMm: 50,
      permitirRotacion: true,
    });

    expect(result.placas).toBe(1);
    expect(result.placements.map((item) => item.rotacion)).toContain(180);
  });

  it('puede ubicar una pieza dentro de un hueco real del vector', () => {
    const geometriaConAro: GeometriaVectorialCanonica = {
      schemaVersion: 1,
      anchoMm: 100,
      altoMm: 100,
      piezas: [
        {
          id: 'aro',
          anchoMm: 100,
          altoMm: 100,
          areaMm2: 8_400,
          perimetroMm: 560,
          contornos: [
            {
              esHueco: false,
              puntos: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 },
              ],
            },
            {
              esHueco: true,
              puntos: [
                { x: 30, y: 30 },
                { x: 70, y: 30 },
                { x: 70, y: 70 },
                { x: 30, y: 70 },
              ],
            },
          ],
        },
        {
          id: 'cuadrado-interior',
          anchoMm: 30,
          altoMm: 30,
          areaMm2: 900,
          perimetroMm: 120,
          contornos: [
            {
              esHueco: false,
              puntos: [
                { x: 0, y: 0 },
                { x: 30, y: 0 },
                { x: 30, y: 30 },
                { x: 0, y: 30 },
              ],
            },
          ],
        },
      ],
      areaTotalMm2: 9_300,
      perimetroTotalMm: 680,
      hashFuente: 'aro-con-pieza',
    };
    const result = nestearGeometriaIrregular({
      geometria: geometriaConAro,
      cantidad: 1,
      anchoPlacaMm: 100,
      altoPlacaMm: 100,
      separacionMm: 2,
      permitirRotacion: false,
    });

    expect(result.placas).toBe(1);
    expect(result.placements).toHaveLength(2);
    expect(result.placements[1].xMm).toBeGreaterThanOrEqual(32);
    expect(result.placements[1].yMm).toBeGreaterThanOrEqual(32);
  });

  it('abre otra placa cuando no hay lugar', () => {
    const result = nestearGeometriaIrregular({
      geometria: triangle,
      cantidad: 3,
      anchoPlacaMm: 121,
      altoPlacaMm: 60,
      separacionMm: 1,
      permitirRotacion: false,
    });
    expect(result.placas).toBe(2);
  });

  it('aprovecha huecos internos que no coinciden con los bordes rectangulares', () => {
    const geometriaConHueco: GeometriaVectorialCanonica = {
      schemaVersion: 1,
      anchoMm: 80,
      altoMm: 50,
      piezas: [
        {
          id: 'triangulo-grande',
          anchoMm: 60,
          altoMm: 50,
          areaMm2: 1_500,
          perimetroMm: 188.1,
          contornos: [
            {
              esHueco: false,
              puntos: [
                { x: 0, y: 0 },
                { x: 60, y: 0 },
                { x: 0, y: 50 },
              ],
            },
          ],
        },
        {
          id: 'rectangulo',
          anchoMm: 40,
          altoMm: 20,
          areaMm2: 800,
          perimetroMm: 120,
          contornos: [
            {
              esHueco: false,
              puntos: [
                { x: 0, y: 0 },
                { x: 40, y: 0 },
                { x: 40, y: 20 },
                { x: 0, y: 20 },
              ],
            },
          ],
        },
      ],
      areaTotalMm2: 2_300,
      perimetroTotalMm: 308.1,
      hashFuente: 'fixture-hueco-interno',
    };

    const result = nestearGeometriaIrregular({
      geometria: geometriaConHueco,
      cantidad: 1,
      anchoPlacaMm: 80,
      altoPlacaMm: 50,
      separacionMm: 5,
      permitirRotacion: false,
    });

    expect(result.placas).toBe(1);
    expect(result.placements).toHaveLength(2);
    expect(result.placements[1]).toMatchObject({ xMm: 40, yMm: 25 });
  });

  it('divide el Puma de 200 cm en dos partes limpias con un corte oblicuo', () => {
    const svg = readFileSync(
      join(__dirname, 'fixtures', 'puma-logo.svg'),
      'utf8',
    );
    const { geometria } = analizarSvgFabricacion({
      svg,
      anchoFinalMm: 2_000,
      toleranciaCurvaMm: 1.5,
    });

    const result = segmentarPiezasConEncastres({
      piezas: geometria.piezas,
      anchoUtilMm: 1_180,
      altoUtilMm: 580,
      permitirRotacion: true,
    });

    const piezaPuma = geometria.piezas.find(
      (pieza) => pieza.id === result.uniones[0]?.piezaOrigenId,
    );
    const partesPuma = result.piezas.filter(
      (pieza) => pieza.segmentacion?.piezaOrigenId === piezaPuma?.id,
    );
    expect(partesPuma).toHaveLength(2);
    expect(result.piezas).toHaveLength(8);
    expect(result.uniones).toHaveLength(1);
    expect(result.uniones[0].anguloGrados).toBe(45);
    expect(result.uniones[0].inicio).toBeDefined();
    expect(result.uniones[0].fin).toBeDefined();
    const puma = piezaPuma;
    for (const punto of [result.uniones[0].inicio, result.uniones[0].fin]) {
      expect(punto?.x).toBeGreaterThanOrEqual(0);
      expect(punto?.x).toBeLessThanOrEqual(puma?.anchoMm ?? 0);
      expect(punto?.y).toBeGreaterThanOrEqual(0);
      expect(punto?.y).toBeLessThanOrEqual(puma?.altoMm ?? 0);
    }
  });

  it('fragmenta una pieza mayor al área útil con encastres trazables', () => {
    const result = nestearGeometriaIrregular({
      geometria: triangle,
      cantidad: 1,
      anchoPlacaMm: 50,
      altoPlacaMm: 50,
    });

    expect(result.segmentos).toBeGreaterThan(1);
    expect(result.uniones.length).toBeGreaterThan(0);
    expect(result.placements.every((placement) => placement.segmentacion)).toBe(
      true,
    );
    expect(result.perimetroCorteMm).toBeGreaterThan(triangle.perimetroTotalMm);
  });

  it('mantiene entera una pieza que sólo entra al girarla', () => {
    const letraAlta: GeometriaVectorialCanonica = {
      schemaVersion: 1,
      anchoMm: 300,
      altoMm: 600,
      piezas: [
        {
          id: 'letra-alta',
          anchoMm: 300,
          altoMm: 600,
          areaMm2: 180_000,
          perimetroMm: 1_800,
          contornos: [
            {
              esHueco: false,
              puntos: [
                { x: 0, y: 0 },
                { x: 300, y: 0 },
                { x: 300, y: 600 },
                { x: 0, y: 600 },
              ],
            },
          ],
        },
      ],
      areaTotalMm2: 180_000,
      perimetroTotalMm: 1_800,
      hashFuente: 'letra-alta',
    };

    const result = nestearGeometriaIrregular({
      geometria: letraAlta,
      cantidad: 1,
      anchoPlacaMm: 1_200,
      altoPlacaMm: 600,
      margenMm: 50,
      separacionMm: 5,
      permitirRotacion: true,
    });

    expect(result.segmentos).toBe(1);
    expect(result.unionesFisicas).toBe(0);
    expect(result.uniones).toHaveLength(0);
    expect(result.placements[0]).toMatchObject({
      pieceId: 'letra-alta',
      rotacion: 90,
    });
  });

  it('divide un cartel de 180 × 80 cm para placas útiles de 110 × 50 cm', () => {
    const grande: GeometriaVectorialCanonica = {
      schemaVersion: 1,
      anchoMm: 1800,
      altoMm: 800,
      piezas: [
        {
          id: 'fondo',
          anchoMm: 1800,
          altoMm: 800,
          areaMm2: 1_440_000,
          perimetroMm: 5_200,
          contornos: [
            {
              esHueco: false,
              puntos: [
                { x: 0, y: 0 },
                { x: 1800, y: 0 },
                { x: 1800, y: 800 },
                { x: 0, y: 800 },
              ],
            },
          ],
        },
      ],
      areaTotalMm2: 1_440_000,
      perimetroTotalMm: 5_200,
      hashFuente: 'cartel-grande',
    };

    const result = nestearGeometriaIrregular({
      geometria: grande,
      cantidad: 1,
      anchoPlacaMm: 1200,
      altoPlacaMm: 600,
      margenMm: 50,
      separacionMm: 5,
      permitirRotacion: true,
    });

    expect(result.segmentos).toBeGreaterThanOrEqual(4);
    expect(result.unionesFisicas).toBe(
      result.segmentos - result.piezasOriginales,
    );
    expect(result.uniones.length).toBeGreaterThanOrEqual(3);
    expect(result.placements).toHaveLength(result.segmentos);
    expect(
      result.placements.every(
        (placement) =>
          placement.anchoMm <= 1100.001 && placement.altoMm <= 500.001,
      ),
    ).toBe(true);
    expect(result.uniones[0]).toMatchObject({
      tipoEncastre: 'cola_milano',
      anchoEncastreMm: 30,
      profundidadEncastreMm: 30,
      kerfMm: 0.3,
    });
    expect(result.uniones[0].cantidadEncastres).toBeGreaterThanOrEqual(8);
  });

  it('genera colas de milano angulares con cabeza más ancha que el cuello', () => {
    const pieza = {
      id: 'placa-grande',
      anchoMm: 1_800,
      altoMm: 800,
      areaMm2: 1_440_000,
      perimetroMm: 5_200,
      contornos: [
        {
          esHueco: false,
          puntos: [
            { x: 0, y: 0 },
            { x: 1_800, y: 0 },
            { x: 1_800, y: 800 },
            { x: 0, y: 800 },
          ],
        },
      ],
    };
    const result = segmentarPiezasConEncastres({
      piezas: [pieza],
      anchoUtilMm: 1_180,
      altoUtilMm: 580,
      permitirRotacion: true,
    });
    const primeraUnion = result.uniones[0];
    const macho = result.piezas.find((segmento) =>
      segmento.segmentacion?.unionesIds.includes(primeraUnion.id),
    );
    const puntos = macho?.contornos[0].puntos ?? [];
    const inicio = puntos.findIndex(
      (punto, index) =>
        Math.abs(punto.x - primeraUnion.posicionMm) < 0.001 &&
        Math.abs((puntos[index + 1]?.x ?? 0) - (primeraUnion.posicionMm + 30)) <
          0.001 &&
        Math.abs((puntos[index + 2]?.x ?? 0) - (primeraUnion.posicionMm + 30)) <
          0.001 &&
        Math.abs((puntos[index + 3]?.x ?? 0) - primeraUnion.posicionMm) < 0.001,
    );

    expect(inicio).toBeGreaterThanOrEqual(0);
    const perfil = puntos.slice(inicio, inicio + 4);
    const anchoCabeza = Math.abs(perfil[2].y - perfil[1].y);
    const anchoCuello = Math.abs(perfil[3].y - perfil[0].y);
    expect(anchoCabeza).toBeCloseTo(30, 3);
    expect(anchoCuello).toBeCloseTo(15, 3);
    expect(anchoCabeza).toBeGreaterThan(anchoCuello);
  });

  it('agrega segmentos antes que reducir la profundidad de una cola de milano', () => {
    const piezaAlta = {
      id: 'pieza-alta',
      anchoMm: 700,
      altoMm: 1_189,
      areaMm2: 832_300,
      perimetroMm: 3_778,
      contornos: [
        {
          esHueco: false,
          puntos: [
            { x: 0, y: 0 },
            { x: 700, y: 0 },
            { x: 700, y: 1_189 },
            { x: 0, y: 1_189 },
          ],
        },
      ],
    };

    const result = segmentarPiezasConEncastres({
      piezas: [piezaAlta],
      anchoUtilMm: 1_180,
      altoUtilMm: 580,
      permitirRotacion: true,
    });

    expect(result.piezas).toHaveLength(3);
    expect(result.uniones).toHaveLength(2);
    expect(
      result.uniones.every((union) => union.profundidadEncastreMm === 30),
    ).toBe(true);
  });

  it('permite dividir con uniones rectas sin encastres', () => {
    const pieza = piezaRectangular('recta', 1_800, 400);
    const result = segmentarPiezasConEncastres({
      piezas: [pieza],
      anchoUtilMm: 1_000,
      altoUtilMm: 500,
      configuracionEncastres: {
        tipoUnion: 'recta',
      },
    });

    expect(result.piezas.length).toBeGreaterThan(1);
    expect(result.uniones.length).toBeGreaterThan(0);
    expect(result.uniones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tipoEncastre: 'recta',
          cantidadEncastres: 0,
          anchoEncastreMm: 0,
          profundidadEncastreMm: 0,
        }),
      ]),
    );
  });

  it('respeta tamaño, cantidad fija y kerf configurados', () => {
    const pieza = piezaRectangular('personalizada', 1_800, 400);
    const result = segmentarPiezasConEncastres({
      piezas: [pieza],
      anchoUtilMm: 1_000,
      altoUtilMm: 500,
      configuracionEncastres: {
        tipoUnion: 'cola_milano',
        anchoEncastreMm: 40,
        profundidadEncastreMm: 20,
        modoCantidad: 'cantidad_fija',
        distanciaMaximaMm: 100,
        cantidadFija: 3,
        cantidadMinima: 1,
        cantidadMaxima: 10,
        kerfMm: 0.5,
      },
    });

    expect(result.uniones.length).toBeGreaterThan(0);
    expect(
      result.uniones.every(
        (union) =>
          union.tipoEncastre === 'cola_milano' &&
          union.anchoEncastreMm === 40 &&
          union.profundidadEncastreMm === 20 &&
          union.cantidadEncastres === 3 &&
          union.kerfMm === 0.5,
      ),
    ).toBe(true);
  });
});

function piezaRectangular(
  id: string,
  anchoMm: number,
  altoMm: number,
): PiezaVectorial {
  return {
    id,
    anchoMm,
    altoMm,
    areaMm2: anchoMm * altoMm,
    perimetroMm: (anchoMm + altoMm) * 2,
    contornos: [
      {
        esHueco: false,
        puntos: [
          { x: 0, y: 0 },
          { x: anchoMm, y: 0 },
          { x: anchoMm, y: altoMm },
          { x: 0, y: altoMm },
        ],
      },
    ],
  };
}
