import {
  dimsDeFormato,
  metaCentroCopiado,
  type CotizarCentroCopiadoRequest,
  type DocumentoCentroCopiado,
} from "./centro-copiado-api";
import type { PropuestaItem } from "./propuestas";

/** Sólo descripción productiva: el servidor vuelve a resolver precios y costos. */
export function cargasParaPreviewCopiado(
  items: PropuestaItem[],
  editados: PropuestaItem[],
): NonNullable<CotizarCentroCopiadoRequest["cargasPedido"]> {
  const excluidos = new Set(editados.map((i) => i.id));
  return items.flatMap((item) => {
    if (excluidos.has(item.id)) return [];
    const meta = metaCentroCopiado(item.jobContext);
    if (!meta) return [];
    const segmentos = meta.esTomo ? (meta.segmentos ?? []) : [meta];
    const documentos: DocumentoCentroCopiado[] = segmentos.map((seg, n) => ({
      id: `${item.id}:${n}`,
      nombre: seg.nombre ?? undefined,
      archivoNombre: seg.archivoNombre,
      paginas: seg.paginas ?? 1,
      paginasOriginales: seg.paginasOriginales,
      rangoPaginas: seg.rangoPaginas,
      orientacionesPaginas: seg.orientacionesPaginas,
      medidasPaginas: seg.medidasPaginas,
      copias: (meta.esTomo ? meta.juegos : meta.copias) ?? 1,
      tamano: seg.tamano ?? "A4",
      tamanoAnchoMm:
        seg.tamanoAnchoMm ?? dimsDeFormato(seg.tamano ?? "A4").anchoMm,
      tamanoAltoMm:
        seg.tamanoAltoMm ?? dimsDeFormato(seg.tamano ?? "A4").altoMm,
      papelMateriaPrimaId: seg.papelMateriaPrimaId ?? "",
      gramaje: seg.gramaje,
      color: seg.color ?? "BN",
      faz: seg.faz ?? 1,
      cobertura: seg.cobertura,
      modo: meta.modo ?? "HOJAS",
      cad: meta.cad,
      copiasPorPagina: meta.copiasPorPagina,
      terminaciones: meta.esTomo ? [] : meta.terminaciones,
      tipoAnillo: meta.esTomo ? undefined : (meta.tipoAnillo ?? undefined),
      grupoId: meta.esTomo ? item.id : undefined,
    }));
    return [
      {
        tipoCambioId: item.cotizacion?.tipoCambio?.id,
        descuento: item.descuentoInput
          ? { tipo: item.descuentoInput.tipo, valor: item.descuentoInput.valor }
          : undefined,
        documentos,
        grupos: meta.esTomo
          ? [
              {
                id: item.id,
                nombre: meta.tomoNombre ?? undefined,
                juegos: meta.juegos ?? 1,
                terminaciones: meta.terminaciones,
                tipoAnillo: meta.tipoAnillo ?? undefined,
              },
            ]
          : [],
      },
    ];
  });
}
