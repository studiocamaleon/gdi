import { notFound } from "next/navigation";
import { ReportesIvaPreview } from "@/components/design-system/preview/reportes-iva-preview";
export default function ReportesIvaPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ReportesIvaPreview />;
}
