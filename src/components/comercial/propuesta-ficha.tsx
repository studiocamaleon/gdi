"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  BadgePercentIcon,
  CalendarIcon,
  ClockIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  CreditCardIcon,
  Edit3Icon,
  XCircleIcon,
  ExternalLinkIcon,
  ExpandIcon,
  FactoryIcon,
  FileIcon,
  FileXIcon,
  EyeIcon,
  FolderIcon,
  HistoryIcon,
  PackageIcon,
  PlusIcon,
  QrCodeIcon,
  LinkIcon,
  ReceiptTextIcon,
  SaveIcon,
  SearchIcon,
  StarIcon,
  TicketPercentIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UserIcon,
  XIcon,
  ZapIcon,
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
  cotizarYGuardar,
  recotizarCotizacionItem,
  type NestingViewerInput,
} from "@/lib/productos-servicios-api";
import {
  agregarOrdenItem,
  cambiarEstadoOrdenTrabajo,
  cancelarOrdenTrabajo,
  crearOrdenTrabajo,
  editarOrdenItem,
  editarOrdenTrabajo,
  getOrdenTrabajo,
  getTableroProduccion,
  quitarOrdenItem,
  setTratamientoFiscalOrden,
} from "@/lib/ordenes-trabajo-api";
import {
  emitirPresupuesto,
  getConfigPresupuestos,
} from "@/lib/presupuestos-api";
import { validarCupon, type Cupon } from "@/lib/cupones-api";
import { CLIENTE_ESCANEADO_EVENT } from "@/lib/clientes-api";
import { parsearDniArgentino } from "@/lib/dni-argentino";
import { esNumeroOrden } from "@/components/mostrador/entrega-escaneo-watcher";
import { useEscaneoCodigo } from "@/lib/use-escaneo-codigo";
import {
  CuponAvisoModal,
  type AvisoCupon,
} from "@/components/comercial/cupon-aviso";
import { QrRetiroModal } from "@/components/comercial/qr-retiro-modal";
import { enlacePublicoUrl } from "@/lib/enlaces-publicos";
import { itemsConSelloDe } from "@/lib/sello-arte/diseno";
import { mensajeDeArtes, publicarArtesDeSello } from "@/lib/sello-arte/publicar";
import { publicarPlanos, type PlanosDeItem } from "@/lib/planos-persistir";
import {
  subirArchivo,
  listarArchivos,
  eliminarArchivo,
} from "@/lib/archivos-api";
import {
  getConfiguracionProduccion,
  getDiasNoLaborables,
  getDuracionesFamilias,
  getEstaciones,
} from "@/lib/estaciones-api";
import type { Estacion } from "@/lib/estaciones";
import type { TableroItemData } from "@/lib/tablero-produccion";
import { ProduccionOrdenTab } from "@/components/comercial/produccion-orden-tab";
import { BastidorVisor } from "@/components/carteleria/bastidor-visor";
import { StepperOt } from "@/components/comercial/stepper-ot";
import {
  estimarDemoraNuevos,
  etiquetaEta,
  sumarDiasHabiles,
  type SimulacionItem,
} from "@/lib/flujo-produccion";
import {
  ORDEN_TRABAJO_ESTADOS,
  esCancelable,
  formatFechaOrden,
  type OrdenTrabajoDetalle,
  type OrdenTrabajoProducto,
} from "@/lib/ordenes-trabajo";
import { ConfirmacionSalida } from "@/components/ui/confirmacion-salida";
import { AvisoOtEnBorrador } from "@/components/comercial/aviso-ot-en-borrador";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import type { CobroDraft } from "@/components/administracion/cobro-formulario";
import { PagosStagingTab } from "@/components/comercial/pagos-staging-tab";
import { crearCobro } from "@/lib/administracion-api";
import { ComprobantesOrdenTab } from "@/components/administracion/facturacion-orden";
import { EstadoOtBadge } from "@/components/produccion/ordenes-trabajo-view";
import {
  EVENTO_ICONOS,
  PagosTab,
  useFormatEventoFecha,
} from "@/components/produccion/orden-trabajo-detalle-view";
import {
  calcularCostoTotal,
  calcularResumen,
  CANALES_VENTA,
  formatCurrency,
  formatUnidad,
  formatUnitPrice,
  offsetDate,
  type CotizacionPropuestaSnapshot,
  type PropuestaCargoDirecto,
  type PropuestaItem,
  type TipoPropuesta,
  type UnidadPropuesta,
} from "@/lib/propuestas";
import {
  calcularCostoItem,
  getCostoTiempoPaso,
  getVisibleCostSteps,
  sumCargosPaso,
  sumCargosYTiempoExtraPaso,
  sumMaterialesPaso,
} from "@/lib/costos-orden";
import { type Moneda } from "@/lib/moneda";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { AgregarProductoSheet } from "@/components/comercial/agregar-producto-sheet";
import CentroCopiadoSheet from "@/components/comercial/centro-copiado-sheet";
import CentroCopiadoPreciosSheet from "@/components/comercial/centro-copiado-precios-sheet";
import ccFicha from "@/components/comercial/centro-copiado-ficha.module.css";
import {
  guardarTomoCentroCopiado,
  dimsDeFormato,
  estadoCentroCopiado,
} from "@/lib/centro-copiado-api";
import { CostosOrdenTab } from "@/components/comercial/costos-orden-tab";
import {
  type MutacionAplicadaView,
  demasiaPorLado,
  describirModificaciones,
  describirOjales,
  medidaAntesDespues,
  medidasDeCorte,
  porcentajeMaterialExtra,
  resumenModificacion,
  resumenOjales,
  tieneDemasia,
} from "@/lib/modificaciones-fisicas";
import { ArchivosOrdenTab } from "@/components/archivos/archivos-orden-tab";
import { NestingViewer } from "@/components/nesting/nesting-viewer";
import {
  layoutPliegosEnHoja,
  type LayoutPliegosEnHoja,
} from "@/lib/nesting-compra-pliego";
import { NestingCompraPliegoModal } from "./nesting-compra-pliego-viewer";
import nestC from "./nesting-compra-pliego-viewer.module.css";
import descM from "./descuento-modal.module.css";
import { ConstelacionCanvas } from "@/components/constelacion-canvas";
import resumenBar from "./resumen-financiero-bar.module.css";
import { listClientes } from "@/lib/clientes-api";
import { getCurrentPeriodo } from "@/lib/costos";
import { technologyCodeLabel } from "@/lib/maquinaria-tecnologias";
import { usePuede } from "@/components/navigation/permisos-provider";
import { useFecha } from "@/components/navigation/config-regional-provider";

type PropuestaFichaProps = {
  initialClientes?: ClienteDetalle[];
  initialProductos?: ProductoListItem[];
  initialCargosDirectos?: CargoDirectoCatalogo[];
  currentUser?: CurrentUser | null;
  initialLoadErrors?: string[];
  /**
   * Modo orden: la MISMA ficha renderiza una OT ya persistida (solo lectura,
   * rehidratada desde los snapshots) con número, estado, flujo e historial.
   * Sin `orden`, es la ficha de creación de siempre.
   */
  orden?: OrdenTrabajoDetalle;
  /**
   * True sólo al aterrizar desde el flujo de emisión (?emitida=1): muestra
   * el tag "RECIÉN EMITIDA" en esta visita y limpia el param de la URL.
   */
  recienEmitida?: boolean;
  /**
   * True al aterrizar desde la conversión de un presupuesto (?convertida=1):
   * abre el aviso de que la orden quedó en BORRADOR y todavía no fue al
   * taller. Ver <AvisoOtEnBorrador />.
   */
  recienConvertida?: boolean;
};

type OrdenTab =
  | "productos"
  | "produccion"
  | "pagos"
  | "comprobantes"
  | "archivos"
  | "costos"
  | "historial";
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


export function getCotizacionPasos(cotizacion: CotizacionExitosa) {
  return cotizacion.pasos
    .filter(
      (paso) =>
        // Se oculta el andamiaje: un paso activado sin tiempo NI costo (p.ej. la
        // impresión en 0 del renglón de anillado) no es un paso de producción real.
        paso.activado &&
        (paso.costoTotal > 0 || (paso.tiempo?.totalMin ?? 0) > 0),
    )
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

function isPanelEditableStep(paso: PasoCosteo): paso is PanelEditorPaso {
  const nesting = paso.nestingResult;
  // [Tanda D] Sin chequeo de familia: el panelizado habilitado + algoritmo
  // de rollo SOLO los produce el acomodado que lo declara (gran formato) —
  // el dato del payload alcanza.
  return (
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
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 9h8M8 13h8M8 17h5" />
        </svg>
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
  historialCount,
  comprobantesCount,
  archivosCount,
}: {
  value: OrdenTab;
  onChange: (value: OrdenTab) => void;
  count: number;
  /** Presente sólo en modo orden: agrega el tab Historial. */
  historialCount?: number;
  /** Presente sólo en modo orden: agrega el tab Comprobantes. */
  comprobantesCount?: number;
  /** null hasta que el tab de Archivos se abre y los cuenta. */
  archivosCount?: number | null;
}) {
  const verMargenes = usePuede("finanzas.ver_margenes");
  const tabs: Array<{
    key: OrdenTab;
    label: string;
    count?: number;
    icon: React.ReactNode;
  }> = [
    { key: "productos", label: "Productos", count, icon: <PackageIcon /> },
    { key: "produccion", label: "Produccion", icon: <FactoryIcon /> },
    { key: "pagos", label: "Pagos", icon: <CreditCardIcon /> },
    ...(comprobantesCount !== undefined
      ? [
          {
            key: "comprobantes" as const,
            label: "Comprobantes",
            icon: <ReceiptTextIcon />,
          },
        ]
      : []),
    {
      key: "archivos",
      label: "Archivos",
      // Sin badge hasta que se sepa el número de verdad: un contador que
      // miente es peor que no tenerlo.
      count: archivosCount ?? undefined,
      icon: <FolderIcon />,
    },
    // El tab Costos es el desglose de lo que le sale a la imprenta: material,
    // máquina, mano de obra. Quien no puede ver márgenes tampoco lo ve — y el
    // API ya le manda la orden sin esos campos, así que el tab estaría vacío.
    ...(verMargenes
      ? [
          {
            key: "costos" as const,
            label: "Costos",
            icon: <CircleDollarSignIcon />,
          },
        ]
      : []),
    ...(historialCount !== undefined
      ? [
          {
            key: "historial" as const,
            label: "Historial",
            count: historialCount,
            icon: <HistoryIcon />,
          },
        ]
      : []),
  ];

  return (
    <div
      className="orden-tabs"
      role="tablist"
      // overflow-x:auto (scroll horizontal de pestañas) fuerza overflow-y a
      // `auto` y saca una barra vertical fantasma por 1px de desborde. Inline
      // para no depender del recompile de globals.css (Turbopack lo saltea).
      style={{ overflowY: "hidden" }}
    >
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
  const listboxId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState(() =>
    sortClientesByName(initialClientes),
  );
  const [total, setTotal] = React.useState(initialClientes.length);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

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
    setActiveIndex(0);
  }, [query, open]);

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
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-activedescendant={
                visibleOptions[activeIndex]
                  ? `${listboxId}-${visibleOptions[activeIndex].id}`
                  : undefined
              }
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex((current) =>
                    visibleOptions.length === 0
                      ? 0
                      : Math.min(current + 1, visibleOptions.length - 1),
                  );
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex((current) => Math.max(0, current - 1));
                } else if (
                  event.key === "Enter" &&
                  visibleOptions[activeIndex]
                ) {
                  event.preventDefault();
                  selectCliente(visibleOptions[activeIndex]);
                }
              }}
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

          <div id={listboxId} className="cliente-combobox-results" role="listbox">
            {visibleOptions.map((cliente, index) => (
              <button
                key={cliente.id}
                id={`${listboxId}-${cliente.id}`}
                type="button"
                className={`cliente-option ${cliente.id === value ? "selected" : ""}${index === activeIndex ? " keyboard" : ""}`}
                role="option"
                aria-selected={cliente.id === value}
                onMouseEnter={() => setActiveIndex(index)}
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

function getMaterialVariantParts(
  material: MaterialCosteo,
  options?: { incluirFormato?: boolean },
) {
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
    if (options?.incluirFormato) push(getAttrText(attrs, ["formatoComercial"]));
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

function getMaterialCommercialLabel(
  material: MaterialCosteo,
  options?: { incluirFormato?: boolean },
) {
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
  const parts = getMaterialVariantParts(material, options).filter((part) => {
    const normalizedPart = normalizeSearchText(part);
    return normalizedPart.length > 0 && !normalizedName.includes(normalizedPart);
  });
  if (parts.length === 0) return materialName;
  return `${materialName} · ${parts.join(" · ")}`;
}

// Nombre para los desgloses de costos: si la variante tiene nombre curado (o el
// consumible trae el canal, ej. "Negro · Toner..."), se respeta. Si el display
// cayó al nombre de la materia prima (variante sin nombre), se completa con los
// atributos que identifican la variante costeada (formato, gramaje, acabado…).
function getMaterialCosteoLabel(material: MaterialCosteo) {
  const base =
    material.materialDisplayName?.trim() || material.materialNombre?.trim();
  const esNombreCurado =
    base &&
    base !== material.materiaPrimaNombre?.trim() &&
    base !== material.materialSku;
  if (esNombreCurado) return base;
  return getMaterialCommercialLabel(material, { incluirFormato: true });
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
 * Copias del talonario (`jobContext.tipoCopia`: 1 simple, 2 duplicado,
 * 3 triplicado). El nesting del ítem representa UNA copia — cada paso de
 * impresión (original/duplicado/triplicado) repite el mismo acomodo — así que
 * el consumo total de pliegos es el del nesting × copias.
 */
function getCopiasItem(item: PropuestaItem): number {
  const copias = Number(
    (item.jobContext as Record<string, unknown> | undefined)?.tipoCopia,
  );
  return copias === 2 || copias === 3 ? copias : 1;
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

function formatCostoUnitarioMaterial(
  value: number,
  unidad: string,
  moneda: Moneda,
) {
  const unidadLabel = formatUnidadCosto(unidad, 1);
  return unidadLabel
    ? `${formatCurrency(value, moneda)} / ${unidadLabel}`
    : formatCurrency(value, moneda);
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
    // El desgaste se mide en clicks A4-equivalentes; para el comercial son
    // "clicks" a secas — el equivalente A4 es detalle interno del cálculo.
    a4_equiv: { singular: "click", plural: "clicks" },
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
    MAQUINA_DESGASTE: "Desgaste",
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
  // Cotizaciones viejas pueden traer el algoritmo retirado en su snapshot.
  if ((algorithm as string) === "packingsolver-rectangle")
    return "Acomodado en placa";
  if (algorithm === "maxrects-rollo") return "Acomodado en rollo";
  if (algorithm === "shelf-rollo") return "Acomodado en rollo";
  if (kind === "sheet") return "Acomodado en pliego";
  if (kind === "roll") return "Acomodado en rollo";
  if (kind === "board") return "Acomodado en placa";
  return "Acomodado";
}

function formatMinutos(min: number) {
  return `${min.toLocaleString("es-AR", { maximumFractionDigits: 1 })} min`;
}

function formatTiempoPaso(paso: PasoCosteo) {
  if (!paso.tiempo) return "-";
  return formatMinutos(paso.tiempo.totalMin);
}

function formatTarifaCentroCosto(paso: PasoCosteo, moneda: Moneda) {
  if (!paso.tiempo?.tarifaHora) return "Sin tarifa";
  return `${formatCurrency(paso.tiempo.tarifaHora, moneda)}/h`;
}

function getCentroCostoLabel(paso: PasoCosteo) {
  if (!paso.activado) return "No aplica";
  if (paso.tiempo?.centroCostoNombre) return paso.tiempo.centroCostoNombre;
  if (paso.tiempo?.costo && paso.tiempo.costo > 0) return "Centro tarifado";
  if (paso.tiempo) return "Sin costo";
  return "Sin tiempo";
}

/**
 * Pliego de impresión del paso, para el dibujo de acomodado. Sale de dos
 * fuentes según cómo se resolvió el sustrato:
 *  - `pliegoImpresionSeleccionado` cuando el motor lo AUTO-selecciona.
 *  - el sustrato nesteado (`substrates[0]`) cuando el sustrato es fijo
 *    (HARDCODED): las piezas se acomodan sobre el pliego, así que ese sheet
 *    ES el pliego de impresión. Los conteos salen de `outputsCanonicos`.
 */
type PliegoPaso = {
  anchoMm: number;
  altoMm: number;
  label?: string;
  pliegosImpresion?: number;
  materiaPrimaVarianteId?: string;
};

function pliegoDePaso(
  nesting: PasoCosteo["nestingResult"] | undefined,
): PliegoPaso | null {
  if (!nesting) return null;
  const numPos = (v: unknown) =>
    typeof v === "number" && v > 0 ? v : undefined;
  const sel = nesting.pliegoImpresionSeleccionado;
  if (sel && sel.anchoMm > 0 && sel.altoMm > 0) {
    return {
      anchoMm: sel.anchoMm,
      altoMm: sel.altoMm,
      label: sel.nombre,
      pliegosImpresion: numPos(sel.pliegosImpresion),
      materiaPrimaVarianteId: sel.materiaPrima?.varianteId,
    };
  }
  const sheet = nesting.substrates?.find((sub) => sub.kind === "sheet");
  if (sheet && "widthMm" in sheet && sheet.widthMm > 0 && sheet.heightMm > 0) {
    const oc = nesting.outputsCanonicos ?? {};
    return {
      anchoMm: sheet.widthMm,
      altoMm: sheet.heightMm,
      label: "Pliego de impresión",
      pliegosImpresion:
        numPos(oc.pliegos_impresos) ?? numPos(oc.pliegos_calculados),
    };
  }
  return null;
}

/** Dims (mm) de la hoja de COMPRA a partir de los atributos de la variante. */
function hojaDeCompraDeMaterial(
  material: MaterialCosteo,
): { anchoMm: number; altoMm: number } | null {
  const attrs = material.atributosVarianteJson;
  if (!attrs) return null;
  const num = (v: unknown) => (typeof v === "number" && v > 0 ? v : null);
  const anchoMm = num(attrs.anchoMm);
  const altoMm = num(attrs.altoMm) ?? num(attrs.largoMm);
  if (anchoMm == null || altoMm == null) return null;
  return { anchoMm, altoMm };
}

/**
 * Acomodado hoja-de-compra → pliego para esta línea, o `null` si no aplica
 * (no hay pliego, la línea no es el sustrato nesteado, o entra 1:1).
 */
function acomodadoDeLinea(
  material: MaterialCosteo,
  pliego: PliegoPaso | null,
): LayoutPliegosEnHoja | null {
  if (!pliego) return null;
  // Sólo la línea del sustrato que se nesteó: por varianteId si el motor lo
  // expone, si no, la línea de MATERIAL con medidas.
  const esLaLinea = pliego.materiaPrimaVarianteId
    ? material.materialVarianteId === pliego.materiaPrimaVarianteId
    : material.tipoLineaCosto === "MATERIAL";
  if (!esLaLinea) return null;
  const hoja = hojaDeCompraDeMaterial(material);
  if (!hoja) return null;
  const layout = layoutPliegosEnHoja(hoja, {
    anchoMm: pliego.anchoMm,
    altoMm: pliego.altoMm,
  });
  if (!layout || !layout.esDerivado || layout.pliegosPorHoja <= 1) return null;
  return layout;
}

function MaterialesPasoTable({
  materiales,
  nesting,
}: {
  materiales: MaterialCosteo[];
  nesting?: PasoCosteo["nestingResult"];
}) {
  const { moneda } = useConfigRegional();
  const [abierto, setAbierto] = React.useState<string | null>(null);
  const pliego = pliegoDePaso(nesting);
  const visibles = materiales.filter((material) => material.costoTotal > 0);
  if (visibles.length === 0) {
    return (
      <div className="cost-empty-line">
        Este paso no consumió materiales ni consumibles con costo.
      </div>
    );
  }

  const abierta = visibles
    .map((material, index) => ({
      key: `${material.slotCodigo}-${material.materialVarianteId}-${index}`,
      material,
      layout: acomodadoDeLinea(material, pliego),
    }))
    .find((row) => row.key === abierto && row.layout);

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
          {visibles.map((material, index) => {
            const key = `${material.slotCodigo}-${material.materialVarianteId}-${index}`;
            const tieneAcomodado = Boolean(acomodadoDeLinea(material, pliego));
            return (
              <tr key={key}>
                <td>
                  <strong>{getMaterialCosteoLabel(material)}</strong>
                  {tieneAcomodado ? (
                    <button
                      type="button"
                      className={nestC.trigger}
                      onClick={() => setAbierto(key)}
                      title="Ver cómo entran los pliegos en la hoja de compra"
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="1.5" />
                        <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
                      </svg>
                    </button>
                  ) : null}
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
                    moneda,
                  )}
                </td>
                <td className="num strong">
                  {formatCurrency(material.costoTotal, moneda)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {abierta && abierta.layout && pliego ? (
        <NestingCompraPliegoModal
          hoja={hojaDeCompraDeMaterial(abierta.material)!}
          pliego={{ anchoMm: pliego.anchoMm, altoMm: pliego.altoMm }}
          layout={abierta.layout}
          onClose={() => setAbierto(null)}
        />
      ) : null}
    </div>
  );
}

function CargosPasoList({ cargos }: { cargos: CargoPasoCosteo[] }) {
  const { moneda } = useConfigRegional();
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
          <strong>{formatCurrency(cargo.monto, moneda)}</strong>
        </div>
      ))}
    </div>
  );
}

/**
 * Bloques de tiempo extra del paso (preparación, traslado) con la cuenta a la
 * vista: de dónde sale el número es la mitad del valor de mostrarlo.
 */
function TiemposExtraPasoList({
  bloques,
}: {
  bloques: NonNullable<NonNullable<PasoCosteo["tiempo"]>["tiemposExtra"]>;
}) {
  const { moneda } = useConfigRegional();
  const visibles = bloques.filter((bloque) => bloque.minutos > 0);
  if (visibles.length === 0) return null;

  return (
    <div className="cost-charges">
      {visibles.map((bloque) => {
        const horas = bloque.minutos / 60;
        const personas =
          bloque.dotacionOperarios > 1
            ? ` × ${bloque.dotacionOperarios} pers`
            : "";
        return (
          <div className="cost-charge" key={bloque.id}>
            <span>{bloque.etiqueta}</span>
            <small>
              {formatDecimal(horas, 2)} h{personas} ×{" "}
              {formatCurrency(bloque.tarifaHora, moneda)}/h
              {bloque.centroCostoNombre ? ` · ${bloque.centroCostoNombre}` : ""}
            </small>
            <strong>{formatCurrency(bloque.costo, moneda)}</strong>
          </div>
        );
      })}
    </div>
  );
}

/** Clave del tab del visor 3D del bastidor dentro de "Disposición de piezas". */
const TAB_BASTIDOR_3D = "__bastidor3d__";

function ProduccionItemView({
  item,
  calculoPendiente,
  onEditPanels,
}: {
  item: PropuestaItem;
  calculoPendiente: boolean;
  /** Ausente en modo lectura: el layout de paneles no se puede editar. */
  onEditPanels?: (paso: PanelEditorPaso) => void;
}) {
  const pasosCosteoActivos = getVisibleCostSteps(item.cotizacion.pasos);
  const pasosActivos = pasosCosteoActivos;
  // Cartelería con estructura de bastidor: se muestra el visor 3D del marco a
  // fabricar. El visor pide la estructura del snapshot y se auto-oculta si no
  // la hay (ítem sin OT emitida todavía).
  const esBastidor = item.cotizacion.pasos.some(
    (paso) => paso.familiaCodigo === "estructura_bastidor",
  );
  // La estructura viene DENTRO de la cotización que la ficha ya tiene: el
  // visor la dibuja al toque, sin esperar a que el ítem exista en la base
  // (mientras se compone la orden no hay nada persistido que fetchear).
  const estructuraBastidorLocal =
    item.cotizacion.pasos.find((paso) => paso.estructuraBastidor)
      ?.estructuraBastidor ?? null;
  const pasosConNesting = pasosCosteoActivos.filter(
    (paso): paso is PanelEditorPaso => Boolean(paso.nestingResult),
  );
  const nestingTabs = pasosConNesting.map((paso, index) => ({
    key: nestingPasoKey(paso),
    label: nestingTabLabel(paso.nestingResult),
    index: index + 1,
    paso,
  }));
  // Overlay de modificaciones físicas: la demasía y los ojales viven en pasos
  // HERMANOS del que trae el nesting (`modificacion_pre` y `colocacion_ojales`
  // vs. la impresión), así que se arman acá y se pasan al visor.
  const modificacionesOverlay = React.useMemo(() => {
    const pasos = item.cotizacion.pasos;
    const demasia = demasiaPorLado(pasos);
    const ojales =
      pasos.flatMap((paso) => paso.ojalesLayout ?? [])[0]?.posiciones ?? [];
    if (!tieneDemasia(demasia) && ojales.length === 0) return undefined;
    return { demasia, ojales };
  }, [item.cotizacion.pasos]);

  const [activeNestingKey, setActiveNestingKey] = React.useState("");
  const bastidorActivo = activeNestingKey === TAB_BASTIDOR_3D;
  const activeNestingTab = bastidorActivo
    ? null
    : (nestingTabs.find((tab) => tab.key === activeNestingKey) ??
      nestingTabs[0] ??
      null);

  // Los tabs de "Disposición de piezas": los del nesting primero y el visor 3D
  // del bastidor al final (cuando el ítem lo tiene). Comparten la misma tira.
  const tabsDisposicion = [
    ...nestingTabs.map((tab) => ({ key: tab.key, label: tab.label })),
    ...(esBastidor ? [{ key: TAB_BASTIDOR_3D, label: "Bastidor 3D" }] : []),
  ];

  React.useEffect(() => {
    const keys = tabsDisposicion.map((tab) => tab.key);
    if (keys.length === 0) return;
    if (!keys.includes(activeNestingKey)) setActiveNestingKey(keys[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNestingKey, tabsDisposicion.map((tab) => tab.key).join()]);

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
            const esTiempoManual =
              paso.tiempo?.origenTiempo === "manual_comercial";
            const detail = paso.tiempo
              ? `${formatTiempoPaso(paso)}${
                  esTiempoManual ? " (estimado por el comercial)" : ""
                } · ${getCentroCostoLabel(paso)}`
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

      {pasosConNesting.length > 0 || esBastidor ? (
        <div className="cost-section">
          {/* Con tabs (nesting + bastidor), la tira de tabs ES el encabezado
              de la sección: el título grande repetía lo que ya dice el tab.
              Con una sola disposición (sin tabs) se mantiene el título. */}
          {tabsDisposicion.length > 1 ? null : (
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
          )}
          <div className="production-nestings">
            {tabsDisposicion.length > 1 ? (
              <div
                className="production-nesting-tabs"
                role="tablist"
                aria-label="Disposición de piezas"
              >
                {tabsDisposicion.map((tab) => {
                  const selected = tab.key === activeNestingKey;
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
            {bastidorActivo ? (
              <div className="production-nesting" key="bastidor3d">
                {/* Estructura local primero (cotización en memoria); el fetch
                    por CotizacionItem/OT-item queda de fallback para ítems
                    rehidratados sin cotización en mano. */}
                <BastidorVisor
                  itemId={item.cotizacionItemId ?? item.id}
                  estructuraLocal={estructuraBastidorLocal}
                />
              </div>
            ) : activeNestingTab ? (
              <div className="production-nesting" key={activeNestingTab.key}>
                {onEditPanels && isPanelEditableStep(activeNestingTab.paso) ? (
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
                  copias={getCopiasItem(item)}
                  costingDetails={activeNestingTab.paso.materiales ?? []}
                  maxPx={
                    activeNestingTab.paso.nestingResult?.substrates[0]?.kind ===
                    "sheet"
                      ? 420
                      : 560
                  }
                  modificaciones={modificacionesOverlay}
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






/**
 * Detalle de un paso `modificacion_pre`: explica por qué el material mide más
 * que lo que pidió el cliente. Es el dato que evita la pregunta "¿por qué esta
 * lona salió más cara si pedí 150×100?".
 */
function MutacionPasoDetail({ mutacion }: { mutacion: MutacionAplicadaView }) {
  const medidas = medidaAntesDespues(mutacion);
  const extra = porcentajeMaterialExtra(mutacion);

  return (
    <div className="cost-detail-block">
      <div className="cost-detail-title">Medida modificada</div>
      <div className="cost-detail-lines">
        <div>{resumenModificacion(mutacion)}</div>
        {medidas ? (
          <div>
            Pedida {formatMmAsCm(medidas.antes.anchoMm)} ×{" "}
            {formatMmAsCm(medidas.antes.altoMm)} cm → material{" "}
            <strong>
              {formatMmAsCm(medidas.despues.anchoMm)} ×{" "}
              {formatMmAsCm(medidas.despues.altoMm)} cm
            </strong>
            {extra !== null && extra > 0
              ? ` (+${formatDecimal(extra, 1)}% de material)`
              : null}
          </div>
        ) : null}
        {mutacion.metrosLinealesUnion > 0 ? (
          <div>
            {formatDecimal(mutacion.metrosLinealesUnion, 2)} ml de unión
            (soldado o pegado)
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PasoCostDetail({ paso }: { paso: PasoCosteo }) {
  const materiales = paso.materiales ?? [];
  const cargos = paso.cargosDirectosPaso ?? [];
  const cargosTotal = sumCargosPaso(paso);
  const tiemposExtra = paso.tiempo?.tiemposExtra ?? [];

  return (
    <div className="cost-step-expanded">
      {paso.mutacionAplicada ? (
        <MutacionPasoDetail mutacion={paso.mutacionAplicada} />
      ) : null}

      <div className="cost-detail-block">
        <div className="cost-detail-title">Materiales del paso</div>
        <MaterialesPasoTable
          materiales={materiales}
          nesting={paso.nestingResult}
        />
      </div>

      {tiemposExtra.length > 0 ? (
        <div className="cost-detail-block">
          <div className="cost-detail-title">
            Tiempo extra del paso (no depende de la cantidad)
          </div>
          <TiemposExtraPasoList bloques={tiemposExtra} />
        </div>
      ) : null}

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
  sinComprobante = false,
}: {
  item: PropuestaItem;
  costo: number;
  calculoPendiente: boolean;
  /** Orden sin comprobante: el waterfall oculta el IVA y cierra en el neto. */
  sinComprobante?: boolean;
}) {
  const { moneda } = useConfigRegional();
  const fmt = (v: number) => formatCurrency(v, moneda);
  // La cuenta vive en @/lib/costos-orden: la comparte con la vista consolidada
  // del tab Costos de la orden, que suma exactamente estos mismos renglones.
  const desglose = calcularCostoItem(item, costo);
  const {
    precioNeto,
    precioBruto,
    ivaTotal,
    impuestosPorFueraNombres,
    filasNeto,
    contribucionMonto: margenContribucionMonto,
    contribucionPct: margenContribucionPct,
  } = desglose;
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

  const pctDelNeto = (monto: number) =>
    precioNeto > 0
      ? `${((monto / precioNeto) * 100).toLocaleString("es-AR", {
          maximumFractionDigits: 1,
        })}%`
      : "—";

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
              {fmt(fila.monto)}
            </span>
          </div>
        ))}
        <div className="cw-row cw-subtotal">
          <span className="cw-label">Precio neto (sin IVA)</span>
          <span className="cw-tipo" />
          <span className="cw-pct">100%</span>
          <span className="cw-amount">{fmt(precioNeto)}</span>
        </div>
        {ivaTotal > 0 && !sinComprobante ? (
          <div className="cw-row">
            <span className="cw-label">
              {impuestosPorFueraNombres || "IVA"}
              <small>se agrega al neto y se discrimina en factura</small>
            </span>
            <span className="cw-tipo">Impuesto</span>
            <span className="cw-pct">+ {pctDelNeto(ivaTotal)}</span>
            <span className="cw-amount">+ {fmt(ivaTotal)}</span>
          </div>
        ) : null}
        <div className="cw-row cw-total">
          <span className="cw-label">
            Precio de venta
            {sinComprobante ? <small>sin comprobante fiscal</small> : null}
          </span>
          <span className="cw-tipo" />
          <span className="cw-pct" />
          <span className="cw-amount">
            {fmt(sinComprobante ? precioNeto : precioBruto)}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 20,
          marginTop: 12,
          padding: "14px 16px",
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "rgba(62, 207, 142, 0.07)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 0,
          }}
        >
          <span style={{ fontWeight: 650, color: "var(--ink)" }}>
            Margen de contribución
          </span>
          <span
            style={{
              fontSize: 11.5,
              lineHeight: 1.4,
              color: "var(--muted)",
              maxWidth: "60ch",
            }}
          >
            Indicador de gestión — no forma parte de la composición del precio.
            Precio neto − costos variables (materiales, proveedor, cargos,
            impuestos internos, comisiones). Es lo que queda para cubrir la
            estructura fija (centro de costo) y dejar ganancia.
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 2,
            flex: "0 0 auto",
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
            {fmt(margenContribucionMonto)}
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {margenContribucionPct.toLocaleString("es-AR", {
              maximumFractionDigits: 1,
            })}
            % del neto
          </span>
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
                // La columna Cargos junta los cargos monetarios y el costo de
                // los bloques de tiempo extra: así se distingue del tiempo de
                // TRABAJO del paso, que es la columna Tiempo.
                const cargosTotal = sumCargosYTiempoExtraPaso(paso);
                const puedeExpandir =
                  paso.activado &&
                  (Boolean(paso.tiempo) ||
                    Boolean(paso.mutacionAplicada) ||
                    (paso.materiales?.length ?? 0) > 0 ||
                    (paso.tiempo?.tiemposExtra?.length ?? 0) > 0 ||
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
                          {paso.tiempo?.origenTiempo === "manual_comercial" ? (
                            <span
                              className="cost-chip"
                              title="El tiempo de este paso lo estimó el comercial al cotizar; no sale del cálculo del motor."
                            >
                              <ClockIcon aria-hidden="true" />
                              Tiempo estimado
                            </span>
                          ) : null}
                          {paso.activadoPorDependencia ? (
                            <span
                              className="cost-chip"
                              title={`Se activó automáticamente porque "${paso.activadoPorDependencia.requeridoPorNombre}" lo necesita. No se puede quitar mientras ese paso esté activo.`}
                            >
                              <LinkIcon aria-hidden="true" />
                              Exigido por{" "}
                              {paso.activadoPorDependencia.requeridoPorNombre}
                            </span>
                          ) : null}
                          {paso.mutacionAplicada ? (
                            <span
                              className="cost-chip"
                              title={`${resumenModificacion(
                                paso.mutacionAplicada,
                              )}. El material se corta más grande que la medida pedida; abrí el paso para ver el detalle.`}
                            >
                              <ExpandIcon aria-hidden="true" />
                              Agranda la medida
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="cost-step-center">
                          <strong>{getCentroCostoLabel(paso)}</strong>
                          <span>{formatTarifaCentroCosto(paso, moneda)}</span>
                        </div>
                      </td>
                      <td className="num">
                        {paso.tiempo ? (
                          <>
                            <strong>{fmt(getCostoTiempoPaso(paso))}</strong>
                            <span>{formatMinutos(paso.tiempo.totalMin)}</span>
                          </>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td className="num">
                        {materialesTotal > 0
                          ? fmt(materialesTotal)
                          : "-"}
                      </td>
                      <td className="num">
                        {cargosTotal > 0 ? fmt(cargosTotal) : "-"}
                      </td>
                      <td className="num strong">
                        {paso.costoTotal > 0
                          ? fmt(paso.costoTotal)
                          : "-"}
                      </td>
                    </tr>
                    {puedeExpandir && expanded ? (
                      <tr className="cost-step-detail-row">
                        <td colSpan={7}>
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

      {/* Sin los bloques de tiempo extra: viven en el detalle del paso, junto
          al tiempo y los materiales que los explican. Acá quedan los cargos en
          PESOS —lo que sale por la puerta—, que es de lo que habla el título. */}
      {cargosPaso.length > 0 || cargosCotizacion.length > 0 ? (
        <div className="cost-section">
          <div className="cost-title">Opcionales y cargos</div>
          <div className="cost-charges">
            {cargosPaso.map((cargo) => (
              <div className="cost-charge" key={`paso-${cargo.cargoCodigo}`}>
                <span>{cargo.cargoNombre}</span>
                <small>{humanizeCodigo(cargo.modoCalculo)}</small>
                <strong>{fmt(cargo.monto)}</strong>
              </div>
            ))}
            {cargosCotizacion.map((cargo) => (
              <div
                className="cost-charge"
                key={`cotizacion-${cargo.cargoCodigo}`}
              >
                <span>{cargo.cargoNombre}</span>
                <small>Cotización</small>
                <strong>{fmt(cargo.monto)}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Specs visibles del item (las mismas filas que muestra la ficha). También
 * son la proyección `specs` que persiste el item de la OT al emitir — la OT
 * muestra exactamente lo que el comercial vio al armarla.
 */
function buildOrdenItemSpecs(
  item: PropuestaItem,
): Array<{ lbl: string; val: string }> {
  const mainMaterial = getMainCommercialMaterial(item);
  const montajeSustrato = getMontajeSustratoMaterial(item);

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

  // 1.b Medida de corte: cuando un paso `modificacion_pre` agrandó la medida
  //     (bolsillo, refuerzo), el operario NO corta lo que pidió el cliente.
  //     Las dos medidas tienen que viajar a la OT o se corta mal.
  //     Ver docs/modificaciones-fisicas-lona-diseno.md §7.
  const cortes = medidasDeCorte(item.cotizacion.pasos);
  if (cortes.length > 0) {
    const valor = cortes
      .map(
        (corte) =>
          `${formatMmAsCm(corte.despues.anchoMm)} × ${formatMmAsCm(
            corte.despues.altoMm,
          )} cm`,
      )
      .join(" · ");
    const medidasIdx = arr.findIndex((spec) =>
      spec.lbl.toLowerCase().includes("medida"),
    );
    const spec = { lbl: "Medida de corte", val: valor };
    if (medidasIdx >= 0) arr.splice(medidasIdx + 1, 0, spec);
    else arr.unshift(spec);
    if (materialIdx >= 0 && medidasIdx >= 0 && materialIdx > medidasIdx) {
      materialIdx += 1;
    }
  }

  // 1.c Modificaciones físicas y ojales: lo que el taller necesita saber del
  //     acabado. El dato más importante es CUÁNTOS ojales lleva el trabajo.
  //     Ver docs/modificaciones-fisicas-lona-diseno.md §7.
  const modificaciones = describirModificaciones(item.cotizacion.pasos);
  for (const descripcion of modificaciones) {
    arr.push({ lbl: "Terminación", val: descripcion });
  }
  const ojales = resumenOjales(item.cotizacion.pasos);
  if (ojales) arr.push({ lbl: "Ojales", val: describirOjales(ojales) });

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

  // 4. Blank comprado (merchandising / textil): producto base + variante
  //    (talle/color/material) al frente, y las estampas al final. Se muestran
  //    aunque el schema del producto no los declare — el dato viaja en la
  //    cotización. Ver docs/ot-merchandising-info-diseno.md
  const identityRows: Array<{ lbl: string; val: string }> = [];
  for (const [key, lbl] of [
    ["producto_tipo", "Tipo de producto"],
    ["producto_base", "Producto base"],
    ["talle", "Talle"],
    ["color_prenda", "Color"],
    ["material_base", "Material base"],
  ] as const) {
    const val = item.especificaciones[key]?.trim();
    if (
      val &&
      !arr.some((spec) => spec.lbl.toLowerCase() === lbl.toLowerCase())
    ) {
      identityRows.push({ lbl, val });
    }
  }
  if (identityRows.length > 0) arr.unshift(...identityRows);
  const estampas = item.especificaciones.personalizaciones?.trim();
  if (estampas && !arr.some((spec) => spec.lbl.toLowerCase() === "estampas")) {
    arr.push({ lbl: "Estampas", val: estampas });
  }

  // Tercerizado: los atributos elegidos (Papel, terminación, …) que resolvió el
  // motor se muestran como specs, para que la ficha/OT reflejen lo que se pidió
  // al proveedor. docs/productos-tercerizados-diseno.md
  let tecnologiaTercerizado: string | null = null;
  for (const paso of item.cotizacion.pasos) {
    if (paso.tecnologiaTercerizado) tecnologiaTercerizado = paso.tecnologiaTercerizado;
    for (const fila of paso.tercerizadoEtiquetas ?? []) {
      if (arr.some((spec) => spec.lbl.toLowerCase() === fila.eje.toLowerCase())) {
        continue;
      }
      arr.push({ lbl: fila.eje, val: fila.valor });
    }
  }
  // Tecnología asignada al tercerizado: pisa la genérica del producto ("Impresión")
  // con el proceso real (ej. Offset), que es lo que clasifican los reportes.
  if (tecnologiaTercerizado) {
    const label = TECNOLOGIA_TERCERIZADO_LABEL[tecnologiaTercerizado] ?? tecnologiaTercerizado;
    const idx = arr.findIndex((spec) => spec.lbl.toLowerCase() === "tecnología");
    if (idx >= 0) arr[idx] = { ...arr[idx], val: label };
    else arr.push({ lbl: "Tecnología", val: label });
  }

  return arr;
}

/** Etiquetas de las tecnologías tercerizables (espejo del selector del editor). */
const TECNOLOGIA_TERCERIZADO_LABEL: Record<string, string> = {
  offset: "Offset",
  serigrafia: "Serigrafía",
  tampografia: "Tampografía",
  sublimacion: "Sublimación",
  bordado: "Bordado",
  laser: "Corte/grabado láser",
  flexografia: "Flexografía",
  termoformado: "Termoformado",
  otra: "Otra",
};

function claveFechaEta(fecha: Date) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

/**
 * Lectura de una ETA simulada contra la fecha elegida: "≈ mar 21/07" (o
 * "~" si corrió con supuestos), la fecha SUGERIDA con el margen del taller
 * (D13: ETA + días hábiles de colchón) y el nivel de alerta — "tarde" si
 * la fecha elegida es anterior a la ETA cruda (no llega), "sin-margen" si
 * cae entre la ETA y la sugerida (llega, pero sin colchón).
 */
function describirEta(
  eta: SimulacionItem | null | undefined,
  fechaElegida: string | null,
  opts?: { margenDias?: number; noLaborables?: Set<string>; zona?: string },
): {
  etiqueta: string;
  sugeridaEtiqueta: string | null;
  nivel: "ok" | "sin-margen" | "tarde";
  aprox: boolean;
  motivo: string;
} | null {
  if (!eta || !eta.finEstimado) return null;
  const fin = eta.finEstimado;
  const margen = opts?.margenDias ?? 0;
  const sugerida = margen > 0 ? sumarDiasHabiles(fin, margen, opts?.noLaborables, opts?.zona) : null;
  const elegida = fechaElegida ? fechaElegida.slice(0, 10) : null;
  const nivel =
    elegida && elegida < claveFechaEta(fin)
      ? "tarde"
      : elegida && sugerida && elegida < claveFechaEta(sugerida)
        ? "sin-margen"
        : "ok";
  const aprox = eta.parcial || eta.asumeDesbloqueo || eta.sinEstimar;
  const motivo = [
    eta.parcial ? "estación sin calendario en la ruta" : null,
    eta.asumeDesbloqueo ? "asume que lo bloqueado se destraba ya" : null,
    eta.sinEstimar ? "hay pasos sin tiempo estimado" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    etiqueta: `${aprox ? "~" : "≈"} ${etiquetaEta(fin)}`,
    sugeridaEtiqueta: sugerida ? etiquetaEta(sugerida) : null,
    nivel,
    aprox,
    motivo,
  };
}

/**
 * Fecha (YYYY-MM-DD) que el sistema recomienda comprometer: la ETA cruda más
 * el colchón de días hábiles del taller — la MISMA fecha "sugerida" que
 * describirEta muestra como recomendación. Es la que sale por defecto en el
 * item y en la OT (el usuario después la puede cambiar).
 */
function fechaRecomendadaEta(
  eta: SimulacionItem | null | undefined,
  opts?: { margenDias?: number; noLaborables?: Set<string>; zona?: string },
): string | null {
  if (!eta || !eta.finEstimado) return null;
  const margen = opts?.margenDias ?? 0;
  const fecha =
    margen > 0
      ? sumarDiasHabiles(eta.finEstimado, margen, opts?.noLaborables, opts?.zona)
      : eta.finEstimado;
  return claveFechaEta(fecha);
}

/** Columnas de la fila/encabezado de productos SIN la columna Imp. (se saca el
 *  110px del IVA). Se aplica inline cuando la orden es sin comprobante, para no
 *  agregar una clase global nueva (rompe css:guard). §6 cuaderno de margen. */
const ORDEN_COLS_SIN_IMP =
  "36px 22px minmax(220px, 1fr) 110px 130px 140px 130px 36px";

export function ProductRow({
  item,
  index,
  expanded,
  etaSistema,
  margenEtaDias = 0,
  noLaborables,
  onToggle,
  onRemove,
  onEdit,
  onDescuento,
  onVerPrecios,
  onEditPanels,
  onChangeFechaEntrega,
  fechaEstimada,
  readOnly = false,
  sinComprobante = false,
}: {
  item: PropuestaItem;
  index: number;
  expanded: boolean;
  /** ETA simulada del item contra las colas del taller (fase 3); null = sin dato. */
  etaSistema?: SimulacionItem | null;
  /** Margen del taller en días hábiles (D13) para el nivel "sin margen". */
  margenEtaDias?: number;
  noLaborables?: Set<string>;
  onToggle: () => void;
  /** Ausentes en modo lectura (OT emitida): la fila no se puede mutar. */
  onRemove?: () => void;
  onEdit?: () => void;
  /** Abre el modal de descuento con esta línea como objetivo. */
  onDescuento?: () => void;
  /** Sólo para ítems de centro de copiado: abre el resumen de precios por hoja. */
  onVerPrecios?: () => void;
  onEditPanels?: (item: PropuestaItem, paso: PanelEditorPaso) => void;
  onChangeFechaEntrega?: (fechaEntrega: string) => void;
  fechaEstimada: string;
  readOnly?: boolean;
  /** Orden sin comprobante fiscal: la fila oculta Imp. y muestra Total neto. */
  sinComprobante?: boolean;
}) {
  const { moneda, zonaHoraria } = useConfigRegional();
  const [innerTab, setInnerTab] = React.useState<InnerTab>("specs");
  const fechaInputRef = React.useRef<HTMLInputElement | null>(null);
  const costo = calcularCostoTotal(item);
  const calculoPendiente = item.precioUnitario === 0 && item.total === 0;
  const tienePrecioEspecial = Boolean(
    item.cotizacion?.desglosePrecio?.precioEspecialCliente,
  );
  const visibleAmounts = React.useMemo(
    () => getItemOrderVisibleAmounts(item),
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
  // Specs visibles (schema + filas sintéticas de materiales/faz/blank):
  // extraídas a buildOrdenItemSpecs para que la emisión de OT persista
  // exactamente estas mismas filas.
  const specs = React.useMemo(() => buildOrdenItemSpecs(item), [item]);

  // Neto por ítem cuando la orden es sin comprobante: Total = subtotal (sin
  // IVA) y el unitario se recalcula sobre el neto. El snapshot no se toca.
  const totalItemVisible = sinComprobante
    ? visibleAmounts.subtotal
    : visibleAmounts.total;

  return (
    <div className={`oprow ${expanded ? "open" : ""}`}>
      <button
        type="button"
        className="oprow-head"
        onClick={onToggle}
        style={
          sinComprobante
            ? { gridTemplateColumns: ORDEN_COLS_SIN_IMP }
            : undefined
        }
      >
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
            {item.varianteNombre ? (
              <span className={ccFicha.variante}>· {item.varianteNombre}</span>
            ) : null}
            {onVerPrecios ? (
              <span
                role="button"
                tabIndex={0}
                className={ccFicha.verPrecios}
                onClick={(event) => {
                  event.stopPropagation();
                  onVerPrecios();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onVerPrecios();
                  }
                }}
                title="Ver precios de impresión por hoja"
              >
                <EyeIcon />
              </span>
            ) : null}
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
          {calculoPendiente ? (
            "A cotizar"
          ) : item.cotizacion.desglosePrecio?.descuento?.aplicado ? (
            <span className={descM.cellDesc}>
              <span className={descM.cellLista}>
                {formatCurrency(
                  visibleAmounts.subtotal +
                    Math.round(
                      item.cotizacion.desglosePrecio.descuento.montoTotal,
                    ),
                  moneda,
                )}
              </span>
              <span className={descM.cellRow}>
                <span className={descM.cellTag}>
                  {item.descuentoInput?.tipo === "PORCENTAJE"
                    ? `−${formatDecimal(item.descuentoInput.valor, 1)}%`
                    : `−${formatCurrency(item.cotizacion.desglosePrecio.descuento.montoTotal, moneda)}`}
                </span>
                <span>{formatCurrency(visibleAmounts.subtotal, moneda)}</span>
              </span>
            </span>
          ) : (
            formatCurrency(visibleAmounts.subtotal, moneda)
          )}
        </div>
        {sinComprobante ? null : (
          <div className="num">
            {calculoPendiente
              ? "-"
              : formatCurrency(visibleAmounts.impuestos, moneda)}
          </div>
        )}
        {/* Precio por unidad de la magnitud cotizada (m², ml, u., hoja): el
            total dividido por la cantidad. Le da al comercial "¿cuánto sale el
            m²/cada folleto?" sin sacar la cuenta a mano. Usa el total visible,
            así unitario × cantidad = total mostrado. */}
        <div className="num">
          {calculoPendiente || item.cantidad <= 0
            ? "—"
            : `${formatUnitPrice(totalItemVisible / item.cantidad, moneda)} / ${formatUnidad(item.unidadMedida)}`}
        </div>
        <div className={`num total${tienePrecioEspecial ? " especial" : ""}`}>
          {calculoPendiente
            ? "Pendiente"
            : formatCurrency(totalItemVisible, moneda)}
        </div>
        {!onRemove ? (
          <span className="x" aria-hidden="true" />
        ) : (
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
        )}
      </button>

      {expanded ? (
        <div className="oprow-body">
          <div className="op-sub">
            {/* Tabs + acciones agrupados a la izquierda: como op-sub queda con un
                único hijo, las acciones caen "a continuación" de los tabs en vez
                de colgar a la derecha. Layout inline para no depender de globals.css
                (Turbopack no recompila ese archivo de forma confiable). */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
            {onEdit ? (
              <button type="button" className="btn-link" onClick={onEdit}>
                <Edit3Icon />
                Editar especificaciones
              </button>
            ) : null}
            </div>
            {/* Descuento al final (derecha). `marginLeft: auto` lo empuja al
                borde sin depender del `justify-content` de op-sub en globals.css
                (Turbopack lo cachea y no lo recompila de forma confiable). */}
            {onDescuento ? (
              <button
                type="button"
                className="btn-link"
                onClick={onDescuento}
                style={{ color: "#c2410c", marginLeft: "auto" }}
              >
                <BadgePercentIcon />
                {item.descuentoInput ? "Editar descuento" : "Descuento"}
              </button>
            ) : null}
          </div>

          {innerTab === "specs" ? (
            <>
              {(() => {
                // Cortas: grilla compacta que se estira al ancho (auto-fit).
                // Largas (caras/modo de color por paso): filas plenas debajo,
                // FUERA de la grilla — un span 1/-1 dentro impediría que
                // auto-fit colapse las columnas vacías de la fila de arriba.
                const esLarga = (spec: (typeof specs)[number]) =>
                  spec.val.length > 40;
                const cortas = specs.filter((spec) => !esLarga(spec));
                const largas = specs.filter(esLarga);
                const renderSpec = (spec: (typeof specs)[number], idx: number) => {
                  const isMedidasSpec = spec.lbl
                    .toLowerCase()
                    .includes("medida");
                  const isModoColorSpec =
                    spec.lbl.toLowerCase().includes("modo de color") ||
                    // Centro de copiado usa "Color" (mismo valor CMYK/B/N).
                    spec.lbl.toLowerCase() === "color";
                  const isCarasSpec =
                    spec.lbl.toLowerCase() === "caras" ||
                    // Centro de copiado usa "Faz" (simple/doble, mismo ícono).
                    spec.lbl.toLowerCase() === "faz";
                  // "Estampas": una personalización por línea (multilínea, como
                  // "Medidas"). Ver docs/ot-merchandising-info-diseno.md
                  const isEstampasSpec = spec.lbl.toLowerCase() === "estampas";
                  return (
                    <div
                      className={`spec ${
                        isModoColorSpec ? "color-mode-spec" : ""
                      } ${esLarga(spec) ? "spec-long" : ""}`}
                      key={`${spec.lbl}-${idx}`}
                    >
                      <div className="spec-head">
                        <div className="lbl">{spec.lbl}</div>
                      </div>
                      <div
                        className={`val ${
                          isMedidasSpec || isEstampasSpec ? "multi" : ""
                        } ${
                          isModoColorSpec ||
                          isCarasSpec ||
                          spec.val.length > 28
                            ? "wrap"
                            : ""
                        }`}
                      >
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
                };
                return (
                  <div className="op-specs">
                    {cortas.length > 0 ? (
                      <div className="op-specs-grid">
                        {cortas.map(renderSpec)}
                      </div>
                    ) : null}
                    {largas.map(renderSpec)}
                  </div>
                );
              })()}

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
                    {readOnly ? (
                      <span className="mval mono">
                        {item.fechaEntrega ?? fechaEstimada}
                      </span>
                    ) : (
                      <input
                        ref={fechaInputRef}
                        className="op-date-input"
                        type="date"
                        value={item.fechaEntrega ?? fechaEstimada}
                        onClick={() => fechaInputRef.current?.showPicker?.()}
                        onChange={(event) =>
                          onChangeFechaEntrega?.(event.target.value)
                        }
                        aria-label={`Fecha estimada de ${item.productoNombre}`}
                      />
                    )}
                  </div>
                  {(() => {
                    const eta = describirEta(etaSistema, item.fechaEntrega ?? fechaEstimada, { margenDias: margenEtaDias, noLaborables, zona: zonaHoraria });
                    if (!eta) return null;
                    return (
                      <div className="op-mini-row">
                        <span className="mlbl">Sistema estima</span>
                        <span
                          className={`mval mono ${eta.nivel === "tarde" ? "eta-tarde" : eta.nivel === "sin-margen" ? "eta-justo" : ""}`}
                          title={eta.motivo || "Simulado contra las colas actuales del taller"}
                        >
                          {eta.etiqueta}
                          {eta.nivel === "tarde" ? " · después de la fecha" : eta.nivel === "sin-margen" ? " · sin margen" : ""}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </>
          ) : null}

          {innerTab === "costos" ? (
            <CostosItemView
              item={item}
              costo={costo}
              calculoPendiente={calculoPendiente}
              sinComprobante={sinComprobante}
            />
          ) : null}

          {innerTab === "produccion" ? (
            <ProduccionItemView
              item={item}
              calculoPendiente={calculoPendiente}
              onEditPanels={
                readOnly ? undefined : (paso) => onEditPanels?.(item, paso)
              }
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

/** Input crudo de un descuento comercial (lo que pide el vendedor). Con
 * `cuponId` viene de un cupón: exento del gate y redimido al emitir. */
type DescuentoInput = {
  tipo: "PORCENTAJE" | "MONTO";
  valor: number;
  cuponId?: string;
  cuponCodigo?: string;
};

/**
 * Proyección del descuento para el MOTOR: sólo { tipo, valor }. El cupón
 * (cuponId/cuponCodigo) es asunto comercial — el DTO del motor no lo conoce
 * y el ValidationPipe (forbidNonWhitelisted) rechaza campos extra.
 */
function descuentoParaMotor(
  input: DescuentoInput | null | undefined,
): { tipo: "PORCENTAJE" | "MONTO"; valor: number } | undefined {
  return input ? { tipo: input.tipo, valor: input.valor } : undefined;
}

/**
 * Margen efectivo por debajo del cual se avisa al aplicar un descuento. Es sólo
 * un aviso blando; el gate duro con aprobación por umbral es F2
 * (`aprobacionDescuentoMaxPct`). Ver docs/descuentos-diseno.md §10.
 */
const DESCUENTO_MARGEN_ALERTA_PCT = 15;

/**
 * Neto de LISTA de la línea (antes del descuento): base para prorratear un
 * descuento de orden por peso. Cae al neto normal / subtotal en snapshots que
 * no traen el bloque de descuento.
 */
function netoListaDeItem(item: PropuestaItem): number {
  const desglose = item.cotizacion.desglosePrecio;
  return (
    desglose?.descuento?.netoListaTotal ??
    desglose?.precioNetoTotal ??
    item.subtotal ??
    0
  );
}

/** Monto del descuento ya resuelto por el motor para la línea (0 si no hubo). */
function descuentoMontoDeItem(item: PropuestaItem): number {
  const descuento = item.cotizacion.desglosePrecio?.descuento;
  return descuento?.aplicado ? descuento.montoTotal : 0;
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

/**
 * Overlay de emisión (diseño Grafo V2 · ordenes.jsx): pasos animados mientras
 * corre la emisión real; el check final aparece recién cuando llega el número
 * de OT asignado por el backend (`numero != null`).
 */
function EmitOverlay({
  numero,
  onDone,
}: {
  numero: string | null;
  onDone: () => void;
}) {
  const [phase, setPhase] = React.useState(0);
  // 0: guardando · 1: asignando Nº · 2: notificando taller · 3: listo · 4: salir
  const STEPS = [
    "Guardando cotización",
    "Asignando número de OT",
    "Notificando al taller",
  ];

  React.useEffect(() => {
    const timers = [
      setTimeout(() => setPhase((p) => Math.max(p, 1)), 620),
      setTimeout(() => setPhase((p) => Math.max(p, 2)), 1240),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // onDone vive en un ref para que el efecto dependa SÓLO de `numero`: si
  // dependiera de `phase`, el cleanup al pasar a fase 3 cancelaría los timers
  // de salida y la redirección nunca dispararía (bug del overlay "clavado").
  const onDoneRef = React.useRef(onDone);
  React.useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  React.useEffect(() => {
    if (numero === null) return;
    const timers = [
      setTimeout(() => setPhase(3), 400),
      setTimeout(() => setPhase(4), 1900),
      setTimeout(() => onDoneRef.current(), 2300),
    ];
    return () => timers.forEach(clearTimeout);
  }, [numero]);

  const done = phase >= 3;

  return (
    <div className={`emit-overlay ${phase >= 4 ? "leaving" : ""}`}>
      <div className="emit-card">
        <div className={`emit-seal ${done ? "done" : ""}`}>
          <span className="ring r1" />
          <span className="ring r2" />
          <span className="ring r3" />
          {done
            ? Array.from({ length: 12 }).map((_, i) => (
                <span
                  key={i}
                  className="spark"
                  style={
                    {
                      "--a": `${i * 30}deg`,
                      "--d": `${(i % 3) * 0.05}s`,
                    } as React.CSSProperties
                  }
                />
              ))
            : null}
          <svg className="emit-check" viewBox="0 0 52 52" width="82" height="82">
            <circle
              className="ec-circle"
              cx="26"
              cy="26"
              r="23"
              fill="none"
              strokeWidth="2.5"
            />
            <path
              className="ec-tick"
              fill="none"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 27 L23 34 L38 18"
            />
          </svg>
        </div>

        <div className="emit-body">
          {!done ? (
            <>
              <div className="emit-title">Emitiendo orden de trabajo…</div>
              <div className="emit-steps">
                {STEPS.map((lbl, i) => {
                  const state = phase > i ? "ok" : phase === i ? "run" : "wait";
                  return (
                    <div key={i} className={`emit-step ${state}`}>
                      <span className="es-dot">
                        {state === "ok" ? (
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        ) : state === "run" ? (
                          <span className="es-spin" />
                        ) : null}
                      </span>
                      <span className="es-lbl">{lbl}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="emit-success">
              <div className="emit-title">¡Orden emitida!</div>
              <div className="emit-nro">{numero}</div>
              <div className="emit-note">
                Enviada al taller · visible en Producción → Órdenes
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Chip honesto del encabezado: la orden no lleva comprobante fiscal. §6 del
 *  cuaderno de margen — nada oculto, se ve de frente. */
function ChipSinComprobante() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        padding: "2px 10px",
        borderRadius: 999,
        background: "#fff7ed",
        color: "#c2410c",
        border: "1px solid #fed7aa",
      }}
      title="Orden sin comprobante fiscal en el sistema."
    >
      <FileXIcon size={13} /> Sin comprobante
    </span>
  );
}

export function ResumenBar({
  items,
  cargosOrden,
  tipo,
  onEmitir,
  onEmitirPresupuesto,
  emitiendo = false,
  onGuardarBorrador,
  guardandoBorrador = false,
  onDescuentoOrden,
  onCuponOrden,
  sinComprobante = false,
  onToggleTratamientoFiscal,
  togglingFiscal = false,
  readOnly = false,
  accionesOrden,
}: {
  items: PropuestaItem[];
  cargosOrden: PropuestaCargoDirecto[];
  tipo: "orden" | "presupuesto";
  /** Ausente en modo lectura (OT emitida): sin acciones de guardado/emisión. */
  onEmitir?: () => void;
  /** Emisión del PRESUPUESTO (toggle en "Presupuesto"). */
  onEmitirPresupuesto?: () => void;
  emitiendo?: boolean;
  onGuardarBorrador?: () => void;
  guardandoBorrador?: boolean;
  /** Abre el modal de descuento a nivel orden (ausente en modo lectura). */
  onDescuentoOrden?: () => void;
  /** Abre el modal directo en modo escaneo de cupón (F4). */
  onCuponOrden?: () => void;
  /** Orden marcada SIN comprobante fiscal: el desglose oculta el IVA y el
   *  total baja al neto. §6 del cuaderno de margen. */
  sinComprobante?: boolean;
  /** Alterna el tratamiento fiscal (FISCAL ↔ SIN_COMPROBANTE). Ausente cuando
   *  la orden ya no admite el cambio (facturada / no editable). */
  onToggleTratamientoFiscal?: () => void;
  togglingFiscal?: boolean;
  readOnly?: boolean;
  /** Acciones de la OT emitida (Editar / Cancelar): van acá, no en el header,
   *  para ganar alto. Sólo en modo lectura. */
  accionesOrden?: React.ReactNode;
}) {
  const { moneda } = useConfigRegional();
  const fmt = (v: number) => formatCurrency(v, moneda);
  const resumen = calcularResumenOrden(items, cargosOrden);
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
  const totalConCargos = productosVisibles.total + resumen.cargosTotal;

  // Las comisiones ya están dentro del subtotal (son parte del precio): no se
  // muestran como línea aparte ni en la barra ni en el desglose del item.
  // Descuento comercial total: suma de lo que resolvió el motor por línea. El
  // subtotal de arriba YA está descontado (el motor lo restó del neto); esta
  // línea es informativa, para que el precio de lista quede a la vista.
  const descuentoTotal = items.reduce(
    (acc, item) => acc + descuentoMontoDeItem(item),
    0,
  );
  // Sin comprobante: se oculta el IVA y el total cae al neto (§6 del cuaderno
  // de margen). El neto es `subtotal` directo (products+cargos sin IVA) — no
  // `total − IVA`, que arrastra el redondeo del IVA y descuadra 1 peso. Se
  // cumple la identidad totalConCargos = subtotal + impuestosVisibles, y este
  // neto coincide con el `total` que persiste el backend.
  const impuestosMostrados = sinComprobante ? 0 : impuestosVisibles;
  const totalMostrado = sinComprobante ? subtotal : totalConCargos;
  const brk = [
    { k: "Subtotal", v: subtotal },
    { k: "Descuento", v: -descuentoTotal },
    { k: "Impuestos", v: impuestosMostrados },
    { k: "Cargos", v: cargos },
  ];

  // Toggle "sin comprobante fiscal" (FileX). Estado, no acción de una vez:
  // aria-pressed + relleno naranja cuando está activo. §6 cuaderno de margen.
  const toggleFiscalBtn = onToggleTratamientoFiscal ? (
    <button
      type="button"
      className="btn"
      onClick={onToggleTratamientoFiscal}
      disabled={togglingFiscal || items.length === 0}
      aria-pressed={sinComprobante}
      aria-label="Sin comprobante fiscal en el sistema"
      title={
        sinComprobante
          ? "Sin comprobante fiscal en el sistema — click o tecla X para volver a fiscal"
          : "Marcar la orden sin comprobante fiscal en el sistema (tecla X)"
      }
      style={
        sinComprobante
          ? { color: "#fff", background: "#c2410c", borderColor: "#c2410c" }
          : { color: "#c2410c" }
      }
    >
      <FileXIcon />
    </button>
  ) : null;

  // Modelo C del diseño: barra anclada al fondo del scroll, con el papel y la
  // constelación del encabezado. La lista de productos corre por detrás y el
  // total nunca se pierde de vista. Ver producto/Resumen financiero.html.
  return (
    <div className={resumenBar.wrap}>
      <ConstelacionCanvas
        className={resumenBar.canvas}
        nodes={34}
        pulses={3}
        cx={0.88}
        cy={0.5}
        radius={1.5}
      />
      <span className={resumenBar.veil} />
      <div className={resumenBar.in}>
        <span className={resumenBar.tot}>
          <span className={resumenBar.totK}>
            Total{sinComprobante ? " (sin comprobante)" : ""}
          </span>
          <span className={resumenBar.totV}>{fmt(totalMostrado)}</span>
        </span>
        <span className={resumenBar.brk}>
          {brk.map((c) => (
            <span
              key={c.k}
              className={`${resumenBar.cell}${c.v !== 0 ? "" : ` ${resumenBar.zero}`}`}
            >
              <span className={resumenBar.cellK}>{c.k}</span>
              <span className={resumenBar.cellV}>{fmt(c.v)}</span>
            </span>
          ))}
        </span>
        {readOnly ? (
          accionesOrden || toggleFiscalBtn ? (
            <span className={resumenBar.acts}>
              {toggleFiscalBtn}
              {accionesOrden}
            </span>
          ) : null
        ) : (
          <span className={resumenBar.acts}>
            {toggleFiscalBtn}
            {onDescuentoOrden ? (
              <button
                type="button"
                className="btn"
                onClick={onDescuentoOrden}
                disabled={emitiendo || items.length === 0}
                aria-label="Aplicar un descuento a toda la orden"
                title={
                  descuentoTotal > 0
                    ? "Descuento aplicado — editar"
                    : "Aplicar un descuento a toda la orden"
                }
                style={{ color: "#c2410c" }}
              >
                <BadgePercentIcon />
              </button>
            ) : null}
            {onCuponOrden ? (
              <button
                type="button"
                className="btn"
                onClick={onCuponOrden}
                disabled={emitiendo || items.length === 0}
                aria-label="Escanear o ingresar un cupón"
                title="Cupón: escaneá el QR o tecleá el código"
                style={{ color: "#c2410c" }}
              >
                <TicketPercentIcon />
              </button>
            ) : null}
            {tipo === "orden" ? (
              <button
                type="button"
                className="btn"
                onClick={onGuardarBorrador}
                disabled={guardandoBorrador || emitiendo || items.length === 0}
              >
                <SaveIcon />
                {guardandoBorrador ? "Guardando…" : "Borrador"}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-primary"
              disabled={emitiendo || items.length === 0}
              onClick={tipo === "orden" ? onEmitir : onEmitirPresupuesto}
            >
              {tipo === "orden" ? (
                <>
                  <CheckIcon />
                  {emitiendo ? "Emitiendo…" : "Emitir OT"}
                </>
              ) : (
                <>
                  <ExternalLinkIcon />
                  {emitiendo ? "Emitiendo…" : "Emitir presupuesto"}
                </>
              )}
            </button>
          </span>
        )}
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
  moneda,
}: {
  cargo: CargoDirectoCatalogo;
  monto: number;
  porcentaje: number;
  precioUnidad: number;
  cantidadInput: number;
  zonaCodigo: string;
  subtotalBase: number;
  nota: string;
  moneda: Moneda;
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
    detalle = `${cantidadInput.toLocaleString("es-AR")} x ${formatCurrency(precioUnidad, moneda)}`;
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
  const { moneda } = useConfigRegional();
  const [cargoId, setCargoId] = React.useState("");
  const selectedCargo = React.useMemo(
    () => cargos.find((cargo) => cargo.id === cargoId) ?? null,
    [cargos, cargoId],
  );
  const zonas = React.useMemo(() => {
    const selectedConfig = getCargoConfig(selectedCargo);
    return Array.isArray(selectedConfig.zonas)
      ? (selectedConfig.zonas as Array<{
          codigo?: string;
          nombre?: string;
          monto?: number;
        }>)
      : [];
  }, [selectedCargo]);
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
  }, [selectedCargo, zonas]);

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
        moneda,
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
                    <strong>{formatCurrency(subtotalBase, moneda)}</strong>
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
                            {formatCurrency(asNumber(zona.monto), moneda)}
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
                  <strong>{formatCurrency(preview.total, moneda)}</strong>
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

/** Qué se va a descontar: abierto desde una fila (item) o desde la barra
 * (orden). `cupon` abre directo en modo escaneo de cupón. */
type DescuentoTarget = {
  scope: "item" | "orden";
  itemId: string | null;
  cupon?: boolean;
};

/**
 * Modal de descuento comercial (F1). Alcance item u orden, % o monto. El preview
 * es sólo monetario (neto de lista → descontado); el margen efectivo y su aviso
 * los resuelve el motor al aplicar (recotización). Ver §10 del diseño.
 */
function DescuentoModal({
  target,
  items,
  clienteId,
  aplicando,
  onClose,
  onApply,
  onApplyCupon,
  onAviso,
}: {
  /** null = cerrado. `scope`/`itemId` fijan el estado inicial del formulario. */
  target: DescuentoTarget | null;
  /** Sólo los items recotizables (con jobContext + motor). */
  items: PropuestaItem[];
  /** Para validar cupones con alcance CLIENTE. */
  clienteId: string | null;
  aplicando: boolean;
  onClose: () => void;
  onApply: (
    scope: "item" | "orden",
    targetItemId: string | null,
    descuento: DescuentoInput | null,
  ) => void;
  /** Cupón validado por el backend, listo para materializar por línea. */
  onApplyCupon: (cupon: Cupon, alcanzadas: string[]) => void;
  /** Los errores de cupón se muestran en el modal centrado, no en toast. */
  onAviso: (aviso: AvisoCupon) => void;
}) {
  const { moneda } = useConfigRegional();
  const [tipo, setTipo] = React.useState<"PORCENTAJE" | "MONTO">("PORCENTAJE");
  const [valor, setValor] = React.useState(0);
  // Cupón (sólo alcance orden): el código define su propio alcance, el
  // backend valida y dice qué líneas toca. El lector 2D tipea + Enter.
  const [modo, setModo] = React.useState<"manual" | "cupon">("manual");
  const [codigoCupon, setCodigoCupon] = React.useState("");
  const [validandoCupon, setValidandoCupon] = React.useState(false);
  const [cuponValidado, setCuponValidado] = React.useState<{
    cupon: Cupon;
    alcanzadas: string[];
  } | null>(null);
  // Modo ESCANEO: input invisible con foco capturando lo que tipea el lector;
  // al Enter valida y aplica directo, sin mostrar el código.
  const [escaneando, setEscaneando] = React.useState(false);
  const scanRef = React.useRef<HTMLInputElement | null>(null);
  const abierto = target != null;

  // Ref con los items para leerlos en el efecto de init sin volverlo a disparar.
  const itemsRefDescuento = React.useRef(items);
  itemsRefDescuento.current = items;

  // El alcance y el item los fija el punto de entrada (la fila o la barra), no el
  // usuario. Init en el flanco de apertura: precarga tipo/valor desde el descuento
  // existente del objetivo (o de cualquiera, si es a nivel orden) para editarlo.
  React.useEffect(() => {
    if (!target) return;
    const itemsRecotizables = itemsRefDescuento.current;
    const ref =
      target.scope === "item"
        ? itemsRecotizables.find((item) => item.id === target.itemId)
        : itemsRecotizables.find((item) => item.descuentoInput);
    if (ref?.descuentoInput) {
      setTipo(ref.descuentoInput.tipo);
      setValor(ref.descuentoInput.valor);
    } else {
      setTipo("PORCENTAJE");
      setValor(0);
    }
    setModo(target.cupon ? "cupon" : "manual");
    setEscaneando(Boolean(target.cupon));
    setCodigoCupon("");
    setCuponValidado(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.scope, target?.itemId, target?.cupon]);

  // El input de escaneo pelea por el foco mientras dura el modo: el lector
  // tipea "a ciegas" y cualquier click no puede robárselo.
  React.useEffect(() => {
    if (!abierto || !escaneando) return;
    const focus = () => scanRef.current?.focus();
    focus();
    const timer = setInterval(focus, 400);
    return () => clearInterval(timer);
  }, [abierto, escaneando]);

  React.useEffect(() => {
    if (!abierto) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto, onClose]);

  if (!abierto) return null;

  const scope = target.scope;
  const itemObjetivo =
    scope === "item"
      ? (items.find((item) => item.id === target.itemId) ?? null)
      : null;
  const objetivoLabel =
    scope === "item"
      ? (itemObjetivo?.productoNombre ?? "Producto")
      : `Toda la orden · ${items.length} ${items.length === 1 ? "producto" : "productos"}`;
  const netoLista =
    scope === "item"
      ? itemObjetivo
        ? netoListaDeItem(itemObjetivo)
        : 0
      : items.reduce((acc, item) => acc + netoListaDeItem(item), 0);
  const descuentoInput: DescuentoInput | null =
    valor > 0 ? { tipo, valor } : null;
  // Preview monetario (no es la matemática de precio del motor, sólo la resta
  // sobre el neto de lista para que el vendedor vea el orden de magnitud).
  const montoPreview =
    tipo === "PORCENTAJE"
      ? (netoLista * Math.min(Math.max(valor, 0), 100)) / 100
      : Math.min(Math.max(valor, 0), netoLista);
  const netoDescontado = Math.max(0, netoLista - montoPreview);
  const hayDescuentoActivo =
    scope === "item"
      ? Boolean(itemObjetivo?.descuentoInput)
      : items.some((item) => item.descuentoInput);

  const handleApply = () => {
    if (scope === "item" && !itemObjetivo) {
      toast.error("No se pudo identificar el producto a descontar.");
      return;
    }
    if (!descuentoInput) {
      toast.error("Ingresá un descuento mayor a cero.");
      return;
    }
    if (tipo === "PORCENTAJE" && valor > 100) {
      toast.error("El porcentaje no puede superar el 100%.");
      return;
    }
    onApply(scope, scope === "item" ? target.itemId : null, descuentoInput);
  };

  // Función plana a propósito: vive después del early return del modal
  // cerrado, así que NO puede ser un hook (rompería el orden de hooks).
  const validarContraCarrito = (codigo: string) =>
    validarCupon({
      codigo,
      clienteId: clienteId ?? undefined,
      items: items.map((item) => ({
        key: item.id,
        productoId: item.motorCodigo || undefined,
        productoCodigo: item.productoCodigo || undefined,
        categoriaCodigo: item.categoriaComercialCodigo || undefined,
        subcategoriaCodigo: item.subcategoriaComercialCodigo || undefined,
        neto: netoListaDeItem(item),
      })),
    });

  const handleValidarCupon = async () => {
    const codigo = codigoCupon.trim();
    if (!codigo) {
      onAviso({
        tipo: "aviso",
        titulo: "Falta el código",
        detalle: "Escaneá el QR del cupón o tecleá su código.",
      });
      return;
    }
    setValidandoCupon(true);
    setCuponValidado(null);
    try {
      setCuponValidado(await validarContraCarrito(codigo));
    } catch (error) {
      onAviso({
        tipo: "error",
        titulo: "Cupón no válido",
        detalle:
          error instanceof Error
            ? error.message
            : "No se pudo validar el cupón.",
      });
    } finally {
      setValidandoCupon(false);
    }
  };

  /** Escaneo: valida y APLICA de una, sin mostrar el código. Si el cupón no
   * pasa, avisa y sigue escuchando (el buffer se limpia solo). */
  const handleEscaneado = async (codigo: string) => {
    if (!codigo.trim() || validandoCupon) return;
    setValidandoCupon(true);
    try {
      const resultado = await validarContraCarrito(codigo.trim());
      onApplyCupon(resultado.cupon, resultado.alcanzadas);
    } catch (error) {
      onAviso({
        tipo: "error",
        titulo: "Cupón no válido",
        detalle:
          error instanceof Error
            ? error.message
            : "No se pudo validar el cupón.",
      });
    } finally {
      setCodigoCupon("");
      setValidandoCupon(false);
    }
  };

  return (
    <div className={descM.overlay} onClick={onClose}>
      <div
        className={descM.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Aplicar descuento"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={descM.close}
          onClick={onClose}
          aria-label="Cerrar"
        >
          <XIcon />
        </button>

        <div className={descM.head}>
          <span className={descM.ico}>
            <BadgePercentIcon />
          </span>
          <div>
            <h2>Aplicar descuento</h2>
            <div className={descM.sub}>
              Reduce la base antes de impuestos. El costo no baja: come margen.
            </div>
          </div>
        </div>

        <div className={descM.body}>
          <div className={descM.target}>
            <span className={descM.targetLbl}>Descuento para</span>
            <strong>{objetivoLabel}</strong>
          </div>

          {/* El cupón define su propio alcance → sólo se ofrece al entrar
              por la orden. Desde una fila, siempre manual. */}
          {scope === "orden" ? (
            <div className={descM.modos}>
              <button
                type="button"
                className={modo === "manual" ? descM.modoOn : ""}
                onClick={() => setModo("manual")}
              >
                Manual
              </button>
              <button
                type="button"
                className={modo === "cupon" ? descM.modoOn : ""}
                onClick={() => setModo("cupon")}
              >
                Cupón
              </button>
            </div>
          ) : null}

          {modo === "manual" ? (
            <>
              <div className={descM.grid2}>
                <div className={descM.field}>
                  <label>Tipo</label>
                  <select
                    value={tipo}
                    onChange={(event) =>
                      setTipo(event.target.value as "PORCENTAJE" | "MONTO")
                    }
                  >
                    <option value="PORCENTAJE">Porcentaje (%)</option>
                    <option value="MONTO">Monto ($)</option>
                  </select>
                </div>
                <div className={descM.field}>
                  <label>
                    {tipo === "PORCENTAJE" ? "Porcentaje" : "Monto neto"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={tipo === "PORCENTAJE" ? "0.5" : "1"}
                    max={tipo === "PORCENTAJE" ? "100" : undefined}
                    value={valor}
                    onChange={(event) =>
                      setValor(Number(event.target.value) || 0)
                    }
                  />
                </div>
              </div>

              <div className={descM.calc}>
                <div>
                  <span className={descM.lbl}>Neto de lista</span>
                  <strong>{formatCurrency(netoLista, moneda)}</strong>
                </div>
                <div className={descM.neg}>
                  <span className={descM.lbl}>Descuento</span>
                  <strong>−{formatCurrency(montoPreview, moneda)}</strong>
                </div>
                <div>
                  <span className={descM.lbl}>Neto con descuento</span>
                  <strong>{formatCurrency(netoDescontado, moneda)}</strong>
                </div>
              </div>

              <div className={descM.note}>
                {scope === "orden"
                  ? tipo === "MONTO"
                    ? "Se reparte entre los productos según su peso."
                    : "Se aplica el mismo porcentaje a cada producto."
                  : "El margen resultante se recalcula al aplicar."}
                <small>
                  Impuestos y comisiones se recalculan sobre el neto descontado.
                </small>
              </div>
            </>
          ) : escaneando ? (
            <>
              {/* Escaneo: input invisible que captura al lector; el código
                  nunca se muestra — valida y aplica de una. */}
              <div className={descM.scan}>
                <input
                  ref={scanRef}
                  className={descM.scanInput}
                  type="text"
                  value={codigoCupon}
                  onChange={(event) =>
                    setCodigoCupon(event.target.value.toUpperCase())
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleEscaneado(codigoCupon);
                    }
                  }}
                  aria-label="Escaneá el cupón"
                />
                <span
                  className={`${descM.scanBox}${validandoCupon ? ` ${descM.scanOk}` : ""}`}
                >
                  <TicketPercentIcon />
                  <span className={descM.scanLine} />
                </span>
                <strong>
                  {validandoCupon ? "Validando…" : "Escaneá el cupón"}
                </strong>
                <small>
                  Apuntá el lector al QR: se valida y aplica solo.
                </small>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => {
                    setEscaneando(false);
                    setCodigoCupon("");
                  }}
                >
                  Ingresar el código a mano
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={descM.field}>
                <label>Código del cupón</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Tecleá o escaneá el QR…"
                  value={codigoCupon}
                  onChange={(event) => {
                    setCodigoCupon(event.target.value.toUpperCase());
                    setCuponValidado(null);
                  }}
                  onKeyDown={(event) => {
                    // El lector 2D tipea el código y manda Enter: valida solo.
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleValidarCupon();
                    }
                  }}
                />
              </div>
              {cuponValidado ? (
                <div className={descM.calc}>
                  <div>
                    <span className={descM.lbl}>Cupón</span>
                    <strong>{cuponValidado.cupon.codigo}</strong>
                  </div>
                  <div className={descM.neg}>
                    <span className={descM.lbl}>Descuento</span>
                    <strong>
                      {cuponValidado.cupon.tipo === "PORCENTAJE"
                        ? `−${cuponValidado.cupon.valor.toLocaleString("es-AR")}%`
                        : `−${formatCurrency(cuponValidado.cupon.valor, moneda)}`}
                    </strong>
                  </div>
                  <div>
                    <span className={descM.lbl}>Alcanza</span>
                    <strong>
                      {cuponValidado.alcanzadas.length} de {items.length}
                    </strong>
                  </div>
                </div>
              ) : null}
              <div className={descM.note}>
                {cuponValidado
                  ? (cuponValidado.cupon.descripcion ??
                    "Validado: se aplica a las líneas del alcance y se redime al emitir la orden.")
                  : "El cupón valida vigencia, usos y alcance contra esta orden. Si alguna línea tenía descuento manual, el cupón lo reemplaza."}
              </div>
            </>
          )}
        </div>

        <div className={descM.foot}>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          {hayDescuentoActivo ? (
            <button
              type="button"
              className="btn"
              disabled={aplicando}
              onClick={() =>
                onApply(scope, scope === "item" ? target.itemId : null, null)
              }
            >
              <Trash2Icon />
              Quitar
            </button>
          ) : null}
          <div className={descM.spacer} />
          {modo === "manual" ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApply}
              disabled={aplicando || items.length === 0}
            >
              <BadgePercentIcon />
              {aplicando ? "Aplicando…" : "Aplicar descuento"}
            </button>
          ) : cuponValidado ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={aplicando}
              onClick={() =>
                onApplyCupon(cuponValidado.cupon, cuponValidado.alcanzadas)
              }
            >
              <TicketPercentIcon />
              {aplicando ? "Aplicando…" : "Aplicar cupón"}
            </button>
          ) : escaneando ? null : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={validandoCupon || codigoCupon.trim().length === 0}
              onClick={() => void handleValidarCupon()}
            >
              {validandoCupon ? "Validando…" : "Validar cupón"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Rehidratación (modo orden) ───────────
   OrdenTrabajoProducto → PropuestaItem: la OT emitida se muestra con esta
   misma ficha. Specs persistidas → schema sintético (mismas filas que vio el
   comercial); pasos/costos desde el snapshot del CotizacionItem. Sin snapshot
   (OT histórica) la fila degrada con gracia: specs sí, costos vacíos. */

function unidadDesdeCorta(cantidadUnidad: string): UnidadPropuesta {
  if (cantidadUnidad === "m²") return "m2";
  if (cantidadUnidad === "ml") return "metro_lineal";
  if (cantidadUnidad === "libros") return "libros";
  if (cantidadUnidad === "hojas") return "hojas";
  return "unidad";
}

/**
 * Proyección persistible de un item (misma forma que usa la emisión): montos
 * visibles + specs curadas. Compartida entre emitir, agregar y editar item.
 */
function itemToOrdenItemPayload(
  item: PropuestaItem,
  cotizacionItemId: string | undefined,
) {
  const amounts = getItemOrderVisibleAmounts(item);
  // El descuento YA está dentro de `subtotal` (el motor lo aplicó sobre el
  // neto): estos campos son la traza persistida (tipo/valor que pidió el
  // comercial + el monto que resolvió el motor), no se vuelven a restar.
  const descuento = item.cotizacion.desglosePrecio?.descuento;
  return {
    cotizacionItemId,
    descuentoTipo: item.descuentoInput?.tipo ?? null,
    descuentoValor: item.descuentoInput?.valor ?? null,
    descuentoMonto:
      item.descuentoInput && descuento?.aplicado
        ? Math.round(descuento.montoTotal)
        : null,
    descuentoCuponId: item.descuentoInput?.cuponId ?? null,
    codigo: item.productoCodigo,
    nombre: item.productoNombre,
    familia:
      item.subcategoriaComercialNombre ||
      item.categoriaComercialNombre ||
      "—",
    categoriaComercial: item.categoriaComercialNombre,
    subcategoriaComercial: item.subcategoriaComercialNombre,
    cantidad: item.cantidad,
    cantidadUnidad: formatUnidad(item.unidadMedida),
    subtotal: amounts.subtotal,
    impuestos: amounts.impuestos,
    total: amounts.total,
    specs: buildOrdenItemSpecs(item).map((spec) => ({
      etiqueta: spec.lbl,
      valor: spec.val,
    })),
    adicionales: item.adicionales,
  };
}

/** Sólo manda decisiones del comercial; el backend construye el snapshot. */
function cargoToOrdenInput(cargo: PropuestaCargoDirecto) {
  return {
    cargoDirectoCatalogoId: cargo.cargoDirectoCatalogoId,
    configInput: cargo.configSnapshot,
    cantidadInput: cargo.cantidadInput,
    montoNeto: cargo.montoNeto,
    nota: cargo.nota,
  };
}

/**
 * Campos editables según estado — espejo de camposEditables() del backend.
 * borrador/pendiente: datos comerciales; produccion: fecha y observaciones;
 * finalizada/entregada: nada.
 */
function camposEditablesOrden(
  estado: OrdenTrabajoDetalle["estado"],
): Set<string> {
  switch (estado) {
    case "borrador":
    case "pendiente":
      return new Set([
        "clienteId",
        "vendedorEmpleadoId",
        "canalVenta",
        "fechaEntrega",
        "observaciones",
      ]);
    case "produccion":
      return new Set(["fechaEntrega", "observaciones"]);
    default:
      return new Set();
  }
}

/** Vendedor visible: el asignado, o quien emitió (primer evento de emisión). */
function vendedorOrdenNombre(orden: OrdenTrabajoDetalle) {
  if (orden.vendedorNombre && orden.vendedorNombre !== "—") {
    return orden.vendedorNombre;
  }
  const emisor = orden.eventos.find((ev) => ev.tipo === "emision");
  return emisor?.usuarioNombre ?? "—";
}

/**
 * Nota badge NUEVA: vive en el LISTADO (ordenes-trabajo-view, 24h+pendiente).
 * En el detalle, "RECIÉN EMITIDA" es de sesión: sólo al llegar de emitir.
 */
type SnapshotResumenOrden = {
  producto?: { id?: string; codigo?: string; nombre?: string };
  ruta?: { nombre?: string; alternativa?: string | null };
  ejecucion?: {
    cantidadEfectiva?: number;
    cantidadPedida?: number;
    cantidadComercialReal?: number;
    cantidadComercialPricing?: number;
    unidadComercialPricing?: string;
    minimoComercialAplicado?: unknown;
    costos?: CotizacionPropuestaSnapshot["costos"];
  };
};

type SnapshotTrazabilidadOrden = {
  pasos?: CotizacionPropuestaSnapshot["pasos"];
  cargosDirectosCotizacion?: CotizacionPropuestaSnapshot["cargosDirectosCotizacion"];
};

function rehidratarOrdenItem(
  producto: OrdenTrabajoProducto,
  index: number,
): PropuestaItem {
  const snap = producto.snapshot ?? null;
  const resumen = (snap?.resumen ?? null) as SnapshotResumenOrden | null;
  const trazabilidad = (snap?.trazabilidad ??
    null) as SnapshotTrazabilidadOrden | null;

  const costosVacios = {
    tiempoTotal: 0,
    materialesTotal: 0,
    cargosDirectosTotal: 0,
    total: snap?.costoTotal ?? 0,
    unitario: snap?.costoUnitario ?? 0,
  } as CotizacionPropuestaSnapshot["costos"];

  const impuestosSnapshot = snap?.precioSnapshots.impuestos;
  const comisionesSnapshot = snap?.precioSnapshots.comisiones;

  // Reconstrucción del desglose de precio con la MISMA matemática de
  // AplicarPrecioService, a partir de lo persistido: neto (subtotal), bruto
  // (precioUnitario/Total), costo, y los snapshots de impuestos/comisiones
  // (con traslado y base de cálculo). Sin esto, el waterfall de Costos
  // muestra márgenes absurdos (precioBase=0 ⇒ margen = −costo).
  const cantidadPricing =
    resumen?.ejecucion?.cantidadComercialPricing ?? producto.cantidad;
  const descuentoMontoPersistido = Math.max(0, producto.descuentoMonto ?? 0);
  const netoUnit =
    cantidadPricing > 0 ? producto.subtotal / cantidadPricing : 0;
  const brutoUnit =
    snap?.precioUnitario ??
    (cantidadPricing > 0 ? producto.total / cantidadPricing : 0);
  const impuestosLista = (
    Array.isArray(impuestosSnapshot) ? impuestosSnapshot : []
  ) as Array<{
    porcentaje?: number;
    traslado?: string;
    baseCalculo?: string;
  }>;
  const comisionesLista = (
    Array.isArray(comisionesSnapshot) ? comisionesSnapshot : []
  ) as Array<{ porcentaje?: number; baseCalculo?: string }>;
  let internosNetoPct = 0;
  let internosBrutoPct = 0;
  for (const impuesto of impuestosLista) {
    if ((impuesto.traslado ?? "POR_DENTRO") === "POR_FUERA") continue;
    if ((impuesto.baseCalculo ?? "NETO") === "BRUTO_COBRADO") {
      internosBrutoPct += impuesto.porcentaje ?? 0;
    } else {
      internosNetoPct += impuesto.porcentaje ?? 0;
    }
  }
  let comisionesNetoPct = 0;
  let comisionesBrutoPct = 0;
  for (const comision of comisionesLista) {
    if ((comision.baseCalculo ?? "NETO") === "BRUTO_COBRADO") {
      comisionesBrutoPct += comision.porcentaje ?? 0;
    } else {
      comisionesNetoPct += comision.porcentaje ?? 0;
    }
  }
  const costosInternosUnit =
    (netoUnit * internosNetoPct) / 100 + (brutoUnit * internosBrutoPct) / 100;
  const comisionesUnit =
    (netoUnit * comisionesNetoPct) / 100 +
    (brutoUnit * comisionesBrutoPct) / 100;
  const precioBaseUnit = netoUnit - costosInternosUnit - comisionesUnit;
  const costoUnit = snap?.costoUnitario ?? 0;
  const margenEfectivoPct =
    netoUnit > 0 ? ((precioBaseUnit - costoUnit) / netoUnit) * 100 : 0;
  const totalImpuestosUnit = Math.max(0, brutoUnit - netoUnit) + costosInternosUnit;

  const cotizacion = {
    productoId: snap?.productoId ?? producto.codigo,
    productoNombre: producto.nombre,
    rutaAlternativaId: snap?.rutaAlternativaId ?? null,
    rutaNombre:
      resumen?.ruta?.alternativa ?? resumen?.ruta?.nombre ?? "Ruta estándar",
    cantidadEfectiva: resumen?.ejecucion?.cantidadEfectiva ?? producto.cantidad,
    cantidadPedida: resumen?.ejecucion?.cantidadPedida ?? producto.cantidad,
    cantidadComercialReal:
      resumen?.ejecucion?.cantidadComercialReal ?? producto.cantidad,
    cantidadComercialPricing:
      resumen?.ejecucion?.cantidadComercialPricing ?? producto.cantidad,
    unidadComercialPricing:
      resumen?.ejecucion?.unidadComercialPricing ??
      unidadDesdeCorta(producto.cantidadUnidad),
    minimoComercialAplicado:
      (resumen?.ejecucion
        ?.minimoComercialAplicado as CotizacionPropuestaSnapshot["minimoComercialAplicado"]) ??
      null,
    costos: resumen?.ejecucion?.costos ?? costosVacios,
    pasos: trazabilidad?.pasos ?? [],
    cargosDirectosCotizacion: trazabilidad?.cargosDirectosCotizacion ?? [],
    desglosePrecio: snap
      ? ({
          precioConfig:
            (snap.precioSnapshots.precioConfig as NonNullable<
              CotizacionPropuestaSnapshot["desglosePrecio"]
            >["precioConfig"]) ?? null,
          impuestos: Array.isArray(impuestosSnapshot) ? impuestosSnapshot : [],
          comisiones: Array.isArray(comisionesSnapshot)
            ? comisionesSnapshot
            : [],
          precioEspecialCliente:
            (snap.precioSnapshots.precioEspecialCliente as never) ?? null,
          precioBase: precioBaseUnit,
          totalComisiones: comisionesUnit,
          totalImpuestos: totalImpuestosUnit,
          margenEfectivoPct,
          precioNetoUnitario: netoUnit,
          precioBrutoUnitario: brutoUnit,
          precioNetoTotal: producto.subtotal,
          precioBrutoTotal: snap.precioTotal ?? producto.total,
          // Descuento persistido (F1.3 escribió tipo/valor/monto en el item). El
          // subtotal ya viene descontado, así que el neto de LISTA se reconstruye
          // sumándole el monto. Sin descuento persistido, no-op (lista = neto).
          descuento: {
            aplicado: descuentoMontoPersistido > 0,
            montoUnitario:
              cantidadPricing > 0 ? descuentoMontoPersistido / cantidadPricing : 0,
            montoTotal: descuentoMontoPersistido,
            netoListaUnitario:
              cantidadPricing > 0
                ? (producto.subtotal + descuentoMontoPersistido) / cantidadPricing
                : netoUnit,
            netoListaTotal: producto.subtotal + descuentoMontoPersistido,
          },
        } as NonNullable<CotizacionPropuestaSnapshot["desglosePrecio"]>)
      : undefined,
  } as CotizacionPropuestaSnapshot;

  return {
    // Id REAL del OrdenTrabajoItem (para editar/quitar); fallback sintético
    // sólo para órdenes previas al campo.
    id: producto.id ?? `ot-item-${index}`,
    cotizacionItemId: producto.cotizacionItemId ?? undefined,
    productoNombre: producto.nombre,
    productoCodigo: producto.codigo,
    motorCodigo: snap?.productoId ?? "",
    categoriaComercialCodigo: "",
    // Órdenes viejas (pre categoriaComercial persistida) caen a `familia`.
    categoriaComercialNombre: producto.categoriaComercial || producto.familia,
    subcategoriaComercialCodigo: "",
    subcategoriaComercialNombre:
      producto.subcategoriaComercial || producto.familia,
    unidadMedida: unidadDesdeCorta(producto.cantidadUnidad),
    cantidad: producto.cantidad,
    precioUnitario:
      producto.cantidad > 0 ? producto.total / producto.cantidad : 0,
    subtotal: producto.subtotal,
    impuestoPorcentaje:
      producto.subtotal > 0
        ? (producto.impuestos / producto.subtotal) * 100
        : 0,
    impuestoMonto: producto.impuestos,
    total: producto.total,
    especificaciones: Object.fromEntries(
      producto.specs.map((spec, i) => [`spec_${i}`, spec.valor]),
    ),
    atributosSchema: producto.specs.map((spec, i) => ({
      key: `spec_${i}`,
      label: spec.etiqueta,
      tipo: "text",
      visible: true,
      orden: i,
    })),
    cotizacion,
    pasos: trazabilidad?.pasos ? getCotizacionPasos(cotizacion) : [],
    adicionales: producto.adicionales,
    rutaAlternativaId: snap?.rutaAlternativaId ?? null,
    jobContext: (snap?.jobContext as Record<string, unknown>) ?? undefined,
    // Descuento que aplicó el vendedor (para reeditarlo si se recotiza el ítem).
    descuentoInput:
      producto.descuentoTipo && producto.descuentoValor != null
        ? {
            tipo: producto.descuentoTipo,
            valor: producto.descuentoValor,
            cuponId: producto.descuentoCuponId ?? undefined,
          }
        : undefined,
  };
}

export function PropuestaFicha({
  initialClientes = [],
  initialProductos = [],
  initialCargosDirectos = [],
  currentUser = null,
  initialLoadErrors = [],
  orden: ordenProp,
  recienEmitida = false,
  recienConvertida = false,
}: PropuestaFichaProps) {
  const { moneda, zonaHoraria } = useConfigRegional();
  const formatEventoFecha = useFormatEventoFecha();
  // La OT vive en estado local (inicializada desde el prop del server) para
  // poder refrescar el header/stepper en vivo sin recargar la página cuando
  // una acción interna cambia su estado (ej: avance de compra tercerizada).
  const [orden, setOrden] = React.useState(ordenProp);
  React.useEffect(() => {
    setOrden(ordenProp);
  }, [ordenProp]);
  const recargarOrden = React.useCallback(() => {
    if (!ordenProp?.id) return;
    getOrdenTrabajo(ordenProp.id)
      .then(setOrden)
      .catch(() => {});
  }, [ordenProp?.id]);
  const modoOrden = Boolean(orden);
  // Sin comprobante fiscal (§6 cuaderno de margen). En creación es estado de
  // cliente que viaja en el payload de crear; en una OT persistida se sincroniza
  // desde el flag y se alterna vía endpoint.
  const [sinComprobante, setSinComprobante] = React.useState(
    ordenProp?.tratamientoFiscal === "SIN_COMPROBANTE",
  );
  React.useEffect(() => {
    if (orden) setSinComprobante(orden.tratamientoFiscal === "SIN_COMPROBANTE");
  }, [orden]);
  const [togglingFiscal, setTogglingFiscal] = React.useState(false);
  const toggleTratamientoFiscal = React.useCallback(async () => {
    const siguiente = sinComprobante ? "FISCAL" : "SIN_COMPROBANTE";
    if (orden?.id) {
      setTogglingFiscal(true);
      try {
        const actualizada = await setTratamientoFiscalOrden(orden.id, siguiente);
        setOrden(actualizada);
        setSinComprobante(siguiente === "SIN_COMPROBANTE");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo cambiar el tratamiento fiscal.",
        );
      } finally {
        setTogglingFiscal(false);
      }
    } else {
      setSinComprobante((v) => !v);
    }
  }, [orden?.id, sinComprobante]);
  const puedeToggleFiscal =
    !modoOrden ||
    (orden ? ["borrador", "pendiente"].includes(orden.estado) : false);
  // Atajo de teclado: X alterna sin comprobante, para quien prefiere no ir al
  // botón. Se ignora mientras se escribe (input/textarea/select/editable) y con
  // modificadoras (no pisar Ctrl/Cmd+X).
  React.useEffect(() => {
    if (!puedeToggleFiscal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "x" && e.key !== "X") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el?.isContentEditable
      )
        return;
      if (togglingFiscal) return;
      e.preventDefault();
      void toggleTratamientoFiscal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [puedeToggleFiscal, togglingFiscal, toggleTratamientoFiscal]);
  // null hasta que el tab de Archivos se abre y los cuenta: la pestaña no
  // muestra badge mientras no sepa el número real.
  const [archivosCount, setArchivosCount] = React.useState<number | null>(null);
  // Tag "RECIÉN EMITIDA": sólo en la visita inmediata a la emisión (llegada
  // con ?emitida=1, o al emitir un borrador acá mismo). El param se limpia
  // de la URL para que un refresh/compartir no lo arrastre.
  const [mostrarRecienEmitida, setMostrarRecienEmitida] =
    React.useState(recienEmitida);
  React.useEffect(() => {
    if (!recienEmitida) return;
    window.history.replaceState(null, "", window.location.pathname);
  }, [recienEmitida]);
  // Aviso "quedó en borrador" al llegar desde una conversión. Sólo si la
  // orden SIGUE en borrador: si alguien recarga con el param después de
  // emitirla, no tiene sentido avisar. El param se limpia igual que el de
  // emisión, para que un refresh o un link compartido no lo reabran.
  const [avisoBorradorAbierto, setAvisoBorradorAbierto] = React.useState(
    recienConvertida && ordenProp?.estado === "borrador",
  );
  React.useEffect(() => {
    if (!recienConvertida) return;
    window.history.replaceState(null, "", window.location.pathname);
  }, [recienConvertida]);
  const [tipo, setTipo] = React.useState<TipoPropuesta>("orden_trabajo");
  const ordenTipo = tipoMap[tipo];
  const [tab, setTab] = React.useState<OrdenTab>("productos");
  // QR que el cliente presenta en el mostrador para retirar.
  const [qrRetiroOpen, setQrRetiroOpen] = React.useState(false);
  // Cobros en staging (sólo creación): se registran todos al emitir la OT,
  // como los items. El backend rechaza cobros sobre borradores, así que
  // guardar borrador NO los persiste (se avisa con modal).
  const [cobrosStaged, setCobrosStaged] = React.useState<CobroDraft[]>([]);
  const [confirmBorradorConCobros, setConfirmBorradorConCobros] =
    React.useState(false);
  const { fechaHora } = useFecha();
  // Acreditar una factura ante ARCA no es cosa de cualquiera: es el mismo
  // permiso que rige anular comprobantes.
  const puedeAnular = usePuede("administracion.anular");
  const [confirmCancelar, setConfirmCancelar] = React.useState(false);
  const [cancelando, setCancelando] = React.useState(false);
  const [openIds, setOpenIds] = React.useState<Set<string>>(() => new Set());
  const [items, setItems] = React.useState<PropuestaItem[]>(() =>
    orden ? orden.productos.map(rehidratarOrdenItem) : [],
  );
  const [cargosOrden, setCargosOrden] = React.useState<PropuestaCargoDirecto[]>(
    () =>
      orden?.cargos?.length
        ? orden.cargos
        : orden && orden.cargosDirectos > 0
        ? [
            {
              id: "ot-cargos",
              cargoDirectoCatalogoId: "",
              codigoSnapshot: "cargos_orden",
              nombreSnapshot: "Cargos directos de la orden",
              modoCalculoSnapshot: "MONTO_FIJO_PLANO",
              configSnapshot: {},
              baseCalculo: 0,
              montoNeto: orden.cargosDirectos,
              impuestoPorcentaje: 0,
              impuestoMonto: 0,
              total: orden.cargosDirectos,
              detalle: "Persistido al emitir la orden",
              createdAt: orden.creadaEl,
            },
          ]
        : [],
  );
  const totalPropuesta = React.useMemo(() => {
    const r = calcularResumenOrden(items, cargosOrden);
    // Sin comprobante: el saldo a cobrar es el neto, sin IVA (§6 cuaderno de
    // margen) — así los Pagos no muestran una deuda inflada con impuestos.
    return sinComprobante ? r.total - r.impuestos : r.total;
  }, [items, cargosOrden, sinComprobante]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [copiadoOpen, setCopiadoOpen] = React.useState(false);
  // Módulo activo (config del tenant): esconde el botón/atajo si está pausado.
  // Fail-open: ante error de red se asume activo (no esconder por un glitch).
  const [ccActivo, setCcActivo] = React.useState(true);
  React.useEffect(() => {
    let vivo = true;
    void estadoCentroCopiado()
      .then((e) => {
        if (vivo) setCcActivo(e.activo);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  // Resumen de precios de impresión por hoja (modal OT-wide).
  const [preciosOpen, setPreciosOpen] = React.useState(false);
  // Edición: la CARGA completa (todos los renglones que entraron juntos).
  const [copiadoEditItems, setCopiadoEditItems] = React.useState<
    PropuestaItem[] | null
  >(null);
  const [cargoOpen, setCargoOpen] = React.useState(false);
  const [descuentoTarget, setDescuentoTarget] =
    React.useState<DescuentoTarget | null>(null);
  const [descuentoAplicando, setDescuentoAplicando] = React.useState(false);
  // Los avisos de cupón van en modal centrado, no en toast: el escaneo pasa
  // con el vendedor mirando el lector y el cliente enfrente.
  const [avisoCupon, setAvisoCupon] = React.useState<AvisoCupon | null>(null);
  const [editingItem, setEditingItem] = React.useState<PropuestaItem | null>(
    null,
  );
  const [panelEditor, setPanelEditor] = React.useState<{
    item: PropuestaItem;
    paso: PanelEditorPaso;
  } | null>(null);
  const [panelSaving, setPanelSaving] = React.useState(false);
  const [clienteId, setClienteId] = React.useState(orden?.clienteId ?? "");
  // Clientes dados de alta escaneando el DNI durante ESTA sesión: no vienen
  // en `initialClientes` (se cargó en el server) y sin esto el combobox no
  // tendría cómo mostrar al recién creado.
  const [clientesEscaneados, setClientesEscaneados] = React.useState<
    ClienteDetalle[]
  >([]);

  // El modal del DNI vive en el layout —el lector anda en cualquier
  // pantalla—, así que avisa por evento y la ficha abierta se lo pone como
  // cliente de la orden.
  React.useEffect(() => {
    const onEscaneado = (event: Event) => {
      const cliente = (event as CustomEvent<ClienteDetalle>).detail;
      if (!cliente?.id) return;
      setClientesEscaneados((prev) =>
        prev.some((c) => c.id === cliente.id) ? prev : [...prev, cliente],
      );
      setClienteId(cliente.id);
      toast.success(`${cliente.nombre} quedó como cliente de la orden.`);
    };
    window.addEventListener(CLIENTE_ESCANEADO_EVENT, onEscaneado);
    return () =>
      window.removeEventListener(CLIENTE_ESCANEADO_EVENT, onEscaneado);
  }, []);

  const clientesDisponibles = React.useMemo(
    () =>
      clientesEscaneados.length === 0
        ? initialClientes
        : [...initialClientes, ...clientesEscaneados],
    [initialClientes, clientesEscaneados],
  );
  const [canalVenta, setCanalVenta] = React.useState(
    orden?.canalVenta ?? "mostrador",
  );
  const [fechaEstimada, setFechaEstimada] = React.useState(
    () => orden?.fechaEntrega ?? offsetDate(7),
  );
  const creacionDefaultsRef = React.useRef({
    canalVenta,
    fechaEstimada,
  });

  // ── Demora estimada por el sistema (fase 3, simulación de flujo) ──────
  // Sólo en creación/borrador: una orden emitida ya está EN las colas del
  // tablero — volver a simularla la contaría dos veces (D10 del doc).
  const conDemoraSistema = !orden || orden.estado === "borrador";
  const [colasTaller, setColasTaller] = React.useState<{
    enCola: TableroItemData[];
    estaciones: Estacion[];
    medianas: Map<string, number>;
    noLaborables: Set<string>;
  } | null>(null);
  const [margenEtaDias, setMargenEtaDias] = React.useState(0);
  React.useEffect(() => {
    if (!conDemoraSistema) return;
    let vigente = true;
    void Promise.all([
      getTableroProduccion(),
      getEstaciones(),
      getDuracionesFamilias(),
      getDiasNoLaborables(),
      getConfiguracionProduccion(),
    ])
      .then(([tablero, estaciones, duraciones, diasNoLaborables, config]) => {
        if (!vigente) return;
        setMargenEtaDias(config.margenEtaDias);
        setColasTaller({
          enCola: tablero.items,
          estaciones,
          medianas: new Map(duraciones.map((d) => [d.familiaCodigo, d.medianaMin])),
          noLaborables: new Set(diasNoLaborables.map((dia) => dia.fecha)),
        });
      })
      .catch(() => {
        // Sin datos de colas no hay sugerencia; la ficha sigue funcionando.
      });
    return () => {
      vigente = false;
    };
  }, [conDemoraSistema]);

  /** ETA por item de la ficha, simulada contra las colas reales de HOY. */
  const demoraPorItem = React.useMemo(() => {
    if (!conDemoraSistema || !colasTaller || items.length === 0) return null;
    const nuevos = items.map((item) => ({
      id: item.id,
      pasos: (item.cotizacion?.pasos ?? [])
        .filter((paso) => paso.activado)
        .map((paso) => ({
          familiaCodigo: paso.familiaCodigo || "trabajo_manual",
          centroCostoId: paso.tiempo?.centroCostoId ?? null,
          duracionMin: paso.tiempo?.totalMin ?? null,
          nombre: paso.nombreVisible ?? undefined,
          // Un tercerizado no ocupa el taller: aporta el plazo del proveedor.
          tercerizado: paso.tercerizado === true,
          plazoProveedorDias: paso.plazoProveedorDias ?? null,
        })),
    }));
    return estimarDemoraNuevos({ nuevos, ...colasTaller, zona: zonaHoraria });
  }, [conDemoraSistema, colasTaller, items, zonaHoraria]);

  /** ETA de la ORDEN completa = el item que termina último. */
  const demoraOrden = React.useMemo<SimulacionItem | null>(() => {
    if (!demoraPorItem || demoraPorItem.size === 0) return null;
    let fin: Date | null = null;
    let sinEstimar = false;
    let parcial = false;
    let asumeDesbloqueo = false;
    for (const eta of demoraPorItem.values()) {
      if (eta.sinEstimar || eta.finEstimado === null) sinEstimar = true;
      else if (fin === null || eta.finEstimado > fin) fin = eta.finEstimado;
      parcial ||= eta.parcial;
      asumeDesbloqueo ||= eta.asumeDesbloqueo;
    }
    return { finEstimado: fin, sinEstimar, parcial, asumeDesbloqueo };
  }, [demoraPorItem]);

  // Fechas que el usuario fijó a mano (o que ya venían en la OT persistida):
  // la ETA no las vuelve a pisar. El resto sigue a la estimación del sistema.
  const otFechaTocadaRef = React.useRef(Boolean(orden?.fechaEntrega));
  const itemFechaTocadaRef = React.useRef<Set<string>>(new Set());

  // Por defecto, cada item se compromete en la fecha que el sistema estima
  // (ETA + colchón). Sigue a la estimación hasta que el usuario la toca.
  React.useEffect(() => {
    if (!demoraPorItem) return;
    const noLaborables = colasTaller?.noLaborables;
    setItems((current) => {
      let cambio = false;
      const next = current.map((item) => {
        if (itemFechaTocadaRef.current.has(item.id)) return item;
        const fecha = fechaRecomendadaEta(demoraPorItem.get(item.id), {
          margenDias: margenEtaDias,
          noLaborables,
          zona: zonaHoraria,
        });
        if (!fecha || item.fechaEntrega === fecha) return item;
        cambio = true;
        return { ...item, fechaEntrega: fecha };
      });
      return cambio ? next : current;
    });
  }, [demoraPorItem, margenEtaDias, colasTaller?.noLaborables, zonaHoraria]);

  // La fecha de la OT sigue a la ETA de la orden completa (el item que termina
  // último) hasta que el usuario la fija a mano.
  React.useEffect(() => {
    if (otFechaTocadaRef.current) return;
    const fecha = fechaRecomendadaEta(demoraOrden, {
      margenDias: margenEtaDias,
      noLaborables: colasTaller?.noLaborables,
      zona: zonaHoraria,
    });
    if (fecha) setFechaEstimada((prev) => (prev === fecha ? prev : fecha));
  }, [demoraOrden, margenEtaDias, colasTaller?.noLaborables, zonaHoraria]);

  const router = useRouter();
  const [emitiendo, setEmitiendo] = React.useState(false);
  const [emisionNumero, setEmisionNumero] = React.useState<string | null>(null);
  const emisionOrdenIdRef = React.useRef<string | null>(null);
  const emisionIdempotencyRef = React.useRef<string | null>(null);
  const borradorIdempotencyRef = React.useRef<string | null>(null);
  const [editandoOrden, setEditandoOrden] = React.useState(false);
  const [guardandoEdicion, setGuardandoEdicion] = React.useState(false);
  const [trackCopiado, setTrackCopiado] = React.useState(false);

  // Copia el link público de seguimiento del cliente (/t/<token>).
  const publicToken = orden?.publicToken ?? null;
  const compartirSeguimiento = React.useCallback(() => {
    if (!publicToken) return;
    const url = enlacePublicoUrl("seguimiento", publicToken);
    void navigator.clipboard?.writeText(url).then(() => {
      setTrackCopiado(true);
      window.setTimeout(() => setTrackCopiado(false), 2000);
    });
  }, [publicToken]);
  const camposEdicion = React.useMemo(
    () =>
      orden && editandoOrden
        ? camposEditablesOrden(orden.estado)
        : new Set<string>(),
    [orden, editandoOrden],
  );
  /** En modo orden, si el campo NO está en edición se muestra estático. */
  const campoEditable = React.useCallback(
    (campo: string) => !orden || camposEdicion.has(campo),
    [orden, camposEdicion],
  );

  /** Items tocables sólo antes de que el taller arranque (espejo backend). */
  const puedeTocarItems =
    !!orden && (orden.estado === "borrador" || orden.estado === "pendiente");
  /**
   * Una sola puerta de edición: los items (agregar/editar/quitar) sólo se
   * habilitan DENTRO del modo "Editar orden", igual que los field-cards.
   * TODO es staging local — nada pega en la base hasta "Guardar cambios".
   */
  const itemsEnEdicion = puedeTocarItems && editandoOrden;

  /** Ids reales de los items persistidos (para diferenciar altas locales). */
  const persistedItemIds = React.useMemo(
    () =>
      new Set(
        (orden?.productos ?? [])
          .map((producto) => producto.id)
          .filter((id): id is string => Boolean(id)),
      ),
    [orden],
  );
  /** Items persistidos que fueron editados en el staging actual. */
  const [editadosIds, setEditadosIds] = React.useState<Set<string>>(
    () => new Set(),
  );

  // Tras guardar, router.refresh() trae la orden nueva y resincronizamos
  // rehidratando. Nunca durante la edición (pisaría el staging) ni al salir
  // de edición sin datos nuevos (flashearía el estado viejo hasta el
  // refresh) — sólo cuando la orden del server realmente cambió.
  const ordenSyncRef = React.useRef(orden);
  React.useEffect(() => {
    if (!orden) return;
    const ordenCambio = ordenSyncRef.current !== orden;
    ordenSyncRef.current = orden;
    if (editandoOrden || !ordenCambio) return;
    setItems(orden.productos.map(rehidratarOrdenItem));
  }, [orden, editandoOrden]);

  /** Cambios de items en staging (altas, ediciones y bajas pendientes). */
  const cambiosItems = React.useMemo(() => {
    if (!orden || !editandoOrden) {
      return { agregados: [], editados: [], quitados: [], total: 0 };
    }
    const idsActuales = new Set(items.map((item) => item.id));
    const agregados = items.filter((item) => !persistedItemIds.has(item.id));
    const editados = items.filter(
      (item) => persistedItemIds.has(item.id) && editadosIds.has(item.id),
    );
    const quitados = orden.productos.filter(
      (producto) => producto.id && !idsActuales.has(producto.id),
    );
    return {
      agregados,
      editados,
      quitados,
      total: agregados.length + editados.length + quitados.length,
    };
  }, [orden, editandoOrden, items, persistedItemIds, editadosIds]);

  /** Cambios de datos comerciales (field-cards) sin guardar. */
  const cambiosFields = React.useMemo(() => {
    if (!orden || !editandoOrden) return {} as Record<string, string>;
    const payload: Record<string, string> = {};
    if (clienteId && clienteId !== (orden.clienteId ?? "")) {
      payload.clienteId = clienteId;
    }
    if (canalVenta !== (orden.canalVenta ?? "mostrador")) {
      payload.canalVenta = canalVenta;
    }
    if (fechaEstimada && fechaEstimada !== (orden.fechaEntrega ?? "")) {
      payload.fechaEntrega = fechaEstimada;
    }
    return payload;
  }, [orden, editandoOrden, clienteId, canalVenta, fechaEstimada]);

  const cambiosCreacion = !orden
    ? items.length +
      cargosOrden.length +
      cobrosStaged.length +
      Number(Boolean(clienteId)) +
      Number(canalVenta !== creacionDefaultsRef.current.canalVenta) +
      Number(fechaEstimada !== creacionDefaultsRef.current.fechaEstimada) +
      Number(sinComprobante)
    : 0;
  const cambiosSinGuardar =
    cambiosCreacion + cambiosItems.total + Object.keys(cambiosFields).length;

  /**
   * Qué le va a pasar a la orden al cancelarla. Se arma con los datos de ESTA
   * orden y no con un texto fijo: lo que importa es la plata cobrada y el
   * trabajo hecho, que es distinto en cada caso.
   */
  /**
   * Una orden facturada no se cancela sin acreditar primero: si ARCA tiene una
   * factura viva, el eje fiscal diría una cosa y el comercial otra. Con permiso
   * de anular se resuelve en el mismo paso; sin él, hay que pedírselo a
   * administración.
   */
  const facturaViva = (orden?.facturadoTotal ?? 0) > 0.01;
  const acreditaYCancela = facturaViva && puedeAnular;

  const impactoCancelacion = React.useMemo(() => {
    if (!orden) return [];
    const puntos = [
      "Sale del tablero del taller y de la capacidad comprometida.",
      "Deja de contar como venta en el panel y los reportes.",
      "El link de seguimiento del cliente deja de funcionar.",
    ];
    if (acreditaYCancela) {
      puntos.unshift(
        `Se emite la nota de crédito de ${formatCurrency(orden.facturadoTotal, moneda)} facturados: la factura queda acreditada ante ARCA.`,
      );
    }
    const cobrado = orden.cobradoTotal ?? 0;
    if (cobrado > 0) {
      puntos.push(
        `Los ${formatCurrency(cobrado, moneda)} cobrados quedan como saldo a favor de ${orden.clienteNombre || "el cliente"} (no se devuelven solos).`,
      );
    }
    if ((orden.progresoPct ?? 0) > 0) {
      puntos.push(
        `El taller ya hizo el ${orden.progresoPct}% del trabajo: esas horas quedan registradas y siguen contando para el equipo.`,
      );
    }
    return puntos;
  }, [orden, moneda, acreditaYCancela]);

  const cancelarOrden = React.useCallback(
    async (motivo: string) => {
      if (!orden || cancelando) return;
      setCancelando(true);
      try {
        await cancelarOrdenTrabajo(orden.id, motivo, acreditaYCancela);
        setConfirmCancelar(false);
        toast.success(
          acreditaYCancela
            ? `Orden ${orden.numero} cancelada y facturación acreditada.`
            : `Orden ${orden.numero} cancelada.`,
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo cancelar la orden.",
        );
      } finally {
        setCancelando(false);
      }
    },
    [orden, cancelando, acreditaYCancela, router],
  );

  /**
   * Sube el arte de los sellos de la orden a los Archivos de cada ítem.
   *
   * Corre DESPUÉS de que la orden se guardó, con el detalle que devuelve el
   * backend: ahí cada ítem ya tiene id —recién entonces existe algo a lo que
   * colgarle un archivo— y trae su `jobContext`, que es donde está el diseño.
   *
   * No lanza nunca: la orden ya está guardada, y perderla por un fallo de red
   * al subir un EPS sería mucho peor que avisar y reintentar en el próximo
   * guardado.
   */
  const publicarArtes = React.useCallback(
    async (productos: OrdenTrabajoProducto[]) => {
      const conSello = itemsConSelloDe(productos);
      if (conSello.length === 0) return;
      const resultado = await publicarArtesDeSello(conSello);
      const aviso = mensajeDeArtes(resultado);
      if (aviso) toast.warning(aviso, { duration: 10000 });
    },
    [],
  );

  // Los PDF medidos (transitorios en item.planosPendientes) se suben a los
  // Archivos del ítem persistido. Se matchea staging→persistido por
  // cotizacionItemId (el id del item no sobrevive; el server genera uno nuevo),
  // con el índice como fallback. Ver docs/planos-persistir-diseno.md.
  const publicarPlanosDeOrden = React.useCallback(
    async (
      itemsConSnapshot: Array<{
        item: PropuestaItem;
        cotizacionItemId?: string;
      }>,
      productos: OrdenTrabajoProducto[],
    ) => {
      const porCotiz = new Map<string, string>();
      productos.forEach((p) => {
        if (p.cotizacionItemId && p.id) porCotiz.set(p.cotizacionItemId, p.id);
      });
      const objetivo: PlanosDeItem[] = [];
      itemsConSnapshot.forEach(({ item, cotizacionItemId }, i) => {
        const planos = item.planosPendientes;
        if (!planos?.length) return;
        const ordenItemId =
          (cotizacionItemId ? porCotiz.get(cotizacionItemId) : undefined) ??
          productos[i]?.id;
        if (ordenItemId) objetivo.push({ ordenItemId, planos });
      });
      if (objetivo.length === 0) return;
      const { errores } = await publicarPlanos(objetivo);
      if (errores.length > 0) {
        toast.error(`Algunos planos no se subieron: ${errores.join(" · ")}`);
      }
    },
    [],
  );

  /**
   * Sube a R2 los PDF originales del centro de copiado, colgándolos del ítem de
   * la OT (scope ORDEN_ITEM), igual que los sellos suben sus artes. Los archivos
   * viajan en memoria en `item.archivosPendientes` y acá se matchean por
   * `cotizacionItemId` con el producto ya persistido. Nunca lanza: la orden ya
   * está guardada. Reemplaza sólo lo autogenerado por el centro de copiado.
   */
  const subirArchivosCentroCopiado = React.useCallback(
    async (
      productos: OrdenTrabajoProducto[],
      filesPorCotItem: Map<string, File[]>,
    ) => {
      if (filesPorCotItem.size === 0) return;
      const MARCA = "centro-copiado";
      const fallidos: string[] = [];
      for (const p of productos) {
        const files = p.cotizacionItemId
          ? filesPorCotItem.get(p.cotizacionItemId)
          : undefined;
        if (!files?.length) continue;
        try {
          const previos = await listarArchivos("ORDEN_ITEM", p.id);
          for (const a of previos) {
            if (a.autogeneradoPor === MARCA) await eliminarArchivo(a.id);
          }
          for (const file of files) {
            await subirArchivo(file, {
              scope: "ORDEN_ITEM",
              entidadId: p.id,
              descripcion: `Documento · ${file.name}`,
              autogeneradoPor: MARCA,
            });
          }
        } catch (error) {
          fallidos.push(
            error instanceof Error ? error.message : "no se pudo subir",
          );
        }
      }
      if (fallidos.length > 0) {
        toast.warning(
          `${fallidos.length} archivo(s) del centro de copiado no se pudieron guardar (${fallidos.join(" · ")}). Podés subirlos a mano desde la pestaña Archivos del ítem.`,
          { duration: 10000 },
        );
      }
    },
    [],
  );

  /** Mapea cotizacionItemId → archivos pendientes, para el matcheo con la OT. */
  const mapaArchivosCC = React.useCallback(
    (
      itemsConSnapshot: Array<{
        item: PropuestaItem;
        cotizacionItemId?: string;
      }>,
    ): Map<string, File[]> => {
      const m = new Map<string, File[]>();
      for (const { item, cotizacionItemId } of itemsConSnapshot) {
        if (cotizacionItemId && item.archivosPendientes?.length) {
          m.set(cotizacionItemId, item.archivosPendientes);
        }
      }
      return m;
    },
    [],
  );

  /**
   * Persiste alta/edición de un item: primero el snapshot del cotizador
   * (recotizar si ya existía, cotizar-y-guardar encadenado a la Cotizacion
   * de origen si es nuevo), después la proyección. Lanza en error — el
   * guardado en lote decide qué reportar.
   */
  const persistirItemOrden = React.useCallback(
    async (item: PropuestaItem, modo: "agregar" | "editar") => {
      if (!orden) return;
      if (!item.motorCodigo || !item.jobContext) {
        throw new Error(
          `"${item.productoNombre}" no tiene datos de cotización para persistir.`,
        );
      }
      const request = {
        rutaAlternativaId: item.rutaAlternativaId ?? null,
        jobContext: item.jobContext as never,
        clienteId: clienteId || null,
        periodo: getCurrentPeriodo(),
        descuento: descuentoParaMotor(item.descuentoInput),
      };
      let cotizacionItemId = item.cotizacionItemId;
      if (cotizacionItemId) {
        const respuesta = await recotizarCotizacionItem(
          cotizacionItemId,
          request,
        );
        if (!respuesta.result.exitoso) {
          throw new Error(
            respuesta.result.errores?.[0]?.mensaje ??
              `No se pudo recotizar "${item.productoNombre}".`,
          );
        }
      } else {
        const respuesta = await cotizarYGuardar({
          productoId: item.motorCodigo,
          ...request,
          cotizacionId: orden.cotizacionId ?? undefined,
        });
        if (!respuesta.result.exitoso) {
          throw new Error(
            respuesta.result.errores?.[0]?.mensaje ??
              `No se pudo guardar la cotización de "${item.productoNombre}".`,
          );
        }
        cotizacionItemId = respuesta.cotizacionItemId;
      }
      const payload = itemToOrdenItemPayload(item, cotizacionItemId);
      const detalle =
        modo === "agregar"
          ? await agregarOrdenItem(orden.id, payload)
          : await editarOrdenItem(orden.id, item.id, payload);

      // Sólo el ítem que se tocó: republicar los demás borraría y volvería a
      // subir un arte idéntico por nada. En el alta el id recién existe acá,
      // así que se lo busca por el snapshot que se acaba de guardar.
      const tocado = detalle.productos.filter((p) =>
        modo === "agregar"
          ? p.cotizacionItemId === cotizacionItemId
          : p.id === item.id,
      );
      await publicarArtes(tocado);
      await subirArchivosCentroCopiado(
        tocado,
        mapaArchivosCC([{ item, cotizacionItemId }]),
      );
      // Los PDF medidos del ítem (si se adjuntaron en el sheet) → Archivos del
      // ítem recién persistido.
      if (item.planosPendientes?.length && tocado[0]?.id) {
        const { errores } = await publicarPlanos([
          { ordenItemId: tocado[0].id, planos: item.planosPendientes },
        ]);
        if (errores.length > 0) {
          toast.error(`Algunos planos no se subieron: ${errores.join(" · ")}`);
        }
      }
    },
    [
      orden,
      clienteId,
      publicarArtes,
      subirArchivosCentroCopiado,
      mapaArchivosCC,
    ],
  );

  /** Baja en staging: sólo saca la fila local; el DELETE va en Guardar. */
  const quitarItemDeOrden = React.useCallback((item: PropuestaItem) => {
    setItems((current) =>
      current.filter((candidate) => candidate.id !== item.id),
    );
    setEditadosIds((prev) => {
      if (!prev.has(item.id)) return prev;
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  }, []);

  const cancelarEdicion = React.useCallback(() => {
    if (!orden) return;
    // Descarta TODO el staging: field-cards e items vuelven a lo persistido.
    setClienteId(orden.clienteId ?? "");
    setCanalVenta(orden.canalVenta ?? "mostrador");
    setFechaEstimada(orden.fechaEntrega ?? orden.creadaEl.slice(0, 10));
    // Vuelve a seguir a la ETA salvo que la OT ya tuviera fecha comprometida.
    otFechaTocadaRef.current = Boolean(orden.fechaEntrega);
    itemFechaTocadaRef.current.clear();
    setItems(orden.productos.map(rehidratarOrdenItem));
    setEditadosIds(new Set());
    setEditandoOrden(false);
  }, [orden]);

  /**
   * Commit en lote del staging: bajas → ediciones → altas de items, y al
   * final los datos comerciales. Cada operación genera su evento de
   * auditoría en el backend. Ante un error se recarga la orden para
   * reflejar exactamente lo que alcanzó a aplicarse.
   */
  const guardarEdicion = React.useCallback(
    async (opciones?: { destino?: string }) => {
      if (!orden) return;
      const destino = opciones?.destino;
      if (cambiosSinGuardar === 0) {
        setEditandoOrden(false);
        if (destino) router.push(destino);
        return;
      }
      setGuardandoEdicion(true);
      try {
        for (const producto of cambiosItems.quitados) {
          await quitarOrdenItem(orden.id, producto.id!);
        }
        for (const item of cambiosItems.editados) {
          await persistirItemOrden(item, "editar");
        }
        for (const item of cambiosItems.agregados) {
          await persistirItemOrden(item, "agregar");
        }
        if (Object.keys(cambiosFields).length > 0) {
          await editarOrdenTrabajo(orden.id, cambiosFields);
        }
        toast.success(
          `Orden actualizada: ${cambiosSinGuardar} cambio${
            cambiosSinGuardar === 1 ? "" : "s"
          } registrado${cambiosSinGuardar === 1 ? "" : "s"} en el historial.`,
        );
        setEditadosIds(new Set());
        setEditandoOrden(false);
        setNavPendiente(null);
        if (destino) {
          router.push(destino);
        } else {
          router.refresh();
        }
      } catch (error) {
        // Ante error NO navegamos: recargamos para reflejar lo aplicado y el
        // usuario decide desde la ficha.
        toast.error(
          (error instanceof Error
            ? error.message
            : "No se pudieron guardar todos los cambios.") +
            " Se recargó la orden para reflejar lo aplicado.",
        );
        setEditadosIds(new Set());
        setEditandoOrden(false);
        setNavPendiente(null);
        router.refresh();
      } finally {
        setGuardandoEdicion(false);
      }
    },
    [
      orden,
      cambiosSinGuardar,
      cambiosItems,
      cambiosFields,
      persistirItemOrden,
      router,
    ],
  );

  // Guard de navegación con cambios sin guardar: los clicks a links internos
  // (sidebar, breadcrumb) se interceptan y abren el modal del sistema con
  // guardar/descartar/seguir. El cierre o recarga de la pestaña usa el aviso
  // nativo del navegador (beforeunload no admite UI propia).
  const [navPendiente, setNavPendiente] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (cambiosSinGuardar === 0) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const anchor = (event.target as HTMLElement).closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      event.preventDefault();
      event.stopPropagation();
      setNavPendiente(href);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [cambiosSinGuardar]);

  /**
   * Emitir un borrador guardado (borrador → pendiente): la salida comercial
   * del borrador. Las transiciones de producción (pendiente en adelante)
   * llegan con el Tablero — no van desde acá.
   */
  const [emitiendoBorrador, setEmitiendoBorrador] = React.useState(false);
  const emitirBorrador = React.useCallback(async () => {
    if (!orden) return;
    if (!orden.clienteId) {
      toast.error(
        "Asigná un cliente antes de emitir (Editar orden → Cliente).",
      );
      return;
    }
    if (!orden.fechaEntrega || orden.fechaEntrega < offsetDate(0)) {
      toast.error(
        "Definí una fecha de entrega vigente antes de emitir (Editar orden → Fecha).",
      );
      return;
    }
    setEmitiendoBorrador(true);
    try {
      await cambiarEstadoOrdenTrabajo(orden.id, { estado: "pendiente" });
      toast.success(`${orden.numero} emitida al taller.`);
      setMostrarRecienEmitida(true);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo emitir la orden.",
      );
    } finally {
      setEmitiendoBorrador(false);
    }
  }, [orden, router]);

  // Emitir desde el aviso de recién convertida. Se cierra pase lo que pase:
  // si faltaba cliente o fecha, emitirBorrador ya avisó por toast y lo que
  // corresponde es dejar la orden a la vista para corregirla.
  const emitirDesdeAviso = React.useCallback(async () => {
    await emitirBorrador();
    setAvisoBorradorAbierto(false);
  }, [emitirBorrador]);

  const descartarYSalir = React.useCallback(() => {
    if (!navPendiente) return;
    const destino = navPendiente;
    setNavPendiente(null);
    // El staging vive en estado local: navegar lo descarta solo. Reseteamos
    // igual para que el guard no reintercepte durante la transición.
    setEditadosIds(new Set());
    setEditandoOrden(false);
    router.push(destino);
  }, [navPendiente, router]);
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

  const abrirCentroCopiado = React.useCallback(() => {
    setCopiadoEditItems(null);
    setCopiadoOpen(true);
  }, []);

  /** Un renglón que salió del centro de copiado (para rutear su edición). */
  const esCentroCopiado = React.useCallback(
    (item: PropuestaItem) =>
      item.productoCodigo === "SYS-IMPRESION-DOC" ||
      Boolean(
        (item.jobContext as { _centroCopiado?: unknown } | undefined)
          ?._centroCopiado,
      ),
    [],
  );

  /** Id del tomo (grupo anillado) al que pertenece un renglón del centro de copiado. */
  const tomoDeItem = React.useCallback(
    (item: PropuestaItem | undefined): string | null =>
      (
        item?.jobContext as
          | { _centroCopiado?: { grupoTomoId?: string | null } }
          | undefined
      )?._centroCopiado?.grupoTomoId ?? null,
    [],
  );
  const tomoNombreDeItem = React.useCallback(
    (item: PropuestaItem): string | null =>
      (
        item.jobContext as
          | { _centroCopiado?: { tomoNombre?: string | null } }
          | undefined
      )?._centroCopiado?.tomoNombre ?? null,
    [],
  );

  /** Id de la carga (todos los renglones de una misma pasada del centro de copiado). */
  const cargaDeItem = React.useCallback(
    (item: PropuestaItem | undefined): string | null =>
      (
        item?.jobContext as
          | { _centroCopiado?: { grupoCargaId?: string | null } }
          | undefined
      )?._centroCopiado?.grupoCargaId ?? null,
    [],
  );

  /**
   * Editar: los del centro de copiado reabren SU modal con la CARGA COMPLETA
   * (todos los renglones que entraron juntos), para no re-cotizar aislado; el
   * resto abre el sheet normal.
   */
  const abrirEdicion = React.useCallback(
    (item: PropuestaItem) => {
      if (esCentroCopiado(item)) {
        const carga = cargaDeItem(item);
        const deLaCarga = carga
          ? items.filter((i) => cargaDeItem(i) === carga)
          : [item];
        setCopiadoEditItems(deLaCarga);
        setCopiadoOpen(true);
      } else {
        setEditingItem(item);
        setAddOpen(true);
      }
    },
    [esCentroCopiado, cargaDeItem, items],
  );

  /**
   * Persiste el snapshot de cada item (cotizar-y-guardar, encadenando la
   * misma Cotizacion). Los que ya se guardaron (recotizaciones) conservan
   * su cotizacionItemId. Compartido por Emitir OT y Guardar borrador.
   */
  const persistirSnapshotsItems = React.useCallback(async () => {
    let cotizacionId: string | undefined;
    const itemsConSnapshot: Array<{
      item: PropuestaItem;
      cotizacionItemId?: string;
    }> = [];
    for (const item of items) {
      if (item.cotizacionItemId) {
        itemsConSnapshot.push({
          item,
          cotizacionItemId: item.cotizacionItemId,
        });
        continue;
      }
      // Tomo compuesto (centro de copiado): se persiste como UN CotizacionItem
      // sintético; no pasa por cotizarYGuardar (que cotiza un solo jobContext).
      const metaTomo = (
        item.jobContext as
          | {
              _centroCopiado?: {
                esTomo?: boolean;
                tomoNombre?: string;
                juegos?: number;
                segmentos?: Array<{
                  nombre?: string | null;
                  paginas: number;
                  tamano: string;
                  tamanoAnchoMm?: number;
                  tamanoAltoMm?: number;
                  papelMateriaPrimaId: string;
                  gramaje?: number | null;
                  color: "BN" | "COLOR";
                  faz: 1 | 2;
                }>;
              };
            }
          | undefined
      )?._centroCopiado;
      if (metaTomo?.esTomo) {
        const resp = await guardarTomoCentroCopiado({
          documentos: (metaTomo.segmentos ?? []).map((s, i) => ({
            id: `s${i}`,
            nombre: s.nombre ?? undefined,
            paginas: s.paginas,
            copias: 1,
            tamano: s.tamano,
            // Cargas nuevas traen las medidas; para las viejas, se resuelven por
            // el nombre del formato contra el catálogo del sistema.
            tamanoAnchoMm: s.tamanoAnchoMm ?? dimsDeFormato(s.tamano).anchoMm,
            tamanoAltoMm: s.tamanoAltoMm ?? dimsDeFormato(s.tamano).altoMm,
            papelMateriaPrimaId: s.papelMateriaPrimaId,
            gramaje: s.gramaje,
            color: s.color,
            faz: s.faz,
            grupoId: "T",
          })),
          grupos: [
            { id: "T", nombre: metaTomo.tomoNombre, juegos: metaTomo.juegos ?? 1 },
          ],
          cotizacionId,
          clienteId: clienteId || null,
        });
        if (resp.error || !resp.cotizacionItemId) {
          throw new Error(
            resp.error ??
              `No se pudo guardar el tomo ${item.productoNombre}.`,
          );
        }
        cotizacionId = resp.cotizacionId ?? cotizacionId;
        itemsConSnapshot.push({ item, cotizacionItemId: resp.cotizacionItemId });
        continue;
      }
      if (!item.motorCodigo || !item.jobContext) {
        throw new Error(
          `"${item.productoNombre}" no tiene una cotización persistible. Volvé a configurarlo antes de guardar la orden.`,
        );
      }
      const response = await cotizarYGuardar({
        productoId: item.motorCodigo,
        rutaAlternativaId: item.rutaAlternativaId ?? null,
        jobContext: item.jobContext as never,
        clienteId: clienteId || null,
        periodo: getCurrentPeriodo(),
        descuento: descuentoParaMotor(item.descuentoInput),
        cotizacionId,
      });
      if (!response.result.exitoso) {
        throw new Error(
          response.result.errores?.[0]?.mensaje ??
            `No se pudo guardar la cotización de ${item.productoNombre}.`,
        );
      }
      cotizacionId = response.cotizacionId ?? cotizacionId;
      itemsConSnapshot.push({
        item,
        cotizacionItemId: response.cotizacionItemId,
      });
    }
    return { itemsConSnapshot, cotizacionId };
  }, [items, clienteId]);

  /** Fecha comprometida: la más tardía entre items y la estimada global. */
  const fechaEntregaOrden = React.useCallback(
    () =>
      items.reduce(
        (max, item) =>
          item.fechaEntrega && item.fechaEntrega > max
            ? item.fechaEntrega
            : max,
        fechaEstimada,
      ),
    [items, fechaEstimada],
  );

  /**
   * Emitir OT: snapshots + OrdenTrabajo en `pendiente`. El overlay muestra
   * el número real cuando el backend lo asigna; al cerrar navega al detalle.
   */
  /**
   * Emitir PRESUPUESTO (toggle "Presupuesto" REAL — antes era cosmético):
   * misma persistencia de snapshots que la OT, pero el destino es el ciclo
   * comercial (/comercial/presupuestos): numera PRES-AAAA-NNNN y guarda la
   * proyección de items para convertir después. No crea ninguna OT.
   */
  const [emitiendoPresupuesto, setEmitiendoPresupuesto] = React.useState(false);
  const emitirPresupuestoCb = React.useCallback(async () => {
    if (items.length === 0) {
      toast.error("Agregá al menos un producto antes de emitir el presupuesto.");
      return;
    }
    if (!clienteId) {
      toast.error("Asigná un cliente: el presupuesto es para alguien.");
      return;
    }
    setEmitiendoPresupuesto(true);
    try {
      const { itemsConSnapshot, cotizacionId } = await persistirSnapshotsItems();
      if (!cotizacionId) {
        throw new Error("No se pudo persistir la cotización del presupuesto.");
      }
      const presupuesto = await emitirPresupuesto({
        cotizacionId,
        clienteId,
        canalVenta,
        fechaEntrega: fechaEntregaOrden(),
        cargos: cargosOrden.map(cargoToOrdenInput),
        items: itemsConSnapshot.map(({ item, cotizacionItemId }) =>
          itemToOrdenItemPayload(item, cotizacionItemId),
        ),
      });
      // El backend emite y envía de una; si las reglas de aprobación
      // dispararon, vuelve en `pendiente_aprobacion` en vez de enviado.
      if (presupuesto.advertenciaEnvio || presupuesto.estado === "borrador") {
        toast.warning(
          `Presupuesto ${presupuesto.numero} guardado, pero no pudo enviarse: ${presupuesto.advertenciaEnvio ?? "reintentá desde su detalle"}.`,
        );
      } else {
        toast.success(
          presupuesto.estado === "pendiente_aprobacion"
            ? `Presupuesto ${presupuesto.numero}: espera la aprobación de un supervisor antes de salir.`
            : `Presupuesto ${presupuesto.numero} emitido y enviado.`,
        );
      }
      router.push("/comercial/presupuestos");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo emitir el presupuesto.",
      );
    } finally {
      setEmitiendoPresupuesto(false);
    }
  }, [
    items,
    cargosOrden,
    clienteId,
    canalVenta,
    persistirSnapshotsItems,
    fechaEntregaOrden,
    router,
  ]);

  const emitirOrden = React.useCallback(async () => {
    if (items.length === 0) {
      toast.error("Agregá al menos un producto antes de emitir la orden.");
      return;
    }
    if (!clienteId) {
      toast.error(
        "Asigná un cliente antes de emitir la orden de trabajo al taller.",
      );
      return;
    }
    const fechaEntrega = fechaEntregaOrden();
    if (fechaEntrega < offsetDate(0)) {
      toast.error(
        "La fecha de entrega no puede ser anterior a hoy. Revisá la fecha estimada.",
      );
      return;
    }
    setEmitiendo(true);
    setEmisionNumero(null);
    emisionOrdenIdRef.current = null;
    const idempotencyKey =
      emisionIdempotencyRef.current ?? crypto.randomUUID();
    emisionIdempotencyRef.current = idempotencyKey;
    try {
      const { itemsConSnapshot, cotizacionId } =
        await persistirSnapshotsItems();
      const orden = await crearOrdenTrabajo({
        idempotencyKey,
        clienteId: clienteId || undefined,
        cotizacionId,
        estado: "pendiente",
        fechaEntrega,
        canalVenta,
        cargos: cargosOrden.map(cargoToOrdenInput),
        tratamientoFiscal: sinComprobante ? "SIN_COMPROBANTE" : "FISCAL",
        items: itemsConSnapshot.map(({ item, cotizacionItemId }) =>
          itemToOrdenItemPayload(item, cotizacionItemId),
        ),
      });

      emisionOrdenIdRef.current = orden.id;

      // Cobros staged: se registran contra la orden recién emitida, en el
      // mismo acto. Si alguno falla la orden ya existe — se avisa cuáles
      // quedaron sin registrar (se cargan desde la pestaña Pagos de la OT).
      if (cobrosStaged.length > 0) {
        const fallidos: string[] = [];
        for (const draft of cobrosStaged) {
          try {
            await crearCobro({
              ...draft.payload,
              ordenId: orden.id,
              clienteId: clienteId || undefined,
            });
          } catch (error) {
            fallidos.push(
              `${draft.metodoNombre} ${formatCurrency(draft.payload.montoBruto, moneda)}` +
                (error instanceof Error ? ` (${error.message})` : ""),
            );
          }
        }
        if (fallidos.length > 0) {
          toast.error(
            `La orden se emitió, pero ${fallidos.length} cobro${fallidos.length === 1 ? "" : "s"} no se ${fallidos.length === 1 ? "pudo" : "pudieron"} registrar: ${fallidos.join(" · ")}. Cargalos desde la pestaña Pagos de la orden.`,
            { duration: 10000 },
          );
        }
      }

      // La OT ya existe: los adjuntos son tareas posteriores y un fallo no puede
      // convertir una emisión exitosa en un falso error reintentable.
      const adjuntos = await Promise.allSettled([
        publicarArtes(orden.productos),
        subirArchivosCentroCopiado(
          orden.productos,
          mapaArchivosCC(itemsConSnapshot),
        ),
        publicarPlanosDeOrden(itemsConSnapshot, orden.productos),
      ]);
      const adjuntosFallidos = adjuntos.filter(
        (resultado) => resultado.status === "rejected",
      ).length;
      if (adjuntosFallidos > 0) {
        toast.warning(
          `La orden se emitió, pero ${adjuntosFallidos} tarea${adjuntosFallidos === 1 ? "" : "s"} de archivos quedó pendiente. Revisá los adjuntos desde la orden.`,
          { duration: 10000 },
        );
      }

      setEmisionNumero(orden.numero);
    } catch (error) {
      setEmitiendo(false);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo emitir la orden de trabajo.",
      );
    }
  }, [
    items,
    cargosOrden,
    clienteId,
    canalVenta,
    cobrosStaged,
    moneda,
    persistirSnapshotsItems,
    fechaEntregaOrden,
    publicarArtes,
    subirArchivosCentroCopiado,
    mapaArchivosCC,
    publicarPlanosDeOrden,
    sinComprobante,
  ]);

  const finalizarEmision = React.useCallback(() => {
    const ordenId = emisionOrdenIdRef.current;
    setEmitiendo(false);
    // ?emitida=1 → el detalle muestra el tag "RECIÉN EMITIDA" sólo en esta
    // llegada (la ficha limpia el param al montar).
    if (ordenId) router.push(`/produccion/ordenes/${ordenId}?emitida=1`);
  }, [router]);

  /**
   * Guardar borrador: misma persistencia que emitir (snapshots + OT) pero
   * en estado `borrador` — sin exigir cliente ni fecha (se completan antes
   * de emitir). Navega al borrador para seguir trabajándolo desde ahí.
   */
  const [guardandoBorrador, setGuardandoBorrador] = React.useState(false);
  const guardarBorrador = React.useCallback(async () => {
    if (items.length === 0) {
      toast.error("Agregá al menos un producto antes de guardar el borrador.");
      return;
    }
    setGuardandoBorrador(true);
    setConfirmBorradorConCobros(false);
    try {
      const { itemsConSnapshot, cotizacionId } =
        await persistirSnapshotsItems();
      const fechaEntrega = fechaEntregaOrden();
      const idempotencyKey =
        borradorIdempotencyRef.current ?? crypto.randomUUID();
      borradorIdempotencyRef.current = idempotencyKey;
      const orden = await crearOrdenTrabajo({
        idempotencyKey,
        clienteId: clienteId || undefined,
        cotizacionId,
        estado: "borrador",
        fechaEntrega: fechaEntrega || undefined,
        canalVenta,
        cargos: cargosOrden.map(cargoToOrdenInput),
        tratamientoFiscal: sinComprobante ? "SIN_COMPROBANTE" : "FISCAL",
        items: itemsConSnapshot.map(({ item, cotizacionItemId }) =>
          itemToOrdenItemPayload(item, cotizacionItemId),
        ),
      });
      const adjuntos = await Promise.allSettled([
        publicarArtes(orden.productos),
        subirArchivosCentroCopiado(
          orden.productos,
          mapaArchivosCC(itemsConSnapshot),
        ),
        publicarPlanosDeOrden(itemsConSnapshot, orden.productos),
      ]);
      const adjuntosFallidos = adjuntos.filter(
        (resultado) => resultado.status === "rejected",
      ).length;
      if (adjuntosFallidos > 0) {
        toast.warning(
          `El borrador se guardó, pero ${adjuntosFallidos} tarea${adjuntosFallidos === 1 ? "" : "s"} de archivos quedó pendiente.`,
          { duration: 10000 },
        );
      }
      toast.success(
        `Borrador ${orden.numero} guardado. Seguí trabajándolo desde acá.`,
      );
      router.push(`/produccion/ordenes/${orden.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el borrador.",
      );
    } finally {
      setGuardandoBorrador(false);
    }
  }, [
    items,
    cargosOrden,
    clienteId,
    canalVenta,
    persistirSnapshotsItems,
    fechaEntregaOrden,
    publicarArtes,
    subirArchivosCentroCopiado,
    mapaArchivosCC,
    publicarPlanosDeOrden,
    router,
    sinComprobante,
  ]);

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
              descuento: descuentoParaMotor(item.descuentoInput),
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

  // ── Descuento comercial (F1) ──────────────────────────────────────────────
  // Enfoque A del diseño: el motor es la autoridad. El front sólo manda el
  // descuento en la (re)cotización y muestra lo que vuelve; no duplica la
  // matemática de precio. Un descuento de ORDEN se materializa por item
  // (prorrateado si es monto), así todo colapsa a un descuento por línea que
  // sobrevive a los recálculos vía `PropuestaItem.descuentoInput`.

  /** Recotiza UNA línea con el descuento dado; devuelve el item actualizado. */
  const recotizarItemConDescuento = React.useCallback(
    async (
      item: PropuestaItem,
      descuentoInput: DescuentoInput | null,
    ): Promise<PropuestaItem | null> => {
      if (!item.jobContext || !item.motorCodigo) return null;
      const request = {
        rutaAlternativaId: item.rutaAlternativaId ?? null,
        jobContext: item.jobContext as never,
        clienteId: clienteId || null,
        periodo: getCurrentPeriodo(),
        descuento: descuentoParaMotor(descuentoInput),
      };
      const response = item.cotizacionItemId
        ? await recotizarCotizacionItem(item.cotizacionItemId, request)
        : {
            result: await cotizar({
              productoId: item.motorCodigo,
              ...request,
            }),
            cotizacionItemId: undefined as string | undefined,
          };
      if (!response.result.exitoso || !response.result.cotizacion) {
        throw new Error(
          response.result.errores?.[0]?.mensaje ??
            `No se pudo aplicar el descuento a "${item.productoNombre}".`,
        );
      }
      const updated = applyCotizacionToItem(
        item,
        response.result.cotizacion,
        item.jobContext as Record<string, unknown>,
      );
      return {
        ...updated,
        descuentoInput: descuentoInput ?? undefined,
        cotizacionItemId: response.cotizacionItemId ?? item.cotizacionItemId,
      };
    },
    [clienteId],
  );

  // Umbral de aprobación por descuento del tenant (F3): se busca una sola vez
  // y recién cuando se aplica un descuento; error de red = sin aviso (el gate
  // real vive en el backend al enviar el presupuesto).
  const umbralDescuentoRef = React.useRef<number | null | undefined>(undefined);
  const umbralDescuentoAprobacion = React.useCallback(async () => {
    if (umbralDescuentoRef.current === undefined) {
      try {
        umbralDescuentoRef.current = (await getConfigPresupuestos())
          .aprobacionDescuentoMaxPct;
      } catch {
        umbralDescuentoRef.current = null;
      }
    }
    return umbralDescuentoRef.current;
  }, []);

  /**
   * Aplica (o quita, con `descuentoInput = null`) un descuento. Alcance `item`
   * toca una línea; alcance `orden` reparte a TODAS: un % se copia igual a cada
   * una (es escala-libre), un monto se prorratea por peso del neto de lista y
   * el último item absorbe el residuo para cuadrar exacto.
   */
  const aplicarDescuento = React.useCallback(
    async (
      scope: "item" | "orden",
      targetItemId: string | null,
      descuentoInput: DescuentoInput | null,
    ) => {
      const recotizables = itemsRef.current.filter(
        (item) => item.jobContext && item.motorCodigo,
      );
      if (recotizables.length === 0) {
        toast.error("No hay productos con datos para aplicar un descuento.");
        return;
      }

      let plan: Array<{ item: PropuestaItem; descuento: DescuentoInput | null }>;
      if (scope === "item") {
        const target = recotizables.find((item) => item.id === targetItemId);
        if (!target) {
          toast.error("No se pudo identificar el producto a descontar.");
          return;
        }
        plan = [{ item: target, descuento: descuentoInput }];
      } else if (!descuentoInput || descuentoInput.tipo === "PORCENTAJE") {
        plan = recotizables.map((item) => ({ item, descuento: descuentoInput }));
      } else {
        const pesos = recotizables.map((item) => netoListaDeItem(item));
        const totalPeso = pesos.reduce((acc, peso) => acc + peso, 0);
        const monto = Math.max(0, descuentoInput.valor);
        let repartido = 0;
        plan = recotizables.map((item, index) => {
          let share: number;
          if (totalPeso <= 0) {
            share = 0;
          } else if (index === recotizables.length - 1) {
            share = Math.max(0, Math.round(monto - repartido));
          } else {
            share = Math.round((monto * pesos[index]) / totalPeso);
            repartido += share;
          }
          return {
            item,
            descuento: share > 0 ? { tipo: "MONTO" as const, valor: share } : null,
          };
        });
      }

      setDescuentoAplicando(true);
      try {
        const results = await Promise.all(
          plan.map(async ({ item, descuento }) => {
            try {
              return {
                id: item.id,
                updated: await recotizarItemConDescuento(item, descuento),
              };
            } catch {
              return { id: item.id, updated: null as PropuestaItem | null };
            }
          }),
        );
        const actualizados = new Map<string, PropuestaItem>();
        let fallidos = 0;
        for (const result of results) {
          if (result.updated) actualizados.set(result.id, result.updated);
          else fallidos += 1;
        }
        if (actualizados.size > 0) {
          setItems((current) =>
            current.map((candidate) => actualizados.get(candidate.id) ?? candidate),
          );
        }

        if (fallidos > 0) {
          toast.warning(
            `${fallidos} producto${fallidos === 1 ? "" : "s"} no se pudo recotizar con el descuento.`,
          );
        } else if (descuentoInput == null) {
          toast.success("Descuento quitado.");
        } else {
          toast.success("Descuento aplicado.");
        }

        // Aviso blando de margen bajo (el gate duro es la aprobación interna).
        if (descuentoInput != null && actualizados.size > 0) {
          const margenes = [...actualizados.values()]
            .filter((item) => descuentoMontoDeItem(item) > 0)
            .map((item) => item.cotizacion.desglosePrecio?.margenEfectivoPct ?? 0);
          const minMargen = margenes.length ? Math.min(...margenes) : null;
          if (minMargen != null && minMargen < DESCUENTO_MARGEN_ALERTA_PCT) {
            toast.warning(
              `El margen queda en ${minMargen.toLocaleString("es-AR", { maximumFractionDigits: 1 })}% en el producto más ajustado. Revisá antes de emitir.`,
            );
          }
          // F3: si el % supera el umbral del tenant, avisar YA que el
          // presupuesto va a pedir aprobación interna (mejor enterarse acá
          // que con el presupuesto trabado en pendiente_aprobacion).
          const maxPct = [...actualizados.values()].reduce((max, item) => {
            const monto = descuentoMontoDeItem(item);
            const lista = netoListaDeItem(item);
            return monto > 0 && lista > 0
              ? Math.max(max, (monto / lista) * 100)
              : max;
          }, 0);
          void umbralDescuentoAprobacion().then((umbral) => {
            if (umbral != null && maxPct > umbral) {
              toast.warning(
                `El descuento supera el ${umbral.toLocaleString("es-AR", { maximumFractionDigits: 1 })}% permitido: emitir (OT o presupuesto) va a requerir la firma de un supervisor.`,
                { duration: 8000 },
              );
            }
          });
        }
        setDescuentoTarget(null);
      } finally {
        setDescuentoAplicando(false);
      }
    },
    [recotizarItemConDescuento, umbralDescuentoAprobacion],
  );

  /**
   * Materializa un cupón validado por el backend (F4): las líneas alcanzadas
   * reciben el MISMO descuento por línea de siempre, marcado con `cuponId`
   * (exento del gate; se redime al emitir). Un % va igual a cada línea; un $
   * se prorratea por peso del neto de lista y la última absorbe el residuo.
   * Pisa el descuento manual de las líneas alcanzadas, con aviso.
   */
  const aplicarCupon = React.useCallback(
    async (cupon: Cupon, alcanzadas: string[]) => {
      const objetivo = itemsRef.current.filter(
        (item) =>
          alcanzadas.includes(item.id) && item.jobContext && item.motorCodigo,
      );
      if (objetivo.length === 0) {
        setAvisoCupon({
          tipo: "error",
          titulo: "El cupón no aplica",
          detalle:
            "Ningún producto de la orden entra en el alcance de este cupón.",
        });
        return;
      }
      const pisadas = objetivo.filter(
        (item) => item.descuentoInput && !item.descuentoInput.cuponId,
      ).length;

      let plan: Array<{ item: PropuestaItem; descuento: DescuentoInput }>;
      const marca = { cuponId: cupon.id, cuponCodigo: cupon.codigo };
      if (cupon.tipo === "PORCENTAJE") {
        plan = objetivo.map((item) => ({
          item,
          descuento: { tipo: "PORCENTAJE", valor: cupon.valor, ...marca },
        }));
      } else {
        const pesos = objetivo.map((item) => netoListaDeItem(item));
        const totalPeso = pesos.reduce((acc, peso) => acc + peso, 0);
        let repartido = 0;
        plan = objetivo.map((item, index) => {
          let share: number;
          if (totalPeso <= 0) {
            share = 0;
          } else if (index === objetivo.length - 1) {
            share = Math.max(0, Math.round(cupon.valor - repartido));
          } else {
            share = Math.round((cupon.valor * pesos[index]) / totalPeso);
            repartido += share;
          }
          return {
            item,
            descuento: { tipo: "MONTO" as const, valor: share, ...marca },
          };
        });
      }

      setDescuentoAplicando(true);
      try {
        const results = await Promise.all(
          plan.map(async ({ item, descuento }) => {
            try {
              return {
                id: item.id,
                updated: await recotizarItemConDescuento(item, descuento),
              };
            } catch {
              return { id: item.id, updated: null as PropuestaItem | null };
            }
          }),
        );
        const actualizados = new Map<string, PropuestaItem>();
        let fallidos = 0;
        for (const result of results) {
          if (result.updated) actualizados.set(result.id, result.updated);
          else fallidos += 1;
        }
        if (actualizados.size > 0) {
          setItems((current) =>
            current.map(
              (candidate) => actualizados.get(candidate.id) ?? candidate,
            ),
          );
        }
        // Aviso en modal centrado, sin el código del cupón (el cliente está
        // mirando la pantalla). El monto real descontado va en grande: es lo
        // que el vendedor le canta.
        const descontado = [...actualizados.values()].reduce(
          (acc, item) => acc + descuentoMontoDeItem(item),
          0,
        );
        const alcance = `${actualizados.size} producto${actualizados.size === 1 ? "" : "s"}`;
        if (fallidos > 0) {
          setAvisoCupon({
            tipo: "aviso",
            titulo: "El cupón se aplicó parcialmente",
            detalle: `${fallidos} producto${fallidos === 1 ? " no se pudo recotizar" : "s no se pudieron recotizar"}. Revisá los precios antes de emitir.`,
            monto: descontado > 0 ? `−${formatCurrency(descontado, moneda)}` : undefined,
          });
        } else {
          setAvisoCupon({
            tipo: "ok",
            titulo: "Cupón aplicado",
            detalle:
              `Descuento en ${alcance}. Se redime al emitir la orden.` +
              (pisadas > 0
                ? ` Reemplazó el descuento manual en ${pisadas} producto${pisadas === 1 ? "" : "s"}.`
                : ""),
            monto: descontado > 0 ? `−${formatCurrency(descontado, moneda)}` : undefined,
          });
        }
        setDescuentoTarget(null);
      } finally {
        setDescuentoAplicando(false);
      }
    },
    [recotizarItemConDescuento, moneda],
  );

  /**
   * Cupón escaneado SIN abrir nada: valida contra el carrito y aplica. Lo
   * dispara el detector de lector 2D (ver useEscaneoCodigo); el modal sigue
   * disponible para tipear el código a mano.
   */
  const aplicarCuponEscaneado = React.useCallback(
    async (codigo: string) => {
      const recotizables = itemsRef.current.filter(
        (item) => item.jobContext && item.motorCodigo,
      );
      if (recotizables.length === 0) {
        setAvisoCupon({
          tipo: "aviso",
          titulo: "Agregá productos primero",
          detalle:
            "El cupón descuenta sobre los productos de la orden, y todavía no hay ninguno.",
        });
        return;
      }
      try {
        const resultado = await validarCupon({
          codigo,
          clienteId: clienteId || undefined,
          items: recotizables.map((item) => ({
            key: item.id,
            productoId: item.motorCodigo || undefined,
            productoCodigo: item.productoCodigo || undefined,
            categoriaCodigo: item.categoriaComercialCodigo || undefined,
            subcategoriaCodigo: item.subcategoriaComercialCodigo || undefined,
            neto: netoListaDeItem(item),
          })),
        });
        await aplicarCupon(resultado.cupon, resultado.alcanzadas);
      } catch (error) {
        // El motivo del backend ya viene sin el código ("está vencido", "no
        // tiene usos disponibles"…), así que se muestra tal cual.
        setAvisoCupon({
          tipo: "error",
          titulo: "Cupón no válido",
          detalle:
            error instanceof Error
              ? error.message
              : "No se pudo validar el cupón escaneado.",
        });
      }
    },
    [clienteId, aplicarCupon],
  );

  // Escaneo global: el vendedor apunta el lector y listo. Se apaga en modo
  // lectura y con cualquier modal abierto (ahí el foco vive en un input y el
  // lector escribe donde corresponde). SIN productos sigue escuchando a
  // propósito: escanear con la orden vacía es lo más natural del mundo y
  // conviene explicarlo con un aviso, no quedarse mudo.
  useEscaneoCodigo({
    activo:
      !modoOrden &&
      descuentoTarget == null &&
      !addOpen &&
      !copiadoOpen &&
      !cargoOpen &&
      !panelEditor,
    onCodigo: (codigo) => {
      // Por el mismo lector entran tres cosas y este listener sólo quiere
      // cupones. Sin este filtro, escanear un DNI o el QR de una orden acá
      // los mandaba a validar como cupón y devolvía "no existe" — mientras
      // el watcher global, en paralelo, hacía lo correcto.
      if (esNumeroOrden(codigo) || parsearDniArgentino(codigo)) return;
      void aplicarCuponEscaneado(codigo);
    },
  });

  React.useEffect(() => {
    if (modoOrden) return; // la orden persistida no se recotiza al vuelo
    if (prevClienteIdRef.current === clienteId) return;
    prevClienteIdRef.current = clienteId;
    if (itemsRef.current.length === 0) return;
    void recotizarItemsPorCliente(clienteId);
  }, [modoOrden, clienteId, recotizarItemsPorCliente]);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target?.closest("input, textarea, select, [contenteditable='true']") !=
        null;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        isEditableTarget
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      // P = agregar producto · C = centro de copiado (si el módulo está activo).
      if (key !== "p" && key !== "c") return;
      if (key === "c" && !ccActivo) return;
      event.preventDefault();
      if (addOpen || cargoOpen || panelEditor || copiadoOpen) return;
      if (key === "p") abrirAgregarProducto();
      else abrirCentroCopiado();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    abrirAgregarProducto,
    abrirCentroCopiado,
    addOpen,
    cargoOpen,
    panelEditor,
    copiadoOpen,
    ccActivo,
  ]);

  function toggle(id: string) {
    // Acordeón de uno por vez: abrir un item cierra el que estaba abierto.
    setOpenIds((prev) => (prev.has(id) ? new Set() : new Set([id])));
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
        descuento: descuentoParaMotor(item.descuentoInput),
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
      {initialLoadErrors.length > 0 ? (
        <div className="orden-load-warning" role="alert">
          No se pudieron cargar: {initialLoadErrors.join(", ")}. Reintentá
          recargando antes de emitir para no trabajar con un catálogo incompleto.
        </div>
      ) : null}
      <div className="orden-head">
        <div className="left">
          {modoOrden ? (
            <nav className="orden-breadcrumb" aria-label="Ubicación">
              <span className="bc-item">
                <FactoryIcon />
                Producción
              </span>
              <span className="bc-sep">›</span>
              <Link className="bc-item bc-link" href="/produccion/ordenes">
                <ArrowLeftIcon />
                Órdenes de trabajo
              </Link>
            </nav>
          ) : null}
          {orden ? (
            <h1
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontFamily: "var(--font-mono)" }}>
                {orden.numero}
              </span>
              <EstadoOtBadge estado={orden.estado} />
              {sinComprobante ? <ChipSinComprobante /> : null}
              {mostrarRecienEmitida ? (
                <span className="otd-new-tag-lg">RECIÉN EMITIDA</span>
              ) : null}
            </h1>
          ) : (
            <h1>
              Nueva {ordenTipo === "orden" ? "orden de trabajo" : "propuesta"}
              <span className="status-chip">
                <span className="d" />
                Borrador
              </span>
              {sinComprobante ? <ChipSinComprobante /> : null}
            </h1>
          )}
          {/* En una OT emitida el cliente ya está en su card y el producto en
              la tabla: el subtítulo repetía. Se deja sólo la guía del alta. */}
          {!orden ? (
            <div className="sub">
              {ordenTipo === "orden"
                ? "Confirma productos, especificaciones y pagos para emitir la OT al taller."
                : "Arma la propuesta para enviar al cliente antes de confirmar la OT."}
            </div>
          ) : null}
        </div>
        <div className="right" style={{ alignItems: "center" }}>
          <div className="orden-meta">
            {/* El N° ya está grande a la izquierda; acá sólo la fecha. */}
            <span className="meta-row">
              <span className="ml">{modoOrden ? "Emitida" : "Creado"}</span>
              <span className="mv mono">
                {orden ? formatFechaOrden(orden.creadaEl) : "hoy"}
              </span>
            </span>
          </div>
          {!modoOrden ? (
            <OrdenSegmented
              value={ordenTipo}
              onChange={(value) => setTipo(fromOrdenTipo(value))}
            />
          ) : orden && orden.estado !== "cancelada" ? (
            // Sólo las acciones "rápidas" arriba (Seguimiento, QR, y Emitir si
            // es borrador). Editar/Cancelar bajaron a la barra de total para
            // ganar alto. Facturar quedó sólo en el tab Comprobantes.
            <div style={{ display: "flex", gap: 8 }}>
              {orden.estado === "borrador" ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void emitirBorrador()}
                  disabled={emitiendoBorrador}
                >
                  <CheckIcon />
                  {emitiendoBorrador ? "Emitiendo…" : "Emitir OT"}
                </button>
              ) : null}
              {publicToken ? (
                <button
                  type="button"
                  className="btn"
                  onClick={compartirSeguimiento}
                  title="Copiar el link público de seguimiento para el cliente"
                >
                  {trackCopiado ? <CheckIcon /> : <ExternalLinkIcon />}
                  {trackCopiado ? "Copiado" : "Seguimiento"}
                </button>
              ) : null}
              <button
                type="button"
                className="btn"
                onClick={() => setQrRetiroOpen(true)}
                title="QR que el cliente presenta para retirar el trabajo"
              >
                <QrCodeIcon />
                QR
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Cancelada: en vez del stepper —que mostraría un recorrido que no va a
          seguir— se cuenta qué pasó. El motivo es lo primero que pregunta
          cualquiera que abre una orden cancelada. */}
      {orden?.cancelacion ? (
        <div className="prf-cancelada">
          <div className="prf-cancelada-t">
            <XCircleIcon width={15} height={15} />
            Cancelada
            {orden.cancelacion.estadoAlCancelar
              ? ` cuando estaba ${(
                  ORDEN_TRABAJO_ESTADOS[
                    orden.cancelacion
                      .estadoAlCancelar as keyof typeof ORDEN_TRABAJO_ESTADOS
                  ]?.label ?? orden.cancelacion.estadoAlCancelar
                ).toLowerCase()}`
              : ""}
          </div>
          <div className="prf-cancelada-m">“{orden.cancelacion.motivo}”</div>
          <div className="prf-cancelada-f">
            {orden.cancelacion.por ? `${orden.cancelacion.por} · ` : ""}
            {fechaHora(orden.cancelacion.fecha)}
            {orden.cancelacion.pasosTotal > 0
              ? ` · ${orden.cancelacion.pasosHechos} de ${orden.cancelacion.pasosTotal} pasos hechos`
              : ""}
            {orden.cancelacion.minutosReales > 0
              ? ` · ${Math.round(orden.cancelacion.minutosReales)} min trabajados`
              : ""}
          </div>
        </div>
      ) : null}

      {orden && !orden.cancelacion ? (
        <div style={{ marginBottom: 12 }}>
          <StepperOt estado={orden.estado} fechasEstado={orden.fechasEstado} />
        </div>
      ) : null}

      <div className="orden-form">
        <FieldCard label="Cliente" icon={<UserIcon />}>
          {campoEditable("clienteId") ? (
            <ClienteCombobox
              value={clienteId}
              onChange={setClienteId}
              initialClientes={clientesDisponibles}
            />
          ) : (
            <div className="ctrl-input">
              <span>{orden?.clienteNombre}</span>
            </div>
          )}
        </FieldCard>

        <FieldCard label="Vendedor" icon={<UserIcon />}>
          <div className="ctrl-input has-avatar">
            {orden ? (
              <>
                <span className="av-sm">
                  {vendedorOrdenNombre(orden).slice(0, 2).toUpperCase()}
                </span>
                <span>{vendedorOrdenNombre(orden)}</span>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </FieldCard>

        <FieldCard label="Canal de venta" icon={<PackageIcon />}>
          {campoEditable("canalVenta") ? (
            <CanalVentaSelect value={canalVenta} onChange={setCanalVenta} />
          ) : (
            <div className="ctrl-input">
              <span>
                {CANALES_VENTA.find((canal) => canal.value === canalVenta)
                  ?.label ?? "Mostrador"}
              </span>
            </div>
          )}
        </FieldCard>

        <FieldCard
          label={modoOrden ? "Fecha de entrega" : "Fecha estimada"}
          icon={<CalendarIcon />}
        >
          {campoEditable("fechaEntrega") ? (
            <div className="ctrl-input">
              <input
                ref={fechaEstimadaInputRef}
                type="date"
                value={fechaEstimada}
                onClick={() => fechaEstimadaInputRef.current?.showPicker?.()}
                onChange={(event) => {
                  otFechaTocadaRef.current = true;
                  setFechaEstimada(event.target.value);
                }}
                aria-label="Fecha de entrega"
              />
            </div>
          ) : (
            <div className="ctrl-input">
              <span>{formatFechaOrden(orden?.fechaEntrega ?? null)}</span>
            </div>
          )}
          {(() => {
            const eta = describirEta(demoraOrden, fechaEstimada, { margenDias: margenEtaDias, noLaborables: colasTaller?.noLaborables, zona: zonaHoraria });
            if (!eta) return null;
            return (
              <div
                className={`eta-sugerida ${eta.nivel === "tarde" ? "tarde" : eta.nivel === "sin-margen" ? "justo" : ""}`}
                title={eta.motivo || "Simulado contra las colas actuales del taller"}
              >
                <ClockIcon />
                <span>
                  El taller la terminaría <strong>{eta.etiqueta}</strong>
                  {eta.sugeridaEtiqueta ? <> · prometé desde <strong>{eta.sugeridaEtiqueta}</strong></> : null}
                  {eta.nivel === "tarde" ? " — después de la fecha elegida" : eta.nivel === "sin-margen" ? " — la fecha elegida queda sin margen" : ""}
                </span>
              </div>
            );
          })()}
        </FieldCard>
      </div>

      {/* Columna flex que llena el alto disponible: deja que el resumen
          financiero de la pestaña Productos caiga anclado al fondo (margin-top
          auto) aun con la OT vacía, y que el `sticky` lo mantenga abajo al
          scrollear cuando hay muchos productos. */}
      <div
        className="orden-main-full"
        style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0 }}
      >
        <div className="orden-tabs-row">
          <OrdenTabs
            value={tab}
            onChange={setTab}
            count={items.length}
            historialCount={orden ? orden.eventos.length : undefined}
            comprobantesCount={orden ? 0 : undefined}
            archivosCount={archivosCount}
          />
          {!modoOrden || itemsEnEdicion ? (
            <div className="orden-actions">
              {!modoOrden ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setCargoOpen(true)}
                >
                  <CircleDollarSignIcon />
                  Agregar cargo
                </button>
              ) : null}
              {ccActivo ? (
                <button
                  type="button"
                  className="btn"
                  onClick={abrirCentroCopiado}
                  title="Carga rápida (C)"
                >
                  {/* Rayo en el naranja de acento del sistema. */}
                  <ZapIcon style={{ color: "#c2410c" }} />
                  Carga rápida
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-primary"
                onClick={abrirAgregarProducto}
                title="Agregar producto (P)"
              >
                <PlusIcon />
                Agregar producto
              </button>
            </div>
          ) : null}
        </div>

        <div className={resumenBar.scroll}>
        {tab === "productos" ? (
          <div className="orden-table">
            <div
              className="ohead"
              style={
                sinComprobante
                  ? { gridTemplateColumns: ORDEN_COLS_SIN_IMP }
                  : undefined
              }
            >
              <span className="ix">#</span>
              <span className="chev" />
              <span className="prod">Producto</span>
              <span className="num qty">Cantidad</span>
              <span className="num">Subtotal</span>
              {sinComprobante ? null : <span className="num">Imp.</span>}
              <span className="num">Unitario</span>
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
              {items.map((item, index) => {
                const tomo = tomoDeItem(item);
                const iniciaTomo = !!tomo && tomo !== tomoDeItem(items[index - 1]);
                const cuentaTomo = tomo
                  ? items.filter((x) => tomoDeItem(x) === tomo).length
                  : 0;
                return (
                <React.Fragment key={item.id}>
                {iniciaTomo && (
                  <div className={ccFicha.tomoHead}>
                    Tomo anillado
                    {tomoNombreDeItem(item) ? ` · ${tomoNombreDeItem(item)}` : ""}
                    <span className={ccFicha.cuenta}>· {cuentaTomo} documentos</span>
                  </div>
                )}
                <div
                  className={`order-row-wrap${recotizandoIds.has(item.id) ? " is-requoting" : ""}${tomo ? ` ${ccFicha.enTomo}` : ""}`}
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
                    sinComprobante={sinComprobante}
                    expanded={openIds.has(item.id)}
                    etaSistema={demoraPorItem?.get(item.id) ?? null}
                    margenEtaDias={margenEtaDias}
                    noLaborables={colasTaller?.noLaborables}
                    onToggle={() => toggle(item.id)}
                    onRemove={
                      modoOrden
                        ? itemsEnEdicion
                          ? () => quitarItemDeOrden(item)
                          : undefined
                        : () =>
                            setItems((current) =>
                              current.filter(
                                (candidate) => candidate.id !== item.id,
                              ),
                            )
                    }
                    onEdit={
                      modoOrden
                        ? itemsEnEdicion && item.jobContext && item.motorCodigo
                          ? () => abrirEdicion(item)
                          : undefined
                        : () => abrirEdicion(item)
                    }
                    onDescuento={
                      !modoOrden && item.jobContext && item.motorCodigo
                        ? () =>
                            setDescuentoTarget({
                              scope: "item",
                              itemId: item.id,
                            })
                        : undefined
                    }
                    onVerPrecios={
                      esCentroCopiado(item)
                        ? () => setPreciosOpen(true)
                        : undefined
                    }
                    onEditPanels={(targetItem, paso) => {
                      setPanelEditor({ item: targetItem, paso });
                    }}
                    onChangeFechaEntrega={(fechaEntrega) => {
                      itemFechaTocadaRef.current.add(item.id);
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
                    readOnly={modoOrden}
                  />
                </div>
                </React.Fragment>
                );
              })}
            </div>
            {!modoOrden || itemsEnEdicion ? (
              <button
                type="button"
                className="orden-add-ghost"
                onClick={abrirAgregarProducto}
              >
                <PlusIcon />
                Agregar otro producto a la{" "}
                {modoOrden || ordenTipo === "orden" ? "orden" : "propuesta"}
              </button>
            ) : null}
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
              {!modoOrden ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setCargoOpen(true)}
                >
                  <PlusIcon />
                  Agregar cargo
                </button>
              ) : null}
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
                    <strong>{formatCurrency(cargo.montoNeto, moneda)}</strong>
                  </div>
                  <div className="cargo-num">
                    <span>IVA</span>
                    <strong>{formatCurrency(cargo.impuestoMonto, moneda)}</strong>
                  </div>
                  <div className="cargo-num total">
                    <span>Total</span>
                    <strong>{formatCurrency(cargo.total, moneda)}</strong>
                  </div>
                  {!modoOrden ? (
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
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "produccion" ? (
          orden ? (
            <ProduccionOrdenTab ordenId={orden.id} onOrdenActualizada={recargarOrden} />
          ) : (
            <EmptyTab
              title="Programacion de produccion"
              description="Una vez confirmada la OT vas a poder ver pasos, maquinas asignadas y tiempos estimados aca."
            />
          )
        ) : null}
        {tab === "pagos" ? (
          orden ? (
            <div className="otd-page" style={{ padding: 0 }}>
              <PagosTab
                pago={orden.pago}
                total={orden.total}
                ordenId={orden.id}
                puedeCobrar={orden.estado !== "borrador"}
                sinComprobante={orden.tratamientoFiscal === "SIN_COMPROBANTE"}
              />
            </div>
          ) : (
            <div className="otd-page" style={{ padding: 0 }}>
              <PagosStagingTab
                total={totalPropuesta}
                sinComprobante={sinComprobante}
                cobros={cobrosStaged}
                onAgregar={(draft) =>
                  setCobrosStaged((prev) => [...prev, draft])
                }
                onQuitar={(index) =>
                  setCobrosStaged((prev) =>
                    prev.filter((_, i) => i !== index),
                  )
                }
              />
            </div>
          )
        ) : null}
        {tab === "comprobantes" && orden ? (
          <div className="otd-page" style={{ padding: 0 }}>
            <ComprobantesOrdenTab
              ordenId={orden.id}
              numero={orden.numero}
              total={orden.total}
              facturadoInicial={orden.facturadoTotal}
              cobradoInicial={orden.cobradoTotal}
              puedeFacturar={orden.estado !== "borrador"}
              recargarToken={0}
            />
          </div>
        ) : null}
        {tab === "archivos" ? (
          orden ? (
            <ArchivosOrdenTab
              ordenId={orden.id}
              onTotalCambio={setArchivosCount}
            />
          ) : (
            // Todavía es una propuesta sin persistir: los items son
            // borradores locales sin fila en la base, así que no hay dónde
            // colgar un archivo. Ver docs/archivos-r2-diseno.md §4.
            <EmptyTab
              title="Archivos"
              description="Guardá la propuesta o emitila como orden para poder adjuntar el arte y las referencias del cliente."
            />
          )
        ) : null}
        {tab === "costos" ? (
          <CostosOrdenTab
            items={items}
            cargosOrden={cargosOrden}
            ordenId={orden?.id}
            sinComprobante={sinComprobante}
          />
        ) : null}
        {tab === "historial" && orden ? (
          <div className="otd-card">
            <div className="otd-card-head">
              <span className="ttl">
                Historial <span className="ct">{orden.eventos.length}</span>
              </span>
            </div>
            {orden.eventos.length === 0 ? (
              <div className="otd-noprod">Sin eventos registrados.</div>
            ) : (
              <div className="otd-timeline">
                {orden.eventos.map((ev, i) => {
                  const { Icono, tone } =
                    EVENTO_ICONOS[ev.tipo] ?? EVENTO_ICONOS.nota;
                  return (
                    <div key={i} className={`otd-ev ${tone ?? ""}`}>
                      <span className="otd-ev-ico">
                        <Icono />
                      </span>
                      <div className="otd-ev-body">
                        <div className="otd-ev-txt">{ev.descripcion}</div>
                        <div className="otd-ev-meta">
                          <span className="mono">
                            {formatEventoFecha(ev.fecha)}
                          </span>{" "}
                          · {ev.usuarioNombre}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
        </div>

        {tab === "productos" ? (
          <ResumenBar
            items={items}
            cargosOrden={cargosOrden}
            tipo={ordenTipo}
            onEmitir={emitirOrden}
            onEmitirPresupuesto={emitirPresupuestoCb}
            emitiendo={emitiendo || emitiendoPresupuesto}
            onGuardarBorrador={() =>
              cobrosStaged.length > 0
                ? setConfirmBorradorConCobros(true)
                : void guardarBorrador()
            }
            guardandoBorrador={guardandoBorrador}
            onDescuentoOrden={
              modoOrden
                ? undefined
                : () => setDescuentoTarget({ scope: "orden", itemId: null })
            }
            onCuponOrden={
              modoOrden
                ? undefined
                : () =>
                    setDescuentoTarget({
                      scope: "orden",
                      itemId: null,
                      cupon: true,
                    })
            }
            sinComprobante={sinComprobante}
            onToggleTratamientoFiscal={
              puedeToggleFiscal ? toggleTratamientoFiscal : undefined
            }
            togglingFiscal={togglingFiscal}
            readOnly={modoOrden}
            accionesOrden={
              modoOrden &&
              orden &&
              orden.estado !== "cancelada" &&
              (camposEditablesOrden(orden.estado).size > 0 ||
                esCancelable(orden.estado)) ? (
                editandoOrden ? (
                  <>
                    <button
                      type="button"
                      className="btn"
                      onClick={cancelarEdicion}
                      disabled={guardandoEdicion}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void guardarEdicion()}
                      disabled={guardandoEdicion}
                    >
                      <CheckIcon />
                      {guardandoEdicion
                        ? "Guardando…"
                        : cambiosSinGuardar > 0
                          ? `Guardar cambios (${cambiosSinGuardar})`
                          : "Guardar cambios"}
                    </button>
                  </>
                ) : (
                  <>
                    {camposEditablesOrden(orden.estado).size > 0 ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setEditandoOrden(true)}
                      >
                        <Edit3Icon />
                        Editar orden
                      </button>
                    ) : null}
                    {esCancelable(orden.estado) ? (
                      <button
                        type="button"
                        className="btn"
                        style={{
                          background: "#ea580c",
                          color: "#fff",
                          borderColor: "#ea580c",
                        }}
                        onClick={() => setConfirmCancelar(true)}
                        disabled={cancelando || (facturaViva && !puedeAnular)}
                        title={
                          facturaViva && !puedeAnular
                            ? "La orden está facturada: administración tiene que emitir la nota de crédito antes de cancelarla"
                            : acreditaYCancela
                              ? "Cancelar la orden: primero se acredita la factura con una nota de crédito"
                              : "Cancelar la orden: sale del taller y deja de contar como venta"
                        }
                      >
                        <XCircleIcon />
                        Cancelar orden
                      </button>
                    ) : null}
                  </>
                )
              ) : undefined
            }
          />
        ) : null}
      </div>

      {emitiendo ? (
        <EmitOverlay numero={emisionNumero} onDone={finalizarEmision} />
      ) : null}

      {/* Montado SIEMPRE y controlado por `open`, igual que los demás
          modales de la ficha: montarlo condicionalmente agrega/saca un
          consumidor de useId y desalinea los ids generados entre server y
          cliente (hydration mismatch en el menú de usuario del topbar). */}
      <AvisoOtEnBorrador
        open={avisoBorradorAbierto && orden?.estado === "borrador"}
        numero={orden?.numero ?? ""}
        emitiendo={emitiendoBorrador}
        onEmitirAhora={emitirDesdeAviso}
        onEmitirDespues={() => setAvisoBorradorAbierto(false)}
      />

      <ConfirmacionSalida
        open={navPendiente !== null}
        cambios={cambiosSinGuardar}
        guardando={guardandoEdicion}
        onGuardarYSalir={() => {
          if (orden) {
            void guardarEdicion({ destino: navPendiente ?? undefined });
            return;
          }
          if (cobrosStaged.length > 0) {
            setNavPendiente(null);
            setConfirmBorradorConCobros(true);
            return;
          }
          void guardarBorrador();
        }}
        onDescartarYSalir={descartarYSalir}
        onSeguirEditando={() => setNavPendiente(null)}
      />

      <ConfirmacionDestructiva
        open={confirmBorradorConCobros}
        onOpenChange={setConfirmBorradorConCobros}
        titulo="El borrador no guarda los cobros"
        descripcion={`Tenés ${cobrosStaged.length} cobro${cobrosStaged.length === 1 ? "" : "s"} cargado${cobrosStaged.length === 1 ? "" : "s"} en la pestaña Pagos. Los cobros se registran recién al emitir la orden: un borrador no puede recibir plata.`}
        impacto={[
          "El borrador se guarda con productos, cliente y condiciones.",
          "Los cobros cargados se descartan (volvé a cargarlos al emitir).",
        ]}
        requiereTipear={false}
        accionLabel="Guardar borrador igualmente"
        onConfirmar={() => guardarBorrador()}
      />

      <ConfirmacionDestructiva
        open={confirmCancelar}
        onOpenChange={setConfirmCancelar}
        titulo={`Cancelar la orden ${orden?.numero ?? ""}`}
        descripcion={
          acreditaYCancela
            ? "Esta orden está facturada, así que el sistema emite primero la nota de crédito que la acredita ante ARCA y recién entonces la cancela. Si ARCA rechaza la nota, no se cancela nada."
            : "La orden sale del taller y deja de contar como venta. El trabajo que ya se hizo queda registrado: las horas del equipo no se borran."
        }
        impacto={impactoCancelacion}
        requiereTipear={false}
        motivo={{
          label: "¿Por qué se cancela? Queda en el historial de la orden.",
          placeholder:
            "Ej.: el cliente se arrepintió · error de carga · no aprobó el arte",
        }}
        accionLabel="Cancelar la orden"
        onConfirmar={(motivo) => cancelarOrden(motivo)}
      />

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
          // En modo orden es staging: la fila queda local y el POST real va
          // recién en "Guardar cambios".
          setItems((current) => [...current, item]);
          // Se agrega COLAPSADO: la fila aparece cerrada (igual que el centro
          // de copiado) y el comercial la expande si la necesita. Antes se
          // abría sola y ocupaba media pantalla en cada alta.
          setAddOpen(false);
          setEditingItem(null);
          focusProductRow(item.id);
        }}
        onSaveItem={(item) => {
          // El sheet recotiza SIN descuento: si la línea tenía uno, se reaplica
          // sobre la nueva config (recotización) para no perderlo.
          const descuentoPrevio =
            items.find((candidate) => candidate.id === item.id)
              ?.descuentoInput ?? null;
          if (descuentoPrevio) {
            void recotizarItemConDescuento(item, descuentoPrevio)
              .then((actualizado) =>
                setItems((current) =>
                  current.map((candidate) =>
                    candidate.id === item.id
                      ? (actualizado ?? {
                          ...item,
                          descuentoInput: descuentoPrevio,
                        })
                      : candidate,
                  ),
                ),
              )
              .catch(() => {
                setItems((current) =>
                  current.map((candidate) =>
                    candidate.id === item.id ? item : candidate,
                  ),
                );
                toast.warning(
                  "El producto se guardó, pero no se pudo reaplicar el descuento. Volvé a cargarlo.",
                );
              });
          } else {
            setItems((current) =>
              current.map((candidate) =>
                candidate.id === item.id ? item : candidate,
              ),
            );
          }
          if (modoOrden && persistedItemIds.has(item.id)) {
            // Marca el item persistido como editado en el staging.
            setEditadosIds((prev) => new Set(prev).add(item.id));
          }
          setOpenIds(new Set([item.id]));
          setAddOpen(false);
          setEditingItem(null);
          focusProductRow(item.id);
        }}
      />
      <CentroCopiadoSheet
        open={copiadoOpen}
        editItems={copiadoEditItems}
        onOpenChange={(open) => {
          setCopiadoOpen(open);
          if (!open) setCopiadoEditItems(null);
        }}
        onAgregar={(nuevos) => {
          if (nuevos.length === 0) return;
          // En edición se reemplaza la CARGA completa (todos sus renglones).
          const cargaEditada = copiadoEditItems?.length
            ? cargaDeItem(copiadoEditItems[0])
            : null;
          setItems((current) => {
            const base = cargaEditada
              ? current.filter((i) => cargaDeItem(i) !== cargaEditada)
              : current;
            return [...base, ...nuevos];
          });
          // Se agregan COLAPSADOS (son varios renglones; expandir todos ocupa
          // demasiado). Se los diferencia por la referencia (varianteNombre).
          setCopiadoOpen(false);
          setCopiadoEditItems(null);
          focusProductRow(nuevos[0].id);
        }}
      />
      <CentroCopiadoPreciosSheet
        open={preciosOpen}
        onClose={() => setPreciosOpen(false)}
        items={items}
        moneda={moneda}
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
      <DescuentoModal
        target={descuentoTarget}
        items={items.filter((item) => item.jobContext && item.motorCodigo)}
        clienteId={clienteId || null}
        aplicando={descuentoAplicando}
        onClose={() => setDescuentoTarget(null)}
        onApply={(scope, targetItemId, descuento) =>
          void aplicarDescuento(scope, targetItemId, descuento)
        }
        onApplyCupon={(cupon, alcanzadas) =>
          void aplicarCupon(cupon, alcanzadas)
        }
        onAviso={setAvisoCupon}
      />

      {/* Va fuera del modal de descuento a propósito: el aviso sobrevive a
          que ese modal se cierre al aplicar. */}
      <CuponAvisoModal
        aviso={avisoCupon}
        onCerrar={() => setAvisoCupon(null)}
      />

      {qrRetiroOpen && orden ? (
        <QrRetiroModal
          numero={orden.numero}
          cliente={orden.clienteNombre}
          onClose={() => setQrRetiroOpen(false)}
        />
      ) : null}
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
