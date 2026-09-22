import { FuncionNoIncluida } from "@/components/navigation/funcion-no-incluida";
import { puedeConfigurar, tieneCapacidad } from "@/lib/capacidades-server";
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
  if (!(await tieneCapacidad("empleados"))) return <FuncionNoIncluida />;
  const [canManage, canViewCommissions] = await Promise.all([
    puedeConfigurar("empleados", "registros.gestionar_empleados"),
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
