import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
import { ConfiguracionFiscalView } from "@/components/administracion/configuracion-fiscal-view";
import type { ConfiguracionFiscal } from "@/lib/administracion";
import { getConfiguracionFiscal } from "@/lib/administracion-api";

export const dynamic = "force-dynamic";

export default async function DatosFiscalesPage() {
  if (!(await tienePermiso("administracion.configurar"))) {
    return <SinPermiso modulo="Datos fiscales" />;
  }

  const config = await getConfiguracionFiscal().catch(
    (): ConfiguracionFiscal | null => null,
  );
  return <ConfiguracionFiscalView initialConfig={config} />;
}
