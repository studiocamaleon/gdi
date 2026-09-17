"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BadgeCheckIcon,
  BanknoteIcon,
  ChartNoAxesGanttIcon,
  ChevronDownIcon,
  Clock3Icon,
  FactoryIcon,
  FileTextIcon,
  HourglassIcon,
  ListOrderedIcon,
  TruckIcon,
} from "lucide-react";
import { SegmentedControl } from "@/components/design-system/choice-controls";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { abreviarMoneda, formatearMoneda } from "@/lib/moneda";
import type { EmbudoEtapaPanel, EmbudoPanel, TabPanel } from "@/lib/panel-api";
import {
  etapasDelEmbudo,
  referenciaDelTramo,
  type ModoEmbudo,
} from "@/lib/reporte-embudo";
import { cn } from "@/lib/utils";
import { Metric, NoData, ReportCard, ReportSource } from "./reportes-ui";
import shared from "./reportes.module.css";
import styles from "./reporte-embudo.module.css";

const numero = (v: number) =>
  v.toLocaleString("es-AR", { maximumFractionDigits: 2 });
const porcentaje = (v: number | null) => (v == null ? "—" : `${numero(v)}%`);
const ETAPAS: Record<
  EmbudoEtapaPanel["clave"],
  { label: string; detalle: string; icon: typeof FileTextIcon }
> = {
  emitidas: {
    label: "Presupuestos emitidos",
    detalle: "El punto de partida del período",
    icon: FileTextIcon,
  },
  aprobadas: {
    label: "Aprobados",
    detalle: "Aceptados o convertidos en una OT",
    icon: BadgeCheckIcon,
  },
  produccion: {
    label: "Alcanzaron producción",
    detalle: "Incluye los que ya finalizaron o se entregaron",
    icon: FactoryIcon,
  },
  entregadas: {
    label: "Entregados",
    detalle: "Con la OT marcada como entregada",
    icon: TruckIcon,
  },
};
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

export function ReporteEmbudo({ d }: { d: TabPanel<EmbudoPanel> }) {
  const { moneda } = useConfigRegional();
  const money = (v: number) => formatearMoneda(v, moneda);
  const [modo, setModo] = useState<ModoEmbudo>("cantidad");
  const k = d.kpis;
  const base = d.funnel[0]?.cantidad ?? 0;
  const etapas = etapasDelEmbudo(d.funnel, modo);
  const cantidades = etapasDelEmbudo(d.funnel, "cantidad");
  const montos = etapasDelEmbudo(d.funnel, "monto");
  const sinAprobar = d.fugas.reduce((sum, f) => sum + f.cantidad, 0);
  const importeSinAprobar = d.fugas.reduce((sum, f) => sum + f.monto, 0);
  const maxFuga = Math.max(0, ...d.fugas.map((f) => f.cantidad));
  const hayTiempos = d.velocidad.some((v) => v.diasPromedio != null);

  return (
    <div className={shared.report}>
      <div className={shared.periodNote}>
        <span>Del presupuesto a la entrega</span>
        <span>Seguimiento de los presupuestos emitidos en el período</span>
      </div>
      <div className={cn(shared.metrics, styles.metrics)}>
        <Metric
          featured
          label="Tasa de aprobación"
          value={base > 0 ? porcentaje(k.tasaAprobacion) : "—"}
          delta={
            base > 0 && !d.sinComparativa ? k.tasaAprobacionDeltaPct : null
          }
          deltaUnit="pts"
          detail={
            base > 0
              ? d.sinComparativa
                ? "Aprobados sobre emitidos · sin comparativa"
                : "Aprobados sobre emitidos · vs. período anterior"
              : "Sin presupuestos en el período"
          }
          hint="La variación compara tasas de aprobación y se expresa en puntos porcentuales. Los presupuestos recientes todavía pueden avanzar."
          icon={<BadgeCheckIcon />}
        />
        <Metric
          label="Conversión a entrega"
          value={base > 0 ? porcentaje(k.tasaEntrega) : "—"}
          detail="Entregados sobre emitidos en el período"
          hint="Cuenta sólo los presupuestos de este período cuya OT ya figura como entregada. Las etapas reflejan hasta dónde llegaron, no sólo su estado actual."
          icon={<TruckIcon />}
        />
        <Metric
          label="Presupuestos abiertos hoy"
          value={abreviarMoneda(k.pipelineAbiertoMonto, moneda)}
          detail={`${numero(k.pipelineAbiertoCantidad)} ${k.pipelineAbiertoCantidad === 1 ? "presupuesto" : "presupuestos"} · ${money(k.pipelineAbiertoMonto)} sin IVA`}
          hint="Presupuestos formales enviados que siguen sin resolver hoy, de cualquier período. No depende del filtro de fechas."
          icon={<HourglassIcon />}
        />
        <Metric
          label="Ciclo hasta finalización"
          value={
            k.cicloPromedioDias == null
              ? "—"
              : `${numero(k.cicloPromedioDias)} días`
          }
          detail="Promedio desde el envío del presupuesto"
          hint="Usa la fecha de finalización de producción de la OT. No mide el momento de entrega física al cliente. Sólo incluye casos con ambas fechas registradas."
          icon={<Clock3Icon />}
        />
      </div>

      <ReportCard
        title="Recorrido comercial"
        description="Cuánto avanzaron los presupuestos emitidos en el período"
        action={
          <ChartNoAxesGanttIcon
            className={shared.headerIcon}
            aria-hidden="true"
          />
        }
      >
        <div className={styles.toolbar}>
          <div className={styles.cohortSummary}>
            <strong>{numero(base)}</strong>
            <span>
              {base === 1 ? "presupuesto de origen" : "presupuestos de origen"}
              <small>Un mismo grupo, seguido hasta hoy</small>
            </span>
          </div>
          <SegmentedControl
            tone="graphite"
            aria-label="Medida del embudo"
            value={modo}
            onChange={(value) => setModo(value as ModoEmbudo)}
            options={[
              {
                value: "cantidad",
                label: "Cantidad",
                icon: <ListOrderedIcon aria-hidden="true" />,
              },
              {
                value: "monto",
                label: "Importe",
                icon: <BanknoteIcon aria-hidden="true" />,
              },
            ]}
          />
        </div>
        {base > 0 ? (
          <>
            <ol
              className={styles.stages}
              aria-label={`Etapas por ${modo === "cantidad" ? "cantidad" : "importe"}`}
            >
              {etapas.map((e, i) => {
                const info = ETAPAS[e.clave];
                const Icon = info.icon;
                return (
                  <li
                    key={e.clave}
                    className={styles.stage}
                    data-stage={e.clave}
                  >
                    <span className={styles.stageIcon}>
                      <Icon aria-hidden="true" />
                    </span>
                    <div className={styles.stageHeading}>
                      <span className={styles.stageIndex}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h4>{info.label}</h4>
                      <p>{info.detalle}</p>
                    </div>
                    <div className={styles.stageValue}>
                      <strong>
                        {modo === "cantidad"
                          ? numero(e.cantidad)
                          : money(e.monto)}
                      </strong>
                      <small>
                        {modo === "cantidad"
                          ? money(e.monto) + " sin IVA"
                          : `${numero(e.cantidad)} ${e.cantidad === 1 ? "presupuesto" : "presupuestos"}`}
                      </small>
                    </div>
                    <div className={styles.stageProgress}>
                      <div className={styles.track} aria-hidden="true">
                        <span style={{ width: `${e.anchoPct}%` }} />
                      </div>
                      <span>
                        {e.share == null
                          ? "Sin importe base"
                          : `${porcentaje(e.share)} de lo emitido`}
                      </span>
                    </div>
                    <div className={styles.conversion}>
                      {i === 0 ? (
                        <>
                          <FileTextIcon aria-hidden="true" />
                          <span>Base del recorrido</span>
                        </>
                      ) : (
                        <>
                          <ArrowDownRightIcon aria-hidden="true" />
                          <span>
                            {e.conversion == null ? (
                              "Sin base para comparar"
                            ) : (
                              <>
                                <strong>{porcentaje(e.conversion)}</strong> de
                                la etapa anterior
                              </>
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            <details className={shared.dataDetails}>
              <summary>
                Ver cantidades, importes y conversiones
                <ChevronDownIcon size={14} aria-hidden="true" />
              </summary>
              <Scroll label="Datos del recorrido comercial">
                <table
                  className={shared.table}
                  aria-label="Datos del recorrido comercial"
                >
                  <thead>
                    <tr>
                      <th scope="col">Etapa alcanzada</th>
                      <th scope="col">Presupuestos</th>
                      <th scope="col">% de emitidos</th>
                      <th scope="col">Conversión por cantidad</th>
                      <th scope="col">Importe sin IVA</th>
                      <th scope="col">% del importe emitido</th>
                      <th scope="col">Conversión por importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cantidades.map((e, i) => (
                      <tr key={e.clave}>
                        <th scope="row">{ETAPAS[e.clave].label}</th>
                        <td>{numero(e.cantidad)}</td>
                        <td>{porcentaje(e.share)}</td>
                        <td>{porcentaje(e.conversion)}</td>
                        <td>{money(e.monto)}</td>
                        <td>{porcentaje(montos[i].share)}</td>
                        <td>{porcentaje(montos[i].conversion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Scroll>
            </details>
          </>
        ) : (
          <NoData
            title="Sin presupuestos emitidos en el período"
            description="El recorrido se forma con presupuestos formales enviados dentro de las fechas seleccionadas."
          />
        )}
        <div className={styles.notes}>
          <p>
            Cada etapa incluye a quienes la alcanzaron y siguieron avanzando.
            Las conversiones comparan una etapa con la anterior; el porcentaje
            de lo emitido compara con el inicio.
          </p>
          <p>
            Importes sin IVA: presupuesto en las dos primeras etapas y OT en
            producción y entrega. Los ajustes de la OT pueden llevar los
            porcentajes por encima del 100%. Sin una base para dividir, se
            muestra “—” o “Sin base”.
          </p>
        </div>
      </ReportCard>

      <div className={shared.detailGrid}>
        <ReportCard
          title="Pendientes y pérdidas"
          description="Desglose de los presupuestos que todavía no llegaron a aprobarse"
          action={
            <ArrowUpRightIcon
              className={shared.headerIcon}
              aria-hidden="true"
            />
          }
        >
          {d.fugas.length ? (
            <>
              <div className={styles.breakdownSummary}>
                <strong>{numero(sinAprobar)}</strong>
                <div>
                  <span>
                    {sinAprobar === 1
                      ? "presupuesto sin aprobar"
                      : "presupuestos sin aprobar"}
                  </span>
                  <small>{money(importeSinAprobar)} sin IVA</small>
                </div>
              </div>
              <Scroll label="Presupuestos pendientes y pérdidas">
                <table
                  className={cn(shared.table, styles.lossTable)}
                  aria-label="Presupuestos pendientes y pérdidas"
                >
                  <thead>
                    <tr>
                      <th scope="col">Situación o motivo</th>
                      <th scope="col">Cantidad</th>
                      <th scope="col">Importe sin IVA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.fugas.map((f) => (
                      <tr key={f.motivo}>
                        <th scope="row">
                          <strong>{f.motivo}</strong>
                          <div
                            className={styles.lossTrack}
                            aria-hidden="true"
                            data-pending={
                              f.motivo === "En gestión (sin resolver)"
                            }
                          >
                            <span
                              style={{
                                width: `${maxFuga > 0 ? (f.cantidad / maxFuga) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </th>
                        <td>{numero(f.cantidad)}</td>
                        <td>{money(f.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Scroll>
            </>
          ) : (
            <NoData
              title={
                base > 0
                  ? "Todos los presupuestos del período se aprobaron"
                  : "Sin presupuestos para analizar"
              }
              description={
                base > 0
                  ? "No hay pendientes ni pérdidas en este grupo de presupuestos."
                  : "El desglose aparece cuando hay presupuestos emitidos en el período."
              }
            />
          )}
          <p className={styles.note}>
            “En gestión” sigue abierto y no es una pérdida. Este bloque
            corresponde al período seleccionado; los abiertos de la cabecera
            incluyen todos los períodos.
          </p>
        </ReportCard>
        <ReportCard
          title="Tiempos entre etapas"
          description="Días promedio según las fechas registradas"
          action={
            <Clock3Icon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          {d.velocidad.length ? (
            <Scroll label="Promedios entre etapas">
              <table
                className={cn(shared.table, styles.speedTable)}
                aria-label="Promedios entre etapas"
              >
                <thead>
                  <tr>
                    <th scope="col">Tramo medido</th>
                    <th scope="col">Días promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {d.velocidad.map((v) => {
                    const info = referenciaDelTramo(v.tramo);
                    return (
                      <tr key={v.tramo}>
                        <th
                          scope="row"
                          data-reporte-exportar={`${info.label} · ${info.referencia}`}
                        >
                          <strong>{info.label}</strong>
                          <small>{info.referencia}</small>
                        </th>
                        <td
                          data-negative={
                            v.diasPromedio != null && v.diasPromedio < 0
                          }
                        >
                          {v.diasPromedio == null ? (
                            <span className={styles.noSample}>
                              Sin fechas suficientes
                            </span>
                          ) : (
                            numero(v.diasPromedio)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Scroll>
          ) : (
            <NoData
              title="Sin tramos registrados"
              description="Los promedios aparecen al registrar las fechas de cada tramo."
            />
          )}
          <p className={styles.note}>
            {!hayTiempos
              ? "Todavía no hay fechas suficientes para calcular tiempos. "
              : ""}
            Cada promedio usa los casos con ambas fechas registradas. La
            finalización de producción no acredita la entrega física; los tramos
            pueden usar muestras distintas y no se suman para calcular el ciclo
            total.
          </p>
        </ReportCard>
      </div>
      <ReportSource meta={d.meta} />
    </div>
  );
}
