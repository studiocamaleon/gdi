import type { Archivo } from "./archivos";
import type { ArchivosDeOrden } from "./archivos-api";
import type {
  DesarrolloDocumental,
  EstadoDocumentalOrden,
} from "./desarrollo-documental-api";

/** Las revisiones usan el mismo archivo físico; se muestran sólo en su historial. */
export function idsDeArchivosVersionados(desarrollo: DesarrolloDocumental) {
  return new Set(
    desarrollo.maestros.flatMap((m) => m.revisiones.map((r) => r.archivo.id)),
  );
}

/** El uploader devuelve sólo su grupo: conservar las revisiones al subir o borrar adjuntos. */
export function actualizarAdjuntosGenerales(
  actuales: Archivo[],
  adjuntos: Archivo[],
  versionados: ReadonlySet<string>,
) {
  return [
    ...new Map(
      [...actuales.filter((a) => versionados.has(a.id)), ...adjuntos].map(
        (a) => [a.id, a],
      ),
    ).values(),
  ];
}

/** Una misma revisión puede cumplir varios controles; cuenta como un solo archivo. */
export function contarArchivosDeOrden(
  adjuntos: ArchivosDeOrden,
  produccion?: EstadoDocumentalOrden | null,
) {
  return new Set([
    ...adjuntos.documento.map((a) => a.id),
    ...adjuntos.items.flatMap((i) => i.archivos.map((a) => a.id)),
    ...(produccion?.gates.flatMap((g) =>
      g.revisionLiberada ? [g.revisionLiberada.archivo.id] : [],
    ) ?? []),
  ]).size;
}
