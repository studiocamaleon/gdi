import dynamicImport from "next/dynamic";

import { createEmptyEmpleado } from "@/lib/empleados";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";
import { SinPermiso } from "@/components/navigation/sin-permiso";
import { tienePermiso } from "@/lib/permisos-server";

const EmpleadoFicha = dynamicImport(
  () =>
    import("@/components/empleados/empleado-ficha").then(
      (module) => module.EmpleadoFicha,
    ),
  {
    loading: () => <ModulePageSkeleton variant="detail" />,
  },
);

export default async function NuevoEmpleadoPage() {
  const [canManage, canViewCommissions] = await Promise.all([
    tienePermiso("registros.gestionar_empleados"),
    tienePermiso("registros.ver_comisiones"),
  ]);
  if (!canManage) return <SinPermiso modulo="Empleados" />;
  return (
    <EmpleadoFicha
      empleado={createEmptyEmpleado()}
      mode="create"
      canManage
      canViewCommissions={canViewCommissions}
    />
  );
}
