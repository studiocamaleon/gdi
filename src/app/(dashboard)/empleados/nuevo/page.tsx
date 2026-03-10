import { EmpleadoFicha } from "@/components/empleados/empleado-ficha";
import { createEmptyEmpleado } from "@/lib/empleados";

export default function NuevoEmpleadoPage() {
  return <EmpleadoFicha empleado={createEmptyEmpleado()} mode="create" />;
}
