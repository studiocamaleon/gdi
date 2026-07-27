import { Suspense } from "react";

import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
import { getGastosFijos } from "@/lib/gastos-fijos-api";
import { GastosFijosPanel } from "@/components/costos/gastos-fijos-panel";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";

export const dynamic = "force-dynamic";

/**
 * Gastos fijos de estructura. Vivía en Costos; el porqué de la mudanza y del
 * permiso está en el controller del API.
 *
 * El gate va acá además del sidebar: esconder la entrada del menú no protege
 * nada si alguien pega la URL. El API igual lo frena, pero un `SinPermiso`
 * explica mejor que un error de fetch.
 */
export default async function GastosFijosPage() {
  if (!(await tienePermiso("administracion.configurar"))) {
    return <SinPermiso modulo="Gastos fijos" />;
  }
  return (
    <Suspense fallback={<ModulePageSkeleton variant="workspace" />}>
      <GastosFijosPageContent />
    </Suspense>
  );
}

async function GastosFijosPageContent() {
  const gastos = await getGastosFijos();
  return <GastosFijosPanel initialGastos={gastos} />;
}
