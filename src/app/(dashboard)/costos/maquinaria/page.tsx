import { getCentrosCosto, getPlantas } from "@/lib/costos-api";
import { getMaquinas } from "@/lib/maquinaria-api";
import { MaquinariaPanel } from "@/components/costos/maquinaria-panel";

export const dynamic = "force-dynamic";

export default async function MaquinariaPage() {
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
