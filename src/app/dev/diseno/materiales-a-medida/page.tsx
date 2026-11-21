import { notFound } from "next/navigation";
import { PruebaMateriales } from "./prueba-materiales";

export const metadata = { title: "Materiales a medida · Prueba local" };

export default function MaterialesAMedidaPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PruebaMateriales />;
}
