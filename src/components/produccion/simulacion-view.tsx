"use client";

/**
 * Mesa de luz — lo que el motor de ETA decidió, paso por paso.
 *
 * Dos lecturas del mismo plan: la línea de tiempo (carriles por estación,
 * bloques en el eje de minutos laborales) y la proyección por estación
 * (la agenda del taller, en filas legibles).
 *
 * Se alimenta de `sim.traza`, que se recalcula sola con el polling del
 * tablero: cuando un operario completa un paso, el plan se rehace.
 * Ver docs/simulacion-mesa-de-luz-diseno.md
 */

import * as React from "react";

import {
  acotarZoom,
  anclarZoom,
  construirEje,
  sliderDeZoom,
  ZOOM_PASOS,
  zoomDeSlider,
} from "@/lib/eje-laboral";
import { fuentesSimulacion } from "@/lib/fuentes-simulacion";
import {
  PROVEEDOR_KEY,
  type PasoProgramado,
  type ResultadoSimulacion,
} from "@/lib/flujo-produccion";
import type { Estacion } from "@/lib/estaciones";
import {
  SIN_ESTACION_KEY,
  type TableroItemData,
  type TableroPasoData,
} from "@/lib/tablero-produccion";

/* Tintas de proceso: hay que distinguir muchas OTs a la vez. */
const TINTAS = [
  "#2E4BFF", "#D6006B", "#B45309", "#6D28D9",
  "#0E9F6E", "#EA580C", "#0284C7", "#9333EA",
];

/* Un acento por estación, estable entre renders. */
const ACENTOS = ["#0E9F6E", "#0284C7", "#2E4BFF", "#6D28D9", "#EA580C", "#0891B2"];

const ROW = 26;
const PAD = 6;
const AXIS_H = 34;
/** Cuánto tiempo entra en pantalla, para rotular el deslizador. */
function loQueEntra(anchoPx: number, z: number, jornadaMin: number) {
  if (!anchoPx || !z) return "";
  const min = anchoPx / z;
  if (min < 90) return `${Math.round(min)} min a la vista`;
  if (min < jornadaMin) return `${(min / 60).toFixed(1)} h a la vista`;
  const jornadas = min / jornadaMin;
  return jornadas < 1.5
    ? "1 jornada a la vista"
    : `${jornadas.toFixed(jornadas < 10 ? 1 : 0)} jornadas a la vista`;
}

/**
 * Intervalo de los ticks horarios según cuánto mide una jornada en pantalla.
 * Calibrado sobre jornadas reales (~540 min): a zoom "Día" son ~243 px.
 */
function pasoHorario(jornadaPx: number): number | null {
  if (jornadaPx > 1100) return 30;
  if (jornadaPx > 450) return 60;
  if (jornadaPx > 170) return 120;
  if (jornadaPx > 80) return 180;
  return null;
}

/** Debajo de esto la etiqueta se pisa con la de al lado: queda sólo el tick. */
const ANCHO_MIN_ETIQUETA = 30;

const DIA_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const diaCorto = (d: Date) =>
  `${DIA_CORTO[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

type Bloque = {
  orden: number;
  itemId: string;
  pasoId: string;
  pasoIndice: number;
  ot: string;
  ordenId: string;
  itemNombre: string;
  cliente: string;
  pasoNombre: string;
  familia: string;
  estKey: string;
  estNombre: string;
  x0: number;
  x1: number;
  inicio: Date;
  fin: Date;
  duracionMin: number | null;
  plazoDias: number | null;
  esperaMin: number;
  parcial: boolean;
  tercerizado: boolean;
  enCurso: boolean;
  candidatos: number | null;
  preparacionMin: number;
  /** Cuándo entra la máquina: el inicio más el traslado. */
  inicioTrabajo: Date;
  tarde: boolean;
  entrega: string | null;
  fila: number;
};

type Carril = {
  key: string;
  nombre: string;
  puestos: number | null;
  bloques: Bloque[];
  filas: number;
  acento: string;
};

const horas = (min: number) =>
  min >= 60 ? `${(min / 60).toFixed(1)} h` : `${Math.round(min)} min`;

export function SimulacionView({
  items,
  estaciones,
  sim,
  noLaborables,
  onOpen,
  vistaInicial = "mesa",
  zoomInicial = 0.16,
}: {
  items: TableroItemData[];
  estaciones: Estacion[];
  sim: ResultadoSimulacion;
  noLaborables: Set<string>;
  onOpen: (itemId: string) => void;
  vistaInicial?: "mesa" | "proj";
  /** px por minuto laboral. Ver Z_MIN/Z_MAX en eje-laboral. */
  zoomInicial?: number;
}) {
  const [vista, setVista] = React.useState<"mesa" | "proj">(vistaInicial);
  const [z, setZ] = React.useState(zoomInicial);
  /* Al hacer zoom hay que dejar quieto el punto que el usuario está mirando:
     se anota qué minuto estaba bajo el cursor y a qué altura de la ventana,
     y se restaura el scroll después de que el stage cambió de ancho. */
  const scrollRef = React.useRef<HTMLDivElement>(null);
  /* El zoom vigente, legible desde handlers que no se re-crean en cada
     render (la rueda dispara mucho más seguido que los renders). */
  const zRef = React.useRef(z);
  const [anchoVisible, setAnchoVisible] = React.useState(0);
  const anclaRef = React.useRef<{
    scrollLeft: number;
    offsetX: number;
    zAnterior: number;
  } | null>(null);

  const zoomear = React.useCallback(
    (
      nuevo: number,
      ancla?: { scrollLeft: number; offsetX: number; zAnterior: number },
    ) => {
      const el = scrollRef.current;
      if (el) {
        // Sin cursor (botones, teclado): se ancla el centro de la ventana.
        anclaRef.current = ancla ?? {
          scrollLeft: el.scrollLeft,
          offsetX: el.clientWidth / 2,
          zAnterior: zRef.current,
        };
      }
      setZ(acotarZoom(nuevo));
    },
    [],
  );

  /* El ancho del lienzo cambia con el sidebar, el tab y la ventana: hay que
     observarlo para que la etiqueta del zoom no mienta. */
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAnchoVisible(el.clientWidth);
    const obs = new ResizeObserver(([e]) => setAnchoVisible(e.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, [vista]);

  React.useLayoutEffect(() => {
    zRef.current = z;
    const el = scrollRef.current;
    const ancla = anclaRef.current;
    if (!el || !ancla) return;
    anclaRef.current = null;
    el.scrollLeft = anclarZoom({ ...ancla, zNuevo: z });
  }, [z]);
  const [corte, setCorte] = React.useState<number | null>(null);
  const [soloTarde, setSoloTarde] = React.useState(false);
  const [consulta, setConsulta] = React.useState("");
  const [sugerencias, setSugerencias] = React.useState(false);
  const [sel, setSel] = React.useState<Bloque | null>(null);
  const [hov, setHov] = React.useState<string | null>(null);
  const [tocando, setTocando] = React.useState(false);

  const { carriles, eje, total, bloques, xAhora } = React.useMemo(
    () => construir(items, estaciones, sim, noLaborables),
    [items, estaciones, sim, noLaborables],
  );

  /* El plan cambia con el polling: el replay no puede quedar apuntando a
     una decisión que ya no existe. */
  const tope = bloques.length;
  const cursor = corte === null ? tope : Math.min(corte, tope);
  React.useEffect(() => {
    if (corte !== null && corte > tope) setCorte(null);
  }, [corte, tope]);

  React.useEffect(() => {
    if (!tocando) return;
    if (cursor >= tope) {
      setTocando(false);
      return;
    }
    const id = window.setTimeout(() => setCorte(cursor + 1), 230);
    return () => window.clearTimeout(id);
  }, [tocando, cursor, tope]);

  /* Al abrir, arrancar mirando "ahora": todo lo anterior está vacío por
     construcción (el scheduler sólo programa de ahora en adelante), así que
     abrir en el origen muestra una franja en blanco. Se hace una sola vez;
     después el scroll es del usuario. */
  const yaUbicado = React.useRef(false);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el || yaUbicado.current || vista !== "mesa" || bloques.length === 0) return;
    yaUbicado.current = true;
    el.scrollLeft = Math.max(0, xAhora * z - 24);
  }, [vista, bloques.length, xAhora, z]);

  /* Encuadra el trabajo real. El horizonte puede ser de semanas mientras
     todo pasa en la primera jornada: abrir en "todo el horizonte" deja la
     pantalla casi vacía. */
  const ajustar = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el || bloques.length === 0) return;
    /* Sin los tercerizados: sus barras son lead time del proveedor y abarcan
       semanas, así que encuadrarlas devuelve la vista de la que uno se
       quiere alejar. Lo que interesa encuadrar es el trabajo del taller. */
    const propios = bloques.filter((b) => !b.tercerizado);
    const foco = propios.length > 0 ? propios : bloques;
    const desde = Math.min(...foco.map((b) => b.x0));
    const hasta = Math.max(...foco.map((b) => b.x1));
    const span = Math.max(30, hasta - desde);
    const nuevo = acotarZoom((el.clientWidth - 40) / span);
    // Encuadrar = poner el arranque del trabajo a 20 px del borde izquierdo.
    anclaRef.current = {
      scrollLeft: desde * zRef.current - 20,
      offsetX: 20,
      zAnterior: zRef.current,
    };
    setZ(nuevo);
  }, [bloques]);

  /* Rueda con ⌘/Ctrl (y pinch de trackpad, que el navegador reporta igual)
     para acercar sin perder de vista lo que estabas mirando. Sin modificador
     la rueda scrollea, que es lo esperable en un lienzo horizontal.
     Los eventos se acumulan y se aplican UNA vez por frame: si se aplicaran
     de a uno, los que llegan antes del próximo render leerían el zoom viejo
     y el acercamiento saltaría en vez de acumularse. */
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let pendiente = 0;
    let frame = 0;
    let offsetX = 0;

    const aplicar = () => {
      frame = 0;
      const delta = pendiente;
      pendiente = 0;
      const zAnterior = zRef.current;
      const zNuevo = acotarZoom(zAnterior * Math.exp(-delta * 0.0025));
      if (zNuevo === zAnterior) return;
      anclaRef.current = { scrollLeft: el.scrollLeft, offsetX, zAnterior };
      setZ(zNuevo);
    };

    const alRodar = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      pendiente += e.deltaY;
      offsetX = e.clientX - el.getBoundingClientRect().left;
      if (!frame) frame = requestAnimationFrame(aplicar);
    };

    el.addEventListener("wheel", alRodar, { passive: false });
    return () => {
      el.removeEventListener("wheel", alRodar);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  /* Teclado: + / − para acercar y alejar, 0 para encuadrar. */
  React.useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const foco = document.activeElement;
      if (foco instanceof HTMLInputElement || foco instanceof HTMLTextAreaElement) return;
      if (e.key === "+" || e.key === "=") zoomear(zRef.current * 1.4);
      else if (e.key === "-" || e.key === "_") zoomear(zRef.current / 1.4);
      else if (e.key === "0") ajustar();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [z, zoomear, ajustar]);

  const q = consulta.trim().toLowerCase();
  const coincide = React.useCallback(
    (b: Bloque) =>
      !q ||
      b.ot.toLowerCase().includes(q) ||
      b.cliente.toLowerCase().includes(q) ||
      b.itemNombre.toLowerCase().includes(q),
    [q],
  );

  const focoOTs = React.useMemo(() => {
    if (hov) return new Set([hov]);
    if (q) return new Set(bloques.filter(coincide).map((b) => b.ot));
    if (sel) return new Set([sel.ot]);
    return null;
  }, [hov, q, sel, bloques, coincide]);

  const otsInfo = React.useMemo(() => {
    const m = new Map<string, { cliente: string; items: Set<string> }>();
    bloques.forEach((b) => {
      const e = m.get(b.ot) ?? { cliente: b.cliente, items: new Set<string>() };
      e.items.add(b.itemNombre);
      m.set(b.ot, e);
    });
    return [...m.entries()].map(([ot, v]) => ({
      ot,
      cliente: v.cliente,
      items: [...v.items],
    }));
  }, [bloques]);

  const hits = q
    ? otsInfo
        .filter(
          (o) =>
            o.ot.toLowerCase().includes(q) ||
            o.cliente.toLowerCase().includes(q) ||
            o.items.some((i) => i.toLowerCase().includes(q)),
        )
        .slice(0, 8)
    : [];

  if (bloques.length === 0) {
    return (
      <div className={`simu simu-vacio ${fuentesSimulacion}`}>
        <h3>No hay nada que simular todavía</h3>
        <p>
          Cuando haya items con ruta y pasos pendientes, acá vas a ver el plan
          completo: qué paso corre en qué estación, a qué hora, y por qué
          esperó lo que esperó.
        </p>
      </div>
    );
  }

  return (
    <div className={`simu ${fuentesSimulacion}`}>
      <div className="simu-top">
        <div className="simu-switch" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={vista === "mesa"}
            className={vista === "mesa" ? "on" : ""}
            onClick={() => setVista("mesa")}
          >
            ◈ Línea de tiempo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={vista === "proj"}
            className={vista === "proj" ? "on" : ""}
            onClick={() => setVista("proj")}
          >
            ▤ Proyección por estación
          </button>
        </div>
        <div className="simu-stats">
          <Stat k={String(total.items)} l="items en cola" />
          <Stat k={horas(total.minutos)} l="trabajo programado" />
          <Stat
            k={`${total.pctSinEstacion}%`}
            l="sin estación real"
            tono={total.pctSinEstacion > 0 ? "amber" : undefined}
          />
          <Stat
            k={String(total.tarde)}
            l="no llegan"
            tono={total.tarde > 0 ? "hot" : undefined}
          />
          <Stat k={String(eje.dias.length)} l="jornadas de horizonte" tono="acc" />
        </div>
      </div>

      <div className="simu-console">
        {vista === "mesa" ? (
          <>
            <div className="simu-ctl">
              <button
                type="button"
                onClick={() => {
                  if (tocando) return setTocando(false);
                  if (cursor >= tope) setCorte(0);
                  setTocando(true);
                }}
              >
                {tocando ? "⏸ Pausar" : "▶ Reproducir"}
              </button>
              <button type="button" onClick={() => { setTocando(false); setCorte(null); }}>
                Ver todo
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={tope}
              value={cursor}
              aria-label="Decisión del scheduler"
              onChange={(e) => { setTocando(false); setCorte(Number(e.target.value)); }}
            />
            <span className="simu-cnt">
              {cursor} / {tope} decisiones
            </span>
            <div className="simu-ctl simu-zoom">
              <span className="simu-eyebrow">Zoom</span>
              <input
                type="range"
                className="simu-zoom-range"
                min={0}
                max={ZOOM_PASOS}
                value={sliderDeZoom(z)}
                aria-label="Nivel de zoom"
                title="También: ⌘/Ctrl + rueda, o las teclas + y −"
                onChange={(e) => zoomear(zoomDeSlider(Number(e.target.value)))}
              />
              <span className="simu-cnt">
                {loQueEntra(anchoVisible, z, eje.jornadaMin)}
              </span>
              <button type="button" onClick={ajustar} title="Encuadrar el trabajo del taller">
                Ajustar
              </button>
            </div>
          </>
        ) : (
          <div className="simu-ctl">
            <span className="simu-eyebrow">Agenda del taller · plan del motor</span>
          </div>
        )}

        <div className="simu-ctl simu-buscar">
          <div className="simu-sugwrap">
            <input
              type="search"
              value={consulta}
              placeholder="N° de OT o cliente"
              autoComplete="off"
              role="combobox"
              aria-expanded={sugerencias && hits.length > 0}
              aria-controls="simu-sugg"
              onChange={(e) => { setConsulta(e.target.value); setSugerencias(true); }}
              onFocus={() => setSugerencias(true)}
              onBlur={() => window.setTimeout(() => setSugerencias(false), 140)}
              onKeyDown={(e) => { if (e.key === "Escape") { setConsulta(""); setSugerencias(false); } }}
            />
            {sugerencias && hits.length > 0 ? (
              <div className="simu-sugg" id="simu-sugg" role="listbox">
                {hits.map((o) => (
                  <div
                    key={o.ot}
                    className="simu-si"
                    role="option"
                    aria-selected={false}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setConsulta(o.ot);
                      setSugerencias(false);
                    }}
                  >
                    <span
                      className="simu-oi"
                      style={{ background: tintaDe(o.ot, otsInfo) }}
                    >
                      {o.ot.replace(/^OT-\d{4}-/, "")}
                    </span>
                    <div className="simu-sc">
                      <div className="simu-cn">{o.cliente}</div>
                      <div className="simu-it">{o.items.join(" · ")}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="simu-ctl">
          <button
            type="button"
            className={soloTarde ? "on" : ""}
            onClick={() => setSoloTarde((v) => !v)}
          >
            Sólo los que no llegan
          </button>
        </div>

        {vista === "mesa" ? (
          <div className="simu-readout">
            <Readout bloques={bloques} cursor={cursor} carriles={carriles.length} tarde={total.tarde} />
          </div>
        ) : null}
      </div>

      {vista === "mesa" ? (
        <LineaDeTiempo
          carriles={carriles}
          eje={eje}
          z={z}
          cursor={cursor}
          focoOTs={focoOTs}
          soloTarde={soloTarde}
          sel={sel}
          otsInfo={otsInfo}
          onHover={setHov}
          onSel={setSel}
          scrollRef={scrollRef}
          xAhora={xAhora}
        />
      ) : (
        <Proyeccion
          carriles={carriles}
          otsInfo={otsInfo}
          filtro={coincide}
          soloTarde={soloTarde}
          onSel={setSel}
        />
      )}

      {sel ? (
        <Inspector
          b={sel}
          total={tope}
          color={tintaDe(sel.ot, otsInfo)}
          onClose={() => setSel(null)}
          onOpen={() => onOpen(sel.itemId)}
        />
      ) : null}
    </div>
  );
}

function Stat({ k, l, tono }: { k: string; l: string; tono?: string }) {
  return (
    <div className={`simu-stat ${tono ?? ""}`}>
      <div className="k">{k}</div>
      <div className="l">{l}</div>
    </div>
  );
}

function Readout({
  bloques,
  cursor,
  carriles,
  tarde,
}: {
  bloques: Bloque[];
  cursor: number;
  carriles: number;
  tarde: number;
}) {
  if (cursor === 0)
    return <span className="muted">Taller vacío. El scheduler todavía no colocó nada.</span>;
  if (cursor >= bloques.length)
    return (
      <>
        Plan completo: <b>{bloques.length} pasos</b> repartidos en{" "}
        <b>{carriles} carriles</b>.{" "}
        {tarde > 0 ? (
          <span className="hot">
            {tarde} item{tarde === 1 ? "" : "s"} no llega
            {tarde === 1 ? "" : "n"}
          </span>
        ) : (
          <span className="good">todos llegan a su fecha</span>
        )}
        .{" "}
        <span className="muted">
          Pasá el mouse por un bloque para seguir el recorrido de esa orden.
        </span>
      </>
    );
  const b = bloques[cursor - 1];
  return (
    <>
      <b>Decisión {cursor}</b> — coloca{" "}
      <span className="acc">
        {b.ot} · {b.pasoNombre}
      </span>{" "}
      en <b>{b.estNombre}</b>, arranca{" "}
      <b>
        {diaCorto(b.inicio)} {hhmm(b.inicio)}
      </b>
      {b.esperaMin > 0 ? (
        <>
          {" "}tras esperar <span className="amber">{horas(b.esperaMin)}</span> por un
          puesto libre
        </>
      ) : (
        " apenas queda libre"
      )}
      {b.duracionMin != null ? ` · ${b.duracionMin} min` : ` · ${b.plazoDias} d proveedor`}
      {b.candidatos && b.candidatos > 1 ? (
        <span className="muted"> ({b.candidatos} candidatos en juego)</span>
      ) : null}
    </>
  );
}

/* ─────────── Línea de tiempo ─────────── */

function LineaDeTiempo({
  carriles,
  eje,
  z,
  cursor,
  focoOTs,
  soloTarde,
  sel,
  otsInfo,
  onHover,
  onSel,
  scrollRef,
  xAhora,
}: {
  carriles: Carril[];
  eje: ReturnType<typeof construirEje>;
  z: number;
  cursor: number;
  focoOTs: Set<string> | null;
  soloTarde: boolean;
  sel: Bloque | null;
  otsInfo: Array<{ ot: string }>;
  onHover: (ot: string | null) => void;
  onSel: (b: Bloque) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  xAhora: number;
}) {
  const ancho = (eje.dias.length * eje.jornadaMin) * z + 60;
  const hiloOT = focoOTs && focoOTs.size === 1 ? [...focoOTs][0] : null;

  /* Las horas reales del taller dentro de cada jornada. El eje son minutos
     laborales, así que la hora se reconstruye desde el inicio de la ventana. */
  const intervalo = pasoHorario(eje.jornadaMin * z);
  const ticks: Array<{ key: string; x: number; etiqueta: string }> = [];
  if (intervalo) {
    for (const dia of eje.dias) {
      // Primer múltiplo del intervalo dentro de la jornada, sin pisar el
      // borde del día (que ya lleva la etiqueta de la fecha).
      const primero = Math.ceil(eje.ventana.desde / intervalo) * intervalo;
      for (let min = primero; min < eje.ventana.hasta; min += intervalo) {
        const offset = min - eje.ventana.desde;
        if (offset <= 0) continue;
        ticks.push({
          key: `${dia.fecha}-${min}`,
          x: dia.x + offset,
          etiqueta:
            intervalo * z >= ANCHO_MIN_ETIQUETA
              ? `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`
              : "",
        });
      }
    }
  }

  return (
    <>
      <div className="simu-legend">
        {otsInfo.slice(0, 8).map((o) => (
          <span key={o.ot} className="simu-lg">
            <span
              className="simu-sw"
              style={{
                background: `${tintaDe(o.ot, otsInfo)}22`,
                boxShadow: `inset 0 0 0 1px ${tintaDe(o.ot, otsInfo)}`,
              }}
            />
            {o.ot.replace(/^OT-\d{4}-/, "OT ")}
          </span>
        ))}
        <span className="simu-lg simu-lg-end">
          <span className="simu-sw" style={{ boxShadow: "inset 0 0 0 1.5px var(--simu-hot)" }} />
          no llega a la fecha
        </span>
        <span className="simu-lg">
          <span className="simu-sw" style={{ border: "1.5px dashed var(--simu-ink-3)" }} />
          tercerizado
        </span>
        <span className="simu-lg">
          <span className="simu-sw simu-sw-hatch" />
          sin estación real
        </span>
      </div>

      <div className="simu-deck">
        <div className="simu-gutter">
          <div className="simu-ghead">
            <span className="simu-eyebrow">Estación</span>
          </div>
          {carriles.map((c) => (
            <div
              key={c.key}
              className={`simu-lane-lbl ${c.key === SIN_ESTACION_KEY ? "warn" : ""}`}
              style={{ height: altura(c) }}
            >
              <div className="n">{c.nombre}</div>
              <div className="m">
                {c.key === PROVEEDOR_KEY
                  ? "externo"
                  : c.puestos
                    ? `${c.puestos} puesto${c.puestos > 1 ? "s" : ""}`
                    : "sin límite"}{" "}
                · {c.bloques.length} pasos
              </div>
            </div>
          ))}
        </div>

        <div className="simu-scroll" ref={scrollRef}>
          <div className="simu-stage" style={{ width: ancho }}>
            <div className="simu-axis">
              {eje.dias.map((d, i) => (
                <div
                  key={d.fecha}
                  className={`simu-day ${i % 5 === 0 ? "wk" : ""}`}
                  style={{ left: d.x * z, width: eje.jornadaMin * z }}
                >
                  {eje.jornadaMin * z > 46 ? <span>{d.etiqueta}</span> : null}
                </div>
              ))}
              {ticks.map((t) => (
                <div key={t.key} className="simu-hora" style={{ left: t.x * z }}>
                  <span>{t.etiqueta}</span>
                </div>
              ))}
            </div>

            <div className="simu-lanes">
              {carriles.map((c) => (
                <div
                  key={c.key}
                  className={`simu-lane ${c.key === SIN_ESTACION_KEY ? "warn" : ""}`}
                  style={{ height: altura(c) }}
                >
                  {eje.dias.map((d) => (
                    <div key={d.fecha} className="simu-gridline" style={{ left: d.x * z }} />
                  ))}
                  {c.bloques.map((b) => {
                    const col = tintaDe(b.ot, otsInfo);
                    const w = (b.x1 - b.x0) * z;
                    const oculto = b.orden >= cursor;
                    const atenuado =
                      !oculto &&
                      ((soloTarde && !b.tarde) || (focoOTs !== null && !focoOTs.has(b.ot)));
                    return (
                      <div
                        key={b.pasoId}
                        className={[
                          "simu-blk",
                          b.tercerizado ? "terc" : "",
                          b.tarde ? "tarde" : "",
                          oculto ? "pend" : "",
                          atenuado ? "dim" : "",
                          sel?.orden === b.orden ? "sel" : "",
                        ].filter(Boolean).join(" ")}
                        style={{
                          left: b.x0 * z,
                          width: Math.max(4, w),
                          top: PAD + b.fila * (ROW + PAD),
                          background: `${col}14`,
                          borderColor: `${col}3A`,
                          boxShadow: `inset 3px 0 0 ${col}`,
                        }}
                        title={`${b.ot} · ${b.pasoNombre}\n${diaCorto(b.inicio)} ${hhmm(b.inicio)} → ${hhmm(b.fin)}${
                          b.duracionMin != null
                            ? `  (${b.duracionMin} min)`
                            : `  (${b.plazoDias} días proveedor)`
                        }`}
                        onClick={() => onSel(b)}
                        onMouseEnter={() => onHover(b.ot)}
                        onMouseLeave={() => onHover(null)}
                      >
                        {w > 54 ? (
                          <span className="t">
                            {b.ot.replace(/^OT-\d{4}-/, "")} · {b.pasoNombre}
                          </span>
                        ) : w > 22 ? (
                          <span className="t">{b.ot.replace(/^OT-\d{4}-/, "")}</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
              {/* Las horas van una sola vez sobre todos los carriles: dentro
                  de cada uno serían cientos de nodos repetidos. */}
              {ticks.map((t) => (
                <div key={t.key} className="simu-gridline hora" style={{ left: t.x * z }} />
              ))}
              <div className="simu-now" style={{ left: xAhora * z }}>
                <span>ahora</span>
              </div>
            </div>

            <Hilo carriles={carriles} ot={hiloOT} z={z} cursor={cursor} otsInfo={otsInfo} />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * El hilo del recorrido. Una OT puede tener varios items con secuencias
 * independientes: se dibuja un hilo POR ITEM, o iría hacia atrás en el
 * tiempo. Y cuando dos pasos encadenados se solapan por el ancho mínimo
 * de bloque, el conector es vertical en vez de una curva que retrocede.
 */
function Hilo({
  carriles,
  ot,
  z,
  cursor,
  otsInfo,
}: {
  carriles: Carril[];
  ot: string | null;
  z: number;
  cursor: number;
  otsInfo: Array<{ ot: string }>;
}) {
  if (!ot) return null;
  const porItem = new Map<string, Array<{ x0: number; x1: number; y: number; idx: number }>>();
  let yOff = 0;
  carriles.forEach((c) => {
    c.bloques.forEach((b) => {
      if (b.ot !== ot || b.orden >= cursor) return;
      const arr = porItem.get(b.itemId) ?? [];
      arr.push({
        x0: b.x0 * z,
        x1: Math.max(b.x0 * z + 4, b.x1 * z),
        y: yOff + PAD + b.fila * (ROW + PAD) + ROW / 2,
        idx: b.pasoIndice,
      });
      porItem.set(b.itemId, arr);
    });
    yOff += altura(c);
  });
  if (porItem.size === 0) return null;

  const col = tintaDe(ot, otsInfo);
  const paths: string[] = [];
  const nodos: Array<{ x: number; y: number }> = [];
  porItem.forEach((grupo) => {
    grupo.sort((a, b) => a.idx - b.idx);
    let d = "";
    grupo.forEach((p, i) => {
      if (i > 0) {
        const prev = grupo[i - 1];
        if (p.x0 >= prev.x1) {
          const mx = (prev.x1 + p.x0) / 2;
          d += ` M ${prev.x1} ${prev.y} C ${mx} ${prev.y}, ${mx} ${p.y}, ${p.x0} ${p.y}`;
        } else {
          d += ` M ${p.x0} ${prev.y} L ${p.x0} ${p.y}`;
        }
      }
      nodos.push({ x: p.x0, y: p.y });
    });
    if (d) paths.push(d.trim());
  });

  return (
    <svg className="simu-thread" style={{ top: AXIS_H }}>
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={col}
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity=".85"
        />
      ))}
      {nodos.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r="2.5" fill={col} />
      ))}
    </svg>
  );
}

/* ─────────── Proyección por estación ─────────── */

function Proyeccion({
  carriles,
  otsInfo,
  filtro,
  soloTarde,
  onSel,
}: {
  carriles: Carril[];
  otsInfo: Array<{ ot: string }>;
  filtro: (b: Bloque) => boolean;
  soloTarde: boolean;
  onSel: (b: Bloque) => void;
}) {
  const maxMin = Math.max(
    1,
    ...carriles.map((c) => c.bloques.reduce((s, b) => s + (b.duracionMin ?? 0), 0)),
  );
  const secciones = carriles
    .map((c) => ({
      c,
      bs: c.bloques
        .filter((b) => filtro(b) && (!soloTarde || b.tarde))
        .slice()
        .sort((a, b) => a.x0 - b.x0 || a.pasoIndice - b.pasoIndice),
    }))
    .filter((s) => s.bs.length > 0);

  if (secciones.length === 0)
    return <div className="simu-proj-vacio">Ningún paso coincide con el filtro.</div>;

  return (
    <div className="simu-proj">
      <p className="simu-pintro">
        Cada estación con los pasos que el scheduler proyectó y el horario
        laboral en que corren. Tocá una fila para ver por qué esperó lo que
        esperó.
      </p>
      {secciones.map(({ c, bs }) => {
        const totMin = bs.reduce((s, b) => s + (b.duracionMin ?? 0), 0);
        const esperaN = bs.filter((b) => b.esperaMin > 0).length;
        const tardeN = bs.filter((b) => b.tarde).length;
        const cap =
          c.key === PROVEEDOR_KEY
            ? "externo"
            : c.key === SIN_ESTACION_KEY
              ? "capacidad ∞"
              : `${c.puestos} puesto${(c.puestos ?? 0) > 1 ? "s" : ""}`;
        let ultimoDia: string | null = null;
        return (
          <section
            key={c.key}
            className={`simu-st ${c.key === SIN_ESTACION_KEY ? "warn" : ""}`}
            style={{ ["--simu-acc" as string]: c.acento }}
          >
            <div className="simu-sh">
              <span className="simu-sdot" />
              <div className="simu-sinfo">
                <div className="nm">{c.nombre}</div>
                <div className="smeta">
                  {cap} · {bs.length} pasos · {horas(totMin)} programadas
                </div>
              </div>
              <div className="simu-sflags">
                {esperaN > 0 ? (
                  <span className="simu-badge wait">{esperaN} con espera</span>
                ) : null}
                {tardeN > 0 ? (
                  <span className="simu-badge late">{tardeN} no llega</span>
                ) : null}
              </div>
              <div className="simu-load">
                <span style={{ width: `${Math.max(4, (totMin / maxMin) * 100)}%` }} />
              </div>
            </div>
            <div className="simu-sbody">
              {bs.map((b) => {
                const dia = diaCorto(b.inicio);
                const sep = dia !== ultimoDia;
                ultimoDia = dia;
                const finTxt =
                  diaCorto(b.fin) === dia ? hhmm(b.fin) : `${diaCorto(b.fin)} ${hhmm(b.fin)}`;
                return (
                  <React.Fragment key={b.pasoId}>
                    {sep ? (
                      <div className="simu-dsep">
                        <span className="dd">{dia}</span>
                      </div>
                    ) : null}
                    <div
                      className="simu-prow"
                      role="button"
                      tabIndex={0}
                      onClick={() => onSel(b)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSel(b);
                        }
                      }}
                    >
                      <div className="simu-ptime">
                        {c.filas > 1 ? <span className="pst">P{b.fila + 1}</span> : null}
                        <span className="h0">{hhmm(b.inicio)}</span>
                        <span className="arr">→</span>
                        <span className="h1">{finTxt}</span>
                        <span className="dur">
                          {b.duracionMin != null
                            ? `${b.duracionMin} min`
                            : `${b.plazoDias} días prov.`}
                        </span>
                      </div>
                      <div className="simu-pmain">
                        <div className="pt">
                          <span
                            className="simu-otchip"
                            style={{ background: tintaDe(b.ot, otsInfo) }}
                          >
                            {b.ot.replace(/^OT-\d{4}-/, "")}
                          </span>
                          {b.pasoNombre}
                        </div>
                        <div className="psub">
                          {b.itemNombre} · {b.cliente}
                        </div>
                      </div>
                      <div className="simu-pflags">
                        {b.esperaMin > 0 ? (
                          <span className="simu-badge wait">espera {horas(b.esperaMin)}</span>
                        ) : null}
                        {b.tercerizado ? (
                          <span className="simu-badge terc">tercerizado</span>
                        ) : null}
                        {c.key === SIN_ESTACION_KEY ? (
                          <span className="simu-badge sin">supuesto</span>
                        ) : null}
                        {b.tarde ? <span className="simu-badge late">no llega</span> : null}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ─────────── Inspector ─────────── */

function Inspector({
  b,
  total,
  color,
  onClose,
  onOpen,
}: {
  b: Bloque;
  total: number;
  color: string;
  onClose: () => void;
  onOpen: () => void;
}) {
  const notas: React.ReactNode[] = [];
  if (b.esperaMin > 0)
    notas.push(
      <div key="e" className="simu-note">
        Esperó <b>{horas(b.esperaMin)}</b> en {b.estNombre} a que se liberara un puesto o
        la máquina. El trabajo estaba listo antes, pero el recurso estaba ocupado.
      </div>,
    );
  if (b.tercerizado)
    notas.push(
      <div key="t" className="simu-note a">
        Paso tercerizado: no ocupa puesto del taller. Corre en el calendario del proveedor,{" "}
        <b>{b.plazoDias} días hábiles</b>.
      </div>,
    );
  if (b.estKey === SIN_ESTACION_KEY)
    notas.push(
      <div key="s" className="simu-note a">
        La familia <b>{b.familia}</b> no está asignada a ninguna estación. El motor la
        programa con capacidad infinita — <b>esta parte del plan es optimista</b>.
      </div>,
    );
  if (b.duracionMin === 0)
    notas.push(
      <div key="z" className="simu-note">
        Duración cero real: el paso existe en la ruta pero no consume tiempo de máquina.
      </div>,
    );
  if (b.preparacionMin > 0)
    notas.push(
      <div key="p" className="simu-note">
        Antes de trabajar hay <b>{b.preparacionMin} min</b> de traslado: el operario va a
        buscar el material. Ocupa un puesto de {b.estNombre}, pero no su máquina — la
        máquina recién entra a las <b>{hhmm(b.inicioTrabajo)}</b>.
      </div>,
    );
  if (b.enCurso)
    notas.push(
      <div key="c" className="simu-note">
        Ya estaba en curso al arrancar la simulación: se programó con el tiempo que le
        quedaba.
      </div>,
    );
  if (b.tarde)
    notas.push(
      <div key="l" className="simu-note h">
        Este item termina después de la entrega comprometida
        {b.entrega ? (
          <>
            {" "}(<b>{b.entrega}</b>)
          </>
        ) : null}
        . No llega.
      </div>,
    );
  if (b.candidatos && b.candidatos > 1)
    notas.push(
      <div key="k" className="simu-note">
        En este turno el scheduler evaluó <b>{b.candidatos} candidatos</b> y eligió éste
        porque podía arrancar antes.
      </div>,
    );

  return (
    <aside className="simu-insp" aria-label="Detalle de la decisión">
      <div className="h">
        <button type="button" className="x" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
        <div className="simu-eyebrow">
          Decisión {b.orden + 1} de {total}
        </div>
        <h2 style={{ color }}>
          {b.ot} · {b.pasoNombre}
        </h2>
        <div className="simu-isub">
          {b.itemNombre} — {b.cliente}
        </div>
      </div>
      <div className="b">
        <div>
          <Fila k="Estación" v={b.estNombre} />
          <Fila k="Familia" v={b.familia} />
          <Fila k="Arranca" v={`${diaCorto(b.inicio)} ${hhmm(b.inicio)}`} />
          <Fila k="Termina" v={`${diaCorto(b.fin)} ${hhmm(b.fin)}`} />
          {b.duracionMin != null ? (
            <Fila k="Duración" v={`${b.duracionMin} min`} />
          ) : (
            <Fila k="Plazo proveedor" v={`${b.plazoDias} días`} />
          )}
          <Fila k="Espera previa" v={b.esperaMin > 0 ? horas(b.esperaMin) : "—"} />
          {b.preparacionMin > 0 ? (
            <Fila k="Traslado" v={`${b.preparacionMin} min`} />
          ) : null}
          <Fila k="Paso nº" v={String(b.pasoIndice)} />
          {b.entrega ? <Fila k="Entrega" v={b.entrega} /> : null}
        </div>
        {notas}
        <button type="button" className="simu-abrir" onClick={onOpen}>
          Abrir el item en el tablero
        </button>
      </div>
    </aside>
  );
}

const Fila = ({ k, v }: { k: string; v: string }) => (
  <div className="simu-row">
    <span className="k">{k}</span>
    <span className="v">{v}</span>
  </div>
);

/* ─────────── Armado ─────────── */

const altura = (c: Carril) => c.filas * ROW + (c.filas + 1) * PAD;

function tintaDe(ot: string, otsInfo: Array<{ ot: string }>) {
  const i = otsInfo.findIndex((o) => o.ot === ot);
  return TINTAS[(i < 0 ? 0 : i) % TINTAS.length];
}

function construir(
  items: TableroItemData[],
  estaciones: Estacion[],
  sim: ResultadoSimulacion,
  noLaborables: Set<string>,
) {
  const porItem = new Map(items.map((i) => [i.id, i]));
  const pasos = new Map<string, TableroPasoData>();
  items.forEach((i) => i.pasos.forEach((p) => pasos.set(p.id, p)));
  const nombreEstacion = new Map(estaciones.map((e) => [e.id, e.nombre]));

  const ahora = new Date();
  const finMax = sim.traza.reduce<Date>(
    (max, p) => (p.fin > max ? p.fin : max),
    ahora,
  );
  const eje = construirEje({ estaciones, ahora, hasta: finMax, noLaborables });
  /* El eje arranca en la APERTURA del día, no en este instante: la línea de
     "ahora" hay que ubicarla, no dejarla en el origen. */
  const xAhora = eje.aX(ahora);

  const crudos = sim.traza
    .map((p: PasoProgramado) => {
      const item = porItem.get(p.itemId);
      const paso = pasos.get(p.pasoId);
      if (!item || !paso) return null;
      const eta = sim.porItem.get(p.itemId);
      const entrega = item.fechaEntrega ? new Date(item.fechaEntrega) : null;
      const bloque: Bloque = {
        orden: p.orden,
        itemId: p.itemId,
        pasoId: p.pasoId,
        pasoIndice: p.pasoIndice,
        ot: item.ordenNumero,
        ordenId: item.ordenId,
        itemNombre: item.nombre,
        cliente: item.clienteNombre,
        pasoNombre: paso.nombre,
        familia: paso.familiaCodigo,
        estKey: p.estacionKey,
        estNombre:
          p.estacionKey === SIN_ESTACION_KEY
            ? "Sin estación asignada"
            : p.estacionKey === PROVEEDOR_KEY
              ? "Proveedor externo"
              : (nombreEstacion.get(p.estacionKey) ?? "Estación"),
        x0: eje.aX(p.inicio),
        x1: eje.aX(p.fin),
        inicio: p.inicio,
        fin: p.fin,
        duracionMin: p.duracionMin,
        plazoDias: p.plazoDias,
        esperaMin: p.esperaMin,
        parcial: p.parcial,
        tercerizado: p.tercerizado,
        enCurso: p.enCurso,
        candidatos: p.candidatos,
        preparacionMin: p.preparacionMin,
        inicioTrabajo: p.inicioTrabajo,
        tarde: !!(entrega && eta?.finEstimado && eta.finEstimado > entrega),
        entrega: entrega ? diaCorto(entrega) : null,
        fila: 0,
      };
      return bloque;
    })
    .filter((b): b is Bloque => b !== null);

  /* Un carril por estación con trabajo; cada uno reparte sus bloques en
     sub-filas por solape (los puestos simultáneos de la estación). */
  const keys = [...new Set(crudos.map((b) => b.estKey))];
  const orden = (k: string) => (k === SIN_ESTACION_KEY ? 1 : k === PROVEEDOR_KEY ? 2 : 0);
  const carriles: Carril[] = keys
    .map((key, i) => {
      const bloques = crudos.filter((b) => b.estKey === key).sort((a, b) => a.x0 - b.x0);
      const filas: Bloque[][] = [];
      bloques.forEach((b) => {
        let f = filas.findIndex((r) => r[r.length - 1].x1 <= b.x0);
        if (f < 0) {
          filas.push([b]);
          f = filas.length - 1;
        } else filas[f].push(b);
        b.fila = f;
      });
      const est = estaciones.find((e) => e.id === key);
      return {
        key,
        nombre: bloques[0].estNombre,
        puestos: est?.capacidadConcurrente ?? null,
        bloques,
        filas: Math.max(1, filas.length),
        acento:
          key === SIN_ESTACION_KEY
            ? "#B45309"
            : key === PROVEEDOR_KEY
              ? "#78716C"
              : ACENTOS[i % ACENTOS.length],
      };
    })
    .sort((a, b) => orden(a.key) - orden(b.key) || a.nombre.localeCompare(b.nombre));

  const minutos = crudos.reduce((s, b) => s + (b.duracionMin ?? 0), 0);
  const sinEst = crudos
    .filter((b) => b.estKey === SIN_ESTACION_KEY)
    .reduce((s, b) => s + (b.duracionMin ?? 0), 0);

  return {
    bloques: crudos,
    carriles,
    eje,
    xAhora,
    total: {
      items: new Set(crudos.map((b) => b.itemId)).size,
      minutos,
      pctSinEstacion: minutos > 0 ? Math.round((sinEst / minutos) * 100) : 0,
      tarde: new Set(crudos.filter((b) => b.tarde).map((b) => b.itemId)).size,
    },
  };
}
