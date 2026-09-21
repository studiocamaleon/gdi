import { tieneCapacidad } from "@/lib/capacidades-server";
import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { ReporteProducto } from "@/components/panel/reporte-producto";
import { getPanelProducto } from "@/lib/panel-api";
import { zonaHorariaDelTenant } from "@/lib/auth-server";
import { rangoDeParametros, type ParametrosPeriodo } from "@/lib/panel-periodo";

export const dynamic = "force-dynamic";

/**
 * Ventas & Producto: margen por categoría y producto, adicionales, consumo de
 * papel y tintas, y qué medidas se venden.
 *
 * Es el único que además recibe el `rango`: el drill por categoría lo vuelve a
 * pedir al API desde el cliente.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ParametrosPeriodo>;
}) {
  if (!(await tieneCapacidad("reportes_comerciales")))
    return <FuncionNoIncluida />;
  const parametros = await searchParams;
  const rango = rangoDeParametros(parametros, await zonaHorariaDelTenant());
  const d = await getPanelProducto(rango);
  return <ReporteProducto d={d} rango={rango} />;
}
