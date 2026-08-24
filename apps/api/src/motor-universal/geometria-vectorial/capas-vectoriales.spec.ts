import { aplicarCapasAGeometria } from './capas-vectoriales';
import { nestearGeometriaIrregular } from './nesting-irregular';
import { analizarSvgFabricacion } from './svg-parser';

describe('aplicarCapasAGeometria', () => {
  it('mantiene juntas las piezas de distintos niveles que deben cortarse', () => {
    const geometria = fixture();
    const result = aplicarCapasAGeometria(geometria, {
      schemaVersion: 1,
      niveles: [
        { id: 'base', nombre: 'Base', orden: 1, colorVisual: 1 },
        { id: 'frente', nombre: 'Frente', orden: 2, colorVisual: 2 },
      ],
      asignaciones: [
        { objetoId: 'objeto-1', nivelId: 'base', modo: 'pieza' },
        { objetoId: 'objeto-2', nivelId: 'frente', modo: 'pieza' },
      ],
    });

    expect(result.piezas).toHaveLength(2);
  });

  it('convierte un inserto del mismo nivel en un corte interno compartido', () => {
    const geometria = analizarSvgFabricacion({
      svg: '<svg viewBox="0 0 100 100"><rect width="100" height="100"/><circle cx="50" cy="50" r="25"/></svg>',
      anchoFinalMm: 100,
    }).geometria;
    const result = aplicarCapasAGeometria(geometria, {
      schemaVersion: 1,
      niveles: [{ id: 'nivel-1', nombre: 'Nivel 1', orden: 1, colorVisual: 1 }],
      asignaciones: [
        { objetoId: 'objeto-1', nivelId: 'nivel-1', modo: 'pieza' },
        { objetoId: 'objeto-2', nivelId: 'nivel-1', modo: 'encastre' },
      ],
    });

    const base = result.piezas.find(
      (pieza) => pieza.objetoFuente?.id === 'objeto-1',
    );
    expect(result.piezas).toHaveLength(1);
    expect(base?.contornos.some((contorno) => contorno.esHueco)).toBe(false);
    expect(base?.cortesInternos).toHaveLength(1);
    expect(result.areaTotalMm2).toBeCloseTo(10_000, 0);
    expect(result.perimetroTotalMm).toBeCloseTo(400 + 2 * Math.PI * 25, 0);
  });

  it('no resta el inserto de una pieza ubicada en otro nivel', () => {
    const geometria = analizarSvgFabricacion({
      svg: '<svg viewBox="0 0 100 100"><rect width="100" height="100"/><circle cx="50" cy="50" r="25"/></svg>',
      anchoFinalMm: 100,
    }).geometria;
    const result = aplicarCapasAGeometria(geometria, {
      schemaVersion: 1,
      niveles: [
        { id: 'base', nombre: 'Base', orden: 1, colorVisual: 1 },
        { id: 'frente', nombre: 'Frente', orden: 2, colorVisual: 2 },
      ],
      asignaciones: [
        { objetoId: 'objeto-1', nivelId: 'base', modo: 'pieza' },
        { objetoId: 'objeto-2', nivelId: 'frente', modo: 'encastre' },
      ],
    });

    expect(result.areaTotalMm2).toBeCloseTo(10_000 + Math.PI * 25 ** 2, -1);
    expect(
      result.piezas[0].contornos.some((contorno) => contorno.esHueco),
    ).toBe(false);
    expect(result.piezas[0].cortesInternos).toBeUndefined();
  });

  it('reutiliza el interior en un solo nivel y lo corta aparte cuando tiene relieve', () => {
    const original = analizarSvgFabricacion({
      svg: '<svg viewBox="0 0 100 100"><rect width="100" height="100"/><circle cx="50" cy="50" r="25"/></svg>',
      anchoFinalMm: 1_000,
    }).geometria;
    const unSoloNivel = aplicarCapasAGeometria(original, {
      schemaVersion: 1,
      niveles: [{ id: 'unico', nombre: 'Único', orden: 1, colorVisual: 1 }],
      asignaciones: [
        { objetoId: 'objeto-1', nivelId: 'unico', modo: 'pieza' },
        { objetoId: 'objeto-2', nivelId: 'unico', modo: 'encastre' },
      ],
    });
    const conRelieve = aplicarCapasAGeometria(original, {
      schemaVersion: 1,
      niveles: [
        { id: 'base', nombre: 'Base', orden: 1, colorVisual: 1 },
        { id: 'frente', nombre: 'Frente', orden: 2, colorVisual: 2 },
      ],
      asignaciones: [
        { objetoId: 'objeto-1', nivelId: 'base', modo: 'pieza' },
        { objetoId: 'objeto-2', nivelId: 'frente', modo: 'pieza' },
      ],
    });
    const nestingUnSoloNivel = nestearGeometriaIrregular({
      geometria: unSoloNivel,
      cantidad: 1,
      anchoPlacaMm: 1_200,
      altoPlacaMm: 600,
      margenMm: 5,
      separacionMm: 5,
      permitirRotacion: true,
    });
    const nestingConRelieve = nestearGeometriaIrregular({
      geometria: conRelieve,
      cantidad: 1,
      anchoPlacaMm: 1_200,
      altoPlacaMm: 600,
      margenMm: 5,
      separacionMm: 5,
      permitirRotacion: true,
    });

    expect(unSoloNivel.piezas).toHaveLength(1);
    expect(unSoloNivel.piezas[0].cortesInternos).toHaveLength(1);
    expect(nestingUnSoloNivel.placements).toHaveLength(2);
    expect(
      nestingUnSoloNivel.placements.some(
        (placement) => (placement.cortesInternos?.length ?? 0) > 0,
      ),
    ).toBe(true);
    expect(conRelieve.piezas).toHaveLength(2);
    expect(conRelieve.piezas[0].cortesInternos).toBeUndefined();
    expect(nestingConRelieve.placements.length).toBeGreaterThan(
      nestingUnSoloNivel.placements.length,
    );
  });
});

function fixture() {
  return analizarSvgFabricacion({
    svg: '<svg viewBox="0 0 100 50"><rect width="40" height="50"/><rect x="60" width="40" height="50"/></svg>',
    anchoFinalMm: 100,
  }).geometria;
}
