"use client";

import { useSearchParams } from "next/navigation";
import {
  ArrowUpRightIcon,
  ChartNoAxesCombinedIcon,
  CheckCheckIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  CirclePercentIcon,
  InfoIcon,
  LayersIcon,
  TargetIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { usePuedeFn } from "@/components/navigation/permisos-provider";
import { ActionLink } from "@/components/design-system/action-link";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { abreviarMoneda, formatearMoneda } from "@/lib/moneda";
import { leerPeriodo, leerRangoPersonalizado } from "@/lib/panel-periodo";
import { fechaDelReporte, serieDelResumen } from "@/lib/reporte-resumen";
import { cn } from "@/lib/utils";
import type { ResumenData } from "@/lib/panel-api";
import { TremorBarChart, TremorSparkAreaChart } from "./charts/tremor-charts";
import { ReportCard, Metric, NoData, ReportSource } from "./reportes-ui";
import styles from "./reportes.module.css";

const porcentaje = (valor: number | null | undefined) =>
  valor == null
    ? "—"
    : `${valor.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;

export function ResumenEjecutivo({ d }: { d: ResumenData }) {
  const { moneda } = useConfigRegional();
  const puede = usePuedeFn();
  const search = useSearchParams();
  const custom = leerRangoPersonalizado(
    search.get("desde") ?? undefined,
    search.get("hasta") ?? undefined,
  );
  const periodo = leerPeriodo(search.get("periodo") ?? undefined);
  const href = (ruta: string) =>
    custom
      ? `${ruta}?desde=${custom.desde}&hasta=${custom.hasta}`
      : periodo === "mes"
        ? ruta
        : `${ruta}?periodo=${periodo}`;
  const r = d.rentabilidad;
  const serie = serieDelResumen(d.serie);
  const monto = (v: number) => formatearMoneda(v, moneda, { decimales: 0 });
  const montoExacto = (v: number) => formatearMoneda(v, moneda);
  const abreviado = (v: number) => abreviarMoneda(v, moneda);
  const comparativa = "vs. período anterior";
  const equilibrioDisponible = r.puntoEquilibrio != null && r.avancePct != null;
  const cumplido = equilibrioDisponible && r.avancePct! >= 100;
  const avanceDibujo = Math.min(100, Math.max(0, r.avancePct ?? 0));
  const principal = Math.max(...d.topClientes.map((c) => c.facturado), 1);
  const rango = `${fechaDelReporte(d.meta.rango.desde, "dia", true)} — ${fechaDelReporte(d.meta.rango.hasta, "dia", true)}`;
  return (
    <div className={styles.report}>
      <div className={styles.periodNote}>
        <span>Lectura del período</span>
        <span data-reporte-periodo>{rango}</span>
      </div>
      <div className={styles.metrics}>
        <Metric
          label="Ventas"
          value={abreviado(r.ventas)}
          detail={
            r.ventasDeltaPct != null
              ? `${comparativa} · sin IVA`
              : "Ventas del período · sin IVA"
          }
          delta={r.ventasDeltaPct}
          icon={<ChartNoAxesCombinedIcon />}
          featured
        >
          <div className={styles.metricSpark}>
            <TremorSparkAreaChart
              data={serie}
              index="fecha"
              category="ventas"
            />
          </div>
        </Metric>
        <Metric
          label="Margen bruto"
          value={porcentaje(r.margenBrutoPct)}
          detail={
            r.margenBrutoDeltaPts != null
              ? comparativa
              : "Sobre las ventas del período"
          }
          delta={r.margenBrutoDeltaPts}
          deltaUnit="pts"
          icon={<CirclePercentIcon />}
          hint="Ventas menos costo directo de los trabajos. La variación se expresa en puntos porcentuales."
        />
        <Metric
          label="Contribución"
          value={porcentaje(r.contribucionPct)}
          detail={
            r.contribucionDeltaPts != null
              ? comparativa
              : "Ventas menos costos variables"
          }
          delta={r.contribucionDeltaPts}
          deltaUnit="pts"
          icon={<LayersIcon />}
          hint="La contribución descuenta los costos variables, como materiales y tintas. Sirve para cubrir la estructura fija."
        />
        <Metric
          label="Punto de equilibrio"
          value={r.puntoEquilibrio != null ? abreviado(r.puntoEquilibrio) : "—"}
          detail={
            r.avancePct != null
              ? `${porcentaje(r.avancePct)} cubierto`
              : "No calculable en este período"
          }
          icon={<TargetIcon />}
        />
        <Metric
          label="Entregas a tiempo"
          value={porcentaje(d.produccion.otdPct)}
          detail={
            d.produccion.otdPct != null
              ? "Cumplimiento de entregas · OTD"
              : "Sin entregas evaluables"
          }
          icon={<CheckCheckIcon />}
        />
      </div>
      <div className={styles.mainGrid}>
        <ReportCard
          title="Ventas, costo y margen"
          description={`Evolución ${{ dia: "diaria", semana: "semanal", mes: "mensual" }[d.meta.granularidad]} · ${moneda.codigo} · sin IVA`}
          className={styles.salesCard}
          action={<span className={styles.sectionMark}>01 / Evolución</span>}
        >
          {serie.length > 0 ? (
            <>
              <div className={styles.chartSummary}>
                <div>
                  <span>Ventas del período</span>
                  <strong>{monto(r.ventas)}</strong>
                </div>
                <div>
                  <span>Margen bruto</span>
                  <strong>{monto(r.margenBruto)}</strong>
                </div>
              </div>
              <div className={styles.chartWrap}>
                <TremorBarChart
                  data={serie}
                  index="fecha"
                  categories={[
                    {
                      key: "costo",
                      label: "Costo directo",
                      color: "var(--chart-cost)",
                    },
                    {
                      key: "margen",
                      label: "Margen bruto",
                      color: "var(--chart-margin)",
                    },
                  ]}
                  valueFormatter={montoExacto}
                  axisFormatter={abreviado}
                  tickFormatter={(f) => fechaDelReporte(f, d.meta.granularidad)}
                  labelFormatter={(f) =>
                    fechaDelReporte(f, d.meta.granularidad, true)
                  }
                  label="Costo directo y margen bruto por período"
                />
              </div>
              <details className={styles.dataDetails}>
                <summary>
                  Ver datos de la evolución{" "}
                  <ChevronDownIcon aria-hidden="true" />
                </summary>
                <div className={styles.tableScroll}>
                  <table
                    className={styles.table}
                    aria-label="Datos de ventas, costo y margen"
                  >
                    <thead>
                      <tr>
                        <th scope="col">Período</th>
                        <th scope="col">Ventas</th>
                        <th scope="col">Costo directo</th>
                        <th scope="col">Margen bruto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serie.map((p, i) => (
                        <tr key={`${p.fecha}-${i}`}>
                          <th scope="row">
                            {fechaDelReporte(
                              p.fecha,
                              d.meta.granularidad,
                              true,
                            )}
                          </th>
                          <td>{montoExacto(p.ventas)}</td>
                          <td>{montoExacto(p.costo)}</td>
                          <td data-negative={p.margen < 0}>
                            {montoExacto(p.margen)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : (
            <NoData
              title="Todavía no hay ventas en este período"
              description="Al emitir órdenes, vas a poder ver cómo evolucionan las ventas, los costos y el margen. También podés consultar otro período."
            />
          )}
        </ReportCard>
        <ReportCard
          title="Punto de equilibrio"
          description="El avance para cubrir tu estructura fija."
          className={styles.equilibriumCard}
          action={
            <TargetIcon className={styles.headerIcon} aria-hidden="true" />
          }
        >
          {equilibrioDisponible ? (
            <>
              <div className={styles.gauge} data-complete={cumplido}>
                <svg viewBox="0 0 180 180" aria-hidden="true">
                  <circle
                    cx="90"
                    cy="90"
                    r="75"
                    className={styles.gaugeTrack}
                  />
                  <circle
                    cx="90"
                    cy="90"
                    r="75"
                    className={styles.gaugeValue}
                    pathLength="100"
                    strokeDasharray={`${avanceDibujo} 100`}
                    transform="rotate(-90 90 90)"
                  />
                </svg>
                <div>
                  <strong>{porcentaje(r.avancePct)}</strong>
                  <span>del equilibrio</span>
                </div>
              </div>
              <p className={styles.equilibriumStatus}>
                {cumplido ? (
                  <>
                    <CircleCheckIcon aria-hidden="true" />
                    Estructura cubierta
                  </>
                ) : (
                  <>
                    <TargetIcon aria-hidden="true" />
                    En camino al equilibrio
                  </>
                )}
              </p>
              <dl className={styles.breakdown}>
                <div>
                  <dt>Ventas necesarias</dt>
                  <dd>{monto(r.puntoEquilibrio!)}</dd>
                </div>
                <div>
                  <dt>Ventas actuales</dt>
                  <dd>{monto(r.ventas)}</dd>
                </div>
                <div>
                  <dt>Costos fijos</dt>
                  <dd>{r.costosFijos != null ? monto(r.costosFijos) : "—"}</dd>
                </div>
              </dl>
              <div className={styles.remaining}>
                <span>
                  {cumplido ? "Por encima del equilibrio" : "Ventas que faltan"}
                </span>
                <strong>
                  {monto(Math.abs(r.puntoEquilibrio! - r.ventas))}
                </strong>
              </div>
            </>
          ) : (
            <NoData
              title="Equilibrio aún no calculable"
              description={
                r.contribucionPct <= 0
                  ? "Se necesitan ventas con contribución positiva y costos fijos del período para calcularlo."
                  : "Se necesitan costos fijos del período para calcular cuánto debe vender tu empresa."
              }
            />
          )}
          {puede("finanzas.ver_margenes") ? (
            <div className={styles.cardAction}>
              <ActionLink variant="outline" href={href("/reportes/finanzas")}>
                Analizar finanzas <ArrowUpRightIcon data-icon="inline-end" />
              </ActionLink>
            </div>
          ) : null}
        </ReportCard>
      </div>
      <div className={styles.detailGrid}>
        <ReportCard
          title="Clientes principales"
          description="Quiénes explican las ventas del período."
          action={<span className={styles.sectionMark}>02 / Clientes</span>}
        >
          {d.topClientes.length ? (
            <div className={styles.tableScroll}>
              <table
                className={cn(styles.table, styles.rankTable)}
                aria-label="Clientes principales"
              >
                <thead>
                  <tr>
                    <th scope="col">Cliente</th>
                    <th scope="col">Órdenes</th>
                    <th scope="col">Ventas sin IVA</th>
                  </tr>
                </thead>
                <tbody>
                  {d.topClientes.map((c, i) => (
                    <tr key={c.id ?? `${c.nombre}-${i}`}>
                      <th scope="row" data-reporte-exportar={c.nombre}>
                        <div className={styles.rankName}>
                          <span>{String(i + 1).padStart(2, "0")}</span>
                          <div>
                            <strong>{c.nombre}</strong>
                            <small>
                              Ticket{" "}
                              {abreviado(
                                c.ordenes > 0 ? c.facturado / c.ordenes : 0,
                              )}
                            </small>
                            <div
                              className={styles.rankTrack}
                              aria-hidden="true"
                            >
                              <span
                                style={{
                                  width: `${Math.max(0, (c.facturado / principal) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </th>
                      <td>{c.ordenes}</td>
                      <td>{monto(c.facturado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <NoData
              title="Sin clientes para mostrar"
              description="Este período todavía no tiene ventas registradas para armar el ranking."
            />
          )}
          <div className={styles.cardAction}>
            <ActionLink variant="outline" href={href("/reportes/clientes")}>
              Analizar clientes <ArrowUpRightIcon data-icon="inline-end" />
            </ActionLink>
          </div>
        </ReportCard>
        <ReportCard
          title="Productos con más ventas"
          description="Ventas y margen de los productos destacados."
          action={<span className={styles.sectionMark}>03 / Productos</span>}
        >
          {d.topProductos.length ? (
            <div className={styles.tableScroll}>
              <table
                className={styles.table}
                aria-label="Productos con más ventas"
              >
                <thead>
                  <tr>
                    <th scope="col">Producto</th>
                    <th scope="col">Margen</th>
                    <th scope="col">Ventas sin IVA</th>
                  </tr>
                </thead>
                <tbody>
                  {d.topProductos.map((p, i) => (
                    <tr key={`${p.nombre}-${i}`}>
                      <th scope="row">{p.nombre}</th>
                      <td>
                        <span
                          className={styles.marginValue}
                          data-negative={p.margenPct < 0}
                        >
                          {porcentaje(p.margenPct)}
                        </span>
                      </td>
                      <td>{monto(p.ventas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <NoData
              title="Sin productos vendidos"
              description="Los productos aparecen cuando tienen ventas en el período seleccionado."
            />
          )}
          <div className={styles.cardAction}>
            <ActionLink variant="outline" href={href("/reportes/producto")}>
              Analizar productos <ArrowUpRightIcon data-icon="inline-end" />
            </ActionLink>
          </div>
        </ReportCard>
      </div>
      <ReportCard
        title="Lo que necesita atención"
        description="Alertas del negocio para orientar tus próximas decisiones."
        action={
          <span className={styles.alertCount}>
            {d.alertas.length} activa{d.alertas.length === 1 ? "" : "s"}
          </span>
        }
      >
        {d.alertas.length ? (
          <div className={styles.alerts}>
            {d.alertas.map((a) => (
              <Alert
                key={a.id}
                role="note"
                className={styles.alert}
                data-severity={a.severidad}
              >
                {a.severidad === "info" ? <InfoIcon /> : <TriangleAlertIcon />}
                <AlertTitle>{a.titulo}</AlertTitle>
                <AlertDescription>{a.detalle}</AlertDescription>
              </Alert>
            ))}
          </div>
        ) : (
          <div className={styles.allClear}>
            <CircleCheckIcon aria-hidden="true" />
            <div>
              <strong>Sin alertas activas</strong>
              <p>No hay alertas para el período seleccionado.</p>
            </div>
          </div>
        )}
      </ReportCard>
      <ReportSource meta={d.meta} />
    </div>
  );
}
