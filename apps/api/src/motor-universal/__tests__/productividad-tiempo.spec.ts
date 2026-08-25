import {
  modoTiempoEfectivo,
  runMinPorProductividad,
} from '../productividad-tiempo';

describe('modoTiempoEfectivo', () => {
  it('fuerza T-3 para corte láser aunque el registro histórico esté vacío', () => {
    expect(modoTiempoEfectivo('corte_laser', null)).toBe('T-3');
  });

  it('fuerza T-3 para corte láser aunque conserve el antiguo T-4', () => {
    expect(modoTiempoEfectivo('corte_laser', 'T-4')).toBe('T-3');
  });

  it('mantiene el fallback histórico para otras familias', () => {
    expect(modoTiempoEfectivo('trabajo_manual', null)).toBe('T-1');
    expect(modoTiempoEfectivo('trabajo_manual', 'T-2')).toBe('T-2');
  });
});

describe('runMinPorProductividad — unidades de velocidad', () => {
  describe('láser / CNC por recorrido (magnitud en METROS)', () => {
    it('MM_S: recorrido 2 m a 20 mm/s = 2000mm/20 = 100s = 1.667 min', () => {
      // corte láser: perímetro 2 m, velocidad 20 mm/s
      expect(runMinPorProductividad(2, 20, 'MM_S')).toBeCloseTo(2000 / 20 / 60, 6);
      expect(runMinPorProductividad(2, 20, 'MM_S')).toBeCloseTo(1.6667, 3);
    });

    it('MM_MIN: recorrido 3 m a 3000 mm/min = 3000mm/3000 = 1 min', () => {
      // router CNC: perímetro 3 m, feed 3000 mm/min
      expect(runMinPorProductividad(3, 3000, 'MM_MIN')).toBeCloseTo(1, 6);
    });

    it('caso letra corpórea: perímetro 0.8 m a 15 mm/s ≈ 0.889 min', () => {
      // pieza 20×20 cm → perímetro 0.8 m; corte MDF a 15 mm/s
      expect(runMinPorProductividad(0.8, 15, 'MM_S')).toBeCloseTo(800 / 15 / 60, 6);
    });

    it('lower case también funciona (viene del enum en minúsculas a veces)', () => {
      expect(runMinPorProductividad(2, 20, 'mm_s')).toBeCloseTo(
        runMinPorProductividad(2, 20, 'MM_S'),
        9,
      );
    });
  });

  describe('unidades existentes no cambian', () => {
    it('M_MIN: cantidad/productividad (metros directo)', () => {
      expect(runMinPorProductividad(10, 5, 'M_MIN')).toBe(2);
    });
    it('por hora (default): (cantidad/prod)*60', () => {
      expect(runMinPorProductividad(100, 225, 'PIEZAS_H')).toBeCloseTo(
        (100 / 225) * 60,
        6,
      );
    });
    it('PPM aplica el factorA4', () => {
      expect(runMinPorProductividad(10, 30, 'PPM', 2)).toBeCloseTo(
        (10 * 2) / 30,
        6,
      );
    });
    it('CORTES_MIN: cantidad/productividad', () => {
      expect(runMinPorProductividad(50, 100, 'CORTES_MIN')).toBe(0.5);
    });
  });

  it('devuelve 0 con entradas inválidas', () => {
    expect(runMinPorProductividad(0, 20, 'MM_S')).toBe(0);
    expect(runMinPorProductividad(2, 0, 'MM_S')).toBe(0);
    expect(runMinPorProductividad(NaN, 20, 'MM_S')).toBe(0);
  });
});
