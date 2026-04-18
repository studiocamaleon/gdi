/**
 * Tests de nesting-placa-rigida (C.2.2).
 */
import {
  nestRectangularGrid,
  nestMultiMedida,
  calculatePlatesNeeded,
} from './nesting-placa-rigida';

describe('nesting-placa-rigida', () => {
  describe('nestRectangularGrid (grid regular)', () => {
    it('1 pieza por placa cuando pieza == placa', () => {
      const r = nestRectangularGrid({
        piezaAnchoMm: 600, piezaAltoMm: 400,
        placaAnchoMm: 600, placaAltoMm: 400,
        separacionHMm: 0, separacionVMm: 0, margenMm: 0,
        permitirRotacion: false,
      });
      expect(r.piezasPorPlaca).toBe(1);
      expect(r.placements).toHaveLength(1);
      expect(r.aprovechamientoPct).toBe(100);
    });

    it('calcula columnas/filas: 100x50 en 600x400 con separación 10', () => {
      const r = nestRectangularGrid({
        piezaAnchoMm: 100, piezaAltoMm: 50,
        placaAnchoMm: 600, placaAltoMm: 400,
        separacionHMm: 10, separacionVMm: 10, margenMm: 10,
        permitirRotacion: false,
      });
      // areaW = 580, areaH = 380. Columnas = floor((580+10)/(100+10)) = 5. Filas = floor((380+10)/(50+10)) = 6.
      expect(r.columnas).toBe(5);
      expect(r.filas).toBe(6);
      expect(r.piezasPorPlaca).toBe(30);
      expect(r.placements).toHaveLength(30);
      expect(r.rotada).toBe(false);
    });

    it('rotación automática cuando aumenta piezas por placa', () => {
      // Pieza 50x100 en placa 600x400. Sin rotar: filas con alto 100 -> (380+10)/(100+10) = 3.5 → 3. Columnas: (580+10)/(50+10) = 9.83 → 9. Total 27.
      // Rotada (100x50): columnas (580+10)/(100+10) = 5, filas (380+10)/(50+10) = 6. Total 30.
      const r = nestRectangularGrid({
        piezaAnchoMm: 50, piezaAltoMm: 100,
        placaAnchoMm: 600, placaAltoMm: 400,
        separacionHMm: 10, separacionVMm: 10, margenMm: 10,
        permitirRotacion: true,
      });
      expect(r.rotada).toBe(true);
      expect(r.piezasPorPlaca).toBe(30);
    });

    it('devuelve 0 piezas si no entra', () => {
      const r = nestRectangularGrid({
        piezaAnchoMm: 1000, piezaAltoMm: 1000,
        placaAnchoMm: 600, placaAltoMm: 400,
        separacionHMm: 0, separacionVMm: 0, margenMm: 0,
        permitirRotacion: true,
      });
      expect(r.piezasPorPlaca).toBe(0);
      expect(r.placements).toHaveLength(0);
    });

    it('placements tienen coordenadas correctas', () => {
      const r = nestRectangularGrid({
        piezaAnchoMm: 100, piezaAltoMm: 50,
        placaAnchoMm: 300, placaAltoMm: 200,
        separacionHMm: 10, separacionVMm: 10, margenMm: 10,
        permitirRotacion: false,
      });
      // Primera pieza en (10, 10)
      expect(r.placements[0]).toMatchObject({ x: 10, y: 10, anchoMm: 100, altoMm: 50 });
      // Segunda pieza: (10 + 100 + 10, 10) = (120, 10)
      expect(r.placements[1]).toMatchObject({ x: 120, y: 10 });
    });
  });

  describe('calculatePlatesNeeded', () => {
    it('calcula placas y sobrantes', () => {
      expect(calculatePlatesNeeded(50, 10)).toEqual({ placas: 5, sobrantes: 0 });
      expect(calculatePlatesNeeded(51, 10)).toEqual({ placas: 6, sobrantes: 9 });
      expect(calculatePlatesNeeded(0, 10)).toEqual({ placas: 0, sobrantes: 0 });
      expect(calculatePlatesNeeded(10, 0)).toEqual({ placas: 0, sobrantes: 0 });
    });
  });

  describe('nestMultiMedida (bin-packing)', () => {
    it('empaqueta 3 medidas distintas en una placa', () => {
      const r = nestMultiMedida(
        [
          { anchoMm: 200, altoMm: 100, cantidad: 2 },
          { anchoMm: 100, altoMm: 100, cantidad: 3 },
          { anchoMm: 50, altoMm: 50, cantidad: 4 },
        ],
        600, 400,   // placa
        5, 5,       // separación
        10,         // margen
        true,       // rotación
      );
      expect(r.placas).toBeGreaterThanOrEqual(1);
      expect(r.totalPiezas).toBe(9); // 2 + 3 + 4
      expect(r.placaLayouts).toHaveLength(r.placas);
      // Al menos la primera placa tiene placements (preview)
      expect(r.placaLayouts[0].placements.length).toBeGreaterThan(0);
    });

    it('retorna vacío cuando no hay medidas válidas', () => {
      const r = nestMultiMedida(
        [{ anchoMm: 0, altoMm: 0, cantidad: 0 }],
        600, 400, 0, 0, 0, false,
      );
      expect(r.placas).toBe(0);
      expect(r.totalPiezas).toBe(0);
      expect(r.placaLayouts).toEqual([]);
    });

    it('usa múltiples placas cuando no entran todas las piezas', () => {
      // Piezas grandes que obligan a múltiples placas
      const r = nestMultiMedida(
        [{ anchoMm: 500, altoMm: 350, cantidad: 5 }],
        600, 400, 0, 0, 10, true,
      );
      expect(r.placas).toBeGreaterThan(1);
      expect(r.totalPiezas).toBe(5);
    });
  });
});
