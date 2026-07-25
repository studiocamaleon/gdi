import { TabEquipo, MetaPie } from "@/components/panel/panel-general";
import { getPanelEquipo } from "@/lib/panel-api";
import { leerPeriodo, rangoDe } from "@/lib/panel-periodo";

export const dynamic = "force-dynamic";

/** Equipo: trabajo cronometrado por persona, disciplina de marcado y vendedores. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo } = await searchParams;
  const d = await getPanelEquipo(rangoDe(leerPeriodo(periodo)));
  return (
    <>
      <TabEquipo d={d as never} />
      <MetaPie meta={d.meta} />
    </>
  );
}
