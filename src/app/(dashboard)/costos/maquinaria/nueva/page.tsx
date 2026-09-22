import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { puedeConfigurar, tieneCapacidad } from "@/lib/capacidades-server";
import dynamicImport from "next/dynamic";
import { Suspense } from "react";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { getPlantas } from "@/lib/costos-api";
import { getMaquinasPage } from "@/lib/maquinaria-api";

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
  if (!(await tieneCapacidad("maquinaria"))) return <FuncionNoIncluida />;
  const [maquinasPage, plantas, puedeGestionar] = await Promise.all([
    getMaquinasPage({ limit: 50 }),
    getPlantas(),
    puedeConfigurar("maquinaria", "costos.gestionar"),
  ]);

  return (
    <MaquinariaPanel
      initialPage={maquinasPage}
      plantas={plantas}
      puedeGestionar={puedeGestionar}
      initialFilters={{}}
      initialCreate={puedeGestionar}
    />
  );
}
