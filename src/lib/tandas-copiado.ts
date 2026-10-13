import type { CentroCopiadoMeta } from "./centro-copiado-api";
import type { SegmentoTomoPdf } from "./tomo-pdf";

/** Usa el plan congelado por el costeador. Un pedido editado no puede mezclar
 * miembros de dos revisiones ni mostrar como lista una tanda incompleta.
 */
export function tandasDeOrden(
  items: { itemId: string; archivosPendientes?: File[] }[],
  metas: Record<string, CentroCopiadoMeta | null>,
) {
  const grupos = new Map<
    string,
    {
      meta: CentroCopiadoMeta;
      segmentos: SegmentoTomoPdf[];
    }
  >();
  for (const item of items) {
    const meta = metas[item.itemId];
    const tanda = meta?.tandaImpresion;
    if (!meta || !tanda || tanda.version !== 1 || meta.esTomo) continue;
    if (!grupos.has(tanda.id)) grupos.set(tanda.id, { meta, segmentos: [] });
    grupos.get(tanda.id)!.segmentos.push({
      nombre: meta.nombre || meta.archivoNombre || "Documento",
      archivoNombre: meta.archivoNombre,
      file: item.archivosPendientes?.find((f) => f.name === meta.archivoNombre),
      archivoBytes: meta.archivoBytes,
      paginas: meta.paginas!,
      paginasOriginales: meta.paginasOriginales,
      rangoPaginas: meta.rangoPaginas,
      faz: meta.faz!,
      copias: meta.copias,
      origenItemIds: [item.itemId],
    });
  }
  return [...grupos.entries()].map(([id, grupo]) => ({
    id,
    ...grupo,
    completa: grupo.segmentos.length === grupo.meta.tandaImpresion!.documentos,
  }));
}
