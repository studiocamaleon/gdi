import { TabComercial, MetaPie } from "@/components/panel/panel-general";
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
  const parametros = await searchParams;
  const d = await getPanelComercial(rangoDeParametros(parametros, await zonaHorariaDelTenant()));
  return (
    <>
      <TabComercial d={d} />
      <MetaPie meta={d.meta} />
    </>
  );
}
