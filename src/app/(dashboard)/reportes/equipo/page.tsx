import { TabEquipo, MetaPie } from "@/components/panel/panel-general";
import { getPanelEquipo } from "@/lib/panel-api";
import { zonaHorariaDelTenant } from "@/lib/auth-server";
import { rangoDeParametros, type ParametrosPeriodo } from "@/lib/panel-periodo";

export const dynamic = "force-dynamic";

/** Equipo: trabajo cronometrado por persona, disciplina de marcado y vendedores. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ParametrosPeriodo>;
}) {
  const parametros = await searchParams;
  const d = await getPanelEquipo(rangoDeParametros(parametros, await zonaHorariaDelTenant()));
  return (
    <>
      <TabEquipo d={d} />
      <MetaPie meta={d.meta} />
    </>
  );
}
