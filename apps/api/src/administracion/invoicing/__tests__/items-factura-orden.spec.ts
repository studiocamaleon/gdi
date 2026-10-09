import {
  conciliarRenglones,
  renglonesFacturaOrden,
  type OrdenParaFactura,
} from '../items-factura-orden';
import { calcularTotales } from '../totales-comprobante';

const orden: OrdenParaFactura = {
  numero: 'OT-PRUEBA-1',
  total: 1783.5,
  facturadoTotal: 0,
  items: [
    {
      nombre: 'Tarjetas',
      cantidad: 500,
      subtotal: 800,
      total: 968,
      descuentoMonto: 200,
    },
    {
      nombre: 'Vinilo',
      cantidad: 0.5,
      subtotal: 300,
      total: 331.5,
      descuentoMonto: 0,
    },
    {
      nombre: 'Muestra gratuita',
      cantidad: 1,
      subtotal: 0,
      total: 0,
      descuentoMonto: 100,
    },
    {
      nombre: 'Componente interno',
      parentItemId: 'padre',
      cantidad: 2,
      subtotal: 2000,
      total: 2420,
      descuentoMonto: 0,
    },
  ],
  cargosDirectosJson: [
    {
      nombreSnapshot: 'Viático',
      cantidadInput: 4,
      montoNeto: 400,
      impuestoPorcentaje: 21,
      total: 484,
      costoInterno: 7,
    },
  ],
};

describe('Detalle fiscal de productos y cargos', () => {
  it.each(['A', 'B', 'C', 'E'] as const)(
    '%s conserva el total, cantidades, descuentos y cargos sin duplicarlos',
    (letra) => {
      const items = renglonesFacturaOrden(orden, letra, 1783.5, 'items');
      expect(items.map((i) => i.descripcion)).toEqual([
        'Tarjetas',
        'Vinilo',
        'Muestra gratuita',
        'Viático',
      ]);
      expect(items.map((i) => i.cantidad)).toEqual([500, 0.5, 1, 1]);
      expect(items[0].bonificacionPct).toBe(20);
      expect(items[2].bonificacionPct).toBe(100);
      expect(calcularTotales(letra, items).total).toBe(1783.5);
      expect(JSON.stringify(items)).not.toContain('costoInterno');
      if (letra === 'A' || letra === 'B')
        expect(items[1].alicuotaIva).toBe(10.5);
    },
  );
  it('detalla también una orden SIN descuento y conserva centavos con 5000 unidades', () => {
    const o = {
      ...orden,
      total: 12100.37,
      items: [
        {
          nombre: 'Volantes',
          cantidad: 5000,
          subtotal: 10000.31,
          total: 12100.37,
          descuentoMonto: 0,
        },
      ],
      cargosDirectosJson: null,
    };
    const items = renglonesFacturaOrden(o, 'B', 12100.37, 'items');
    expect(items[0].descripcion).toBe('Volantes');
    expect(items[0].cantidad).toBe(5000);
    expect(calcularTotales('B', items).total).toBe(12100.37);
  });
  it.each(['A', 'B'] as const)(
    '%s usa el IVA congelado aunque el redondeo unitario acumule diferencias',
    (letra) => {
      const cantidad = 600;
      const total = 146.88 * cantidad;
      const o: OrdenParaFactura = {
        numero: 'OT-FICTICIA-REDONDEO',
        total,
        facturadoTotal: 0,
        items: [
          {
            nombre: 'Impresos de prueba',
            cantidad,
            subtotal: 121.39 * cantidad,
            total,
            descuentoMonto: 0,
            cotizacionItem: {
              impuestosSnapshotJson: [
                { traslado: 'POR_DENTRO', porcentaje: 3.5 },
                { traslado: 'POR_FUERA', porcentaje: 21 },
              ],
            },
          },
        ],
      };
      expect(
        Math.abs(total - Number(o.items[0].subtotal) * 1.21),
      ).toBeGreaterThan(0.51);
      for (const detalle of ['items', 'orden'] as const) {
        const lineas = renglonesFacturaOrden(o, letra, total, detalle);
        expect(lineas[0].alicuotaIva).toBe(21);
        expect(calcularTotales(letra, lineas).total).toBe(total);
      }
      const parcial = renglonesFacturaOrden(o, letra, 1000, 'items');
      expect(parcial[0].alicuotaIva).toBe(21);
      expect(calcularTotales(letra, parcial).total).toBe(1000);
    },
  );
  it('respeta el IVA congelado con redondeo comercial a pesos enteros', () => {
    const total = 1450;
    const o: OrdenParaFactura = {
      numero: 'OT-FICTICIA-ENTEROS',
      total,
      facturadoTotal: 0,
      items: [
        {
          nombre: 'Prueba entera',
          cantidad: 10,
          subtotal: 1200,
          total,
          descuentoMonto: 0,
          cotizacionItem: {
            impuestosSnapshotJson: [
              { traslado: 'POR_FUERA', porcentaje: '21' },
            ],
          },
        },
      ],
    };
    const lineas = renglonesFacturaOrden(o, 'A', total, 'items');
    expect(lineas[0].alicuotaIva).toBe(21);
    expect(calcularTotales('A', lineas).total).toBe(total);
  });
  it('rechaza importes históricos ambiguos sin inventar una alícuota', () => {
    const o = {
      ...orden,
      total: 0.1,
      cargosDirectosJson: null,
      items: [
        {
          nombre: 'Prueba histórica',
          cantidad: 1,
          subtotal: 0.07,
          total: 0.1,
          descuentoMonto: 0,
        },
      ],
    };
    expect(() => renglonesFacturaOrden(o, 'A', 0.1, 'items')).toThrow(
      'No se pudo determinar el IVA',
    );
  });
  it.each([7, null, 'no-numero'])(
    'rechaza una alícuota congelada inválida (%s), sin reemplazarla por otra',
    (porcentaje) => {
      const o = {
        ...orden,
        total: 121,
        cargosDirectosJson: null,
        items: [
          {
            nombre: 'Prueba',
            cantidad: 1,
            subtotal: 100,
            total: 121,
            descuentoMonto: 0,
            cotizacionItem: {
              impuestosSnapshotJson: [{ traslado: 'POR_FUERA', porcentaje }],
            },
          },
        ],
      };
      expect(() => renglonesFacturaOrden(o, 'A', 121, 'items')).toThrow(
        'No se pudo determinar el IVA',
      );
    },
  );
  it('no infiere otra alícuota cuando hay varios impuestos externos', () => {
    const o = {
      ...orden,
      total: 121,
      cargosDirectosJson: null,
      items: [
        {
          nombre: 'Prueba',
          cantidad: 1,
          subtotal: 100,
          total: 121,
          descuentoMonto: 0,
          cotizacionItem: {
            impuestosSnapshotJson: [
              { traslado: 'POR_FUERA', porcentaje: 21 },
              { traslado: 'POR_FUERA', porcentaje: 10.5 },
            ],
          },
        },
      ],
    };
    expect(() => renglonesFacturaOrden(o, 'B', 121, 'items')).toThrow(
      'No se pudo determinar el IVA',
    );
  });
  it('el resumen conserva alícuotas y total del detalle', () => {
    const items = renglonesFacturaOrden(orden, 'A', 1783.5, 'orden');
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.descripcion.includes(orden.numero))).toBe(true);
    expect(calcularTotales('A', items)).toEqual(
      calcularTotales('A', renglonesFacturaOrden(orden, 'A', 1783.5, 'items')),
    );
  });
  it('identifica a qué OT pertenece cada producto y cada cargo en una agrupada', () => {
    const items = renglonesFacturaOrden(
      orden,
      'B',
      1783.5,
      'items',
      undefined,
      true,
    );
    expect(items.every((i) => i.descripcion.startsWith('OT-PRUEBA-1 · '))).toBe(
      true,
    );
  });
  it.each([0, 800])(
    'un importe parcial se describe como tal y no vuelve a facturar cantidades completas (%s facturado)',
    (facturadoTotal) => {
      const items = renglonesFacturaOrden(
        { ...orden, facturadoTotal },
        'B',
        400,
        'items',
      );
      expect(
        items.every((i) => i.descripcion.startsWith('Facturación parcial')),
      ).toBe(true);
      expect(items.every((i) => i.cantidad === 1)).toBe(true);
      expect(calcularTotales('B', items).total).toBe(400);
    },
  );
  it('rechaza diferencias y datos corruptos antes de emitir', () => {
    expect(() =>
      renglonesFacturaOrden({ ...orden, total: 2000 }, 'B', 2000, 'items'),
    ).toThrow('no coincide');
    expect(() =>
      renglonesFacturaOrden(
        { ...orden, cargosDirectosJson: [{ montoNeto: 'mal', total: 484 }] },
        'B',
        1783.5,
        'items',
      ),
    ).toThrow('no coincide');
  });
  it('concilia centavos en A tanto por orden como al agrupar muchos renglones', () => {
    const todas = [];
    let total = 0;
    for (let centavos = 10000; centavos < 10300; centavos++) {
      const bruto = centavos / 100;
      const o = {
        ...orden,
        total: bruto,
        cargosDirectosJson: null,
        items: [
          {
            nombre: 'Prueba',
            cantidad: 500,
            subtotal: Math.round((bruto / 1.21) * 100) / 100,
            total: bruto,
            descuentoMonto: 0,
          },
        ],
      };
      const items = renglonesFacturaOrden(o, 'A', bruto, 'items');
      expect(calcularTotales('A', items).total).toBe(bruto);
      todas.push(...items);
      total += bruto;
    }
    expect(
      calcularTotales('A', conciliarRenglones('A', todas, total)).total,
    ).toBe(Math.round(total * 100) / 100);
  });
});
