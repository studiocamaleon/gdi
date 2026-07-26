import { TabProduccion, MetaPie } from "@/components/panel/panel-general";
import { getPanelProduccion } from "@/lib/panel-api";
import { zonaHorariaDelTenant } from "@/lib/auth-server";
import { leerPeriodo, rangoDe } from "@/lib/panel-periodo";

export const dynamic = "force-dynamic";

/** Producción: OTD, precisión del estimado, utilización y bloqueos. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo } = await searchParams;
  const d = await getPanelProduccion(rangoDe(leerPeriodo(periodo), await zonaHorariaDelTenant()));
  return (
    <>
      <TabProduccion d={d as never} />
      <MetaPie meta={d.meta} />
    </>
  );
}
