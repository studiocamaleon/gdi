import { TabClientes, MetaPie } from "@/components/panel/panel-general";
import { getPanelClientes } from "@/lib/panel-api";
import { zonaHorariaDelTenant } from "@/lib/auth-server";
import { leerPeriodo, rangoDe } from "@/lib/panel-periodo";

export const dynamic = "force-dynamic";

/** Clientes: concentración, recurrencia, dormidos y margen por cliente. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo } = await searchParams;
  const d = await getPanelClientes(rangoDe(leerPeriodo(periodo), await zonaHorariaDelTenant()));
  return (
    <>
      <TabClientes d={d as never} />
      <MetaPie meta={d.meta} />
    </>
  );
}
