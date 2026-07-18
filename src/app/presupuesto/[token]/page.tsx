import { PresupuestoPublicoView } from "@/components/comercial/presupuesto-publico";
import { getPresupuestoPublico, type PresupuestoPublico } from "@/lib/presupuestos-api";

export const dynamic = "force-dynamic";

/**
 * Vista PÚBLICA del presupuesto (sin sesión — el token es la credencial).
 * El cliente lo ve, y si está vigente puede aprobarlo o rechazarlo: esa
 * decisión queda registrada con timestamp en el timeline (firma virtual).
 */
export default async function PresupuestoPublicoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let datos: PresupuestoPublico | null = null;
  try {
    datos = await getPresupuestoPublico(token);
  } catch {
    // null → estado "no encontrado".
  }
  return <PresupuestoPublicoView token={token} initial={datos} />;
}
