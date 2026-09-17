import { AprobacionDocumentalPublicaView } from "@/components/comercial/aprobacion-documental-publica";
import {
  getAprobacionDocumentalPublica,
  type AprobacionDocumentalPublica,
} from "@/lib/desarrollo-documental-api";

export const dynamic = "force-dynamic";

export default async function AprobacionDocumentalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let initial: AprobacionDocumentalPublica | null = null;
  try {
    initial = await getAprobacionDocumentalPublica(token);
  } catch {}
  return <AprobacionDocumentalPublicaView token={token} initial={initial} />;
}
