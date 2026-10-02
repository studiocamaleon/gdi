/** Omitir el inventario inicial no satisface ni omite controles de calidad. */
export function gateOperativoCumplido(gate: { tipo?: string; estado: string }) {
  return (
    gate.estado === 'CUMPLIDO' ||
    (gate.tipo === 'MATERIAL' && gate.estado === 'OMITIDO_INICIO')
  );
}
