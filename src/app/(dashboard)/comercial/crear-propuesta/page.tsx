import { Suspense } from "react";

import { getClientes } from "@/lib/clientes-api";
import { PropuestaFicha } from "@/components/comercial/propuesta-ficha";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";

export const dynamic = "force-dynamic";

export default function CrearPropuestaPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="workspace" />}>
      <CrearPropuestaContent />
    </Suspense>
  );
}

async function CrearPropuestaContent() {
  const clientes = await getClientes();
  return <PropuestaFicha initialClientes={clientes} />;
}
