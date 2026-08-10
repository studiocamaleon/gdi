import { partirPiezasEnPanosDeHoja } from '../nesting-dispatcher';
import type { NestingConfigResolved } from '../nesting-config';

/**
 * Partición en paños sobre HOJA (montaje): la chapa trasera de un cartel más
 * grande que la hoja se hace en partes, como en el taller.
 */
function config(over: Partial<NestingConfigResolved> = {}): NestingConfigResolved {
  return {
    algorithm: null,
    allowRotation: true,
    pieceBleedMm: 0,
    separationHMm: 0,
    separationVMm: 0,
    margins: {
      leftMm: 0,
      rightMm: 0,
      topMm: 0,
      bottomMm: 0,
      startMm: 0,
      endMm: 0,
    },
    rollWidthMm: null,
    sheetWidthMm: 1220,
    sheetHeightMm: 2440,
    printSheetMode: 'fixed',
    printSheetCostSource: 'derivado',
    printSheetCandidates: [],
    purchaseSheetWidthMm: 1220,
    purchaseSheetHeightMm: 2440,
    purchaseSheetPrecio: null,
    machineGeometry: null,
    costing: { strategy: 'simple', segmentSteps: [] },
    panelizado: {
      enabled: true,
      mode: 'automatic',
      axis: 'automatic',
      overlapMm: 0,
      maxPanelWidthMm: 1220,
      distribution: 'equitativa',
      widthInterpretation: 'panel',
      manualLayout: null,
    },
    ...over,
  } as NestingConfigResolved;
}

describe('partirPiezasEnPanosDeHoja', () => {
  it('la chapa trasera de 2500×1300 sale en 3 paños que entran en la hoja', () => {
    const r = partirPiezasEnPanosDeHoja(
      [{ cantidad: 1, anchoMm: 2500, altoMm: 1300 }],
      config(),
    );
    expect(r).not.toBeNull();
    expect(r![0].cantidad).toBe(3);
    expect(r![0].anchoMm).toBeCloseTo(2500 / 3, 3);
    expect(r![0].altoMm).toBe(1300);
  });

  it('con junta, cada paño con corte suma el solape', () => {
    const r = partirPiezasEnPanosDeHoja(
      [{ cantidad: 1, anchoMm: 2500, altoMm: 1300 }],
      config({
        panelizado: { ...config().panelizado, overlapMm: 20 },
      }),
    );
    expect(r![0].anchoMm).toBeCloseTo(2500 / 3 + 20, 3);
  });

  it('devuelve null si todo ya entra (sin partir de más)', () => {
    expect(
      partirPiezasEnPanosDeHoja(
        [{ cantidad: 1, anchoMm: 1500, altoMm: 1000 }],
        config(),
      ),
    ).toBeNull();
  });

  it('devuelve null con panelizado apagado', () => {
    expect(
      partirPiezasEnPanosDeHoja(
        [{ cantidad: 1, anchoMm: 2500, altoMm: 1300 }],
        config({
          panelizado: { ...config().panelizado, enabled: false },
        }),
      ),
    ).toBeNull();
  });

  it('eje manual horizontal: sólo corta a lo alto — si no alcanza, null', () => {
    // 2500 de ancho no entra ni rotado partiendo sólo filas.
    expect(
      partirPiezasEnPanosDeHoja(
        [{ cantidad: 1, anchoMm: 2500, altoMm: 1300 }],
        config({
          panelizado: {
            ...config().panelizado,
            mode: 'manual',
            axis: 'horizontal',
          },
        }),
      ),
    ).toBeNull();
  });

  it('las piezas que entran se conservan intactas junto a las partidas', () => {
    const r = partirPiezasEnPanosDeHoja(
      [
        { cantidad: 2, anchoMm: 600, altoMm: 400 },
        { cantidad: 1, anchoMm: 2500, altoMm: 1300 },
      ],
      config(),
    );
    expect(r![0]).toEqual({ cantidad: 2, anchoMm: 600, altoMm: 400 });
    expect(r![1].cantidad).toBe(3);
  });
});
