import { Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { DelayedError } from 'bullmq';
import { conLockDeCron } from './cron-lock';
import { PaddleService } from '../cobro/paddle.service';
import { CobroWebhookController } from '../cobro/cobro-webhook.controller';
import { CorreoPresupuestoService } from '../presupuestos/correo-presupuesto.service';
import { GeometriaWorker } from '../workers/geometria/geometria.worker';

const datoPrivado = 'clave-privada-ficticia';
const fallo = () => new Error(`SQL y proveedor: ${datoPrivado}`);
jest.mock('@paddle/paddle-node-sdk', () => ({
  Environment: { sandbox: 'sandbox', production: 'production' },
  Paddle: jest.fn().mockImplementation(() => ({
    subscriptions: { get: () => Promise.reject(fallo()) },
  })),
}));

describe('Los servicios conservan el fallo sin copiar datos privados al registro', () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  let log: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());
  const privado = () => {
    const entradas = [
      warn.mock.calls as unknown[][],
      error.mock.calls as unknown[][],
      log.mock.calls as unknown[][],
    ];
    expect(entradas.flat().length).toBeGreaterThan(0);
    expect(JSON.stringify(entradas)).not.toContain(datoPrivado);
  };

  it('si falla la toma del lease, no ejecuta el trabajo ni registra la consulta fallida', async () => {
    const tarea = jest.fn();
    const prisma = { $queryRawUnsafe: jest.fn().mockRejectedValue(fallo()) };
    await expect(
      conLockDeCron(prisma as never, 'ensayo', 60, tarea),
    ).resolves.toBeNull();
    expect(tarea).not.toHaveBeenCalled();
    privado();
  });
  it('si falla liberar el lease, conserva el resultado y oculta el error', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ nombre: 'ensayo' }]),
      $executeRawUnsafe: jest.fn().mockRejectedValue(fallo()),
    };
    await expect(
      conLockDeCron(prisma as never, 'ensayo', 60, () =>
        Promise.resolve('completado'),
      ),
    ).resolves.toBe('completado');
    privado();
  });
  it('un proveedor de cobro caído sigue devolviendo null, sin registrar su respuesta', async () => {
    const original = process.env.PADDLE_API_KEY;
    process.env.PADDLE_API_KEY = 'configuracion-ficticia';
    try {
      await expect(
        new PaddleService().obtenerSuscripcion('suscripcion-ficticia'),
      ).resolves.toBeNull();
      privado();
    } finally {
      if (original === undefined) delete process.env.PADDLE_API_KEY;
      else process.env.PADDLE_API_KEY = original;
    }
  });
  it('un error al consultar correos pendientes no publica filas ni credenciales', async () => {
    const prisma = {
      correoPresupuesto: { findMany: jest.fn().mockRejectedValue(fallo()) },
    };
    const correo = new CorreoPresupuestoService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      { disponible: true } as never,
    );
    await expect(correo.despacharPendientes()).resolves.toBeUndefined();
    privado();
  });
  it('el webhook conserva el rechazo para reintento, sin persistir el error crudo', async () => {
    const errorOriginal = fallo();
    const prisma = {
      eventoCobro: {
        upsert: jest.fn().mockResolvedValue({ id: 'evento-local' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockRejectedValue(errorOriginal),
    };
    const paddle = {
      puedeVerificarFirma: true,
      verificarEvento: jest.fn().mockResolvedValue({
        eventId: 'evento-proveedor',
        eventType: 'subscription.updated',
        data: { id: 'suscripcion' },
      }),
    };
    const controller = new CobroWebhookController(
      prisma as never,
      paddle as never,
      {} as never,
    );
    await expect(
      controller.paddleWebhook(
        { rawBody: Buffer.from('{}') },
        'firma-ficticia',
      ),
    ).rejects.toBe(errorOriginal);
    const llamada = prisma.eventoCobro.updateMany.mock.calls[0] as unknown[];
    const guardado = llamada[0] as {
      data: { resultado: string };
    };
    expect(guardado.data.resultado).toBe('fallido');
    expect(
      JSON.stringify(prisma.eventoCobro.updateMany.mock.calls),
    ).not.toContain(datoPrivado);
    privado();
  });
  it.each(['failed', 'error'])(
    'un evento %s del worker no registra el contenido del error',
    (evento) => {
      const worker = new GeometriaWorker(
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      );
      const emisor = Object.assign(new EventEmitter(), {
        name: 'cola-ficticia',
      });
      worker['conectarEventos'](emisor as never);
      if (evento === 'failed') emisor.emit(evento, undefined, fallo());
      else emisor.emit(evento, fallo());
      privado();
    },
  );
  it('un rechazo de admisión reprograma sin registrar claves del error', async () => {
    const worker = new GeometriaWorker(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const job = {
      id: 'job-ficticio',
      token: 'lease-ficticio',
      moveToDelayed: jest.fn().mockResolvedValue(undefined),
    };
    await expect(
      worker['reprogramarAdmision'](job as never, fallo()),
    ).rejects.toBeInstanceOf(DelayedError);
    expect(job.moveToDelayed).toHaveBeenCalledTimes(1);
    privado();
  });
});
