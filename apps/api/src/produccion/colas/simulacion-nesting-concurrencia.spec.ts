import { PrismaService } from '../../prisma/prisma.service';
import { SimulacionNestingColaService } from './simulacion-nesting.service';
import { capacidadesDePrueba } from '../../../test/fixture-capacidades';

function consultaPendiente(cantidad = 1) {
  let iniciar!: () => void;
  const iniciada = new Promise<void>((resolve) => {
    iniciar = resolve;
  });
  let resolver!: (v: never[]) => void;
  let rechazar!: (e: Error) => void;
  const resultado = new Promise<never[]>((resolve, reject) => {
    resolver = resolve;
    rechazar = reject;
  });
  const findMany = jest
    .fn<Promise<never[]>, [{ where: { tenantId: string } }]>()
    .mockImplementation(() => {
      if (findMany.mock.calls.length === cantidad) iniciar();
      return resultado;
    });
  const prisma = {
    ordenTrabajoItemPaso: { findMany },
  } as unknown as PrismaService;
  return {
    service: new SimulacionNestingColaService(prisma, capacidadesDePrueba()),
    iniciada,
    findMany,
    resolver,
    rechazar,
  };
}

it('un fallo llega a ambas aperturas y permite reintentar con una nueva consulta', async () => {
  const { service, findMany, rechazar, iniciada } = consultaPendiente();
  const respuestas = Promise.allSettled([
    service.simular('tenant', 'uv', ['p1', 'p2']),
    service.simular('tenant', 'uv', ['p2', 'p1']),
  ]);
  await iniciada;
  expect(findMany).toHaveBeenCalledTimes(1);
  const error = new Error('Consulta interrumpida');
  rechazar(error);
  expect(await respuestas).toEqual([
    { status: 'rejected', reason: error },
    { status: 'rejected', reason: error },
  ]);
  findMany.mockResolvedValueOnce([]);
  await expect(service.simular('tenant', 'uv', ['p1', 'p2'])).rejects.toThrow(
    'Algún trabajo',
  );
  expect(findMany).toHaveBeenCalledTimes(2);
});

it('separa tenants y máquinas, conserva el límite global y permite duplicados sin otra plaza', async () => {
  const { service, findMany, resolver, iniciada } = consultaPendiente(2);
  const respuestas = Promise.allSettled([
    service.simular('tenant-a', 'uv', ['p1']),
    service.simular('tenant-b', 'uv', ['p1']),
    service.simular('tenant-a', 'uv', ['p1']),
  ]);
  await iniciada;
  expect(findMany).toHaveBeenCalledTimes(2);
  expect(findMany.mock.calls.map(([args]) => args.where.tenantId)).toEqual([
    'tenant-a',
    'tenant-b',
  ]);
  await expect(service.simular('tenant-a', 'eco', ['p1'])).rejects.toThrow(
    'simulación en curso',
  );
  await expect(service.simular('tenant-a', 'uv', ['p2'])).rejects.toThrow(
    'simulación en curso',
  );
  await expect(service.simular('tenant-c', 'uv', ['p1'])).rejects.toThrow(
    'simulación en curso',
  );
  resolver([]);
  expect((await respuestas).every((r) => r.status === 'rejected')).toBe(true);
  // Al terminar, incluso con error, la plaza vuelve a estar disponible.
  await expect(service.simular('tenant-c', 'uv', ['p1'])).rejects.toThrow(
    'Algún trabajo',
  );
  expect(findMany).toHaveBeenCalledTimes(3);
});
