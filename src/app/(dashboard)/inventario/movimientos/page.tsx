import { Suspense } from "react";
import { DesignSystemProvider } from "@/components/design-system/appearance";

import { MovimientosKardexPanel } from "@/components/inventario/movimientos-kardex-panel";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { getAlmacenes } from "@/lib/inventario-stock-api";
import { getMateriasPrimas } from "@/lib/materias-primas-api";

export const dynamic = "force-dynamic";

export default function MovimientosKardexPage() {
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <Suspense fallback={<ModulePageSkeleton variant="workspace" />}>
        <MovimientosKardexPageContent />
      </Suspense>
    </DesignSystemProvider>
  );
}

async function MovimientosKardexPageContent() {
  const [materiasPrimas, almacenes] = await Promise.all([
    getMateriasPrimas(),
    getAlmacenes(),
  ]);

  return (
    <MovimientosKardexPanel
      materiasPrimas={materiasPrimas}
      almacenes={almacenes}
    />
  );
}
