import type { MetaInbox } from "./meta-inbox-api";

/** Conserva las páginas anteriores sólo cuando se comprueba continuidad.
 * Tras una desconexión larga no se inventa un salto entre dos páginas. */
export function combinarInbox(
  prev: MetaInbox | null,
  actual: MetaInbox,
  modo: "anteriores" | "reciente",
): MetaInbox {
  if (
    !prev ||
    prev.canalId !== actual.canalId ||
    prev.conversacionId !== actual.conversacionId ||
    prev.contacto.telefono !== actual.contacto.telefono ||
    prev.empresaId !== actual.empresaId ||
    prev.usuarioId !== actual.usuarioId
  )
    return actual;
  // El general vuelve a consultar toda la ventana visible: no conservar textos
  // antiguos que pudieron editarse o eliminarse fuera de la página reciente.
  if (actual.origen === "GENERAL" && modo === "reciente") return actual;
  const ids = new Set(prev.mensajes.map((m) => m.id));
  if (modo === "reciente" && !actual.mensajes.some((m) => ids.has(m.id)))
    return actual;
  const mensajes = new Map(
    [...prev.mensajes, ...actual.mensajes].map((m) => [m.id, m]),
  );
  return {
    ...actual,
    ...(actual.origen === "GENERAL"
      ? {
          conversaciones: prev.conversaciones,
          listaAnterior: prev.listaAnterior,
        }
      : {}),
    anterior: modo === "anteriores" ? actual.anterior : prev.anterior,
    mensajes: [...mensajes.values()].sort(
      (a, b) =>
        a.enviadoEl.localeCompare(b.enviadoEl) || a.id.localeCompare(b.id),
    ),
  };
}
