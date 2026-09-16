import type { Prisma } from '@prisma/client';
import { leerAprobacionesPendientes } from './aprobaciones-pendientes';

it('comparte las aprobaciones de orden, paso e ítem y hereda las del producto en lotes', async () => {
  const gate = (nombre: string, alcance: string, extra = {}) => ({
    nombre,
    alcance,
    ordenId: 'ot',
    ordenItemId: null,
    pasoId: null,
    tipoAprobacion: 'CLIENTE',
    archivoMaestro: { revisionLiberada: null },
    ...extra,
  });
  const findMany = jest
    .fn()
    .mockResolvedValue([
      gate('General', 'ORDEN'),
      gate('Producto original', 'ITEM', { ordenItemId: 'original' }),
      gate('Sólo corte', 'PASO', { pasoId: 'corte' }),
      gate('Otro ítem', 'ITEM', { ordenItemId: 'otro' }),
      gate('Ya aprobada', 'ORDEN', {
        archivoMaestro: {
          revisionLiberada: { solicitudes: [{ tipo: 'CLIENTE' }] },
        },
      }),
    ]);
  const db = {
    gateProduccionDocumento: { findMany },
    ordenTrabajoItem: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'producto-lote', parentItemId: 'original' }]),
    },
  } as unknown as Prisma.TransactionClient;
  const referencias = [
    {
      id: 'corte',
      ordenId: 'ot',
      itemId: 'componente',
      item: { loteEntregaId: 'lote', parentItemId: 'producto-lote' },
    },
    { id: 'impresion', ordenId: 'ot', itemId: 'independiente', item: {} },
  ];
  const resultado = await leerAprobacionesPendientes(db, 'tenant', referencias);
  expect(resultado.get('corte')).toEqual([
    'General',
    'Producto original',
    'Sólo corte',
  ]);
  expect(resultado.get('impresion')).toEqual(['General']);
  expect(findMany).toHaveBeenCalledTimes(1);
  expect(findMany.mock.calls[0][0].where).toEqual({
    tenantId: 'tenant',
    ordenId: { in: ['ot'] },
    activo: true,
  });
});

it('no consulta aprobaciones ni historial cuando no hay pasos activos', async () => {
  const db = {} as Prisma.TransactionClient;
  expect(await leerAprobacionesPendientes(db, 'tenant', [])).toEqual(new Map());
});
