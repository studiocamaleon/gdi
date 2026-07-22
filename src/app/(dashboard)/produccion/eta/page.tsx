import { PanelSaludEta } from "@/components/produccion/panel-salud-eta";
import { getEtaPrecision, getEtaSalud } from "@/lib/eta-api";
import { getFamiliasPasos } from "@/lib/estaciones-api";

export const dynamic = "force-dynamic";

/**
 * Salud del ETA — precisión de las promesas + calibración de duraciones.
 * Se pre-cargan las métricas server-side; el cliente permite refrescar.
 * Ver docs/eta-metricas-historicas-diseno.md
 */
export default async function SaludEtaPage() {
  const [precision, salud, familias] = await Promise.all([
    getEtaPrecision(),
    getEtaSalud(),
    getFamiliasPasos(),
  ]);
  const familiaNombres: Record<string, string> = {};
  for (const f of familias) familiaNombres[f.codigo] = f.nombre;

  return (
    <PanelSaludEta
      initialPrecision={precision}
      initialSalud={salud}
      familiaNombres={familiaNombres}
    />
  );
}
