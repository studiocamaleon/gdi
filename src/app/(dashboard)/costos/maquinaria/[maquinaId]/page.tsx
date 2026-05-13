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

export default function MaquinariaDetallePage({
  params,
}: {
  params: Promise<{ maquinaId: string }>;
}) {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="workspace" />}>
      <MaquinariaDetalleContent params={params} />
    </Suspense>
  );
}

async function MaquinariaDetalleContent({
  params,
}: {
  params: Promise<{ maquinaId: string }>;
}) {
  const { maquinaId } = await params;
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
      initialEditingId={maquinaId}
    />
  );
}
