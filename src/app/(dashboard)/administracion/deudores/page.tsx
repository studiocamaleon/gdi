import { DeudoresView } from "@/components/administracion/deudores-view";
import type { FilaDeudor } from "@/lib/administracion";
import { getDeudores } from "@/lib/administracion-api";

export const dynamic = "force-dynamic";

export default async function DeudoresPage() {
  let filas: FilaDeudor[] = [];
  try {
    filas = await getDeudores();
  } catch {
    filas = [];
  }
  return <DeudoresView initialFilas={filas} />;
}
