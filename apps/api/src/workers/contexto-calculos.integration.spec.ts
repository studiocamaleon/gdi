import Redis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import { AnalisisVectorialAsyncService } from '../motor-universal/geometria-vectorial/analisis-vectorial-async.service';
import { GeometriaVectorialCacheService } from '../motor-universal/geometria-vectorial/geometria-vectorial-cache.service';
import { GeometriaJobsService } from './geometria/geometria-jobs.service';
import { ControlTrabajosGeometriaService } from './control-trabajos-geometria.service';
import { CapacidadGeometriaService } from './geometria/capacidad-geometria.service';
import {
  COLA_GEOMETRIA,
  COLA_GEOMETRIA_INTENSIVA,
  type NestingIrregularOpenNestData,
} from './colas';
import { resolverNestingBaseSeguro } from './geometria/nesting-base-seguro';

describe('Contexto de cálculos aceptados (Redis desechable)', () => {
  const url = process.env.TEST_QUEUE_REDIS_URL;
  const original = process.env.REDIS_URL;
  let redis: Redis;
  let colas: Queue<NestingIrregularOpenNestData>[];
  let servicios: ReturnType<typeof crear>[];
  function crear() {
    const control = new ControlTrabajosGeometriaService();
    const capacidad = new CapacidadGeometriaService();
    const plan = {
      exigir: jest.fn().mockResolvedValue(undefined),
      exigirTodas: jest.fn().mockResolvedValue(undefined),
    };
    const jobs = new GeometriaJobsService(control, capacidad, plan as never);
    const cache = new GeometriaVectorialCacheService();
    const analisis = new AnalisisVectorialAsyncService(
      jobs,
      cache,
      plan as never,
    );
    return { control, capacidad, jobs, cache, analisis };
  }
  function iniciar(
    i = 0,
    bytes = 0,
    empresa = 'empresa-a',
    claveSolicitud?: string,
  ) {
    return servicios[i % 2].analisis.iniciar({
      tenantId: empresa,
      dto: {
        nombreArchivo: `ficticio-${i}.svg`,
        claveSolicitud,
        svg: `<svg viewBox="0 0 100 100"><!--${'x'.repeat(bytes)}--><path d="M0 0H100V100H0Z"/></svg>`,
        anchoFinalMm: 100,
        cantidad: 2,
        anchoPlacaMm: 300,
        altoPlacaMm: 300,
      },
    });
  }
  beforeAll(() => {
    if (
      !url ||
      new URL(url).hostname !== '127.0.0.1' ||
      new URL(url).port !== '16387'
    )
      throw new Error(
        'Requiere Redis desechable exclusivo en 127.0.0.1:16387.',
      );
    process.env.REDIS_URL = url;
    redis = new Redis(url);
    colas = [COLA_GEOMETRIA, COLA_GEOMETRIA_INTENSIVA].map(
      (nombre) =>
        new Queue<NestingIrregularOpenNestData>(nombre, {
          connection: { url },
        }),
    );
  });
  async function limpiar() {
    for (const cola of colas) await cola.obliterate({ force: true });
    const keys = await redis.keys('grafo:*');
    if (keys.length) await redis.del(...keys);
  }
  beforeEach(async () => {
    await limpiar();
    servicios = [crear(), crear()];
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    for (const s of servicios) {
      s.analisis.onApplicationShutdown();
      s.cache.onApplicationShutdown();
      await s.jobs.onApplicationShutdown();
      s.control.onApplicationShutdown();
      s.capacidad.onApplicationShutdown();
    }
    await limpiar();
  });
  afterAll(async () => {
    await Promise.all(colas.map((c) => c.close()));
    redis.disconnect();
    if (original === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = original;
  });
  it('incluye el contexto completo en el cupo antes de aceptar otro análisis', async () => {
    // Cada SVG es válido y menor al máximo individual; el conjunto supera 8 MiB.
    const resultados = [];
    for (let i = 0; i < 20; i++) {
      try {
        resultados.push(await iniciar(i, 460 * 1024));
      } catch (error) {
        expect(error).toMatchObject({ status: 429 });
        break;
      }
    }
    expect(resultados.length).toBeLessThan(20);
    expect(await iniciar(99, 0, 'empresa-b')).toMatchObject({
      estado: 'pendiente',
    });
  });
  it('al retirar un trabajo no deja una preparación grande separada', async () => {
    const vista = await iniciar();
    expect(vista.estado).toBe('pendiente');
    await (await colas[0].getJob(vista.id))!.remove();
    expect(
      await redis.keys('grafo:geometry:vector-analysis:v1:*'),
    ).toHaveLength(0);
  });

  it('recupera la vista completa en otro servidor tras completar el job y bloquea a otra empresa', async () => {
    const vista = await iniciar();
    expect(JSON.stringify(vista)).not.toContain('contextoAnalisis');
    expect(JSON.stringify(vista)).not.toContain('<svg');
    const job = await colas[0].getJob(vista.id);
    expect(job!.data.contextoAnalisis).toMatchObject({
      tenantId: 'empresa-a',
      nombreArchivo: 'ficticio-0.svg',
    });
    const worker = new Worker<NestingIrregularOpenNestData>(
      COLA_GEOMETRIA,
      undefined,
      {
        connection: { url },
        autorun: false,
      },
    );
    try {
      const activo = await worker.getNextJob('token-ficticio');
      expect(activo.id).toBe(vista.id);
      await activo.moveToCompleted(
        resolverNestingBaseSeguro(activo.data),
        'token-ficticio',
        false,
      );
      servicios[0].analisis.onApplicationShutdown();
      await servicios[0].jobs.onApplicationShutdown();
      const nuevo = crear();
      servicios.push(nuevo);
      const resultado = await nuevo.analisis.consultar('empresa-a', vista.id);
      expect(resultado.estado).toBe('completado');
      expect(
        resultado.resultado?.solucionNesting.resultado.piezasOriginales,
      ).toBe(2);
      expect(resultado.resultado?.nombreArchivo).toBe('ficticio-0.svg');
      await expect(
        nuevo.analisis.consultar('empresa-b', vista.id),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        nuevo.jobs.leerContextoAnalisis('empresa-b', vista.id),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        await redis.keys('grafo:geometry:vector-analysis:v1:*'),
      ).toHaveLength(0);
    } finally {
      await worker.close();
    }
  });

  it('la deduplicación conserva el contexto y distingue archivos distintos del mismo panel', async () => {
    const primero = await iniciar(1, 0, 'empresa-a', 'panel');
    const repetido = await iniciar(1, 0, 'empresa-a', 'panel');
    expect(repetido.id).toBe(primero.id);
    const cambiado = await iniciar(2, 0, 'empresa-a', 'panel');
    expect(cambiado.id).not.toBe(primero.id);
    expect(
      await servicios[1].jobs.leerContextoAnalisis('empresa-a', cambiado.id),
    ).toMatchObject({ nombreArchivo: 'ficticio-2.svg' });
  });

  it('rechaza un contexto de otra empresa antes de guardar el cálculo', async () => {
    const vista = await iniciar();
    const job = (await colas[0].getJob(vista.id))!;
    await expect(
      servicios[1].jobs.crear({
        tenantId: 'empresa-b',
        dto: { placa: job.data.placa, piezas: [], separacionMm: 0 },
        contextoAnalisis: job.data.contextoAnalisis,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      (
        await colas[0].getJobs(['wait', 'prioritized', 'active', 'delayed'])
      ).map((pendiente) => pendiente.id),
    ).toEqual([vista.id]);
  });

  it('conserva la consulta de un job anterior usando su preparación con TTL', async () => {
    const vista = await iniciar();
    const job = await colas[0].getJob(vista.id);
    const { contextoAnalisis, ...dataAnterior } = job!.data;
    await job!.updateData(dataAnterior);
    await redis.set(
      `grafo:geometry:vector-analysis:v1:${vista.id}`,
      JSON.stringify(contextoAnalisis),
      'EX',
      60,
    );
    const worker = new Worker<NestingIrregularOpenNestData>(
      COLA_GEOMETRIA,
      undefined,
      {
        connection: { url },
        autorun: false,
      },
    );
    try {
      const activo = await worker.getNextJob('token-legado');
      await activo.moveToCompleted(
        resolverNestingBaseSeguro(activo.data),
        'token-legado',
        false,
      );
      expect(
        (await servicios[1].analisis.consultar('empresa-a', vista.id)).resultado
          ?.nombreArchivo,
      ).toBe('ficticio-0.svg');
      expect(
        await redis.ttl(`grafo:geometry:vector-analysis:v1:${vista.id}`),
      ).toBeGreaterThan(0);
    } finally {
      await worker.close();
    }
  });
});
