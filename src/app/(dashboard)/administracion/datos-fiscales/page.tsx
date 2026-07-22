import { ConfiguracionFiscalView } from "@/components/administracion/configuracion-fiscal-view";
import type { ConfiguracionFiscal } from "@/lib/administracion";
import { getConfiguracionFiscal } from "@/lib/administracion-api";
import { getLogoTenant, type LogoTenant } from "@/lib/archivos-api";

export const dynamic = "force-dynamic";

export default async function DatosFiscalesPage() {
  const [config, logo] = await Promise.all([
    getConfiguracionFiscal().catch((): ConfiguracionFiscal | null => null),
    getLogoTenant().catch((): LogoTenant => null),
  ]);
  return <ConfiguracionFiscalView initialConfig={config} logoInicial={logo} />;
}
