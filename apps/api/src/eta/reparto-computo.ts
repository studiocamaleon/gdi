import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from 'node:worker_threads';
import {
  simularFlujo,
  type ResultadoSimulacion,
} from './motor/flujo-produccion';

type Entrada = Parameters<typeof simularFlujo>[0];

/** El reconciliador espera a cada empresa antes de pasar a la siguiente.
 * Sólo mueve el cálculo a otro hilo. La lectura y la publicación siguen en
 * la misma transacción serializable. */
export async function simularRepartoProgramado(entrada: Entrada) {
  if (entrada.items.reduce((n, item) => n + item.pasos.length, 0) <= 200)
    return simularFlujo(entrada);

  const worker = new Worker(__filename, {
    workerData: { tipo: 'reparto', entrada },
    execArgv: __filename.endsWith('.ts')
      ? ['-r', require.resolve('ts-node/register/transpile-only')]
      : [],
    resourceLimits: { maxOldGenerationSizeMb: 256 },
  });
  let timer: NodeJS.Timeout | undefined;
  try {
    return await new Promise<ResultadoSimulacion>((resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error('Se agotó el tiempo del reparto de personal.')),
        30_000,
      );
      worker.once('message', resolve);
      worker.once('error', reject);
      worker.once('exit', () =>
        reject(new Error('El cálculo del reparto se interrumpió.')),
      );
    });
  } finally {
    clearTimeout(timer);
    await worker.terminate();
  }
}

if (!isMainThread && workerData?.tipo === 'reparto') {
  parentPort!.postMessage(simularFlujo(workerData.entrada as Entrada));
}
