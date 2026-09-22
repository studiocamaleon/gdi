import { puedeConfigurar } from "@/lib/capacidades-server";
import { DesignSystemProvider } from "@/components/design-system/appearance";
import dynamicImport from "next/dynamic";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { getClienteById } from "@/lib/clientes-api";
const ClienteFicha = dynamicImport(
  () =>
    import("@/components/clientes/cliente-ficha").then((m) => m.ClienteFicha),
  { loading: () => <ModulePageSkeleton variant="detail" /> },
);
export const dynamic = "force-dynamic";
export default function Page({
  params,
}: {
  params: Promise<{ clienteId: string }>;
}) {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="detail" />}>
      <Content params={params} />
    </Suspense>
  );
}
async function Content({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params;
  const [cliente, canManage] = await Promise.all([
    getClienteById(clienteId),
    puedeConfigurar("clientes", "crm.gestionar"),
  ]);
  if (!cliente) notFound();
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <ClienteFicha cliente={cliente} mode={canManage ? "edit" : "view"} />
    </DesignSystemProvider>
  );
}
