/** Familias de procesos que entregan recorridos para una máquina de corte. */
export function esFamiliaCorteNesting(familiaCodigo?: string | null): boolean {
  return [
    "corte_laser",
    "corte_hilo_caliente",
    "cnc",
    "router_cnc",
    "troquelado_digital",
  ].includes(familiaCodigo ?? "");
}
