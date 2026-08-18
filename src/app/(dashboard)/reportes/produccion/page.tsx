import { TabProduccion, MetaPie } from "@/components/panel/panel-general";
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
  const parametros = await searchParams;
  const d = await getPanelProduccion(rangoDeParametros(parametros, await zonaHorariaDelTenant()));
  return (
    <>
      <TabProduccion d={d} />
      <MetaPie meta={d.meta} />
    </>
  );
}
