import { MetaAltaWorker } from './meta-alta.worker';
const claves = [
  'META_CONEXION_MODO',
  'NODE_ENV',
  'GRAFO_LOCAL_DISABLE_CRON',
] as const;
const anteriores = Object.fromEntries(claves.map((k) => [k, process.env[k]]));
let worker: MetaAltaWorker;
const procesarSiguiente = jest.fn(),
  updateMany = jest.fn();
beforeEach(() => {
  jest.useFakeTimers();
  procesarSiguiente.mockReset().mockResolvedValue(false);
  updateMany.mockReset().mockResolvedValue({ count: 0 });
  worker = new MetaAltaWorker(
    { procesarSiguiente } as never,
    { metaAutorizacion: { updateMany } } as never,
  );
  Object.assign(process.env, {
    META_CONEXION_MODO: 'sandbox',
    NODE_ENV: 'development',
    GRAFO_LOCAL_DISABLE_CRON: 'true',
  });
});
afterEach(async () => {
  await worker.onModuleDestroy();
  jest.useRealTimers();
  for (const k of claves) {
    if (anteriores[k] === undefined) delete process.env[k];
    else process.env[k] = anteriores[k];
  }
});
it('el recorrido local con cron apagado no agenda ni ejecuta llamadas', async () => {
  worker.onModuleInit();
  await jest.advanceTimersByTimeAsync(10000);
  expect(updateMany).not.toHaveBeenCalled();
  expect(procesarSiguiente).not.toHaveBeenCalled();
});
it('el barrido sólo retira credenciales de intentos pendientes vencidos', async () => {
  process.env.GRAFO_LOCAL_DISABLE_CRON = 'false';
  worker.onModuleInit();
  await jest.advanceTimersByTimeAsync(2000);
  expect(updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        estado: { in: ['PREPARADA', 'CANJEANDO', 'CANJEADA', 'VERIFICANDO'] },
        venceEl: { lte: expect.any(Date) },
      },
      data: expect.objectContaining({
        estado: 'REINICIAR',
        falloCodigo: 'INTENTO_VENCIDO',
      }),
    }),
  );
  await worker.onModuleDestroy();
  await jest.advanceTimersByTimeAsync(10000);
  expect(updateMany).toHaveBeenCalledTimes(1);
});
it('el alta deshabilitada no inicia el worker aunque se permitan otras tareas', async () => {
  process.env.GRAFO_LOCAL_DISABLE_CRON = 'false';
  process.env.META_CONEXION_MODO = '';
  worker.onModuleInit();
  await jest.advanceTimersByTimeAsync(10000);
  expect(updateMany).not.toHaveBeenCalled();
});
