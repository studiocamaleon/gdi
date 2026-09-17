import { notFound } from "next/navigation";
import { OrdenDesignPreview } from "@/components/comercial/orden-design-preview";

/** Catálogo visual sólo en desarrollo. No sustituye la ficha operativa. */
export default function OrdenDesignPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <OrdenDesignPreview />;
}
