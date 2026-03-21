import { Suspense } from "react";

import { ProveedoresTable } from "@/components/proveedores/proveedores-table";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { getProveedores } from "@/lib/proveedores-api";

export const dynamic = "force-dynamic";

export default function ProveedoresPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton variant="table" />}>
      <ProveedoresPageContent />
    </Suspense>
  );
}

async function ProveedoresPageContent() {
  const proveedores = await getProveedores();

  return <ProveedoresTable initialProveedores={proveedores} />;
}
