import { notFound, redirect } from "next/navigation";

import { ConfigPasosEditorView } from "@/components/productos-servicios/config-pasos-editor-view";
import {
  getCatalogoFamilias,
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
    redirect(`/productos-servicios/${productoId}?tab=pasos&rutaAltId=${rutaAltId}`);
  }
  const [producto, catalogoFamilias, lookups] = await Promise.all([
    getProductoById(productoId),
    getCatalogoFamilias(),
    getLookupsConfigPaso(),
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
        embedded
      />
    </div>
  );
}
