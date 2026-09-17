import { DocumentoNoEncontrado } from "@/components/publico/documento-publico";
import { TrackingView } from "@/components/tracking/tracking-view";
import { getTrackingPublico, type TrackingPublico } from "@/lib/tracking";

export const dynamic = "force-dynamic";

/**
 * Seguimiento PÚBLICO de una OT por link privado (sin login). El token de la
 * URL es la credencial; la data llega de un endpoint @Public() del API.
 * Fuera del grupo (dashboard): no exige sesión ni tiene chrome interno.
 * Ver docs/tracking-publico-diseno.md
 */
export default async function TrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let data: TrackingPublico | null = null;
  try {
    data = await getTrackingPublico(token);
  } catch {
    data = null;
  }

  if (!data) return <DocumentoNoEncontrado tipo="pedido" />;

  return <TrackingView token={token} initialData={data} />;
}
