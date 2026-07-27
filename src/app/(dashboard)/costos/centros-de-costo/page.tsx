import { Suspense } from "react";

import { getCentrosCosto, getPlantas } from "@/lib/costos-api";
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
  const [plantas, centros] = await Promise.all([
    getPlantas(),
    getCentrosCosto(),
  ]);

  return (
    <CostosPanel
      initialPlantas={plantas}
      initialCentros={centros}
    />
  );
}
