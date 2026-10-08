"use client";
import type { PaginaFacturacion } from "@/lib/listado-fiscal";
import { TablePagination } from "@/components/ui/table-pagination";

import { normalizarBusqueda } from "@/lib/busqueda-texto";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Checkbox, Chip, SearchField } from "@heroui/react";
import {
  ArrowUpRightIcon,
  CheckCheckIcon,
  FileStackIcon,
  FilesIcon,
  InfoIcon,
  ListChecksIcon,
  ListFilterIcon,
  ReceiptTextIcon,
  SearchXIcon,
  UsersRoundIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { OrdenFacturable } from "@/lib/administracion";
import {
  FacturaDetalleSelector,
  type DetalleFactura,
} from "./factura-detalle-selector";
import { FacturacionLotes } from "./facturacion-lotes";
import { facturarLote } from "@/lib/administracion-api";
import {
  useConfigRegional,
  useFecha,
} from "@/components/navigation/config-regional-provider";
import {
  parametrosFacturacion,
  type FiltrosFacturacion,
} from "@/lib/facturacion-filtros";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { usePuede } from "@/components/navigation/permisos-provider";
import { formatearMoneda } from "@/lib/moneda";
import { fechaComprobante } from "@/lib/comprobantes-presentacion";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import { ActionButton } from "@/components/design-system/action-button";
import { ActionLink } from "@/components/design-system/action-link";
import { ListMetric } from "@/components/design-system/list-metric";
import { SegmentedControl } from "@/components/design-system/choice-controls";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  FacturacionConfirmacion,
  type LotePorConfirmar,
} from "./facturacion-confirmacion";
import listPage from "@/components/design-system/list-page.module.css";
import focus from "@/components/design-system/field-focus.module.css";
import s from "./facturacion.module.css";

/** Conserva la emisión por orden o agrupada y el resultado parcial del lote. */
export function FacturacionView({
  initialOrdenes,
  initialFiltros = {},
  initialQ = "",
  paginacion,
}: {
  initialOrdenes: OrdenFacturable[];
  initialFiltros?: FiltrosFacturacion;
  initialQ?: string;
  paginacion?: PaginaFacturacion;
}) {
  const router = useRouter();
  const { moneda } = useConfigRegional();
  const { fechaNumerica } = useFecha();
  const [filtros, setFiltros] = React.useState(initialFiltros);
  const [filtrosAbiertos, setFiltrosAbiertos] = React.useState(false);
  const [cargandoFiltros, iniciarFiltro] = React.useTransition();
  const filtroId = React.useId();
  const filtrosActivos = Boolean(
    parametrosFacturacion(initialFiltros) || initialQ,
  );
  const rangoInvalido = Boolean(
    filtros.emisionDesde &&
    filtros.emisionHasta &&
    filtros.emisionDesde > filtros.emisionHasta,
  );
  const navegarFiltros = (nuevos: FiltrosFacturacion) => {
    setFiltros(nuevos);
    setSel(new Set());
    setQ("");
    const query = parametrosFacturacion(nuevos);
    iniciarFiltro(() =>
      router.replace(`/administracion/facturacion${query ? `?${query}` : ""}`, {
        scroll: false,
      }),
    );
  };
  const fmt = (n: number) => formatearMoneda(n, moneda);
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const puedeGestionar = usePuede("administracion.facturacion.gestionar");
  const [q, setQ] = React.useState(initialQ);
  const [cacheSeleccion, setCacheSeleccion] = React.useState<
    Map<string, OrdenFacturable>
  >(() => new Map());
  const [sel, setSel] = React.useState<Set<string>>(() => new Set());
  const [detalleAgrupada, setDetalleAgrupada] =
    React.useState<DetalleFactura>("orden");
  const [detallePorOrden, setDetallePorOrden] =
    React.useState<DetalleFactura>("items");
  const [modo, setModo] = React.useState<"por_orden" | "agrupada">("por_orden");
  const [facturando, setFacturando] = React.useState(false);
  const [confirmacion, setConfirmacion] =
    React.useState<LotePorConfirmar | null>(null);
  const emisionEnCurso = React.useRef(false);
  const claveSolicitud = React.useRef<string | null>(null);
  const [revisionLotes, setRevisionLotes] = React.useState(0);

  const data = initialOrdenes;
  const rows = React.useMemo(
    () =>
      paginacion
        ? data
        : data.filter(
            (o) =>
              !q ||
              normalizarBusqueda(
                `${o.numero} ${o.clienteNombre ?? ""}`,
              ).includes(normalizarBusqueda(q)),
          ),
    [data, q, paginacion],
  );

  const seleccionadas = [...cacheSeleccion.values()].filter((o) =>
    sel.has(o.ordenId),
  );
  const totalSel = seleccionadas.reduce((s, o) => s + o.saldoSinFacturar, 0);
  const clientesSel = new Set(seleccionadas.map((o) => o.clienteId ?? "CF"));
  const puedeAgrupar = seleccionadas.length > 1 && clientesSel.size === 1;
  const totalPendiente =
    paginacion?.resumen.importe ??
    data.reduce((s, o) => s + o.saldoSinFacturar, 0);
  const todasVisiblesSeleccionadas =
    rows.length > 0 && rows.every((o) => sel.has(o.ordenId));
  const algunaVisibleSeleccionada = rows.some((o) => sel.has(o.ordenId));

  const guardarSeleccion = (filas: OrdenFacturable[]) =>
    setCacheSeleccion((prev) => {
      const next = new Map(prev);
      filas.forEach((o) => next.set(o.ordenId, o));
      return next;
    });
  const navegarPagina = (pagina: number, busqueda = initialQ) => {
    const params = new URLSearchParams(parametrosFacturacion(initialFiltros));
    params.set("pagina", String(pagina));
    if (busqueda.trim()) params.set("q", busqueda.trim());
    iniciarFiltro(() =>
      router.replace(`/administracion/facturacion?${params}`, {
        scroll: false,
      }),
    );
  };
  const toggle = (id: string) => {
    if (!sel.has(id) && sel.size >= 100) {
      toast.info("Podés seleccionar hasta 100 órdenes por lote.");
      return;
    }
    guardarSeleccion(data.filter((o) => o.ordenId === id));
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTodasVisibles = () => {
    guardarSeleccion(rows);
    setSel((prev) => {
      const next = new Set(prev);
      if (todasVisiblesSeleccionadas) {
        rows.forEach((o) => next.delete(o.ordenId));
      } else {
        rows.forEach((o) => {
          if (next.size < 100) next.add(o.ordenId);
        });
        if (rows.some((o) => !next.has(o.ordenId)))
          toast.info("Podés seleccionar hasta 100 órdenes por lote.");
      }
      return next;
    });
  };

  const prepararEmision = () => {
    if (
      !puedeGestionar ||
      seleccionadas.length === 0 ||
      emisionEnCurso.current ||
      cargandoFiltros
    )
      return;
    claveSolicitud.current = crypto.randomUUID();
    setConfirmacion({
      ordenes: seleccionadas.map(
        ({ ordenId, numero, clienteNombre, saldoSinFacturar }) => ({
          ordenId,
          numero,
          clienteNombre,
          saldoSinFacturar,
        }),
      ),
      modo: puedeAgrupar ? modo : "por_orden",
      detalle:
        puedeAgrupar && modo === "agrupada" ? detalleAgrupada : detallePorOrden,
    });
  };

  const cancelarEmision = () => {
    if (!emisionEnCurso.current) setConfirmacion(null);
  };

  const facturar = async () => {
    if (
      !puedeGestionar ||
      !confirmacion?.ordenes.length ||
      emisionEnCurso.current
    )
      return;
    const modoFinal = confirmacion.modo;
    emisionEnCurso.current = true;
    setFacturando(true);
    try {
      await facturarLote({
        claveSolicitud:
          claveSolicitud.current ??
          (claveSolicitud.current = crypto.randomUUID()),
        ordenIds: confirmacion.ordenes.map((o) => o.ordenId),
        modo: modoFinal,
        detalle: confirmacion.detalle,
      });
      setConfirmacion(null);
      setSel(new Set());
      setRevisionLotes((v) => v + 1);
      toast.success(
        "Lote recibido. Podés seguir trabajando; te avisaremos en la campanita al terminar.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo facturar.");
    } finally {
      emisionEnCurso.current = false;
      setFacturando(false);
    }
  };

  const modoFinal = puedeAgrupar ? modo : "por_orden";
  const cantidadFacturas = modoFinal === "agrupada" ? 1 : seleccionadas.length;
  const ocultas = seleccionadas.filter(
    (o) => !rows.some((r) => r.ordenId === o.ordenId),
  ).length;
  const cantidadClientes =
    paginacion?.resumen.clientes ??
    new Set(data.map((o) => o.clienteId ?? "CF")).size;

  return (
    <section {...scope} className={`${theme} ${listPage.page} ${s.page}`}>
      <header className={listPage.header}>
        <div>
          <p className={s.eyebrow}>Administración · Emisión de facturas</p>
          <h1>
            Facturación<span className={s.dot}>.</span>
          </h1>
          <p className={listPage.subtitle}>
            De la orden al comprobante. Facturá trabajos finalizados, de forma
            individual o en lote.
          </p>
        </div>
        <div className={s.headerActions}>
          <ActionLink
            variant="outline"
            href="/administracion/facturacion/lotes"
          >
            Historial de lotes
          </ActionLink>
          <ActionLink variant="outline" href="/administracion/comprobantes">
            Ver comprobantes <ArrowUpRightIcon aria-hidden />
          </ActionLink>
        </div>
      </header>
      <FacturacionLotes revision={revisionLotes} />

      <div className={s.metrics} aria-label="Resumen de facturación">
        <div className={s.totalMetric}>
          <ListMetric
            label="Importe sin facturar"
            value={fmt(totalPendiente)}
            hint={
              filtrosActivos
                ? "Importe del listado filtrado, con IVA."
                : "Importe pendiente del listado, con IVA."
            }
            icon={ReceiptTextIcon}
          />
        </div>
        <ListMetric
          label="Órdenes pendientes"
          value={paginacion?.total ?? data.length}
          hint={
            filtrosActivos
              ? "Órdenes que coinciden con los filtros."
              : "Finalizadas o entregadas con importe sin facturar."
          }
          icon={ListChecksIcon}
        />
        <ListMetric
          label="Clientes"
          value={cantidadClientes}
          hint="Clientes de las órdenes del listado."
          icon={UsersRoundIcon}
        />
      </div>

      <div className={s.workspace} data-readonly={!puedeGestionar || undefined}>
        <div className={s.main}>
          <Card className={s.card}>
            <Card.Header className={s.cardHeader}>
              <span className={s.sectionIcon}>
                <FilesIcon aria-hidden />
              </span>
              <div>
                <Card.Title>Órdenes para facturar</Card.Title>
                <Card.Description>
                  El importe sin facturar es independiente de lo cobrado.
                </Card.Description>
              </div>
            </Card.Header>
            <form
              className={s.toolbar}
              onSubmit={(e) => {
                e.preventDefault();
                if (paginacion) {
                  setSel(new Set());
                  navegarPagina(1, q);
                }
              }}
            >
              <SearchField
                aria-label="Buscar orden o cliente"
                value={q}
                onChange={setQ}
                className={s.search}
              >
                <SearchField.Group className={focus.singleBorder}>
                  <SearchField.SearchIcon />
                  <SearchField.Input
                    maxLength={200}
                    placeholder="Número de orden o cliente…"
                  />
                  <SearchField.ClearButton aria-label="Limpiar búsqueda" />
                </SearchField.Group>
              </SearchField>
              {paginacion && (
                <ActionButton
                  type="submit"
                  variant="outline"
                  isDisabled={facturando}
                  isPending={cargandoFiltros}
                >
                  Buscar
                </ActionButton>
              )}
              <ActionButton
                variant="outline"
                aria-expanded={filtrosAbiertos}
                aria-controls={`${filtroId}-panel`}
                onPress={() => setFiltrosAbiertos(!filtrosAbiertos)}
              >
                <ListFilterIcon aria-hidden /> Filtros
                {filtrosActivos ? " activos" : ""}
              </ActionButton>
              {filtrosActivos && (
                <ActionButton
                  variant="ghost"
                  onPress={() => navegarFiltros({})}
                  isDisabled={facturando || cargandoFiltros}
                >
                  <XIcon aria-hidden /> Limpiar filtros
                </ActionButton>
              )}
              <span className={s.count}>
                {rows.length} de {paginacion?.total ?? data.length} órdenes
              </span>
            </form>
            {filtrosActivos && (
              <p className={s.filterSummary} role="status">
                {initialFiltros.cobro
                  ? "Sin facturar · cobradas al 100%. "
                  : "Todos los cobros. "}
                {initialFiltros.emisionDesde &&
                  `Emisión desde ${fechaComprobante(initialFiltros.emisionDesde)}. `}
                {initialFiltros.emisionHasta &&
                  `Emisión hasta ${fechaComprobante(initialFiltros.emisionHasta)}.`}
              </p>
            )}
            {filtrosAbiertos && (
              <form
                id={`${filtroId}-panel`}
                aria-label="Filtros de facturación"
                className={s.filters}
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!rangoInvalido && !facturando) navegarFiltros(filtros);
                }}
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel id={`${filtroId}-cobro`}>
                      Cobro de la orden
                    </FieldLabel>
                    <SegmentedControl
                      aria-labelledby={`${filtroId}-cobro`}
                      value={filtros.cobro ?? "todas"}
                      isDisabled={facturando || cargandoFiltros}
                      options={[
                        {
                          value: "todas",
                          label: "Todas las pendientes",
                          icon: null,
                        },
                        {
                          value: "cobradas_sin_facturar",
                          label: "Sin facturar · cobradas al 100%",
                          icon: null,
                        },
                      ]}
                      onChange={(value) =>
                        setFiltros({
                          ...filtros,
                          cobro:
                            value === "cobradas_sin_facturar"
                              ? value
                              : undefined,
                        })
                      }
                    />
                  </Field>
                  <FieldGroup className={s.dateFilters}>
                    <Field data-invalid={rangoInvalido}>
                      <FieldLabel htmlFor={`${filtroId}-desde`}>
                        Emisión de OT · desde
                      </FieldLabel>
                      <Input
                        id={`${filtroId}-desde`}
                        type="date"
                        value={filtros.emisionDesde ?? ""}
                        max={filtros.emisionHasta || undefined}
                        disabled={facturando || cargandoFiltros}
                        className={focus.singleBorder}
                        aria-invalid={rangoInvalido}
                        aria-describedby={
                          rangoInvalido ? `${filtroId}-error` : undefined
                        }
                        onChange={(event) =>
                          setFiltros({
                            ...filtros,
                            emisionDesde: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field data-invalid={rangoInvalido}>
                      <FieldLabel htmlFor={`${filtroId}-hasta`}>
                        Emisión de OT · hasta
                      </FieldLabel>
                      <Input
                        id={`${filtroId}-hasta`}
                        type="date"
                        value={filtros.emisionHasta ?? ""}
                        min={filtros.emisionDesde || undefined}
                        disabled={facturando || cargandoFiltros}
                        className={focus.singleBorder}
                        aria-invalid={rangoInvalido}
                        aria-describedby={
                          rangoInvalido ? `${filtroId}-error` : undefined
                        }
                        onChange={(event) =>
                          setFiltros({
                            ...filtros,
                            emisionHasta: event.target.value,
                          })
                        }
                      />
                    </Field>
                  </FieldGroup>
                  {rangoInvalido && (
                    <FieldError id={`${filtroId}-error`}>
                      La fecha desde no puede ser posterior a la fecha hasta.
                    </FieldError>
                  )}
                </FieldGroup>
                <div className={s.filterActions}>
                  <p>
                    Ambas fechas se incluyen. Al aplicar se limpia la selección
                    de órdenes.
                  </p>
                  <ActionButton
                    type="submit"
                    isPending={cargandoFiltros}
                    isDisabled={facturando || rangoInvalido}
                  >
                    Aplicar filtros
                  </ActionButton>
                </div>
              </form>
            )}
            {rows.length > 0 ? (
              <Table
                className={s.table}
                aria-label="Órdenes pendientes de facturación"
              >
                <TableHeader>
                  <TableRow>
                    {puedeGestionar && (
                      <TableHead className={s.checkCell}>
                        <Checkbox
                          aria-label="Seleccionar todas las órdenes visibles"
                          isSelected={todasVisiblesSeleccionadas}
                          isIndeterminate={
                            algunaVisibleSeleccionada &&
                            !todasVisiblesSeleccionadas
                          }
                          isDisabled={facturando || cargandoFiltros}
                          onChange={toggleTodasVisibles}
                        >
                          <Checkbox.Content>
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                          </Checkbox.Content>
                        </Checkbox>
                      </TableHead>
                    )}
                    <TableHead>Orden</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Emisión / finalización</TableHead>
                    <TableHead className={s.number}>Total</TableHead>
                    <TableHead className={s.number}>Facturado</TableHead>
                    <TableHead className={s.number}>Cobrado</TableHead>
                    <TableHead className={s.number}>Sin facturar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((o) => (
                    <TableRow
                      key={o.ordenId}
                      data-selected={sel.has(o.ordenId) || undefined}
                      onClick={() => {
                        if (puedeGestionar && !facturando) toggle(o.ordenId);
                      }}
                    >
                      {puedeGestionar && (
                        <TableCell
                          className={s.checkCell}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            aria-label={`Seleccionar ${o.numero}`}
                            isSelected={sel.has(o.ordenId)}
                            isDisabled={facturando || cargandoFiltros}
                            onChange={() => toggle(o.ordenId)}
                          >
                            <Checkbox.Content>
                              <Checkbox.Control>
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                            </Checkbox.Content>
                          </Checkbox>
                        </TableCell>
                      )}
                      <TableCell>
                        <Link
                          className={s.orderLink}
                          href={`/produccion/ordenes/${o.ordenId}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {o.numero}
                          <ArrowUpRightIcon aria-hidden />
                        </Link>
                        <Chip size="sm" variant="soft" className={s.status}>
                          {o.estado === "entregada"
                            ? "Entregada"
                            : o.estado === "finalizada"
                              ? "Finalizada"
                              : o.estado}
                        </Chip>
                      </TableCell>
                      <TableCell className={s.client}>
                        {o.clienteNombre ?? "Mostrador / sin cliente"}
                      </TableCell>
                      <TableCell className={s.date}>
                        <span>
                          {o.fechaEmision
                            ? fechaNumerica(o.fechaEmision)
                            : "Sin fecha de emisión"}
                        </span>
                        <small>
                          Finalizada: {fechaComprobante(o.fechaFinalizada)}
                        </small>
                      </TableCell>
                      <TableCell className={s.number}>{fmt(o.total)}</TableCell>
                      <TableCell className={s.number}>
                        {o.facturado > 0 ? fmt(o.facturado) : "—"}
                      </TableCell>
                      <TableCell className={`${s.number} ${s.collected}`}>
                        {o.cobrado > 0 ? fmt(o.cobrado) : "—"}
                      </TableCell>
                      <TableCell className={`${s.number} ${s.pending}`}>
                        {fmt(o.saldoSinFacturar)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty className={s.empty}>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    {data.length || filtrosActivos ? (
                      <SearchXIcon />
                    ) : (
                      <CheckCheckIcon />
                    )}
                  </EmptyMedia>
                  <EmptyTitle>
                    {data.length || filtrosActivos
                      ? "No encontramos órdenes con esos filtros"
                      : "La facturación está al día"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {data.length || filtrosActivos
                      ? "Cambiá la búsqueda, el cobro o las fechas, o limpiá los filtros."
                      : "Acá aparecen las órdenes finalizadas o entregadas que todavía tienen importe sin facturar."}
                  </EmptyDescription>
                </EmptyHeader>
                {q && (
                  <ActionButton variant="outline" onPress={() => setQ("")}>
                    Limpiar búsqueda
                  </ActionButton>
                )}
              </Empty>
            )}
            {paginacion && (
              <div aria-busy={cargandoFiltros}>
                {cargandoFiltros && (
                  <p role="status" className={s.filterSummary}>
                    Cargando órdenes…
                  </p>
                )}
                <TablePagination
                  disabled={cargandoFiltros || facturando}
                  total={paginacion.total}
                  page={paginacion.pagina}
                  pageSize={paginacion.tamanoPagina}
                  onPageChange={(p) => {
                    if (!cargandoFiltros && !facturando) navegarPagina(p);
                  }}
                />
                <p className={s.filterSummary}>
                  La selección se conserva entre páginas, hasta 100 órdenes por
                  lote. Buscar o aplicar filtros la limpia.
                </p>
              </div>
            )}
          </Card>
          <p className={s.caption}>
            <InfoIcon aria-hidden />
            Una orden puede estar cobrada y seguir sin facturar. Para consultar
            la deuda del cliente, usá{" "}
            <Link href="/administracion/deudores">
              Cuentas por cobrar <ArrowUpRightIcon aria-hidden />
            </Link>
            .
          </p>
        </div>

        {puedeGestionar && (
          <aside className={s.aside} aria-label="Preparar facturación">
            <Card className={s.card}>
              <Card.Header className={s.selectionHeader}>
                <span className={s.sectionIcon}>
                  <ReceiptTextIcon aria-hidden />
                </span>
                <div>
                  <Card.Title>Preparar facturación</Card.Title>
                  <Card.Description>Selección de órdenes</Card.Description>
                </div>
              </Card.Header>
              <Card.Content className={s.selectionBody}>
                {seleccionadas.length === 0 ? (
                  <div className={s.selectionEmpty}>
                    <span className={s.selectionMark}>
                      <ListChecksIcon aria-hidden />
                    </span>
                    <strong>Elegí las órdenes</strong>
                    <p>
                      Marcalas en la tabla para ver el importe y definir cómo
                      facturarlas.
                    </p>
                    <small>
                      Si son del mismo cliente, podés reunirlas en una sola
                      factura.
                    </small>
                  </div>
                ) : (
                  <>
                    <div className={s.selectedHeading}>
                      <span>
                        {seleccionadas.length}{" "}
                        {seleccionadas.length === 1
                          ? "orden seleccionada"
                          : "órdenes seleccionadas"}
                      </span>
                      <ActionButton
                        variant="ghost"
                        isIconOnly
                        aria-label="Limpiar selección"
                        onPress={() => setSel(new Set())}
                        isDisabled={facturando}
                      >
                        <XIcon aria-hidden />
                      </ActionButton>
                    </div>
                    <ul
                      className={s.selectedOrders}
                      aria-label="Órdenes seleccionadas"
                    >
                      {seleccionadas.map((o) => (
                        <li key={o.ordenId}>
                          <span>
                            <strong>{o.numero}</strong>
                            <small>
                              {o.clienteNombre ?? "Mostrador / sin cliente"}
                            </small>
                          </span>
                          <span>{fmt(o.saldoSinFacturar)}</span>
                        </li>
                      ))}
                    </ul>
                    {ocultas > 0 && (
                      <p className={s.selectionHint}>
                        {ocultas}{" "}
                        {ocultas === 1
                          ? "orden seleccionada no coincide"
                          : "órdenes seleccionadas no coinciden"}{" "}
                        con la búsqueda actual.
                      </p>
                    )}
                    <div className={s.mode}>
                      <span className={s.eyebrow}>Cómo facturar</span>
                      {puedeAgrupar ? (
                        <SegmentedControl
                          aria-label="Modo de facturación"
                          tone="graphite"
                          value={modo}
                          onChange={(v) =>
                            setModo(v as "por_orden" | "agrupada")
                          }
                          isDisabled={facturando}
                          options={[
                            {
                              value: "por_orden",
                              label: "Por orden",
                              icon: <FilesIcon />,
                            },
                            {
                              value: "agrupada",
                              label: "Agrupada",
                              icon: <FileStackIcon />,
                            },
                          ]}
                        />
                      ) : (
                        <strong>Una factura por orden</strong>
                      )}
                      <p>
                        {modoFinal === "agrupada"
                          ? "Una sola factura para el mismo cliente, con el detalle que elijas."
                          : seleccionadas.length > 1 && !puedeAgrupar
                            ? "Las órdenes son de clientes distintos. Se emite una factura para cada orden."
                            : "Cada orden tendrá su propio comprobante por el importe que falta facturar."}
                      </p>
                    </div>
                    <FacturaDetalleSelector
                      value={
                        modoFinal === "agrupada"
                          ? detalleAgrupada
                          : detallePorOrden
                      }
                      onChange={
                        modoFinal === "agrupada"
                          ? setDetalleAgrupada
                          : setDetallePorOrden
                      }
                      disabled={facturando}
                    />
                    <dl className={s.selectionTotal}>
                      <div>
                        <dt>Facturas a emitir</dt>
                        <dd>{cantidadFacturas}</dd>
                      </div>
                      <div>
                        <dt>Total a facturar</dt>
                        <dd>{fmt(totalSel)}</dd>
                      </div>
                    </dl>
                  </>
                )}
              </Card.Content>
              {seleccionadas.length > 0 && (
                <Card.Footer className={s.selectionFooter}>
                  <ActionButton
                    onPress={prepararEmision}
                    isPending={facturando}
                    isDisabled={facturando}
                  >
                    <ReceiptTextIcon aria-hidden />
                    {facturando
                      ? "Registrando…"
                      : cantidadFacturas === 1
                        ? "Emitir factura"
                        : `Emitir ${cantidadFacturas} facturas`}
                    <ArrowUpRightIcon aria-hidden />
                  </ActionButton>
                  <p aria-live="polite">
                    {facturando
                      ? "Registrando el lote para procesarlo en segundo plano."
                      : "Revisá el resumen y confirmá antes de emitir."}
                  </p>
                </Card.Footer>
              )}
            </Card>
          </aside>
        )}
      </div>
      {confirmacion && puedeGestionar && (
        <FacturacionConfirmacion
          lote={confirmacion}
          enviando={facturando}
          onCancelar={cancelarEmision}
          onConfirmar={() => void facturar()}
        />
      )}
    </section>
  );
}
