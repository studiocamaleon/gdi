import { Prisma } from '@prisma/client';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import { exigirMismoTrabajo } from '../pedidos/snapshot-pedido';

type DatosItem = {
  cantidad: string;
  costoUnitario: string;
  costoTotal: string;
  precioNetoUnitario: string | null;
  precioNetoTotal: string | null;
  precioUnitario: string | null;
  precioTotal: string | null;
  jobContextJson: Record<string, unknown>;
  snapshotJson: {
    producto: { unidadComercial: string };
    ejecucion: {
      cantidadComercialReal: number;
      unidadComercialPricing: string;
    };
  };
};
const motor = new MotorUniversalService({} as never, {} as never, {} as never);
const persistir = (
  motor as unknown as { buildCotizacionItemData(args: unknown): DatosItem }
).buildCotizacionItemData.bind(motor);
function fixture(copias = 10, cad = true) {
  const jobContext = {
    cantidad: copias,
    caras: 1,
    modoColor: 'BN',
    piezas: [
      {
        cantidad: copias,
        anchoMm: 594.0036944444444,
        altoMm: 841.0010555555555,
      },
    ],
    ...(cad ? { _centroCopiado: { modo: 'CAD', copias, esTomo: false } } : {}),
  };
  return {
    tenantId: 'empresa-ficticia',
    cotizacionId: 'cotizacion-ficticia',
    productoId: 'plano',
    jobContext,
    inputHash: 'ensayo',
    periodo: '2026-10',
    producto: { productoId: 'plano', unidadComercial: 'ml', pasos: [] },
    cotizacion: {
      cantidadPedida: copias,
      cantidadComercialReal: 0.596 * copias,
      cantidadComercialPricing: 0.596 * copias,
      unidadComercialPricing: 'ml',
      cantidadEfectiva: copias,
      pasos: [],
      costos: { total: 100 * copias, unitario: 100 / 0.596 },
      desglosePrecio: {
        precioNetoTotal: 2500 * copias,
        precioBrutoTotal: 3025 * copias,
        precioNetoUnitario: 2500 / 0.596,
        precioBrutoUnitario: 3025 / 0.596,
        descuento: { montoTotal: 0 },
      },
    },
  };
}
it.each([1, 5, 10])(
  'guarda %s planos sin confundirlos con ML y permite revisar la OT',
  (copias) => {
    const f = fixture(copias);
    const data = persistir(f);
    expect(data.cantidad).toBe(String(copias));
    expect(data.snapshotJson.producto.unidadComercial).toBe('u');
    expect(data).toMatchObject({
      costoUnitario: '100',
      precioNetoUnitario: '2500',
      precioUnitario: '3025',
    });
    expect(Number(data.precioTotal)).toBe(3025 * copias);
    expect(Number(data.precioNetoTotal)).toBe(2500 * copias);
    expect(Number(data.costoTotal)).toBe(100 * copias);
    expect(data.snapshotJson.ejecucion).toMatchObject({
      cantidadComercialReal: 0.596 * copias,
      unidadComercialPricing: 'ml',
    });
    const original = {
      productoId: 'plano',
      cantidad: new Prisma.Decimal(data.cantidad),
      jobContextJson: data.jobContextJson as Prisma.JsonObject,
    };
    expect(() =>
      exigirMismoTrabajo(original, {
        productoId: 'plano',
        cantidad: copias,
        jobContext: f.jobContext,
      }),
    ).not.toThrow();
    expect(() =>
      exigirMismoTrabajo(original, {
        productoId: 'plano',
        cantidad: copias + 1,
        jobContext: { ...f.jobContext, cantidad: copias + 1 },
      }),
    ).toThrow('no coinciden');
  },
);
it('conserva ML y precios unitarios fuera de Centro de copiado', () => {
  const data = persistir(fixture(10, false));
  expect(data.cantidad).toBe('5.96');
  expect(data.snapshotJson.producto.unidadComercial).toBe('ml');
  expect(Number(data.precioUnitario)).toBeCloseTo(3025 / 0.596);
});
