import { PanelGeneral } from "@/components/panel/panel-general";
import { getPanelResumen } from "@/lib/panel-api";

export const dynamic = "force-dynamic";

/**
 * Panel general (Inteligencia de negocio) — la home del dashboard. Se
 * pre-carga el Resumen del mes en curso server-side para pintar rápido;
 * el cliente busca las demás tabs y períodos on demand.
 */
export default async function DashboardPage() {
  const resumen = await getPanelResumen();
  return <PanelGeneral initialResumen={resumen as never} />;
}
