import { PresupuestosView } from "@/components/comercial/presupuestos-view";
import { listarPresupuestos, type PresupuestosListado } from "@/lib/presupuestos-api";

export const dynamic = "force-dynamic";

export default async function PresupuestosPage() {
  let listado: PresupuestosListado = { presupuestos: [], stats: [] };
  try {
    listado = await listarPresupuestos();
  } catch {
    // La vista muestra su estado vacío.
  }
  return <PresupuestosView initial={listado} />;
}
