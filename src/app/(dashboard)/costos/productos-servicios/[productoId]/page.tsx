import { notFound } from "next/navigation";

import { ProductoServicioFichaTabs } from "@/components/productos-servicios/producto-servicio-ficha-tabs";
import { getMateriasPrimas } from "@/lib/materias-primas-api";
import { getProcesos } from "@/lib/procesos-api";
import {
  getAdicionalesCatalogo,
  getFamiliasProducto,
  getMotoresCostoCatalogo,
  getProductoAdicionales,
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
    const [producto, variantes, procesos, materiasPrimas, familias, subfamilias, motores, adicionalesCatalogo, adicionalesProducto] = await Promise.all([
      getProductoServicio(productoId),
      getProductoVariantes(productoId),
      getProcesos(),
      getMateriasPrimas(),
      getFamiliasProducto(),
      getSubfamiliasProducto(),
      getMotoresCostoCatalogo(),
      getAdicionalesCatalogo(),
      getProductoAdicionales(productoId),
    ]);

    return (
      <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <ProductoServicioFichaTabs
          producto={producto}
          initialVariantes={variantes}
          procesos={procesos}
          materiasPrimas={materiasPrimas}
          familias={familias}
          subfamilias={subfamilias}
          motores={motores}
          adicionalesCatalogo={adicionalesCatalogo}
          adicionalesProducto={adicionalesProducto}
        />
      </section>
    );
  } catch {
    notFound();
  }
}
