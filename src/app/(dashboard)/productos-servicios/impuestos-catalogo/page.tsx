import { PrecioCatalogoManager } from "@/components/productos-servicios/precio-catalogo-manager";
import { getImpuestosCatalogo } from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default async function ImpuestosCatalogoPage() {
  const items = await getImpuestosCatalogo(false); // incluye inactivos
  return <PrecioCatalogoManager initialItems={items} tipo="impuestos" />;
}
