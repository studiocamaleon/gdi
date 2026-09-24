import { solicitudDesdeMateriales } from "../../apps/api/src/inventario/prevision-materiales.proyeccion";
import { apiRequest } from "./api";
import { materialesDeCotizaciones } from "../../apps/api/src/ordenes-trabajo/materiales-cotizacion.proyeccion";
import type { PropuestaItem } from "./propuestas";
import type { ItemHipotetico } from "./flujo-produccion";
import { instanteDe, sumarDiasAClave } from "./zona";
export type PrevisionMateriales = {
  estado:
    | "no_incluido"
    | "sin_control"
    | "disponible"
    | "requiere_compra"
    | "por_confirmar";
  modoReserva: "MANUAL" | "AL_EMITIR" | null;
  calculadoEl: string;
  fechaPedidoSupuesto: string;
  zona: string;
  disponibleDesde: string | null;
  pendientes: number;
  materiales: Array<{
    varianteId: string;
    nombre: string;
    unidad: string | null;
    necesario: number | null;
    libre: number;
    faltante: number | null;
    disponibleDesde: string | null;
    revisar: boolean;
    motivo: string | null;
    fuentes: Array<{
      tipo:
        | "compra_confirmada"
        | "compra_estimada"
        | "plazo_proveedor"
        | "sin_fecha";
      cantidad: number;
      fecha: string | null;
      proveedor: string | null;
      compraNumero: number | null;
    }>;
  }>;
};
export function solicitudPrevisionMateriales(
  items: Pick<
    PropuestaItem,
    "id" | "productoNombre" | "cotizacion" | "jobContext"
  >[],
) {
  const proyeccion = materialesDeCotizaciones(
    items.map((i) => ({
      id: i.id,
      nombre: i.productoNombre,
      cotizacion: i.cotizacion,
      jobContext: i.jobContext,
    })),
  );
  return solicitudDesdeMateriales(proyeccion);
}
export function consultarPrevisionMateriales(
  data: ReturnType<typeof solicitudPrevisionMateriales>,
  signal?: AbortSignal,
) {
  return apiRequest<PrevisionMateriales>("/inventario/prevision-materiales", {
    method: "POST",
    body: JSON.stringify(data),
    signal,
  });
}
/** Estimación conservadora: requiere todo el material antes de iniciar el trabajo.
 * Las compras tienen día, no hora de recepción: se empieza a planificar desde
 * el día siguiente y el motor respeta calendario, colas y capacidad. */
export function condicionarPorMateriales(
  nuevo: ItemHipotetico,
  prevision: PrevisionMateriales | null,
  error?: string | null,
): ItemHipotetico {
  if (!prevision || prevision.estado === "por_confirmar")
    return {
      ...nuevo,
      pasos: [],
      motivoSinEstimar:
        error ||
        (!prevision
          ? "Consultando disponibilidad de materiales."
          : "Entrega por confirmar: faltan materiales con fecha de reposición o cantidades por revisar."),
    };
  if (prevision.estado !== "requiere_compra") return nuevo;
  if (!prevision.disponibleDesde)
    return {
      ...nuevo,
      pasos: [],
      motivoSinEstimar: "Entrega por confirmar: falta la fecha de reposición.",
    };
  const desde = instanteDe(
    sumarDiasAClave(prevision.disponibleDesde, 1),
    "00:00",
    prevision.zona,
  ).toISOString();
  return {
    ...nuevo,
    pasos: nuevo.pasos.map((p) => ({ ...p, planificadoDesde: desde })),
  };
}
