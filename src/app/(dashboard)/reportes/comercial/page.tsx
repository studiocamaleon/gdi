import { TabComercial, MetaPie } from "@/components/panel/panel-general";
import { getPanelComercial } from "@/lib/panel-api";
import { zonaHorariaDelTenant } from "@/lib/auth-server";
import { leerPeriodo, rangoDe } from "@/lib/panel-periodo";

export const dynamic = "force-dynamic";

/** Comercial: ventas del período, ticket, mix y clientes dormidos. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo } = await searchParams;
  const d = await getPanelComercial(rangoDe(leerPeriodo(periodo), await zonaHorariaDelTenant()));
  return (
    <>
      <TabComercial d={d as never} />
      <MetaPie meta={d.meta} />
    </>
  );
}
