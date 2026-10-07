import { SolicitudesAlta } from "@/components/clientes/solicitudes-alta";
import { apiRequest } from "@/lib/api";
import { listarAltas, raizAltas } from "@/lib/clientes-autoregistro-api";
import { tienePermiso } from "@/lib/permisos-server";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!(await tienePermiso("crm.aprobar_altas", { exigirConfirmacion: true })))
    return (
      <div className="p-6">
        Necesitás el permiso «Revisar altas de clientes» para entrar a esta
        sección.
      </div>
    );
  const [initial, enlace] = await Promise.all([
    listarAltas("PENDIENTE", 1),
    apiRequest<{ token: string | null }>(`${raizAltas}/enlace`),
  ]);
  return <SolicitudesAlta initial={initial} initialToken={enlace.token} />;
}
