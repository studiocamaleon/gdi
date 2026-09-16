import { notFound } from "next/navigation";
import { ButtonDesignPreview } from "@/components/design-system/preview/button-design-preview";

export const metadata = { title: "Botones · Laboratorio Grafoprint" };

export default function ButtonDesignPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ButtonDesignPreview />;
}
