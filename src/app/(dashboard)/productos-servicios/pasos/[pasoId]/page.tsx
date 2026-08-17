import { SinPermiso } from "@/components/navigation/sin-permiso";
import { PasoTenantConfiguracionPage } from "@/components/productos-servicios/paso-tenant-configuracion-page";
import { tienePermiso } from "@/lib/permisos-server";

export const dynamic = "force-dynamic";

export default async function PasoTenantPage({
  params,
}: {
  params: Promise<{ pasoId: string }>;
}) {
  if (!(await tienePermiso("costos.gestionar"))) {
    return <SinPermiso modulo="Configuración de pasos" />;
  }
  const { pasoId } = await params;
  return <PasoTenantConfiguracionPage pasoId={pasoId} />;
}
