import { PresupuestosView } from "@/components/comercial/presupuestos-view";
import { getCurrentUserCached } from "@/lib/auth-server";
import type { MembershipRole } from "@/lib/auth";
import { listarPresupuestos, type PresupuestosListado } from "@/lib/presupuestos-api";

export const dynamic = "force-dynamic";

export default async function PresupuestosPage() {
  let listado: PresupuestosListado = { presupuestos: [], stats: [] };
  // El rol decide qué acciones ve el drawer (aprobación interna, config).
  // Ante la duda, el rol más restrictivo.
  let rol: MembershipRole = "operador";
  try {
    const [datos, current] = await Promise.all([
      listarPresupuestos(),
      getCurrentUserCached(),
    ]);
    listado = datos;
    rol = current.currentUser.tenantActual.rol;
  } catch {
    // La vista muestra su estado vacío.
  }
  return <PresupuestosView initial={listado} rol={rol} />;
}
