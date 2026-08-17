import { notFound } from "next/navigation";

import { RutaFormView } from "@/components/productos-servicios/ruta-form-view";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { ApiError } from "@/lib/api";
import { tienePermiso } from "@/lib/permisos-server";
import {
  getCatalogoFamilias,
  getRutaById,
} from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

interface RutaConPasos {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  versionActual: number;
  activo: boolean;
  pasos: Array<{
    id: string;
    orden: number;
    familiaCodigo: string;
    nombreVisible?: string | null;
    icono?: string | null;
  }>;
  versiones: Array<{
    version: number;
    cambios: string | null;
    createdAt: string;
  }>;
  productosAlternativas: Array<{
    id: string;
    nombre: string;
    rutaVersion: number;
    producto: { id: string; codigo: string; nombre: string };
  }>;
}

export default async function RutaDetallePage({
  params,
}: {
  params: Promise<{ rutaId: string }>;
}) {
  const { rutaId } = await params;
  if (!(await tienePermiso("costos.gestionar"))) {
    return <SinPermiso modulo="Rutas de producción" />;
  }
  try {
    const [ruta, catalogo] = await Promise.all([
      getRutaById(rutaId) as Promise<RutaConPasos>,
      getCatalogoFamilias(),
    ]);
    return (
      <RutaFormView
        modo="editar"
        rutaExistente={ruta}
        catalogoFamilias={catalogo}
      />
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}
