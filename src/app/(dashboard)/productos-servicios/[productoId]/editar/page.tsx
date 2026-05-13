import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * /[productoId]/editar — redirige a la ficha del producto.
 *
 * Mantiene la URL para no romper links externos / históricos.
 */
export default async function EditarProductoRedirectPage({
  params,
}: {
  params: Promise<{ productoId: string }>;
}) {
  const { productoId } = await params;
  redirect(`/productos-servicios/${productoId}?tab=identidad`);
}
