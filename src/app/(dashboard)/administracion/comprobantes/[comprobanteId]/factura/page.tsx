import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";

import { FacturaView } from "@/components/administracion/factura-view";
import type { FacturaDocumento } from "@/lib/administracion";
import { getFactura } from "@/lib/administracion-api";

export const dynamic = "force-dynamic";

export default async function FacturaPage({
  params,
}: {
  params: Promise<{ comprobanteId: string }>;
}) {
  const { comprobanteId } = await params;

  let doc: FacturaDocumento | null = null;
  try {
    doc = await getFactura(comprobanteId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  if (!doc) notFound();

  return <FacturaView doc={doc} id={comprobanteId} />;
}
