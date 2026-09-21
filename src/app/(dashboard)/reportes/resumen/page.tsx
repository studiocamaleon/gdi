import { tieneCapacidad } from "@/lib/capacidades-server";
import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { ResumenEjecutivo } from "@/components/panel/resumen-ejecutivo";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { getPanelResumen } from "@/lib/panel-api";
import { zonaHorariaDelTenant } from "@/lib/auth-server";
import { rangoDeParametros, type ParametrosPeriodo } from "@/lib/panel-periodo";
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
  searchParams: Promise<ParametrosPeriodo>;
}) {
  if (!(await tieneCapacidad("reportes_resumen"))) return <FuncionNoIncluida />;
  if (!(await tienePermiso("reportes.ver_resumen"))) {
    return <SinPermiso modulo="el Resumen ejecutivo" />;
  }

  const parametros = await searchParams;
  const d = await getPanelResumen(
    rangoDeParametros(parametros, await zonaHorariaDelTenant()),
  );
  return (
    <>
      <ResumenEjecutivo d={d} />
    </>
  );
}
