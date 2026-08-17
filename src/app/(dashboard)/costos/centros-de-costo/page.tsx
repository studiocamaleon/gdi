import { Suspense } from "react";

import { getCentrosCosto } from "@/lib/costos-api";
import { CostosPanel } from "@/components/costos/costos-panel";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { tienePermiso } from "@/lib/permisos-server";

export const dynamic = "force-dynamic";

export default function CentrosDeCostoPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="workspace" />}>
      <CentrosDeCostoPageContent />
    </Suspense>
  );
}

async function CentrosDeCostoPageContent() {
  const [centros, puedeGestionar] = await Promise.all([
    getCentrosCosto(),
    tienePermiso("costos.gestionar"),
  ]);

  return (
    <CostosPanel initialCentros={centros} puedeGestionar={puedeGestionar} />
  );
}
