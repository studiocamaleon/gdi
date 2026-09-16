import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from 'node:worker_threads';
import { ServiceUnavailableException } from '@nestjs/common';
import {
  simularRollo,
  type EntradaSimulacionRollo,
  type ResultadoSimulacionRollo,
} from './simulacion-rollo';

/** El cálculo geométrico no bloquea las peticiones HTTP del resto del taller. */
export function calcularRollo(
  entrada: EntradaSimulacionRollo,
): Promise<ResultadoSimulacionRollo> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: entrada,
      execArgv: __filename.endsWith('.ts')
        ? ['-r', require.resolve('ts-node/register/transpile-only')]
        : [],
      resourceLimits: { maxOldGenerationSizeMb: 192 },
    });
    let terminado = false;
    const terminar = (error?: Error, resultado?: ResultadoSimulacionRollo) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(timer);
      void worker
        .terminate()
        .finally(() => (error ? reject(error) : resolve(resultado!)));
    };
    const timer = setTimeout(
      () =>
        terminar(
          new ServiceUnavailableException(
            'La simulación demoró demasiado. Probá con menos trabajos.',
          ),
        ),
      20_000,
    );
    worker.once(
      'message',
      (m: { resultado?: ResultadoSimulacionRollo; error?: string }) =>
        terminar(m.error ? new Error(m.error) : undefined, m.resultado),
    );
    worker.once('error', terminar);
    worker.once('exit', () => {
      if (!terminado)
        terminar(new Error('La simulación se interrumpió. Volvé a intentar.'));
    });
  });
}
if (!isMainThread) {
  try {
    parentPort!.postMessage({
      resultado: simularRollo(workerData as EntradaSimulacionRollo),
    });
  } catch (e) {
    parentPort!.postMessage({
      error: e instanceof Error ? e.message : 'No se pudo simular.',
    });
  }
}
