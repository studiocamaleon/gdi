import { tieneCapacidad } from "@/lib/capacidades-server";
import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { ReporteProduccion } from "@/components/panel/reporte-produccion";
import { getPanelProduccion } from "@/lib/panel-api";
import { zonaHorariaDelTenant } from "@/lib/auth-server";
import { rangoDeParametros, type ParametrosPeriodo } from "@/lib/panel-periodo";

export const dynamic = "force-dynamic";

/** Producción: OTD, precisión del estimado, utilización y bloqueos. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ParametrosPeriodo>;
}) {
  if (!(await tieneCapacidad("reportes_produccion")))
    return <FuncionNoIncluida />;
  const parametros = await searchParams;
  const d = await getPanelProduccion(
    rangoDeParametros(parametros, await zonaHorariaDelTenant()),
  );
  return <ReporteProduccion d={d} />;
}
