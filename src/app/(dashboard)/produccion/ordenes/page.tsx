import { OrdenesTrabajoView } from "@/components/produccion/ordenes-trabajo-view";
import type {
  OrdenTrabajoEstado,
  OrdenesTrabajoStats,
} from "@/lib/ordenes-trabajo";
import { getOrdenesTrabajo } from "@/lib/ordenes-trabajo-api";
import { ApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

const LIMIT = 30;

const STATS_VACIAS: OrdenesTrabajoStats = {
  porEstado: {
    borrador: 0,
    pendiente: 0,
    produccion: 0,
    finalizada: 0,
    entregada: 0,
    cancelada: 0,
  },
  totalOrdenes: 0,
  activas: 0,
  valorEnCurso: 0,
  proximasEntregar: 0,
  atrasadas: 0,
  emitidasHoy: 0,
};

const ESTADOS_VALIDOS = new Set([
  "borrador",
  "pendiente",
  "produccion",
  "finalizada",
  "entregada",
  "cancelada",
]);

/**
 * El listado es server-driven: búsqueda, filtro y página viven en la URL y
 * las resuelve el backend (indexado). Antes se traían hasta 200 órdenes y
 * se filtraba en el cliente — más allá del límite, las órdenes viejas
 * desaparecían en silencio y los KPIs mentían.
 */
export default async function OrdenesTrabajoPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    estado?: string;
    urgencia?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  // Validado contra el enum: un estado inventado en la URL cae a undefined.
  const estado =
    params.estado && ESTADOS_VALIDOS.has(params.estado)
      ? (params.estado as OrdenTrabajoEstado)
      : undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const urgencia = params.urgencia === "atrasadas" ? "atrasadas" : undefined;

  let respuesta;
  let errorCarga: string | null = null;
  try {
    respuesta = await getOrdenesTrabajo({
      q,
      estado: urgencia ? undefined : estado,
      urgencia,
      page,
      limit: LIMIT,
    });
  } catch (error) {
    errorCarga =
      error instanceof ApiError && error.status === 403
        ? "No tenés permisos para consultar las órdenes de trabajo."
        : "No se pudieron cargar las órdenes de trabajo. Revisá la conexión e intentá nuevamente.";
    respuesta = {
      data: [],
      total: 0,
      page: 1,
      limit: LIMIT,
      pages: 0,
      stats: STATS_VACIAS,
    };
  }

  return (
    <OrdenesTrabajoView
      ordenes={respuesta.data}
      stats={respuesta.stats}
      total={respuesta.total}
      page={respuesta.page}
      pages={respuesta.pages}
      limit={respuesta.limit}
      q={q ?? ""}
      estado={urgencia ? "todas" : (estado ?? "todas")}
      urgencia={urgencia}
      errorCarga={errorCarga}
    />
  );
}
