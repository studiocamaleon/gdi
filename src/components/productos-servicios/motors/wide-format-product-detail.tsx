"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  PrinterIcon,
  SaveIcon,
  Settings2Icon,
  Trash2Icon,
  TrophyIcon,
} from "lucide-react";
import { toast } from "sonner";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import type { DigitalProductDetailProps } from "@/components/productos-servicios/motors/digital-product-detail";
import {
  ProductoServicioChecklistCotizador,
  ProductoServicioChecklistEditor,
} from "@/components/productos-servicios/producto-servicio-checklist";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getVarianteOptionChips } from "@/lib/materias-primas-variantes-display";
import type { MateriaPrimaVariante } from "@/lib/materias-primas";
import {
  getMaquinaGeometriasCompatibles,
  getMaquinaTecnologia,
  tecnologiaMaquinaItems,
  type Maquina,
} from "@/lib/maquinaria";
import {
  assignProductoMotor,
  getCotizacionesProductoServicio,
  getGranFormatoConfig,
  getGranFormatoChecklist,
  previewGranFormatoCostos,
  getGranFormatoRutaBase,
  updateGranFormatoConfig,
  updateGranFormatoChecklist,
  updateGranFormatoRutaBase,
  updateProductoImpuesto,
  updateProductoPrecio,
  updateProductoPrecioEspecialClientes,
  updateProductoServicio,
} from "@/lib/productos-servicios-api";
import { simularPrecioComercial } from "@/lib/productos-servicios-simulacion";
import {
  type CotizacionProductoSnapshotResumen,
  type GranFormatoImposicionConfig,
  type GranFormatoImposicionCriterioOptimizacion,
  type GranFormatoPanelManualLayout,
  type GranFormatoPanelManualLayoutItem,
  type GranFormatoPanelManualItem,
  type GranFormatoPanelizadoDireccion,
  type GranFormatoPanelizadoDistribucion,
  type GranFormatoPanelizadoInterpretacionAnchoMaximo,
  type GranFormatoPanelizadoModo,
  type GranFormatoCostosResponse,
  type MetodoCalculoPrecioProducto,
  type ProductoImpuestoCatalogo,
  type ProductoChecklist,
  type ProductoChecklistPayload,
  type ProductoPrecioComisionItem,
  type ProductoPrecioComisionTipo,
  type ProductoPrecioConfig,
  type ProductoPrecioEspecialCliente,
  type ProductoPrecioFilaCantidadMargen,
  type ProductoPrecioFilaCantidadPrecio,
  type ProductoPrecioFilaRangoMargen,
  type ProductoPrecioFilaRangoPrecio,
  type UnidadComercialProducto,
  estadoProductoServicioItems,
  tipoProductoServicioItems,
  unidadComercialProductoItems,
} from "@/lib/productos-servicios";

const wideFormatTabs = [
  { value: "general", label: "General" },
  { value: "tecnologias", label: "Tecnologías" },
  { value: "produccion", label: "Ruta base" },
  { value: "checklist", label: "Ruta de opcionales" },
  { value: "imposicion", label: "Imposición" },
  { value: "cotizador", label: "Simular costo" },
  { value: "precio", label: "Precio" },
  { value: "simulacion-comercial", label: "Simular venta" },
] as const;

function getUnidadComercialProductoLabel(value: string | null | undefined) {
  return (
    unidadComercialProductoItems.find((item) => item.value === value)?.label ??
    value?.trim() ??
    "Unidad"
  );
}

function LabelWithTooltip({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <Tooltip>
        <TooltipTrigger className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground">
          <InfoIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

function resolveUnidadComercialProducto(value: string | null | undefined): UnidadComercialProducto | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "unidad" || normalized === "unidades") return "unidad";
  if (normalized === "m2" || normalized === "m²" || normalized === "metro cuadrado" || normalized === "metros cuadrados") {
    return "m2";
  }
  if (
    normalized === "metro_lineal" ||
    normalized === "ml" ||
    normalized === "metro lineal" ||
    normalized === "metros lineales"
  ) {
    return "metro_lineal";
  }
  return null;
}

function getUnidadComercialProductoSuffix(value: string | null | undefined) {
  const normalized = normalizeUnidadComercialProducto(value);
  if (normalized === "m2") return "m2";
  if (normalized === "metro_lineal") return "ml";
  return "unidad";
}

function normalizeUnidadComercialProducto(value: string | null | undefined): UnidadComercialProducto {
  return resolveUnidadComercialProducto(value) ?? "unidad";
}

function normalizeWideFormatMeasurementUnit(
  value: string | null | undefined,
  unidadComercial: UnidadComercialProducto,
) {
  const resolved = resolveUnidadComercialProducto(value);
  if (!resolved || resolved === "unidad") {
    return unidadComercial;
  }
  return resolved;
}

function buildWideFormatPrecioConfigDraft(
  precio: ProductoPrecioConfig | null | undefined,
  unidadComercial: UnidadComercialProducto,
) {
  const config = buildPrecioConfigDraft(precio, unidadComercial);
  return {
    ...config,
    measurementUnit: normalizeWideFormatMeasurementUnit(config.measurementUnit, unidadComercial),
  } as ProductoPrecioConfig;
}

function buildWideFormatPrecioEspecialClienteDraft(
  item: ProductoPrecioEspecialCliente | null | undefined,
  unidadComercial: UnidadComercialProducto,
) {
  const draft = buildPrecioEspecialClienteDraft(item ?? null, unidadComercial);
  return {
    ...draft,
    measurementUnit: normalizeWideFormatMeasurementUnit(draft.measurementUnit, unidadComercial),
  };
}

const EMPTY_MATERIAL_BASE_VALUE = "__empty_material_base__";
const PlotterSimulator = dynamic(() => import("@/components/plotter-simulator"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[70vh] min-h-[480px] items-center justify-center rounded-xl border bg-muted/20 text-sm text-muted-foreground">
      Cargando motor 3D...
    </div>
  ),
});

const technologyOrder = tecnologiaMaquinaItems.map((item) => item.value);

const technologyLabels: Record<string, string> = Object.fromEntries(
  tecnologiaMaquinaItems.map((item) => [item.value, item.label]),
);

const imposicionOptimizationItems: Array<{
  value: GranFormatoImposicionCriterioOptimizacion;
  label: string;
}> = [
  { value: "menor_costo_total", label: "Menor costo total" },
  { value: "menor_desperdicio", label: "Menor desperdicio" },
  { value: "menor_largo_consumido", label: "Menor largo consumido" },
];

const panelizadoDireccionItems: Array<{
  value: GranFormatoPanelizadoDireccion;
  label: string;
}> = [
  { value: "automatica", label: "Automática" },
  { value: "vertical", label: "Vertical" },
  { value: "horizontal", label: "Horizontal" },
];

const panelizadoDistribucionItems: Array<{
  value: GranFormatoPanelizadoDistribucion;
  label: string;
}> = [
  { value: "equilibrada", label: "Equilibrada" },
  { value: "libre", label: "Libre" },
];

const panelizadoInterpretacionItems: Array<{
  value: GranFormatoPanelizadoInterpretacionAnchoMaximo;
  label: string;
}> = [
  { value: "total", label: "Ancho total del panel" },
  { value: "util", label: "Ancho útil sin solape" },
];
const MIN_MANUAL_PANEL_USEFUL_MM = 20;

function buildManualLayoutFromPlacements(
  placements: GranFormatoImposicionPlacement[],
): GranFormatoPanelManualLayout | null {
  const groups = new Map<string, GranFormatoPanelManualLayoutItem>();
  for (const placement of placements) {
    if (!placement.sourcePieceId || !placement.panelIndex || !placement.panelAxis) {
      continue;
    }
    const current =
      groups.get(placement.sourcePieceId) ??
      {
        sourcePieceId: placement.sourcePieceId,
        pieceWidthMm: placement.originalWidthMm,
        pieceHeightMm: placement.originalHeightMm,
        axis: placement.panelAxis,
        panels: [] as GranFormatoPanelManualItem[],
      };
    current.panels.push({
      panelIndex: placement.panelIndex,
      usefulWidthMm: placement.usefulWidthMm,
      usefulHeightMm: placement.usefulHeightMm,
      overlapStartMm: placement.overlapStartMm,
      overlapEndMm: placement.overlapEndMm,
      finalWidthMm:
        placement.panelAxis === "vertical"
          ? placement.usefulWidthMm + placement.overlapStartMm + placement.overlapEndMm
          : placement.usefulWidthMm,
      finalHeightMm:
        placement.panelAxis === "horizontal"
          ? placement.usefulHeightMm + placement.overlapStartMm + placement.overlapEndMm
          : placement.usefulHeightMm,
    });
    groups.set(placement.sourcePieceId, current);
  }
  const items = Array.from(groups.values())
    .map((item) => ({
      ...item,
      panels: [...item.panels].sort((a, b) => a.panelIndex - b.panelIndex),
    }))
    .sort((a, b) => a.sourcePieceId.localeCompare(b.sourcePieceId));
  return items.length ? { items } : null;
}

function buildManualLayoutFromNestingPieces(
  pieces: NonNullable<GranFormatoCostosResponse["nestingPreview"]>["pieces"],
): GranFormatoPanelManualLayout | null {
  const groups = new Map<string, GranFormatoPanelManualLayoutItem>();
  for (const piece of pieces) {
    if (!piece.sourcePieceId || !piece.panelIndex || !piece.panelAxis) {
      continue;
    }
    const usefulWidthMm = Math.round(((piece.usefulW ?? piece.w ?? 0)) * 10);
    const usefulHeightMm = Math.round(((piece.usefulH ?? piece.h ?? 0)) * 10);
    const overlapStartMm = Math.round(((piece.overlapStart ?? 0)) * 10);
    const overlapEndMm = Math.round(((piece.overlapEnd ?? 0)) * 10);
    const current =
      groups.get(piece.sourcePieceId) ??
      {
        sourcePieceId: piece.sourcePieceId,
        pieceWidthMm: 0,
        pieceHeightMm: 0,
        axis: piece.panelAxis,
        panels: [] as GranFormatoPanelManualItem[],
      };
    current.panels.push({
      panelIndex: piece.panelIndex,
      usefulWidthMm,
      usefulHeightMm,
      overlapStartMm,
      overlapEndMm,
      finalWidthMm:
        piece.panelAxis === "vertical"
          ? usefulWidthMm + overlapStartMm + overlapEndMm
          : usefulWidthMm,
      finalHeightMm:
        piece.panelAxis === "horizontal"
          ? usefulHeightMm + overlapStartMm + overlapEndMm
          : usefulHeightMm,
    });
    groups.set(piece.sourcePieceId, current);
  }
  const items = Array.from(groups.values())
    .map((item) => {
      const panels = [...item.panels].sort((a, b) => a.panelIndex - b.panelIndex);
      const pieceWidthMm =
        item.axis === "vertical"
          ? panels.reduce((acc, panel) => acc + panel.usefulWidthMm, 0)
          : panels[0]?.usefulWidthMm ?? 0;
      const pieceHeightMm =
        item.axis === "horizontal"
          ? panels.reduce((acc, panel) => acc + panel.usefulHeightMm, 0)
          : panels[0]?.usefulHeightMm ?? 0;
      return {
        ...item,
        pieceWidthMm,
        pieceHeightMm,
        panels,
      };
    })
    .filter((item) => item.pieceWidthMm > 0 && item.pieceHeightMm > 0)
    .sort((a, b) => a.sourcePieceId.localeCompare(b.sourcePieceId));
  return items.length ? { items } : null;
}

function recalculateManualLayoutItem(
  item: GranFormatoPanelManualLayoutItem,
): GranFormatoPanelManualLayoutItem {
  return {
    ...item,
    panels: item.panels.map((panel) => ({
      ...panel,
      finalWidthMm:
        item.axis === "vertical"
          ? panel.usefulWidthMm + panel.overlapStartMm + panel.overlapEndMm
          : item.pieceWidthMm,
      finalHeightMm:
        item.axis === "horizontal"
          ? panel.usefulHeightMm + panel.overlapStartMm + panel.overlapEndMm
          : item.pieceHeightMm,
    })),
  };
}

function validateManualLayoutItem(input: {
  item: GranFormatoPanelManualLayoutItem;
  printableWidthMm: number;
  maxPanelWidthMm: number | null;
  widthInterpretation: GranFormatoPanelizadoInterpretacionAnchoMaximo;
}) {
  const dimension = input.item.axis === "vertical" ? input.item.pieceWidthMm : input.item.pieceHeightMm;
  const usefulTotal = input.item.panels.reduce(
    (acc, panel) =>
      acc + (input.item.axis === "vertical" ? panel.usefulWidthMm : panel.usefulHeightMm),
    0,
  );
  if (Math.abs(usefulTotal - dimension) > 1) {
    return false;
  }
  return input.item.panels.every((panel) => {
    const useful = input.item.axis === "vertical" ? panel.usefulWidthMm : panel.usefulHeightMm;
    const final = input.item.axis === "vertical" ? panel.finalWidthMm : panel.finalHeightMm;
    const withinConfiguredLimit =
      input.maxPanelWidthMm == null
        ? true
        : input.widthInterpretation === "total"
          ? final <= input.maxPanelWidthMm
          : useful <= input.maxPanelWidthMm;
    return useful >= MIN_MANUAL_PANEL_USEFUL_MM && final <= input.printableWidthMm && withinConfiguredLimit;
  });
}

const defaultGranFormatoImposicionConfig: GranFormatoImposicionConfig = {
  medidas: [createGranFormatoImposicionMedida()],
  piezaAnchoMm: null,
  piezaAltoMm: null,
  cantidadReferencia: 1,
  tecnologiaDefault: null,
  maquinaDefaultId: null,
  perfilDefaultId: null,
  permitirRotacion: true,
  separacionHorizontalMm: 0,
  separacionVerticalMm: 0,
  margenLateralIzquierdoMmOverride: null,
  margenLateralDerechoMmOverride: null,
  margenInicioMmOverride: null,
  margenFinalMmOverride: null,
  criterioOptimizacion: "menor_costo_total",
  panelizadoActivo: false,
  panelizadoDireccion: "automatica",
  panelizadoSolapeMm: null,
  panelizadoAnchoMaxPanelMm: null,
  panelizadoDistribucion: "equilibrada",
  panelizadoInterpretacionAnchoMaximo: "total",
  panelizadoModo: "automatico",
  panelizadoManualLayout: null,
};

function createGranFormatoImposicionMedida() {
  return {
    anchoMm: null,
    altoMm: null,
    cantidad: 1,
  };
}

type PrecioEspecialClienteConfirmDelete = {
  id: string;
  clienteNombre: string;
};

type PrecioEspecialClienteDraft = {
  id: string;
  clienteId: string;
  clienteNombre: string;
  descripcion: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  metodoCalculo: MetodoCalculoPrecioProducto;
  measurementUnit: string | null;
  impuestos: ProductoPrecioConfig["impuestos"];
  detalle: Record<string, unknown>;
};

type PrecioComisionDraft = ProductoPrecioComisionItem;

const metodoCalculoPrecioLabels: Record<MetodoCalculoPrecioProducto, string> = {
  margen_variable: "Cantidad libre por margen variable",
  por_margen: "Precio fijo por margen fijo",
  precio_fijo: "Precio fijo",
  fijado_por_cantidad: "Cantidades fijas con precio fijo",
  fijo_con_margen_variable: "Cantidades fijas con margen variable",
  variable_por_cantidad: "Rangos de precio con precio fijo",
  precio_fijo_para_margen_minimo: "Precio fijo para margen mínimo",
};

const metodoCalculoPrecioItems: Array<{ value: MetodoCalculoPrecioProducto; label: string }> = [
  { value: "margen_variable", label: metodoCalculoPrecioLabels.margen_variable },
  { value: "por_margen", label: metodoCalculoPrecioLabels.por_margen },
  { value: "precio_fijo", label: metodoCalculoPrecioLabels.precio_fijo },
  { value: "fijado_por_cantidad", label: metodoCalculoPrecioLabels.fijado_por_cantidad },
  { value: "fijo_con_margen_variable", label: metodoCalculoPrecioLabels.fijo_con_margen_variable },
  { value: "variable_por_cantidad", label: metodoCalculoPrecioLabels.variable_por_cantidad },
  { value: "precio_fijo_para_margen_minimo", label: metodoCalculoPrecioLabels.precio_fijo_para_margen_minimo },
];

const precioComisionTipoLabels: Record<ProductoPrecioComisionTipo, string> = {
  financiera: "Financiera",
  vendedor: "Vendedor",
};

const precioComisionTipoItems: Array<{ value: ProductoPrecioComisionTipo; label: string }> = [
  { value: "financiera", label: precioComisionTipoLabels.financiera },
  { value: "vendedor", label: precioComisionTipoLabels.vendedor },
];

function buildDefaultPrecioDetalle(metodoCalculo: MetodoCalculoPrecioProducto) {
  if (metodoCalculo === "por_margen") {
    return { marginPct: 0, minimumMarginPct: 0 };
  }
  if (metodoCalculo === "precio_fijo") {
    return { price: 0, minimumPrice: 0 };
  }
  if (metodoCalculo === "precio_fijo_para_margen_minimo") {
    return { price: 0, minimumPrice: 0, minimumMarginPct: 0 };
  }
  if (metodoCalculo === "fijado_por_cantidad") {
    return { tiers: [{ quantity: 1, price: 0 }] as ProductoPrecioFilaCantidadPrecio[] };
  }
  if (metodoCalculo === "fijo_con_margen_variable") {
    return { tiers: [{ quantity: 1, marginPct: 0 }] as ProductoPrecioFilaCantidadMargen[] };
  }
  if (metodoCalculo === "variable_por_cantidad") {
    return { tiers: [{ quantityUntil: 1, price: 0 }] as ProductoPrecioFilaRangoPrecio[] };
  }
  return { tiers: [{ quantityUntil: 1, marginPct: 0 }] as ProductoPrecioFilaRangoMargen[] };
}

function buildDefaultPrecioImpuestos() {
  return {
    esquemaId: null,
    esquemaNombre: "",
    items: [],
    porcentajeTotal: 0,
  };
}

function buildDefaultPrecioComisiones() {
  return {
    items: [] as ProductoPrecioComisionItem[],
    porcentajeTotal: 0,
  };
}

function clonePrecioDetalle(
  metodoCalculo: MetodoCalculoPrecioProducto,
  detalle: ProductoPrecioConfig["detalle"],
): ProductoPrecioConfig["detalle"] {
  if (metodoCalculo === "por_margen") {
    const current = detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "por_margen" }>["detalle"];
    return { marginPct: current.marginPct, minimumMarginPct: current.minimumMarginPct };
  }
  if (metodoCalculo === "precio_fijo") {
    const current = detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "precio_fijo" }>["detalle"];
    return { price: current.price, minimumPrice: current.minimumPrice };
  }
  if (metodoCalculo === "precio_fijo_para_margen_minimo") {
    const current = detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "precio_fijo_para_margen_minimo" }>["detalle"];
    return {
      price: current.price,
      minimumPrice: current.minimumPrice,
      minimumMarginPct: current.minimumMarginPct,
    };
  }
  if (metodoCalculo === "fijado_por_cantidad") {
    const current = detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijado_por_cantidad" }>["detalle"];
    return { tiers: current.tiers.map((tier) => ({ ...tier })) };
  }
  if (metodoCalculo === "fijo_con_margen_variable") {
    const current = detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>["detalle"];
    return { tiers: current.tiers.map((tier) => ({ ...tier })) };
  }
  if (metodoCalculo === "variable_por_cantidad") {
    const current = detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>["detalle"];
    return { tiers: current.tiers.map((tier) => ({ ...tier })) };
  }
  const current = detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>["detalle"];
  return { tiers: current.tiers.map((tier) => ({ ...tier })) };
}

function buildPrecioConfigDraft(
  precio: ProductoPrecioConfig | null | undefined,
  measurementUnitFallback: string,
): ProductoPrecioConfig {
  const metodoCalculo = precio?.metodoCalculo ?? "margen_variable";
  const detalle = precio?.detalle ?? buildDefaultPrecioDetalle(metodoCalculo);
  return {
    metodoCalculo,
    measurementUnit: precio?.measurementUnit ?? measurementUnitFallback,
    impuestos: precio?.impuestos
      ? {
          esquemaId: precio.impuestos.esquemaId,
          esquemaNombre: precio.impuestos.esquemaNombre,
          items: precio.impuestos.items.map((item) => ({ ...item })),
          porcentajeTotal: precio.impuestos.porcentajeTotal,
        }
      : buildDefaultPrecioImpuestos(),
    comisiones: precio?.comisiones
      ? {
          items: precio.comisiones.items.map((item) => ({ ...item })),
          porcentajeTotal: precio.comisiones.porcentajeTotal,
        }
      : buildDefaultPrecioComisiones(),
    detalle: clonePrecioDetalle(metodoCalculo, detalle),
  } as ProductoPrecioConfig;
}

function buildPrecioConfigForMethod(
  metodoCalculo: MetodoCalculoPrecioProducto,
  measurementUnit: string | null,
): ProductoPrecioConfig {
  return {
    metodoCalculo,
    measurementUnit,
    impuestos: buildDefaultPrecioImpuestos(),
    comisiones: buildDefaultPrecioComisiones(),
    detalle: buildDefaultPrecioDetalle(metodoCalculo),
  } as ProductoPrecioConfig;
}

function buildPrecioComisionDraft(item?: ProductoPrecioComisionItem | null): PrecioComisionDraft {
  return {
    id: item?.id ?? crypto.randomUUID(),
    nombre: item?.nombre ?? "",
    tipo: item?.tipo ?? "financiera",
    porcentaje: item?.porcentaje ?? 0,
    activo: item?.activo ?? true,
  };
}

function buildPrecioEspecialClienteDraft(
  item: ProductoPrecioEspecialCliente | null | undefined,
  measurementUnitFallback: string,
): PrecioEspecialClienteDraft {
  const precio = buildPrecioConfigDraft(item, measurementUnitFallback);
  const now = new Date().toISOString();
  return {
    id: item?.id ?? crypto.randomUUID(),
    clienteId: item?.clienteId ?? "",
    clienteNombre: item?.clienteNombre ?? "",
    descripcion: item?.descripcion ?? "",
    activo: item?.activo ?? true,
    createdAt: item?.createdAt ?? now,
    updatedAt: item?.updatedAt ?? now,
    ...precio,
  } as PrecioEspecialClienteDraft;
}

function getPrecioEspecialClienteResumen(item: ProductoPrecioEspecialCliente | PrecioEspecialClienteDraft) {
  if (item.metodoCalculo === "por_margen") {
    const detail = item.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "por_margen" }>["detalle"];
    return `${detail.marginPct}%`;
  }
  if (item.metodoCalculo === "precio_fijo") {
    const detail = item.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "precio_fijo" }>["detalle"];
    return `${detail.price}`;
  }
  if (item.metodoCalculo === "fijado_por_cantidad") {
    const detail = item.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijado_por_cantidad" }>["detalle"];
    return detail.tiers.map((tier: ProductoPrecioFilaCantidadPrecio) => tier.quantity).join(", ");
  }
  if (item.metodoCalculo === "fijo_con_margen_variable") {
    const detail = item.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>["detalle"];
    return detail.tiers.map((tier: ProductoPrecioFilaCantidadMargen) => `${tier.quantity}: ${tier.marginPct}%`).join(", ");
  }
  if (item.metodoCalculo === "variable_por_cantidad") {
    const detail = item.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>["detalle"];
    return detail.tiers.map((tier: ProductoPrecioFilaRangoPrecio) => `Hasta ${tier.quantityUntil}`).join(", ");
  }
  if (item.metodoCalculo === "margen_variable") {
    const detail = item.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>["detalle"];
    return detail.tiers
      .map((tier: ProductoPrecioFilaRangoMargen) => `Hasta ${tier.quantityUntil}: ${tier.marginPct}%`)
      .join(", ");
  }
  return "";
}

function buildPrecioEspecialClienteFromDraft(
  draft: PrecioEspecialClienteDraft,
  clienteNombre: string,
  updatedAt: string,
): ProductoPrecioEspecialCliente {
  return {
    id: draft.id,
    clienteId: draft.clienteId,
    clienteNombre,
    descripcion: draft.descripcion,
    activo: draft.activo,
    createdAt: draft.createdAt,
    updatedAt,
    metodoCalculo: draft.metodoCalculo,
    measurementUnit: draft.measurementUnit,
    impuestos: draft.impuestos,
    detalle: draft.detalle,
  } as ProductoPrecioEspecialCliente;
}

function getPrecioMethodLabel(value: MetodoCalculoPrecioProducto) {
  return metodoCalculoPrecioLabels[value] ?? value;
}

function getPrecioMethodDescription(value: MetodoCalculoPrecioProducto) {
  if (value === "margen_variable") return "Define márgenes por tramos para vender en cualquier cantidad.";
  if (value === "por_margen") return "El precio de venta se calcula desde el costo usando un margen fijo.";
  if (value === "precio_fijo") return "El precio de venta se define manualmente como un valor fijo único.";
  if (value === "fijado_por_cantidad") return "Define cantidades exactas habilitadas y un precio fijo para cada una.";
  if (value === "fijo_con_margen_variable") return "Define cantidades exactas habilitadas y un margen variable para cada una.";
  if (value === "variable_por_cantidad") return "Define rangos de cantidad con un precio fijo para cada tramo.";
  return "Define los parámetros comerciales del método seleccionado.";
}

function getVariableRangeLabel(index: number, quantityUntil: number, measurementUnit?: string | null) {
  const unitSuffix = getUnidadComercialProductoSuffix(measurementUnit);
  if (index === 0) return `Hasta ${quantityUntil} ${unitSuffix}`;
  return `Hasta ${quantityUntil} ${unitSuffix}`;
}

type GranFormatoRutaBaseReglaDraft = {
  id: string;
  tecnologia: string;
  maquinaId: string;
  pasoPlantillaId: string;
  perfilOperativoDefaultId: string;
};

type GranFormatoImposicionPlacement = {
  id: string;
  widthMm: number;
  heightMm: number;
  usefulWidthMm: number;
  usefulHeightMm: number;
  overlapStartMm: number;
  overlapEndMm: number;
  centerXMm: number;
  centerYMm: number;
  label: string;
  rotated: boolean;
  originalWidthMm: number;
  originalHeightMm: number;
  panelIndex: number | null;
  panelCount: number | null;
  panelAxis: "vertical" | "horizontal" | null;
  sourcePieceId: string | null;
};

type GranFormatoImposicionPreviewItem = {
  variant: MateriaPrimaVariante;
  rollWidthMm: number;
  machineLimitedWidthMm: number;
  printableWidthMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  marginStartMm: number;
  marginEndMm: number;
  orientacion: "normal" | "rotada" | "mixta";
  panelizado: boolean;
  panelAxis: "vertical" | "horizontal" | null;
  panelCount: number;
  panelOverlapMm: number | null;
  panelMaxWidthMm: number | null;
  panelDistribution: GranFormatoPanelizadoDistribucion | null;
  panelWidthInterpretation: GranFormatoPanelizadoInterpretacionAnchoMaximo | null;
  panelMode: GranFormatoPanelizadoModo | null;
  piecesPerRow: number;
  rows: number;
  consumedLengthMm: number;
  usefulAreaM2: number;
  consumedAreaM2: number;
  wasteAreaM2: number;
  wastePct: number;
  placements: GranFormatoImposicionPlacement[];
  estimatedCostTotal: number;
};

type GranFormatoImposicionPreviewResultState = {
  items: GranFormatoImposicionPreviewItem[];
  rejected: Array<{
    variant: MateriaPrimaVariante;
    reason: string;
  }>;
  machineIssue: string | null;
};

function createEmptyImposicionPreviewResult(machineIssue: string | null): GranFormatoImposicionPreviewResultState {
  return {
    items: [],
    rejected: [],
    machineIssue,
  };
}

function createRutaBaseReglaDraft(): GranFormatoRutaBaseReglaDraft {
  return {
    id: crypto.randomUUID(),
    tecnologia: "",
    maquinaId: "",
    pasoPlantillaId: "",
    perfilOperativoDefaultId: "",
  };
}

function normalizeRutaBaseDraftSnapshot(
  procesoDefinicionId: string,
  reglasImpresion: GranFormatoRutaBaseReglaDraft[],
) {
  return JSON.stringify({
    procesoDefinicionId: procesoDefinicionId || "",
    reglasImpresion: reglasImpresion
      .map((item) => ({
        tecnologia: item.tecnologia,
        maquinaId: item.maquinaId || "",
        pasoPlantillaId: item.pasoPlantillaId,
        perfilOperativoDefaultId: item.perfilOperativoDefaultId || "",
      }))
      .sort((a, b) =>
        `${a.tecnologia}:${a.maquinaId}:${a.pasoPlantillaId}`.localeCompare(
          `${b.tecnologia}:${b.maquinaId}:${b.pasoPlantillaId}`,
        ),
      ),
  });
}

function normalizeRutaBaseReglasSnapshot(reglasImpresion: GranFormatoRutaBaseReglaDraft[]) {
  return JSON.stringify(
    reglasImpresion
      .map((item) => ({
        id: item.id,
        tecnologia: item.tecnologia || "",
        maquinaId: item.maquinaId || "",
        pasoPlantillaId: item.pasoPlantillaId || "",
        perfilOperativoDefaultId: item.perfilOperativoDefaultId || "",
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
}

function normalizePasoNombreBase(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) {
    return "";
  }
  const colonIndex = normalized.indexOf(":");
  if (colonIndex <= 0) {
    return normalized;
  }
  return normalized.slice(0, colonIndex).trim();
}

function getPasoPlantillaIdFromDetalle(value: Record<string, unknown> | null | undefined) {
  const pasoPlantillaId = value?.pasoPlantillaId;
  return typeof pasoPlantillaId === "string" && pasoPlantillaId.trim().length
    ? pasoPlantillaId.trim()
    : null;
}

function createEmptyChecklist(productoId: string): ProductoChecklist {
  return {
    productoId,
    activo: true,
    preguntas: [],
    createdAt: null,
    updatedAt: null,
  };
}

function normalizeImposicionSnapshot(config: GranFormatoImposicionConfig) {
  return JSON.stringify({
    medidas: config.medidas.map((item) => ({
      anchoMm: item.anchoMm ?? null,
      altoMm: item.altoMm ?? null,
      cantidad: item.cantidad ?? 1,
    })),
    piezaAnchoMm: config.piezaAnchoMm ?? null,
    piezaAltoMm: config.piezaAltoMm ?? null,
    cantidadReferencia: config.cantidadReferencia ?? 1,
    tecnologiaDefault: config.tecnologiaDefault ?? "",
    maquinaDefaultId: config.maquinaDefaultId ?? "",
    perfilDefaultId: config.perfilDefaultId ?? "",
    permitirRotacion: config.permitirRotacion !== false,
    separacionHorizontalMm: config.separacionHorizontalMm ?? 0,
    separacionVerticalMm: config.separacionVerticalMm ?? 0,
    margenLateralIzquierdoMmOverride: config.margenLateralIzquierdoMmOverride ?? null,
    margenLateralDerechoMmOverride: config.margenLateralDerechoMmOverride ?? null,
    margenInicioMmOverride: config.margenInicioMmOverride ?? null,
    margenFinalMmOverride: config.margenFinalMmOverride ?? null,
    criterioOptimizacion: config.criterioOptimizacion,
    panelizadoActivo: config.panelizadoActivo === true,
    panelizadoDireccion: config.panelizadoDireccion ?? "automatica",
    panelizadoSolapeMm: config.panelizadoSolapeMm ?? null,
    panelizadoAnchoMaxPanelMm: config.panelizadoAnchoMaxPanelMm ?? null,
    panelizadoDistribucion: config.panelizadoDistribucion ?? "equilibrada",
    panelizadoInterpretacionAnchoMaximo: config.panelizadoInterpretacionAnchoMaximo ?? "total",
    panelizadoModo: config.panelizadoModo ?? "automatico",
    panelizadoManualLayout: config.panelizadoManualLayout
      ? {
          items: config.panelizadoManualLayout.items.map((item) => ({
            ...item,
            panels: item.panels.map((panel) => ({ ...panel })),
          })),
        }
      : null,
  });
}

function cloneGranFormatoImposicionConfig(config: GranFormatoImposicionConfig): GranFormatoImposicionConfig {
  return {
    ...config,
    medidas: config.medidas.map((item) => ({
      anchoMm: item.anchoMm ?? null,
      altoMm: item.altoMm ?? null,
      cantidad: item.cantidad ?? 1,
    })),
    panelizadoModo: config.panelizadoModo ?? "automatico",
    panelizadoManualLayout: config.panelizadoManualLayout
      ? {
          items: config.panelizadoManualLayout.items.map((item) => ({
            ...item,
            panels: item.panels.map((panel) => ({ ...panel })),
          })),
        }
      : null,
  };
}

function readNumericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readMachineMarginMm(maquina: Maquina | null, key: string) {
  const raw = maquina?.parametrosTecnicos?.[key];
  const cm = readNumericValue(raw);
  return cm == null ? null : cm * 10;
}

function formatMmAsCm(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "";
  }
  return String(Number((value / 10).toFixed(2)));
}

function buildDefaultPeriodo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getPieceLetterLabel(index: number) {
  let current = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (current % 26)) + label;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);
  return `Pieza ${label}`;
}

function renderGranFormatoMaterialDisplay(item: GranFormatoCostosResponse["materiasPrimas"][number]) {
  if (item.variantChips?.length) {
    return (
      <div className="space-y-1">
        <p>{item.nombre}</p>
        <div className="flex flex-wrap gap-1">
          {item.variantChips.map((chip) => (
            <span key={`${item.nombre}-${chip.label}-${chip.value}`} className="rounded border px-2 py-0.5 text-xs text-muted-foreground">
              {chip.label}: {chip.value}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (item.sku) {
    return `${item.nombre} · ${item.sku}`;
  }
  return item.nombre;
}

function formatNumber(value: number | null | undefined, decimals = 2) {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}

function getPanelizadoInterpretacionLabel(
  value: GranFormatoPanelizadoInterpretacionAnchoMaximo | null | undefined,
) {
  return (
    panelizadoInterpretacionItems.find((item) => item.value === value)?.label ??
    "Ancho total del panel"
  );
}

function getPanelizadoModoLabel(value: GranFormatoPanelizadoModo | null | undefined) {
  if (value === "manual") return "Manual";
  return "Automático";
}

function getWideFormatMaterialLabel(tipo: string) {
  if (tipo === "SUSTRATO") return "Sustrato";
  if (tipo === "TINTA") return "Tinta";
  if (tipo === "CHECKLIST_MATERIAL") return "Materiales opcionales";
  return tipo;
}

function resolveProcesoOperacionPlantilla(
  operacion: {
    nombre: string;
    maquinaId?: string | null;
    perfilOperativoId?: string | null;
    detalle?: Record<string, unknown> | null;
  },
  plantillasPaso: DigitalProductDetailProps["plantillasPaso"],
) {
  const operationName = operacion.nombre.trim().toLowerCase();
  const operationBaseName = normalizePasoNombreBase(operacion.nombre);
  const pasoPlantillaId = getPasoPlantillaIdFromDetalle(operacion.detalle ?? null) ?? "";
  if (pasoPlantillaId) {
    return plantillasPaso.find((item) => item.id === pasoPlantillaId && item.activo) ?? null;
  }
  const exactWithProfile =
    plantillasPaso.find(
      (item) =>
        item.activo &&
        item.perfilOperativoId &&
        item.perfilOperativoId === (operacion.perfilOperativoId ?? "") &&
        (item.maquinaId ?? "") === (operacion.maquinaId ?? ""),
    ) ?? null;
  if (exactWithProfile) {
    return exactWithProfile;
  }
  return (
    plantillasPaso.find(
      (item) =>
        item.activo &&
        item.nombre.trim().toLowerCase() === operationName &&
        (item.maquinaId ?? "") === (operacion.maquinaId ?? ""),
    ) ??
    plantillasPaso.find(
      (item) =>
        item.activo &&
        normalizePasoNombreBase(item.nombre) === operationBaseName &&
        (item.maquinaId ?? "") === (operacion.maquinaId ?? ""),
    ) ??
    plantillasPaso.find((item) => item.activo && item.nombre.trim().toLowerCase() === operationName) ??
    plantillasPaso.find((item) => item.activo && normalizePasoNombreBase(item.nombre) === operationBaseName) ??
    null
  );
}

function toChecklistPayload(checklist: ProductoChecklist): ProductoChecklistPayload {
  return {
    activo: checklist.activo,
    preguntas: checklist.preguntas.map((pregunta) => ({
      id: pregunta.id,
      texto: pregunta.texto,
      tipoPregunta: pregunta.tipoPregunta,
      orden: pregunta.orden,
      activo: pregunta.activo,
      respuestas: pregunta.respuestas.map((respuesta) => ({
        id: respuesta.id,
        texto: respuesta.texto,
        codigo: respuesta.codigo ?? undefined,
        preguntaSiguienteId: respuesta.preguntaSiguienteId ?? undefined,
        orden: respuesta.orden,
        activo: respuesta.activo,
        reglas: respuesta.reglas.map((regla) => ({
          id: regla.id,
          accion: regla.accion,
          orden: regla.orden,
          activo: regla.activo,
          pasoPlantillaId: regla.pasoPlantillaId ?? undefined,
          variantePasoId: regla.variantePasoId ?? undefined,
          costoRegla: regla.costoRegla ?? undefined,
          costoValor: regla.costoValor ?? undefined,
          costoCentroCostoId: regla.costoCentroCostoId ?? undefined,
          materiaPrimaVarianteId: regla.materiaPrimaVarianteId ?? undefined,
          tipoConsumo: regla.tipoConsumo ?? undefined,
          factorConsumo: regla.factorConsumo ?? undefined,
          mermaPct: regla.mermaPct ?? undefined,
          detalle: regla.detalle ?? undefined,
        })),
      })),
    })),
  };
}

function isWideFormatMachine(maquina: Maquina) {
  return (
    maquina.activo &&
    getMaquinaGeometriasCompatibles(maquina).includes("rollo") &&
    Boolean(getMaquinaTecnologia(maquina))
  );
}

function toggleInArray(items: string[], value: string, checked: boolean) {
  if (checked) {
    return Array.from(new Set([...items, value]));
  }
  return items.filter((item) => item !== value);
}

export function WideFormatProductDetail({
  producto,
  familias,
  subfamilias,
  motores,
  procesos,
  maquinas,
  plantillasPaso,
  materiasPrimas,
  checklist,
  initialClientes,
  initialImpuestosCatalogo,
}: DigitalProductDetailProps) {
  const [activeTab, setActiveTab] = React.useState("general");
  const [productoState, setProductoState] = React.useState(producto);
  const clientesOptions = React.useMemo(
    () => [...initialClientes].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [initialClientes],
  );
  const [impuestosCatalogo, setImpuestosCatalogo] = React.useState(initialImpuestosCatalogo);
  const impuestosCatalogoActivos = React.useMemo(
    () => impuestosCatalogo.filter((item) => item.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [impuestosCatalogo],
  );
  const [isSavingGeneral, startSavingGeneral] = React.useTransition();
  const [isSavingConfig, startSavingConfig] = React.useTransition();
  const [isLoadingConfig, setIsLoadingConfig] = React.useState(true);
  const [isSavingPrecio, startSavingPrecio] = React.useTransition();
  const [isSavingPrecioEspecialClientes, startSavingPrecioEspecialClientes] = React.useTransition();
  const [isSavingImpuestosCatalogo, startSavingImpuestosCatalogo] = React.useTransition();
  const [generalForm, setGeneralForm] = React.useState({
    nombre: producto.nombre,
    descripcion: producto.descripcion ?? "",
    familiaProductoId: producto.familiaProductoId,
    subfamiliaProductoId: producto.subfamiliaProductoId ?? "",
    unidadComercial: normalizeUnidadComercialProducto(producto.unidadComercial),
    motorCodigo: producto.motorCodigo,
    motorVersion: producto.motorVersion,
  });
  const [tecnologiasCompatibles, setTecnologiasCompatibles] = React.useState<string[]>([]);
  const [savedTecnologiasCompatibles, setSavedTecnologiasCompatibles] = React.useState<string[]>([]);
  const [maquinasCompatiblesIds, setMaquinasCompatiblesIds] = React.useState<string[]>([]);
  const [savedMaquinasCompatiblesIds, setSavedMaquinasCompatiblesIds] = React.useState<string[]>([]);
  const [perfilesCompatiblesIds, setPerfilesCompatiblesIds] = React.useState<string[]>([]);
  const [savedPerfilesCompatiblesIds, setSavedPerfilesCompatiblesIds] = React.useState<string[]>([]);
  const [materialBaseId, setMaterialBaseId] = React.useState<string>("");
  const [savedMaterialBaseId, setSavedMaterialBaseId] = React.useState<string>("");
  const [materialesCompatiblesIds, setMaterialesCompatiblesIds] = React.useState<string[]>([]);
  const [savedMaterialesCompatiblesIds, setSavedMaterialesCompatiblesIds] = React.useState<string[]>([]);
  const [imposicionConfig, setImposicionConfig] = React.useState<GranFormatoImposicionConfig>(
    defaultGranFormatoImposicionConfig,
  );
  const [isSimulatingImposicion, startSimulatingImposicion] = React.useTransition();
  const [imposicionSimulationConfig, setImposicionSimulationConfig] =
    React.useState<GranFormatoImposicionConfig | null>(null);
  const [imposicionPreviewResult, setImposicionPreviewResult] =
    React.useState<GranFormatoImposicionPreviewResultState>(
      createEmptyImposicionPreviewResult("Todavía no ejecutaste una simulación de imposición."),
    );
  const [savedImposicionSnapshot, setSavedImposicionSnapshot] = React.useState(
    normalizeImposicionSnapshot(defaultGranFormatoImposicionConfig),
  );
  const [showImposicionOverrides, setShowImposicionOverrides] = React.useState(false);
  const [isImposicion3dOpen, setIsImposicion3dOpen] = React.useState(false);
  const [isPanelEditorOpen, setIsPanelEditorOpen] = React.useState(false);
  const [panelEditorContext, setPanelEditorContext] = React.useState<"imposicion" | "costos">("imposicion");
  const [panelEditorDraft, setPanelEditorDraft] = React.useState<GranFormatoPanelManualLayout | null>(null);
  const [panelEditorSelectedPieceId, setPanelEditorSelectedPieceId] = React.useState("");
  const [panelEditorDragIndex, setPanelEditorDragIndex] = React.useState<number | null>(null);
  const [isCostos3dOpen, setIsCostos3dOpen] = React.useState(false);
  const panelEditorCanvasRef = React.useRef<HTMLDivElement | null>(null);
  const [isLoadingRutaBase, setIsLoadingRutaBase] = React.useState(true);
  const [isSavingRutaBase, startSavingRutaBase] = React.useTransition();
  const [rutaBaseProcesoId, setRutaBaseProcesoId] = React.useState("");
  const [rutaBaseReglasImpresion, setRutaBaseReglasImpresion] = React.useState<GranFormatoRutaBaseReglaDraft[]>([]);
  const [savedRutaBaseSnapshot, setSavedRutaBaseSnapshot] = React.useState(
    normalizeRutaBaseDraftSnapshot("", []),
  );
  const [isLoadingChecklist, setIsLoadingChecklist] = React.useState(true);
  const [isSavingChecklistScope, startSavingChecklistScope] = React.useTransition();
  const [aplicaChecklistATodasLasTecnologias, setAplicaChecklistATodasLasTecnologias] = React.useState(true);
  const [checklistComun, setChecklistComun] = React.useState<ProductoChecklist>(
    createEmptyChecklist(producto.id),
  );
  const [checklistsPorTecnologia, setChecklistsPorTecnologia] = React.useState<Record<string, ProductoChecklist>>({});
  const [tecnologiaChecklistSeleccionada, setTecnologiaChecklistSeleccionada] = React.useState("");
  const [checklistDirty, setChecklistDirty] = React.useState(false);
  const [isCalculatingCosts, startCalculatingCosts] = React.useTransition();
  const [costosPeriodo, setCostosPeriodo] = React.useState(buildDefaultPeriodo());
  const [costosTecnologia, setCostosTecnologia] = React.useState("");
  const [costosPerfilOverrideId, setCostosPerfilOverrideId] = React.useState("");
  const [costosMedidas, setCostosMedidas] = React.useState<GranFormatoImposicionConfig["medidas"]>(
    [createGranFormatoImposicionMedida()],
  );
  const [costosPanelizadoModo, setCostosPanelizadoModo] =
    React.useState<GranFormatoPanelizadoModo>("automatico");
  const [costosPanelizadoManualLayout, setCostosPanelizadoManualLayout] =
    React.useState<GranFormatoPanelManualLayout | null>(null);
  const [costosPanelizadoEsTemporal, setCostosPanelizadoEsTemporal] = React.useState(false);
  const [costosPanelizadoPrintableWidthMm, setCostosPanelizadoPrintableWidthMm] =
    React.useState<number | null>(null);
  const [costosChecklistRespuestas, setCostosChecklistRespuestas] = React.useState<
    Record<string, { respuestaId: string }>
  >({});
  const [costosPreview, setCostosPreview] = React.useState<GranFormatoCostosResponse | null>(null);
  const [costosSnapshots, setCostosSnapshots] = React.useState<CotizacionProductoSnapshotResumen[]>([]);
  const [costosSnapshotsOpen, setCostosSnapshotsOpen] = React.useState(false);
  const [precioForm, setPrecioForm] = React.useState<ProductoPrecioConfig>(() =>
    buildWideFormatPrecioConfigDraft(producto.precio, normalizeUnidadComercialProducto(producto.unidadComercial)),
  );
  const [precioEditorOpen, setPrecioEditorOpen] = React.useState(false);
  const [precioEditorDraft, setPrecioEditorDraft] = React.useState<ProductoPrecioConfig>(() =>
    buildWideFormatPrecioConfigDraft(producto.precio, normalizeUnidadComercialProducto(producto.unidadComercial)),
  );
  const [precioEspecialClientesForm, setPrecioEspecialClientesForm] = React.useState<ProductoPrecioEspecialCliente[]>(
    () => producto.precioEspecialClientes ?? [],
  );
  const [precioComisionEditorOpen, setPrecioComisionEditorOpen] = React.useState(false);
  const [precioComisionEditorDraft, setPrecioComisionEditorDraft] = React.useState<PrecioComisionDraft>(() =>
    buildPrecioComisionDraft(),
  );
  const [precioComisionToDelete, setPrecioComisionToDelete] = React.useState<ProductoPrecioComisionItem | null>(null);
  const [precioEspecialClienteToDelete, setPrecioEspecialClienteToDelete] =
    React.useState<PrecioEspecialClienteConfirmDelete | null>(null);
  const [precioEspecialClienteEditorOpen, setPrecioEspecialClienteEditorOpen] = React.useState(false);
  const [precioEspecialClienteEditorDraft, setPrecioEspecialClienteEditorDraft] =
    React.useState<PrecioEspecialClienteDraft>(() => buildWideFormatPrecioEspecialClienteDraft(null, normalizeUnidadComercialProducto(producto.unidadComercial)));
  const [impuestosEditorOpen, setImpuestosEditorOpen] = React.useState(false);
  const [impuestosEditorDraft, setImpuestosEditorDraft] = React.useState<ProductoImpuestoCatalogo | null>(null);

  const loadGranFormatoSnapshots = React.useCallback(
    async (productoId: string) => {
      const snapshots = await getCotizacionesProductoServicio(productoId);
      setCostosSnapshots(snapshots);
      setCostosPreview(null);
      setCostosPanelizadoPrintableWidthMm(null);
    },
    [],
  );

  const loadGranFormatoConfig = React.useCallback(async () => {
    setIsLoadingConfig(true);
    try {
      const config = await getGranFormatoConfig(productoState.id);
      setTecnologiasCompatibles(config.tecnologiasCompatibles);
      setSavedTecnologiasCompatibles(config.tecnologiasCompatibles);
      setMaquinasCompatiblesIds(config.maquinasCompatibles);
      setSavedMaquinasCompatiblesIds(config.maquinasCompatibles);
      setPerfilesCompatiblesIds(config.perfilesCompatibles);
      setSavedPerfilesCompatiblesIds(config.perfilesCompatibles);
      setMaterialBaseId(config.materialBaseId ?? "");
      setSavedMaterialBaseId(config.materialBaseId ?? "");
      setMaterialesCompatiblesIds(config.materialesCompatibles);
      setSavedMaterialesCompatiblesIds(config.materialesCompatibles);
      const nextImposicion = config.imposicion ?? defaultGranFormatoImposicionConfig;
      setImposicionConfig({
        ...nextImposicion,
        panelizadoInterpretacionAnchoMaximo:
          nextImposicion.panelizadoInterpretacionAnchoMaximo ?? "total",
        medidas:
          nextImposicion.medidas?.length
            ? nextImposicion.medidas
            : nextImposicion.piezaAnchoMm && nextImposicion.piezaAltoMm
              ? [
                  {
                    anchoMm: nextImposicion.piezaAnchoMm,
                    altoMm: nextImposicion.piezaAltoMm,
                    cantidad: nextImposicion.cantidadReferencia ?? 1,
                  },
                ]
              : [createGranFormatoImposicionMedida()],
      });
      setCostosMedidas(
        nextImposicion.medidas?.length
          ? nextImposicion.medidas
          : nextImposicion.piezaAnchoMm && nextImposicion.piezaAltoMm
            ? [
                {
                  anchoMm: nextImposicion.piezaAnchoMm,
                  altoMm: nextImposicion.piezaAltoMm,
                  cantidad: nextImposicion.cantidadReferencia ?? 1,
                },
              ]
            : [createGranFormatoImposicionMedida()],
      );
      setCostosTecnologia(nextImposicion.tecnologiaDefault ?? "");
      setCostosPerfilOverrideId("");
      setCostosPanelizadoModo(nextImposicion.panelizadoModo ?? "automatico");
      setCostosPanelizadoManualLayout(
        nextImposicion.panelizadoManualLayout
          ? cloneGranFormatoImposicionConfig(nextImposicion).panelizadoManualLayout
          : null,
      );
      setCostosPanelizadoEsTemporal(false);
      setCostosPanelizadoPrintableWidthMm(null);
      setCostosPreview(null);
      setImposicionSimulationConfig(null);
      setImposicionPreviewResult(
        createEmptyImposicionPreviewResult("Todavía no ejecutaste una simulación de imposición."),
      );
      setSavedImposicionSnapshot(
        normalizeImposicionSnapshot({
          ...nextImposicion,
          medidas:
            nextImposicion.medidas?.length
              ? nextImposicion.medidas
              : nextImposicion.piezaAnchoMm && nextImposicion.piezaAltoMm
                ? [
                    {
                      anchoMm: nextImposicion.piezaAnchoMm,
                      altoMm: nextImposicion.piezaAltoMm,
                      cantidad: nextImposicion.cantidadReferencia ?? 1,
                    },
                  ]
                : [createGranFormatoImposicionMedida()],
        }),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la configuración de gran formato.");
    } finally {
      setIsLoadingConfig(false);
    }
  }, [productoState.id]);

  React.useEffect(() => {
    void loadGranFormatoConfig();
  }, [loadGranFormatoConfig]);

  React.useEffect(() => {
    loadGranFormatoSnapshots(productoState.id).catch((error) =>
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar snapshots de costos."),
    );
  }, [loadGranFormatoSnapshots, productoState.id]);

  const loadGranFormatoRouteBase = React.useCallback(async () => {
    setIsLoadingRutaBase(true);
    try {
      const routeBase = await getGranFormatoRutaBase(productoState.id);
      const nextReglas = routeBase.reglasImpresion.map((item) => ({
        id: item.id || crypto.randomUUID(),
        tecnologia: item.tecnologia,
        maquinaId: item.maquinaId ?? "",
        pasoPlantillaId: item.pasoPlantillaId,
        perfilOperativoDefaultId: item.perfilOperativoDefaultId ?? "",
      }));
      setRutaBaseProcesoId(routeBase.procesoDefinicionId ?? "");
      setRutaBaseReglasImpresion(nextReglas);
      setSavedRutaBaseSnapshot(normalizeRutaBaseDraftSnapshot(routeBase.procesoDefinicionId ?? "", nextReglas));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la ruta base de gran formato.");
    } finally {
      setIsLoadingRutaBase(false);
    }
  }, [productoState.id]);

  React.useEffect(() => {
    void loadGranFormatoRouteBase();
  }, [loadGranFormatoRouteBase]);

  const loadGranFormatoChecklistConfig = React.useCallback(async () => {
    setIsLoadingChecklist(true);
    try {
      const config = await getGranFormatoChecklist(productoState.id);
      setAplicaChecklistATodasLasTecnologias(config.aplicaATodasLasTecnologias);
      setChecklistComun(
        config.checklistComun?.preguntas.length
          ? config.checklistComun
          : checklist?.preguntas.length
            ? checklist
            : createEmptyChecklist(productoState.id),
      );
      setChecklistsPorTecnologia(
        Object.fromEntries(
          config.checklistsPorTecnologia.map((item) => [item.tecnologia, item.checklist]),
        ),
      );
      setChecklistDirty(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la ruta de opcionales.");
    } finally {
      setIsLoadingChecklist(false);
    }
  }, [checklist, productoState.id]);

  React.useEffect(() => {
    void loadGranFormatoChecklistConfig();
  }, [loadGranFormatoChecklistConfig]);

  const estadoProductoLabel = React.useMemo(
    () => estadoProductoServicioItems.find((item) => item.value === productoState.estado)?.label ?? productoState.estado,
    [productoState.estado],
  );
  const tipoProductoLabel = React.useMemo(
    () => tipoProductoServicioItems.find((item) => item.value === productoState.tipo)?.label ?? productoState.tipo,
    [productoState.tipo],
  );
  const subfamiliasFiltradasGeneral = React.useMemo(
    () => subfamilias.filter((item) => item.familiaProductoId === generalForm.familiaProductoId),
    [subfamilias, generalForm.familiaProductoId],
  );
  const familiaGeneralLabel = React.useMemo(
    () => familias.find((item) => item.id === generalForm.familiaProductoId)?.nombre ?? "Seleccionar familia",
    [familias, generalForm.familiaProductoId],
  );
  const subfamiliaGeneralLabel = React.useMemo(() => {
    if (!generalForm.subfamiliaProductoId) {
      return "Sin subfamilia";
    }
    return (
      subfamiliasFiltradasGeneral.find((item) => item.id === generalForm.subfamiliaProductoId)?.nombre ??
      "Sin subfamilia"
    );
  }, [generalForm.subfamiliaProductoId, subfamiliasFiltradasGeneral]);
  const motorCostoValue = `${generalForm.motorCodigo}@${generalForm.motorVersion}`;
  const motorCostoLabel = React.useMemo(
    () =>
      motores.find((item) => `${item.code}@${item.version}` === motorCostoValue)?.label ??
      "Selecciona motor de costo",
    [motores, motorCostoValue],
  );
  const isGeneralDirty =
    generalForm.nombre.trim() !== (productoState.nombre ?? "").trim() ||
    generalForm.descripcion.trim() !== (productoState.descripcion ?? "").trim() ||
    generalForm.familiaProductoId !== productoState.familiaProductoId ||
    (generalForm.subfamiliaProductoId || "") !== (productoState.subfamiliaProductoId || "") ||
    generalForm.unidadComercial !== productoState.unidadComercial ||
    generalForm.motorCodigo !== productoState.motorCodigo ||
    generalForm.motorVersion !== productoState.motorVersion;

  const availableMachines = React.useMemo(() => maquinas.filter((item) => isWideFormatMachine(item)), [maquinas]);
  const availableTechnologyItems = React.useMemo(() => {
    const available = new Set<string>();
    for (const machine of availableMachines) {
      const tecnologia = getMaquinaTecnologia(machine);
      if (tecnologia) {
        available.add(tecnologia);
      }
    }
    return technologyOrder
      .filter((value) => available.has(value))
      .map((value) => ({
        value,
        label: technologyLabels[value],
      }));
  }, [availableMachines]);

  const filteredMachines = React.useMemo(() => {
    if (tecnologiasCompatibles.length === 0) {
      return [] as Maquina[];
    }
    const selected = new Set(tecnologiasCompatibles);
    return availableMachines.filter((machine) => {
      const tecnologia = getMaquinaTecnologia(machine);
      return tecnologia ? selected.has(tecnologia) : false;
    });
  }, [availableMachines, tecnologiasCompatibles]);

  const filteredMachineIds = React.useMemo(() => new Set(filteredMachines.map((item) => item.id)), [filteredMachines]);

  const selectedMachines = React.useMemo(
    () => filteredMachines.filter((machine) => maquinasCompatiblesIds.includes(machine.id)),
    [filteredMachines, maquinasCompatiblesIds],
  );

  const groupedProfiles = React.useMemo(
    () =>
      selectedMachines.map((machine) => ({
        machine,
        profiles: machine.perfilesOperativos.filter((profile) => profile.activo),
      })),
    [selectedMachines],
  );

  const validProfileIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const group of groupedProfiles) {
      for (const profile of group.profiles) {
        ids.add(profile.id);
      }
    }
    return ids;
  }, [groupedProfiles]);

  const availableBaseMaterials = React.useMemo(
    () =>
      materiasPrimas.filter(
        (item) => item.activo && item.subfamilia === "sustrato_rollo_flexible" && item.variantes.some((variant) => variant.activo),
      ),
    [materiasPrimas],
  );

  const selectedBaseMaterial = React.useMemo(
    () => availableBaseMaterials.find((item) => item.id === materialBaseId) ?? null,
    [availableBaseMaterials, materialBaseId],
  );
  const materialBaseLabel = React.useMemo(
    () => availableBaseMaterials.find((item) => item.id === materialBaseId)?.nombre ?? "Seleccionar material base",
    [availableBaseMaterials, materialBaseId],
  );

  const availableMaterialVariants = React.useMemo(
    () => (selectedBaseMaterial?.variantes ?? []).filter((variant) => variant.activo),
    [selectedBaseMaterial],
  );
  const hasImposicionSimulation = imposicionSimulationConfig != null;
  const imposicionSimulationSnapshot = React.useMemo(
    () =>
      imposicionSimulationConfig ? normalizeImposicionSnapshot(imposicionSimulationConfig) : null,
    [imposicionSimulationConfig],
  );
  const isImposicionSimulationStale =
    hasImposicionSimulation &&
    imposicionSimulationSnapshot !== normalizeImposicionSnapshot(imposicionConfig);
  const imposicionPreviewConfig = imposicionSimulationConfig ?? imposicionConfig;
  const imposicionPreviewHasValidMeasures = imposicionPreviewConfig.medidas.some(
    (item) => (item.anchoMm ?? 0) > 0 && (item.altoMm ?? 0) > 0 && (item.cantidad ?? 0) > 0,
  );

  const validMaterialVariantIds = React.useMemo(
    () => new Set(availableMaterialVariants.map((item) => item.id)),
    [availableMaterialVariants],
  );
  const imposicionTechnologies = React.useMemo(
    () => tecnologiasCompatibles.filter((item) => selectedMachines.some((machine) => getMaquinaTecnologia(machine) === item)),
    [selectedMachines, tecnologiasCompatibles],
  );
  const imposicionTechnology = React.useMemo(() => {
    if (imposicionConfig.tecnologiaDefault && imposicionTechnologies.includes(imposicionConfig.tecnologiaDefault)) {
      return imposicionConfig.tecnologiaDefault;
    }
    return imposicionTechnologies[0] ?? "";
  }, [imposicionConfig.tecnologiaDefault, imposicionTechnologies]);
  const imposicionMachineOptions = React.useMemo(
    () => selectedMachines.filter((machine) => getMaquinaTecnologia(machine) === imposicionTechnology),
    [imposicionTechnology, selectedMachines],
  );
  const imposicionMachine = React.useMemo(() => {
    if (imposicionConfig.maquinaDefaultId) {
      const selected = imposicionMachineOptions.find((machine) => machine.id === imposicionConfig.maquinaDefaultId);
      if (selected) {
        return selected;
      }
    }
    return imposicionMachineOptions[0] ?? null;
  }, [imposicionConfig.maquinaDefaultId, imposicionMachineOptions]);
  const imposicionProfileOptions = React.useMemo(() => {
    if (!imposicionMachine) {
      return [];
    }
    return imposicionMachine.perfilesOperativos.filter(
      (profile) => profile.activo && perfilesCompatiblesIds.includes(profile.id),
    );
  }, [imposicionMachine, perfilesCompatiblesIds]);
  const imposicionProfile = React.useMemo(() => {
    if (imposicionConfig.perfilDefaultId) {
      const selected = imposicionProfileOptions.find((profile) => profile.id === imposicionConfig.perfilDefaultId);
      if (selected) {
        return selected;
      }
    }
    return imposicionProfileOptions[0] ?? null;
  }, [imposicionConfig.perfilDefaultId, imposicionProfileOptions]);
  const imposicionMaterialVariants = React.useMemo(
    () =>
      materialesCompatiblesIds.length > 0
        ? availableMaterialVariants.filter((item) => materialesCompatiblesIds.includes(item.id))
        : availableMaterialVariants,
    [availableMaterialVariants, materialesCompatiblesIds],
  );
  const imposicionPreview = imposicionPreviewResult.items;
  const imposicionRejectedVariants = imposicionPreviewResult.rejected;
  const imposicionBestCandidate = imposicionPreview[0] ?? null;
  const imposicionManualLayoutActual = React.useMemo(
    () =>
      imposicionPreviewConfig.panelizadoManualLayout ??
      buildManualLayoutFromPlacements(imposicionBestCandidate?.placements ?? []),
    [imposicionBestCandidate?.placements, imposicionPreviewConfig.panelizadoManualLayout],
  );
  const costosManualLayoutActual = React.useMemo(
    () =>
      costosPanelizadoManualLayout ??
      buildManualLayoutFromNestingPieces(costosPreview?.nestingPreview?.pieces ?? []),
    [costosPanelizadoManualLayout, costosPreview?.nestingPreview?.pieces],
  );
  const panelEditorBaseLayout = React.useMemo(
    () => (panelEditorContext === "costos" ? costosManualLayoutActual : imposicionManualLayoutActual),
    [costosManualLayoutActual, imposicionManualLayoutActual, panelEditorContext],
  );
  const panelEditorPieces = React.useMemo(
    () => panelEditorDraft?.items ?? panelEditorBaseLayout?.items ?? [],
    [panelEditorBaseLayout?.items, panelEditorDraft?.items],
  );
  const panelEditorSelectedPiece = React.useMemo(
    () =>
      panelEditorPieces.find((item) => item.sourcePieceId === panelEditorSelectedPieceId) ??
      panelEditorPieces[0] ??
      null,
    [panelEditorPieces, panelEditorSelectedPieceId],
  );
  React.useEffect(() => {
    if (!panelEditorPieces.length) {
      if (panelEditorSelectedPieceId) {
        setPanelEditorSelectedPieceId("");
      }
      return;
    }
    if (!panelEditorSelectedPieceId || !panelEditorPieces.some((item) => item.sourcePieceId === panelEditorSelectedPieceId)) {
      setPanelEditorSelectedPieceId(panelEditorPieces[0]?.sourcePieceId ?? "");
    }
  }, [panelEditorPieces, panelEditorSelectedPieceId]);
  const panelEditorPrintableWidthMm =
    panelEditorContext === "costos"
      ? (costosPanelizadoPrintableWidthMm ?? costosPreview?.resumenTecnico.anchoImprimibleMm ?? 0)
      : (imposicionBestCandidate?.printableWidthMm ?? 0);
  const panelEditorAllValid = React.useMemo(() => {
    if (!panelEditorDraft) {
      return true;
    }
    return panelEditorDraft.items.every((item) =>
      validateManualLayoutItem({
        item,
        printableWidthMm: panelEditorPrintableWidthMm,
        maxPanelWidthMm: imposicionPreviewConfig.panelizadoAnchoMaxPanelMm,
        widthInterpretation: imposicionPreviewConfig.panelizadoInterpretacionAnchoMaximo,
      }),
    );
  }, [
    imposicionPreviewConfig.panelizadoAnchoMaxPanelMm,
    imposicionPreviewConfig.panelizadoInterpretacionAnchoMaximo,
    panelEditorDraft,
    panelEditorPrintableWidthMm,
  ]);
  const panelEditorSelectedPieceValid = React.useMemo(() => {
    if (!panelEditorSelectedPiece) {
      return true;
    }
    return validateManualLayoutItem({
      item: panelEditorSelectedPiece,
      printableWidthMm: panelEditorPrintableWidthMm,
      maxPanelWidthMm: imposicionPreviewConfig.panelizadoAnchoMaxPanelMm,
      widthInterpretation: imposicionPreviewConfig.panelizadoInterpretacionAnchoMaximo,
    });
  }, [
    imposicionPreviewConfig.panelizadoAnchoMaxPanelMm,
    imposicionPreviewConfig.panelizadoInterpretacionAnchoMaximo,
    panelEditorPrintableWidthMm,
    panelEditorSelectedPiece,
  ]);
  const imposicionMarginSummary = React.useMemo(() => {
    const machineLeftMm =
      readMachineMarginMm(imposicionMachine, "margenLateralIzquierdoNoImprimible") ??
      readMachineMarginMm(imposicionMachine, "margenIzquierdo") ??
      0;
    const machineRightMm =
      readMachineMarginMm(imposicionMachine, "margenLateralDerechoNoImprimible") ??
      readMachineMarginMm(imposicionMachine, "margenDerecho") ??
      0;
    const machineStartMm =
      readMachineMarginMm(imposicionMachine, "margenInicioNoImprimible") ??
      readMachineMarginMm(imposicionMachine, "margenSuperior") ??
      0;
    const machineEndMm =
      readMachineMarginMm(imposicionMachine, "margenFinalNoImprimible") ??
      readMachineMarginMm(imposicionMachine, "margenInferior") ??
      0;

    return [
      {
        key: "left",
        title: "Izquierdo",
        machineMm: machineLeftMm,
        overrideKey: "margenLateralIzquierdoMmOverride" as const,
        effectiveMm: imposicionConfig.margenLateralIzquierdoMmOverride ?? machineLeftMm,
      },
      {
        key: "right",
        title: "Derecho",
        machineMm: machineRightMm,
        overrideKey: "margenLateralDerechoMmOverride" as const,
        effectiveMm: imposicionConfig.margenLateralDerechoMmOverride ?? machineRightMm,
      },
      {
        key: "start",
        title: "Inicio",
        machineMm: machineStartMm,
        overrideKey: "margenInicioMmOverride" as const,
        effectiveMm: imposicionConfig.margenInicioMmOverride ?? machineStartMm,
      },
      {
        key: "end",
        title: "Final",
        machineMm: machineEndMm,
        overrideKey: "margenFinalMmOverride" as const,
        effectiveMm: imposicionConfig.margenFinalMmOverride ?? machineEndMm,
      },
    ];
  }, [
    imposicionConfig.margenFinalMmOverride,
    imposicionConfig.margenInicioMmOverride,
    imposicionConfig.margenLateralDerechoMmOverride,
    imposicionConfig.margenLateralIzquierdoMmOverride,
    imposicionMachine,
  ]);
  const costosTechnologies = imposicionTechnologies;
  const costosTechnology = React.useMemo(() => {
    if (costosTecnologia && costosTechnologies.includes(costosTecnologia)) {
      return costosTecnologia;
    }
    return costosTechnologies[0] ?? "";
  }, [costosTecnologia, costosTechnologies]);
  const costosProfileOptions = React.useMemo(() => {
    if (!costosTechnology) {
      return [];
    }
    const items = selectedMachines
      .filter((machine) => getMaquinaTecnologia(machine) === costosTechnology)
      .flatMap((machine) =>
        machine.perfilesOperativos.filter(
          (profile) => profile.activo && perfilesCompatiblesIds.includes(profile.id),
        ),
      );
    return items.filter((profile, index, list) => list.findIndex((item) => item.id === profile.id) === index);
  }, [costosTechnology, perfilesCompatiblesIds, selectedMachines]);
  const costosTechnologyLabel = React.useMemo(
    () => technologyLabels[costosTechnology] ?? "Seleccionar tecnología",
    [costosTechnology],
  );
  const costosPerfilOverrideLabel = React.useMemo(() => {
    if (!costosPerfilOverrideId) {
      return "Usar perfil default del producto";
    }
    return (
      costosProfileOptions.find((item) => item.id === costosPerfilOverrideId)?.nombre ??
      "Usar perfil default del producto"
    );
  }, [costosPerfilOverrideId, costosProfileOptions]);
  const checklistCotizadorGranFormato = React.useMemo(() => {
    if (aplicaChecklistATodasLasTecnologias) {
      return checklistComun;
    }
    return checklistsPorTecnologia[costosTechnology] ?? createEmptyChecklist(producto.id);
  }, [
    aplicaChecklistATodasLasTecnologias,
    checklistComun,
    checklistsPorTecnologia,
    costosTechnology,
    producto.id,
  ]);
  const costosMaterialesAgrupados = React.useMemo(() => {
    const groups = new Map<
      string,
      {
        tipo: string;
        label: string;
        items: Array<GranFormatoCostosResponse["materiasPrimas"][number]>;
        totalCantidad: number;
        totalCosto: number;
      }
    >();
    for (const item of costosPreview?.materiasPrimas ?? []) {
      const tipo = item.tipo;
      const current =
        groups.get(tipo) ??
        {
          tipo,
          label: getWideFormatMaterialLabel(tipo),
          items: [],
          totalCantidad: 0,
          totalCosto: 0,
        };
      current.items.push(item);
      current.totalCantidad += Number(item.cantidad ?? 0);
      current.totalCosto += Number(item.costo ?? 0);
      groups.set(tipo, current);
    }
    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [costosPreview]);
  const costos3dResumen = React.useMemo(() => {
    if (!costosPreview?.nestingPreview) {
      return null;
    }
    const tiempoImpresionMin =
      costosPreview.centrosCosto
        .filter((item) => /impres/i.test(item.paso) || /impres/i.test(item.centroCostoNombre))
        .reduce((acc, item) => acc + item.minutos, 0) || null;

    return [
      {
        label: "Ancho de rollo",
        value: `${formatMmAsCm(costosPreview.resumenTecnico.anchoRolloMm)} cm`,
      },
      {
        label: "Panelizado",
        value: costosPreview.resumenTecnico.panelizado
          ? `${costosPreview.resumenTecnico.panelCount} panel(es)`
          : "No",
      },
      ...(costosPreview.resumenTecnico.panelizado
        ? [
            {
              label: "Modo",
              value: getPanelizadoModoLabel(costosPreview.resumenTecnico.panelMode),
            },
            {
              label: "Dirección",
              value:
                costosPreview.resumenTecnico.panelAxis === "vertical" ? "Vertical" : "Horizontal",
            },
            {
              label: "Ancho máx. panel",
              value: costosPreview.resumenTecnico.panelMaxWidthMm != null
                ? `${formatMmAsCm(costosPreview.resumenTecnico.panelMaxWidthMm)} cm`
                : "Sin dato",
            },
            {
              label: "Interpretación",
              value: getPanelizadoInterpretacionLabel(
                costosPreview.resumenTecnico.panelWidthInterpretation,
              ),
            },
          ]
        : []),
      {
        label: "Cantidad de piezas",
        value: formatNumber(costosPreview.nestingPreview.pieces.length, 0),
      },
      {
        label: "Desperdicio",
        value: `${formatNumber(costosPreview.resumenTecnico.desperdicioPct, 2)}%`,
      },
      {
        label: "M2 impresos",
        value: `${formatNumber(costosPreview.resumenTecnico.areaUtilM2, 3)} m2`,
      },
      {
        label: "Tiempo de impresión",
        value: tiempoImpresionMin !== null ? `${formatNumber(tiempoImpresionMin, 2)} min` : "Sin dato",
      },
    ];
  }, [costosPreview]);
  const simulacionComercial = React.useMemo(
    () =>
      simularPrecioComercial({
        precio: precioForm,
        costoTotal: costosPreview?.totales.tecnico ?? null,
        cantidad: costosPreview?.cantidadTotal ?? null,
      }),
    [costosPreview?.cantidadTotal, costosPreview?.totales.tecnico, precioForm],
  );
  const imposicion3dResumen = React.useMemo(() => {
    if (!imposicionBestCandidate) {
      return null;
    }

    return [
      {
        label: "Ancho de rollo",
        value: `${formatMmAsCm(imposicionBestCandidate.rollWidthMm)} cm`,
      },
      {
        label: "Panelizado",
        value: imposicionBestCandidate.panelizado
          ? `${imposicionBestCandidate.panelCount} panel(es)`
          : "No",
      },
      ...(imposicionBestCandidate.panelizado
        ? [
            {
              label: "Modo",
              value: getPanelizadoModoLabel(imposicionBestCandidate.panelMode),
            },
            {
              label: "Dirección",
              value: imposicionBestCandidate.panelAxis === "vertical" ? "Vertical" : "Horizontal",
            },
            {
              label: "Ancho máx. panel",
              value:
                imposicionBestCandidate.panelMaxWidthMm != null
                  ? `${formatMmAsCm(imposicionBestCandidate.panelMaxWidthMm)} cm`
                  : "Sin dato",
            },
            {
              label: "Interpretación",
              value: getPanelizadoInterpretacionLabel(
                imposicionBestCandidate.panelWidthInterpretation,
              ),
            },
          ]
        : []),
      {
        label: "Cantidad de piezas",
        value: formatNumber(imposicionBestCandidate.placements.length, 0),
      },
      {
        label: "Desperdicio",
        value: `${formatNumber(imposicionBestCandidate.wastePct, 2)}%`,
      },
      {
        label: "M2 impresos",
        value: `${formatNumber(imposicionBestCandidate.usefulAreaM2, 3)} m2`,
      },
      {
        label: "Largo consumido",
        value: `${formatNumber(imposicionBestCandidate.consumedLengthMm / 1000, 3)} m`,
      },
    ];
  }, [imposicionBestCandidate]);

  React.useEffect(() => {
    const tecnologiasSet = new Set(tecnologiasCompatibles);
    const maquinasSet = new Set(maquinasCompatiblesIds);
    const perfilesSet = new Set(perfilesCompatiblesIds);
    const tecnologiaDefault = imposicionConfig.tecnologiaDefault;
    const maquinaDefaultId = imposicionConfig.maquinaDefaultId;
    const perfilDefaultId = imposicionConfig.perfilDefaultId;
    const hasInvalidTecnologia =
      typeof tecnologiaDefault === "string" && tecnologiaDefault.length > 0 && !tecnologiasSet.has(tecnologiaDefault);
    const hasInvalidMaquina =
      typeof maquinaDefaultId === "string" && maquinaDefaultId.length > 0 && !maquinasSet.has(maquinaDefaultId);
    const hasInvalidPerfil =
      typeof perfilDefaultId === "string" && perfilDefaultId.length > 0 && !perfilesSet.has(perfilDefaultId);

    if (!hasInvalidTecnologia && !hasInvalidMaquina && !hasInvalidPerfil) {
      return;
    }

    setImposicionConfig((prev) => {
      const next: GranFormatoImposicionConfig = { ...prev };
      if (next.tecnologiaDefault && !tecnologiasSet.has(next.tecnologiaDefault)) {
        next.tecnologiaDefault = null;
      }

      if (next.maquinaDefaultId && !maquinasSet.has(next.maquinaDefaultId)) {
        next.maquinaDefaultId = null;
      }

      if (next.perfilDefaultId && !perfilesSet.has(next.perfilDefaultId)) {
        next.perfilDefaultId = null;
      }

      return normalizeImposicionSnapshot(next) === normalizeImposicionSnapshot(prev) ? prev : next;
    });
  }, [
    imposicionConfig.maquinaDefaultId,
    imposicionConfig.perfilDefaultId,
    imposicionConfig.tecnologiaDefault,
    maquinasCompatiblesIds,
    perfilesCompatiblesIds,
    tecnologiasCompatibles,
  ]);

  React.useEffect(() => {
    const needsTecnologiaDefault = !imposicionConfig.tecnologiaDefault && imposicionTechnologies.length > 0;
    const needsMaquinaDefault = !imposicionConfig.maquinaDefaultId && imposicionMachineOptions.length > 0;
    const needsPerfilDefault = !imposicionConfig.perfilDefaultId && imposicionProfileOptions.length > 0;

    if (!needsTecnologiaDefault && !needsMaquinaDefault && !needsPerfilDefault) {
      return;
    }

    setImposicionConfig((prev) => {
      const next = { ...prev };

      if (!next.tecnologiaDefault && imposicionTechnologies.length > 0) {
        next.tecnologiaDefault = imposicionTechnologies[0];
      }
      if (!next.maquinaDefaultId && imposicionMachineOptions.length > 0) {
        next.maquinaDefaultId = imposicionMachineOptions[0].id;
      }
      if (!next.perfilDefaultId && imposicionProfileOptions.length > 0) {
        next.perfilDefaultId = imposicionProfileOptions[0].id;
      }

      return normalizeImposicionSnapshot(next) === normalizeImposicionSnapshot(prev) ? prev : next;
    });
  }, [
    imposicionConfig.maquinaDefaultId,
    imposicionConfig.perfilDefaultId,
    imposicionConfig.tecnologiaDefault,
    imposicionMachineOptions,
    imposicionProfileOptions,
    imposicionTechnologies,
  ]);

  React.useEffect(() => {
    const hasOverride =
      imposicionConfig.margenLateralIzquierdoMmOverride != null ||
      imposicionConfig.margenLateralDerechoMmOverride != null ||
      imposicionConfig.margenInicioMmOverride != null ||
      imposicionConfig.margenFinalMmOverride != null;
    if (hasOverride) {
      setShowImposicionOverrides(true);
    }
  }, [
    imposicionConfig.margenFinalMmOverride,
    imposicionConfig.margenInicioMmOverride,
    imposicionConfig.margenLateralDerechoMmOverride,
    imposicionConfig.margenLateralIzquierdoMmOverride,
  ]);

  React.useEffect(() => {
    if (!costosTecnologia && costosTechnologies.length > 0) {
      setCostosTecnologia(costosTechnologies[0]);
    }
  }, [costosTecnologia, costosTechnologies]);

  React.useEffect(() => {
    setCostosChecklistRespuestas({});
  }, [checklistCotizadorGranFormato]);

  React.useEffect(() => {
    if (costosPanelizadoEsTemporal) {
      return;
    }
    setCostosPanelizadoModo(imposicionConfig.panelizadoModo ?? "automatico");
    setCostosPanelizadoManualLayout(
      imposicionConfig.panelizadoManualLayout
        ? cloneGranFormatoImposicionConfig(imposicionConfig).panelizadoManualLayout
        : null,
    );
  }, [
    costosPanelizadoEsTemporal,
    imposicionConfig,
  ]);

  React.useEffect(() => {
    if (
      costosPerfilOverrideId &&
      !costosProfileOptions.some((item) => item.id === costosPerfilOverrideId)
    ) {
      setCostosPerfilOverrideId("");
    }
  }, [costosPerfilOverrideId, costosProfileOptions]);

  React.useEffect(() => {
    const next = maquinasCompatiblesIds.filter((id) => filteredMachineIds.has(id));
    if (JSON.stringify(next) !== JSON.stringify(maquinasCompatiblesIds)) {
      setMaquinasCompatiblesIds(next);
    }
  }, [filteredMachineIds, maquinasCompatiblesIds]);

  React.useEffect(() => {
    const next = perfilesCompatiblesIds.filter((id) => validProfileIds.has(id));
    if (JSON.stringify(next) !== JSON.stringify(perfilesCompatiblesIds)) {
      setPerfilesCompatiblesIds(next);
    }
  }, [validProfileIds, perfilesCompatiblesIds]);

  React.useEffect(() => {
    const next = materialesCompatiblesIds.filter((id) => validMaterialVariantIds.has(id));
    if (JSON.stringify(next) !== JSON.stringify(materialesCompatiblesIds)) {
      setMaterialesCompatiblesIds(next);
    }
  }, [validMaterialVariantIds, materialesCompatiblesIds]);

  const isConfigDirty =
    JSON.stringify([...tecnologiasCompatibles].sort()) !== JSON.stringify([...savedTecnologiasCompatibles].sort()) ||
    JSON.stringify([...maquinasCompatiblesIds].sort()) !== JSON.stringify([...savedMaquinasCompatiblesIds].sort()) ||
    JSON.stringify([...perfilesCompatiblesIds].sort()) !== JSON.stringify([...savedPerfilesCompatiblesIds].sort()) ||
    materialBaseId !== savedMaterialBaseId ||
    JSON.stringify([...materialesCompatiblesIds].sort()) !== JSON.stringify([...savedMaterialesCompatiblesIds].sort()) ||
    normalizeImposicionSnapshot(imposicionConfig) !== savedImposicionSnapshot;
  const persistedPrecio = React.useMemo(
    () =>
      buildWideFormatPrecioConfigDraft(
        productoState.precio,
        normalizeUnidadComercialProducto(productoState.unidadComercial),
      ),
    [productoState.precio, productoState.unidadComercial],
  );
  const isPrecioDirty = JSON.stringify(precioForm) !== JSON.stringify(persistedPrecio);

  const machineById = React.useMemo(() => new Map(maquinas.map((item) => [item.id, item])), [maquinas]);
  const routeBasePlantillasActivas = plantillasPaso.filter((item) => item.activo);
  const routeBasePlantillaById = React.useMemo(
    () => new Map(routeBasePlantillasActivas.map((item) => [item.id, item])),
    [routeBasePlantillasActivas],
  );
  const routeBaseProceso = React.useMemo(
    () => procesos.find((item) => item.id === rutaBaseProcesoId) ?? null,
    [procesos, rutaBaseProcesoId],
  );
  const maquinasCompatiblesSet = React.useMemo(() => new Set(maquinasCompatiblesIds), [maquinasCompatiblesIds]);
  const tecnologiasCompatiblesSet = React.useMemo(() => new Set(tecnologiasCompatibles), [tecnologiasCompatibles]);
  const selectedProfilesByMachine = React.useMemo(() => {
    const next = new Map<string, typeof selectedMachines[number]["perfilesOperativos"]>();
    for (const machine of selectedMachines) {
      next.set(
        machine.id,
        machine.perfilesOperativos.filter((profile) => profile.activo),
      );
    }
    return next;
  }, [selectedMachines]);
  const syncProductoCommercialState = React.useCallback((updated: typeof productoState) => {
    setProductoState(updated);
    const nextPrecio = buildWideFormatPrecioConfigDraft(
      updated.precio,
      normalizeUnidadComercialProducto(updated.unidadComercial),
    );
    setPrecioForm(nextPrecio);
    setPrecioEditorDraft(nextPrecio);
    setPrecioEspecialClientesForm(updated.precioEspecialClientes ?? []);
  }, []);

  React.useEffect(() => {
    syncProductoCommercialState(producto);
  }, [producto, syncProductoCommercialState]);

  const rutaBasePrintingPlantillas = React.useMemo(
    () => {
      if (!routeBaseProceso) {
        return [];
      }

      const resolvedIds = new Set(
        routeBaseProceso.operaciones
          .map((operation) => {
            const detalle =
              (operation.detalle ?? null) as Record<string, unknown> | null;
            const directId = getPasoPlantillaIdFromDetalle(detalle);
            if (directId) {
              return directId;
            }

            const nombre = operation.nombre?.trim().toLowerCase() ?? "";
            const nombreBase = normalizePasoNombreBase(operation.nombre);
            if (!nombre) {
              return "";
            }

            const exactWithMachine =
              routeBasePlantillasActivas.find(
                (item) =>
                  item.nombre.trim().toLowerCase() === nombre &&
                  (item.maquinaId ?? "") === (operation.maquinaId ?? ""),
              ) ?? null;
            if (exactWithMachine) {
              return exactWithMachine.id;
            }

            const exactWithProfile =
              routeBasePlantillasActivas.find(
                (item) =>
                  Boolean(item.perfilOperativoId) &&
                  item.perfilOperativoId === (operation.perfilOperativoId ?? "") &&
                  (item.maquinaId ?? "") === (operation.maquinaId ?? ""),
              ) ?? null;
            if (exactWithProfile) {
              return exactWithProfile.id;
            }

            const baseWithMachine =
              routeBasePlantillasActivas.find(
                (item) =>
                  normalizePasoNombreBase(item.nombre) === nombreBase &&
                  (item.maquinaId ?? "") === (operation.maquinaId ?? ""),
              ) ?? null;
            if (baseWithMachine) {
              return baseWithMachine.id;
            }

            const exact =
              routeBasePlantillasActivas.find(
                (item) => item.nombre.trim().toLowerCase() === nombre,
              ) ?? null;
            if (exact) {
              return exact.id;
            }

            const base =
              routeBasePlantillasActivas.find(
                (item) => normalizePasoNombreBase(item.nombre) === nombreBase,
              ) ?? null;
            return base?.id ?? "";
          })
          .filter(Boolean),
      );

      return routeBasePlantillasActivas.filter((item) => {
        if (!item.maquinaId || !resolvedIds.has(item.id)) {
          return false;
        }
        const machine = machineById.get(item.maquinaId);
        if (!machine || !maquinasCompatiblesSet.has(machine.id)) {
          return false;
        }
        const tecnologia = getMaquinaTecnologia(machine);
        return Boolean(tecnologia && tecnologiasCompatiblesSet.has(tecnologia));
      });
    },
    [routeBasePlantillasActivas, routeBaseProceso, machineById, maquinasCompatiblesSet, tecnologiasCompatiblesSet],
  );
  const currentRutaBaseSnapshot = React.useMemo(
    () => normalizeRutaBaseDraftSnapshot(rutaBaseProcesoId, rutaBaseReglasImpresion),
    [rutaBaseProcesoId, rutaBaseReglasImpresion],
  );
  const isRutaBaseDirty = currentRutaBaseSnapshot !== savedRutaBaseSnapshot;
  const tecnologiasChecklistDisponibles = React.useMemo(
    () => tecnologiasCompatibles.filter((item) => Boolean(item)),
    [tecnologiasCompatibles],
  );
  const checklistActivo = React.useMemo(() => {
    if (aplicaChecklistATodasLasTecnologias) {
      return checklistComun;
    }
    return (
      checklistsPorTecnologia[tecnologiaChecklistSeleccionada] ??
      createEmptyChecklist(productoState.id)
    );
  }, [
    aplicaChecklistATodasLasTecnologias,
    checklistComun,
    checklistsPorTecnologia,
    tecnologiaChecklistSeleccionada,
    productoState.id,
  ]);
  const checklistRutaPasoOptions = React.useMemo(() => {
    if (!routeBaseProceso) {
      return [];
    }
    const baseSteps = routeBaseProceso.operaciones
      .map((operation) =>
        resolveProcesoOperacionPlantilla(
          {
            nombre: operation.nombre,
            maquinaId: operation.maquinaId,
            perfilOperativoId: operation.perfilOperativoId,
            detalle:
              (operation.detalle ?? null) as Record<string, unknown> | null,
          },
          plantillasPaso,
        ),
      )
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => ({ id: item.id, label: item.nombre }));

    const rulesToUse = aplicaChecklistATodasLasTecnologias
      ? rutaBaseReglasImpresion
      : rutaBaseReglasImpresion.filter(
          (item) => item.tecnologia === tecnologiaChecklistSeleccionada,
        );
    const ruleSteps = rulesToUse
      .map((item) => routeBasePlantillaById.get(item.pasoPlantillaId) ?? null)
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => ({ id: item.id, label: item.nombre }));

    return Array.from(
      new Map([...baseSteps, ...ruleSteps].map((item) => [item.id, item])).values(),
    );
  }, [
    routeBaseProceso,
    plantillasPaso,
    aplicaChecklistATodasLasTecnologias,
    rutaBaseReglasImpresion,
    tecnologiaChecklistSeleccionada,
    routeBasePlantillaById,
  ]);

  React.useEffect(() => {
    if (!tecnologiasChecklistDisponibles.length) {
      setTecnologiaChecklistSeleccionada("");
      return;
    }
    setTecnologiaChecklistSeleccionada((prev) =>
      prev && tecnologiasChecklistDisponibles.includes(prev)
        ? prev
        : tecnologiasChecklistDisponibles[0],
    );
  }, [tecnologiasChecklistDisponibles]);

  React.useEffect(() => {
    const next = rutaBaseReglasImpresion
      .map((item) => {
        if (!item.tecnologia || !tecnologiasCompatiblesSet.has(item.tecnologia)) {
          return {
            ...item,
            tecnologia: tecnologiasCompatibles[0] ?? "",
            maquinaId: "",
            pasoPlantillaId: "",
            perfilOperativoDefaultId: "",
          };
        }
        const machineOptions = selectedMachines.filter(
          (machine) => getMaquinaTecnologia(machine) === item.tecnologia,
        );
        const maquinaId =
          item.maquinaId && machineOptions.some((machine) => machine.id === item.maquinaId) ? item.maquinaId : "";
        const printingOptions = rutaBasePrintingPlantillas.filter((plantilla) => {
          if (!plantilla.maquinaId) return false;
          const machine = machineById.get(plantilla.maquinaId);
          if (!machine) return false;
          if (getMaquinaTecnologia(machine) !== item.tecnologia) return false;
          return maquinaId ? plantilla.maquinaId === maquinaId : true;
        });
        const pasoPlantillaId =
          item.pasoPlantillaId &&
          (printingOptions.some((plantilla) => plantilla.id === item.pasoPlantillaId) ||
            routeBasePlantillaById.has(item.pasoPlantillaId))
            ? item.pasoPlantillaId
            : "";
        const plantilla = pasoPlantillaId ? routeBasePlantillaById.get(pasoPlantillaId) ?? null : null;
        const profiles = plantilla?.maquinaId ? selectedProfilesByMachine.get(plantilla.maquinaId) ?? [] : [];
        return {
          ...item,
          maquinaId,
          pasoPlantillaId,
          perfilOperativoDefaultId: profiles.some((profile) => profile.id === item.perfilOperativoDefaultId)
            ? item.perfilOperativoDefaultId
            : "",
        };
      })
      .filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index);

    if (normalizeRutaBaseReglasSnapshot(next) !== normalizeRutaBaseReglasSnapshot(rutaBaseReglasImpresion)) {
      setRutaBaseReglasImpresion(next);
    }
  }, [
    tecnologiasCompatibles,
    tecnologiasCompatiblesSet,
    selectedMachines,
    rutaBasePrintingPlantillas,
    routeBasePlantillaById,
    machineById,
    selectedProfilesByMachine,
    rutaBaseReglasImpresion,
  ]);

  const handleSaveRutaBase = () => {
    startSavingRutaBase(async () => {
      try {
        const updated = await updateGranFormatoRutaBase(productoState.id, {
          procesoDefinicionId: rutaBaseProcesoId || null,
          reglasImpresion: rutaBaseReglasImpresion
            .filter((item) => item.tecnologia && item.pasoPlantillaId)
            .map((item) => ({
              tecnologia: item.tecnologia,
              maquinaId: item.maquinaId || null,
              pasoPlantillaId: item.pasoPlantillaId,
              perfilOperativoDefaultId: item.perfilOperativoDefaultId || null,
            })),
        });
        const nextReglas = updated.reglasImpresion.map((item) => ({
          id: item.id || crypto.randomUUID(),
          tecnologia: item.tecnologia,
          maquinaId: item.maquinaId ?? "",
          pasoPlantillaId: item.pasoPlantillaId,
          perfilOperativoDefaultId: item.perfilOperativoDefaultId ?? "",
        }));
        setRutaBaseProcesoId(updated.procesoDefinicionId ?? "");
        setRutaBaseReglasImpresion(nextReglas);
        setSavedRutaBaseSnapshot(
          normalizeRutaBaseDraftSnapshot(updated.procesoDefinicionId ?? "", nextReglas),
        );
        toast.success("Ruta base actualizada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la ruta base.");
      }
    });
  };

  const handleSaveGranFormatoChecklist = React.useCallback(
    async (payload: ProductoChecklistPayload) => {
      const nextChecklistsPorTecnologia = { ...checklistsPorTecnologia };
      if (!aplicaChecklistATodasLasTecnologias && tecnologiaChecklistSeleccionada) {
        nextChecklistsPorTecnologia[tecnologiaChecklistSeleccionada] = {
          ...checklistActivo,
          activo: payload.activo ?? true,
          preguntas: checklistActivo.preguntas,
        };
      }

      const updated = await updateGranFormatoChecklist(productoState.id, {
        aplicaATodasLasTecnologias: aplicaChecklistATodasLasTecnologias,
        checklistComun: aplicaChecklistATodasLasTecnologias ? payload : undefined,
        checklistsPorTecnologia: tecnologiasChecklistDisponibles.map((tecnologia) => ({
          tecnologia,
          checklist:
            tecnologia === tecnologiaChecklistSeleccionada && !aplicaChecklistATodasLasTecnologias
              ? payload
              : toChecklistPayload(
                  nextChecklistsPorTecnologia[tecnologia] ?? createEmptyChecklist(productoState.id),
                ),
        })),
      });

      setAplicaChecklistATodasLasTecnologias(updated.aplicaATodasLasTecnologias);
      setChecklistComun(updated.checklistComun);
      setChecklistsPorTecnologia(
        Object.fromEntries(
          updated.checklistsPorTecnologia.map((item) => [item.tecnologia, item.checklist]),
        ),
      );
      setChecklistDirty(false);
      return aplicaChecklistATodasLasTecnologias
        ? updated.checklistComun
        : updated.checklistsPorTecnologia.find(
            (item) => item.tecnologia === tecnologiaChecklistSeleccionada,
          )?.checklist ?? createEmptyChecklist(productoState.id);
    },
    [
      aplicaChecklistATodasLasTecnologias,
      checklistActivo,
      checklistsPorTecnologia,
      productoState.id,
      tecnologiaChecklistSeleccionada,
      tecnologiasChecklistDisponibles,
    ],
  );

  const handleToggleChecklistScope = React.useCallback(
    (checked: boolean) => {
      if (checklistDirty) {
        toast.error("Guardá primero los cambios del checklist antes de cambiar el alcance.");
        return;
      }
      startSavingChecklistScope(async () => {
        try {
          const updated = await updateGranFormatoChecklist(productoState.id, {
            aplicaATodasLasTecnologias: checked,
            checklistComun: toChecklistPayload(checklistComun),
            checklistsPorTecnologia: tecnologiasChecklistDisponibles.map((tecnologia) => ({
              tecnologia,
              checklist: toChecklistPayload(
                checklistsPorTecnologia[tecnologia] ?? createEmptyChecklist(productoState.id),
              ),
            })),
          });
          setAplicaChecklistATodasLasTecnologias(updated.aplicaATodasLasTecnologias);
          setChecklistComun(updated.checklistComun);
          setChecklistsPorTecnologia(
            Object.fromEntries(
              updated.checklistsPorTecnologia.map((item) => [item.tecnologia, item.checklist]),
            ),
          );
          setChecklistDirty(false);
          toast.success("Alcance de la ruta de opcionales guardado.");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "No se pudo guardar el alcance del checklist.");
        }
      });
    },
    [
      checklistDirty,
      productoState.id,
      checklistComun,
      tecnologiasChecklistDisponibles,
      checklistsPorTecnologia,
    ],
  );

  const handleSaveGeneral = () => {
    if (!generalForm.nombre.trim()) {
      toast.error("El nombre del producto es obligatorio.");
      return;
    }

    startSavingGeneral(async () => {
      try {
        const updated = await updateProductoServicio(productoState.id, {
          codigo: productoState.codigo,
          nombre: generalForm.nombre.trim(),
          descripcion: generalForm.descripcion.trim(),
          familiaProductoId: generalForm.familiaProductoId,
          subfamiliaProductoId: generalForm.subfamiliaProductoId || undefined,
          unidadComercial: generalForm.unidadComercial,
          motorCodigo: generalForm.motorCodigo,
          motorVersion: generalForm.motorVersion,
          estado: productoState.estado,
          activo: productoState.activo,
        });
        const motorChanged =
          updated.motorCodigo !== generalForm.motorCodigo ||
          updated.motorVersion !== generalForm.motorVersion;
        const withMotor = motorChanged
          ? await assignProductoMotor(updated.id, {
              motorCodigo: generalForm.motorCodigo,
              motorVersion: generalForm.motorVersion,
            })
          : updated;
        syncProductoCommercialState(withMotor);
        setGeneralForm({
          nombre: withMotor.nombre,
          descripcion: withMotor.descripcion ?? "",
          familiaProductoId: withMotor.familiaProductoId,
          subfamiliaProductoId: withMotor.subfamiliaProductoId ?? "",
          unidadComercial: normalizeUnidadComercialProducto(withMotor.unidadComercial),
          motorCodigo: withMotor.motorCodigo,
          motorVersion: withMotor.motorVersion,
        });
        toast.success("Datos generales actualizados.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar el producto.");
      }
    });
  };

  const handleSavePrecio = (draftPrecio: ProductoPrecioConfig = precioForm, closeEditor = false) => {
    startSavingPrecio(async () => {
      try {
        const updated = await updateProductoPrecio(productoState.id, {
          metodoCalculo: draftPrecio.metodoCalculo,
          measurementUnit: draftPrecio.measurementUnit,
          impuestos: draftPrecio.impuestos,
          comisiones: draftPrecio.comisiones,
          detalle: draftPrecio.detalle as Record<string, unknown>,
        });
        syncProductoCommercialState(updated);
        if (closeEditor) {
          setPrecioEditorOpen(false);
        }
        toast.success("Configuración de precio actualizada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la configuración de precio.");
      }
    });
  };

  const persistPrecioComisiones = (
    nextComisiones: ProductoPrecioConfig["comisiones"],
    options?: { successMessage?: string; onSuccess?: () => void },
  ) => {
    const nextPrecio = { ...precioForm, comisiones: nextComisiones } as ProductoPrecioConfig;
    setPrecioForm(nextPrecio);
    setPrecioEditorDraft((current) => ({ ...current, comisiones: nextComisiones }));

    startSavingPrecio(async () => {
      try {
        const updated = await updateProductoPrecio(productoState.id, {
          metodoCalculo: nextPrecio.metodoCalculo,
          measurementUnit: nextPrecio.measurementUnit,
          impuestos: nextPrecio.impuestos,
          comisiones: nextPrecio.comisiones,
          detalle: nextPrecio.detalle as Record<string, unknown>,
        });
        syncProductoCommercialState(updated);
        options?.onSuccess?.();
        toast.success(options?.successMessage ?? "Comisiones actualizadas.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudieron guardar las comisiones.");
      }
    });
  };

  const handleChangeMetodoCalculoPrecio = (metodoCalculo: MetodoCalculoPrecioProducto) => {
    const unidadComercial = normalizeUnidadComercialProducto(productoState.unidadComercial);
    const basePrecio = buildWideFormatPrecioConfigDraft(precioForm, unidadComercial);
    const nextMeasurementUnit = normalizeWideFormatMeasurementUnit(basePrecio.measurementUnit, unidadComercial);
    const next = {
      ...buildPrecioConfigForMethod(metodoCalculo, nextMeasurementUnit),
      impuestos: {
        esquemaId: basePrecio.impuestos.esquemaId,
        esquemaNombre: basePrecio.impuestos.esquemaNombre,
        items: basePrecio.impuestos.items.map((item) => ({ ...item })),
        porcentajeTotal: basePrecio.impuestos.porcentajeTotal,
      },
      comisiones: {
        items: basePrecio.comisiones.items.map((item) => ({ ...item })),
        porcentajeTotal: basePrecio.comisiones.porcentajeTotal,
      },
    } as ProductoPrecioConfig;
    setPrecioForm(next);
    setPrecioEditorDraft(next);
  };

  const handleOpenPrecioComisionEditor = (item?: ProductoPrecioComisionItem) => {
    setPrecioComisionEditorDraft(buildPrecioComisionDraft(item));
    setPrecioComisionEditorOpen(true);
  };

  const handleSavePrecioComisionDraft = () => {
    if (!precioComisionEditorDraft.nombre.trim()) {
      toast.error("El nombre de la comisión es obligatorio.");
      return;
    }
    const nextItem: ProductoPrecioComisionItem = {
      ...precioComisionEditorDraft,
      nombre: precioComisionEditorDraft.nombre.trim(),
      porcentaje: Number(precioComisionEditorDraft.porcentaje || 0),
    };
    const nextItems = precioForm.comisiones.items.some((item) => item.id === nextItem.id)
      ? precioForm.comisiones.items.map((item) => (item.id === nextItem.id ? nextItem : item))
      : [...precioForm.comisiones.items, nextItem];
    const comisiones = {
      items: nextItems,
      porcentajeTotal: Number(
        nextItems
          .filter((item) => item.activo)
          .reduce((sum, item) => sum + Number(item.porcentaje || 0), 0)
          .toFixed(4),
      ),
    };
    persistPrecioComisiones(comisiones, {
      successMessage: "Comisión guardada.",
      onSuccess: () => setPrecioComisionEditorOpen(false),
    });
  };

  const handleTogglePrecioComision = (itemId: string, activo: boolean) => {
    const nextItems = precioForm.comisiones.items.map((item) =>
      item.id === itemId ? { ...item, activo } : item,
    );
    const comisiones = {
      items: nextItems,
      porcentajeTotal: Number(
        nextItems
          .filter((item) => item.activo)
          .reduce((sum, item) => sum + Number(item.porcentaje || 0), 0)
          .toFixed(4),
      ),
    };
    persistPrecioComisiones(comisiones, { successMessage: "Estado de comisión actualizado." });
  };

  const handleDeletePrecioComision = (itemId: string) => {
    const nextItems = precioForm.comisiones.items.filter((item) => item.id !== itemId);
    const comisiones = {
      items: nextItems,
      porcentajeTotal: Number(
        nextItems
          .filter((item) => item.activo)
          .reduce((sum, item) => sum + Number(item.porcentaje || 0), 0)
          .toFixed(4),
      ),
    };
    persistPrecioComisiones(comisiones, {
      successMessage: "Comisión eliminada.",
      onSuccess: () => setPrecioComisionToDelete(null),
    });
  };

  const handleChangeImpuestoEsquema = (esquemaId: string | null) => {
    const esquema = impuestosCatalogoActivos.find((item) => item.id === esquemaId) ?? null;
    const impuestos = esquema
      ? {
          esquemaId: esquema.id,
          esquemaNombre: esquema.nombre,
          items: esquema.detalle.items,
          porcentajeTotal: esquema.porcentaje,
        }
      : buildDefaultPrecioImpuestos();
    setPrecioForm((current) => ({ ...current, impuestos }));
    setPrecioEditorDraft((current) => ({ ...current, impuestos }));
  };

  const handleOpenImpuestosEditor = () => {
    const current = impuestosCatalogo.find((item) => item.id === precioForm.impuestos.esquemaId) ?? impuestosCatalogoActivos[0] ?? null;
    setImpuestosEditorDraft(current ? { ...current, detalle: { items: current.detalle.items.map((item) => ({ ...item })) } } : null);
    setImpuestosEditorOpen(true);
  };

  const handleSaveImpuestosEditor = () => {
    if (!impuestosEditorDraft) {
      toast.error("Selecciona un esquema impositivo.");
      return;
    }
    const porcentaje = Number(
      impuestosEditorDraft.detalle.items.reduce((sum, item) => sum + Number(item.porcentaje || 0), 0).toFixed(4),
    );
    startSavingImpuestosCatalogo(async () => {
      try {
        const updated = await updateProductoImpuesto(impuestosEditorDraft.id, {
          codigo: impuestosEditorDraft.codigo,
          nombre: impuestosEditorDraft.nombre,
          porcentaje,
          detalle: {
            items: impuestosEditorDraft.detalle.items.map((item) => ({
              nombre: item.nombre,
              porcentaje: Number(item.porcentaje || 0),
            })),
          },
          activo: impuestosEditorDraft.activo,
        });
        setImpuestosCatalogo((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setImpuestosEditorDraft(updated);
        if (precioForm.impuestos.esquemaId === updated.id) {
          handleChangeImpuestoEsquema(updated.id);
        }
        setImpuestosEditorOpen(false);
        toast.success("Impuestos actualizados.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar el esquema impositivo.");
      }
    });
  };

  const handleOpenPrecioEditor = () => {
    setPrecioEditorDraft(
      buildWideFormatPrecioConfigDraft(
        precioForm,
        normalizeUnidadComercialProducto(productoState.unidadComercial),
      ),
    );
    setPrecioEditorOpen(true);
  };

  const handleCancelPrecioEditor = () => {
    setPrecioEditorDraft(
      buildWideFormatPrecioConfigDraft(
        precioForm,
        normalizeUnidadComercialProducto(productoState.unidadComercial),
      ),
    );
    setPrecioEditorOpen(false);
  };

  const handleSavePrecioFromEditor = () => {
    const nextPrecio = buildWideFormatPrecioConfigDraft(
      precioEditorDraft,
      normalizeUnidadComercialProducto(productoState.unidadComercial),
    );
    setPrecioForm(nextPrecio);
    handleSavePrecio(nextPrecio, true);
  };

  const handleOpenPrecioEspecialClienteEditor = (item?: ProductoPrecioEspecialCliente) => {
    setPrecioEspecialClienteEditorDraft(
      buildWideFormatPrecioEspecialClienteDraft(
        item,
        normalizeUnidadComercialProducto(productoState.unidadComercial),
      ),
    );
    setPrecioEspecialClienteEditorOpen(true);
  };

  const handleChangeMetodoCalculoPrecioEspecialCliente = (metodoCalculo: MetodoCalculoPrecioProducto) => {
    const nextMeasurementUnit = normalizeWideFormatMeasurementUnit(
      precioEspecialClienteEditorDraft.measurementUnit,
      normalizeUnidadComercialProducto(productoState.unidadComercial),
    );
    updatePrecioEspecialClienteEditorDraft((current) => ({
      ...current,
      ...buildPrecioConfigForMethod(metodoCalculo, nextMeasurementUnit),
      clienteId: current.clienteId,
      clienteNombre: current.clienteNombre,
      descripcion: current.descripcion,
      activo: current.activo,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: current.updatedAt,
    }));
  };

  const persistPrecioEspecialClientes = (
    nextItems: ProductoPrecioEspecialCliente[],
    options?: { successMessage?: string; onSuccess?: (updated: typeof productoState) => void },
  ) => {
    startSavingPrecioEspecialClientes(async () => {
      try {
        const updated = await updateProductoPrecioEspecialClientes(productoState.id, {
          items: nextItems.map((item) => ({
            id: item.id,
            clienteId: item.clienteId,
            clienteNombre: item.clienteNombre,
            descripcion: item.descripcion,
            activo: item.activo,
            metodoCalculo: item.metodoCalculo,
            measurementUnit: item.measurementUnit,
            detalle: item.detalle as Record<string, unknown>,
          })),
        });
        syncProductoCommercialState(updated);
        options?.onSuccess?.(updated);
        toast.success(options?.successMessage ?? "Precios especiales guardados.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudieron guardar los precios especiales.");
      }
    });
  };

  const handleSavePrecioEspecialClienteDraft = () => {
    if (!precioEspecialClienteEditorDraft.clienteId) {
      toast.error("Selecciona un cliente.");
      return;
    }
    const selectedCliente = clientesOptions.find((item) => item.id === precioEspecialClienteEditorDraft.clienteId);
    if (!selectedCliente) {
      toast.error("El cliente seleccionado no existe.");
      return;
    }
    const nextItem = buildPrecioEspecialClienteFromDraft(
      precioEspecialClienteEditorDraft,
      selectedCliente.nombre,
      new Date().toISOString(),
    );
    const nextItems = precioEspecialClientesForm.some((item) => item.id === nextItem.id)
      ? precioEspecialClientesForm.map((item) => (item.id === nextItem.id ? nextItem : item))
      : [...precioEspecialClientesForm, nextItem];
    persistPrecioEspecialClientes(nextItems, {
      successMessage: "Precio especial guardado.",
      onSuccess: () => setPrecioEspecialClienteEditorOpen(false),
    });
  };

  const handleTogglePrecioEspecialCliente = (itemId: string, activo: boolean) => {
    const nextItems = precioEspecialClientesForm.map((item) =>
      item.id === itemId ? { ...item, activo, updatedAt: new Date().toISOString() } : item,
    );
    persistPrecioEspecialClientes(nextItems, { successMessage: "Estado del precio especial actualizado." });
  };

  const handleDeletePrecioEspecialCliente = (itemId: string) => {
    const nextItems = precioEspecialClientesForm.filter((item) => item.id !== itemId);
    persistPrecioEspecialClientes(nextItems, { successMessage: "Precio especial eliminado." });
  };

  const updatePrecioEspecialClienteEditorDraft = (
    updater: (current: PrecioEspecialClienteDraft) => PrecioEspecialClienteDraft,
  ) => {
    setPrecioEspecialClienteEditorDraft((current) => updater(current));
  };

  const addPrecioEspecialClienteTierRow = () => {
    updatePrecioEspecialClienteEditorDraft((current) => {
      if (current.metodoCalculo === "fijado_por_cantidad") {
        const draft = current as PrecioEspecialClienteDraft & {
          detalle: Extract<ProductoPrecioConfig, { metodoCalculo: "fijado_por_cantidad" }>["detalle"];
        };
        return { ...draft, detalle: { tiers: [...draft.detalle.tiers, { quantity: 1, price: 0 }] } };
      }
      if (current.metodoCalculo === "fijo_con_margen_variable") {
        const draft = current as PrecioEspecialClienteDraft & {
          detalle: Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>["detalle"];
        };
        return { ...draft, detalle: { tiers: [...draft.detalle.tiers, { quantity: 1, marginPct: 0 }] } };
      }
      if (current.metodoCalculo === "variable_por_cantidad") {
        const draft = current as PrecioEspecialClienteDraft & {
          detalle: Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>["detalle"];
        };
        return { ...draft, detalle: { tiers: [...draft.detalle.tiers, { quantityUntil: 1, price: 0 }] } };
      }
      if (current.metodoCalculo === "margen_variable") {
        const draft = current as PrecioEspecialClienteDraft & {
          detalle: Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>["detalle"];
        };
        return { ...draft, detalle: { tiers: [...draft.detalle.tiers, { quantityUntil: 1, marginPct: 0 }] } };
      }
      return current;
    });
  };

  const removePrecioEspecialClienteTierRow = (index: number) => {
    updatePrecioEspecialClienteEditorDraft((current) => {
      if (current.metodoCalculo === "fijado_por_cantidad") {
        const draft = current as PrecioEspecialClienteDraft & {
          detalle: Extract<ProductoPrecioConfig, { metodoCalculo: "fijado_por_cantidad" }>["detalle"];
        };
        return draft.detalle.tiers.length > 1
          ? { ...draft, detalle: { tiers: draft.detalle.tiers.filter((_, rowIndex) => rowIndex !== index) } }
          : current;
      }
      if (current.metodoCalculo === "fijo_con_margen_variable") {
        const draft = current as PrecioEspecialClienteDraft & {
          detalle: Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>["detalle"];
        };
        return draft.detalle.tiers.length > 1
          ? { ...draft, detalle: { tiers: draft.detalle.tiers.filter((_, rowIndex) => rowIndex !== index) } }
          : current;
      }
      if (current.metodoCalculo === "variable_por_cantidad") {
        const draft = current as PrecioEspecialClienteDraft & {
          detalle: Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>["detalle"];
        };
        return draft.detalle.tiers.length > 1
          ? { ...draft, detalle: { tiers: draft.detalle.tiers.filter((_, rowIndex) => rowIndex !== index) } }
          : current;
      }
      if (current.metodoCalculo === "margen_variable") {
        const draft = current as PrecioEspecialClienteDraft & {
          detalle: Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>["detalle"];
        };
        return draft.detalle.tiers.length > 1
          ? { ...draft, detalle: { tiers: draft.detalle.tiers.filter((_, rowIndex) => rowIndex !== index) } }
          : current;
      }
      return current;
    });
  };

  const updatePrecioEditorDraft = (updater: (current: ProductoPrecioConfig) => ProductoPrecioConfig) => {
    setPrecioEditorDraft((current) => updater(current));
  };

  const addPrecioTierRow = () => {
    updatePrecioEditorDraft((current) => {
      if (current.metodoCalculo === "fijado_por_cantidad") {
        const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "fijado_por_cantidad" }>;
        return { ...draft, detalle: { tiers: [...draft.detalle.tiers, { quantity: 1, price: 0 }] } };
      }
      if (current.metodoCalculo === "fijo_con_margen_variable") {
        const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>;
        return { ...draft, detalle: { tiers: [...draft.detalle.tiers, { quantity: 1, marginPct: 0 }] } };
      }
      if (current.metodoCalculo === "variable_por_cantidad") {
        const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>;
        return { ...draft, detalle: { tiers: [...draft.detalle.tiers, { quantityUntil: 1, price: 0 }] } };
      }
      if (current.metodoCalculo === "margen_variable") {
        const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>;
        return { ...draft, detalle: { tiers: [...draft.detalle.tiers, { quantityUntil: 1, marginPct: 0 }] } };
      }
      return current;
    });
  };

  const removePrecioTierRow = (index: number) => {
    updatePrecioEditorDraft((current) => {
      if (current.metodoCalculo === "fijado_por_cantidad") {
        const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "fijado_por_cantidad" }>;
        return draft.detalle.tiers.length > 1
          ? { ...draft, detalle: { tiers: draft.detalle.tiers.filter((_, rowIndex) => rowIndex !== index) } }
          : current;
      }
      if (current.metodoCalculo === "fijo_con_margen_variable") {
        const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>;
        return draft.detalle.tiers.length > 1
          ? { ...draft, detalle: { tiers: draft.detalle.tiers.filter((_, rowIndex) => rowIndex !== index) } }
          : current;
      }
      if (current.metodoCalculo === "variable_por_cantidad") {
        const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>;
        return draft.detalle.tiers.length > 1
          ? { ...draft, detalle: { tiers: draft.detalle.tiers.filter((_, rowIndex) => rowIndex !== index) } }
          : current;
      }
      if (current.metodoCalculo === "margen_variable") {
        const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>;
        return draft.detalle.tiers.length > 1
          ? { ...draft, detalle: { tiers: draft.detalle.tiers.filter((_, rowIndex) => rowIndex !== index) } }
          : current;
      }
      return current;
    });
  };

  const handleSaveTecnologias = () => {
    startSavingConfig(async () => {
      try {
        const updated = await updateGranFormatoConfig(productoState.id, {
          tecnologiasCompatibles,
          maquinasCompatibles: maquinasCompatiblesIds,
          perfilesCompatibles: perfilesCompatiblesIds,
          materialBaseId: materialBaseId || null,
          materialesCompatibles: materialesCompatiblesIds,
          imposicion: imposicionConfig,
        });
        setTecnologiasCompatibles(updated.tecnologiasCompatibles);
        setSavedTecnologiasCompatibles(updated.tecnologiasCompatibles);
        setMaquinasCompatiblesIds(updated.maquinasCompatibles);
        setSavedMaquinasCompatiblesIds(updated.maquinasCompatibles);
        setPerfilesCompatiblesIds(updated.perfilesCompatibles);
        setSavedPerfilesCompatiblesIds(updated.perfilesCompatibles);
        setMaterialBaseId(updated.materialBaseId ?? "");
        setSavedMaterialBaseId(updated.materialBaseId ?? "");
        setMaterialesCompatiblesIds(updated.materialesCompatibles);
        setSavedMaterialesCompatiblesIds(updated.materialesCompatibles);
        const nextImposicion = {
          ...(updated.imposicion ?? defaultGranFormatoImposicionConfig),
          panelizadoInterpretacionAnchoMaximo:
            updated.imposicion?.panelizadoInterpretacionAnchoMaximo ?? "total",
        };
        setImposicionConfig(nextImposicion);
        setSavedImposicionSnapshot(
          normalizeImposicionSnapshot(nextImposicion),
        );
        toast.success("Configuración técnica actualizada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la configuración técnica.");
      }
    });
  };

  const handleSimularImposicion = () => {
    const nextConfig = cloneGranFormatoImposicionConfig(imposicionConfig);
    const shouldResetManualPanelLayout =
      nextConfig.panelizadoActivo &&
      nextConfig.panelizadoModo === "manual" &&
      nextConfig.panelizadoManualLayout != null;
    const effectiveConfig = shouldResetManualPanelLayout
      ? {
          ...nextConfig,
          panelizadoModo: "automatico" as const,
          panelizadoManualLayout: null,
        }
      : nextConfig;
    if (shouldResetManualPanelLayout) {
      setImposicionConfig(effectiveConfig);
    }
    setImposicionSimulationConfig(effectiveConfig);

    const medidasValidas = effectiveConfig.medidas.filter(
      (item) => (item.anchoMm ?? 0) > 0 && (item.altoMm ?? 0) > 0 && (item.cantidad ?? 0) > 0,
    );
    if (!medidasValidas.length) {
      setImposicionPreviewResult(
        createEmptyImposicionPreviewResult("Completá al menos una medida válida para simular la imposición."),
      );
      toast.error("Completá al menos una medida válida para simular la imposición.");
      return;
    }
    if (!imposicionMachine) {
      setImposicionPreviewResult(
        createEmptyImposicionPreviewResult("Seleccioná una máquina compatible para evaluar la imposición."),
      );
      toast.error("Seleccioná una máquina compatible para simular la imposición.");
      return;
    }

    startSimulatingImposicion(async () => {
      try {
        const result = await previewGranFormatoCostos(productoState.id, {
          periodo: costosPeriodo,
          tecnologia: effectiveConfig.tecnologiaDefault ?? undefined,
          persistirSnapshot: false,
          incluirCandidatos: true,
          medidas: medidasValidas.map((item) => ({
            anchoMm: item.anchoMm ?? 0,
            altoMm: item.altoMm ?? 0,
            cantidad: item.cantidad ?? 1,
          })),
          panelizado: {
            activo: effectiveConfig.panelizadoActivo,
            modo: effectiveConfig.panelizadoModo,
            direccion: effectiveConfig.panelizadoDireccion,
            solapeMm: effectiveConfig.panelizadoSolapeMm,
            anchoMaxPanelMm: effectiveConfig.panelizadoAnchoMaxPanelMm,
            distribucion: effectiveConfig.panelizadoDistribucion,
            interpretacionAnchoMaximo: effectiveConfig.panelizadoInterpretacionAnchoMaximo,
            manualLayout:
              effectiveConfig.panelizadoModo === "manual" ? effectiveConfig.panelizadoManualLayout : null,
          },
        });

        const variantById = new Map(imposicionMaterialVariants.map((item) => [item.id, item]));
        const items: GranFormatoImposicionPreviewItem[] = (result.candidatos ?? [])
          .map((candidate) => {
            const variant = variantById.get(candidate.variantId);
            if (!variant) {
              return null;
            }
            return {
              variant,
              rollWidthMm: candidate.rollWidthMm,
              machineLimitedWidthMm:
                candidate.printableWidthMm + candidate.marginLeftMm + candidate.marginRightMm,
              printableWidthMm: candidate.printableWidthMm,
              marginLeftMm: candidate.marginLeftMm,
              marginRightMm: candidate.marginRightMm,
              marginStartMm: candidate.marginStartMm,
              marginEndMm: candidate.marginEndMm,
              orientacion: candidate.orientacion,
              panelizado: candidate.panelizado,
              panelAxis: candidate.panelAxis,
              panelCount: candidate.panelCount,
              panelOverlapMm: candidate.panelOverlapMm,
              panelMaxWidthMm: candidate.panelMaxWidthMm,
              panelDistribution: candidate.panelDistribution,
              panelWidthInterpretation: candidate.panelWidthInterpretation,
              panelMode: candidate.panelMode,
              piecesPerRow: candidate.piecesPerRow,
              rows: candidate.rows,
              consumedLengthMm: candidate.consumedLengthMm,
              usefulAreaM2: candidate.usefulAreaM2,
              consumedAreaM2: candidate.consumedAreaM2,
              wasteAreaM2: candidate.wasteAreaM2,
              wastePct: candidate.wastePct,
              placements: candidate.placements,
              estimatedCostTotal: candidate.totalCost,
            };
          })
          .filter((item): item is GranFormatoImposicionPreviewItem => Boolean(item));

        setImposicionPreviewResult({
          items,
          rejected: [],
          machineIssue:
            items.length > 0
              ? null
              : "No se pudo resolver la imposición con la configuración actual.",
        });
        if (shouldResetManualPanelLayout) {
          toast.info("La simulación se recalculó en automático desde cero.");
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No se pudo simular la imposición.";
        setImposicionPreviewResult(createEmptyImposicionPreviewResult(message));
        toast.error(message);
      }
    });
  };

  const handleCalcularCostos = () => {
    if (checklistDirty) {
      toast.error("Guardá primero los cambios de Ruta de opcionales para costear con el orden real de la ruta.");
      return;
    }

    const medidasValidas = costosMedidas.filter(
      (item) => (item.anchoMm ?? 0) > 0 && (item.altoMm ?? 0) > 0 && (item.cantidad ?? 0) > 0,
    );
    if (!medidasValidas.length) {
      toast.error("Completá al menos una medida válida para calcular costos.");
      return;
    }
    if (!costosTechnology) {
      toast.error("Seleccioná una tecnología para calcular costos.");
      return;
    }

    startCalculatingCosts(async () => {
      try {
        const result = await previewGranFormatoCostos(productoState.id, {
          periodo: costosPeriodo,
          tecnologia: costosTechnology,
          perfilOverrideId: costosPerfilOverrideId || undefined,
          medidas: medidasValidas.map((item) => ({
            anchoMm: item.anchoMm ?? 0,
            altoMm: item.altoMm ?? 0,
            cantidad: item.cantidad ?? 1,
          })),
          checklistRespuestas: Object.entries(costosChecklistRespuestas)
            .filter(([, value]) => Boolean(value?.respuestaId))
            .map(([preguntaId, value]) => ({
              preguntaId,
              respuestaId: value.respuestaId,
            })),
          panelizado: {
            activo: imposicionConfig.panelizadoActivo,
            modo:
              costosPanelizadoModo === "manual" && costosPanelizadoManualLayout
                ? "manual"
                : "automatico",
            direccion: imposicionConfig.panelizadoDireccion,
            solapeMm: imposicionConfig.panelizadoSolapeMm,
            anchoMaxPanelMm: imposicionConfig.panelizadoAnchoMaxPanelMm,
            distribucion: imposicionConfig.panelizadoDistribucion,
            interpretacionAnchoMaximo: imposicionConfig.panelizadoInterpretacionAnchoMaximo,
            manualLayout:
              costosPanelizadoModo === "manual"
                ? costosPanelizadoManualLayout
                : null,
          },
        });
        setCostosPreview(result);
        setCostosPanelizadoPrintableWidthMm(result.resumenTecnico.anchoImprimibleMm ?? null);
        const snapshots = await getCotizacionesProductoServicio(productoState.id);
        setCostosSnapshots(snapshots);
        toast.success("Costos calculados.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo calcular el costo.");
      }
    });
  };

  const openImposicionPanelEditor = () => {
    if (!imposicionBestCandidate?.panelizado) {
      return;
    }
    const layout =
      imposicionPreviewConfig.panelizadoModo === "manual" && imposicionPreviewConfig.panelizadoManualLayout
        ? cloneGranFormatoImposicionConfig(imposicionPreviewConfig).panelizadoManualLayout
        : buildManualLayoutFromPlacements(imposicionBestCandidate.placements);
    if (!layout) {
      toast.error("No hay paneles disponibles para editar.");
      return;
    }
    setPanelEditorContext("imposicion");
    setPanelEditorDraft(layout);
    setPanelEditorSelectedPieceId(layout.items[0]?.sourcePieceId ?? "");
    setPanelEditorDragIndex(null);
    setIsPanelEditorOpen(true);
  };

  const openCostosPanelEditor = () => {
    const layout = costosManualLayoutActual;
    if (!layout) {
      toast.error("Simulá primero un costo con panelizado para poder editar los paneles.");
      return;
    }
    setPanelEditorContext("costos");
    setPanelEditorDraft(layout);
    setPanelEditorSelectedPieceId(layout.items[0]?.sourcePieceId ?? "");
    setPanelEditorDragIndex(null);
    setIsPanelEditorOpen(true);
  };

  const updatePanelEditorBoundary = React.useCallback(
    (deltaMm: number) => {
      if (!panelEditorSelectedPiece || panelEditorDragIndex == null || !panelEditorDraft) {
        return;
      }
      setPanelEditorDraft((current) => {
        if (!current) {
          return current;
        }
        return {
          items: current.items.map((item) => {
            if (item.sourcePieceId !== panelEditorSelectedPiece.sourcePieceId) {
              return item;
            }
            const panels = [...item.panels];
            const left = panels[panelEditorDragIndex];
            const right = panels[panelEditorDragIndex + 1];
            if (!left || !right) {
              return item;
            }
            if (item.axis === "vertical") {
              const nextLeft = Math.max(MIN_MANUAL_PANEL_USEFUL_MM, left.usefulWidthMm + deltaMm);
              const appliedDelta = nextLeft - left.usefulWidthMm;
              if (Math.abs(appliedDelta) < 0.1) {
                return item;
              }
              left.usefulWidthMm = nextLeft;
              right.usefulWidthMm = Math.max(MIN_MANUAL_PANEL_USEFUL_MM, right.usefulWidthMm - appliedDelta);
            } else {
              const nextLeft = Math.max(MIN_MANUAL_PANEL_USEFUL_MM, left.usefulHeightMm + deltaMm);
              const appliedDelta = nextLeft - left.usefulHeightMm;
              if (Math.abs(appliedDelta) < 0.1) {
                return item;
              }
              left.usefulHeightMm = nextLeft;
              right.usefulHeightMm = Math.max(MIN_MANUAL_PANEL_USEFUL_MM, right.usefulHeightMm - appliedDelta);
            }
            return recalculateManualLayoutItem({
              ...item,
              panels,
            });
          }),
        };
      });
    },
    [panelEditorDraft, panelEditorDragIndex, panelEditorSelectedPiece],
  );

  React.useEffect(() => {
    if (panelEditorDragIndex == null) {
      return;
    }
    const handleMouseMove = (event: MouseEvent) => {
      if (!panelEditorSelectedPiece || !panelEditorCanvasRef.current) {
        return;
      }
      const rect = panelEditorCanvasRef.current.getBoundingClientRect();
      const axisLengthPx =
        panelEditorSelectedPiece.axis === "vertical" ? rect.width : rect.height;
      const axisLengthMm =
        panelEditorSelectedPiece.axis === "vertical"
          ? panelEditorSelectedPiece.pieceWidthMm
          : panelEditorSelectedPiece.pieceHeightMm;
      if (axisLengthPx <= 0 || axisLengthMm <= 0) {
        return;
      }
      const deltaPx =
        panelEditorSelectedPiece.axis === "vertical" ? event.movementX : -event.movementY;
      const deltaMm = (deltaPx / axisLengthPx) * axisLengthMm;
      if (Math.abs(deltaMm) > 0) {
        updatePanelEditorBoundary(deltaMm);
      }
    };
    const handleMouseUp = () => setPanelEditorDragIndex(null);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [panelEditorDragIndex, panelEditorSelectedPiece, updatePanelEditorBoundary]);

  const applyPanelEditor = () => {
    if (!panelEditorDraft) {
      return;
    }
    if (!panelEditorAllValid) {
      toast.error("El layout manual tiene paneles inválidos.");
      return;
    }
    if (panelEditorContext === "costos") {
      setCostosPanelizadoModo("manual");
      setCostosPanelizadoManualLayout(panelEditorDraft);
      setCostosPanelizadoEsTemporal(true);
      setCostosPreview(null);
      setIsPanelEditorOpen(false);
      toast.success("Panelizado manual temporal aplicado. Ejecutá Simular costo para recalcular.");
      return;
    }
    const nextConfig: GranFormatoImposicionConfig = {
      ...imposicionConfig,
      panelizadoModo: "manual",
      panelizadoManualLayout: panelEditorDraft,
    };
    setImposicionConfig(nextConfig);
    setImposicionSimulationConfig(cloneGranFormatoImposicionConfig(nextConfig));
    setIsPanelEditorOpen(false);
    toast.success("Panelizado manual aplicado.");
  };

  const restoreAutomaticPanelLayout = () => {
    if (panelEditorContext === "costos") {
      setPanelEditorDraft(
        imposicionConfig.panelizadoManualLayout
          ? cloneGranFormatoImposicionConfig(imposicionConfig).panelizadoManualLayout
          : buildManualLayoutFromNestingPieces(costosPreview?.nestingPreview?.pieces ?? []),
      );
      setCostosPanelizadoModo(imposicionConfig.panelizadoModo ?? "automatico");
      setCostosPanelizadoManualLayout(
        imposicionConfig.panelizadoManualLayout
          ? cloneGranFormatoImposicionConfig(imposicionConfig).panelizadoManualLayout
          : null,
      );
      setCostosPanelizadoEsTemporal(false);
      setCostosPreview(null);
      setIsPanelEditorOpen(false);
      setPanelEditorDragIndex(null);
      toast.success("Se quitó la edición manual temporal del costo.");
      return;
    }
    const nextConfig: GranFormatoImposicionConfig = {
      ...imposicionConfig,
      panelizadoModo: "automatico",
      panelizadoManualLayout: null,
    };
    setPanelEditorDraft(buildManualLayoutFromPlacements(imposicionBestCandidate?.placements ?? []));
    setImposicionConfig(nextConfig);
    setImposicionSimulationConfig(cloneGranFormatoImposicionConfig(nextConfig));
    setIsPanelEditorOpen(false);
    setPanelEditorDragIndex(null);
    toast.success("Se restableció el panelizado automático.");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link
            href="/costos/productos-servicios"
            className={cn(buttonVariants({ variant: "ghost" }), "-ml-3")}
          >
            Volver a catalogo de productos
          </Link>
          <h1 className="text-xl font-semibold">{productoState.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            {productoState.codigo} · {productoState.familiaProductoNombre}
            {productoState.subfamiliaProductoNombre ? ` · ${productoState.subfamiliaProductoNombre}` : ""}
          </p>
        </div>
        <Badge variant={productoState.estado === "activo" ? "default" : "secondary"}>{estadoProductoLabel}</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
        <TabsList className="h-auto gap-1 rounded-lg bg-muted/70 p-1.5">
          {wideFormatTabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="cursor-pointer rounded-md px-4 py-2.5 text-sm font-medium transition-transform duration-150 hover:scale-[1.02] data-active:scale-100 data-active:bg-orange-600 data-active:text-white data-active:font-bold data-active:hover:bg-orange-600 data-active:hover:text-white"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
              <CardDescription>Identidad comercial y motor de costo del producto.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Nombre</p>
                <Input
                  value={generalForm.nombre}
                  onChange={(e) => setGeneralForm((prev) => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Nombre del producto"
                />
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Código</p>
                <p className="font-medium">{productoState.codigo}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Clase</p>
                <p className="font-medium">{tipoProductoLabel}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Estado</p>
                <p className="font-medium">{estadoProductoLabel}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Familia</p>
                <Select
                  value={generalForm.familiaProductoId}
                  onValueChange={(value) =>
                    setGeneralForm((prev) => ({
                      ...prev,
                      familiaProductoId: value ?? "",
                      subfamiliaProductoId: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar familia">{familiaGeneralLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {familias.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Subfamilia</p>
                <Select
                  value={generalForm.subfamiliaProductoId || "__none__"}
                  onValueChange={(value) =>
                    setGeneralForm((prev) => ({
                      ...prev,
                      subfamiliaProductoId: !value || value === "__none__" ? "" : value,
                    }))
                  }
                  disabled={subfamiliasFiltradasGeneral.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin subfamilia">{subfamiliaGeneralLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin subfamilia</SelectItem>
                    {subfamiliasFiltradasGeneral.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Unidad comercial</p>
                <Select
                  value={generalForm.unidadComercial}
                  onValueChange={(value) =>
                    setGeneralForm((prev) => ({
                      ...prev,
                      unidadComercial: (value as UnidadComercialProducto) ?? "unidad",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar unidad comercial">
                      {getUnidadComercialProductoLabel(generalForm.unidadComercial)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {unidadComercialProductoItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border p-3 md:col-span-2">
                <p className="text-xs text-muted-foreground">Descripción</p>
                <textarea
                  value={generalForm.descripcion}
                  onChange={(e) => setGeneralForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Descripción del producto"
                  className="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="rounded-lg border p-3 md:col-span-2">
                <p className="text-xs text-muted-foreground">Motor de costo</p>
                <Select
                  value={motorCostoValue}
                  onValueChange={(value) =>
                    setGeneralForm((prev) => {
                      const [motorCodigo, motorVersionRaw] = String(value ?? "").split("@");
                      const parsedVersion = Number(motorVersionRaw ?? "1");
                      return {
                        ...prev,
                        motorCodigo: motorCodigo || prev.motorCodigo,
                        motorVersion: Number.isFinite(parsedVersion) ? parsedVersion : prev.motorVersion,
                      };
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona motor de costo">{motorCostoLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {motores.map((item) => (
                      <SelectItem key={`${item.code}@${item.version}`} value={`${item.code}@${item.version}`}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground md:col-span-2">
                Este producto funciona como plantilla de trabajo para gran formato. La compatibilidad técnica se define
                en el tab Tecnologías.
              </div>
              <div className="md:col-span-2">
                <Button type="button" onClick={handleSaveGeneral} disabled={isSavingGeneral || !isGeneralDirty}>
                  {isSavingGeneral ? <GdiSpinner className="size-4" /> : <SaveIcon />}
                  Guardar datos generales
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tecnologias" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tecnologías</CardTitle>
              <CardDescription>
                Definí tecnologías, equipos, perfiles y material base compatibles para este producto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-end">
                <Button type="button" onClick={handleSaveTecnologias} disabled={isSavingConfig || isLoadingConfig || !isConfigDirty}>
                  {isSavingConfig ? <GdiSpinner className="size-4" /> : <SaveIcon />}
                  Guardar tecnologías
                </Button>
              </div>

              {isLoadingConfig ? (
                <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
                  <GdiSpinner className="size-4" />
                  Cargando configuración de gran formato...
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tecnologías compatibles</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {availableTechnologyItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No hay tecnologías compatibles configuradas.</p>
                      ) : (
                        availableTechnologyItems.map((item) => (
                          <label key={item.value} className="flex items-center gap-3 text-sm">
                            <Checkbox
                              checked={tecnologiasCompatibles.includes(item.value)}
                              onCheckedChange={(checked) =>
                                setTecnologiasCompatibles((prev) => toggleInArray(prev, item.value, checked === true))
                              }
                            />
                            <span>{item.label}</span>
                          </label>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Equipos compatibles</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {filteredMachines.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Seleccioná al menos una tecnología para habilitar equipos.
                        </p>
                      ) : (
                        filteredMachines.map((machine) => (
                          <label key={machine.id} className="flex items-center gap-3 text-sm">
                            <Checkbox
                              checked={maquinasCompatiblesIds.includes(machine.id)}
                              onCheckedChange={(checked) =>
                                setMaquinasCompatiblesIds((prev) => toggleInArray(prev, machine.id, checked === true))
                              }
                            />
                            <div>
                              <div>{machine.nombre}</div>
                              <div className="text-xs text-muted-foreground">{machine.codigo}</div>
                            </div>
                          </label>
                        ))
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Calidades</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {groupedProfiles.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Seleccioná al menos un equipo para habilitar perfiles.
                        </p>
                      ) : (
                        groupedProfiles.map((group) => (
                          <div key={group.machine.id} className="space-y-2">
                            <p className="text-sm font-medium">{group.machine.nombre}</p>
                            <div className="space-y-2">
                              {group.profiles.map((profile) => (
                                <label key={profile.id} className="flex items-center gap-3 text-sm">
                                  <Checkbox
                                    checked={perfilesCompatiblesIds.includes(profile.id)}
                                    onCheckedChange={(checked) =>
                                      setPerfilesCompatiblesIds((prev) =>
                                        toggleInArray(prev, profile.id, checked === true),
                                      )
                                    }
                                  />
                                  <span>{profile.nombre}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Material base</CardTitle>
                    <CardDescription>Seleccioná un único material base principal para este producto.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Select
                      value={materialBaseId || EMPTY_MATERIAL_BASE_VALUE}
                      onValueChange={(value) => {
                        const nextValue =
                          String(value ?? "") === EMPTY_MATERIAL_BASE_VALUE ? "" : String(value ?? "");
                        setMaterialBaseId(nextValue);
                        if (!nextValue) {
                          setMaterialesCompatiblesIds([]);
                          return;
                        }
                        const nextMaterial = availableBaseMaterials.find((item) => item.id === nextValue) ?? null;
                        const nextVariantIds = (nextMaterial?.variantes ?? [])
                          .filter((variant) => variant.activo)
                          .map((variant) => variant.id);
                        setMaterialesCompatiblesIds(nextVariantIds);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar material base">{materialBaseLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EMPTY_MATERIAL_BASE_VALUE}>Seleccionar material base</SelectItem>
                        {availableBaseMaterials.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Variantes de material compatibles</CardTitle>
                    <CardDescription>
                      Elegí anchos de rollo u otras variantes activas del material base seleccionado.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!selectedBaseMaterial ? (
                      <p className="text-sm text-muted-foreground">
                        Seleccioná un material base para habilitar sus variantes compatibles.
                      </p>
                    ) : availableMaterialVariants.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        El material base seleccionado no tiene variantes activas.
                      </p>
                    ) : (
                      availableMaterialVariants.map((variant) => (
                        <label
                          key={variant.id}
                          className="flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/20"
                        >
                          <Checkbox
                            checked={materialesCompatiblesIds.includes(variant.id)}
                            onCheckedChange={(checked) =>
                              setMaterialesCompatiblesIds((prev) => toggleInArray(prev, variant.id, checked === true))
                            }
                          />
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-1">
                              {getVarianteOptionChips(selectedBaseMaterial, variant).map((chip) => (
                                <span
                                  key={`${variant.id}-${chip.key}`}
                                  className="rounded border px-2 py-0.5 text-xs"
                                >
                                  {chip.label}: {chip.value}
                                </span>
                              ))}
                            </div>
                          </div>
                        </label>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="produccion">
          <Card>
            <CardHeader>
              <CardTitle>Ruta base</CardTitle>
              <CardDescription>
                Configurá los pasos fijos compartidos y las reglas que resuelven el paso de impresión por tecnología y máquina.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Prioridad de resolución</p>
                  <p className="text-sm text-muted-foreground">
                    Si existe una regla específica por máquina, gana sobre la regla general de tecnología.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={handleSaveRutaBase}
                  disabled={isSavingRutaBase || isLoadingRutaBase || !isRutaBaseDirty}
                >
                  {isSavingRutaBase ? <GdiSpinner className="size-4" /> : <SaveIcon />}
                  Guardar ruta base
                </Button>
              </div>

              {isLoadingRutaBase ? (
                <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
                  <GdiSpinner className="size-4" />
                  Cargando ruta base...
                </div>
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <div>
                        <CardTitle className="text-base">Ruta de producción base</CardTitle>
                        <CardDescription>
                          Reutilizá una ruta de producción existente, igual que en impresión digital.
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">Ruta de producción</p>
                          <Select value={rutaBaseProcesoId || "__none__"} onValueChange={(value) => {
                            const nextValue = value === "__none__" ? "" : String(value ?? "");
                            setRutaBaseProcesoId(nextValue);
                            setRutaBaseReglasImpresion((prev) =>
                              prev.map((row) => ({
                                ...row,
                                pasoPlantillaId: "",
                                perfilOperativoDefaultId: "",
                              })),
                            );
                          }}>
                            <SelectTrigger className="w-full md:min-w-[420px]">
                              <SelectValue placeholder="Seleccionar ruta">
                                {routeBaseProceso ? `${routeBaseProceso.codigo} · ${routeBaseProceso.nombre}` : "Seleccionar ruta"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="min-w-[var(--radix-select-trigger-width)] md:min-w-[420px]">
                              <SelectItem value="__none__">Seleccionar ruta</SelectItem>
                              {procesos.map((proceso) => (
                                <SelectItem key={proceso.id} value={proceso.id}>
                                  {proceso.codigo} · {proceso.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Link href="/costos/procesos" className={buttonVariants({ variant: "outline" })}>
                          Ir al módulo Rutas
                        </Link>
                      </div>

                      {routeBaseProceso ? (
                        <div className="rounded-md border">
                          <div className="border-b bg-muted/30 px-3 py-2 text-sm font-medium">
                            Pasos de la ruta seleccionada
                          </div>
                          <div className="p-3">
                            <div className="space-y-2 text-sm">
                              {routeBaseProceso.operaciones.map((operation) => (
                                <div key={operation.id} className="flex items-center gap-2">
                                  <Badge variant="outline">{operation.orden}</Badge>
                                  <span>{operation.nombre}</span>
                                  <span className="text-muted-foreground">· {operation.centroCostoNombre}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                          Seleccioná una ruta de producción para definir la base del producto.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-base">Reglas de impresión</CardTitle>
                        <CardDescription>
                          Definí qué paso base y qué perfil default usar según la tecnología y, opcionalmente, una máquina puntual.
                        </CardDescription>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setRutaBaseReglasImpresion((prev) => [...prev, createRutaBaseReglaDraft()])}
                        disabled={tecnologiasCompatibles.length === 0 || !rutaBaseProcesoId}
                      >
                        <PlusIcon />
                        Agregar regla
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {tecnologiasCompatibles.length === 0 ? (
                        <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                          Primero seleccioná tecnologías compatibles en el tab Tecnologías.
                        </div>
                      ) : !rutaBaseProcesoId ? (
                        <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                          Primero seleccioná una ruta de producción base.
                        </div>
                      ) : null}
                      {rutaBaseReglasImpresion.length === 0 && tecnologiasCompatibles.length > 0 && rutaBaseProcesoId ? (
                        <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                          No hay reglas de impresión configuradas.
                        </div>
                      ) : null}
                      {rutaBaseReglasImpresion.map((item) => {
                        const machineOptions = selectedMachines.filter(
                          (machine) => getMaquinaTecnologia(machine) === item.tecnologia,
                        );
                        const printingOptions = rutaBasePrintingPlantillas.filter((plantilla) => {
                          if (!plantilla.maquinaId) return false;
                          const machine = machineById.get(plantilla.maquinaId);
                          if (!machine) return false;
                          if (getMaquinaTecnologia(machine) !== item.tecnologia) return false;
                          return item.maquinaId ? plantilla.maquinaId === item.maquinaId : true;
                        });
                        const currentSelectedPlantilla =
                          item.pasoPlantillaId
                            ? routeBasePlantillaById.get(item.pasoPlantillaId) ?? null
                            : null;
                        const printingOptionsWithSelected =
                          currentSelectedPlantilla &&
                          !printingOptions.some((option) => option.id === currentSelectedPlantilla.id)
                            ? [currentSelectedPlantilla, ...printingOptions]
                            : printingOptions;
                        const plantilla = item.pasoPlantillaId ? routeBasePlantillaById.get(item.pasoPlantillaId) ?? null : null;
                        const perfilesDisponibles = plantilla?.maquinaId
                          ? selectedProfilesByMachine.get(plantilla.maquinaId) ?? []
                          : [];
                        return (
                          <div key={item.id} className="grid gap-3 rounded-lg border p-3 md:grid-cols-2 xl:grid-cols-[180px_220px_minmax(0,1fr)_260px_auto]">
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">Tecnología</p>
                              <Select
                                value={item.tecnologia || "__none__"}
                                onValueChange={(value) =>
                                  setRutaBaseReglasImpresion((prev) =>
                                    prev.map((row) =>
                                      row.id === item.id
                                        ? {
                                            ...row,
                                            tecnologia: value === "__none__" ? "" : String(value ?? ""),
                                            maquinaId: "",
                                            pasoPlantillaId: "",
                                            perfilOperativoDefaultId: "",
                                          }
                                        : row,
                                    ),
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar tecnología">
                                    {technologyLabels[item.tecnologia] ?? "Seleccionar tecnología"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Seleccionar tecnología</SelectItem>
                                  {tecnologiasCompatibles.map((tech) => (
                                    <SelectItem key={`${item.id}-${tech}`} value={tech}>
                                      {technologyLabels[tech] ?? tech}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">Máquina específica</p>
                              <Select
                                value={item.maquinaId || "__none__"}
                                onValueChange={(value) =>
                                  setRutaBaseReglasImpresion((prev) =>
                                    prev.map((row) =>
                                      row.id === item.id
                                        ? {
                                            ...row,
                                            maquinaId: value === "__none__" ? "" : String(value ?? ""),
                                            pasoPlantillaId: "",
                                            perfilOperativoDefaultId: "",
                                          }
                                        : row,
                                    ),
                                  )
                                }
                                disabled={!item.tecnologia}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Fallback por tecnología">
                                    {machineOptions.find((machine) => machine.id === item.maquinaId)?.nombre ??
                                      "Fallback por tecnología"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Fallback por tecnología</SelectItem>
                                  {machineOptions.map((machine) => (
                                    <SelectItem key={machine.id} value={machine.id}>
                                      {machine.nombre}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">Paso de impresión</p>
                              <Select
                                value={item.pasoPlantillaId || "__none__"}
                                onValueChange={(value) =>
                                  setRutaBaseReglasImpresion((prev) =>
                                    prev.map((row) =>
                                      row.id === item.id
                                        ? {
                                            ...row,
                                            pasoPlantillaId: value === "__none__" ? "" : String(value ?? ""),
                                            perfilOperativoDefaultId: "",
                                          }
                                        : row,
                                    ),
                                  )
                                }
                                disabled={!item.tecnologia}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar paso de impresión">
                                    {plantilla?.nombre ?? "Seleccionar paso de impresión"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Seleccionar paso de impresión</SelectItem>
                                  {printingOptionsWithSelected.map((option) => (
                                    <SelectItem key={option.id} value={option.id}>
                                      {option.nombre}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">Perfil default</p>
                              <Select
                                value={item.perfilOperativoDefaultId || "__none__"}
                                onValueChange={(value) =>
                                  setRutaBaseReglasImpresion((prev) =>
                                    prev.map((row) =>
                                      row.id === item.id
                                        ? {
                                            ...row,
                                            perfilOperativoDefaultId: value === "__none__" ? "" : String(value ?? ""),
                                          }
                                        : row,
                                    ),
                                  )
                                }
                                disabled={!plantilla?.maquinaId}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Sin perfil default">
                                    {perfilesDisponibles.find((profile) => profile.id === item.perfilOperativoDefaultId)?.nombre ??
                                      "Sin perfil default"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Sin perfil default</SelectItem>
                                  {perfilesDisponibles.map((profile) => (
                                    <SelectItem key={profile.id} value={profile.id}>
                                      {profile.nombre}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  setRutaBaseReglasImpresion((prev) => prev.filter((row) => row.id !== item.id))
                                }
                              >
                                <Trash2Icon className="size-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Preview simple de ruta efectiva</CardTitle>
                      <CardDescription>
                        Sirve para validar rápidamente qué secuencia queda armada por cada regla de impresión.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {rutaBaseReglasImpresion.length === 0 ? (
                        <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                          Agregá al menos una regla de impresión para visualizar la ruta efectiva.
                        </div>
                      ) : (
                        rutaBaseReglasImpresion.map((item) => {
                          const reglaPlantilla = routeBasePlantillaById.get(item.pasoPlantillaId);
                          const machineLabel =
                            selectedMachines.find((machine) => machine.id === item.maquinaId)?.nombre ??
                            "Fallback por tecnología";
                          const labels = [
                            ...(
                              routeBaseProceso?.operaciones.map((operation) => operation.nombre) ?? []
                            ),
                            reglaPlantilla?.nombre ?? "",
                          ].filter(Boolean);
                          return (
                            <div key={`preview-${item.id}`} className="rounded-lg border p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">
                                  {(technologyLabels[item.tecnologia] ?? item.tecnologia) || "Sin tecnología"}
                                </Badge>
                                <Badge variant="outline">{machineLabel}</Badge>
                              </div>
                              <p className="mt-3 text-sm">
                                {labels.length > 0 ? labels.join(" -> ") : "Sin pasos configurados todavía."}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checklist">
          <Card>
            <CardHeader>
              <CardTitle>Ruta de opcionales</CardTitle>
              <CardDescription>
                Define preguntas guía, activadores y pasos opcionales como laminados, instalación y otros servicios o acabados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={aplicaChecklistATodasLasTecnologias}
                    onCheckedChange={(checked) => handleToggleChecklistScope(Boolean(checked))}
                  />
                  <p className="text-sm font-medium">Aplicar a todas las tecnologías</p>
                </div>
                {isSavingChecklistScope ? (
                  <p className="text-xs text-muted-foreground">Guardando alcance...</p>
                ) : null}
                {!aplicaChecklistATodasLasTecnologias ? (
                  <div className="min-w-[260px]">
                    <Select
                      value={tecnologiaChecklistSeleccionada || "__none__"}
                      onValueChange={(value) => {
                        if (checklistDirty) {
                          toast.error("Guardá primero los cambios del checklist antes de cambiar de tecnología.");
                          return;
                        }
                        setTecnologiaChecklistSeleccionada(value === "__none__" ? "" : String(value ?? ""));
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar tecnología">
                          {technologyLabels[tecnologiaChecklistSeleccionada] ?? "Seleccionar tecnología"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Seleccionar tecnología</SelectItem>
                        {tecnologiasChecklistDisponibles.map((item) => (
                          <SelectItem key={item} value={item}>
                            {technologyLabels[item] ?? item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>

              {isLoadingChecklist ? (
                <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
                  <GdiSpinner className="size-4" />
                  Cargando ruta de opcionales...
                </div>
              ) : !rutaBaseProcesoId ? (
                <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                  Primero seleccioná una ruta de producción base para definir la preview de la ruta de opcionales.
                </div>
              ) : !aplicaChecklistATodasLasTecnologias && !tecnologiaChecklistSeleccionada ? (
                <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                  Seleccioná una tecnología para configurar su ruta de opcionales.
                </div>
              ) : (
                <ProductoServicioChecklistEditor
                  initialChecklist={checklistActivo}
                  plantillasPaso={plantillasPaso}
                  materiasPrimas={materiasPrimas}
                  routeStepOptions={checklistRutaPasoOptions}
                  onSaved={(saved) => {
                    if (aplicaChecklistATodasLasTecnologias) {
                      setChecklistComun(saved);
                    } else if (tecnologiaChecklistSeleccionada) {
                      setChecklistsPorTecnologia((prev) => ({
                        ...prev,
                        [tecnologiaChecklistSeleccionada]: saved,
                      }));
                    }
                  }}
                  onSaveChecklist={handleSaveGranFormatoChecklist}
                  onDirtyChange={setChecklistDirty}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="imposicion">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>Imposición</CardTitle>
                  <CardDescription>
                    Definí el baseline técnico de impresión para gran formato: pieza de referencia, máquina/perfil por default, separación entre piezas, márgenes y criterio de optimización.
                  </CardDescription>
                </div>
                <Button type="button" onClick={handleSaveTecnologias} disabled={isSavingConfig || isLoadingConfig || !isConfigDirty}>
                  {isSavingConfig ? <GdiSpinner className="size-4" /> : <SaveIcon />}
                  Guardar configuración
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Parámetros de imposición</CardTitle>
                  <CardDescription>
                    Definí el baseline técnico del producto: defaults de impresión, optimización y márgenes que luego usará el resto del flujo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-xl border bg-muted/10 p-4">
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold">Configuración por defecto</h4>
                      <p className="text-sm text-muted-foreground">
                        Estos valores definen el contexto técnico base del producto para imposición, costos y simulación comercial.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Tecnología default</p>
                        <Select
                          value={imposicionTechnology || "__none__"}
                          onValueChange={(value) =>
                            setImposicionConfig((prev) => ({
                              ...prev,
                              tecnologiaDefault: value === "__none__" ? null : value,
                              maquinaDefaultId: null,
                              perfilDefaultId: null,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tecnología">
                              {technologyLabels[imposicionTechnology] ?? "Seleccionar tecnología"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Seleccionar tecnología</SelectItem>
                            {imposicionTechnologies.map((item) => (
                              <SelectItem key={item} value={item}>
                                {technologyLabels[item] ?? item}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Máquina default</p>
                        <Select
                          value={imposicionMachine?.id ?? "__none__"}
                          onValueChange={(value) =>
                            setImposicionConfig((prev) => ({
                              ...prev,
                              maquinaDefaultId: value === "__none__" ? null : value,
                              perfilDefaultId: null,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar máquina">
                              {imposicionMachine?.nombre ?? "Seleccionar máquina"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Seleccionar máquina</SelectItem>
                            {imposicionMachineOptions.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Perfil default</p>
                        <Select
                          value={imposicionProfile?.id ?? "__none__"}
                          onValueChange={(value) =>
                            setImposicionConfig((prev) => ({
                              ...prev,
                              perfilDefaultId: value === "__none__" ? null : value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar perfil">
                              {imposicionProfile?.nombre ?? "Seleccionar perfil"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Seleccionar perfil</SelectItem>
                            {imposicionProfileOptions.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-muted/10 p-4">
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold">Configuración de optimización</h4>
                      <p className="text-sm text-muted-foreground">
                        Ajustá cómo el sistema evalúa alternativas de nesting para este producto.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div className="space-y-2 xl:col-span-1">
                        <p className="text-xs text-muted-foreground">Criterio de optimización</p>
                        <Select
                          value={imposicionConfig.criterioOptimizacion}
                          onValueChange={(value) =>
                            setImposicionConfig((prev) => ({
                              ...prev,
                              criterioOptimizacion: value as GranFormatoImposicionCriterioOptimizacion,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue>
                              {imposicionOptimizationItems.find((item) => item.value === imposicionConfig.criterioOptimizacion)?.label ??
                                "Seleccionar criterio"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {imposicionOptimizationItems.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-3">
                        <p className="text-sm font-medium">
                          <LabelWithTooltip
                            label="Permitir rotación"
                            tooltip="Evalúa orientaciones alternativas para mejorar el aprovechamiento del rollo."
                          />
                        </p>
                        <Switch
                          checked={imposicionConfig.permitirRotacion}
                          onCheckedChange={(checked) =>
                            setImposicionConfig((prev) => ({ ...prev, permitirRotacion: Boolean(checked) }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-3">
                        <p className="text-sm font-medium">
                          <LabelWithTooltip
                            label="Apto para panelizado"
                            tooltip="Si una pieza no entra entera en ningún rollo, el sistema podrá dividirla en paneles automáticamente."
                          />
                        </p>
                        <Switch
                          checked={imposicionConfig.panelizadoActivo}
                          onCheckedChange={(checked) =>
                            setImposicionConfig((prev) => ({
                              ...prev,
                              panelizadoActivo: Boolean(checked),
                              panelizadoDireccion: checked ? prev.panelizadoDireccion : "automatica",
                              panelizadoDistribucion: checked ? prev.panelizadoDistribucion : "equilibrada",
                            }))
                          }
                        />
                      </div>
                      {imposicionConfig.panelizadoActivo ? (
                        <>
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">Dirección de panelizado</p>
                            <Select
                              value={imposicionConfig.panelizadoDireccion ?? "automatica"}
                              onValueChange={(value) =>
                                setImposicionConfig((prev) => ({
                                  ...prev,
                                  panelizadoDireccion: value as GranFormatoPanelizadoDireccion,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue>
                                  {panelizadoDireccionItems.find(
                                    (item) => item.value === (imposicionConfig.panelizadoDireccion ?? "automatica"),
                                  )?.label ?? "Automática"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {panelizadoDireccionItems.map((item) => (
                                  <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">Solape por panel (mm)</p>
                            <Input
                              type="number"
                              min={0}
                              value={imposicionConfig.panelizadoSolapeMm ?? ""}
                              onChange={(event) =>
                                setImposicionConfig((prev) => ({
                                  ...prev,
                                  panelizadoSolapeMm: event.target.value ? Math.max(0, Number(event.target.value)) : null,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">Ancho máximo de panel (cm)</p>
                            <Input
                              type="number"
                              min={1}
                              step="0.1"
                              value={formatMmAsCm(imposicionConfig.panelizadoAnchoMaxPanelMm)}
                              onChange={(event) =>
                                setImposicionConfig((prev) => ({
                                  ...prev,
                                  panelizadoAnchoMaxPanelMm: event.target.value
                                    ? Math.max(1, Number(event.target.value) * 10)
                                    : null,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">Distribución de paneles</p>
                            <Select
                              value={imposicionConfig.panelizadoDistribucion ?? "equilibrada"}
                              onValueChange={(value) =>
                                setImposicionConfig((prev) => ({
                                  ...prev,
                                  panelizadoDistribucion: value as GranFormatoPanelizadoDistribucion,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue>
                                  {panelizadoDistribucionItems.find(
                                    (item) => item.value === (imposicionConfig.panelizadoDistribucion ?? "equilibrada"),
                                  )?.label ?? "Equilibrada"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {panelizadoDistribucionItems.map((item) => (
                                  <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 xl:col-span-2">
                            <p className="text-xs text-muted-foreground">Interpretar ancho máximo como</p>
                            <Select
                              value={imposicionConfig.panelizadoInterpretacionAnchoMaximo ?? "total"}
                              onValueChange={(value) =>
                                setImposicionConfig((prev) => ({
                                  ...prev,
                                  panelizadoInterpretacionAnchoMaximo:
                                    value as GranFormatoPanelizadoInterpretacionAnchoMaximo,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue>
                                  {panelizadoInterpretacionItems.find(
                                    (item) =>
                                      item.value ===
                                      (imposicionConfig.panelizadoInterpretacionAnchoMaximo ?? "total"),
                                  )?.label ?? "Ancho total del panel"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {panelizadoInterpretacionItems.map((item) => (
                                  <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-xl border bg-muted/10 p-4">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h4 className="text-sm font-semibold">Configuración de márgenes de impresión</h4>
                        <p className="text-sm text-muted-foreground">
                          Mostramos primero los márgenes heredados de la máquina y, si hace falta, podés overridearlos para este producto.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={showImposicionOverrides}
                          onCheckedChange={(checked) => {
                            setShowImposicionOverrides(checked);
                            if (!checked) {
                              setImposicionConfig((prev) => ({
                                ...prev,
                                margenLateralIzquierdoMmOverride: null,
                                margenLateralDerechoMmOverride: null,
                                margenInicioMmOverride: null,
                                margenFinalMmOverride: null,
                              }));
                            }
                          }}
                        />
                        <p className="text-sm font-medium">Usar overrides de márgenes</p>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {imposicionMarginSummary.map((item) => {
                        const overrideValue = imposicionConfig[item.overrideKey] as number | null;
                        return (
                          <div key={item.key} className="rounded-lg border bg-background p-3">
                            <p className="text-xs text-muted-foreground">{item.title}</p>
                            <p className="mt-1 text-lg font-semibold">{formatMmAsCm(item.effectiveMm)} cm</p>
                            <p className="text-xs text-muted-foreground">
                              Máquina: {formatMmAsCm(item.machineMm)} cm
                            </p>
                            {showImposicionOverrides ? (
                              <div className="mt-3 space-y-2">
                                <p className="text-xs text-muted-foreground">Override (mm)</p>
                                <Input
                                  type="number"
                                  min={0}
                                  value={overrideValue ?? ""}
                                  onChange={(event) =>
                                    setImposicionConfig((prev) => ({
                                      ...prev,
                                      [item.overrideKey]: event.target.value ? Math.max(0, Number(event.target.value)) : null,
                                    }))
                                  }
                                />
                              </div>
                            ) : (
                              <p className="mt-2 text-xs text-muted-foreground">
                                {overrideValue != null ? "Override activo" : "Usando valor heredado de máquina"}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-5 rounded-xl border bg-background p-4">
                      <div className="mb-4">
                        <h5 className="text-sm font-semibold">Márgenes entre piezas para impresión</h5>
                        <p className="text-sm text-muted-foreground">
                          Definí la separación técnica mínima entre piezas dentro del nesting.
                        </p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">Separación horizontal (mm)</p>
                          <Input
                            type="number"
                            min={0}
                            value={imposicionConfig.separacionHorizontalMm}
                            onChange={(event) =>
                              setImposicionConfig((prev) => ({
                                ...prev,
                                separacionHorizontalMm: Math.max(0, Number(event.target.value || 0)),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">Separación vertical (mm)</p>
                          <Input
                            type="number"
                            min={0}
                            value={imposicionConfig.separacionVerticalMm}
                            onChange={(event) =>
                              setImposicionConfig((prev) => ({
                                ...prev,
                                separacionVerticalMm: Math.max(0, Number(event.target.value || 0)),
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <CardTitle className="text-base">Simulador de imposición</CardTitle>
                      <CardDescription>
                        Cargá medidas reales del trabajo y revisá cómo responde el producto frente a cada ancho de rollo disponible.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      className="gap-2 self-start bg-orange-500 text-white hover:bg-orange-500/90"
                      disabled={isSimulatingImposicion}
                      onClick={handleSimularImposicion}
                    >
                      <PrinterIcon className="size-4" />
                      Simular imposición
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-xl border bg-muted/10 p-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Medidas a evaluar</p>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Ingresá una o varias medidas y el sistema comparará variantes de rollo para detectar la alternativa más conveniente.
                      </p>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="hidden gap-3 px-3 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto_auto]">
                        <p className="text-xs font-medium text-muted-foreground">Ancho (cm)</p>
                        <p className="text-xs font-medium text-muted-foreground">Alto (cm)</p>
                        <p className="text-xs font-medium text-muted-foreground">Cantidad</p>
                        <span />
                        <span />
                      </div>
                      {imposicionConfig.medidas.map((medida, index) => (
                        <div
                          key={`medida-${index}`}
                          className="grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto_auto] md:items-end"
                        >
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground md:hidden">Ancho (cm)</p>
                            <Input
                              aria-label={`Ancho de la medida ${index + 1} en centímetros`}
                              type="number"
                              min={1}
                              step="0.1"
                              value={formatMmAsCm(medida.anchoMm)}
                              onChange={(event) =>
                                setImposicionConfig((prev) => {
                                  const next = [...prev.medidas];
                                  next[index] = {
                                    ...next[index],
                                    anchoMm: event.target.value ? Number(event.target.value) * 10 : null,
                                  };
                                  const first = next[0] ?? createGranFormatoImposicionMedida();
                                  return {
                                    ...prev,
                                    medidas: next,
                                    piezaAnchoMm: first.anchoMm,
                                    piezaAltoMm: first.altoMm,
                                    cantidadReferencia: first.cantidad,
                                  };
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground md:hidden">Alto (cm)</p>
                            <Input
                              aria-label={`Alto de la medida ${index + 1} en centímetros`}
                              type="number"
                              min={1}
                              step="0.1"
                              value={formatMmAsCm(medida.altoMm)}
                              onChange={(event) =>
                                setImposicionConfig((prev) => {
                                  const next = [...prev.medidas];
                                  next[index] = {
                                    ...next[index],
                                    altoMm: event.target.value ? Number(event.target.value) * 10 : null,
                                  };
                                  const first = next[0] ?? createGranFormatoImposicionMedida();
                                  return {
                                    ...prev,
                                    medidas: next,
                                    piezaAnchoMm: first.anchoMm,
                                    piezaAltoMm: first.altoMm,
                                    cantidadReferencia: first.cantidad,
                                  };
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground md:hidden">Cantidad</p>
                            <Input
                              aria-label={`Cantidad de la medida ${index + 1}`}
                              type="number"
                              min={1}
                              value={medida.cantidad}
                              onChange={(event) =>
                                setImposicionConfig((prev) => {
                                  const next = [...prev.medidas];
                                  next[index] = {
                                    ...next[index],
                                    cantidad: Math.max(1, Number(event.target.value || 1)),
                                  };
                                  const first = next[0] ?? createGranFormatoImposicionMedida();
                                  return {
                                    ...prev,
                                    medidas: next,
                                    piezaAnchoMm: first.anchoMm,
                                    piezaAltoMm: first.altoMm,
                                    cantidadReferencia: first.cantidad,
                                  };
                                })
                              }
                            />
                          </div>
                          <div className="flex md:justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Agregar nueva medida"
                              onClick={() =>
                                setImposicionConfig((prev) => ({
                                  ...prev,
                                  medidas: [...prev.medidas, createGranFormatoImposicionMedida()],
                                }))
                              }
                            >
                              <PlusIcon className="size-4" />
                            </Button>
                          </div>
                          <div className="flex md:justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={imposicionConfig.medidas.length === 1}
                              onClick={() =>
                                setImposicionConfig((prev) => {
                                  const next = prev.medidas.filter((_, currentIndex) => currentIndex !== index);
                                  const safe = next.length > 0 ? next : [createGranFormatoImposicionMedida()];
                                  const first = safe[0];
                                  return {
                                    ...prev,
                                    medidas: safe,
                                    piezaAnchoMm: first.anchoMm,
                                    piezaAltoMm: first.altoMm,
                                    cantidadReferencia: first.cantidad,
                                  };
                                })
                              }
                            >
                              <Trash2Icon className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border bg-muted/10 p-4">
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold">Preview por ancho de rollo</h4>
                      <p className="text-sm text-muted-foreground">
                        El sistema compara las variantes de material compatibles y muestra cuál conviene según el criterio configurado.
                      </p>
                    </div>
                    <div className="space-y-4">
                  {!hasImposicionSimulation ? (
                    <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                      Configurá el escenario y presioná <span className="font-medium text-foreground">Simular imposición</span> para ver candidatos.
                    </div>
                  ) : !imposicionPreviewHasValidMeasures ? (
                    <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                      Completá al menos una medida válida para simular la imposición.
                    </div>
                  ) : !imposicionMachine ? (
                    <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                      Seleccioná una máquina compatible para poder evaluar los márgenes no imprimibles y el ancho máximo imprimible.
                    </div>
                  ) : imposicionPreview.length === 0 ? (
                    <div className="space-y-3">
                      {isImposicionSimulationStale ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          Hay cambios sin simular. El preview corresponde a la última simulación ejecutada.
                        </div>
                      ) : null}
                      <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                        {imposicionPreviewResult.machineIssue ??
                          (imposicionRejectedVariants.length > 0
                            ? "No se pudo resolver la imposición con la configuración actual."
                            : "No hay variantes de material disponibles para evaluar.")}
                      </div>
                      {imposicionRejectedVariants.length > 0 ? (
                        <div className="rounded-lg border p-4">
                          <p className="text-sm font-medium">Motivos de descarte</p>
                          <div className="mt-3 space-y-2">
                            {imposicionRejectedVariants.map((item, index) => (
                              <div key={`${item.variant.id}-${index}-${item.reason}`} className="rounded-md border px-3 py-2 text-sm">
                                <p className="font-medium">{item.variant.sku}</p>
                                <p className="text-muted-foreground">{item.reason}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      {isImposicionSimulationStale ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          Hay cambios sin simular. El resultado mostrado corresponde a la última simulación ejecutada.
                        </div>
                      ) : null}
                      {imposicionBestCandidate ? (
                        <div className="rounded-lg border bg-muted/20 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex size-7 items-center justify-center rounded-full bg-orange-500/12 text-orange-600">
                                  <TrophyIcon className="size-4" />
                                </span>
                                <p className="text-sm font-medium">Mejor candidato actual</p>
                                {imposicionBestCandidate.panelizado ? (
                                  <Badge variant="outline" className="bg-white">
                                    {getPanelizadoModoLabel(imposicionBestCandidate.panelMode)}
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {selectedBaseMaterial
                                  ? getVarianteOptionChips(selectedBaseMaterial, imposicionBestCandidate.variant).map((chip) => (
                                      <span key={`${imposicionBestCandidate.variant.id}-${chip.key}`} className="rounded border px-2 py-0.5 text-xs">
                                        {chip.label}: {chip.value}
                                      </span>
                                    ))
                                  : (
                                    <span className="rounded border px-2 py-0.5 text-xs">
                                      {imposicionBestCandidate.variant.sku}
                                    </span>
                                  )}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="gap-2 bg-orange-500 text-white hover:bg-orange-500/90"
                                onClick={() => setIsImposicion3dOpen(true)}
                              >
                                <PrinterIcon className="size-4" />
                                Ver nesting
                              </Button>
                              {imposicionBestCandidate.panelizado ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="gap-2"
                                  onClick={openImposicionPanelEditor}
                                >
                                  <PencilIcon className="size-4" />
                                  Editar paneles
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="overflow-x-auto rounded-lg border">
                        <table className="min-w-full text-sm">
                          <thead className="bg-muted/30 text-left">
                            <tr>
                              <th className="px-3 py-2 font-medium">Variante</th>
                              <th className="px-3 py-2 font-medium">Ancho rollo</th>
                              <th className="px-3 py-2 font-medium">Ancho imprimible</th>
                              <th className="px-3 py-2 font-medium">Orientación</th>
                              <th className="px-3 py-2 font-medium">Piezas/fila</th>
                              <th className="px-3 py-2 font-medium">Filas</th>
                              <th className="px-3 py-2 font-medium">Largo consumido</th>
                              <th className="px-3 py-2 font-medium">Desperdicio</th>
                            </tr>
                          </thead>
                          <tbody>
                            {imposicionPreview.map((item) => (
                              <tr
                                key={`${item.variant.id}-${item.panelizado ? item.panelAxis ?? "panel" : "normal"}-${item.panelMode ?? "na"}-${Math.round(item.consumedLengthMm)}`}
                                className="border-t"
                              >
                                <td className="px-3 py-2">
                                  <div className="flex flex-wrap gap-1">
                                    {selectedBaseMaterial
                                      ? getVarianteOptionChips(selectedBaseMaterial, item.variant).map((chip) => (
                                          <span key={`${item.variant.id}-${chip.key}`} className="rounded border px-2 py-0.5 text-xs">
                                            {chip.label}: {chip.value}
                                          </span>
                                        ))
                                      : (
                                        <span className="font-medium">{item.variant.sku}</span>
                                      )}
                                  </div>
                                </td>
                                <td className="px-3 py-2">{(item.rollWidthMm / 10).toLocaleString("es-AR")} cm</td>
                                <td className="px-3 py-2">{(item.printableWidthMm / 10).toLocaleString("es-AR")} cm</td>
                                <td className="px-3 py-2">
                                  <div>
                                    <p>
                                      {item.orientacion === "mixta"
                                        ? "Mixta"
                                        : item.orientacion === "rotada"
                                          ? "Rotada"
                                          : "Normal"}
                                    </p>
                                    {item.panelizado ? (
                                      <p className="text-xs text-muted-foreground">
                                        {getPanelizadoModoLabel(item.panelMode)} ·{" "}
                                        Panelizado {item.panelAxis === "vertical" ? "vertical" : "horizontal"} · {item.panelCount} paneles ·{" "}
                                        {item.panelDistribution === "libre" ? "Libre" : "Equilibrada"}
                                        {item.panelMaxWidthMm != null ? ` · Máx. ${formatMmAsCm(item.panelMaxWidthMm)} cm` : ""}
                                        {item.panelWidthInterpretation
                                          ? ` · ${getPanelizadoInterpretacionLabel(item.panelWidthInterpretation)}`
                                          : ""}
                                      </p>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-3 py-2">{item.piecesPerRow}</td>
                                <td className="px-3 py-2">{item.rows}</td>
                                <td className="px-3 py-2">
                                  {(item.consumedLengthMm / 1000).toLocaleString("es-AR", { maximumFractionDigits: 3 })} m
                                </td>
                                <td className="px-3 py-2">
                                  {item.wastePct.toLocaleString("es-AR", { maximumFractionDigits: 2 })}% ·{" "}
                                  {item.wasteAreaM2.toLocaleString("es-AR", { maximumFractionDigits: 3 })} m2
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {imposicionRejectedVariants.length > 0 ? (
                        <div className="rounded-lg border p-4">
                          <p className="text-sm font-medium">Variantes descartadas</p>
                          <div className="mt-3 space-y-2">
                            {imposicionRejectedVariants.map((item, index) => (
                              <div key={`${item.variant.id}-${index}-${item.reason}`} className="rounded-md border px-3 py-2 text-sm">
                                <div className="flex flex-wrap gap-1">
                                  {selectedBaseMaterial
                                    ? getVarianteOptionChips(selectedBaseMaterial, item.variant).map((chip) => (
                                        <span key={`${item.variant.id}-${chip.key}`} className="rounded border px-2 py-0.5 text-xs">
                                          {chip.label}: {chip.value}
                                        </span>
                                      ))
                                    : (
                                      <span className="font-medium">{item.variant.sku}</span>
                                    )}
                                </div>
                                <p className="text-muted-foreground">{item.reason}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <Sheet
          open={isPanelEditorOpen}
          onOpenChange={(open) => {
            setIsPanelEditorOpen(open);
            if (!open) {
              setPanelEditorDragIndex(null);
            }
          }}
        >
          <SheetContent side="right" className="!w-[78vw] !max-w-none md:!w-[72vw] xl:!w-[68vw] sm:!max-w-none">
            <SheetHeader>
              <SheetTitle>Editor visual de paneles</SheetTitle>
              <SheetDescription>
                {panelEditorContext === "costos"
                  ? "Ajustá manualmente las divisiones para esta simulación puntual. Los cambios afectarán nesting, desperdicio y costo cuando vuelvas a simular, pero no modificarán la configuración base del producto."
                  : "Ajustá manualmente las divisiones del panelizado. Cuando apliques los cambios, este layout pasa a ser la configuración manual base del producto."}
              </SheetDescription>
            </SheetHeader>
            <div className="flex h-full flex-col gap-4 overflow-hidden px-4 pb-4">
              {!panelEditorSelectedPiece ? (
                <div className="flex h-full items-center justify-center rounded-xl border bg-muted/20 text-sm text-muted-foreground">
                  No hay paneles disponibles para editar.
                </div>
              ) : (
                <>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border bg-muted/10 p-3">
                      <p className="text-xs text-muted-foreground">Modo actual</p>
                      <p className="mt-1 text-sm font-semibold">
                        {getPanelizadoModoLabel(
                          panelEditorContext === "costos" ? costosPanelizadoModo : imposicionPreviewConfig.panelizadoModo,
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl border bg-muted/10 p-3">
                      <p className="text-xs text-muted-foreground">Dirección</p>
                      <p className="mt-1 text-sm font-semibold">
                        {panelEditorSelectedPiece.axis === "vertical" ? "Vertical" : "Horizontal"}
                      </p>
                    </div>
                    <div className="rounded-xl border bg-muted/10 p-3">
                      <p className="text-xs text-muted-foreground">Solape</p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatMmAsCm(imposicionPreviewConfig.panelizadoSolapeMm)} cm
                      </p>
                    </div>
                    <div className="rounded-xl border bg-muted/10 p-3">
                      <p className="text-xs text-muted-foreground">Ancho máximo</p>
                      <p className="mt-1 text-sm font-semibold">
                        {imposicionPreviewConfig.panelizadoAnchoMaxPanelMm != null
                          ? `${formatMmAsCm(imposicionPreviewConfig.panelizadoAnchoMaxPanelMm)} cm`
                          : "Sin dato"}
                      </p>
                    </div>
                  </div>

                  {panelEditorPieces.length > 1 ? (
                    <div className="rounded-xl border bg-muted/10 p-3">
                      <p className="mb-3 text-sm font-medium">Pieza a editar</p>
                      <div className="flex flex-wrap gap-2">
                        {panelEditorPieces.map((item, index) => (
                          <Button
                            key={item.sourcePieceId}
                            type="button"
                            size="sm"
                            variant={item.sourcePieceId === panelEditorSelectedPiece.sourcePieceId ? "default" : "outline"}
                            onClick={() => setPanelEditorSelectedPieceId(item.sourcePieceId)}
                          >
                            {getPieceLetterLabel(index)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_320px]">
                    <div className="flex min-h-0 flex-col rounded-xl border bg-muted/10 p-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {getPieceLetterLabel(
                              Math.max(
                                0,
                                panelEditorPieces.findIndex(
                                  (item) => item.sourcePieceId === panelEditorSelectedPiece.sourcePieceId,
                                ),
                              ),
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Pieza real: {formatMmAsCm(panelEditorSelectedPiece.pieceWidthMm)} ×{" "}
                            {formatMmAsCm(panelEditorSelectedPiece.pieceHeightMm)} cm
                          </p>
                        </div>
                        <Badge variant={panelEditorSelectedPieceValid ? "outline" : "destructive"}>
                          {panelEditorSelectedPieceValid ? "Layout válido" : "Layout inválido"}
                        </Badge>
                      </div>

                      <div className="mb-3 rounded-lg border border-dashed bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                        Arrastrá los divisores para cambiar el tamaño útil de los paneles. El solape se mantiene fijo según la configuración técnica del producto.
                      </div>

                      <div className="min-h-0 flex-1 overflow-auto">
                        <div
                          className="mx-auto flex h-full min-h-[340px] max-h-[540px] w-full max-w-[840px] items-center justify-center"
                        >
                          <div
                            ref={panelEditorCanvasRef}
                            className={cn(
                              "relative flex w-full max-w-[820px] overflow-visible border-2 border-dashed border-orange-200 bg-white p-2 shadow-sm select-none",
                              panelEditorSelectedPiece.axis === "vertical"
                                ? "min-h-[260px] flex-row items-stretch"
                                : "min-h-[420px] max-w-[420px] flex-col items-stretch",
                            )}
                            style={{
                              aspectRatio: `${Math.max(panelEditorSelectedPiece.pieceWidthMm, 1)} / ${Math.max(panelEditorSelectedPiece.pieceHeightMm, 1)}`,
                            }}
                          >
                            {panelEditorSelectedPiece.panels.map((panel, index) => {
                              const usefulDimension =
                                panelEditorSelectedPiece.axis === "vertical"
                                  ? panel.usefulWidthMm
                                  : panel.usefulHeightMm;
                              const finalDimension =
                                panelEditorSelectedPiece.axis === "vertical"
                                  ? panel.finalWidthMm
                                  : panel.finalHeightMm;
                              const withinConfiguredLimit =
                                imposicionPreviewConfig.panelizadoAnchoMaxPanelMm == null
                                  ? true
                                  : imposicionPreviewConfig.panelizadoInterpretacionAnchoMaximo === "total"
                                    ? finalDimension <= imposicionPreviewConfig.panelizadoAnchoMaxPanelMm
                                    : usefulDimension <= imposicionPreviewConfig.panelizadoAnchoMaxPanelMm;
                              const withinPrintableWidth = finalDimension <= panelEditorPrintableWidthMm;
                              const panelValid =
                                usefulDimension >= MIN_MANUAL_PANEL_USEFUL_MM &&
                                withinConfiguredLimit &&
                                withinPrintableWidth;
                              const totalForFlex =
                                panelEditorSelectedPiece.axis === "vertical"
                                  ? panel.finalWidthMm
                                  : panel.finalHeightMm;
                              const overlapStartPct =
                                totalForFlex > 0
                                  ? ((panelEditorSelectedPiece.axis === "vertical"
                                      ? panel.overlapStartMm
                                      : panel.overlapStartMm) /
                                      totalForFlex) *
                                    100
                                  : 0;
                              const overlapEndPct =
                                totalForFlex > 0
                                  ? ((panelEditorSelectedPiece.axis === "vertical"
                                      ? panel.overlapEndMm
                                      : panel.overlapEndMm) /
                                      totalForFlex) *
                                    100
                                  : 0;

                              return (
                                <React.Fragment key={`${panelEditorSelectedPiece.sourcePieceId}-${panel.panelIndex}`}>
                                  <div
                                    className="relative flex min-h-0 min-w-0"
                                    style={{ flexGrow: Math.max(totalForFlex, 1), flexBasis: 0 }}
                                  >
                                    <div
                                      className={cn(
                                        "relative flex min-h-0 min-w-0 flex-1 overflow-hidden border",
                                        panelValid
                                          ? "border-zinc-200 bg-zinc-50"
                                          : "border-red-300 bg-red-50",
                                      )}
                                    >
                                      {panelEditorSelectedPiece.axis === "vertical" ? (
                                        <>
                                          {panel.overlapStartMm > 0 ? (
                                            <div
                                              className="absolute inset-y-0 left-0 bg-orange-200/80"
                                              style={{ width: `${overlapStartPct}%` }}
                                            />
                                          ) : null}
                                          {panel.overlapEndMm > 0 ? (
                                            <div
                                              className="absolute inset-y-0 right-0 bg-orange-200/80"
                                              style={{ width: `${overlapEndPct}%` }}
                                            />
                                          ) : null}
                                          <div
                                            className="absolute inset-y-0 border border-cyan-300/50 bg-cyan-200/35"
                                            style={{
                                              left: `${overlapStartPct}%`,
                                              right: `${overlapEndPct}%`,
                                            }}
                                          />
                                        </>
                                      ) : (
                                        <>
                                          {panel.overlapStartMm > 0 ? (
                                            <div
                                              className="absolute inset-x-0 top-0 bg-orange-200/80"
                                              style={{ height: `${overlapStartPct}%` }}
                                            />
                                          ) : null}
                                          {panel.overlapEndMm > 0 ? (
                                            <div
                                              className="absolute inset-x-0 bottom-0 bg-orange-200/80"
                                              style={{ height: `${overlapEndPct}%` }}
                                            />
                                          ) : null}
                                          <div
                                            className="absolute inset-x-0 border border-cyan-300/50 bg-cyan-200/35"
                                            style={{
                                              top: `${overlapStartPct}%`,
                                              bottom: `${overlapEndPct}%`,
                                            }}
                                          />
                                        </>
                                      )}

                                      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-2 p-3 text-center">
                                        <Badge variant="outline" className="bg-white/80">
                                          {`Panel ${panel.panelIndex}`}
                                        </Badge>
                                        <div className="space-y-1">
                                          <p className="text-sm font-semibold">
                                            Útil:{" "}
                                            {panelEditorSelectedPiece.axis === "vertical"
                                              ? `${formatMmAsCm(panel.usefulWidthMm)} × ${formatMmAsCm(panel.usefulHeightMm)} cm`
                                              : `${formatMmAsCm(panel.usefulWidthMm)} × ${formatMmAsCm(panel.usefulHeightMm)} cm`}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            Final: {formatMmAsCm(panel.finalWidthMm)} × {formatMmAsCm(panel.finalHeightMm)} cm
                                          </p>
                                        </div>
                                        {!panelValid ? (
                                          <p className="text-xs font-medium text-red-600">
                                            {withinConfiguredLimit
                                              ? withinPrintableWidth
                                                ? "Panel menor al mínimo técnico"
                                                : "No entra en el ancho imprimible"
                                              : "Supera el ancho máximo configurado"}
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                    {index < panelEditorSelectedPiece.panels.length - 1 ? (
                                      <button
                                        type="button"
                                        aria-label={`Mover divisor entre panel ${panel.panelIndex} y panel ${panel.panelIndex + 1}`}
                                        className={cn(
                                          "absolute z-20 border-0 bg-transparent transition",
                                          panelEditorSelectedPiece.axis === "vertical"
                                            ? "-right-2 top-0 h-full w-4 cursor-col-resize"
                                            : "-bottom-2 left-0 h-4 w-full cursor-row-resize",
                                        )}
                                        onMouseDown={(event) => {
                                          event.preventDefault();
                                          setPanelEditorDragIndex(index);
                                        }}
                                      >
                                        <span
                                          className={cn(
                                            "absolute bg-orange-500 shadow-[0_0_0_2px_rgba(255,255,255,0.9)]",
                                            panelEditorSelectedPiece.axis === "vertical"
                                              ? "left-1/2 top-1/2 h-16 w-[3px] -translate-x-1/2 -translate-y-1/2"
                                              : "left-1/2 top-1/2 h-[3px] w-16 -translate-x-1/2 -translate-y-1/2",
                                          )}
                                        />
                                      </button>
                                    ) : null}
                                  </div>
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex min-h-0 flex-col gap-4">
                    <div className="rounded-xl border bg-muted/10 p-4">
                      <p className="text-sm font-semibold">Configuración usada</p>
                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-muted-foreground">Distribución</span>
                            <span className="font-medium">
                              {panelizadoDistribucionItems.find(
                                (item) => item.value === imposicionPreviewConfig.panelizadoDistribucion,
                              )?.label ?? "Equilibrada"}
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-muted-foreground">Interpretación</span>
                            <span className="text-right font-medium">
                              {getPanelizadoInterpretacionLabel(
                                imposicionPreviewConfig.panelizadoInterpretacionAnchoMaximo,
                              )}
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-muted-foreground">Ancho imprimible</span>
                            <span className="font-medium">
                              {panelEditorPrintableWidthMm > 0
                                ? `${formatMmAsCm(panelEditorPrintableWidthMm)} cm`
                                : "Sin dato"}
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-muted-foreground">Estado general</span>
                            <span className={cn("font-medium", panelEditorAllValid ? "text-emerald-600" : "text-red-600")}>
                              {panelEditorAllValid ? "Válido" : "Revisar paneles"}
                            </span>
                          </div>
                          {panelEditorContext === "costos" ? (
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-muted-foreground">Destino</span>
                              <span className="text-right font-medium">Sólo esta simulación</span>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-xl border bg-muted/10 p-4">
                        <p className="text-sm font-semibold">Detalle de paneles</p>
                        <div className="mt-3 space-y-2">
                          {panelEditorSelectedPiece.panels.map((panel) => {
                            const usefulDimension =
                              panelEditorSelectedPiece.axis === "vertical"
                                ? panel.usefulWidthMm
                                : panel.usefulHeightMm;
                            const finalDimension =
                              panelEditorSelectedPiece.axis === "vertical"
                                ? panel.finalWidthMm
                                : panel.finalHeightMm;
                            const withinConfiguredLimit =
                              imposicionPreviewConfig.panelizadoAnchoMaxPanelMm == null
                                ? true
                                : imposicionPreviewConfig.panelizadoInterpretacionAnchoMaximo === "total"
                                  ? finalDimension <= imposicionPreviewConfig.panelizadoAnchoMaxPanelMm
                                  : usefulDimension <= imposicionPreviewConfig.panelizadoAnchoMaxPanelMm;
                            const withinPrintableWidth = finalDimension <= panelEditorPrintableWidthMm;
                            const panelValid =
                              usefulDimension >= MIN_MANUAL_PANEL_USEFUL_MM &&
                              withinConfiguredLimit &&
                              withinPrintableWidth;
                            return (
                              <div
                                key={`detail-${panelEditorSelectedPiece.sourcePieceId}-${panel.panelIndex}`}
                                className={cn(
                                  "rounded-lg border p-3",
                                  panelValid ? "bg-background" : "border-red-300 bg-red-50",
                                )}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-medium">{`Panel ${panel.panelIndex}`}</p>
                                  <Badge variant={panelValid ? "outline" : "destructive"}>
                                    {panelValid ? "OK" : "Inválido"}
                                  </Badge>
                                </div>
                                <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
                                  <p>Útil: {formatMmAsCm(panel.usefulWidthMm)} × {formatMmAsCm(panel.usefulHeightMm)} cm</p>
                                  <p>Final: {formatMmAsCm(panel.finalWidthMm)} × {formatMmAsCm(panel.finalHeightMm)} cm</p>
                                  <p>Solape inicio/fin: {formatMmAsCm(panel.overlapStartMm)} / {formatMmAsCm(panel.overlapEndMm)} cm</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                    <Button type="button" variant="outline" onClick={restoreAutomaticPanelLayout}>
                      {panelEditorContext === "costos" ? "Quitar edición manual" : "Restablecer automático"}
                    </Button>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsPanelEditorOpen(false);
                          setPanelEditorDragIndex(null);
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        className="bg-orange-500 text-white hover:bg-orange-500/90"
                        onClick={applyPanelEditor}
                        disabled={!panelEditorAllValid}
                      >
                        {panelEditorContext === "costos"
                          ? "Aplicar a esta simulación"
                          : "Aplicar panelizado manual"}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={isImposicion3dOpen} onOpenChange={setIsImposicion3dOpen}>
          <SheetContent side="right" className="!w-[72vw] !max-w-none md:!w-[68vw] lg:!w-[64vw] xl:!w-[62vw] sm:!max-w-none">
            <SheetHeader>
              <SheetTitle>Visualización 3D del nesting</SheetTitle>
              <SheetDescription>
                Render del plotter y del mejor candidato actual, incluyendo márgenes no imprimibles y distribución de piezas sobre el rollo.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 px-4 pb-4">
              {imposicionBestCandidate ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[#f28a32]/20 bg-gradient-to-r from-[#fff7ed] to-[#fffaf5] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">
                        Margen no imprimible
                      </Badge>
                      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                        Área imprimible
                      </Badge>
                      <Badge variant="outline" className="border-zinc-300 bg-white text-zinc-700">
                        Material / rollo
                      </Badge>
                      <Badge variant="outline" className="border-[#f28a32]/30 bg-[#fff2e8] text-[#c65a10]">
                        Piezas anidadas
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      La vista muestra el sustrato apoyado en el plotter, el área utilizable del material y los márgenes no imprimibles que el motor descuenta para la imposición.
                    </p>
                  </div>
                  <div className="relative">
                    {imposicion3dResumen ? (
                      <div className="pointer-events-none absolute left-4 top-4 z-10 w-[220px] rounded-xl border border-white/10 bg-zinc-950/75 p-3 text-white shadow-xl backdrop-blur-md">
                        <div className="space-y-2">
                          {imposicion3dResumen.map((item) => (
                            <div key={item.label} className="flex items-start justify-between gap-3 text-sm">
                              <span className="text-zinc-300">{item.label}</span>
                              <span className="text-right font-medium tabular-nums text-white">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <PlotterSimulator
                      key={`plotter-${imposicionBestCandidate.variant.id}-${isImposicion3dOpen ? "open" : "closed"}`}
                      rollWidth={Number((imposicionBestCandidate.rollWidthMm / 10).toFixed(2))}
                      rollLength={Number((imposicionBestCandidate.consumedLengthMm / 10).toFixed(2))}
                      marginLeft={Number((imposicionBestCandidate.marginLeftMm / 10).toFixed(2))}
                      marginRight={Number((imposicionBestCandidate.marginRightMm / 10).toFixed(2))}
                      marginStart={Number((imposicionBestCandidate.marginStartMm / 10).toFixed(2))}
                      marginEnd={Number((imposicionBestCandidate.marginEndMm / 10).toFixed(2))}
                      panelizado={imposicionBestCandidate.panelizado}
                      panelAxis={imposicionBestCandidate.panelAxis}
                      panelCount={imposicionBestCandidate.panelCount}
                      panelOverlap={
                        imposicionBestCandidate.panelOverlapMm != null
                          ? Number((imposicionBestCandidate.panelOverlapMm / 10).toFixed(2))
                          : null
                      }
                      panelMaxWidth={
                        imposicionBestCandidate.panelMaxWidthMm != null
                          ? Number((imposicionBestCandidate.panelMaxWidthMm / 10).toFixed(2))
                          : null
                      }
                      panelDistribution={imposicionBestCandidate.panelDistribution}
                      panelWidthInterpretation={imposicionBestCandidate.panelWidthInterpretation}
                      panelMode={imposicionBestCandidate.panelMode}
                      pieces={imposicionBestCandidate.placements.map((item, index) => ({
                        id: item.id,
                        w: Number((item.widthMm / 10).toFixed(2)),
                        h: Number((item.heightMm / 10).toFixed(2)),
                        usefulW: Number((item.usefulWidthMm / 10).toFixed(2)),
                        usefulH: Number((item.usefulHeightMm / 10).toFixed(2)),
                        cx: Number((((item.centerXMm - imposicionBestCandidate.rollWidthMm / 2) / 10)).toFixed(2)),
                        cy: Number((item.centerYMm / 10).toFixed(2)),
                        color: ["#ff9f43", "#0abde3", "#1dd1a1", "#ff6b6b", "#f97316", "#22c55e"][index % 6],
                        label: getPieceLetterLabel(index),
                        textColor: "#111111",
                        rotated: item.rotated,
                        panelIndex: item.panelIndex,
                        panelCount: item.panelCount,
                        panelAxis: item.panelAxis,
                        sourcePieceId: item.sourcePieceId,
                        overlapStart: Number((item.overlapStartMm / 10).toFixed(2)),
                        overlapEnd: Number((item.overlapEndMm / 10).toFixed(2)),
                      }))}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex h-[70vh] items-center justify-center rounded-xl border bg-muted/20 text-sm text-muted-foreground">
                  No hay un candidato válido para renderizar.
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={isCostos3dOpen} onOpenChange={setIsCostos3dOpen}>
          <SheetContent side="right" className="!w-[72vw] !max-w-none md:!w-[68vw] lg:!w-[64vw] xl:!w-[62vw] sm:!max-w-none">
            <SheetHeader>
              <SheetTitle>Visualización 3D del sustrato costado</SheetTitle>
              <SheetDescription>
                Muestra exactamente el layout usado para calcular consumo de sustrato y desperdicio.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 px-4 pb-4">
              {costosPreview?.nestingPreview ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[#f28a32]/20 bg-gradient-to-r from-[#fff7ed] to-[#fffaf5] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">
                        Margen no imprimible
                      </Badge>
                      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                        Área imprimible
                      </Badge>
                      <Badge variant="outline" className="border-zinc-300 bg-white text-zinc-700">
                        Material / rollo
                      </Badge>
                      <Badge variant="outline" className="border-[#f28a32]/30 bg-[#fff2e8] text-[#c65a10]">
                        Piezas anidadas
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Esta vista corresponde al candidato efectivamente usado en el cálculo de costos.
                    </p>
                  </div>
                  <div className="relative">
                    {costos3dResumen ? (
                      <div className="pointer-events-none absolute left-4 top-4 z-10 w-[220px] rounded-xl border border-white/10 bg-zinc-950/75 p-3 text-white shadow-xl backdrop-blur-md">
                        <div className="space-y-2">
                          {costos3dResumen.map((item) => (
                            <div key={item.label} className="flex items-start justify-between gap-3 text-sm">
                              <span className="text-zinc-300">{item.label}</span>
                              <span className="text-right font-medium tabular-nums text-white">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <PlotterSimulator
                      key={`plotter-costos-${costosPreview.resumenTecnico.varianteId}-${isCostos3dOpen ? "open" : "closed"}`}
                      rollWidth={costosPreview.nestingPreview.rollWidth}
                      rollLength={costosPreview.nestingPreview.rollLength}
                      marginLeft={costosPreview.nestingPreview.marginLeft}
                      marginRight={costosPreview.nestingPreview.marginRight}
                      marginStart={costosPreview.nestingPreview.marginStart}
                      marginEnd={costosPreview.nestingPreview.marginEnd}
                      panelizado={costosPreview.nestingPreview.panelizado}
                      panelAxis={costosPreview.nestingPreview.panelAxis}
                      panelCount={costosPreview.nestingPreview.panelCount}
                      panelOverlap={costosPreview.nestingPreview.panelOverlap}
                      panelMaxWidth={costosPreview.nestingPreview.panelMaxWidth}
                      panelDistribution={costosPreview.nestingPreview.panelDistribution}
                      panelWidthInterpretation={costosPreview.nestingPreview.panelWidthInterpretation}
                      panelMode={costosPreview.nestingPreview.panelMode}
                      pieces={costosPreview.nestingPreview.pieces}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex h-[70vh] items-center justify-center rounded-xl border bg-muted/20 text-sm text-muted-foreground">
                  No hay un layout disponible para renderizar.
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <TabsContent value="cotizador">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Simulador de costos</CardTitle>
                <CardDescription>
                  Ejecuta una simulación operativa del trabajo usando la base técnica definida en Imposición.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.95fr)]">
                  <div className="rounded-lg border p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Medidas del trabajo</p>
                    </div>
                    <div className="space-y-2">
                      <div className="hidden gap-2 px-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_40px_40px]">
                        <span>Ancho (cm)</span>
                        <span>Alto (cm)</span>
                        <span>Cantidad</span>
                        <span />
                        <span />
                      </div>
                      {costosMedidas.map((medida, index) => (
                        <div
                          key={`costos-medida-${index}`}
                          className="grid gap-2 rounded-lg border p-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_40px_40px]"
                        >
                          <Field>
                            <Input
                              aria-label={`Ancho (cm) fila ${index + 1}`}
                              value={formatMmAsCm(medida.anchoMm)}
                              onChange={(event) => {
                                const value = event.target.value;
                                setCostosMedidas((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          anchoMm: value.trim() ? Math.round(Number(value) * 10) : null,
                                        }
                                      : item,
                                  ),
                                );
                              }}
                            />
                          </Field>
                          <Field>
                            <Input
                              aria-label={`Alto (cm) fila ${index + 1}`}
                              value={formatMmAsCm(medida.altoMm)}
                              onChange={(event) => {
                                const value = event.target.value;
                                setCostosMedidas((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          altoMm: value.trim() ? Math.round(Number(value) * 10) : null,
                                        }
                                      : item,
                                  ),
                                );
                              }}
                            />
                          </Field>
                          <Field>
                            <Input
                              aria-label={`Cantidad fila ${index + 1}`}
                              type="number"
                              min={1}
                              value={medida.cantidad}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                setCostosMedidas((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          cantidad: Number.isFinite(value) && value > 0 ? value : 1,
                                        }
                                      : item,
                                  ),
                                );
                              }}
                            />
                          </Field>
                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Agregar nueva medida"
                              onClick={() =>
                                setCostosMedidas((prev) => [...prev, createGranFormatoImposicionMedida()])
                              }
                            >
                              <PlusIcon className="size-4" />
                            </Button>
                          </div>
                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={costosMedidas.length === 1}
                              onClick={() =>
                                setCostosMedidas((prev) =>
                                  prev.length === 1 ? prev : prev.filter((_, itemIndex) => itemIndex !== index),
                                )
                              }
                            >
                              <Trash2Icon className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border p-3">
                    <div className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                        <FieldLabel className="sm:mb-0">Tecnología</FieldLabel>
                        <Select value={costosTechnology} onValueChange={(value) => setCostosTecnologia(value ?? "")}>
                          <SelectTrigger>
                            <SelectValue>{costosTechnologyLabel}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {costosTechnologies.map((item) => (
                              <SelectItem key={item} value={item}>
                                {technologyLabels[item] ?? item}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                        <FieldLabel className="sm:mb-0">Perfil operativo</FieldLabel>
                        <Select
                          value={costosPerfilOverrideId || "__default__"}
                          onValueChange={(value) => setCostosPerfilOverrideId(value === "__default__" || value == null ? "" : value)}
                        >
                          <SelectTrigger>
                            <SelectValue>{costosPerfilOverrideLabel}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__default__">Usar perfil default del producto</SelectItem>
                            {costosProfileOptions.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-center">
                        <FieldLabel className="sm:mb-0">Período tarifa</FieldLabel>
                        <Input
                          value={costosPeriodo}
                          placeholder="YYYY-MM"
                          onChange={(event) => setCostosPeriodo(event.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {costosPanelizadoEsTemporal ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">Panelizado manual para esta simulación</p>
                      <p>Este ajuste es temporal y no modifica Imposición. Ejecutá Simular costo para recalcular con este layout.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={openCostosPanelEditor}>
                        <PencilIcon className="size-4" />
                        Editar paneles
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCostosPanelizadoModo(imposicionConfig.panelizadoModo ?? "automatico");
                          setCostosPanelizadoManualLayout(
                            imposicionConfig.panelizadoManualLayout
                              ? cloneGranFormatoImposicionConfig(imposicionConfig).panelizadoManualLayout
                              : null,
                          );
                          setCostosPanelizadoEsTemporal(false);
                          setCostosPreview(null);
                          toast.success("Se quitó la edición manual temporal del costo.");
                        }}
                      >
                        Quitar edición manual
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-lg border p-3">
                  <p className="mb-2 text-sm font-medium">Opcionales para costear</p>
                  <ProductoServicioChecklistCotizador
                    checklist={checklistCotizadorGranFormato}
                    value={costosChecklistRespuestas}
                    onChange={setCostosChecklistRespuestas}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  {costosPanelizadoModo === "manual" && costosPanelizadoManualLayout ? (
                    <Button type="button" variant="outline" onClick={openCostosPanelEditor}>
                      <PencilIcon className="size-4" />
                      Editar paneles
                    </Button>
                  ) : null}
                  <Button type="button" onClick={handleCalcularCostos} disabled={isCalculatingCosts || checklistDirty}>
                    {isCalculatingCosts ? <GdiSpinner className="size-4" data-icon="inline-start" /> : null}
                    Simular costo
                  </Button>
                </div>

                {checklistDirty ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-950">
                    Guardá primero los cambios de <span className="font-medium">Ruta de opcionales</span> para que
                    el orden del preview de ruta y el centro de costos coincidan en este cálculo.
                  </div>
                ) : null}

                {costosPreview?.warnings?.length ? (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    {costosPreview.warnings.map((warning, index) => (
                      <p key={`costos-warning-${index}`}>{warning}</p>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {costosPreview ? (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <CardTitle>Resumen técnico</CardTitle>
                        <CardDescription>
                          Candidato elegido para costear material, tinta y tiempo operativo.
                        </CardDescription>
                      </div>
                      {(costosPreview.resumenTecnico.panelizado || costosPanelizadoModo === "manual") ? (
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={openCostosPanelEditor}>
                            <PencilIcon className="size-4" />
                            Editar paneles
                          </Button>
                          {costosPanelizadoEsTemporal ? (
                            <Badge variant="outline" className="bg-white">
                              Manual temporal
                            </Badge>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {costosPreview.resumenTecnico.varianteChips.map((chip) => (
                        <Badge key={`${chip.label}-${chip.value}`} variant="outline">
                          {chip.label}: {chip.value}
                        </Badge>
                      ))}
                    </div>
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Ancho rollo</TableHead>
                          <TableHead>Ancho imprimible</TableHead>
                          <TableHead>Orientación</TableHead>
                          <TableHead className="text-right">Piezas/fila</TableHead>
                          <TableHead className="text-right">Filas</TableHead>
                          <TableHead className="text-right">Largo consumido</TableHead>
                          <TableHead className="text-right">Desperdicio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>{formatMmAsCm(costosPreview.resumenTecnico.anchoRolloMm)} cm</TableCell>
                          <TableCell>{formatMmAsCm(costosPreview.resumenTecnico.anchoImprimibleMm)} cm</TableCell>
                          <TableCell>
                            <div>
                              <p>
                                {costosPreview.resumenTecnico.orientacion === "mixta"
                                  ? "Mixta"
                                  : costosPreview.resumenTecnico.orientacion === "rotada"
                                    ? "Rotada"
                                    : "Normal"}
                              </p>
                              {costosPreview.resumenTecnico.panelizado ? (
                                <p className="text-xs text-muted-foreground">
                                  Panelizado {costosPreview.resumenTecnico.panelAxis === "vertical" ? "vertical" : "horizontal"} ·{" "}
                                  {formatNumber(costosPreview.resumenTecnico.panelCount, 0)} paneles ·{" "}
                                  {costosPreview.resumenTecnico.panelDistribution === "libre" ? "Libre" : "Equilibrada"}
                                  {costosPreview.resumenTecnico.panelMaxWidthMm != null
                                    ? ` · Máx. ${formatMmAsCm(costosPreview.resumenTecnico.panelMaxWidthMm)} cm`
                                    : ""}
                                  {costosPreview.resumenTecnico.panelWidthInterpretation
                                    ? ` · ${getPanelizadoInterpretacionLabel(costosPreview.resumenTecnico.panelWidthInterpretation)}`
                                    : ""}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(costosPreview.resumenTecnico.piezasPorFila, 0)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(costosPreview.resumenTecnico.filas, 0)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(costosPreview.resumenTecnico.largoConsumidoMm / 1000, 2)} m</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(costosPreview.resumenTecnico.desperdicioPct, 2)}% · {formatNumber(costosPreview.resumenTecnico.areaDesperdicioM2, 3)} m2
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Centro de costos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Paso</TableHead>
                          <TableHead>Centro</TableHead>
                          <TableHead>Origen</TableHead>
                          <TableHead className="text-right">Minutos</TableHead>
                          <TableHead className="text-right">Tarifa/h</TableHead>
                          <TableHead className="text-right">Costo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {costosPreview.centrosCosto.map((item) => (
                          <TableRow key={`${item.codigo}-${item.orden}`}>
                            <TableCell>{item.orden}</TableCell>
                            <TableCell>{item.paso}</TableCell>
                            <TableCell>{item.centroCostoNombre || "-"}</TableCell>
                            <TableCell>{item.origen}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(item.minutos, 2)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(item.tarifaHora)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(item.costo)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell colSpan={6} className="text-right font-medium">
                            Total centro de costos
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatCurrency(costosPreview.totales.centrosCosto)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Materias primas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {costosMaterialesAgrupados.map((grupo) => (
                      <div key={grupo.tipo} className="rounded-lg border">
                        <div className="flex items-center justify-between gap-3 border-b px-3 py-3">
                          <div>
                            <p className="font-medium">{grupo.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {grupo.items.length} componente{grupo.items.length === 1 ? "" : "s"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {grupo.tipo === "SUSTRATO" && costosPreview.nestingPreview ? (
                              <Button
                                type="button"
                                size="sm"
                                className="bg-[#f28a32] text-white hover:bg-[#d87422]"
                                title="Ver nesting del sustrato"
                                onClick={() => setIsCostos3dOpen(true)}
                              >
                                <PrinterIcon className="size-4" />
                                Ver nesting
                              </Button>
                            ) : null}
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Costo total</p>
                              <p className="font-medium tabular-nums">{formatCurrency(grupo.totalCosto)}</p>
                            </div>
                          </div>
                        </div>
                        <Table className="table-fixed">
                          <colgroup>
                            <col className="w-auto" />
                            <col className="w-[140px]" />
                            <col className="w-[140px]" />
                            <col className="w-[160px]" />
                            <col className="w-[160px]" />
                          </colgroup>
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead>Componente</TableHead>
                              <TableHead className="whitespace-nowrap">Origen</TableHead>
                              <TableHead className="text-right whitespace-nowrap">Cantidad</TableHead>
                              <TableHead className="text-right whitespace-nowrap">Costo unitario</TableHead>
                              <TableHead className="text-right whitespace-nowrap">Costo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {grupo.items.map((item, index) => (
                              <TableRow key={`${grupo.tipo}-${index}`}>
                                <TableCell className="align-top">{renderGranFormatoMaterialDisplay(item)}</TableCell>
                                <TableCell className="align-top whitespace-nowrap">{item.origen}</TableCell>
                                <TableCell className="align-top text-right tabular-nums whitespace-nowrap">
                                  {formatNumber(item.cantidad, 3)}{item.unidad ? ` ${item.unidad}` : ""}
                                </TableCell>
                                <TableCell className="align-top text-right tabular-nums whitespace-nowrap">{formatCurrency(item.costoUnitario)}</TableCell>
                                <TableCell className="align-top text-right tabular-nums whitespace-nowrap">{formatCurrency(item.costo)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}

                    <div className="rounded-lg border">
                      <Table>
                        <TableBody>
                          <TableRow>
                            <TableCell colSpan={4} className="text-right font-medium">
                              Total materiales
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {formatCurrency(costosPreview.totales.materiales)}
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-amber-100/60">
                            <TableCell colSpan={4} className="text-right font-semibold">
                              Total técnico
                            </TableCell>
                            <TableCell className="text-right font-bold tabular-nums">
                              {formatCurrency(costosPreview.totales.tecnico)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <div className="rounded-lg border">
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted/60"
                    onClick={() => setCostosSnapshotsOpen((prev) => !prev)}
                  >
                    <span className="text-sm font-medium">Historial de snapshots</span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      {costosSnapshots.length}
                      {costosSnapshotsOpen ? (
                        <ChevronDownIcon className="size-4" />
                      ) : (
                        <ChevronRightIcon className="size-4" />
                      )}
                    </span>
                  </button>
                  {costosSnapshotsOpen ? (
                    <div className="border-t">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>Snapshot</TableHead>
                            <TableHead>Cantidad</TableHead>
                            <TableHead>Período</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Unitario</TableHead>
                            <TableHead>Fecha</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {costosSnapshots.length ? (
                            costosSnapshots.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-mono text-xs">{item.id.slice(0, 8)}</TableCell>
                                <TableCell>{item.cantidad}</TableCell>
                                <TableCell>{item.periodoTarifa}</TableCell>
                                <TableCell>{formatCurrency(item.total)}</TableCell>
                                <TableCell>{formatCurrency(item.unitario)}</TableCell>
                                <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                                Todavía no hay snapshots guardados.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="precio">
          <Card>
            <CardHeader>
              <CardTitle>Precio</CardTitle>
              <CardDescription>Configura el método de cálculo comercial del producto.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="grid gap-3 md:min-w-[360px]">
                    <Field>
                      <FieldLabel>Método de cálculo</FieldLabel>
                      <Select
                        value={precioForm.metodoCalculo}
                        onValueChange={(value) =>
                          handleChangeMetodoCalculoPrecio((value as MetodoCalculoPrecioProducto) ?? "margen_variable")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona método">
                            {getPrecioMethodLabel(precioForm.metodoCalculo)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {metodoCalculoPrecioItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <p className="text-xs text-muted-foreground">
                      Unidad comercial:{" "}
                      {getUnidadComercialProductoLabel(
                        normalizeWideFormatMeasurementUnit(
                          precioForm.measurementUnit,
                          normalizeUnidadComercialProducto(productoState.unidadComercial),
                        ),
                      )}
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={handleOpenPrecioEditor}>
                    <InfoIcon className="size-4" />
                    Ver detalle
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Impuestos</p>
                      <p className="text-xs text-muted-foreground">
                        Selecciona el esquema impositivo que aplica a este producto.
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={handleOpenImpuestosEditor}>
                      <Settings2Icon className="size-4" />
                      Administrar impuestos
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                    <Field>
                      <FieldLabel>Impuestos</FieldLabel>
                      <Select
                        value={precioForm.impuestos.esquemaId ?? "__none__"}
                        onValueChange={(value) => handleChangeImpuestoEsquema(value === "__none__" ? null : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione">
                            {precioForm.impuestos.esquemaNombre || "Seleccione"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Seleccione</SelectItem>
                          {impuestosCatalogoActivos.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Impuestos Totales</FieldLabel>
                      <Input value={formatNumber(precioForm.impuestos.porcentajeTotal)} disabled />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Comisiones</p>
                      <p className="text-xs text-muted-foreground">
                        Define cargos financieros y comisiones comerciales que afectan la rentabilidad del producto.
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => handleOpenPrecioComisionEditor()}>
                      <PlusIcon className="size-4" />
                      Agregar
                    </Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Porcentaje</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="w-[140px] text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {precioForm.comisiones.items.length ? (
                            precioForm.comisiones.items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.nombre}</TableCell>
                                <TableCell>{precioComisionTipoLabels[item.tipo]}</TableCell>
                                <TableCell>{formatNumber(item.porcentaje)}%</TableCell>
                                <TableCell>{item.activo ? "Activa" : "Inactiva"}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleOpenPrecioComisionEditor(item)}>
                                      <PencilIcon className="size-4" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => setPrecioComisionToDelete(item)}>
                                      <Trash2Icon className="size-4" />
                                    </Button>
                                    <Switch
                                      checked={item.activo}
                                      onCheckedChange={(checked) => handleTogglePrecioComision(item.id, Boolean(checked))}
                                    />
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                                No hay comisiones configuradas.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <Field>
                      <FieldLabel>Comisiones Totales</FieldLabel>
                      <Input value={formatNumber(precioForm.comisiones.porcentajeTotal)} disabled />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Precio especial para clientes</p>
                    <p className="text-xs text-muted-foreground">Define reglas comerciales especiales por cliente.</p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => handleOpenPrecioEspecialClienteEditor()}>
                    <PlusIcon className="size-4" />
                    Agregar
                  </Button>
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Método de cálculo</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-[140px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {precioEspecialClientesForm.length ? (
                        precioEspecialClientesForm.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.clienteNombre}</TableCell>
                            <TableCell>{getPrecioMethodLabel(item.metodoCalculo)}</TableCell>
                            <TableCell>{item.descripcion || getPrecioEspecialClienteResumen(item) || "-"}</TableCell>
                            <TableCell>{item.activo ? "Activa" : "Inactiva"}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={isSavingPrecioEspecialClientes}
                                  onClick={() => handleOpenPrecioEspecialClienteEditor(item)}
                                >
                                  <PencilIcon className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={isSavingPrecioEspecialClientes}
                                  onClick={() =>
                                    setPrecioEspecialClienteToDelete({
                                      id: item.id,
                                      clienteNombre: item.clienteNombre,
                                    })
                                  }
                                >
                                  <Trash2Icon className="size-4" />
                                </Button>
                                <Switch
                                  checked={item.activo}
                                  disabled={isSavingPrecioEspecialClientes}
                                  onCheckedChange={(checked) => handleTogglePrecioEspecialCliente(item.id, Boolean(checked))}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                            No hay elementos registrados.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <Button type="button" onClick={() => handleSavePrecio()} disabled={isSavingPrecio || !isPrecioDirty}>
                {isSavingPrecio ? <GdiSpinner className="size-4" /> : <SaveIcon />}
                Guardar configuración de precio
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simulacion-comercial">
          <Card>
            <CardHeader>
              <CardTitle>Simulación comercial</CardTitle>
              <CardDescription>
                Estima el precio final de venta a partir de la última simulación de costos y la configuración comercial del producto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Estado de simulación</p>
                    <p className="text-xs text-muted-foreground">
                      Usa la última simulación/snapshot calculada en el tab Simulador de costos.
                    </p>
                  </div>
                  <Badge
                    variant={
                      simulacionComercial.status === "disponible"
                        ? "default"
                        : simulacionComercial.status === "no_calculable"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {simulacionComercial.status === "disponible"
                      ? "Simulación disponible"
                      : simulacionComercial.status === "no_calculable"
                        ? "No calculable"
                        : "Sin simulación de costos"}
                  </Badge>
                </div>
                <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                  {simulacionComercial.reason ??
                    simulacionComercial.descripcion ??
                    "La simulación comercial está lista con el último snapshot de costos calculado."}
                </div>
              </div>

              {simulacionComercial.status === "disponible" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-lg border bg-muted/20 p-4 text-center">
                      <p className="text-3xl font-semibold">
                        {simulacionComercial.valorComercial != null
                          ? formatCurrency(simulacionComercial.valorComercial)
                          : "-"}
                      </p>
                      <div className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                        <span>Valor comercial</span>
                        <InfoIcon className="size-3.5" />
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-4 text-center">
                      <p className="text-3xl font-semibold">
                        {simulacionComercial.vmcMonto != null
                          ? formatCurrency(simulacionComercial.vmcMonto)
                          : "-"}
                      </p>
                      <div className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                        <span>VMC</span>
                        <InfoIcon className="size-3.5" />
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-4 text-center">
                      <p className="text-3xl font-semibold">
                        {simulacionComercial.icmPct != null
                          ? `${formatNumber(simulacionComercial.icmPct)}%`
                          : "-"}
                      </p>
                      <div className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                        <span>ICM</span>
                        <InfoIcon className="size-3.5" />
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-4 text-center">
                      <p className="text-3xl font-semibold">
                        {simulacionComercial.beneficioMonto != null
                          ? formatCurrency(simulacionComercial.beneficioMonto)
                          : "-"}
                      </p>
                      <div className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                        <span>Beneficio</span>
                        <InfoIcon className="size-3.5" />
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-4 text-center">
                      <p className="text-3xl font-semibold">
                        {simulacionComercial.beneficioPct != null
                          ? `${formatNumber(simulacionComercial.beneficioPct)}%`
                          : "-"}
                      </p>
                      <div className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground">
                        <span>Beneficio</span>
                        <InfoIcon className="size-3.5" />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="overflow-hidden rounded-lg border">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>Resumen comercial</TableHead>
                            <TableHead className="w-[220px] text-right">Valor</TableHead>
                            <TableHead className="w-[140px] text-right">%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Costo total</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(simulacionComercial.costoTotal)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {simulacionComercial.precioFinal
                                ? `${formatNumber((simulacionComercial.costoTotal / simulacionComercial.precioFinal) * 100)}%`
                                : "-"}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Impuestos</TableCell>
                            <TableCell className="text-right font-medium">
                              {simulacionComercial.impuestosMonto != null
                                ? formatCurrency(simulacionComercial.impuestosMonto)
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {simulacionComercial.impuestosMonto != null
                                ? `${formatNumber(simulacionComercial.impuestosPct)}%`
                                : "-"}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Comisiones</TableCell>
                            <TableCell className="text-right font-medium">
                              {simulacionComercial.comisionesMonto != null
                                ? formatCurrency(simulacionComercial.comisionesMonto)
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {simulacionComercial.comisionesMonto != null
                                ? `${formatNumber(simulacionComercial.comisionesPct)}%`
                                : "-"}
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/20">
                            <TableCell className="font-medium">Precio final al cliente</TableCell>
                            <TableCell className="text-right font-semibold">
                              {simulacionComercial.precioFinal != null
                                ? formatCurrency(simulacionComercial.precioFinal)
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {simulacionComercial.precioFinal != null ? "100%" : "-"}
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-emerald-50/60">
                            <TableCell className="font-medium">Margen real</TableCell>
                            <TableCell className="text-right font-semibold">
                              {simulacionComercial.margenRealMonto != null
                                ? formatCurrency(simulacionComercial.margenRealMonto)
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {simulacionComercial.margenRealPct != null
                                ? `${formatNumber(simulacionComercial.margenRealPct)}%`
                                : "-"}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-lg border p-4">
                        <p className="text-sm font-medium">Lectura rápida</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {simulacionComercial.descripcion}
                        </p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-sm font-medium">Configuración usada</p>
                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Unidad comercial</span>
                            <span>{getUnidadComercialProductoLabel(precioForm.measurementUnit ?? productoState.unidadComercial)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Esquema impositivo</span>
                            <span>{precioForm.impuestos.esquemaNombre || "Sin impuestos"}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Comisiones activas</span>
                            <span>{precioForm.comisiones.items.filter((item) => item.activo).length}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Snapshot de costos</span>
                            <span>{costosPreview?.snapshotId ? costosPreview.snapshotId.slice(0, 8) : "-"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="text-sm font-medium">
                    {simulacionComercial.status === "sin_cotizacion"
                      ? "Todavía no hay una simulación de costos para simular."
                      : "La configuración actual no permite calcular un precio comercial."}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {simulacionComercial.reason ??
                      "Revisá la última simulación en Simulador de costos y la configuración del tab Precio."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Sheet open={precioEditorOpen} onOpenChange={(open) => (open ? setPrecioEditorOpen(true) : handleCancelPrecioEditor())}>
        <SheetContent
          side="right"
          className="overflow-y-auto px-4 py-6 data-[side=right]:w-[96vw] data-[side=right]:max-w-none sm:px-6 sm:data-[side=right]:w-[72vw] sm:data-[side=right]:max-w-none lg:px-8 lg:data-[side=right]:w-[30vw] lg:data-[side=right]:min-w-[540px] lg:data-[side=right]:max-w-none"
        >
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Detalle de precio</SheetTitle>
            <SheetDescription>
              {getPrecioMethodDescription(precioEditorDraft.metodoCalculo)}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <Field>
              <FieldLabel>Unidad comercial</FieldLabel>
              <Input
                value={getUnidadComercialProductoLabel(
                  normalizeWideFormatMeasurementUnit(
                    precioEditorDraft.measurementUnit,
                    normalizeUnidadComercialProducto(productoState.unidadComercial),
                  ),
                )}
                disabled
              />
            </Field>

            {precioEditorDraft.metodoCalculo === "por_margen" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Precio fijo por margen fijo: el precio se calcula a partir del costo y del margen definido aquí.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field>
                    <FieldLabel>Margen (%)</FieldLabel>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={precioEditorDraft.detalle.marginPct}
                      onChange={(e) =>
                        updatePrecioEditorDraft((current) => {
                          const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "por_margen" }>;
                          return {
                            ...draft,
                            detalle: {
                              ...draft.detalle,
                              marginPct: Number(e.target.value || 0),
                            },
                          };
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Margen mínimo (%)</FieldLabel>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={precioEditorDraft.detalle.minimumMarginPct}
                      onChange={(e) =>
                        updatePrecioEditorDraft((current) => {
                          const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "por_margen" }>;
                          return {
                            ...draft,
                            detalle: {
                              ...draft.detalle,
                              minimumMarginPct: Number(e.target.value || 0),
                            },
                          };
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
            ) : null}

            {precioEditorDraft.metodoCalculo === "precio_fijo" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Precio fijo: ingresás manualmente el precio final de venta, sin calcularlo desde un margen.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field>
                    <FieldLabel>Precio</FieldLabel>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={precioEditorDraft.detalle.price}
                      onChange={(e) =>
                        updatePrecioEditorDraft((current) => {
                          const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "precio_fijo" }>;
                          return { ...draft, detalle: { ...draft.detalle, price: Number(e.target.value || 0) } };
                        })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Precio mínimo</FieldLabel>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={precioEditorDraft.detalle.minimumPrice}
                      onChange={(e) =>
                        updatePrecioEditorDraft((current) => {
                          const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "precio_fijo" }>;
                          return {
                            ...draft,
                            detalle: { ...draft.detalle, minimumPrice: Number(e.target.value || 0) },
                          };
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
            ) : null}

            {precioEditorDraft.metodoCalculo === "precio_fijo_para_margen_minimo" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Field>
                  <FieldLabel>Precio</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={precioEditorDraft.detalle.price}
                    onChange={(e) =>
                      updatePrecioEditorDraft((current) => {
                        const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "precio_fijo_para_margen_minimo" }>;
                        return { ...draft, detalle: { ...draft.detalle, price: Number(e.target.value || 0) } };
                      })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Precio mínimo</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={precioEditorDraft.detalle.minimumPrice}
                    onChange={(e) =>
                      updatePrecioEditorDraft((current) => {
                        const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "precio_fijo_para_margen_minimo" }>;
                        return {
                          ...draft,
                          detalle: { ...draft.detalle, minimumPrice: Number(e.target.value || 0) },
                        };
                      })
                    }
                  />
                </Field>
                <Field className="md:col-span-2">
                  <FieldLabel>Margen mínimo (%)</FieldLabel>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={precioEditorDraft.detalle.minimumMarginPct}
                    onChange={(e) =>
                      updatePrecioEditorDraft((current) => {
                        const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "precio_fijo_para_margen_minimo" }>;
                        return {
                          ...draft,
                          detalle: { ...draft.detalle, minimumMarginPct: Number(e.target.value || 0) },
                        };
                      })
                    }
                  />
                </Field>
              </div>
            ) : null}

            {precioEditorDraft.metodoCalculo === "fijado_por_cantidad" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Cantidades fijas con precio fijo: sólo se podrán vender las cantidades definidas en esta tabla, expresadas en {getUnidadComercialProductoSuffix(precioEditorDraft.measurementUnit)}.
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="min-w-[120px]">Cantidad ({getUnidadComercialProductoSuffix(precioEditorDraft.measurementUnit)})</TableHead>
                        <TableHead className="min-w-[140px]">Precio</TableHead>
                        <TableHead className="w-[90px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {precioEditorDraft.detalle.tiers.map((tier, index) => (
                        <TableRow key={`precio-cantidad-${index}`}>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={tier.quantity}
                              onChange={(e) =>
                                updatePrecioEditorDraft((current) => {
                                  const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "fijado_por_cantidad" }>;
                                  return {
                                    ...draft,
                                    detalle: {
                                      tiers: draft.detalle.tiers.map((item, rowIndex) =>
                                        rowIndex === index ? { ...item, quantity: Number(e.target.value || 1) } : item,
                                      ),
                                    },
                                  };
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={tier.price}
                              onChange={(e) =>
                                updatePrecioEditorDraft((current) => {
                                  const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "fijado_por_cantidad" }>;
                                  return {
                                    ...draft,
                                    detalle: {
                                      tiers: draft.detalle.tiers.map((item, rowIndex) =>
                                        rowIndex === index ? { ...item, price: Number(e.target.value || 0) } : item,
                                      ),
                                    },
                                  };
                                })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button type="button" variant="ghost" size="icon" onClick={() => removePrecioTierRow(index)}>
                              <Trash2Icon className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button type="button" variant="outline" onClick={addPrecioTierRow}>
                  <PlusIcon className="size-4" />
                  Agregar cantidad
                </Button>
              </div>
            ) : null}

            {precioEditorDraft.metodoCalculo === "fijo_con_margen_variable" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Cantidades fijas con margen variable: sólo se podrán vender las cantidades definidas en esta tabla en {getUnidadComercialProductoSuffix(precioEditorDraft.measurementUnit)} y cada cantidad usa su propio margen.
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="min-w-[120px]">Cantidad ({getUnidadComercialProductoSuffix(precioEditorDraft.measurementUnit)})</TableHead>
                        <TableHead className="min-w-[140px]">Margen (%)</TableHead>
                        <TableHead className="w-[90px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {precioEditorDraft.detalle.tiers.map((tier, index) => (
                        <TableRow key={`margen-fijo-cantidad-${index}`}>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={tier.quantity}
                              onChange={(e) =>
                                updatePrecioEditorDraft((current) => {
                                  const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>;
                                  return {
                                    ...draft,
                                    detalle: {
                                      tiers: draft.detalle.tiers.map((item, rowIndex) =>
                                        rowIndex === index ? { ...item, quantity: Number(e.target.value || 1) } : item,
                                      ),
                                    },
                                  };
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={tier.marginPct}
                              onChange={(e) =>
                                updatePrecioEditorDraft((current) => {
                                  const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>;
                                  return {
                                    ...draft,
                                    detalle: {
                                      tiers: draft.detalle.tiers.map((item, rowIndex) =>
                                        rowIndex === index ? { ...item, marginPct: Number(e.target.value || 0) } : item,
                                      ),
                                    },
                                  };
                                })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button type="button" variant="ghost" size="icon" onClick={() => removePrecioTierRow(index)}>
                              <Trash2Icon className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button type="button" variant="outline" onClick={addPrecioTierRow}>
                  <PlusIcon className="size-4" />
                  Agregar cantidad
                </Button>
              </div>
            ) : null}

            {precioEditorDraft.metodoCalculo === "variable_por_cantidad" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Rangos de precio con precio fijo: cada tramo define hasta qué cantidad en {getUnidadComercialProductoSuffix(precioEditorDraft.measurementUnit)} aplica ese precio.
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="min-w-[110px]">Rango</TableHead>
                        <TableHead className="min-w-[130px]">Hasta cantidad ({getUnidadComercialProductoSuffix(precioEditorDraft.measurementUnit)})</TableHead>
                        <TableHead className="min-w-[130px]">Precio</TableHead>
                        <TableHead className="w-[90px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {precioEditorDraft.detalle.tiers.map((tier, index) => (
                        <TableRow key={`precio-rango-${index}`}>
                          <TableCell className="text-sm text-muted-foreground">
                            {getVariableRangeLabel(index, tier.quantityUntil, precioEditorDraft.measurementUnit)}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={tier.quantityUntil}
                              onChange={(e) =>
                                updatePrecioEditorDraft((current) => {
                                  const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>;
                                  return {
                                    ...draft,
                                    detalle: {
                                      tiers: draft.detalle.tiers.map((item, rowIndex) =>
                                        rowIndex === index
                                          ? { ...item, quantityUntil: Number(e.target.value || 1) }
                                          : item,
                                      ),
                                    },
                                  };
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={tier.price}
                              onChange={(e) =>
                                updatePrecioEditorDraft((current) => {
                                  const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>;
                                  return {
                                    ...draft,
                                    detalle: {
                                      tiers: draft.detalle.tiers.map((item, rowIndex) =>
                                        rowIndex === index ? { ...item, price: Number(e.target.value || 0) } : item,
                                      ),
                                    },
                                  };
                                })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button type="button" variant="ghost" size="icon" onClick={() => removePrecioTierRow(index)}>
                              <Trash2Icon className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button type="button" variant="outline" onClick={addPrecioTierRow}>
                  <PlusIcon className="size-4" />
                  Agregar rango
                </Button>
              </div>
            ) : null}

            {precioEditorDraft.metodoCalculo === "margen_variable" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Cantidad libre por margen variable: cada tramo define hasta qué cantidad en {getUnidadComercialProductoSuffix(precioEditorDraft.measurementUnit)} aplica ese margen.
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="min-w-[110px]">Rango</TableHead>
                        <TableHead className="min-w-[130px]">Hasta cantidad ({getUnidadComercialProductoSuffix(precioEditorDraft.measurementUnit)})</TableHead>
                        <TableHead className="min-w-[130px]">Margen (%)</TableHead>
                        <TableHead className="w-[90px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {precioEditorDraft.detalle.tiers.map((tier, index) => (
                        <TableRow key={`margen-rango-${index}`}>
                          <TableCell className="text-sm text-muted-foreground">
                            {getVariableRangeLabel(index, tier.quantityUntil, precioEditorDraft.measurementUnit)}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={tier.quantityUntil}
                              onChange={(e) =>
                                updatePrecioEditorDraft((current) => {
                                  const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>;
                                  return {
                                    ...draft,
                                    detalle: {
                                      tiers: draft.detalle.tiers.map((item, rowIndex) =>
                                        rowIndex === index
                                          ? { ...item, quantityUntil: Number(e.target.value || 1) }
                                          : item,
                                      ),
                                    },
                                  };
                                })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={tier.marginPct}
                              onChange={(e) =>
                                updatePrecioEditorDraft((current) => {
                                  const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>;
                                  return {
                                    ...draft,
                                    detalle: {
                                      tiers: draft.detalle.tiers.map((item, rowIndex) =>
                                        rowIndex === index ? { ...item, marginPct: Number(e.target.value || 0) } : item,
                                      ),
                                    },
                                  };
                                })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button type="button" variant="ghost" size="icon" onClick={() => removePrecioTierRow(index)}>
                              <Trash2Icon className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button type="button" variant="outline" onClick={addPrecioTierRow}>
                  <PlusIcon className="size-4" />
                  Agregar rango
                </Button>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={handleCancelPrecioEditor}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSavePrecioFromEditor} disabled={isSavingPrecio}>
                {isSavingPrecio ? <GdiSpinner className="size-4" data-icon="inline-start" /> : null}
                Guardar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={precioEspecialClienteEditorOpen} onOpenChange={setPrecioEspecialClienteEditorOpen}>
        <SheetContent
          side="right"
          className="overflow-y-auto px-4 py-6 data-[side=right]:w-[96vw] data-[side=right]:max-w-none sm:px-6 sm:data-[side=right]:w-[72vw] sm:data-[side=right]:max-w-none lg:px-8 lg:data-[side=right]:w-[32vw] lg:data-[side=right]:min-w-[560px] lg:data-[side=right]:max-w-none"
        >
          <SheetHeader className="border-b pb-4">
            <SheetTitle>{precioEspecialClienteEditorDraft.clienteId ? "Editar precio especial" : "Añadir precio especial"}</SheetTitle>
            <SheetDescription>
              Define una regla comercial especial para un cliente.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <Field>
              <FieldLabel>Cliente</FieldLabel>
              <Select
                value={precioEspecialClienteEditorDraft.clienteId || "__none__"}
                onValueChange={(value) => {
                  const nextValue = value ?? "__none__";
                  const cliente = clientesOptions.find((item) => item.id === nextValue);
                  updatePrecioEspecialClienteEditorDraft((current) => ({
                    ...current,
                    clienteId: nextValue === "__none__" ? "" : nextValue,
                    clienteNombre: nextValue === "__none__" ? "" : (cliente?.nombre ?? ""),
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona cliente">
                    {precioEspecialClienteEditorDraft.clienteNombre || "Selecciona cliente"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecciona cliente</SelectItem>
                  {clientesOptions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid gap-3 md:grid-cols-2">
              <Field>
                <FieldLabel>Método de cálculo</FieldLabel>
                <Select
                  value={precioEspecialClienteEditorDraft.metodoCalculo}
                  onValueChange={(value) =>
                    handleChangeMetodoCalculoPrecioEspecialCliente(
                      (value as MetodoCalculoPrecioProducto) ?? "margen_variable",
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona método">
                      {getPrecioMethodLabel(precioEspecialClienteEditorDraft.metodoCalculo)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {metodoCalculoPrecioItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Unidad comercial</FieldLabel>
                <Input
                  value={getUnidadComercialProductoLabel(
                    normalizeWideFormatMeasurementUnit(
                      precioEspecialClienteEditorDraft.measurementUnit,
                      normalizeUnidadComercialProducto(productoState.unidadComercial),
                    ),
                  )}
                  disabled
                />
              </Field>
            </div>

            <Field>
              <FieldLabel>Descripción</FieldLabel>
              <Input
                value={precioEspecialClienteEditorDraft.descripcion}
                onChange={(e) =>
                  updatePrecioEspecialClienteEditorDraft((current) => ({
                    ...current,
                    descripcion: e.target.value,
                  }))
                }
                placeholder="Opcional"
              />
            </Field>

            {precioEspecialClienteEditorDraft.metodoCalculo === "por_margen" ? (
              <div className="grid gap-3 md:grid-cols-2">
                {(() => {
                  const draft = precioEspecialClienteEditorDraft as PrecioEspecialClienteDraft & {
                    detalle: Extract<ProductoPrecioConfig, { metodoCalculo: "por_margen" }>["detalle"];
                  };
                  return (
                    <>
                      <Field>
                        <FieldLabel>Margen (%)</FieldLabel>
                        <Input type="number" min="0" step="0.01" value={draft.detalle.marginPct} onChange={(e) => updatePrecioEspecialClienteEditorDraft((current) => ({ ...current, detalle: { ...(current.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "por_margen" }>["detalle"]), marginPct: Number(e.target.value || 0) } }))} />
                      </Field>
                      <Field>
                        <FieldLabel>Margen mínimo (%)</FieldLabel>
                        <Input type="number" min="0" step="0.01" value={draft.detalle.minimumMarginPct} onChange={(e) => updatePrecioEspecialClienteEditorDraft((current) => ({ ...current, detalle: { ...(current.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "por_margen" }>["detalle"]), minimumMarginPct: Number(e.target.value || 0) } }))} />
                      </Field>
                    </>
                  );
                })()}
              </div>
            ) : null}

            {precioEspecialClienteEditorDraft.metodoCalculo === "precio_fijo" ? (
              <div className="grid gap-3 md:grid-cols-2">
                {(() => {
                  const draft = precioEspecialClienteEditorDraft as PrecioEspecialClienteDraft & {
                    detalle: Extract<ProductoPrecioConfig, { metodoCalculo: "precio_fijo" }>["detalle"];
                  };
                  return (
                    <>
                      <Field>
                        <FieldLabel>Precio</FieldLabel>
                        <Input type="number" min="0" step="0.01" value={draft.detalle.price} onChange={(e) => updatePrecioEspecialClienteEditorDraft((current) => ({ ...current, detalle: { ...(current.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "precio_fijo" }>["detalle"]), price: Number(e.target.value || 0) } }))} />
                      </Field>
                      <Field>
                        <FieldLabel>Precio mínimo</FieldLabel>
                        <Input type="number" min="0" step="0.01" value={draft.detalle.minimumPrice} onChange={(e) => updatePrecioEspecialClienteEditorDraft((current) => ({ ...current, detalle: { ...(current.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "precio_fijo" }>["detalle"]), minimumPrice: Number(e.target.value || 0) } }))} />
                      </Field>
                    </>
                  );
                })()}
              </div>
            ) : null}

            {precioEspecialClienteEditorDraft.metodoCalculo === "fijado_por_cantidad" ? (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Cantidad ({getUnidadComercialProductoSuffix(precioEspecialClienteEditorDraft.measurementUnit)})</TableHead>
                        <TableHead>Precio</TableHead>
                        <TableHead className="w-[90px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(precioEspecialClienteEditorDraft.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijado_por_cantidad" }>["detalle"]).tiers.map((tier, index) => (
                        <TableRow key={`especial-precio-${index}`}>
                          <TableCell>
                            <Input type="number" min="1" step="1" value={tier.quantity} onChange={(e) => updatePrecioEspecialClienteEditorDraft((current) => ({ ...current, detalle: { tiers: (current.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijado_por_cantidad" }>["detalle"]).tiers.map((item, rowIndex) => rowIndex === index ? { ...item, quantity: Number(e.target.value || 1) } : item) } }))} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min="0" step="0.01" value={tier.price} onChange={(e) => updatePrecioEspecialClienteEditorDraft((current) => ({ ...current, detalle: { tiers: (current.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijado_por_cantidad" }>["detalle"]).tiers.map((item, rowIndex) => rowIndex === index ? { ...item, price: Number(e.target.value || 0) } : item) } }))} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button type="button" variant="ghost" size="icon" onClick={() => removePrecioEspecialClienteTierRow(index)}>
                              <Trash2Icon className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button type="button" variant="outline" onClick={addPrecioEspecialClienteTierRow}>
                  <PlusIcon className="size-4" />
                  Agregar cantidad
                </Button>
              </div>
            ) : null}

            {precioEspecialClienteEditorDraft.metodoCalculo === "fijo_con_margen_variable" ? (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Cantidad ({getUnidadComercialProductoSuffix(precioEspecialClienteEditorDraft.measurementUnit)})</TableHead>
                        <TableHead>Margen (%)</TableHead>
                        <TableHead className="w-[90px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(precioEspecialClienteEditorDraft.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>["detalle"]).tiers.map((tier, index) => (
                        <TableRow key={`especial-margen-fijo-${index}`}>
                          <TableCell>
                            <Input type="number" min="1" step="1" value={tier.quantity} onChange={(e) => updatePrecioEspecialClienteEditorDraft((current) => ({ ...current, detalle: { tiers: (current.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>["detalle"]).tiers.map((item, rowIndex) => rowIndex === index ? { ...item, quantity: Number(e.target.value || 1) } : item) } }))} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min="0" step="0.01" value={tier.marginPct} onChange={(e) => updatePrecioEspecialClienteEditorDraft((current) => ({ ...current, detalle: { tiers: (current.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>["detalle"]).tiers.map((item, rowIndex) => rowIndex === index ? { ...item, marginPct: Number(e.target.value || 0) } : item) } }))} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button type="button" variant="ghost" size="icon" onClick={() => removePrecioEspecialClienteTierRow(index)}>
                              <Trash2Icon className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button type="button" variant="outline" onClick={addPrecioEspecialClienteTierRow}>
                  <PlusIcon className="size-4" />
                  Agregar cantidad
                </Button>
              </div>
            ) : null}

            {precioEspecialClienteEditorDraft.metodoCalculo === "variable_por_cantidad" ? (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Rango</TableHead>
                        <TableHead>Hasta cantidad ({getUnidadComercialProductoSuffix(precioEspecialClienteEditorDraft.measurementUnit)})</TableHead>
                        <TableHead>Precio</TableHead>
                        <TableHead className="w-[90px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(precioEspecialClienteEditorDraft.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>["detalle"]).tiers.map((tier, index) => (
                        <TableRow key={`especial-rango-precio-${index}`}>
                          <TableCell className="text-sm text-muted-foreground">{getVariableRangeLabel(index, tier.quantityUntil, precioEspecialClienteEditorDraft.measurementUnit)}</TableCell>
                          <TableCell>
                            <Input type="number" min="1" step="1" value={tier.quantityUntil} onChange={(e) => updatePrecioEspecialClienteEditorDraft((current) => ({ ...current, detalle: { tiers: (current.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>["detalle"]).tiers.map((item, rowIndex) => rowIndex === index ? { ...item, quantityUntil: Number(e.target.value || 1) } : item) } }))} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min="0" step="0.01" value={tier.price} onChange={(e) => updatePrecioEspecialClienteEditorDraft((current) => ({ ...current, detalle: { tiers: (current.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>["detalle"]).tiers.map((item, rowIndex) => rowIndex === index ? { ...item, price: Number(e.target.value || 0) } : item) } }))} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button type="button" variant="ghost" size="icon" onClick={() => removePrecioEspecialClienteTierRow(index)}>
                              <Trash2Icon className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button type="button" variant="outline" onClick={addPrecioEspecialClienteTierRow}>
                  <PlusIcon className="size-4" />
                  Agregar rango
                </Button>
              </div>
            ) : null}

            {precioEspecialClienteEditorDraft.metodoCalculo === "margen_variable" ? (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Rango</TableHead>
                        <TableHead>Hasta cantidad ({getUnidadComercialProductoSuffix(precioEspecialClienteEditorDraft.measurementUnit)})</TableHead>
                        <TableHead>Margen (%)</TableHead>
                        <TableHead className="w-[90px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(precioEspecialClienteEditorDraft.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>["detalle"]).tiers.map((tier, index) => (
                        <TableRow key={`especial-rango-margen-${index}`}>
                          <TableCell className="text-sm text-muted-foreground">{getVariableRangeLabel(index, tier.quantityUntil, precioEspecialClienteEditorDraft.measurementUnit)}</TableCell>
                          <TableCell>
                            <Input type="number" min="1" step="1" value={tier.quantityUntil} onChange={(e) => updatePrecioEspecialClienteEditorDraft((current) => ({ ...current, detalle: { tiers: (current.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>["detalle"]).tiers.map((item, rowIndex) => rowIndex === index ? { ...item, quantityUntil: Number(e.target.value || 1) } : item) } }))} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min="0" step="0.01" value={tier.marginPct} onChange={(e) => updatePrecioEspecialClienteEditorDraft((current) => ({ ...current, detalle: { tiers: (current.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>["detalle"]).tiers.map((item, rowIndex) => rowIndex === index ? { ...item, marginPct: Number(e.target.value || 0) } : item) } }))} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button type="button" variant="ghost" size="icon" onClick={() => removePrecioEspecialClienteTierRow(index)}>
                              <Trash2Icon className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button type="button" variant="outline" onClick={addPrecioEspecialClienteTierRow}>
                  <PlusIcon className="size-4" />
                  Agregar rango
                </Button>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setPrecioEspecialClienteEditorOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSavePrecioEspecialClienteDraft} disabled={isSavingPrecioEspecialClientes}>
                {isSavingPrecioEspecialClientes ? <GdiSpinner className="size-4" data-icon="inline-start" /> : null}
                Guardar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={precioComisionEditorOpen} onOpenChange={setPrecioComisionEditorOpen}>
        <SheetContent
          side="right"
          className="overflow-y-auto px-4 py-6 data-[side=right]:w-[96vw] data-[side=right]:max-w-none sm:px-6 sm:data-[side=right]:w-[52vw] sm:data-[side=right]:max-w-none lg:px-8 lg:data-[side=right]:w-[30vw] lg:data-[side=right]:min-w-[440px] lg:data-[side=right]:max-w-none"
        >
          <SheetHeader className="border-b pb-4">
            <SheetTitle>{precioForm.comisiones.items.some((item) => item.id === precioComisionEditorDraft.id) ? "Editar comisión" : "Añadir comisión"}</SheetTitle>
            <SheetDescription>
              Configura un cargo financiero o una comisión comercial del producto.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input
                value={precioComisionEditorDraft.nombre}
                onChange={(e) =>
                  setPrecioComisionEditorDraft((current) => ({
                    ...current,
                    nombre: e.target.value,
                  }))
                }
                placeholder="Ej: Mercado Pago o Comisión vendedor"
              />
            </Field>

            <div className="grid gap-3 md:grid-cols-2">
              <Field>
                <FieldLabel>Tipo</FieldLabel>
                <Select
                  value={precioComisionEditorDraft.tipo}
                  onValueChange={(value) =>
                    setPrecioComisionEditorDraft((current) => ({
                      ...current,
                      tipo: (value as ProductoPrecioComisionTipo) ?? "financiera",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tipo">
                      {precioComisionTipoLabels[precioComisionEditorDraft.tipo]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {precioComisionTipoItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Porcentaje (%)</FieldLabel>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={precioComisionEditorDraft.porcentaje}
                  onChange={(e) =>
                    setPrecioComisionEditorDraft((current) => ({
                      ...current,
                      porcentaje: Number(e.target.value || 0),
                    }))
                  }
                />
              </Field>
            </div>

            <div className="flex items-center gap-2 rounded-md border px-3 py-2">
              <Switch
                checked={precioComisionEditorDraft.activo}
                onCheckedChange={(checked) =>
                  setPrecioComisionEditorDraft((current) => ({
                    ...current,
                    activo: Boolean(checked),
                  }))
                }
              />
              <span className="text-sm">Comisión activa</span>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setPrecioComisionEditorOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSavePrecioComisionDraft}>
                Aplicar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={impuestosEditorOpen} onOpenChange={setImpuestosEditorOpen}>
        <SheetContent
          side="right"
          className="overflow-y-auto px-4 py-6 data-[side=right]:w-[96vw] data-[side=right]:max-w-none sm:px-6 sm:data-[side=right]:w-[52vw] sm:data-[side=right]:max-w-none lg:px-8 lg:data-[side=right]:w-[30vw] lg:data-[side=right]:min-w-[440px] lg:data-[side=right]:max-w-none"
        >
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Administrar impuestos</SheetTitle>
            <SheetDescription>
              Edita el detalle del esquema impositivo seleccionado.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <Field>
              <FieldLabel>Esquema</FieldLabel>
              <Select
                value={impuestosEditorDraft?.id ?? "__none__"}
                onValueChange={(value) =>
                  setImpuestosEditorDraft(
                    impuestosCatalogoActivos.find((item) => item.id === value) ?? null,
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona esquema">
                    {impuestosEditorDraft?.nombre || "Selecciona esquema"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {impuestosCatalogoActivos.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {impuestosEditorDraft ? (
              <div className="space-y-3">
                {impuestosEditorDraft.detalle.items.map((item, index) => (
                  <Field key={`${impuestosEditorDraft.id}-${item.nombre}-${index}`}>
                    <FieldLabel>{item.nombre}</FieldLabel>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.porcentaje}
                      onChange={(e) =>
                        setImpuestosEditorDraft((current) =>
                          current
                            ? {
                                ...current,
                                detalle: {
                                  items: current.detalle.items.map((entry, itemIndex) =>
                                    itemIndex === index
                                      ? { ...entry, porcentaje: Number(e.target.value || 0) }
                                      : entry,
                                  ),
                                },
                              }
                            : current,
                        )
                      }
                    />
                  </Field>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay un esquema impositivo disponible para editar.</p>
            )}

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setImpuestosEditorOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSaveImpuestosEditor} disabled={isSavingImpuestosCatalogo || !impuestosEditorDraft}>
                {isSavingImpuestosCatalogo ? <GdiSpinner className="size-4" data-icon="inline-start" /> : null}
                Aplicar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={Boolean(precioEspecialClienteToDelete)}
        onOpenChange={(open) => (!open ? setPrecioEspecialClienteToDelete(null) : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar precio especial</AlertDialogTitle>
            <AlertDialogDescription>
              {precioEspecialClienteToDelete
                ? `Vas a eliminar el precio especial de "${precioEspecialClienteToDelete.clienteNombre}". Esta acción no se puede deshacer.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingPrecioEspecialClientes}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSavingPrecioEspecialClientes}
              onClick={() => {
                if (!precioEspecialClienteToDelete) return;
                handleDeletePrecioEspecialCliente(precioEspecialClienteToDelete.id);
                setPrecioEspecialClienteToDelete(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(precioComisionToDelete)}
        onOpenChange={(open) => (!open ? setPrecioComisionToDelete(null) : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar comisión</AlertDialogTitle>
            <AlertDialogDescription>
              {precioComisionToDelete
                ? `Vas a eliminar la comisión "${precioComisionToDelete.nombre}". Esta acción no se puede deshacer.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!precioComisionToDelete) return;
                handleDeletePrecioComision(precioComisionToDelete.id);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
