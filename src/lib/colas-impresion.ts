import {
  claveDocumento,
  type DocumentoOrden,
  type EnvioDocumento,
  type VistaDocumentos,
} from "./impresion-api";
export type TrabajoCola = {
  clave: string;
  ordenId: string;
  numero: string;
  estadoOrden: string;
  doc: DocumentoOrden;
  envio?: EnvioDocumento;
};
export const REVISAR_ENVIO = new Set([
  "PREPARADO",
  "SIN_CONFIRMAR",
  "ERROR",
  "PAUSED",
  "ABORTED",
  "CANCELED",
  "DELETED",
]);
/** Los resultados inciertos se verifican individualmente, después de revisarlos. */
export function admiteVerificacionMultiple(t: TrabajoCola) {
  return (
    !!t.envio &&
    !t.envio.confirmacion &&
    !REVISAR_ENVIO.has(t.envio.estado) &&
    !["borrador", "cancelada"].includes(t.estadoOrden)
  );
}
export function trabajosDeVistas(vistas: VistaDocumentos[]): TrabajoCola[] {
  return vistas
    .flatMap((v) =>
      v.documentos.map((doc) => ({
        clave: claveDocumento(doc),
        ordenId: v.ordenId,
        numero: v.numero,
        estadoOrden: v.estado,
        doc,
        envio: v.historial.find(
          (e) => claveDocumento(e) === claveDocumento(doc),
        ),
      })),
    )
    .sort(
      (a, b) =>
        (a.doc.fechaEntrega ?? "9999").localeCompare(
          b.doc.fechaEntrega ?? "9999",
        ) ||
        a.numero.localeCompare(b.numero) ||
        (a.doc.pasoId ?? a.doc.itemId).localeCompare(
          b.doc.pasoId ?? b.doc.itemId,
        ) ||
        (a.doc.paginaCad?.pagina ?? 0) - (b.doc.paginaCad?.pagina ?? 0),
    );
}
export function maquinaTrabajo(t: TrabajoCola) {
  return (
    t.envio?.perfilSnapshot?.bandeja.destino ??
    t.doc.ruta.perfil?.bandeja.destino
  );
}
export function agruparColas(trabajos: TrabajoCola[]) {
  const grupos = new Map<string, TrabajoCola[]>();
  for (const t of trabajos) {
    const id = maquinaTrabajo(t)?.maquinaId ?? "revisar";
    grupos.set(id, [...(grupos.get(id) ?? []), t]);
  }
  return grupos;
}
/** Las máquinas avanzan por turnos cortos; dentro de cada máquina no se salta papel pendiente. */
export function siguientesEnvios(trabajos: TrabajoCola[]) {
  return [...agruparColas(trabajos).values()].flatMap((filas) => {
    if (
      filas.some(
        (t) =>
          t.envio && !t.envio.confirmacion && REVISAR_ENVIO.has(t.envio.estado),
      )
    )
      return [];
    const siguiente = filas.find((t) => !t.envio);
    return siguiente &&
      !["borrador", "cancelada"].includes(siguiente.estadoOrden) &&
      !siguiente.doc.motivo &&
      siguiente.doc.ruta.estado === "LISTO"
      ? [siguiente]
      : [];
  });
}
