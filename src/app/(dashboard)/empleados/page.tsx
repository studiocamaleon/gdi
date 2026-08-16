import { Suspense } from "react";

import { EmpleadosTable } from "@/components/empleados/empleados-table";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { listEmpleados } from "@/lib/empleados-api";
import { tienePermiso } from "@/lib/permisos-server";

export const dynamic = "force-dynamic";

export default function EmpleadosPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="table" />}>
      <EmpleadosPageContent />
    </Suspense>
  );
}

async function EmpleadosPageContent() {
  const [response, canManage] = await Promise.all([
    listEmpleados({ page: 1, limit: 25 }),
    tienePermiso("registros.gestionar_empleados"),
  ]);

  return <EmpleadosTable initialResponse={response} canManage={canManage} />;
}
