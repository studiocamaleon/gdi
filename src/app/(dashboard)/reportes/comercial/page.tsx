import { tieneCapacidad } from "@/lib/capacidades-server";
import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { ReporteComercial } from "@/components/panel/reporte-comercial";
import { getPanelComercial } from "@/lib/panel-api";
import { zonaHorariaDelTenant } from "@/lib/auth-server";
import { rangoDeParametros, type ParametrosPeriodo } from "@/lib/panel-periodo";

export const dynamic = "force-dynamic";

/** Comercial: ventas del período, ticket, mix y clientes dormidos. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ParametrosPeriodo>;
}) {
  if (!(await tieneCapacidad("reportes_resumen"))) return <FuncionNoIncluida />;
  const parametros = await searchParams;
  const d = await getPanelComercial(
    rangoDeParametros(parametros, await zonaHorariaDelTenant()),
  );
  return <ReporteComercial d={d} />;
}
