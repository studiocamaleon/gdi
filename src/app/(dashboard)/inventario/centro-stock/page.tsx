import { Suspense } from "react";
import { DesignSystemProvider } from "@/components/design-system/appearance";

import { CentroStockPanel } from "@/components/inventario/centro-stock-panel";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { getAlmacenes } from "@/lib/inventario-stock-api";
import { getMateriasPrimas } from "@/lib/materias-primas-api";

export const dynamic = "force-dynamic";

export default function CentroStockPage() {
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <Suspense fallback={<ModulePageSkeleton variant="workspace" />}>
        <CentroStockPageContent />
      </Suspense>
    </DesignSystemProvider>
  );
}

async function CentroStockPageContent() {
  const [almacenes, materiasPrimas] = await Promise.all([
    getAlmacenes(),
    getMateriasPrimas(),
  ]);

  return (
    <CentroStockPanel
      initialAlmacenes={almacenes}
      materiasPrimas={materiasPrimas}
    />
  );
}
