import { ConfiguracionFiscalView } from "@/components/administracion/configuracion-fiscal-view";
import type { ConfiguracionFiscal } from "@/lib/administracion";
import { getConfiguracionFiscal } from "@/lib/administracion-api";

export const dynamic = "force-dynamic";

export default async function DatosFiscalesPage() {
  let config: ConfiguracionFiscal | null = null;
  try {
    config = await getConfiguracionFiscal();
  } catch {
    config = null;
  }
  return <ConfiguracionFiscalView initialConfig={config} />;
}
