import {
  evaluarCupon,
  normalizarCodigoCupon,
  planDescuentoCupon,
  type CuponEvaluable,
  type ContextoCarrito,
} from '../cupon-reglas';

const base: CuponEvaluable = {
  codigo: 'SORTEO2026',
  tipo: 'PORCENTAJE',
  valor: 20,
  alcanceTipo: 'ORDEN',
  alcanceRef: null,
  montoMinimo: null,
  vigenciaDesde: null,
  vigenciaHasta: null,
  usoMax: null,
  usoCount: 0,
  activo: true,
};

const carrito = (extra?: Partial<ContextoCarrito>): ContextoCarrito => ({
  ahora: new Date('2026-08-08T12:00:00Z'),
  zonaHoraria: 'America/Argentina/Buenos_Aires',
  clienteId: 'cli-1',
  items: [
    {
      key: 'a',
      productoId: 'prod-1',
      categoriaCodigo: 'carteleria',
      subcategoriaCodigo: 'lonas',
      neto: 80_000,
    },
    {
      key: 'b',
      productoId: 'prod-2',
      categoriaCodigo: 'imprenta',
      subcategoriaCodigo: 'tarjetas',
      neto: 20_000,
    },
  ],
  ...extra,
});

describe('evaluarCupon', () => {
  it('cupón sin reglas alcanza todas las líneas', () => {
    const r = evaluarCupon(base, carrito());
    expect(r).toEqual({ ok: true, alcanzadas: ['a', 'b'] });
  });

  it('inactivo, no vigente aún, vencido y agotado rechazan con su motivo', () => {
    const casos: Array<[Partial<CuponEvaluable>, RegExp]> = [
      [{ activo: false }, /desactivado/],
      [{ vigenciaDesde: '2026-09-01' }, /todavía no/],
      [{ vigenciaHasta: '2026-08-01' }, /vencido/],
      [{ usoMax: 1, usoCount: 1 }, /usos disponibles/],
    ];
    for (const [override, motivo] of casos) {
      const r = evaluarCupon({ ...base, ...override }, carrito());
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo).toMatch(motivo);
    }
  });

  it('vigente dentro de la ventana pasa', () => {
    const r = evaluarCupon(
      {
        ...base,
        vigenciaDesde: '2026-08-01',
        vigenciaHasta: '2026-12-31',
      },
      carrito(),
    );
    expect(r.ok).toBe(true);
  });

  it('incluye todo el día final en la zona del tenant', () => {
    const r = evaluarCupon(
      { ...base, vigenciaHasta: '2026-08-08' },
      carrito({ ahora: new Date('2026-08-09T02:30:00Z') }),
    );
    expect(r.ok).toBe(true);
  });

  it('vence al cambiar el día comercial, no a medianoche UTC', () => {
    const cupon = { ...base, vigenciaHasta: '2026-08-08' };
    expect(
      evaluarCupon(cupon, carrito({ ahora: new Date('2026-08-09T02:59:59Z') }))
        .ok,
    ).toBe(true);
    expect(
      evaluarCupon(cupon, carrito({ ahora: new Date('2026-08-09T03:00:00Z') }))
        .ok,
    ).toBe(false);
  });

  it('prorratea monto fijo con suma exacta y centavos canónicos', () => {
    const plan = planDescuentoCupon(
      { tipo: 'MONTO', valor: 10 },
      [
        { key: 'a', neto: 10 },
        { key: 'b', neto: 10 },
        { key: 'c', neto: 10 },
      ],
      ['a', 'b', 'c'],
      2,
    );
    expect(plan.map((linea) => linea.valor)).toEqual([3.34, 3.33, 3.33]);
    expect(plan.reduce((suma, linea) => suma + linea.valor, 0)).toBeCloseTo(10);
  });

  it('respeta monedas sin decimales y nunca descuenta más que el neto', () => {
    const plan = planDescuentoCupon(
      { tipo: 'MONTO', valor: 999 },
      [
        { key: 'a', neto: 2 },
        { key: 'b', neto: 3 },
      ],
      ['a', 'b'],
      0,
    );
    expect(plan).toEqual([
      { key: 'a', tipo: 'MONTO', valor: 2 },
      { key: 'b', tipo: 'MONTO', valor: 3 },
    ]);
  });

  it('mantiene el prorrateo exacto cerca del máximo monetario', () => {
    const plan = planDescuentoCupon(
      { tipo: 'MONTO', valor: 999_999_999_999.99 },
      [
        { key: 'a', neto: 999_999_999_999.99 },
        { key: 'b', neto: 999_999_999_999.98 },
        { key: 'c', neto: 0.03 },
      ],
      ['a', 'b', 'c'],
      2,
    );
    expect(
      Math.round(plan.reduce((suma, linea) => suma + linea.valor, 0) * 100),
    ).toBe(99_999_999_999_999);
    expect(
      plan.every((linea) =>
        Number.isSafeInteger(Math.round(linea.valor * 100)),
      ),
    ).toBe(true);
  });

  it('alcance CATEGORIA filtra las líneas', () => {
    const r = evaluarCupon(
      { ...base, alcanceTipo: 'CATEGORIA', alcanceRef: 'carteleria' },
      carrito(),
    );
    expect(r).toEqual({ ok: true, alcanzadas: ['a'] });
  });

  it('alcance PRODUCTO matchea por id O por código', () => {
    // La ficha manda el uuid en `productoId` y el código aparte: un cupón
    // pudo guardar cualquiera de los dos según cómo se creó.
    const carritoConCodigos: ContextoCarrito = {
      ...carrito(),
      items: [
        {
          key: 'a',
          productoId: 'uuid-1',
          productoCodigo: 'FOLLETOS_A5',
          neto: 50_000,
        },
      ],
    };
    for (const ref of ['uuid-1', 'FOLLETOS_A5']) {
      expect(
        evaluarCupon(
          { ...base, alcanceTipo: 'PRODUCTO', alcanceRef: ref },
          carritoConCodigos,
        ),
      ).toEqual({ ok: true, alcanzadas: ['a'] });
    }
    expect(
      evaluarCupon(
        { ...base, alcanceTipo: 'PRODUCTO', alcanceRef: 'otro' },
        carritoConCodigos,
      ).ok,
    ).toBe(false);
  });

  it('alcance SUBCATEGORIA y PRODUCTO filtran igual', () => {
    expect(
      evaluarCupon(
        { ...base, alcanceTipo: 'SUBCATEGORIA', alcanceRef: 'tarjetas' },
        carrito(),
      ),
    ).toEqual({ ok: true, alcanzadas: ['b'] });
    expect(
      evaluarCupon(
        { ...base, alcanceTipo: 'PRODUCTO', alcanceRef: 'prod-1' },
        carrito(),
      ),
    ).toEqual({ ok: true, alcanzadas: ['a'] });
  });

  it('alcance sin ninguna línea adentro rechaza', () => {
    const r = evaluarCupon(
      { ...base, alcanceTipo: 'CATEGORIA', alcanceRef: 'textil' },
      carrito(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/alcance/);
  });

  it('alcance CLIENTE exige el cliente correcto (y alcanza todo)', () => {
    const cupon = { ...base, alcanceTipo: 'CLIENTE', alcanceRef: 'cli-1' };
    expect(evaluarCupon(cupon, carrito())).toEqual({
      ok: true,
      alcanzadas: ['a', 'b'],
    });
    expect(evaluarCupon(cupon, carrito({ clienteId: 'cli-2' })).ok).toBe(false);
    expect(evaluarCupon(cupon, carrito({ clienteId: null })).ok).toBe(false);
  });

  it('monto mínimo se controla contra el neto de TODA la orden', () => {
    // Alcanza sólo cartelería (80k), pero el ticket es 100k: pasa con mínimo 90k.
    const r = evaluarCupon(
      {
        ...base,
        alcanceTipo: 'CATEGORIA',
        alcanceRef: 'carteleria',
        montoMinimo: 90_000,
      },
      carrito(),
    );
    expect(r.ok).toBe(true);
    expect(evaluarCupon({ ...base, montoMinimo: 150_000 }, carrito()).ok).toBe(
      false,
    );
  });
});

describe('normalizarCodigoCupon', () => {
  it('trimea y pasa a mayúsculas', () => {
    expect(normalizarCodigoCupon('  sorteo2026 ')).toBe('SORTEO2026');
  });
});
