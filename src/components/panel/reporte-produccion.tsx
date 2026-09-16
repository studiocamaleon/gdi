"use client";

import {
  ActivityIcon,
  ChartColumnIcon,
  CheckCheckIcon,
  ChevronDownIcon,
  Clock3Icon,
  GaugeIcon,
  Layers3Icon,
  ListOrderedIcon,
  PauseCircleIcon,
  ShieldAlertIcon,
  TimerIcon,
} from "lucide-react";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { formatearMoneda } from "@/lib/moneda";
import { technologyCodeLabel } from "@/lib/maquinaria-tecnologias";
import { fechaDelReporte } from "@/lib/reporte-resumen";
import type { ProduccionPanel, TabPanel } from "@/lib/panel-api";
import { cn } from "@/lib/utils";
import { Metric, NoData, ReportCard, ReportSource } from "./reportes-ui";
import { TremorBarChart } from "./charts/tremor-charts";
import shared from "./reportes.module.css";
import styles from "./reporte-produccion.module.css";

const numero = (value: number, decimals = 2) =>
  value.toLocaleString("es-AR", { maximumFractionDigits: decimals });
const porcentaje = (value: number | null) =>
  value == null ? "—" : `${numero(value)}%`;
const fecha = (value: string) => fechaDelReporte(value, "dia", true);
const FUENTES: Record<string, { label: string; color: string }> = {
  medido: { label: "Medido", color: "var(--success)" },
  medido_lote: { label: "Medido en tanda", color: "var(--brand-graphite)" },
  declarado: { label: "Declarado", color: "var(--accent)" },
  estimado: { label: "Estimado por máquina", color: "var(--muted-text)" },
  invalido: { label: "Sin tiempo", color: "var(--danger)" },
};
const fuente = (key: string) =>
  FUENTES[key] ?? { label: key, color: "var(--muted-text-2)" };
const estadoDesvio = (value: number) =>
  Math.abs(value) <= 10 ? "En línea" : value > 0 ? "Más lento" : "Más rápido";

/** El porcentaje se conserva en texto; sólo se limita el ancho de la barra. */
function Track({
  value,
  max = 100,
  tone,
}: {
  value: number;
  max?: number;
  tone?: string;
}) {
  return (
    <div className={styles.track} aria-hidden="true" data-tone={tone}>
      <span
        style={{
          width: `${Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0))}%`,
        }}
      />
    </div>
  );
}

function Deviation({ value }: { value: number | null }) {
  if (value == null) return <span>—</span>;
  const inLine = Math.abs(value) <= 10;
  const tone = inLine ? "neutral" : value > 0 ? "slow" : "fast";
  return (
    <div className={styles.deviation} data-tone={tone}>
      <strong>
        {value > 0 ? "+" : ""}
        {numero(value)}%
      </strong>
      <small>{estadoDesvio(value)}</small>
      <div className={styles.deviationTrack} aria-hidden="true">
        <span
          style={{
            left:
              value < 0 ? `${50 - Math.min(50, Math.abs(value) / 2)}%` : "50%",
            width: `${Math.min(50, Math.abs(value) / 2)}%`,
          }}
        />
      </div>
    </div>
  );
}

export function ReporteProduccion({ d }: { d: TabPanel<ProduccionPanel> }) {
  const { moneda } = useConfigRegional();
  const k = d.kpis;
  const registro = d.registroTiempos;
  const ahorros = d.ahorros;
  const totalPasos = d.throughput.reduce(
    (sum, point) => sum + point.cantidad,
    0,
  );
  const money = (v: number) => formatearMoneda(v, moneda);
  const pausasMax = Math.max(1, ...registro.pausas.map((p) => p.veces));
  const bloqueosMax = Math.max(1, ...d.bloqueos.map((p) => p.veces));
  const rangosAhorro = [
    { label: "En el período", value: ahorros.periodo },
    { label: "Acumulado histórico", value: ahorros.historico },
  ];

  return (
    <div className={shared.report}>
      <div className={shared.periodNote}>
        <span>Lectura de producción</span>
        <span data-reporte-periodo>
          {fecha(d.meta.rango.desde)} — {fecha(d.meta.rango.hasta)}
        </span>
      </div>

      <div className={shared.metrics}>
        <Metric
          label="Entregas a tiempo"
          value={porcentaje(k.otdPct)}
          detail={`${numero(d.otd.aTiempo)} de ${numero(d.otd.total)} órdenes evaluadas`}
          icon={<CheckCheckIcon />}
          featured
        />
        <Metric
          label="Cola actual"
          value={numero(k.trabajosEnCola)}
          detail={
            k.diasDeCarga != null
              ? `${numero(k.diasDeCarga)} días de carga estimada · hoy`
              : "Hoy · sin capacidad cargada"
          }
          icon={<ListOrderedIcon />}
          hint="Pasos pendientes de órdenes activas, independientemente del período. Los días de carga se estiman con las horas de los centros y 22 días hábiles por mes."
        />
        <Metric
          label="Tiempo de ciclo"
          value={
            k.leadTimeDias == null ? "—" : `${numero(k.leadTimeDias)} días`
          }
          detail="Desde emisión hasta fin de producción"
          icon={<Clock3Icon />}
          hint="Promedio de días entre la emisión y el último paso completado de las órdenes finalizadas o entregadas en el período."
        />
        <Metric
          label="Tiempo real / cotizado"
          value={porcentaje(k.eficienciaPct)}
          detail="100% equivale al tiempo cotizado"
          icon={<TimerIcon />}
          hint="Eficiencia de tiempo: más de 100% indica que se tardó más de lo cotizado. Se calcula sólo con tiempos medidos y excluye los atípicos."
        />
        <Metric
          label="Bloqueados ahora"
          value={numero(k.bloqueados)}
          detail={
            k.bloqueados > 0
              ? "Pasos que requieren intervención · hoy"
              : "Sin pasos bloqueados · hoy"
          }
          icon={<ShieldAlertIcon />}
        />
      </div>

      <div className={styles.primaryGrid}>
        <ReportCard
          title="Ritmo de producción"
          description="Pasos completados por día · período seleccionado"
          action={
            <ChartColumnIcon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          <div className={shared.chartSummary}>
            <div>
              <span>Pasos completados</span>
              <strong>{numero(totalPasos)}</strong>
            </div>
            <div>
              <span>Días con actividad</span>
              <strong>
                {numero(d.throughput.filter((p) => p.cantidad > 0).length)}
              </strong>
            </div>
          </div>
          {d.throughput.length > 0 ? (
            <div className={shared.chartWrap}>
              <TremorBarChart
                data={d.throughput}
                index="fecha"
                categories={[
                  {
                    key: "cantidad",
                    label: "Pasos completados",
                    color: "var(--accent)",
                  },
                ]}
                valueFormatter={(v) => numero(v, 0)}
                labelFormatter={fecha}
                tickFormatter={(v) => fechaDelReporte(v, "dia")}
                allowDecimals={false}
                label="Pasos completados por día"
                height={260}
              />
            </div>
          ) : (
            <NoData
              title="Sin pasos completados"
              description="Todavía no hay actividad finalizada para mostrar en este período."
            />
          )}
          {d.throughput.length > 0 ? (
            <>
              <p className={styles.note}>
                Se muestran los días con registros de producción.
              </p>
              <details className={shared.dataDetails}>
                <summary>
                  Ver datos de producción <ChevronDownIcon aria-hidden="true" />
                </summary>
                <div className={shared.tableScroll}>
                  <table
                    className={shared.table}
                    aria-label="Datos de producción diaria"
                  >
                    <thead>
                      <tr>
                        <th scope="col">Fecha</th>
                        <th scope="col">Pasos completados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.throughput.map((p) => (
                        <tr key={p.fecha}>
                          <th scope="row">{fecha(p.fecha)}</th>
                          <td>{numero(p.cantidad, 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : null}
        </ReportCard>

        <ReportCard
          title="Cumplimiento de entregas"
          description="Finalización de producción frente a la fecha prometida"
          action={
            <CheckCheckIcon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          <div className={styles.deliverySummary}>
            <div>
              <span>A tiempo</span>
              <strong>{numero(d.otd.aTiempo)}</strong>
            </div>
            <div data-warning={d.otd.tarde > 0}>
              <span>Fuera de fecha</span>
              <strong>{numero(d.otd.tarde)}</strong>
            </div>
            <div>
              <span>Atraso promedio</span>
              <strong>
                {numero(d.otd.atrasoPromedioDias)} <small>días</small>
              </strong>
            </div>
          </div>
          {d.otd.atrasadas.length ? (
            <div className={shared.tableScroll}>
              <table
                className={cn(shared.table, styles.deliveryTable)}
                aria-label="Órdenes finalizadas fuera de fecha"
              >
                <thead>
                  <tr>
                    <th scope="col">Orden / cliente</th>
                    <th scope="col">Fecha prometida</th>
                    <th scope="col">Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {d.otd.atrasadas.map((o) => (
                    <tr key={o.numero}>
                      <th
                        scope="row"
                        data-reporte-exportar={`${o.numero} · ${o.cliente}`}
                      >
                        <strong>{o.numero}</strong>
                        <small>{o.cliente}</small>
                      </th>
                      <td data-reporte-exportar={fecha(o.fechaEntrega)}>
                        {fechaDelReporte(o.fechaEntrega, "dia")}
                      </td>
                      <td className={styles.warning}>
                        {numero(o.diasAtraso)} días
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <NoData
              title={
                d.otd.total > 0
                  ? "Todas las órdenes, a tiempo"
                  : "Sin órdenes para evaluar"
              }
              description={
                d.otd.total > 0
                  ? "Las órdenes evaluadas finalizaron su producción dentro de la fecha prometida."
                  : "No hay órdenes finalizadas con fecha de entrega evaluable en este período."
              }
            />
          )}
          <p className={styles.note}>
            {d.otd.sinFecha > 0
              ? `${numero(d.otd.sinFecha)} orden(es) sin fecha de entrega, excluida(s) del indicador. `
              : ""}
            El atraso promedio considera sólo las órdenes fuera de fecha.
          </p>
        </ReportCard>
      </div>

      <div className={styles.equalGrid}>
        <ReportCard
          title="Precisión de estimación"
          description="Mediana por familia · tiempos medidos frente a lo cotizado"
          action={
            <TimerIcon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          {d.eficiencia.porFamilia.length ? (
            <div className={shared.tableScroll}>
              <table
                className={cn(shared.table, styles.precisionTable)}
                aria-label="Precisión de tiempos por familia"
              >
                <thead>
                  <tr>
                    <th scope="col">Familia / muestra</th>
                    <th scope="col">Cotizado</th>
                    <th scope="col">Medido</th>
                    <th scope="col">Desvío</th>
                  </tr>
                </thead>
                <tbody>
                  {d.eficiencia.porFamilia.map((f) => {
                    const desvio = f.razon == null ? null : (f.razon - 1) * 100;
                    return (
                      <tr key={f.familia}>
                        <th
                          scope="row"
                          data-reporte-exportar={`${f.familia} · ${numero(f.muestras)} ${f.muestras === 1 ? "paso medido" : "pasos medidos"}${f.muestras < 3 ? " · muestra pequeña" : ""}`}
                        >
                          <strong>{f.familia}</strong>
                          <small data-warning={f.muestras < 3}>
                            {numero(f.muestras)}{" "}
                            {f.muestras === 1 ? "paso medido" : "pasos medidos"}
                            {f.muestras < 3 ? " · muestra pequeña" : ""}
                          </small>
                        </th>
                        <td>{numero(f.estimadoMin)} min</td>
                        <td>{numero(f.realMin)} min</td>
                        <td
                          data-reporte-exportar={
                            desvio == null
                              ? "—"
                              : `${desvio > 0 ? "+" : ""}${numero(desvio)}% · ${estadoDesvio(desvio)}`
                          }
                        >
                          <Deviation value={desvio} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <NoData
              title="Sin tiempos comparables"
              description="Se necesitan pasos con tiempo medido y cotizado para evaluar la precisión."
            />
          )}
          <p className={styles.note}>
            En línea: hasta ±10% de desvío. Más lento indica un tiempo medido
            mayor al cotizado.
            {d.eficiencia.atipicosExcluidos > 0
              ? ` ${numero(d.eficiencia.atipicosExcluidos)} tiempo(s) atípico(s) excluido(s).`
              : ""}
          </p>
        </ReportCard>

        <ReportCard
          title="Utilización por centro"
          description="Horas registradas frente a capacidad práctica del período"
          action={
            <GaugeIcon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          {d.utilizacion.length ? (
            <div className={shared.tableScroll}>
              <table
                className={cn(shared.table, styles.utilizationTable)}
                aria-label="Utilización por centro de costo"
              >
                <thead>
                  <tr>
                    <th scope="col">Centro</th>
                    <th scope="col">Registradas</th>
                    <th scope="col">Capacidad</th>
                    <th scope="col">Uso</th>
                  </tr>
                </thead>
                <tbody>
                  {d.utilizacion.map((c) => (
                    <tr key={c.centro}>
                      <th scope="row">
                        <strong>{c.centro}</strong>
                        {c.pct != null ? (
                          <Track
                            value={c.pct}
                            tone={c.pct > 100 ? "warning" : undefined}
                          />
                        ) : (
                          <small>Sin capacidad cargada</small>
                        )}
                      </th>
                      <td>{numero(c.horasReales)} h</td>
                      <td>{numero(c.capacidadPractica)} h</td>
                      <td data-warning={c.pct != null && c.pct > 100}>
                        {porcentaje(c.pct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <NoData
              title="Sin utilización registrada"
              description="No hay pasos completados con tiempo y centro de costo asociados en este período."
            />
          )}
          <p className={styles.note}>
            Incluye tiempo medido, declarado y estimado. La capacidad se
            prorratea al período; superar el 100% indica horas por encima de esa
            referencia.
          </p>
        </ReportCard>
      </div>

      <div className={styles.equalGrid}>
        <ReportCard
          title="Calidad del registro"
          description="Origen del tiempo de los pasos completados"
          action={
            <ActivityIcon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          {registro.totalPasos > 0 ? (
            <>
              <div className={cn(shared.chartSummary, styles.qualitySummary)}>
                <div>
                  <span>Con tiempo medido</span>
                  <strong>{porcentaje(registro.confiablePct)}</strong>
                </div>
                <div>
                  <span>Pasos registrados</span>
                  <strong>{numero(registro.totalPasos)}</strong>
                </div>
              </div>
              <div className={styles.sourceBar} aria-hidden="true">
                {registro.fuentes
                  .filter((f) => f.pasos > 0)
                  .map((f) => (
                    <span
                      key={f.fuente}
                      style={{
                        flexGrow: f.pasos,
                        background: fuente(f.fuente).color,
                      }}
                    />
                  ))}
              </div>
              <div className={shared.tableScroll}>
                <table
                  className={cn(shared.table, styles.compactTable)}
                  aria-label="Fuentes del registro de tiempos"
                >
                  <thead>
                    <tr>
                      <th scope="col">Fuente</th>
                      <th scope="col">Pasos</th>
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
                    {registro.fuentes.map((f) => (
                      <tr key={f.fuente}>
                        <th scope="row">
                          <span className={styles.sourceName}>
                            <i
                              style={{ background: fuente(f.fuente).color }}
                              aria-hidden="true"
                            />
                            {fuente(f.fuente).label}
                          </span>
                        </th>
                        <td>{numero(f.pasos)}</td>
                        <td>{porcentaje(f.pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={styles.note}>
                La medición directa y la medición en tanda se usan para evaluar
                la eficiencia.
                {registro.confiablePct != null && registro.confiablePct < 50
                  ? " Menos de la mitad de los pasos tiene tiempo medido."
                  : ""}
              </p>
            </>
          ) : (
            <NoData
              title="Sin registros de tiempo"
              description="La distribución aparecerá cuando haya pasos completados en el período."
            />
          )}
        </ReportCard>

        <div className={styles.cardStack}>
          <ReportCard
            title="Pausas del taller"
            description="Interrupciones registradas en el período"
            action={
              <PauseCircleIcon
                className={shared.headerIcon}
                aria-hidden="true"
              />
            }
          >
            {registro.pausas.length ? (
              <div className={shared.tableScroll}>
                <table className={shared.table} aria-label="Pausas por motivo">
                  <thead>
                    <tr>
                      <th scope="col">Motivo</th>
                      <th scope="col">Veces</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registro.pausas.map((p) => (
                      <tr key={p.motivo}>
                        <th scope="row">
                          {p.motivo}
                          <Track
                            value={p.veces}
                            max={pausasMax}
                            tone={
                              p.motivo === "Pausa automática" ||
                              p.motivo === "Fin de jornada"
                                ? "muted"
                                : undefined
                            }
                          />
                        </th>
                        <td>{numero(p.veces)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <NoData
                title="Sin pausas registradas"
                description="No hay interrupciones asentadas para el período seleccionado."
              />
            )}
          </ReportCard>
          <ReportCard
            title="Bloqueos actuales"
            description="Pasos bloqueados por motivo · independiente del período"
            action={<span className={styles.currentBadge}>Hoy</span>}
          >
            {d.bloqueos.length ? (
              <div className={shared.tableScroll}>
                <table
                  className={shared.table}
                  aria-label="Bloqueos actuales por motivo"
                >
                  <thead>
                    <tr>
                      <th scope="col">Motivo</th>
                      <th scope="col">Pasos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.bloqueos.map((p) => (
                      <tr key={p.motivo}>
                        <th scope="row">
                          {p.motivo}
                          <Track
                            value={p.veces}
                            max={bloqueosMax}
                            tone="warning"
                          />
                        </th>
                        <td>{numero(p.veces)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={shared.allClear}>
                <CheckCheckIcon aria-hidden="true" />
                <div>
                  <strong>Sin pasos bloqueados</strong>
                  <p>
                    El taller no tiene bloqueos registrados en este momento.
                  </p>
                </div>
              </div>
            )}
          </ReportCard>
        </div>
      </div>

      <div className={styles.savingsGrid}>
        <ReportCard
          title="Ahorro por consolidación"
          description="Menor consumo de rollo al reunir trabajos en tandas"
          action={
            <Layers3Icon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          {ahorros.historico.tandas > 0 || ahorros.periodo.tandas > 0 ? (
            <>
              <div className={styles.savingsSummary}>
                {rangosAhorro.map(({ label, value }) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{money(value.ahorroPesos)}</strong>
                    <small>
                      {numero(value.ahorroMl)} m lineales ·{" "}
                      {numero(value.tandas)} tandas · {numero(value.jobs)}{" "}
                      trabajos
                    </small>
                  </div>
                ))}
              </div>
              <details className={shared.dataDetails}>
                <summary>
                  Ver datos de ahorro <ChevronDownIcon aria-hidden="true" />
                </summary>
                <div className={shared.tableScroll}>
                  <table
                    className={shared.table}
                    aria-label="Resumen de ahorros por alcance"
                  >
                    <thead>
                      <tr>
                        <th scope="col">Alcance</th>
                        <th scope="col">Ahorro</th>
                        <th scope="col">Metros lineales</th>
                        <th scope="col">Tandas</th>
                        <th scope="col">Trabajos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rangosAhorro.map(({ label, value }) => (
                        <tr key={label}>
                          <th scope="row">{label}</th>
                          <td>{money(value.ahorroPesos)}</td>
                          <td>{numero(value.ahorroMl)}</td>
                          <td>{numero(value.tandas)}</td>
                          <td>{numero(value.jobs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : (
            <NoData
              title="Sin ahorros registrados"
              description="Al consolidar tandas, vas a ver el ahorro registrado respecto de producir los trabajos por separado."
            />
          )}
        </ReportCard>
        <ReportCard
          title="Ahorro por material"
          description="Principales materiales · acumulado histórico por consolidación"
          action={<span className={styles.currentBadge}>Histórico</span>}
        >
          {ahorros.porMaterial.length ? (
            <div className={shared.tableScroll}>
              <table
                className={cn(shared.table, styles.savingsTable)}
                aria-label="Ahorro histórico por material"
              >
                <thead>
                  <tr>
                    <th scope="col">Material / tecnología</th>
                    <th scope="col">Tandas</th>
                    <th scope="col">Rollo ahorrado</th>
                    <th scope="col">Ahorro</th>
                  </tr>
                </thead>
                <tbody>
                  {ahorros.porMaterial.map((m) => (
                    <tr key={`${m.material}|${m.tecnologia ?? ""}`}>
                      <th
                        scope="row"
                        data-reporte-exportar={`${m.material} · ${m.tecnologia ? technologyCodeLabel(m.tecnologia) || m.tecnologia : "Sin tecnología asociada"}`}
                      >
                        <strong>{m.material}</strong>
                        <small>
                          {m.tecnologia
                            ? technologyCodeLabel(m.tecnologia) || m.tecnologia
                            : "Sin tecnología asociada"}
                        </small>
                      </th>
                      <td>{numero(m.tandas)}</td>
                      <td>{numero(m.ahorroMl)} m lineales</td>
                      <td className={styles.savingAmount}>
                        {money(m.ahorroPesos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <NoData
              title="Sin materiales con ahorro"
              description="El desglose histórico aparecerá al registrar las primeras consolidaciones."
            />
          )}
        </ReportCard>
      </div>
      <ReportSource meta={d.meta} />
    </div>
  );
}
