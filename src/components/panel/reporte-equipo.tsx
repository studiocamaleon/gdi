"use client";

import { type CSSProperties, type ReactNode } from "react";
import {
  ArrowUpRightIcon,
  ChartNoAxesCombinedIcon,
  CheckCheckIcon,
  ChevronDownIcon,
  Clock3Icon,
  FingerprintIcon,
  Layers3Icon,
  ScanLineIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "lucide-react";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { formatearMoneda } from "@/lib/moneda";
import type { EquipoPanel, TabPanel } from "@/lib/panel-api";
import { fechaDelReporte } from "@/lib/reporte-resumen";
import { cn } from "@/lib/utils";
import { TremorSparkAreaChart } from "./charts/tremor-charts";
import { Metric, NoData, ReportCard, ReportSource } from "./reportes-ui";
import shared from "./reportes.module.css";
import styles from "./reporte-equipo.module.css";

const numero = (n: number, decimals = 2) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: decimals });
const porcentaje = (n: number | null) => (n == null ? "—" : `${numero(n)}%`);
const desvio = (n: number) => `${n > 0 ? "+" : ""}${numero(n)}%`;
const fecha = (s: string) => fechaDelReporte(s, "dia", true);
const cantidad = (n: number, singular: string, plural = `${singular}s`) =>
  `${numero(n)} ${n === 1 ? singular : plural}`;
const porNombre = <T extends { nombre: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
const FUENTES = [
  { key: "medidos", label: "Medido", color: "var(--brand-graphite)" },
  { key: "declarados", label: "Declarado", color: "var(--accent)" },
  { key: "estimados", label: "Estimado", color: "var(--muted-text)" },
  { key: "invalidos", label: "Sin tiempo", color: "var(--border-strong)" },
] as const;

function TableScroll({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
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

function Persona({ nombre, detail }: { nombre: string; detail?: string }) {
  return (
    <div className={styles.person}>
      <span className={styles.personIcon}>
        <UserRoundIcon aria-hidden="true" />
      </span>
      <div>
        <strong>{nombre}</strong>
        {detail ? <small>{detail}</small> : null}
      </div>
    </div>
  );
}

/** Cobertura observada en el período; no certifica habilidades ni disponibilidad. */
function Polivalencia({ celdas }: { celdas: EquipoPanel["polivalencia"] }) {
  const personas = [...new Set(celdas.map((c) => c.nombre))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  const familias = [...new Set(celdas.map((c) => c.familia))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  const valores = new Map(
    celdas.map((c) => [JSON.stringify([c.familia, c.nombre]), c]),
  );
  const max = Math.max(1, ...celdas.map((c) => c.minutos));
  return (
    <>
      <div className={styles.matrixLegend}>
        <span>
          {cantidad(personas.length, "persona")} ·{" "}
          {cantidad(familias.length, "familia")}
        </span>
        <span>
          <i aria-hidden="true" />
          Mayor intensidad = más tiempo
        </span>
      </div>
      <TableScroll label="Cobertura por familia y persona; desplazá para ver todas las columnas">
        <table
          className={cn(shared.table, styles.matrix)}
          aria-label="Polivalencia observada"
        >
          <thead>
            <tr>
              <th scope="col">Familia de producción</th>
              {personas.map((p) => (
                <th scope="col" key={p}>
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {familias.map((f) => (
              <tr key={f}>
                <th scope="row">{f}</th>
                {personas.map((p) => {
                  const c = valores.get(JSON.stringify([f, p]));
                  return (
                    <td
                      key={p}
                      data-reporte-exportar={
                        c
                          ? `${numero(c.minutos)} min · ${cantidad(c.pasos, "paso")}`
                          : "Sin trabajo registrado"
                      }
                    >
                      {c ? (
                        <div
                          className={styles.heatCell}
                          style={
                            {
                              "--intensity": `${8 + (c.minutos / max) * 22}%`,
                            } as CSSProperties
                          }
                        >
                          <strong>
                            {numero(c.minutos)} <span>min</span>
                          </strong>
                          <small>
                            {numero(c.pasos)} {c.pasos === 1 ? "paso" : "pasos"}
                          </small>
                        </div>
                      ) : (
                        <span
                          className={styles.noRecord}
                          aria-label="Sin trabajo registrado"
                        >
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <p className={styles.note}>
        La matriz muestra trabajo registrado en este período. Una celda vacía no
        implica que la persona no pueda realizar esa tarea.
      </p>
    </>
  );
}

export function ReporteEquipo({ d }: { d: TabPanel<EquipoPanel> }) {
  const { moneda } = useConfigRegional();
  const dinero = (n: number) => formatearMoneda(n, moneda);
  const k = d.kpis;
  const personas = porNombre(d.personas);
  const disciplina = porNombre(d.disciplina);
  const eficiencia = porNombre(d.eficiencia);
  const conMuestra = eficiencia.filter(
    (p) => p.muestras >= d.muestraMinima && p.desvioPct != null,
  );
  const semanales = conMuestra.flatMap((p) =>
    p.serie.map((s) => ({ ...s, nombre: p.nombre, id: p.id })),
  );

  return (
    <div className={shared.report}>
      <div className={shared.periodNote}>
        <span>Lectura del equipo</span>
        <span>Actividad y cobertura del período seleccionado</span>
      </div>
      <div className={shared.metrics}>
        <Metric
          featured
          label="Personas activas"
          value={numero(k.personasActivas)}
          detail="Con tramos de trabajo registrados"
          icon={<UsersRoundIcon />}
        />
        <Metric
          label="Horas productivas"
          value={`${numero(k.minutosProductivos / 60)} h`}
          detail={`${numero(k.minutosProductivos)} minutos cronometrados`}
          hint="Suma de tramos cerrados de trabajo. No incluye esperas ni representa asistencia."
          icon={<Clock3Icon />}
        />
        <Metric
          label="Pasos completados"
          value={numero(k.pasosCompletados)}
          detail="Finalizados durante el período"
          icon={<CheckCheckIcon />}
        />
        <Metric
          label="Pasos con tiempo medido"
          value={porcentaje(k.medidoPct)}
          detail="Cronómetro sobre pasos completados"
          hint="Porcentaje de pasos con tiempo medido, individualmente o en tanda. No es el porcentaje de horas trabajadas."
          icon={<ScanLineIcon />}
        />
        <Metric
          label="Vendedores activos"
          value={numero(k.vendedoresActivos)}
          detail="Con ventas en el período"
          icon={<ArrowUpRightIcon />}
        />
      </div>

      <div className={styles.activityGrid}>
        <ReportCard
          title="Trabajo por persona"
          description="Tiempo cronometrado en pasos · orden alfabético"
          action={
            <UsersRoundIcon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          {personas.length ? (
            <TableScroll label="Trabajo por persona">
              <table
                className={cn(shared.table, styles.workTable)}
                aria-label="Trabajo por persona"
              >
                <thead>
                  <tr>
                    <th scope="col">Persona</th>
                    <th scope="col">Pasos</th>
                    <th scope="col">Días activos</th>
                    <th scope="col">Familias</th>
                    <th scope="col">Minutos</th>
                  </tr>
                </thead>
                <tbody>
                  {personas.map((p) => (
                    <tr key={JSON.stringify([p.id, p.nombre])}>
                      <th
                        scope="row"
                        data-reporte-exportar={`${p.nombre}${p.autoPausas ? ` · ${cantidad(p.autoPausas, "pausa automática", "pausas automáticas")}` : ""}`}
                      >
                        <Persona
                          nombre={p.nombre}
                          detail={
                            p.autoPausas
                              ? cantidad(
                                  p.autoPausas,
                                  "pausa automática",
                                  "pausas automáticas",
                                )
                              : undefined
                          }
                        />
                      </th>
                      <td>{numero(p.pasos)}</td>
                      <td>{numero(p.dias)}</td>
                      <td>{numero(p.familias)}</td>
                      <td className={styles.emphasis}>{numero(p.minutos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          ) : (
            <NoData
              title="Sin trabajo registrado"
              description="Los tramos cerrados de producción aparecerán acá."
            />
          )}
          <p className={styles.note}>
            Los pasos de esta tabla tuvieron trabajo registrado; pueden seguir
            en curso. Los días activos cuentan días con tramos, no asistencia.
          </p>
        </ReportCard>

        <ReportCard
          title="Disciplina de registro"
          description="Cómo se obtuvo el tiempo de los pasos completados"
          action={
            <FingerprintIcon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          {disciplina.length ? (
            <>
              <div className={styles.registration}>
                {disciplina.map((p) => (
                  <div
                    key={JSON.stringify([p.id, p.nombre])}
                    className={styles.registrationRow}
                  >
                    <div className={styles.registrationHeader}>
                      <strong>{p.nombre}</strong>
                      <span>
                        {porcentaje(p.medidoPct)} <small>medido</small>
                      </span>
                    </div>
                    <div
                      className={styles.stack}
                      role="img"
                      aria-label={`${p.nombre}: ${FUENTES.map((f) => `${numero(p[f.key])} ${f.label.toLowerCase()}`).join(", ")}`}
                    >
                      {FUENTES.map((f) => (
                        <span
                          key={f.key}
                          style={{
                            width: `${p.pasos > 0 ? (p[f.key] / p.pasos) * 100 : 0}%`,
                            background: f.color,
                          }}
                        />
                      ))}
                    </div>
                    <div className={styles.registrationMeta}>
                      <span>
                        {cantidad(
                          p.pasos,
                          "paso completado",
                          "pasos completados",
                        )}
                      </span>
                      {p.autoPausas > 0 ? (
                        <span>
                          {cantidad(
                            p.autoPausas,
                            "pausa automática",
                            "pausas automáticas",
                          )}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              <ul className={styles.legend} aria-label="Fuentes del tiempo">
                {FUENTES.map((f) => (
                  <li key={f.key}>
                    <i style={{ background: f.color }} aria-hidden="true" />
                    {f.label}
                  </li>
                ))}
              </ul>
              <details className={shared.dataDetails}>
                <summary>
                  Ver datos del registro
                  <ChevronDownIcon size={14} aria-hidden="true" />
                </summary>
                <TableScroll label="Detalle de las fuentes del tiempo">
                  <table
                    className={shared.table}
                    aria-label="Detalle de las fuentes del tiempo"
                  >
                    <thead>
                      <tr>
                        <th scope="col">Persona</th>
                        <th scope="col">Pasos</th>
                        {FUENTES.map((f) => (
                          <th key={f.key} scope="col">
                            {f.label}
                          </th>
                        ))}
                        <th scope="col">Medido %</th>
                        <th scope="col">Pausas automáticas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disciplina.map((p) => (
                        <tr key={JSON.stringify([p.id, p.nombre])}>
                          <th scope="row">{p.nombre}</th>
                          <td>{numero(p.pasos)}</td>
                          {FUENTES.map((f) => (
                            <td key={f.key}>{numero(p[f.key])}</td>
                          ))}
                          <td>{porcentaje(p.medidoPct)}</td>
                          <td>{numero(p.autoPausas)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScroll>
              </details>
            </>
          ) : (
            <NoData
              title="Sin pasos completados"
              description="Las fuentes de tiempo se muestran cuando se completan pasos."
            />
          )}
        </ReportCard>
      </div>

      <ReportCard
        title="Eficiencia vs. cotizado"
        description="Desvío del tiempo real de cada persona respecto del tiempo cotizado"
        action={
          <ChartNoAxesCombinedIcon
            className={shared.headerIcon}
            aria-hidden="true"
          />
        }
      >
        <div className={styles.sectionSummary}>
          <span>
            <strong>{numero(conMuestra.length)}</strong>{" "}
            {conMuestra.length === 1
              ? "persona con muestra suficiente"
              : "personas con muestra suficiente"}
          </span>
          <span>Mínimo: {numero(d.muestraMinima)} pasos medidos</span>
          <span className={styles.tag}>Orden alfabético</span>
        </div>
        {eficiencia.length ? (
          <TableScroll label="Eficiencia por persona">
            <table className={shared.table} aria-label="Eficiencia por persona">
              <thead>
                <tr>
                  <th scope="col">Persona</th>
                  <th scope="col">Muestra</th>
                  <th scope="col">Tendencia semanal</th>
                  <th scope="col">Desvío vs. cotizado</th>
                </tr>
              </thead>
              <tbody>
                {eficiencia.map((p) => {
                  const suficiente =
                    p.muestras >= d.muestraMinima && p.desvioPct != null;
                  const lectura =
                    p.desvioPct === 0
                      ? "Igual al cotizado"
                      : p.desvioPct! > 0
                        ? "Más tiempo que el cotizado"
                        : "Menos tiempo que el cotizado";
                  const tieneSerie = suficiente && p.serie.length >= 2;
                  return (
                    <tr key={JSON.stringify([p.id, p.nombre])}>
                      <th scope="row">
                        <Persona nombre={p.nombre} />
                      </th>
                      <td>
                        {cantidad(p.muestras, "paso medido", "pasos medidos")}
                      </td>
                      <td
                        data-reporte-exportar={
                          tieneSerie
                            ? `${p.serie.length} semanas; valores en detalle semanal`
                            : suficiente && p.serie.length === 1
                              ? "Una semana registrada"
                              : "Sin tendencia suficiente"
                        }
                      >
                        {tieneSerie ? (
                          <div className={styles.spark}>
                            <TremorSparkAreaChart
                              data={p.serie}
                              index="semana"
                              category="desvioPct"
                            />
                            <small>
                              {p.serie.length} semanas · ver datos debajo
                            </small>
                          </div>
                        ) : (
                          <span className={styles.muted}>
                            {suficiente && p.serie.length === 1
                              ? "Una semana registrada"
                              : "Sin tendencia suficiente"}
                          </span>
                        )}
                      </td>
                      <td
                        data-reporte-exportar={
                          suficiente
                            ? `${desvio(p.desvioPct!)} · ${lectura}`
                            : `Sin muestra suficiente (${p.muestras}/${d.muestraMinima})`
                        }
                      >
                        {suficiente ? (
                          <div
                            className={styles.deviation}
                            data-over={p.desvioPct! > 0}
                          >
                            <strong>{desvio(p.desvioPct!)}</strong>
                            <small>{lectura}</small>
                          </div>
                        ) : (
                          <div className={styles.sample}>
                            <span>
                              {numero(p.muestras)} / {numero(d.muestraMinima)}{" "}
                              pasos
                            </span>
                            <small>Sin muestra suficiente</small>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        ) : (
          <NoData
            title="Sin tiempos comparables"
            description="Se necesitan pasos medidos con un tiempo cotizado para calcular el desvío."
          />
        )}
        {semanales.length ? (
          <details className={shared.dataDetails}>
            <summary>
              Ver datos semanales
              <ChevronDownIcon size={14} aria-hidden="true" />
            </summary>
            <TableScroll label="Desvíos semanales por persona">
              <table
                className={shared.table}
                aria-label="Desvíos semanales por persona"
              >
                <thead>
                  <tr>
                    <th scope="col">Persona</th>
                    <th scope="col">Semana desde</th>
                    <th scope="col">Pasos medidos</th>
                    <th scope="col">Desvío</th>
                  </tr>
                </thead>
                <tbody>
                  {semanales.map((s, i) => (
                    <tr key={JSON.stringify([s.id, s.nombre, s.semana, i])}>
                      <th scope="row">{s.nombre}</th>
                      <td>{fecha(s.semana)}</td>
                      <td>{numero(s.muestras)}</td>
                      <td>{desvio(s.desvioPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <p className={styles.note}>
              La muestra mínima se aplica al período completo. Cada semana
              muestra su propia cantidad de pasos.
            </p>
          </details>
        ) : null}
        <p className={styles.note}>
          Leé el desvío junto con la calidad del registro y el tipo de trabajo.
          Sólo se incluyen tiempos medidos sin atípicos; con menos de{" "}
          {d.muestraMinima} pasos, el desvío individual no se muestra.
        </p>
      </ReportCard>

      <div className={shared.mainGrid}>
        <ReportCard
          title="Polivalencia observada"
          description="Quién trabajó en cada familia de producción"
          action={
            <Layers3Icon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          {d.polivalencia.length ? (
            <Polivalencia celdas={d.polivalencia} />
          ) : (
            <NoData
              title="Sin cobertura observada"
              description="La matriz se completa con los tramos de trabajo registrados."
            />
          )}
        </ReportCard>
        <ReportCard
          title="Cobertura a revisar"
          description="Familias con una sola persona registrada"
          action={
            <UsersRoundIcon className={shared.headerIcon} aria-hidden="true" />
          }
        >
          {d.familiasSinRespaldo.length ? (
            <>
              <div className={styles.coverageSummary}>
                <strong>{numero(d.familiasSinRespaldo.length)}</strong>
                <span>
                  {d.familiasSinRespaldo.length === 1
                    ? "familia con actividad de una persona"
                    : "familias con actividad de una persona"}
                </span>
              </div>
              <TableScroll label="Familias con una sola persona">
                <table
                  className={cn(shared.table, styles.coverageTable)}
                  aria-label="Familias con una sola persona"
                >
                  <thead>
                    <tr>
                      <th scope="col">Familia</th>
                      <th scope="col">Persona</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.familiasSinRespaldo.map((f) => (
                      <tr key={f.familia}>
                        <th scope="row">{f.familia}</th>
                        <td>{f.persona}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
              <p className={styles.note}>
                Revisá si hay otras personas capacitadas para cubrir estas
                tareas. Este dato refleja la actividad del período.
              </p>
            </>
          ) : (
            <NoData
              title={
                d.polivalencia.length
                  ? "Cobertura compartida"
                  : "Sin datos de cobertura"
              }
              description={
                d.polivalencia.length
                  ? "Todas las familias observadas registraron trabajo de más de una persona."
                  : "Al registrar trabajo se identificarán las familias que dependen de una sola persona."
              }
            />
          )}
        </ReportCard>
      </div>

      <ReportCard
        title="Vendedores"
        description="Ventas y ticket por vendedor · importes sin IVA del período"
        action={
          <ArrowUpRightIcon className={shared.headerIcon} aria-hidden="true" />
        }
      >
        {d.vendedores.length ? (
          <TableScroll label="Ventas por vendedor">
            <table
              className={cn(shared.table, styles.sellersTable)}
              aria-label="Ventas por vendedor"
            >
              <thead>
                <tr>
                  <th scope="col">Vendedor</th>
                  <th scope="col">Órdenes</th>
                  <th scope="col">Ticket promedio</th>
                  <th scope="col">Ventas</th>
                  {d.margenesVisibles ? <th scope="col">Margen</th> : null}
                  {d.comisionesVisibles ? (
                    <th scope="col">Comisión estimada</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {d.vendedores.map((v) => (
                  <tr key={JSON.stringify([v.empleadoId, v.nombre])}>
                    <th
                      scope="row"
                      data-reporte-exportar={`${v.nombre}${d.margenesVisibles && v.itemsSinCosto ? ` · ${v.itemsSinCosto} ítems sin costo (fuera del margen)` : ""}`}
                    >
                      <Persona
                        nombre={v.nombre}
                        detail={
                          d.margenesVisibles && v.itemsSinCosto
                            ? `${numero(v.itemsSinCosto)} ítems sin costo · fuera del margen`
                            : undefined
                        }
                      />
                    </th>
                    <td>{numero(v.ordenes)}</td>
                    <td>{dinero(v.ticketPromedio)}</td>
                    <td className={styles.emphasis}>{dinero(v.facturado)}</td>
                    {d.margenesVisibles ? (
                      <td
                        data-negative={v.margenPct != null && v.margenPct < 0}
                      >
                        {porcentaje(v.margenPct ?? null)}
                      </td>
                    ) : null}
                    {d.comisionesVisibles ? (
                      <td>
                        {v.comisionEstimada != null ? (
                          dinero(v.comisionEstimada)
                        ) : (
                          <span className={styles.muted}>Sin regla</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        ) : (
          <NoData
            title="Sin ventas en el período"
            description="Las órdenes emitidas con ventas se agrupan por vendedor."
          />
        )}
        <p className={styles.note}>
          Producción se atribuye al usuario que registra el trabajo; ventas, al
          vendedor de la orden.
          {d.margenesVisibles
            ? " El margen sólo incluye ítems con costo registrado."
            : ""}
          {d.comisionesVisibles
            ? " La comisión aplica las reglas configuradas a las ventas del período: es estimada, no liquidada."
            : ""}
        </p>
      </ReportCard>
      <ReportSource meta={d.meta} />
    </div>
  );
}
