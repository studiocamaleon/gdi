import { notFound } from "next/navigation";

import { PresupuestoDetalleView } from "@/components/comercial/presupuesto-detalle-view";
import { ApiError } from "@/lib/api";
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

  return <PresupuestoDetalleView inicial={detalle} />;
}
