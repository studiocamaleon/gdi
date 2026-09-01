import { notFound, redirect } from "next/navigation";

import { ModeloProductivoEditorView } from "@/components/productos-servicios/modelo-productivo-editor-view";
import {
  getCatalogoFamilias,
  getCargosDirectosCatalogo,
  getLookupsConfigPaso,
  getProductoById,
  getRecetasProducto,
} from "@/lib/productos-servicios-api";
import { tienePermiso } from "@/lib/permisos-server";

export const dynamic = "force-dynamic";

export default async function ConfigPasosFocusedPage({
  params,
  searchParams,
}: {
  params: Promise<{ productoId: string; rutaAltId: string }>;
  searchParams: Promise<{ nodo?: string | string[] }>;
}) {
  const { productoId, rutaAltId } = await params;
  const query = await searchParams;
  const nodoInicial =
    typeof query.nodo === "string" && query.nodo.trim()
      ? query.nodo
      : undefined;
  if (!(await tienePermiso("costos.gestionar"))) {
    redirect(
      `/productos-servicios/${productoId}?tab=produccion&vista=operaciones&rutaAltId=${rutaAltId}`,
    );
  }
  const [producto, catalogoFamilias, lookups, catalogoCargos, recetas] =
    await Promise.all([
      getProductoById(productoId),
      getCatalogoFamilias(),
      getLookupsConfigPaso(),
      getCargosDirectosCatalogo(true),
      getRecetasProducto(productoId),
    ]);
  const rutaAlternativa = producto.rutasAlternativas.find(
    (ruta) => ruta.id === rutaAltId,
  );

  if (!rutaAlternativa) {
    notFound();
  }

  return (
    <div className="pasos-editor-page">
      <ModeloProductivoEditorView
        producto={producto}
        rutaAlternativa={rutaAlternativa}
        catalogoFamilias={catalogoFamilias}
        lookups={lookups}
        catalogoCargos={catalogoCargos}
        recetas={recetas}
        nodoInicial={nodoInicial}
      />
    </div>
  );
}
