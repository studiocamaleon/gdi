import {
  diasDelRango,
  fraccionMesEnRango,
  granularidad,
  mesesDelRango,
  parseRango,
  periodoAnterior,
} from '../periodo';

const iso = (fecha: Date) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;

describe('periodo', () => {
  describe('parseRango', () => {
    it('sin fechas → mes en curso', () => {
      const r = parseRango(undefined, undefined, new Date(2026, 6, 15));
      expect(iso(r.desde)).toBe('2026-07-01');
      expect(iso(r.hasta)).toBe('2026-07-31');
    });

    it('respeta el rango explícito', () => {
      const r = parseRango('2026-07-10', '2026-07-20');
      expect(iso(r.desde)).toBe('2026-07-10');
      expect(iso(r.hasta)).toBe('2026-07-20');
    });

    it('completa el mes si falta una punta', () => {
      expect(iso(parseRango('2026-03-05').hasta)).toBe('2026-03-31');
      expect(iso(parseRango(undefined, '2026-03-05').desde)).toBe('2026-03-01');
    });

    it('rechaza fecha inválida y rango invertido', () => {
      expect(() => parseRango('2026-02-30', '2026-03-01')).toThrow();
      expect(() => parseRango('2026-07-20', '2026-07-10')).toThrow();
    });
  });

  describe('periodoAnterior', () => {
    it('mes calendario → mes anterior completo (sin error de 31 días)', () => {
      const r = parseRango('2026-07-01', '2026-07-31');
      const a = periodoAnterior(r);
      expect(iso(a.desde)).toBe('2026-06-01');
      expect(iso(a.hasta)).toBe('2026-06-30');
    });

    it('cruza el año hacia atrás', () => {
      const a = periodoAnterior(parseRango('2026-01-01', '2026-01-31'));
      expect(iso(a.desde)).toBe('2025-12-01');
      expect(iso(a.hasta)).toBe('2025-12-31');
    });

    it('trimestre calendario → trimestre anterior', () => {
      const a = periodoAnterior(parseRango('2026-04-01', '2026-06-30'));
      expect(iso(a.desde)).toBe('2026-01-01');
      expect(iso(a.hasta)).toBe('2026-03-31');
    });

    it('rango arbitrario → misma cantidad de días, inmediatamente antes', () => {
      const a = periodoAnterior(parseRango('2026-07-10', '2026-07-16')); // 7 días
      expect(iso(a.hasta)).toBe('2026-07-09');
      expect(iso(a.desde)).toBe('2026-07-03');
    });
  });

  describe('granularidad', () => {
    it('mes → día, trimestre → semana, año → mes', () => {
      expect(granularidad(parseRango('2026-07-01', '2026-07-31'))).toBe('dia');
      expect(granularidad(parseRango('2026-04-01', '2026-06-30'))).toBe('semana');
      expect(granularidad(parseRango('2026-01-01', '2026-12-31'))).toBe('mes');
    });
  });

  describe('mesesDelRango', () => {
    it('enumera los YYYY-MM que toca (para costos fijos)', () => {
      expect(mesesDelRango(parseRango('2026-07-01', '2026-07-31'))).toEqual(['2026-07']);
      expect(mesesDelRango(parseRango('2026-05-15', '2026-08-10'))).toEqual([
        '2026-05',
        '2026-06',
        '2026-07',
        '2026-08',
      ]);
    });
  });

  describe('fraccionMesEnRango', () => {
    it('mes completo → 1', () => {
      expect(fraccionMesEnRango('2026-07', parseRango('2026-07-01', '2026-07-31'))).toBe(1);
    });
    it('rango parcial → prorratea por días', () => {
      // 11 días (10 al 20) de 31 → 11/31
      expect(fraccionMesEnRango('2026-07', parseRango('2026-07-10', '2026-07-20'))).toBeCloseTo(11 / 31, 5);
    });
    it('mes fuera del rango → 0', () => {
      expect(fraccionMesEnRango('2026-05', parseRango('2026-07-01', '2026-07-31'))).toBe(0);
    });
    it('mes intermedio de un rango largo → 1', () => {
      expect(fraccionMesEnRango('2026-06', parseRango('2026-05-15', '2026-08-10'))).toBe(1);
    });
  });

  describe('diasDelRango', () => {
    it('cuenta inclusivo', () => {
      expect(diasDelRango(parseRango('2026-07-01', '2026-07-31'))).toBe(31);
      expect(diasDelRango(parseRango('2026-07-10', '2026-07-10'))).toBe(1);
    });
  });
});
