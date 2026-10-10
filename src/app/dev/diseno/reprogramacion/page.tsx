import { notFound } from "next/navigation";
import { ReprogramacionPreview } from "@/components/design-system/preview/reprogramacion-preview";
export default function ReprogramacionPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ReprogramacionPreview />;
}
