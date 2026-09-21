import { tieneCapacidad } from "@/lib/capacidades-server";
import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { FidelizacionView } from "@/components/crm/fidelizacion-view";
import { getFidelizacionResumen } from "@/lib/fidelizacion-api";
import { tienePermiso } from "@/lib/permisos-server";
export const dynamic = "force-dynamic";
export default async function FidelizacionPage() {
  if (!(await tieneCapacidad("fidelizacion"))) return <FuncionNoIncluida />;
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
