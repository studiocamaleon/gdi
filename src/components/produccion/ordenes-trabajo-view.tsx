"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, SearchField } from "@heroui/react";
import {
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  DownloadIcon,
  FilePlus2,
  LayoutGrid,
  PlusIcon,
  Table2,
  TriangleAlert,
} from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { useDesignScope } from "@/components/design-system/appearance";
import { SegmentedControl } from "@/components/design-system/choice-controls";
import { IdentityAvatar } from "@/components/design-system/identity-avatar";
import theme from "@/components/design-system/theme.module.css";
import fieldFocus from "@/components/design-system/field-focus.module.css";
import tabStyles from "@/components/design-system/navigation-tab-list.module.css";
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
  const scope = useDesignScope();
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
    <section
      {...scope}
      className={`${theme.theme} ${layout.page}`}
      aria-label="Órdenes de trabajo"
    >
      <header className={layout.header}>
        <div className="min-w-0">
          <h1>Órdenes de trabajo</h1>
          <p className={layout.subtitle}>
            Seguimiento de todas las OT emitidas y en curso.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton
            variant="outline"
            isDisabled={exportando || Boolean(errorCarga)}
            onPress={exportarCsv}
          >
            <DownloadIcon size={15} aria-hidden />
            {exportando ? "Exportando…" : "Exportar"}
          </ActionButton>
          <ActionLink href="/comercial/crear-propuesta">
            <PlusIcon size={15} aria-hidden />
            Nueva orden
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
        <div className={layout.toolbar}>
          <div
            className={layout.filters}
            role="group"
            aria-label="Filtrar por estado"
          >
            {filtros.map((f) => (
              <Button
                key={f.k}
                type="button"
                variant="ghost"
                className={`${tabStyles.tab} ${layout.filter}`}
                aria-pressed={!urgencia && filtro === f.k}
                onPress={() => navegar({ estado: f.k, urgencia: undefined })}
              >
                {f.label}
                <span className={tabStyles.count}>{counts[f.k]}</span>
              </Button>
            ))}
          </div>
          <div className={layout.tools}>
            <SearchField
              aria-label="Buscar órdenes por número o cliente"
              className={layout.search}
              value={busqueda}
              onChange={setBusqueda}
            >
              <SearchField.Group
                className={`${layout.searchGroup} ${fieldFocus.singleBorder}`}
              >
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Buscar por Nº, cliente…" />
              </SearchField.Group>
            </SearchField>
            <SegmentedControl
              aria-label="Vista de órdenes"
              value={modo}
              onChange={(value) => setModo(value as ModoVista)}
              options={[
                {
                  value: "tabla",
                  label: "Tabla",
                  icon: <Table2 size={15} aria-hidden />,
                },
                {
                  value: "tarjetas",
                  label: "Tarjetas",
                  icon: <LayoutGrid size={15} aria-hidden />,
                },
              ]}
            />
          </div>
        </div>

        <div className={s.content} aria-busy={navegando}>
          {modo === "tabla" ? (
            <div className={s.tableScroller}>
              <div className={s.table}>
                <div className={`${s.row} ${s.tableHead}`}>
                  <span>Nº / Cliente</span>
                  <span>Estado</span>
                  <span>Progreso</span>
                  <span className="text-center">Ítems</span>
                  <span>Entrega</span>
                  <span className="text-right">Total</span>
                  <span>Vendedor</span>
                </div>
                {lista.map((o) => (
                  <div
                    key={o.id}
                    className={`${s.row} ${s.orderRow}`}
                    data-late={diasDeAtraso(o) > 0 || undefined}
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
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className={s.number}>
                        {o.numero}
                        {esNueva(o) ? (
                          <Chip size="sm" className={s.newTag}>
                            NUEVA
                          </Chip>
                        ) : null}
                      </span>
                      <span
                        className={s.client}
                        title={`${o.clienteNombre} · ${o.resumen}`}
                      >
                        {o.clienteNombre} ·{" "}
                        <span className="text-muted-foreground">
                          {o.resumen}
                        </span>
                      </span>
                    </span>
                    <span>
                      <EstadoListado estado={o.estado} />
                    </span>
                    <span>
                      <ProgresoListado
                        valor={o.progresoPct}
                        estado={o.estado}
                        progreso={o.progreso}
                      />
                    </span>
                    <span className="text-center tabular-nums">
                      {o.itemsCount}
                    </span>
                    <span className={s.delivery}>
                      {formatFechaOrden(o.fechaEntrega)}
                      {diasDeAtraso(o) > 0 ? (
                        <span className={s.lateTag}>
                          {diasDeAtraso(o)} d tarde
                        </span>
                      ) : null}
                    </span>
                    <span className="text-right font-semibold whitespace-nowrap tabular-nums">
                      {formatMonedaOrden(o.total, moneda)}
                    </span>
                    <span className={layout.seller} title={o.vendedorNombre}>
                      <span aria-hidden>
                        <IdentityAvatar name={o.vendedorNombre} />
                      </span>
                      <span className="truncate">{o.vendedorNombre}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={s.cards}>
              {lista.map((o) => (
                <Card<"button">
                  key={o.id}
                  render={(props) => <button {...props} />}
                  type="button"
                  className={s.orderCard}
                  onClick={() => abrirOrden(o.id)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className={s.number}>{o.numero}</span>
                    {esNueva(o) ? (
                      <Chip size="sm" className={s.newTag}>
                        NUEVA
                      </Chip>
                    ) : (
                      <EstadoListado estado={o.estado} />
                    )}
                  </span>
                  {esNueva(o) ? (
                    <span>
                      <EstadoListado estado={o.estado} />
                    </span>
                  ) : null}
                  <span className={s.cardClient}>{o.clienteNombre}</span>
                  <span className={s.cardDescription}>{o.resumen}</span>
                  <span className={s.cardProgress}>
                    {o.estado === "borrador" ? (
                      <span className="text-muted-foreground">Sin emitir</span>
                    ) : (
                      <ProgresoListado
                        valor={o.progresoPct}
                        estado={o.estado}
                        progreso={o.progreso}
                      />
                    )}
                  </span>
                  <span className={s.cardFoot}>
                    <span className="flex flex-col gap-1">
                      <span className={s.caption}>Entrega</span>
                      <span className={s.delivery}>
                        {formatFechaOrden(o.fechaEntrega)}
                        {diasDeAtraso(o) > 0 ? (
                          <span className={s.lateTag}>
                            {diasDeAtraso(o)} d tarde
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="flex flex-col gap-1 text-right">
                      <span className={s.caption}>Total</span>
                      <span className="font-semibold whitespace-nowrap tabular-nums">
                        {formatMonedaOrden(o.total, moneda)}
                      </span>
                    </span>
                  </span>
                </Card>
              ))}
            </div>
          )}

          {errorCarga ? (
            <div className={layout.empty} role="alert">
              <TriangleAlert size={24} aria-hidden />
              <p>{errorCarga}</p>
              <ActionButton variant="outline" onPress={() => router.refresh()}>
                Reintentar
              </ActionButton>
            </div>
          ) : lista.length === 0 ? (
            <div className={layout.empty}>
              <ClipboardList size={28} aria-hidden />
              <p>Sin órdenes que coincidan con el filtro.</p>
            </div>
          ) : null}
        </div>

        {pages > 1 ? (
          <footer className={layout.pager}>
            <span className="text-muted-foreground tabular-nums">
              {(page - 1) * limit + 1}–{Math.min(page * limit, total)} de{" "}
              {total}
            </span>
            <div className="flex items-center gap-2">
              <ActionButton
                variant="outline"
                isDisabled={page <= 1 || navegando}
                onPress={() => navegar({ page: page - 1 })}
              >
                <ChevronLeft size={15} aria-hidden />
                Anterior
              </ActionButton>
              <ActionButton
                variant="outline"
                isDisabled={page >= pages || navegando}
                onPress={() => navegar({ page: page + 1 })}
              >
                Siguiente
                <ChevronRight size={15} aria-hidden />
              </ActionButton>
            </div>
          </footer>
        ) : null}
      </Card>
    </section>
  );
}
