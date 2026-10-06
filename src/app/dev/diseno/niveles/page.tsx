import { notFound } from "next/navigation";
import { NivelesDesignPreview } from "@/components/productos-servicios/niveles-design-preview";
export default function NivelesPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <NivelesDesignPreview />;
}
