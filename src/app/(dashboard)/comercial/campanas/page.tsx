import { CampanasView } from "@/components/comercial/campanas-view";
import { listarCampanas, type CampanasListado } from "@/lib/campanas-api";
import { getClientes } from "@/lib/clientes-api";
import { getEmpleados } from "@/lib/empleados-api";
import { tienePermiso } from "@/lib/permisos-server";

export const dynamic = "force-dynamic";

export default async function CampanasPage({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string }>;
}) {
  const { clienteId } = await searchParams;
  const empty: CampanasListado = {
    data: [],
    total: 0,
    page: 1,
    limit: 100,
    pages: 0,
    stats: { porEstado: {}, enRiesgo: 0, proximasAVencer: 0 },
  };
  const [campanas, clientes, empleados, canManage] = await Promise.all([
    listarCampanas({ limit: 100, clienteId }).catch(() => empty),
    getClientes({ limit: 200 }).catch(() => []),
    getEmpleados().catch(() => []),
    tienePermiso("comercial.gestionar"),
  ]);
  return (
    <CampanasView
      initial={campanas}
      clientes={clientes}
      empleados={empleados}
      canManage={canManage}
      initialClienteId={clienteId}
    />
  );
}
