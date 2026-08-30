import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ProductoRutasRedirectPage({
  params,
}: {
  params: Promise<{ productoId: string }>;
}) {
  const { productoId } = await params;
  redirect(`/productos-servicios/${productoId}?tab=produccion&vista=rutas`);
}
