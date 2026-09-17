import type { EstadoPdfPresupuesto } from "./presupuestos-api";

/** Consulta acotada y cancelable: cerrar la pestaña no cancela la generación. */
export async function esperarPdf(
  consultar: (signal: AbortSignal) => Promise<EstadoPdfPresupuesto>,
  signal: AbortSignal,
): Promise<EstadoPdfPresupuesto> {
  const limite = Date.now() + 90_000;
  while (!signal.aborted) {
    const estado = await consultar(
      AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    );
    if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
    if (estado.estado !== "preparando" || Date.now() >= limite) return estado;
    await new Promise<void>((resolve, reject) => {
      const cancelar = () => {
        clearTimeout(timer);
        reject(new DOMException("Cancelado", "AbortError"));
      };
      const timer = setTimeout(
        () => {
          signal.removeEventListener("abort", cancelar);
          resolve();
        },
        Math.min(5000, Math.max(2000, estado.reintentarEnMs || 2000)),
      );
      signal.addEventListener("abort", cancelar, { once: true });
    });
  }
  throw new DOMException("Cancelado", "AbortError");
}
