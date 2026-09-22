import type { VistaEtiqueta } from "./impresion-api";
/** El servidor revalida la descarga aunque la vista previa ya esté cargada. */
export async function descargarEtiquetaPdf(
  vista: VistaEtiqueta,
  ordenId: string,
) {
  const respuesta = await fetch(
    `/api/backend/impresion/ordenes/${encodeURIComponent(ordenId)}/etiqueta/pdf`,
    { cache: "no-store" },
  );
  if (!respuesta.ok) throw new Error("No se pudo descargar la etiqueta.");
  const url = URL.createObjectURL(await respuesta.blob());
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `etiqueta-${vista.numero.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
