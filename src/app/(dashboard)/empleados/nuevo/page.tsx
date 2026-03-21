import dynamicImport from "next/dynamic";

import { createEmptyEmpleado } from "@/lib/empleados";
import { ModulePageSkeleton } from "@/components/dashboard/module-page-skeleton";

const EmpleadoFicha = dynamicImport(
  () =>
    import("@/components/empleados/empleado-ficha").then(
      (module) => module.EmpleadoFicha,
    ),
  {
    loading: () => <ModulePageSkeleton variant="detail" />,
  },
);

export default function NuevoEmpleadoPage() {
  return <EmpleadoFicha empleado={createEmptyEmpleado()} mode="create" />;
}
