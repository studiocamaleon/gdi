import { notFound } from "next/navigation";

import { ProductoRutasEditorView } from "@/components/productos-servicios/producto-rutas-editor-view";
import { ApiError } from "@/lib/api";
import { getProductoById, getRutas } from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default async function ProductoRutasPage({
  params,
}: {
  params: Promise<{ productoId: string }>;
}) {
  const { productoId } = await params;
  try {
    const [producto, rutasDisponibles] = await Promise.all([
      getProductoById(productoId),
      getRutas(),
    ]);
    return (
      <ProductoRutasEditorView producto={producto} rutasDisponibles={rutasDisponibles} />
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}
