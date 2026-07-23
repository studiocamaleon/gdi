import { permanentRedirect } from "next/navigation";

import { enlacePublicoPath } from "@/lib/enlaces-publicos";

export const dynamic = "force-dynamic";

/**
 * Ruta vieja del seguimiento, ahora en /t/<token>.
 *
 * No se puede borrar: cada link que la imprenta ya mandó por WhatsApp apunta
 * acá, y esos mensajes no se pueden editar. Redirige permanente y se queda.
 */
export default async function TrackLegacyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  permanentRedirect(enlacePublicoPath("seguimiento", token));
}
