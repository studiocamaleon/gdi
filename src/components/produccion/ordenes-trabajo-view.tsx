"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DownloadIcon, PlusIcon, SearchIcon } from "lucide-react";

import {
  ORDEN_TRABAJO_ESTADOS,
  ORDEN_TRABAJO_FLOW,
  fechaLocalDesdeIso,
  formatFechaOrden,
  formatMonedaOrden,
  type OrdenTrabajoEstado,
  type OrdenTrabajoListItem,
} from "@/lib/ordenes-trabajo";

type FiltroEstado = OrdenTrabajoEstado | "todas";
type ModoVista = "tabla" | "tarjetas";

export function EstadoOtBadge({
  estado,
  sm,
}: {
  estado: OrdenTrabajoEstado;
  sm?: boolean;
}) {
  const e = ORDEN_TRABAJO_ESTADOS[estado];
  return (
    <span
      className={`otl-badge ${sm ? "sm" : ""}`}
      style={{ color: e.fg, background: e.bg }}
    >
      <span className="d" style={{ background: e.dot }} />
      {e.label}
    </span>
  );
}

function ProgresoMini({
  valor,
  estado,
}: {
  valor: number | null;
  estado: OrdenTrabajoEstado;
}) {
  if (valor === null) return <span className="dash">—</span>;
  const e = ORDEN_TRABAJO_ESTADOS[estado];
  return (
    <div className="otl-prog">
      <div className="otl-prog-track">
        <span style={{ width: `${valor}%`, background: e.dot }} />
      </div>
      <span className="otl-prog-v mono">{valor}%</span>
    </div>
  );
}

function esMismoDiaLocal(iso: string, fecha: Date) {
  const local = fechaLocalDesdeIso(iso);
  return (
    local !== null &&
    local.getFullYear() === fecha.getFullYear() &&
    local.getMonth() === fecha.getMonth() &&
    local.getDate() === fecha.getDate()
  );
}

function diasHasta(iso: string | null, desde: Date): number | null {
  if (!iso) return null;
  const local = fechaLocalDesdeIso(iso);
  if (!local) return null;
  const base = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  return Math.round((local.getTime() - base.getTime()) / 86_400_000);
}

export function OrdenesTrabajoView({
  ordenes = [],
}: {
  ordenes?: OrdenTrabajoListItem[];
}) {
  const router = useRouter();
  const [filtro, setFiltro] = React.useState<FiltroEstado>("todas");
  const [busqueda, setBusqueda] = React.useState("");
  const [modo, setModo] = React.useState<ModoVista>("tabla");

  const abrirOrden = (id: string) =>
    router.push(`/produccion/ordenes/${id}`);

  const hoy = React.useMemo(() => new Date(), []);

  // NUEVA = emitida hace menos de 24h corridas Y todavía pendiente (cuando
  // el taller la agarra deja de ser "nueva"). Decisión 2026-07-16.
  const esNueva = React.useCallback(
    (o: OrdenTrabajoListItem) => {
      if (o.estado !== "pendiente") return false;
      const creada = new Date(o.creadaEl).getTime();
      if (Number.isNaN(creada)) return false;
      return hoy.getTime() - creada < 24 * 60 * 60 * 1000;
    },
    [hoy],
  );

  const counts = React.useMemo(() => {
    const base: Record<FiltroEstado, number> = {
      todas: ordenes.length,
      borrador: 0,
      pendiente: 0,
      produccion: 0,
      finalizada: 0,
      entregada: 0,
    };
    for (const orden of ordenes) base[orden.estado] += 1;
    return base;
  }, [ordenes]);

  const kpis = React.useMemo(() => {
    const esActiva = (o: OrdenTrabajoListItem) =>
      o.estado === "pendiente" || o.estado === "produccion";
    const activas = ordenes.filter(esActiva);
    const valorEnCurso = ordenes
      .filter((o) => o.estado !== "entregada" && o.estado !== "borrador")
      .reduce((acc, o) => acc + o.total, 0);
    const proximasEntregar = activas.filter((o) => {
      const dias = diasHasta(o.fechaEntrega, hoy);
      return dias !== null && dias >= 0 && dias <= 7;
    }).length;
    const emitidasHoy = ordenes.filter(
      (o) => o.estado !== "borrador" && esMismoDiaLocal(o.creadaEl, hoy),
    ).length;
    return { activas: activas.length, valorEnCurso, proximasEntregar, emitidasHoy };
  }, [ordenes, hoy]);

  const lista = React.useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return ordenes.filter((o) => {
      if (filtro !== "todas" && o.estado !== filtro) return false;
      if (!q) return true;
      const s =
        `${o.numero} ${o.clienteNombre} ${o.resumen} ${o.vendedorNombre}`.toLowerCase();
      return s.includes(q);
    });
  }, [ordenes, filtro, busqueda]);

  const filtros: Array<{ k: FiltroEstado; label: string }> = [
    { k: "todas", label: "Todas" },
    ...ORDEN_TRABAJO_FLOW.map((k) => ({
      k,
      label: ORDEN_TRABAJO_ESTADOS[k].label,
    })),
  ];

  return (
    <div
      className="otl-page"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        width: "auto",
        maxWidth: "none",
        margin: 0,
        padding: "28px 34px 60px",
      }}
    >
      <div className="otl-inner">
        <div className="otl-head">
          <div className="left">
            <h1>Órdenes de trabajo</h1>
            <div className="sub">
              Seguimiento de todas las OT emitidas y en curso.
            </div>
          </div>
          <div className="right">
            <button type="button" className="btn">
              <DownloadIcon />
              Exportar
            </button>
            <Link href="/comercial/crear-propuesta" className="btn btn-primary">
              <PlusIcon />
              Nueva orden
            </Link>
          </div>
        </div>

        <div className="otl-kpis">
          <div className="otl-kpi">
            <div className="k-lbl">Órdenes activas</div>
            <div className="k-val mono">{kpis.activas}</div>
            <div className="k-hint">Pendientes + en producción</div>
          </div>
          <div className="otl-kpi">
            <div className="k-lbl">Valor en curso</div>
            <div className="k-val mono">{formatMonedaOrden(kpis.valorEnCurso)}</div>
            <div className="k-hint">Sin entregadas ni borradores</div>
          </div>
          <div className="otl-kpi">
            <div className="k-lbl">Próximas a entregar</div>
            <div className="k-val mono">{kpis.proximasEntregar}</div>
            <div className="k-hint">Dentro de 7 días</div>
          </div>
          <div className="otl-kpi accent">
            <div className="k-lbl">Emitidas hoy</div>
            <div className="k-val mono">{kpis.emitidasHoy}</div>
            <div className="k-hint">
              {new Intl.DateTimeFormat("es-AR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              }).format(hoy)}
            </div>
          </div>
        </div>

        <div className="otl-toolbar">
          <div className="otl-filters">
            {filtros.map((f) => (
              <button
                key={f.k}
                type="button"
                className={`otl-fchip ${filtro === f.k ? "on" : ""}`}
                onClick={() => setFiltro(f.k)}
              >
                {f.label}
                <span className="ct">{counts[f.k]}</span>
              </button>
            ))}
          </div>
          <div className="otl-tools-right">
            <div className="otl-search">
              <SearchIcon size={15} />
              <input
                placeholder="Buscar por Nº, cliente…"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
              />
            </div>
            <div className="otl-viewtoggle">
              <button
                type="button"
                className={modo === "tabla" ? "on" : ""}
                onClick={() => setModo("tabla")}
                title="Tabla"
                aria-label="Ver como tabla"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path d="M3 9h18M3 15h18M4 4h16v16H4z" />
                </svg>
              </button>
              <button
                type="button"
                className={modo === "tarjetas" ? "on" : ""}
                onClick={() => setModo("tarjetas")}
                title="Tarjetas"
                aria-label="Ver como tarjetas"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {modo === "tabla" ? (
          <div className="otl-table">
            <div className="otl-tr otl-th">
              <span>Nº / Cliente</span>
              <span>Estado</span>
              <span>Progreso</span>
              <span className="c">Ítems</span>
              <span>Entrega</span>
              <span className="r">Total</span>
              <span className="r">Vendedor</span>
            </div>
            {lista.map((o) => (
              <div
                key={o.id}
                className="otl-tr otl-row"
                onClick={() => abrirOrden(o.id)}
              >
                <span className="otl-idcell">
                  <span className="nro mono">
                    {o.numero}
                    {esNueva(o) ? (
                      <span className="otl-new-tag">NUEVA</span>
                    ) : null}
                  </span>
                  <span className="cli">
                    {o.clienteNombre} · <span className="res">{o.resumen}</span>
                  </span>
                </span>
                <span>
                  <EstadoOtBadge estado={o.estado} sm />
                </span>
                <span>
                  <ProgresoMini valor={o.progresoPct} estado={o.estado} />
                </span>
                <span className="c mono">{o.itemsCount}</span>
                <span className="mono entrega">
                  {formatFechaOrden(o.fechaEntrega)}
                </span>
                <span className="r mono total">{formatMonedaOrden(o.total)}</span>
                <span className="r vend">{o.vendedorNombre}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="otl-cards">
            {lista.map((o) => (
              <button
                key={o.id}
                type="button"
                className="otl-card"
                onClick={() => abrirOrden(o.id)}
              >
                <div className="otl-card-top">
                  <span className="nro mono">{o.numero}</span>
                  {esNueva(o) ? (
                    <span className="otl-new-tag">NUEVA</span>
                  ) : (
                    <EstadoOtBadge estado={o.estado} sm />
                  )}
                </div>
                {esNueva(o) ? (
                  <div style={{ marginTop: -2 }}>
                    <EstadoOtBadge estado={o.estado} sm />
                  </div>
                ) : null}
                <div className="otl-card-cli">{o.clienteNombre}</div>
                <div className="otl-card-res">{o.resumen}</div>
                <div className="otl-card-prog">
                  {o.estado === "borrador" ? (
                    <span className="dash">Sin emitir</span>
                  ) : (
                    <ProgresoMini valor={o.progresoPct} estado={o.estado} />
                  )}
                </div>
                <div className="otl-card-foot">
                  <span className="cf">
                    <span className="l">Entrega</span>
                    <span className="v mono">
                      {formatFechaOrden(o.fechaEntrega)}
                    </span>
                  </span>
                  <span className="cf r">
                    <span className="l">Total</span>
                    <span className="v mono total">
                      {formatMonedaOrden(o.total)}
                    </span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {lista.length === 0 ? (
          <div className="otl-empty">
            Sin órdenes que coincidan con el filtro.
          </div>
        ) : null}
      </div>
    </div>
  );
}
