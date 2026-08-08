import { evaluarAprobacion } from '../aprobacion';

const items = (pares: Array<[number, number | null]>) =>
  pares.map(([subtotal, costoTotal]) => ({ subtotal, costoTotal }));

describe('evaluarAprobacion', () => {
  it('sin configuración no dispara nada (defaults desactivados)', () => {
    expect(
      evaluarAprobacion(
        { aprobacionMontoMax: null, aprobacionMargenMinPct: null },
        { total: 10_000_000, items: items([[10_000_000, 9_999_999]]) },
      ),
    ).toEqual([]);
  });

  it('monto: dispara sólo por encima del umbral (el igual pasa)', () => {
    const config = { aprobacionMontoMax: 100_000, aprobacionMargenMinPct: null };
    expect(evaluarAprobacion(config, { total: 100_000, items: [] })).toEqual([]);
    const motivos = evaluarAprobacion(config, { total: 100_001, items: [] });
    expect(motivos).toHaveLength(1);
    expect(motivos[0].regla).toBe('monto');
  });

  it('margen: dispara debajo del mínimo', () => {
    const config = { aprobacionMontoMax: null, aprobacionMargenMinPct: 25 };
    // margen 40% → pasa
    expect(
      evaluarAprobacion(config, { total: 0, items: items([[100_000, 60_000]]) }),
    ).toEqual([]);
    // margen 10% → dispara
    const motivos = evaluarAprobacion(config, {
      total: 0,
      items: items([[100_000, 90_000]]),
    });
    expect(motivos).toHaveLength(1);
    expect(motivos[0].regla).toBe('margen');
    expect(motivos[0].detalle).toContain('10%');
  });

  it('margen con item sin costo: dispara sin_costeo y no inventa el margen', () => {
    const motivos = evaluarAprobacion(
      { aprobacionMontoMax: null, aprobacionMargenMinPct: 25 },
      { total: 0, items: items([[100_000, 60_000], [50_000, null]]) },
    );
    expect(motivos.map((m) => m.regla)).toEqual(['sin_costeo']);
  });

  it('reglas combinadas: monto y margen disparan juntas', () => {
    const motivos = evaluarAprobacion(
      { aprobacionMontoMax: 50_000, aprobacionMargenMinPct: 25 },
      { total: 121_000, items: items([[100_000, 95_000]]) },
    );
    expect(motivos.map((m) => m.regla).sort()).toEqual(['margen', 'monto']);
  });

  it('sin items y sin neto, el margen no divide por cero', () => {
    expect(
      evaluarAprobacion(
        { aprobacionMontoMax: null, aprobacionMargenMinPct: 25 },
        { total: 0, items: [] },
      ),
    ).toEqual([]);
  });

  describe('descuento (F3)', () => {
    const config = {
      aprobacionMontoMax: null,
      aprobacionMargenMinPct: null,
      aprobacionDescuentoMaxPct: 10,
    };

    it('dispara sólo por encima del umbral (el igual pasa)', () => {
      expect(
        evaluarAprobacion(config, { total: 0, items: [], descuentoMaxPct: 10 }),
      ).toEqual([]);
      const motivos = evaluarAprobacion(config, {
        total: 0,
        items: [],
        descuentoMaxPct: 15,
      });
      expect(motivos).toHaveLength(1);
      expect(motivos[0].regla).toBe('descuento');
      expect(motivos[0].detalle).toContain('15%');
      expect(motivos[0].detalle).toContain('10%');
    });

    it('sin descuento (o sin el campo) no dispara', () => {
      expect(
        evaluarAprobacion(config, { total: 0, items: [], descuentoMaxPct: 0 }),
      ).toEqual([]);
      expect(evaluarAprobacion(config, { total: 0, items: [] })).toEqual([]);
    });

    it('regla desactivada (null/ausente) ignora cualquier descuento', () => {
      expect(
        evaluarAprobacion(
          { aprobacionMontoMax: null, aprobacionMargenMinPct: null },
          { total: 0, items: [], descuentoMaxPct: 99 },
        ),
      ).toEqual([]);
      expect(
        evaluarAprobacion(
          {
            aprobacionMontoMax: null,
            aprobacionMargenMinPct: null,
            aprobacionDescuentoMaxPct: null,
          },
          { total: 0, items: [], descuentoMaxPct: 99 },
        ),
      ).toEqual([]);
    });

    it('combina con las otras reglas', () => {
      const motivos = evaluarAprobacion(
        {
          aprobacionMontoMax: 50_000,
          aprobacionMargenMinPct: null,
          aprobacionDescuentoMaxPct: 10,
        },
        { total: 121_000, items: [], descuentoMaxPct: 20 },
      );
      expect(motivos.map((m) => m.regla).sort()).toEqual([
        'descuento',
        'monto',
      ]);
    });
  });
});
