import { SinPermiso } from "@/components/navigation/sin-permiso";
import { PanelGeneralView } from "@/components/panel-general/panel-general-view";
import { getCurrentUserCached } from "@/lib/auth-server";
import { getPanelGeneral } from "@/lib/panel-general-api";
import { tienePermiso } from "@/lib/permisos-server";

export const dynamic = "force-dynamic";

/**
 * Panel general operativo: la foto actual del trabajo, personalizada por los
 * permisos efectivos. La inteligencia histórica sigue viviendo en Reportes.
 */
export default async function DashboardPage() {
  if (!(await tienePermiso("panel.ver"))) {
    return <SinPermiso modulo="el Panel general" />;
  }

  const [{ currentUser }, panel] = await Promise.all([
    getCurrentUserCached(),
    getPanelGeneral().catch(() => null),
  ]);

  return (
    <PanelGeneralView
      initialData={panel}
      nombreUsuario={currentUser.nombreCompleto ?? currentUser.email}
    />
  );
}
