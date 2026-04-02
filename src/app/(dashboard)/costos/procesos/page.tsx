import dynamicImport from "next/dynamic";
import { Suspense } from "react";

import { getCentrosCosto } from "@/lib/costos-api";
import { getEstaciones } from "@/lib/estaciones-api";
import { getMaquinas } from "@/lib/maquinaria-api";
import { getProcesoOperacionPlantillas, getProcesos } from "@/lib/procesos-api";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";

const ProcesosPanel = dynamicImport(
  () =>
    import("@/components/costos/procesos-panel").then(
      (module) => module.ProcesosPanel,
    ),
  {
    loading: () => <ModulePageSkeleton variant="workspace" />,
  },
);

export const dynamic = "force-dynamic";

export default function ProcesosPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="workspace" />}>
      <ProcesosPageContent />
    </Suspense>
  );
}

async function ProcesosPageContent() {
  const [procesos, centrosCosto, maquinas, estaciones] = await Promise.all([
    getProcesos(),
    getCentrosCosto(),
    getMaquinas(),
    getEstaciones(),
  ]);
  let bibliotecaOperaciones = [] as Awaited<
    ReturnType<typeof getProcesoOperacionPlantillas>
  >;

  try {
    bibliotecaOperaciones = await getProcesoOperacionPlantillas();
  } catch (error) {
    console.error("No se pudo cargar biblioteca de operaciones:", error);
  }

  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <ProcesosPanel
        initialProcesos={procesos}
        centrosCosto={centrosCosto}
        maquinas={maquinas}
        estaciones={estaciones}
        initialBibliotecaOperaciones={bibliotecaOperaciones}
      />
    </section>
  );
}
