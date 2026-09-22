import { tieneCapacidad } from "@/lib/capacidades-server";
import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { DesignSystemProvider } from "@/components/design-system/appearance";
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
  if (!(await tieneCapacidad("proveedores"))) return <FuncionNoIncluida />;
  if (!(await tienePermiso("registros.gestionar"))) {
    return <SinPermiso modulo="Gestionar proveedores" />;
  }
  return (
    <DesignSystemProvider theme="brand" appearance="light">
      <ProveedorFicha proveedor={createEmptyProveedor()} mode="create" />
    </DesignSystemProvider>
  );
}
