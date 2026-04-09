import { Suspense } from "react";

import { MovimientosKardexPanel } from "@/components/inventario/movimientos-kardex-panel";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { getMateriasPrimas } from "@/lib/materias-primas-api";

export const dynamic = "force-dynamic";

export default function MovimientosKardexPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="workspace" />}>
      <MovimientosKardexPageContent />
    </Suspense>
  );
}

async function MovimientosKardexPageContent() {
  const materiasPrimas = await getMateriasPrimas();

  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <MovimientosKardexPanel materiasPrimas={materiasPrimas} />
    </section>
  );
}
