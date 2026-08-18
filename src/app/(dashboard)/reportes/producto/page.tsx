import { MetaPie, TabProducto } from "@/components/panel/panel-general";
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
  const parametros = await searchParams;
  const rango = rangoDeParametros(parametros, await zonaHorariaDelTenant());
  const d = await getPanelProducto(rango);
  return (
    <>
      <TabProducto d={d} rango={rango} />
      <MetaPie meta={d.meta} />
    </>
  );
}
