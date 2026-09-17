import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";

import { ComprobanteDetalleView } from "@/components/administracion/comprobante-detalle-view";
import type { ComprobanteDetalle } from "@/lib/administracion";
import { getComprobante } from "@/lib/administracion-api";

export const dynamic = "force-dynamic";

export default async function ComprobantePage({
  params,
}: {
  params: Promise<{ comprobanteId: string }>;
}) {
  const { comprobanteId } = await params;

  // El fetch va separado del render: la regla react-hooks prohíbe JSX
  // dentro de try/catch.
  let comprobante: ComprobanteDetalle | null = null;
  try {
    comprobante = await getComprobante(comprobanteId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  if (!comprobante) notFound();

  return <ComprobanteDetalleView comprobante={comprobante} />;
}
