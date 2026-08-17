import { Suspense } from "react";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { ProductosServiciosTable } from "@/components/productos-servicios/productos-table";
import { getCatalogoComercial, listProductos } from "@/lib/productos-servicios-api";
import { tienePermiso } from "@/lib/permisos-server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default function ProductosServiciosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="table" />}>
      <ProductosServiciosPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ProductosServiciosPageContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(first(params.page)) || 1);
  const unidad = normalizarUnidad(first(params.unidad));
  const estado = normalizarEstado(first(params.estado));
  const orden = normalizarOrden(first(params.orden));
  const search = first(params.search)?.trim() ?? "";
  const categoria = first(params.categoria)?.trim() ?? "";
  const [res, catalogo, canManage] = await Promise.all([
    listProductos({
      page,
      limit: PAGE_SIZE,
      search,
      activo: estado === "activo" ? true : estado === "inactivo" ? false : undefined,
      unidadComercial: unidad || undefined,
      subcategoriaCodigo: categoria || undefined,
      orden,
    }),
    getCatalogoComercial(),
    tienePermiso("costos.gestionar"),
  ]);
  return (
    <ProductosServiciosTable
      initialProductos={res.data}
      initialTotal={res.total}
      initialPages={res.pages}
      pageSize={PAGE_SIZE}
      canManage={canManage}
      initialQuery={{
        page,
        search,
        unidadComercial: unidad,
        subcategoriaCodigo: categoria,
        estado,
        orden,
      }}
      subcategorias={catalogo.flatMap((grupo) =>
        grupo.subcategorias.map((subcategoria) => ({
          value: subcategoria.codigo,
          label: `${grupo.nombre} · ${subcategoria.nombre}`,
        })),
      )}
    />
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizarUnidad(value: string | undefined) {
  return value === "unidad" || value === "m2" || value === "metro_lineal" ? value : "";
}

function normalizarEstado(value: string | undefined) {
  return value === "activo" || value === "inactivo" ? value : "";
}

function normalizarOrden(value: string | undefined) {
  return value === "nombre_asc" || value === "nombre_desc" ? value : "recientes";
}
