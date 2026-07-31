import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
import { ImpuestosConfigView } from "@/components/productos-servicios/impuestos-config-view";
import { getImpuestosCatalogo } from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default async function ImpuestosCatalogoPage() {
  // Mismo permiso que guarda el API del catálogo (@Permiso 'costos.ver').
  if (!(await tienePermiso("costos.ver"))) {
    return <SinPermiso modulo="Impuestos" />;
  }
  const items = await getImpuestosCatalogo(false); // incluye inactivos
  return <ImpuestosConfigView initialItems={items} />;
}
