import { notFound, redirect } from "next/navigation";

import { ProductoServicioFichaTabs } from "@/components/productos-servicios/producto-servicio-ficha-tabs";
import { ApiError } from "@/lib/api";
import { getClientes } from "@/lib/clientes-api";
import { getMaquinas } from "@/lib/maquinaria-api";
import { getMateriasPrimas } from "@/lib/materias-primas-api";
import { getProcesoOperacionPlantillas, getProcesos } from "@/lib/procesos-api";
import {
  getFamiliasProducto,
  getMotoresCostoCatalogo,
  getProductoImpuestosCatalogo,
  getProductoChecklist,
  getProductoServicio,
  getProductoVariantes,
  getSubfamiliasProducto,
} from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

type ProductoServicioDetallePageProps = {
  params: Promise<{
    productoId: string;
  }>;
};

export default async function ProductoServicioDetallePage({
  params,
}: ProductoServicioDetallePageProps) {
  const { productoId } = await params;

  try {
    const [producto, variantes, procesos, plantillasPaso, materiasPrimas, familias, subfamilias, motores, checklist, maquinas, impuestosCatalogo, clientes] = await Promise.all([
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
      getClientes(),
    ]);

    return (
      <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <ProductoServicioFichaTabs
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
