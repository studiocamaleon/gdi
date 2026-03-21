import { Suspense } from "react";

import { getAreasCosto, getCentrosCosto, getPlantas } from "@/lib/costos-api";
import { getEmpleados } from "@/lib/empleados-api";
import { CostosPanel } from "@/components/costos/costos-panel";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";

export const dynamic = "force-dynamic";

export default function CentrosDeCostoPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="workspace" />}>
      <CentrosDeCostoPageContent />
    </Suspense>
  );
}

async function CentrosDeCostoPageContent() {
  const [plantas, areas, centros, empleados] = await Promise.all([
    getPlantas(),
    getAreasCosto(),
    getCentrosCosto(),
    getEmpleados(),
  ]);

  return (
    <CostosPanel
      initialPlantas={plantas}
      initialAreas={areas}
      initialCentros={centros}
      empleados={empleados}
    />
  );
}
