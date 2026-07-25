"use client";

/**
 * Gastos fijos de estructura — vista portada VERBATIM del diseño Grafoprint
 * ("Gastos fijos.html"), conectada al backend real. Sin los elementos de
 * punto de equilibrio (ese cálculo vive en Reportes).
 * Ver docs/gastos-fijos-estructura-diseno.md
 */

import * as React from "react";
import { toast } from "sonner";
import { ConciliacionNominaCard } from "@/components/costos/conciliacion-nomina-card";

import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import {
  CATEGORIAS_GASTO_FIJO,
  CATEGORIA_GASTO_INFO,
  createGastoFijo,
  eliminarGastoFijo,
  getGastosFijos,
  toggleGastoFijo,
  type CategoriaGastoFijo,
  type GastoFijo,
} from "@/lib/gastos-fijos-api";

/* ─── helpers ─── */
const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function monthLbl(s: string | null): string | null {
  if (!s) return null;
  const [y, m] = s.split("-");
  return `${MESES[Number(m) - 1]} ${y.slice(2)}`;
}
function mesActual(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
}
function mesAnterior(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function vigenteEn(g: GastoFijo, mes: string): boolean {
  return g.activo && g.vigenteDesde <= mes && (g.vigenteHasta === null || mes <= g.vigenteHasta);
}
const info = (c: string) => CATEGORIA_GASTO_INFO[c as CategoriaGastoFijo] ?? { label: c, color: "#8a8a93" };

/* ─── icons (verbatim del diseño) ─── */
const IcCard = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></svg>);
const IcList = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 6h16M4 12h16M4 18h10" /></svg>);
const IcChart = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 3v18h18" /><path d="M7 15l4-6 3 4 4-7" /></svg>);
const IcPlus = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>);
const IcPower = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18.36 6.64A9 9 0 1 1 5.64 6.64" /><path d="M12 2v10" /></svg>);
const IcTrash = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>);

const MES = mesActual();
const FORM_VACIO = { nombre: "", categoria: "SUELDOS" as CategoriaGastoFijo, importe: "", vigenteDesde: MES, vigenteHasta: "" };

export function GastosFijosPanel({ initialGastos }: { initialGastos: GastoFijo[] }) {
  const [gastos, setGastos] = React.useState<GastoFijo[]>(initialGastos);
  const [form, setForm] = React.useState(FORM_VACIO);
  const [guardando, setGuardando] = React.useState(false);
  const [aEliminar, setAEliminar] = React.useState<GastoFijo | null>(null);
  const nombreRef = React.useRef<HTMLInputElement>(null);

  const recargar = React.useCallback(async () => {
    try {
      setGastos(await getGastosFijos());
    } catch {
      toast.error("No se pudo actualizar la lista.");
    }
  }, []);

  /* ─── agregados (sobre lo vigente este mes) ─── */
  const vigentes = gastos.filter((g) => vigenteEn(g, MES));
  const total = vigentes.reduce((s, g) => s + g.importeMensual, 0);
  const inactivos = gastos.filter((g) => !g.activo).length;
  const prevTotal = gastos.filter((g) => vigenteEn(g, mesAnterior(MES))).reduce((s, g) => s + g.importeMensual, 0);
  const deltaPct = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;

  const byCat = new Map<string, number>();
  for (const g of vigentes) byCat.set(g.categoria, (byCat.get(g.categoria) ?? 0) + g.importeMensual);
  const comp = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const top = comp[0];

  async function agregar(event: React.FormEvent) {
    event.preventDefault();
    const importe = Number((form.importe || "").replace(/\D/g, ""));
    if (!form.nombre.trim()) return toast.error("Poné un nombre al gasto.");
    if (!importe) return toast.error("El importe mensual no es válido.");
    if (form.vigenteHasta && form.vigenteHasta < form.vigenteDesde)
      return toast.error('La vigencia "hasta" no puede ser anterior a "desde".');
    setGuardando(true);
    try {
      await createGastoFijo({
        nombre: form.nombre.trim(),
        categoria: form.categoria,
        importeMensual: importe,
        vigenteDesde: form.vigenteDesde || MES,
        vigenteHasta: form.vigenteHasta || null,
      });
      toast.success("Gasto fijo agregado.");
      setForm(FORM_VACIO);
      await recargar();
      nombreRef.current?.focus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function alternar(g: GastoFijo) {
    try {
      await toggleGastoFijo(g.id);
      await recargar();
    } catch {
      toast.error("No se pudo cambiar el estado.");
    }
  }

  return (
    <div className="gf">
      <div className="wrap">
        {/* head */}
        <div className="page-head">
          <div>
            <h1>Gastos fijos de estructura</h1>
            <div className="sub">
              La estructura mensual que tu facturación debe cubrir. Es la base del <b>punto de equilibrio</b> de
              Reportes. Independiente de los centros de costo (que sirven para las tarifas): podés tener sueldos
              en ambos lados sin doble conteo.
            </div>
          </div>
          <div className="total-badge">
            <div className="lbl">Total fijo vigente · {MES}</div>
            <div className="val">{fmt(total)}</div>
            <div className="unit">por mes · {vigentes.length} conceptos</div>
          </div>
        </div>

        <ConciliacionNominaCard mes={MES} onAlineado={recargar} />

        {/* KPIs (sin "Facturación de equilibrio") */}
        <div className="kpis">
          <div className="kpi">
            <div className="l"><IcCard />Total mensual</div>
            <div className="v">{fmt(total)}</div>
            <div className="h">
              {deltaPct === null ? (
                "sin mes anterior para comparar"
              ) : (
                <>
                  <span className={deltaPct <= 0 ? "up" : "dn"}>
                    {deltaPct <= 0 ? "↓" : "↑"} {Math.abs(deltaPct).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%
                  </span>{" "}
                  vs mes anterior
                </>
              )}
            </div>
          </div>
          <div className="kpi">
            <div className="l"><IcList />Conceptos vigentes</div>
            <div className="v">{vigentes.length}</div>
            <div className="h">{inactivos} inactivos</div>
          </div>
          <div className="kpi">
            <div className="l"><IcChart />Categoría mayor</div>
            <div className="v" style={{ fontSize: 16 }}>{top ? info(top[0]).label : "—"}</div>
            <div className="h">{top && total > 0 ? `${Math.round((top[1] / total) * 100)}% de la estructura` : "—"}</div>
          </div>
        </div>

        <div className="grid">
          {/* LEFT: form + tabla */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div className="card">
              <div className="card-head">
                <h2>Agregar gasto fijo</h2>
                <span className="grow" />
                <span className="cap">se suma a la estructura del mes seleccionado</span>
              </div>
              <div className="card-body">
                <form onSubmit={agregar}>
                  <div className="form-grid">
                    <div className="field wide">
                      <label>Nombre</label>
                      <input ref={nombreRef} className="ctl" placeholder="Ej: Alquiler del local" value={form.nombre}
                        onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label>Categoría</label>
                      <select className="ctl" value={form.categoria}
                        onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value as CategoriaGastoFijo }))}>
                        {CATEGORIAS_GASTO_FIJO.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label>Importe mensual</label>
                      <div className="money">
                        <span className="pfx">$</span>
                        <input className="ctl" inputMode="numeric" placeholder="0" value={form.importe}
                          onChange={(e) => { const n = e.target.value.replace(/\D/g, ""); setForm((f) => ({ ...f, importe: n ? Number(n).toLocaleString("es-AR") : "" })); }} />
                      </div>
                    </div>
                    <div className="field">
                      <label>Vigente desde</label>
                      <input className="ctl" type="month" value={form.vigenteDesde}
                        onChange={(e) => setForm((f) => ({ ...f, vigenteDesde: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label>Vigente hasta <span className="opt">· opcional</span></label>
                      <input className="ctl" type="month" value={form.vigenteHasta}
                        onChange={(e) => setForm((f) => ({ ...f, vigenteHasta: e.target.value }))} />
                    </div>
                    <div className="field wide" style={{ flexDirection: "row", gap: 10, marginTop: 2 }}>
                      <button className="btn" type="submit" disabled={guardando}><IcPlus />Agregar gasto</button>
                      <button className="btn ghost" type="button" onClick={() => setForm(FORM_VACIO)}>Limpiar</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h2>Gastos fijos cargados</h2>
                <span className="grow" />
                <span className="cap">{gastos.length} conceptos</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Nombre</th><th>Categoría</th><th className="right">Importe mensual</th>
                      <th>Vigencia</th><th>Estado</th><th className="right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gastos.length === 0 ? (
                      <tr><td colSpan={6}><div className="empty"><IcCard /><div>Todavía no cargaste gastos fijos.</div></div></td></tr>
                    ) : gastos.map((g) => {
                      const vig = vigenteEn(g, MES);
                      const tag = !g.activo
                        ? <span className="tag mut"><span className="d" />Inactivo</span>
                        : !vig
                        ? <span className="tag mut"><span className="d" />Fuera de vigencia</span>
                        : g.vigenteHasta
                        ? <span className="tag warn"><span className="d" />Vence {monthLbl(g.vigenteHasta)}</span>
                        : <span className="tag ok"><span className="d" />Vigente</span>;
                      return (
                        <tr key={g.id} className={g.activo ? "" : "off"}>
                          <td className="nm-cell"><div className="nm">{g.nombre}</div></td>
                          <td><span className="cat"><span className="dot" style={{ background: info(g.categoria).color }} />{info(g.categoria).label}</span></td>
                          <td className="amt-cell">{fmt(g.importeMensual)}</td>
                          <td>
                            <span className="vig">
                              {monthLbl(g.vigenteDesde)}<span className="arw">→</span>
                              {g.vigenteHasta ? monthLbl(g.vigenteHasta) : <span className="open">en curso</span>}
                            </span>
                          </td>
                          <td>{tag}</td>
                          <td>
                            <span className="acts">
                              <button className="icon-btn" title={g.activo ? "Inactivar" : "Activar"} onClick={() => alternar(g)}><IcPower /></button>
                              <button className="icon-btn danger" title="Eliminar" onClick={() => setAEliminar(g)}><IcTrash /></button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="foot">
                <span className="lbl">Total fijo vigente por mes</span>
                <span className="sum">{fmt(total)}</span>
              </div>
            </div>
          </div>

          {/* RIGHT: composición (sin bloque de equilibrio) */}
          <div className="card">
            <div className="card-head">
              <h2>Composición de la estructura</h2>
              <span className="grow" />
              <span className="cap">dónde se va el fijo</span>
            </div>
            <div className="card-body">
              {comp.length === 0 ? (
                <div className="empty"><IcChart /><div>Sin gastos vigentes este mes.</div></div>
              ) : (
                <>
                  <div className="comp-bar">
                    {comp.map(([k, v]) => <span key={k} style={{ width: `${(v / total) * 100}%`, background: info(k).color }} />)}
                  </div>
                  <div className="comp-list">
                    {comp.map(([k, v]) => (
                      <div key={k} className="comp-row">
                        <span className="dot" style={{ background: info(k).color }} />
                        <span className="nm">{info(k).label}</span>
                        <span className="amt">{fmt(v)}</span>
                        <span className="pct">{Math.round((v / total) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmacionDestructiva
        open={aEliminar !== null}
        onOpenChange={(o) => { if (!o) setAEliminar(null); }}
        titulo="Eliminar gasto fijo"
        descripcion={<>Se quita <strong>{aEliminar?.nombre}</strong> de la estructura de costos fijos.</>}
        nombreItem={aEliminar?.nombre}
        requiereTipear={false}
        accionLabel="Eliminar"
        onConfirmar={async () => {
          if (!aEliminar) return;
          try {
            await eliminarGastoFijo(aEliminar.id);
            toast.success("Gasto fijo eliminado.");
            setAEliminar(null);
            await recargar();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "No se pudo eliminar.");
          }
        }}
      />
    </div>
  );
}

