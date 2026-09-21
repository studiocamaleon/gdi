import { tieneCapacidad } from "@/lib/capacidades-server";
import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { ReporteEmbudo } from "@/components/panel/reporte-embudo";
import { getPanelEmbudo } from "@/lib/panel-api";
import { zonaHorariaDelTenant } from "@/lib/auth-server";
import { rangoDeParametros, type ParametrosPeriodo } from "@/lib/panel-periodo";

export const dynamic = "force-dynamic";

/** Embudo: cuánto de lo cotizado llega a entregarse, y dónde se cae. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ParametrosPeriodo>;
}) {
  if (!(await tieneCapacidad("reportes_resumen"))) return <FuncionNoIncluida />;
  const parametros = await searchParams;
  const d = await getPanelEmbudo(
    rangoDeParametros(parametros, await zonaHorariaDelTenant()),
  );
  return <ReporteEmbudo d={d} />;
}
