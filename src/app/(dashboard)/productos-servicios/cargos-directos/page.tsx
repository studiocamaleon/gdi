import { Suspense } from "react";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { CargosDirectosManager } from "@/components/productos-servicios/cargos-directos-manager";
import { getCargosDirectosCatalogo } from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default function CargosDirectosPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="table" />}>
      <CargosDirectosPageContent />
    </Suspense>
  );
}

async function CargosDirectosPageContent() {
  const cargos = await getCargosDirectosCatalogo(false); // incluye inactivos
  return <CargosDirectosManager initialCargos={cargos} />;
}
