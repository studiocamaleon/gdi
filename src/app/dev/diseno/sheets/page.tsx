import { notFound } from "next/navigation";
import { ProductSheetPreview } from "@/components/design-system/preview/product-sheet-preview";

export const metadata = {
  title: "Sheets de producto · Laboratorio Grafoprint",
};

export default function SheetDesignPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ProductSheetPreview />;
}
