import {
  evaluarCupon,
  normalizarCodigoCupon,
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
      [{ vigenciaDesde: new Date('2026-09-01') }, /todavía no/],
      [{ vigenciaHasta: new Date('2026-08-01') }, /vencido/],
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
        vigenciaDesde: new Date('2026-08-01'),
        vigenciaHasta: new Date('2026-12-31'),
      },
      carrito(),
    );
    expect(r.ok).toBe(true);
  });

  it('alcance CATEGORIA filtra las líneas', () => {
    const r = evaluarCupon(
      { ...base, alcanceTipo: 'CATEGORIA', alcanceRef: 'carteleria' },
      carrito(),
    );
    expect(r).toEqual({ ok: true, alcanzadas: ['a'] });
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
    expect(
      evaluarCupon({ ...base, montoMinimo: 150_000 }, carrito()).ok,
    ).toBe(false);
  });
});

describe('normalizarCodigoCupon', () => {
  it('trimea y pasa a mayúsculas', () => {
    expect(normalizarCodigoCupon('  sorteo2026 ')).toBe('SORTEO2026');
  });
});
