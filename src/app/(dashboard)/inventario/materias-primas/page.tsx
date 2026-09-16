import { Suspense } from "react";
import { DesignSystemProvider } from "@/components/design-system/appearance";

import { getMateriasPrimas } from "@/lib/materias-primas-api";
import { MateriasPrimasPanel } from "@/components/inventario/materias-primas-panel";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";

export const dynamic = "force-dynamic";

export default function MateriasPrimasPage() {
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <Suspense fallback={<ModulePageSkeleton variant="workspace" />}>
        <MateriasPrimasPageContent />
      </Suspense>
    </DesignSystemProvider>
  );
}

async function MateriasPrimasPageContent() {
  const materiasPrimas = await getMateriasPrimas();

  return <MateriasPrimasPanel initialMateriasPrimas={materiasPrimas} />;
}
