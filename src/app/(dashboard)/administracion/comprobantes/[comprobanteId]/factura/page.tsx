import { notFound } from "next/navigation";

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
  } catch {
    doc = null;
  }

  if (!doc) notFound();

  return <FacturaView doc={doc} id={comprobanteId} />;
}
