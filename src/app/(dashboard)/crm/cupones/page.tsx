import { tieneCapacidad } from "@/lib/capacidades-server";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { CuponesView } from "@/components/comercial/cupones-view";
import { getCurrentUserCached } from "@/lib/auth-server";
import { listarCupones, type CuponesListado } from "@/lib/cupones-api";
export const dynamic = "force-dynamic";
export default async function Page() {
  const conCupones = await tieneCapacidad("cupones");
  const { currentUser } = await getCurrentUserCached();
  const permisos = currentUser.tenantActual.permisos;
  const puedeEditar =
    conCupones && !currentUser.tenantActual.suscripcion?.soloLectura &&
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
  } catch (e) {
    errorInicial =
      e instanceof Error ? e.message : "No se pudieron cargar los cupones.";
  }
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <CuponesView
        initial={listado}
        puedeEditar={puedeEditar}
        conCupones={conCupones}
        errorInicial={errorInicial}
      />
    </DesignSystemProvider>
  );
}
