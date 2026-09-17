import { PresupuestoPdfView } from "@/components/comercial/presupuesto-pdf-view";

export const metadata = { title: "PDF del presupuesto · Grafo" };

export default async function PresupuestoPdfPage({
  params,
}: {
  params: Promise<{ presupuestoId: string }>;
}) {
  const { presupuestoId } = await params;
  return <PresupuestoPdfView id={presupuestoId} />;
}
