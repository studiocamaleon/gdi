import { notFound } from "next/navigation";
import dynamicImport from "next/dynamic";
import { Suspense } from "react";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { getCentrosCosto, getPlantas } from "@/lib/costos-api";
import { getMaquina, getMaquinaHistorial } from "@/lib/maquinaria-api";
import { tienePermiso } from "@/lib/permisos-server";
import { ApiError } from "@/lib/api";

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
  const [maquina, historial, plantas, centrosCosto, puedeGestionar] =
    await Promise.all([
      getMaquina(maquinaId).catch((error) => {
        if (error instanceof ApiError && error.status === 404) notFound();
        throw error;
      }),
      getMaquinaHistorial(maquinaId).catch((error) => {
        if (error instanceof ApiError && error.status === 404) notFound();
        throw error;
      }),
      getPlantas(),
      getCentrosCosto(),
      tienePermiso("costos.gestionar"),
    ]);

  return (
    <MaquinaFicha
      maquina={maquina}
      historial={historial}
      plantas={plantas}
      centrosCosto={centrosCosto}
      puedeGestionar={puedeGestionar}
    />
  );
}
