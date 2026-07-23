import { permanentRedirect } from "next/navigation";

import { enlacePublicoPath } from "@/lib/enlaces-publicos";

export const dynamic = "force-dynamic";

/**
 * Ruta vieja del presupuesto público, ahora en /p/<token>.
 *
 * No se puede borrar: cada link que ya se le mandó a un cliente apunta acá.
 * Redirige permanente y se queda.
 */
export default async function PresupuestoLegacyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  permanentRedirect(enlacePublicoPath("presupuesto", token));
}
