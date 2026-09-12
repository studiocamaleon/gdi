const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const positivo = (v: unknown) => {
  const n = typeof v === 'number' || typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};
export type MedidaPiezaCola = {
  anchoMm: number;
  altoMm: number;
  cantidad: number;
};
export type MedidaPanelCola = MedidaPiezaCola & {
  panel: number | null;
  paneles: number | null;
};

/** Los placements ya incluyen los solapes. Deshacer sólo la rotación del acomodo. */
export function medidasPanelesCola(ubicaciones: unknown): MedidaPanelCola[] {
  if (!Array.isArray(ubicaciones) || !ubicaciones.length) return [];
  const grupos = new Map<string, MedidaPanelCola>();
  for (const v of ubicaciones) {
    const p = objeto(v),
      rotada = p.rotated === true;
    const anchoMm = positivo(rotada ? p.heightMm : p.widthMm);
    const altoMm = positivo(rotada ? p.widthMm : p.heightMm);
    const paneles = positivo(p.panelCount),
      panel = positivo(p.panelIndex);
    if (!anchoMm || !altoMm) return [];
    if (
      paneles &&
      paneles > 1 &&
      (!Number.isInteger(paneles) ||
        !Number.isInteger(panel) ||
        !panel ||
        panel > paneles)
    )
      return [];
    const medida = {
      anchoMm,
      altoMm,
      panel: paneles && paneles > 1 ? panel : null,
      paneles: paneles && paneles > 1 ? paneles : null,
    };
    const clave = JSON.stringify(medida);
    grupos.set(clave, {
      ...medida,
      cantidad: (grupos.get(clave)?.cantidad ?? 0) + 1,
    });
  }
  return [...grupos.values()].sort(
    (a, b) =>
      (a.panel ?? 0) - (b.panel ?? 0) ||
      a.anchoMm - b.anchoMm ||
      a.altoMm - b.altoMm,
  );
}

/** Cantidades físicas del contexto de fabricación; nunca la cantidad comercial del ítem. */
export function medidasPiezasCola(contexto: unknown): MedidaPiezaCola[] {
  const job = objeto(contexto);
  const piezas = job.piezas;
  const medida = objeto(job.medidaCustomMm);
  const entradas =
    Array.isArray(piezas) && piezas.length
      ? piezas
      : [{ ...medida, cantidad: job.cantidad }];
  const resultado = new Map<string, MedidaPiezaCola>();
  for (const entrada of entradas) {
    const p = objeto(entrada),
      anchoMm = positivo(p.anchoMm),
      altoMm = positivo(p.altoMm),
      cantidad = positivo(p.cantidad);
    // No presentar una lista parcial ni inventar medidas/cantidades faltantes.
    if (!anchoMm || !altoMm || !cantidad) return [];
    const clave = `${anchoMm}:${altoMm}`;
    const anterior = resultado.get(clave);
    resultado.set(clave, {
      anchoMm,
      altoMm,
      cantidad: cantidad + (anterior?.cantidad ?? 0),
    });
  }
  return [...resultado.values()];
}
