import { Logger } from '@nestjs/common';
import { MetaAdjuntosWorker } from './meta-adjuntos.worker';

const claves = [
  'META_INBOX_RECEPCION_ENABLED',
  'META_INBOX_ADJUNTOS_ENABLED',
  'GRAFO_LOCAL_DISABLE_CRON',
  'NODE_ENV',
];
const originales = Object.fromEntries(claves.map((k) => [k, process.env[k]]));
let worker: MetaAdjuntosWorker;
const procesarSiguiente = jest.fn();
beforeEach(() => {
  jest.useFakeTimers();
  process.env.META_INBOX_RECEPCION_ENABLED = 'true';
  process.env.META_INBOX_ADJUNTOS_ENABLED = 'true';
  process.env.NODE_ENV = 'test';
  procesarSiguiente.mockReset().mockResolvedValue(false);
  worker = new MetaAdjuntosWorker({ procesarSiguiente } as never);
});
afterEach(async () => {
  await worker.onModuleDestroy();
  jest.useRealTimers();
  jest.restoreAllMocks();
  for (const key of claves) {
    if (originales[key] === undefined) delete process.env[key];
    else process.env[key] = originales[key];
  }
});
it('no programa procesamiento con la recepción deshabilitada', async () => {
  process.env.META_INBOX_RECEPCION_ENABLED = 'false';
  worker.onModuleInit();
  await jest.advanceTimersByTimeAsync(3000);
  expect(procesarSiguiente).not.toHaveBeenCalled();
});
it('respeta el freno de tareas automáticas de desarrollo local', async () => {
  process.env.NODE_ENV = 'development';
  process.env.GRAFO_LOCAL_DISABLE_CRON = 'true';
  worker.onModuleInit();
  await jest.advanceTimersByTimeAsync(3000);
  expect(procesarSiguiente).not.toHaveBeenCalled();
});
it('limita cada ciclo y no deja timers al cerrar', async () => {
  procesarSiguiente.mockResolvedValue(true);
  worker.onModuleInit();
  await jest.advanceTimersByTimeAsync(2000);
  expect(procesarSiguiente).toHaveBeenCalledTimes(1);
  await worker.onModuleDestroy();
  await jest.advanceTimersByTimeAsync(5000);
  expect(procesarSiguiente).toHaveBeenCalledTimes(1);
});
it('se recupera de una falla sin registrar su contenido', async () => {
  const warn = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => undefined);
  procesarSiguiente.mockRejectedValueOnce(
    new Error('Contenido sensible ficticio'),
  );
  worker.onModuleInit();
  await jest.advanceTimersByTimeAsync(4000);
  expect(procesarSiguiente).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(warn.mock.calls)).not.toContain('sensible');
});
it('espera al lote en vuelo y no inicia otro mientras cierra', async () => {
  let terminar!: (value: boolean) => void;
  procesarSiguiente.mockImplementationOnce(
    () =>
      new Promise<boolean>((resolve) => {
        terminar = resolve;
      }),
  );
  worker.onModuleInit();
  await jest.advanceTimersByTimeAsync(2000);
  let cerrado = false;
  const cierre = worker.onModuleDestroy().then(() => {
    cerrado = true;
  });
  await jest.advanceTimersByTimeAsync(5000);
  expect(cerrado).toBe(false);
  terminar(true);
  await cierre;
  expect(procesarSiguiente).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it('no descarga con el flag propio apagado', async () => {
  process.env.META_INBOX_ADJUNTOS_ENABLED = 'false';
  worker.onModuleInit();
  await jest.advanceTimersByTimeAsync(5000);
  expect(procesarSiguiente).not.toHaveBeenCalled();
});
