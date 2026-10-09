import { notFound } from "next/navigation";
import { OperadoresDesignPreview } from "@/components/comercial/operadores-design-preview";
export default function OperadoresPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <OperadoresDesignPreview />;
}
