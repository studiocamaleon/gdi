import { FacturacionView } from "@/components/administracion/facturacion-view";
import type { OrdenFacturable } from "@/lib/administracion";
import { getFacturacionPendientes } from "@/lib/administracion-api";

export const dynamic = "force-dynamic";

export default async function FacturacionPage() {
  let ordenes: OrdenFacturable[] = [];
  try {
    ordenes = await getFacturacionPendientes();
  } catch {
    ordenes = [];
  }
  return <FacturacionView initialOrdenes={ordenes} />;
}
