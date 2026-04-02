import { Suspense } from "react";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { getEstaciones } from "@/lib/estaciones-api";
import { EstacionesPanel } from "@/components/produccion/estaciones-panel";

export const dynamic = "force-dynamic";

export default function EstacionesPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="table" />}>
      <EstacionesPageContent />
    </Suspense>
  );
}

async function EstacionesPageContent() {
  const estaciones = await getEstaciones();
  return <EstacionesPanel initialEstaciones={estaciones} />;
}
