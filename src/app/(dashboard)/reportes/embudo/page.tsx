import { TabEmbudo, MetaPie } from "@/components/panel/panel-general";
import { getPanelEmbudo } from "@/lib/panel-api";
import { zonaHorariaDelTenant } from "@/lib/auth-server";
import { leerPeriodo, rangoDe } from "@/lib/panel-periodo";

export const dynamic = "force-dynamic";

/** Embudo: cuánto de lo cotizado llega a entregarse, y dónde se cae. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo } = await searchParams;
  const d = await getPanelEmbudo(rangoDe(leerPeriodo(periodo), await zonaHorariaDelTenant()));
  return (
    <>
      <TabEmbudo d={d as never} />
      <MetaPie meta={d.meta} />
    </>
  );
}
