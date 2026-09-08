/** Presupuestos globales; los reintentos comparten el mismo reloj. */
export const OPENNEST_PRESUPUESTO_DEFAULT_MS = 120_000;
export const OPENNEST_LIMITE_DEFAULT_MS = 300_000;

export function timeoutOpenNestMs(): number {
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
