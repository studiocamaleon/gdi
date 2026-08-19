import { dataCotizacionItemTomo } from '../persistencia-tomo';

it('persiste sin recalcular el resultado completo del motor universal', () => {
  const data = dataCotizacionItemTomo({
    tenantId: 'tenant-1',
    cotizacionId: 'cotizacion-1',
    productoId: 'producto-1',
    rutaAlternativaId: 'ruta-1',
    tomo: {
      juegos: 2,
      anilladoActivo: true,
      costos: {
        unitario: 250,
        total: 500,
        materiales: 320,
        procesos: 180,
      },
      subtotal: 800,
      iva: 168,
      total: 968,
      jobContext: { origen: 'CENTRO_COPIADO', documentos: 3 },
      pasos: [{ codigo: 'IMPRESION', costo: 500 }],
      precio: {
        precioConfig: { margen: 0.6 },
        impuestos: { alicuota: 0.21 },
        comisiones: { total: 0 },
        precioEspecialCliente: { reglaId: 'regla-1' },
      },
    },
  });

  expect(data).toMatchObject({
    cantidad: '2',
    costoUnitario: '250',
    costoTotal: '500',
    precioNetoUnitario: '400',
    precioNetoTotal: '800',
    impuestosPorFueraTotal: '168',
    precioUnitario: '484',
    precioTotal: '968',
    precioEspecialClienteSnapshotJson: { reglaId: 'regla-1' },
  });
  expect(data.jobContextJson).toEqual({
    origen: 'CENTRO_COPIADO',
    documentos: 3,
  });
  expect(data.snapshotJson).toMatchObject({
    ejecucion: {
      cantidadEfectiva: 2,
      costos: {
        unitario: 250,
        total: 500,
        materiales: 320,
        procesos: 180,
      },
    },
  });
});
