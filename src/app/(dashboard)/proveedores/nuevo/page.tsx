import dynamicImport from "next/dynamic";

import { createEmptyProveedor } from "@/lib/proveedores";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";
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

export default async function NuevoProveedorPage() {
  if (!(await tienePermiso("registros.gestionar"))) {
    return <SinPermiso modulo="Gestionar proveedores" />;
  }
  return <ProveedorFicha proveedor={createEmptyProveedor()} mode="create" />;
}
