"use client";

import {
  ArrowRightIcon,
  ChartNoAxesCombinedIcon,
  ChevronDownIcon,
  Clock3Icon,
  GaugeIcon,
  ScanLineIcon,
  SlidersHorizontalIcon,
  TargetIcon,
} from "lucide-react";
import type { SaludEtaPanel, TabPanel } from "@/lib/panel-api";
import { fechaDelReporte } from "@/lib/reporte-resumen";
import { cn } from "@/lib/utils";
import { Metric, NoData, ReportCard, ReportSource } from "./reportes-ui";
import shared from "./reportes.module.css";
import styles from "./reporte-salud-eta.module.css";

const numero = (n: number, decimals = 2) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: decimals });
const porcentaje = (n: number | null) => (n == null ? "—" : `${numero(n)}%`);
const minutos = (n: number | null) => (n == null ? "—" : `${numero(n)} min`);

/** La duración compacta conserva el signo; el detalle exporta minutos exactos. */
function duracion(n: number | null, signed = false) {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const value = abs < 90 ? `${numero(abs)} min` : `${numero(abs / 60, 1)} h`;
  return `${n < 0 ? "−" : signed && n > 0 ? "+" : ""}${value}`;
}

function prettyFamilia(codigo: string) {
  const nombre = codigo.replace(/_/g, " ");
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

function PercentageTrack({
  value,
  tone,
}: {
  value: number | null;
  tone?: string;
}) {
  return (
    <div className={styles.track} data-tone={tone} aria-hidden="true">
      <span style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }} />
    </div>
  );
}

export function ReporteSaludEta({ d }: { d: TabPanel<SaludEtaPanel> }) {
  const { precision, salud } = d;
  const cobertura = salud.cobertura;
  const sesgo = precision.sesgoMin;
  const sesgoLectura =
    sesgo == null
      ? "Sin promesas medibles"
      : sesgo > 0
        ? "Termina más tarde, en promedio"
        : sesgo < 0
          ? "Termina antes, en promedio"
          : "Sin adelanto ni atraso promedio";
  const sugerencias = salud.sesgoFamilias.filter(
    (f) => f.duracionSugeridaMin != null,
  ).length;
  const precisionRows = [
    {
      label: "Dentro de ±4 horas",
      detail: "Respecto del fin estimado",
      value: precision.dentro4hPct,
      tone: "accent",
    },
    {
      label: "Dentro de ±1 día",
      detail: "Margen de 24 horas calendario",
      value: precision.dentro1dPct,
      tone: "accent",
    },
    {
      label: "Finalizaron tarde",
      detail: "Después del fin estimado",
      value: precision.tardePct,
      tone: "warning",
    },
  ];
  const coberturaRows = [
    {
      label: "Con ETA estimable",
      detail: "Se pudo calcular un fin estimado",
      value: cobertura.conEtaPct,
      tone: "accent",
    },
    {
      label: "Sin estimar",
      detail: "Promesas sin duración estimable",
      value: cobertura.sinEstimarPct,
      tone: "warning",
    },
    {
      label: "Con supuestos",
      detail: "Por ejemplo, calendario o estación faltante",
      value: cobertura.parcialPct,
      tone: "muted",
    },
  ];
  const errorRows = [
    { label: "Error medio absoluto (MAE)", value: precision.maeMin },
    { label: "Mediana del error absoluto", value: precision.medianaAbsMin },
    { label: "Percentil 90 del error absoluto", value: precision.p90AbsMin },
    { label: "Sesgo del pronóstico (con signo)", value: sesgo },
  ];

  return (
    <div className={shared.report}>
      <div className={shared.periodNote}>
        <span>Precisión del pronóstico</span>
        <span data-reporte-periodo>
          {fechaDelReporte(d.meta.rango.desde, "dia", true)} —{" "}
          {fechaDelReporte(d.meta.rango.hasta, "dia", true)}
        </span>
      </div>
      <div className={cn(shared.metrics, styles.metrics)}>
        <Metric
          label="Promesas medidas"
          value={numero(precision.muestras)}
          detail={`${numero(precision.cerradas)} promesas cerradas en la muestra`}
          icon={<ScanLineIcon />}
          featured
        />
        <Metric
          label="Error medio absoluto"
          value={duracion(precision.maeMin)}
          detail="Distancia promedio al fin estimado · MAE"
          icon={<TargetIcon />}
          hint="Promedio de la magnitud del error entre el fin estimado y el real, sin distinguir adelantos de atrasos. Cada promesa corresponde a un ítem."
        />
        <Metric
          label="Mediana del error"
          value={duracion(precision.medianaAbsMin)}
          detail={`Percentil 90: ${duracion(precision.p90AbsMin)}`}
          icon={<Clock3Icon />}
          hint="La mediana es el percentil 50 del error absoluto; el percentil 90 muestra el error que abarca al 90% de las mediciones. Se interpolan cuando corresponde."
        />
        <Metric
          label="Sesgo del pronóstico"
          value={duracion(sesgo, true)}
          detail={sesgoLectura}
          icon={<ChartNoAxesCombinedIcon />}
          hint="Promedio del error con signo, en tiempo: negativo indica adelanto y positivo indica atraso. Cero es ausencia de sesgo promedio; no implica que cada promesa haya sido exacta."
        />
      </div>

      <div className={styles.overviewGrid}>
        <ReportCard
          title="Precisión de las promesas"
          description="Promesas registradas en el período que ya tienen fin real"
          action={
            <TargetIcon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          <div className={cn(shared.chartSummary, styles.summary)}>
            <div>
              <span>Promesas medibles</span>
              <strong>{numero(precision.muestras)}</strong>
            </div>
            <div>
              <span>Cobertura de las cerradas</span>
              <strong>
                {porcentaje(
                  precision.cerradas > 0 ? precision.coberturaPct : null,
                )}
              </strong>
            </div>
          </div>
          <div className={shared.tableScroll}>
            <table
              className={cn(shared.table, styles.coverageClosed)}
              aria-label="Cobertura de promesas cerradas"
            >
              <thead>
                <tr>
                  <th scope="col">Cerradas</th>
                  <th scope="col">Sin estimar</th>
                  <th scope="col">Cobertura</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{numero(precision.cerradas)}</th>
                  <td>{numero(precision.sinEstimar)}</td>
                  <td>
                    {porcentaje(
                      precision.cerradas > 0 ? precision.coberturaPct : null,
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {precision.muestras > 0 ? (
            <>
              <div className={shared.tableScroll}>
                <table
                  className={cn(shared.table, styles.distribution)}
                  aria-label="Precisión respecto del ETA"
                >
                  <thead>
                    <tr>
                      <th scope="col">Resultado</th>
                      <th scope="col">Promesas medidas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {precisionRows.map((r) => (
                      <tr key={r.label}>
                        <th scope="row" data-reporte-exportar={r.label}>
                          <strong>{r.label}</strong>
                          <small>{r.detail}</small>
                          <PercentageTrack value={r.value} tone={r.tone} />
                        </th>
                        <td>{porcentaje(r.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={styles.note}>
                Las franjas se superponen: ±4 horas está incluida en ±1 día. Se
                miden tiempos calendario, no jornadas laborales.
              </p>
            </>
          ) : (
            <NoData
              title="Sin promesas cerradas medibles"
              description="La precisión aparecerá cuando las promesas con ETA registrado tengan un fin real para comparar."
            />
          )}
          <details className={shared.dataDetails}>
            <summary>
              Ver errores en minutos <ChevronDownIcon aria-hidden="true" />
            </summary>
            <div className={shared.tableScroll}>
              <table
                className={shared.table}
                aria-label="Errores del ETA en minutos"
              >
                <thead>
                  <tr>
                    <th scope="col">Indicador</th>
                    <th scope="col">Minutos</th>
                  </tr>
                </thead>
                <tbody>
                  {errorRows.map((r) => (
                    <tr key={r.label}>
                      <th scope="row">{r.label}</th>
                      <td>{r.value == null ? "—" : numero(r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </ReportCard>

        <ReportCard
          title="Cobertura del pronóstico"
          description="Todas las promesas del período · abiertas y cerradas"
          action={
            <GaugeIcon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          <div className={styles.forecastTotal} data-reporte-indicador>
            <span data-reporte-etiqueta>Promesas registradas</span>
            <strong data-reporte-valor>{numero(cobertura.promesas)}</strong>
            <small data-reporte-detalle>
              Cada promesa corresponde a un ítem de una orden.
            </small>
          </div>
          {cobertura.promesas > 0 ? (
            <>
              <div className={shared.tableScroll}>
                <table
                  className={cn(shared.table, styles.distribution)}
                  aria-label="Cobertura de todas las promesas"
                >
                  <thead>
                    <tr>
                      <th scope="col">Calidad del pronóstico</th>
                      <th
                        scope="col"
                        aria-label="Participación"
                        data-reporte-exportar="Participación"
                      >
                        %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {coberturaRows.map((r) => (
                      <tr key={r.label}>
                        <th scope="row" data-reporte-exportar={r.label}>
                          <strong>{r.label}</strong>
                          <small>{r.detail}</small>
                          <PercentageTrack value={r.value} tone={r.tone} />
                        </th>
                        <td>{porcentaje(r.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={styles.note}>
                “Con supuestos” puede coincidir con las otras categorías; los
                tres porcentajes no se suman.
                {cobertura.sinEstimarPct > 0
                  ? " Revisá los pasos sin duración para mejorar la cobertura."
                  : " Todas las promesas del período tienen un ETA estimable."}
              </p>
            </>
          ) : (
            <NoData
              title="Sin promesas en el período"
              description="La cobertura se completa al registrar estimaciones. Un período vacío todavía no permite evaluar el pronóstico."
            />
          )}
        </ReportCard>
      </div>

      <ReportCard
        title="Calibración de duraciones por familia"
        description="Medianas de los pasos completados en el período · sólo tiempos medidos"
        action={
          <SlidersHorizontalIcon
            className={shared.headerIcon}
            aria-hidden="true"
          />
        }
      >
        {salud.sesgoFamilias.length ? (
          <>
            <div className={styles.calibrationSummary}>
              <span>
                <strong>{numero(salud.sesgoFamilias.length)}</strong> familias
                con mediciones
              </span>
              <span>
                <strong>{numero(sugerencias)}</strong> con duración sugerida
              </span>
              <span className={styles.manualBadge}>Revisión manual</span>
            </div>
            <div className={shared.tableScroll}>
              <table
                className={cn(shared.table, styles.calibration)}
                aria-label="Calibración de duraciones por familia"
              >
                <thead>
                  <tr>
                    <th scope="col">Familia / muestra</th>
                    <th scope="col">Estimado</th>
                    <th scope="col">Medido</th>
                    <th scope="col">Sesgo</th>
                    <th scope="col">Duración sugerida</th>
                  </tr>
                </thead>
                <tbody>
                  {salud.sesgoFamilias.map((f) => {
                    const nombre =
                      f.familiaNombre ?? prettyFamilia(f.familiaCodigo);
                    const alineada = Math.abs(f.sesgoPct) <= 10;
                    const estado = alineada
                      ? "En línea"
                      : f.sesgoMin > 0
                        ? "Subestimado"
                        : "Sobreestimado";
                    const signoPct = `${f.sesgoPct > 0 ? "+" : ""}${porcentaje(f.sesgoPct)}`;
                    const maximo =
                      Math.max(f.medianaEstimadoMin, f.medianaRealMin) || 1;
                    return (
                      <tr key={f.familiaCodigo}>
                        <th
                          scope="row"
                          data-reporte-exportar={`${nombre} · ${numero(f.muestras)} pasos medidos${f.muestras < 5 ? " · muestra pequeña" : ""}`}
                        >
                          <strong>{nombre}</strong>
                          <small data-warning={f.muestras < 5}>
                            {numero(f.muestras)} pasos medidos
                            {f.muestras < 5 ? " · muestra pequeña" : ""}
                          </small>
                          <div className={styles.comparison} aria-hidden="true">
                            <span
                              style={{
                                width: `${Math.max(0, (f.medianaEstimadoMin / maximo) * 100)}%`,
                              }}
                            />
                            <span
                              style={{
                                width: `${Math.max(0, (f.medianaRealMin / maximo) * 100)}%`,
                              }}
                            />
                          </div>
                        </th>
                        <td>{minutos(f.medianaEstimadoMin)}</td>
                        <td>{minutos(f.medianaRealMin)}</td>
                        <td
                          data-reporte-exportar={`${signoPct} · ${f.sesgoMin > 0 ? "+" : ""}${minutos(f.sesgoMin)} · ${estado}`}
                        >
                          <div
                            className={styles.bias}
                            data-tone={
                              alineada
                                ? "neutral"
                                : f.sesgoMin > 0
                                  ? "late"
                                  : "early"
                            }
                          >
                            <strong>{signoPct}</strong>
                            <small>
                              {f.sesgoMin > 0 ? "+" : ""}
                              {minutos(f.sesgoMin)} · {estado}
                            </small>
                          </div>
                        </td>
                        <td>
                          {f.duracionSugeridaMin != null ? (
                            <span className={styles.suggestion}>
                              <ArrowRightIcon aria-hidden="true" />
                              {minutos(f.duracionSugeridaMin)}
                            </span>
                          ) : (
                            <span className={styles.noSuggestion}>
                              Sin sugerencia
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div
              className={styles.legend}
              aria-label="Referencia de comparación"
            >
              <span>
                <i aria-hidden="true" />
                Estimado
              </span>
              <span>
                <i aria-hidden="true" />
                Medido
              </span>
              <span>Barras relativas dentro de cada familia.</span>
            </div>
          </>
        ) : (
          <NoData
            title="Todavía no hay familias para calibrar"
            description="Se necesitan al menos 3 pasos con tiempo medido y estimado en una misma familia. El registro de tiempos completa esta comparación."
          />
        )}
        <p className={styles.note}>
          En línea: hasta ±10% de desvío. El sistema sugiere una duración con al
          menos 5 muestras y un sesgo absoluto de 20% o más. Las sugerencias no
          se aplican automáticamente.
        </p>
      </ReportCard>
      <ReportSource meta={d.meta} />
    </div>
  );
}
