import dynamicImport from "next/dynamic";
import { Suspense } from "react";
import { notFound } from "next/navigation";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { getProveedorById } from "@/lib/proveedores-api";

const ProveedorFicha = dynamicImport(
  () =>
    import("@/components/proveedores/proveedor-ficha").then(
      (module) => module.ProveedorFicha,
    ),
  {
    loading: () => <ModulePageSkeleton variant="detail" />,
  },
);

export const dynamic = "force-dynamic";

export default function ProveedorDetallePage({
  params,
}: {
  params: Promise<{ proveedorId: string }>;
}) {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="detail" />}>
      <ProveedorDetallePageContent params={params} />
    </Suspense>
  );
}

async function ProveedorDetallePageContent({
  params,
}: {
  params: Promise<{ proveedorId: string }>;
}) {
  const { proveedorId } = await params;
  const proveedor = await getProveedorById(proveedorId);

  if (!proveedor) {
    notFound();
  }

  return <ProveedorFicha proveedor={proveedor} mode="edit" />;
}
