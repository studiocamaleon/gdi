import { evaluateGranFormatoMaxRectsRollLayout } from './maxrects-rollo';
import { evaluateGranFormatoMixedShelfLayout } from './shelf-rollo';

const baseInput = {
  printableWidthMm: 1360,
  marginLeftMm: 5,
  marginStartMm: 10,
  marginEndMm: 10,
  separacionHorizontalMm: 5,
  separacionVerticalMm: 5,
  permitirRotacion: true,
  medidas: [
    { anchoMm: 900, altoMm: 700, cantidad: 1 },
    { anchoMm: 450, altoMm: 250, cantidad: 1 },
    { anchoMm: 220, altoMm: 220, cantidad: 5 },
  ],
};

describe('evaluateGranFormatoMaxRectsRollLayout', () => {
  it('mejora el largo consumido frente a shelf-rollo para piezas mixtas', () => {
    const shelf = evaluateGranFormatoMixedShelfLayout(baseInput);
    const maxRects = evaluateGranFormatoMaxRectsRollLayout({
      ...baseInput,
      upperBoundConsumedLengthMm: shelf?.consumedLengthMm,
    });

    expect(shelf).not.toBeNull();
    expect(maxRects).not.toBeNull();
    expect(maxRects!.placements).toHaveLength(7);
    expect(maxRects!.consumedLengthMm).toBeLessThan(shelf!.consumedLengthMm);
  });

  it('respeta margenes, separacion y evita solapamientos', () => {
    const result = evaluateGranFormatoMaxRectsRollLayout(baseInput);

    expect(result).not.toBeNull();
    const placements = result!.placements;
    for (const placement of placements) {
      const left = placement.centerXMm - placement.widthMm / 2;
      const top = placement.centerYMm - placement.heightMm / 2;
      const right = placement.centerXMm + placement.widthMm / 2;
      const bottom = placement.centerYMm + placement.heightMm / 2;
      expect(left).toBeGreaterThanOrEqual(baseInput.marginLeftMm);
      expect(top).toBeGreaterThanOrEqual(baseInput.marginStartMm);
      expect(right).toBeLessThanOrEqual(
        baseInput.marginLeftMm + baseInput.printableWidthMm,
      );
      expect(bottom).toBeLessThanOrEqual(result!.consumedLengthMm);
    }

    for (let i = 0; i < placements.length; i += 1) {
      for (let j = i + 1; j < placements.length; j += 1) {
        const a = placements[i];
        const b = placements[j];
        const aLeft = a.centerXMm - a.widthMm / 2;
        const aRight = a.centerXMm + a.widthMm / 2;
        const aTop = a.centerYMm - a.heightMm / 2;
        const aBottom = a.centerYMm + a.heightMm / 2;
        const bLeft = b.centerXMm - b.widthMm / 2;
        const bRight = b.centerXMm + b.widthMm / 2;
        const bTop = b.centerYMm - b.heightMm / 2;
        const bBottom = b.centerYMm + b.heightMm / 2;
        const separatedHorizontally =
          aRight + baseInput.separacionHorizontalMm <= bLeft ||
          bRight + baseInput.separacionHorizontalMm <= aLeft;
        const separatedVertically =
          aBottom + baseInput.separacionVerticalMm <= bTop ||
          bBottom + baseInput.separacionVerticalMm <= aTop;
        expect(separatedHorizontally || separatedVertically).toBe(true);
      }
    }
  });

  it('mantiene metadata de panelizado', () => {
    const result = evaluateGranFormatoMaxRectsRollLayout({
      ...baseInput,
      permitirRotacion: false,
      medidas: [
        { anchoMm: 1800, altoMm: 800, cantidad: 1 },
        { anchoMm: 200, altoMm: 300, cantidad: 2 },
      ],
      panelizado: {
        activo: true,
        mode: 'automatico',
        axis: 'vertical',
        overlapMm: 20,
        maxPanelWidthMm: 1360,
        distribution: 'equilibrada',
        widthInterpretation: 'total',
      },
    });

    expect(result).not.toBeNull();
    expect(result!.panelizado).toBe(true);
    expect(result!.panelCount).toBe(2);
    expect(result!.placements.filter((p) => p.panelIndex != null)).toHaveLength(2);
    expect(result!.placements.filter((p) => p.panelIndex == null)).toHaveLength(2);
  });
});
