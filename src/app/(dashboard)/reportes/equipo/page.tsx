import { tieneCapacidad } from "@/lib/capacidades-server";
import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { ReporteEquipo } from "@/components/panel/reporte-equipo";
import { getPanelEquipo } from "@/lib/panel-api";
import { zonaHorariaDelTenant } from "@/lib/auth-server";
import { rangoDeParametros, type ParametrosPeriodo } from "@/lib/panel-periodo";

export const dynamic = "force-dynamic";

/** Equipo: trabajo cronometrado por persona, disciplina de marcado y vendedores. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ParametrosPeriodo>;
}) {
  if (!(await tieneCapacidad("reportes_produccion")))
    return <FuncionNoIncluida />;
  const parametros = await searchParams;
  const d = await getPanelEquipo(
    rangoDeParametros(parametros, await zonaHorariaDelTenant()),
  );
  return <ReporteEquipo d={d} />;
}
