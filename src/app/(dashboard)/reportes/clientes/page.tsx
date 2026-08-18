import { TabClientes, MetaPie } from "@/components/panel/panel-general";
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
  const parametros = await searchParams;
  const d = await getPanelClientes(rangoDeParametros(parametros, await zonaHorariaDelTenant()));
  return (
    <>
      <TabClientes d={d} />
      <MetaPie meta={d.meta} />
    </>
  );
}
