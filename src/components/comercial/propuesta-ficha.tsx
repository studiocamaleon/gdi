"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  BriefcaseBusinessIcon,
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  CreditCardIcon,
  Edit3Icon,
  ExternalLinkIcon,
  FactoryIcon,
  FileIcon,
  FolderIcon,
  PackageIcon,
  PlusIcon,
  SaveIcon,
  SearchIcon,
  SquareIcon,
  StarIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import type { ClienteDetalle } from "@/lib/clientes";
import type { CurrentUser } from "@/lib/auth";
import type {
  CargoDirectoCatalogo,
  ProductoListItem,
} from "@/lib/productos-servicios";
import {
  cotizar,
  recotizarCotizacionItem,
  type NestingViewerInput,
} from "@/lib/productos-servicios-api";
import {
  calcularCostoTotal,
  calcularResumen,
  CANALES_VENTA,
  formatCurrency,
  formatUnidad,
  offsetDate,
  type CotizacionPropuestaSnapshot,
  type PropuestaCargoDirecto,
  type PropuestaItem,
  type TipoPropuesta,
} from "@/lib/propuestas";
import { AgregarProductoSheet } from "@/components/comercial/agregar-producto-sheet";
import { NestingViewer } from "@/components/nesting/nesting-viewer";
import { listClientes } from "@/lib/clientes-api";
import { getCurrentPeriodo } from "@/lib/costos";
import { technologyCodeLabel } from "@/lib/maquinaria-tecnologias";

type PropuestaFichaProps = {
  initialClientes: ClienteDetalle[];
  initialProductos: ProductoListItem[];
  initialCargosDirectos: CargoDirectoCatalogo[];
  currentUser: CurrentUser | null;
};

type OrdenTab = "productos" | "produccion" | "pagos" | "archivos" | "costos";
type InnerTab = "specs" | "costos" | "produccion";
type PasoCosteo = CotizacionPropuestaSnapshot["pasos"][number];
type MaterialCosteo = NonNullable<PasoCosteo["materiales"]>[number];
type CargoPasoCosteo = NonNullable<PasoCosteo["cargosDirectosPaso"]>[number];
type CotizacionExitosa = CotizacionPropuestaSnapshot;
type PanelEditorPaso = PasoCosteo & { nestingResult: NestingViewerInput };
type PanelManualLayout = {
  items: PanelLayoutItem[];
};
type PanelLayoutItem = {
  sourcePieceId: string;
  pieceWidthMm: number;
  pieceHeightMm: number;
  axis: "vertical" | "horizontal";
  panels: PanelLayoutPanel[];
};
type PanelLayoutPanel = {
  panelIndex: number;
  usefulWidthMm: number;
  usefulHeightMm: number;
  overlapStartMm: number;
  overlapEndMm: number;
  finalWidthMm: number;
  finalHeightMm: number;
};

const tipoMap: Record<TipoPropuesta, "orden" | "presupuesto"> = {
  orden_trabajo: "orden",
  presupuesto: "presupuesto",
};

function fromOrdenTipo(value: "orden" | "presupuesto"): TipoPropuesta {
  return value === "orden" ? "orden_trabajo" : "presupuesto";
}

function getCotizacionNeto(cotizacion: CotizacionExitosa) {
  return (
    cotizacion.desglosePrecio?.precioNetoTotal ??
    cotizacion.precio?.precioTotal ??
    cotizacion.costos.total
  );
}

function getCotizacionTotal(cotizacion: CotizacionExitosa) {
  return (
    cotizacion.desglosePrecio?.precioBrutoTotal ??
    cotizacion.precio?.precioTotal ??
    cotizacion.costos.total
  );
}

function getCotizacionUnitario(cotizacion: CotizacionExitosa) {
  return (
    cotizacion.desglosePrecio?.precioBrutoUnitario ??
    cotizacion.precio?.precioUnitario ??
    cotizacion.costos.unitario
  );
}

function getCotizacionImpuestos(cotizacion: CotizacionExitosa) {
  return cotizacion.desglosePrecio
    ? cotizacion.desglosePrecio.precioBrutoTotal -
        cotizacion.desglosePrecio.precioNetoTotal
    : 0;
}

function getCotizacionCantidadPrecio(
  cotizacion: CotizacionExitosa,
  itemCantidad: number,
) {
  return (
    cotizacion.cantidadComercialPricing ??
    cotizacion.cantidadEfectiva ??
    itemCantidad
  );
}

function getCotizacionPasos(cotizacion: CotizacionExitosa) {
  return cotizacion.pasos
    .filter((paso) => paso.activado)
    .map((paso) => ({
      nombre: paso.nombreVisible?.trim() || humanizeCodigo(paso.familiaCodigo),
      centroCosto: paso.tiempo ? "Producción" : "Proceso",
      minutos: paso.tiempo?.totalMin ?? 0,
      origen: "base" as const,
    }));
}

function getModoColorChannels(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const channels: Array<{ key: string; label: string; className: string }> = [];
  const push = (key: string, label: string, className: string) => {
    if (!channels.some((channel) => channel.key === key)) {
      channels.push({ key, label, className });
    }
  };

  if (normalized.includes("sin impresion")) {
    return channels;
  }
  if (
    normalized.includes("cmyk") ||
    normalized.includes("color") ||
    normalized.includes("cuatricrom")
  ) {
    push("c", "C", "cyan");
    push("m", "M", "magenta");
    push("y", "Y", "yellow");
    push("k", "K", "black");
  } else if (
    normalized.includes("blanco y negro") ||
    normalized.includes("byn") ||
    normalized.includes("b/n") ||
    normalized.includes("negro")
  ) {
    push("k", "K", "black");
  }
  if (normalized.includes("blanco")) {
    push("w", "W", "white");
  }
  if (normalized.includes("barniz") || normalized.includes("varnish")) {
    push("v", "V", "varnish");
  }

  return channels;
}

function ModoColorSpecValue({ value }: { value: string }) {
  const channels = getModoColorChannels(value);

  return (
    <div className="op-color-mode-value">
      {channels.length > 0 ? (
        <span className="op-color-dots" aria-hidden="true">
          {channels.map((channel) => (
            <span
              className={`op-color-dot ${channel.className}`}
              key={channel.key}
            >
              {channel.label}
            </span>
          ))}
        </span>
      ) : null}
      <span className="op-color-mode-text">{value}</span>
    </div>
  );
}

/** Valor de la spec "Caras" con el mismo ícono que el sheet (simple / doble faz). */
function CarasSpecValue({ value }: { value: string }) {
  const doble = normalizeSearchText(value).includes("doble");
  return (
    <span className="op-caras-value">
      {doble ? (
        <svg className="op-caras-ico" viewBox="0 0 26 26" fill="none" aria-hidden="true">
          <rect x="3" y="5" width="13" height="18" rx="2" fill="var(--surface,#fff)" stroke="var(--muted,#b8b6b1)" strokeWidth="1.5" />
          <rect x="10" y="3" width="13" height="18" rx="2" fill="var(--surface,#fff)" stroke="currentColor" strokeWidth="1.6" />
          <line x1="13" y1="8" x2="20" y2="8" stroke="currentColor" strokeWidth="1.4" />
          <line x1="13" y1="12" x2="20" y2="12" stroke="var(--muted,#b8b6b1)" strokeWidth="1.4" />
        </svg>
      ) : (
        <svg className="op-caras-ico" viewBox="0 0 26 26" fill="none" aria-hidden="true">
          <rect x="6" y="3" width="14" height="20" rx="2" fill="var(--surface,#fff)" stroke="currentColor" strokeWidth="1.6" />
          <line x1="9" y1="8" x2="17" y2="8" stroke="currentColor" strokeWidth="1.4" />
          <line x1="9" y1="12" x2="17" y2="12" stroke="var(--muted,#b8b6b1)" strokeWidth="1.4" />
          <line x1="9" y1="16" x2="14" y2="16" stroke="var(--muted,#b8b6b1)" strokeWidth="1.4" />
        </svg>
      )}
      <span>{value}</span>
    </span>
  );
}

function applyCotizacionToItem(
  item: PropuestaItem,
  cotizacion: CotizacionExitosa,
  jobContext: Record<string, unknown>,
): PropuestaItem {
  const subtotal = getCotizacionNeto(cotizacion);
  const impuestoMonto = getCotizacionImpuestos(cotizacion);
  const total = getCotizacionTotal(cotizacion);
  const impuestoPorcentaje =
    subtotal > 0 ? (impuestoMonto / subtotal) * 100 : 0;

  return {
    ...item,
    cantidad:
      cotizacion.cantidadComercialPricing ??
      cotizacion.cantidadEfectiva ??
      item.cantidad,
    precioUnitario: getCotizacionUnitario(cotizacion),
    subtotal,
    impuestoMonto,
    impuestoPorcentaje,
    total,
    cotizacion,
    pasos: getCotizacionPasos(cotizacion),
    jobContext,
    rutaAlternativaId: cotizacion.rutaAlternativaId ?? item.rutaAlternativaId,
  };
}

function parseLocalDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isPanelEditableStep(paso: PasoCosteo): paso is PanelEditorPaso {
  const nesting = paso.nestingResult;
  return (
    paso.familiaCodigo === "impresion_por_area" &&
    Boolean(nesting?.visualConfig?.panelizado?.enabled) &&
    (nesting?.algorithm === "shelf-rollo" ||
      nesting?.algorithm === "maxrects-rollo") &&
    nesting.placements.some((placement) => (placement.panelCount ?? 1) > 1)
  );
}

function getSourcePiecesFromJobContext(
  jobContext: Record<string, unknown> | undefined,
) {
  const piezas = Array.isArray(jobContext?.piezas)
    ? (jobContext.piezas as Array<{
        cantidad?: unknown;
        anchoMm?: unknown;
        altoMm?: unknown;
      }>)
    : [];
  return piezas.flatMap((pieza, medidaIndex) => {
    const cantidad = Math.max(1, Number(pieza.cantidad ?? 0) || 0);
    const anchoMm = Number(pieza.anchoMm ?? 0);
    const altoMm = Number(pieza.altoMm ?? 0);
    return Array.from({ length: cantidad }, (_, copyIndex) => ({
      sourcePieceId: `piece-${medidaIndex}-${copyIndex}`,
      pieceWidthMm: anchoMm,
      pieceHeightMm: altoMm,
    }));
  });
}

function getPanelAxis(nesting: NestingViewerInput): "vertical" | "horizontal" {
  const placementAxis = nesting.placements.find(
    (placement) => placement.panelAxis,
  )?.panelAxis;
  if (placementAxis === "horizontal") return "horizontal";
  if (placementAxis === "vertical") return "vertical";
  return nesting.visualConfig?.panelizado?.axis === "horizontal"
    ? "horizontal"
    : "vertical";
}

function inferSourcePieceId(pieceId: string) {
  const panelMatch = pieceId.match(/^(piece-\d+-\d+)(?:-panel-\d+)?$/);
  return panelMatch?.[1] ?? pieceId;
}

function buildPanelLayoutFromNesting(
  item: PropuestaItem,
  nesting: NestingViewerInput,
): PanelManualLayout | null {
  const sourcePieces = getSourcePiecesFromJobContext(item.jobContext);
  if (!sourcePieces.length) return null;
  const placementsBySource = new Map<
    string,
    NestingViewerInput["placements"]
  >();
  for (const placement of nesting.placements) {
    const sourcePieceId = inferSourcePieceId(placement.pieceId);
    const current = placementsBySource.get(sourcePieceId) ?? [];
    current.push(placement);
    placementsBySource.set(sourcePieceId, current);
  }
  const fallbackAxis = getPanelAxis(nesting);

  const items = sourcePieces.map((sourcePiece) => {
    const placements = (placementsBySource.get(sourcePiece.sourcePieceId) ?? [])
      .slice()
      .sort((a, b) => (a.panelIndex ?? 1) - (b.panelIndex ?? 1));
    const axis =
      placements.find((placement) => placement.panelAxis)?.panelAxis ??
      fallbackAxis;
    const panels =
      placements.length > 0
        ? placements.map((placement, index) =>
            buildPanelFromPlacement(sourcePiece, placement, axis, index),
          )
        : [buildFullPanel(sourcePiece)];

    return {
      sourcePieceId: sourcePiece.sourcePieceId,
      pieceWidthMm: sourcePiece.pieceWidthMm,
      pieceHeightMm: sourcePiece.pieceHeightMm,
      axis,
      panels,
    };
  });

  return { items };
}

function buildFullPanel(sourcePiece: {
  pieceWidthMm: number;
  pieceHeightMm: number;
}): PanelLayoutPanel {
  return {
    panelIndex: 1,
    usefulWidthMm: sourcePiece.pieceWidthMm,
    usefulHeightMm: sourcePiece.pieceHeightMm,
    overlapStartMm: 0,
    overlapEndMm: 0,
    finalWidthMm: sourcePiece.pieceWidthMm,
    finalHeightMm: sourcePiece.pieceHeightMm,
  };
}

function buildPanelFromPlacement(
  sourcePiece: { pieceWidthMm: number; pieceHeightMm: number },
  placement: NestingViewerInput["placements"][number],
  axis: "vertical" | "horizontal",
  index: number,
): PanelLayoutPanel {
  const overlapStartMm = Number(placement.overlapStartMm ?? 0);
  const overlapEndMm = Number(placement.overlapEndMm ?? 0);
  const usefulWidthMm =
    axis === "vertical"
      ? Number(
          placement.usefulWidthMm ??
            placement.widthMm - overlapStartMm - overlapEndMm,
        )
      : sourcePiece.pieceWidthMm;
  const usefulHeightMm =
    axis === "horizontal"
      ? Number(
          placement.usefulHeightMm ??
            placement.heightMm - overlapStartMm - overlapEndMm,
        )
      : sourcePiece.pieceHeightMm;

  return {
    panelIndex: placement.panelIndex ?? index + 1,
    usefulWidthMm: Math.max(1, Math.round(usefulWidthMm)),
    usefulHeightMm: Math.max(1, Math.round(usefulHeightMm)),
    overlapStartMm,
    overlapEndMm,
    finalWidthMm:
      axis === "vertical"
        ? Math.max(1, Math.round(usefulWidthMm + overlapStartMm + overlapEndMm))
        : sourcePiece.pieceWidthMm,
    finalHeightMm:
      axis === "horizontal"
        ? Math.max(
            1,
            Math.round(usefulHeightMm + overlapStartMm + overlapEndMm),
          )
        : sourcePiece.pieceHeightMm,
  };
}

function updateManualLayoutItemSizes(
  item: PanelLayoutItem,
  sizes: number[],
  overlapMm: number,
): PanelLayoutItem {
  const panels = sizes.map((size, index) => {
    const overlapStartMm = index === 0 ? 0 : overlapMm;
    const overlapEndMm = index === sizes.length - 1 ? 0 : overlapMm;
    return {
      panelIndex: index + 1,
      usefulWidthMm: item.axis === "vertical" ? size : item.pieceWidthMm,
      usefulHeightMm: item.axis === "horizontal" ? size : item.pieceHeightMm,
      overlapStartMm,
      overlapEndMm,
      finalWidthMm:
        item.axis === "vertical"
          ? size + overlapStartMm + overlapEndMm
          : item.pieceWidthMm,
      finalHeightMm:
        item.axis === "horizontal"
          ? size + overlapStartMm + overlapEndMm
          : item.pieceHeightMm,
    };
  });
  return { ...item, panels };
}

function removePanelRuntimeOverride(
  jobContext: Record<string, unknown>,
  configPasoId: string,
) {
  const next = structuredClone(jobContext) as Record<string, unknown>;
  const runtime =
    typeof next.configPasoRuntime === "object" &&
    next.configPasoRuntime !== null &&
    !Array.isArray(next.configPasoRuntime)
      ? ({ ...(next.configPasoRuntime as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : {};
  const stepRuntime =
    typeof runtime[configPasoId] === "object" &&
    runtime[configPasoId] !== null &&
    !Array.isArray(runtime[configPasoId])
      ? ({ ...(runtime[configPasoId] as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : {};
  const nestingConfig =
    typeof stepRuntime.nestingConfig === "object" &&
    stepRuntime.nestingConfig !== null &&
    !Array.isArray(stepRuntime.nestingConfig)
      ? ({
          ...(stepRuntime.nestingConfig as Record<string, unknown>),
        } as Record<string, unknown>)
      : {};
  delete nestingConfig.panelizado;
  stepRuntime.nestingConfig = nestingConfig;
  runtime[configPasoId] = stepRuntime;
  next.configPasoRuntime = runtime;
  return next;
}

function applyPanelRuntimeOverride(args: {
  jobContext: Record<string, unknown>;
  configPasoId: string;
  nesting: NestingViewerInput;
  layout: PanelManualLayout;
}) {
  const next = structuredClone(args.jobContext) as Record<string, unknown>;
  const runtime =
    typeof next.configPasoRuntime === "object" &&
    next.configPasoRuntime !== null &&
    !Array.isArray(next.configPasoRuntime)
      ? ({ ...(next.configPasoRuntime as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : {};
  const stepRuntime =
    typeof runtime[args.configPasoId] === "object" &&
    runtime[args.configPasoId] !== null &&
    !Array.isArray(runtime[args.configPasoId])
      ? ({
          ...(runtime[args.configPasoId] as Record<string, unknown>),
        } as Record<string, unknown>)
      : {};
  const nestingConfig =
    typeof stepRuntime.nestingConfig === "object" &&
    stepRuntime.nestingConfig !== null &&
    !Array.isArray(stepRuntime.nestingConfig)
      ? ({
          ...(stepRuntime.nestingConfig as Record<string, unknown>),
        } as Record<string, unknown>)
      : {};
  const panelizado = args.nesting.visualConfig?.panelizado;
  const axis =
    args.layout.items.find((item) => item.panels.length > 1)?.axis ??
    "vertical";
  nestingConfig.panelizado = {
    enabled: true,
    mode: "manual",
    axis,
    overlapMm: panelizado?.overlapMm ?? 0,
    maxPanelWidthMm:
      panelizado?.maxPanelWidthMm ??
      args.nesting.visualConfig?.usableArea.widthMm ??
      null,
    distribution: panelizado?.distribution ?? "equilibrada",
    widthInterpretation: panelizado?.widthInterpretation ?? "total",
    manualLayout: args.layout,
  };
  stepRuntime.nestingConfig = nestingConfig;
  runtime[args.configPasoId] = stepRuntime;
  next.configPasoRuntime = runtime;
  return next;
}

function formatPlazoEntrega(fechaEstimada: string, fechaCreacion: string) {
  const estimated = parseLocalDate(fechaEstimada);
  const created = parseLocalDate(fechaCreacion);
  if (!estimated || !created) return "A definir";

  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.max(
    0,
    Math.ceil((estimated.getTime() - created.getTime()) / dayMs),
  );
  if (days === 0) return "Hoy";
  if (days === 1) return "1 dia";
  return `${days} dias`;
}

function OrdenSegmented({
  value,
  onChange,
}: {
  value: "orden" | "presupuesto";
  onChange: (value: "orden" | "presupuesto") => void;
}) {
  return (
    <div className="orden-toggle">
      <button
        type="button"
        className={`oseg ${value === "orden" ? "on" : ""}`}
        onClick={() => onChange("orden")}
      >
        <SquareIcon />
        Orden de trabajo
      </button>
      <button
        type="button"
        className={`oseg ${value === "presupuesto" ? "on" : ""}`}
        onClick={() => onChange("presupuesto")}
      >
        <FileIcon />
        Presupuesto
      </button>
    </div>
  );
}

function OrdenTabs({
  value,
  onChange,
  count,
}: {
  value: OrdenTab;
  onChange: (value: OrdenTab) => void;
  count: number;
}) {
  const tabs: Array<{
    key: OrdenTab;
    label: string;
    count?: number;
    icon: React.ReactNode;
  }> = [
    { key: "productos", label: "Productos", count, icon: <PackageIcon /> },
    { key: "produccion", label: "Produccion", icon: <FactoryIcon /> },
    { key: "pagos", label: "Pagos", icon: <CreditCardIcon /> },
    { key: "archivos", label: "Archivos", count: 2, icon: <FolderIcon /> },
    { key: "costos", label: "Costos", icon: <CircleDollarSignIcon /> },
  ];

  return (
    <div className="orden-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`otab ${value === tab.key ? "on" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          <span className="ic">{tab.icon}</span>
          <span>{tab.label}</span>
          {tab.count != null ? <span className="ct">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

function FieldCard({
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
      <div className="ofield-ctrl">{children}</div>
      {hint ? <div className="ofield-hint">{hint}</div> : null}
    </div>
  );
}

function normalizeClienteQuery(value: string) {
  return value.trim().toLowerCase();
}

function sortClientesByName(clientes: ClienteDetalle[]) {
  return [...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function mergeClientes(current: ClienteDetalle[], incoming: ClienteDetalle[]) {
  const map = new Map<string, ClienteDetalle>();
  for (const cliente of [...current, ...incoming]) {
    map.set(cliente.id, cliente);
  }
  return sortClientesByName([...map.values()]);
}

function ClienteCombobox({
  value,
  onChange,
  initialClientes,
}: {
  value: string;
  onChange: (value: string) => void;
  initialClientes: ClienteDetalle[];
}) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState(() =>
    sortClientesByName(initialClientes),
  );
  const [total, setTotal] = React.useState(initialClientes.length);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = React.useState("");

  const selectedCliente = React.useMemo(
    () => options.find((cliente) => cliente.id === value) ?? null,
    [options, value],
  );

  const visibleOptions = React.useMemo(() => {
    const normalized = normalizeClienteQuery(query);
    if (!normalized) return options;
    return options.filter((cliente) => {
      const haystack = [
        cliente.nombre,
        cliente.razonSocial,
        cliente.email,
        cliente.contacto,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [options, query]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  React.useEffect(() => {
    setOptions((current) => mergeClientes(current, initialClientes));
    setTotal((current) => Math.max(current, initialClientes.length));
  }, [initialClientes]);

  React.useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => inputRef.current?.focus(), 0);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    setLoading(true);
    setError(null);

    listClientes({ q: debouncedQuery, limit: 30 })
      .then((response) => {
        if (cancelled) return;
        setOptions((current) => mergeClientes(current, response.data));
        setTotal(response.total);
      })
      .catch(() => {
        if (cancelled) return;
        setError("No se pudieron cargar clientes.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open]);

  const selectCliente = (cliente: ClienteDetalle) => {
    setOptions((current) => mergeClientes(current, [cliente]));
    onChange(cliente.id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="cliente-combobox" ref={rootRef}>
      <button
        type="button"
        className="cliente-combobox-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selectedCliente ? "" : "placeholder"}>
          {selectedCliente?.nombre ?? "Seleccionar cliente"}
        </span>
        <ChevronRightIcon />
      </button>

      {open ? (
        <div className="cliente-combobox-popover">
          <div className="cliente-combobox-search">
            <SearchIcon />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre, razón social o email..."
              aria-label="Buscar cliente"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpiar búsqueda"
              >
                <XIcon />
              </button>
            ) : null}
          </div>

          <div className="cliente-combobox-results" role="listbox">
            {visibleOptions.map((cliente) => (
              <button
                key={cliente.id}
                type="button"
                className={`cliente-option ${cliente.id === value ? "selected" : ""}`}
                role="option"
                aria-selected={cliente.id === value}
                onClick={() => selectCliente(cliente)}
              >
                <span className="cliente-option-main">
                  <strong>{cliente.nombre}</strong>
                  <small>
                    {[cliente.razonSocial, cliente.email]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos adicionales"}
                  </small>
                </span>
                {cliente.id === value ? <CheckIcon /> : null}
              </button>
            ))}

            {!loading && visibleOptions.length === 0 ? (
              <div className="cliente-combobox-empty">
                No encontramos clientes con esa búsqueda.
              </div>
            ) : null}
          </div>

          <div className="cliente-combobox-foot">
            <span>
              {loading
                ? "Buscando clientes..."
                : `Mostrando ${Math.min(visibleOptions.length, total)} de ${total}`}
            </span>
            {error ? <span className="error">{error}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CanalVentaSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const selected = CANALES_VENTA.find((canal) => canal.value === value);

  React.useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const selectCanal = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div className="cliente-combobox canal-combobox" ref={rootRef}>
      <button
        type="button"
        className="cliente-combobox-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label ?? "Seleccionar canal"}</span>
        <ChevronRightIcon />
      </button>

      {open ? (
        <div className="cliente-combobox-popover canal-combobox-popover">
          <div
            className="cliente-combobox-results canal-combobox-results"
            role="listbox"
          >
            {CANALES_VENTA.map((canal) => (
              <button
                key={canal.value}
                type="button"
                className={`cliente-option canal-option ${canal.value === value ? "selected" : ""}`}
                role="option"
                aria-selected={canal.value === value}
                onClick={() => selectCanal(canal.value)}
              >
                <span className="cliente-option-main">
                  <strong>{canal.label}</strong>
                </span>
                {canal.value === value ? <CheckIcon /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatCantidadItem(item: PropuestaItem) {
  const acceptsDecimals =
    item.unidadMedida === "m2" || item.unidadMedida === "metro_lineal";
  const maximumFractionDigits = acceptsDecimals ? 2 : 0;
  const minimumFractionDigits =
    acceptsDecimals && !Number.isInteger(item.cantidad) ? 2 : 0;

  return item.cantidad.toLocaleString("es-AR", {
    minimumFractionDigits,
    maximumFractionDigits,
  });
}

function isDuplicateModoColorSpec(item: PropuestaItem, key: string) {
  if (!["impresion", "impresion_color", "color"].includes(key)) return false;
  const value = item.especificaciones[key]?.trim().toLowerCase();
  const modoColor = item.especificaciones.modo_color?.trim().toLowerCase();
  return Boolean(value && modoColor && value === modoColor);
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function asDisplayText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function asDisplayNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatVariantNumber(value: number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function getAttrText(attrs: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asDisplayText(attrs[key]);
    if (value) return value;
  }
  return "";
}

function getAttrNumber(attrs: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asDisplayNumber(attrs[key]);
    if (value !== null) return value;
  }
  return null;
}

function getCommercialMaterialKind(material: MaterialCosteo) {
  const templateId = normalizeSearchText(material.materiaPrimaTemplateId ?? "");
  const tipoTecnico = normalizeSearchText(material.materiaPrimaTipoTecnico ?? "");
  const attrs = material.atributosVarianteJson ?? {};
  const combined = `${templateId} ${tipoTecnico}`;

  if (combined.includes("sustrato_hoja")) return "sustrato_hoja";
  if (combined.includes("laminado_film")) return "laminado_film";
  if (combined.includes("laminado_pouch")) return "laminado_pouch";
  if (combined.includes("vinilo_de_corte")) return "vinilo_de_corte";
  if (combined.includes("sustrato_rollo")) return "sustrato_rollo";
  if (combined.includes("sustrato_rigido")) return "sustrato_rigido";
  if (combined.includes("film_transferencia")) return "film_transferencia";
  if (combined.includes("papel_transferencia")) return "papel_transferencia";
  if (combined.includes("toner")) return "toner";
  if (combined.includes("tinta_impresion")) return "tinta_impresion";

  if (attrs.formatoComercial && (attrs.gramaje ?? attrs.gramajeGr)) {
    return "sustrato_hoja";
  }
  if ((attrs.micrones ?? attrs.espesorMicrones ?? attrs.espesor) && attrs.acabado) {
    return "laminado_film";
  }
  return "generico";
}

function getMaterialVariantParts(material: MaterialCosteo) {
  const attrs = material.atributosVarianteJson ?? {};
  const kind = getCommercialMaterialKind(material);
  const parts: string[] = [];
  const push = (value: string) => {
    if (value && !parts.some((part) => normalizeSearchText(part) === normalizeSearchText(value))) {
      parts.push(value);
    }
  };

  const gramaje = getAttrNumber(attrs, ["gramajeGr", "gramaje"]);
  const acabado = getAttrText(attrs, ["acabado"]);
  const color = getAttrText(attrs, ["color", "colorBase"]);
  const micrones = getAttrNumber(attrs, [
    "micrones",
    "espesorMicrones",
    "espesor",
  ]);

  if (kind === "sustrato_hoja") {
    if (gramaje !== null) push(`${formatVariantNumber(gramaje)} g/m²`);
    push(acabado);
    if (color && normalizeSearchText(color) !== "blanco") push(color);
  } else if (kind === "laminado_film" || kind === "laminado_pouch") {
    if (micrones !== null) push(`${formatVariantNumber(micrones)} mic`);
    push(acabado);
    push(getAttrText(attrs, ["adhesivoTipo"]));
  } else if (kind === "vinilo_de_corte") {
    push(getAttrText(attrs, ["tipoVinilo"]));
    push(color);
    push(acabado);
    push(getAttrText(attrs, ["adhesivoTipo"]));
  } else if (kind === "sustrato_rollo") {
    push(getAttrText(attrs, ["material", "tipoMaterial", "tipoVinilo"]));
    push(color);
    push(acabado);
  } else if (kind === "sustrato_rigido") {
    if (micrones !== null) push(`${formatVariantNumber(micrones)} mm`);
    push(color);
    push(getAttrText(attrs, ["material"]));
  } else if (kind === "film_transferencia") {
    push(technologyCodeLabel(getAttrText(attrs, ["tecnologiaCompatible"])));
    if (micrones !== null) push(`${formatVariantNumber(micrones)} mic`);
  } else if (kind === "papel_transferencia") {
    if (gramaje !== null) push(`${formatVariantNumber(gramaje)} g/m²`);
    push(getAttrText(attrs, ["ladoImprimible", "tecnologiaCompatible"]));
  } else if (kind === "toner" || kind === "tinta_impresion") {
    push(color);
    push(technologyCodeLabel(getAttrText(attrs, ["tecnologiaCompatible", "equipoCompatible"])));
  } else {
    const commercialKeys = [
      "material",
      "tipoMaterial",
      "gramaje",
      "gramajeGr",
      "espesor",
      "espesorMicrones",
      "micrones",
      "color",
      "colorBase",
      "acabado",
      "tipoVinilo",
      "adhesivoTipo",
    ];
    for (const key of commercialKeys) {
      const numberValue = asDisplayNumber(attrs[key]);
      if (numberValue !== null) {
        const suffix = key.toLowerCase().includes("gramaje")
          ? " g/m²"
          : key.toLowerCase().includes("mic")
            ? " mic"
            : "";
        push(`${formatVariantNumber(numberValue)}${suffix}`);
      } else {
        push(asDisplayText(attrs[key]));
      }
    }
  }

  if (parts.length === 0) {
    const fallback = material.materialDisplayName || material.materialNombre;
    if (fallback && fallback !== material.materialSku) push(fallback);
  }

  return parts;
}

function getMaterialVariantOnlyLabel(material: MaterialCosteo) {
  const parts = getMaterialVariantParts(material);
  return parts.length > 0
    ? parts.join(" · ")
    : material.materialDisplayName || material.materialNombre;
}

function getMaterialCommercialLabel(material: MaterialCosteo) {
  const attrs = material.atributosVarianteJson ?? {};
  const materialName =
    asDisplayText(attrs.material) ||
    material.materiaPrimaNombre?.trim() ||
    material.materialDisplayName?.trim() ||
    material.materialNombre;
  const normalizedName = normalizeSearchText(materialName);
  // Descartamos las partes de variante que ya están contenidas en el nombre
  // del material (ej. "Film DTF textil" ya dice "DTF textil"): evita el
  // "· DTF textil" redundante.
  const parts = getMaterialVariantParts(material).filter((part) => {
    const normalizedPart = normalizeSearchText(part);
    return normalizedPart.length > 0 && !normalizedName.includes(normalizedPart);
  });
  if (parts.length === 0) return materialName;
  return `${materialName} · ${parts.join(" · ")}`;
}

function getMainCommercialMaterial(item: PropuestaItem) {
  const materiales = item.cotizacion.pasos
    .filter((paso) => paso.activado)
    .flatMap((paso) =>
      (paso.materiales ?? []).map((material) => ({ paso, material })),
    )
    .filter(({ material }) => material.tipoLineaCosto === "MATERIAL");

  const preferred = materiales.find(({ paso, material }) => {
    const familia = normalizeSearchText(paso.familiaCodigo);
    const slot = normalizeSearchText(material.slotCodigo);
    return (
      familia.includes("impresion") &&
      ["sustrato", "papel", "pliego", "media", "material"].some((key) =>
        slot.includes(key),
      )
    );
  });

  return preferred?.material ?? materiales[0]?.material ?? null;
}

function isMaterialSpecKey(key: string, label: string) {
  const normalized = normalizeSearchText(`${key} ${label}`);
  return normalized === "material" || normalized.includes(" material");
}

function isEspesorSpecKey(key: string, label: string) {
  return normalizeSearchText(`${key} ${label}`).includes("espesor");
}

function isFazSpecKey(key: string, label: string) {
  const n = normalizeSearchText(`${key} ${label}`);
  return n.includes("caras") || n.includes("faz");
}

/**
 * Doble faz seleccionado al cotizar. `jobContext.caras === 2` solo ocurre en
 * productos que soportan doble faz (el selector solo aparece ahí), así que es
 * señal confiable. Devuelve 2 (doble faz), 1 (simple) o null si no aplica.
 */
function getCarasItem(item: PropuestaItem): number | null {
  const caras = Number((item.jobContext as Record<string, unknown> | undefined)?.caras);
  return caras === 2 ? 2 : caras === 1 ? 1 : null;
}

/**
 * Material del SUSTRATO sobre el que se monta el producto, cuando la ruta tiene
 * un paso de montaje sobre sustrato (`montaje_sobre_sustrato`). Es el segundo
 * material que compone el producto (ej. el PVC espumado bajo el vinilo). Se
 * muestra en su propio bloque "Montaje" para que quede claro sobre qué se monta
 * (hoy solo se veía su espesor suelto, sin decir de qué material).
 */
function getMontajeSustratoMaterial(item: PropuestaItem): MaterialCosteo | null {
  const montajePaso = item.cotizacion.pasos.find(
    (paso) =>
      paso.activado && paso.familiaCodigo === "montaje_sobre_sustrato",
  );
  if (!montajePaso) return null;
  const sustrato = (montajePaso.materiales ?? []).find((material) => {
    if (material.tipoLineaCosto !== "MATERIAL") return false;
    const rol = normalizeSearchText(material.slotRol ?? "");
    const slot = normalizeSearchText(material.slotCodigo ?? "");
    return rol.includes("sustrato") || slot.includes("sustrato");
  });
  return sustrato ?? null;
}

function getOptionalMaterialDetails(item: PropuestaItem, adicional: string) {
  const adicionalNorm = normalizeSearchText(adicional);
  const details = new Set<string>();

  for (const paso of item.cotizacion.pasos) {
    if (!paso.activado) continue;
    const pasoLabel = paso.nombreVisible?.trim() || humanizeCodigo(paso.familiaCodigo);
    const pasoNorm = normalizeSearchText(pasoLabel);
    if (!pasoNorm || (!pasoNorm.includes(adicionalNorm) && !adicionalNorm.includes(pasoNorm))) {
      continue;
    }
    for (const material of paso.materiales ?? []) {
      if (material.tipoLineaCosto !== "MATERIAL") continue;
      details.add(getMaterialVariantOnlyLabel(material));
    }
  }

  return Array.from(details).filter(Boolean);
}

function getComponentMaterialDetails(item: PropuestaItem) {
  const details = new Set<string>();
  for (const paso of item.cotizacion.pasos) {
    if (!paso.activado) continue;
    for (const material of paso.materiales ?? []) {
      if (
        material.tipoLineaCosto !== "MATERIAL" ||
        material.slotRol !== "COMPONENTE"
      ) {
        continue;
      }
      details.add(getMaterialCommercialLabel(material));
    }
  }
  return Array.from(details).filter(Boolean);
}

function formatCantidadCosto(value: number, unidad: string) {
  const unidadLabel = formatUnidadCosto(unidad, value);
  return `${value.toLocaleString("es-AR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  })} ${unidadLabel}`;
}

function formatCostoUnitarioMaterial(value: number, unidad: string) {
  const unidadLabel = formatUnidadCosto(unidad, 1);
  return unidadLabel
    ? `${formatCurrency(value)} / ${unidadLabel}`
    : formatCurrency(value);
}

function formatUnidadCosto(unidad: string, cantidad = 1) {
  const normalized = unidad.trim().toLowerCase();
  const isSingular = Math.abs(cantidad) === 1;
  const pluralizable: Record<string, { singular: string; plural: string }> = {
    gramo: { singular: "gramo", plural: "gramos" },
    hoja: { singular: "hoja", plural: "hojas" },
    pliego: { singular: "hoja", plural: "hojas" },
    rollo: { singular: "rollo", plural: "rollos" },
    caja: { singular: "caja", plural: "cajas" },
    pack: { singular: "pack", plural: "packs" },
    pieza: { singular: "pieza", plural: "piezas" },
  };
  const pluralized = pluralizable[normalized];
  if (pluralized) return isSingular ? pluralized.singular : pluralized.plural;

  const labels: Record<string, string> = {
    m_lineales: "ml",
    metro_lineal: "ml",
    metros_lineales: "ml",
    m2: "m²",
    m_2: "m²",
    unidad: "u.",
    unidades: "u.",
    pouches: "pouches",
  };
  return labels[normalized] ?? unidad;
}

function formatModoSeleccion(value: string) {
  const labels: Record<string, string> = {
    HARDCODED: "Base",
    COMERCIAL_ELIGE: "Comercial elige",
    MOTOR_ELIGE_AUTO: "Motor elige",
    MAQUINA_CONSUMIBLE: "Consumible",
  };
  return labels[value] ?? value;
}

function humanizeCodigo(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function nestingPasoKey(paso: PasoCosteo) {
  return `${paso.rutaPasoOrden}-${paso.familiaCodigo}-${paso.nestingResult?.algorithm ?? "nesting"}`;
}

function nestingTabLabel(result: NestingViewerInput | undefined) {
  const algorithm = result?.algorithm;
  const kind = result?.substrates[0]?.kind;
  if (algorithm === "grid-2d-single") return "Acomodado en pliego";
  if (algorithm === "grid-2d-multi") return "Acomodado multi-placa";
  if (algorithm === "packingsolver-rectangle") return "Acomodado en placa";
  if (algorithm === "maxrects-rollo") return "Acomodado en rollo";
  if (algorithm === "shelf-rollo") return "Acomodado en rollo";
  if (kind === "sheet") return "Acomodado en pliego";
  if (kind === "roll") return "Acomodado en rollo";
  if (kind === "board") return "Acomodado en placa";
  return "Acomodado";
}

function getCostBuckets(item: PropuestaItem) {
  return [
    {
      key: "materiales",
      label: "Materiales",
      amount: item.cotizacion.costos.materialesTotal,
    },
    {
      key: "centro-costo",
      label: "Centro de costo",
      amount: item.cotizacion.costos.tiempoTotal,
    },
    {
      key: "cargos",
      label: "Cargos directos",
      amount: item.cotizacion.costos.cargosDirectosTotal,
    },
  ].filter((bucket) => bucket.amount > 0);
}

function sumMaterialesPaso(paso: PasoCosteo) {
  return (paso.materiales ?? []).reduce(
    (acc, material) => acc + material.costoTotal,
    0,
  );
}

function sumCargosPaso(paso: PasoCosteo) {
  return (paso.cargosDirectosPaso ?? []).reduce(
    (acc, cargo) => acc + cargo.monto,
    0,
  );
}

function getVisibleCostSteps(pasos: PasoCosteo[]) {
  return pasos.filter((paso) => paso.activado || paso.costoTotal > 0);
}

function formatTiempoPaso(paso: PasoCosteo) {
  if (!paso.tiempo) return "-";
  return `${paso.tiempo.totalMin.toLocaleString("es-AR", {
    maximumFractionDigits: 1,
  })} min`;
}

function formatTarifaCentroCosto(paso: PasoCosteo) {
  if (!paso.tiempo?.tarifaHora) return "Sin tarifa";
  return `${formatCurrency(paso.tiempo.tarifaHora)}/h`;
}

function getCentroCostoLabel(paso: PasoCosteo) {
  if (!paso.activado) return "No aplica";
  if (paso.tiempo?.centroCostoNombre) return paso.tiempo.centroCostoNombre;
  if (paso.tiempo?.costo && paso.tiempo.costo > 0) return "Centro tarifado";
  if (paso.tiempo) return "Sin costo";
  return "Sin tiempo";
}

function MaterialesPasoTable({ materiales }: { materiales: MaterialCosteo[] }) {
  const visibles = materiales.filter((material) => material.costoTotal > 0);
  if (visibles.length === 0) {
    return (
      <div className="cost-empty-line">
        Este paso no consumió materiales ni consumibles con costo.
      </div>
    );
  }

  return (
    <div className="cost-detail-table-wrap">
      <table className="cost-detail-table">
        <thead>
          <tr>
            <th>Material</th>
            <th>Tipo</th>
            <th className="num">Cantidad</th>
            <th className="num">Costo unit.</th>
            <th className="num">Costo</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((material, index) => (
            <tr
              key={`${material.slotCodigo}-${material.materialVarianteId}-${index}`}
            >
              <td>
                <strong>
                  {material.materialDisplayName || material.materialNombre}
                </strong>
              </td>
              <td>
                <span className="cost-chip">
                  {formatModoSeleccion(material.modoSeleccion)}
                </span>
              </td>
              <td className="num">
                {formatCantidadCosto(material.cantidad, material.unidad)}
              </td>
              <td className="num">
                {formatCostoUnitarioMaterial(
                  material.precioUnitario,
                  material.unidad,
                )}
              </td>
              <td className="num strong">
                {formatCurrency(material.costoTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CargosPasoList({ cargos }: { cargos: CargoPasoCosteo[] }) {
  const visibles = cargos.filter((cargo) => cargo.monto > 0);
  if (visibles.length === 0) return null;

  return (
    <div className="cost-charges">
      {visibles.map((cargo) => (
        <div
          className="cost-charge"
          key={`${cargo.cargoCodigo}-${cargo.cargoNombre}`}
        >
          <span>{cargo.cargoNombre}</span>
          <small>{humanizeCodigo(cargo.modoCalculo)}</small>
          <strong>{formatCurrency(cargo.monto)}</strong>
        </div>
      ))}
    </div>
  );
}

function ProduccionItemView({
  item,
  calculoPendiente,
  onEditPanels,
}: {
  item: PropuestaItem;
  calculoPendiente: boolean;
  onEditPanels: (paso: PanelEditorPaso) => void;
}) {
  const pasosCosteoActivos = getVisibleCostSteps(item.cotizacion.pasos);
  const pasosActivos = pasosCosteoActivos;
  const pasosConNesting = pasosCosteoActivos.filter(
    (paso): paso is PanelEditorPaso => Boolean(paso.nestingResult),
  );
  const nestingTabs = pasosConNesting.map((paso, index) => ({
    key: nestingPasoKey(paso),
    label: nestingTabLabel(paso.nestingResult),
    index: index + 1,
    paso,
  }));
  const [activeNestingKey, setActiveNestingKey] = React.useState("");
  const activeNestingTab =
    nestingTabs.find((tab) => tab.key === activeNestingKey) ??
    nestingTabs[0] ??
    null;

  React.useEffect(() => {
    if (nestingTabs.length === 0) return;
    if (!nestingTabs.some((tab) => tab.key === activeNestingKey)) {
      setActiveNestingKey(nestingTabs[0]?.key ?? "");
    }
  }, [activeNestingKey, nestingTabs]);

  if (calculoPendiente) {
    return (
      <div className="op-empty">
        <div className="ttl">Producción pendiente de cotización</div>
        <div className="sub">
          Cotizá el producto para ver ruta activa, tiempos y nesting calculado
          por el Motor Universal.
        </div>
      </div>
    );
  }

  return (
    <div className="op-production">
      {item.notaProduccion ? (
        <div className="production-note">
          <span className="production-note-icon" aria-hidden="true">
            <TriangleAlertIcon />
          </span>
          <div>
            <strong>Nota para producción</strong>
            <p>{item.notaProduccion}</p>
          </div>
        </div>
      ) : null}

      <div className="cost-section">
        <div className="cost-title">Ruta de producción</div>
        <div className="production-route">
          {pasosActivos.map((paso, index) => {
            const title =
              paso.nombreVisible?.trim() || humanizeCodigo(paso.familiaCodigo);
            const detail = paso.tiempo
              ? `${formatTiempoPaso(paso)} · ${getCentroCostoLabel(paso)}`
              : getCentroCostoLabel(paso);
            return (
              <div className="production-step" key={`${title}-${index}`}>
                <span>{index + 1}</span>
                <div>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {pasosConNesting.length > 0 ? (
        <div className="cost-section">
          <div className="mb-[18px] flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1 basis-80">
              <div className="cost-title mb-1">Nesting del item</div>
              <h1 className="m-0 text-[22px] font-semibold leading-[1.2] tracking-[-0.018em] text-[var(--ink)]">
                Disposición de piezas
              </h1>
              <div className="mt-1 text-[13px] text-[var(--muted)]">
                Acomodo calculado por la ruta activa para controlar consumo,
                demasía y cortes.
              </div>
            </div>
          </div>
          <div className="production-nestings">
            {nestingTabs.length > 1 ? (
              <div
                className="production-nesting-tabs"
                role="tablist"
                aria-label="Nesting del item"
              >
                {nestingTabs.map((tab) => {
                  const selected = tab.key === activeNestingTab?.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      className={selected ? "on" : ""}
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setActiveNestingKey(tab.key)}
                    >
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {activeNestingTab ? (
              <div className="production-nesting" key={activeNestingTab.key}>
                {isPanelEditableStep(activeNestingTab.paso) ? (
                  <div className="mb-3 flex justify-end">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => onEditPanels(activeNestingTab.paso)}
                    >
                      <Edit3Icon />
                      Editar paneles
                    </button>
                  </div>
                ) : null}
                <NestingViewer
                  result={activeNestingTab.paso.nestingResult!}
                  costingDetails={activeNestingTab.paso.materiales ?? []}
                  maxPx={
                    activeNestingTab.paso.nestingResult?.substrates[0]?.kind ===
                    "sheet"
                      ? 420
                      : 560
                  }
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="op-empty">
          <div className="ttl">Sin nesting para este item</div>
          <div className="sub">
            La ruta activa no generó un gráfico de nesting para los pasos
            calculados.
          </div>
        </div>
      )}
    </div>
  );
}

function PanelesManualEditor({
  item,
  paso,
  saving,
  onClose,
  onSave,
  onRestoreAutomatic,
}: {
  item: PropuestaItem;
  paso: PanelEditorPaso;
  saving: boolean;
  onClose: () => void;
  onSave: (layout: PanelManualLayout) => void;
  onRestoreAutomatic: () => void;
}) {
  const baseLayout = React.useMemo(
    () => buildPanelLayoutFromNesting(item, paso.nestingResult),
    [item, paso],
  );
  const editableSourceIds = React.useMemo(
    () =>
      (baseLayout?.items ?? [])
        .filter((layoutItem) => layoutItem.panels.length > 1)
        .map((layoutItem) => layoutItem.sourcePieceId),
    [baseLayout],
  );
  const [layout, setLayout] = React.useState<PanelManualLayout | null>(
    baseLayout,
  );
  const [selectedId, setSelectedId] = React.useState(
    editableSourceIds[0] ?? "",
  );
  const barRef = React.useRef<HTMLDivElement | null>(null);
  const dragIndex = React.useRef<number | null>(null);

  React.useEffect(() => {
    setLayout(baseLayout);
    setSelectedId(editableSourceIds[0] ?? "");
  }, [baseLayout, editableSourceIds]);

  const selected = layout?.items.find(
    (layoutItem) => layoutItem.sourcePieceId === selectedId,
  );
  const panelizado = paso.nestingResult.visualConfig?.panelizado;
  const overlapMm = Number(panelizado?.overlapMm ?? 0);
  const printableLimit =
    paso.nestingResult.visualConfig?.usableArea.widthMm ??
    paso.nestingResult.substrates.find((sub) => sub.kind === "roll")?.widthMm ??
    Number.POSITIVE_INFINITY;
  const sizes =
    selected?.panels.map((panel) =>
      selected.axis === "vertical" ? panel.usefulWidthMm : panel.usefulHeightMm,
    ) ?? [];
  const totalAxis =
    selected?.axis === "horizontal"
      ? selected.pieceHeightMm
      : (selected?.pieceWidthMm ?? 0);
  const invalidMessage = selected
    ? getManualLayoutInvalidMessage(selected, printableLimit)
    : "No hay piezas panelizadas editables.";

  function updateSizes(nextSizes: number[]) {
    if (!layout || !selected) return;
    setLayout({
      items: layout.items.map((layoutItem) =>
        layoutItem.sourcePieceId === selected.sourcePieceId
          ? updateManualLayoutItemSizes(layoutItem, nextSizes, overlapMm)
          : layoutItem,
      ),
    });
  }

  function moveBoundary(clientX: number) {
    if (!barRef.current || !selected || dragIndex.current == null) return;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const boundaryMm = Math.round(ratio * totalAxis);
    const index = dragIndex.current;
    const before = sizes.slice(0, index).reduce((acc, size) => acc + size, 0);
    const after = sizes.slice(index + 2).reduce((acc, size) => acc + size, 0);
    const minPanelMm = 20;
    const minBoundary = before + minPanelMm;
    const maxBoundary = totalAxis - after - minPanelMm;
    const clamped = Math.min(maxBoundary, Math.max(minBoundary, boundaryMm));
    const next = [...sizes];
    next[index] = clamped - before;
    next[index + 1] = totalAxis - after - clamped;
    updateSizes(next);
  }

  React.useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      if (dragIndex.current == null) return;
      moveBoundary(event.clientX);
    }
    function onPointerUp() {
      dragIndex.current = null;
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  });

  if (!layout) {
    return (
      <PanelEditorShell title="Editar paneles" onClose={onClose}>
        <div className="op-empty">
          <div className="ttl">No se pudo reconstruir el panelizado</div>
          <div className="sub">
            El item no tiene piezas suficientes para armar un layout manual.
          </div>
        </div>
      </PanelEditorShell>
    );
  }

  return (
    <PanelEditorShell title="Editar paneles" onClose={onClose}>
      <div className="panel-editor-grid">
        {editableSourceIds.length > 1 ? (
          <div className="panel-editor-list">
            {editableSourceIds.map((sourceId, index) => (
              <button
                type="button"
                key={sourceId}
                className={sourceId === selectedId ? "on" : ""}
                onClick={() => setSelectedId(sourceId)}
              >
                Pieza {index + 1}
              </button>
            ))}
          </div>
        ) : null}

        <div className="panel-editor-stage">
          <div className="panel-editor-meta">
            <strong>
              {selected
                ? `${formatMmAsCm(selected.pieceWidthMm)} x ${formatMmAsCm(
                    selected.pieceHeightMm,
                  )} cm`
                : "Sin pieza seleccionada"}
            </strong>
            <span>
              {selected?.axis === "horizontal"
                ? "Paneles horizontales"
                : "Paneles verticales"}
            </span>
          </div>

          <div className="panel-bar" ref={barRef}>
            {selected?.panels.map((panel, index) => {
              const size =
                selected.axis === "vertical"
                  ? panel.usefulWidthMm
                  : panel.usefulHeightMm;
              const pct = totalAxis > 0 ? (size / totalAxis) * 100 : 0;
              return (
                <div
                  className="panel-segment"
                  key={panel.panelIndex}
                  style={{ width: `${pct}%` }}
                >
                  <span>P-{String(index + 1).padStart(2, "0")}</span>
                  <strong>
                    {selected.axis === "vertical"
                      ? `${formatMmAsCm(panel.usefulWidthMm)} x ${formatMmAsCm(panel.usefulHeightMm)} cm`
                      : `${formatMmAsCm(panel.usefulWidthMm)} x ${formatMmAsCm(panel.usefulHeightMm)} cm`}
                  </strong>
                  {index < selected.panels.length - 1 ? (
                    <button
                      type="button"
                      className="panel-handle"
                      aria-label={`Mover división ${index + 1}`}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        dragIndex.current = index;
                        event.currentTarget.setPointerCapture?.(
                          event.pointerId,
                        );
                      }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="panel-editor-table">
            {selected?.panels.map((panel) => (
              <div key={panel.panelIndex}>
                <span>Panel {panel.panelIndex}</span>
                <strong>
                  {formatMmAsCm(panel.finalWidthMm)} x{" "}
                  {formatMmAsCm(panel.finalHeightMm)} cm
                </strong>
              </div>
            ))}
          </div>

          {invalidMessage ? (
            <div className="panel-editor-error">{invalidMessage}</div>
          ) : null}
        </div>
      </div>

      <div className="panel-editor-actions">
        <button
          type="button"
          className="btn"
          onClick={onClose}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn"
          onClick={onRestoreAutomatic}
          disabled={saving}
        >
          Restaurar automático
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onSave(layout)}
          disabled={saving || Boolean(invalidMessage)}
        >
          {saving ? "Recotizando..." : "Guardar y recotizar"}
        </button>
      </div>
    </PanelEditorShell>
  );
}

function PanelEditorShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="panel-editor-overlay" role="dialog" aria-modal="true">
      <div className="panel-editor-modal">
        <div className="panel-editor-head">
          <div>
            <div className="cost-title">Panelizado manual</div>
            <h2>{title}</h2>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function getManualLayoutInvalidMessage(
  item: PanelLayoutItem,
  printableLimit: number,
) {
  const usefulTotal = item.panels.reduce(
    (acc, panel) =>
      acc +
      (item.axis === "vertical" ? panel.usefulWidthMm : panel.usefulHeightMm),
    0,
  );
  const expected =
    item.axis === "vertical" ? item.pieceWidthMm : item.pieceHeightMm;
  if (Math.abs(usefulTotal - expected) > 1) {
    return "La suma de paneles no coincide con la medida original.";
  }
  const oversized = item.panels.some((panel) =>
    item.axis === "vertical"
      ? panel.finalWidthMm > printableLimit
      : panel.finalHeightMm > printableLimit,
  );
  if (oversized) {
    return "Hay un panel que supera el ancho imprimible del rollo.";
  }
  return "";
}

function formatMmAsCm(value: number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 1,
  }).format(value / 10);
}

function formatDecimal(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits,
  }).format(value);
}

type PricePieceRow = {
  key: string;
  label: string;
  cantidad: number;
  baseLabel: string;
  netoAsignado: number;
  brutoAsignado: number;
  netoUnitario: number;
};

type CommercialPriceDetail = {
  precioNeto: number;
  precioBruto: number;
  impuestos: number;
  cantidadPrecio: number;
  precioPromedioNeto: number;
  precioPromedioBruto: number;
  unidadLabel: string;
  pieceRows: PricePieceRow[];
  asignacionLabel: string;
  materiales: Array<{
    key: string;
    nombre: string;
    cantidad: number;
    unidad: string;
    costo: number;
  }>;
  cargos: Array<{ key: string; nombre: string; monto: number; origen: string }>;
};

function getCommercialPieceRows(
  item: PropuestaItem,
  precioNeto: number,
  precioBruto: number,
): { rows: PricePieceRow[]; asignacionLabel: string } {
  const piezas = Array.isArray(item.jobContext?.piezas)
    ? (item.jobContext.piezas as Array<{
        cantidad?: unknown;
        anchoMm?: unknown;
        altoMm?: unknown;
      }>)
    : [];
  const normalized = piezas
    .map((pieza, index) => {
      const cantidad = Math.max(1, Number(pieza.cantidad ?? 0) || 0);
      const anchoMm = Number(pieza.anchoMm ?? 0);
      const altoMm = Number(pieza.altoMm ?? 0);
      const areaM2 =
        anchoMm > 0 && altoMm > 0
          ? (cantidad * anchoMm * altoMm) / 1_000_000
          : 0;
      const metrosLineales = altoMm > 0 ? (cantidad * altoMm) / 1000 : 0;
      return { index, cantidad, anchoMm, altoMm, areaM2, metrosLineales };
    })
    .filter((pieza) => pieza.cantidad > 0);

  if (normalized.length === 0) {
    return { rows: [], asignacionLabel: "Promedio comercial" };
  }

  const totalArea = normalized.reduce((acc, pieza) => acc + pieza.areaM2, 0);
  const totalMl = normalized.reduce(
    (acc, pieza) => acc + pieza.metrosLineales,
    0,
  );
  const totalCantidad = normalized.reduce(
    (acc, pieza) => acc + pieza.cantidad,
    0,
  );
  const allocationMode =
    item.unidadMedida === "metro_lineal" && totalMl > 0
      ? "ml"
      : totalArea > 0
        ? "area"
        : "cantidad";
  const totalBase =
    allocationMode === "ml"
      ? totalMl
      : allocationMode === "area"
        ? totalArea
        : totalCantidad;
  const asignacionLabel =
    allocationMode === "ml"
      ? "Proporcional por metro lineal"
      : allocationMode === "area"
        ? "Proporcional por superficie"
        : "Proporcional por cantidad";

  return {
    asignacionLabel,
    rows: normalized.map((pieza) => {
      const base =
        allocationMode === "ml"
          ? pieza.metrosLineales
          : allocationMode === "area"
            ? pieza.areaM2
            : pieza.cantidad;
      const weight = totalBase > 0 ? base / totalBase : 0;
      const netoAsignado = precioNeto * weight;
      const brutoAsignado = precioBruto * weight;
      const baseLabel =
        allocationMode === "ml"
          ? `${formatDecimal(base)} ml`
          : allocationMode === "area"
            ? `${formatDecimal(base)} m²`
            : `${formatDecimal(base, 0)} u.`;
      const medidaLabel =
        pieza.anchoMm > 0 && pieza.altoMm > 0
          ? `${formatMmAsCm(pieza.anchoMm)} × ${formatMmAsCm(pieza.altoMm)} cm`
          : "Medida sin definir";

      return {
        key: `piece-price-${pieza.index}`,
        label: medidaLabel,
        cantidad: pieza.cantidad,
        baseLabel,
        netoAsignado,
        brutoAsignado,
        netoUnitario: pieza.cantidad > 0 ? netoAsignado / pieza.cantidad : 0,
      };
    }),
  };
}

function buildCommercialPriceDetail(
  item: PropuestaItem,
): CommercialPriceDetail {
  const precioNeto = item.subtotal;
  const precioBruto = getCotizacionTotal(item.cotizacion);
  const impuestos = getCotizacionImpuestos(item.cotizacion);
  const cantidadPrecio = getCotizacionCantidadPrecio(
    item.cotizacion,
    item.cantidad,
  );
  const { rows: pieceRows, asignacionLabel } = getCommercialPieceRows(
    item,
    precioNeto,
    precioBruto,
  );
  const cargosPaso = item.cotizacion.pasos.flatMap((paso) =>
    (paso.cargosDirectosPaso ?? [])
      .filter((cargo) => cargo.monto > 0)
      .map((cargo) => ({
        key: `paso-${paso.configPasoId}-${cargo.cargoCodigo}`,
        nombre: cargo.cargoNombre,
        monto: cargo.monto,
        origen:
          paso.nombreVisible?.trim() || humanizeCodigo(paso.familiaCodigo),
      })),
  );
  const cargosCotizacion = item.cotizacion.cargosDirectosCotizacion
    .filter((cargo) => cargo.monto > 0)
    .map((cargo) => ({
      key: `cotizacion-${cargo.cargoCodigo}`,
      nombre: cargo.cargoNombre,
      monto: cargo.monto,
      origen: "Cotización",
    }));
  const materialesMap = new Map<
    string,
    {
      key: string;
      nombre: string;
      cantidad: number;
      unidad: string;
      costo: number;
    }
  >();
  for (const material of item.cotizacion.pasos.flatMap(
    (paso) => paso.materiales ?? [],
  )) {
    if (material.costoTotal <= 0) continue;
    const nombre =
      material.materialDisplayName?.trim() ||
      material.materialNombre?.trim() ||
      material.materiaPrimaNombre?.trim() ||
      "Material";
    const key = `${nombre}-${material.unidad}`;
    const current = materialesMap.get(key) ?? {
      key,
      nombre,
      cantidad: 0,
      unidad: material.unidad,
      costo: 0,
    };
    current.cantidad += material.cantidad;
    current.costo += material.costoTotal;
    materialesMap.set(key, current);
  }

  return {
    precioNeto,
    precioBruto,
    impuestos,
    cantidadPrecio,
    precioPromedioNeto: cantidadPrecio > 0 ? precioNeto / cantidadPrecio : 0,
    precioPromedioBruto: cantidadPrecio > 0 ? precioBruto / cantidadPrecio : 0,
    unidadLabel: formatUnidad(item.unidadMedida),
    pieceRows,
    asignacionLabel,
    materiales: Array.from(materialesMap.values()).sort(
      (a, b) => b.costo - a.costo,
    ),
    cargos: [...cargosPaso, ...cargosCotizacion],
  };
}

function CommercialPriceDetailPanel({
  item,
  detail,
}: {
  item: PropuestaItem;
  detail: CommercialPriceDetail;
}) {
  return (
    <div className="op-price-detail">
      <div className="op-price-detail-head">
        <div>
          <div className="op-price-title">Detalle comercial del precio</div>
          <div className="op-price-sub">
            {detail.asignacionLabel}. El motor calcula el precio a nivel ítem.
          </div>
        </div>
        <span className="op-price-badge">Estimado proporcional</span>
      </div>

      <div className="op-price-kpis">
        <div className="op-price-kpi">
          <span>Precio neto</span>
          <strong>{formatCurrency(detail.precioNeto)}</strong>
        </div>
        <div className="op-price-kpi">
          <span>Impuestos</span>
          <strong>{formatCurrency(detail.impuestos)}</strong>
        </div>
        <div className="op-price-kpi">
          <span>Total con impuestos</span>
          <strong>{formatCurrency(detail.precioBruto)}</strong>
        </div>
        <div className="op-price-kpi">
          <span>Promedio por {detail.unidadLabel}</span>
          <strong>{formatCurrency(detail.precioPromedioBruto)}</strong>
        </div>
      </div>

      {detail.pieceRows.length > 0 ? (
        <div className="op-price-table-wrap">
          <table className="op-price-table">
            <thead>
              <tr>
                <th>Pieza</th>
                <th className="num">Cant.</th>
                <th className="num">Base</th>
                <th className="num">Neto asignado</th>
                <th className="num">Neto por pieza</th>
                <th className="num">Total c/imp.</th>
              </tr>
            </thead>
            <tbody>
              {detail.pieceRows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td className="num">{formatDecimal(row.cantidad, 0)}</td>
                  <td className="num">{row.baseLabel}</td>
                  <td className="num">{formatCurrency(row.netoAsignado)}</td>
                  <td className="num">{formatCurrency(row.netoUnitario)}</td>
                  <td className="num">{formatCurrency(row.brutoAsignado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="op-price-note">
          No hay piezas con medidas para distribuir el precio. Se muestra el
          promedio por {detail.unidadLabel}.
        </div>
      )}

      {detail.materiales.length > 0 ? (
        <div className="op-price-materials">
          <div className="op-price-list-title">Materiales costeados</div>
          <div className="op-price-material-grid">
            {detail.materiales.map((material) => (
              <div className="op-price-material" key={material.key}>
                <span>{material.nombre}</span>
                <small>
                  {formatDecimal(material.cantidad)} {material.unidad}
                </small>
                <strong>{formatCurrency(material.costo)}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="op-price-lists">
        <div>
          <div className="op-price-list-title">Opcionales activados</div>
          <div className="op-chips">
            {item.adicionales.length > 0 ? (
              item.adicionales.map((adicional) => {
                const details = getOptionalMaterialDetails(item, adicional);
                return (
                  <span key={adicional} className="adi-chip-detail neutral">
                    <span className="adi-chip">{adicional}</span>
                    {details.length > 0 ? (
                      <span className="adi-chip-variant">
                        {details.join(" · ")}
                      </span>
                    ) : null}
                  </span>
                );
              })
            ) : (
              <span className="adi-chip neutral">Sin opcionales activados</span>
            )}
          </div>
        </div>
        <div>
          <div className="op-price-list-title">Cargos con monto explícito</div>
          {detail.cargos.length > 0 ? (
            <div className="op-price-charge-list">
              {detail.cargos.map((cargo) => (
                <div className="op-price-charge" key={cargo.key}>
                  <span>
                    {cargo.nombre}
                    <small>{cargo.origen}</small>
                  </span>
                  <strong>{formatCurrency(cargo.monto)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="op-price-note compact">
              No hay cargos separados en el snapshot. Los opcionales productivos
              quedan incluidos dentro del precio del ítem.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PasoCostDetail({ paso }: { paso: PasoCosteo }) {
  const materiales = paso.materiales ?? [];
  const cargos = paso.cargosDirectosPaso ?? [];
  const cargosTotal = sumCargosPaso(paso);

  return (
    <div className="cost-step-expanded">
      <div className="cost-detail-block">
        <div className="cost-detail-title">Materiales del paso</div>
        <MaterialesPasoTable materiales={materiales} />
      </div>

      {cargosTotal > 0 ? (
        <div className="cost-detail-block">
          <div className="cost-detail-title">Cargos directos del paso</div>
          <CargosPasoList cargos={cargos} />
        </div>
      ) : null}
    </div>
  );
}

function CostosItemView({
  item,
  costo,
  calculoPendiente,
}: {
  item: PropuestaItem;
  costo: number;
  calculoPendiente: boolean;
}) {
  const precioNeto = item.subtotal;
  const precioBruto = getCotizacionTotal(item.cotizacion);
  const desglosePrecio = item.cotizacion.desglosePrecio;
  const cantidadPrecio = getCotizacionCantidadPrecio(
    item.cotizacion,
    item.cantidad,
  );
  const precioBaseTotal = desglosePrecio
    ? desglosePrecio.precioBase * cantidadPrecio
    : precioNeto;
  const comisionesTotal = desglosePrecio
    ? desglosePrecio.totalComisiones * cantidadPrecio
    : 0;
  const margenPrecioMonto = precioBaseTotal - costo;
  // El margen se expresa sobre el NETO (sin IVA): es la base sobre la que se
  // configura el margen del Tab Precio — así "margen 40%" configurado se lee
  // 40% acá (y no 33% como cuando se dividía por el bruto, que incluye el IVA
  // y no es ingreso).
  const margenPrecioPct =
    precioNeto > 0 ? (margenPrecioMonto / precioNeto) * 100 : 0;
  const buckets = getCostBuckets(item);
  const cargosPaso = item.cotizacion.pasos
    .flatMap((paso) => paso.cargosDirectosPaso ?? [])
    .filter((cargo) => cargo.monto > 0);
  const cargosCotizacion = item.cotizacion.cargosDirectosCotizacion.filter(
    (cargo) => cargo.monto > 0,
  );
  const visibleCostSteps = getVisibleCostSteps(item.cotizacion.pasos);
  const [expandedCostSteps, setExpandedCostSteps] = React.useState<Set<string>>(
    () => new Set(),
  );

  const toggleCostStep = (key: string) => {
    setExpandedCostSteps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (calculoPendiente) {
    return (
      <div className="op-empty">
        <div className="ttl">Costo pendiente de cotización</div>
        <div className="sub">
          Cotizá el producto para ver materiales, producción y opcionales con
          costos reales del Motor Universal.
        </div>
      </div>
    );
  }

  // ── Cascada del precio: cada fila suma hacia abajo hasta el precio de venta.
  //    costo (materiales + centro de costo + cargos) + impuestos internos +
  //    comisiones + margen = precio neto; neto + IVA = precio de venta.
  const costosInternosTotal = Math.max(
    0,
    precioNeto - precioBaseTotal - comisionesTotal,
  );
  const ivaTotal = Math.max(0, precioBruto - precioNeto);
  const impuestosInternosNombres = (desglosePrecio?.impuestos ?? [])
    .filter((impuesto) => (impuesto.traslado ?? "POR_DENTRO") !== "POR_FUERA")
    .map((impuesto) => impuesto.nombre)
    .join(" + ");
  const impuestosPorFueraNombres = (desglosePrecio?.impuestos ?? [])
    .filter((impuesto) => impuesto.traslado === "POR_FUERA")
    .map((impuesto) => `${impuesto.nombre} ${impuesto.porcentaje}%`)
    .join(" + ");

  const pctDelNeto = (monto: number) =>
    precioNeto > 0
      ? `${((monto / precioNeto) * 100).toLocaleString("es-AR", {
          maximumFractionDigits: 1,
        })}%`
      : "—";
  const TIPO_POR_BUCKET: Record<string, string> = {
    materiales: "Materia prima",
    "centro-costo": "Centro de costo",
    cargos: "Cargo directo",
  };
  // Filas punto por punto: todo lo que compone el precio neto (suma 100%).
  const filasNeto: Array<{
    key: string;
    label: string;
    hint?: string;
    tipo: string;
    monto: number;
    warn?: boolean;
  }> = [
    ...buckets.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      tipo: TIPO_POR_BUCKET[bucket.key] ?? "Costo",
      monto: bucket.amount,
    })),
    ...(costosInternosTotal > 0
      ? [
          {
            key: "impuestos-internos",
            label: impuestosInternosNombres || "Impuestos internos",
            hint: "ya incluidos en el precio, no se muestran al cliente",
            tipo: "Impuesto",
            monto: costosInternosTotal,
          },
        ]
      : []),
    ...(comisionesTotal > 0
      ? [
          {
            key: "comisiones",
            label: "Comisiones",
            tipo: "Comisión",
            monto: comisionesTotal,
          },
        ]
      : []),
    {
      key: "margen",
      label: "Margen",
      tipo: "Rentabilidad",
      monto: margenPrecioMonto,
      warn: margenPrecioPct < 25,
    },
  ];

  return (
    <div className="op-costs">
      <div className="cost-waterfall">
        {filasNeto.map((fila) => (
          <div className="cw-row" key={fila.key}>
            <span className="cw-label">
              {fila.label}
              {fila.hint ? <small>{fila.hint}</small> : null}
            </span>
            <span className="cw-tipo">{fila.tipo}</span>
            <span className="cw-pct">{pctDelNeto(fila.monto)}</span>
            <span className={`cw-amount ${fila.warn ? "cw-margen warn" : ""}`}>
              {formatCurrency(fila.monto)}
            </span>
          </div>
        ))}
        <div className="cw-row cw-subtotal">
          <span className="cw-label">Precio neto (sin IVA)</span>
          <span className="cw-tipo" />
          <span className="cw-pct">100%</span>
          <span className="cw-amount">{formatCurrency(precioNeto)}</span>
        </div>
        {ivaTotal > 0 ? (
          <div className="cw-row">
            <span className="cw-label">
              {impuestosPorFueraNombres || "IVA"}
              <small>se agrega al neto y se discrimina en factura</small>
            </span>
            <span className="cw-tipo">Impuesto</span>
            <span className="cw-pct">+ {pctDelNeto(ivaTotal)}</span>
            <span className="cw-amount">+ {formatCurrency(ivaTotal)}</span>
          </div>
        ) : null}
        <div className="cw-row cw-total">
          <span className="cw-label">Precio de venta</span>
          <span className="cw-tipo" />
          <span className="cw-pct" />
          <span className="cw-amount">{formatCurrency(precioBruto)}</span>
        </div>
      </div>

      <div className="cost-section">
        <div className="cost-title">Desglose por paso</div>
        <div className="cost-steps-table-wrap">
          <table className="cost-steps-table">
            <thead>
              <tr>
                <th>Paso</th>
                <th>Centro de costo</th>
                <th className="num">Tiempo</th>
                <th className="num">Materiales</th>
                <th className="num">Cargos</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {visibleCostSteps.map((paso, visibleIndex) => {
                const stepKey = `${paso.rutaPasoOrden}-${paso.familiaCodigo}`;
                const materialesTotal = sumMaterialesPaso(paso);
                const cargosTotal = sumCargosPaso(paso);
                const centroCostoTotal = paso.tiempo?.costo ?? 0;
                const puedeExpandir =
                  paso.activado &&
                  (Boolean(paso.tiempo) ||
                    (paso.materiales?.length ?? 0) > 0 ||
                    (paso.cargosDirectosPaso?.length ?? 0) > 0);
                const expanded = expandedCostSteps.has(stepKey);
                return (
                  <React.Fragment key={stepKey}>
                    <tr
                      className={`${paso.activado ? "" : "muted-row"} ${
                        puedeExpandir ? "clickable" : ""
                      } ${expanded ? "open" : ""}`}
                      onClick={
                        puedeExpandir
                          ? () => toggleCostStep(stepKey)
                          : undefined
                      }
                    >
                      <td>
                        <div className="cost-step-name">
                          <span className="cost-step-title">
                            {puedeExpandir ? (
                              <ChevronRightIcon
                                className="cost-row-chevron"
                                aria-hidden="true"
                              />
                            ) : null}
                            <span>
                              {visibleIndex + 1}.{" "}
                              {paso.nombreVisible?.trim() ||
                                humanizeCodigo(paso.familiaCodigo)}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="cost-step-center">
                          <strong>{getCentroCostoLabel(paso)}</strong>
                          <span>{formatTarifaCentroCosto(paso)}</span>
                        </div>
                      </td>
                      <td className="num">
                        {paso.tiempo ? (
                          <>
                            <strong>{formatCurrency(centroCostoTotal)}</strong>
                            <span>{formatTiempoPaso(paso)}</span>
                          </>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className="num">
                        {materialesTotal > 0
                          ? formatCurrency(materialesTotal)
                          : "-"}
                      </td>
                      <td className="num">
                        {cargosTotal > 0 ? formatCurrency(cargosTotal) : "-"}
                      </td>
                      <td className="num strong">
                        {paso.costoTotal > 0
                          ? formatCurrency(paso.costoTotal)
                          : "-"}
                      </td>
                    </tr>
                    {puedeExpandir && expanded ? (
                      <tr className="cost-step-detail-row">
                        <td colSpan={6}>
                          <PasoCostDetail paso={paso} />
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {cargosPaso.length > 0 || cargosCotizacion.length > 0 ? (
        <div className="cost-section">
          <div className="cost-title">Opcionales y cargos</div>
          <div className="cost-charges">
            {cargosPaso.map((cargo) => (
              <div className="cost-charge" key={`paso-${cargo.cargoCodigo}`}>
                <span>{cargo.cargoNombre}</span>
                <small>{humanizeCodigo(cargo.modoCalculo)}</small>
                <strong>{formatCurrency(cargo.monto)}</strong>
              </div>
            ))}
            {cargosCotizacion.map((cargo) => (
              <div
                className="cost-charge"
                key={`cotizacion-${cargo.cargoCodigo}`}
              >
                <span>{cargo.cargoNombre}</span>
                <small>Cotización</small>
                <strong>{formatCurrency(cargo.monto)}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProductRow({
  item,
  index,
  expanded,
  onToggle,
  onRemove,
  onEdit,
  onEditPanels,
  onChangeFechaEntrega,
  fechaEstimada,
}: {
  item: PropuestaItem;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onEdit: () => void;
  onEditPanels: (item: PropuestaItem, paso: PanelEditorPaso) => void;
  onChangeFechaEntrega: (fechaEntrega: string) => void;
  fechaEstimada: string;
}) {
  const [innerTab, setInnerTab] = React.useState<InnerTab>("specs");
  const [priceDetailOpen, setPriceDetailOpen] = React.useState(false);
  const fechaInputRef = React.useRef<HTMLInputElement | null>(null);
  const costo = calcularCostoTotal(item);
  const calculoPendiente = item.precioUnitario === 0 && item.total === 0;
  const tienePrecioEspecial = Boolean(
    item.cotizacion?.desglosePrecio?.precioEspecialCliente,
  );
  const margen =
    item.subtotal > 0 ? ((item.subtotal - costo) / item.subtotal) * 100 : 0;
  const visibleAmounts = React.useMemo(
    () => getItemOrderVisibleAmounts(item),
    [item],
  );
  const commercialPriceDetail = React.useMemo(
    () => buildCommercialPriceDetail(item),
    [item],
  );
  const mainMaterial = React.useMemo(() => getMainCommercialMaterial(item), [item]);
  const montajeSustrato = React.useMemo(
    () => getMontajeSustratoMaterial(item),
    [item],
  );
  const optionalMaterialDetails = React.useMemo(
    () =>
      new Map(
        item.adicionales.map((adicional) => [
          adicional,
          getOptionalMaterialDetails(item, adicional),
        ]),
      ),
    [item],
  );
  const componentMaterialDetails = React.useMemo(
    () => getComponentMaterialDetails(item),
    [item],
  );
  const specsBase = item.atributosSchema
    .filter(
      (attr) =>
        attr.visible &&
        !["tipo_pieza", "tipoPieza", "tipo_de_pieza"].includes(attr.key),
    )
    .filter((attr) => !isDuplicateModoColorSpec(item, attr.key))
    // Con sustrato de montaje, el espesor pertenece a ESE material y se muestra
    // dentro del bloque "Montaje" (con su nombre); quitamos el ESPESOR suelto
    // para no dejar un "3 mm" huérfano que no dice de qué material es.
    .filter(
      (attr) => !(montajeSustrato && isEspesorSpecKey(attr.key, attr.label)),
    )
    .sort((a, b) => a.orden - b.orden)
    .map((attr) => ({
      lbl: attr.label,
      val:
        mainMaterial && isMaterialSpecKey(attr.key, attr.label)
          ? getMaterialCommercialLabel(mainMaterial)
          : item.especificaciones[attr.key] ?? "A definir",
    }));

  // Materiales que componen el producto: el principal (sustrato impreso) y el
  // de montaje. Se muestran SIEMPRE que existan en la cotización, aunque el
  // `atributosSchema` del producto no los declare (algunos productos no tienen
  // el atributo "material" en su schema, pero el dato viaja igual en la
  // cotización). El de montaje va justo después del principal.
  const specs = (() => {
    const arr = [...specsBase];

    // 1. Material principal: si el schema no generó una fila de material pero
    //    la cotización sí resolvió uno, lo insertamos sintéticamente (tras
    //    "Medidas" para respetar el orden Medidas · Material · …).
    let materialIdx = arr.findIndex((spec) => isMaterialSpecKey("", spec.lbl));
    if (materialIdx < 0 && mainMaterial) {
      const medidasIdx = arr.findIndex((spec) =>
        spec.lbl.toLowerCase().includes("medida"),
      );
      materialIdx = medidasIdx >= 0 ? medidasIdx + 1 : 0;
      arr.splice(materialIdx, 0, {
        lbl: "Material",
        val: getMaterialCommercialLabel(mainMaterial),
      });
    }

    // 2. Montaje: material del sustrato sobre el que se monta (ej. Imán,
    //    PVC espumado · 3 mm), justo después del principal.
    if (
      montajeSustrato &&
      montajeSustrato.materialVarianteId !== mainMaterial?.materialVarianteId
    ) {
      const montajeSpec = {
        lbl: "Montaje",
        val: getMaterialCommercialLabel(montajeSustrato),
      };
      if (materialIdx >= 0) arr.splice(materialIdx + 1, 0, montajeSpec);
      else arr.push(montajeSpec);
    }

    // 3. Faz: si es doble faz, mostrarlo siempre (aunque el schema no declare
    //    el atributo "caras"). El dato viaja en jobContext.caras. Si el schema
    //    ya lo trae, no duplicamos.
    const caras = getCarasItem(item);
    if (caras === 2 && !arr.some((spec) => isFazSpecKey("", spec.lbl))) {
      arr.push({ lbl: "Caras", val: "Doble faz" });
    }

    return arr;
  })();

  return (
    <div className={`oprow ${expanded ? "open" : ""}`}>
      <button type="button" className="oprow-head" onClick={onToggle}>
        <span className="ix">{index + 1}</span>
        <span className="chev">
          <ChevronRightIcon
            style={{
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform .15s ease",
            }}
          />
        </span>
        <div className="prod">
          <div className="nm">
            {item.productoNombre}
            {tienePrecioEspecial ? (
              <span
                className="op-especial"
                title="Cotizado con el precio especial configurado para el cliente de la orden."
              >
                <StarIcon aria-hidden="true" />
                Precio especial
              </span>
            ) : null}
          </div>
          <div className="cd">
            <span className="fam">
              {item.categoriaComercialNombre} ·{" "}
              {item.subcategoriaComercialNombre}
            </span>
          </div>
        </div>
        <div className="num qty">
          <span className="v">{formatCantidadItem(item)}</span>
          <span className="u">{formatUnidad(item.unidadMedida)}</span>
        </div>
        <div className="num">
          {calculoPendiente ? "A cotizar" : formatCurrency(visibleAmounts.subtotal)}
        </div>
        <div className="num">
          {calculoPendiente ? "-" : formatCurrency(visibleAmounts.impuestos)}
        </div>
        <div className={`num total${tienePrecioEspecial ? " especial" : ""}`}>
          {calculoPendiente ? "Pendiente" : formatCurrency(visibleAmounts.total)}
        </div>
        <span
          className="x"
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              onRemove();
            }
          }}
          title="Quitar producto"
        >
          <Trash2Icon />
        </span>
      </button>

      {expanded ? (
        <div className="oprow-body">
          <div className="op-sub">
            <div className="op-subnav">
              <button
                type="button"
                className={innerTab === "specs" ? "on" : ""}
                onClick={() => setInnerTab("specs")}
              >
                Especificaciones
              </button>
              <button
                type="button"
                className={innerTab === "costos" ? "on" : ""}
                onClick={() => setInnerTab("costos")}
              >
                Costos
              </button>
              <button
                type="button"
                className={innerTab === "produccion" ? "on" : ""}
                onClick={() => setInnerTab("produccion")}
              >
                Produccion
              </button>
            </div>
            <button type="button" className="btn-link" onClick={onEdit}>
              <Edit3Icon />
              Editar especificaciones
            </button>
          </div>

          {innerTab === "specs" ? (
            <>
              <div className="op-specs">
                {specs.map((spec) => {
                  const isMedidasSpec = spec.lbl
                    .toLowerCase()
                    .includes("medida");
                  const isModoColorSpec = spec.lbl
                    .toLowerCase()
                    .includes("modo de color");
                  const isCarasSpec = spec.lbl.toLowerCase() === "caras";
                  return (
                    <div
                      className={`spec ${isMedidasSpec ? "with-action" : ""} ${
                        isModoColorSpec ? "color-mode-spec" : ""
                      }`}
                      key={spec.lbl}
                    >
                      <div className="spec-head">
                        <div className="lbl">{spec.lbl}</div>
                        {isMedidasSpec ? (
                          <button
                            type="button"
                            className={`op-price-detail-trigger ${
                              priceDetailOpen ? "on" : ""
                            }`}
                            onClick={() =>
                              setPriceDetailOpen((current) => !current)
                            }
                            disabled={calculoPendiente}
                            aria-label={
                              priceDetailOpen
                                ? "Ocultar detalle de precio"
                                : "Ver detalle de precio"
                            }
                            title={
                              priceDetailOpen
                                ? "Ocultar detalle de precio"
                                : "Ver detalle de precio"
                            }
                          >
                            <CircleDollarSignIcon />
                          </button>
                        ) : null}
                      </div>
                      <div className={`val ${isMedidasSpec ? "multi" : ""}`}>
                        {isModoColorSpec ? (
                          <ModoColorSpecValue value={spec.val} />
                        ) : isCarasSpec ? (
                          <CarasSpecValue value={spec.val} />
                        ) : (
                          spec.val
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {priceDetailOpen && !calculoPendiente ? (
                <CommercialPriceDetailPanel
                  item={item}
                  detail={commercialPriceDetail}
                />
              ) : null}

              <div className="op-extras">
                <div className="op-adicionales">
                  <div className="op-adi-head">
                    <PlusIcon />
                    <span>Opcionales activados</span>
                  </div>
                  <div className="op-chips">
                    {item.adicionales.length > 0 ? (
                      item.adicionales.map((adicional) => {
                        const details =
                          optionalMaterialDetails.get(adicional) ?? [];
                        return (
                          <span key={adicional} className="adi-chip-detail">
                            <span className="adi-chip">
                              <CheckIcon />
                              {adicional}
                            </span>
                            {details.length > 0 ? (
                              <span className="adi-chip-variant">
                                {details.join(" · ")}
                              </span>
                            ) : null}
                          </span>
                        );
                      })
                    ) : (
                      <span className="adi-chip">Sin opcionales activados</span>
                    )}
                  </div>
                </div>

                {componentMaterialDetails.length > 0 ? (
                  <div className="op-adicionales">
                    <div className="op-adi-head">
                      <PackageIcon />
                      <span>Componentes</span>
                    </div>
                    <div className="op-chips">
                      {componentMaterialDetails.map((detail) => (
                        <span key={detail} className="adi-chip-detail">
                          <span className="adi-chip">{detail}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="op-mini">
                  <div className="op-mini-row">
                    <span className="mlbl">Fecha estimada</span>
                    <input
                      ref={fechaInputRef}
                      className="op-date-input"
                      type="date"
                      value={item.fechaEntrega ?? fechaEstimada}
                      onClick={() => fechaInputRef.current?.showPicker?.()}
                      onChange={(event) =>
                        onChangeFechaEntrega(event.target.value)
                      }
                      aria-label={`Fecha estimada de ${item.productoNombre}`}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {innerTab === "costos" ? (
            <CostosItemView
              item={item}
              costo={costo}
              calculoPendiente={calculoPendiente}
            />
          ) : null}

          {innerTab === "produccion" ? (
            <ProduccionItemView
              item={item}
              calculoPendiente={calculoPendiente}
              onEditPanels={(paso) => onEditPanels(item, paso)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EmptyTab({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="orden-tab-empty">
      <div className="ttl">{title}</div>
      <div className="sub">{description}</div>
    </div>
  );
}

function calcularCargosDirectosItems(items: PropuestaItem[]) {
  return items.reduce(
    (acc, item) => acc + item.cotizacion.costos.cargosDirectosTotal,
    0,
  );
}

function calcularComisionesItems(items: PropuestaItem[]) {
  return items.reduce((acc, item) => {
    const desglose = item.cotizacion.desglosePrecio;
    if (!desglose) return acc;

    const cantidad = getCotizacionCantidadPrecio(item.cotizacion, item.cantidad);

    return acc + desglose.totalComisiones * cantidad;
  }, 0);
}

type ImpuestoResumenLinea = {
  key: string;
  nombre: string;
  porcentaje: number;
  monto: number;
};

function getImpuestosItemResumen(item: PropuestaItem) {
  const desglose = item.cotizacion.desglosePrecio;
  const lineas: ImpuestoResumenLinea[] = [];
  let ocultos = 0;

  if (!desglose) {
    return { visibles: lineas, ocultos };
  }

  // Solo los impuestos POR_FUERA (IVA) son líneas que se agregan al neto y
  // pueden mostrarse/ocultarse al cliente: su monto es % del neto. Los
  // POR_DENTRO (IIBB, imp. al cheque) son costos ya embebidos en el precio
  // neto — nunca se listan ni ajustan el subtotal.
  const netoTotal = desglose.precioNetoTotal ?? 0;
  for (const impuesto of desglose.impuestos ?? []) {
    if ((impuesto.traslado ?? "POR_DENTRO") !== "POR_FUERA") continue;
    const monto = netoTotal * (impuesto.porcentaje / 100);
    if (monto <= 0) continue;
    if (impuesto.desglosarCliente === false) {
      ocultos += monto;
      continue;
    }

    lineas.push({
      key: impuesto.catalogoId || impuesto.codigo || impuesto.nombre,
      nombre: impuesto.nombre,
      porcentaje: impuesto.porcentaje,
      monto,
    });
  }

  return { visibles: lineas, ocultos };
}

function roundVisibleCurrency(value: number) {
  return Math.round(value);
}

function getItemOrderVisibleAmounts(item: PropuestaItem) {
  const impuestosResumen = getImpuestosItemResumen(item);
  const subtotal = roundVisibleCurrency(item.subtotal + impuestosResumen.ocultos);
  const impuestos = roundVisibleCurrency(
    Math.max(0, item.impuestoMonto - impuestosResumen.ocultos),
  );
  return {
    subtotal,
    impuestos,
    total: roundVisibleCurrency(item.total),
  };
}

function getImpuestosProductoResumen(items: PropuestaItem[]) {
  const lineas = new Map<string, ImpuestoResumenLinea>();
  let ocultos = 0;

  for (const item of items) {
    const resumenItem = getImpuestosItemResumen(item);
    ocultos += resumenItem.ocultos;

    for (const impuesto of resumenItem.visibles) {
      const key = impuesto.key;
      const current = lineas.get(key) ?? {
        key,
        nombre: impuesto.nombre,
        porcentaje: impuesto.porcentaje,
        monto: 0,
      };
      current.monto += impuesto.monto;
      lineas.set(key, current);
    }
  }

  return {
    visibles: Array.from(lineas.values()).sort((a, b) => b.monto - a.monto),
    ocultos,
  };
}

function formatImpuestoResumenLabel(linea: ImpuestoResumenLinea) {
  if (linea.porcentaje <= 0) return linea.nombre;
  const porcentaje = linea.porcentaje.toFixed(2);
  const porcentajeCompacto = Number.isInteger(linea.porcentaje)
    ? linea.porcentaje.toFixed(0)
    : porcentaje.replace(/0+$/, "").replace(/\.$/, "");
  const nombreNormalizado = linea.nombre.replace(",", ".").toLowerCase();
  const yaIncluyePorcentaje =
    nombreNormalizado.includes(`${porcentaje.toLowerCase()}%`) ||
    nombreNormalizado.includes(`${porcentajeCompacto.toLowerCase()}%`);

  return yaIncluyePorcentaje ? linea.nombre : `${linea.nombre} ${porcentaje}%`;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getCargoConfig(cargo: CargoDirectoCatalogo | null) {
  return (cargo?.configJson ?? {}) as Record<string, unknown>;
}

function getCargoDefaultMonto(cargo: CargoDirectoCatalogo | null) {
  const config = getCargoConfig(cargo);
  const zonas = Array.isArray(config.zonas) ? config.zonas : [];
  const firstZona = zonas[0] as { monto?: unknown } | undefined;
  return asNumber(config.monto ?? firstZona?.monto, 0);
}

function getCargoDefaultPorcentaje(cargo: CargoDirectoCatalogo | null) {
  const config = getCargoConfig(cargo);
  return asNumber(config.porcentaje ?? config.porcentajeDefault, 0);
}

function getCargoDefaultPrecioUnidad(cargo: CargoDirectoCatalogo | null) {
  const config = getCargoConfig(cargo);
  return asNumber(config.precioPorUnidad, 0);
}

function getCargoInputLabel(cargo: CargoDirectoCatalogo | null) {
  const config = getCargoConfig(cargo);
  const inputCantidad =
    typeof config.inputCantidad === "string"
      ? config.inputCantidad
      : "cantidad";
  const unidad = typeof config.unidad === "string" ? config.unidad : "";
  const labels: Record<string, string> = {
    distanciaKm: "Distancia",
    bultos: "Bultos",
    horas: "Horas",
    viajes: "Viajes",
    paradas: "Paradas",
    cajas: "Cajas",
    cantidad: "Cantidad",
  };
  const label = labels[inputCantidad] ?? humanizeCodigo(inputCantidad);
  return unidad ? `${label} (${unidad})` : label;
}

function calcularResumenOrden(
  items: PropuestaItem[],
  cargosOrden: PropuestaCargoDirecto[],
) {
  const productos = calcularResumen(items);
  const cargosSubtotal = cargosOrden.reduce(
    (acc, cargo) => acc + cargo.montoNeto,
    0,
  );
  const cargosImpuestos = cargosOrden.reduce(
    (acc, cargo) => acc + cargo.impuestoMonto,
    0,
  );
  const cargosTotal = cargosOrden.reduce((acc, cargo) => acc + cargo.total, 0);

  return {
    productos,
    cargosSubtotal,
    cargosImpuestos,
    cargosTotal,
    subtotal: productos.subtotal + cargosSubtotal,
    impuestos: productos.impuestos + cargosImpuestos,
    total: productos.total + cargosTotal,
    cantidadItems: productos.cantidadItems,
  };
}

function ResumenBar({
  items,
  cargosOrden,
  tipo,
  fechaEstimada,
  fechaCreacion,
}: {
  items: PropuestaItem[];
  cargosOrden: PropuestaCargoDirecto[];
  tipo: "orden" | "presupuesto";
  fechaEstimada: string;
  fechaCreacion: string;
}) {
  const resumen = calcularResumenOrden(items, cargosOrden);
  const impuestosProductoResumen = getImpuestosProductoResumen(items);
  const cargosImpuestos = resumen.cargosImpuestos;
  const productosVisibles = items.reduce(
    (acc, item) => {
      const amounts = getItemOrderVisibleAmounts(item);
      return {
        subtotal: acc.subtotal + amounts.subtotal,
        impuestos: acc.impuestos + amounts.impuestos,
        total: acc.total + amounts.total,
      };
    },
    { subtotal: 0, impuestos: 0, total: 0 },
  );
  const subtotal = productosVisibles.subtotal + resumen.cargosSubtotal;
  const impuestosVisibles = productosVisibles.impuestos + cargosImpuestos;
  const cargosItems = calcularCargosDirectosItems(items);
  const cargosOrdenTotal = resumen.cargosSubtotal;
  const cargos = cargosItems + cargosOrdenTotal;
  const comisiones = calcularComisionesItems(items);
  const totalConCargos = productosVisibles.total + resumen.cargosTotal;
  const impuestoLineas = [
    ...impuestosProductoResumen.visibles,
    ...(cargosImpuestos > 0
      ? [
          {
            key: "cargos-directos",
            nombre: "Impuestos sobre cargos",
            porcentaje: 0,
            monto: cargosImpuestos,
          },
        ]
      : []),
  ];
  if (impuestosVisibles > 0 && impuestoLineas.length === 0) {
    impuestoLineas.push({
      key: "impuestos",
      nombre: "Impuestos",
      porcentaje: 0,
      monto: impuestosVisibles,
    });
  }

  return (
    <div className="resumen-bar">
      <div className="rbar-head">
        <div>
          <div className="ttl">Resumen financiero</div>
          <div className="sub">
            {items.length} productos ·{" "}
            {tipo === "orden" ? "Orden de trabajo" : "Presupuesto"}
          </div>
        </div>
        <div className="rbar-conditions">
          {tipo === "presupuesto" ? (
            <span className="cond">
              <span className="cl">Validez</span>
              <span className="cv">7 dias</span>
            </span>
          ) : null}
          <span className="cond">
            <span className="cl">Plazo entrega</span>
            <span className="cv">
              {formatPlazoEntrega(fechaEstimada, fechaCreacion)}
            </span>
          </span>
          <span className="cond">
            <span className="cl">Forma de pago</span>
            <span className="cv">A definir</span>
          </span>
        </div>
      </div>

      <div className="rbar-cols">
        <div className="rbcol">
          <div className="lbl">Subtotal</div>
          <div className="val">{formatCurrency(subtotal)}</div>
          <div className="hint">{items.length} productos</div>
        </div>
        <div className="rbsep">+</div>
        <div className="rbcol">
          <div className="lbl">Impuestos</div>
          <div className="val">{formatCurrency(impuestosVisibles)}</div>
          <div className="hint">
            {impuestoLineas.length > 0
              ? impuestoLineas
                  .map((linea) => formatImpuestoResumenLabel(linea))
                  .join(" · ")
              : impuestosProductoResumen.ocultos > 0
                ? "Incluidos en subtotal"
                : "Sin impuestos"}
          </div>
        </div>
        <div className="rbsep">+</div>
        <div className="rbcol">
          <div className="lbl">Cargos directos</div>
          <div className="val">{formatCurrency(cargos)}</div>
          <div className="hint">
            {cargosOrdenTotal > 0
              ? `${cargosOrden.length} cargo${cargosOrden.length === 1 ? "" : "s"} de orden`
              : cargosItems > 0
                ? "Incluidos en productos"
                : "Sin cargos configurados"}
          </div>
        </div>
        <div className="rbsep">·</div>
        <div className="rbcol muted">
          <div className="lbl">Comisiones</div>
          <div className="val">{formatCurrency(comisiones)}</div>
          <div className="hint">
            {comisiones > 0 ? "Incluidas en subtotal" : "Sin comisiones"}
          </div>
        </div>
        <div className="rbsep eq">=</div>
        <div className="rbcol total">
          <div className="lbl">Total c/ imp.</div>
          <div className="val">{formatCurrency(totalConCargos)}</div>
          <div className="hint">Para emitir al cliente</div>
        </div>
      </div>

      <div className="rbar-foot">
        <div className="rbar-actions">
          <button type="button" className="btn">
            <SaveIcon />
            Guardar borrador
          </button>
          <button type="button" className="btn btn-primary">
            {tipo === "orden" ? (
              <>
                <CheckIcon />
                Emitir OT
              </>
            ) : (
              <>
                <ExternalLinkIcon />
                Enviar al cliente
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function buildCargoOrdenSnapshot({
  cargo,
  monto,
  porcentaje,
  precioUnidad,
  cantidadInput,
  zonaCodigo,
  subtotalBase,
  nota,
}: {
  cargo: CargoDirectoCatalogo;
  monto: number;
  porcentaje: number;
  precioUnidad: number;
  cantidadInput: number;
  zonaCodigo: string;
  subtotalBase: number;
  nota: string;
}): PropuestaCargoDirecto {
  const config = getCargoConfig(cargo);
  const zonas = Array.isArray(config.zonas) ? config.zonas : [];
  const zona =
    zonaCodigo && zonas.length > 0
      ? (zonas.find(
          (candidate) =>
            typeof candidate === "object" &&
            candidate !== null &&
            "codigo" in candidate &&
            String((candidate as { codigo: unknown }).codigo) === zonaCodigo,
        ) as { codigo?: string; nombre?: string; monto?: number } | undefined)
      : undefined;
  let montoNeto = monto;
  let detalle = "Monto fijo";
  const nextConfig: Record<string, unknown> = { ...config };

  if (cargo.modoCalculo === "MONTO_FIJO_PLANO") {
    montoNeto = zona ? asNumber(zona.monto, monto) : monto;
    nextConfig.montoAplicado = montoNeto;
    if (zona) {
      nextConfig.zonaAplicada = {
        codigo: zona.codigo,
        nombre: zona.nombre,
        monto: montoNeto,
      };
      detalle = zona.nombre ? `Zona ${zona.nombre}` : `Zona ${zona.codigo}`;
    }
  }

  if (cargo.modoCalculo === "PORCENTAJE_SOBRE_BASE") {
    montoNeto = (subtotalBase * porcentaje) / 100;
    nextConfig.porcentajeAplicado = porcentaje;
    detalle = `${porcentaje.toLocaleString("es-AR", { maximumFractionDigits: 2 })}% sobre subtotal`;
  }

  if (cargo.modoCalculo === "POR_UNIDAD_INPUT") {
    montoNeto = precioUnidad * cantidadInput;
    nextConfig.precioPorUnidadAplicado = precioUnidad;
    nextConfig.cantidadAplicada = cantidadInput;
    detalle = `${cantidadInput.toLocaleString("es-AR")} x ${formatCurrency(precioUnidad)}`;
  }

  const montoRedondeado = Math.max(0, Math.round(montoNeto));
  const impuestoPorcentaje = 21;
  const impuestoMonto = Math.round(
    montoRedondeado * (impuestoPorcentaje / 100),
  );

  return {
    id: `cargo-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    cargoDirectoCatalogoId: cargo.id,
    codigoSnapshot: cargo.codigo,
    nombreSnapshot: cargo.nombre,
    descripcionSnapshot: cargo.descripcion,
    modoCalculoSnapshot:
      cargo.modoCalculo as PropuestaCargoDirecto["modoCalculoSnapshot"],
    configSnapshot: nextConfig,
    baseCalculo: subtotalBase,
    cantidadInput:
      cargo.modoCalculo === "POR_UNIDAD_INPUT" ? cantidadInput : undefined,
    montoNeto: montoRedondeado,
    impuestoPorcentaje,
    impuestoMonto,
    total: montoRedondeado + impuestoMonto,
    detalle,
    nota: nota.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
}

function CargoOrdenSheet({
  open,
  cargos,
  subtotalBase,
  onClose,
  onAdd,
}: {
  open: boolean;
  cargos: CargoDirectoCatalogo[];
  subtotalBase: number;
  onClose: () => void;
  onAdd: (cargo: PropuestaCargoDirecto) => void;
}) {
  const [cargoId, setCargoId] = React.useState("");
  const selectedCargo = cargos.find((cargo) => cargo.id === cargoId) ?? null;
  const selectedConfig = getCargoConfig(selectedCargo);
  const zonas = Array.isArray(selectedConfig.zonas)
    ? (selectedConfig.zonas as Array<{
        codigo?: string;
        nombre?: string;
        monto?: number;
      }>)
    : [];
  const [monto, setMonto] = React.useState(0);
  const [porcentaje, setPorcentaje] = React.useState(0);
  const [precioUnidad, setPrecioUnidad] = React.useState(0);
  const [cantidadInput, setCantidadInput] = React.useState(1);
  const [zonaCodigo, setZonaCodigo] = React.useState("");
  const [nota, setNota] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    const first = cargos[0];
    setCargoId(first?.id ?? "");
  }, [cargos, open]);

  React.useEffect(() => {
    setMonto(getCargoDefaultMonto(selectedCargo));
    setPorcentaje(getCargoDefaultPorcentaje(selectedCargo));
    setPrecioUnidad(getCargoDefaultPrecioUnidad(selectedCargo));
    setCantidadInput(1);
    setZonaCodigo(zonas[0]?.codigo ?? "");
    setNota("");
  }, [selectedCargo?.id]);

  if (!open) return null;

  const preview = selectedCargo
    ? buildCargoOrdenSnapshot({
        cargo: selectedCargo,
        monto,
        porcentaje,
        precioUnidad,
        cantidadInput,
        zonaCodigo,
        subtotalBase,
        nota,
      })
    : null;

  const handleAdd = () => {
    if (!selectedCargo || !preview) {
      toast.error("Seleccioná un cargo del catálogo.");
      return;
    }
    if (preview.montoNeto <= 0) {
      toast.error("El monto del cargo debe ser mayor a cero.");
      return;
    }
    onAdd(preview);
  };

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <aside
        className="sheet sheet-ap cargo-sheet"
        aria-modal="true"
        role="dialog"
      >
        <div className="sheet-head">
          <span className="sheet-ico">
            <CircleDollarSignIcon />
          </span>
          <div className="body">
            <h2>Agregar cargo a la OT</h2>
            <div className="sub">
              Usa el catálogo de Costos, pero guarda un snapshot para esta
              orden.
            </div>
          </div>
          <button
            type="button"
            className="close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <XIcon />
          </button>
        </div>

        <div className="sheet-body cargo-sheet-body">
          {cargos.length === 0 ? (
            <div className="orden-tab-empty">
              <div className="ttl">Sin cargos disponibles</div>
              <div className="sub">
                Creá cargos en Costos &gt; Cargos directos.
              </div>
            </div>
          ) : (
            <>
              <div className="cargo-field">
                <label>Cargo</label>
                <select
                  value={cargoId}
                  onChange={(event) => setCargoId(event.target.value)}
                >
                  {cargos.map((cargo) => (
                    <option key={cargo.id} value={cargo.id}>
                      {cargo.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCargo ? (
                <div className="cargo-calc-card">
                  <div>
                    <span className="lbl">Tipo de cálculo</span>
                    <strong>
                      {selectedCargo.modoCalculo.replaceAll("_", " ")}
                    </strong>
                  </div>
                  <div>
                    <span className="lbl">Base actual</span>
                    <strong>{formatCurrency(subtotalBase)}</strong>
                  </div>
                </div>
              ) : null}

              {selectedCargo?.modoCalculo === "MONTO_FIJO_PLANO" ? (
                <>
                  {zonas.length > 0 ? (
                    <div className="cargo-field">
                      <label>Zona</label>
                      <select
                        value={zonaCodigo}
                        onChange={(event) => setZonaCodigo(event.target.value)}
                      >
                        {zonas.map((zona) => (
                          <option key={zona.codigo} value={zona.codigo}>
                            {zona.nombre ?? zona.codigo} ·{" "}
                            {formatCurrency(asNumber(zona.monto))}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {zonas.length === 0 ? (
                    <div className="cargo-field">
                      <label>Monto neto</label>
                      <input
                        type="number"
                        min="0"
                        value={monto}
                        onChange={(event) =>
                          setMonto(Number(event.target.value) || 0)
                        }
                      />
                    </div>
                  ) : null}
                </>
              ) : null}

              {selectedCargo?.modoCalculo === "PORCENTAJE_SOBRE_BASE" ? (
                <div className="cargo-field">
                  <label>Porcentaje sobre subtotal</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={porcentaje}
                    onChange={(event) =>
                      setPorcentaje(Number(event.target.value) || 0)
                    }
                  />
                </div>
              ) : null}

              {selectedCargo?.modoCalculo === "POR_UNIDAD_INPUT" ? (
                <div className="cargo-grid-2">
                  <div className="cargo-field">
                    <label>{getCargoInputLabel(selectedCargo)}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cantidadInput}
                      onChange={(event) =>
                        setCantidadInput(Number(event.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="cargo-field">
                    <label>Precio por unidad</label>
                    <input
                      type="number"
                      min="0"
                      value={precioUnidad}
                      onChange={(event) =>
                        setPrecioUnidad(Number(event.target.value) || 0)
                      }
                    />
                  </div>
                </div>
              ) : null}

              <div className="cargo-field">
                <label>Nota interna</label>
                <textarea
                  rows={3}
                  value={nota}
                  onChange={(event) => setNota(event.target.value)}
                  placeholder="Opcional"
                />
              </div>

              {preview ? (
                <div className="cargo-preview">
                  <span>
                    {preview.nombreSnapshot}
                    <small>{preview.detalle}</small>
                  </span>
                  <strong>{formatCurrency(preview.total)}</strong>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="sheet-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <div className="spacer" />
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAdd}
            disabled={cargos.length === 0}
          >
            <PlusIcon />
            Agregar cargo
          </button>
        </div>
      </aside>
    </>
  );
}

export function PropuestaFicha({
  initialClientes,
  initialProductos,
  initialCargosDirectos,
  currentUser,
}: PropuestaFichaProps) {
  const [tipo, setTipo] = React.useState<TipoPropuesta>("orden_trabajo");
  const ordenTipo = tipoMap[tipo];
  const [tab, setTab] = React.useState<OrdenTab>("productos");
  const [openIds, setOpenIds] = React.useState<Set<string>>(() => new Set());
  const [items, setItems] = React.useState<PropuestaItem[]>([]);
  const [cargosOrden, setCargosOrden] = React.useState<PropuestaCargoDirecto[]>(
    [],
  );
  const [addOpen, setAddOpen] = React.useState(false);
  const [cargoOpen, setCargoOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<PropuestaItem | null>(
    null,
  );
  const [panelEditor, setPanelEditor] = React.useState<{
    item: PropuestaItem;
    paso: PanelEditorPaso;
  } | null>(null);
  const [panelSaving, setPanelSaving] = React.useState(false);
  const [clienteId, setClienteId] = React.useState("");
  const [canalVenta, setCanalVenta] = React.useState("mostrador");
  const [fechaEstimada, setFechaEstimada] = React.useState(offsetDate(7));
  const [fechaCreacion] = React.useState(() => offsetDate(0));
  const fechaEstimadaInputRef = React.useRef<HTMLInputElement | null>(null);
  const rowRefs = React.useRef(new Map<string, HTMLDivElement>());

  const focusProductRow = React.useCallback((itemId: string) => {
    window.requestAnimationFrame(() => {
      rowRefs.current.get(itemId)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, []);

  const abrirAgregarProducto = React.useCallback(() => {
    setEditingItem(null);
    setTab("productos");
    setAddOpen(true);
  }, []);

  // Al cambiar el cliente con productos ya cargados, los precios de esos items
  // quedaron calculados sin (o con otro) cliente. Recotizamos todos en masa
  // para que apliquen los precios especiales del cliente nuevo (o vuelvan al
  // estándar). Cada fila se actualiza al llegar su resultado; un token de lote
  // descarta resultados viejos si el cliente cambia de nuevo en el medio.
  const [recotizandoIds, setRecotizandoIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const recotizacionBatchRef = React.useRef(0);
  const prevClienteIdRef = React.useRef(clienteId);
  // Ref con los items actuales para que el batch no dependa del array (evita
  // re-disparos del efecto por cada actualización progresiva).
  const itemsRef = React.useRef(items);
  itemsRef.current = items;

  const recotizarItemsPorCliente = React.useCallback(
    async (targetClienteId: string) => {
      const batch = ++recotizacionBatchRef.current;
      const recotizables = itemsRef.current.filter(
        (item) => item.jobContext && item.motorCodigo,
      );
      const omitidos = itemsRef.current.length - recotizables.length;
      if (recotizables.length === 0) return;

      setRecotizandoIds(new Set(recotizables.map((item) => item.id)));
      let exitosos = 0;
      let conEspecial = 0;
      let fallidos = 0;

      await Promise.all(
        recotizables.map(async (item) => {
          try {
            const request = {
              rutaAlternativaId: item.rutaAlternativaId ?? null,
              jobContext: item.jobContext as never,
              clienteId: targetClienteId || null,
              periodo: getCurrentPeriodo(),
            };
            const response = item.cotizacionItemId
              ? await recotizarCotizacionItem(item.cotizacionItemId, request)
              : {
                  result: await cotizar({
                    productoId: item.motorCodigo,
                    ...request,
                  }),
                };
            if (batch !== recotizacionBatchRef.current) return;
            if (response.result.exitoso && response.result.cotizacion) {
              const cotizacion = response.result.cotizacion;
              exitosos += 1;
              if (cotizacion.desglosePrecio?.precioEspecialCliente) {
                conEspecial += 1;
              }
              setItems((current) =>
                current.map((candidate) =>
                  candidate.id === item.id
                    ? applyCotizacionToItem(
                        candidate,
                        cotizacion,
                        item.jobContext as Record<string, unknown>,
                      )
                    : candidate,
                ),
              );
            } else {
              fallidos += 1;
            }
          } catch {
            if (batch !== recotizacionBatchRef.current) return;
            fallidos += 1;
          } finally {
            if (batch === recotizacionBatchRef.current) {
              setRecotizandoIds((current) => {
                const next = new Set(current);
                next.delete(item.id);
                return next;
              });
            }
          }
        }),
      );

      if (batch !== recotizacionBatchRef.current) return;
      const partes: string[] = [];
      if (exitosos > 0) {
        partes.push(
          `${exitosos} producto${exitosos === 1 ? "" : "s"} recotizado${exitosos === 1 ? "" : "s"} con el cliente seleccionado` +
            (conEspecial > 0
              ? ` (${conEspecial} con precio especial)`
              : ""),
        );
      }
      if (fallidos > 0) {
        partes.push(`${fallidos} no se pudieron recotizar y conservan su precio`);
      }
      if (omitidos > 0) {
        partes.push(`${omitidos} sin datos para recotizar`);
      }
      if (partes.length > 0) {
        (fallidos > 0 ? toast.warning : toast.success)(partes.join(" · ") + ".");
      }
    },
    [],
  );

  React.useEffect(() => {
    if (prevClienteIdRef.current === clienteId) return;
    prevClienteIdRef.current = clienteId;
    if (itemsRef.current.length === 0) return;
    void recotizarItemsPorCliente(clienteId);
  }, [clienteId, recotizarItemsPorCliente]);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target?.closest("input, textarea, select, [contenteditable='true']") !=
        null;
      const key = event.key.toLowerCase();
      const isAddShortcut =
        key === "n" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        !isEditableTarget;
      if (!isAddShortcut) return;

      event.preventDefault();
      if (addOpen || cargoOpen || panelEditor) return;
      abrirAgregarProducto();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [abrirAgregarProducto, addOpen, cargoOpen, panelEditor]);

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function recotizarPaneles(
    item: PropuestaItem,
    paso: PanelEditorPaso,
    layout: PanelManualLayout | null,
  ) {
    if (!item.jobContext || !item.motorCodigo) return;
    const configPasoId = paso.configPasoId;
    if (!configPasoId) {
      toast.error("No se pudo identificar el paso a recotizar.");
      return;
    }

    const nextJobContext = layout
      ? applyPanelRuntimeOverride({
          jobContext: item.jobContext,
          configPasoId,
          nesting: paso.nestingResult,
          layout,
        })
      : removePanelRuntimeOverride(item.jobContext, configPasoId);

    setPanelSaving(true);
    try {
      const request = {
        rutaAlternativaId: item.rutaAlternativaId ?? null,
        jobContext: nextJobContext as never,
        clienteId: clienteId || null,
        periodo: getCurrentPeriodo(),
      };
      const response = item.cotizacionItemId
        ? await recotizarCotizacionItem(item.cotizacionItemId, request)
        : {
            result: await cotizar({
              productoId: item.motorCodigo,
              ...request,
            }),
          };
      if (!response.result.exitoso || !response.result.cotizacion) {
        toast.error(
          response.result.errores[0]?.mensaje ??
            "No se pudo recotizar el panelizado.",
        );
        return;
      }
      const updatedItem = applyCotizacionToItem(
        item,
        response.result.cotizacion,
        nextJobContext,
      );
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? {
                ...updatedItem,
                cotizacionItemId:
                  response.cotizacionItemId ?? item.cotizacionItemId,
              }
            : candidate,
        ),
      );
      setPanelEditor(null);
      toast.success(
        layout
          ? "Paneles actualizados y recotizados."
          : "Panelizado automático restaurado.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo recotizar el panelizado.",
      );
    } finally {
      setPanelSaving(false);
    }
  }

  return (
    <section className="ot-v1 flex flex-1 flex-col p-4 md:p-6">
      <div className="orden-head">
        <div className="left">
          <Link className="back-link" href="/">
            <ArrowLeftIcon />
            Volver
          </Link>
          <div className="eyebrow">
            <BriefcaseBusinessIcon />
            Comercial
          </div>
          <h1>
            Nueva {ordenTipo === "orden" ? "orden de trabajo" : "propuesta"}
            <span className="status-chip">
              <span className="d" />
              Borrador
            </span>
          </h1>
          <div className="sub">
            {ordenTipo === "orden"
              ? "Confirma productos, especificaciones y pagos para emitir la OT al taller."
              : "Arma la propuesta para enviar al cliente antes de confirmar la OT."}
          </div>
        </div>
        <div className="right">
          <div className="orden-meta">
            <span className="meta-row">
              <span className="ml">Nº</span>
              <span className="mv mono">OT-2026-0184</span>
            </span>
            <span className="meta-row">
              <span className="ml">Creado</span>
              <span className="mv">hoy · 02:04</span>
            </span>
          </div>
          <OrdenSegmented
            value={ordenTipo}
            onChange={(value) => setTipo(fromOrdenTipo(value))}
          />
        </div>
      </div>

      <div className="orden-form">
        <FieldCard label="Cliente" icon={<UserIcon />}>
          <ClienteCombobox
            value={clienteId}
            onChange={setClienteId}
            initialClientes={initialClientes}
          />
        </FieldCard>

        <FieldCard label="Vendedor" icon={<UserIcon />}>
          <div className="ctrl-input has-avatar">
            <span className="av-sm">
              {(currentUser?.nombreCompleto ?? currentUser?.email ?? "US")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <span>
              {currentUser?.nombreCompleto ??
                currentUser?.email ??
                "Usuario actual"}
            </span>
          </div>
        </FieldCard>

        <FieldCard label="Canal de venta" icon={<PackageIcon />}>
          <CanalVentaSelect value={canalVenta} onChange={setCanalVenta} />
        </FieldCard>

        <FieldCard
          label="Fecha estimada"
          icon={<CalendarIcon />}
          hint="Entrega"
        >
          <div className="ctrl-input">
            <input
              ref={fechaEstimadaInputRef}
              type="date"
              value={fechaEstimada}
              onClick={() => fechaEstimadaInputRef.current?.showPicker?.()}
              onChange={(event) => setFechaEstimada(event.target.value)}
              aria-label="Fecha estimada"
            />
          </div>
        </FieldCard>
      </div>

      <div className="orden-main-full">
        <div className="orden-tabs-row">
          <OrdenTabs value={tab} onChange={setTab} count={items.length} />
          <div className="orden-actions">
            <button
              type="button"
              className="btn"
              onClick={() => setCargoOpen(true)}
            >
              <CircleDollarSignIcon />
              Agregar cargo
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={abrirAgregarProducto}
            >
              <PlusIcon />
              Agregar producto
            </button>
          </div>
        </div>

        {tab === "productos" ? (
          <div className="orden-table">
            <div className="ohead">
              <span className="ix">#</span>
              <span className="chev" />
              <span className="prod">Producto</span>
              <span className="num qty">Cantidad</span>
              <span className="num">Subtotal</span>
              <span className="num">Imp.</span>
              <span className="num">Total</span>
              <span className="x" />
            </div>
            {recotizandoIds.size > 0 ? (
              <div className="orden-recotizando" role="status" aria-live="polite">
                <span className="spin" aria-hidden="true" />
                Recotizando {recotizandoIds.size}{" "}
                {recotizandoIds.size === 1 ? "producto" : "productos"} con los
                precios del cliente seleccionado…
              </div>
            ) : null}
            <div className="orows">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`order-row-wrap${recotizandoIds.has(item.id) ? " is-requoting" : ""}`}
                  ref={(node) => {
                    if (node) {
                      rowRefs.current.set(item.id, node);
                    } else {
                      rowRefs.current.delete(item.id);
                    }
                  }}
                >
                  <ProductRow
                    item={item}
                    index={index}
                    expanded={openIds.has(item.id)}
                    onToggle={() => toggle(item.id)}
                    onRemove={() =>
                      setItems((current) =>
                        current.filter(
                          (candidate) => candidate.id !== item.id,
                        ),
                      )
                    }
                    onEdit={() => {
                      setEditingItem(item);
                      setAddOpen(true);
                    }}
                    onEditPanels={(targetItem, paso) => {
                      setPanelEditor({ item: targetItem, paso });
                    }}
                    onChangeFechaEntrega={(fechaEntrega) => {
                      setItems((current) =>
                        current.map((candidate) =>
                          candidate.id === item.id
                            ? {
                                ...candidate,
                                fechaEntrega: fechaEntrega || fechaEstimada,
                              }
                            : candidate,
                        ),
                      );
                    }}
                    fechaEstimada={fechaEstimada}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="orden-add-ghost"
              onClick={abrirAgregarProducto}
            >
              <PlusIcon />
              Agregar otro producto a la{" "}
              {ordenTipo === "orden" ? "orden" : "propuesta"}
            </button>
          </div>
        ) : null}

        {tab === "productos" && cargosOrden.length > 0 ? (
          <section className="orden-cargos-card">
            <div className="orden-cargos-head">
              <div>
                <div className="ttl">Cargos de la orden</div>
                <div className="sub">
                  Aplicados al total general con snapshot del catálogo.
                </div>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => setCargoOpen(true)}
              >
                <PlusIcon />
                Agregar cargo
              </button>
            </div>
            <div className="orden-cargos-list">
              {cargosOrden.map((cargo) => (
                <div className="orden-cargo-row" key={cargo.id}>
                  <div className="cargo-main">
                    <strong>{cargo.nombreSnapshot}</strong>
                    <small>{cargo.detalle}</small>
                    {cargo.nota ? <em>{cargo.nota}</em> : null}
                  </div>
                  <div className="cargo-num">
                    <span>Neto</span>
                    <strong>{formatCurrency(cargo.montoNeto)}</strong>
                  </div>
                  <div className="cargo-num">
                    <span>IVA</span>
                    <strong>{formatCurrency(cargo.impuestoMonto)}</strong>
                  </div>
                  <div className="cargo-num total">
                    <span>Total</span>
                    <strong>{formatCurrency(cargo.total)}</strong>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() =>
                      setCargosOrden((current) =>
                        current.filter(
                          (candidate) => candidate.id !== cargo.id,
                        ),
                      )
                    }
                    aria-label={`Eliminar cargo ${cargo.nombreSnapshot}`}
                  >
                    <Trash2Icon />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "produccion" ? (
          <EmptyTab
            title="Programacion de produccion"
            description="Una vez confirmada la OT vas a poder ver pasos, maquinas asignadas y tiempos estimados aca."
          />
        ) : null}
        {tab === "pagos" ? (
          <EmptyTab
            title="Plan de pagos"
            description="Configura anticipo, condiciones y vencimientos antes de emitir."
          />
        ) : null}
        {tab === "archivos" ? (
          <EmptyTab
            title="Archivos del cliente"
            description="Subi PDFs, vectores o referencias para que produccion los tenga a mano."
          />
        ) : null}
        {tab === "costos" ? (
          <EmptyTab
            title="Vista consolidada de costos"
            description={`Desglose de maquinas, materiales y mano de obra para los ${items.length} productos.`}
          />
        ) : null}

        {tab === "productos" ? (
          <ResumenBar
            items={items}
            cargosOrden={cargosOrden}
            tipo={ordenTipo}
            fechaEstimada={fechaEstimada}
            fechaCreacion={fechaCreacion}
          />
        ) : null}
      </div>

      <AgregarProductoSheet
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setEditingItem(null);
        }}
        productos={initialProductos}
        clienteId={clienteId || null}
        fechaEntregaDefault={fechaEstimada}
        editingItem={editingItem}
        onAddItem={(item) => {
          setItems((current) => [...current, item]);
          setOpenIds(new Set([item.id]));
          setAddOpen(false);
          setEditingItem(null);
          focusProductRow(item.id);
        }}
        onSaveItem={(item) => {
          setItems((current) =>
            current.map((candidate) =>
              candidate.id === item.id ? item : candidate,
            ),
          );
          setOpenIds(new Set([item.id]));
          setAddOpen(false);
          setEditingItem(null);
          focusProductRow(item.id);
        }}
      />
      <CargoOrdenSheet
        open={cargoOpen}
        cargos={initialCargosDirectos}
        subtotalBase={calcularResumen(items).subtotal}
        onClose={() => setCargoOpen(false)}
        onAdd={(cargo) => {
          setCargosOrden((current) => [...current, cargo]);
          setCargoOpen(false);
          toast.success(`${cargo.nombreSnapshot} agregado a la orden.`);
        }}
      />
      {panelEditor ? (
        <PanelesManualEditor
          item={panelEditor.item}
          paso={panelEditor.paso}
          saving={panelSaving}
          onClose={() => {
            if (!panelSaving) setPanelEditor(null);
          }}
          onSave={(layout) =>
            void recotizarPaneles(panelEditor.item, panelEditor.paso, layout)
          }
          onRestoreAutomatic={() =>
            void recotizarPaneles(panelEditor.item, panelEditor.paso, null)
          }
        />
      ) : null}
    </section>
  );
}
