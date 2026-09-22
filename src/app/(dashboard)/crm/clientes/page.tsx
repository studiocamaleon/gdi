import { puedeConfigurar } from "@/lib/capacidades-server";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import { Suspense } from "react";
import { ClientesTable } from "@/components/clientes/clientes-table";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { listClientes } from "@/lib/clientes-api";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="table" />}>
      <Content />
    </Suspense>
  );
}
async function Content() {
  const [response, canManage] = await Promise.all([
    listClientes({ page: 1, limit: 25 }),
    puedeConfigurar("clientes", "crm.gestionar"),
  ]);
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <ClientesTable initialResponse={response} canManage={canManage} />
    </DesignSystemProvider>
  );
}
