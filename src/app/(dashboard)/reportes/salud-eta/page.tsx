import { PanelSaludEta } from "@/components/produccion/panel-salud-eta";
import { getEtaPrecision, getEtaSalud } from "@/lib/eta-api";
import { getFamiliasPasos } from "@/lib/estaciones-api";

export const dynamic = "force-dynamic";

/**
 * Salud del ETA como reporte: precisión de las promesas + calibración de
 * duraciones. Antes vivía en Producción (/produccion/eta); se movió a Reportes
 * como un reporte más. El cromo (título, período, tabs) lo pone el shell.
 * Ver docs/eta-metricas-historicas-diseno.md
 */
export default async function SaludEtaReportePage() {
  const [precision, salud, familias] = await Promise.all([
    getEtaPrecision(),
    getEtaSalud(),
    getFamiliasPasos(),
  ]);
  const familiaNombres: Record<string, string> = {};
  for (const f of familias) familiaNombres[f.codigo] = f.nombre;

  return (
    <PanelSaludEta
      enReportes
      initialPrecision={precision}
      initialSalud={salud}
      familiaNombres={familiaNombres}
    />
  );
}
