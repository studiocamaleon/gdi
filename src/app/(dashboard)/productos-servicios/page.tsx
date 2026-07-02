import { Suspense } from "react";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { ProductosServiciosTable } from "@/components/productos-servicios/productos-table";
import { listProductos } from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default function ProductosServiciosPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="table" />}>
      <ProductosServiciosPageContent />
    </Suspense>
  );
}

async function ProductosServiciosPageContent() {
  const res = await listProductos({ page: 1, limit: PAGE_SIZE });
  return (
    <ProductosServiciosTable
      initialProductos={res.data}
      initialTotal={res.total}
      initialPages={res.pages}
      pageSize={PAGE_SIZE}
    />
  );
}
