import { calcularTotales } from '../totales-comprobante';
import {
  itemsOrdenConDescuento,
  renglonesDetalladosOrden,
  type OrdenItemFacturable,
} from '../items-orden-descuento';

/** Item de OT con descuento del 10% sobre un neto de lista de 46.215. */
const tarjetas: OrdenItemFacturable = {
  nombre: 'Tarjetas de visita',
  cantidad: 500,
  subtotal: 41595, // 46.215 − 4.620 ≈ 10% (redondeo comercial real)
  total: 50330, // 41.595 + 21% redondeado
  descuentoMonto: 4620,
};

const sinDescuento: OrdenItemFacturable = {
  nombre: 'Lona 3x2',
  cantidad: 1,
  subtotal: 80000,
  total: 96800,
  descuentoMonto: 0,
};

describe('itemsOrdenConDescuento — la bonificación devuelve la base exacta', () => {
  it('A: lista bonificada aterriza en el neto persistido al centavo', () => {
    const [item] = itemsOrdenConDescuento('A', [tarjetas]);
    expect(item.bonificacionPct).toBeGreaterThan(9.9);
    expect(item.bonificacionPct).toBeLessThan(10.1);
    const r = calcularTotales('A', [item]);
    expect(r.netoGravado).toBe(41595);
    expect(r.total).toBe(r2(41595 * 1.21));
  });

  it('B: usa el precio final persistido — cierra aunque el IVA no fuera 21%', () => {
    // total 50.330 ≠ 41.595 × 1.21 exacto (redondeo comercial): la línea B
    // debe aterrizar en el TOTAL persistido, no en neto × 1.21.
    const [item] = itemsOrdenConDescuento('B', [tarjetas]);
    const r = calcularTotales('B', [item]);
    expect(r.total).toBe(50330);
  });

  it('sin descuento no agrega bonificación y factura la base tal cual', () => {
    const [item] = itemsOrdenConDescuento('A', [sinDescuento]);
    expect(item.bonificacionPct).toBeUndefined();
    expect(calcularTotales('A', [item]).netoGravado).toBe(80000);
  });

  it('cantidades grandes no acumulan error de redondeo por línea', () => {
    // 5.000 unidades: si el precio unitario se redondeara a 2 decimales,
    // el error por línea escalaría hasta pesos enteros.
    const grande: OrdenItemFacturable = {
      nombre: 'Volantes',
      cantidad: 5000,
      subtotal: 123457,
      total: 149383,
      descuentoMonto: 13717,
    };
    const r = calcularTotales('A', itemsOrdenConDescuento('A', [grande]));
    expect(r.netoGravado).toBe(123457);
  });

  it('mezcla de items con y sin descuento suma el neto de la orden', () => {
    const r = calcularTotales(
      'A',
      itemsOrdenConDescuento('A', [tarjetas, sinDescuento]),
    );
    expect(r.netoGravado).toBe(41595 + 80000);
  });

  it('descuento del 100% (neto 0) no divide por cero', () => {
    const regalo: OrdenItemFacturable = {
      nombre: 'Muestra',
      cantidad: 1,
      subtotal: 0,
      total: 0,
      descuentoMonto: 5000,
    };
    const [item] = itemsOrdenConDescuento('A', [regalo]);
    expect(item.bonificacionPct).toBe(100);
    expect(calcularTotales('A', [item]).total).toBe(0);
  });

  it('cantidad 0 degrada a 1 sin romper el monto', () => {
    const raro: OrdenItemFacturable = {
      nombre: 'Ajuste',
      cantidad: 0,
      subtotal: 1000,
      total: 1210,
      descuentoMonto: 0,
    };
    const r = calcularTotales('A', itemsOrdenConDescuento('A', [raro]));
    expect(r.netoGravado).toBe(1000);
  });
});

describe('renglonesDetalladosOrden — cuándo la factura sale detallada', () => {
  // Orden B: saldo = total bruto de los items.
  const base = {
    letra: 'B' as const,
    saldo: 50330 + 96800,
    monto: 50330 + 96800,
    facturadoTotal: 0,
    descuentoTotal: 4620,
    items: [tarjetas, sinDescuento],
  };

  it('con descuento, factura completa y recálculo que cierra → detallada', () => {
    const items = renglonesDetalladosOrden(base);
    expect(items).not.toBeNull();
    expect(items).toHaveLength(2);
    expect(calcularTotales('B', items!).total).toBe(base.saldo);
  });

  it('sin descuento → null (la factura no cambia de cara)', () => {
    expect(
      renglonesDetalladosOrden({ ...base, descuentoTotal: 0 }),
    ).toBeNull();
  });

  it('monto parcial → null (no mapea a items)', () => {
    expect(
      renglonesDetalladosOrden({ ...base, monto: base.saldo / 2 }),
    ).toBeNull();
  });

  it('segunda factura (ya hay facturado) → null', () => {
    expect(
      renglonesDetalladosOrden({
        ...base,
        facturadoTotal: 1000,
        monto: base.saldo,
      }),
    ).toBeNull();
  });

  it('recálculo que no cierra contra el saldo → null (protege la deuda)', () => {
    // Saldo inflado artificialmente: simula un perfil de impuestos que hace
    // divergir el recálculo — mejor renglón único que desviar la deuda.
    expect(renglonesDetalladosOrden({ ...base, saldo: base.saldo + 500, monto: base.saldo + 500 })).toBeNull();
  });

  it('sin items → null', () => {
    expect(renglonesDetalladosOrden({ ...base, items: [] })).toBeNull();
  });
});

const r2 = (n: number) => Math.round(n * 100) / 100;
