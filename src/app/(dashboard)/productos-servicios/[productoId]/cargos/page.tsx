import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProductoCargosRedirectPage({
  params,
}: {
  params: Promise<{ productoId: string }>;
}) {
  const { productoId } = await params;
  redirect(`/productos-servicios/${productoId}?tab=cargos`);
}
