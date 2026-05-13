import dynamicImport from "next/dynamic";
import { Suspense } from "react";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { getCentrosCosto, getPlantas } from "@/lib/costos-api";
import { getMaquinas } from "@/lib/maquinaria-api";

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

export default function NuevaMaquinariaPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="workspace" />}>
      <NuevaMaquinariaContent />
    </Suspense>
  );
}

async function NuevaMaquinariaContent() {
  const [maquinas, plantas, centrosCosto] = await Promise.all([
    getMaquinas(),
    getPlantas(),
    getCentrosCosto(),
  ]);

  return (
    <MaquinariaPanel
      initialMaquinas={maquinas}
      plantas={plantas}
      centrosCosto={centrosCosto}
      initialCreate
    />
  );
}
