import { ProductosServiciosFamiliasManager } from "@/components/productos-servicios/productos-servicios-familias-manager";
import { getFamiliasProducto, getProductosServicios, getSubfamiliasProducto } from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default async function ProductosServiciosFamiliasPage() {
  const [familias, subfamilias, productos] = await Promise.all([
    getFamiliasProducto(),
    getSubfamiliasProducto(),
    getProductosServicios(),
  ]);

  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <ProductosServiciosFamiliasManager
        initialFamilias={familias}
        initialSubfamilias={subfamilias}
        initialProductos={productos}
      />
    </section>
  );
}
