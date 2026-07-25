import { MetaPie, TabProducto } from "@/components/panel/panel-general";
import { getPanelProducto } from "@/lib/panel-api";
import { leerPeriodo, rangoDe } from "@/lib/panel-periodo";

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
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { periodo } = await searchParams;
  const rango = rangoDe(leerPeriodo(periodo));
  const d = await getPanelProducto(rango);
  return (
    <>
      <TabProducto d={d as never} rango={rango} />
      <MetaPie meta={d.meta} />
    </>
  );
}
