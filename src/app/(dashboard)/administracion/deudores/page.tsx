import { DeudoresView } from "@/components/administracion/deudores-view";
import { getDeudores } from "@/lib/administracion-api";

export const dynamic = "force-dynamic";

export default async function DeudoresPage() {
  const filas = await getDeudores();
  return <DeudoresView initialFilas={filas} />;
}
