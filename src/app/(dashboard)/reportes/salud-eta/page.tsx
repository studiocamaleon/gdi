import { PanelSaludEta } from "@/components/produccion/panel-salud-eta";
import { MetaPie } from "@/components/panel/panel-general";
import { zonaHorariaDelTenant } from "@/lib/auth-server";
import { getPanelSaludEta } from "@/lib/panel-api";
import { rangoDeParametros, type ParametrosPeriodo } from "@/lib/panel-periodo";

export const dynamic = "force-dynamic";

/**
 * Salud del ETA como reporte: precisión de las promesas + calibración de
 * duraciones. Antes vivía en Producción (/produccion/eta); se movió a Reportes
 * como un reporte más. El cromo (título, período, tabs) lo pone el shell.
 * Ver docs/eta-metricas-historicas-diseno.md
 */
export default async function SaludEtaReportePage({
  searchParams,
}: {
  searchParams: Promise<ParametrosPeriodo>;
}) {
  const parametros = await searchParams;
  const rango = rangoDeParametros(parametros, await zonaHorariaDelTenant());
  const data = await getPanelSaludEta(rango);

  return (
    <>
      <PanelSaludEta
        enReportes
        initialPrecision={data.precision}
        initialSalud={data.salud}
        rango={rango}
      />
      <MetaPie meta={data.meta} />
    </>
  );
}
