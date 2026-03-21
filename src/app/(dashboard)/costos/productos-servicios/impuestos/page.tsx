import { ProductosServiciosImpuestosManager } from "@/components/productos-servicios/productos-servicios-impuestos-manager";
import { getProductoImpuestosCatalogo } from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default async function ProductosServiciosImpuestosPage() {
  const impuestos = await getProductoImpuestosCatalogo();

  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <ProductosServiciosImpuestosManager initialImpuestos={impuestos} />
    </section>
  );
}
