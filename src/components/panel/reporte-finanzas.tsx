"use client";

import {
  ChartNoAxesCombinedIcon,
  ChevronDownIcon,
  CirclePercentIcon,
  LandmarkIcon,
  ReceiptTextIcon,
  TargetIcon,
  WalletIcon,
} from "lucide-react";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { abreviarMoneda, formatearMoneda } from "@/lib/moneda";
import { fechaDelReporte } from "@/lib/reporte-resumen";
import type { FinanzasData, FranjaAgingPanel } from "@/lib/panel-api";
import { cn } from "@/lib/utils";
import { Metric, NoData, ReportCard, ReportSource } from "./reportes-ui";
import { TremorBarChart } from "./charts/tremor-charts";
import shared from "./reportes.module.css";
import styles from "./reporte-finanzas.module.css";

const numero = (v: number) =>
  v.toLocaleString("es-AR", { maximumFractionDigits: 1 });
const porcentaje = (v: number) => `${numero(v)}%`;
const franjas: Array<{ key: FranjaAgingPanel; label: string; color: string }> =
  [
    { key: "A vencer", label: "A vencer", color: "var(--success)" },
    { key: "0-30", label: "1–30 días", color: "var(--muted-text)" },
    { key: "31-60", label: "31–60 días", color: "var(--warning)" },
    { key: "61-90", label: "61–90 días", color: "var(--accent)" },
    { key: "+90", label: "Más de 90 días", color: "var(--danger)" },
  ];

/** El color acompaña la etiqueta y el importe; nunca es la única lectura. */
function DebtDistribution({
  amounts,
}: {
  amounts: Partial<Record<FranjaAgingPanel, number>>;
}) {
  const total = franjas.reduce(
    (sum, f) => sum + Math.max(0, amounts[f.key] ?? 0),
    0,
  );
  return (
    <div className={styles.debtBar} aria-hidden="true">
      {franjas.map((f) => {
        const value = amounts[f.key] ?? 0;
        return value > 0 && total > 0 ? (
          <span
            key={f.key}
            style={{ flexGrow: value / total, background: f.color }}
          />
        ) : null;
      })}
    </div>
  );
}

export function ReporteFinanzas({ d }: { d: FinanzasData }) {
  const { moneda } = useConfigRegional();
  const r = d.rentabilidad;
  const co = d.cobranza;
  const gasto = r.gastoPorCategoria ?? [];
  const money = (v: number | null | undefined) =>
    v == null ? "—" : formatearMoneda(v, moneda);
  const short = (v: number) => abreviarMoneda(v, moneda);
  const range = `${fechaDelReporte(d.meta.rango.desde, "dia", true)} — ${fechaDelReporte(d.meta.rango.hasta, "dia", true)}`;
  const aging = Object.fromEntries(co.aging.map((a) => [a.franja, a.monto]));
  const hasComparison =
    r.ventas !== 0 || (r.costoTotal != null && r.costoTotal !== 0);
  const resultRows = [
    { label: "Ventas", value: r.ventas, detail: "Órdenes emitidas · sin IVA" },
    {
      label: "Costo directo",
      value: r.costoTotal,
      detail: "Costo registrado de los trabajos vendidos",
    },
    {
      label: "Margen bruto",
      value: r.margenBruto,
      detail: `${porcentaje(r.margenBrutoPct)} sobre ventas`,
    },
    {
      label: "Costos variables",
      value: r.costosVariables,
      detail: "Base del margen de contribución",
    },
    {
      label: "Contribución",
      value: r.contribucion,
      detail: `${porcentaje(r.contribucionPct)} sobre ventas`,
    },
    {
      label: "Gastos fijos",
      value: r.costosFijos,
      detail: "Prorrateados para el rango seleccionado",
    },
    {
      label: "Punto de equilibrio",
      value: r.puntoEquilibrio,
      detail:
        r.avancePct != null
          ? `${porcentaje(r.avancePct)} cubierto`
          : "Sin base para calcularlo",
    },
  ];

  return (
    <div className={shared.report}>
      <div className={shared.periodNote}>
        <span>Lectura financiera</span>
        <span data-reporte-periodo>{range}</span>
      </div>
      <div className={shared.metrics}>
        <Metric
          label="Ventas"
          value={short(r.ventas)}
          detail={
            r.ventasDeltaPct != null
              ? "vs. período anterior · sin IVA"
              : "Órdenes emitidas · sin IVA"
          }
          delta={r.ventasDeltaPct}
          icon={<ChartNoAxesCombinedIcon />}
          featured
        />
        <Metric
          label="Contribución"
          value={porcentaje(r.contribucionPct)}
          detail={`${money(r.contribucion)} · ventas menos variables`}
          icon={<CirclePercentIcon />}
          hint="La contribución resta los costos variables a las ventas. Es la base que utiliza el sistema para calcular el punto de equilibrio."
        />
        <Metric
          label="Punto de equilibrio"
          value={r.puntoEquilibrio != null ? short(r.puntoEquilibrio) : "—"}
          detail={
            r.avancePct != null
              ? `${porcentaje(r.avancePct)} cubierto por las ventas`
              : "Sin base para calcularlo"
          }
          icon={<TargetIcon />}
          hint="Nivel de ventas necesario para cubrir los gastos fijos con el margen de contribución del período."
        />
        <Metric
          label="Cuentas por cobrar hoy"
          value={short(co.agingTotal)}
          detail={
            co.dso != null
              ? `DSO estimado · ${numero(co.dso)} días`
              : "DSO no calculable en este período"
          }
          icon={<WalletIcon />}
          hint="El saldo pendiente es actual. El DSO estima cuántos días de ventas finalizadas del período representa esa deuda; no es el promedio real del tiempo que tarda cada cobro."
        />
        <Metric
          label="Costo de cobrar"
          value={short(co.comisionTotal)}
          detail="Comisiones de los cobros del período"
          icon={<ReceiptTextIcon />}
        />
      </div>

      <div className={styles.primaryGrid}>
        <ReportCard
          title="Ventas vs costo"
          description="Totales del período seleccionado · sin IVA"
          action={
            <ChartNoAxesCombinedIcon
              className={shared.headerIcon}
              aria-hidden="true"
            />
          }
        >
          <div className={cn(shared.chartSummary, styles.comparisonSummary)}>
            <div>
              <span>Ventas</span>
              <strong>{money(r.ventas)}</strong>
            </div>
            <div>
              <span>Costo directo</span>
              <strong>{money(r.costoTotal)}</strong>
            </div>
            <div>
              <span>Margen bruto · {porcentaje(r.margenBrutoPct)}</span>
              <strong data-negative={r.margenBruto < 0}>
                {money(r.margenBruto)}
              </strong>
            </div>
          </div>
          {hasComparison ? (
            <div className={shared.chartWrap}>
              <TremorBarChart
                data={[
                  {
                    periodo: "Total del período",
                    ventas: r.ventas,
                    costo: r.costoTotal ?? null,
                  },
                ]}
                index="periodo"
                mode="grouped"
                categories={[
                  { key: "ventas", label: "Ventas", color: "var(--accent)" },
                  {
                    key: "costo",
                    label: "Costo directo",
                    color: "var(--brand-graphite)",
                  },
                ]}
                valueFormatter={money}
                axisFormatter={short}
                labelFormatter={() => range}
                label="Comparación de ventas y costo del período"
                height={245}
              />
            </div>
          ) : (
            <NoData
              title="Sin actividad de ventas y costos"
              description="Elegí otro período para comparar las ventas y los costos de los trabajos."
            />
          )}
          <details className={shared.dataDetails}>
            <summary>
              Ver datos del resultado
              <ChevronDownIcon aria-hidden="true" />
            </summary>
            <div className={shared.tableScroll}>
              <table
                className={shared.table}
                aria-label="Datos del resultado financiero"
              >
                <thead>
                  <tr>
                    <th scope="col">Concepto</th>
                    <th scope="col">Importe</th>
                    <th scope="col">Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {resultRows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td data-negative={row.value != null && row.value < 0}>
                        {money(row.value)}
                      </td>
                      <td className={styles.reference}>{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </ReportCard>

        <ReportCard
          title="Cuentas por cobrar hoy"
          description="Saldo comercial actual · independiente del período"
          action={<span className={styles.currentBadge}>Hoy</span>}
        >
          <div className={cn(shared.chartSummary, styles.agingSummary)}>
            <div>
              <span>Total pendiente</span>
              <strong>{money(co.agingTotal)}</strong>
            </div>
            <div>
              <span>Saldo vencido</span>
              <strong data-overdue={co.vencido > 0}>{money(co.vencido)}</strong>
            </div>
          </div>
          {co.agingTotal > 0 ? (
            <>
              <div className={styles.agingBar}>
                <DebtDistribution amounts={aging} />
              </div>
              <div className={shared.tableScroll}>
                <table
                  className={cn(shared.table, styles.agingTable)}
                  aria-label="Cuentas por cobrar por antigüedad"
                >
                  <thead>
                    <tr>
                      <th scope="col">Antigüedad</th>
                      <th
                        scope="col"
                        aria-label="Participación"
                        data-reporte-exportar="Participación"
                      >
                        %
                      </th>
                      <th scope="col">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {franjas.map((f) => {
                      const amount = aging[f.key] ?? 0;
                      return (
                        <tr key={f.key}>
                          <th scope="row">
                            <span className={styles.franjaLabel}>
                              <i
                                style={{ background: f.color }}
                                aria-hidden="true"
                              />
                              {f.label}
                            </span>
                          </th>
                          <td>{porcentaje((amount / co.agingTotal) * 100)}</td>
                          <td>{money(amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <NoData
              title="Sin deuda pendiente"
              description="No hay saldo comercial por cobrar en las órdenes finalizadas o entregadas."
            />
          )}
          <p className={styles.cardNote}>
            La antigüedad se mide desde el vencimiento comercial; si no está
            definido, desde la finalización de la orden.
          </p>
        </ReportCard>
      </div>

      <div className={styles.secondaryGrid}>
        <ReportCard
          title="Costo de cobrar"
          description="Comisiones por método de pago · cobros del período"
          action={
            <ReceiptTextIcon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          {co.costoCobrar.length ? (
            <>
              <div className={styles.sectionTotal}>
                <span>Comisiones del período</span>
                <strong>{money(co.comisionTotal)}</strong>
              </div>
              <div className={shared.tableScroll}>
                <table
                  className={shared.table}
                  aria-label="Comisiones por método de pago"
                >
                  <thead>
                    <tr>
                      <th scope="col">Método</th>
                      <th scope="col">Cobros</th>
                      <th scope="col">Bruto</th>
                      <th scope="col">Comisión</th>
                      <th scope="col">Neto</th>
                      <th scope="col">Comisión %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {co.costoCobrar.map((m) => (
                      <tr key={m.metodo}>
                        <th scope="row">{m.metodo}</th>
                        <td>{m.cantidad.toLocaleString("es-AR")}</td>
                        <td>{money(m.bruto)}</td>
                        <td
                          className={styles.commission}
                          data-has-fee={m.comision > 0}
                        >
                          {money(m.comision)}
                        </td>
                        <td>{money(m.neto)}</td>
                        <td>{porcentaje(m.pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={styles.cardNote}>
                La comisión incluye su IVA. El neto corresponde al importe
                acreditado registrado en cada cobro.
              </p>
            </>
          ) : (
            <NoData
              title="Sin cobros en el período"
              description="Al registrar cobros, vas a ver aquí sus importes y las comisiones de cada método de pago."
            />
          )}
        </ReportCard>

        <ReportCard
          title="Gasto fijo por categoría"
          description="Estructura prorrateada para el rango seleccionado"
          action={
            <LandmarkIcon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          {gasto.length ? (
            <>
              <div className={styles.sectionTotal}>
                <span>Gastos fijos del período</span>
                <strong>{money(r.costosFijos)}</strong>
              </div>
              <div className={shared.tableScroll}>
                <table
                  className={cn(shared.table, styles.expenses)}
                  aria-label="Gastos fijos por categoría"
                >
                  <thead>
                    <tr>
                      <th scope="col">Categoría</th>
                      <th
                        scope="col"
                        aria-label="Participación"
                        data-reporte-exportar="Participación"
                      >
                        %
                      </th>
                      <th scope="col">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gasto.map((g) => (
                      <tr key={g.categoria}>
                        <th scope="row">
                          {g.categoria}
                          <div
                            className={cn(
                              shared.rankTrack,
                              styles.expenseTrack,
                            )}
                            aria-hidden="true"
                          >
                            <span
                              style={{
                                width: `${Math.min(100, Math.max(0, g.pct))}%`,
                              }}
                            />
                          </div>
                        </th>
                        <td>{porcentaje(g.pct)}</td>
                        <td data-negative={g.monto < 0}>{money(g.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <NoData
              title="Sin gastos fijos de estructura"
              description="No hay gastos fijos vigentes para este rango. Se necesitan para calcular el punto de equilibrio."
            />
          )}
        </ReportCard>
      </div>

      <ReportCard
        title="Deudores principales"
        description="Saldos comerciales actuales, ordenados de mayor a menor"
        action={<span className={styles.currentBadge}>Hoy</span>}
      >
        {co.deudores.length ? (
          <>
            <div className={shared.tableScroll}>
              <table
                className={cn(shared.table, styles.debtors)}
                aria-label="Deudores principales"
              >
                <thead>
                  <tr>
                    <th scope="col">Cliente</th>
                    <th scope="col">Saldo pendiente</th>
                    <th scope="col">Mayor atraso</th>
                    <th scope="col">Distribución de la deuda</th>
                  </tr>
                </thead>
                <tbody>
                  {co.deudores.map((x) => (
                    <tr key={x.clienteId ?? x.cliente}>
                      <th scope="row">{x.cliente}</th>
                      <td className={styles.debtorBalance}>{money(x.saldo)}</td>
                      <td>
                        <span
                          className={styles.days}
                          data-overdue={x.diasMax > 60}
                        >
                          {x.diasMax > 0
                            ? `${numero(x.diasMax)} días`
                            : "Sin atraso"}
                        </span>
                      </td>
                      <td
                        className={styles.distributionCell}
                        data-reporte-exportar={franjas
                          .map(
                            (f) => `${f.label}: ${money(x.porFranja[f.key])}`,
                          )
                          .join(" · ")}
                      >
                        <DebtDistribution amounts={x.porFranja} />
                        <details className={styles.debtDetails}>
                          <summary>
                            Ver importes
                            <span className="sr-only"> de {x.cliente}</span>
                            <ChevronDownIcon aria-hidden="true" />
                          </summary>
                          <dl>
                            {franjas.map((f) => (
                              <div key={f.key}>
                                <dt>
                                  <i
                                    style={{ background: f.color }}
                                    aria-hidden="true"
                                  />
                                  {f.label}
                                </dt>
                                <dd>{money(x.porFranja[f.key])}</dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul
              className={styles.agingLegend}
              aria-label="Franjas de antigüedad"
            >
              {franjas.map((f) => (
                <li key={f.key}>
                  <i style={{ background: f.color }} aria-hidden="true" />
                  {f.label}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <NoData
            title="Sin deudores pendientes"
            description="No hay clientes con saldo comercial pendiente en las órdenes finalizadas o entregadas."
          />
        )}
      </ReportCard>
      <ReportSource meta={d.meta} />
    </div>
  );
}
