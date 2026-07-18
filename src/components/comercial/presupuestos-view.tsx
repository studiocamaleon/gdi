"use client";

/**
 * Presupuestos — listado + detalle del ciclo comercial
 * (docs/presupuestos-modulo-estudio.md). Reusa el shell visual del listado
 * de OTs (otl-*). El detalle vive en un panel lateral con el timeline y
 * las acciones válidas según estado.
 */

import * as React from "react";
import Link from "next/link";
import { PlusIcon, SearchIcon, FileTextIcon, LinkIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import {
  MOTIVOS_PERDIDA,
  convertirPresupuesto,
  enviarPresupuesto,
  getPresupuesto,
  listarPresupuestos,
  presupuestoPdfUrl,
  presupuestoPublicUrl,
  resolverPresupuesto,
  type PresupuestoDetalle,
  type PresupuestoEstado,
  type PresupuestosListado,
} from "@/lib/presupuestos-api";

const ESTADO_META: Record<PresupuestoEstado, { label: string; color: string; bg: string }> = {
  borrador: { label: "Borrador", color: "#6e6e76", bg: "rgba(20,20,26,.06)" },
  enviado: { label: "Enviado", color: "#1d4ed8", bg: "rgba(29,78,216,.09)" },
  aprobado: { label: "Aprobado", color: "#16794a", bg: "rgba(22,121,74,.10)" },
  rechazado: { label: "Rechazado", color: "#c2410c", bg: "rgba(194,65,12,.10)" },
  vencido: { label: "Vencido", color: "#92929b", bg: "rgba(20,20,26,.05)" },
  convertido: { label: "Convertido", color: "#14141a", bg: "rgba(20,20,26,.08)" },
};

const fmtMoneda = (n: number) =>
  "$" + Math.round(n).toLocaleString("es-AR");
const fmtFecha = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

function EstadoBadge({ estado, visto }: { estado: PresupuestoEstado; visto?: boolean }) {
  const meta = ESTADO_META[estado];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, color: meta.color, background: meta.bg, whiteSpace: "nowrap" }}>
        {meta.label}
      </span>
      {estado === "enviado" && visto ? (
        <span title="El cliente abrió el presupuesto" style={{ fontSize: 10.5, color: "#16794a", fontWeight: 600 }}>· visto</span>
      ) : null}
    </span>
  );
}

export function PresupuestosView({ initial }: { initial: PresupuestosListado }) {
  const [data, setData] = React.useState(initial);
  const [filtro, setFiltro] = React.useState<PresupuestoEstado | "todos">("todos");
  const [busqueda, setBusqueda] = React.useState("");
  const [abiertoId, setAbiertoId] = React.useState<string | null>(null);

  const recargar = React.useCallback(async () => {
    try {
      setData(await listarPresupuestos());
    } catch {
      /* la vista conserva lo último */
    }
  }, []);

  const lista = data.presupuestos.filter((p) => {
    if (filtro !== "todos" && p.estado !== filtro) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      if (!p.numero.toLowerCase().includes(q) && !p.cliente.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const statDe = (estado: PresupuestoEstado) =>
    data.stats.find((s) => s.estado === estado) ?? { cantidad: 0, total: 0 };
  const pipeline = statDe("enviado");
  const aprobados = statDe("aprobado");
  const enviadosResueltos =
    statDe("aprobado").cantidad + statDe("rechazado").cantidad + statDe("vencido").cantidad + statDe("convertido").cantidad;
  const ganados = statDe("aprobado").cantidad + statDe("convertido").cantidad;

  const chips: Array<{ k: PresupuestoEstado | "todos"; label: string }> = [
    { k: "todos", label: "Todos" },
    { k: "borrador", label: "Borrador" },
    { k: "enviado", label: "Enviados" },
    { k: "aprobado", label: "Aprobados" },
    { k: "rechazado", label: "Rechazados" },
    { k: "vencido", label: "Vencidos" },
    { k: "convertido", label: "Convertidos" },
  ];
  const countChip = (k: PresupuestoEstado | "todos") =>
    k === "todos" ? data.presupuestos.length : data.presupuestos.filter((p) => p.estado === k).length;

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "28px 34px 60px" }}>
      <div className="otl-inner">
        <div className="otl-head">
          <div className="left">
            <h1>Presupuestos</h1>
            <div className="sub">El ciclo comercial: enviá, seguí la decisión del cliente y convertí en orden.</div>
          </div>
          <div className="right">
            <Link href="/comercial/crear-propuesta" className="btn btn-primary">
              <PlusIcon />
              Nuevo presupuesto
            </Link>
          </div>
        </div>

        <div className="otl-kpis">
          <div className="otl-kpi">
            <div className="k-lbl">Pipeline abierto</div>
            <div className="k-val mono">{fmtMoneda(pipeline.total)}</div>
            <div className="k-hint">{pipeline.cantidad} enviados esperando decisión</div>
          </div>
          <div className="otl-kpi">
            <div className="k-lbl">Aprobados sin convertir</div>
            <div className="k-val mono">{fmtMoneda(aprobados.total)}</div>
            <div className="k-hint">{aprobados.cantidad} listos para pasar a OT</div>
          </div>
          <div className="otl-kpi">
            <div className="k-lbl">Tasa de cierre</div>
            <div className="k-val mono">
              {enviadosResueltos > 0 ? `${Math.round((ganados / enviadosResueltos) * 100)}%` : "—"}
            </div>
            <div className="k-hint">ganados sobre resueltos</div>
          </div>
          <div className="otl-kpi accent">
            <div className="k-lbl">Perdidos</div>
            <div className="k-val mono">{statDe("rechazado").cantidad + statDe("vencido").cantidad}</div>
            <div className="k-hint">{fmtMoneda(statDe("rechazado").total + statDe("vencido").total)} con motivo registrado</div>
          </div>
        </div>

        <div className="otl-toolbar">
          <div className="otl-filters">
            {chips.map((f) => (
              <button key={f.k} type="button" className={`otl-fchip ${filtro === f.k ? "on" : ""}`} onClick={() => setFiltro(f.k)}>
                {f.label}
                <span className="ct">{countChip(f.k)}</span>
              </button>
            ))}
          </div>
          <div className="otl-tools-right">
            <div className="otl-search">
              <SearchIcon size={15} />
              <input placeholder="Buscar por Nº, cliente…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
          </div>
        </div>

        {lista.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--muted-text, #6e6e76)", fontSize: 13.5 }}>
            {data.presupuestos.length === 0
              ? "Todavía no emitiste presupuestos. Crealos desde la ficha comercial con el selector en “Presupuesto”."
              : "Ningún presupuesto coincide con el filtro."}
          </div>
        ) : (
          <div style={{ border: "1px solid #efece8", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#fafaf9", color: "#6e6e76", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em", textAlign: "left" }}>
                  <th style={{ padding: "9px 14px" }}>Número</th>
                  <th style={{ padding: "9px 14px" }}>Cliente</th>
                  <th style={{ padding: "9px 14px" }}>Estado</th>
                  <th style={{ padding: "9px 14px" }}>Emisión</th>
                  <th style={{ padding: "9px 14px" }}>Válido hasta</th>
                  <th style={{ padding: "9px 14px", textAlign: "right" }}>Total</th>
                  <th style={{ padding: "9px 14px" }}>Vendedor</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id} onClick={() => setAbiertoId(p.id)} style={{ borderTop: "1px solid #efece8", cursor: "pointer" }}>
                    <td className="mono" style={{ padding: "11px 14px", fontWeight: 600 }}>{p.numero}</td>
                    <td style={{ padding: "11px 14px" }}>{p.cliente}<span style={{ color: "#92929b" }}> · {p.items} item{p.items === 1 ? "" : "s"}</span></td>
                    <td style={{ padding: "11px 14px" }}>
                      <EstadoBadge estado={p.estado} visto={p.visto} />
                      {p.estado === "convertido" && p.ordenConvertida ? (
                        <span className="mono" style={{ marginLeft: 6, fontSize: 11, color: "#6e6e76" }}>→ {p.ordenConvertida}</span>
                      ) : null}
                    </td>
                    <td className="mono" style={{ padding: "11px 14px" }}>{fmtFecha(p.fechaEmision)}</td>
                    <td className="mono" style={{ padding: "11px 14px" }}>{fmtFecha(p.fechaValidez)}</td>
                    <td className="mono" style={{ padding: "11px 14px", textAlign: "right", fontWeight: 600 }}>{fmtMoneda(p.total)}</td>
                    <td style={{ padding: "11px 14px", color: "#6e6e76" }}>{p.vendedor ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {abiertoId ? (
        <PresupuestoPanel id={abiertoId} onCerrar={() => setAbiertoId(null)} onCambio={recargar} />
      ) : null}
    </div>
  );
}

/* ─── Panel lateral de detalle ─── */
function PresupuestoPanel({ id, onCerrar, onCambio }: { id: string; onCerrar: () => void; onCambio: () => void }) {
  const [d, setD] = React.useState<PresupuestoDetalle | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [trabajando, setTrabajando] = React.useState(false);
  const [rechazoAbierto, setRechazoAbierto] = React.useState(false);
  const [motivo, setMotivo] = React.useState("precio");
  const [motivoDetalle, setMotivoDetalle] = React.useState("");
  const [seleccion, setSeleccion] = React.useState<Set<string>>(new Set());

  const cargar = React.useCallback(async () => {
    try {
      const det = await getPresupuesto(id);
      setD(det);
      setSeleccion(new Set(det.items.map((i) => i.cotizacionItemId).filter((x): x is string => x != null)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el presupuesto.");
    }
  }, [id]);
  React.useEffect(() => { void cargar(); }, [cargar]);

  const accion = async (fn: () => Promise<unknown>, ok: string) => {
    setTrabajando(true);
    try {
      await fn();
      toast.success(ok);
      await cargar();
      onCambio();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar la acción.");
    } finally {
      setTrabajando(false);
    }
  };

  const copiarLink = () => {
    if (!d?.publicToken) return;
    void navigator.clipboard.writeText(presupuestoPublicUrl(d.publicToken));
    toast.success("Link copiado. Compartilo con el cliente: puede aprobar desde ahí.");
  };

  const convertir = () =>
    accion(async () => {
      const total = d!.items.filter((i) => i.cotizacionItemId != null).length;
      const parcial = seleccion.size < total;
      const res = await convertirPresupuesto(id, parcial ? { itemIds: [...seleccion] } : {});
      toast.success(`Orden ${res.ordenNumero} creada en borrador — revisá la fecha de entrega y emitila.`);
    }, "Presupuesto convertido.");

  const btn = (label: string, onClick: () => void, primario = false, deshabilitado = false) => (
    <button type="button" className={`btn ${primario ? "btn-primary" : ""}`} onClick={onClick} disabled={trabajando || deshabilitado} style={{ fontSize: 12.5 }}>
      {label}
    </button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end", background: "rgba(20,20,26,.28)" }} onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 96vw)", height: "100%", background: "#fff", overflowY: "auto", padding: "22px 24px 40px", boxShadow: "-12px 0 40px rgba(20,20,26,.18)" }}>
        {error ? <div style={{ padding: 30, color: "#c2410c" }}>{error}</div> : !d ? (
          <div style={{ padding: 30, color: "#6e6e76" }}>Cargando…</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h2 className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{d.numero}</h2>
              <EstadoBadge estado={d.estado} visto={d.primeraVistaEl != null} />
              <div style={{ flex: 1 }} />
              <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ background: "none", border: 0, cursor: "pointer", color: "#6e6e76" }}><XIcon size={18} /></button>
            </div>
            <div style={{ fontSize: 12.5, color: "#6e6e76", marginBottom: 14 }}>
              {d.cliente?.nombre ?? "Sin cliente"} · emitido {fmtFecha(d.fechaEmision)} · válido hasta {fmtFecha(d.fechaValidez)}
              {d.vendedor ? ` · ${d.vendedor.nombre}` : ""}
            </div>

            {/* Acciones según estado */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              <a className="btn" href={presupuestoPdfUrl(d.id)} target="_blank" rel="noreferrer" style={{ fontSize: 12.5 }}>
                <FileTextIcon size={14} /> PDF
              </a>
              {d.publicToken && (d.estado === "enviado" || d.estado === "aprobado") ? (
                <button type="button" className="btn" onClick={copiarLink} style={{ fontSize: 12.5 }}>
                  <LinkIcon size={14} /> Copiar link del cliente
                </button>
              ) : null}
              {d.estado === "borrador" ? btn("Enviar al cliente", () => void accion(() => enviarPresupuesto(id), "Presupuesto enviado — copiá el link y compartilo."), true) : null}
              {d.estado === "enviado" ? btn("Marcar aprobado", () => void accion(() => resolverPresupuesto(id, { resultado: "aprobado" }), "Aprobado.")) : null}
              {d.estado === "enviado" || d.estado === "vencido" ? btn("Marcar perdido", () => setRechazoAbierto(true)) : null}
              {d.estado === "enviado" || d.estado === "aprobado" ? btn("Convertir en OT", () => void convertir(), true) : null}
              {d.estado === "convertido" && d.ordenConvertidaId ? (
                <Link className="btn btn-primary" href={`/produccion/ordenes/${d.ordenConvertidaId}`} style={{ fontSize: 12.5 }}>
                  Ver orden {d.ordenConvertida}
                </Link>
              ) : null}
            </div>

            {rechazoAbierto ? (
              <div style={{ border: "1px solid #efece8", borderRadius: 10, padding: 14, marginBottom: 16, background: "#fafaf9" }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>¿Por qué se perdió? (alimenta tus métricas)</div>
                <select value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #d4d2cd", fontSize: 13, marginBottom: 8 }}>
                  {MOTIVOS_PERDIDA.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <input placeholder="Detalle (opcional)" value={motivoDetalle} onChange={(e) => setMotivoDetalle(e.target.value)} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid #d4d2cd", fontSize: 13, marginBottom: 10 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  {btn("Confirmar pérdida", () => { setRechazoAbierto(false); void accion(() => resolverPresupuesto(id, { resultado: "rechazado", motivoPerdida: motivo, motivoPerdidaDetalle: motivoDetalle || undefined }), "Registrado como perdido."); }, true)}
                  {btn("Cancelar", () => setRechazoAbierto(false))}
                </div>
              </div>
            ) : null}

            {/* Items (con selección para conversión parcial) */}
            <div style={{ border: "1px solid #efece8", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead><tr style={{ background: "#fafaf9", color: "#6e6e76", fontSize: 10.5, textTransform: "uppercase", textAlign: "left" }}>
                  {(d.estado === "enviado" || d.estado === "aprobado") ? <th style={{ padding: "7px 10px", width: 30 }} /> : null}
                  <th style={{ padding: "7px 10px" }}>Item</th><th style={{ padding: "7px 10px", textAlign: "right" }}>Cant.</th><th style={{ padding: "7px 10px", textAlign: "right" }}>Total</th>
                </tr></thead>
                <tbody>
                  {d.items.map((i, idx) => (
                    <tr key={i.cotizacionItemId ?? idx} style={{ borderTop: "1px solid #efece8" }}>
                      {(d.estado === "enviado" || d.estado === "aprobado") ? (
                        <td style={{ padding: "8px 10px" }}>
                          {i.cotizacionItemId ? (
                            <input type="checkbox" checked={seleccion.has(i.cotizacionItemId)} onChange={(e) => {
                              const s = new Set(seleccion);
                              if (e.target.checked) s.add(i.cotizacionItemId!);
                              else s.delete(i.cotizacionItemId!);
                              setSeleccion(s);
                            }} title="Incluir al convertir" />
                          ) : null}
                        </td>
                      ) : null}
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ fontWeight: 600 }}>{i.nombre}</div>
                        {i.adicionales.length ? <div style={{ fontSize: 11, color: "#6e6e76" }}>+ {i.adicionales.join(", ")}</div> : null}
                      </td>
                      <td className="mono" style={{ padding: "8px 10px", textAlign: "right" }}>{i.cantidad.toLocaleString("es-AR")} {i.cantidadUnidad}</td>
                      <td className="mono" style={{ padding: "8px 10px", textAlign: "right" }}>{fmtMoneda(i.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 18, padding: "10px 12px", borderTop: "1px solid #efece8", fontSize: 12.5, background: "#fafaf9" }}>
                <span style={{ color: "#6e6e76" }}>Subtotal <strong className="mono" style={{ color: "#14141a" }}>{fmtMoneda(d.subtotal)}</strong></span>
                {d.cargosDirectos > 0 ? <span style={{ color: "#6e6e76" }}>Cargos <strong className="mono" style={{ color: "#14141a" }}>{fmtMoneda(d.cargosDirectos)}</strong></span> : null}
                <span style={{ color: "#6e6e76" }}>Impuestos <strong className="mono" style={{ color: "#14141a" }}>{fmtMoneda(d.impuestos)}</strong></span>
                <span style={{ color: "#6e6e76" }}>Total <strong className="mono" style={{ color: "#14141a", fontSize: 14 }}>{fmtMoneda(d.total)}</strong></span>
              </div>
            </div>

            {d.motivoPerdida ? (
              <div style={{ fontSize: 12.5, color: "#c2410c", marginBottom: 14 }}>
                Perdido por: {MOTIVOS_PERDIDA.find((m) => m.value === d.motivoPerdida)?.label ?? d.motivoPerdida}
                {d.motivoPerdidaDetalle ? ` — ${d.motivoPerdidaDetalle}` : ""}
              </div>
            ) : null}

            {/* Timeline */}
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "#6e6e76", marginBottom: 8 }}>Historial</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {d.eventos.map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 10, fontSize: 12.5 }}>
                  <span className="mono" style={{ color: "#92929b", whiteSpace: "nowrap" }}>
                    {new Date(e.fecha).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span style={{ color: "#2c2c33" }}>{e.descripcion} <span style={{ color: "#92929b" }}>· {e.usuario}</span></span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
