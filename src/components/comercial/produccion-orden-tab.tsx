"use client";

/**
 * Tab "Producción" del detalle de una OT — ruta de producción por producto
 * + avance general, con el estado EN VIVO de cada paso (mismos datos que el
 * Tablero, sin ir al Tablero). Componentes portados del diseño Grafoprint
 * (`orden-detail.jsx` → ProduccionTab) conectados a `GET /ordenes-trabajo/:id/pasos`.
 */

import * as React from "react";

import { getOrdenPasos } from "@/lib/ordenes-trabajo-api";
import {
  etiquetaDuracion,
  etiquetaMomento,
  familiaIcono,
  progresoItem,
  type TableroItemData,
  type TableroPasoData,
  type TableroPasoEstado,
} from "@/lib/tablero-produccion";

/* ─── Íconos (set TIco del diseño, verbatim) ─── */
type IcoProps = React.SVGProps<SVGSVGElement>;
const svg = (inner: React.ReactNode, w = 14, sw = 1.7) =>
  function Ico(p: IcoProps) {
    return (
      <svg viewBox="0 0 24 24" width={w} height={w} fill="none" stroke="currentColor"
        strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...p}>
        {inner}
      </svg>
    );
  };
const TICO: Record<string, React.FC<IcoProps>> = {
  Layout: svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12" /></>),
  Check: svg(<path d="M5 12l4 4 10-10" />, 14, 2.2),
  Layers: svg(<><path d="m12 3 9 4.5-9 4.5-9-4.5Z" /><path d="m3 12 9 4.5 9-4.5M3 16.5l9 4.5 9-4.5" /></>),
  Printer: svg(<><path d="M7 7V3h10v4" /><rect x="4" y="7" width="16" height="9" rx="1.5" /><path d="M7 14h10v6H7Z" /></>),
  Plot: svg(<><rect x="3" y="5" width="18" height="6" rx="1.5" /><path d="M5 11v8M19 11v8M5 19h14" /><circle cx="9" cy="8" r="1.2" fill="currentColor" /></>),
  Cut: svg(<><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="m20 4-12 12M14 14l6 6M14 10 8 4" /></>),
  Sun: svg(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M5 5l1.5 1.5M17.5 17.5 19 19M2 12h2M20 12h2M5 19l1.5-1.5M17.5 6.5 19 5" /></>),
  Brush: svg(<><path d="M9 22h6" /><path d="M12 18v4" /><path d="M5 11l8-8 6 6-8 8Z" /><path d="M5 11l-2 6 6-2Z" /></>),
  Scissors: svg(<><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" /></>),
  Stamp: svg(<><path d="M9 9V4a3 3 0 0 1 6 0v5l3 5H6Z" /><rect x="4" y="18" width="16" height="3" rx="1" /></>),
  Fold: svg(<><path d="M3 7h18v6H3Z" /><path d="M3 13l4 6h10l4-6" /></>),
  Cnc: svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" /><circle cx="15" cy="15" r="2" /></>),
  Beam: svg(<><path d="M12 2v6M12 22v-4M3 12h6M21 12h-4M5 5l3 3M19 5l-3 3M5 19l3-3" /><circle cx="12" cy="12" r="2" /></>),
  Book: svg(<><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2Z" /><path d="M8 7h6M8 11h6" /></>),
  Tool: svg(<><path d="M14 7a3 3 0 1 1 3-3l-3 3 4 4 3-3a3 3 0 1 1-3-3" /><path d="m18 12-7 7-4-1-1-4 7-7" /></>),
  Shield: svg(<><path d="M12 3 4 6v6c0 5 3 8 8 9 5-1 8-4 8-9V6Z" /><path d="m9 12 2 2 4-4" /></>),
  Package: svg(<><path d="M12 22V11" /><path d="M3 7v10l9 5 9-5V7l-9-5Z" /><path d="m3 7 9 4 9-4M7.5 4.5 16 9" /></>),
  Truck: svg(<><rect x="1" y="6" width="13" height="11" rx="1" /><path d="M14 9h4l3 3v5h-7Z" /><circle cx="5.5" cy="18.5" r="2" /><circle cx="18.5" cy="18.5" r="2" /></>),
  Wrench: svg(<><path d="M14.7 6.3a4 4 0 1 0 5 5l-3.5-1.5-1.5-3.5Z" /><path d="m14.7 11.3-10 10 3 3 10-10" /></>),
  Block: svg(<><circle cx="12" cy="12" r="9" /><path d="m5.5 5.5 13 13" /></>, 14, 2),
  Chev: svg(<path d="m9 6 6 6-6 6" />, 12, 2),
  Factory: svg(<><path d="M2 20h20M4 20V9l5 3V9l5 3V9l5 3v8" /></>),
};
const Ico = (name: string) => TICO[name] ?? TICO.Tool;

/* ─── Mapeo estado real → estado visual del diseño ─── */
type VisualStatus = "done" | "current" | "pending" | "blocked";
const STATUS_OF: Record<TableroPasoEstado, VisualStatus> = {
  hecho: "done",
  en_curso: "current",
  bloqueado: "blocked",
  pendiente: "pending",
};
const ST_LBL: Record<VisualStatus, string> = {
  done: "Completo",
  current: "En curso",
  pending: "Pendiente",
  blocked: "Bloqueado",
};

function StepNode({ paso, compact }: { paso: TableroPasoData; compact?: boolean }) {
  const status = STATUS_OF[paso.estado];
  const IcoC = Ico(familiaIcono(paso.familiaCodigo));
  return (
    <div className={`otp-node ${status}`} title={`${paso.nombre} · ${ST_LBL[status]}`}>
      <span className="otp-ic">
        {status === "done" ? <TICO.Check /> : status === "blocked" ? <TICO.Block /> : <IcoC />}
        {status === "current" && <span className="otp-run" />}
      </span>
      {!compact && <span className="otp-lbl">{paso.nombre}</span>}
    </div>
  );
}

function ProductoRuta({ item }: { item: TableroItemData }) {
  const [open, setOpen] = React.useState(false);
  const route = item.pasos;
  const pct = progresoItem(item);
  const doneN = route.filter((s) => s.estado === "hecho").length;
  const blocked = route.find((s) => s.estado === "bloqueado");
  const current = route.find((s) => s.estado === "en_curso");
  const proximo = !current && !blocked ? route.find((s) => s.estado === "pendiente") : undefined;
  const state = blocked ? "blocked" : current ? "run" : pct === 100 ? "done" : "wait";

  return (
    <div className={`otp-prod ${open ? "open" : ""}`}>
      <div className="otp-prod-head" onClick={() => setOpen((o) => !o)}>
        <span className="chev"><TICO.Chev style={{ transform: open ? "rotate(90deg)" : "rotate(0)", transition: "transform .15s" }} /></span>
        <div className="otp-prod-id">
          <span className="nm">{item.nombre}</span>
        </div>
        <div className={`otp-prod-now ${state}`}>
          {state === "done" ? (
            <span className="pill ok"><TICO.Check />Terminado</span>
          ) : blocked ? (
            <span className="pill blk"><TICO.Block />Bloqueado · {blocked.nombre}</span>
          ) : current ? (
            <span className="pill run"><span className="d" />En {current.nombre}</span>
          ) : proximo ? (
            <span className="pill wait">Próximo · {proximo.nombre}</span>
          ) : (
            <span className="pill wait">En cola</span>
          )}
        </div>
        <div className="otp-prod-track"><div className="otp-prod-fill" style={{ width: `${pct}%` }} /></div>
        <span className="otp-prod-pct mono">{pct}%</span>
      </div>

      <div className="otp-prod-strip">
        {route.map((s, i) => (
          <React.Fragment key={s.id}>
            <StepNode paso={s} compact />
            {i < route.length - 1 && <span className={`otp-seg ${s.estado === "hecho" ? "on" : ""}`} />}
          </React.Fragment>
        ))}
      </div>

      {open && (
        <div className="otp-prod-detail">
          <div className="otp-detail-head"><span>{doneN} de {route.length} pasos completos</span></div>
          <div className="otp-detail-list">
            {route.map((s) => {
              const status = STATUS_OF[s.estado];
              const IcoC = Ico(familiaIcono(s.familiaCodigo));
              const dur = etiquetaDuracion(s.duracionEstimadaMin);
              const sub = [s.centroCostoNombre, dur ? `est. ${dur}` : null].filter(Boolean).join(" · ");
              const end =
                s.estado === "hecho"
                  ? etiquetaMomento(s.completadoEl) ?? "—"
                  : s.estado === "en_curso"
                  ? "en curso"
                  : s.estado === "bloqueado"
                  ? s.motivoBloqueo ?? "bloqueado"
                  : dur ?? "—";
              return (
                <div key={s.id} className={`otp-dl-row ${status}`}>
                  <span className="otp-dl-ic">{status === "done" ? <TICO.Check /> : status === "blocked" ? <TICO.Block /> : <IcoC />}</span>
                  <div className="otp-dl-body">
                    <div className="otp-dl-top"><span className="nm">{s.nombre}</span><span className={`otp-dl-badge ${status}`}>{ST_LBL[status]}</span></div>
                    <div className="otp-dl-sub">{sub || "—"}{s.mesaUsuarioNombre ? ` · ${s.mesaUsuarioNombre}` : ""}</div>
                  </div>
                  <span className="otp-dl-end mono">{end}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Anillo de avance ─── */
function Ring({ pct }: { pct: number }) {
  return (
    <div className="otp-ring" style={{ ["--p" as string]: pct }}>
      <span className="otp-ring-hole" />
      <span className="otp-ring-val mono">{pct}%</span>
    </div>
  );
}

export function ProduccionOrdenTab({ ordenId }: { ordenId: string }) {
  const [items, setItems] = React.useState<TableroItemData[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let vivo = true;
    setItems(null);
    setError(null);
    getOrdenPasos(ordenId)
      .then((res) => { if (vivo) setItems(res.items); })
      .catch((e) => { if (vivo) setError(e instanceof Error ? e.message : "No se pudieron cargar los pasos."); });
    return () => { vivo = false; };
  }, [ordenId]);

  if (error) {
    return <div className="pagos-empty"><div className="pe-ttl">No se pudo cargar la producción</div><div className="pe-sub">{error}</div></div>;
  }
  if (items === null) {
    return <div className="pagos-empty"><div className="pe-sub">Cargando la ruta de producción…</div></div>;
  }

  const conRuta = items.filter((it) => it.pasos.length > 0);
  if (conRuta.length === 0) {
    return (
      <div className="pagos-empty">
        <div className="pe-ico"><TICO.Factory /></div>
        <div className="pe-ttl">Sin ruta de producción cargada</div>
        <div className="pe-sub">Los productos de esta orden todavía no tienen ruta de producción materializada en el taller.</div>
      </div>
    );
  }

  const overall = Math.round(conRuta.reduce((s, p) => s + progresoItem(p), 0) / conRuta.length);
  const terminados = conRuta.filter((p) => progresoItem(p) === 100).length;
  const enCurso = conRuta.filter((p) => p.pasos.some((s) => s.estado === "en_curso"));
  const bloqueados = conRuta.filter((p) => p.pasos.some((s) => s.estado === "bloqueado"));

  return (
    <div className="prodtab">
      {/* Avance general */}
      <div className="otd-card otp-overall">
        <Ring pct={overall} />
        <div className="otp-overall-body">
          <div className="otp-overall-ttl">Avance general de la orden</div>
          <div className="otp-overall-track"><div className="otp-overall-fill" style={{ width: `${overall}%` }} /></div>
          <div className="otp-overall-stats">
            <span>{conRuta.length} producto{conRuta.length === 1 ? "" : "s"} en ruta</span>
            <span className="dot-sep">·</span>
            <span>{terminados} terminado{terminados === 1 ? "" : "s"}</span>
            {enCurso.length > 0 ? <><span className="dot-sep">·</span><span className="run">{enCurso.length} en curso</span></> : null}
            {bloqueados.length > 0 ? <><span className="dot-sep">·</span><span className="warn">{bloqueados.length} bloqueado{bloqueados.length === 1 ? "" : "s"}</span></> : null}
          </div>
        </div>
      </div>

      {/* Ruta por producto */}
      <div className="otd-card">
        <div className="otd-card-head">
          <span className="ttl">Ruta por producto <span className="ct">{conRuta.length}</span></span>
          <span className="sub">Tocá un producto para ver el detalle de pasos</span>
        </div>
        <div className="otp-prods">
          {conRuta.map((it) => <ProductoRuta key={it.id} item={it} />)}
        </div>
      </div>
    </div>
  );
}
