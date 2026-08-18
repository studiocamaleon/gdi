import { CAMPOS_DE_PLATA, FALSOS_AMIGOS, podarPlata } from '../margenes';

/**
 * Qué se saca y —sobre todo— qué NO se saca de una respuesta cuando el usuario
 * no puede ver la plata.
 */
describe('podar la plata', () => {
  it('saca costos y márgenes de cualquier profundidad', () => {
    const cotizacion = {
      total: 185400,
      items: [
        {
          nombre: 'Lona 3x2',
          precioUnitario: 92700,
          costoUnitario: 41000,
          desglose: { costoTotal: 82000, margenBrutoPct: 55.7 },
        },
      ],
    };
    expect(podarPlata(cotizacion)).toEqual({
      total: 185400,
      items: [
        {
          nombre: 'Lona 3x2',
          precioUnitario: 92700,
          desglose: {},
        },
      ],
    });
  });

  /** Lo que el vendedor SÍ tiene que ver: lo que le cobra al cliente. */
  it('no toca los precios de venta ni los totales', () => {
    const v = {
      precioUnitario: 100,
      precioFinal: 121,
      subtotal: 100,
      total: 121,
      iva: 21,
    };
    expect(podarPlata(v)).toEqual(v);
  });

  /**
   * El motivo de que la lista sea explícita: estos son milímetros de papel,
   * no plata. Podarlos rompe el nesting en silencio y sólo para algunos
   * usuarios.
   */
  it('NO poda los márgenes físicos de impresión', () => {
    for (const clave of FALSOS_AMIGOS) {
      expect(CAMPOS_DE_PLATA.has(clave)).toBe(false);
      const salida = podarPlata({ [clave]: 5 }) as Record<string, unknown>;
      expect(salida[clave]).toBe(5);
    }
  });

  it('un pliego con márgenes físicos sobrevive entero', () => {
    const pliego = {
      anchoMm: 700,
      altoMm: 1000,
      margenesNoImprimiblesMm: { top: 5, bottom: 5, left: 3, right: 3 },
      margenNoUsableMm: 4,
      costoTotal: 1200,
    };
    expect(podarPlata(pliego)).toEqual({
      anchoMm: 700,
      altoMm: 1000,
      margenesNoImprimiblesMm: { top: 5, bottom: 5, left: 3, right: 3 },
      margenNoUsableMm: 4,
    });
  });

  /**
   * Un cero es un dato: se suma, se promedia y termina en un reporte diciendo
   * que la imprenta trabaja sin costos. Ausente es ausente.
   */
  it('borra el campo en vez de ponerlo en cero', () => {
    const salida = podarPlata({ costoTotal: 5000 }) as Record<string, unknown>;
    expect('costoTotal' in salida).toBe(false);
  });

  it('no rompe fechas ni valores sueltos', () => {
    const fecha = new Date('2026-07-24T00:00:00.000Z');
    const salida = podarPlata({ fecha, numero: 'OT-01285', nulo: null });
    expect(salida).toEqual({ fecha, numero: 'OT-01285', nulo: null });
    expect(podarPlata(42)).toBe(42);
    expect(podarPlata(null)).toBeNull();
  });

  it('poda dentro de arrays de arrays', () => {
    const salida = podarPlata([[{ costo: 1, nombre: 'x' }]]);
    expect(salida).toEqual([[{ nombre: 'x' }]]);
  });

  it('conserva la bandera de UI aunque quite el detalle de márgenes', () => {
    expect(
      podarPlata({
        margenesVisibles: false,
        margenClientes: [{ cliente: 'Imprenta Sur', margen: 45000 }],
      }),
    ).toEqual({ margenesVisibles: false });
  });
});
