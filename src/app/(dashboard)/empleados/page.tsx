import { EmpleadosTable } from "@/components/empleados/empleados-table";
import { getEmpleados } from "@/lib/empleados-api";

export const dynamic = "force-dynamic";

export default async function EmpleadosPage() {
  const empleados = await getEmpleados();

  return <EmpleadosTable initialEmpleados={empleados} />;
}
