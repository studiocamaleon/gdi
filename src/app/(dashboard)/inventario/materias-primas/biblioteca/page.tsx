import { puedeConfigurar, tieneCapacidad } from "@/lib/capacidades-server";
import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { SinPermiso } from "@/components/navigation/sin-permiso";
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
  if (!(await tieneCapacidad("materiales"))) return <FuncionNoIncluida />;
  if (!(await puedeConfigurar("materiales", "inventario.gestionar")))
    return <SinPermiso modulo="Materiales" />;
  const items = await getBibliotecaMateriasPrimas();

  return <BibliotecaMateriasPrimasView initialItems={items} />;
}
