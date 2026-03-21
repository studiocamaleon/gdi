import dynamicImport from "next/dynamic";
import { Suspense } from "react";
import { notFound } from "next/navigation";

import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { getEmpleadoById } from "@/lib/empleados-api";

const EmpleadoFicha = dynamicImport(
  () =>
    import("@/components/empleados/empleado-ficha").then(
      (module) => module.EmpleadoFicha,
    ),
  {
    loading: () => <ModulePageSkeleton variant="detail" />,
  },
);

export const dynamic = "force-dynamic";

export default function EmpleadoDetallePage({
  params,
}: {
  params: Promise<{ empleadoId: string }>;
}) {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="detail" />}>
      <EmpleadoDetallePageContent params={params} />
    </Suspense>
  );
}

async function EmpleadoDetallePageContent({
  params,
}: {
  params: Promise<{ empleadoId: string }>;
}) {
  const { empleadoId } = await params;
  const empleado = await getEmpleadoById(empleadoId);

  if (!empleado) {
    notFound();
  }

  return <EmpleadoFicha empleado={empleado} mode="edit" />;
}
