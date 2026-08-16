import { Suspense } from "react";

import { ProveedoresTable } from "@/components/proveedores/proveedores-table";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { listProveedores } from "@/lib/proveedores-api";
import { tienePermiso } from "@/lib/permisos-server";

export const dynamic = "force-dynamic";

export default function ProveedoresPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="table" />}>
      <ProveedoresPageContent />
    </Suspense>
  );
}

async function ProveedoresPageContent() {
  const [response, canManage] = await Promise.all([
    listProveedores({ page: 1, limit: 25 }),
    tienePermiso("registros.gestionar"),
  ]);

  return <ProveedoresTable initialResponse={response} canManage={canManage} />;
}
