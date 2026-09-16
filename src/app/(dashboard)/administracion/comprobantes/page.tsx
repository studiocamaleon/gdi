import { ComprobantesView } from "@/components/administracion/comprobantes-view";
import { getComprobantes } from "@/lib/administracion-api";

export const dynamic = "force-dynamic";

export default async function ComprobantesPage() {
  const comprobantes = await getComprobantes();
  return <ComprobantesView initialComprobantes={comprobantes} />;
}
