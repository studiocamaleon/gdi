import { tieneCapacidad } from "@/lib/capacidades-server";
import { getCurrentUserCached } from "@/lib/auth-server";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { FidelizacionView } from "@/components/crm/fidelizacion-view";
import { getFidelizacionResumen } from "@/lib/fidelizacion-api";
import { tienePermiso } from "@/lib/permisos-server";
export const dynamic = "force-dynamic";
export default async function FidelizacionPage() {
  const [initial, permiso, conFidelizacion, { currentUser }] = await Promise.all([
    getFidelizacionResumen(),
    tienePermiso("crm.configurar_fidelizacion"),
    tieneCapacidad("fidelizacion"),
    getCurrentUserCached(),
  ]);
  const puedeConfigurar = permiso && conFidelizacion && !currentUser.tenantActual.suscripcion?.soloLectura;
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <FidelizacionView initial={initial} puedeConfigurar={puedeConfigurar} conFidelizacion={conFidelizacion} />
    </DesignSystemProvider>
  );
}
