import { notFound } from "next/navigation";
import { ComponentDesignPreview } from "@/components/design-system/preview/component-design-preview";

export const metadata = { title: "Componentes · Laboratorio Grafoprint" };

export default function ComponentDesignPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ComponentDesignPreview />;
}
