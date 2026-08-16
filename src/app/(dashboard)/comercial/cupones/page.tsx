import { CuponesView } from "@/components/comercial/cupones-view";
import { getCurrentUserCached } from "@/lib/auth-server";
import { listarCupones, type CuponesListado } from "@/lib/cupones-api";

export const dynamic = "force-dynamic";

export default async function CuponesPage() {
  const { currentUser } = await getCurrentUserCached();
  const permisos = currentUser.tenantActual.permisos;
  const puedeEditar =
    currentUser.tenantActual.rol !== "operador" &&
    (permisos == null || permisos.includes("comercial.aprobar_descuento"));
  let listado: CuponesListado = {
    items: [],
    total: 0,
    skip: 0,
    limit: 24,
    metricas: {
      total: 0,
      vigentes: 0,
      porVencer: 0,
      agotados: 0,
      redencionesMes: 0,
      descontadoMes: 0,
    },
  };
  let errorInicial: string | null = null;
  try {
    listado = await listarCupones({ limit: 24 });
  } catch (error) {
    errorInicial =
      error instanceof Error
        ? error.message
        : "No se pudieron cargar los cupones.";
  }
  return (
    <CuponesView
      initial={listado}
      puedeEditar={puedeEditar}
      errorInicial={errorInicial}
    />
  );
}
