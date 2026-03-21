import { Suspense } from "react";

import { CentroStockPanel } from "@/components/inventario/centro-stock-panel";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { getAlmacenes, getStockActual } from "@/lib/inventario-stock-api";
import { getMateriasPrimas } from "@/lib/materias-primas-api";

export const dynamic = "force-dynamic";

export default function CentroStockPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="workspace" />}>
      <CentroStockPageContent />
    </Suspense>
  );
}

async function CentroStockPageContent() {
  const [almacenes, stock, materiasPrimas] = await Promise.all([
    getAlmacenes(),
    getStockActual(),
    getMateriasPrimas(),
  ]);

  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <CentroStockPanel
        initialAlmacenes={almacenes}
        initialStock={stock}
        materiasPrimas={materiasPrimas}
      />
    </section>
  );
}
