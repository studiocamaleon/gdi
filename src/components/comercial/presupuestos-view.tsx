"use client";

/**
 * Presupuestos — listado + detalle del ciclo comercial
 * (docs/presupuestos-modulo-estudio.md). Reusa el shell visual del listado
 * de OTs (otl-*). El detalle vive en un panel lateral con el timeline y
 * las acciones válidas según estado.
 */

import * as React from "react";
import Link from "next/link";
import { PlusIcon, SearchIcon } from "lucide-react";
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

const BADGE_CLASE: Record<PresupuestoEstado, string> = {
  borrador: "neutral",
  enviado: "sent",
  aprobado: "won",
  rechazado: "lost",
  vencido: "neutral",
  convertido: "conv",
};

function EstadoBadge({ estado, visto }: { estado: PresupuestoEstado; visto?: boolean }) {
  const meta = ESTADO_META[estado];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span className={`pp-badge ${BADGE_CLASE[estado]}`}><span className="d" />{meta.label}</span>
      {estado === "enviado" && visto ? (
        <span className="pp-badge seen" title="El cliente abrió el presupuesto"><span className="d" />Visto</span>
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

  const chipsDe = (i: PresupuestoDetalle["items"][number]) => (
    <>
      {i.specs.length ? (
        <div className="pp-chips">
          {i.specs.map((s) => (
            <span key={s.etiqueta} className="pp-chip"><span className="k">{s.etiqueta}</span>{s.valor}</span>
          ))}
        </div>
      ) : null}
      {i.adicionales.length ? (
        <div className="pp-opt">
          <div className="pp-opt-lbl">Opcionales incluidos</div>
          <div className="pp-chips">
            {i.adicionales.map((a) => (
              <span key={a} className="pp-chip opt">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                {a}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );

  return (
    <div className="pp-scrim" onClick={onCerrar}>
      <div className="pp-drawer" onClick={(e) => e.stopPropagation()}>
        {error ? (
          <div style={{ padding: 30, color: "#b91c1c" }}>{error}</div>
        ) : !d ? (
          <div style={{ padding: 30, color: "var(--muted-text)" }}>Cargando…</div>
        ) : (
          <>
            <div className="pp-dw-head">
              <div className="top">
                <span className="num">{d.numero}</span>
                <EstadoBadge estado={d.estado} visto={d.primeraVistaEl != null} />
                <button type="button" className="x" onClick={onCerrar} aria-label="Cerrar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="sub">
                <b>{d.cliente?.nombre ?? "Sin cliente"}</b> · emitido {fmtFecha(d.fechaEmision)} · válido hasta {fmtFecha(d.fechaValidez)}
                {d.vendedor ? <> · {d.vendedor.nombre}</> : null}
              </div>
            </div>

            <div className="pp-dw-actions">
              <a className="pp-da" href={presupuestoPdfUrl(d.id)} target="_blank" rel="noreferrer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 3v5h5" /><path d="M8 13h8M8 17h6M6 3h9l5 5v13H6z" /></svg>
                PDF
              </a>
              {d.publicToken && (d.estado === "enviado" || d.estado === "aprobado") ? (
                <button type="button" className="pp-da" onClick={copiarLink}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></svg>
                  Copiar link
                </button>
              ) : null}
              {d.estado === "borrador" ? (
                <button type="button" className="pp-da primary" disabled={trabajando} onClick={() => void accion(() => enviarPresupuesto(id), "Presupuesto enviado — copiá el link y compartilo.")}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
                  Enviar al cliente
                </button>
              ) : null}
              {d.estado === "enviado" ? (
                <button type="button" className="pp-da ok" disabled={trabajando} onClick={() => void accion(() => resolverPresupuesto(id, { resultado: "aprobado" }), "Aprobado.")}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                  Marcar aprobado
                </button>
              ) : null}
              {d.estado === "enviado" || d.estado === "vencido" ? (
                <button type="button" className="pp-da" disabled={trabajando} onClick={() => setRechazoAbierto(true)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  Marcar perdido
                </button>
              ) : null}
              {d.estado === "enviado" || d.estado === "aprobado" ? (
                <button type="button" className="pp-da primary" disabled={trabajando} onClick={() => void convertir()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  Convertir en OT
                </button>
              ) : null}
              {d.estado === "convertido" && d.ordenConvertidaId ? (
                <Link className="pp-da primary" href={`/produccion/ordenes/${d.ordenConvertidaId}`}>
                  Ver orden {d.ordenConvertida}
                </Link>
              ) : null}
            </div>

            <div className="pp-dw-body">
              {rechazoAbierto ? (
                <div className="pp-dw-rechazo">
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>¿Por qué se perdió? (alimenta tus métricas)</div>
                  <select value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ marginBottom: 8 }}>
                    {MOTIVOS_PERDIDA.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <input placeholder="Detalle (opcional)" value={motivoDetalle} onChange={(e) => setMotivoDetalle(e.target.value)} style={{ marginBottom: 10 }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="pp-da primary" disabled={trabajando} onClick={() => { setRechazoAbierto(false); void accion(() => resolverPresupuesto(id, { resultado: "rechazado", motivoPerdida: motivo, motivoPerdidaDetalle: motivoDetalle || undefined }), "Registrado como perdido."); }}>
                      Confirmar pérdida
                    </button>
                    <button type="button" className="pp-da" onClick={() => setRechazoAbierto(false)}>Cancelar</button>
                  </div>
                </div>
              ) : null}

              <div className="pp-dw-card">
                {d.items.map((i, idx) => {
                  const seleccionable = (d.estado === "enviado" || d.estado === "aprobado") && i.cotizacionItemId != null;
                  const on = i.cotizacionItemId != null && seleccion.has(i.cotizacionItemId);
                  return (
                    <div key={i.cotizacionItemId ?? idx} className="pp-dw-item">
                      {seleccionable ? (
                        <button type="button" className={`chkbox ${on ? "on" : ""}`} title="Incluir al convertir" onClick={() => {
                          const s = new Set(seleccion);
                          if (on) s.delete(i.cotizacionItemId!);
                          else s.add(i.cotizacionItemId!);
                          setSeleccion(s);
                        }}>
                          {on ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg> : null}
                        </button>
                      ) : null}
                      <div className="bd">
                        <div className="nm">{i.nombre}</div>
                        {chipsDe(i)}
                      </div>
                      <div className="rt">
                        <div className="q">{i.cantidad.toLocaleString("es-AR")} {i.cantidadUnidad}</div>
                        <div className="p">{fmtMoneda(i.total)}</div>
                      </div>
                    </div>
                  );
                })}
                <div className="pp-dw-tot">
                  <span className="t">Subtotal<b>{fmtMoneda(d.subtotal)}</b></span>
                  {d.cargosDirectos > 0 ? <span className="t">Cargos<b>{fmtMoneda(d.cargosDirectos)}</b></span> : null}
                  <span className="t">Impuestos<b>{fmtMoneda(d.impuestos)}</b></span>
                  <span className="grand">Total<b> {fmtMoneda(d.total)}</b></span>
                </div>
              </div>

              {d.motivoPerdida ? (
                <div style={{ fontSize: 12.5, color: "#b91c1c", marginBottom: 14 }}>
                  Perdido por: {MOTIVOS_PERDIDA.find((m) => m.value === d.motivoPerdida)?.label ?? d.motivoPerdida}
                  {d.motivoPerdidaDetalle ? ` — ${d.motivoPerdidaDetalle}` : ""}
                </div>
              ) : null}

              <div className="pp-dw-sec">Historial</div>
              <div className="pp-timeline">
                {d.eventos.map((e, i) => (
                  <div key={i} className={`pp-tl ${i === 0 ? "hot" : ""}`}>
                    <span className="dot" />
                    <div className="tm">
                      {new Date(e.fecha).toLocaleString("es-AR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="tx">{e.descripcion}</div>
                    <div className="who">· {e.usuario}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
