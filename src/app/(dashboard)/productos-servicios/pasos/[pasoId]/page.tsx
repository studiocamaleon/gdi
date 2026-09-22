import { puedeConfigurar } from "@/lib/capacidades-server";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { PasoTenantConfiguracionPage } from "@/components/productos-servicios/paso-tenant-configuracion-page";

export const dynamic = "force-dynamic";

export default async function PasoTenantPage({
  params,
}: {
  params: Promise<{ pasoId: string }>;
}) {
  if (!(await puedeConfigurar("procesos", "costos.gestionar"))) {
    return <SinPermiso modulo="Configuración de nodos" />;
  }
  const { pasoId } = await params;
  return <PasoTenantConfiguracionPage pasoId={pasoId} />;
}
