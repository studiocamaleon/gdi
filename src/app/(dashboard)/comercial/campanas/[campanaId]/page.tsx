import { notFound } from "next/navigation";
import { CampanaDetalleView } from "@/components/comercial/campana-detalle-view";
import { ApiError } from "@/lib/api";
import { listarArchivos } from "@/lib/archivos-api";
import { getCampana } from "@/lib/campanas-api";
import { getEmpleados } from "@/lib/empleados-api";
import { tienePermiso } from "@/lib/permisos-server";

export const dynamic = "force-dynamic";

export default async function CampanaDetallePage({
  params,
}: {
  params: Promise<{ campanaId: string }>;
}) {
  const { campanaId } = await params;
  let campana;
  try {
    campana = await getCampana(campanaId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const [archivos, empleados, canManage] = await Promise.all([
    listarArchivos("CAMPANA", campanaId).catch(() => []),
    getEmpleados().catch(() => []),
    tienePermiso("comercial.gestionar"),
  ]);
  return (
    <CampanaDetalleView
      initial={campana}
      initialArchivos={archivos}
      empleados={empleados}
      canManage={canManage}
    />
  );
}
