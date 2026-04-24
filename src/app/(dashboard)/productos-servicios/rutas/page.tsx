import { Suspense } from "react";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { RutasTable } from "@/components/productos-servicios/rutas-table";
import { getRutas } from "@/lib/productos-servicios-api";

export const dynamic = "force-dynamic";

export default function RutasPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="table" />}>
      <RutasPageContent />
    </Suspense>
  );
}

async function RutasPageContent() {
  const rutas = await getRutas();
  return <RutasTable initialRutas={rutas} />;
}
