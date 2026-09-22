import { puedeConfigurar } from "@/lib/capacidades-server";
import { Suspense } from "react";

import { getCentrosCosto } from "@/lib/costos-api";
import { CostosPanel } from "@/components/costos/costos-panel";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { DesignSystemProvider } from "@/components/design-system/appearance";

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
    puedeConfigurar("centros_costo", "costos.gestionar"),
  ]);

  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <CostosPanel initialCentros={centros} puedeGestionar={puedeGestionar} />
    </DesignSystemProvider>
  );
}
