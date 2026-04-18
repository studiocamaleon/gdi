/**
 * Tests de nesting-rollo (C.2.3).
 *
 * Cubre los casos que el algoritmo actual de gran formato maneja:
 * - Piezas que caben en ancho imprimible.
 * - Rotación automática.
 * - Márgenes no-imprimibles de la máquina.
 * - Panelizado automático (piezas más grandes que el ancho).
 * - Panelizado manual.
 * - Piezas que no encajan (retorna null).
 */
import { nestOnRoll, normalizeManualLayout } from './nesting-rollo';

// Base config razonable: rollo de 1370mm (vinilo adhesivo blanco 1.37m),
// máquina sin márgenes especiales.
const BASE = {
  printableWidthMm: 1360, // 1370 - 5 margen izq - 5 margen der
  marginLeftMm: 5,
  marginStartMm: 0,
  marginEndMm: 0,
  separacionHorizontalMm: 10,
  separacionVerticalMm: 10,
  permitirRotacion: true,
};

describe('nestOnRoll', () => {
  it('1 pieza 1000×500mm cabe en rollo 1360mm, no rota (1000 < 1360)', () => {
    const r = nestOnRoll({
      ...BASE,
      medidas: [{ anchoMm: 1000, altoMm: 500, cantidad: 1 }],
    });
    expect(r).not.toBeNull();
    expect(r!.placements).toHaveLength(1);
    expect(r!.placements[0].rotated).toBe(false);
    expect(r!.rows).toBe(1);
    expect(r!.piecesPerRow).toBe(1);
  });

  it('10 stickers 80×50mm: múltiples por fila con rotación optimizando', () => {
    const r = nestOnRoll({
      ...BASE,
      medidas: [{ anchoMm: 80, altoMm: 50, cantidad: 10 }],
    });
    expect(r).not.toBeNull();
    expect(r!.placements).toHaveLength(10);
    // Debe caber todo en 1 fila porque ancho útil es 1360mm.
    // (1360 + 10) / (50 + 10) = 22.83 rotada → 22 por fila
    // 10 piezas en 1 fila.
    expect(r!.rows).toBe(1);
  });

  it('pieza más grande que el ancho imprimible → null (sin panelizado)', () => {
    const r = nestOnRoll({
      ...BASE,
      printableWidthMm: 500,
      medidas: [{ anchoMm: 1000, altoMm: 1000, cantidad: 1 }],
      // 1000 > 500 y rotada también 1000 > 500
      // Sin panelizado → retorna null
    });
    expect(r).toBeNull();
  });

  it('pieza grande con panelizado automático vertical: se divide en paneles', () => {
    const r = nestOnRoll({
      ...BASE,
      printableWidthMm: 1360,
      medidas: [{ anchoMm: 3000, altoMm: 500, cantidad: 1 }],
      panelizado: {
        activo: true,
        mode: 'automatico',
        axis: 'vertical',
        overlapMm: 50,
        maxPanelWidthMm: 1200,
        distribution: 'equilibrada',
        widthInterpretation: 'total',
      },
    });
    expect(r).not.toBeNull();
    expect(r!.panelizado).toBe(true);
    expect(r!.panelCount).toBeGreaterThan(1);
    // Placements tienen info de panel
    expect(r!.placements[0].panelIndex).not.toBeNull();
    expect(r!.placements[0].panelCount).not.toBeNull();
  });

  it('márgenes de inicio/fin: se suman al consumedLengthMm', () => {
    const rSinMargen = nestOnRoll({
      ...BASE,
      medidas: [{ anchoMm: 500, altoMm: 300, cantidad: 1 }],
    });
    const rConMargen = nestOnRoll({
      ...BASE,
      marginStartMm: 20,
      marginEndMm: 20,
      medidas: [{ anchoMm: 500, altoMm: 300, cantidad: 1 }],
    });
    expect(rSinMargen).not.toBeNull();
    expect(rConMargen).not.toBeNull();
    expect(rConMargen!.consumedLengthMm).toBe(rSinMargen!.consumedLengthMm + 40);
  });

  it('múltiples medidas se packean juntas optimizando largo', () => {
    const r = nestOnRoll({
      ...BASE,
      medidas: [
        { anchoMm: 500, altoMm: 300, cantidad: 2 },
        { anchoMm: 300, altoMm: 200, cantidad: 3 },
      ],
    });
    expect(r).not.toBeNull();
    expect(r!.placements).toHaveLength(5);
  });

  it('permitirRotacion=false: no rota aunque sea conveniente', () => {
    const r = nestOnRoll({
      ...BASE,
      permitirRotacion: false,
      medidas: [{ anchoMm: 50, altoMm: 80, cantidad: 5 }],
    });
    expect(r).not.toBeNull();
    expect(r!.placements.every((p) => !p.rotated)).toBe(true);
    expect(r!.orientacion).toBe('normal');
  });

  it('placements tienen info completa para preview UI', () => {
    const r = nestOnRoll({
      ...BASE,
      medidas: [{ anchoMm: 500, altoMm: 300, cantidad: 1 }],
    });
    expect(r).not.toBeNull();
    const p = r!.placements[0];
    expect(p.widthMm).toBe(500);
    expect(p.heightMm).toBe(300);
    expect(p.centerXMm).toBeGreaterThan(0);
    expect(p.centerYMm).toBeGreaterThan(0);
    expect(p.label).toBe('50x30 cm');
    expect(p.originalWidthMm).toBe(500);
    expect(p.originalHeightMm).toBe(300);
    expect(p.sourcePieceId).toMatch(/^piece-0-0$/);
  });

  it('usefulAreaM2 suma el área útil real', () => {
    const r = nestOnRoll({
      ...BASE,
      medidas: [
        { anchoMm: 1000, altoMm: 500, cantidad: 2 }, // 2 × 0.5m² = 1.0
        { anchoMm: 500, altoMm: 500, cantidad: 2 }, //  2 × 0.25m² = 0.5
      ],
    });
    expect(r).not.toBeNull();
    expect(r!.usefulAreaM2).toBeCloseTo(1.5, 4);
  });
});

describe('normalizeManualLayout', () => {
  it('retorna null para valor inválido', () => {
    expect(normalizeManualLayout(null)).toBeNull();
    expect(normalizeManualLayout(undefined)).toBeNull();
    expect(normalizeManualLayout({})).toBeNull();
    expect(normalizeManualLayout({ items: [] })).toBeNull();
  });

  it('normaliza layout válido con panels', () => {
    const r = normalizeManualLayout({
      items: [
        {
          sourcePieceId: 'piece-0-0',
          pieceWidthMm: 3000,
          pieceHeightMm: 500,
          axis: 'vertical',
          panels: [
            { panelIndex: 1, usefulWidthMm: 1500, usefulHeightMm: 500, overlapStartMm: 0, overlapEndMm: 50, finalWidthMm: 1550, finalHeightMm: 500 },
            { panelIndex: 2, usefulWidthMm: 1500, usefulHeightMm: 500, overlapStartMm: 50, overlapEndMm: 0, finalWidthMm: 1550, finalHeightMm: 500 },
          ],
        },
      ],
    });
    expect(r).not.toBeNull();
    expect(r!.items).toHaveLength(1);
    expect(r!.items[0].panels).toHaveLength(2);
  });
});
