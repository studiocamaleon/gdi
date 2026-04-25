import { notFound } from "next/navigation";

import { ProductoCargosEditorView } from "@/components/productos-servicios/producto-cargos-editor-view";
import { ApiError } from "@/lib/api";
import {
  getCargosDirectosCatalogo,
  getProductoById,
} from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default async function ProductoCargosPage({
  params,
}: {
  params: Promise<{ productoId: string }>;
}) {
  const { productoId } = await params;
  try {
    const [producto, catalogo] = await Promise.all([
      getProductoById(productoId),
      getCargosDirectosCatalogo(true),
    ]);
    return <ProductoCargosEditorView producto={producto} catalogoCargos={catalogo} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}
