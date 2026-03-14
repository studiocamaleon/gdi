import { getAreasCosto, getCentrosCosto, getPlantas } from "@/lib/costos-api";
import { getEmpleados } from "@/lib/empleados-api";
import { CostosPanel } from "@/components/costos/costos-panel";

export const dynamic = "force-dynamic";

export default async function CentrosDeCostoPage() {
  const [plantas, areas, centros, empleados] = await Promise.all([
    getPlantas(),
    getAreasCosto(),
    getCentrosCosto(),
    getEmpleados(),
  ]);

  return (
    <CostosPanel
      initialPlantas={plantas}
      initialAreas={areas}
      initialCentros={centros}
      empleados={empleados}
    />
  );
}
