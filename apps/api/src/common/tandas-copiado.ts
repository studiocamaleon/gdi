/** El plan pertenece a un único pedido. No combina clientes ni órdenes.
 * Los tomos y las terminaciones conservan sus límites de producción.
 * Las copias se incorporan al PDF: cada original/copia comienza en frente.
 */
export const MAX_PAGINAS_TANDA = 5000;
export const MAX_BYTES_TANDA = 100 * 1024 * 1024;
export type DocumentoTanda = {
  id: string;
  archivoNombre?: string;
  archivoBytes?: number;
  paginas: number;
  paginasOriginales?: number;
  copias: number;
  modo?: string;
  grupoId?: string | null;
  terminaciones?: string[];
  papelMateriaPrimaId: string;
  gramaje?: number | null;
  tamano: string;
  tamanoAnchoMm: number;
  tamanoAltoMm: number;
  color: string;
  cobertura?: string | null;
  faz: number;
};

export type TandaCopiado = {
  documentos: string[];
  paginas: number;
  bytes: number;
};

export function planificarTandasCopiado(
  entradas: { documento: DocumentoTanda; maquina: string; contexto?: string }[],
): TandaCopiado[] {
  const tandas: TandaCopiado[] = [];
  const abiertas = new Map<string, TandaCopiado>();
  for (const { documento: d, maquina, contexto } of entradas) {
    if (
      d.modo === 'CAD' ||
      d.grupoId ||
      d.terminaciones?.length ||
      !maquina ||
      !d.archivoNombre?.toLowerCase().endsWith('.pdf') ||
      !Number.isSafeInteger(d.archivoBytes) ||
      !d.archivoBytes ||
      d.archivoBytes > MAX_BYTES_TANDA ||
      !Number.isSafeInteger(d.paginasOriginales) ||
      !Number.isSafeInteger(d.paginas) ||
      d.paginas < 1 ||
      !Number.isSafeInteger(d.copias) ||
      d.copias < 1 ||
      ![1, 2].includes(d.faz)
    )
      continue;
    const paginas = (d.paginas + (d.faz === 2 ? d.paginas % 2 : 0)) * d.copias;
    if (paginas > MAX_PAGINAS_TANDA) continue;
    const clave = JSON.stringify([
      contexto ?? '',
      maquina,
      d.papelMateriaPrimaId,
      d.gramaje ?? null,
      d.tamano,
      d.tamanoAnchoMm,
      d.tamanoAltoMm,
      d.color,
      d.cobertura ?? 'alta',
      d.faz,
    ]);
    let tanda = abiertas.get(clave);
    if (
      !tanda ||
      tanda.paginas + paginas > MAX_PAGINAS_TANDA ||
      tanda.bytes + d.archivoBytes > MAX_BYTES_TANDA
    ) {
      tanda = { documentos: [], paginas: 0, bytes: 0 };
      tandas.push(tanda);
      abiertas.set(clave, tanda);
    }
    tanda.documentos.push(d.id);
    tanda.paginas += paginas;
    tanda.bytes += d.archivoBytes;
  }
  return tandas;
}

/** Identidad productiva del motor; no depende del nombre mostrado de la máquina. */
export function maquinaTanda(job: Record<string, unknown>): string {
  const maquinas = Object.entries(job)
    .filter(
      ([k, v]) =>
        k.startsWith('maquinaSeleccionada_') && typeof v === 'string' && v,
    )
    .sort(([a], [b]) => a.localeCompare(b));
  return maquinas.length ? JSON.stringify(maquinas) : '';
}

export type ReferenciaTanda = {
  version: 1;
  id: string;
  documentos: number;
  paginas: number;
  prepara: boolean;
};
