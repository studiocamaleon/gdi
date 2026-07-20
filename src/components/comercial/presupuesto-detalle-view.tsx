"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HistoryIcon,
  PackageIcon,
  SendIcon,
  StoreIcon,
  UserIcon,
} from "lucide-react";

import {
  convertirPresupuesto,
  enviarPresupuesto,
  getPresupuesto,
  presupuestoPdfUrl,
  presupuestoPublicUrl,
  resolverAprobacionPresupuesto,
  resolverPresupuesto,
  type PresupuestoDetalle,
  type PresupuestoEstado,
} from "@/lib/presupuestos-api";
import type { MembershipRole } from "@/lib/auth";

/**
 * Vista de detalle DEDICADA de un presupuesto (antes vivía en un drawer de
 * 460px, donde no entraban items + specs + totales + acciones + historial).
 * Espeja la ficha de OT: header con estado, stepper del ciclo, fila de campos,
 * barra de acción principal y tabs.
 */

const ESTADO_META: Record<PresupuestoEstado, { label: string; dot: string; fg: string }> = {
  borrador: { label: "Borrador", dot: "#9b9ba3", fg: "#6e6e76" },
  pendiente_aprobacion: { label: "Pendiente de aprobación", dot: "#d9642a", fg: "#b1531f" },
  enviado: { label: "Enviado", dot: "#1d4ed8", fg: "#1d4ed8" },
  aprobado: { label: "Aprobado", dot: "#16794a", fg: "#16794a" },
  rechazado: { label: "Rechazado", dot: "#b91c1c", fg: "#b91c1c" },
  vencido: { label: "Vencido", dot: "#92929b", fg: "#6e6e76" },
  convertido: { label: "Convertido en OT", dot: "#16794a", fg: "#16794a" },
};

/** Camino feliz del presupuesto. Rechazado/vencido se muestran aparte. */
const FLUJO: PresupuestoEstado[] = ["borrador", "enviado", "aprobado", "convertido"];

const MOTIVOS_PERDIDA = [
  { v: "precio", l: "Precio" },
  { v: "plazo", l: "Plazo de entrega" },
  { v: "competencia", l: "Se fue con la competencia" },
  { v: "sin_respuesta", l: "Sin respuesta" },
  { v: "otro", l: "Otro" },
];

const fmtMoneda = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");
const fmtFecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtMomento = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

type Tab = "productos" | "conversion" | "historial";

export function PresupuestoDetalleView({
  inicial,
  rol,
}: {
  inicial: PresupuestoDetalle;
  rol: MembershipRole;
}) {
  const router = useRouter();
  const [d, setD] = React.useState<PresupuestoDetalle>(inicial);
  const [tab, setTab] = React.useState<Tab>("productos");
  const [trabajando, setTrabajando] = React.useState(false);
  const [rechazoAbierto, setRechazoAbierto] = React.useState(false);
  const [devolucionAbierta, setDevolucionAbierta] = React.useState(false);
  const [motivo, setMotivo] = React.useState(MOTIVOS_PERDIDA[0].v);
  const [motivoDetalle, setMotivoDetalle] = React.useState("");
  const [notaDevolucion, setNotaDevolucion] = React.useState("");
  const [linkCopiado, setLinkCopiado] = React.useState(false);
  const [seleccion, setSeleccion] = React.useState<Set<string>>(
    () => new Set(inicial.items.map((i) => i.cotizacionItemId).filter((x): x is string => x != null)),
  );

  const puedeAprobar = rol === "administrador" || rol === "supervisor";
  const id = d.id;

  const cargar = React.useCallback(async () => {
    try {
      setD(await getPresupuesto(id));
    } catch {
      /* el polling no molesta con errores transitorios */
    }
  }, [id]);

  // La decisión del cliente llega por el link público desde OTRO navegador:
  // se refresca por polling. Pausa durante acciones o formularios abiertos
  // para no pisar lo que el usuario está escribiendo.
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !trabajando && !rechazoAbierto && !devolucionAbierta) {
        void cargar();
      }
    }, 10_000);
    return () => clearInterval(timer);
  }, [cargar, trabajando, rechazoAbierto, devolucionAbierta]);

  const accion = async (fn: () => Promise<unknown>, ok: string) => {
    setTrabajando(true);
    try {
      await fn();
      toast.success(ok);
      await cargar();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar la acción.");
    } finally {
      setTrabajando(false);
    }
  };

  const copiarLink = () => {
    if (!d.publicToken) return;
    void navigator.clipboard.writeText(presupuestoPublicUrl(d.publicToken));
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2000);
    toast.success("Link copiado. El cliente puede aprobar desde ahí.");
  };

  const itemsConvertibles = d.items.filter((i) => i.cotizacionItemId != null);
  const parcial = seleccion.size < itemsConvertibles.length;

  const convertir = () =>
    accion(async () => {
      const res = await convertirPresupuesto(id, parcial ? { itemIds: [...seleccion] } : {});
      toast.success(`Orden ${res.ordenNumero} creada en borrador — revisá la fecha de entrega y emitila.`);
    }, "Presupuesto convertido.");

  const meta = ESTADO_META[d.estado];
  const idxActual = FLUJO.indexOf(d.estado);
  const fueraDelFlujo = idxActual < 0; // rechazado / vencido / pendiente_aprobacion

  return (
    <section className="ot-v1 pp-detalle flex flex-1 flex-col p-4 md:p-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="orden-head">
        <div className="left">
          <nav className="orden-breadcrumb" aria-label="Ubicación">
            <span className="bc-item">
              <FileTextIcon />
              Comercial
            </span>
            <span className="bc-sep">›</span>
            <Link className="bc-item bc-link" href="/comercial/presupuestos">
              <ArrowLeftIcon />
              Presupuestos
            </Link>
          </nav>
          <h1 style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-mono)" }}>{d.numero ?? "Borrador"}</span>
            <span className="pp-badge" style={{ color: meta.fg }}>
              <span className="d" style={{ background: meta.dot }} />
              {meta.label}
            </span>
            {d.estado === "enviado" && d.primeraVistaEl ? (
              <span className="pp-visto">Visto {fmtMomento(d.primeraVistaEl)}</span>
            ) : null}
          </h1>
          <div className="sub">
            {d.cliente?.nombre ?? "Sin cliente"} · emitido {fmtFecha(d.fechaEmision)} · válido hasta{" "}
            {fmtFecha(d.fechaValidez)}
          </div>
        </div>

        <div className="right">
          <a className="btn" href={presupuestoPdfUrl(id)} target="_blank" rel="noreferrer">
            <FileTextIcon /> PDF
          </a>
          {d.publicToken ? (
            <>
              <button type="button" className="btn" onClick={copiarLink}>
                {linkCopiado ? <CheckIcon /> : <ExternalLinkIcon />}
                {linkCopiado ? "Copiado" : "Copiar link"}
              </button>
              <a
                className="btn"
                href={presupuestoPublicUrl(d.publicToken)}
                target="_blank"
                rel="noreferrer"
                title="Abrir la vista que ve el cliente"
              >
                Ver como cliente
              </a>
            </>
          ) : null}
        </div>
      </div>

      {/* ── Ciclo de vida ──────────────────────────────────── */}
      <div className="otd-flow">
        {fueraDelFlujo ? (
          <div className="otd-fstage cur">
            <span className="fs-dot" style={{ background: meta.dot }} />
            <span className="fs-lbl" style={{ color: meta.fg }}>
              {meta.label}
            </span>
          </div>
        ) : (
          FLUJO.map((k, i) => {
            const e = ESTADO_META[k];
            const st = i < idxActual ? "past" : i === idxActual ? "cur" : "future";
            return (
              <React.Fragment key={k}>
                <div className={`otd-fstage ${st}`}>
                  <span className="fs-dot" style={st !== "future" ? { background: e.dot } : {}} />
                  <span className="fs-lbl" style={st === "cur" ? { color: e.fg } : {}}>
                    {e.label}
                  </span>
                </div>
                {i < FLUJO.length - 1 ? <span className={`otd-fline ${i < idxActual ? "on" : ""}`} /> : null}
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* ── Campos ─────────────────────────────────────────── */}
      <div className="orden-form">
        <Campo label="Cliente" icon={<UserIcon />}>
          {d.cliente?.nombre ?? "Sin cliente"}
        </Campo>
        <Campo label="Vendedor" icon={<UserIcon />}>
          {d.vendedor?.nombre ?? "—"}
        </Campo>
        <Campo label="Canal de venta" icon={<StoreIcon />}>
          {d.canalVenta ?? "—"}
        </Campo>
        <Campo label="Válido hasta" icon={<CalendarIcon />} hint={d.fechaEntrega ? `Entrega estimada ${fmtFecha(d.fechaEntrega)}` : undefined}>
          {fmtFecha(d.fechaValidez)}
        </Campo>
      </div>

      {/* ── Acción principal del estado ────────────────────── */}
      <AccionesEstado
        d={d}
        puedeAprobar={puedeAprobar}
        trabajando={trabajando}
        onEnviar={() =>
          void accion(() => enviarPresupuesto(id), "Presupuesto enviado — copiá el link y compartilo.")
        }
        onAprobar={() =>
          void accion(
            () => resolverAprobacionPresupuesto(id, { decision: "aprobar" }),
            "Aprobado y enviado al cliente.",
          )
        }
        onAbrirDevolucion={() => setDevolucionAbierta(true)}
        onAbrirRechazo={() => setRechazoAbierto(true)}
        onConvertir={() => void convertir()}
        parcial={parcial}
        seleccionadas={seleccion.size}
      />

      {devolucionAbierta ? (
        <div className="otd-card pp-form-card">
          <div className="otd-card-head">
            <span className="ttl">Devolver al vendedor</span>
            <span className="sub">Se le avisa para que lo corrija y lo vuelva a mandar.</span>
          </div>
          <div className="pp-form-body">
            <textarea
              className="pp-textarea"
              placeholder="Qué hay que corregir…"
              value={notaDevolucion}
              onChange={(e) => setNotaDevolucion(e.target.value)}
            />
            <div className="pp-form-actions">
              <button type="button" className="btn" onClick={() => setDevolucionAbierta(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={trabajando}
                onClick={() =>
                  void accion(async () => {
                    await resolverAprobacionPresupuesto(id, {
                      decision: "devolver",
                      comentario: notaDevolucion || undefined,
                    });
                    setDevolucionAbierta(false);
                    setNotaDevolucion("");
                  }, "Devuelto al vendedor.")
                }
              >
                Devolver
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rechazoAbierto ? (
        <div className="otd-card pp-form-card">
          <div className="otd-card-head">
            <span className="ttl">Registrar rechazo</span>
            <span className="sub">Queda el motivo para los reportes de pérdida.</span>
          </div>
          <div className="pp-form-body">
            <div className="pp-motivos">
              {MOTIVOS_PERDIDA.map((m) => (
                <button
                  key={m.v}
                  type="button"
                  className={`pp-motivo ${motivo === m.v ? "on" : ""}`}
                  onClick={() => setMotivo(m.v)}
                >
                  {m.l}
                </button>
              ))}
            </div>
            <textarea
              className="pp-textarea"
              placeholder="Detalle (opcional)…"
              value={motivoDetalle}
              onChange={(e) => setMotivoDetalle(e.target.value)}
            />
            <div className="pp-form-actions">
              <button type="button" className="btn" onClick={() => setRechazoAbierto(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={trabajando}
                onClick={() =>
                  void accion(async () => {
                    await resolverPresupuesto(id, {
                      resultado: "rechazado",
                      motivoPerdida: motivo,
                      motivoPerdidaDetalle: motivoDetalle || undefined,
                    });
                    setRechazoAbierto(false);
                    setMotivoDetalle("");
                  }, "Rechazo registrado.")
                }
              >
                Registrar rechazo
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Tabs ───────────────────────────────────────────────
          `.orden-tabs` tiene flex:1 y espera vivir dentro de `.orden-tabs-row`
          (flex en fila); suelto en una columna colapsa a 0 de alto. */}
      <div className="orden-tabs-row">
      <div className="orden-tabs" role="tablist">
        {(
          [
            { k: "productos", l: "Productos", ic: <PackageIcon />, ct: d.items.length },
            { k: "conversion", l: "Conversión", ic: <SendIcon />, ct: null },
            { k: "historial", l: "Historial", ic: <HistoryIcon />, ct: d.eventos.length },
          ] as const
        ).map((t) => (
          <button
            key={t.k}
            type="button"
            className={`otab ${tab === t.k ? "on" : ""}`}
            onClick={() => setTab(t.k as Tab)}
          >
            <span className="ic">{t.ic}</span>
            <span>{t.l}</span>
            {t.ct != null ? <span className="ct">{t.ct}</span> : null}
          </button>
        ))}
      </div>
      </div>

      {tab === "productos" ? <TabProductos d={d} /> : null}
      {tab === "conversion" ? (
        <TabConversion d={d} seleccion={seleccion} setSeleccion={setSeleccion} />
      ) : null}
      {tab === "historial" ? <TabHistorial d={d} /> : null}
    </section>
  );
}

function Campo({
  label,
  icon,
  children,
  hint,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="ofield">
      <div className="ofield-lbl">
        <span className="ic">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="ofield-ctrl pp-ofield-ro">{children}</div>
      {hint ? <div className="ofield-hint">{hint}</div> : null}
    </div>
  );
}

/** Acción PRINCIPAL según el estado; el resto queda secundario. */
function AccionesEstado({
  d,
  puedeAprobar,
  trabajando,
  onEnviar,
  onAprobar,
  onAbrirDevolucion,
  onAbrirRechazo,
  onConvertir,
  parcial,
  seleccionadas,
}: {
  d: PresupuestoDetalle;
  puedeAprobar: boolean;
  trabajando: boolean;
  onEnviar: () => void;
  onAprobar: () => void;
  onAbrirDevolucion: () => void;
  onAbrirRechazo: () => void;
  onConvertir: () => void;
  parcial: boolean;
  seleccionadas: number;
}) {
  if (d.estado === "convertido") {
    return (
      <div className="pp-accion-bar ok">
        <div>
          <div className="t">Convertido en {d.ordenConvertida}</div>
          <div className="s">La orden de trabajo ya existe; seguí desde ahí.</div>
        </div>
        {d.ordenConvertidaId ? (
          <Link className="btn btn-primary" href={`/produccion/ordenes/${d.ordenConvertidaId}`}>
            Ver la orden
          </Link>
        ) : null}
      </div>
    );
  }

  if (d.estado === "borrador") {
    return (
      <div className="pp-accion-bar">
        <div>
          <div className="t">Listo para enviar</div>
          <div className="s">Al enviarlo se genera el link para que el cliente lo apruebe.</div>
        </div>
        <button type="button" className="btn btn-primary" disabled={trabajando} onClick={onEnviar}>
          <SendIcon /> Enviar al cliente
        </button>
      </div>
    );
  }

  if (d.estado === "pendiente_aprobacion") {
    return (
      <div className="pp-accion-bar warn">
        <div>
          <div className="t">Necesita aprobación interna</div>
          <div className="s">
            {d.aprobacionMotivos.length
              ? d.aprobacionMotivos.map((m) => m.detalle).join(" · ")
              : "Supera los umbrales configurados."}
          </div>
        </div>
        {puedeAprobar ? (
          <div className="acts">
            <button type="button" className="btn" disabled={trabajando} onClick={onAbrirDevolucion}>
              Devolver
            </button>
            <button type="button" className="btn btn-primary" disabled={trabajando} onClick={onAprobar}>
              <CheckIcon /> Aprobar y enviar
            </button>
          </div>
        ) : (
          <span className="s">Lo tiene que resolver un administrador.</span>
        )}
      </div>
    );
  }

  if (d.estado === "enviado") {
    return (
      <div className="pp-accion-bar">
        <div>
          <div className="t">Esperando la decisión del cliente</div>
          <div className="s">
            {d.primeraVistaEl
              ? "Ya lo vio. Podés registrar la respuesta si te contestó por otro canal."
              : "Todavía no lo abrió. Compartile el link."}
          </div>
        </div>
        <button type="button" className="btn" disabled={trabajando} onClick={onAbrirRechazo}>
          Registrar rechazo
        </button>
      </div>
    );
  }

  if (d.estado === "aprobado") {
    return (
      <div className="pp-accion-bar ok">
        <div>
          <div className="t">Aprobado por el cliente</div>
          <div className="s">
            {parcial
              ? `Se convertirán ${seleccionadas} de ${d.items.length} productos (elegilos en la pestaña Conversión).`
              : "Se convertirá el presupuesto completo en una orden de trabajo."}
          </div>
        </div>
        <button type="button" className="btn btn-primary" disabled={trabajando} onClick={onConvertir}>
          Convertir en orden
        </button>
      </div>
    );
  }

  return null;
}

function TabProductos({ d }: { d: PresupuestoDetalle }) {
  return (
    <>
      <div className="otd-card">
        <table className="tbl" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: "8%" }}>#</th>
              <th style={{ width: "52%" }}>Producto</th>
              <th style={{ width: "13%" }}>Cantidad</th>
              <th className="right" style={{ width: "13%" }}>Subtotal</th>
              <th className="right" style={{ width: "14%" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {d.items.map((i, idx) => (
              <tr key={i.cotizacionItemId ?? idx}>
                <td>{idx + 1}</td>
                <td>
                  <div className="name">{i.nombre}</div>
                  {i.specs.length ? (
                    <div className="pp-chips" style={{ marginTop: 6 }}>
                      {i.specs.map((s) => (
                        <span key={s.etiqueta} className="pp-chip">
                          <span className="k">{s.etiqueta}</span>
                          {s.valor}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {i.adicionales.length ? (
                    <div className="pp-chips" style={{ marginTop: 6 }}>
                      {i.adicionales.map((a) => (
                        <span key={a} className="pp-chip opt">
                          <CheckIcon /> {a}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </td>
                <td className="mono">
                  {i.cantidad.toLocaleString("es-AR")} {i.cantidadUnidad}
                </td>
                <td className="right mono">{fmtMoneda(i.subtotal)}</td>
                <td className="right mono">
                  <b>{fmtMoneda(i.total)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="otd-card">
        <div className="otd-card-head">
          <span className="ttl">Resumen financiero</span>
          <span className="sub">
            {d.items.length} producto{d.items.length === 1 ? "" : "s"} · presupuesto
          </span>
        </div>
        <div className="pp-resumen">
          <Cifra l="Subtotal" v={fmtMoneda(d.subtotal)} s="sin impuestos" />
          <span className="op">+</span>
          <Cifra l="Impuestos" v={fmtMoneda(d.impuestos)} s={d.impuestos > 0 ? "IVA incluido" : "sin impuestos"} />
          <span className="op">+</span>
          <Cifra l="Cargos directos" v={fmtMoneda(d.cargosDirectos)} s={d.cargosDirectos > 0 ? "" : "sin cargos"} />
          <span className="op">=</span>
          <div className="pp-total">
            <div className="l">Total c/ imp.</div>
            <div className="v">{fmtMoneda(d.total)}</div>
            {d.senaSugeridaPct ? <div className="s">Seña sugerida {d.senaSugeridaPct}%</div> : null}
          </div>
        </div>
      </div>

      {d.observaciones ? (
        <div className="otd-card">
          <div className="otd-card-head">
            <span className="ttl">Observaciones</span>
          </div>
          <div className="pp-observaciones">{d.observaciones}</div>
        </div>
      ) : null}
    </>
  );
}

function Cifra({ l, v, s }: { l: string; v: string; s?: string }) {
  return (
    <div className="pp-cifra">
      <div className="l">{l}</div>
      <div className="v">{v}</div>
      {s ? <div className="s">{s}</div> : null}
    </div>
  );
}

function TabConversion({
  d,
  seleccion,
  setSeleccion,
}: {
  d: PresupuestoDetalle;
  seleccion: Set<string>;
  setSeleccion: (s: Set<string>) => void;
}) {
  const convertibles = d.items.filter((i) => i.cotizacionItemId != null);
  const disponible = d.estado === "aprobado";

  const toggle = (itemId: string) => {
    const next = new Set(seleccion);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setSeleccion(next);
  };

  const totalSel = convertibles
    .filter((i) => i.cotizacionItemId && seleccion.has(i.cotizacionItemId))
    .reduce((s, i) => s + i.total, 0);

  return (
    <div className="otd-card">
      <div className="otd-card-head">
        <span className="ttl">
          Qué se convierte <span className="ct">{seleccion.size}</span>
        </span>
        <span className="sub">
          {disponible
            ? "Destildá lo que el cliente no confirmó: se crea la OT sólo con lo elegido."
            : "Disponible cuando el presupuesto esté aprobado."}
        </span>
      </div>
      <div className="pp-conv">
        {convertibles.length === 0 ? (
          <div className="pp-conv-empty">Este presupuesto no tiene items convertibles.</div>
        ) : (
          convertibles.map((i) => {
            const itemId = i.cotizacionItemId!;
            const on = seleccion.has(itemId);
            return (
              <label key={itemId} className={`pp-conv-row ${on ? "on" : ""} ${disponible ? "" : "off"}`}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!disponible}
                  onChange={() => toggle(itemId)}
                />
                <span className="nm">{i.nombre}</span>
                <span className="qt mono">
                  {i.cantidad.toLocaleString("es-AR")} {i.cantidadUnidad}
                </span>
                <span className="tt mono">{fmtMoneda(i.total)}</span>
              </label>
            );
          })
        )}
      </div>
      {convertibles.length > 0 ? (
        <div className="pp-conv-foot">
          <span>
            {seleccion.size} de {convertibles.length} productos
          </span>
          <b className="mono">{fmtMoneda(totalSel)}</b>
        </div>
      ) : null}
    </div>
  );
}

function TabHistorial({ d }: { d: PresupuestoDetalle }) {
  return (
    <div className="otd-card">
      <div className="otd-card-head">
        <span className="ttl">
          Historial <span className="ct">{d.eventos.length}</span>
        </span>
        <span className="sub">Todo lo que pasó con este presupuesto</span>
      </div>
      <div className="pp-timeline">
        {d.eventos.length === 0 ? (
          <div className="pp-conv-empty">Sin eventos todavía.</div>
        ) : (
          d.eventos.map((e, i) => (
            <div key={i} className="pp-tl">
              <span className="dot" />
              <div className="tm">{fmtMomento(e.fecha)}</div>
              <div className="tx">{e.descripcion}</div>
              {e.usuario || e.origen ? (
                <div className="tm">{[e.usuario, e.origen].filter(Boolean).join(" · ")}</div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
