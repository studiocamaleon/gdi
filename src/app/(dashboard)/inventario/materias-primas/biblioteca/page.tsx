import { Suspense } from "react";
import { DesignSystemProvider } from "@/components/design-system/appearance";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { BibliotecaMateriasPrimasView } from "@/components/inventario/biblioteca-materias-primas-view";
import { getBibliotecaMateriasPrimas } from "@/lib/materias-primas-api";

export const dynamic = "force-dynamic";

export default function BibliotecaMateriasPrimasPage() {
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <Suspense fallback={<ModulePageSkeleton variant="workspace" />}>
        <BibliotecaMateriasPrimasPageContent />
      </Suspense>
    </DesignSystemProvider>
  );
}

async function BibliotecaMateriasPrimasPageContent() {
  const items = await getBibliotecaMateriasPrimas();

  return <BibliotecaMateriasPrimasView initialItems={items} />;
}
