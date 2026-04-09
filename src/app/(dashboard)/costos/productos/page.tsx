import { Suspense } from "react";

import { ProductosServiciosTable } from '@/components/productos-servicios/productos-servicios-table';
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import {
  getFamiliasProducto,
  getMotoresCostoCatalogo,
  getProductosServicios,
  getSubfamiliasProducto,
} from '@/lib/productos-servicios-api';

export const dynamic = 'force-dynamic';

export default function ProductosServiciosPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="table" />}>
      <ProductosServiciosPageContent />
    </Suspense>
  );
}

async function ProductosServiciosPageContent() {
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
