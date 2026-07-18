"use client";

/**
 * Mi desempeño — la devolución del sistema al PROPIO operario (estudio
 * docs/metricas-equipo-operarios-estudio.md, F2). Muestra exactamente
 * los mismos números que ve el supervisor en el tab Equipo, scoped al
 * usuario logueado: tendencia contra uno mismo, nunca contra compañeros.
 * Reusa los primitivos y clases del Panel general.
 */

import * as React from "react";
import {
  AreaChart,
  BarraDesvio,
  Card,
  FUENTE_DISCIPLINA_COLORS,
  HBar,
  Kpi,
  LegendDot,
  Sparkline,
  StackedHBar,
  fmtAR,
  fmtMinutos,
  pct,
} from "@/components/panel/panel-general";
import type { MiDesempenoPanel } from "@/lib/panel-api";

export function MiDesempeno({ datos }: { datos: MiDesempenoPanel | null }) {
  if (!datos) {
    return (
      <div className="dash-scroll" style={{ padding: "26px 30px 44px" }}>
        <div className="dash">
          <div className="dash-head"><div className="title-block"><h1>Mi desempeño</h1></div></div>
          <div className="d-empty" style={{ padding: 40 }}>No se pudo cargar tu información. Probá recargar.</div>
        </div>
      </div>
    );
  }
  const d = datos;
  const sinActividad = d.serieSemanal.length === 0;
  const semanas = d.serieSemanal;
  const maxFamilia = Math.max(...d.familias.map((f) => f.minutos), 1);
  const conEficiencia = d.eficiencia.desvioPct != null;
  const desvio = d.eficiencia.desvioPct;

  return (
    <div className="dash-scroll" style={{ padding: "26px 30px 44px" }}>
      <div className="dash">
        <div className="dash-head">
          <div className="title-block">
            <h1>Mi desempeño</h1>
            <div className="sub">Tu trabajo de las últimas {d.ventana.semanas} semanas. Los mismos números que ve tu supervisor — acá no hay ranking.</div>
          </div>
        </div>

        {sinActividad ? (
          <div className="d-empty" style={{ padding: 48 }}>
            Todavía no registraste trabajo en pasos. Cuando arranques un paso desde el tablero, esta vista se llena sola.
          </div>
        ) : (
          <>
            <div className="d-kpi-row">
              <Kpi label="Hoy" value={fmtMinutos(d.hoy.minutos)} sub={`${d.hoy.pasos} paso${d.hoy.pasos === 1 ? "" : "s"} trabajado${d.hoy.pasos === 1 ? "" : "s"}`} />
              <Kpi label="Esta semana" value={fmtMinutos(d.semanaActual.minutos)} delta={d.semanaActual.vsPromedioPct}
                sub={d.semanaActual.vsPromedioPct != null ? "vs. tu promedio" : `${d.semanaActual.dias} día${d.semanaActual.dias === 1 ? "" : "s"} activo${d.semanaActual.dias === 1 ? "" : "s"}`} />
              <Kpi label="Tiempo medido" value={pct(d.disciplina.medidoPct, 0)} sub="de tus pasos, con cronómetro" hint="Cuando el tiempo sale del cronómetro, tus métricas y las cotizaciones del taller mejoran" />
              <Kpi label="Tus familias" value={fmtAR(d.familias.length)} sub={d.familias.some((f) => f.nueva) ? "¡sumaste una nueva!" : "tipos de trabajo que hacés"} />
            </div>

            <div className="dash-grid">
              <Card span={8} title="Tu constancia" sub="horas trabajadas por semana"
                foot={<span>La línea es tuya contra vos {d.semanaActual.vsPromedioPct != null ? <>— esta semana vas <strong style={{ color: d.semanaActual.vsPromedioPct >= 0 ? "var(--ok)" : "var(--ink)" }}>{d.semanaActual.vsPromedioPct >= 0 ? "+" : ""}{fmtAR(d.semanaActual.vsPromedioPct, 0)}%</strong> respecto de tu promedio.</> : "— todavía sin semanas previas para comparar."}</span>}>
                {semanas.length >= 2 ? (
                  <AreaChart series={semanas.map((s) => s.minutos / 60)} labels={semanas.map((s) => s.semana.slice(5))} yFormat={(v) => `${fmtAR(v, 0)}h`} height={210} nombres={["Horas"]} fmtValor={(v) => `${fmtAR(v, 1)} h`} />
                ) : (
                  <div className="d-empty" style={{ padding: 40 }}>Con un par de semanas más de trabajo vas a ver tu curva acá.</div>
                )}
              </Card>

              <Card span={4} title="Tu registro" sub="de dónde sale el tiempo de tus pasos">
                {d.disciplina.pasos === 0 ? <div className="d-empty" style={{ padding: 30 }}>Sin pasos completados en la ventana.</div> : (
                  <>
                    <StackedHBar segments={FUENTE_DISCIPLINA_COLORS.map((f) => ({ value: d.disciplina[f.key], color: f.color, label: f.label }))} />
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                      {FUENTE_DISCIPLINA_COLORS.map((f) => (
                        <LegendDot key={f.key} color={f.color} label={f.label} value={String(d.disciplina[f.key])} />
                      ))}
                    </div>
                    {d.disciplina.autoPausas > 0 ? (
                      <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--muted-text)" }}>
                        {d.disciplina.autoPausas} auto-pausa{d.disciplina.autoPausas === 1 ? "" : "s"}: el cronómetro quedó corriendo y el sistema lo cortó. Pausarlo vos mejora tu registro.
                      </div>
                    ) : null}
                  </>
                )}
              </Card>

              <Card span={7} title="Tu precisión vs. lo cotizado" sub="cuánto tardás contra lo que se presupuestó"
                foot={<span>Se calcula sólo con tus pasos cronometrados. Sirve para ajustar los tiempos que se cotizan — no es una nota.</span>}>
                {conEficiencia ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                    <div style={{ flex: 1 }}>
                      <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: Math.abs(desvio!) <= 10 ? "var(--muted-text)" : desvio! > 0 ? "var(--signal)" : "var(--ok)" }}>
                        {desvio! > 0 ? "+" : ""}{fmtAR(desvio!, 0)}%
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted-text)" }}>
                        {Math.abs(desvio!) <= 10 ? "en línea con lo cotizado" : desvio! > 0 ? "tardás más que lo cotizado" : "más rápido que lo cotizado"} · {d.eficiencia.muestras} pasos
                      </div>
                      <div style={{ marginTop: 10, maxWidth: 260 }}><BarraDesvio desvioPct={desvio} /></div>
                    </div>
                    {d.eficiencia.serie.length >= 2 ? (
                      <div style={{ textAlign: "center" }}>
                        <Sparkline values={d.eficiencia.serie.map((s) => s.desvioPct)} width={140} height={40} signal={(d.eficiencia.serie[d.eficiencia.serie.length - 1]?.desvioPct ?? 0) > 10} />
                        <div style={{ fontSize: 10.5, color: "var(--muted-text)", marginTop: 4 }}>tu tendencia semanal</div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="d-empty" style={{ padding: 26 }}>
                    Llevás {d.eficiencia.muestras} de {d.eficiencia.muestraMinima} pasos cronometrados: con menos que eso el número no dice nada de vos. Usá el cronómetro y esta métrica se destraba sola.
                  </div>
                )}
              </Card>

              <Card span={5} title="Tus familias de trabajo" sub="dónde pusiste el tiempo" flush>
                {d.familias.length === 0 ? <div className="d-empty" style={{ padding: 30 }}>Sin trabajo por familia en la ventana.</div> : (
                  <table className="d-tbl"><thead><tr><th>Familia</th><th style={{ width: 90 }} /><th className="right">Pasos</th><th className="right">Tiempo</th></tr></thead>
                    <tbody>{d.familias.map((f) => (
                      <tr key={f.familia}>
                        <td><div className="nm">{f.familia}{f.nueva ? <span style={{ marginLeft: 6, fontSize: 10, color: "var(--ok)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>nueva</span> : null}</div></td>
                        <td><HBar value={f.minutos} max={maxFamilia} tone={f.nueva ? "ok" : "ink"} /></td>
                        <td className="right mono">{f.pasos}</td>
                        <td className="right mono">{fmtMinutos(f.minutos)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </Card>
            </div>
          </>
        )}

        <div style={{ fontSize: 11, color: "var(--muted-text)", lineHeight: 1.5, marginTop: 4 }}>
          {d.limites.join(" ")}
        </div>
      </div>
    </div>
  );
}
