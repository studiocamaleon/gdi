"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DownloadIcon, PlusIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import {
  ORDEN_TRABAJO_ESTADOS,
  ORDEN_TRABAJO_FLOW,
  ESTADO_CANCELADA,
  formatFechaOrden,
  formatMonedaOrden,
  type OrdenTrabajoEstado,
  type OrdenTrabajoListItem,
  type OrdenesTrabajoStats,
} from "@/lib/ordenes-trabajo";
import { getOrdenesTrabajo } from "@/lib/ordenes-trabajo-api";
import {
  useConfigRegional,
  useFecha,
} from "@/components/navigation/config-regional-provider";

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

export function OrdenesTrabajoView({
  ordenes = [],
  stats,
  total,
  page,
  pages,
  limit,
  q: qInicial,
  estado: filtro,
  urgencia,
  errorCarga,
}: {
  ordenes?: OrdenTrabajoListItem[];
  /** KPIs y contadores del tenant completo, calculados por el backend. */
  stats: OrdenesTrabajoStats;
  total: number;
  page: number;
  pages: number;
  limit: number;
  q: string;
  estado: FiltroEstado;
  urgencia?: "atrasadas";
  errorCarga?: string | null;
}) {
  const { moneda, zonaHoraria } = useConfigRegional();
  const { fechaNumerica } = useFecha();
  const router = useRouter();
  const [busqueda, setBusqueda] = React.useState(qInicial);
  const [modo, setModo] = React.useState<ModoVista>("tabla");
  const [exportando, setExportando] = React.useState(false);
  const [navegando, startTransition] = React.useTransition();

  const abrirOrden = (id: string) => router.push(`/produccion/ordenes/${id}`);

  const hoy = React.useMemo(() => new Date(), []);

  /**
   * Búsqueda, filtro y página viven en la URL: los resuelve el backend con
   * sus índices. Filtrar acá arriba de una página ya recortada mostraría
   * resultados incompletos sin avisar.
   */
  const navegar = React.useCallback(
    (destino: {
      q?: string;
      estado?: FiltroEstado;
      urgencia?: "atrasadas";
      page?: number;
    }) => {
      const params = new URLSearchParams();
      const q = (destino.q ?? busqueda).trim();
      const estado = destino.estado ?? filtro;
      const urgenciaDestino = Object.hasOwn(destino, "urgencia")
        ? destino.urgencia
        : urgencia;
      const pagina = destino.page ?? 1;
      if (q) params.set("q", q);
      if (urgenciaDestino) params.set("urgencia", urgenciaDestino);
      else if (estado !== "todas") params.set("estado", estado);
      if (pagina > 1) params.set("page", String(pagina));
      const qs = params.toString();
      startTransition(() => {
        router.replace(`/produccion/ordenes${qs ? `?${qs}` : ""}`, {
          scroll: false,
        });
      });
    },
    [busqueda, filtro, router, urgencia],
  );

  const hoyClave = React.useMemo(() => {
    const partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: zonaHoraria,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(hoy);
    const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
      partes.find((item) => item.type === tipo)?.value ?? "";
    return `${parte("year")}-${parte("month")}-${parte("day")}`;
  }, [hoy, zonaHoraria]);

  const diasDeAtraso = React.useCallback(
    (orden: OrdenTrabajoListItem) => {
      if (
        !orden.fechaEntrega ||
        !["pendiente", "produccion"].includes(orden.estado)
      )
        return 0;
      const entrega = orden.fechaEntrega.slice(0, 10);
      if (entrega >= hoyClave) return 0;
      return Math.round(
        (Date.parse(`${hoyClave}T00:00:00Z`) -
          Date.parse(`${entrega}T00:00:00Z`)) /
          86_400_000,
      );
    },
    [hoyClave],
  );

  const exportarCsv = React.useCallback(async () => {
    setExportando(true);
    try {
      const filas: OrdenTrabajoListItem[] = [];
      let pagina = 1;
      let paginas = 1;
      do {
        const respuesta = await getOrdenesTrabajo({
          q: qInicial || undefined,
          estado: urgencia
            ? undefined
            : filtro === "todas"
              ? undefined
              : filtro,
          urgencia,
          page: pagina,
          limit: 200,
        });
        filas.push(...respuesta.data);
        paginas = respuesta.pages;
        pagina += 1;
      } while (pagina <= paginas);

      const celda = (valor: unknown) => {
        let texto = String(valor ?? "");
        if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;
        return `"${texto.replaceAll('"', '""')}"`;
      };
      const encabezado = [
        "Número",
        "Cliente",
        "Estado",
        "Progreso",
        "Ítems",
        "Fecha de entrega",
        "Total",
        "Vendedor",
      ];
      const contenido = [
        encabezado,
        ...filas.map((orden) => [
          orden.numero,
          orden.clienteNombre,
          ORDEN_TRABAJO_ESTADOS[orden.estado].label,
          orden.progresoPct ?? "",
          orden.itemsCount,
          orden.fechaEntrega?.slice(0, 10) ?? "",
          orden.total,
          orden.vendedorNombre,
        ]),
      ]
        .map((fila) => fila.map(celda).join(","))
        .join("\r\n");
      const url = URL.createObjectURL(
        new Blob(["\uFEFF", contenido], { type: "text/csv;charset=utf-8" }),
      );
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `ordenes-trabajo-${hoyClave}.csv`;
      enlace.click();
      URL.revokeObjectURL(url);
      toast.success(`${filas.length} órdenes exportadas.`);
    } catch {
      toast.error("No se pudieron exportar las órdenes.");
    } finally {
      setExportando(false);
    }
  }, [filtro, hoyClave, qInicial, urgencia]);

  // La búsqueda espera a que dejes de tipear; el resto navega al toque.
  React.useEffect(() => {
    if (busqueda.trim() === qInicial.trim()) return;
    const timer = setTimeout(() => navegar({ q: busqueda }), 350);
    return () => clearTimeout(timer);
  }, [busqueda, qInicial, navegar]);

  // NUEVA = emitida hace menos de 24h corridas Y todavía pendiente (cuando
  // el taller la agarra deja de ser "nueva"). Decisión 2026-07-16.
  const esNueva = React.useCallback(
    (o: OrdenTrabajoListItem) => {
      if (o.estado !== "pendiente") return false;
      if (!o.fechaEmision) return false;
      const emitida = new Date(o.fechaEmision).getTime();
      if (Number.isNaN(emitida)) return false;
      return hoy.getTime() - emitida < 24 * 60 * 60 * 1000;
    },
    [hoy],
  );

  const counts: Record<FiltroEstado, number> = {
    todas: stats.totalOrdenes,
    ...stats.porEstado,
  };
  const kpis = stats;
  const lista = ordenes;

  const filtros: Array<{ k: FiltroEstado; label: string }> = [
    { k: "todas", label: "Todas" },
    ...ORDEN_TRABAJO_FLOW.map((k) => ({
      k,
      label: ORDEN_TRABAJO_ESTADOS[k].label,
    })),
    // Va al final y sólo si hay alguna: en un taller sano son pocas, y un chip
    // permanente en cero le daría un lugar que no se ganó.
    ...(kpis.porEstado.cancelada > 0
      ? [
          {
            k: ESTADO_CANCELADA as FiltroEstado,
            label: ORDEN_TRABAJO_ESTADOS.cancelada.label,
          },
        ]
      : []),
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
            <button
              type="button"
              className="btn"
              disabled={exportando || Boolean(errorCarga)}
              onClick={exportarCsv}
            >
              <DownloadIcon />
              {exportando ? "Exportando…" : "Exportar"}
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
          <button
            type="button"
            className={`otl-kpi danger ${urgencia === "atrasadas" ? "on" : ""}`}
            onClick={() => navegar({ estado: "todas", urgencia: "atrasadas" })}
          >
            <div className="k-lbl">Entregas atrasadas</div>
            <div className="k-val mono">{kpis.atrasadas}</div>
            <div className="k-hint">Pendientes + en producción</div>
          </button>
          <div className="otl-kpi">
            <div className="k-lbl">Valor en curso</div>
            <div className="k-val mono">
              {formatMonedaOrden(kpis.valorEnCurso, moneda)}
            </div>
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
            <div className="k-hint">{fechaNumerica(hoy.toISOString())}</div>
          </div>
        </div>

        <div className="otl-toolbar">
          <div className="otl-filters">
            {filtros.map((f) => (
              <button
                key={f.k}
                type="button"
                className={`otl-fchip ${!urgencia && filtro === f.k ? "on" : ""}`}
                onClick={() => navegar({ estado: f.k, urgencia: undefined })}
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

        <div
          style={{
            opacity: navegando ? 0.55 : 1,
            transition: "opacity 0.15s",
          }}
        >
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
                  className={`otl-tr otl-row ${diasDeAtraso(o) > 0 ? "late" : ""}`}
                  role="link"
                  tabIndex={0}
                  onClick={() => abrirOrden(o.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      abrirOrden(o.id);
                    }
                  }}
                >
                  <span className="otl-idcell">
                    <span className="nro mono">
                      {o.numero}
                      {esNueva(o) ? (
                        <span className="otl-new-tag">NUEVA</span>
                      ) : null}
                    </span>
                    <span className="cli">
                      {o.clienteNombre} ·{" "}
                      <span className="res">{o.resumen}</span>
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
                    {diasDeAtraso(o) > 0 ? (
                      <span className="otl-late-tag">
                        {diasDeAtraso(o)} d tarde
                      </span>
                    ) : null}
                  </span>
                  <span className="r mono total">
                    {formatMonedaOrden(o.total, moneda)}
                  </span>
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
                        {diasDeAtraso(o) > 0 ? (
                          <span className="otl-late-tag">
                            {diasDeAtraso(o)} d tarde
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="cf r">
                      <span className="l">Total</span>
                      <span className="v mono total">
                        {formatMonedaOrden(o.total, moneda)}
                      </span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {errorCarga ? (
            <div className="otl-empty" role="alert">
              {errorCarga}{" "}
              <button
                type="button"
                className="btn"
                onClick={() => router.refresh()}
              >
                Reintentar
              </button>
            </div>
          ) : lista.length === 0 ? (
            <div className="otl-empty">
              Sin órdenes que coincidan con el filtro.
            </div>
          ) : null}
        </div>

        {pages > 1 ? (
          <div className="otl-pager">
            <span className="rango mono">
              {(page - 1) * limit + 1}–{Math.min(page * limit, total)} de{" "}
              {total}
            </span>
            <div className="botones">
              <button
                type="button"
                className="btn"
                disabled={page <= 1 || navegando}
                onClick={() => navegar({ page: page - 1 })}
              >
                Anterior
              </button>
              <button
                type="button"
                className="btn"
                disabled={page >= pages || navegando}
                onClick={() => navegar({ page: page + 1 })}
              >
                Siguiente
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
