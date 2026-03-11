import { getAreasCosto, getCentrosCosto, getPlantas } from "@/lib/costos-api";
import { getEmpleados } from "@/lib/empleados-api";
import { getProveedores } from "@/lib/proveedores-api";
import { CostosPanel } from "@/components/costos/costos-panel";

export const dynamic = "force-dynamic";

export default async function CentrosDeCostoPage() {
  const [plantas, areas, centros, empleados, proveedores] = await Promise.all([
    getPlantas(),
    getAreasCosto(),
    getCentrosCosto(),
    getEmpleados(),
    getProveedores(),
  ]);

  return (
    <CostosPanel
      initialPlantas={plantas}
      initialAreas={areas}
      initialCentros={centros}
      empleados={empleados}
      proveedores={proveedores}
    />
  );
}
