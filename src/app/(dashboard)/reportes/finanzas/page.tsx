import { MetaPie, TabFinanzas } from "@/components/panel/panel-general";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { getPanelFinanzas } from "@/lib/panel-api";
import { zonaHorariaDelTenant } from "@/lib/auth-server";
import { leerPeriodo, rangoDe } from "@/lib/panel-periodo";
import { tienePermiso } from "@/lib/permisos-server";

export const dynamic = "force-dynamic";

/**
 * Finanzas: rentabilidad pura — facturado contra costo, contribución, punto de
 * equilibrio y cobranza.
 *
 * Acá el margen no viaja de arrastre, ES el contenido: podarlo dejaría una
 * pantalla de cascarones vacíos, así que el permiso decide la puerta.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  if (!(await tienePermiso("finanzas.ver_margenes"))) {
    return <SinPermiso modulo="Finanzas" />;
  }

  const { periodo } = await searchParams;
  const d = await getPanelFinanzas(rangoDe(leerPeriodo(periodo), await zonaHorariaDelTenant()));
  return (
    <>
      <TabFinanzas d={d as never} />
      <MetaPie meta={d.meta} />
    </>
  );
}
