import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
import { ComisionesConfigView } from "@/components/productos-servicios/comisiones-config-view";
import { getComisionesCatalogo } from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default async function ComisionesCatalogoPage() {
  // Mismo permiso que guarda el API del catálogo (@Permiso 'costos.ver').
  if (!(await tienePermiso("costos.ver"))) {
    return <SinPermiso modulo="Comisiones" />;
  }
  const items = await getComisionesCatalogo(false);
  return <ComisionesConfigView initialItems={items} />;
}
