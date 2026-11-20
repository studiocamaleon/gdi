import { eliminarArchivo, listarArchivos, subirArchivo } from "./archivos-api";
import type { PropuestaItem } from "./propuestas";
import { metaCentroCopiado } from "./centro-copiado-api";

/** Los originales del centro de copiado se usan para imprimir. Las referencias
 * elegidas en Trabajo a medida son adjuntos comunes del producto. */
export async function subirArchivosPendientesDeItem(
  itemId: string,
  item: Pick<PropuestaItem, "jobContext">,
  archivos: File[],
) {
  const destino = { scope: "ORDEN_ITEM" as const, entidadId: itemId };
  const esCopiado = !!metaCentroCopiado(item.jobContext);
  const previos = esCopiado ? await listarArchivos("ORDEN_ITEM", itemId) : [];
  const reemplazados = new Set<string>();

  for (const file of archivos) {
    await subirArchivo(file, esCopiado ? {
      ...destino,
      descripcion: `Documento · ${file.name}`,
      autogeneradoPor: "centro-copiado",
    } : destino);

    // Conservar el original anterior hasta confirmar la subida del reemplazo.
    for (const a of previos) {
      if (a.autogeneradoPor === "centro-copiado" && a.nombre === file.name && !reemplazados.has(a.id)) {
        await eliminarArchivo(a.id);
        reemplazados.add(a.id);
      }
    }
  }
}
