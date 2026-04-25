import { notFound } from "next/navigation";

import { PasosExtrasPanel } from "@/components/productos-servicios/pasos-extras-panel";
import { ProductoRutasEditorView } from "@/components/productos-servicios/producto-rutas-editor-view";
import { ApiError } from "@/lib/api";
import {
  getCatalogoFamilias,
  getProductoById,
  getRutas,
} from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default async function ProductoRutasPage({
  params,
}: {
  params: Promise<{ productoId: string }>;
}) {
  const { productoId } = await params;
  try {
    const [producto, rutasDisponibles, catalogoFamilias] = await Promise.all([
      getProductoById(productoId),
      getRutas(),
      getCatalogoFamilias(),
    ]);
    return (
      <div className="space-y-6">
        <ProductoRutasEditorView producto={producto} rutasDisponibles={rutasDisponibles} />
        <PasosExtrasPanel
          productoId={producto.id}
          pasosExtras={producto.pasosExtras}
          catalogoFamilias={catalogoFamilias}
        />
      </div>
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}
