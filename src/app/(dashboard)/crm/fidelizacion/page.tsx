import { DesignSystemProvider } from "@/components/design-system/appearance";
import { FidelizacionView } from "@/components/crm/fidelizacion-view";
import { getFidelizacionResumen } from "@/lib/fidelizacion-api";
import { tienePermiso } from "@/lib/permisos-server";
export const dynamic = "force-dynamic";
export default async function FidelizacionPage() {
  const [initial, puedeConfigurar] = await Promise.all([
    getFidelizacionResumen(),
    tienePermiso("crm.configurar_fidelizacion"),
  ]);
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <FidelizacionView initial={initial} puedeConfigurar={puedeConfigurar} />
    </DesignSystemProvider>
  );
}
