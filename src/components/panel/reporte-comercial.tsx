"use client";

import { type ReactNode } from "react";
import {
  ChartNoAxesCombinedIcon,
  ChevronDownIcon,
  LayersIcon,
  ReceiptTextIcon,
  UserPlusIcon,
  HistoryIcon,
} from "lucide-react";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { abreviarMoneda, formatearMoneda } from "@/lib/moneda";
import { technologyCodeLabel } from "@/lib/maquinaria-tecnologias";
import { fechaDelReporte } from "@/lib/reporte-resumen";
import type {
  ComercialPanel,
  MetaPanel,
  MixPanel,
  RankingPanel,
} from "@/lib/panel-api";
import { cn } from "@/lib/utils";
import { Metric, NoData, ReportCard, ReportSource } from "./reportes-ui";
import { TremorAreaChart, TremorSparkAreaChart } from "./charts/tremor-charts";
import shared from "./reportes.module.css";
import styles from "./reporte-comercial.module.css";

const numero = (n: number) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
const porcentaje = (n: number) =>
  `${n.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
const agrupacion = { dia: "día", semana: "semana", mes: "mes" };

function DataDetails({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className={shared.dataDetails}>
      <summary>
        {title}
        <ChevronDownIcon aria-hidden="true" />
      </summary>
      <div className={shared.tableScroll}>{children}</div>
    </details>
  );
}

function SalesMix({
  rows,
  technology = false,
}: {
  rows: MixPanel[];
  technology?: boolean;
}) {
  const { moneda } = useConfigRegional();
  if (!rows.length)
    return (
      <NoData
        title="Sin ventas para distribuir"
        description="La participación aparece cuando hay ventas en el período seleccionado."
      />
    );
  return (
    <div className={shared.tableScroll}>
      <table
        className={cn(shared.table, styles.mixTable)}
        aria-label={
          technology ? "Ventas por tecnología" : "Ventas por categoría"
        }
      >
        <thead>
          <tr>
            <th scope="col">{technology ? "Tecnología" : "Categoría"}</th>
            <th scope="col">Participación</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const nombre = technology
              ? technologyCodeLabel(m.nombre) || m.nombre
              : m.nombre;
            return (
              <tr key={m.nombre}>
                <th scope="row">
                  <span>{nombre}</span>
                  <div className={shared.rankTrack} aria-hidden="true">
                    <span
                      style={{ width: `${Math.min(100, Math.max(0, m.pct))}%` }}
                    />
                  </div>
                </th>
                <td
                  data-reporte-exportar={`${porcentaje(m.pct)} · ${formatearMoneda(m.monto, moneda)}`}
                >
                  <strong>{porcentaje(m.pct)}</strong>
                  <small>{formatearMoneda(m.monto, moneda)}</small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Ranking({ rows, label }: { rows: RankingPanel[]; label: string }) {
  const { moneda } = useConfigRegional();
  const max = Math.max(...rows.map((r) => r.facturado), 1);
  if (!rows.length)
    return (
      <NoData
        title="Sin ventas en este período"
        description="El ranking se completa con las órdenes emitidas del rango seleccionado."
      />
    );
  return (
    <div className={shared.tableScroll}>
      <table className={shared.table} aria-label={label}>
        <thead>
          <tr>
            <th scope="col">
              {label === "Clientes principales" ? "Cliente" : "Vendedor"}
            </th>
            <th scope="col">Órdenes</th>
            <th scope="col">Ticket promedio</th>
            <th scope="col">Ventas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? r.nombre}>
              <th scope="row" data-reporte-exportar={r.nombre}>
                <div className={shared.rankName}>
                  <span aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <strong>{r.nombre}</strong>
                    <div
                      className={cn(shared.rankTrack, styles.rankingTrack)}
                      aria-hidden="true"
                    >
                      <span
                        style={{
                          width: `${Math.max(0, (r.facturado / max) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </th>
              <td>{numero(r.ordenes)}</td>
              <td>
                {formatearMoneda(
                  r.ordenes > 0 ? r.facturado / r.ordenes : 0,
                  moneda,
                )}
              </td>
              <td>{formatearMoneda(r.facturado, moneda)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Seasonality({ cells }: { cells: ComercialPanel["estacionalidad"] }) {
  const { moneda } = useConfigRegional();
  const months = [...new Set(cells.map((c) => c.mes))].sort();
  const totals = new Map<string, number>();
  const values = new Map<string, Map<string, number>>();
  for (const c of cells) {
    totals.set(c.categoria, (totals.get(c.categoria) ?? 0) + c.monto);
    if (!values.has(c.categoria)) values.set(c.categoria, new Map());
    const row = values.get(c.categoria)!;
    row.set(c.mes, (row.get(c.mes) ?? 0) + c.monto);
  }
  const categories = [...totals]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name);
  const max = Math.max(...cells.map((c) => c.monto), 1);
  if (!months.length)
    return (
      <NoData
        title="Todavía no hay historia de ventas"
        description="Este mapa reúne las ventas por categoría de los últimos 12 meses hasta el cierre del rango."
      />
    );
  return (
    <>
      <div className={cn(shared.tableScroll, styles.heatmapScroll)}>
        <table
          className={cn(shared.table, styles.heatmap)}
          aria-label="Estacionalidad por categoría"
        >
          <thead>
            <tr>
              <th scope="col">Categoría</th>
              {months.map((month) => (
                <th key={month} scope="col">
                  {fechaDelReporte(`${month}-01`, "mes")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category}>
                <th scope="row">{category}</th>
                {months.map((month) => {
                  const value = values.get(category)?.get(month) ?? 0;
                  const intensity =
                    value > 0 ? 8 + 22 * Math.min(1, value / max) : 0;
                  const exact = formatearMoneda(value, moneda);
                  return (
                    <td
                      key={month}
                      data-reporte-exportar={exact}
                      title={`${category} · ${fechaDelReporte(`${month}-01`, "mes")}: ${exact}`}
                    >
                      <span
                        className={styles.heatCell}
                        data-negative={value < 0}
                        style={{
                          background: `color-mix(in srgb, var(--accent) ${intensity}%, var(--canvas-background))`,
                        }}
                      >
                        <span aria-hidden="true">
                          {value === 0 ? "—" : abreviarMoneda(value, moneda)}
                        </span>
                        <span className="sr-only">{exact}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.heatmapFoot}>
        <p>
          Hasta 8 categorías con más ventas. Se muestran los meses con actividad
          dentro de los últimos 12 meses; un guion indica cero ventas.
        </p>
        <span className={styles.heatLegend}>
          <span>Menor venta</span>
          <i aria-hidden="true" />
          <span>Mayor venta</span>
        </span>
      </div>
      <p className={styles.cardNote}>
        Esta vista muestra la historia disponible. Un índice estacional requiere
        al menos dos años de datos.
      </p>
    </>
  );
}

export function ReporteComercial({
  d,
}: {
  d: ComercialPanel & { meta: MetaPanel };
}) {
  const { moneda } = useConfigRegional();
  const k = d.kpis;
  const money = (n: number) => formatearMoneda(n, moneda);
  const short = (n: number) => abreviarMoneda(n, moneda);
  const date = (f: string) => fechaDelReporte(f, d.granularidad, true);
  const axisDate = (f: string) => fechaDelReporte(f, d.granularidad);
  const range = `${fechaDelReporte(d.meta.rango.desde, "dia", true)} — ${fechaDelReporte(d.meta.rango.hasta, "dia", true)}`;
  return (
    <div className={shared.report}>
      <div className={shared.periodNote}>
        <span>Lectura comercial</span>
        <span data-reporte-periodo>{range}</span>
      </div>
      <div className={shared.metrics}>
        <Metric
          label="Ventas"
          value={short(k.ventas)}
          detail={`${k.ventasDeltaPct != null ? "vs. período anterior" : "Ventas del período"} · sin IVA${k.ventasDeltaAnualPct != null ? ` · ${k.ventasDeltaAnualPct > 0 ? "+" : ""}${porcentaje(k.ventasDeltaAnualPct)} vs. año anterior` : ""}`}
          delta={k.ventasDeltaPct}
          icon={<ChartNoAxesCombinedIcon />}
          featured
        >
          <div className={shared.metricSpark}>
            <TremorSparkAreaChart
              data={d.serie}
              index="fecha"
              category="monto"
            />
          </div>
        </Metric>
        <Metric
          label="Órdenes"
          value={numero(k.ordenes)}
          detail={
            k.ordenesDeltaPct != null
              ? "vs. período anterior"
              : "Emitidas en el período"
          }
          delta={k.ordenesDeltaPct}
          icon={<ReceiptTextIcon />}
        />
        <Metric
          label="Ticket promedio"
          value={short(k.ticketPromedio)}
          detail={`${numero(k.itemsPorOrden)} ítems por orden · sin IVA`}
          icon={<LayersIcon />}
          hint="Ventas netas divididas por la cantidad de órdenes del período."
        />
        <Metric
          label="Clientes nuevos"
          value={numero(k.nuevosClientes)}
          detail="Primera compra en el período"
          icon={<UserPlusIcon />}
          hint="Se consulta todo el historial para identificar clientes cuya primera orden emitida está dentro del rango."
        />
        <Metric
          label="Clientes dormidos"
          value={numero(k.clientesDormidos)}
          detail="Recurrentes sin actividad reciente"
          icon={<HistoryIcon />}
          hint="Situación actual de clientes recurrentes según su historial de compras. Este indicador no depende del período seleccionado."
        />
      </div>
      <div className={styles.chartGrid}>
        <ReportCard
          title="Ventas del período"
          description={`Evolución por ${agrupacion[d.granularidad]} · importes sin IVA`}
          action={
            <ChartNoAxesCombinedIcon
              className={shared.headerIcon}
              aria-hidden="true"
            />
          }
        >
          <div className={shared.chartSummary}>
            <div>
              <span>Total de ventas</span>
              <strong>{money(k.ventas)}</strong>
            </div>
            <div>
              <span>Órdenes emitidas</span>
              <strong>{numero(k.ordenes)}</strong>
            </div>
          </div>
          {d.serie.length ? (
            <>
              <div className={shared.chartWrap}>
                <TremorAreaChart
                  data={d.serie}
                  index="fecha"
                  categories={[
                    { key: "monto", label: "Ventas", color: "var(--accent)" },
                  ]}
                  valueFormatter={money}
                  axisFormatter={short}
                  labelFormatter={date}
                  tickFormatter={axisDate}
                  label="Ventas por período"
                />
              </div>
              <DataDetails title="Ver datos de ventas">
                <table className={shared.table} aria-label="Datos de ventas">
                  <thead>
                    <tr>
                      <th scope="col">Período</th>
                      <th scope="col">Ventas sin IVA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.serie.map((p) => (
                      <tr key={p.fecha}>
                        <th scope="row">{date(p.fecha)}</th>
                        <td>{money(p.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataDetails>
            </>
          ) : (
            <NoData
              title="Sin ventas en este período"
              description="Probá otro rango para consultar la evolución de las órdenes emitidas."
            />
          )}
        </ReportCard>
        <ReportCard
          title="Mix por categoría"
          description="Qué categorías aportan a tus ventas · sin IVA"
        >
          <SalesMix rows={d.mixCategoria} />
        </ReportCard>
        <ReportCard
          title="Evolución del ticket"
          description={`Promedio y mediana por orden · agrupados por ${agrupacion[d.granularidad]}`}
        >
          {d.serieTicket.length ? (
            <>
              <div className={shared.chartWrap}>
                <TremorAreaChart
                  data={d.serieTicket}
                  index="fecha"
                  categories={[
                    {
                      key: "ticketPromedio",
                      label: "Promedio",
                      color: "var(--brand-graphite)",
                    },
                    {
                      key: "ticketMediana",
                      label: "Mediana",
                      color: "var(--accent)",
                      dashed: true,
                    },
                  ]}
                  valueFormatter={money}
                  axisFormatter={short}
                  labelFormatter={date}
                  tickFormatter={axisDate}
                  label="Ticket promedio y mediana por período"
                />
              </div>
              <p className={styles.cardNote}>
                La mediana representa la orden del medio. Si el promedio queda
                muy por encima, unas pocas órdenes de mayor importe pueden estar
                elevándolo.
              </p>
              <DataDetails title="Ver datos del ticket">
                <table className={shared.table} aria-label="Datos del ticket">
                  <thead>
                    <tr>
                      <th scope="col">Período</th>
                      <th scope="col">Órdenes</th>
                      <th scope="col">Promedio</th>
                      <th scope="col">Mediana</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.serieTicket.map((p) => (
                      <tr key={p.fecha}>
                        <th scope="row">{date(p.fecha)}</th>
                        <td>{numero(p.ordenes)}</td>
                        <td>{money(p.ticketPromedio)}</td>
                        <td>{money(p.ticketMediana)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataDetails>
            </>
          ) : (
            <NoData
              title="Sin órdenes para calcular el ticket"
              description="El promedio y la mediana se muestran cuando hay órdenes emitidas en el período."
            />
          )}
        </ReportCard>
        <ReportCard
          title="Mix por tecnología"
          description="Participación sobre las ventas · sin IVA"
        >
          <SalesMix rows={d.mixTecnologia} technology />
        </ReportCard>
      </div>
      <ReportCard
        title="Estacionalidad por categoría"
        description="Ventas por mes · últimos 12 meses hasta el cierre del rango · sin IVA"
      >
        <Seasonality cells={d.estacionalidad} />
      </ReportCard>
      <div className={styles.rankings}>
        <ReportCard
          title="Clientes principales"
          description="Ordenados por ventas del período · sin IVA"
        >
          <Ranking rows={d.rankingClientes} label="Clientes principales" />
        </ReportCard>
        <ReportCard
          title="Ranking de vendedores"
          description="Ventas atribuidas por vendedor · sin IVA"
        >
          <Ranking rows={d.rankingVendedores} label="Ranking de vendedores" />
        </ReportCard>
      </div>
      <ReportCard
        title="Clientes dormidos"
        description="Clientes recurrentes que dejaron de comprar · situación actual, independiente del rango"
        action={
          <HistoryIcon className={shared.headerIcon} aria-hidden="true" />
        }
      >
        {d.dormidos.length ? (
          <div className={shared.tableScroll}>
            <table className={shared.table} aria-label="Clientes dormidos">
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col">Última compra</th>
                  <th scope="col">Sin comprar</th>
                  <th scope="col">Órdenes históricas</th>
                </tr>
              </thead>
              <tbody>
                {d.dormidos.map((c) => (
                  <tr key={c.clienteId ?? c.cliente}>
                    <th scope="row">{c.cliente}</th>
                    <td>{fechaDelReporte(c.ultimaCompra, "dia", true)}</td>
                    <td>
                      <span className={styles.inactiveDays}>
                        {numero(c.diasSinComprar)} días
                      </span>
                    </td>
                    <td>{numero(c.historico)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <NoData
            title="Sin clientes dormidos identificados"
            description="No hay clientes recurrentes que cumplan el criterio de inactividad actual."
          />
        )}
      </ReportCard>
      <ReportSource meta={d.meta} />
    </div>
  );
}
