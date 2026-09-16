import {
  demandaHistorica,
  recuperarDemandasHistoricas,
} from './demanda-historica';
import { Prisma } from '@prisma/client';
import { aplicarOperacionMaquina } from './motor/demanda-humana';
const paso = {
  rutaPasoId: 'p',
  maquinaId: 'uv',
  familiaCodigo: 'impresion_por_area',
  duracionEstimadaMin: 80,
};
const tiempo = {
  maquinaId: 'uv',
  totalMin: 80,
  setupMin: 10,
  runMin: 60,
  cleanupMin: 10,
  tiempoFijoMin: 0,
  dotacionOperarios: 1,
};
const traza = { pasos: [{ rutaPasoId: 'p', tiempo }] };
it('recupera fases del snapshot exacto sin leer ni modificar geometría', () => {
  const fuente = {
    ...traza,
    get __grafo_geometrias_v2() {
      throw Error('No cargar geometría');
    },
  };
  expect(demandaHistorica(paso, fuente)).toEqual({
    version: 1,
    verificada: true,
    fases: [
      { minutos: 10, personas: 1 },
      { minutos: 60, personas: 0 },
      { minutos: 10, personas: 1 },
    ],
  });
});
it('busca en componentes históricos y rechaza otra duración, máquina o identidad', () => {
  expect(
    demandaHistorica(paso, { componentesFabricados: [traza] })?.verificada,
  ).toBe(true);
  for (const otro of [
    { ...paso, maquinaId: 'eco' },
    { ...paso, duracionEstimadaMin: 160 },
    { ...paso, rutaPasoId: 'otra' },
  ])
    expect(demandaHistorica(otro, traza)).toBeNull();
  expect(
    demandaHistorica(paso, {
      pasos: [
        ...traza.pasos,
        { rutaPasoId: 'p', tiempo: { ...tiempo, dotacionOperarios: 2 } },
      ],
    }),
  ).toBeNull();
});
it('no libera recargas históricas de una guillotina sin secuencia', () => {
  const d = demandaHistorica(
    { ...paso, familiaCodigo: 'corte_guillotina' },
    traza,
  );
  expect(d?.verificada).toBe(false);
  expect(d?.fases.every((f) => f.personas === 1)).toBe(true);
  expect(aplicarOperacionMaquina(d, 'con_operario')?.verificada).toBe(true);
  expect(aplicarOperacionMaquina(d, 'autonoma')?.verificada).toBe(false);
});
it('no reconstruye una tanda consolidada con el tiempo de un solo participante', () => {
  expect(
    demandaHistorica({ ...paso, nestingLoteRol: 'OPERATIVO' }, traza),
  ).toBeNull();
});
it('acota lecturas y escrituras al tenant y actualiza sólo datos todavía ausentes', async () => {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const db = {
    ordenTrabajoItemPaso: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { ...paso, id: 'step', itemId: 'item', nestingLoteRol: null },
        ]),
      updateMany,
    },
    ordenTrabajoItem: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'item',
          parentItemId: null,
          trazabilidadSnapshotJson: traza,
          cotizacionItem: null,
        },
      ]),
    },
  };
  const res = await recuperarDemandasHistoricas(
    db as unknown as Prisma.TransactionClient,
    'tenant',
    [{ id: 'step', demandaHumanaJson: null }],
  );
  expect(res.get('step')?.verificada).toBe(true);
  const lecturaDelTenant: unknown = expect.objectContaining({
    where: expect.objectContaining({ tenantId: 'tenant' }) as unknown,
  });
  expect(db.ordenTrabajoItemPaso.findMany).toHaveBeenCalledWith(
    lecturaDelTenant,
  );
  expect(db.ordenTrabajoItem.findMany).toHaveBeenCalledWith(lecturaDelTenant);
  expect(updateMany).toHaveBeenCalledWith({
    where: expect.objectContaining({
      tenantId: 'tenant',
      id: 'step',
      maquinaId: 'uv',
      duracionEstimadaMin: 80,
      demandaHumanaJson: { equals: Prisma.AnyNull },
    }) as unknown,
    data: { demandaHumanaJson: res.get('step') },
  });
  await recuperarDemandasHistoricas(
    db as unknown as Prisma.TransactionClient,
    'tenant',
    [{ id: 'step', demandaHumanaJson: res.get('step') }],
  );
  expect(updateMany).toHaveBeenCalledTimes(1);
});
it('no devuelve una recuperación antigua si otro proceso ya modificó el paso', async () => {
  const db = {
    ordenTrabajoItemPaso: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ ...paso, id: 'step', itemId: 'item' }]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    ordenTrabajoItem: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'item', trazabilidadSnapshotJson: traza }]),
    },
  };
  expect(
    (
      await recuperarDemandasHistoricas(
        db as unknown as Prisma.TransactionClient,
        'tenant',
        [{ id: 'step' }],
      )
    ).size,
  ).toBe(0);
});

it('revisa una guillotina pendiente ya recuperada sin verificar, una sola vez y con compare-and-set', async () => {
  const anterior = { version: 1, verificada: false, fases: [{ minutos: 80, personas: 1 }] };
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const db = {
    ordenTrabajoItemPaso: {
      findMany: jest.fn().mockResolvedValue([{ ...paso, familiaCodigo: 'corte_guillotina', id: 'step', itemId: 'item', demandaHumanaJson: anterior }]),
      updateMany,
    },
    ordenTrabajoItem: { findMany: jest.fn().mockResolvedValue([{ id: 'item', trazabilidadSnapshotJson: traza }]) },
  };
  const resultado = await recuperarDemandasHistoricas(db as unknown as Prisma.TransactionClient, 'tenant', [{ id: 'step', demandaHumanaJson: anterior }]);
  expect(resultado.get('step')).toMatchObject({ revisionOperacion: 1, dotacionOperarios: 1 });
  expect(aplicarOperacionMaquina(resultado.get('step')!, 'con_operario')?.verificada).toBe(true);
  expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant', demandaHumanaJson: { equals: anterior }, estado: { not: 'hecho' } }) }));
  await recuperarDemandasHistoricas(db as unknown as Prisma.TransactionClient, 'tenant', [{ id: 'step', demandaHumanaJson: resultado.get('step') }]);
  expect(updateMany).toHaveBeenCalledTimes(1);
});
