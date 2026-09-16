"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Chip, SearchField } from "@heroui/react";
import {
  ArrowUpRight,
  CheckCheck,
  CircleCheck,
  CircleDashed,
  Factory,
  FilePenLine,
  Layers3,
  SlidersHorizontal,
  Truck,
  X,
  CircleX,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  DownloadIcon,
  FilePlus2,
  PlusIcon,
  TriangleAlert,
} from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import {
  DesignSystemProvider,
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import { IdentityAvatar } from "@/components/design-system/identity-avatar";
import fieldFocus from "@/components/design-system/field-focus.module.css";
import { EstadoListado, ProgresoListado } from "./ordenes-trabajo-presentacion";
import s from "./ordenes-trabajo-view.module.css";
import layout from "@/components/design-system/list-page.module.css";
import { ListMetric } from "@/components/design-system/list-metric";
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

type OrdenesTrabajoViewProps = {
  ordenes?: OrdenTrabajoListItem[];
  /** Indicadores del tenant completo, calculados por el backend. */
  stats: OrdenesTrabajoStats;
  total: number;
  page: number;
  pages: number;
  limit: number;
  q: string;
  estado: FiltroEstado;
  urgencia?: "atrasadas";
  errorCarga?: string | null;
};

export function OrdenesTrabajoView(props: OrdenesTrabajoViewProps) {
  return (
    <DesignSystemProvider appearance="light" theme="brand">
      <OrdenesTrabajoContent {...props} />
    </DesignSystemProvider>
  );
}

function OrdenesTrabajoContent({
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
}: OrdenesTrabajoViewProps) {
  const scope = useDesignScope();
  const themeClass = useDesignTheme();
  const { moneda, zonaHoraria } = useConfigRegional();
  const { fechaNumerica } = useFecha();
  const router = useRouter();
  const [busqueda, setBusqueda] = React.useState(qInicial);
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

  const filtroActivo = Boolean(qInicial || urgencia || filtro !== "todas");
  const limpiarFiltros = () => {
    setBusqueda("");
    navegar({ q: "", estado: "todas", urgencia: undefined });
  };
  const iconosFiltro = {
    todas: Layers3,
    borrador: FilePenLine,
    pendiente: CircleDashed,
    produccion: Factory,
    finalizada: CircleCheck,
    entregada: Truck,
    cancelada: CircleX,
  };

  return (
    <section
      {...scope}
      data-visual="brand"
      className={`${themeClass} ${layout.page} ${s.page}`}
      aria-label="Órdenes de trabajo"
    >
      <header className={layout.header}>
        <div className="min-w-0">
          <p className={s.eyebrow}>
            <ClipboardList aria-hidden /> Comercial / Órdenes
          </p>
          <h1>
            Órdenes de trabajo<span className={s.titleDot}>.</span>
          </h1>
          <p className={layout.subtitle}>
            Cada trabajo, desde el primer borrador hasta la entrega.
          </p>
        </div>
        <div className={s.headerActions}>
          <ActionButton
            variant="outline"
            isDisabled={exportando || Boolean(errorCarga)}
            onPress={exportarCsv}
          >
            <DownloadIcon aria-hidden />
            {exportando ? "Exportando…" : "Exportar"}
          </ActionButton>
          <ActionLink href="/comercial/crear-propuesta">
            <PlusIcon aria-hidden /> Nueva orden <ArrowUpRight aria-hidden />
          </ActionLink>
        </div>
      </header>

      <div className={s.kpis}>
        <ListMetric
          label="Órdenes activas"
          value={kpis.activas}
          hint="Pendientes + en producción"
          icon={ClipboardList}
        />
        <ListMetric
          label="Entregas atrasadas"
          value={kpis.atrasadas}
          hint="Pendientes + en producción"
          icon={Clock3}
          tone="danger"
          selected={urgencia === "atrasadas"}
          onClick={() => navegar({ estado: "todas", urgencia: "atrasadas" })}
        />
        <ListMetric
          label="Valor en curso"
          value={formatMonedaOrden(kpis.valorEnCurso, moneda)}
          hint="Sin entregadas ni borradores"
          icon={CircleDollarSign}
        />
        <ListMetric
          label="Próximas a entregar"
          value={kpis.proximasEntregar}
          hint="Dentro de 7 días"
          icon={CalendarCheck2}
        />
        <ListMetric
          label="Emitidas hoy"
          value={kpis.emitidasHoy}
          hint={fechaNumerica(hoy.toISOString())}
          icon={FilePlus2}
          tone="brand"
        />
      </div>

      <Card className={layout.results}>
        <div className={s.toolbar}>
          <SearchField
            aria-label="Buscar órdenes por número o cliente"
            className={s.search}
            value={busqueda}
            onChange={setBusqueda}
          >
            <SearchField.Group
              className={`${s.searchGroup} ${fieldFocus.singleBorder}`}
            >
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Buscar por número o cliente…" />
              <SearchField.ClearButton aria-label="Limpiar búsqueda" />
            </SearchField.Group>
          </SearchField>
          <span className={s.resultCount} role="status">
            {errorCarga
              ? "Sin datos disponibles"
              : navegando
                ? "Buscando…"
                : `${total} ${total === 1 ? "orden" : "órdenes"}`}
          </span>
        </div>
        <div className={s.filters} role="group" aria-label="Filtrar por estado">
          {filtros.map((f) => {
            const Icon = iconosFiltro[f.k];
            return (
              <Button
                key={f.k}
                type="button"
                variant="ghost"
                className={s.filter}
                aria-pressed={!urgencia && filtro === f.k}
                onPress={() => navegar({ estado: f.k, urgencia: undefined })}
              >
                <Icon aria-hidden />
                <span>{f.label}</span>
                <span className={s.filterCount}>{counts[f.k]}</span>
              </Button>
            );
          })}
        </div>
        {filtroActivo && (
          <div className={s.activeFilters}>
            <span>
              <SlidersHorizontal aria-hidden />
              {urgencia
                ? "Entregas atrasadas"
                : filtro !== "todas"
                  ? ORDEN_TRABAJO_ESTADOS[filtro].label
                  : "Todas las órdenes"}
              {qInicial && <span className={s.query}>“{qInicial}”</span>}
            </span>
            <ActionButton variant="ghost" size="sm" onPress={limpiarFiltros}>
              <X aria-hidden /> Limpiar filtros
            </ActionButton>
          </div>
        )}

        <div className={s.content} aria-busy={navegando}>
          {lista.length > 0 && (
            <div
              className={s.tableScroller}
              role="region"
              aria-label="Tabla de órdenes"
              tabIndex={0}
            >
              <table className={s.table}>
                <caption className="sr-only">
                  Órdenes de trabajo: cliente, estado, avance, productos,
                  entrega, total y vendedor.
                </caption>
                <colgroup>
                  <col className={s.identityCol} />
                  <col />
                  <col />
                  <col className={s.itemsCol} />
                  <col />
                  <col />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Orden / Cliente</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Avance</th>
                    <th scope="col" className={s.center}>
                      Ítems
                    </th>
                    <th scope="col">Entrega</th>
                    <th scope="col" className={s.right}>
                      Total
                    </th>
                    <th scope="col">Vendedor</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((o) => (
                    <tr
                      key={o.id}
                      className={s.orderRow}
                      data-late={diasDeAtraso(o) > 0 || undefined}
                      onClick={(event) => {
                        // El enlace y el tooltip conservan sus interacciones nativas.
                        if (
                          (event.target as Element).closest(
                            "a, button, [tabindex]",
                          )
                        )
                          return;
                        abrirOrden(o.id);
                      }}
                    >
                      <td>
                        <div className={s.orderIdentity}>
                          <Link
                            href={`/produccion/ordenes/${o.id}`}
                            className={s.number}
                          >
                            {o.numero}
                            <ArrowUpRight aria-hidden />
                          </Link>
                          {esNueva(o) && (
                            <Chip size="sm" className={s.newTag}>
                              Nueva
                            </Chip>
                          )}
                        </div>
                        <div className={s.client}>{o.clienteNombre}</div>
                        <div className={s.description} title={o.resumen}>
                          {o.resumen}
                        </div>
                      </td>
                      <td>
                        <EstadoListado estado={o.estado} />
                      </td>
                      <td>
                        <ProgresoListado
                          valor={o.progresoPct}
                          estado={o.estado}
                          progreso={o.progreso}
                        />
                      </td>
                      <td className={s.center}>
                        <span className={s.itemCount}>{o.itemsCount}</span>
                      </td>
                      <td>
                        <EntregaOrden orden={o} atraso={diasDeAtraso(o)} />
                      </td>
                      <td className={s.total}>
                        {formatMonedaOrden(o.total, moneda)}
                      </td>
                      <td>
                        <span
                          className={layout.seller}
                          title={o.vendedorNombre}
                        >
                          <span aria-hidden>
                            <IdentityAvatar name={o.vendedorNombre} />
                          </span>
                          <span className="truncate">{o.vendedorNombre}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {errorCarga ? (
            <div className={`${layout.empty} ${s.empty}`} role="alert">
              <TriangleAlert aria-hidden />
              <h2>No pudimos cargar las órdenes</h2>
              <p>{errorCarga}</p>
              <ActionButton variant="outline" onPress={() => router.refresh()}>
                Reintentar
              </ActionButton>
            </div>
          ) : lista.length === 0 ? (
            <div className={`${layout.empty} ${s.empty}`}>
              {filtroActivo ? (
                <SlidersHorizontal aria-hidden />
              ) : (
                <ClipboardList aria-hidden />
              )}
              <h2>
                {filtroActivo
                  ? "No hay órdenes con estos filtros"
                  : "Tu próxima orden empieza acá"}
              </h2>
              <p>
                {filtroActivo
                  ? "Probá con otro número, cliente o estado."
                  : "Creá una orden y acompañá cada trabajo hasta su entrega."}
              </p>
              {filtroActivo ? (
                <ActionButton variant="outline" onPress={limpiarFiltros}>
                  Limpiar filtros
                </ActionButton>
              ) : (
                <ActionLink href="/comercial/crear-propuesta">
                  <PlusIcon aria-hidden /> Nueva orden
                </ActionLink>
              )}
            </div>
          ) : null}
        </div>

        {!errorCarga && total > 0 && (
          <footer className={layout.pager}>
            <span className={s.pageCount}>
              <strong>
                {(page - 1) * limit + 1}–{Math.min(page * limit, total)}
              </strong>{" "}
              de {total} {total === 1 ? "orden" : "órdenes"}
            </span>
            {pages > 1 && (
              <div className={s.pagination}>
                <span>
                  Página {page} de {pages}
                </span>
                <ActionButton
                  variant="outline"
                  isDisabled={page <= 1 || navegando}
                  onPress={() => navegar({ page: page - 1 })}
                >
                  <ChevronLeft aria-hidden /> Anterior
                </ActionButton>
                <ActionButton
                  variant="outline"
                  isDisabled={page >= pages || navegando}
                  onPress={() => navegar({ page: page + 1 })}
                >
                  Siguiente <ChevronRight aria-hidden />
                </ActionButton>
              </div>
            )}
          </footer>
        )}
      </Card>
    </section>
  );
}

function EntregaOrden({
  orden,
  atraso,
}: {
  orden: OrdenTrabajoListItem;
  atraso: number;
}) {
  return (
    <span className={s.delivery}>
      <span>{formatFechaOrden(orden.fechaEntrega)}</span>
      {atraso > 0 && (
        <span className={s.lateTag}>
          <Clock3 aria-hidden />
          {atraso} {atraso === 1 ? "día" : "días"} de atraso
        </span>
      )}
      {orden.estado === "entregada" && (
        <span className={s.deliveredTag}>
          <CheckCheck aria-hidden />
          Entregada
        </span>
      )}
    </span>
  );
}
