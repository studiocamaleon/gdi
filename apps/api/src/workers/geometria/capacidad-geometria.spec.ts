import { createHash, randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { urlRedisWorkers } from '../redis';
import {
  CapacidadGeometriaService,
  type PermisoCapacidad,
  type RegistroCapacidad,
} from './capacidad-geometria.service';

describe('admisión compartida de geometría (Redis real aislado)', () => {
  const redis = new Redis(urlRedisWorkers(), { maxRetriesPerRequest: 1 });
  let prefix: string;
  let services: CapacidadGeometriaService[];
  let original: NodeJS.ProcessEnv;
  const job = (
    id: string,
    tenantId = id,
    clase: 'normal' | 'intensiva' = 'normal',
  ): RegistroCapacidad => ({
    jobId: id,
    tenantId,
    clase,
    prioridad: clase === 'normal' ? 5 : 20,
  });
  const service = () => {
    const s = new CapacidadGeometriaService();
    services.push(s);
    return s;
  };
  beforeEach(() => {
    original = { ...process.env };
    const pool = `test-capacidad-${randomUUID()}`;
    process.env.GRAFONEST_POOL_ID = pool;
    prefix = `grafo:geometry:capacity:v1:{${createHash('sha256').update(pool).digest('hex')}}`;
    services = [];
  });
  afterEach(async () => {
    services.forEach((s) => s.onApplicationShutdown());
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${prefix}*`,
        'COUNT',
        100,
      );
      if (keys.length) await redis.del(...keys);
      cursor = next;
    } while (cursor !== '0');
    process.env = original;
  });
  afterAll(() => redis.disconnect());

  it('varias réplicas respetan CPU, memoria y cupos en una admisión atómica', async () => {
    const replicas = [service(), service(), service()];
    const jobs = [
      ...Array.from({ length: 12 }, (_, i) => job(`normal-${i}`)),
      job('pesado', 'pesado', 'intensiva'),
    ];
    await Promise.all(jobs.map((j) => replicas[0].registrar(j)));
    const permisos = new Map<string, PermisoCapacidad>();
    for (let vuelta = 0; vuelta < 12; vuelta++) {
      await Promise.all(
        jobs
          .filter((j) => !permisos.has(j.jobId))
          .map(async (j, i) => {
            const lease = await replicas[i % replicas.length].adquirir(j);
            if (lease) permisos.set(j.jobId, lease);
          }),
      );
      const estado = await replicas[0].estado();
      expect(estado.cpuReservada).toBeLessThanOrEqual(4);
      expect(estado.memoriaReservadaMb).toBeLessThanOrEqual(4096);
      expect(estado.normalesActivos).toBeLessThanOrEqual(2);
      expect(estado.intensivosActivos).toBeLessThanOrEqual(1);
    }
    expect(permisos.size).toBe(3);
    expect(await replicas[1].estado()).toMatchObject({
      cpuReservada: 4,
      memoriaReservadaMb: 4096,
    });
    for (const permiso of permisos.values())
      expect(await replicas[2].liberar(permiso)).toBe(true);
    expect(await replicas[0].estado()).toMatchObject({
      cpuReservada: 0,
      permisosActivos: 0,
    });
  });

  it('una ráfaga de cien jobs no posterga a otra fábrica hasta el final', async () => {
    const s = service();
    const primero = (await s.adquirir(job('a-0', 'fabrica-a')))!;
    const pendientes = Array.from({ length: 100 }, (_, i) =>
      job(`a-${i + 1}`, 'fabrica-a'),
    );
    await Promise.all(pendientes.map((j) => s.registrar(j)));
    const b = job('b', 'fabrica-b');
    await s.registrar(b);
    await s.liberar(primero);
    let adelantados = 0,
      permisoB: PermisoCapacidad | null = null;
    for (let vuelta = 0; vuelta < 3 && !permisoB; vuelta++) {
      const permisoA = await s.adquirir(pendientes[adelantados]);
      if (permisoA) {
        adelantados++;
        await s.liberar(permisoA);
      }
      permisoB = await s.adquirir(b);
    }
    expect(permisoB).not.toBeNull();
    expect(adelantados).toBeLessThanOrEqual(1);
    await s.liberar(permisoB!);
  });

  it('reserva una entrada interactiva aunque haya más réplicas intensivas', async () => {
    process.env.GRAFONEST_HEAVY_MAX_ACTIVE = '2';
    const s = service();
    const a = await s.adquirir(job('heavy-a', 'a', 'intensiva'));
    const b = await s.adquirir(job('heavy-b', 'b', 'intensiva'));
    const normal = await s.adquirir(job('normal'));
    expect(a).not.toBeNull();
    expect(b).toBeNull();
    expect(normal).not.toBeNull();
  });

  it('reserva la intensiva pendiente ante una llegada continua de jobs normales', async () => {
    process.env.GRAFONEST_NORMAL_MAX_ACTIVE = '4';
    const s = service();
    const activos: PermisoCapacidad[] = [];
    for (let i = 0; i < 4; i++)
      activos.push((await s.adquirir(job(`a-${i}`)))!);
    await s.registrar(job('heavy', 'heavy', 'intensiva'));
    await s.liberar(activos[0]);
    await s.liberar(activos[1]);
    expect(await s.adquirir(job('nuevo-normal'))).toBeNull();
    expect(await s.adquirir(job('heavy', 'heavy', 'intensiva'))).not.toBeNull();
  });

  it('alterna las clases cuando el servidor sólo puede ejecutar una a la vez', async () => {
    process.env.GRAFONEST_POOL_CPU = '2';
    process.env.GRAFONEST_POOL_MEMORY_MB = '2048';
    const s = service();
    const primero = (await s.adquirir(job('h1', 'h', 'intensiva')))!;
    await s.registrar(job('n1', 'n'));
    await s.registrar(job('h2', 'h', 'intensiva'));
    await s.liberar(primero);
    expect(await s.adquirir(job('h2', 'h', 'intensiva'))).toBeNull();
    const normal = (await s.adquirir(job('n1', 'n')))!;
    expect(normal).not.toBeNull();
    await s.registrar(job('n2', 'n'));
    await s.liberar(normal);
    expect(await s.adquirir(job('n2', 'n'))).toBeNull();
    expect(await s.adquirir(job('h2', 'h', 'intensiva'))).not.toBeNull();
  });

  it('un registro provisional no bloquea turnos y confirmar no resucita un job terminado', async () => {
    const s = service();
    await s.registrar(job('api-cayo'), false);
    const otro = (await s.adquirir(job('real')))!;
    expect(otro).not.toBeNull();
    await s.liberar(otro);
    await s.confirmar('real');
    expect(await s.estado()).toMatchObject({
      trabajosPendientes: 1,
      permisosActivos: 0,
    });
    await s.cancelar('api-cayo');
    expect(await s.estado()).toMatchObject({ trabajosPendientes: 0 });
  });

  it('recupera permisos vencidos y un propietario viejo no libera al nuevo', async () => {
    const s = service(),
      j = job('recuperable');
    const viejo = (await s.adquirir(j))!;
    await redis.zadd(`${prefix}:leases`, 0, j.jobId);
    expect(await s.renovar(viejo)).toBe(false);
    const nuevo = (await s.adquirir(j))!;
    expect(nuevo).not.toBeNull();
    expect(nuevo.propietario).not.toBe(viejo.propietario);
    expect(await s.liberar(viejo)).toBe(false);
    expect(await s.estado()).toMatchObject({
      permisosActivos: 1,
      cpuReservada: 1,
    });
    await s.cancelar(j.jobId);
    expect(await s.estado()).toMatchObject({ permisosActivos: 1 });
    expect(await s.liberar(nuevo)).toBe(true);
  });

  it('rechaza configuración incompatible entre réplicas del mismo pool', async () => {
    await service().estado();
    process.env.GRAFONEST_POOL_CPU = '8';
    await expect(service().estado()).rejects.toThrow(
      'GRAFONEST_POOL_CONFIG_MISMATCH',
    );
  });

  it('señala el próximo trabajo respetando prioridad dentro de la fábrica', async () => {
    const s = service();
    const activo = (await s.adquirir(job('activo', 'a')))!;
    await s.registrar({ ...job('prioridad-baja', 'a'), prioridad: 20 });
    await s.registrar({ ...job('prioridad-alta', 'a'), prioridad: 1 });
    expect(await s.siguiente('normal')).toBeNull();
    await s.liberar(activo);
    expect(await s.siguiente('normal')).toBe('prioridad-alta');
    const siguiente = (await s.adquirir({
      ...job('prioridad-alta', 'a'),
      prioridad: 1,
    }))!;
    expect(siguiente).not.toBeNull();
    await s.liberar(siguiente);
    expect(await s.siguiente('normal')).toBe('prioridad-baja');
  });

  it('un turno abandonado vence sin borrar el job de BullMQ ni bloquear otra fábrica', async () => {
    const s = service();
    await s.registrar(job('abandonado', 'a'));
    await redis.zadd(`${prefix}:expires`, 0, 'abandonado');
    const nuevo = await s.adquirir(job('en-cola', 'b'));
    expect(nuevo).not.toBeNull();
    await s.liberar(nuevo!);
    // Si BullMQ lo entrega tarde, vuelve a registrarse y puede ejecutarse.
    expect(await s.adquirir(job('abandonado', 'a'))).not.toBeNull();
  });
});
