import { getMateriasPrimas } from "@/lib/materias-primas-api";
import { MateriasPrimasPanel } from "@/components/inventario/materias-primas-panel";

export const dynamic = "force-dynamic";

export default async function MateriasPrimasPage() {
  const materiasPrimas = await getMateriasPrimas();

  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <MateriasPrimasPanel initialMateriasPrimas={materiasPrimas} />
    </section>
  );
}
