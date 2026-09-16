/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment -- Dobles de IO asíncrono en pruebas. */
import { DelayedError } from 'bullmq';
import { PlanificacionEntregasWorker } from './planificacion.worker';
import { PlanificacionEntregasDispatcher } from './planificacion-dispatcher';
import { huellaContextoPlan } from './planificacion-contrato';
import { exhibidorControlado } from '../../test/fixtures/f6-planificacion/exhibidor-controlado';

it('reprograma sin cotizar cuando el tenant ya ocupa su concurrencia', async () => {
  const planes = { calcular: jest.fn() },
    motor = { cotizar: jest.fn() };
  const worker = new PlanificacionEntregasWorker(
    planes as never,
    motor as never,
    { adquirir: async () => null } as never,
  );
  const job = {
    id: 'r',
    token: 't',
    data: { tenantId: 'empresa', revisionId: 'revision' },
    moveToDelayed: jest.fn(),
  };
  await expect(worker.procesar(job as never)).rejects.toBeInstanceOf(
    DelayedError,
  );
  expect(job.moveToDelayed).toHaveBeenCalled();
  expect(planes.calcular).not.toHaveBeenCalled();
});
it('ejecuta desde IDs persistidos y libera el turno incluso con error', async () => {
  const lease = { clave: 'c', propietario: 'p', duracionMs: 1000 };
  const concurrency = {
    adquirir: jest.fn(async () => lease),
    liberar: jest.fn(),
    renovar: jest.fn(),
  };
  concurrency.liberar.mockResolvedValue(undefined);
  const motor = { cotizar: jest.fn(async () => ({ exitoso: true })) };
  const planes = {
    calcular: jest.fn(async (_tenant, _id, cotizar) => {
      await cotizar({ tenantId: 'empresa' });
      throw new Error('fallo de DB');
    }),
  };
  const worker = new PlanificacionEntregasWorker(
    planes as never,
    motor as never,
    concurrency as never,
  );
  await expect(
    worker.procesar({
      id: 'r',
      data: { tenantId: 'empresa', revisionId: 'revision' },
    } as never),
  ).rejects.toThrow('fallo de DB');
  expect(planes.calcular).toHaveBeenCalledWith(
    'empresa',
    'revision',
    expect.any(Function),
    expect.any(AbortSignal),
  );
  expect(concurrency.liberar).toHaveBeenCalledWith(lease);
});
it('el dispatcher transporta sólo identificadores y usa la revisión para deduplicar', async () => {
  const revision = { id: 'r', tenantId: 't' };
  const db = {
    planEntregaRevision: {
      updateMany: jest.fn(),
      findMany: jest.fn(async () => [revision]),
    },
  };
  const dispatcher = new PlanificacionEntregasDispatcher(db as never);
  const queue = { add: jest.fn(async () => undefined) };
  Object.assign(dispatcher, { queue });
  await dispatcher.despachar();
  await dispatcher.despachar();
  expect(queue.add).toHaveBeenCalledTimes(2);
  expect(queue.add).toHaveBeenLastCalledWith(
    'delivery.plan',
    { tenantId: 't', revisionId: 'r' },
    expect.objectContaining({ jobId: 'r' }),
  );
  expect(db.planEntregaRevision.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ estado: 'FALLIDA', ejecucionId: null }),
    }),
  );
});
it('la huella ignora el reloj y el orden de mapas pero detecta capacidad y feriados', () => {
  const t = exhibidorControlado().taller;
  const a = huellaContextoPlan(t, 1);
  expect(
    huellaContextoPlan(
      {
        ...t,
        ahora: new Date(t.ahora.getTime() + 1000),
        estaciones: [...t.estaciones].reverse(),
      },
      1,
    ),
  ).toBe(a);
  expect(
    huellaContextoPlan({ ...t, noLaborables: new Set(['2026-09-10']) }, 1),
  ).not.toBe(a);
  expect(
    huellaContextoPlan(
      {
        ...t,
        estaciones: t.estaciones.map((e) => ({
          ...e,
          capacidadConcurrente: 2,
        })),
      },
      1,
    ),
  ).not.toBe(a);
});
