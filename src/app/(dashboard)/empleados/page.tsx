import { Suspense } from "react";

import { EmpleadosTable } from "@/components/empleados/empleados-table";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { getEmpleados } from "@/lib/empleados-api";

export const dynamic = "force-dynamic";

export default function EmpleadosPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="table" />}>
      <EmpleadosPageContent />
    </Suspense>
  );
}

async function EmpleadosPageContent() {
  const empleados = await getEmpleados();

  return <EmpleadosTable initialEmpleados={empleados} />;
}
