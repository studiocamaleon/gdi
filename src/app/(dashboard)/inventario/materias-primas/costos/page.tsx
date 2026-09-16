import { Suspense } from "react";
import { DesignSystemProvider } from "@/components/design-system/appearance";

import { getMateriasPrimas } from "@/lib/materias-primas-api";
import { CostosMaterialesEditor } from "@/components/inventario/costos-materiales-editor";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";

export const dynamic = "force-dynamic";

export default function CostosMaterialesPage() {
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <Suspense fallback={<ModulePageSkeleton variant="workspace" />}>
        <CostosMaterialesPageContent />
      </Suspense>
    </DesignSystemProvider>
  );
}

async function CostosMaterialesPageContent() {
  const materiasPrimas = await getMateriasPrimas();

  return <CostosMaterialesEditor initialMateriasPrimas={materiasPrimas} />;
}
