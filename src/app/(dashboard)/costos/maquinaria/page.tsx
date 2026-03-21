import dynamicImport from "next/dynamic";
import { Suspense } from "react";

import { getCentrosCosto, getPlantas } from "@/lib/costos-api";
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
  const [maquinas, plantas, centrosCosto] = await Promise.all([
    getMaquinas(),
    getPlantas(),
    getCentrosCosto(),
  ]);

  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <MaquinariaPanel
        initialMaquinas={maquinas}
        plantas={plantas}
        centrosCosto={centrosCosto}
      />
    </section>
  );
}
