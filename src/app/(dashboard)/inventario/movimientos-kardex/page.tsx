import { MovimientosKardexPanel } from "@/components/inventario/movimientos-kardex-panel";
import { getMateriasPrimas } from "@/lib/materias-primas-api";

export const dynamic = "force-dynamic";

export default async function MovimientosKardexPage() {
  const materiasPrimas = await getMateriasPrimas();

  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <MovimientosKardexPanel materiasPrimas={materiasPrimas} />
    </section>
  );
}
