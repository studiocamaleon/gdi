import { DesignSystemProvider } from "@/components/design-system/appearance";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { GestionPantallas } from "@/components/produccion/gestion-pantallas";
import { tienePermiso } from "@/lib/permisos-server";

export const dynamic = "force-dynamic";
export default async function PantallasPage() {
  if (
    !(await tienePermiso("produccion.tablero.ver", {
      exigirConfirmacion: true,
    })) ||
    !(await tienePermiso("produccion.configurar", { exigirConfirmacion: true }))
  ) {
    return <SinPermiso modulo="Pantallas de producción" />;
  }
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <GestionPantallas />
    </DesignSystemProvider>
  );
}
