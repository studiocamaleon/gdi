import { AsyncLocalStorage } from 'node:async_hooks';

/** Los reintentos de un nesting comparten el mismo reloj. */
export const OPENNEST_PRESUPUESTO_DEFAULT_MS = 120_000;
export const OPENNEST_LIMITE_DEFAULT_MS = 300_000;
export const OPENNEST_PREPARACION_MS = 300_000;

// Contexto aislado por cotización: nunca cambia la configuración de otros jobs.
const preparacion = new AsyncLocalStorage<boolean>();

export function conPreparacionNesting<T>(calcular: () => T): T {
  return preparacion.run(true, calcular);
}

export function esPreparacionNesting(): boolean {
  return preparacion.getStore() === true;
}

export function timeoutOpenNestMs(): number {
  if (esPreparacionNesting())
    return Math.min(OPENNEST_PREPARACION_MS, timeoutMaximoOpenNestMs());
  return presupuesto(
    process.env.OPENNEST_JOB_TIMEOUT_MS,
    OPENNEST_PRESUPUESTO_DEFAULT_MS,
  );
}

export function timeoutMaximoOpenNestMs(): number {
  return presupuesto(
    process.env.OPENNEST_TIMEOUT_MAX_MS,
    OPENNEST_LIMITE_DEFAULT_MS,
  );
}

function presupuesto(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 100 && n <= 3_600_000 ? n : fallback;
}
