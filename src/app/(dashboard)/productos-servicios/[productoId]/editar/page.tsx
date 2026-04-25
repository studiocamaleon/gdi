import { notFound } from "next/navigation";

import { ProductoFormView } from "@/components/productos-servicios/producto-form-view";
import { ApiError } from "@/lib/api";
import { getProductoById } from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default async function EditarProductoPage({
  params,
}: {
  params: Promise<{ productoId: string }>;
}) {
  const { productoId } = await params;
  try {
    const producto = await getProductoById(productoId);
    return <ProductoFormView modo="editar" productoExistente={producto} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}
