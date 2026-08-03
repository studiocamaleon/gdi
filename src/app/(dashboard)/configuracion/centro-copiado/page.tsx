import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
import { CentroCopiadoConfigView } from "@/components/comercial/centro-copiado-config-view";

export const dynamic = "force-dynamic";

/**
 * Configuración › Centro de copiado. Cura qué ofrece el TPV (papeles, tamaños,
 * terminaciones). El API la guarda por tenant; el permiso es el mismo que gestiona
 * costeo/máquinas/materiales.
 */
export default async function CentroCopiadoConfigPage() {
  if (!(await tienePermiso("costos.gestionar"))) {
    return <SinPermiso modulo="Centro de copiado" />;
  }
  return <CentroCopiadoConfigView />;
}
