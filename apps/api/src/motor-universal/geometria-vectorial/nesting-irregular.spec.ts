import {
  nestearGeometriaIrregular,
  NestingIrregularError,
} from './nesting-irregular';
import { segmentarPiezasConEncastres } from './segmentacion-encastres';
import type { GeometriaVectorialCanonica } from './tipos';

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
});
