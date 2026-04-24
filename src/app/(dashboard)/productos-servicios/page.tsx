import { Suspense } from "react";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { ProductosServiciosTable } from "@/components/productos-servicios/productos-table";
import { getProductos } from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default function ProductosServiciosPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="table" />}>
      <ProductosServiciosPageContent />
    </Suspense>
  );
}

async function ProductosServiciosPageContent() {
  const productos = await getProductos();
  return <ProductosServiciosTable initialProductos={productos} />;
}
