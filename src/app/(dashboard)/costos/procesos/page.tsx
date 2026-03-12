import { getCentrosCosto } from "@/lib/costos-api";
import { getMaquinas } from "@/lib/maquinaria-api";
import { getProcesoOperacionPlantillas, getProcesos } from "@/lib/procesos-api";
import { ProcesosPanel } from "@/components/costos/procesos-panel";

export const dynamic = "force-dynamic";

export default async function ProcesosPage() {
  const [procesos, centrosCosto, maquinas] = await Promise.all([
    getProcesos(),
    getCentrosCosto(),
    getMaquinas(),
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
        initialBibliotecaOperaciones={bibliotecaOperaciones}
      />
    </section>
  );
}
