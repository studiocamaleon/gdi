import { Suspense } from "react";

import { getMateriasPrimas } from "@/lib/materias-primas-api";
import { CostosMaterialesEditor } from "@/components/inventario/costos-materiales-editor";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";

export const dynamic = "force-dynamic";

export default function CostosMaterialesPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="workspace" />}>
      <CostosMaterialesPageContent />
    </Suspense>
  );
}

async function CostosMaterialesPageContent() {
  const materiasPrimas = await getMateriasPrimas();

  return (
    <section className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <CostosMaterialesEditor initialMateriasPrimas={materiasPrimas} />
    </section>
  );
}
