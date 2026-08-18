import { TabEmbudo, MetaPie } from "@/components/panel/panel-general";
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
  const parametros = await searchParams;
  const d = await getPanelEmbudo(rangoDeParametros(parametros, await zonaHorariaDelTenant()));
  return (
    <>
      <TabEmbudo d={d} />
      <MetaPie meta={d.meta} />
    </>
  );
}
