import dynamicImport from "next/dynamic";

import { createEmptyProveedor } from "@/lib/proveedores";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";

const ProveedorFicha = dynamicImport(
  () =>
    import("@/components/proveedores/proveedor-ficha").then(
      (module) => module.ProveedorFicha,
    ),
  {
    loading: () => <ModulePageSkeleton variant="detail" />,
  },
);

export default function NuevoProveedorPage() {
  return <ProveedorFicha proveedor={createEmptyProveedor()} mode="create" />;
}
