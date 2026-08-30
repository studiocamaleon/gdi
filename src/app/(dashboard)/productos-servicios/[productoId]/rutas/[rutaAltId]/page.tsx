import { notFound, redirect } from "next/navigation";

import { ConfigPasosEditorView } from "@/components/productos-servicios/config-pasos-editor-view";
import {
  getCatalogoFamilias,
  getCargosDirectosCatalogo,
  getLookupsConfigPaso,
  getProductoById,
} from "@/lib/productos-servicios-api";
import { tienePermiso } from "@/lib/permisos-server";

export const dynamic = "force-dynamic";

export default async function ConfigPasosFocusedPage({
  params,
}: {
  params: Promise<{ productoId: string; rutaAltId: string }>;
}) {
  const { productoId, rutaAltId } = await params;
  if (!(await tienePermiso("costos.gestionar"))) {
    redirect(
      `/productos-servicios/${productoId}?tab=produccion&vista=operaciones&rutaAltId=${rutaAltId}`,
    );
  }
  const [producto, catalogoFamilias, lookups, catalogoCargos] =
    await Promise.all([
      getProductoById(productoId),
      getCatalogoFamilias(),
      getLookupsConfigPaso(),
      getCargosDirectosCatalogo(true),
    ]);
  const rutaAlternativa = producto.rutasAlternativas.find((ruta) => ruta.id === rutaAltId);

  if (!rutaAlternativa) {
    notFound();
  }

  return (
    <div className="pasos-editor-page">
      <ConfigPasosEditorView
        producto={producto}
        rutaAlternativa={rutaAlternativa}
        catalogoFamilias={catalogoFamilias}
        lookups={lookups}
        catalogoCargos={catalogoCargos}
        embedded
      />
    </div>
  );
}
