import { ProductosServiciosTable } from '@/components/productos-servicios/productos-servicios-table';
import {
  getFamiliasProducto,
  getMotoresCostoCatalogo,
  getProductosServicios,
  getSubfamiliasProducto,
} from '@/lib/productos-servicios-api';

export const dynamic = 'force-dynamic';

export default async function ProductosServiciosPage() {
  const [
    productos,
    familias,
    subfamilias,
    motores,
  ] = await Promise.all([
    getProductosServicios(),
    getFamiliasProducto(),
    getSubfamiliasProducto(),
    getMotoresCostoCatalogo(),
  ]);

  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <ProductosServiciosTable
        initialProductos={productos}
        familias={familias}
        subfamilias={subfamilias}
        motores={motores}
      />
    </section>
  );
}
