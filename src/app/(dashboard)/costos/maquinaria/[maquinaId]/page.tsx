import { notFound } from "next/navigation";
import dynamicImport from "next/dynamic";
import { Suspense } from "react";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { getCentrosCosto, getPlantas } from "@/lib/costos-api";
import { getMaquina } from "@/lib/maquinaria-api";

const MaquinaFicha = dynamicImport(
  () =>
    import("@/components/costos/maquina-ficha").then(
      (module) => module.MaquinaFicha,
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
  const [maquina, plantas, centrosCosto] = await Promise.all([
    getMaquina(maquinaId).catch(() => null),
    getPlantas(),
    getCentrosCosto(),
  ]);

  if (!maquina) notFound();

  return (
    <MaquinaFicha
      maquina={maquina}
      plantas={plantas}
      centrosCosto={centrosCosto}
    />
  );
}
