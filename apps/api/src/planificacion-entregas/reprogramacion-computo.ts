import { ServiceUnavailableException } from '@nestjs/common';
import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from 'node:worker_threads';
import {
  proponerEntregasPiloto,
  type EntradaPiloto,
} from '../eta/planificacion/prototipo-entregas';
import { buscarReprogramaciones } from './reprogramacion-escenarios';

export type EntradaReprogramacion = {
  tenantId: string;
  piloto: EntradaPiloto;
  excluidas: string[];
};
export type ResultadoReprogramacion = {
  resultado: ReturnType<typeof proponerEntregasPiloto>;
  busqueda: Awaited<ReturnType<typeof buscarReprogramaciones>>;
};

// La búsqueda CPU no ocupa el hilo HTTP. Cola pequeña y explícita: una empresa
// no retiene todas las plazas ni se acumulan copias ilimitadas del taller.
const MAX_ACTIVOS = 2;
const MAX_EN_COLA = 8;
type Solicitud = {
  entrada: EntradaReprogramacion;
  resolver: (r: ResultadoReprogramacion) => void;
  rechazar: (e: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
};
const cola: Solicitud[] = [];
const activos = new Map<Worker, Solicitud>();
const tenants = new Set<string>();
const ocupado = () =>
  new ServiceUnavailableException(
    'Hay otras planificaciones calculándose. Volvé a intentar en unos segundos; tu distribución está guardada.',
  );

export function calcularReprogramacion(
  entrada: EntradaReprogramacion,
): Promise<ResultadoReprogramacion> {
  if (
    tenants.has(entrada.tenantId) ||
    (activos.size >= MAX_ACTIVOS && cola.length >= MAX_EN_COLA)
  )
    return Promise.reject(ocupado());
  return new Promise((resolver, rechazar) => {
    const solicitud: Solicitud = { entrada, resolver, rechazar };
    tenants.add(entrada.tenantId);
    solicitud.timer = setTimeout(() => {
      const i = cola.indexOf(solicitud);
      if (i < 0) return;
      cola.splice(i, 1);
      tenants.delete(entrada.tenantId);
      rechazar(ocupado());
    }, 15_000);
    cola.push(solicitud);
    despachar();
  });
}

function despachar() {
  while (activos.size < MAX_ACTIVOS && cola.length) {
    const solicitud = cola.shift()!;
    clearTimeout(solicitud.timer);
    let worker: Worker;
    try {
      worker = new Worker(__filename, {
        workerData: solicitud.entrada,
        // Nest ejecuta JS compilado. Las pruebas pueden cargar la fuente TS.
        execArgv: __filename.endsWith('.ts')
          ? ['-r', require.resolve('ts-node/register/transpile-only')]
          : [],
        resourceLimits: { maxOldGenerationSizeMb: 256 },
      });
    } catch (error) {
      tenants.delete(solicitud.entrada.tenantId);
      solicitud.rechazar(
        error instanceof Error ? error : new Error(String(error)),
      );
      continue;
    }
    activos.set(worker, solicitud);
    let terminado = false;
    const terminar = (error?: Error, resultado?: ResultadoReprogramacion) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(solicitud.timer);
      // No liberamos la plaza hasta que el proceso de cálculo realmente termina.
      void worker.terminate().finally(() => {
        activos.delete(worker);
        tenants.delete(solicitud.entrada.tenantId);
        if (error) solicitud.rechazar(error);
        else solicitud.resolver(resultado!);
        despachar();
      });
    };
    solicitud.timer = setTimeout(
      () =>
        terminar(
          new ServiceUnavailableException(
            'La búsqueda superó el tiempo disponible. La distribución sigue guardada; podés volver a intentar.',
          ),
        ),
      45_000,
    );
    worker.once(
      'message',
      (m: { resultado?: ResultadoReprogramacion; error?: string }) =>
        m.error
          ? terminar(new Error(m.error))
          : terminar(undefined, m.resultado),
    );
    worker.once('error', terminar);
    worker.once('exit', (codigo) => {
      if (!terminado)
        terminar(
          new Error(`El cálculo se interrumpió (${codigo}). Volvé a intentar.`),
        );
    });
  }
}

export async function cerrarReprogramaciones() {
  for (const s of cola.splice(0)) {
    clearTimeout(s.timer);
    tenants.delete(s.entrada.tenantId);
    s.rechazar(ocupado());
  }
  await Promise.all([...activos.keys()].map((w) => w.terminate()));
}

if (!isMainThread) {
  const entrada = workerData as EntradaReprogramacion;
  void (async () => {
    const resultado = proponerEntregasPiloto(entrada.piloto);
    const busqueda = await buscarReprogramaciones({
      taller: entrada.piloto.taller,
      margen: entrada.piloto.margenDiasHabiles,
      alternativa: resultado.alternativas[0],
      operaciones: entrada.piloto.operaciones,
      excluidas: entrada.excluidas,
    });
    parentPort!.postMessage({ resultado: { resultado, busqueda } });
  })().catch((e: unknown) =>
    parentPort!.postMessage({
      error: e instanceof Error ? e.message : String(e),
    }),
  );
}
