"use client";

import * as React from "react";
import {
  BarraDesvio,
  Card,
  fmtAR,
  fmtMinutos,
  Kpi,
  pct,
} from "@/components/panel/panel-general";
import {
  getEtaPrecision,
  getEtaSalud,
  type PrecisionEta,
  type SaludEta,
} from "@/lib/eta-api";

/** "corte_laser" → "Corte laser" cuando no hay nombre del catálogo. */
function prettyFamilia(codigo: string) {
  const s = codigo.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const min = (v: number | null) => (v == null ? "—" : fmtMinutos(v));

export function PanelSaludEta({
  initialPrecision,
  initialSalud,
  familiaNombres,
}: {
  initialPrecision: PrecisionEta;
  initialSalud: SaludEta;
  familiaNombres: Record<string, string>;
}) {
  const [precision, setPrecision] = React.useState(initialPrecision);
  const [salud, setSalud] = React.useState(initialSalud);
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refrescar = async () => {
    setCargando(true);
    setError(null);
    try {
      const [p, s] = await Promise.all([getEtaPrecision(), getEtaSalud()]);
      setPrecision(p);
      setSalud(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar.");
    } finally {
      setCargando(false);
    }
  };

  const nombreFamilia = (codigo: string) =>
    familiaNombres[codigo] ?? prettyFamilia(codigo);

  const hayMuestras = precision.muestras > 0;
  // + = tiende a terminar tarde; lo mostramos con su signo y una etiqueta.
  const sesgo = precision.sesgoMin;

  return (
    <div className="dash-scroll" style={{ padding: "26px 30px 44px" }}>
      <div className="dash">
        <div className="dash-head">
          <div className="title-block">
            <h1>Salud del ETA</h1>
            <div className="sub">
              Qué tan confiable es la fecha que prometemos, medida contra lo que
              realmente pasó.
            </div>
          </div>
          <div className="actions">
            <button
              className="btn-ghost"
              onClick={refrescar}
              disabled={cargando}
            >
              {cargando ? "Actualizando…" : "Actualizar"}
            </button>
          </div>
        </div>

        {error ? <div className="d-empty">{error}</div> : null}

        {/* ── Precisión de las promesas ── */}
        <div className="d-kpi-row cols-4">
          <Kpi
            label="Promesas medidas"
            value={fmtAR(precision.muestras)}
            sub={`${fmtAR(precision.cerradas)} OT finalizadas`}
            hint="Promesas de emisión ya cerradas con un ETA estimable. La cobertura excluye las que salieron sin estimar."
          />
          <Kpi
            label="Error medio (MAE)"
            value={min(precision.maeMin)}
            sub="promedio del desvío"
            hint="Promedio del error absoluto entre el ETA prometido y el fin real."
          />
          <Kpi
            label="Mediana del error"
            value={min(precision.medianaAbsMin)}
            sub={`p90 ${min(precision.p90AbsMin)}`}
            hint="La mitad de las OT erran menos que esto; el p90, el 90%."
          />
          <Kpi
            label="Sesgo"
            value={
              sesgo == null ? "—" : `${sesgo > 0 ? "+" : ""}${fmtMinutos(Math.abs(sesgo))}`
            }
            sub={
              sesgo == null
                ? undefined
                : sesgo > 0
                  ? "tiende a terminar TARDE"
                  : "tiende a terminar temprano"
            }
            delta={sesgo == null ? undefined : sesgo}
            deltaTone="inverse"
            hint="Media del error CON signo. Positivo = prometemos antes de lo que cumplimos."
          />
        </div>

        {!hayMuestras ? (
          <div className="d-empty" style={{ padding: 30 }}>
            Todavía no hay promesas cerradas para medir. A medida que se emitan y
            finalicen OT, la precisión se va acumulando sola.
          </div>
        ) : (
          <div className="d-kpi-row cols-4">
            <Kpi
              label="Dentro de ±4 h"
              value={pct(precision.dentro4hPct)}
              sub="del ETA prometido"
            />
            <Kpi
              label="Dentro de ±1 día"
              value={pct(precision.dentro1dPct)}
              sub="del ETA prometido"
            />
            <Kpi
              label="Terminaron tarde"
              value={pct(precision.tardePct)}
              sub="después del ETA"
              delta={precision.tardePct != null ? precision.tardePct : undefined}
              deltaTone="inverse"
            />
            <Kpi
              label="Cobertura"
              value={pct(precision.coberturaPct)}
              sub={`${fmtAR(precision.sinEstimar)} sin estimar`}
              hint="Fracción de las OT cerradas que tenían un ETA (el resto salió sin duración estimable)."
            />
          </div>
        )}

        <div className="dash-grid">
          {/* ── Cobertura del pronóstico (todas las promesas, abiertas y cerradas) ── */}
          <Card
            span={5}
            title="Cobertura del pronóstico"
            sub="calidad de datos de las promesas vivas"
          >
            <div className="d-kpi-row cols-3" style={{ marginTop: 4 }}>
              <Kpi label="Promesas" value={fmtAR(salud.cobertura.promesas)} />
              <Kpi
                label="Con ETA"
                value={pct(salud.cobertura.conEtaPct)}
                sub="estimable"
              />
              <Kpi
                label="Con supuestos"
                value={pct(salud.cobertura.parcialPct)}
                sub="calendario / sin estación"
                delta={
                  salud.cobertura.parcialPct > 0
                    ? salud.cobertura.parcialPct
                    : undefined
                }
                deltaTone="inverse"
              />
            </div>
            <div
              className="sub"
              style={{ padding: "10px 4px 2px", color: "var(--muted-text)" }}
            >
              {salud.cobertura.sinEstimarPct > 0
                ? `Un ${pct(salud.cobertura.sinEstimarPct)} de las promesas no se pudo estimar: revisá los pasos sin duración cargada.`
                : "Todas las promesas tienen un ETA estimable."}
            </div>
          </Card>

          {/* ── Sesgo de duración por familia + sugeridor ── */}
          <Card
            span={7}
            title="Calibración de duraciones por familia"
            sub="estimado vs. real medido — dónde ajustar"
            flush
            foot={
              <span>
                <span className="d-pip warn" style={{ marginRight: 4 }} />
                Con sugerencia = el sesgo supera el 20% con evidencia. Aplicarla
                es decisión tuya.
              </span>
            }
          >
            {salud.sesgoFamilias.length === 0 ? (
              <div className="d-empty" style={{ padding: 26 }}>
                Sin suficientes pasos medidos por familia todavía (mínimo 3). El
                registro de tiempos alimenta esta tabla.
              </div>
            ) : (
              <table className="d-tbl">
                <thead>
                  <tr>
                    <th>Familia</th>
                    <th className="right">Estimado</th>
                    <th className="right">Real</th>
                    <th style={{ width: 110 }} />
                    <th className="right">Sesgo</th>
                    <th className="right">Sugerencia</th>
                  </tr>
                </thead>
                <tbody>
                  {salud.sesgoFamilias.map((f) => {
                    const color =
                      Math.abs(f.sesgoPct) <= 10
                        ? "var(--muted-text)"
                        : f.sesgoMin > 0
                          ? "var(--signal)"
                          : "var(--ok)";
                    return (
                      <tr key={f.familiaCodigo}>
                        <td>
                          <div className="nm">
                            {nombreFamilia(f.familiaCodigo)}
                          </div>
                          <div
                            className="sub"
                            style={{
                              color:
                                f.muestras < 5 ? "var(--signal)" : undefined,
                            }}
                          >
                            {f.muestras} paso{f.muestras === 1 ? "" : "s"} medido
                            {f.muestras === 1 ? "" : "s"}
                            {f.muestras < 5 ? " · poca señal" : ""}
                          </div>
                        </td>
                        <td className="right mono">
                          {fmtMinutos(f.medianaEstimadoMin)}
                        </td>
                        <td className="right mono">
                          {fmtMinutos(f.medianaRealMin)}
                        </td>
                        <td>
                          <BarraDesvio desvioPct={f.sesgoPct} />
                        </td>
                        <td className="right">
                          <div
                            className="mono"
                            style={{ fontWeight: 600, color }}
                          >
                            {f.sesgoMin > 0 ? "+" : ""}
                            {fmtAR(f.sesgoPct, 0)}%
                          </div>
                          <div
                            style={{ fontSize: 10.5, color: "var(--muted-text)" }}
                          >
                            {Math.abs(f.sesgoPct) <= 10
                              ? "calibrado"
                              : f.sesgoMin > 0
                                ? "subestimado"
                                : "sobreestimado"}
                          </div>
                        </td>
                        <td className="right">
                          {f.duracionSugeridaMin != null ? (
                            <span className="ds-chip" title="Corrección sugerida (no aplicada)">
                              → {fmtMinutos(f.duracionSugeridaMin)}
                            </span>
                          ) : (
                            <span className="mono muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
