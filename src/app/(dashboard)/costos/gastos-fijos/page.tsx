import { Suspense } from "react";

import { getGastosFijos } from "@/lib/gastos-fijos-api";
import { GastosFijosPanel } from "@/components/costos/gastos-fijos-panel";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";

export const dynamic = "force-dynamic";

export default function GastosFijosPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="workspace" />}>
      <GastosFijosPageContent />
    </Suspense>
  );
}

async function GastosFijosPageContent() {
  const gastos = await getGastosFijos();
  return <GastosFijosPanel initialGastos={gastos} />;
}
