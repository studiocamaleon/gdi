import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import {
  ProductoWorkspace,
  type ProductoProduccionVista,
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
  const tabSolicitada = firstParam(sp.tab);
  const tab = normalizarTab(tabSolicitada);
  const produccionVista = normalizarProduccionVista(
    firstParam(sp.vista),
    tabSolicitada,
  );
  const rutaAltId = firstParam(sp.rutaAltId);
  try {
    const producto = await getProductoById(productoId);
    const rutaAltValida = rutaAltId
      ? producto.rutasAlternativas.some((r) => r.id === rutaAltId)
      : false;
    if (
      tabSolicitada === "rutas" ||
      tabSolicitada === "pasos" ||
      tabSolicitada === "receta"
    ) {
      const params = new URLSearchParams({
        tab: "produccion",
        vista: produccionVista,
      });
      if (rutaAltId) params.set("rutaAltId", rutaAltId);
      redirect(`/productos-servicios/${productoId}?${params.toString()}`);
    }
    if (
      tab === "produccion" &&
      produccionVista === "operaciones" &&
      producto.rutasAlternativas.length > 0 &&
      !rutaAltValida
    ) {
      const rutaDefault =
        producto.rutasAlternativas.find((r) => r.esPreferida)?.id ??
        producto.rutasAlternativas[0]?.id;
      redirect(
        `/productos-servicios/${productoId}?tab=produccion&vista=operaciones&rutaAltId=${rutaDefault}`,
      );
    }

    const [rutasDisponibles, catalogoFamilias, lookups, catalogoCargos, recetas, canManage] = await Promise.all([
      tab === "produccion" && produccionVista === "rutas" ? getRutas() : Promise.resolve(undefined),
      tab === "produccion" && (produccionVista === "rutas" || produccionVista === "operaciones") ? getCatalogoFamilias() : Promise.resolve(undefined),
      tab === "produccion" && produccionVista === "operaciones" ? getLookupsConfigPaso() : Promise.resolve(undefined),
      tab === "cargos" ? getCargosDirectosCatalogo(true) : Promise.resolve(undefined),
      getRecetasProducto(productoId),
      tienePermiso("costos.gestionar"),
    ]);

    return (
      <ProductoWorkspace
        producto={producto}
        activeTab={tab}
        produccionVista={produccionVista}
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
    value === "produccion" ||
    value === "cargos" ||
    value === "herramientas" ||
    value === "pricing"
  ) {
    return value;
  }
  return "identidad";
}

function normalizarProduccionVista(
  value: string | undefined,
  tabLegacy?: string,
): ProductoProduccionVista {
  if (tabLegacy === "pasos") return "operaciones";
  if (tabLegacy === "receta") return "bom";
  if (value === "rutas" || value === "operaciones" || value === "bom") {
    return value;
  }
  return "rutas";
}
