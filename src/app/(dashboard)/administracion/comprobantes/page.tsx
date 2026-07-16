import { ComprobantesView } from "@/components/administracion/comprobantes-view";
import type { Comprobante } from "@/lib/administracion";
import { getComprobantes } from "@/lib/administracion-api";

export const dynamic = "force-dynamic";

export default async function ComprobantesPage() {
  let comprobantes: Comprobante[] = [];
  try {
    comprobantes = await getComprobantes();
  } catch {
    comprobantes = [];
  }
  return <ComprobantesView initialComprobantes={comprobantes} />;
}
