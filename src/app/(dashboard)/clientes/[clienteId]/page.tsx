import dynamicImport from "next/dynamic";
import { Suspense } from "react";
import { notFound } from "next/navigation";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { getClienteById } from "@/lib/clientes-api";

const ClienteFicha = dynamicImport(
  () =>
    import("@/components/clientes/cliente-ficha").then(
      (module) => module.ClienteFicha,
    ),
  {
    loading: () => <ModulePageSkeleton variant="detail" />,
  },
);

export const dynamic = "force-dynamic";

export default function ClienteDetallePage({
  params,
}: {
  params: Promise<{ clienteId: string }>;
}) {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="detail" />}>
      <ClienteDetallePageContent params={params} />
    </Suspense>
  );
}

async function ClienteDetallePageContent({
  params,
}: {
  params: Promise<{ clienteId: string }>;
}) {
  const { clienteId } = await params;
  const cliente = await getClienteById(clienteId);

  if (!cliente) {
    notFound();
  }

  return <ClienteFicha cliente={cliente} mode="edit" />;
}
