"use client";

import * as React from "react";

import {
  copyDePaso,
  duracionTexto,
  estadoNarrativo,
  estadoPill,
  fechaLarga,
  getTrackingPublico,
  haceCuanto,
  urlArchivoTracking,
  type TrackingArchivo,
  type TrackingItem,
  type TrackingPaso,
  type TrackingPublico,
} from "@/lib/tracking";
import { formatBytes } from "@/lib/archivos";

/** Cada cuánto se sincroniza el avance con la planta (sin recargar). */
const POLL_MS = 15000;

// ── Iconos (set mínimo, calcado del diseño) ──────────────────────────────

const IcoCheck = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l4 4 10-10" />
  </svg>
);
const IcoPhone = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
  </svg>
);
const IcoWa = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M17.5 14.4c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.2-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6 0-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4 0 1.4 1 2.7 1.2 2.9.2.2 2 3.1 4.8 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.3 0-.1-.3-.2-.6-.4Z M12 2C6.5 2 2 6.5 2 12c0 1.7.4 3.4 1.3 4.8L2 22l5.3-1.3c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2Zm6 16-.2.2c-1.5 1.5-3.6 2.4-5.8 2.4-1.5 0-2.9-.4-4.2-1.1l-.3-.2-3.2.8.8-3.1-.2-.3c-.8-1.3-1.2-2.8-1.2-4.4 0-4.6 3.7-8.3 8.3-8.3 2.2 0 4.3.9 5.9 2.4 1.6 1.6 2.4 3.7 2.4 5.9 0 2.2-.9 4.3-2.3 5.7Z" />
  </svg>
);
const IcoPin = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IcoClock = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const IcoDoc = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);
const IcoImagen = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="1.6" />
    <path d="m21 15-4.5-4.5L7 20" />
  </svg>
);
const IcoChevron = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s ease" }}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

// ── Confetti (al llegar a listo/entregado) ───────────────────────────────

function Confetti() {
  const colors = ["#14141a", "#06b6d4", "#d946ef", "#eab308", "#16794a", "#c2410c"];
  const pieces = React.useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        color: colors[i % colors.length],
        left: 30 + ((i * 37) % 40),
        dx: ((i % 2 === 0 ? -1 : 1) * (40 + (i * 53) % 220)),
        dy: 140 + ((i * 71) % 160),
        r: (i % 2 === 0 ? -1 : 1) * (200 + (i * 90) % 500),
        delay: ((i * 17) % 20) / 100,
        w: 5 + (i % 5),
        h: 8 + (i % 6),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return (
    <div className="t-confetti-layer">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="t-confetti"
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: p.w,
            height: p.h,
            ["--dx" as string]: `${p.dx}px`,
            ["--dy" as string]: `${p.dy}px`,
            ["--r" as string]: `${p.r}deg`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Timeline de un item ──────────────────────────────────────────────────

function pasoEstadoVisual(pasos: TrackingPaso[], i: number): "done" | "current" | "pending" {
  const p = pasos[i];
  if (p.estado === "hecho") return "done";
  // El primer paso no-hecho es el "actual".
  const primerNoHecho = pasos.findIndex((x) => x.estado !== "hecho");
  return i === primerNoHecho ? "current" : "pending";
}

function ItemTimeline({ item }: { item: TrackingItem }) {
  return (
    <div className="t-timeline">
      {item.pasos.map((paso, i) => {
        const state = pasoEstadoVisual(item.pasos, i);
        const copy = copyDePaso(paso.familiaCodigo);
        const dur = duracionTexto(paso.duracionEstimadaMin);
        return (
          <div key={paso.indice} className={`t-step ${state}`}>
            <span className="t-step-dot">{state === "done" ? <IcoCheck /> : i + 1}</span>
            <div className="t-step-body">
              <div className="tec">{paso.nombre}</div>
              <div className="simple">{copy.simple}</div>
              {state !== "pending" ? <div className="desc">{copy.desc}</div> : null}
              {state === "done" && paso.completadoEl ? (
                <span className="ts ok"><IcoCheck />{fmtMomento(paso.completadoEl)}</span>
              ) : null}
              {state === "current" ? (
                <span className="ts live"><span className="dot" />En curso{dur ? ` · estimado ${dur}` : ""}</span>
              ) : null}
              {state === "pending" ? (
                <div className="desc" style={{ color: "var(--t-muted-2)", fontSize: 12 }}>
                  {dur ? `Estimado: ${dur}` : "Pendiente"}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** "16/07 · 14:32" para timestamps de pasos completados. */
function fmtMomento(iso: string): string {
  const f = new Date(iso);
  if (Number.isNaN(f.getTime())) return "";
  const dd = String(f.getDate()).padStart(2, "0");
  const mm = String(f.getMonth() + 1).padStart(2, "0");
  const hh = String(f.getHours()).padStart(2, "0");
  const mi = String(f.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} · ${hh}:${mi}`;
}

// ── Hero de producción por item (animación neutra, nombra el paso) ───────

function ProdHero({ item, total }: { item: TrackingItem; total: number }) {
  const idx = item.pasos.findIndex((p) => p.estado !== "hecho");
  const paso = idx >= 0 ? item.pasos[idx] : null;
  if (!paso) return null;
  const copy = copyDePaso(paso.familiaCodigo);
  const dur = duracionTexto(paso.duracionEstimadaMin);
  return (
    <div className="t-press-hero">
      <div className="ph-eyebrow">
        <span className="live-dot" />
        EN PRODUCCIÓN · PASO {idx + 1} DE {total}
      </div>
      <h2>{copy.simple}</h2>

      <div className="t-press-anim">
        <div className="t-paper-line">
          <span className="roller-l" /><span className="roller-r" />
          <span className="ink-pass c" /><span className="ink-pass m" />
        </div>
        <div className="t-paper-line">
          <span className="roller-l" /><span className="roller-r" />
          <span className="ink-pass y" /><span className="ink-pass k" />
        </div>
      </div>

      <div className="ph-foot">
        <div className="col">
          <div className="lbl">Etapa</div>
          <div className="v">{item.estacionActual ?? paso.nombre}</div>
        </div>
        <div className="col">
          <div className="lbl">Estimado</div>
          <div className="v">{dur ?? "—"}</div>
        </div>
      </div>
    </div>
  );
}

// ── Panel de acordeón por item ───────────────────────────────────────────

/**
 * Adjuntos que la imprenta compartió con el cliente: prueba de color, foto
 * del trabajo terminado, lo que haya marcado como visible. La descarga la
 * autoriza el token de la orden — el bucket es privado y acá no hay sesión.
 */
function ArchivosCliente({
  archivos,
  token,
  compacto = false,
}: {
  archivos: TrackingArchivo[];
  token: string;
  compacto?: boolean;
}) {
  if (archivos.length === 0) return null;
  return (
    <div className={`t-archivos${compacto ? " compacto" : ""}`}>
      {archivos.map((a) => (
        <a
          key={a.id}
          className="t-archivo"
          href={urlArchivoTracking(token, a.id)}
          target="_blank"
          rel="noreferrer"
        >
          <span className="ico">{a.esImagen ? <IcoImagen /> : <IcoDoc />}</span>
          <span className="nm">{a.nombre}</span>
          <span className="sz">{formatBytes(a.bytes)}</span>
        </a>
      ))}
    </div>
  );
}

function ItemPanel({
  item,
  index,
  open,
  onToggle,
  token,
}: {
  item: TrackingItem;
  index: number;
  open: boolean;
  onToggle: () => void;
  token: string;
}) {
  const enProduccion = item.progresoPct > 0 && item.progresoPct < 100;
  const listo = item.progresoPct >= 100;
  return (
    <div className={`t-item-panel ${open ? "open" : ""}`}>
      <button type="button" className="t-item-head" onClick={onToggle} aria-expanded={open}>
        <span className="idx">{index + 1}</span>
        <div className="meta">
          <div className="nm">{item.nombre}</div>
          <div className="sub">
            {listo ? "Completado" : item.pasoActual ? copyDePaso(pasoFamilia(item)).simple : "Por iniciar"}
          </div>
        </div>
        <span className={`prog ${listo ? "ok" : ""}`}>{item.progresoPct}%</span>
        <span className="chev"><IcoChevron open={open} /></span>
      </button>
      {open ? (
        <div className="t-item-body">
          <div className="t-item-track">
            <span className="fill" style={{ width: `${item.progresoPct}%` }} />
          </div>
          {enProduccion ? <ProdHero item={item} total={item.pasos.length} /> : null}
          <ItemTimeline item={item} />
          {item.specs.length > 0 ? (
            <div className="t-specs t-specs-inline">
              {item.specs.map((spec, i) => (
                <div key={i} className="spec">
                  <div className="lbl">{spec.etiqueta}</div>
                  <div className="v">{spec.valor}</div>
                </div>
              ))}
            </div>
          ) : null}
          <ArchivosCliente archivos={item.archivos} token={token} compacto />
        </div>
      ) : null}
    </div>
  );
}

function pasoFamilia(item: TrackingItem): string {
  const actual = item.pasos.find((p) => p.estado !== "hecho");
  return actual?.familiaCodigo ?? "trabajo_manual";
}

// ── Vista principal ──────────────────────────────────────────────────────

export function TrackingView({
  token,
  initialData,
}: {
  token: string;
  initialData: TrackingPublico;
}) {
  // Avance EN VIVO: re-consulta la planta cada POLL_MS sin recargar. Se pausa
  // con la pestaña oculta y refresca al volver al foco. Ante error de red
  // conserva el último estado (no parpadea la página).
  const [data, setData] = React.useState(initialData);
  const [sincronizando, setSincronizando] = React.useState(false);

  React.useEffect(() => {
    let vivo = true;
    const refrescar = async () => {
      if (document.hidden) return;
      setSincronizando(true);
      try {
        const fresh = await getTrackingPublico(token);
        if (vivo) setData(fresh);
      } catch {
        // Se conserva el último estado.
      } finally {
        if (vivo) setSincronizando(false);
      }
    };
    const id = window.setInterval(refrescar, POLL_MS);
    const onFocus = () => {
      if (!document.hidden) void refrescar();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      vivo = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [token]);

  const unItem = data.items.length === 1;
  // Abrimos el item en producción; si no hay, el primero.
  const abiertoInicial = React.useMemo(() => {
    const enProd = data.items.findIndex((i) => i.progresoPct > 0 && i.progresoPct < 100);
    return new Set<string>([data.items[enProd >= 0 ? enProd : 0]?.id].filter(Boolean) as string[]);
  }, [data.items]);
  const [abiertos, setAbiertos] = React.useState<Set<string>>(abiertoInicial);
  const toggle = (id: string) =>
    setAbiertos((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pill = estadoPill(data.estado);
  const entrega = fechaLarga(data.fechaEntrega);
  const celebra = data.estado === "finalizada" || data.estado === "entregada";
  const ultimaAct = data.actividad[0]?.fecha;
  const telDigits = data.vendedor?.telefono?.replace(/\D/g, "") ?? "";
  // Puede venir sin `contacto` si el navegador tiene cacheada la respuesta
  // vieja: la página se re-consulta sola y no vale la pena romperla por eso.
  const contacto = data.imprenta.contacto ?? {
    telefono: null, whatsapp: null, domicilio: null, horario: null, sitioWeb: null,
  };
  const hayContacto = Boolean(
    contacto.domicilio || contacto.horario || contacto.telefono || contacto.whatsapp,
  );

  return (
    <div className="t-app t-mobile">
      {/* Marca de la imprenta */}
      <div className="t-brandbar">
        <div className="imprenta-logo">
          {data.imprenta.tieneLogo ? (
            // Va por el proxy BFF, que reenvía el 302 a la URL firmada. El
            // endpoint es @Public: acá el cliente no tiene sesión.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="mark mark-img"
              src={`/api/backend/ordenes-trabajo/track/${token}/logo`}
              alt={data.imprenta.nombre}
            />
          ) : (
            <span className="mark">{data.imprenta.iniciales}</span>
          )}
          <div>
            <div className="nm">{data.imprenta.nombre}</div>
            <div className="sub">Tu pedido en producción</div>
          </div>
        </div>
        <div className="powered">
          <span>Powered by</span>
          <span className="gp">Grafoprint</span>
        </div>
      </div>

      {/* Los dos textos hablan de cosas distintas y hay que decirlo: a la
          izquierda la CONEXIÓN (la página se re-consulta sola cada POLL_MS), a
          la derecha la última novedad del PEDIDO. Sin nombrar el sujeto se leía
          como una contradicción ("en vivo" al lado de "act. hace 13 h"). */}
      <div className="t-live-strip">
        <span className="live-dot" />
        <span>{sincronizando ? "Sincronizando…" : "En vivo desde planta"}</span>
        <span className="upd">
          {ultimaAct ? `última novedad ${haceCuanto(ultimaAct)}` : "sin novedades todavía"}
        </span>
      </div>

      <div className="t-body">
        {/* Saludo */}
        <div className="t-eyebrow">
          <span className="code">{data.numero}</span>
          <span className="sep">·</span>
          <span>iniciada {fechaLarga(data.creadaEl)?.dia ?? ""}</span>
          <span style={{ marginLeft: "auto" }} className={`t-status-pill ${pill.tone === "ok" ? "ok" : ""}`}>
            <span className="dot" />{pill.label}
          </span>
        </div>
        <h1 className="t-hero-title">
          Hola {data.cliente.nombre},<br />
          tu pedido está{" "}
          <strong
            className={`t-hero-estado${pill.tone === "ok" ? " ok" : ""}`}
          >{estadoNarrativo(data.estado)}</strong>.
        </h1>
        <div className="t-hero-sub">
          {data.progresoPct}% completado. Te avisaremos ni bien esté listo para retirar.
        </div>

        {/* Entrega + progreso global */}
        <div className="t-deliver">
          <div className="cal">
            <span className="m">{entrega?.mes ?? "—"}</span>
            <span className="d">{entrega?.num ?? "?"}</span>
          </div>
          <div className="body">
            <div className="lbl">Entrega estimada</div>
            <div className="v">{entrega?.dia ?? "A confirmar"}</div>
            <div className="sub">
              {data.items.length} {data.items.length === 1 ? "producto" : "productos"} · {data.progresoPct}% del total
            </div>
          </div>
        </div>

        {/* Acordeón de items */}
        <div className="t-card">
          <div className="t-card-head">
            <span className="ttl">Seguimiento por producto</span>
            <span className="sub">{data.items.length} {data.items.length === 1 ? "item" : "items"}</span>
          </div>
          <div className="t-items">
            {data.items.map((item, i) => (
              <ItemPanel
                key={item.id}
                item={item}
                index={i}
                open={unItem || abiertos.has(item.id)}
                onToggle={() => toggle(item.id)}
                token={token}
              />
            ))}
          </div>
        </div>

        {/* Vendedor */}
        {data.vendedor ? (
          <div className="t-contact">
            <span className="av">{data.vendedor.iniciales}</span>
            <div className="body">
              <div className="lbl">Tu asesor comercial</div>
              <div className="nm">{data.vendedor.nombre}</div>
              <div className="role">Cualquier duda, escribinos.</div>
            </div>
            {data.vendedor.telefono ? (
              <div className="t-contact-actions">
                <a className="ic-btn" title="Llamar" href={`tel:${data.vendedor.telefono}`}><IcoPhone /></a>
                <a className="ic-btn wa" title="WhatsApp" href={`https://wa.me/${telDigits}`} target="_blank" rel="noreferrer"><IcoWa /></a>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Dónde queda la imprenta y hasta qué hora atiende. El cliente que
            abre este link ya sabe CUÁNDO va a estar listo; lo que no tenía era
            adónde ir a buscarlo ni a quién preguntarle si el vendedor no
            cargó teléfono. Si el negocio no cargó nada, la tarjeta no existe. */}
        {hayContacto ? (
          <div className="t-card">
            <div className="t-card-head">
              <span className="ttl">{data.imprenta.nombre}</span>
              <span className="sub">dónde estamos</span>
            </div>
            <div className="t-shop">
              {contacto.domicilio ? (
                <a
                  className="row"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contacto.domicilio)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="ico"><IcoPin /></span>
                  <span className="txt">{contacto.domicilio}</span>
                  <span className="cta">Ver mapa</span>
                </a>
              ) : null}
              {contacto.horario ? (
                <div className="row">
                  <span className="ico"><IcoClock /></span>
                  <span className="txt">{contacto.horario}</span>
                </div>
              ) : null}
              {/* Los botones sólo cuando el vendedor no los ofreció ya: dos
                  pares de teléfonos en la misma pantalla sólo hacen dudar. */}
              {!data.vendedor?.telefono && (contacto.telefono || contacto.whatsapp) ? (
                <div className="t-contact-actions" style={{ marginTop: 4 }}>
                  {contacto.telefono ? (
                    <a className="ic-btn" title="Llamar" href={`tel:${contacto.telefono}`}><IcoPhone /></a>
                  ) : null}
                  {contacto.whatsapp ? (
                    <a className="ic-btn wa" title="WhatsApp" href={`https://wa.me/${contacto.whatsapp}`} target="_blank" rel="noreferrer"><IcoWa /></a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Archivos compartidos por la imprenta */}
        {data.archivos.length > 0 ? (
          <div className="t-card">
            <div className="t-card-head">
              <span className="ttl">Archivos</span>
              <span className="sub">
                {data.archivos.length === 1
                  ? "1 archivo"
                  : `${data.archivos.length} archivos`}
              </span>
            </div>
            <ArchivosCliente archivos={data.archivos} token={token} />
          </div>
        ) : null}

        {/* Actividad */}
        {data.actividad.length > 0 ? (
          <div className="t-card">
            <div className="t-card-head">
              <span className="ttl">Actividad reciente</span>
              <span className="sub">en vivo</span>
            </div>
            <div className="t-activity">
              {data.actividad.map((a, i) => (
                <div key={i} className={`row ${i === 0 ? "new" : ""}`}>
                  <span className="when">{haceCuanto(a.fecha)}</span>
                  <span className="what">{a.texto}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="t-share">
        Este link es privado. Compartilo solo con quien necesite ver el pedido.
        <div className="gp-tag">
          <span className="gp-mark">G</span>
          Hecho con Grafoprint
        </div>
      </div>

      {celebra ? <Confetti /> : null}
    </div>
  );
}
