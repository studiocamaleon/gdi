import { CentroStockPanel } from "@/components/inventario/centro-stock-panel";
import { getAlmacenes, getStockActual } from "@/lib/inventario-stock-api";
import { getMateriasPrimas } from "@/lib/materias-primas-api";

export const dynamic = "force-dynamic";

export default async function CentroStockPage() {
  const [almacenes, stock, materiasPrimas] = await Promise.all([
    getAlmacenes(),
    getStockActual(),
    getMateriasPrimas(),
  ]);

  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <CentroStockPanel
        initialAlmacenes={almacenes}
        initialStock={stock}
        materiasPrimas={materiasPrimas}
      />
    </section>
  );
}
