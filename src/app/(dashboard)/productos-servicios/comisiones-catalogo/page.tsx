import { PrecioCatalogoManager } from "@/components/productos-servicios/precio-catalogo-manager";
import { getComisionesCatalogo } from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default async function ComisionesCatalogoPage() {
  const items = await getComisionesCatalogo(false);
  return <PrecioCatalogoManager initialItems={items} tipo="comisiones" />;
}
