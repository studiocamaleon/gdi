import { notFound } from "next/navigation";

import { PresupuestoDetalleView } from "@/components/comercial/presupuesto-detalle-view";
import { ApiError } from "@/lib/api";
import type { MembershipRole } from "@/lib/auth";
import { getCurrentUserCached } from "@/lib/auth-server";
import { getPresupuesto } from "@/lib/presupuestos-api";

export const dynamic = "force-dynamic";

export default async function PresupuestoDetallePage({
  params,
}: {
  params: Promise<{ presupuestoId: string }>;
}) {
  const { presupuestoId } = await params;

  let detalle;
  try {
    detalle = await getPresupuesto(presupuestoId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  // El rol decide si se ven las acciones de aprobación interna.
  // Ante la duda, el más restrictivo.
  let rol: MembershipRole = "operador";
  try {
    const current = await getCurrentUserCached();
    rol = current.currentUser.tenantActual.rol;
  } catch {
    /* queda operador */
  }

  return <PresupuestoDetalleView inicial={detalle} rol={rol} />;
}
