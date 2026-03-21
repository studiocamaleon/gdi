import { Suspense } from "react";

import { ClientesTable } from "@/components/clientes/clientes-table";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { getClientes } from "@/lib/clientes-api";

export const dynamic = "force-dynamic";

export default function ClientesPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="table" />}>
      <ClientesPageContent />
    </Suspense>
  );
}

async function ClientesPageContent() {
  const clientes = await getClientes();

  return <ClientesTable initialClientes={clientes} />;
}
