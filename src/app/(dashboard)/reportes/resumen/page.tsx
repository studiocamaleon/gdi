import { MetaPie, TabResumen } from "@/components/panel/panel-general";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { getPanelResumen } from "@/lib/panel-api";
import { leerPeriodo, rangoDe } from "@/lib/panel-periodo";
import { tienePermiso } from "@/lib/permisos-server";

export const dynamic = "force-dynamic";

/**
 * Resumen ejecutivo: el negocio entero en una pantalla — facturación, margen,
 * punto de equilibrio y alertas.
 *
 * Es el único reporte con permiso propio: de fábrica lo tiene sólo el
 * Administrador. Sin él ni siquiera se pide al API, que devolvería 403.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  if (!(await tienePermiso("reportes.ver_resumen"))) {
    return <SinPermiso modulo="el Resumen ejecutivo" />;
  }

  const { periodo } = await searchParams;
  const d = await getPanelResumen(rangoDe(leerPeriodo(periodo)));
  return (
    <>
      <TabResumen d={d as never} />
      <MetaPie meta={d.meta} />
    </>
  );
}
