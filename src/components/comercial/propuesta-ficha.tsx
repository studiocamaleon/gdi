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
  SquareIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import type { ClienteDetalle } from "@/lib/clientes";
import type { CurrentUser } from "@/lib/auth";
import type { ProductoListItem } from "@/lib/productos-servicios";
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
  type PropuestaItem,
  type TipoPropuesta,
} from "@/lib/propuestas";
import { AgregarProductoSheet } from "@/components/comercial/agregar-producto-sheet";
import { NestingViewer } from "@/components/nesting/nesting-viewer";

type PropuestaFichaProps = {
  initialClientes: ClienteDetalle[];
  initialProductos: ProductoListItem[];
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

function getCotizacionPasos(cotizacion: CotizacionExitosa) {
  return cotizacion.pasos
    .filter((paso) => paso.activado)
    .map((paso) => ({
      nombre: humanizeCodigo(paso.familiaCodigo),
      centroCosto: paso.tiempo ? "Producción" : "Proceso",
      minutos: paso.tiempo?.totalMin ?? 0,
      origen: "base" as const,
    }));
}

function applyCotizacionToItem(
  item: PropuestaItem,
  cotizacion: CotizacionExitosa,
  jobContext: Record<string, unknown>,
): PropuestaItem {
  const subtotal = getCotizacionNeto(cotizacion);
  const impuestoMonto = getCotizacionImpuestos(cotizacion);
  const total = getCotizacionTotal(cotizacion);
  const impuestoPorcentaje = subtotal > 0 ? (impuestoMonto / subtotal) * 100 : 0;

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

function getPanelAxis(
  nesting: NestingViewerInput,
): "vertical" | "horizontal" {
  const placementAxis = nesting.placements.find((placement) => placement.panelAxis)
    ?.panelAxis;
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
  const placementsBySource = new Map<string, NestingViewerInput["placements"]>();
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

function buildFullPanel(
  sourcePiece: { pieceWidthMm: number; pieceHeightMm: number },
): PanelLayoutPanel {
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
      ? Number(placement.usefulWidthMm ?? placement.widthMm - overlapStartMm - overlapEndMm)
      : sourcePiece.pieceWidthMm;
  const usefulHeightMm =
    axis === "horizontal"
      ? Number(placement.usefulHeightMm ?? placement.heightMm - overlapStartMm - overlapEndMm)
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
        ? Math.max(1, Math.round(usefulHeightMm + overlapStartMm + overlapEndMm))
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
      ? ({ ...(next.configPasoRuntime as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const stepRuntime =
    typeof runtime[configPasoId] === "object" &&
    runtime[configPasoId] !== null &&
    !Array.isArray(runtime[configPasoId])
      ? ({ ...(runtime[configPasoId] as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const nestingConfig =
    typeof stepRuntime.nestingConfig === "object" &&
    stepRuntime.nestingConfig !== null &&
    !Array.isArray(stepRuntime.nestingConfig)
      ? ({ ...(stepRuntime.nestingConfig as Record<string, unknown>) } as Record<string, unknown>)
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
      ? ({ ...(next.configPasoRuntime as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const stepRuntime =
    typeof runtime[args.configPasoId] === "object" &&
    runtime[args.configPasoId] !== null &&
    !Array.isArray(runtime[args.configPasoId])
      ? ({ ...(runtime[args.configPasoId] as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const nestingConfig =
    typeof stepRuntime.nestingConfig === "object" &&
    stepRuntime.nestingConfig !== null &&
    !Array.isArray(stepRuntime.nestingConfig)
      ? ({ ...(stepRuntime.nestingConfig as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const panelizado = args.nesting.visualConfig?.panelizado;
  const axis = args.layout.items.find((item) => item.panels.length > 1)?.axis ?? "vertical";
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
  const days = Math.max(0, Math.ceil((estimated.getTime() - created.getTime()) / dayMs));
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

function formatCantidadItem(item: PropuestaItem) {
  const maximumFractionDigits = item.unidadMedida === "m2" ? 2 : 0;
  const minimumFractionDigits =
    item.unidadMedida === "m2" && !Number.isInteger(item.cantidad) ? 2 : 0;

  return item.cantidad.toLocaleString("es-AR", {
    minimumFractionDigits,
    maximumFractionDigits,
  });
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
  return unidadLabel ? `${formatCurrency(value)} / ${unidadLabel}` : formatCurrency(value);
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
    { key: "materiales", label: "Materiales", amount: item.cotizacion.costos.materialesTotal },
    { key: "centro-costo", label: "Centro de costo", amount: item.cotizacion.costos.tiempoTotal },
    { key: "cargos", label: "Cargos directos", amount: item.cotizacion.costos.cargosDirectosTotal },
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
  return pasos.filter(
    (paso) =>
      paso.activado ||
      paso.costoTotal > 0,
  );
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
            <tr key={`${material.slotCodigo}-${material.materialVarianteId}-${index}`}>
              <td>
                <strong>{material.materialDisplayName || material.materialNombre}</strong>
              </td>
              <td>
                <span className="cost-chip">{formatModoSeleccion(material.modoSeleccion)}</span>
              </td>
              <td className="num">{formatCantidadCosto(material.cantidad, material.unidad)}</td>
              <td className="num">
                {formatCostoUnitarioMaterial(material.precioUnitario, material.unidad)}
              </td>
              <td className="num strong">{formatCurrency(material.costoTotal)}</td>
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
        <div className="cost-charge" key={`${cargo.cargoCodigo}-${cargo.cargoNombre}`}>
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
    nestingTabs.find((tab) => tab.key === activeNestingKey) ?? nestingTabs[0] ?? null;

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
            const title = humanizeCodigo(paso.familiaCodigo);
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
              <div className="production-nesting-tabs" role="tablist" aria-label="Nesting del item">
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
              <div
                className="production-nesting"
                key={activeNestingTab.key}
              >
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
                    activeNestingTab.paso.nestingResult?.substrates[0]?.kind === "sheet"
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

  const selected = layout?.items.find((layoutItem) => layoutItem.sourcePieceId === selectedId);
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
      : selected?.pieceWidthMm ?? 0;
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
          <div className="sub">El item no tiene piezas suficientes para armar un layout manual.</div>
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
              {selected?.axis === "horizontal" ? "Paneles horizontales" : "Paneles verticales"}
            </span>
          </div>

          <div className="panel-bar" ref={barRef}>
            {selected?.panels.map((panel, index) => {
              const size = selected.axis === "vertical" ? panel.usefulWidthMm : panel.usefulHeightMm;
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
                        event.currentTarget.setPointerCapture?.(event.pointerId);
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
                  {formatMmAsCm(panel.finalWidthMm)} x {formatMmAsCm(panel.finalHeightMm)} cm
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
        <button type="button" className="btn" onClick={onClose} disabled={saving}>
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
      acc + (item.axis === "vertical" ? panel.usefulWidthMm : panel.usefulHeightMm),
    0,
  );
  const expected = item.axis === "vertical" ? item.pieceWidthMm : item.pieceHeightMm;
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
  margen,
  calculoPendiente,
}: {
  item: PropuestaItem;
  costo: number;
  margen: number;
  calculoPendiente: boolean;
}) {
  const precioNeto = item.subtotal;
  const margenMonto = precioNeto - costo;
  const costoUnitario = item.cantidad > 0 ? costo / item.cantidad : 0;
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

  return (
    <div className="op-costs">
      <div className="cost-hero">
        <div>
          <div className="cost-eyebrow">Costeo del Motor Universal</div>
          <div className="cost-main">{formatCurrency(costo)}</div>
          <div className="cost-sub">
            Costo por {formatUnidad(item.unidadMedida)}: {formatCurrency(costoUnitario)} ·{" "}
            Cantidad: {formatCantidadItem(item)} {formatUnidad(item.unidadMedida)}
          </div>
        </div>
        <div className="cost-margin">
          <span>Margen bruto</span>
          <strong className={margen < 25 ? "warn" : ""}>{margen.toFixed(1)}%</strong>
          <small>{formatCurrency(margenMonto)}</small>
        </div>
        <div className="cost-margin">
          <span>Precio neto</span>
          <strong>{formatCurrency(precioNeto)}</strong>
          <small>sin impuestos</small>
        </div>
      </div>

      <div className="cost-section">
        <div className="cost-title">Composición del costo</div>
        <div className="cost-bars">
          {buckets.map((bucket) => {
            const pct = costo > 0 ? (bucket.amount / costo) * 100 : 0;
            return (
              <div className="cost-bar-row" key={bucket.key}>
                <div className="cost-bar-meta">
                  <span>{bucket.label}</span>
                  <strong>{formatCurrency(bucket.amount)}</strong>
                </div>
                <div className="cost-bar-track">
                  <span style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                </div>
                <div className="cost-bar-pct">{pct.toFixed(0)}%</div>
              </div>
            );
          })}
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
                        onClick={puedeExpandir ? () => toggleCostStep(stepKey) : undefined}
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
                              <span>{visibleIndex + 1}. {humanizeCodigo(paso.familiaCodigo)}</span>
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
                          {materialesTotal > 0 ? formatCurrency(materialesTotal) : "-"}
                        </td>
                        <td className="num">
                          {cargosTotal > 0 ? formatCurrency(cargosTotal) : "-"}
                        </td>
                        <td className="num strong">
                          {paso.costoTotal > 0 ? formatCurrency(paso.costoTotal) : "-"}
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
              <div className="cost-charge" key={`cotizacion-${cargo.cargoCodigo}`}>
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
  const fechaInputRef = React.useRef<HTMLInputElement | null>(null);
  const costo = calcularCostoTotal(item);
  const calculoPendiente = item.precioUnitario === 0 && item.total === 0;
  const margen = item.subtotal > 0 ? ((item.subtotal - costo) / item.subtotal) * 100 : 0;
  const specs = item.atributosSchema
    .filter(
      (attr) =>
        attr.visible &&
        !["tipo_pieza", "tipoPieza", "tipo_de_pieza"].includes(attr.key),
    )
    .sort((a, b) => a.orden - b.orden)
    .map((attr) => ({
      lbl: attr.label,
      val: item.especificaciones[attr.key] ?? "A definir",
    }));

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
          <div className="nm">{item.productoNombre}</div>
          <div className="cd">
            <span className="code">{item.productoCodigo}</span>
            <span className="fam">
              {item.categoriaComercialNombre} · {item.subcategoriaComercialNombre}
            </span>
          </div>
        </div>
        <div className="num qty">
          <span className="v">{formatCantidadItem(item)}</span>
          <span className="u">{formatUnidad(item.unidadMedida)}</span>
        </div>
        <div className="num">{calculoPendiente ? "A cotizar" : formatCurrency(item.subtotal)}</div>
        <div className="num">{calculoPendiente ? "-" : formatCurrency(item.impuestoMonto)}</div>
        <div className="num total">{calculoPendiente ? "Pendiente" : formatCurrency(item.total)}</div>
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
                {specs.map((spec) => (
                  <div className="spec" key={spec.lbl}>
                    <div className="lbl">{spec.lbl}</div>
                    <div className={`val ${spec.lbl.toLowerCase().includes("medida") ? "multi" : ""}`}>
                      {spec.val}
                    </div>
                  </div>
                ))}
              </div>

              <div className="op-extras">
                <div className="op-adicionales">
                  <div className="op-adi-head">
                    <PlusIcon />
                    <span>Opcionales activados</span>
                  </div>
                  <div className="op-chips">
                    {item.adicionales.length > 0 ? (
                      item.adicionales.map((adicional) => (
                        <span key={adicional} className="adi-chip">
                          <CheckIcon />
                          {adicional}
                        </span>
                      ))
                    ) : (
                      <span className="adi-chip">Sin opcionales activados</span>
                    )}
                  </div>
                </div>

                <div className="op-mini">
                  <div className="op-mini-row">
                    <span className="mlbl">Fecha estimada</span>
                    <input
                      ref={fechaInputRef}
                      className="op-date-input"
                      type="date"
                      value={item.fechaEntrega ?? fechaEstimada}
                      onClick={() => fechaInputRef.current?.showPicker?.()}
                      onChange={(event) => onChangeFechaEntrega(event.target.value)}
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
              margen={margen}
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

    const cantidad =
      item.cotizacion.cantidadComercialPricing ??
      item.cotizacion.cantidadEfectiva ??
      item.cantidad;

    return acc + desglose.totalComisiones * cantidad;
  }, 0);
}

function ResumenBar({
  items,
  tipo,
  fechaEstimada,
  fechaCreacion,
}: {
  items: PropuestaItem[];
  tipo: "orden" | "presupuesto";
  fechaEstimada: string;
  fechaCreacion: string;
}) {
  const resumen = calcularResumen(items);
  const subtotal = resumen.subtotal;
  const impuestos = resumen.impuestos;
  const costoTotal = items.reduce(
    (acc, item) => acc + calcularCostoTotal(item),
    0,
  );
  const cargos = calcularCargosDirectosItems(items);
  const comisiones = calcularComisionesItems(items);
  const totalConCargos = resumen.total;
  const margen = subtotal > 0 ? ((subtotal - costoTotal) / subtotal) * 100 : 0;

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
            <span className="cv">{formatPlazoEntrega(fechaEstimada, fechaCreacion)}</span>
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
          <div className="val">{formatCurrency(impuestos)}</div>
          <div className="hint">IVA 21%</div>
        </div>
        <div className="rbsep">+</div>
        <div className="rbcol">
          <div className="lbl">Cargos directos</div>
          <div className="val">{formatCurrency(cargos)}</div>
          <div className="hint">
            {cargos > 0 ? "Incluidos en subtotal" : "Sin cargos configurados"}
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
        <div className="rbar-margen">
          <div className="m-head">
            <span className="m-lbl">Margen bruto estimado</span>
            <span className={`m-val ${margen < 25 ? "warn" : ""}`}>
              {margen.toFixed(1)}%
            </span>
          </div>
          <div className="m-track">
            <span
              style={{
                width: `${Math.min(100, Math.max(0, margen))}%`,
              }}
            />
          </div>
          <div className="m-foot">
            <span>Costo motor</span>
            <span className="mono">{formatCurrency(costoTotal)}</span>
          </div>
        </div>
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

export function PropuestaFicha({
  initialClientes,
  initialProductos,
  currentUser,
}: PropuestaFichaProps) {
  const [tipo, setTipo] = React.useState<TipoPropuesta>("orden_trabajo");
  const ordenTipo = tipoMap[tipo];
  const [tab, setTab] = React.useState<OrdenTab>("productos");
  const [openIds, setOpenIds] = React.useState<Set<string>>(() => new Set());
  const [items, setItems] = React.useState<PropuestaItem[]>([]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<PropuestaItem | null>(null);
  const [panelEditor, setPanelEditor] = React.useState<{
    item: PropuestaItem;
    paso: PanelEditorPaso;
  } | null>(null);
  const [panelSaving, setPanelSaving] = React.useState(false);
  const [clienteId, setClienteId] = React.useState("");
  const [canalVenta, setCanalVenta] = React.useState("mostrador");
  const [fechaEstimada, setFechaEstimada] = React.useState(offsetDate(7));
  const [fechaCreacion] = React.useState(() => offsetDate(0));

  const clienteItems = React.useMemo(() => {
    return [...initialClientes]
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((cliente) => ({ value: cliente.id, label: cliente.nombre }));
  }, [initialClientes]);

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
        periodo: "2026-03",
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
          <div className="ctrl-select">
            <select
              value={clienteId}
              onChange={(event) => setClienteId(event.target.value)}
              aria-label="Cliente"
            >
              <option value="">Seleccionar cliente</option>
              {clienteItems.map((cliente) => (
                <option key={cliente.value} value={cliente.value}>
                  {cliente.label}
                </option>
              ))}
            </select>
            <ChevronRightIcon />
          </div>
        </FieldCard>

        <FieldCard label="Vendedor" icon={<UserIcon />}>
          <div className="ctrl-input has-avatar">
            <span className="av-sm">
              {(currentUser?.nombreCompleto ?? currentUser?.email ?? "US")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <span>{currentUser?.nombreCompleto ?? currentUser?.email ?? "Usuario actual"}</span>
          </div>
        </FieldCard>

        <FieldCard label="Canal de venta" icon={<PackageIcon />}>
          <div className="ctrl-select">
            <select
              value={canalVenta}
              onChange={(event) => setCanalVenta(event.target.value)}
              aria-label="Canal de venta"
            >
              {CANALES_VENTA.map((canal) => (
                <option key={canal.value} value={canal.value}>
                  {canal.label}
                </option>
              ))}
            </select>
            <ChevronRightIcon />
          </div>
        </FieldCard>

        <FieldCard label="Fecha estimada" icon={<CalendarIcon />} hint="Entrega">
          <div className="ctrl-input">
            <input
              type="date"
              value={fechaEstimada}
              onChange={(event) => setFechaEstimada(event.target.value)}
              aria-label="Fecha estimada"
            />
          </div>
        </FieldCard>
      </div>

      <div className="orden-main-full">
        <div className="orden-tabs-row">
          <OrdenTabs value={tab} onChange={setTab} count={items.length} />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingItem(null);
              setAddOpen(true);
            }}
          >
            <PlusIcon />
            Agregar producto
          </button>
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
            <div className="orows">
              {items.map((item, index) => (
                <ProductRow
                  key={item.id}
                  item={item}
                  index={index}
                  expanded={openIds.has(item.id)}
                  onToggle={() => toggle(item.id)}
                  onRemove={() =>
                    setItems((current) =>
                      current.filter((candidate) => candidate.id !== item.id),
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
                          ? { ...candidate, fechaEntrega: fechaEntrega || fechaEstimada }
                          : candidate,
                      ),
                    );
                  }}
                  fechaEstimada={fechaEstimada}
                />
              ))}
            </div>
            <button
              type="button"
              className="orden-add-ghost"
              onClick={() => {
                setEditingItem(null);
                setAddOpen(true);
              }}
            >
              <PlusIcon />
              Agregar otro producto a la{" "}
              {ordenTipo === "orden" ? "orden" : "propuesta"}
            </button>
          </div>
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
        fechaEntregaDefault={fechaEstimada}
        editingItem={editingItem}
        onAddItem={(item) => {
          setItems((current) => [...current, item]);
          setOpenIds((current) => new Set([...current, item.id]));
          setAddOpen(false);
          setEditingItem(null);
        }}
        onSaveItem={(item) => {
          setItems((current) =>
            current.map((candidate) => (candidate.id === item.id ? item : candidate)),
          );
          setOpenIds((current) => new Set([...current, item.id]));
          setAddOpen(false);
          setEditingItem(null);
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
