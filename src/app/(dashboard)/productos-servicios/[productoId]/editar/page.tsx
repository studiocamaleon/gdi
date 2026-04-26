import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * /[productoId]/editar — redirige al wizard del producto.
 *
 * El editor monolítico fue reemplazado por el wizard de 5 steps en Sprint 3.
 * Mantiene la URL para no romper links externos / históricos.
 */
export default async function EditarProductoRedirectPage({
  params,
}: {
  params: Promise<{ productoId: string }>;
}) {
  const { productoId } = await params;
  redirect(`/productos-servicios/${productoId}/wizard`);
}
