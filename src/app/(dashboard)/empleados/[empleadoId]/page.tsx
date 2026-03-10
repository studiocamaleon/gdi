import { notFound } from "next/navigation";

import { EmpleadoFicha } from "@/components/empleados/empleado-ficha";
import { getEmpleadoById } from "@/lib/empleados-api";

export const dynamic = "force-dynamic";

export default async function EmpleadoDetallePage({
  params,
}: {
  params: Promise<{ empleadoId: string }>;
}) {
  const { empleadoId } = await params;
  const empleado = await getEmpleadoById(empleadoId);

  if (!empleado) {
    notFound();
  }

  return <EmpleadoFicha empleado={empleado} mode="edit" />;
}
