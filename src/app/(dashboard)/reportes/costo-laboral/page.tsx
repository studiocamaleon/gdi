import { MetaPie, TabCostoLaboral } from "@/components/panel/panel-general";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { getPanelCostoLaboral } from "@/lib/panel-api";
import { leerPeriodo, rangoDe } from "@/lib/panel-periodo";
import { tienePermiso } from "@/lib/permisos-server";

export const dynamic = "force-dynamic";

/**
 * Costo laboral: qué cuesta cada persona y a dónde va ese costo.
 *
 * Pide el permiso de remuneraciones y no el del módulo, porque muestra
 * sueldos: quien lee los reportes del negocio no necesariamente puede ver lo
 * que gana cada compañero.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  if (!(await tienePermiso("registros.ver_remuneraciones"))) {
    return <SinPermiso modulo="el costo laboral" />;
  }

  const { periodo } = await searchParams;
  const d = await getPanelCostoLaboral(rangoDe(leerPeriodo(periodo)));
  return (
    <>
      <TabCostoLaboral d={d as never} />
      <MetaPie meta={d.meta} />
    </>
  );
}
