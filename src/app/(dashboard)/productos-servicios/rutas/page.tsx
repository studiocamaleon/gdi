import { puedeConfigurar } from "@/lib/capacidades-server";
import { Suspense } from "react";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { RutasTable } from "@/components/productos-servicios/rutas-table";
import { getRutas } from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default function RutasPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="table" />}>
      <RutasPageContent />
    </Suspense>
  );
}

async function RutasPageContent() {
  const [rutas, puedeGestionar] = await Promise.all([
    getRutas({ incluirInactivas: true }),
    puedeConfigurar("procesos", "costos.gestionar"),
  ]);
  return <RutasTable initialRutas={rutas} puedeGestionar={puedeGestionar} />;
}
