"use client";

import { type ReactNode } from "react";
import {
  ChartColumnStackedIcon,
  ChevronDownIcon,
  Clock3Icon,
  HistoryIcon,
  Layers3Icon,
  Repeat2Icon,
  TargetIcon,
  UserPlusIcon,
  UserRoundIcon,
  UsersRoundIcon,
  WalletIcon,
} from "lucide-react";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { abreviarMoneda, formatearMoneda } from "@/lib/moneda";
import { fechaDelReporte } from "@/lib/reporte-resumen";
import type {
  ClientesPanel,
  SegmentoRfmPanel,
  TabPanel,
} from "@/lib/panel-api";
import { cn } from "@/lib/utils";
import { TremorBarChart } from "./charts/tremor-charts";
import { Metric, NoData, ReportCard, ReportSource } from "./reportes-ui";
import shared from "./reportes.module.css";
import styles from "./reporte-clientes.module.css";

const numero = (v: number) =>
  v.toLocaleString("es-AR", { maximumFractionDigits: 2 });
const porcentaje = (v: number | null) => (v == null ? "—" : `${numero(v)}%`);
const fecha = (value: string) => fechaDelReporte(value, "dia", true);

function reglasDeSegmentos(
  dias: number,
): Record<SegmentoRfmPanel, { label: string; regla: string; tone: string }> {
  return {
    campeones: {
      label: "Campeones",
      regla: `4 o más órdenes · última compra hace ${dias} días o menos`,
      tone: "graphite",
    },
    leales: {
      label: "Leales",
      regla: `2 a 3 órdenes · última compra hace ${dias} días o menos`,
      tone: "success",
    },
    nuevos: {
      label: "Nuevos",
      regla: `Una sola orden · compra hace ${dias} días o menos`,
      tone: "accent",
    },
    en_riesgo: {
      label: "En riesgo",
      regla: `2 o más órdenes · sin comprar entre ${dias + 1} y ${dias * 3} días`,
      tone: "warning",
    },
    perdidos: {
      label: "Perdidos",
      regla: `2 o más órdenes · sin comprar hace más de ${dias * 3} días`,
      tone: "danger",
    },
    ocasionales: {
      label: "Ocasionales",
      regla: `Una sola orden · sin comprar hace más de ${dias} días`,
      tone: "muted",
    },
  };
}

function Scroll({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      className={cn(shared.tableScroll, styles.scroll)}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
function Cliente({ nombre, detail }: { nombre: string; detail?: string }) {
  return (
    <div className={styles.client}>
      <span className={styles.clientIcon}>
        <UserRoundIcon aria-hidden="true" />
      </span>
      <div>
        <strong>{nombre}</strong>
        {detail ? <small>{detail}</small> : null}
      </div>
    </div>
  );
}
function Track({ value, tone = "accent" }: { value: number; tone?: string }) {
  return (
    <div className={styles.track} aria-hidden="true" data-tone={tone}>
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function ReporteClientes({ d }: { d: TabPanel<ClientesPanel> }) {
  const { moneda } = useConfigRegional();
  const money = (v: number) => formatearMoneda(v, moneda);
  const k = d.kpis;
  const serie = d.serieNuevosRecurrentes;
  const ventasNuevos = serie.reduce((sum, s) => sum + s.nuevos, 0);
  const ventasRecurrentes = serie.reduce((sum, s) => sum + s.recurrentes, 0);
  const totalCartera = d.rfm.segmentos.reduce((sum, s) => sum + s.clientes, 0);
  const totalRiesgo =
    d.rfm.segmentos.find((s) => s.segmento === "en_riesgo")?.clientes ??
    d.rfm.enRiesgo.length;
  const reglas = reglasDeSegmentos(d.rfm.diasActivo);
  const gran = d.granularidad;
  const agrupacion =
    gran === "dia" ? "día" : gran === "semana" ? "semana" : "mes";
  const fechaSerie = (v: string, completa = false) =>
    `${gran === "semana" && completa ? "Semana del " : ""}${fechaDelReporte(v, gran, completa)}`;
  const margenes = d.margenClientes ?? [];

  return (
    <div className={shared.report}>
      <div className={shared.periodNote}>
        <span>Lectura de clientes</span>
        <span>Ventas y actividad del período seleccionado</span>
      </div>
      <div className={shared.metrics}>
        <Metric
          featured
          label="Clientes activos"
          value={numero(k.activos)}
          detail="Compraron durante el período"
          icon={<UsersRoundIcon />}
        />
        <Metric
          label="Retención"
          value={porcentaje(k.retencionPct)}
          detail={
            k.retencionPct == null
              ? "Sin clientes en el período anterior"
              : "Del período anterior que volvieron"
          }
          hint="Porcentaje de clientes del período anterior equivalente que también compraron en el período seleccionado."
          icon={<Repeat2Icon />}
        />
        <Metric
          label="Recompra histórica"
          value={
            k.frecuenciaMedianaDias == null
              ? "—"
              : `${numero(k.frecuenciaMedianaDias)} días`
          }
          detail="Mediana histórica entre compras"
          hint="Mediana de los intervalos entre órdenes del mismo cliente en todo el historial. Se muestra con al menos cinco intervalos; no depende del período seleccionado."
          icon={<Clock3Icon />}
        />
        <Metric
          label="Clientes nuevos"
          value={numero(k.nuevos)}
          detail={`Primera compra en el período · ${numero(k.recurrentes)} recurrentes`}
          icon={<UserPlusIcon />}
        />
        <Metric
          label="Concentración · top 3"
          value={porcentaje(k.concentracionTop3Pct)}
          detail="De las ventas con cliente identificado"
          hint="Participación conjunta de hasta tres clientes con más ventas en el período. Con menos de tres clientes, incluye sólo los existentes."
          icon={<TargetIcon />}
        />
      </div>

      <ReportCard
        title="Ventas de nuevos y recurrentes"
        description={`Origen de las ventas por ${agrupacion} · sin IVA`}
        action={
          <ChartColumnStackedIcon
            className={shared.headerIcon}
            aria-hidden="true"
          />
        }
      >
        {serie.length ? (
          <>
            <div className={styles.salesSummary}>
              <div>
                <span>Ventas de nuevos</span>
                <strong>{money(ventasNuevos)}</strong>
              </div>
              <div>
                <span>Ventas de recurrentes</span>
                <strong>{money(ventasRecurrentes)}</strong>
              </div>
              <span className={styles.scopeTag}>Período seleccionado</span>
            </div>
            <div className={shared.chartWrap}>
              <TremorBarChart
                data={serie}
                index="fecha"
                categories={[
                  {
                    key: "recurrentes",
                    label: "Recurrentes",
                    color: "var(--brand-graphite)",
                  },
                  { key: "nuevos", label: "Nuevos", color: "var(--accent)" },
                ]}
                valueFormatter={money}
                axisFormatter={(v) => abreviarMoneda(v, moneda)}
                labelFormatter={(v) => fechaSerie(v, true)}
                tickFormatter={(v) => fechaSerie(v)}
                label="Ventas de clientes nuevos y recurrentes"
                height={270}
              />
            </div>
            <details className={shared.dataDetails}>
              <summary>
                Ver datos de nuevos y recurrentes
                <ChevronDownIcon size={14} aria-hidden="true" />
              </summary>
              <Scroll label="Datos de nuevos y recurrentes">
                <table
                  className={shared.table}
                  aria-label="Datos de nuevos y recurrentes"
                >
                  <thead>
                    <tr>
                      <th scope="col">
                        {gran === "semana" ? "Semana desde" : "Período"}
                      </th>
                      <th scope="col">Ventas de nuevos</th>
                      <th scope="col">Ventas de recurrentes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serie.map((s) => (
                      <tr key={s.fecha}>
                        <th scope="row">
                          {fechaDelReporte(s.fecha, gran, true)}
                        </th>
                        <td>{money(s.nuevos)}</td>
                        <td>{money(s.recurrentes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Scroll>
            </details>
          </>
        ) : (
          <NoData
            title="Sin ventas con cliente en el período"
            description="La evolución aparece al registrar ventas en órdenes con un cliente identificado."
          />
        )}
        <p className={styles.note}>
          En cada {agrupacion}, “Nuevos” reúne las ventas de clientes cuya
          primera compra ocurrió en ese mismo {agrupacion}. Sus compras en los
          siguientes se muestran como recurrentes. El indicador de clientes
          nuevos cuenta clientes únicos en todo el período.
        </p>
      </ReportCard>

      <div className={d.margenesVisibles ? shared.detailGrid : undefined}>
        <ReportCard
          title="Concentración de cartera"
          description="Hasta 10 clientes por importe de ventas del período"
          action={
            <TargetIcon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          {d.pareto.length ? (
            <Scroll label="Concentración de cartera">
              <table
                className={cn(shared.table, styles.portfolioTable)}
                aria-label="Concentración de cartera"
              >
                <thead>
                  <tr>
                    <th scope="col">Cliente</th>
                    <th scope="col">Órdenes</th>
                    <th scope="col">Ventas</th>
                    <th scope="col">Participación</th>
                    <th scope="col">Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {d.pareto.map((c) => (
                    <tr key={c.clienteId}>
                      <th scope="row">
                        <Cliente nombre={c.cliente} />
                        <Track value={c.pct} />
                      </th>
                      <td>{numero(c.ordenes)}</td>
                      <td className={styles.amount}>{money(c.facturado)}</td>
                      <td>{porcentaje(c.pct)}</td>
                      <td>
                        <span className={styles.accumulated}>
                          {porcentaje(c.pctAcumulado)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroll>
          ) : (
            <NoData
              title="Sin cartera para distribuir"
              description="Los clientes con ventas en el período se ordenan por su participación."
            />
          )}
          <p className={styles.note}>
            Participación sobre todas las ventas del período con cliente
            identificado. El acumulado suma las filas desde arriba; los diez
            clientes mostrados pueden representar menos del 100%.
          </p>
        </ReportCard>
        {d.margenesVisibles ? (
          <ReportCard
            title="Margen por cliente"
            description="Hasta 10 clientes por ventas del período · sin IVA"
            action={
              <WalletIcon className={shared.headerIcon} aria-hidden="true" />
            }
          >
            {margenes.length ? (
              <Scroll label="Margen por cliente">
                <table
                  className={cn(shared.table, styles.marginTable)}
                  aria-label="Margen por cliente"
                >
                  <thead>
                    <tr>
                      <th scope="col">Cliente</th>
                      <th scope="col">Órdenes</th>
                      <th scope="col">Ventas</th>
                      <th scope="col">Margen</th>
                      <th scope="col">Margen %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {margenes.map((c) => {
                      const detail =
                        c.itemsSinCosto > 0
                          ? `${numero(c.itemsSinCosto)} ${c.itemsSinCosto === 1 ? "ítem sin costo" : "ítems sin costo"} · fuera del margen`
                          : undefined;
                      return (
                        <tr key={c.clienteId ?? c.cliente}>
                          <th
                            scope="row"
                            data-reporte-exportar={`${c.cliente}${detail ? ` · ${detail}` : ""}`}
                          >
                            <Cliente nombre={c.cliente} detail={detail} />
                          </th>
                          <td>{numero(c.ordenes)}</td>
                          <td>{money(c.ventas)}</td>
                          <td data-negative={c.margen < 0}>
                            {money(c.margen)}
                          </td>
                          <td
                            data-negative={
                              c.margenPct != null && c.margenPct < 0
                            }
                          >
                            {porcentaje(c.margenPct)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Scroll>
            ) : (
              <NoData
                title="Sin ventas para analizar margen"
                description="El detalle se completa con las órdenes emitidas en el período."
              />
            )}
            <p className={styles.note}>
              Ventas incluye todos los ítems. El margen y su porcentaje se
              calculan únicamente sobre los ítems con costo guardado; los
              restantes se indican junto al cliente.
            </p>
          </ReportCard>
        ) : null}
      </div>

      <div className={styles.sectionHeading}>
        <div>
          <HistoryIcon aria-hidden="true" />
          <strong>Cartera actual</strong>
        </div>
        <span>
          Situación de hoy · historial completo, independiente del período
        </span>
      </div>
      <div className={styles.historyGrid}>
        <ReportCard
          title="Segmentos de cartera"
          description="Según la cantidad de órdenes y la última compra"
          action={
            <Layers3Icon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          <div className={styles.historySummary}>
            <span>
              <strong>{numero(totalCartera)}</strong> clientes con historial
            </span>
            <span>
              Actividad reciente: hasta {numero(d.rfm.diasActivo)} días
            </span>
          </div>
          {totalCartera > 0 ? (
            <Scroll label="Segmentos actuales de cartera">
              <table
                className={cn(shared.table, styles.segmentTable)}
                aria-label="Segmentos actuales de cartera"
              >
                <thead>
                  <tr>
                    <th scope="col">Segmento y regla</th>
                    <th scope="col">Clientes</th>
                    <th scope="col">Ventas históricas</th>
                  </tr>
                </thead>
                <tbody>
                  {d.rfm.segmentos.map((s) => {
                    const regla = reglas[s.segmento];
                    return (
                      <tr key={s.segmento}>
                        <th
                          scope="row"
                          data-reporte-exportar={`${regla.label} · ${regla.regla}`}
                        >
                          <span
                            className={styles.segmentLabel}
                            data-tone={regla.tone}
                          >
                            <i aria-hidden="true" />
                            {regla.label}
                          </span>
                          <small>{regla.regla}</small>
                          <Track
                            value={(s.clientes / totalCartera) * 100}
                            tone={regla.tone}
                          />
                        </th>
                        <td>{numero(s.clientes)}</td>
                        <td>{money(s.facturado)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Scroll>
          ) : (
            <NoData
              title="Sin historial para segmentar"
              description="Los segmentos se forman con clientes que tienen órdenes emitidas."
            />
          )}
          <p className={styles.note}>
            Los importes acumulan todo el historial, sin IVA. El segmento
            “Nuevos” incluye una sola orden reciente; puede diferir del
            indicador de nuevos clientes del período.
          </p>
        </ReportCard>
        <ReportCard
          title="Clientes en riesgo"
          description={`Recurrentes sin comprar entre ${d.rfm.diasActivo + 1} y ${d.rfm.diasActivo * 3} días`}
          action={
            <HistoryIcon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          {d.rfm.enRiesgo.length ? (
            <>
              <div className={styles.riskSummary}>
                <strong>{numero(totalRiesgo)}</strong>
                <div>
                  <span>
                    {totalRiesgo === 1
                      ? "cliente en este segmento"
                      : "clientes en este segmento"}
                  </span>
                  <small>Hasta ocho, ordenados por ventas históricas</small>
                </div>
              </div>
              <Scroll label="Clientes actualmente en riesgo">
                <table
                  className={cn(shared.table, styles.riskTable)}
                  aria-label="Clientes actualmente en riesgo"
                >
                  <thead>
                    <tr>
                      <th scope="col">Cliente</th>
                      <th scope="col">Sin comprar</th>
                      <th scope="col">Ventas históricas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.rfm.enRiesgo.map((c) => {
                      const detalle = `${numero(c.ordenes)} órdenes · última compra ${fecha(c.ultimaCompra)}`;
                      return (
                        <tr key={c.clienteId}>
                          <th
                            scope="row"
                            data-reporte-exportar={`${c.cliente} · ${detalle}`}
                          >
                            <Cliente nombre={c.cliente} detail={detalle} />
                          </th>
                          <td>
                            <span className={styles.inactiveDays}>
                              {numero(c.diasSinComprar)} días
                            </span>
                          </td>
                          <td>{money(c.facturadoHistorico)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Scroll>
            </>
          ) : (
            <NoData
              title={
                totalCartera > 0
                  ? "Sin clientes en este tramo de riesgo"
                  : "Sin historial de clientes"
              }
              description={
                totalCartera > 0
                  ? `No hay recurrentes cuya última compra esté entre ${d.rfm.diasActivo + 1} y ${d.rfm.diasActivo * 3} días atrás.`
                  : "La actividad histórica permitirá identificar a los clientes que dejan de comprar."
              }
            />
          )}
          <p className={styles.note}>
            Con más de {d.rfm.diasActivo * 3} días sin comprar, un recurrente
            pasa al segmento “Perdidos”. Los umbrales siguen la configuración de
            tu negocio.
          </p>
        </ReportCard>
      </div>
      <ReportSource meta={d.meta} />
    </div>
  );
}
