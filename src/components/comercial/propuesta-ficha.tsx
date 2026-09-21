"use client";
import { useImpresionDirecta, useCapacidad } from "@/components/navigation/capacidades-provider";

import { TipoCambioPanel } from "./tipo-cambio-panel";
import type { TipoCambioSnapshot } from "@/lib/tipo-cambio-api";
import {
  useMotorConTipoCambio,
  useTipoCambioDocumento,
  TipoCambioDocumentoProvider,
} from "./tipo-cambio-documento";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import {
  fechaFinalDistribucion,
  fechaFinalItems,
} from "@/lib/planificacion-entregas";

import { usePrevisionMateriales } from "@/hooks/use-prevision-materiales";
import { condicionarPorMateriales } from "@/lib/prevision-materiales";
import { PrevisionMaterialesPanel } from "./prevision-materiales-panel";
import { getContextoPrevision } from "@/lib/eta-api";
import { itemHipoteticoDesdeCotizacion } from "@/lib/eta-cotizacion";
import { describirEta, fechaRecomendadaEta } from "@/lib/eta-fechas";
import fechasStyles from "./propuesta-fechas.module.css";

import { DesgloseOperacionesCorte } from "./desglose-operaciones-corte";

import { CampanaSelectorOrden } from "./campana-selector-orden";
import { OrdenWorkspace, type OrdenWorkspaceHandle } from "./orden-workspace";
import { CanalVentaSelector } from "./canal-venta-selector";
import { canalVentaValido, nombreCanalVenta } from "@/lib/canales-venta";
import workspaceStyles from "./orden-workspace.module.css";
import itemStyles from "./orden-item-detalle.module.css";
import itemCostStyles from "./orden-item-costos.module.css";
import workspaceTheme from "@/components/ui/workspace-theme.module.css";
import { cn } from "@/lib/utils";
import { Chip, Input as HeroInput, Tabs as HeroTabs } from "@heroui/react";
import { NavigationTabList } from "@/components/design-system/navigation-tab-list";
import { IdentityAvatar } from "@/components/design-system/identity-avatar";
import { ActionButton as HeroButton } from "@/components/design-system/action-button";
import { DesignSystemProvider, useLegacyDesignScope } from "@/components/design-system/appearance";
import designTheme from "@/components/design-system/brand-workspace-theme.module.css";
import {
  calcularResumenOrden,
  descuentoMontoDeItem,
  getItemOrderVisibleAmounts,
} from "@/lib/orden-productos-presentacion";
import { OrdenSummaryDetails } from "./orden-summary-details";
import { OrdenProductosTable } from "./orden-productos-table";
import {
  OrdenSegmented,
  OrdenTabs,
  FieldCard,
  type OrdenTab,
} from "./orden-ficha-presentacion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { esFamiliaCorteNesting } from "@/lib/nesting-procesos";
import { NestingPatronesDescargas } from "@/components/nesting/nesting-patrones-descargas";
import { vincularFuentesFabricacion } from "@/lib/fabricacion-export";

import * as React from "react";
import issued from "./orden-issued.module.css";
import { OrdenSectionHeading } from "./orden-section-heading";
import { PlanificacionEntregas } from "./planificacion-entregas";
import {
  useEntregasPrevias,
  type EntregasPreviasProps,
} from "./use-entregas-previas";
import type { VinculoPlanEntrega } from "@/lib/planificacion-entregas";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleDollarSignIcon,
  Grid2X2Icon,
  Layers3Icon,
  PaletteIcon,
  PrinterIcon,
  RulerIcon,
  SlidersHorizontalIcon,
  BadgePercentIcon,
  BlocksIcon,
  CalendarIcon,
  ClockIcon,
  CheckIcon,
  ChevronRightIcon,
  DownloadIcon,
  Edit3Icon,
  XCircleIcon,
  ExternalLinkIcon,
  ExpandIcon,
  FactoryIcon,
  FileXIcon,
  FolderIcon,
  GitCommitHorizontalIcon,
  PackageCheckIcon,
  PackageIcon,
  PlusIcon,
  QrCodeIcon,
  LinkIcon,
  SaveIcon,
  TriangleAlertIcon,
  UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useCambiosSistema } from "@/components/notificaciones/notificaciones-provider";

import type { ClienteDetalle } from "@/lib/clientes";
import type { CurrentUser } from "@/lib/auth";
import type {
  CargoDirectoCatalogo,
  ProductoListItem,
} from "@/lib/productos-servicios";
import { type NestingViewerInput } from "@/lib/productos-servicios-api";
import {
  cambiarEstadoOrdenTrabajo,
  cancelarOrdenTrabajo,
  crearOrdenTrabajo,
  editarOrdenTrabajoLote,
  getOrdenTrabajo,
  setTratamientoFiscalOrden,
} from "@/lib/ordenes-trabajo-api";
import {
  emitirPresupuesto,
  getConfigPresupuestos,
} from "@/lib/presupuestos-api";
import { type ValidarCuponResultado } from "@/lib/cupones-api";
import { validarYAplicarCuponOrden } from "@/lib/cupones-orden";
import { CLIENTE_ESCANEADO_EVENT } from "@/lib/clientes-api";
import {
  getCampanasOpciones,
  type CampanaReferencia,
} from "@/lib/campanas-api";
import { parsearDniArgentino } from "@/lib/dni-argentino";
import { esNumeroOrden } from "@/components/mostrador/entrega-escaneo-watcher";
import { EntregaModal } from "@/components/mostrador/entrega-modal";
import { useEscaneoCodigo } from "@/lib/use-escaneo-codigo";
import {
  CuponAvisoModal,
  type AvisoCupon,
} from "@/components/comercial/cupon-aviso";
import { useImpresionDocumentos } from "@/components/impresion/documentos-impresion-contexto";
import { EmisionDocumentosDialog } from "@/components/impresion/emision-documentos-dialog";
import { EtiquetaOrdenDialog } from "@/components/impresion/etiqueta-orden-dialog";
import { QrRetiroModal } from "@/components/comercial/qr-retiro-modal";
import { enlacePublicoUrl } from "@/lib/enlaces-publicos";
import { itemsConSelloDe } from "@/lib/sello-arte/diseno";
import {
  mensajeDeArtes,
  publicarArtesDeSello,
} from "@/lib/sello-arte/publicar";
import { publicarPlanos, type PlanosDeItem } from "@/lib/planos-persistir";
import {
  subirArchivo,
  listarArchivos,
  eliminarArchivo,
} from "@/lib/archivos-api";
import type { BriefDisenoArchivoPendiente } from "@/lib/brief-diseno";
import { ProduccionOrdenTab } from "@/components/comercial/produccion-orden-tab";
import { MaterialesOrdenTab } from "@/components/comercial/materiales-orden-tab";
import { BastidorVisor } from "@/components/carteleria/bastidor-visor";
import { StepperOt } from "@/components/comercial/stepper-ot";
import {
  estimarDemoraNuevos,
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
  formatCurrency,
  formatMaterialUnitPrice,
  formatUnidad,
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
  proyectarPasoOperacionInterna,
  sumCargosPaso,
  sumCargosYTiempoExtraPaso,
  sumMaterialesPaso,
  consolidarCostosOrden,
} from "@/lib/costos-orden";
import {
  construirWorkflowCotizacion,
  type ComponenteWorkflowCotizacion,
} from "@/lib/workflow-cotizacion";
import {
  calcularCostoMermaTiempo,
  calcularItemsMermaMaterial,
} from "@/lib/desglose-merma-material";
import { FidelizacionCotizador } from "@/components/comercial/fidelizacion-cotizador";
import { type Moneda } from "@/lib/moneda";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { AgregarProductoSheet } from "@/components/comercial/agregar-producto-sheet";
import { ComponentesEspecificaciones } from "@/components/comercial/componentes-especificaciones";
import { componentesTienenMaterialEfectivo } from "@/lib/especificaciones-componentes";
import {
  BriefDisenoDialog,
  BriefDisenoEspecificaciones,
} from "@/components/comercial/brief-diseno-resumen";
import { briefDisenoTieneContenido, leerBriefDiseno } from "@/lib/brief-diseno";
import CentroCopiadoSheet from "@/components/comercial/centro-copiado-sheet";
import CentroCopiadoPreciosSheet from "@/components/comercial/centro-copiado-precios-sheet";
import {
  cantidadLibrosCentroCopiado,
  dimsDeFormato,
  estadoCentroCopiado,
  metaCentroCopiado,
} from "@/lib/centro-copiado-api";
import { CostosOrdenTab } from "@/components/comercial/costos-orden-tab";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import type { EstadoDocumentalOrden } from "@/lib/desarrollo-documental-api";
import { ProduccionEntregas } from "./produccion-entregas";
import { NestingViewer } from "@/components/nesting/nesting-viewer";
import nestingStyles from "@/components/nesting/nesting-viewer.module.css";
import { RecorridoCortePanel } from "@/components/produccion/recorrido-corte-panel";
import { PlantillaInstalacionPanel } from "@/components/produccion/plantilla-instalacion-panel";
import {
  descargarTexto,
  nombreBaseSvg,
  obtenerFuenteVectorial,
} from "@/lib/nesting-vectorial-export";
import {
  layoutPliegosEnHoja,
  type LayoutPliegosEnHoja,
} from "@/lib/nesting-compra-pliego";
import { NestingCompraPliegoModal } from "./nesting-compra-pliego-viewer";
import costC from "./propuesta-ficha-costos.module.css";
import { netoListaDeItem, type DescuentoInput } from "@/lib/descuentos-orden";
import { CargoOrdenDialog } from "./cargo-orden-dialog";
import { OrdenCargosList } from "./orden-cargos-list";
import {
  DescuentoOrdenDialog,
  type DescuentoTarget,
} from "./descuento-orden-dialog";
import { OrdenCuponField } from "./orden-cupon-field";
import { ResumenBar, OrdenSaveActions } from "./orden-resumen-financiero";
import { OrdenFinancialActions } from "./orden-financial-actions";
import { OrdenDatosSections } from "./orden-datos-sections";
import { ClienteLista } from "./cliente-selector-orden";
import { useClientesOrden } from "./use-clientes-orden";
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
  initialDocumentos?: EstadoDocumentalOrden | null;
};

type InnerTab = "specs" | "costos" | "produccion" | "aprovechamiento";
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

function requierePreparacionPolyfan(item: PropuestaItem) {
  return item.cotizacion.pasos.some(
    (paso) => paso.activado && paso.familiaCodigo === "corte_hilo_caliente",
  );
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
        <svg
          className="op-caras-ico"
          viewBox="0 0 26 26"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="3"
            y="5"
            width="13"
            height="18"
            rx="2"
            fill="var(--surface,#fff)"
            stroke="var(--muted,#b8b6b1)"
            strokeWidth="1.5"
          />
          <rect
            x="10"
            y="3"
            width="13"
            height="18"
            rx="2"
            fill="var(--surface,#fff)"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <line
            x1="13"
            y1="8"
            x2="20"
            y2="8"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <line
            x1="13"
            y1="12"
            x2="20"
            y2="12"
            stroke="var(--muted,#b8b6b1)"
            strokeWidth="1.4"
          />
        </svg>
      ) : (
        <svg
          className="op-caras-ico"
          viewBox="0 0 26 26"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="6"
            y="3"
            width="14"
            height="20"
            rx="2"
            fill="var(--surface,#fff)"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <line
            x1="9"
            y1="8"
            x2="17"
            y2="8"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <line
            x1="9"
            y1="12"
            x2="17"
            y2="12"
            stroke="var(--muted,#b8b6b1)"
            strokeWidth="1.4"
          />
          <line
            x1="9"
            y1="16"
            x2="14"
            y2="16"
            stroke="var(--muted,#b8b6b1)"
            strokeWidth="1.4"
          />
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
  const cantidadLibros =
    item.unidadMedida === "libros"
      ? cantidadLibrosCentroCopiado(jobContext)
      : null;
  const cantidad =
    cantidadLibros ??
    cotizacion.cantidadComercialPricing ??
    cotizacion.cantidadEfectiva ??
    item.cantidad;

  return {
    ...item,
    cantidad,
    precioUnitario:
      cantidadLibros && cantidad > 0
        ? subtotal / cantidad
        : getCotizacionUnitario(cotizacion),
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
  const tipoTecnico = normalizeSearchText(
    material.materiaPrimaTipoTecnico ?? "",
  );
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
  if (
    (attrs.micrones ?? attrs.espesorMicrones ?? attrs.espesor) &&
    attrs.acabado
  ) {
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
    if (
      value &&
      !parts.some(
        (part) => normalizeSearchText(part) === normalizeSearchText(value),
      )
    ) {
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
    push(
      technologyCodeLabel(
        getAttrText(attrs, ["tecnologiaCompatible", "equipoCompatible"]),
      ),
    );
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
    return (
      normalizedPart.length > 0 && !normalizedName.includes(normalizedPart)
    );
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
  const caras = Number(
    (item.jobContext as Record<string, unknown> | undefined)?.caras,
  );
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
function getMontajeSustratoMaterial(
  item: PropuestaItem,
): MaterialCosteo | null {
  const montajePaso = item.cotizacion.pasos.find(
    (paso) => paso.activado && paso.familiaCodigo === "montaje_sobre_sustrato",
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
    const pasoLabel =
      paso.nombreVisible?.trim() || humanizeCodigo(paso.familiaCodigo);
    const pasoNorm = normalizeSearchText(pasoLabel);
    if (
      !pasoNorm ||
      (!pasoNorm.includes(adicionalNorm) && !adicionalNorm.includes(pasoNorm))
    ) {
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
    ? `${formatMaterialUnitPrice(value, moneda)} / ${unidadLabel}`
    : formatMaterialUnitPrice(value, moneda);
}

function formatUnidadCosto(unidad: string, cantidad = 1) {
  const normalized = unidad.trim().toLowerCase();
  const isSingular = Math.abs(cantidad) === 1;
  const pluralizable: Record<string, { singular: string; plural: string }> = {
    gramo: { singular: "gramo", plural: "gramos" },
    botella: { singular: "botella", plural: "botellas" },
    hoja: { singular: "hoja", plural: "hojas" },
    placa: { singular: "placa", plural: "placas" },
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
  const maquina = result?.maquina?.nombre?.trim();
  if (maquina) return maquina;
  const sustrato = result?.sustrato?.nombre?.trim();
  if (sustrato) return sustrato;
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

type ComponenteNestingRecursivo = {
  jobContext?: Record<string, unknown>;
  codigo?: string;
  nombre?: string;
  pasos?: Array<
    Partial<PasoCosteo> & {
      rutaPasoOrden: number;
      familiaCodigo: string;
      activado: boolean;
      costoTotal: number;
      nestingResult?: NestingViewerInput;
      operacionesInternas?: Array<{
        codigo: string;
        nombre: string;
        familiaCodigo: string;
        activada: boolean;
        duracionMin: number;
        costoTotal: number;
        centroCostoId?: string | null;
        centroCostoNombre?: string | null;
        materiales?: PasoCosteo["materiales"];
        nestingResult?: NestingViewerInput;
      }>;
    }
  >;
  componentes?: ComponenteNestingRecursivo[];
};

type FuenteNesting = {
  key: string;
  label: string;
  paso: PanelEditorPaso;
  /** Sólo el paso raíz pertenece al editor de paneles del item padre. */
  editable: boolean;
  /** Metadatos internos para reemplazar participantes por su lote común. */
  componenteCodigo?: string;
  rutaComponentes?: string[];
  pasoClave?: string;
  orden: number;
};

/**
 * El nesting puede pertenecer a un paso raíz, una operación interna de una
 * etapa consolidada o cualquier nivel fabricado del BOM. La cotización ya
 * conserva esos resultados: esta función evita que Producción mire solamente
 * el primer nivel y haga desaparecer los acomodos de componentes/etapas.
 */
function recolectarNestingsCotizacion(
  cotizacion: CotizacionPropuestaSnapshot,
  jobContext?: Record<string, unknown>,
): FuenteNesting[] {
  const fuentes: FuenteNesting[] = [];
  let secuencia = 0;

  const agregarPaso = (
    paso: PasoCosteo,
    contexto: string | null,
    editable: boolean,
    componenteCodigo?: string,
    contextoVectorial?: Record<string, unknown>,
    rutaComponentes?: string[],
  ) => {
    if (paso.nestingResult)
      paso = {
        ...paso,
        nestingResult: vincularFuentesFabricacion(
          paso.nestingResult,
          contextoVectorial,
        ),
      };
    if (paso.nestingResult) {
      secuencia += 1;
      fuentes.push({
        key: `${contexto ?? "raiz"}-${nestingPasoKey(paso)}-${secuencia}`,
        label: [contexto, nestingTabLabel(paso.nestingResult)]
          .filter(Boolean)
          .join(" · "),
        paso: paso as PanelEditorPaso,
        editable,
        componenteCodigo,
        rutaComponentes,
        pasoClave: paso.configPasoId,
        orden: secuencia,
      });
    }

    for (const operacion of paso.operacionesInternas ?? []) {
      if (!operacion.nestingResult) continue;
      secuencia += 1;
      const pasoInterno = {
        rutaPasoOrden: paso.rutaPasoOrden,
        familiaCodigo: operacion.familiaCodigo,
        nombreVisible: operacion.nombre,
        activado: operacion.activada,
        costoTotal: operacion.costoTotal,
        tiempo: {
          totalMin: operacion.duracionMin,
          centroCostoId: operacion.centroCostoId ?? null,
          centroCostoNombre: operacion.centroCostoNombre ?? null,
          tarifaHora: 0,
          costo: 0,
        },
        materiales: operacion.materiales ?? [],
        nestingResult: vincularFuentesFabricacion(
          operacion.nestingResult,
          contextoVectorial,
        ),
      } as PanelEditorPaso;
      fuentes.push({
        key: `${contexto ?? "etapa"}-${operacion.codigo}-${secuencia}`,
        label: [
          contexto,
          paso.nombreVisible?.trim() || "Etapa",
          operacion.nombre,
        ]
          .filter(Boolean)
          .join(" · "),
        paso: pasoInterno,
        editable: false,
        componenteCodigo,
        rutaComponentes,
        orden: secuencia,
      });
    }
  };

  cotizacion.pasos.forEach((paso) =>
    agregarPaso(paso, null, true, undefined, jobContext),
  );

  const recorrerComponentes = (
    componentes: ComponenteNestingRecursivo[],
    rutaPadre: string[] = [],
    codigosPadre: string[] = [],
  ) => {
    for (const componente of componentes) {
      const nombre =
        componente.nombre?.trim() || componente.codigo || "Componente";
      const ruta = [...rutaPadre, nombre];
      const codigos = [...codigosPadre, componente.codigo ?? ""];
      for (const paso of componente.pasos ?? []) {
        agregarPaso(
          paso as PasoCosteo,
          ruta.join(" › "),
          false,
          componente.codigo,
          componente.jobContext,
          codigos,
        );
      }
      recorrerComponentes(componente.componentes ?? [], ruta, codigos);
    }
  };

  recorrerComponentes(
    (cotizacion.componentesFabricados ??
      []) as unknown as ComponenteNestingRecursivo[],
  );

  const gruposAplicados =
    cotizacion.analisisNestingCompuesto?.grupos.filter(
      (grupo) => grupo.aplicacion?.aplicado === true && grupo.lote,
    ) ?? [];
  if (gruposAplicados.length === 0) return fuentes;

  const suprimidas = new Set<string>();
  const consolidadas: FuenteNesting[] = [];
  const nombresPorCodigo = new Map<string, string>();
  const indexarNombres = (componentes: ComponenteNestingRecursivo[]) => {
    for (const componente of componentes) {
      if (componente.codigo) {
        nombresPorCodigo.set(
          componente.codigo,
          componente.nombre?.trim() || componente.codigo,
        );
      }
      indexarNombres(componente.componentes ?? []);
    }
  };
  indexarNombres(
    (cotizacion.componentesFabricados ??
      []) as unknown as ComponenteNestingRecursivo[],
  );

  for (const grupo of gruposAplicados) {
    const lote = grupo.lote!;
    const participantes = grupo.participantes.map((participante) =>
      fuentes.find(
        (fuente) =>
          fuente.componenteCodigo === participante.componenteCodigo &&
          (fuente.pasoClave === participante.pasoClave ||
            fuente.paso.rutaPasoId === participante.rutaPasoId),
      ),
    );
    // Ante un snapshot incompleto conservamos los resultados individuales: es
    // preferible mostrar más información que inventar una asociación.
    if (participantes.some((participante) => !participante)) continue;
    const fuentesParticipantes = participantes as FuenteNesting[];
    const base = fuentesParticipantes[0];
    const baseResult = base.paso.nestingResult;
    const snapshot = lote.nestingResult;
    const cantidadSustratos = snapshot.substrates.reduce(
      (total, substrate) =>
        total + (substrate.kind === "sheet" ? substrate.count : 1),
      0,
    );
    const placements = snapshot.placements.map((placement) => {
      const meta =
        placement.meta &&
        typeof placement.meta === "object" &&
        !Array.isArray(placement.meta)
          ? (placement.meta as Record<string, unknown>)
          : {};
      const codigo =
        typeof meta.componenteCodigo === "string"
          ? meta.componenteCodigo
          : null;
      return {
        ...placement,
        meta: {
          ...meta,
          ...(codigo ? { label: nombresPorCodigo.get(codigo) ?? codigo } : {}),
        },
      };
    });
    const nestingResult: NestingViewerInput = {
      ...baseResult,
      ...snapshot,
      algorithm: snapshot.algorithm,
      cantidadCalculada: snapshot.cantidadCalculada ?? cantidadSustratos,
      unidad:
        snapshot.unidad ??
        (snapshot.substrates.some((substrate) => substrate.kind === "roll")
          ? "m_lineales"
          : "pliegos"),
      aprovechamientoPct: snapshot.aprovechamientoPct,
      maquina: snapshot.maquina ?? baseResult.maquina,
      sustrato: snapshot.sustrato ?? baseResult.sustrato,
      substrates: snapshot.substrates,
      placements,
      piezasAcomodadas: snapshot.piezasAcomodadas ?? placements.length,
      visualConfig: snapshot.visualConfig ?? baseResult.visualConfig,
      costingPreview: snapshot.costingPreview,
      composicionCompuesta: {
        participantes: grupo.participantes.length,
        sustratosIndependientes: grupo.independiente.sustratos,
        sustratosConsolidados: grupo.consolidado.sustratos,
        ahorroPct: grupo.diferencia.ahorroPct,
      },
    };

    const materialBase = base.paso.materiales?.find(
      (material) =>
        material.materialVarianteId === lote.materialVarianteId &&
        (material.detalleCosteoNesting ||
          material.asignacionNestingCompuesto?.loteId === lote.id),
    );
    const costeo = lote.costeoSustrato;
    const detalleExacto = costeo
      ? {
          strategy: costeo.strategy,
          totalCost: costeo.totalCost,
          unitPrice: costeo.unitPrice,
          pricePerM2: costeo.pricePerM2,
          fullUnits: costeo.fullUnits,
          fullUnitsCost: costeo.fullUnitsCost,
          lastUnit: costeo.lastUnit,
          units: costeo.units,
        }
      : materialBase?.detalleCosteoNesting
        ? {
            ...materialBase.detalleCosteoNesting,
            totalCost: lote.costoMaterialTotal,
            fullUnits: 0,
            fullUnitsCost: 0,
            lastUnit: null,
            units: [],
          }
        : null;
    const materiales =
      materialBase && detalleExacto
        ? [
            {
              ...materialBase,
              materialNombre: lote.materialNombre,
              materialDisplayName: lote.materialNombre,
              cantidad:
                detalleExacto.unitPrice > 0
                  ? detalleExacto.totalCost / detalleExacto.unitPrice
                  : materialBase.cantidad,
              costoTotal: detalleExacto.totalCost,
              detalleCosteoNesting: detalleExacto,
            },
          ]
        : [];

    fuentesParticipantes.forEach((fuente) => suprimidas.add(fuente.key));
    consolidadas.push({
      key: `lote-${lote.id}`,
      label: `${lote.layoutOrigenLoteId ? "Corte láser consolidado" : "Nesting consolidado"} · ${nestingTabLabel(nestingResult)}`,
      paso: {
        ...base.paso,
        nombreVisible: `${lote.layoutOrigenLoteId ? "Corte compartido" : "Nesting consolidado"} de ${grupo.participantes.length} componentes`,
        costoTotal: lote.costoTotalAsignado,
        materiales,
        nestingResult,
      },
      editable: false,
      orden: Math.min(...fuentesParticipantes.map((fuente) => fuente.orden)),
    });
  }

  return [
    ...fuentes.filter((fuente) => !suprimidas.has(fuente.key)),
    ...consolidadas,
  ].sort((a, b) => a.orden - b.orden);
}

function formatMinutos(min: number) {
  return `${min.toLocaleString("es-AR", { maximumFractionDigits: 1 })} min`;
}

function formatTiempoPaso(paso: PasoCosteo) {
  if (!paso.tiempo) return "-";
  return formatMinutos(paso.tiempo.totalMin);
}

function formatTarifaCentroCosto(paso: PasoCosteo, moneda: Moneda) {
  if (paso.tercerizado) return "Costo tercerizado";
  if (!paso.tiempo?.tarifaHora) return "Sin tarifa";
  return `${formatCurrency(paso.tiempo.tarifaHora, moneda)}/h`;
}

function getCentroCostoLabel(paso: PasoCosteo) {
  if (!paso.activado) return "No aplica";
  if (paso.tercerizado) return "Proveedor";
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
  costosMoneda,
}: {
  materiales: MaterialCosteo[];
  costosMoneda: CotizacionPropuestaSnapshot["costosMaterialesMoneda"];
}) {
  const { moneda } = useConfigRegional();
  const visibles = materiales.filter((material) => material.costoTotal > 0);
  if (visibles.length === 0) {
    return (
      <div className={cn(itemCostStyles["cost-empty-line"])}>
        Este paso no consumió materiales ni consumibles con costo.
      </div>
    );
  }

  return (
    <div className={cn(itemCostStyles["cost-detail-table-wrap"])}>
      <table className={cn(itemCostStyles["cost-detail-table"])}>
        <thead>
          <tr>
            <th>Material</th>
            <th>Tipo</th>
            <th className="num">Cantidad</th>
            <th className="num">Tipo de cambio USD</th>
            <th className="num">Costo unit.</th>
            <th className="num">Costo</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((material, index) => {
            const key = `${material.slotCodigo}-${material.materialVarianteId}-${index}`;
            const conversion = costosMoneda?.find(
              (costo) =>
                costo.varianteId === material.materialVarianteId &&
                costo.monedaOrigen === "USD",
            );
            return (
              <tr key={key}>
                <td>
                  <strong>{getMaterialCosteoLabel(material)}</strong>
                </td>
                <td>
                  <span className={cn(itemCostStyles["cost-chip"])}>
                    {formatModoSeleccion(material.modoSeleccion)}
                  </span>
                </td>
                <td className="num">
                  {formatCantidadCosto(material.cantidad, material.unidad)}
                </td>
                <td className="num">
                  {conversion
                    ? `${conversion.monedaDestino} ${conversion.factorCambio.toLocaleString(moneda.locale, { maximumFractionDigits: 8 })}`
                    : "—"}
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
    </div>
  );
}

/** El acomodo del pliego en su hoja de compra pertenece a Aprovechamiento. */
function PliegosCompraItem({ paso }: { paso: PasoCosteo }) {
  const [abierto, setAbierto] = React.useState<number | null>(null);
  const pliego = pliegoDePaso(paso.nestingResult);
  const materiales = (paso.materiales ?? []).flatMap((material, index) => {
    const layout = acomodadoDeLinea(material, pliego);
    const hoja = hojaDeCompraDeMaterial(material);
    return layout && hoja ? [{ material, layout, hoja, index }] : [];
  });
  const seleccion = materiales.find((linea) => linea.index === abierto);
  if (!materiales.length || !pliego) return null;
  return (
    <div className={itemStyles.actions}>
      {materiales.map(({ material, index }) => (
        <Button
          key={index}
          variant="outline"
          size="sm"
          onClick={() => setAbierto(index)}
        >
          <ExpandIcon data-icon="inline-start" />
          Hoja de compra · {getMaterialCosteoLabel(material)}
        </Button>
      ))}
      {seleccion ? (
        <NestingCompraPliegoModal
          hoja={seleccion.hoja}
          pliego={pliego}
          layout={seleccion.layout}
          onClose={() => setAbierto(null)}
        />
      ) : null}
    </div>
  );
}

type ItemMermaPasoVista = {
  key: string;
  titulo: string;
  detalle: string;
  cantidad: number;
  unidad: string;
  porcentaje: number;
  costo: number;
};

function tituloMermaOperativa(material: MaterialCosteo) {
  if (material.tipoLineaCosto === "CONSUMIBLE_MAQUINA") {
    return "Consumo adicional de tinta o tóner";
  }
  if (material.tipoLineaCosto === "DESGASTE_MAQUINA") {
    return "Desgaste adicional de máquina";
  }
  return "Merma operativa de sustrato";
}

function itemsMermaDelPaso(
  paso: PasoCosteo,
  cotizacion: CotizacionPropuestaSnapshot,
): ItemMermaPasoVista[] {
  const items: ItemMermaPasoVista[] = [];

  (paso.materiales ?? [])
    .filter((material) => material.costoTotal > 0)
    .forEach((material, materialIndex) => {
      const asignacion = material.asignacionNestingCompuesto;
      const loteCompartido = asignacion
        ? cotizacion.analisisNestingCompuesto?.grupos.find(
            (grupo) => grupo.lote?.id === asignacion.loteId,
          )?.lote
        : null;
      const participante = loteCompartido?.participantes.find(
        (item) =>
          item.pasoClave === paso.configPasoId ||
          item.rutaPasoId === paso.rutaPasoId,
      );
      const detalles = calcularItemsMermaMaterial({
        material,
        costeoNesting:
          loteCompartido?.nestingResult.costingPreview ??
          paso.nestingResult?.costingPreview,
        porcentajeAsignacion:
          participante?.porcentajeAsignacion ??
          asignacion?.porcentajeAsignacion ??
          100,
        consolidado: Boolean(loteCompartido),
      });

      detalles.forEach((detalle, detalleIndex) => {
        const nombreMaterial = getMaterialCosteoLabel(material);
        const esGeometrica = detalle.origen === "NESTING_GEOMETRICA";
        items.push({
          key: `${material.slotCodigo}-${material.materialVarianteId}-${materialIndex}-${detalleIndex}`,
          titulo: esGeometrica
            ? "Desperdicio geométrico del nesting"
            : tituloMermaOperativa(material),
          detalle: esGeometrica
            ? `${nombreMaterial} · ${detalle.consolidado ? "lote consolidado" : "acomodo individual"}`
            : `${nombreMaterial} · ${formatDecimal(detalle.porcentaje, 2)}% sobre el consumo productivo`,
          cantidad: detalle.cantidadMerma,
          unidad: detalle.unidad,
          porcentaje: detalle.porcentaje,
          costo: detalle.costoMerma,
        });
      });
    });

  const tiempo = paso.tiempo;
  const runMermaMin = Math.max(0, Number(tiempo?.runMermaMin ?? 0));
  if (tiempo && runMermaMin > 0) {
    items.push({
      key: `tiempo-${paso.configPasoId ?? paso.rutaPasoId ?? paso.rutaPasoOrden}`,
      titulo: "Tiempo adicional de corrida",
      detalle: `${tiempo.centroCostoNombre ?? "Centro de costo del paso"} · ${formatDecimal(tiempo.mermaOperativaPct ?? 0, 2)}% sobre la corrida productiva`,
      cantidad: runMermaMin,
      unidad: "min",
      porcentaje: Math.max(0, Number(tiempo.mermaOperativaPct ?? 0)),
      costo: calcularCostoMermaTiempo(tiempo),
    });
  }

  return items.filter(
    (item) =>
      Number.isFinite(item.cantidad) &&
      item.cantidad > 0 &&
      Number.isFinite(item.costo) &&
      item.costo >= 0,
  );
}

function MermaPasoCollapsible({
  paso,
  cotizacion,
}: {
  paso: PasoCosteo;
  cotizacion: CotizacionPropuestaSnapshot;
}) {
  const { moneda } = useConfigRegional();
  const [open, setOpen] = React.useState(false);
  const items = itemsMermaDelPaso(paso, cotizacion);
  if (items.length === 0) return null;

  const costoTotal = items.reduce((total, item) => total + item.costo, 0);
  const cantidadConceptos = items.length;

  return (
    <div className={cn(itemCostStyles["cost-detail-block"])}>
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className={costC.collapsible}
      >
        <CollapsibleTrigger
          render={<button type="button" className={costC.trigger} />}
        >
          <ChevronRightIcon
            data-icon="inline-start"
            className={costC.chevron}
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          />
          <span className={costC.triggerCopy}>
            <strong>Merma</strong>
            <small>
              {cantidadConceptos}{" "}
              {cantidadConceptos === 1 ? "concepto" : "conceptos"}
            </small>
          </span>
          <strong className={costC.triggerTotal}>
            {formatCurrency(costoTotal, moneda)}
          </strong>
        </CollapsibleTrigger>
        <CollapsibleContent className={costC.content}>
          {items.map((item) => (
            <div className={costC.item} key={item.key}>
              <div className={costC.itemCopy}>
                <strong>{item.titulo}</strong>
                <small>{item.detalle}</small>
              </div>
              <div className={costC.itemQuantity}>
                <strong>
                  {formatCantidadCosto(item.cantidad, item.unidad)}
                </strong>
                <small>{formatDecimal(item.porcentaje, 1)}%</small>
              </div>
              <strong className={costC.itemCost}>
                {formatCurrency(item.costo, moneda)}
              </strong>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function CargosPasoList({ cargos }: { cargos: CargoPasoCosteo[] }) {
  const { moneda } = useConfigRegional();
  const visibles = cargos.filter((cargo) => cargo.monto > 0);
  if (visibles.length === 0) return null;

  return (
    <div className={cn(itemCostStyles["cost-charges"])}>
      {visibles.map((cargo) => (
        <div
          className={cn(itemCostStyles["cost-charge"])}
          key={`${cargo.cargoCodigo}-${cargo.cargoNombre}`}
        >
          <span>{cargo.cargoNombre}</span>
          <small>
            {humanizeCodigo(cargo.modoCalculo)} ·{" "}
            {cargo.aplicaMargen === false ? "sin margen" : "con margen"}
          </small>
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
    <div className={cn(itemCostStyles["cost-charges"])}>
      {visibles.map((bloque) => {
        const horas = bloque.minutos / 60;
        const personas =
          bloque.dotacionOperarios > 1
            ? ` × ${bloque.dotacionOperarios} pers`
            : "";
        return (
          <div className={cn(itemCostStyles["cost-charge"])} key={bloque.id}>
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

type ComponenteWorkflowVista = ComponenteWorkflowCotizacion<PasoCosteo> & {
  politicaEjecucion?: "INLINE" | "INDEPENDIENTE";
  jobContext?: {
    disenosVectoriales?: unknown[];
    piezas?: Array<{ cantidadPorUnidad?: number }>;
  };
};

function WorkflowCotizacion({
  cotizacion,
}: {
  cotizacion: CotizacionPropuestaSnapshot;
}) {
  const workflow = React.useMemo(
    () =>
      construirWorkflowCotizacion({
        pasos: cotizacion.pasos,
        componentes: (cotizacion.componentesFabricados ??
          []) as unknown as ComponenteWorkflowVista[],
        grafoProduccion: cotizacion.grafoProduccion,
      }),
    [
      cotizacion.componentesFabricados,
      cotizacion.grafoProduccion,
      cotizacion.pasos,
    ],
  );

  if (workflow.columnas.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Sin pasos de producción</EmptyTitle>
          <EmptyDescription>
            Esta cotización no tiene operaciones activas.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className={itemStyles.workflowViewport}>
      <div className={itemStyles.workflowCanvas}>
        <div className={itemStyles.workflowTerminal} aria-hidden="true">
          <span />
          <small>Inicio</small>
        </div>
        {workflow.columnas.map((columna, indiceColumna) => (
          <React.Fragment key={`momento-${indiceColumna}`}>
            {indiceColumna > 0 ? (
              <div className={itemStyles.workflowLink} aria-hidden="true">
                <span />
              </div>
            ) : null}
            <section className={itemStyles.workflowMoment}>
              <header>
                <span>Etapa {String(indiceColumna + 1).padStart(2, "0")}</span>
                {columna.length > 1 ? (
                  <small>{columna.length} en paralelo</small>
                ) : null}
              </header>
              <div className={itemStyles.workflowStack}>
                {columna.map((nodo) => {
                  if (nodo.tipo === "COMPONENTE") {
                    const componente = nodo.componente;
                    const pasosActivos =
                      componente.pasos?.filter((p) => p.activado).length ?? 0;
                    const esColeccion = Boolean(
                      componente.jobContext?.disenosVectoriales?.length ||
                        componente.jobContext?.piezas?.some(
                          (p) => p.cantidadPorUnidad != null,
                        ),
                    );
                    return (
                      <article
                        className={itemStyles.workflowNode}
                        key={nodo.clave}
                      >
                        <span className={itemStyles.workflowIcon}>
                          <PackageIcon />
                        </span>
                        <span className={itemStyles.workflowCopy}>
                          <small>Componente fabricado</small>
                          <strong>{componente.nombre}</strong>
                          <span>
                            {componente.cantidad ?? 1}{" "}
                            {esColeccion
                              ? "conjuntos"
                              : (componente.unidad ?? "u.")}
                            {pasosActivos
                              ? ` · ${pasosActivos} ${pasosActivos === 1 ? "paso" : "pasos"}`
                              : ""}
                          </span>
                        </span>
                      </article>
                    );
                  }

                  const paso = nodo.paso;
                  const esEtapa = nodo.tipo === "ETAPA";
                  return (
                    <article
                      className={itemStyles.workflowNode}
                      key={nodo.clave}
                    >
                      <span className={itemStyles.workflowIcon}>
                        {esEtapa ? <BlocksIcon /> : <GitCommitHorizontalIcon />}
                      </span>
                      <span className={itemStyles.workflowCopy}>
                        <small>
                          {esEtapa ? "Etapa consolidada" : "Operación"}
                        </small>
                        <strong>
                          {paso.nombreVisible?.trim() ||
                            humanizeCodigo(paso.familiaCodigo)}
                        </strong>
                        <span>
                          {paso.tiempo
                            ? `${formatTiempoPaso(paso)} · ${getCentroCostoLabel(paso)}`
                            : getCentroCostoLabel(paso)}
                        </span>
                      </span>
                    </article>
                  );
                })}
              </div>
            </section>
          </React.Fragment>
        ))}
        <div className={itemStyles.workflowLink} aria-hidden="true">
          <span />
        </div>
        <div className={itemStyles.workflowTerminal} aria-hidden="true">
          <span />
          <small>Fin</small>
        </div>
      </div>
    </div>
  );
}

type VistaFabricacionItem = "produccion" | "aprovechamiento";
type FabricacionItemProps = {
  item: PropuestaItem;
  calculoPendiente: boolean;
  vista: VistaFabricacionItem;
  onEditPanels?: (paso: PanelEditorPaso) => void;
  onExpand?: () => void;
  ampliada?: boolean;
  prepararCorte?: boolean;
  loteId?: string;
  onLoteChange?: (id: string) => void;
};

function FabricacionItemView(props: FabricacionItemProps) {
  const renderVista = (
    item: PropuestaItem,
    ampliada = props.ampliada,
    esLote = false,
  ) =>
    props.vista === "produccion" ? (
      <ProduccionItemSinLotesView
        {...props}
        item={item}
        onExpand={esLote ? undefined : props.onExpand}
      />
    ) : (
      <AprovechamientoItemSinLotesView
        {...props}
        item={item}
        ampliada={ampliada}
        onExpand={esLote ? undefined : props.onExpand}
        onEditPanels={esLote ? undefined : props.onEditPanels}
      />
    );
  const lotes = props.item.distribucionEntregas?.lotes;
  if (lotes?.length)
    return (
      <ProduccionEntregas
        item={props.item}
        lotes={lotes}
        vista={props.vista}
        loteId={props.loteId}
        onLoteChange={props.onLoteChange}
        render={(item, ampliada) => renderVista(item, ampliada, true)}
      />
    );
  return renderVista(props.item);
}

function ProduccionItemSinLotesView({
  item,
  calculoPendiente,
  onExpand,
}: FabricacionItemProps) {
  if (calculoPendiente)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Producción pendiente de cotización</EmptyTitle>
          <EmptyDescription>
            Cotizá el producto para ver sus operaciones y tiempos.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <div className={itemStyles.production}>
      {item.notaProduccion ? (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Nota para producción</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">
            {item.notaProduccion}
          </AlertDescription>
        </Alert>
      ) : null}
      <Card size="sm" className={itemStyles.technicalCard}>
        <CardHeader>
          <CardTitle className={itemStyles.sectionTitle}>
            <FactoryIcon aria-hidden="true" />
            Flujo de producción
          </CardTitle>
          {onExpand ? (
            <CardAction>
              <HeroButton variant="outline" size="sm" onPress={onExpand}>
                <ExpandIcon data-icon="inline-start" />
                Ampliar
              </HeroButton>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          <WorkflowCotizacion cotizacion={item.cotizacion} />
        </CardContent>
      </Card>
    </div>
  );
}

function AprovechamientoItemSinLotesView({
  item,
  calculoPendiente,
  onEditPanels,
  onExpand,
  ampliada = false,
  prepararCorte = false,
}: FabricacionItemProps) {
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
  const fuentesNesting = React.useMemo(
    () => recolectarNestingsCotizacion(item.cotizacion, item.jobContext),
    [item.cotizacion, item.jobContext],
  );
  const fuenteVectorial = React.useMemo(
    () => obtenerFuenteVectorial(item.jobContext),
    [item.jobContext],
  );
  const nestingTabs = fuentesNesting.map((fuente, index) => ({
    ...fuente,
    index: index + 1,
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
  const seleccionRecorrido = React.useMemo(
    () => ({
      rutaComponentes: activeNestingTab?.rutaComponentes,
      rutaPasoId: activeNestingTab?.paso.rutaPasoId,
    }),
    [activeNestingTab?.rutaComponentes, activeNestingTab?.paso.rutaPasoId],
  );

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

  if (calculoPendiente)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Aprovechamiento pendiente de cotización</EmptyTitle>
          <EmptyDescription>
            Cotizá el producto para ver la disposición de las piezas y el
            consumo de material.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  return (
    <div className={itemStyles.production}>
      {fuentesNesting.length > 0 || esBastidor ? (
        <section
          className={itemStyles.nesting}
          aria-label="Aprovechamiento del material"
        >
          <div className={itemStyles.sectionHeading}>
            <span className={itemStyles.sectionTitle}>
              <Grid2X2Icon aria-hidden="true" />
              Disposición de piezas
            </span>
            {onExpand ? (
              <HeroButton variant="outline" size="sm" onPress={onExpand}>
                <ExpandIcon data-icon="inline-start" />
                Ampliar
              </HeroButton>
            ) : null}
          </div>
          <div className={nestingStyles.itemNestings}>
            <Tabs
              value={activeNestingKey}
              onValueChange={(value) => setActiveNestingKey(String(value))}
            >
              {tabsDisposicion.length > 1 ? (
                <TabsList
                  className={itemStyles.scrollTabs}
                  aria-label="Proceso y componente"
                >
                  {tabsDisposicion.map((tab) => (
                    <TabsTrigger key={tab.key} value={tab.key}>
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              ) : null}
              <TabsContent
                value={activeNestingKey}
                aria-label={
                  bastidorActivo ? "Bastidor 3D" : activeNestingTab?.label
                }
              >
                {bastidorActivo ? (
                  <div className={itemStyles.nestingContent} key="bastidor3d">
                    {/* Estructura local primero (cotización en memoria); el fetch
                    por CotizacionItem/OT-item queda de fallback para ítems
                    rehidratados sin cotización en mano. */}
                    <BastidorVisor
                      itemId={item.cotizacionItemId ?? item.id}
                      estructuraLocal={estructuraBastidorLocal}
                    />
                  </div>
                ) : activeNestingTab ? (
                  <div
                    className={itemStyles.nestingContent}
                    key={activeNestingTab.key}
                  >
                    {onEditPanels &&
                    activeNestingTab.editable &&
                    isPanelEditableStep(activeNestingTab.paso) ? (
                      <div className="mb-3 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEditPanels(activeNestingTab.paso)}
                        >
                          <Edit3Icon data-icon="inline-start" />
                          Editar paneles
                        </Button>
                      </div>
                    ) : null}
                    <PliegosCompraItem
                      key={activeNestingTab.key}
                      paso={activeNestingTab.paso}
                    />
                    <NestingViewer
                      archivos={
                        esFamiliaCorteNesting(
                          activeNestingTab.paso.familiaCodigo,
                        ) &&
                        activeNestingTab.paso.nestingResult?.algorithm ===
                          "irregular-2d-bottom-left-v1" ? (
                          <div className="flex flex-col gap-3">
                            {fuenteVectorial ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  descargarTexto(
                                    fuenteVectorial.svg,
                                    fuenteVectorial.nombreArchivo,
                                  )
                                }
                              >
                                <DownloadIcon />
                                SVG original
                              </Button>
                            ) : null}
                            <NestingPatronesDescargas
                              result={activeNestingTab.paso.nestingResult}
                              nombreBase={nombreBaseSvg(item.productoNombre)}
                              permitirDxf
                            />
                          </div>
                        ) : undefined
                      }
                      result={activeNestingTab.paso.nestingResult!}
                      copias={getCopiasItem(item)}
                      costingDetails={activeNestingTab.paso.materiales ?? []}
                      maxPx={
                        ampliada
                          ? 900
                          : activeNestingTab.paso.nestingResult?.substrates[0]
                                ?.kind === "sheet"
                            ? 420
                            : 560
                      }
                      modificaciones={modificacionesOverlay}
                    />
                    {prepararCorte &&
                    activeNestingTab.paso.familiaCodigo ===
                      "corte_hilo_caliente" ? (
                      <>
                        <RecorridoCortePanel
                          key={`corte-${activeNestingTab.key}`}
                          itemId={item.id}
                          seleccion={seleccionRecorrido}
                        />
                        <PlantillaInstalacionPanel
                          key={`instalacion-${activeNestingTab.key}`}
                          itemId={item.id}
                          seleccion={seleccionRecorrido}
                        />
                      </>
                    ) : null}
                  </div>
                ) : null}
              </TabsContent>
            </Tabs>
          </div>
        </section>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Sin aprovechamiento calculado</EmptyTitle>
            <EmptyDescription>
              Este ítem no tiene una disposición de piezas para mostrar.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
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
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No se pudo reconstruir el panelizado</EmptyTitle>
            <EmptyDescription>
              El ítem no tiene piezas suficientes para armar un layout manual.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </PanelEditorShell>
    );
  }

  return (
    <PanelEditorShell title="Editar paneles" onClose={onClose}>
      <div className={itemStyles["panel-editor-grid"]}>
        {editableSourceIds.length > 1 ? (
          <div className={itemStyles["panel-editor-list"]}>
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

        <div className={itemStyles["panel-editor-stage"]}>
          <div className={itemStyles["panel-editor-meta"]}>
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

          <div className={itemStyles["panel-bar"]} ref={barRef}>
            {selected?.panels.map((panel, index) => {
              const size =
                selected.axis === "vertical"
                  ? panel.usefulWidthMm
                  : panel.usefulHeightMm;
              const pct = totalAxis > 0 ? (size / totalAxis) * 100 : 0;
              return (
                <div
                  className={itemStyles["panel-segment"]}
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
                      className={itemStyles["panel-handle"]}
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

          <div className={itemStyles["panel-editor-table"]}>
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
            <div className={itemStyles["panel-editor-error"]}>
              {invalidMessage}
            </div>
          ) : null}
        </div>
      </div>

      <div className={itemStyles["panel-editor-actions"]}>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={saving}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onRestoreAutomatic}
          disabled={saving}
        >
          Restaurar automático
        </Button>
        <Button
          type="button"
          onClick={() => onSave(layout)}
          disabled={saving || Boolean(invalidMessage)}
        >
          {saving ? "Recotizando..." : "Guardar y recotizar"}
        </Button>
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
  const { className: legacyTheme, ...legacyScope } = useLegacyDesignScope();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        {...legacyScope}
        className={cn(legacyTheme ?? workspaceTheme.theme, itemStyles.panelEditorDialog)}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Ajustá las divisiones sin superar el ancho imprimible de la máquina.
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
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
    <div className={cn(itemCostStyles["cost-detail-block"])}>
      <div className={cn(itemCostStyles["cost-detail-title"])}>
        Medida modificada
      </div>
      <div className={cn(itemCostStyles["cost-detail-lines"])}>
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

function pasoTieneDetalleCosteo(paso: PasoCosteo) {
  return (
    paso.activado &&
    (Boolean(paso.tiempo) ||
      Boolean(paso.mutacionAplicada) ||
      Boolean(paso.tiempo?.procesamientoCorte) ||
      (paso.materiales?.length ?? 0) > 0 ||
      (paso.tiempo?.tiemposExtra?.length ?? 0) > 0 ||
      (paso.cargosDirectosPaso?.length ?? 0) > 0)
  );
}

function operacionTieneDetalleDesplegable(paso: PasoCosteo) {
  return (
    paso.activado &&
    (Boolean(paso.mutacionAplicada) ||
      Boolean(paso.tiempo?.procesamientoCorte) ||
      (paso.materiales?.length ?? 0) > 0 ||
      (paso.tiempo?.tiemposExtra?.length ?? 0) > 0 ||
      Number(paso.tiempo?.runMermaMin ?? 0) > 0 ||
      (paso.cargosDirectosPaso?.length ?? 0) > 0)
  );
}

function OperacionesEtapaTable({
  etapa,
  cotizacion,
}: {
  etapa: PasoCosteo;
  cotizacion: CotizacionPropuestaSnapshot;
}) {
  const { moneda } = useConfigRegional();
  const operaciones = etapa.operacionesInternas ?? [];
  const [abiertas, setAbiertas] = React.useState<Set<string>>(() => new Set());

  const alternar = (key: string) => {
    setAbiertas((actuales) => {
      const siguientes = new Set(actuales);
      if (siguientes.has(key)) siguientes.delete(key);
      else siguientes.add(key);
      return siguientes;
    });
  };

  return (
    <div className={cn(itemCostStyles["cost-detail-block"])}>
      <div className={cn(itemCostStyles["cost-detail-title"])}>
        Desglose por operación
      </div>
      <div
        className={`${itemCostStyles["cost-detail-table-wrap"]} ${costC.stageTableWrap}`}
      >
        <Table
          className={`${itemCostStyles["cost-detail-table"]} ${costC.stageTable}`}
        >
          <TableHeader>
            <TableRow>
              <TableHead>Operación</TableHead>
              <TableHead>Centro de costo</TableHead>
              <TableHead className="num">Tiempo</TableHead>
              <TableHead className="num">Materiales</TableHead>
              <TableHead className="num">Cargos</TableHead>
              <TableHead className="num">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operaciones.map((operacion, index) => {
              const key = `${operacion.codigo}-${index}`;
              const pasoOperacion = proyectarPasoOperacionInterna(
                etapa,
                operacion,
                index,
              );
              const materialesTotal = sumMaterialesPaso(pasoOperacion);
              const cargosTotal = sumCargosYTiempoExtraPaso(pasoOperacion);
              const puedeExpandir =
                operacionTieneDetalleDesplegable(pasoOperacion);
              const abierta = abiertas.has(key);
              const centroCosto =
                operacion.tiempo?.centroCostoNombre ??
                operacion.centroCostoNombre ??
                (operacion.activada ? "Sin centro asignado" : "No aplica");
              const tiempoMin =
                operacion.tiempo?.totalMin ?? operacion.duracionMin;

              return (
                <React.Fragment key={key}>
                  <TableRow
                    className={`${costC.stageRow} ${
                      operacion.activada ? "" : costC.inactiveRow
                    }`}
                  >
                    <TableCell className={costC.operationCell}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={costC.operationTrigger}
                        disabled={!puedeExpandir}
                        aria-expanded={puedeExpandir ? abierta : undefined}
                        onClick={() => puedeExpandir && alternar(key)}
                      >
                        <ChevronRightIcon
                          data-icon="inline-start"
                          data-open={abierta ? "true" : "false"}
                          aria-hidden="true"
                          className={`${costC.operationChevron} ${
                            puedeExpandir ? "" : costC.hiddenChevron
                          }`}
                        />
                        <span className={costC.operationIndex}>
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <strong>{operacion.nombre}</strong>
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className={cn(itemCostStyles["cost-step-center"])}>
                        <strong>{centroCosto}</strong>
                        <span>
                          {operacion.tiempo
                            ? formatTarifaCentroCosto(pasoOperacion, moneda)
                            : "Sin detalle tarifario"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="num">
                      {tiempoMin > 0 ? (
                        <>
                          <strong>
                            {operacion.tiempo
                              ? formatCurrency(
                                  getCostoTiempoPaso(pasoOperacion),
                                  moneda,
                                )
                              : "—"}
                          </strong>
                          <span>{formatMinutos(tiempoMin)}</span>
                        </>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="num">
                      {materialesTotal > 0
                        ? formatCurrency(materialesTotal, moneda)
                        : "-"}
                    </TableCell>
                    <TableCell className="num">
                      {cargosTotal > 0
                        ? formatCurrency(cargosTotal, moneda)
                        : "-"}
                    </TableCell>
                    <TableCell className="num strong">
                      {operacion.costoTotal > 0
                        ? formatCurrency(operacion.costoTotal, moneda)
                        : "-"}
                    </TableCell>
                  </TableRow>
                  {puedeExpandir && abierta ? (
                    <TableRow className={costC.operationDetailRow}>
                      <TableCell colSpan={6} className={costC.detailCell}>
                        <div>
                          <PasoCostDetail
                            paso={pasoOperacion}
                            cotizacion={cotizacion}
                            contexto="operación"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PasoCostDetail({
  paso,
  cotizacion,
  contexto = "paso",
}: {
  paso: PasoCosteo;
  cotizacion: CotizacionPropuestaSnapshot;
  contexto?: "paso" | "operación";
}) {
  if ((paso.operacionesInternas?.length ?? 0) > 0) {
    return (
      <div className={cn(itemCostStyles["cost-step-expanded"])}>
        <OperacionesEtapaTable etapa={paso} cotizacion={cotizacion} />
      </div>
    );
  }

  const materiales = paso.materiales ?? [];
  const cargos = paso.cargosDirectosPaso ?? [];
  const cargosTotal = sumCargosPaso(paso);
  const tiemposExtra = paso.tiempo?.tiemposExtra ?? [];

  return (
    <div className={cn(itemCostStyles["cost-step-expanded"])}>
      {paso.mutacionAplicada ? (
        <MutacionPasoDetail mutacion={paso.mutacionAplicada} />
      ) : null}

      <div className={cn(itemCostStyles["cost-detail-block"])}>
        <div className={cn(itemCostStyles["cost-detail-title"])}>
          {contexto === "paso"
            ? "Materiales del paso"
            : "Materiales de la operación"}
        </div>
        <MaterialesPasoTable
          materiales={materiales}
          costosMoneda={cotizacion.costosMaterialesMoneda}
        />
      </div>

      <DesgloseOperacionesCorte valor={paso.tiempo?.procesamientoCorte} />
      <MermaPasoCollapsible paso={paso} cotizacion={cotizacion} />

      {tiemposExtra.length > 0 ? (
        <div className={cn(itemCostStyles["cost-detail-block"])}>
          <div className={cn(itemCostStyles["cost-detail-title"])}>
            Tiempo extra del paso (no depende de la cantidad)
          </div>
          <TiemposExtraPasoList bloques={tiemposExtra} />
        </div>
      ) : null}

      {cargosTotal > 0 ? (
        <div className={cn(itemCostStyles["cost-detail-block"])}>
          <div className={cn(itemCostStyles["cost-detail-title"])}>
            Cargos directos del paso
          </div>
          <CargosPasoList cargos={cargos} />
        </div>
      ) : null}
    </div>
  );
}

type ComponenteCostoVista = {
  codigo: string;
  nombre: string;
  cantidad?: number;
  unidad?: string;
  costoTotal: number;
  nodoIncorporacionClave?: string | null;
  nodosPredecesoresClaves?: string[];
  grafoProduccion?: ComponenteWorkflowVista["grafoProduccion"];
  pasos?: unknown[];
  componentes?: ComponenteCostoVista[];
};

type FilaCostoArbol =
  | {
      tipo: "componente";
      key: string;
      componente: ComponenteCostoVista;
      nivel: number;
    }
  | {
      tipo: "paso";
      key: string;
      paso: PasoCosteo;
      nivel: number;
      indice: number;
    };

function construirFilasCostoArbol(
  cotizacion: CotizacionPropuestaSnapshot,
): FilaCostoArbol[] {
  const filas: FilaCostoArbol[] = [];

  const recorrerWorkflow = ({
    pasos,
    componentes,
    grafoProduccion,
    nivel,
    prefijo,
  }: {
    pasos: PasoCosteo[];
    componentes: ComponenteCostoVista[];
    grafoProduccion?: ComponenteWorkflowVista["grafoProduccion"];
    nivel: number;
    prefijo: string;
  }) => {
    const workflow = construirWorkflowCotizacion({
      pasos,
      componentes: componentes as unknown as ComponenteWorkflowVista[],
      grafoProduccion,
    });
    let indicePaso = 0;

    for (const columna of workflow.columnas) {
      for (const nodo of columna) {
        if (nodo.tipo === "COMPONENTE") {
          const componente = nodo.componente as unknown as ComponenteCostoVista;
          const clave = `${prefijo}-componente-${componente.codigo}-${filas.length}`;
          filas.push({
            tipo: "componente",
            key: clave,
            componente,
            nivel,
          });
          recorrerWorkflow({
            pasos: (componente.pasos ?? []) as PasoCosteo[],
            componentes: componente.componentes ?? [],
            grafoProduccion: componente.grafoProduccion,
            nivel: nivel + 1,
            prefijo: clave,
          });
          continue;
        }

        const paso = nodo.paso;
        if (getVisibleCostSteps([paso]).length === 0) continue;
        indicePaso += 1;
        filas.push({
          tipo: "paso",
          key: `${prefijo}-paso-${paso.rutaPasoId ?? `${paso.rutaPasoOrden}-${paso.familiaCodigo}`}`,
          paso,
          nivel,
          indice: indicePaso,
        });
      }
    }
  };

  recorrerWorkflow({
    pasos: cotizacion.pasos,
    componentes: (cotizacion.componentesFabricados ??
      []) as unknown as ComponenteCostoVista[],
    grafoProduccion: cotizacion.grafoProduccion,
    nivel: 0,
    prefijo: "raiz",
  });
  return filas;
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
  const filasCosteo = React.useMemo(
    () => construirFilasCostoArbol(item.cotizacion),
    [item.cotizacion],
  );
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
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Costo pendiente de cotización</EmptyTitle>
          <EmptyDescription>
            Cotizá el producto para ver el desglose de sus costos.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const pctDelNeto = (monto: number) =>
    precioNeto > 0
      ? `${((monto / precioNeto) * 100).toLocaleString("es-AR", {
          maximumFractionDigits: 1,
        })}%`
      : "—";

  return (
    <div className={cn(itemCostStyles["op-costs"])}>
      <div className={itemStyles.costOverview}>
        <div className={cn(itemCostStyles["cost-waterfall"])}>
          <h3 className={itemCostStyles.waterfallHeading}>
            <CircleDollarSignIcon aria-hidden="true" />
            Composición del precio
          </h3>
          {filasNeto.map((fila) => (
            <div className={cn(itemCostStyles["cw-row"])} key={fila.key}>
              <span className={cn(itemCostStyles["cw-label"])}>
                {fila.label}
                {fila.hint ? <small>{fila.hint}</small> : null}
              </span>
              <span className={cn(itemCostStyles["cw-tipo"])}>{fila.tipo}</span>
              <span className={cn(itemCostStyles["cw-pct"])}>
                {pctDelNeto(fila.monto)}
              </span>
              <span
                className={`${itemCostStyles["cw-amount"]} ${fila.warn ? cn(itemCostStyles["cw-margen"], "warn") : ""}`}
              >
                {fmt(fila.monto)}
              </span>
            </div>
          ))}
          <div
            className={cn(
              itemCostStyles["cw-row"],
              itemCostStyles["cw-subtotal"],
            )}
          >
            <span className={cn(itemCostStyles["cw-label"])}>
              Precio neto (sin IVA)
            </span>
            <span className={cn(itemCostStyles["cw-tipo"])} />
            <span className={cn(itemCostStyles["cw-pct"])}>100%</span>
            <span className={cn(itemCostStyles["cw-amount"])}>
              {fmt(precioNeto)}
            </span>
          </div>
          {ivaTotal > 0 && !sinComprobante ? (
            <div className={cn(itemCostStyles["cw-row"])}>
              <span className={cn(itemCostStyles["cw-label"])}>
                {impuestosPorFueraNombres || "IVA"}
                <small>se agrega al neto y se discrimina en factura</small>
              </span>
              <span className={cn(itemCostStyles["cw-tipo"])}>Impuesto</span>
              <span className={cn(itemCostStyles["cw-pct"])}>
                + {pctDelNeto(ivaTotal)}
              </span>
              <span className={cn(itemCostStyles["cw-amount"])}>
                + {fmt(ivaTotal)}
              </span>
            </div>
          ) : null}
          <div
            className={cn(itemCostStyles["cw-row"], itemCostStyles["cw-total"])}
          >
            <span className={cn(itemCostStyles["cw-label"])}>
              Precio de venta
              {sinComprobante ? <small>sin comprobante fiscal</small> : null}
            </span>
            <span className={cn(itemCostStyles["cw-tipo"])} />
            <span className={cn(itemCostStyles["cw-pct"])} />
            <span className={cn(itemCostStyles["cw-amount"])}>
              {fmt(sinComprobante ? precioNeto : precioBruto)}
            </span>
          </div>
        </div>

        <Card size="sm" className={itemStyles.contribution}>
          <CardHeader>
            <CardTitle className={itemStyles.contributionTitle}>
              Margen de contribución
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={itemStyles.contributionValue}>
              {fmt(margenContribucionMonto)}
            </div>
            <p className={itemStyles.contributionHint}>
              {margenContribucionPct.toLocaleString("es-AR", {
                maximumFractionDigits: 1,
              })}
              % del neto
            </p>
            <details className={itemStyles.explanation}>
              <summary>Cómo se calcula</summary>
              <p>
                Precio neto menos costos variables: materia prima, proveedor,
                cargos, impuestos internos y comisiones. Es lo que queda para
                cubrir la estructura fija y dejar ganancia. Este indicador no se
                suma al precio.
              </p>
            </details>
          </CardContent>
        </Card>
      </div>

      <div className={cn(itemCostStyles["cost-section"])}>
        <div className={cn(itemCostStyles["cost-title"])}>
          Desglose por paso
        </div>
        <div className={cn(itemCostStyles["cost-steps-table-wrap"])}>
          <table className={cn(itemCostStyles["cost-steps-table"])}>
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
              {filasCosteo.map((fila) => {
                if (fila.tipo === "componente") {
                  const { componente, nivel } = fila;
                  return (
                    <tr
                      className={cn(itemCostStyles["cost-component-row"])}
                      key={fila.key}
                    >
                      <td colSpan={5}>
                        <div
                          className={cn(itemCostStyles["cost-component-name"])}
                          style={{
                            paddingLeft: `${Math.max(0, nivel - 1) * 18}px`,
                          }}
                        >
                          <PackageIcon aria-hidden="true" />
                          <span>
                            <strong>{componente.nombre}</strong>
                            <small>
                              Componente fabricado
                              {componente.cantidad != null
                                ? ` · ${formatDecimal(componente.cantidad, 2)} ${componente.unidad ?? "u."}`
                                : ""}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td className="num strong">
                        {componente.costoTotal > 0
                          ? fmt(componente.costoTotal)
                          : "-"}
                      </td>
                    </tr>
                  );
                }

                const { paso, nivel, indice: visibleIndex } = fila;
                const stepKey = fila.key;
                const materialesTotal = sumMaterialesPaso(paso);
                // La columna Cargos junta los cargos monetarios y el costo de
                // los bloques de tiempo extra: así se distingue del tiempo de
                // TRABAJO del paso, que es la columna Tiempo.
                const cargosTotal = sumCargosYTiempoExtraPaso(paso);
                const puedeExpandir = pasoTieneDetalleCosteo(paso);
                const expanded = expandedCostSteps.has(stepKey);
                return (
                  <React.Fragment key={fila.key}>
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
                      <td style={{ paddingLeft: `${12 + nivel * 22}px` }}>
                        <div className={cn(itemCostStyles["cost-step-name"])}>
                          <span
                            className={cn(itemCostStyles["cost-step-title"])}
                          >
                            {puedeExpandir ? (
                              <ChevronRightIcon
                                className={cn(
                                  itemCostStyles["cost-row-chevron"],
                                )}
                                aria-hidden="true"
                              />
                            ) : null}
                            <span>
                              {visibleIndex}.{" "}
                              {paso.nombreVisible?.trim() ||
                                humanizeCodigo(paso.familiaCodigo)}
                            </span>
                          </span>
                          {paso.tiempo?.origenTiempo === "manual_comercial" ? (
                            <span
                              className={cn(itemCostStyles["cost-chip"])}
                              title="El tiempo de este paso lo estimó el comercial al cotizar; no sale del cálculo del motor."
                            >
                              <ClockIcon aria-hidden="true" />
                              Tiempo estimado
                            </span>
                          ) : null}
                          {paso.activadoPorDependencia ? (
                            <span
                              className={cn(itemCostStyles["cost-chip"])}
                              title={`Se activó automáticamente porque "${paso.activadoPorDependencia.requeridoPorNombre}" lo necesita. No se puede quitar mientras ese paso esté activo.`}
                            >
                              <LinkIcon aria-hidden="true" />
                              Exigido por{" "}
                              {paso.activadoPorDependencia.requeridoPorNombre}
                            </span>
                          ) : null}
                          {paso.mutacionAplicada ? (
                            <span
                              className={cn(itemCostStyles["cost-chip"])}
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
                        <div className={cn(itemCostStyles["cost-step-center"])}>
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
                        {materialesTotal > 0 ? fmt(materialesTotal) : "-"}
                      </td>
                      <td className="num">
                        {cargosTotal > 0 ? fmt(cargosTotal) : "-"}
                      </td>
                      <td className="num strong">
                        {paso.costoTotal > 0 ? fmt(paso.costoTotal) : "-"}
                      </td>
                    </tr>
                    {puedeExpandir && expanded ? (
                      <tr
                        className={cn(itemCostStyles["cost-step-detail-row"])}
                      >
                        <td colSpan={6}>
                          <PasoCostDetail
                            paso={paso}
                            cotizacion={item.cotizacion}
                          />
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
    </div>
  );
}

/**
 * Specs visibles del item (las mismas filas que muestra la ficha). También
 * son la proyección `specs` que persiste el item de la OT al emitir — la OT
 * muestra exactamente lo que el comercial vio al armarla.
 */
export function buildOrdenItemSpecs(
  item: PropuestaItem,
): Array<{ lbl: string; val: string }> {
  const mainMaterial = getMainCommercialMaterial(item);
  const montajeSustrato = getMontajeSustratoMaterial(item);
  const materialEnComponentes =
    !mainMaterial &&
    componentesTienenMaterialEfectivo(item.cotizacion.componentesFabricados);

  const specsBase = item.atributosSchema
    .filter(
      (attr) =>
        attr.visible &&
        !["tipo_pieza", "tipoPieza", "tipo_de_pieza"].includes(attr.key),
    )
    .filter((attr) => !isDuplicateModoColorSpec(item, attr.key))
    .filter(
      (attr) =>
        !(materialEnComponentes && isMaterialSpecKey(attr.key, attr.label)),
    )
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
          : (item.especificaciones[attr.key] ?? "A definir"),
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
    if (paso.tecnologiaTercerizado)
      tecnologiaTercerizado = paso.tecnologiaTercerizado;
    for (const fila of paso.tercerizadoEtiquetas ?? []) {
      if (
        arr.some((spec) => spec.lbl.toLowerCase() === fila.eje.toLowerCase())
      ) {
        continue;
      }
      arr.push({ lbl: fila.eje, val: fila.valor });
    }
  }
  // Tecnología asignada al tercerizado: pisa la genérica del producto ("Impresión")
  // con el proceso real (ej. Offset), que es lo que clasifican los reportes.
  if (tecnologiaTercerizado) {
    const label =
      TECNOLOGIA_TERCERIZADO_LABEL[tecnologiaTercerizado] ??
      tecnologiaTercerizado;
    const idx = arr.findIndex(
      (spec) => spec.lbl.toLowerCase() === "tecnología",
    );
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

export function OrdenProductoDetalle({
  item,
  expanded,
  etaSistema,
  ahoraEta,
  margenEtaDias = 0,
  noLaborables,
  onEdit,
  onDescuento,
  onEditPanels,
  onChangeFechaEntrega,
  fechaEstimada,
  readOnly = false,
  editarFecha = false,
  prepararCorte = false,
  planificarEntregas = false,
  entregasPrevias,
  onDistribucionGuardada,
  sinComprobante = false,
}: {
  item: PropuestaItem;
  expanded: boolean;
  /** ETA simulada del item contra las colas del taller (fase 3); null = sin dato. */
  etaSistema?: SimulacionItem | null;
  ahoraEta?: Date;
  /** Margen del taller en días hábiles (D13) para el nivel "sin margen". */
  margenEtaDias?: number;
  noLaborables?: Set<string>;
  /** Ausentes en modo lectura (OT emitida): la fila no se puede mutar. */
  onEdit?: () => void;
  /** Abre el modal de descuento con esta línea como objetivo. */
  onDescuento?: () => void;
  /** Sólo para ítems de centro de copiado: abre el resumen de precios por hoja. */
  onEditPanels?: (item: PropuestaItem, paso: PanelEditorPaso) => void;
  onChangeFechaEntrega?: (fechaEntrega: string) => void;
  fechaEstimada: string;
  readOnly?: boolean;
  editarFecha?: boolean;
  /** El ítem ya existe en la OT y puede consultarse para preparar TAP/plantillas. */
  prepararCorte?: boolean;
  planificarEntregas?: boolean;
  entregasPrevias?: EntregasPreviasProps;
  onDistribucionGuardada?: () => void;
  /** Orden sin comprobante fiscal: la fila oculta Imp. y muestra Total neto. */
  sinComprobante?: boolean;
}) {
  const conPlanificacion = useCapacidad("planificacion_avanzada");
  const conEta = useCapacidad("eta_capacidad");
  const { className: legacyTheme, ...legacyScope } = useLegacyDesignScope();
  const { zonaHoraria } = useConfigRegional();
  const [innerTab, setInnerTab] = React.useState<InnerTab>("specs");
  const [loteId, setLoteId] = React.useState<string>();
  const [vistaAmpliada, setVistaAmpliada] =
    React.useState<VistaFabricacionItem | null>(null);
  const [briefAbierto, setBriefAbierto] = React.useState(false);
  const fechaInputRef = React.useRef<HTMLInputElement | null>(null);
  const costo = calcularCostoTotal(item);
  const calculoPendiente = item.precioUnitario === 0 && item.total === 0;
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
  const briefDiseno = React.useMemo(
    () => leerBriefDiseno(item.jobContext?.briefDiseno),
    [item.jobContext],
  );
  const componentesFabricados = item.cotizacion.componentesFabricados ?? [];
  const tieneComponentesFabricados = componentesFabricados.length > 0;
  const tieneEspecificacionesRaiz =
    specs.length > 0 || briefDisenoTieneContenido(briefDiseno);
  const carasBrief = getCarasItem(item) === 2 ? 2 : 1;

  return (
    <div>
      {expanded ? (
        <HeroTabs
          {...legacyScope}
          className={cn(legacyTheme ?? workspaceTheme.theme, itemStyles.detail)}
          selectedKey={innerTab}
          onSelectionChange={(value) => setInnerTab(value as InnerTab)}
        >
          <div className={itemStyles.toolbar}>
            <NavigationTabList
              variant="inset"
              className={itemStyles.detailNavigation}
              label={`Detalle de ${item.productoNombre}`}
              items={[
                { id: "specs", label: "Especificaciones", icon: <SlidersHorizontalIcon /> },
                { id: "costos", label: "Costos", icon: <CircleDollarSignIcon /> },
                { id: "produccion", label: "Flujo de producción", icon: <FactoryIcon /> },
                { id: "aprovechamiento", label: "Aprovechamiento", icon: <Grid2X2Icon /> },
              ]}
            />
            <div className={itemStyles.actions}>
              {onEdit ? (
                <HeroButton variant="outline" size="sm" onPress={onEdit}>
                  <Edit3Icon data-icon="inline-start" />
                  Editar especificaciones
                </HeroButton>
              ) : null}
              {onDescuento ? (
                <HeroButton variant="ghost" size="sm" onPress={onDescuento}>
                  <BadgePercentIcon data-icon="inline-start" />
                  {item.descuentoInput ? "Editar descuento" : "Descuento"}
                </HeroButton>
              ) : null}
            </div>
          </div>

          <HeroTabs.Panel id="specs" className={itemStyles.panel}>
            {tieneEspecificacionesRaiz
              ? (() => {
                  // Cortas: grilla compacta que se estira al ancho (auto-fit).
                  // Largas (caras/modo de color por paso): filas plenas debajo,
                  // FUERA de la grilla — un span 1/-1 dentro impediría que
                  // auto-fit colapse las columnas vacías de la fila de arriba.
                  const esLarga = (spec: (typeof specs)[number]) =>
                    spec.val.length > 40;
                  const cortas = specs.filter((spec) => !esLarga(spec));
                  const largas = specs.filter(esLarga);
                  const renderSpec = (
                    spec: (typeof specs)[number],
                    idx: number,
                  ) => {
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
                    const isEstampasSpec =
                      spec.lbl.toLowerCase() === "estampas";
                    const SpecIcon = isMedidasSpec
                      ? RulerIcon
                      : isModoColorSpec ? PaletteIcon
                      : /material|montaje/i.test(spec.lbl) ? Layers3Icon
                      : /tecnolog|impresi/i.test(spec.lbl) ? PrinterIcon
                      : isCarasSpec || isEstampasSpec ? Grid2X2Icon
                      : SlidersHorizontalIcon;
                    return (
                      <div
                        className={cn(
                          itemStyles.spec,
                          esLarga(spec) && itemStyles.specWide,
                        )}
                        key={`${spec.lbl}-${idx}`}
                      >
                        <div className={itemStyles.specHeading}>
                          <SpecIcon aria-hidden="true" />
                          <div className={itemStyles.specLabel}>{spec.lbl}</div>
                        </div>
                        <div
                          className={cn(
                            itemStyles.specValue,
                            (isMedidasSpec || isEstampasSpec) &&
                              itemStyles.multiline,
                          )}
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
                    <div className={itemStyles.specs}>
                      {cortas.length > 0 ? (
                        <div className={itemStyles.specGrid}>
                          {cortas.map(renderSpec)}
                        </div>
                      ) : null}
                      {largas.map(renderSpec)}
                      <BriefDisenoEspecificaciones
                        brief={briefDiseno}
                        caras={carasBrief}
                        onOpen={() => setBriefAbierto(true)}
                      />
                    </div>
                  );
                })()
              : null}

            <ComponentesEspecificaciones componentes={componentesFabricados} />

            <div className={itemStyles.extras}>
              {item.adicionales.length > 0 || !tieneComponentesFabricados ? (
                <div className={itemStyles.extrasSection}>
                  <div className={itemStyles.extrasHeading}>
                    <PlusIcon />
                    <span>Opcionales activados</span>
                  </div>
                  <div className={itemStyles.chips}>
                    {item.adicionales.length > 0 ? (
                      item.adicionales.map((adicional) => {
                        const details =
                          optionalMaterialDetails.get(adicional) ?? [];
                        return (
                          <span
                            key={adicional}
                            className={itemStyles.chipDetail}
                          >
                            <span className={itemStyles.optionalChip}>
                              <CheckIcon aria-hidden="true" />
                              {adicional}
                            </span>
                            {details.length > 0 ? (
                              <span className={itemStyles.chipHint}>
                                {details.join(" · ")}
                              </span>
                            ) : null}
                          </span>
                        );
                      })
                    ) : (
                      <p className={itemStyles.emptyOptional}>
                        Sin opcionales activados
                      </p>
                    )}
                  </div>
                </div>
              ) : componentMaterialDetails.length === 0 ? (
                <span aria-hidden="true" />
              ) : null}

              {componentMaterialDetails.length > 0 ? (
                <div className={itemStyles.extrasSection}>
                  <div className={itemStyles.extrasHeading}>
                    <PackageIcon />
                    <span>Componentes</span>
                  </div>
                  <div className={itemStyles.chips}>
                    {componentMaterialDetails.map((detail) => (
                      <span key={detail} className={itemStyles.chipDetail}>
                        <Badge variant="secondary">{detail}</Badge>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className={itemStyles.delivery}>
                <div className={itemStyles.extrasHeading}>
                  <CalendarIcon aria-hidden="true" />
                  <span>Entrega del producto</span>
                </div>
                {!(entregasPrevias?.distribucion ?? item.distribucionEntregas)
                  ?.entregas.length ? (
                  <>
                    <div className={itemStyles.deliveryRow}>
                      <span className={itemStyles.deliveryLabel}>
                        Entrega prevista
                      </span>
                      {readOnly && !editarFecha ? (
                        <span className={itemStyles.deliveryValue}>
                          {formatFechaOrden(item.fechaEntrega ?? fechaEstimada)}
                        </span>
                      ) : (
                        <Input
                          ref={fechaInputRef}
                          className={itemStyles.dateInput}
                          type="date"
                          value={item.fechaEntrega ?? fechaEstimada}
                          onClick={() => fechaInputRef.current?.showPicker?.()}
                          onChange={(event) =>
                            onChangeFechaEntrega?.(event.target.value)
                          }
                          aria-label={`Entrega prevista de ${item.productoNombre}`}
                        />
                      )}
                    </div>
                    {(() => {
                      if (!conEta) return null;
                      const eta = describirEta(
                        etaSistema,
                        item.fechaEntrega ?? fechaEstimada,
                        {
                          margenDias: margenEtaDias,
                          noLaborables,
                          zona: zonaHoraria,
                          ahora: ahoraEta,
                        },
                      );
                      if (!eta) return null;
                      return (
                        <div
                          className={cn(
                            itemStyles.deliveryRow,
                            itemStyles.deliveryEstimate,
                            fechasStyles.filaTiempo,
                          )}
                        >
                          <span className={itemStyles.deliveryLabel}>
                            Producción lista
                          </span>
                          <span
                            className={cn(
                              itemStyles.deliveryValue,
                              fechasStyles.valorTiempo,
                              eta.nivel === "tarde" && itemStyles.late,
                              eta.nivel === "sin-margen" && itemStyles.tight,
                            )}
                            title={
                              eta.motivo ||
                              "Simulado contra las colas actuales del taller"
                            }
                          >
                            {eta.etiqueta}
                            {eta.nivel === "tarde"
                              ? " · después de la fecha"
                              : eta.nivel === "sin-margen"
                                ? " · sin margen"
                                : ""}
                          </span>
                        </div>
                      );
                    })()}
                  </>
                ) : null}
                {(conPlanificacion && (planificarEntregas || entregasPrevias)) ||
                item.distribucionEntregas ? (
                  <PlanificacionEntregas
                    itemId={item.id}
                    nombre={item.productoNombre}
                    cantidad={item.cantidad}
                    previa={entregasPrevias}
                    distribucion={item.distribucionEntregas}
                    editable={conPlanificacion && (!!planificarEntregas || !!entregasPrevias)}
                    onGuardada={onDistribucionGuardada}
                  />
                ) : null}
              </div>
            </div>
          </HeroTabs.Panel>

          <HeroTabs.Panel id="costos" className={itemStyles.panel}>
            <CostosItemView
              item={item}
              costo={costo}
              calculoPendiente={calculoPendiente}
              sinComprobante={sinComprobante}
            />
          </HeroTabs.Panel>

          {(["produccion", "aprovechamiento"] as const).map((vista) => (
            <HeroTabs.Panel key={vista} id={vista} className={itemStyles.panel}>
              <FabricacionItemView
                vista={vista}
                loteId={loteId}
                onLoteChange={setLoteId}
                item={item}
                calculoPendiente={calculoPendiente}
                prepararCorte={prepararCorte}
                onExpand={() => setVistaAmpliada(vista)}
                onEditPanels={
                  readOnly ? undefined : (paso) => onEditPanels?.(item, paso)
                }
              />
            </HeroTabs.Panel>
          ))}
        </HeroTabs>
      ) : null}

      <Dialog
        open={vistaAmpliada !== null}
        onOpenChange={(open) => {
          if (!open) setVistaAmpliada(null);
        }}
      >
        <DialogContent
          {...legacyScope}
          className={cn(legacyTheme ?? workspaceTheme.theme, itemStyles.dialog)}
        >
          <DialogHeader className={itemStyles.dialogHeader}>
            <DialogTitle>
              {vistaAmpliada === "aprovechamiento"
                ? "Aprovechamiento"
                : "Flujo de producción"}{" "}
              · {item.productoNombre}
            </DialogTitle>
            <DialogDescription>
              {vistaAmpliada === "aprovechamiento"
                ? "Disposición de piezas, consumo y archivos de fabricación."
                : "Operaciones y tiempos del ítem."}
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <div className={itemStyles.dialogBody}>
            <div className={itemStyles.expandedContent}>
              {vistaAmpliada ? (
                <FabricacionItemView
                  vista={vistaAmpliada}
                  loteId={loteId}
                  onLoteChange={setLoteId}
                  item={item}
                  calculoPendiente={calculoPendiente}
                  ampliada
                  prepararCorte={prepararCorte}
                  onEditPanels={
                    readOnly ? undefined : (paso) => onEditPanels?.(item, paso)
                  }
                />
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BriefDisenoDialog
        brief={briefDiseno}
        caras={carasBrief}
        productoNombre={item.productoNombre}
        open={briefAbierto}
        onOpenChange={setBriefAbierto}
      />
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
          <svg
            className="emit-check"
            viewBox="0 0 52 52"
            width="82"
            height="82"
          >
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
                          <GdiSpinner />
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
    <Chip size="sm" color="warning" variant="soft">
      <FileXIcon className="size-3" />
      Sin comprobante
    </Chip>
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
  planEntrega?: VinculoPlanEntrega,
) {
  const amounts = getItemOrderVisibleAmounts(item);
  // El descuento YA está dentro de `subtotal` (el motor lo aplicó sobre el
  // neto): estos campos son la traza persistida (tipo/valor que pidió el
  // comercial + el monto que resolvió el motor), no se vuelven a restar.
  const descuento = item.cotizacion.desglosePrecio?.descuento;
  return {
    cotizacionItemId,
    fechaEntrega: item.fechaEntrega || undefined,
    ...(planEntrega ? { planEntrega } : {}),
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
      item.subcategoriaComercialNombre || item.categoriaComercialNombre || "—",
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
    ...(item.archivosOrigenItemIds?.length
      ? { archivosOrigenItemIds: item.archivosOrigenItemIds }
      : {}),
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
function solicitudTomo(
  meta: NonNullable<ReturnType<typeof metaCentroCopiado>>,
  clienteId: string,
) {
  return {
    clienteId: clienteId || undefined,
    documentos: (meta.segmentos ?? []).map((segmento, indice) => ({
      ...segmento,
      id: `s${indice}`,
      nombre: segmento.nombre ?? undefined,
      copias: 1,
      tamanoAnchoMm:
        segmento.tamanoAnchoMm ?? dimsDeFormato(segmento.tamano).anchoMm,
      tamanoAltoMm:
        segmento.tamanoAltoMm ?? dimsDeFormato(segmento.tamano).altoMm,
      grupoId: "T",
    })),
    grupos: [
      {
        id: "T",
        juegos: meta.juegos ?? 1,
        nombre: meta.tomoNombre ?? undefined,
        terminaciones: meta.terminaciones ?? [],
        tipoAnillo: meta.tipoAnillo ?? undefined,
      },
    ],
  };
}

type SnapshotResumenOrden = {
  tipoCambio?: import("@/lib/tipo-cambio-api").TipoCambioSnapshot;
  costosMaterialesMoneda?: import("@/lib/tipo-cambio-api").CostoMaterialMoneda[];
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
  componentesFabricados?: CotizacionPropuestaSnapshot["componentesFabricados"];
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
  const jobContext =
    (snap?.jobContext as Record<string, unknown> | null) ?? undefined;
  const unidadMedida = unidadDesdeCorta(producto.cantidadUnidad);
  const cantidadLibros =
    unidadMedida === "libros" ? cantidadLibrosCentroCopiado(jobContext) : null;
  const cantidadVisible = cantidadLibros ?? producto.cantidad;

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
  const totalImpuestosUnit =
    Math.max(0, brutoUnit - netoUnit) + costosInternosUnit;

  const cotizacion = {
    tipoCambio: resumen?.tipoCambio,
    costosMaterialesMoneda: resumen?.costosMaterialesMoneda,
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
    // La cotización persiste el árbol completo de componentes dentro de la
    // trazabilidad. Rehidratar sólo los pasos del producto raíz conservaba el
    // total, pero borraba el origen de los costos de los hijos: la vista de
    // Costos terminaba enviándolos a "Sin desglosar" al reabrir una OT.
    componentesFabricados: trazabilidad?.componentesFabricados ?? [],
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
              cantidadPricing > 0
                ? descuentoMontoPersistido / cantidadPricing
                : 0,
            montoTotal: descuentoMontoPersistido,
            netoListaUnitario:
              cantidadPricing > 0
                ? (producto.subtotal + descuentoMontoPersistido) /
                  cantidadPricing
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
    fechaEntrega: producto.fechaEntrega ?? undefined,
    distribucionEntregas: producto.distribucionEntregas,
    productoNombre: producto.nombre,
    productoCodigo: producto.codigo,
    motorCodigo: snap?.productoId ?? "",
    categoriaComercialCodigo: "",
    // Órdenes viejas (pre categoriaComercial persistida) caen a `familia`.
    categoriaComercialNombre: producto.categoriaComercial || producto.familia,
    subcategoriaComercialCodigo: "",
    subcategoriaComercialNombre:
      producto.subcategoriaComercial || producto.familia,
    unidadMedida,
    cantidad: cantidadVisible,
    precioUnitario: cantidadVisible > 0 ? producto.total / cantidadVisible : 0,
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
    jobContext,
    notaProduccion:
      typeof jobContext?.notasProduccion === "string"
        ? jobContext.notasProduccion
        : undefined,
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

export function PropuestaFicha(props: PropuestaFichaProps) {
  const inicial = props.orden?.productos
    .map(
      (p) =>
        (
          p.snapshot?.resumen as {
            tipoCambio?: import("@/lib/tipo-cambio-api").TipoCambioSnapshot;
          } | null
        )?.tipoCambio,
    )
    .find(Boolean);
  return (
    <TipoCambioDocumentoProvider inicial={inicial}>
      <PropuestaFichaContenido {...props} />
    </TipoCambioDocumentoProvider>
  );
}

function PropuestaFichaContenido({
  initialClientes = [],
  initialProductos = [],
  initialCargosDirectos = [],
  currentUser = null,
  initialLoadErrors = [],
  orden: ordenProp,
  recienEmitida = false,
  recienConvertida = false,
  initialDocumentos = null,
}: PropuestaFichaProps) {
  const {
    cotizar,
    cotizarYGuardar,
    recotizarCotizacionItem,
    guardarTomoCentroCopiado,
    construirItemsCentroCopiado,
  } = useMotorConTipoCambio();
  const cambioDocumento = useTipoCambioDocumento();
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
  const [editandoOrden, setEditandoOrden] = React.useState(false);
  const [guardandoEdicion, setGuardandoEdicion] = React.useState(false);
  // Única puerta para las mutaciones de esta ficha; los permisos y estados
  // de cada operación siguen aplicándose además de este modo de presentación.
  const puedeEditarOrden = !orden || (editandoOrden && !guardandoEdicion && orden.estado !== "cancelada");
  const permisoEdicionRef = React.useRef(puedeEditarOrden);
  React.useLayoutEffect(() => {
    permisoEdicionRef.current = puedeEditarOrden;
  }, [puedeEditarOrden]);
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
    if (!permisoEdicionRef.current) return;
    const siguiente = sinComprobante ? "FISCAL" : "SIN_COMPROBANTE";
    if (orden?.id) {
      setTogglingFiscal(true);
      try {
        const actualizada = await setTratamientoFiscalOrden(
          orden.id,
          siguiente,
        );
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
    puedeEditarOrden && (!modoOrden ||
    (orden ? ["borrador", "pendiente"].includes(orden.estado) : false));
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
  const [tab, setTab] = React.useState<OrdenTab>(
    ordenProp ? "productos" : "datos",
  );
  // QR que el cliente presenta en el mostrador para retirar.
  const [etiquetaOpen, setEtiquetaOpen] = React.useState(false);
  const impresionDirecta = useImpresionDirecta();
  const conFidelizacion = useCapacidad("fidelizacion");
  const conCupones = useCapacidad("cupones");
  const conProyectos = useCapacidad("proyectos");
  const conEta = useCapacidad("eta_capacidad");
  const conPrevision = useCapacidad("prevision_materiales");
  const impresionDocumentos = useImpresionDocumentos();
  const [confirmarEmisionDocumentos, setConfirmarEmisionDocumentos] = React.useState<"nueva" | "borrador" | null>(null);
  const imprimirAlEmitirRef = React.useRef(false);
  const puedeImprimirEtiqueta = usePuede("produccion.ver");
  const puedeVerMaterialesComercial = usePuede("comercial.ver");
  const puedeVerMateriales =
    puedeImprimirEtiqueta || puedeVerMaterialesComercial;
  const [qrRetiroOpen, setQrRetiroOpen] = React.useState(false);
  // Acceso manual al mismo circuito de mostrador cuando no se usa el QR.
  const [entregaManualOpen, setEntregaManualOpen] = React.useState(false);
  // Cobros en staging (sólo creación): se registran todos al emitir la OT,
  // como los items. El backend rechaza cobros sobre borradores, así que
  // guardar borrador NO los persiste (se avisa con modal).
  const [cobrosStaged, setCobrosStaged] = React.useState<CobroDraft[]>([]);
  const [confirmBorradorConCobros, setConfirmBorradorConCobros] =
    React.useState(false);
  const { fechaHora } = useFecha();
  // Acreditar una factura ante ARCA no es cosa de cualquiera: es el mismo
  // permiso que rige anular comprobantes.
  const verMargenes = usePuede("finanzas.ver_margenes");
  const puedeAnular = usePuede("administracion.anular");
  const puedeEntregar = usePuede("produccion.gestionar");
  const [confirmCancelar, setConfirmCancelar] = React.useState(false);
  const [cancelando, setCancelando] = React.useState(false);
  const [openIds, setOpenIds] = React.useState<Set<string>>(() => new Set());
  const [items, setItems] = React.useState<PropuestaItem[]>(() =>
    orden ? orden.productos.map(rehidratarOrdenItem) : [],
  );
  const documentosCentroCopiado = items.filter(item => metaCentroCopiado(item.jobContext)).length;

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
  const [fidelizacionCanjePuntos, setFidelizacionCanjePuntos] =
    React.useState(0);
  const [fidelizacionCanjeMonto, setFidelizacionCanjeMonto] = React.useState(0);
  const costosFidelizacion = React.useMemo(
    () => consolidarCostosOrden(items, cargosOrden),
    [items, cargosOrden],
  );
  const totalPropuestaAntesCanje = React.useMemo(() => {
    const r = calcularResumenOrden(items, cargosOrden);
    // Sin comprobante: el saldo a cobrar es el neto, sin IVA (§6 cuaderno de
    // margen) — así los Pagos no muestran una deuda inflada con impuestos.
    return sinComprobante ? r.total - r.impuestos : r.total;
  }, [items, cargosOrden, sinComprobante]);
  const totalPropuesta = Math.max(
    0,
    totalPropuestaAntesCanje - fidelizacionCanjeMonto,
  );
  const actualizarSimulacionFidelizacion = React.useCallback(
    (simulacion: { canjeMonto: number; canjePuntos: number } | null) => {
      setFidelizacionCanjeMonto(simulacion?.canjeMonto ?? 0);
      if (simulacion) {
        setFidelizacionCanjePuntos((actual) =>
          actual === simulacion.canjePuntos ? actual : simulacion.canjePuntos,
        );
      }
    },
    [],
  );
  const [addOpen, setAddOpen] = React.useState(false);
  const [copiadoOpen, setCopiadoOpen] = React.useState(false);
  // Módulo activo (config del tenant): esconde el botón/atajo si está pausado.
  // Se inicia cerrado hasta confirmar el estado; el backend también lo exige.
  const [ccActivo, setCcActivo] = React.useState(false);
  React.useEffect(() => {
    let vivo = true;
    void estadoCentroCopiado()
      .then((e) => {
        if (vivo) setCcActivo(e.activo);
      })
      .catch(() => {
        if (vivo) setCcActivo(false);
      });
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
  const [cuponAbierto, setCuponAbierto] = React.useState(false);
  const [cuponValidando, setCuponValidando] = React.useState(false);
  const cuponEnCurso = React.useRef(false);
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
  const [proyectoCampanaId, setProyectoCampanaId] = React.useState(
    orden?.proyectoCampana?.id ?? "",
  );
  const [campanasCliente, setCampanasCliente] = React.useState<
    CampanaReferencia[]
  >([]);
  React.useEffect(() => {
    let vigente = true;
    if (!conProyectos) return;
    if (!clienteId) {
      setCampanasCliente([]);
      setProyectoCampanaId("");
      return;
    }
    void getCampanasOpciones(clienteId)
      .then((rows) => {
        if (!vigente) return;
        setCampanasCliente(rows);
        setProyectoCampanaId((actual) =>
          actual && rows.some((c) => c.id === actual) ? actual : "",
        );
      })
      .catch(() => {
        if (vigente) setCampanasCliente([]);
      });
    return () => {
      vigente = false;
    };
  }, [clienteId, conProyectos]);
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
      if (!permisoEdicionRef.current) return;
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
  // La caché sobrevive al cierre del panel de datos en móvil.
  const selectorClientes = useClientesOrden(clientesDisponibles);
  const [canalVenta, setCanalVenta] = React.useState(orden?.canalVenta ?? "");
  const datosOrdenRef = React.useRef<OrdenWorkspaceHandle>(null);
  const canalSelectorId = React.useId();
  const [errorCanalVenta, setErrorCanalVenta] = React.useState(false);
  const validarCanalVenta = React.useCallback(() => {
    if (canalVentaValido(canalVenta, orden?.canalVenta)) return true;
    setErrorCanalVenta(true);
    setNavPendiente(null);
    setConfirmBorradorConCobros(false);
    datosOrdenRef.current?.mostrarDatos();
    toast.error("Elegí un canal de venta para guardar.");
    window.requestAnimationFrame(() => {
      const campo = document.getElementById(canalSelectorId);
      campo?.scrollIntoView({ block: "nearest" });
      campo?.querySelector("button")?.focus();
    });
    return false;
  }, [canalVenta, orden?.canalVenta, canalSelectorId]);
  const [fechaEstimada, setFechaEstimada] = React.useState(
    () => orden?.fechaEntrega ?? offsetDate(7, zonaHoraria),
  );
  const creacionDefaultsRef = React.useRef({
    canalVenta,
    fechaEstimada,
  });

  const entregasPrevias = useEntregasPrevias((item) => ({
    productoId: item.motorCodigo!,
    tipoCambioId:
      item.cotizacion?.tipoCambio?.id ?? cambioDocumento?.cambio?.id,
    rutaAlternativaId: item.rutaAlternativaId ?? null,
    jobContext: { ...item.jobContext, cantidad: item.cantidad } as never,
    clienteId: clienteId || null,
    periodo: getCurrentPeriodo(),
    descuento: descuentoParaMotor(item.descuentoInput),
  }));

  /** La OT termina con su última entrega; una fecha global vieja no la retiene. */
  const fechaEntregaOrden = React.useCallback(
    () =>
      fechaFinalItems(
        items.map(
          (item) =>
            (!orden && ordenTipo === "orden"
              ? entregasPrevias.fechaPara(item)
              : fechaFinalDistribucion(item.distribucionEntregas)) ??
            item.fechaEntrega ??
            fechaEstimada,
        ),
        fechaEstimada,
      ),
    [items, fechaEstimada, orden, ordenTipo, entregasPrevias],
  );
  const fechaFinalVisible =
    ordenTipo === "orden" ? fechaEntregaOrden() : fechaEstimada;

  // ── Demora estimada por el sistema (fase 3, simulación de flujo) ──────
  // Sólo en creación/borrador: una orden emitida ya está EN las colas del
  // tablero — volver a simularla la contaría dos veces (D10 del doc).
  const cotizando = !orden || orden.estado === "borrador";
  const conDemoraSistema = cotizando && conEta;
  const conPrevisionMateriales = cotizando && conPrevision;
  const previsionMateriales = usePrevisionMateriales(items, conPrevisionMateriales);
  const [colasTaller, setColasTaller] = React.useState<Awaited<
    ReturnType<typeof getContextoPrevision>
  > | null>(null);
  const [margenEtaDias, setMargenEtaDias] = React.useState(0);
  React.useEffect(() => {
    if (!conDemoraSistema) return;
    let vigente = true;
    let timer: ReturnType<typeof setTimeout>;
    const actualizar = async () => {
      try {
        const contexto = await getContextoPrevision();
        if (!vigente) return;
        setMargenEtaDias(contexto.margenEtaDias);
        setColasTaller(contexto);
      } catch {
        if (vigente) setColasTaller(null);
      } finally {
        // Renueva carga y reloj también si la ficha queda abierta al cambiar el día.
        if (vigente) timer = setTimeout(actualizar, 60_000);
      }
    };
    void actualizar();
    return () => {
      vigente = false;
      clearTimeout(timer);
    };
  }, [conDemoraSistema]);

  /** ETA por item de la ficha, simulada contra las colas reales de HOY. */
  const demoraPorItem = React.useMemo(() => {
    if (!conDemoraSistema || !colasTaller || items.length === 0) return null;
    const nuevos = items.map((item) =>
      condicionarPorMateriales(
        itemHipoteticoDesdeCotizacion(item.id, item.cotizacion),
        previsionMateriales.data,
        previsionMateriales.error,
      ),
    );
    return estimarDemoraNuevos({ nuevos, ...colasTaller });
  }, [
    conDemoraSistema,
    colasTaller,
    items,
    previsionMateriales.data,
    previsionMateriales.error,
  ]);

  /** ETA de la ORDEN completa = el item que termina último. */
  const demoraOrden = React.useMemo<SimulacionItem | null>(() => {
    if (!demoraPorItem || demoraPorItem.size === 0) return null;
    let fin: Date | null = null;
    let sinEstimar = false;
    let parcial = false;
    let asumeDesbloqueo = false;
    const motivos = new Set<string>();
    for (const eta of demoraPorItem.values()) {
      if (eta.sinEstimar || eta.finEstimado === null) sinEstimar = true;
      else if (fin === null || eta.finEstimado > fin) fin = eta.finEstimado;
      parcial ||= eta.parcial;
      asumeDesbloqueo ||= eta.asumeDesbloqueo;
      if (eta.motivoSinEstimar) motivos.add(eta.motivoSinEstimar);
    }
    return {
      finEstimado: sinEstimar ? null : fin,
      motivoSinEstimar: [...motivos].join(" ") || undefined,
      sinEstimar,
      parcial,
      asumeDesbloqueo,
    };
  }, [demoraPorItem]);

  // Fechas que el usuario fijó a mano (o que ya venían en la OT persistida):
  // la ETA no las vuelve a pisar. El resto sigue a la estimación del sistema.
  const otFechaTocadaRef = React.useRef(Boolean(orden?.fechaEntrega));
  const itemFechaTocadaRef = React.useRef<Set<string>>(
    new Set(
      orden?.productos.flatMap((p) => (p.id && p.fechaEntrega ? [p.id] : [])) ??
        [],
    ),
  );

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
          zona: colasTaller?.zona ?? zonaHoraria,
        });
        // No conservar una sugerencia anterior si el abastecimiento dejó de ser estimable.
        if (item.fechaEntrega === (fecha ?? "")) return item;
        cambio = true;
        return { ...item, fechaEntrega: fecha ?? "" };
      });
      return cambio ? next : current;
    });
  }, [
    demoraPorItem,
    margenEtaDias,
    colasTaller?.noLaborables,
    colasTaller?.zona,
    zonaHoraria,
  ]);

  // La fecha de la OT sigue a la ETA de la orden completa (el item que termina
  // último) hasta que el usuario la fija a mano.
  React.useEffect(() => {
    if (!conDemoraSistema || otFechaTocadaRef.current) return;
    const fecha = fechaRecomendadaEta(demoraOrden, {
      margenDias: margenEtaDias,
      noLaborables: colasTaller?.noLaborables,
      zona: colasTaller?.zona ?? zonaHoraria,
    });
    if (items.length > 0)
      setFechaEstimada((prev) => (prev === (fecha ?? "") ? prev : fecha ?? ""));
  }, [
    demoraOrden,
    conDemoraSistema,
    items.length,
    margenEtaDias,
    colasTaller?.noLaborables,
    colasTaller?.zona,
    zonaHoraria,
  ]);

  const router = useRouter();
  const [emitiendo, setEmitiendo] = React.useState(false);
  const [emisionNumero, setEmisionNumero] = React.useState<string | null>(null);
  const emisionOrdenIdRef = React.useRef<string | null>(null);
  const emisionIdempotencyRef = React.useRef<string | null>(null);
  const borradorIdempotencyRef = React.useRef<string | null>(null);
  const tomosIdempotencyRef = React.useRef<Map<string, string>>(new Map());
  const cambioRemotoPendiente = React.useRef(false);
  const bloqueaCambioRemoto =
    editandoOrden ||
    guardandoEdicion ||
    panelSaving ||
    emitiendo ||
    cancelando ||
    togglingFiscal;

  const aplicarCambioRemoto = React.useCallback(() => {
    if (!ordenProp?.id) return;
    if (bloqueaCambioRemoto) {
      cambioRemotoPendiente.current = true;
      return;
    }
    cambioRemotoPendiente.current = false;
    recargarOrden();
    router.refresh();
  }, [bloqueaCambioRemoto, ordenProp?.id, recargarOrden, router]);

  useCambiosSistema(
    (cambio) => {
      if (ordenProp?.id && cambio.topicos.includes(`orden:${ordenProp.id}`)) {
        aplicarCambioRemoto();
      }
    },
    [aplicarCambioRemoto, ordenProp?.id],
  );

  React.useEffect(() => {
    if (!bloqueaCambioRemoto && cambioRemotoPendiente.current) {
      aplicarCambioRemoto();
    }
  }, [aplicarCambioRemoto, bloqueaCambioRemoto]);
  React.useEffect(() => {
    if (puedeEditarOrden) return;
    setConfirmCancelar(false);
    setEntregaManualOpen(false);
  }, [puedeEditarOrden]);
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
    (campo: string) => !orden || (puedeEditarOrden && camposEdicion.has(campo)),
    [orden, puedeEditarOrden, camposEdicion],
  );

  /** Items tocables sólo antes de que el taller arranque (espejo backend). */
  const puedeTocarItems =
    !!orden && (orden.estado === "borrador" || orden.estado === "pendiente");
  /**
   * Una sola puerta de edición: los items (agregar/editar/quitar) sólo se
   * habilitan DENTRO del modo "Editar orden", igual que los field-cards.
   * TODO es staging local — nada pega en la base hasta "Guardar cambios".
   */
  const itemsEnEdicion = puedeTocarItems && puedeEditarOrden;
  // Misma puerta para botones, atajos y confirmación de ambos sheets.
  const puedeModificarProductos =
    !guardandoEdicion &&
    !cuponValidando &&
    !descuentoAplicando &&
    (!modoOrden || itemsEnEdicion);
  const permisoProductosRef = React.useRef(puedeModificarProductos);
  React.useLayoutEffect(() => {
    permisoProductosRef.current = puedeModificarProductos;
    if (puedeModificarProductos) return;
    setAddOpen(false);
    setEditingItem(null);
    setCopiadoOpen(false);
    setCopiadoEditItems(null);
  }, [puedeModificarProductos]);

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
    setFechaEstimada(orden.fechaEntrega ?? "");
    itemFechaTocadaRef.current = new Set(
      orden.productos.flatMap((p) => (p.id && p.fechaEntrega ? [p.id] : [])),
    );
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

  const polyfanPendientesDeGuardar = React.useMemo(
    () =>
      [...cambiosItems.agregados, ...cambiosItems.editados].filter(
        requierePreparacionPolyfan,
      ),
    [cambiosItems],
  );

  /** Cambios de datos comerciales (field-cards) sin guardar. */
  const cambiosFields = React.useMemo(() => {
    if (!orden || !editandoOrden) return {} as Record<string, string>;
    const payload: Record<string, string> = {};
    if (clienteId && clienteId !== (orden.clienteId ?? "")) {
      payload.clienteId = clienteId;
    }
    if (canalVenta !== (orden.canalVenta ?? "")) {
      payload.canalVenta = canalVenta;
    }
    if (fechaFinalVisible && fechaFinalVisible !== (orden.fechaEntrega ?? "")) {
      payload.fechaEntrega = fechaFinalVisible;
    }
    return payload;
  }, [orden, editandoOrden, clienteId, canalVenta, fechaFinalVisible]);

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
        `La OT tiene un ${orden.progresoPct}% de avance estimado por operaciones completadas. El trabajo y los tiempos registrados se conservan.`,
      );
    }
    return puntos;
  }, [orden, moneda, acreditaYCancela]);

  const cancelarOrden = React.useCallback(
    async (motivo: string) => {
      if (!permisoEdicionRef.current || !orden || cancelando || cambiosSinGuardar > 0) return;
      setCancelando(true);
      try {
        await cancelarOrdenTrabajo(orden.id, motivo, acreditaYCancela);
        setConfirmCancelar(false);
        setEditandoOrden(false);
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
    [orden, cancelando, acreditaYCancela, router, cambiosSinGuardar],
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
          for (const file of files) {
            // Reemplaza sólo el mismo original. En una edición parcial de un
            // tomo no debe borrar los PDF de los demás documentos heredados.
            for (const a of previos) {
              if (a.autogeneradoPor === MARCA && a.nombre === file.name) {
                await eliminarArchivo(a.id);
              }
            }
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

  const mapaArchivosBrief = React.useCallback(
    (
      itemsConSnapshot: Array<{
        item: PropuestaItem;
        cotizacionItemId?: string;
      }>,
    ): Map<string, BriefDisenoArchivoPendiente[]> => {
      const mapa = new Map<string, BriefDisenoArchivoPendiente[]>();
      for (const { item, cotizacionItemId } of itemsConSnapshot) {
        if (cotizacionItemId && item.briefDisenoArchivosPendientes?.length) {
          mapa.set(cotizacionItemId, item.briefDisenoArchivosPendientes);
        }
      }
      return mapa;
    },
    [],
  );

  /** Publica logos y referencias del brief una vez que existe el ítem real. */
  const subirArchivosBriefDiseno = React.useCallback(
    async (
      productos: OrdenTrabajoProducto[],
      archivosPorCotItem: Map<string, BriefDisenoArchivoPendiente[]>,
    ) => {
      if (archivosPorCotItem.size === 0) return;
      const marca = "brief-diseno";
      const fallidos: string[] = [];
      for (const producto of productos) {
        const pendientes = producto.cotizacionItemId
          ? archivosPorCotItem.get(producto.cotizacionItemId)
          : undefined;
        if (!pendientes?.length) continue;
        try {
          const previos = await listarArchivos("ORDEN_ITEM", producto.id);
          for (const pendiente of pendientes) {
            for (const previo of previos) {
              if (
                previo.autogeneradoPor === marca &&
                previo.nombre === pendiente.file.name
              ) {
                await eliminarArchivo(previo.id);
              }
            }
            await subirArchivo(pendiente.file, {
              scope: "ORDEN_ITEM",
              entidadId: producto.id,
              descripcion: pendiente.requiereVectorizacion
                ? "Brief de diseño · Requiere vectorización"
                : "Brief de diseño",
              autogeneradoPor: marca,
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
          `${fallidos.length} tarea(s) de archivos del brief no se pudieron completar. Revisá los adjuntos del producto.`,
          { duration: 10000 },
        );
      }
    },
    [],
  );

  /**
   * Prepara snapshots nuevos para las altas y ediciones sin sobrescribir los
   * históricos. El guardado en lote aplica después toda la proyección.
   */
  const prepararItemOrden = React.useCallback(
    async (item: PropuestaItem) => {
      if (!orden) throw new Error("No se cargó la orden de trabajo.");
      if (!item.motorCodigo || !item.jobContext) {
        throw new Error(
          `"${item.productoNombre}" no tiene datos de cotización para persistir.`,
        );
      }
      const meta = metaCentroCopiado(item.jobContext);
      if (meta?.esTomo) {
        const huella = `${item.id}:${item.cotizacion?.tipoCambio?.id ?? ""}:${JSON.stringify(meta)}`;
        const key =
          tomosIdempotencyRef.current.get(huella) ?? crypto.randomUUID();
        tomosIdempotencyRef.current.set(huella, key);
        const guardado = await guardarTomoCentroCopiado({
          ...solicitudTomo(meta, clienteId),
          idempotencyKey: key,
        });
        if (guardado.error || !guardado.cotizacionItemId)
          throw new Error(guardado.error || "No se pudo guardar el tomo.");
        return {
          item,
          cotizacionItemId: guardado.cotizacionItemId,
          payload: itemToOrdenItemPayload(item, guardado.cotizacionItemId),
        };
      }
      const request = {
        rutaAlternativaId: item.rutaAlternativaId ?? null,
        jobContext: item.jobContext as never,
        clienteId: clienteId || null,
        periodo: getCurrentPeriodo(),
        descuento: descuentoParaMotor(item.descuentoInput),
      };
      // Una edición prepara una revisión nueva; la OT sólo cambia al confirmar
      // el lote y la cotización anterior queda disponible para trazabilidad.
      const respuesta = await cotizarYGuardar({
        productoId: item.motorCodigo,
        ...request,
      });
      if (!respuesta.result.exitoso) {
        throw new Error(
          respuesta.result.errores?.[0]?.mensaje ??
            `No se pudo guardar la cotización de "${item.productoNombre}".`,
        );
      }
      const cotizacionItemId = respuesta.cotizacionItemId;
      const payload = itemToOrdenItemPayload(item, cotizacionItemId);
      return { item, cotizacionItemId, payload };
    },
    [orden, clienteId, cotizarYGuardar, guardarTomoCentroCopiado],
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
    if (!orden || togglingFiscal || cancelando) return;
    // Descarta TODO el staging: field-cards e items vuelven a lo persistido.
    setClienteId(orden.clienteId ?? "");
    setCanalVenta(orden.canalVenta ?? "");
    setErrorCanalVenta(false);
    setFechaEstimada(orden.fechaEntrega ?? orden.creadaEl.slice(0, 10));
    // Vuelve a seguir a la ETA salvo que la OT ya tuviera fecha comprometida.
    otFechaTocadaRef.current = Boolean(orden.fechaEntrega);
    itemFechaTocadaRef.current = new Set(
      orden.productos.flatMap((p) => (p.id && p.fechaEntrega ? [p.id] : [])),
    );
    setItems(orden.productos.map(rehidratarOrdenItem));
    cambioDocumento?.establecer(
      orden.productos
        .map(
          (p) =>
            (p.snapshot?.resumen as SnapshotResumenOrden | null)?.tipoCambio,
        )
        .find(Boolean) ?? null,
    );
    setEditadosIds(new Set());
    setEditandoOrden(false);
  }, [orden, togglingFiscal, cancelando, cambioDocumento]);

  /**
   * Commit atómico del staging. Los snapshots se recalculan primero y luego
   * el backend aplica campos, altas, ediciones, bajas, pasos, totales y
   * cupones dentro de una única transacción con control de versión.
   */
  const guardarEdicion = React.useCallback(
    async (opciones?: { destino?: string }) => {
      if (!permisoEdicionRef.current || !orden) return;
      if (
        camposEditablesOrden(orden.estado).has("canalVenta") &&
        !validarCanalVenta()
      )
        return;
      const destino = opciones?.destino;
      if (cambiosSinGuardar === 0) {
        setEditandoOrden(false);
        if (destino) router.push(destino);
        return;
      }
      setGuardandoEdicion(true);
      try {
        const tocados = [...cambiosItems.editados, ...cambiosItems.agregados];
        const cambioAlGuardar = tocados.length
          ? await cambioDocumento?.resolver()
          : cambioDocumento?.cambio;
        const preparados = [];
        for (const item of tocados) {
          preparados.push(await prepararItemOrden(item));
        }
        const porItemId = new Map(
          preparados.map((preparado) => [preparado.item.id, preparado]),
        );
        const idsPersistidos = new Set(
          orden.productos.map((producto) => producto.id),
        );
        const itemsFinales =
          cambiosItems.quitados.length > 0 || preparados.length > 0
            ? items.map((item) => {
                const preparado = porItemId.get(item.id);
                const cotizacionItemId =
                  preparado?.cotizacionItemId ?? item.cotizacionItemId;
                if (!cotizacionItemId) {
                  throw new Error(
                    `"${item.productoNombre}" no tiene una cotización persistida.`,
                  );
                }
                return {
                  ...(preparado?.payload ??
                    itemToOrdenItemPayload(item, cotizacionItemId)),
                  ...(idsPersistidos.has(item.id) ? { id: item.id } : {}),
                };
              })
            : undefined;
        const detalle = await editarOrdenTrabajoLote(orden.id, {
          expectedVersion: orden.version,
          tipoCambioId: cambioAlGuardar?.id,
          ...cambiosFields,
          items: itemsFinales,
        });

        // Los binarios se publican post-commit y sólo para los ítems tocados;
        // no forman parte de la consistencia comercial de la orden.
        for (const preparado of preparados) {
          const productos = detalle.productos.filter(
            (producto) =>
              producto.cotizacionItemId === preparado.cotizacionItemId,
          );
          await publicarArtes(productos);
          await subirArchivosCentroCopiado(
            productos,
            mapaArchivosCC([preparado]),
          );
          await subirArchivosBriefDiseno(
            productos,
            mapaArchivosBrief([preparado]),
          );
          if (preparado.item.planosPendientes?.length && productos[0]?.id) {
            const { errores } = await publicarPlanos([
              {
                ordenItemId: productos[0].id,
                planos: preparado.item.planosPendientes,
              },
            ]);
            if (errores.length > 0) {
              toast.error(
                `Algunos planos no se subieron: ${errores.join(" · ")}`,
              );
            }
          }
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
        toast.error(
          (error instanceof Error
            ? error.message
            : "No se pudieron guardar los cambios.") +
            " La orden no se modificó; se recargó la versión vigente.",
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
      cambioDocumento,
      validarCanalVenta,
      cambiosSinGuardar,
      cambiosItems,
      cambiosFields,
      items,
      prepararItemOrden,
      publicarArtes,
      subirArchivosCentroCopiado,
      mapaArchivosCC,
      subirArchivosBriefDiseno,
      mapaArchivosBrief,
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
  const emitirBorrador = React.useCallback(async (imprimir = false) => {
    if (!permisoEdicionRef.current || !orden || cambiosSinGuardar > 0) return;
    if (!canalVentaValido(orden.canalVenta ?? "", orden.canalVenta)) {
      setEditandoOrden(true);
      setErrorCanalVenta(true);
      datosOrdenRef.current?.mostrarDatos();
      toast.error(
        "Elegí un canal de venta y guardá los cambios antes de emitir.",
      );
      return;
    }
    if (!orden.clienteId) {
      toast.error(
        "Asigná un cliente antes de emitir (Editar orden → Cliente).",
      );
      return;
    }
    if (
      !orden.fechaEntrega ||
      orden.fechaEntrega < offsetDate(0, zonaHoraria)
    ) {
      toast.error(
        "Definí una fecha de entrega vigente antes de emitir (Editar orden → Fecha).",
      );
      return;
    }
    setEmitiendoBorrador(true);
    try {
      await cambiarEstadoOrdenTrabajo(orden.id, { estado: "pendiente" });
      if (imprimir) impresionDocumentos.abrir(orden.id, true);
      toast.success(`${orden.numero} emitida al taller.`);
      setMostrarRecienEmitida(true);
      setEditandoOrden(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo emitir la orden.",
      );
    } finally {
      setEmitiendoBorrador(false);
    }
  }, [orden, router, zonaHoraria, cambiosSinGuardar, impresionDocumentos]);

  // El aviso lleva a edición; la emisión se confirma desde la cabecera.
  const emitirDesdeAviso = React.useCallback(() => {
    setAvisoBorradorAbierto(false);
    setEditandoOrden(true);
  }, []);

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
  const rowRefs = React.useRef(new Map<string, HTMLElement>());

  const focusOrdenProductoDetalle = React.useCallback((itemId: string) => {
    window.requestAnimationFrame(() => {
      rowRefs.current.get(itemId)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, []);

  const abrirAgregarProducto = React.useCallback(() => {
    if (!puedeModificarProductos) return;
    setEditingItem(null);
    setTab("productos");
    setAddOpen(true);
  }, [puedeModificarProductos]);

  const abrirCentroCopiado = React.useCallback(() => {
    if (!puedeModificarProductos || !ccActivo) return;
    setCopiadoEditItems(null);
    setCopiadoOpen(true);
  }, [puedeModificarProductos, ccActivo]);

  /** Un renglón que salió del centro de copiado (para rutear su edición). */
  const esCentroCopiado = React.useCallback(
    (item: PropuestaItem) =>
      item.productoCodigo === "SYS-IMPRESION-DOC" ||
      Boolean(metaCentroCopiado(item.jobContext)),
    [],
  );

  /** Id del tomo (grupo anillado) al que pertenece un renglón del centro de copiado. */
  const tomoDeItem = React.useCallback(
    (item: PropuestaItem | undefined): string | null =>
      metaCentroCopiado(item?.jobContext)?.grupoTomoId ?? null,
    [],
  );
  const tomoNombreDeItem = React.useCallback(
    (item: PropuestaItem): string | null =>
      metaCentroCopiado(item.jobContext)?.tomoNombre ?? null,
    [],
  );

  /** Id de la carga (todos los renglones de una misma pasada del centro de copiado). */
  const cargaDeItem = React.useCallback(
    (item: PropuestaItem | undefined): string | null =>
      metaCentroCopiado(item?.jobContext)?.grupoCargaId ?? null,
    [],
  );

  /**
   * Editar: los del centro de copiado reabren SU modal con la CARGA COMPLETA
   * (todos los renglones que entraron juntos), para no re-cotizar aislado; el
   * resto abre el sheet normal.
   */
  const abrirEdicion = React.useCallback(
    (item: PropuestaItem) => {
      if (!puedeModificarProductos) return;
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
    [puedeModificarProductos, esCentroCopiado, cargaDeItem, items],
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
      planEntrega?: VinculoPlanEntrega;
    }> = [];
    for (const item of items) {
      const previa =
        !orden && ordenTipo === "orden"
          ? await entregasPrevias.paraGuardar(item)
          : null;
      if (previa) {
        itemsConSnapshot.push({ item, ...previa });
        continue;
      }
      if (item.cotizacionItemId) {
        itemsConSnapshot.push({
          item,
          cotizacionItemId: item.cotizacionItemId,
        });
        continue;
      }
      // Tomo compuesto (centro de copiado): se persiste como UN CotizacionItem
      // sintético; no pasa por cotizarYGuardar (que cotiza un solo jobContext).
      const metaTomo = metaCentroCopiado(item.jobContext);
      if (metaTomo?.esTomo) {
        const huellaTomo = `${item.id}:${item.cotizacion?.tipoCambio?.id ?? ""}:${JSON.stringify(metaTomo)}`;
        const idempotencyKey =
          tomosIdempotencyRef.current.get(huellaTomo) ?? crypto.randomUUID();
        tomosIdempotencyRef.current.set(huellaTomo, idempotencyKey);
        const resp = await guardarTomoCentroCopiado({
          ...solicitudTomo(metaTomo, clienteId),
          cotizacionId,
          clienteId: clienteId || null,
          idempotencyKey,
        });
        if (resp.error || !resp.cotizacionItemId) {
          throw new Error(
            resp.error ?? `No se pudo guardar el tomo ${item.productoNombre}.`,
          );
        }
        cotizacionId = resp.cotizacionId ?? cotizacionId;
        itemsConSnapshot.push({
          item,
          cotizacionItemId: resp.cotizacionItemId,
        });
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
    // Cada ítem conserva su cotización de origen. Las preparadas antes del
    // guardado pueden pertenecer a distintos snapshots comerciales.
    return {
      itemsConSnapshot,
      cotizacionId: itemsConSnapshot.some((i) => i.planEntrega)
        ? undefined
        : cotizacionId,
    };
  }, [
    items,
    clienteId,
    orden,
    ordenTipo,
    entregasPrevias,
    cotizarYGuardar,
    guardarTomoCentroCopiado,
  ]);

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
    if (!validarCanalVenta()) return;
    if (items.length === 0) {
      toast.error(
        "Agregá al menos un producto antes de emitir el presupuesto.",
      );
      return;
    }
    if (!clienteId) {
      toast.error("Asigná un cliente: el presupuesto es para alguien.");
      return;
    }
    setEmitiendoPresupuesto(true);
    try {
      const { itemsConSnapshot, cotizacionId } =
        await persistirSnapshotsItems();
      if (!cotizacionId) {
        throw new Error("No se pudo persistir la cotización del presupuesto.");
      }
      const presupuesto = await emitirPresupuesto({
        cotizacionId,
        clienteId,
        proyectoCampanaId: proyectoCampanaId || undefined,
        fidelizacionCanjePuntos,
        canalVenta,
        fechaEntrega: fechaEntregaOrden() || undefined,
        cargos: cargosOrden.map(cargoToOrdenInput),
        items: itemsConSnapshot.map(({ item, cotizacionItemId, planEntrega }) =>
          itemToOrdenItemPayload(item, cotizacionItemId, planEntrega),
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
    proyectoCampanaId,
    fidelizacionCanjePuntos,
    canalVenta,
    validarCanalVenta,
    persistirSnapshotsItems,
    fechaEntregaOrden,
    router,
  ]);

  const emitirOrden = React.useCallback(async (imprimir = false) => {
    if (!validarCanalVenta()) return;
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
    if (!fechaEntrega) {
      toast.error("La entrega está por confirmar. Podés guardar un borrador o fijar la fecha del producto antes de emitir.");
      return;
    }
    if (fechaEntrega < offsetDate(0, zonaHoraria)) {
      toast.error(
        "La fecha de entrega no puede ser anterior a hoy. Revisá la fecha estimada.",
      );
      return;
    }
    imprimirAlEmitirRef.current = imprimir;
    setEmitiendo(true);
    setEmisionNumero(null);
    emisionOrdenIdRef.current = null;
    const idempotencyKey = emisionIdempotencyRef.current ?? crypto.randomUUID();
    emisionIdempotencyRef.current = idempotencyKey;
    try {
      const { itemsConSnapshot, cotizacionId } =
        await persistirSnapshotsItems();
      const orden = await crearOrdenTrabajo({
        idempotencyKey,
        clienteId: clienteId || undefined,
        cotizacionId,
        proyectoCampanaId: proyectoCampanaId || undefined,
        fidelizacionCanjePuntos,
        estado: "pendiente",
        fechaEntrega,
        canalVenta,
        cargos: cargosOrden.map(cargoToOrdenInput),
        tratamientoFiscal: sinComprobante ? "SIN_COMPROBANTE" : "FISCAL",
        items: itemsConSnapshot.map(({ item, cotizacionItemId, planEntrega }) =>
          itemToOrdenItemPayload(item, cotizacionItemId, planEntrega),
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
        subirArchivosBriefDiseno(
          orden.productos,
          mapaArchivosBrief(itemsConSnapshot),
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
    proyectoCampanaId,
    fidelizacionCanjePuntos,
    canalVenta,
    validarCanalVenta,
    cobrosStaged,
    moneda,
    persistirSnapshotsItems,
    fechaEntregaOrden,
    zonaHoraria,
    publicarArtes,
    subirArchivosCentroCopiado,
    mapaArchivosCC,
    subirArchivosBriefDiseno,
    mapaArchivosBrief,
    publicarPlanosDeOrden,
    sinComprobante,
  ]);

  const finalizarEmision = React.useCallback(() => {
    const ordenId = emisionOrdenIdRef.current;
    setEmitiendo(false);
    // ?emitida=1 → el detalle muestra el tag "RECIÉN EMITIDA" sólo en esta
    // llegada (la ficha limpia el param al montar).
    if (ordenId) {
      if (imprimirAlEmitirRef.current) {
        imprimirAlEmitirRef.current = false;
        impresionDocumentos.abrir(ordenId, true);
      }
      router.push(`/produccion/ordenes/${ordenId}?emitida=1`);
    }
  }, [router, impresionDocumentos]);

  /**
   * Guardar borrador: misma persistencia que emitir (snapshots + OT) pero
   * en estado `borrador` — sin exigir cliente ni fecha (se completan antes
   * de emitir). Navega al borrador para seguir trabajándolo desde ahí.
   */
  const [guardandoBorrador, setGuardandoBorrador] = React.useState(false);
  const guardarBorrador = React.useCallback(async () => {
    if (!validarCanalVenta()) return;
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
        proyectoCampanaId: proyectoCampanaId || undefined,
        fidelizacionCanjePuntos,
        estado: "borrador",
        fechaEntrega: fechaEntrega || undefined,
        canalVenta,
        cargos: cargosOrden.map(cargoToOrdenInput),
        tratamientoFiscal: sinComprobante ? "SIN_COMPROBANTE" : "FISCAL",
        items: itemsConSnapshot.map(({ item, cotizacionItemId, planEntrega }) =>
          itemToOrdenItemPayload(item, cotizacionItemId, planEntrega),
        ),
      });
      const adjuntos = await Promise.allSettled([
        publicarArtes(orden.productos),
        subirArchivosCentroCopiado(
          orden.productos,
          mapaArchivosCC(itemsConSnapshot),
        ),
        subirArchivosBriefDiseno(
          orden.productos,
          mapaArchivosBrief(itemsConSnapshot),
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
    proyectoCampanaId,
    fidelizacionCanjePuntos,
    canalVenta,
    validarCanalVenta,
    persistirSnapshotsItems,
    fechaEntregaOrden,
    publicarArtes,
    subirArchivosCentroCopiado,
    mapaArchivosCC,
    subirArchivosBriefDiseno,
    mapaArchivosBrief,
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
  const contextoCuponRef = React.useRef({ clienteId, items });
  contextoCuponRef.current = { clienteId, items };

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
            (conEspecial > 0 ? ` (${conEspecial} con precio especial)` : ""),
        );
      }
      if (fallidos > 0) {
        partes.push(
          `${fallidos} no se pudieron recotizar y conservan su precio`,
        );
      }
      if (omitidos > 0) {
        partes.push(`${omitidos} sin datos para recotizar`);
      }
      if (partes.length > 0) {
        (fallidos > 0 ? toast.warning : toast.success)(
          partes.join(" · ") + ".",
        );
      }
    },
    [cotizar, recotizarCotizacionItem],
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
    [clienteId, cotizar, recotizarCotizacionItem],
  );

  // Umbral de aprobación por descuento del tenant (F3): se busca una sola vez
  // y recién cuando se aplica un descuento; error de red = sin aviso (el gate
  // real vive en el backend al enviar el presupuesto).
  const umbralDescuentoRef = React.useRef<number | null | undefined>(undefined);
  const umbralDescuentoAprobacion = React.useCallback(async () => {
    if (umbralDescuentoRef.current === undefined) {
      try {
        umbralDescuentoRef.current = (
          await getConfigPresupuestos()
        ).aprobacionDescuentoMaxPct;
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

      let plan: Array<{
        item: PropuestaItem;
        descuento: DescuentoInput | null;
      }>;
      if (scope === "item") {
        const target = recotizables.find((item) => item.id === targetItemId);
        if (!target) {
          toast.error("No se pudo identificar el producto a descontar.");
          return;
        }
        plan = [{ item: target, descuento: descuentoInput }];
      } else if (!descuentoInput || descuentoInput.tipo === "PORCENTAJE") {
        plan = recotizables.map((item) => ({
          item,
          descuento: descuentoInput,
        }));
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
            descuento:
              share > 0 ? { tipo: "MONTO" as const, valor: share } : null,
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
            .map(
              (item) => item.cotizacion.desglosePrecio?.margenEfectivoPct ?? 0,
            );
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

  /** Materializa exactamente el plan por línea calculado por el backend. */
  const aplicarCupon = React.useCallback(
    async (resultado: ValidarCuponResultado) => {
      const { cupon } = resultado;
      const planPorItem = new Map(
        resultado.plan.map((linea) => [linea.key, linea]),
      );
      const objetivo = itemsRef.current.filter(
        (item) =>
          planPorItem.has(item.id) && item.jobContext && item.motorCodigo,
      );
      if (objetivo.length === 0) {
        setAvisoCupon({
          tipo: "error",
          titulo: "El cupón no aplica",
          detalle:
            "Ningún producto de la orden entra en el alcance de este cupón.",
        });
        return false;
      }
      const pisadas = objetivo.filter(
        (item) => item.descuentoInput && !item.descuentoInput.cuponId,
      ).length;

      const marca = { cuponId: cupon.id, cuponCodigo: cupon.codigo };
      const plan: Array<{ item: PropuestaItem; descuento: DescuentoInput }> =
        objetivo.map((item) => {
          const linea = planPorItem.get(item.id)!;
          return {
            item,
            descuento: { tipo: linea.tipo, valor: linea.valor, ...marca },
          };
        });

      setDescuentoAplicando(true);
      try {
        const actualizados = new Map<string, PropuestaItem>();
        try {
          for (const { item, descuento } of plan) {
            const updated = await recotizarItemConDescuento(item, descuento);
            if (!updated) {
              throw new Error(`No se pudo recotizar "${item.productoNombre}".`);
            }
            actualizados.set(item.id, updated);
          }
        } catch (cause) {
          const restauraciones = await Promise.allSettled(
            objetivo
              .filter((item) => actualizados.has(item.id))
              .reverse()
              .map((item) =>
                recotizarItemConDescuento(item, item.descuentoInput ?? null),
              ),
          );
          const rollbackFallido = restauraciones.some(
            (restauracion) => restauracion.status === "rejected",
          );
          setAvisoCupon({
            tipo: "error",
            titulo: "El cupón no se aplicó",
            detalle: rollbackFallido
              ? "Una recotización falló y no pudimos restaurar todas las líneas. Recargá la ficha antes de continuar."
              : cause instanceof Error
                ? `${cause.message} Se restauraron las líneas anteriores.`
                : "La recotización falló y se restauraron las líneas anteriores.",
          });
          return false;
        }
        setItems((current) =>
          current.map(
            (candidate) => actualizados.get(candidate.id) ?? candidate,
          ),
        );
        const descontado = [...actualizados.values()].reduce(
          (acc, item) => acc + descuentoMontoDeItem(item),
          0,
        );
        const alcance = `${actualizados.size} producto${actualizados.size === 1 ? "" : "s"}`;
        setAvisoCupon({
          tipo: "ok",
          titulo: "Cupón aplicado",
          detalle:
            `Descuento en ${alcance}. Se reserva al enviar el presupuesto o se redime al emitir la orden.` +
            (pisadas > 0
              ? ` Reemplazó el descuento manual en ${pisadas} producto${pisadas === 1 ? "" : "s"}.`
              : ""),
          monto:
            descontado > 0
              ? `−${formatCurrency(descontado, moneda)}`
              : undefined,
        });
        return true;
      } finally {
        setDescuentoAplicando(false);
      }
    },
    [recotizarItemConDescuento, moneda],
  );

  /** Código manual o del lector: valida y aplica el mismo plan del backend. */
  const aplicarCuponCodigo = React.useCallback(
    async (codigo: string): Promise<boolean> => {
      if (
        !conCupones ||
        cuponEnCurso.current ||
        descuentoAplicando ||
        modoOrden ||
        emitiendo ||
        emitiendoPresupuesto ||
        guardandoBorrador
      )
        return false;
      const contexto = contextoCuponRef.current;
      const recotizables = contexto.items.filter(
        (item) => item.jobContext && item.motorCodigo,
      );
      if (recotizables.length === 0) {
        setAvisoCupon({
          tipo: "aviso",
          titulo: "Agregá productos primero",
          detalle: "No hay productos con datos para aplicar un cupón.",
        });
        return false;
      }
      cuponEnCurso.current = true;
      setCuponValidando(true);
      try {
        const aplicado = await validarYAplicarCuponOrden({
          codigo,
          clienteId: contexto.clienteId,
          items: recotizables,
          contextoVigente: () =>
            contextoCuponRef.current.clienteId === contexto.clienteId &&
            contextoCuponRef.current.items === contexto.items,
          aplicar: aplicarCupon,
        });
        if (aplicado) setCuponAbierto(false);
        return aplicado;
      } catch (error) {
        setAvisoCupon({
          tipo: "error",
          titulo: "Cupón no válido",
          detalle:
            error instanceof Error
              ? error.message
              : "No se pudo validar el cupón.",
        });
        return false;
      } finally {
        cuponEnCurso.current = false;
        setCuponValidando(false);
      }
    },
    [
      aplicarCupon,
      conCupones,
      descuentoAplicando,
      modoOrden,
      emitiendo,
      emitiendoPresupuesto,
      guardandoBorrador,
    ],
  );

  // Escaneo global: el vendedor apunta el lector y listo. Se apaga en modo
  // lectura y con cualquier modal abierto (ahí el foco vive en un input y el
  // lector escribe donde corresponde). SIN productos sigue escuchando a
  // propósito: escanear con la orden vacía es lo más natural del mundo y
  // conviene explicarlo con un aviso, no quedarse mudo.
  useEscaneoCodigo({
    activo:
      conCupones &&
      !modoOrden &&
      descuentoTarget == null &&
      !cuponAbierto &&
      !cuponValidando &&
      !descuentoAplicando &&
      !addOpen &&
      !copiadoOpen &&
      !cargoOpen &&
      !panelEditor,
    onCodigo: (codigo) => {
      // Por el mismo lector entran tres cosas y este listener sólo quiere
      // cupones. Sin este filtro, escanear un DNI o el QR de una orden acá
      // los mandaba a validar como cupón y devolvía "no existe" — mientras
      // el watcher global, en paralelo, hacía lo correcto.
      if (esNumeroOrden(codigo) || parsearDniArgentino(codigo)) return false;
      void aplicarCuponCodigo(codigo);
      return true;
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
      if (!puedeModificarProductos || event.defaultPrevented || event.repeat)
        return;
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
    puedeModificarProductos,
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

  async function aplicarTipoCambio(cambio: TipoCambioSnapshot) {
    if (!puedeModificarProductos)
      throw new Error("Activá la edición para cambiar el tipo de cambio.");
    const anteriores = itemsRef.current;
    const nuevos: PropuestaItem[] = [];
    // Staging completo: si falla una línea, no se modifica ninguna.
    for (const item of anteriores) {
      if (!item.jobContext || !item.motorCodigo)
        throw new Error(
          `Volvé a configurar "${item.productoNombre}" antes de actualizar el cambio.`,
        );
      const meta = metaCentroCopiado(item.jobContext);
      let resultado: CotizacionPropuestaSnapshot | undefined;
      if (meta?.esTomo) {
        const construido = await construirItemsCentroCopiado({
          tipoCambioId: cambio.id,
          clienteId: clienteId || undefined,
          documentos: (meta.segmentos ?? []).map((segmento, indice) => ({
            ...segmento,
            id: `s${indice}`,
            nombre: segmento.nombre ?? undefined,
            copias: 1,
            tamanoAnchoMm:
              segmento.tamanoAnchoMm ?? dimsDeFormato(segmento.tamano).anchoMm,
            tamanoAltoMm:
              segmento.tamanoAltoMm ?? dimsDeFormato(segmento.tamano).altoMm,
            grupoId: "T",
          })),
          grupos: [
            {
              id: "T",
              juegos: meta.juegos ?? 1,
              nombre: meta.tomoNombre ?? undefined,
              terminaciones: meta.terminaciones ?? [],
              tipoAnillo: meta.tipoAnillo ?? undefined,
            },
          ],
        });
        resultado = construido.items[0]?.cotizacion ?? undefined;
      } else {
        const respuesta = await cotizar({
          tipoCambioId: cambio.id,
          productoId: item.motorCodigo,
          rutaAlternativaId: item.rutaAlternativaId ?? null,
          jobContext: { ...item.jobContext, tipoCambioId: cambio.id } as never,
          clienteId: clienteId || null,
          periodo: getCurrentPeriodo(),
          descuento: descuentoParaMotor(item.descuentoInput),
        });
        if (!respuesta.exitoso)
          throw new Error(
            respuesta.errores?.[0]?.mensaje ||
              `No se pudo cotizar ${item.productoNombre}.`,
          );
        resultado = respuesta.cotizacion;
      }
      if (!resultado)
        throw new Error(`No se pudo actualizar ${item.productoNombre}.`);
      nuevos.push({
        ...applyCotizacionToItem(item, resultado, {
          ...item.jobContext,
          tipoCambioId: cambio.id,
        }),
        cotizacionItemId: undefined,
      });
    }
    if (itemsRef.current !== anteriores)
      throw new Error(
        "Los productos cambiaron durante el cálculo. Volvé a aplicar el tipo de cambio.",
      );
    setItems(nuevos);
    setEditadosIds(new Set(nuevos.map((item) => item.id)));
  }

  return (
    <DesignSystemProvider appearance="light" theme="brand">
      <section
        data-ui="heroui"
        data-appearance="light"
        className={cn(
          designTheme.theme,
          "flex min-h-0 min-w-0 flex-1 flex-col bg-background",
          workspaceStyles.page,
          orden && issued.page,
        )}
      >
        {initialLoadErrors.length > 0 ? (
          <div className="orden-load-warning" role="alert">
            No se pudieron cargar: {initialLoadErrors.join(", ")}. Reintentá
            recargando antes de emitir para no trabajar con un catálogo
            incompleto.
          </div>
        ) : null}
        <HeroTabs
          selectedKey={tab}
          onSelectionChange={(key) => setTab(String(key) as OrdenTab)}
          className={workspaceStyles.tabs}
        >
          <OrdenWorkspace
            activeSection={tab}
            onShowData={() => setTab("datos")}
            navigation={
              <OrdenTabs
                clientePendiente={!clienteId}
                verMargenes={verMargenes}
                count={items.length}
                historialCount={orden ? orden.eventosTotal : undefined}
                comprobantesCount={orden ? 0 : undefined}
                mostrarMateriales={Boolean(orden) && puedeVerMateriales}
                archivosCount={archivosCount}
                archivosPendientesCount={
                  initialDocumentos?.gates.filter((gate) => !gate.cumplido).length
                }
              />
            }
            summary={
              <OrdenSummaryDetails
                cliente={
                  orden?.clienteNombre ??
                  selectorClientes.options.find((c) => c.id === clienteId)
                    ?.nombre
                }
                campana={
                  campanasCliente.find((c) => c.id === proyectoCampanaId)
                    ?.nombre ??
                  (proyectoCampanaId &&
                  orden?.proyectoCampana?.id === proyectoCampanaId
                    ? orden.proyectoCampana.nombre
                    : undefined)
                }
                fecha={formatFechaOrden(
                  fechaFinalVisible || orden?.fechaEntrega || null,
                )}
                vendedor={
                  orden
                    ? vendedorOrdenNombre(orden)
                    : (currentUser?.nombreCompleto ??
                      currentUser?.email ??
                      "Usuario actual")
                }
                onShowData={puedeEditarOrden ? () => setTab("datos") : undefined}
              >
                <TipoCambioPanel
                  editable={puedeModificarProductos}
                  onAplicar={aplicarTipoCambio}
                />
                <OrdenFinancialActions
                  empty={items.length === 0}
                  emitiendo={emitiendo || emitiendoPresupuesto}
                  guardandoBorrador={guardandoBorrador}
                  sinComprobante={sinComprobante}
                  onAgregarCargo={
                    !modoOrden ? () => setCargoOpen(true) : undefined
                  }
                  onDescuentoOrden={
                    modoOrden
                      ? undefined
                      : () =>
                          setDescuentoTarget({ scope: "orden", itemId: null })
                  }
                  onCuponOrden={
                    modoOrden || !conCupones
                      ? undefined
                      : () => setCuponAbierto((value) => !value)
                  }
                  cuponAbierto={cuponAbierto}
                  cuponFieldId="orden-cupon"
                  operacionPendiente={cuponValidando || descuentoAplicando}
                  onToggleTratamientoFiscal={
                    puedeToggleFiscal ? toggleTratamientoFiscal : undefined
                  }
                  togglingFiscal={togglingFiscal}
                />
                {conCupones && cuponAbierto && !modoOrden && (
                  <OrdenCuponField
                    id="orden-cupon"
                    isDisabled={
                      !items.length ||
                      emitiendo ||
                      emitiendoPresupuesto ||
                      guardandoBorrador ||
                      descuentoAplicando
                    }
                    onValidar={aplicarCuponCodigo}
                  />
                )}
                <ResumenBar
                  layout="sidebar"
                  items={items}
                  cargosOrden={cargosOrden}
                  sinComprobante={sinComprobante}
                  fidelizacionCanjeMonto={fidelizacionCanjeMonto}
                  readOnly={modoOrden}
                  resumenPersistido={
                    orden
                      ? {
                          subtotal: orden.subtotal,
                          impuestos: orden.impuestos,
                          descuentoTotal: orden.descuentoTotal,
                          total: orden.total,
                        }
                      : undefined
                  }
                />
              </OrdenSummaryDetails>
            }
            ref={datosOrdenRef}
            header={
              <div className={workspaceStyles.heading}>
                <div className={workspaceStyles.identity}>
                  <nav
                    aria-label="Ruta de navegación"
                    className={workspaceStyles.breadcrumb}
                  >
                    <span>Comercial</span>
                    <ChevronRightIcon />
                    <Link href="/produccion/ordenes">Órdenes de trabajo</Link>
                    <ChevronRightIcon />
                    <span aria-current="page">
                      {orden?.numero ?? "Nueva orden"}
                    </span>
                  </nav>
                  {orden ? (
                    <h1 className={workspaceStyles.title}>
                      <span className={workspaceStyles.titleText}>
                        {orden.numero}
                      </span>
                      <EstadoOtBadge estado={orden.estado} />
                      {sinComprobante ? <ChipSinComprobante /> : null}
                      {mostrarRecienEmitida ? (
                        <Chip size="sm" color="success" variant="soft">
                          Recién emitida
                        </Chip>
                      ) : null}
                    </h1>
                  ) : (
                    <h1 className={workspaceStyles.title}>
                      <span className={workspaceStyles.titleText}>
                        Nueva{" "}
                        {ordenTipo === "orden"
                          ? "orden de trabajo"
                          : "propuesta"}
                      </span>
                      {sinComprobante ? <ChipSinComprobante /> : null}
                    </h1>
                  )}
                  {orden && (
                    <p className={issued.orderContext}>
                      {orden.clienteNombre || "Sin cliente"}
                      <span aria-hidden="true">/</span>
                      {items.length} {items.length === 1 ? "producto" : "productos"}
                    </p>
                  )}
                  {!orden && (
                    <p className={workspaceStyles.description}>
                      {ordenTipo === "orden"
                        ? "Creá una orden de trabajo, agregá productos y definí todos los detalles."
                        : "Armá la propuesta para enviar al cliente antes de confirmar la OT."}
                    </p>
                  )}
                </div>
                <div className={workspaceStyles.identity}>
                  {!modoOrden ? (
                    <OrdenSaveActions
                      operacionPendiente={cuponValidando || descuentoAplicando}
                      tipo={ordenTipo}
                      clienteSeleccionado={Boolean(clienteId)}
                      empty={items.length === 0}
                      onEmitir={() => impresionDirecta && documentosCentroCopiado ? setConfirmarEmisionDocumentos("nueva") : void emitirOrden()}
                      onEmitirPresupuesto={emitirPresupuestoCb}
                      emitiendo={emitiendo || emitiendoPresupuesto}
                      guardandoBorrador={guardandoBorrador}
                      onGuardarBorrador={() =>
                        cobrosStaged.length > 0
                          ? setConfirmBorradorConCobros(true)
                          : void guardarBorrador()
                      }
                    />
                  ) : orden && orden.estado !== "cancelada" ? (
                    // Acciones de la orden en la cabecera fija; facturación en Comprobantes.
                    <div className={workspaceStyles.quickActions}>
                      {editandoOrden ? (
                        <>
                          <HeroButton
                            type="button"
                            variant="tertiary"
                            size="sm"
                            onPress={cancelarEdicion}
                            isDisabled={guardandoEdicion || togglingFiscal || cancelando || emitiendoBorrador}
                          >
                            Cancelar
                          </HeroButton>
                          <HeroButton
                            type="button"
                            variant="primary"
                            size="sm"
                            onPress={() => void guardarEdicion()}
                            isDisabled={guardandoEdicion || togglingFiscal || cancelando || emitiendoBorrador}
                          >
                            <CheckIcon />
                            {guardandoEdicion
                              ? "Guardando…"
                              : cambiosSinGuardar > 0
                                ? `Guardar cambios (${cambiosSinGuardar})`
                                : "Finalizar edición"}
                          </HeroButton>
                        </>
                      ) : (
                        <HeroButton
                          type="button"
                          variant="primary"
                          size="sm"
                          onPress={() => setEditandoOrden(true)}
                        >
                          <Edit3Icon />
                          Editar orden
                        </HeroButton>
                      )}
                      {puedeEditarOrden && esCancelable(orden.estado) ? (
                        <HeroButton
                          type="button"
                          variant="tertiary"
                          size="sm"
                          onPress={() => setConfirmCancelar(true)}
                          isDisabled={cancelando || cambiosSinGuardar > 0 || (facturaViva && !puedeAnular)}
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
                        </HeroButton>
                      ) : null}
                      {puedeEditarOrden && orden.estado === "borrador" ? (
                        <HeroButton
                          type="button"
                          variant="primary"
                          size="sm"
                          onPress={() => impresionDirecta && documentosCentroCopiado ? setConfirmarEmisionDocumentos("borrador") : void emitirBorrador()}
                          isDisabled={
                            emitiendoBorrador ||
                            cambiosSinGuardar > 0 ||
                            !orden.clienteId
                          }
                          title={
                            !orden.clienteId
                              ? "Asigná un cliente y guardá el borrador para emitir"
                              : undefined
                          }
                        >
                          <CheckIcon />
                          {emitiendoBorrador ? "Emitiendo…" : "Emitir OT"}
                        </HeroButton>
                      ) : null}
                      {puedeEditarOrden && orden.estado === "finalizada" && puedeEntregar ? (
                        <Button
                          size="lg"
                          onClick={() => setEntregaManualOpen(true)}
                          title="Registrar la entrega al cliente"
                        >
                          <PackageCheckIcon data-icon="inline-start" />
                          Entregar
                        </Button>
                      ) : null}
                      {impresionDirecta && orden && items.some(item => metaCentroCopiado(item.jobContext)) && !["borrador", "cancelada"].includes(orden.estado) && (
                        <HeroButton variant="tertiary" onPress={() => impresionDocumentos.abrir(orden.id)}>
                          <PrinterIcon />
                          Impresión de documentos
                        </HeroButton>
                      )}
                      {puedeImprimirEtiqueta && orden && !["borrador", "cancelada"].includes(orden.estado) && (
                        <HeroButton variant="tertiary" onPress={() => setEtiquetaOpen(true)}>
                          <PrinterIcon />
                          {impresionDirecta ? "Imprimir etiqueta" : "Descargar etiqueta"}
                        </HeroButton>
                      )}
                      {publicToken ? (
                        <HeroButton
                          type="button"
                          variant="tertiary"
                          size="sm"
                          onPress={compartirSeguimiento}
                          title="Copiar el link público de seguimiento para el cliente"
                        >
                          {trackCopiado ? <CheckIcon /> : <ExternalLinkIcon />}
                          {trackCopiado ? "Copiado" : "Seguimiento"}
                        </HeroButton>
                      ) : null}
                      <HeroButton
                        type="button"
                        variant="tertiary"
                        size="sm"
                        onPress={() => setQrRetiroOpen(true)}
                        title="QR que el cliente presenta para retirar el trabajo"
                      >
                        <QrCodeIcon />
                        QR
                      </HeroButton>
                    </div>
                  ) : null}
                </div>
              </div>
            }
            sidebar={
              <>
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
                    <div className="prf-cancelada-m">
                      “{orden.cancelacion.motivo}”
                    </div>
                    <div className="prf-cancelada-f">
                      {orden.cancelacion.por
                        ? `${orden.cancelacion.por} · `
                        : ""}
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
                  <div className={workspaceStyles.progress}>
                    <StepperOt
                      estado={orden.estado}
                      fechasEstado={orden.fechasEstado}
                      orientation="horizontal"
                    />
                  </div>
                ) : null}

                <OrdenDatosSections
                  tipo={
                    !modoOrden ? (
                      <OrdenSegmented
                        value={ordenTipo}
                        onChange={(value) => setTipo(fromOrdenTipo(value))}
                      />
                    ) : (
                      <span className="text-sm font-medium">
                        Orden de trabajo
                      </span>
                    )
                  }
                  vendedor={
                    <FieldCard label="Vendedor" icon={<UserIcon />}>
                      <div className="flex items-center gap-2 text-sm">
                        {orden ? (
                          <>
                            <IdentityAvatar name={vendedorOrdenNombre(orden)} />
                            <span>{vendedorOrdenNombre(orden)}</span>
                          </>
                        ) : (
                          <>
                            <IdentityAvatar
                              name={
                                currentUser?.nombreCompleto ??
                                currentUser?.email ??
                                "Usuario actual"
                              }
                            />
                            <span>
                              {currentUser?.nombreCompleto ??
                                currentUser?.email ??
                                "Usuario actual"}
                            </span>
                          </>
                        )}
                      </div>
                    </FieldCard>
                  }
                  cliente={
                    <FieldCard label="Cliente" icon={<UserIcon />}>
                      {campoEditable("clienteId") ? (
                        <ClienteLista
                          value={clienteId}
                          onChange={setClienteId}
                          {...selectorClientes}
                        />
                      ) : (
                        <div className="text-sm text-foreground">
                          <span>{orden?.clienteNombre}</span>
                        </div>
                      )}
                    </FieldCard>
                  }
                  campana={conProyectos ? (
                    <FieldCard
                      label="Campaña"
                      icon={<FolderIcon />}
                      hint={
                        !orden && !clienteId
                          ? "Elegí primero un cliente"
                          : undefined
                      }
                    >
                      {!orden ? (
                        <CampanaSelectorOrden
                          value={proyectoCampanaId}
                          onChange={setProyectoCampanaId}
                          options={campanasCliente}
                          isDisabled={!clienteId}
                        />
                      ) : orden.proyectoCampana ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Link
                                className="flex min-h-9 w-full items-center justify-between gap-2 rounded-field border border-border bg-surface px-3 py-2 text-sm text-foreground hover:bg-default aria-disabled:opacity-60 [&_svg]:size-4"
                                data-active="true"
                                href={`/comercial/campanas/${orden.proyectoCampana.id}`}
                                aria-label={`Abrir campaña ${orden.proyectoCampana.nombre}`}
                              />
                            }
                          >
                            <span>{orden.proyectoCampana.nombre}</span>
                            <ExternalLinkIcon aria-hidden="true" />
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {orden.proyectoCampana.codigo} ·{" "}
                            {orden.proyectoCampana.nombre}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span
                                className="flex min-h-9 w-full items-center justify-between gap-2 rounded-field border border-border bg-surface px-3 py-2 text-sm text-foreground hover:bg-default aria-disabled:opacity-60 [&_svg]:size-4"
                                aria-label="Sin campaña"
                                aria-disabled="true"
                              />
                            }
                          >
                            <span>Sin campaña</span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Sin campaña
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </FieldCard>
                  ) : undefined}
                  canalVenta={
                    campoEditable("canalVenta") ? (
                      <CanalVentaSelector
                        id={canalSelectorId}
                        value={canalVenta}
                        invalid={errorCanalVenta}
                        onChange={(value) => {
                          setCanalVenta(value);
                          setErrorCanalVenta(false);
                        }}
                      />
                    ) : (
                      <FieldCard label="Canal de venta" icon={<PackageIcon />}>
                        <div className="text-sm text-foreground">
                          <span>{nombreCanalVenta(canalVenta)}</span>
                        </div>
                      </FieldCard>
                    )
                  }
                  entrega={
                    <>
                      <FieldCard
                        label="Entrega prevista"
                        icon={<CalendarIcon />}
                      >
                        {campoEditable("fechaEntrega") ? (
                          <div className="text-sm text-foreground">
                            <HeroInput
                              className="w-full"
                              ref={fechaEstimadaInputRef}
                              type="date"
                              value={fechaFinalVisible}
                              readOnly={
                                ordenTipo === "orden" && items.length > 0
                              }
                              onClick={() => {
                                if (ordenTipo !== "orden" || !items.length)
                                  fechaEstimadaInputRef.current?.showPicker?.();
                              }}
                              onChange={(event) => {
                                otFechaTocadaRef.current = true;
                                setFechaEstimada(event.target.value);
                              }}
                              aria-label="Entrega prevista"
                            />
                          </div>
                        ) : (
                          <div className="text-sm text-foreground">
                            <span>
                              {formatFechaOrden(orden?.fechaEntrega ?? null)}
                            </span>
                          </div>
                        )}
                      </FieldCard>
                      {(() => {
                        if (!conEta) return null;
                        const porProducto = items.some((i) =>
                          !orden
                            ? !!entregasPrevias.fechaPara(i)
                            : !!fechaFinalDistribucion(i.distribucionEntregas),
                        );
                        const eta = porProducto
                          ? null
                          : describirEta(demoraOrden, fechaFinalVisible, {
                              margenDias: margenEtaDias,
                              noLaborables: colasTaller?.noLaborables,
                              zona: colasTaller?.zona ?? zonaHoraria,
                              ahora: colasTaller?.ahora,
                            });
                        return (
                          <>
                            <FieldCard
                              label="Producción estimada"
                              icon={<FactoryIcon />}
                            >
                              <div className={fechasStyles.valorConsulta}>
                                {eta?.fechaProduccion ? (
                                  <time dateTime={eta?.fechaProduccion}>
                                    {formatFechaOrden(eta?.fechaProduccion)}
                                  </time>
                                ) : porProducto ? (
                                  "Según cada producto"
                                ) : (
                                  "Sin estimación completa"
                                )}
                              </div>
                            </FieldCard>
                            <FieldCard
                              label="Entrega sugerida"
                              icon={<PackageCheckIcon />}
                            >
                              <div className={fechasStyles.valorConsulta}>
                                {eta?.fechaSugerida ? (
                                  <time dateTime={eta?.fechaSugerida}>
                                    {formatFechaOrden(eta?.fechaSugerida)}
                                  </time>
                                ) : porProducto ? (
                                  "Según cada producto"
                                ) : (
                                  "Sin estimación completa"
                                )}
                              </div>
                            </FieldCard>
                            <FieldCard
                              label="Margen de producción"
                              icon={<ClockIcon />}
                            >
                              <div className={fechasStyles.valorConsulta}>
                                {margenEtaDias}{" "}
                                {margenEtaDias === 1
                                  ? "día hábil"
                                  : "días hábiles"}
                              </div>
                            </FieldCard>
                            {eta && (eta.motivo || eta.nivel !== "ok") ? (
                              <div
                                className={cn(
                                  fechasStyles.notas,
                                  workspaceStyles.deliveryNotes,
                                )}
                              >
                                {eta.motivo ? (
                                  <p className={fechasStyles.condicion}>
                                    Proyección condicionada. {eta.motivo}
                                  </p>
                                ) : null}
                                {eta.nivel !== "ok" ? (
                                  <p className={fechasStyles.alerta}>
                                    {eta.nivel === "tarde"
                                      ? "La producción terminaría después de la fecha elegida."
                                      : "La fecha elegida queda sin el margen del taller."}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                          </>
                        );
                      })()}
                    </>
                  }
                />

                {orden ? (
                  <div className={workspaceStyles.sidebarFooter}>
                    <div className={workspaceStyles.meta}>
                      <span>{orden.fechaEmision ? "Emitida" : "Creada"}</span>
                      <span className={workspaceStyles.metaValue}>
                        {formatFechaOrden(orden.fechaEmision ?? orden.creadaEl)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </>
            }
          >
            {conPrevisionMateriales && items.length > 0 && (
              <PrevisionMaterialesPanel
                data={previsionMateriales.data}
                error={previsionMateriales.error}
                loading={previsionMateriales.loading}
                onRefresh={previsionMateriales.actualizar}
                entregasDistribuidas={items.some(
                  (item) => !!entregasPrevias.fechaPara(item) || !!fechaFinalDistribucion(item.distribucionEntregas),
                )}
              />
            )}
            {orden && <OrdenSectionHeading section={tab} />}
            {tab === "productos" ? (
              <OrdenProductosTable
                catalogo={initialProductos}
                items={items}
                sinComprobante={sinComprobante}
                expandedIds={openIds}
                onToggle={toggle}
                recotizandoIds={recotizandoIds}
                onAdd={
                  puedeModificarProductos
                    ? () => abrirAgregarProducto()
                    : undefined
                }
                onPrint={
                  puedeModificarProductos
                    ? ccActivo
                      ? abrirCentroCopiado
                      : undefined
                    : undefined
                }
                getTomo={(item) => ({
                  id: tomoDeItem(item),
                  nombre: tomoNombreDeItem(item),
                })}
                rowRef={(id, node) => {
                  if (node) rowRefs.current.set(id, node);
                  else rowRefs.current.delete(id);
                }}
                getActions={(item) => ({
                  onRemove: modoOrden
                    ? itemsEnEdicion
                      ? () => quitarItemDeOrden(item)
                      : undefined
                    : () =>
                        setItems((current) =>
                          current.filter(
                            (candidate) => candidate.id !== item.id,
                          ),
                        ),
                  onVerPrecios: esCentroCopiado(item)
                    ? () => setPreciosOpen(true)
                    : undefined,
                })}
                renderDetail={(item) => (
                  <OrdenProductoDetalle
                    item={item}
                    sinComprobante={sinComprobante}
                    expanded={openIds.has(item.id)}
                    etaSistema={demoraPorItem?.get(item.id) ?? null}
                    ahoraEta={colasTaller?.ahora}
                    margenEtaDias={margenEtaDias}
                    noLaborables={colasTaller?.noLaborables}
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
                    onEditPanels={(targetItem, paso) => {
                      setPanelEditor({ item: targetItem, paso });
                    }}
                    onChangeFechaEntrega={(fechaEntrega) => {
                      itemFechaTocadaRef.current.add(item.id);
                      if (itemsEnEdicion && persistedItemIds.has(item.id))
                        setEditadosIds((prev) => new Set([...prev, item.id]));
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
                    editarFecha={itemsEnEdicion}
                    prepararCorte={modoOrden && puedeEditarOrden && persistedItemIds.has(item.id)}
                    onDistribucionGuardada={
                      orden ? () => {
                        void getOrdenTrabajo(orden.id).then((actualizada) => {
                          setOrden(actualizada);
                          setItems(actualizada.productos.map(rehidratarOrdenItem));
                          setFechaEstimada(actualizada.fechaEntrega ?? "");
                        }).catch(() => router.refresh());
                      } : undefined
                    }
                    planificarEntregas={
                      !!orden &&
                      puedeEditarOrden && cambiosSinGuardar === 0 &&
                      (orden.estado === "borrador" ||
                        orden.estado === "pendiente") &&
                      persistedItemIds.has(item.id)
                    }
                    entregasPrevias={
                      !orden &&
                      ordenTipo === "orden" &&
                      item.motorCodigo &&
                      item.jobContext &&
                      item.unidadMedida === "unidad" &&
                      !esCentroCopiado(item)
                        ? entregasPrevias.propsPara(item)
                        : undefined
                    }
                  />
                )}
              />
            ) : null}

            {tab === "productos" && (
              <OrdenCargosList
                cargos={cargosOrden}
                isDisabled={cuponValidando || descuentoAplicando}
                onRemove={
                  modoOrden
                    ? undefined
                    : (id) =>
                        setCargosOrden((current) =>
                          current.filter((cargo) => cargo.id !== id),
                        )
                }
              />
            )}

            {tab === "produccion" ? (
              orden ? (
                <ProduccionOrdenTab
                  ordenId={orden.id}
                  onOrdenActualizada={recargarOrden}
                  soloLectura={!puedeEditarOrden}
                />
              ) : (
                <EmptyTab
                  title="Programación de producción"
                  description="Una vez confirmada la OT vas a poder ver pasos, maquinas asignadas y tiempos estimados aca."
                />
              )
            ) : null}
            {tab === "materiales" && orden && puedeVerMateriales ? (
              <MaterialesOrdenTab ordenId={orden.id} versionOrden={orden} />
            ) : null}
            {tab === "pagos" ? (
              orden ? (
                <div className="otd-page" style={{ padding: 0 }}>
                  <PagosTab
                    pago={orden.pago}
                    total={orden.total}
                    ordenId={orden.id}
                    puedeCobrar={orden.estado !== "borrador"}
                    soloLectura={!puedeEditarOrden}
                    sinComprobante={
                      orden.tratamientoFiscal === "SIN_COMPROBANTE"
                    }
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
                  soloLectura={!puedeEditarOrden}
                  recargarToken={0}
                />
              </div>
            ) : null}
            {tab === "archivos" ? (
              orden ? (
                <ArchivosOrdenTab
                  ordenId={orden.id}
                  estadoDocumental={initialDocumentos}
                  soloLectura={!puedeEditarOrden}
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
              <section className={issued.history} aria-label="Actividad de la orden">
                <header className={issued.historyHeader}>
                  <span>Registro de actividad</span>
                  <span className={issued.counter}>{orden.eventosTotal} eventos</span>
                </header>
                {orden.eventos.length === 0 ? (
                  <p className={issued.empty}>Sin eventos registrados.</p>
                ) : (
                  <>
                    {orden.eventosTotal > orden.eventos.length && (
                      <p className={issued.empty}>
                        Se muestran los 200 eventos más recientes de {orden.eventosTotal}.
                      </p>
                    )}
                    <ol className={issued.timeline}>
                      {orden.eventos.map((ev, i) => {
                        const { Icono } = EVENTO_ICONOS[ev.tipo] ?? EVENTO_ICONOS.nota;
                        return (
                          <li key={i} className={issued.event}>
                            <span className={issued.eventIcon} aria-hidden="true"><Icono /></span>
                            <div>
                              <p>{ev.descripcion}</p>
                              <div className={issued.eventMeta}>
                                <time dateTime={ev.fecha}>{formatEventoFecha(ev.fecha)}</time>
                                <span>{ev.usuarioNombre}</span>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </>
                )}
              </section>
            ) : null}

            {tab === "productos" ? (
              <div className="flex shrink-0 flex-col gap-4">
                {modoOrden &&
                orden &&
                (orden.fidelizacion.canjePuntos > 0 ||
                  orden.fidelizacion.puntosEstimados > 0) ? (
                  <div className="rounded-xl border bg-card p-4 text-sm">
                    <div className="font-semibold">Fidelización</div>
                    <div className="mt-1 text-muted-foreground">
                      {orden.fidelizacion.canjePuntos > 0
                        ? `${orden.fidelizacion.canjePuntos} puntos · −${formatCurrency(orden.fidelizacion.canjeMonto, moneda)}`
                        : `Esta orden suma ${orden.fidelizacion.puntosEstimados} puntos cuando esté entregada y pagada con fondos acreditados.`}
                    </div>
                  </div>
                ) : null}
                {!modoOrden && conFidelizacion ? (
                  <FidelizacionCotizador
                    clienteId={clienteId}
                    margen={costosFidelizacion.margenMonto}
                    total={totalPropuestaAntesCanje}
                    moneda={moneda}
                    value={fidelizacionCanjePuntos}
                    onChange={setFidelizacionCanjePuntos}
                    onSimulation={actualizarSimulacionFidelizacion}
                  />
                ) : null}
                {modoOrden &&
                editandoOrden &&
                polyfanPendientesDeGuardar.length > 0 ? (
                  <div
                    role="status"
                    className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950"
                  >
                    <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-emerald-200 bg-white text-emerald-700">
                      <SaveIcon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold">
                        Preparación de corte pendiente de guardar
                      </div>
                      <div className="mt-0.5 text-xs leading-relaxed text-emerald-800">
                        Al guardar la orden se prepararán automáticamente los
                        recorridos y archivos TAP de{" "}
                        {polyfanPendientesDeGuardar.length === 1
                          ? `“${polyfanPendientesDeGuardar[0].productoNombre}”`
                          : `${polyfanPendientesDeGuardar.length} productos de Polyfan`}
                        . Luego quedarán disponibles en Producción.
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </OrdenWorkspace>
        </HeroTabs>

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
          emitirLabel="Revisar y emitir"
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
          open={puedeEditarOrden && confirmCancelar}
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
          open={addOpen && puedeModificarProductos}
          onOpenChange={(open) => {
            if (open && !permisoProductosRef.current) return;
            setAddOpen(open);
            if (!open) setEditingItem(null);
          }}
          productos={initialProductos}
          clienteId={clienteId || null}
          fechaEntregaDefault={fechaEstimada}
          editingItem={editingItem}
          onAddItem={(item) => {
            if (!permisoProductosRef.current) return false;
            // En modo orden es staging: la fila queda local y el POST real va
            // recién en "Guardar cambios".
            setItems((current) => [...current, item]);
            // Se agrega COLAPSADO: la fila aparece cerrada (igual que el centro
            // de copiado) y el comercial la expande si la necesita. Antes se
            // abría sola y ocupaba media pantalla en cada alta.
            setAddOpen(false);
            setEditingItem(null);
            focusOrdenProductoDetalle(item.id);
          }}
          onSaveItem={(item) => {
            if (!permisoProductosRef.current) return false;
            // El sheet recotiza SIN descuento: si la línea tenía uno, se reaplica
            // sobre la nueva config (recotización) para no perderlo.
            const descuentoPrevio =
              items.find((candidate) => candidate.id === item.id)
                ?.descuentoInput ?? null;
            if (descuentoPrevio) {
              void recotizarItemConDescuento(item, descuentoPrevio)
                .then((actualizado) => {
                  if (!permisoProductosRef.current) return;
                  setItems((current) =>
                    current.map((candidate) =>
                      candidate.id === item.id
                        ? (actualizado ?? {
                            ...item,
                            descuentoInput: descuentoPrevio,
                          })
                        : candidate,
                    ),
                  );
                })
                .catch(() => {
                  if (!permisoProductosRef.current) return;
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
            focusOrdenProductoDetalle(item.id);
          }}
        />
        <CentroCopiadoSheet
          open={copiadoOpen && puedeModificarProductos}
          clienteId={clienteId || null}
          editItems={copiadoEditItems}
          onOpenChange={(open) => {
            if (open && !permisoProductosRef.current) return;
            setCopiadoOpen(open);
            if (!open) setCopiadoEditItems(null);
          }}
          onAgregar={(nuevos) => {
            if (!permisoProductosRef.current) return false;
            if (nuevos.length === 0) return;
            // En edición se reemplaza la CARGA completa (todos sus renglones).
            const cargaEditada = copiadoEditItems?.length
              ? cargaDeItem(copiadoEditItems[0])
              : null;
            const nuevosConHerencia = cargaEditada
              ? nuevos.map((nuevo, indice) => ({
                  ...nuevo,
                  archivosOrigenItemIds: copiadoEditItems!
                    .filter(
                      (_, origenIndice) =>
                        Math.min(origenIndice, nuevos.length - 1) === indice,
                    )
                    .map((origen) => origen.id)
                    .filter((id) => persistedItemIds.has(id)),
                }))
              : nuevos;
            setItems((current) => {
              const base = cargaEditada
                ? current.filter((i) => cargaDeItem(i) !== cargaEditada)
                : current;
              return [...base, ...nuevosConHerencia];
            });
            // Se agregan COLAPSADOS (son varios renglones; expandir todos ocupa
            // demasiado). Se los diferencia por la referencia (varianteNombre).
            setCopiadoOpen(false);
            setCopiadoEditItems(null);
            focusOrdenProductoDetalle(nuevosConHerencia[0].id);
          }}
        />
        <CentroCopiadoPreciosSheet
          open={preciosOpen}
          onClose={() => setPreciosOpen(false)}
          items={items}
          moneda={moneda}
        />
        <CargoOrdenDialog
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
        <DescuentoOrdenDialog
          target={descuentoTarget}
          items={items.filter((item) => item.jobContext && item.motorCodigo)}
          aplicando={descuentoAplicando}
          onClose={() => setDescuentoTarget(null)}
          onApply={(scope, targetItemId, descuento) =>
            void aplicarDescuento(scope, targetItemId, descuento)
          }
        />

        {/* Va fuera del modal de descuento a propósito: el aviso sobrevive a
          que ese modal se cierre al aplicar. */}
        <CuponAvisoModal
          aviso={avisoCupon}
          onCerrar={() => setAvisoCupon(null)}
        />

        {impresionDirecta && confirmarEmisionDocumentos && (
          <EmisionDocumentosDialog
            items={items}
            onClose={() => setConfirmarEmisionDocumentos(null)}
            onEmitir={(imprimir) => {
              const modo = confirmarEmisionDocumentos;
              setConfirmarEmisionDocumentos(null);
              if (modo === "borrador") void emitirBorrador(imprimir);
              else void emitirOrden(imprimir);
            }}
          />
        )}
        {etiquetaOpen && orden && (
          <EtiquetaOrdenDialog ordenId={orden.id} onClose={() => setEtiquetaOpen(false)} />
        )}
        {qrRetiroOpen && orden ? (
          <QrRetiroModal
            numero={orden.numero}
            cliente={orden.clienteNombre}
            onClose={() => setQrRetiroOpen(false)}
          />
        ) : null}
        {puedeEditarOrden && entregaManualOpen && orden ? (
          <EntregaModal
            codigo={orden.numero}
            onClose={() => setEntregaManualOpen(false)}
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
    </DesignSystemProvider>
  );
}
