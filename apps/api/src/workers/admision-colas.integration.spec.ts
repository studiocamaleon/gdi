import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { ColaCalculos, CUPO_CALCULOS } from './cola-calculos';
import { GeometriaJobsService } from './geometria/geometria-jobs.service';
import { CapacidadGeometriaService } from './geometria/capacidad-geometria.service';
import { ControlTrabajosGeometriaService } from './control-trabajos-geometria.service';
import { COLA_GEOMETRIA } from './colas';
import {
  CotizacionJobsService,
  COLA_COTIZACIONES,
} from './cotizacion/cotizacion-jobs.service';

describe('Cupos durables de cálculos (Redis desechable)', () => {
  const url = process.env.TEST_QUEUE_REDIS_URL;
  const original = process.env.REDIS_URL;
  let queue: Queue;
  let servicios: CotizacionJobsService[];
  beforeAll(async () => {
    if (
      !url ||
      new URL(url).hostname !== '127.0.0.1' ||
      new URL(url).port !== '16387'
    )
      throw new Error(
        'Esta suite requiere un Redis desechable exclusivo en 127.0.0.1:16387.',
      );
    process.env.REDIS_URL = url;
    queue = new Queue(COLA_COTIZACIONES, { connection: { url } });
    await queue.waitUntilReady();
  });
  beforeEach(async () => {
    servicios = [crearServicio(), crearServicio()];
    await queue.obliterate({ force: true });
  });
  afterEach(async () => {
    await Promise.all(servicios.map((s) => s.onApplicationShutdown()));
    await queue.obliterate({ force: true });
  });
  afterAll(async () => {
    await queue?.close();
    if (original === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = original;
  });
  function crearServicio() {
    return new CotizacionJobsService({
      exigirTodas: jest.fn().mockResolvedValue(undefined),
    } as never);
  }
  const input = (tenantId = 'empresa-a') => ({
    cotizacion: {
      tenantId,
      productoId: 'producto-ficticio',
      jobContext: { cantidad: 1 },
    },
  });
  it('impide que una empresa supere 32 pendientes alternando servidores y deja entrar a otra', async () => {
    for (let i = 0; i < 32; i++) await servicios[i % 2].crear(input());
    await expect(servicios[1].crear(input())).rejects.toMatchObject({
      status: 429,
    });
    await expect(servicios[0].crear(input('empresa-b'))).resolves.toMatchObject(
      { estado: 'pendiente' },
    );
    expect(await queue.getWaitingCount()).toBe(33);
  });
  it('mantiene el cupo ante altas simultáneas desde dos servidores', async () => {
    const resultados = await Promise.allSettled(
      Array.from({ length: 50 }, (_, i) => servicios[i % 2].crear(input())),
    );
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(32);
    for (const r of resultados)
      if (r.status === 'rejected')
        expect(r.reason).toMatchObject({ status: 429 });
    expect(await queue.getWaitingCount()).toBe(32);
  });
  it('el cupo global impide sumar empresas indefinidamente', async () => {
    for (let i = 0; i < 128; i++)
      await servicios[i % 2].crear(input(`empresa-${Math.floor(i / 32)}`));
    await expect(
      servicios[0].crear(input('empresa-extra')),
    ).rejects.toMatchObject({ status: 429 });
    expect(await queue.getWaitingCount()).toBe(128);
  });
  it('un reinicio conserva el cupo y borrar un trabajo libera su lugar sin borrar los demás', async () => {
    const ids = [];
    for (let i = 0; i < 32; i++)
      ids.push((await servicios[0].crear(input())).id);
    await servicios[0].onApplicationShutdown();
    servicios[0] = crearServicio();
    await expect(servicios[0].crear(input())).rejects.toMatchObject({
      status: 429,
    });
    await (await queue.getJob(ids[0]))!.remove();
    await expect(servicios[0].crear(input())).resolves.toMatchObject({
      estado: 'pendiente',
    });
    expect(await queue.getWaitingCount()).toBe(32);
    expect(await queue.getJob(ids[1])).toBeDefined();
  });
  it('repetir la misma cotización no consume otro cupo ni se rechaza por estar lleno', async () => {
    const solicitud = { ...input(), claveSolicitud: 'sheet-ficticio' };
    const inicial = await servicios[0].crear(solicitud);
    for (let i = 0; i < 31; i++) await servicios[0].crear(input());
    expect((await servicios[1].crear(solicitud)).id).toBe(inicial.id);
    expect(await queue.getWaitingCount()).toBe(32);
  });
  it('trabajos activos, demorados y pausados siguen ocupando cupo', async () => {
    const ids = [];
    for (let i = 0; i < 32; i++)
      ids.push((await servicios[0].crear(input())).id);
    const worker = new Worker(COLA_COTIZACIONES, undefined, {
      connection: { url },
      autorun: false,
    });
    try {
      const active = await worker.getNextJob('token-prueba');
      expect(active).toBeDefined();
      await expect(servicios[1].crear(input())).rejects.toMatchObject({
        status: 429,
      });
      await active.moveToDelayed(Date.now() + 60_000, 'token-prueba');
      await queue.pause();
      await expect(servicios[1].crear(input())).rejects.toMatchObject({
        status: 429,
      });
      expect(await queue.getDelayedCount()).toBe(1);
      expect(await queue.getWaitingCount()).toBe(31);
    } finally {
      await worker.close();
    }
  });
  it('completar o fallar un trabajo libera capacidad y conserva el resultado para consultar', async () => {
    for (let i = 0; i < 32; i++) await servicios[0].crear(input());
    const worker = new Worker(COLA_COTIZACIONES, undefined, {
      connection: { url },
      autorun: false,
    });
    try {
      const a = await worker.getNextJob('token-a');
      await a.moveToCompleted({ exitoso: true, errores: [] }, 'token-a', false);
      const b = await worker.getNextJob('token-b');
      await b.moveToFailed(new Error('Fallo ficticio'), 'token-b', false);
      await servicios[1].crear(input());
      await servicios[1].crear(input());
      await expect(servicios[1].crear(input())).rejects.toMatchObject({
        status: 429,
      });
      expect(await queue.getCompletedCount()).toBe(1);
      expect(await queue.getFailedCount()).toBe(1);
      expect(await servicios[0].consultar('empresa-a', a.id!)).toMatchObject({
        estado: 'completado',
        resultado: { exitoso: true },
      });
    } finally {
      await worker.close();
    }
  });
  it('limita bytes además de cantidad, sin almacenar el trabajo rechazado', async () => {
    const cola = new ColaCalculos<
      { tenantId: string; contenido: string },
      string,
      'test'
    >('qa-bytes', (d) => d.tenantId);
    const r = new Redis(url!);
    try {
      await cola.add(
        'test',
        {
          tenantId: 'empresa-a',
          contenido: 'a'.repeat(CUPO_CALCULOS.bytesEmpresa / 2),
        },
        { jobId: 'uno' },
      );
      await expect(
        cola.add(
          'test',
          {
            tenantId: 'empresa-a',
            contenido: 'b'.repeat(CUPO_CALCULOS.bytesEmpresa / 2),
          },
          { jobId: 'dos' },
        ),
      ).rejects.toMatchObject({ status: 429 });
      await expect(
        cola.add(
          'test',
          {
            tenantId: 'empresa-b',
            contenido: 'c'.repeat(CUPO_CALCULOS.bytesTrabajo),
          },
          { jobId: 'grande' },
        ),
      ).rejects.toMatchObject({ status: 413 });
      expect(await cola.getWaitingCount()).toBe(1);
      expect(await r.exists(cola.toKey('dos'), cola.toKey('grande'))).toBe(0);
    } finally {
      await cola.obliterate({ force: true });
      await r.del(cola.toKey('grafo-admision-v1'));
      await cola.close();
      r.disconnect();
    }
  });
  it('la admisión no deja reservas si el proceso cae antes de confirmar EXEC', async () => {
    const raw = new Redis(url!, { maxRetriesPerRequest: 0 });
    const cola = new ColaCalculos<{ tenantId: string }, string, 'test'>(
      'qa-caida',
      (d) => d.tenantId,
      {},
      raw,
    );
    const r = new Redis(url!);
    try {
      await cola.waitUntilReady();
      const originalMulti = raw.multi.bind(raw);
      const espia = jest.spyOn(raw, 'multi').mockImplementation((...args) => {
        const tx = originalMulti(...args);
        jest
          .spyOn(tx, 'exec')
          .mockRejectedValueOnce(new Error('Caída ficticia antes de EXEC'));
        return tx;
      });
      await expect(
        cola.add('test', { tenantId: 'empresa-a' }, { jobId: 'interrumpido' }),
      ).rejects.toThrow('Caída ficticia');
      espia.mockRestore();
      expect(
        await r.exists(
          cola.toKey('interrumpido'),
          cola.toKey('grafo-admision-v1'),
        ),
      ).toBe(0);
      await expect(
        cola.add('test', { tenantId: 'empresa-a' }, { jobId: 'valido' }),
      ).resolves.toBeDefined();
    } finally {
      await cola.obliterate({ force: true });
      await r.del(cola.toKey('grafo-admision-v1'));
      await cola.close();
      r.disconnect();
    }
  });
  it('un alta confirmada cuya respuesta se pierde no consume dos cupos al reintentar', async () => {
    const raw = new Redis(url!, { maxRetriesPerRequest: 0 });
    const cola = new ColaCalculos<{ tenantId: string }, string, 'test'>(
      'qa-respuesta-perdida',
      (d) => d.tenantId,
      {},
      raw,
    );
    const r = new Redis(url!);
    try {
      await cola.waitUntilReady();
      const originalMulti = raw.multi.bind(raw);
      const espia = jest.spyOn(raw, 'multi').mockImplementation((...args) => {
        const tx = originalMulti(...args);
        const exec = tx.exec.bind(tx);
        jest.spyOn(tx, 'exec').mockImplementationOnce(async () => {
          await exec();
          throw new Error('Respuesta perdida después de EXEC');
        });
        return tx;
      });
      await expect(
        cola.add('test', { tenantId: 'empresa-a' }, { jobId: 'repetido' }),
      ).rejects.toThrow('Respuesta perdida');
      espia.mockRestore();
      await cola.add('test', { tenantId: 'empresa-a' }, { jobId: 'repetido' });
      expect(await cola.getWaitingCount()).toBe(1);
      expect(
        JSON.parse((await r.get(cola.toKey('grafo-admision-v1')))!),
      ).toHaveLength(1);
    } finally {
      await cola.obliterate({ force: true });
      await r.del(cola.toKey('grafo-admision-v1'));
      await cola.close();
      r.disconnect();
    }
  });
  it('no ignora ni borra los trabajos pendientes de una versión anterior', async () => {
    const antiguo = await queue.add(
      'quote.calculate.v1',
      { input: input().cotizacion },
      { jobId: 'version-anterior' },
    );
    await expect(servicios[0].crear(input())).rejects.toMatchObject({
      status: 503,
    });
    expect(await queue.getWaitingCount()).toBe(1);
    await antiguo.remove();
    await expect(servicios[0].crear(input())).resolves.toMatchObject({
      estado: 'pendiente',
    });
  });
  it('una reconexión no permite confirmar la transacción que perdió WATCH', async () => {
    const raw = new Redis(url!, {
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      autoResendUnfulfilledCommands: false,
    });
    const cola = new ColaCalculos<{ tenantId: string }, string, 'test'>(
      'qa-reconexion',
      (d) => d.tenantId,
      {},
      raw,
    );
    const r = new Redis(url!);
    try {
      const get = raw.get.bind(raw);
      const espia = jest
        .spyOn(raw, 'get')
        .mockImplementationOnce(async (key) => {
          const value = await get(key);
          const cerrado = new Promise<void>((resolve) =>
            raw.once('close', resolve),
          );
          raw.disconnect();
          await cerrado;
          await raw.connect();
          return value;
        });
      await expect(
        cola.add('test', { tenantId: 'empresa-a' }, { jobId: 'interrumpido' }),
      ).rejects.toMatchObject({ status: 503 });
      espia.mockRestore();
      expect(
        await r.exists(
          cola.toKey('interrumpido'),
          cola.toKey('grafo-admision-v1'),
        ),
      ).toBe(0);
      await expect(
        cola.add('test', { tenantId: 'empresa-a' }, { jobId: 'valido' }),
      ).resolves.toBeDefined();
    } finally {
      await cola.obliterate({ force: true });
      await r.del(cola.toKey('grafo-admision-v1'));
      await cola.close();
      r.disconnect();
    }
  });
  it('conserva una sola ejecución al reintentar simultáneamente un nesting fallido', async () => {
    const control = new ControlTrabajosGeometriaService();
    const capacidad = new CapacidadGeometriaService();
    const plan = {
      exigirTodas: jest.fn().mockResolvedValue(undefined),
      exigir: jest.fn().mockResolvedValue(undefined),
    };
    const productores = [
      new GeometriaJobsService(control, capacidad, plan as never),
      new GeometriaJobsService(control, capacidad, plan as never),
    ];
    const q = new Queue(COLA_GEOMETRIA, { connection: { url } });
    const worker = new Worker(COLA_GEOMETRIA, undefined, {
      connection: { url },
      autorun: false,
    });
    const dto = {
      claveSolicitud: 'sheet-reintento',
      placa: { anchoMm: 500, altoMm: 500, margenMm: 1, maxPlacas: 1 },
      separacionMm: 1,
      piezas: [
        {
          id: 'pieza-prueba',
          cantidad: 1,
          rotaciones: 4,
          contorno: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 0, y: 10 },
          ],
        },
      ],
    };
    try {
      const primero = await productores[0].crear({
        tenantId: 'empresa-reintento',
        dto,
      });
      const activo = await worker.getNextJob('token-reintento');
      await activo.moveToFailed(
        new Error('Fallo ficticio'),
        'token-reintento',
        false,
      );
      const [a, b] = await Promise.all(
        productores.map((p) => p.crear({ tenantId: 'empresa-reintento', dto })),
      );
      expect(a.id).toBe(b.id);
      expect(a.id).not.toBe(primero.id);
      expect(a.estado).toBe('pendiente');
      expect(await q.getPrioritizedCount()).toBe(1);
      expect(
        (await productores[0].crear({ tenantId: 'empresa-reintento', dto })).id,
      ).toBe(a.id);
      expect(
        (await productores[1].crear({ tenantId: 'otra-empresa', dto })).id,
      ).not.toBe(a.id);
      expect(await q.getPrioritizedCount()).toBe(2);
    } finally {
      await worker.close();
      await Promise.all(productores.map((p) => p.onApplicationShutdown()));
      control.onApplicationShutdown();
      capacidad.onApplicationShutdown();
      await q.obliterate({ force: true });
      await q.close();
    }
  });
  it('geometría aplica el cupo también a cotizaciones internas y no comparte el cupo de la cola padre', async () => {
    const control = new ControlTrabajosGeometriaService();
    const capacidad = new CapacidadGeometriaService();
    const geometria = new GeometriaJobsService(control, capacidad, {
      exigirTodas: jest.fn().mockResolvedValue(undefined),
      exigir: jest.fn().mockResolvedValue(undefined),
    } as never);
    const geometricQueue = new Queue(COLA_GEOMETRIA, { connection: { url } });
    const worker = new Worker(COLA_GEOMETRIA, undefined, {
      connection: { url },
      autorun: false,
    });
    const dto = {
      placa: { anchoMm: 500, altoMm: 500, margenMm: 1, maxPlacas: 1 },
      separacionMm: 1,
      piezas: [
        {
          id: 'pieza-prueba',
          cantidad: 1,
          rotaciones: 4,
          contorno: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 0, y: 10 },
          ],
        },
      ],
    };
    try {
      for (let i = 0; i < 32; i++) await servicios[0].crear(input());
      const crear = () =>
        geometria.crearParaCotizacion({ tenantId: 'empresa-a', dto });
      const primero = await crear();
      for (let i = 0; i < 31; i++) await crear();
      await expect(crear()).rejects.toMatchObject({ status: 429 });
      await expect(
        geometria.crear({ tenantId: 'empresa-a', dto }),
      ).rejects.toMatchObject({ status: 429 });
      await expect(
        geometria.crear({ tenantId: 'empresa-b', dto }),
      ).resolves.toMatchObject({ estado: 'pendiente' });
      const active = await worker.getNextJob('token-geometria');
      expect(active.id).toBe(primero.id);
      await active.moveToFailed(
        new Error('Fallo ficticio'),
        'token-geometria',
        false,
      );
      await expect(crear()).resolves.toMatchObject({ estado: 'pendiente' });
    } finally {
      await worker.close();
      await geometria.onApplicationShutdown();
      control.onApplicationShutdown();
      capacidad.onApplicationShutdown();
      await geometricQueue.obliterate({ force: true });
      await geometricQueue.close();
    }
  });
});
