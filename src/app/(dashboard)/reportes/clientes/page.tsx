import { tieneCapacidad } from "@/lib/capacidades-server";
import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { ReporteClientes } from "@/components/panel/reporte-clientes";
import { getPanelClientes } from "@/lib/panel-api";
import { zonaHorariaDelTenant } from "@/lib/auth-server";
import { rangoDeParametros, type ParametrosPeriodo } from "@/lib/panel-periodo";

export const dynamic = "force-dynamic";

/** Clientes: concentración, recurrencia, dormidos y margen por cliente. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ParametrosPeriodo>;
}) {
  if (!(await tieneCapacidad("reportes_comerciales")))
    return <FuncionNoIncluida />;
  const parametros = await searchParams;
  const d = await getPanelClientes(
    rangoDeParametros(parametros, await zonaHorariaDelTenant()),
  );
  return <ReporteClientes d={d} />;
}
