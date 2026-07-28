import dynamicImport from "next/dynamic";
import { Suspense } from "react";

import { getPlantas } from "@/lib/costos-api";
import { getMaquinas } from "@/lib/maquinaria-api";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";

const MaquinariaPanel = dynamicImport(
  () =>
    import("@/components/costos/maquinaria-panel").then(
      (module) => module.MaquinariaPanel,
    ),
  {
    loading: () => <ModulePageSkeleton variant="workspace" />,
  },
);

export const dynamic = "force-dynamic";

export default function MaquinariaPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="workspace" />}>
      <MaquinariaPageContent />
    </Suspense>
  );
}

async function MaquinariaPageContent() {
  const [maquinas, plantas] = await Promise.all([
    getMaquinas(),
    getPlantas(),
  ]);

  return (
    <MaquinariaPanel
      initialMaquinas={maquinas}
      plantas={plantas}
    />
  );
}
