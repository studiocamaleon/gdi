import { FacturacionView } from "@/components/administracion/facturacion-view";
import { getFacturacionPendientes } from "@/lib/administracion-api";

export const dynamic = "force-dynamic";

export default async function FacturacionPage() {
  const ordenes = await getFacturacionPendientes();
  return <FacturacionView initialOrdenes={ordenes} />;
}
