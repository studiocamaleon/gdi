import type {
  ConfiguracionPerfiles,
  DestinoImpresion,
} from "@/lib/impresion-api";

export type CategoriaImpresora = "documentos" | "cad";

/** La clasificación usa la máquina, también antes de configurar su rollo.
 * El CAD guardado conserva su sección si la máquina dejó de estar disponible. */
export function categoriaImpresora(
  destino: DestinoImpresion,
  maquinas: ConfiguracionPerfiles["maquinas"],
): CategoriaImpresora {
  return destino.cad ||
    maquinas.find((m) => m.id === destino.maquinaId)?.plantilla ===
      "PLOTTER_CAD"
    ? "cad"
    : "documentos";
}
