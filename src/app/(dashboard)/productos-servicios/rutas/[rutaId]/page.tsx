import { notFound } from "next/navigation";

import { RutaFormView } from "@/components/productos-servicios/ruta-form-view";
import { ApiError } from "@/lib/api";
import { getCatalogoFamilias, getRutaById } from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

interface RutaConPasos {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  versionActual: number;
  activo: boolean;
  pasos: Array<{ id: string; orden: number; familiaCodigo: string }>;
  versiones: Array<{ version: number; cambios: string | null; createdAt: string }>;
  productosAlternativas: Array<{
    id: string;
    nombre: string;
    producto: { id: string; codigo: string; nombre: string };
  }>;
}

export default async function RutaDetallePage({
  params,
}: {
  params: Promise<{ rutaId: string }>;
}) {
  const { rutaId } = await params;
  try {
    const [ruta, catalogo] = await Promise.all([
      getRutaById(rutaId) as Promise<RutaConPasos>,
      getCatalogoFamilias(),
    ]);
    return <RutaFormView modo="editar" rutaExistente={ruta} catalogoFamilias={catalogo} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}
