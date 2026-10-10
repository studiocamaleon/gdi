import { tienePermiso } from "@/lib/permisos-server";
import { tieneCapacidad } from "@/lib/capacidades-server";
import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { PlanificacionView } from "@/components/produccion/planificacion-view";
import { cargarDatosTableroProduccion } from "@/lib/tablero-produccion-server";
import { DesignSystemProvider } from "@/components/design-system/appearance";

export const dynamic = "force-dynamic";

export default async function PlanificacionProduccionPage() {
  if (!(await tieneCapacidad("planificacion_avanzada")))
    return <FuncionNoIncluida />;
  const [datos, puedeReprogramar, puedeCambiarEntrega] = await Promise.all([
    cargarDatosTableroProduccion(),
    tienePermiso("produccion.supervisar", { exigirConfirmacion: true }),
    tienePermiso("comercial.ordenes.gestionar", { exigirConfirmacion: true }),
  ]);
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <PlanificacionView puedeReprogramar={puedeReprogramar} puedeCambiarEntrega={puedeCambiarEntrega} {...datos} consultadoEl={new Date().toISOString()} />
    </DesignSystemProvider>
  );
}
