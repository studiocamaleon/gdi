import { DelayedError, Job } from 'bullmq';
import { GeometriaWorker } from './geometria.worker';
import { COLA_GEOMETRIA_INTENSIVA } from '../colas';

describe('pérdida del permiso distribuido de geometría', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it.each(['expirado', 'redis-no-disponible', 'capacidad-expirada'])(
    'detiene el solver y reprograma cuando el permiso está %s',
    async (caso) => {
      const permiso = {
        clave: 'cuota',
        propietario: 'este-worker',
        duracionMs: 60000,
      };
      const concurrencia = {
        adquirir: jest.fn().mockResolvedValue(permiso),
        renovar:
          caso === 'capacidad-expirada'
            ? jest.fn().mockResolvedValue(true)
            : caso === 'expirado'
              ? jest.fn().mockResolvedValue(false)
              : jest.fn().mockRejectedValue(new Error('Redis no disponible')),
        liberar: jest.fn().mockResolvedValue(undefined),
      };
      let signal: AbortSignal | undefined;
      const detener = jest.fn();
      const resolver = jest.fn(async (_data, options) => {
        signal = options.signal;
        await new Promise<void>((_resolve, reject) =>
          options.signal.addEventListener(
            'abort',
            () => {
              detener();
              reject(new Error('Proceso geométrico detenido'));
            },
            { once: true },
          ),
        );
      });
      const worker = new GeometriaWorker(
        { resolver } as never,
        { leerCancelacion: jest.fn().mockResolvedValue(false) } as never,
        concurrencia as never,
        {
          adquirir: jest
            .fn()
            .mockResolvedValue({ ...permiso, jobId: 'job-largo' }),
          renovar: jest.fn().mockResolvedValue(caso !== 'capacidad-expirada'),
          liberar: jest.fn().mockResolvedValue(true),
          siguiente: jest.fn().mockResolvedValue(null),
        } as never,
      );
      const job = {
        id: 'job-largo',
        queueName: COLA_GEOMETRIA_INTENSIVA,
        token: 'token-bull',
        opts: {},
        data: { tenantId: 'fabrica-a', timeoutMs: 300000 },
        updateProgress: jest.fn().mockResolvedValue(undefined),
        moveToDelayed: jest.fn().mockResolvedValue(undefined),
      };
      const tarea = (
        worker as unknown as {
          procesarOpenNest(job: unknown): Promise<unknown>;
        }
      ).procesarOpenNest(job);
      const termina = expect(tarea).rejects.toBeInstanceOf(DelayedError);
      await jest.advanceTimersByTimeAsync(20000);
      await termina;
      expect(signal?.aborted).toBe(true);
      expect(detener).toHaveBeenCalledTimes(1);
      expect(concurrencia.adquirir).toHaveBeenCalledWith(
        expect.objectContaining({ duracionMs: 60000 }),
      );
      expect(job.moveToDelayed).toHaveBeenCalledWith(
        expect.any(Number),
        'token-bull',
      );
      expect(concurrencia.liberar).toHaveBeenCalledWith(permiso);
      await jest.advanceTimersByTimeAsync(60000);
      expect(concurrencia.renovar).toHaveBeenCalledTimes(1);
    },
  );
});

describe('admisión y finalización de geometría', () => {
  const preparar = () => {
    const tenant = {
      adquirir: jest.fn().mockResolvedValue({
        clave: 't',
        propietario: 't1',
        duracionMs: 60000,
      }),
      renovar: jest.fn().mockResolvedValue(true),
      liberar: jest.fn().mockResolvedValue(undefined),
    };
    const pool = {
      adquirir: jest.fn().mockResolvedValue({
        jobId: 'j',
        propietario: 'p1',
        duracionMs: 60000,
      }),
      renovar: jest.fn().mockResolvedValue(true),
      liberar: jest.fn().mockResolvedValue(true),
      cancelar: jest.fn().mockResolvedValue(undefined),
      siguiente: jest.fn().mockResolvedValue(null),
    };
    const resolver = jest.fn().mockResolvedValue({ placasUsadas: 1 });
    const control = { leerCancelacion: jest.fn().mockResolvedValue(false) };
    const worker = new GeometriaWorker(
      { resolver } as never,
      control as never,
      tenant as never,
      pool as never,
    );
    const job = {
      id: 'j',
      queueName: COLA_GEOMETRIA_INTENSIVA,
      token: 'token',
      opts: {},
      data: { tenantId: 'fabrica', timeoutMs: 300000 },
      updateProgress: jest.fn().mockResolvedValue(undefined),
      moveToDelayed: jest.fn().mockResolvedValue(undefined),
    };
    const ejecutar = () =>
      (
        worker as unknown as {
          procesarOpenNest(j: unknown, cola: unknown): Promise<unknown>;
        }
      ).procesarOpenNest(job, {});
    return { tenant, pool, resolver, control, job, ejecutar };
  };

  it.each(['sin-capacidad', 'redis-intermitente'])(
    'espera sin arrancar el solver: %s',
    async (caso) => {
      const t = preparar();
      if (caso === 'sin-capacidad') t.pool.adquirir.mockResolvedValue(null);
      else
        t.pool.adquirir.mockRejectedValue(
          new Error('Redis temporalmente no disponible'),
        );
      await expect(t.ejecutar()).rejects.toBeInstanceOf(DelayedError);
      expect(t.resolver).not.toHaveBeenCalled();
      expect(t.tenant.liberar).toHaveBeenCalledTimes(1);
      expect(t.job.moveToDelayed).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['vencido', 'sin-confirmacion-redis'])(
    'no publica éxito con permiso final %s',
    async (caso) => {
      const t = preparar();
      if (caso === 'vencido') t.pool.liberar.mockResolvedValue(false);
      else
        t.pool.liberar.mockRejectedValue(
          new Error('Redis temporalmente no disponible'),
        );
      await expect(t.ejecutar()).rejects.toBeInstanceOf(DelayedError);
      expect(t.job.updateProgress).not.toHaveBeenCalledWith({
        porcentaje: 100,
        etapa: 'completado',
      });
      expect(t.tenant.liberar).toHaveBeenCalledTimes(1);
    },
  );

  it('cancela un trabajo pendiente antes de tomar recursos', async () => {
    const t = preparar();
    t.control.leerCancelacion.mockResolvedValue(true);
    await expect(t.ejecutar()).rejects.toThrow('cancelado');
    expect(t.pool.cancelar).toHaveBeenCalledWith('j');
    expect(t.tenant.adquirir).not.toHaveBeenCalled();
    expect(t.resolver).not.toHaveBeenCalled();
  });

  it('no reintenta indefinidamente una configuración incompatible', async () => {
    const t = preparar();
    t.pool.adquirir.mockRejectedValue(
      new Error('GRAFONEST_POOL_CONFIG_MISMATCH'),
    );
    await expect(t.ejecutar()).rejects.toThrow(
      'GRAFONEST_POOL_CONFIG_MISMATCH',
    );
    expect(t.job.moveToDelayed).not.toHaveBeenCalled();
    expect(t.resolver).not.toHaveBeenCalled();
  });

  it('devuelve un resultado y deja libres ambos permisos', async () => {
    const t = preparar();
    await expect(t.ejecutar()).resolves.toEqual({ placasUsadas: 1 });
    expect(t.pool.liberar).toHaveBeenCalledTimes(1);
    expect(t.tenant.liberar).toHaveBeenCalledTimes(1);
    expect(t.job.updateProgress).toHaveBeenLastCalledWith({
      porcentaje: 100,
      etapa: 'completado',
    });
  });

  it('despierta el siguiente trabajo sin esperar el reintento periódico', async () => {
    const t = preparar();
    t.pool.siguiente.mockResolvedValue('j2');
    const promote = jest.fn().mockResolvedValue(undefined);
    const fromId = jest.spyOn(Job, 'fromId').mockResolvedValue({
      getState: async () => 'delayed',
      promote,
    } as never);
    try {
      await t.ejecutar();
      expect(promote).toHaveBeenCalledTimes(1);
      expect(t.tenant.liberar.mock.invocationCallOrder[0]).toBeLessThan(
        promote.mock.invocationCallOrder[0],
      );
    } finally {
      fromId.mockRestore();
    }
  });
});
