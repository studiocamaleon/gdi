import { notFound } from "next/navigation";

import { ConfigPasosEditorView } from "@/components/productos-servicios/config-pasos-editor-view";
import { ApiError } from "@/lib/api";
import {
  getCatalogoFamilias,
  getLookupsConfigPaso,
  getProductoById,
} from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default async function ConfigPasosPage({
  params,
}: {
  params: Promise<{ productoId: string; rutaAltId: string }>;
}) {
  const { productoId, rutaAltId } = await params;
  try {
    const [producto, catalogo, lookups] = await Promise.all([
      getProductoById(productoId),
      getCatalogoFamilias(),
      getLookupsConfigPaso(),
    ]);
    const rutaAlt = producto.rutasAlternativas.find((r) => r.id === rutaAltId);
    if (!rutaAlt) notFound();
    return (
      <ConfigPasosEditorView
        producto={producto}
        rutaAlternativa={rutaAlt}
        catalogoFamilias={catalogo}
        lookups={lookups}
      />
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}
