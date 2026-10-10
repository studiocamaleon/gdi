import { notFound } from "next/navigation";
import { FacturacionTelefonosPreview } from "@/components/design-system/preview/facturacion-telefonos-preview";
export default function FacturacionPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <FacturacionTelefonosPreview />;
}
