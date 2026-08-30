import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import {
  ProductoWorkspace,
  type ProductoWorkspaceTab,
} from "@/components/productos-servicios/producto-workspace";
import { ApiError } from "@/lib/api";
import { tienePermiso } from "@/lib/permisos-server";
import {
  getCargosDirectosCatalogo,
  getCatalogoFamilias,
  getLookupsConfigPaso,
  getProductoById,
  getRecetasProducto,
  getRutas,
} from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default async function ProductoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ productoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="detail" />}>
      <ProductoDetalleContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ProductoDetalleContent({
  params,
  searchParams,
}: {
  params: Promise<{ productoId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { productoId } = await params;
  const sp = await searchParams;
  const tab = normalizarTab(firstParam(sp.tab));
  const rutaAltId = firstParam(sp.rutaAltId);
  try {
    const producto = await getProductoById(productoId);
    const rutaAltValida = rutaAltId
      ? producto.rutasAlternativas.some((r) => r.id === rutaAltId)
      : false;
    if (tab === "pasos" && producto.rutasAlternativas.length > 0 && !rutaAltValida) {
      const rutaDefault =
        producto.rutasAlternativas.find((r) => r.esPreferida)?.id ??
        producto.rutasAlternativas[0]?.id;
      redirect(`/productos-servicios/${productoId}?tab=pasos&rutaAltId=${rutaDefault}`);
    }

    const [rutasDisponibles, catalogoFamilias, lookups, catalogoCargos, recetas, canManage] = await Promise.all([
      tab === "rutas" ? getRutas() : Promise.resolve(undefined),
      tab === "rutas" || tab === "pasos" ? getCatalogoFamilias() : Promise.resolve(undefined),
      tab === "pasos" ? getLookupsConfigPaso() : Promise.resolve(undefined),
      tab === "cargos" ? getCargosDirectosCatalogo(true) : Promise.resolve(undefined),
      tab === "receta" ? getRecetasProducto(productoId) : Promise.resolve(undefined),
      tienePermiso("costos.gestionar"),
    ]);

    return (
      <ProductoWorkspace
        producto={producto}
        activeTab={tab}
        rutaAltId={rutaAltId}
        rutasDisponibles={rutasDisponibles}
        catalogoFamilias={catalogoFamilias}
        lookups={lookups}
        catalogoCargos={catalogoCargos}
        recetas={recetas}
        canManage={canManage}
      />
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizarTab(value: string | undefined): ProductoWorkspaceTab {
  if (
    value === "identidad" ||
    value === "rutas" ||
    value === "pasos" ||
    value === "receta" ||
    value === "cargos" ||
    value === "herramientas" ||
    value === "pricing"
  ) {
    return value;
  }
  return "identidad";
}
