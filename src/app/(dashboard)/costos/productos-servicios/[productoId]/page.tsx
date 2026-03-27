import dynamicImport from "next/dynamic";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { ApiError } from "@/lib/api";
import { getClientes } from "@/lib/clientes-api";
import { getMaquinas } from "@/lib/maquinaria-api";
import { getMateriasPrimas } from "@/lib/materias-primas-api";
import { getProcesoOperacionPlantillas, getProcesos } from "@/lib/procesos-api";
import {
  getProductoComisionesCatalogo,
  getFamiliasProducto,
  getMotoresCostoCatalogo,
  getProductoImpuestosCatalogo,
  getProductoChecklist,
  getProductoServicio,
  getProductoVariantes,
  getSubfamiliasProducto,
} from "@/lib/productos-servicios-api";

const ProductoServicioDetailShell = dynamicImport(
  () =>
    import("@/components/productos-servicios/producto-servicio-detail-shell").then(
      (module) => module.ProductoServicioDetailShell,
    ),
  {
    loading: () => <ModulePageSkeleton variant="detail" />,
  },
);

export const dynamic = "force-dynamic";

type ProductoServicioDetallePageProps = {
  params: Promise<{
    productoId: string;
  }>;
};

export default async function ProductoServicioDetallePage({
  params,
}: ProductoServicioDetallePageProps) {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="detail" />}>
      <ProductoServicioDetallePageContent params={params} />
    </Suspense>
  );
}

async function ProductoServicioDetallePageContent({
  params,
}: ProductoServicioDetallePageProps) {
  const { productoId } = await params;

  try {
  const [producto, variantes, procesos, plantillasPaso, materiasPrimas, familias, subfamilias, motores, checklist, maquinas, impuestosCatalogo, comisionesCatalogo, clientes] = await Promise.all([
      getProductoServicio(productoId),
      getProductoVariantes(productoId),
      getProcesos(),
      getProcesoOperacionPlantillas(),
      getMateriasPrimas(),
      getFamiliasProducto(),
      getSubfamiliasProducto(),
      getMotoresCostoCatalogo(),
      getProductoChecklist(productoId),
      getMaquinas(),
      getProductoImpuestosCatalogo(),
      getProductoComisionesCatalogo(),
      getClientes(),
    ]);

    return (
      <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <ProductoServicioDetailShell
          producto={producto}
          initialVariantes={variantes}
          procesos={procesos}
          plantillasPaso={plantillasPaso}
          materiasPrimas={materiasPrimas}
          familias={familias}
          subfamilias={subfamilias}
          motores={motores}
          checklist={checklist}
          maquinas={maquinas}
          initialImpuestosCatalogo={impuestosCatalogo}
          initialComisionesCatalogo={comisionesCatalogo}
          initialClientes={clientes}
        />
      </section>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    if (error instanceof ApiError && error.status === 401) {
      redirect("/login");
    }

    throw error;
  }
}
