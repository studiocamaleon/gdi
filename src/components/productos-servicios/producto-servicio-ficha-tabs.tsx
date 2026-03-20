"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GripVerticalIcon,
  InfoIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  Settings2Icon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import type { ClienteDetalle } from "@/lib/clientes";
import type { MateriaPrima } from "@/lib/materias-primas";
import type { Maquina } from "@/lib/maquinaria";
import type { Proceso } from "@/lib/procesos";
import {
  modoProductividadProcesoItems,
  tipoOperacionProcesoItems,
  unidadProcesoItems,
  type ProcesoOperacionPayload,
  type ProcesoOperacionPlantilla,
  type UnidadProceso,
} from "@/lib/procesos";
import {
  createProceso,
  getProcesoOperacionPlantillas,
} from "@/lib/procesos-api";
import {
  assignProductoMotor,
  assignProductoVarianteRuta,
  cotizarProductoVariante,
  createProductoVariante,
  deleteProductoVariante,
  getCatalogoPliegosImpresion,
  getCotizacionProductoById,
  getCotizacionesProductoVariante,
  getProductoMotorConfig,
  getVarianteMotorOverride,
  previewImposicionProductoVariante,
  updateProductoImpuesto,
  updateProductoRutaPolicy,
  updateProductoPrecio,
  updateProductoPrecioEspecialClientes,
  upsertVarianteMotorOverride,
  updateProductoServicio,
  updateProductoVariante,
  updateVarianteOpcionesProductivas,
} from "@/lib/productos-servicios-api";
import type {
  DimensionOpcionProductiva,
  FamiliaProducto,
  MetodoCalculoPrecioProducto,
  MotorCostoCatalogItem,
  PliegoImpresionCatalogItem,
  CotizacionProductoSnapshotResumen,
  CotizacionProductoVariante,
  ProductoChecklist,
  ProductoPrecioComisionItem,
  ProductoPrecioComisionTipo,
  ProductoPrecioConfig,
  ProductoPrecioEspecialCliente,
  ProductoImpuestoCatalogo,
  ProductoPrecioFilaCantidadMargen,
  ProductoPrecioFilaCantidadPrecio,
  ProductoPrecioFilaRangoMargen,
  ProductoPrecioFilaRangoPrecio,
  ProductoRutaBaseMatchingVariante,
  ProductoServicio,
  ProductoVariante,
  SubfamiliaProducto,
  ValorOpcionProductiva,
} from "@/lib/productos-servicios";
import {
  carasProductoVarianteItems,
  estadoProductoServicioItems,
  tipoImpresionProductoVarianteItems,
} from "@/lib/productos-servicios";
import { simularPrecioComercial } from "@/lib/productos-servicios-simulacion";
import { Badge } from "@/components/ui/badge";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ProductoServicioChecklistCotizador,
  ProductoServicioChecklistEditor,
} from "@/components/productos-servicios/producto-servicio-checklist";

type PapelOption = {
  id: string;
  sku: string;
  label: string;
  precioReferencia: number | null;
  anchoMm: number | null;
  altoMm: number | null;
  resumen: string;
};

type ProductoServicioFichaTabsProps = {
  producto: ProductoServicio;
  initialVariantes: ProductoVariante[];
  initialClientes: ClienteDetalle[];
  initialImpuestosCatalogo: ProductoImpuestoCatalogo[];
  procesos: Proceso[];
  plantillasPaso: ProcesoOperacionPlantilla[];
  materiasPrimas: MateriaPrima[];
  familias: FamiliaProducto[];
  subfamilias: SubfamiliaProducto[];
  motores: MotorCostoCatalogItem[];
  checklist: ProductoChecklist;
  maquinas: Maquina[];
};

type VarianteDraft = {
  nombre: string;
  anchoMm: string;
  altoMm: string;
  papelVarianteId: string;
  tipoImpresion: "bn" | "cmyk";
  caras: "simple_faz" | "doble_faz";
  opcionesTipoImpresion: Array<"bn" | "cmyk">;
  opcionesCaras: Array<"simple_faz" | "doble_faz">;
};

type VarianteEditDraft = VarianteDraft;
type VarianteConfirmAction =
  | { type: "delete"; variante: ProductoVariante }
  | { type: "toggle"; variante: ProductoVariante; nextActive: boolean };
type PrecioEspecialClienteConfirmDelete = {
  id: string;
  clienteNombre: string;
};

type RouteOperationDraft = ProcesoOperacionPayload & {
  id: string;
};

type RutaBaseMatchingDraft = {
  tipoImpresion: "bn" | "cmyk" | null;
  caras: "simple_faz" | "doble_faz" | null;
  pasoPlantillaId: string;
  perfilOperativoId: string;
};

type RutaBasePasoFijoDraft = {
  pasoPlantillaId: string;
  perfilOperativoId: string;
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

const dimensionBaseLabelByValue: Record<DimensionOpcionProductiva, string> = {
  tipo_impresion: "Tipo de impresión",
  caras: "Caras",
};

const valorOpcionBaseLabelByValue: Record<ValorOpcionProductiva, string> = {
  bn: "Escala de grises",
  cmyk: "CMYK",
  simple_faz: "Simple faz",
  doble_faz: "Doble faz",
};

const tipoImpresionPermitidoSelectItems = [
  { value: "cmyk", label: "Solo CMYK", values: ["cmyk"] as Array<"bn" | "cmyk"> },
  { value: "bn", label: "Solo K", values: ["bn"] as Array<"bn" | "cmyk"> },
  { value: "cmyk_bn", label: "CMYK y K", values: ["cmyk", "bn"] as Array<"bn" | "cmyk"> },
];

const carasPermitidasSelectItems = [
  { value: "simple_faz", label: "Solo simple faz", values: ["simple_faz"] as Array<"simple_faz" | "doble_faz"> },
  { value: "doble_faz", label: "Solo doble faz", values: ["doble_faz"] as Array<"simple_faz" | "doble_faz"> },
  { value: "simple_doble", label: "Simple y doble faz", values: ["simple_faz", "doble_faz"] as Array<"simple_faz" | "doble_faz"> },
];

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
    return {
      marginPct: current.marginPct,
      minimumMarginPct: current.minimumMarginPct,
    };
  }
  if (metodoCalculo === "precio_fijo") {
    const current = detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "precio_fijo" }>["detalle"];
    return {
      price: current.price,
      minimumPrice: current.minimumPrice,
    };
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
    return {
      tiers: current.tiers.map((tier) => ({ ...tier })),
    };
  }
  if (metodoCalculo === "fijo_con_margen_variable") {
    const current = detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>["detalle"];
    return {
      tiers: current.tiers.map((tier) => ({ ...tier })),
    };
  }
  if (metodoCalculo === "variable_por_cantidad") {
    const current = detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>["detalle"];
    return {
      tiers: current.tiers.map((tier) => ({ ...tier })),
    };
  }
  const current = detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>["detalle"];
  return {
    tiers: current.tiers.map((tier) => ({ ...tier })),
  };
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
  if (value === "margen_variable") {
    return "Define márgenes por tramos para vender en cualquier cantidad.";
  }
  if (value === "por_margen") {
    return "El precio de venta se calcula desde el costo usando un margen fijo.";
  }
  if (value === "precio_fijo") {
    return "El precio de venta se define manualmente como un valor fijo único.";
  }
  if (value === "fijado_por_cantidad") {
    return "Define cantidades exactas habilitadas y un precio fijo para cada una.";
  }
  if (value === "fijo_con_margen_variable") {
    return "Define cantidades exactas habilitadas y un margen variable para cada una.";
  }
  if (value === "variable_por_cantidad") {
    return "Define rangos de cantidad con un precio fijo para cada tramo.";
  }
  return "Define los parámetros comerciales del método seleccionado.";
}

function getVariableRangeLabel(index: number, quantityUntil: number) {
  if (index === 0) return `Hasta ${quantityUntil}`;
  return `Hasta ${quantityUntil}`;
}

const tipoCorteItems = [
  { value: "sin_demasia", label: "Sin demasía", help: "Corte al borde de la pieza, sin separación interna." },
  { value: "con_demasia", label: "Con demasía", help: "Agrega margen técnico alrededor de cada pieza." },
] as const;

const fallbackPliegosImpresion: PliegoImpresionCatalogItem[] = [
  { codigo: "A6", nombre: "A6", anchoMm: 105, altoMm: 148, label: "A6 (105 x 148 mm)" },
  { codigo: "A5", nombre: "A5", anchoMm: 148, altoMm: 210, label: "A5 (148 x 210 mm)" },
  { codigo: "A4", nombre: "A4", anchoMm: 210, altoMm: 297, label: "A4 (210 x 297 mm)" },
  { codigo: "A3", nombre: "A3", anchoMm: 297, altoMm: 420, label: "A3 (297 x 420 mm)" },
  { codigo: "SRA3", nombre: "SRA3", anchoMm: 320, altoMm: 450, label: "SRA3 (320 x 450 mm)" },
];

function buildDefaultPeriodo() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function createVarianteDraft(papeles: PapelOption[]): VarianteDraft {
  return {
    nombre: "",
    anchoMm: "90",
    altoMm: "50",
    papelVarianteId: papeles[0]?.id ?? "",
    tipoImpresion: "cmyk",
    caras: "simple_faz",
    opcionesTipoImpresion: ["cmyk"],
    opcionesCaras: ["simple_faz"],
  };
}

function createEditVarianteDraft(variante: ProductoVariante, papeles: PapelOption[]): VarianteEditDraft {
  const opcionesTipoImpresion =
    variante.opcionesProductivas?.find((item) => item.dimension === "tipo_impresion")?.valores.filter(
      (value): value is "bn" | "cmyk" => value === "bn" || value === "cmyk",
    ) ?? [variante.tipoImpresion];
  const opcionesCaras =
    variante.opcionesProductivas?.find((item) => item.dimension === "caras")?.valores.filter(
      (value): value is "simple_faz" | "doble_faz" => value === "simple_faz" || value === "doble_faz",
    ) ?? [variante.caras];
  return {
    nombre: variante.nombre,
    anchoMm: String(variante.anchoMm),
    altoMm: String(variante.altoMm),
    papelVarianteId: variante.papelVarianteId ?? papeles[0]?.id ?? "",
    tipoImpresion: variante.tipoImpresion,
    caras: variante.caras,
    opcionesTipoImpresion: opcionesTipoImpresion.length ? opcionesTipoImpresion : [variante.tipoImpresion],
    opcionesCaras: opcionesCaras.length ? opcionesCaras : [variante.caras],
  };
}

function buildRutaBaseMatchingDraft(
  producto: ProductoServicio,
  variantes: ProductoVariante[],
) {
  const current = new Map(
    (producto.matchingBasePorVariante ?? []).map((item) => [
      item.varianteId,
      item.matching.map((row) => ({
        tipoImpresion: row.tipoImpresion,
        caras: row.caras,
        pasoPlantillaId: row.pasoPlantillaId,
        perfilOperativoId: row.perfilOperativoId,
      })),
    ]),
  );
  const next: Record<string, RutaBaseMatchingDraft[]> = {};
  for (const variante of variantes) {
    next[variante.id] = current.get(variante.id) ?? [];
  }
  return next;
}

function buildRutaBasePasosFijosDraft(
  producto: ProductoServicio,
  variantes: ProductoVariante[],
) {
  const current = new Map(
    (producto.pasosFijosPorVariante ?? []).map((item) => [
      item.varianteId,
      item.pasos.map((row) => ({
        pasoPlantillaId: row.pasoPlantillaId,
        perfilOperativoId: row.perfilOperativoId,
      })),
    ]),
  );
  const next: Record<string, RutaBasePasoFijoDraft[]> = {};
  for (const variante of variantes) {
    next[variante.id] = current.get(variante.id) ?? [];
  }
  return next;
}

function normalizeRutaBaseMatchingDraftForVariantes(
  nextMatchingDraft: Record<string, RutaBaseMatchingDraft[]>,
  variantes: ProductoVariante[],
  dimensionesConsumidas: DimensionOpcionProductiva[],
) {
  const normalized: Record<string, RutaBaseMatchingDraft[]> = {};
  for (const variante of variantes) {
    const rows = buildMatchingRowsForVariante(
      variante,
      dimensionesConsumidas,
      nextMatchingDraft[variante.id] ?? [],
    );
    normalized[variante.id] = rows.map((row) => ({
      tipoImpresion: row.tipoImpresion,
      caras: row.caras,
      pasoPlantillaId: row.pasoPlantillaId,
      perfilOperativoId: row.perfilOperativoId,
    }));
  }
  return normalized;
}

function buildDimensionesBaseConsumidasDraft(producto: ProductoServicio) {
  return producto.dimensionesBaseConsumidas ?? [];
}

function getValoresOpcionesBase(variante: ProductoVariante, dimension: DimensionOpcionProductiva) {
  if (dimension === "tipo_impresion") {
    return (
      variante.opcionesProductivas?.find((item) => item.dimension === "tipo_impresion")?.valores.filter(
        (value): value is "bn" | "cmyk" => value === "bn" || value === "cmyk",
      ) ?? [variante.tipoImpresion]
    );
  }
  return (
    variante.opcionesProductivas?.find((item) => item.dimension === "caras")?.valores.filter(
      (value): value is "simple_faz" | "doble_faz" => value === "simple_faz" || value === "doble_faz",
    ) ?? [variante.caras]
  );
}

function toggleAllowedValue<T extends string>(currentValues: T[], value: T, fallbackValue: T) {
  const current = new Set(currentValues);
  if (current.has(value)) {
    current.delete(value);
  } else {
    current.add(value);
  }
  const next = Array.from(current) as T[];
  return next.length ? next : [fallbackValue];
}

function getTipoImpresionPermitidoSelectValue(values: Array<"bn" | "cmyk">) {
  const normalized = [...new Set(values)].sort().join("|");
  if (normalized === "bn") return "bn";
  if (normalized === "bn|cmyk") return "cmyk_bn";
  return "cmyk";
}

function getCarasPermitidasSelectValue(values: Array<"simple_faz" | "doble_faz">) {
  const normalized = [...new Set(values)].sort().join("|");
  if (normalized === "doble_faz") return "doble_faz";
  if (normalized === "doble_faz|simple_faz") return "simple_doble";
  return "simple_faz";
}

function buildMatchingRowsForVariante(
  variante: ProductoVariante,
  dimensionesConsumidas: DimensionOpcionProductiva[],
  currentMatching: RutaBaseMatchingDraft[],
  defaultPasoPlantillaId?: string,
) {
  const tipos = dimensionesConsumidas.includes("tipo_impresion")
    ? getValoresOpcionesBase(variante, "tipo_impresion").filter(
        (value): value is "bn" | "cmyk" => value === "bn" || value === "cmyk",
      )
    : [null];
  const caras = dimensionesConsumidas.includes("caras")
    ? getValoresOpcionesBase(variante, "caras").filter(
        (value): value is "simple_faz" | "doble_faz" => value === "simple_faz" || value === "doble_faz",
      )
    : [null];

  return tipos.flatMap((tipoImpresion) =>
    caras.map((carasValue) => {
      const current =
        currentMatching.find(
          (item) => item.tipoImpresion === tipoImpresion && item.caras === carasValue,
        ) ?? null;
      return {
        key: `${tipoImpresion ?? "na"}-${carasValue ?? "na"}`,
        tipoImpresion,
        caras: carasValue,
        pasoPlantillaId: current?.pasoPlantillaId ?? defaultPasoPlantillaId ?? "",
        perfilOperativoId: current?.perfilOperativoId ?? "",
      };
    }),
  );
}

function getGuillotinaCutsFromImposicion(
  cols: number,
  rows: number,
  tipoCorte: "sin_demasia" | "con_demasia",
) {
  const normalizedCols = Math.max(0, Math.floor(cols));
  const normalizedRows = Math.max(0, Math.floor(rows));
  if (normalizedCols <= 0 || normalizedRows <= 0) {
    return 0;
  }
  if (tipoCorte === "con_demasia") {
    return normalizedCols * 2 + normalizedRows * 2;
  }
  return normalizedCols + normalizedRows + 2;
}

function normalizePasoNombreBase(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return "";
  const colonIndex = normalized.indexOf(":");
  if (colonIndex <= 0) {
    return normalized;
  }
  return normalized.slice(0, colonIndex).trim();
}

function resolveProcesoOperacionPlantilla(
  operacion: Pick<Proceso["operaciones"][number], "nombre" | "maquinaId" | "perfilOperativoId" | "detalle">,
  plantillasPaso: ProcesoOperacionPlantilla[],
) {
  const operationName = operacion.nombre.trim().toLowerCase();
  const operationBaseName = normalizePasoNombreBase(operacion.nombre);
  const pasoPlantillaId =
    operacion.detalle && typeof operacion.detalle === "object"
      ? String((operacion.detalle as Record<string, unknown>).pasoPlantillaId ?? "").trim()
      : "";
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

function isPerfilCompatibleWithMatchingRow(
  perfil: Maquina["perfilesOperativos"][number],
  row: { tipoImpresion: "bn" | "cmyk" | null; caras: "simple_faz" | "doble_faz" | null },
) {
  const normalizedPrintMode = perfil.printMode || null;
  const normalizedPrintSides = perfil.printSides || null;
  if (row.tipoImpresion && normalizedPrintMode && normalizedPrintMode !== row.tipoImpresion) {
    return false;
  }
  if (row.caras && normalizedPrintSides && normalizedPrintSides !== row.caras) {
    return false;
  }
  return true;
}

function getRutaBasePasoOptions(
  procesoId: string | null | undefined,
  procesos: Proceso[],
  plantillasPaso: ProcesoOperacionPlantilla[],
  maquinas: Maquina[],
  dimensionesConsumidas: DimensionOpcionProductiva[],
) {
  const proceso = procesos.find((item) => item.id === procesoId) ?? null;
  if (!proceso) return [];
  const maquinaById = new Map(maquinas.map((item) => [item.id, item]));
  const requiresBasePrintMatching =
    dimensionesConsumidas.includes("tipo_impresion") || dimensionesConsumidas.includes("caras");
  const matches = proceso.operaciones
    .map((op) => resolveProcesoOperacionPlantilla(op, plantillasPaso))
    .filter((item): item is ProcesoOperacionPlantilla => Boolean(item))
    .filter((item) => {
      if (!requiresBasePrintMatching) {
        return true;
      }
      if (!item.maquinaId) {
        return false;
      }
      const maquina = maquinaById.get(item.maquinaId);
      if (!maquina) {
        return false;
      }
      return maquina.plantilla === "impresora_laser";
    });

  return Array.from(new Map(matches.map((item) => [item.id, item])).values());
}

function getRutaBasePasoFijoOptions(
  procesoId: string | null | undefined,
  procesos: Proceso[],
  plantillasPaso: ProcesoOperacionPlantilla[],
  maquinas: Maquina[],
  dimensionesConsumidas: DimensionOpcionProductiva[],
) {
  const matchingIds = new Set(
    getRutaBasePasoOptions(procesoId, procesos, plantillasPaso, maquinas, dimensionesConsumidas).map((item) => item.id),
  );
  const proceso = procesos.find((item) => item.id === procesoId) ?? null;
  if (!proceso) return [];
  const matches = proceso.operaciones
    .map((op) => resolveProcesoOperacionPlantilla(op, plantillasPaso))
    .filter((item): item is ProcesoOperacionPlantilla => Boolean(item))
    .filter((item) => !matchingIds.has(item.id));

  return Array.from(new Map(matches.map((item) => [item.id, item])).values());
}

function getRutaPasoOptions(
  procesoId: string | null | undefined,
  procesos: Proceso[],
  plantillasPaso: ProcesoOperacionPlantilla[],
) {
  const proceso = procesos.find((item) => item.id === procesoId) ?? null;
  if (!proceso) return [];
  const matches = proceso.operaciones
    .map((op) => resolveProcesoOperacionPlantilla(op, plantillasPaso))
    .filter((item): item is ProcesoOperacionPlantilla => Boolean(item));

  return Array.from(new Map(matches.map((item) => [item.id, item])).values());
}

function formatNumber(value: number) {
  return value.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function formatCurrency(value: number) {
  return `$ ${formatNumber(value)}`;
}

function formatOrigenProcesoLabel(
  origen: unknown,
  addonTipo?: "servicio" | "acabado" | null,
) {
  const raw = String(origen ?? "Base").trim();
  if (!raw) return "Producto base";
  const normalized = raw.toLowerCase();
  if (normalized === "base" || normalized === "producto base") return "Producto base";
  if (raw.toLowerCase().startsWith("adicional")) {
    if (addonTipo === "servicio") return "Servicio adicional";
    if (addonTipo === "acabado") return "Acabado adicional";
    return "Adicional";
  }
  return raw;
}

function getMaterialTipoLabel(tipo: unknown) {
  const raw = String(tipo ?? "").trim().toUpperCase();
  if (raw === "PAPEL") return "Papel";
  if (raw === "TONER") return "Tóner";
  if (raw === "FILM") return "Film";
  if (raw === "DESGASTE") return "Desgaste";
  if (raw === "CONSUMIBLE_FILM") return "Consumibles de terminación";
  if (raw === "ADDITIONAL_MATERIAL_EFFECT") return "Material adicional";
  return raw || "-";
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPdfCurrency(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPdfNumber(value: number | null | undefined, maximumFractionDigits = 2) {
  if (value == null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits,
  }).format(value);
}

type LaminadoTraceView = {
  key: string;
  codigo: string;
  nombre: string;
  modoLaminado: string;
  pasadasLaminado: number;
  filmFactor: number;
  pliegosTotales: number;
  hojasTotales: number;
  orientacionEntrada: string;
  pliegoOriginalAnchoMm: number;
  pliegoOriginalAltoMm: number;
  anchoRolloMm: number;
  anchoHojaMm: number;
  altoHojaMm: number;
  gapEntreHojasMm: number;
  mermaArranqueMm: number;
  mermaCierreMm: number;
  pasoLinealMm: number;
  largoConsumidoMm: number;
  velocidadMmSegEfectiva: number;
};

type ImposicionPreviewView = {
  hojaW: number;
  hojaH: number;
  piezaW: number;
  piezaH: number;
  printableW: number;
  printableH: number;
  utilW: number;
  utilH: number;
  effectiveW: number;
  effectiveH: number;
  orientacion: "normal" | "rotada";
  cols: number;
  rows: number;
  cortesGuillotina: number;
  piezasPorPliego: number;
  pliegosPorSustrato: number | null;
  orientacionSustrato: "normal" | "rotada" | null;
  sustratoAnchoMm: number | null;
  sustratoAltoMm: number | null;
  margins: {
    leftMm: number;
    rightMm: number;
    topMm: number;
    bottomMm: number;
  };
};

function buildImposicionPdfSvgMarkup(
  previewImposicion: ImposicionPreviewView,
  lineaCorteMm: number,
) {
  const canvasW = 800;
  const canvasH = 520;
  const pad = 30;
  const scale = Math.min(
    (canvasW - pad * 2) / previewImposicion.hojaW,
    (canvasH - pad * 2) / previewImposicion.hojaH,
  );
  const sheetW = previewImposicion.hojaW * scale;
  const sheetH = previewImposicion.hojaH * scale;
  const ox = (canvasW - sheetW) / 2;
  const oy = (canvasH - sheetH) / 2;
  const marginLeft = previewImposicion.margins.leftMm * scale;
  const marginRight = previewImposicion.margins.rightMm * scale;
  const marginTop = previewImposicion.margins.topMm * scale;
  const marginBottom = previewImposicion.margins.bottomMm * scale;
  const printableX = ox + marginLeft;
  const printableY = oy + marginTop;
  const printableW = Math.max(0, sheetW - marginLeft - marginRight);
  const printableH = Math.max(0, sheetH - marginTop - marginBottom);
  const lineCut = previewImposicion.piezaW > 0 ? lineaCorteMm * scale : 0;
  const utilX = printableX + lineCut;
  const utilY = printableY + lineCut;
  const utilW = Math.max(0, printableW - lineCut * 2);
  const utilH = Math.max(0, printableH - lineCut * 2);
  const effectivePieceW =
    (previewImposicion.orientacion === "rotada"
      ? previewImposicion.effectiveH
      : previewImposicion.effectiveW) * scale;
  const effectivePieceH =
    (previewImposicion.orientacion === "rotada"
      ? previewImposicion.effectiveW
      : previewImposicion.effectiveH) * scale;
  const gridW = previewImposicion.cols * effectivePieceW;
  const gridH = previewImposicion.rows * effectivePieceH;
  const centeredGridX = utilX + Math.max(0, (utilW - gridW) / 2);
  const centeredGridY = utilY + Math.max(0, (utilH - gridH) / 2);

  let cells = "";
  for (let r = 0; r < previewImposicion.rows; r += 1) {
    for (let c = 0; c < previewImposicion.cols; c += 1) {
      const x = centeredGridX + c * effectivePieceW;
      const y = centeredGridY + r * effectivePieceH;
      cells += `<rect x="${x}" y="${y}" width="${effectivePieceW}" height="${effectivePieceH}" fill="#dcfce7" stroke="#16a34a" stroke-width="0.8" />`;
    }
  }

  return `
    <svg viewBox="0 0 800 520" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">
      <rect x="${ox}" y="${oy}" width="${sheetW}" height="${sheetH}" fill="#fecaca" stroke="#7f1d1d" stroke-width="1.6" />
      <rect x="${printableX}" y="${printableY}" width="${printableW}" height="${printableH}" fill="#fff" stroke="#b91c1c" stroke-width="0.9" />
      <rect x="${utilX}" y="${utilY}" width="${utilW}" height="${utilH}" fill="#ecfccb" fill-opacity="0.4" />
      ${cells}
    </svg>
  `;
}

function buildFilmPdfSvgMarkup(trace: LaminadoTraceView) {
  const totalPliegos = Math.max(1, trace.pliegosTotales || trace.hojasTotales || 1);
  const total = trace.largoConsumidoMm;
  const startPct = total > 0 ? (trace.mermaArranqueMm / total) * 100 : 0;
  const endPct = total > 0 ? (trace.mermaCierreMm / total) * 100 : 0;
  const maxExplicitPliegos = 10;
  const headCount = totalPliegos > maxExplicitPliegos ? 5 : totalPliegos;
  const tailCount = totalPliegos > maxExplicitPliegos ? 5 : 0;
  const omittedPliegos = Math.max(0, totalPliegos - headCount - tailCount);
  const trackTop = 20;
  const trackLeft = 80;
  const trackWidth = 120;
  const bodyContentPadding = 16;
  const minSheetHeight = totalPliegos <= maxExplicitPliegos ? 12 : 28;
  const minGapHeight = trace.gapEntreHojasMm > 0 ? (totalPliegos <= maxExplicitPliegos ? 2 : 8) : 0;
  const explicitCount = headCount + tailCount;
  const explicitGapCount = Math.max(0, explicitCount - 1 + (omittedPliegos > 0 ? 2 : 0));
  const requiredBodyContentHeight =
    explicitCount * minSheetHeight +
    explicitGapCount * minGapHeight +
    (omittedPliegos > 0 ? 44 : 0);
  const baseTrackHeight = 700;
  const baseStartHeight = Math.max(10, (startPct / 100) * baseTrackHeight);
  const baseEndHeight = Math.max(10, (endPct / 100) * baseTrackHeight);
  const baseBodyHeight = Math.max(180, baseTrackHeight - baseStartHeight - baseEndHeight);
  const baseBodyContentHeight = Math.max(120, baseBodyHeight - bodyContentPadding * 2);
  const trackHeight =
    totalPliegos <= maxExplicitPliegos && baseBodyContentHeight < requiredBodyContentHeight
      ? baseTrackHeight + (requiredBodyContentHeight - baseBodyContentHeight) + 12
      : baseTrackHeight;
  const startHeight = Math.max(10, (startPct / 100) * trackHeight);
  const endHeight = Math.max(10, (endPct / 100) * trackHeight);
  const bodyTop = trackTop + startHeight;
  const bodyHeight = Math.max(180, trackHeight - startHeight - endHeight);
  const bodyContentTop = bodyTop + bodyContentPadding;
  const bodyContentHeight = Math.max(requiredBodyContentHeight, bodyHeight - bodyContentPadding * 2);
  const explicitBlocksMm =
    (headCount + tailCount) * trace.altoHojaMm +
    Math.max(0, headCount + tailCount - 1) * trace.gapEntreHojasMm;
  const omittedBlockMm =
    omittedPliegos > 0
      ? omittedPliegos * trace.altoHojaMm + Math.max(0, omittedPliegos - 1) * trace.gapEntreHojasMm
      : 0;
  const totalDisplayedBodyMm = Math.max(1, explicitBlocksMm + omittedBlockMm);
  const pxPerBodyMm = bodyContentHeight / totalDisplayedBodyMm;
  const explicitSheetHeight = Math.max(minSheetHeight, trace.altoHojaMm * pxPerBodyMm);
  const explicitGapHeight =
    trace.gapEntreHojasMm > 0 ? Math.max(minGapHeight, trace.gapEntreHojasMm * pxPerBodyMm) : 0;
  const omittedHeight =
    omittedPliegos > 0
      ? Math.max(
          44,
          bodyContentHeight -
            (headCount + tailCount) * explicitSheetHeight -
            Math.max(0, headCount + tailCount - 1) * explicitGapHeight,
        )
      : 0;
  const clipId = `film-pdf-${trace.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const blockEntries: Array<
    | { kind: "pliego"; label: string; y: number; height: number }
    | { kind: "resumen"; label: string; y: number; height: number }
    | { kind: "gap"; y: number; height: number }
  > = [];
  let cursor = bodyContentTop;
  const pushPliego = (label: string) => {
    blockEntries.push({ kind: "pliego", label, y: cursor, height: explicitSheetHeight });
    cursor += explicitSheetHeight;
  };
  const pushGap = () => {
    if (explicitGapHeight > 0) {
      blockEntries.push({ kind: "gap", y: cursor, height: explicitGapHeight });
      cursor += explicitGapHeight;
    }
  };
  for (let index = 0; index < headCount; index += 1) {
    pushPliego(`P${index + 1}`);
    if (index < headCount - 1 || omittedPliegos > 0 || tailCount > 0) pushGap();
  }
  if (omittedPliegos > 0) {
    blockEntries.push({
      kind: "resumen",
      label: `+ ${omittedPliegos} pliegos`,
      y: cursor,
      height: omittedHeight,
    });
    cursor += omittedHeight;
    if (tailCount > 0) pushGap();
  }
  for (let index = 0; index < tailCount; index += 1) {
    pushPliego(`P${totalPliegos - tailCount + index + 1}`);
    if (index < tailCount - 1) pushGap();
  }
  const viewBoxHeight = trackTop + trackHeight + 60;
  const legendY = 28;

  return `
    <svg viewBox="0 0 280 ${viewBoxHeight}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;max-width:240px;">
      <defs>
        <clipPath id="${clipId}">
          <rect x="96" y="${bodyContentTop}" width="88" height="${bodyContentHeight}" rx="0" />
        </clipPath>
      </defs>
      <rect x="${trackLeft}" y="${trackTop}" width="${trackWidth}" height="${trackHeight}" rx="26" fill="#f5efe8" stroke="#d6c4b2" />
      <rect x="${trackLeft}" y="${trackTop}" width="${trackWidth}" height="${startHeight}" fill="#f4d7c8" />
      <rect x="${trackLeft}" y="${trackTop + trackHeight - endHeight}" width="${trackWidth}" height="${endHeight}" fill="#f4d7c8" />
      <rect x="96" y="${bodyContentTop}" width="88" height="${bodyContentHeight}" fill="#fcf7f0" stroke="#dcc6b0" stroke-dasharray="4 3" />
      <line x1="${trackLeft}" y1="${bodyTop}" x2="${trackLeft + trackWidth}" y2="${bodyTop}" stroke="#c89e7b" stroke-width="2" />
      <line x1="${trackLeft}" y1="${bodyTop + bodyHeight}" x2="${trackLeft + trackWidth}" y2="${bodyTop + bodyHeight}" stroke="#c89e7b" stroke-width="2" />
      <g clip-path="url(#${clipId})">
        ${blockEntries
          .map((block) => {
            if (block.kind === "pliego") {
              return `
                <rect x="96" y="${block.y}" width="88" height="${block.height}" fill="#fef8ee" stroke="#c9aa8a" />
                <text x="140" y="${block.y + block.height / 2 + 5}" text-anchor="middle" font-size="14" fill="#6d4a2d">${block.label}</text>
              `;
            }
            if (block.kind === "resumen") {
              return `
                <rect x="101" y="${block.y}" width="78" height="${block.height}" fill="#f1e0cf" stroke="#d0b49a" stroke-dasharray="6 4" />
                <text x="140" y="${block.y + block.height / 2 - 4}" text-anchor="middle" font-size="14" fill="#7b4b2a">...</text>
                <text x="140" y="${block.y + block.height / 2 + 14}" text-anchor="middle" font-size="11" fill="#7b4b2a">${block.label}</text>
              `;
            }
            return `
              <rect x="110" y="${block.y}" width="60" height="${block.height}" fill="#f97316" opacity="0.12" />
              <line x1="108" y1="${block.y + block.height / 2}" x2="172" y2="${block.y + block.height / 2}" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="3 2" />
            `;
          })
          .join("")}
      </g>
      <g transform="translate(24, ${legendY})">
        <rect x="0" y="0" width="22" height="12" fill="#f4d7c8" />
        <text x="30" y="10" font-size="10" fill="#6b7280">Merma</text>
        <line x1="0" y1="24" x2="22" y2="24" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="3 2" />
        <text x="30" y="28" font-size="10" fill="#6b7280">Gap</text>
        <rect x="0" y="40" width="22" height="12" fill="#fcf7f0" stroke="#dcc6b0" />
        <text x="30" y="50" font-size="10" fill="#6b7280">Tramo útil</text>
      </g>
    </svg>
  `;
}

async function svgMarkupToPngDataUrl(svgMarkup: string, width: number, height: number) {
  return await new Promise<string>((resolve, reject) => {
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          URL.revokeObjectURL(url);
          reject(new Error("No se pudo preparar el canvas del PDF."));
          return;
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        URL.revokeObjectURL(url);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo rasterizar el SVG para el PDF."));
    };

    image.src = url;
  });
}

async function imageUrlToDataUrl(url: string) {
  return await new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("No se pudo preparar el logo para el PDF."));
          return;
        }
        context.drawImage(image, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error("No se pudo cargar el logo del PDF."));
    image.src = url;
  });
}

function asPositiveNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getLaminadoTraceView(
  proceso: CotizacionProductoVariante["bloques"]["procesos"][number],
): LaminadoTraceView | null {
  const detalle = (proceso.detalleTecnico ?? null) as Record<string, unknown> | null;
  if (!detalle || String(detalle.tipo ?? "") !== "laminadora_bopp_rollo") {
    return null;
  }

  const largoConsumidoMm = asPositiveNumber(detalle.largoConsumidoMm);
  const anchoRolloMm = asPositiveNumber(detalle.anchoRolloMm ?? detalle.anchoConsumidoMm);
  const anchoHojaMm = asPositiveNumber(detalle.anchoHojaMm);
  const altoHojaMm = asPositiveNumber(detalle.altoHojaMm);
  const pasoLinealMm = asPositiveNumber(detalle.pasoLinealMm);

  if (!largoConsumidoMm || !anchoRolloMm || !anchoHojaMm || !altoHojaMm || !pasoLinealMm) {
    return null;
  }

  return {
    key: `${proceso.codigo}-${proceso.nombre}`,
    codigo: proceso.codigo,
    nombre: proceso.nombre,
    modoLaminado: String(detalle.modoLaminado ?? "una_cara"),
    pasadasLaminado: Number(detalle.pasadasLaminado ?? 1) || 1,
    filmFactor: Number(detalle.filmFactor ?? 1) || 1,
    pliegosTotales: Number(detalle.pliegosTotales ?? 0) || 0,
    hojasTotales: Number(detalle.hojasTotales ?? 0) || 0,
    orientacionEntrada: String(detalle.orientacionEntrada ?? "normal"),
    pliegoOriginalAnchoMm: Number(detalle.pliegoOriginalAnchoMm ?? anchoHojaMm) || anchoHojaMm,
    pliegoOriginalAltoMm: Number(detalle.pliegoOriginalAltoMm ?? altoHojaMm) || altoHojaMm,
    anchoRolloMm,
    anchoHojaMm,
    altoHojaMm,
    gapEntreHojasMm: Number(detalle.gapEntreHojasMm ?? 0) || 0,
    mermaArranqueMm: Number(detalle.mermaArranqueMm ?? 0) || 0,
    mermaCierreMm: Number(detalle.mermaCierreMm ?? 0) || 0,
    pasoLinealMm,
    largoConsumidoMm,
    velocidadMmSegEfectiva: Number(detalle.velocidadMmSegEfectiva ?? 0) || 0,
  };
}

function formatDetalleTecnico(detalle: Record<string, unknown> | null | undefined) {
  if (!detalle) return "";
  const lines: string[] = [];
  const push = (label: string, value: unknown, suffix = "") => {
    if (value === null || value === undefined || value === "") return;
    lines.push(`${label}: ${String(value)}${suffix}`);
  };

  if ("maquina" in detalle) push("Máquina", detalle.maquina);
  if ("perfilOperativo" in detalle) push("Perfil operativo", detalle.perfilOperativo);
  if ("sourceProductividad" in detalle) {
    const sourceLabels: Record<string, string> = {
      nivel_fijo: "Nivel fijo",
      nivel_variable_manual: "Nivel variable manual",
      nivel_variable_perfil: "Perfil operativo",
      checklist: "Checklist",
      plantilla: "Plantilla",
      perfil: "Perfil",
    };
    const raw = String(detalle.sourceProductividad ?? "").trim();
    push("Fuente", sourceLabels[raw] ?? raw);
  }
  if ("cantidadObjetivoSalida" in detalle) push("Cantidad objetivo", detalle.cantidadObjetivoSalida);
  if ("productividadAplicada" in detalle) push("Productividad aplicada", detalle.productividadAplicada);

  const hasGuillotinaTrace =
    "alturaTandaEfectivaMm" in detalle ||
    "capacidadTanda" in detalle ||
    "tandas" in detalle ||
    "cortesPorImposicion" in detalle ||
    "cortesTotales" in detalle ||
    "cortesMinPerfil" in detalle;

  if (hasGuillotinaTrace) {
    push("Pliegos totales", detalle.pliegosTotales);
    push("Altura efectiva de tanda", detalle.alturaTandaEfectivaMm, " mm");
    push("Capacidad por tanda", detalle.capacidadTanda, " hojas");
    push("Tandas", detalle.tandas);
    push("Cortes por imposición", detalle.cortesPorImposicion);
    push("Cortes totales", detalle.cortesTotales);
    push("Cortes por minuto", detalle.cortesMinPerfil ?? detalle.productivityValue);
  }

  const preferredKeys = new Set([
    "maquina",
    "perfilOperativo",
    "sourceProductividad",
    "pliegosTotales",
    "cantidadObjetivoSalida",
    "productividadAplicada",
    "alturaTandaEfectivaMm",
    "capacidadTanda",
    "tandas",
    "cortesPorImposicion",
    "cortesTotales",
    "cortesMinPerfil",
    "tipo",
    "productivityValue",
  ]);

  for (const [key, value] of Object.entries(detalle)) {
    if (preferredKeys.has(key)) continue;
    if (value === null || value === undefined || value === "") continue;
    lines.push(`${key}: ${String(value)}`);
  }

  return lines.join("\n");
}

function buildDraftFromTemplate(template: ProcesoOperacionPlantilla): RouteOperationDraft {
  return {
    id: crypto.randomUUID(),
    nombre: template.nombre,
    tipoOperacion: template.tipoOperacion,
    centroCostoId: template.centroCostoId || undefined,
    maquinaId: template.maquinaId || undefined,
    perfilOperativoId: template.perfilOperativoId || undefined,
    setupMin: template.setupMin ?? undefined,
    runMin: undefined,
    cleanupMin: template.cleanupMin ?? undefined,
    tiempoFijoMin: template.tiempoFijoMin ?? undefined,
    modoProductividad: template.modoProductividad,
    productividadBase: template.productividadBase ?? undefined,
    unidadEntrada: template.unidadEntrada,
    unidadSalida: template.unidadSalida,
    unidadTiempo: template.unidadTiempo,
    mermaSetup: undefined,
    mermaRunPct: template.mermaRunPct ?? undefined,
    reglaVelocidad: template.reglaVelocidad ?? undefined,
    reglaMerma: template.reglaMerma ?? undefined,
    detalle: {
      pasoPlantillaId: template.id,
    },
    activo: true,
  };
}

function buildDraftFromProceso(proceso: Proceso): RouteOperationDraft[] {
  return proceso.operaciones
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((op) => ({
      id: op.id,
      nombre: op.nombre,
      tipoOperacion: op.tipoOperacion,
      centroCostoId: op.centroCostoId || undefined,
      maquinaId: op.maquinaId || undefined,
      perfilOperativoId: op.perfilOperativoId || undefined,
      setupMin: op.setupMin ?? undefined,
      runMin: op.runMin ?? undefined,
      cleanupMin: op.cleanupMin ?? undefined,
      tiempoFijoMin: op.tiempoFijoMin ?? undefined,
      modoProductividad: op.modoProductividad,
      productividadBase: op.productividadBase ?? undefined,
      unidadEntrada: op.unidadEntrada,
      unidadSalida: op.unidadSalida,
      unidadTiempo: op.unidadTiempo,
      mermaSetup: op.mermaSetup ?? undefined,
      mermaRunPct: op.mermaRunPct ?? undefined,
      reglaVelocidad: op.reglaVelocidad ?? undefined,
      reglaMerma: op.reglaMerma ?? undefined,
      detalle: op.detalle ?? undefined,
      activo: op.activo,
    }));
}

function normalizeToMm(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null;
  return value <= 100 ? value * 10 : value;
}

function buildPapelResumen(attrs: Record<string, unknown>) {
  const parts: string[] = [];
  const ancho = normalizeToMm(Number(attrs.ancho ?? 0));
  const alto = normalizeToMm(Number(attrs.alto ?? 0));
  if (ancho && alto) {
    parts.push(`${ancho}x${alto} mm`);
  }
  const gramaje = Number(attrs.gramaje ?? attrs.gramos ?? 0);
  if (Number.isFinite(gramaje) && gramaje > 0) {
    parts.push(`${gramaje} g`);
  }
  const acabado = String(attrs.acabado ?? "").trim();
  if (acabado) {
    parts.push(acabado);
  }
  return parts.join(" · ");
}

function getUnidadProcesoLabel(value: string) {
  return unidadProcesoItems.find((item) => item.value === value)?.label ?? value;
}

function getModoProductividadLabel(value: string) {
  if (value === "fija") return "Fija";
  if (value === "variable") return "Variable";
  return value;
}

function getUnidadProductividadCompuestaLabel(unidadSalida: string, unidadTiempo: string) {
  const key = `${unidadSalida}/${unidadTiempo}`;
  const labels: Record<string, string> = {
    "copia/minuto": "Páginas por minuto (pag/min)",
    "hoja/minuto": "Hojas por minuto (hoja/min)",
    "m2/hora": "Metros cuadrados por hora (m2/h)",
    "metro_lineal/hora": "Metros lineales por hora (ml/h)",
    "pieza/hora": "Piezas por hora (pieza/h)",
    "unidad/hora": "Unidades por hora (unidad/h)",
  };
  return labels[key] ?? `${getUnidadProcesoLabel(unidadSalida)} por ${getUnidadProcesoLabel(unidadTiempo)}`;
}

export function ProductoServicioFichaTabs({
  producto,
  initialVariantes,
  initialClientes,
  initialImpuestosCatalogo,
  procesos,
  plantillasPaso,
  materiasPrimas,
  familias,
  subfamilias,
  motores,
  checklist,
  maquinas,
}: ProductoServicioFichaTabsProps) {
  const measurementUnitFallback = producto.unidadComercial?.trim() || "unidad";
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
  const [generalForm, setGeneralForm] = React.useState<{
    nombre: string;
    descripcion: string;
    familiaProductoId: string;
    subfamiliaProductoId: string;
    motorCodigo: string;
    motorVersion: number;
  }>({
    nombre: producto.nombre,
    descripcion: producto.descripcion ?? "",
    familiaProductoId: producto.familiaProductoId,
    subfamiliaProductoId: producto.subfamiliaProductoId ?? "",
    motorCodigo: producto.motorCodigo,
    motorVersion: producto.motorVersion,
  });
  const [precioForm, setPrecioForm] = React.useState<ProductoPrecioConfig>(() =>
    buildPrecioConfigDraft(producto.precio, measurementUnitFallback),
  );
  const [isSavingGeneral, startSavingGeneral] = React.useTransition();
  const [isSavingPrecio, startSavingPrecio] = React.useTransition();
  const [precioEditorOpen, setPrecioEditorOpen] = React.useState(false);
  const [precioEditorDraft, setPrecioEditorDraft] = React.useState<ProductoPrecioConfig>(() =>
    buildPrecioConfigDraft(producto.precio, measurementUnitFallback),
  );
  const [precioEspecialClientesForm, setPrecioEspecialClientesForm] = React.useState<ProductoPrecioEspecialCliente[]>(
    () => producto.precioEspecialClientes ?? [],
  );
  const [precioComisionEditorOpen, setPrecioComisionEditorOpen] = React.useState(false);
  const [precioComisionEditorDraft, setPrecioComisionEditorDraft] = React.useState<PrecioComisionDraft>(() =>
    buildPrecioComisionDraft(),
  );
  const [precioComisionToDelete, setPrecioComisionToDelete] = React.useState<ProductoPrecioComisionItem | null>(null);
  const [isSavingPrecioEspecialClientes, startSavingPrecioEspecialClientes] = React.useTransition();
  const [precioEspecialClienteToDelete, setPrecioEspecialClienteToDelete] =
    React.useState<PrecioEspecialClienteConfirmDelete | null>(null);
  const [precioEspecialClienteEditorOpen, setPrecioEspecialClienteEditorOpen] = React.useState(false);
  const [precioEspecialClienteEditorDraft, setPrecioEspecialClienteEditorDraft] = React.useState<PrecioEspecialClienteDraft>(
    () => buildPrecioEspecialClienteDraft(null, measurementUnitFallback),
  );
  const [impuestosEditorOpen, setImpuestosEditorOpen] = React.useState(false);
  const [isSavingImpuestosCatalogo, startSavingImpuestosCatalogo] = React.useTransition();
  const [impuestosEditorDraft, setImpuestosEditorDraft] = React.useState<ProductoImpuestoCatalogo | null>(null);

  const papeles = React.useMemo<PapelOption[]>(() => {
    const items: PapelOption[] = [];
    for (const mp of materiasPrimas) {
      if (mp.subfamilia !== "sustrato_hoja") {
        continue;
      }
      for (const variante of mp.variantes) {
        const varianteNombre = variante.nombreVariante?.trim();
        const attrs = variante.atributosVariante ?? {};
        const anchoMm = normalizeToMm(Number(attrs.ancho ?? 0));
        const altoMm = normalizeToMm(Number(attrs.alto ?? 0));
        const resumen = buildPapelResumen(attrs);
        items.push({
          id: variante.id,
          sku: variante.sku,
          label: `${mp.nombre}${varianteNombre ? ` · ${varianteNombre}` : ""}${resumen ? ` · ${resumen}` : ""} · ${variante.sku}`,
          precioReferencia: variante.precioReferencia,
          anchoMm,
          altoMm,
          resumen,
        });
      }
    }
    return items.sort((a, b) => a.label.localeCompare(b.label));
  }, [materiasPrimas]);

  const [variantes, setVariantes] = React.useState(initialVariantes);
  const [productoChecklist, setProductoChecklist] = React.useState(checklist);
  const [selectedVarianteId, setSelectedVarianteId] = React.useState(initialVariantes[0]?.id ?? "");
  const selectedVariante = React.useMemo(
    () => variantes.find((item) => item.id === selectedVarianteId) ?? null,
    [selectedVarianteId, variantes],
  );

  const [draft, setDraft] = React.useState<VarianteDraft>(() => createVarianteDraft(papeles));
  const [isSavingVariante, startSavingVariante] = React.useTransition();
  const [isUpdatingVariante, startUpdatingVariante] = React.useTransition();
  const [isSavingConfig, startSavingConfig] = React.useTransition();
  const [isCotizando, startCotizando] = React.useTransition();
  const [isTogglingVariante, startTogglingVariante] = React.useTransition();
  const [isDeletingVariante, startDeletingVariante] = React.useTransition();
  const [showInactiveVariantes, setShowInactiveVariantes] = React.useState(false);
  const [editingVarianteId, setEditingVarianteId] = React.useState("");
  const [editDraft, setEditDraft] = React.useState<VarianteEditDraft>(() => createVarianteDraft(papeles));
  const [confirmAction, setConfirmAction] = React.useState<VarianteConfirmAction | null>(null);
  const [pliegosImpresion, setPliegosImpresion] = React.useState<PliegoImpresionCatalogItem[]>(fallbackPliegosImpresion);

  const [rutaSeleccionadaId, setRutaSeleccionadaId] = React.useState(selectedVariante?.procesoDefinicionId ?? "");
  const [usarRutaComunVariantes, setUsarRutaComunVariantes] = React.useState(producto.usarRutaComunVariantes);
  const [rutaDefaultProductoId, setRutaDefaultProductoId] = React.useState(producto.procesoDefinicionDefaultId ?? "");
  const [rutasPorVarianteDraft, setRutasPorVarianteDraft] = React.useState<Record<string, string>>({});
  const [isSavingRutaPolicy, startSavingRutaPolicy] = React.useTransition();
  const [isSavingRutaBaseRules, startSavingRutaBaseRules] = React.useTransition();
  const [isSavingRutaVariante, startSavingRutaVariante] = React.useTransition();
  const [savingVarianteId, setSavingVarianteId] = React.useState<string | null>(null);
  const [dimensionesBaseConsumidasDraft, setDimensionesBaseConsumidasDraft] = React.useState<DimensionOpcionProductiva[]>(
    () => buildDimensionesBaseConsumidasDraft(producto),
  );
  const [rutaBaseMatchingDraft, setRutaBaseMatchingDraft] = React.useState<Record<string, RutaBaseMatchingDraft[]>>(
    () => buildRutaBaseMatchingDraft(producto, initialVariantes),
  );
  const [rutaBasePasosFijosDraft, setRutaBasePasosFijosDraft] = React.useState<Record<string, RutaBasePasoFijoDraft[]>>(
    () => buildRutaBasePasosFijosDraft(producto, initialVariantes),
  );
  const [routeEditorOpen, setRouteEditorOpen] = React.useState(false);
  const [routeEditorCodigo, setRouteEditorCodigo] = React.useState("");
  const [routeEditorNombre, setRouteEditorNombre] = React.useState("");
  const [routeEditorOperaciones, setRouteEditorOperaciones] = React.useState<RouteOperationDraft[]>([]);
  const [routeEditorTemplateId, setRouteEditorTemplateId] = React.useState("");
  const [routeEditorPlantillas, setRouteEditorPlantillas] = React.useState<ProcesoOperacionPlantilla[]>([]);
  const [routeEditorGuardarEnRutas, setRouteEditorGuardarEnRutas] = React.useState(true);
  const [routeEditorTargetVarianteId, setRouteEditorTargetVarianteId] = React.useState<string | null>(null);
  const [isSavingRouteEditor, startSavingRouteEditor] = React.useTransition();
  const [draggingOpIndex, setDraggingOpIndex] = React.useState<number | null>(null);
  const [config, setConfig] = React.useState<Record<string, unknown>>({
    tipoCorte: "sin_demasia",
    demasiaCorteMm: 0,
    lineaCorteMm: 3,
    tamanoPliegoImpresion: {
      codigo: "A4",
      nombre: "A4",
      anchoMm: 210,
      altoMm: 297,
    },
    mermaAdicionalPct: 0,
  });
  const [cotizacionCantidad, setCotizacionCantidad] = React.useState("100");
  const [cotizacionPeriodo, setCotizacionPeriodo] = React.useState(buildDefaultPeriodo());
  const [cotizacionChecklistRespuestas, setCotizacionChecklistRespuestas] = React.useState<
    Record<string, { respuestaId: string }>
  >({});
  const [cotizacionSeleccionesBase, setCotizacionSeleccionesBase] = React.useState<
    Partial<Record<DimensionOpcionProductiva, ValorOpcionProductiva>>
  >({});
  const [cotizacion, setCotizacion] = React.useState<CotizacionProductoVariante | null>(null);
  const [cotizaciones, setCotizaciones] = React.useState<CotizacionProductoSnapshotResumen[]>([]);
  const [snapshotsOpen, setSnapshotsOpen] = React.useState(false);
  const [imposicionPreviewRaw, setImposicionPreviewRaw] = React.useState<Record<string, unknown> | null>(null);
  const [svgZoom, setSvgZoom] = React.useState({ active: false, x: 50, y: 50 });

  React.useEffect(() => {
    setProductoChecklist(checklist);
    setCotizacionChecklistRespuestas({});
  }, [checklist]);

  React.useEffect(() => {
    const sameProduct = producto.id === productoState.id;
    const incomingUpdatedAt = Date.parse(producto.updatedAt ?? "");
    const currentUpdatedAt = Date.parse(productoState.updatedAt ?? "");
    if (
      sameProduct &&
      Number.isFinite(incomingUpdatedAt) &&
      Number.isFinite(currentUpdatedAt) &&
      incomingUpdatedAt <= currentUpdatedAt
    ) {
      return;
    }

    setProductoState(producto);
    setDimensionesBaseConsumidasDraft(buildDimensionesBaseConsumidasDraft(producto));
    setRutaBaseMatchingDraft(buildRutaBaseMatchingDraft(producto, initialVariantes));
    setRutaBasePasosFijosDraft(buildRutaBasePasosFijosDraft(producto, initialVariantes));
    setUsarRutaComunVariantes(producto.usarRutaComunVariantes);
    setRutaDefaultProductoId(producto.procesoDefinicionDefaultId ?? "");
    setGeneralForm({
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? "",
      familiaProductoId: producto.familiaProductoId,
      subfamiliaProductoId: producto.subfamiliaProductoId ?? "",
      motorCodigo: producto.motorCodigo,
      motorVersion: producto.motorVersion,
    });
    const nextPrecio = buildPrecioConfigDraft(producto.precio, producto.unidadComercial?.trim() || "unidad");
    setPrecioForm(nextPrecio);
    setPrecioEditorDraft(nextPrecio);
    setPrecioEspecialClientesForm(producto.precioEspecialClientes ?? []);
  }, [producto, initialVariantes, productoState.id, productoState.updatedAt]);

  React.useEffect(() => {
    if (!selectedVariante) {
      setCotizacionSeleccionesBase({});
      return;
    }
    const next: Partial<Record<DimensionOpcionProductiva, ValorOpcionProductiva>> = {};
    dimensionesBaseConsumidasDraft.forEach((dimension) => {
      const values = getValoresOpcionesBase(selectedVariante, dimension);
      if (values.length === 1) {
        next[dimension] = values[0];
      }
    });
    setCotizacionSeleccionesBase(next);
  }, [selectedVariante, dimensionesBaseConsumidasDraft]);

  React.useEffect(() => {
    setRutasPorVarianteDraft((prev) => {
      const next: Record<string, string> = {};
      for (const variante of variantes) {
        next[variante.id] = prev[variante.id] ?? variante.procesoDefinicionId ?? "";
      }
      return next;
    });
  }, [variantes]);

  React.useEffect(() => {
    setRutaBaseMatchingDraft((prev) => {
      const next = { ...prev };
      for (const variante of variantes) {
        next[variante.id] = next[variante.id] ?? [];
      }
      for (const key of Object.keys(next)) {
        if (!variantes.some((variante) => variante.id === key)) {
          delete next[key];
        }
      }
      return next;
    });
  }, [variantes]);

  const varianteLabel = selectedVariante?.nombre ?? "";
  const papelLabelById = React.useMemo(() => new Map(papeles.map((item) => [item.id, item.label])), [papeles]);
  const papelById = React.useMemo(() => new Map(papeles.map((item) => [item.id, item])), [papeles]);
  const rutaLabelById = React.useMemo(
    () => new Map(procesos.map((item) => [item.id, `${item.codigo} · ${item.nombre}`])),
    [procesos],
  );
  const rutaNombreById = React.useMemo(
    () => new Map(procesos.map((item) => [item.id, item.nombre])),
    [procesos],
  );
  const maquinaById = React.useMemo(
    () => new Map(maquinas.map((item) => [item.id, item])),
    [maquinas],
  );
  const pasosRutaOpcionales = React.useMemo(() => {
    const processIds = new Set<string>();
    if (usarRutaComunVariantes) {
      if (rutaDefaultProductoId) processIds.add(rutaDefaultProductoId);
    } else {
      for (const variante of variantes) {
        const processId = rutasPorVarianteDraft[variante.id] ?? variante.procesoDefinicionId ?? "";
        if (processId) processIds.add(processId);
      }
    }
    const options = Array.from(processIds).flatMap((procesoId) =>
      getRutaPasoOptions(procesoId, procesos, plantillasPaso).map((paso) => ({
        id: paso.id,
        nombre: paso.nombre,
        procesoId,
      })),
    );
    return Array.from(new Map(options.map((item) => [item.id, item])).values());
  }, [usarRutaComunVariantes, rutaDefaultProductoId, rutasPorVarianteDraft, variantes, procesos, plantillasPaso]);
  React.useEffect(() => {
    getCatalogoPliegosImpresion()
      .then((items) => {
        if (items.length > 0) {
          setPliegosImpresion(items);
        }
      })
      .catch(() => {
        setPliegosImpresion(fallbackPliegosImpresion);
      });
  }, []);

  React.useEffect(() => {
    if (!selectedVariante) {
      setCotizacion(null);
      setCotizaciones([]);
      return;
    }

    setCotizacion(null);

    Promise.all([
      getProductoMotorConfig(productoState.id),
      getVarianteMotorOverride(selectedVariante.id),
    ])
      .then(([baseConfig, overrideConfig]) => {
        const incoming = {
          ...(baseConfig.parametros ?? {}),
          ...(overrideConfig.parametros ?? {}),
        } as Record<string, unknown>;
        const legacyTipoImposicion = String(incoming.tipoImposicion ?? "");
        const legacyPerimetral = Number(incoming.margenPerimetralCorteMm ?? 0);
        const legacyGap = Math.max(
          Number(incoming.gapHorizontalMm ?? 0),
          Number(incoming.gapVerticalMm ?? 0),
          legacyPerimetral,
        );
        const tipoCorte =
          String(incoming.tipoCorte ?? "") ||
          (legacyTipoImposicion === "doble_calle" ? "con_demasia" : "sin_demasia");
        const demasiaCorteMm =
          tipoCorte === "con_demasia"
            ? Number(incoming.demasiaCorteMm ?? legacyGap ?? 0)
            : 0;
        const lineaCorteMm = Number(incoming.lineaCorteMm ?? 3);
        const tamanoRaw = incoming.tamanoPliegoImpresion;
        const tamanoPliegoImpresion =
          tamanoRaw && typeof tamanoRaw === "object" && !Array.isArray(tamanoRaw)
            ? tamanoRaw
            : {
                codigo: "A4",
                nombre: "A4",
                anchoMm: 210,
                altoMm: 297,
              };
        setConfig({
          ...incoming,
          tipoCorte,
          demasiaCorteMm: Number.isFinite(demasiaCorteMm) ? Math.max(0, demasiaCorteMm) : 0,
          lineaCorteMm: Number.isFinite(lineaCorteMm) ? Math.max(0, lineaCorteMm) : 3,
          tamanoPliegoImpresion,
        });
      })
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : "No se pudo cargar configuración de imposición."),
      );

    getCotizacionesProductoVariante(selectedVariante.id)
      .then(async (snapshots) => {
        setCotizaciones(snapshots);
        const latestSnapshot = snapshots[0];
        if (!latestSnapshot) {
          setCotizacion(null);
          return;
        }
        const detalle = await getCotizacionProductoById(latestSnapshot.id);
        setCotizacion({
          snapshotId: detalle.id,
          ...(detalle.resultado as Omit<CotizacionProductoVariante, "snapshotId" | "createdAt">),
          createdAt: detalle.createdAt,
        });
      })
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : "No se pudieron cargar cotizaciones."),
      );
  }, [selectedVariante]);

  React.useEffect(() => {
    setRutaSeleccionadaId(
      usarRutaComunVariantes
        ? rutaDefaultProductoId
        : (selectedVariante?.procesoDefinicionId ?? ""),
    );
  }, [usarRutaComunVariantes, rutaDefaultProductoId, selectedVariante?.procesoDefinicionId]);

  const procesoSeleccionado = React.useMemo(
    () =>
      procesos.find(
        (item) =>
          item.id ===
          (usarRutaComunVariantes
            ? rutaDefaultProductoId
            : (rutasPorVarianteDraft[selectedVarianteId] ?? selectedVariante?.procesoDefinicionId ?? rutaSeleccionadaId)),
      ) ?? null,
    [
      procesos,
      usarRutaComunVariantes,
      rutaDefaultProductoId,
      rutasPorVarianteDraft,
      selectedVarianteId,
      selectedVariante?.procesoDefinicionId,
      rutaSeleccionadaId,
    ],
  );
  const variantesVisibles = React.useMemo(
    () => (showInactiveVariantes ? variantes : variantes.filter((item) => item.activo)),
    [showInactiveVariantes, variantes],
  );
  const variantesSelect = React.useMemo(
    () =>
      showInactiveVariantes
        ? variantes
        : variantes.filter((item) => item.activo || item.id === selectedVarianteId),
    [showInactiveVariantes, variantes, selectedVarianteId],
  );
  const editingVariante = React.useMemo(
    () => variantes.find((item) => item.id === editingVarianteId) ?? null,
    [editingVarianteId, variantes],
  );
  const subfamiliasFiltradasGeneral = React.useMemo(
    () => subfamilias.filter((item) => item.familiaProductoId === generalForm.familiaProductoId),
    [subfamilias, generalForm.familiaProductoId],
  );
  const familiaGeneralLabel = React.useMemo(() => {
    const item = familias.find((entry) => entry.id === generalForm.familiaProductoId);
    return item ? item.nombre : "";
  }, [familias, generalForm.familiaProductoId]);
  const subfamiliaGeneralLabel = React.useMemo(() => {
    if (!generalForm.subfamiliaProductoId) return "Sin subfamilia";
    const item = subfamiliasFiltradasGeneral.find((entry) => entry.id === generalForm.subfamiliaProductoId);
    return item ? item.nombre : "Sin subfamilia";
  }, [generalForm.subfamiliaProductoId, subfamiliasFiltradasGeneral]);
  const motorCostoValue = `${generalForm.motorCodigo}@${generalForm.motorVersion}`;
  const motorCostoLabel = React.useMemo(() => {
    return (
      motores.find((item) => `${item.code}@${item.version}` === motorCostoValue)?.label ??
      "Motor de costo"
    );
  }, [motores, motorCostoValue]);
  const rutaDefaultGuardadaId = productoState.procesoDefinicionDefaultId ?? "";

  const tipoProductoLabel = "Producto";
  const estadoProductoLabel =
    estadoProductoServicioItems.find((item) => item.value === productoState.estado)?.label ?? productoState.estado;

  const tipoCorteValue = String(config.tipoCorte ?? "sin_demasia");
  const tipoCorteSelected =
    tipoCorteItems.find((item) => item.value === tipoCorteValue) ?? tipoCorteItems[0];
  const demasiaCorteMm =
    tipoCorteValue === "con_demasia"
      ? Math.max(0, Number(config.demasiaCorteMm ?? 0))
      : 0;
  const lineaCorteMm = Math.max(0, Number(config.lineaCorteMm ?? 3));
  const tamanoPliegoRaw =
    config.tamanoPliegoImpresion &&
    typeof config.tamanoPliegoImpresion === "object" &&
    !Array.isArray(config.tamanoPliegoImpresion)
      ? (config.tamanoPliegoImpresion as Record<string, unknown>)
      : null;
  const tamanoPliegoCodigo = String(tamanoPliegoRaw?.codigo ?? "A4");
  const tamanoPliegoSeleccionado =
    pliegosImpresion.find((item) => item.codigo === tamanoPliegoCodigo) ??
    ({
      codigo: tamanoPliegoCodigo,
      nombre: String(tamanoPliegoRaw?.nombre ?? "Personalizado"),
      anchoMm: Number(tamanoPliegoRaw?.anchoMm ?? 210),
      altoMm: Number(tamanoPliegoRaw?.altoMm ?? 297),
      label: `${String(tamanoPliegoRaw?.nombre ?? "Personalizado")} (${Number(tamanoPliegoRaw?.anchoMm ?? 210)} x ${Number(tamanoPliegoRaw?.altoMm ?? 297)} mm)`,
    } as PliegoImpresionCatalogItem);

  const previewImposicion = React.useMemo(() => {
    if (!selectedVariante) return null;
    const server = imposicionPreviewRaw ?? {};
    const serverImposicion =
      server.imposicion && typeof server.imposicion === "object" && !Array.isArray(server.imposicion)
        ? (server.imposicion as Record<string, unknown>)
        : null;
    const serverMargins =
      server.machineMargins && typeof server.machineMargins === "object" && !Array.isArray(server.machineMargins)
        ? (server.machineMargins as Record<string, unknown>)
        : null;
    const serverPliego =
      server.pliegoImpresion && typeof server.pliegoImpresion === "object" && !Array.isArray(server.pliegoImpresion)
        ? (server.pliegoImpresion as Record<string, unknown>)
        : null;
    const piezaW = Math.max(1, Number(selectedVariante.anchoMm));
    const piezaH = Math.max(1, Number(selectedVariante.altoMm));
    const hojaW = Math.max(1, Number(serverPliego?.anchoMm ?? tamanoPliegoSeleccionado.anchoMm));
    const hojaH = Math.max(1, Number(serverPliego?.altoMm ?? tamanoPliegoSeleccionado.altoMm));
    const effectiveW = piezaW + demasiaCorteMm * 2;
    const effectiveH = piezaH + demasiaCorteMm * 2;
    const margins = {
      leftMm: Math.max(0, Number(serverMargins?.leftMm ?? 0)),
      rightMm: Math.max(0, Number(serverMargins?.rightMm ?? 0)),
      topMm: Math.max(0, Number(serverMargins?.topMm ?? 0)),
      bottomMm: Math.max(0, Number(serverMargins?.bottomMm ?? 0)),
    };
    const printableW = Math.max(0, hojaW - margins.leftMm - margins.rightMm);
    const printableH = Math.max(0, hojaH - margins.topMm - margins.bottomMm);
    const utilW = Math.max(0, printableW - lineaCorteMm * 2);
    const utilH = Math.max(0, printableH - lineaCorteMm * 2);
    const normalCols = Math.max(0, Math.floor(utilW / effectiveW));
    const normalRows = Math.max(0, Math.floor(utilH / effectiveH));
    const normal = normalCols * normalRows;
    const rotCols = Math.max(0, Math.floor(utilW / effectiveH));
    const rotRows = Math.max(0, Math.floor(utilH / effectiveW));
    const rotada = rotCols * rotRows;
    const orientacion: "normal" | "rotada" =
      String(serverImposicion?.orientacion ?? "") === "rotada" || (rotada > normal && !serverImposicion)
        ? "rotada"
        : "normal";
    const cols = Math.max(0, Number(serverImposicion?.cols ?? (orientacion === "rotada" ? rotCols : normalCols)));
    const rows = Math.max(0, Number(serverImposicion?.rows ?? (orientacion === "rotada" ? rotRows : normalRows)));
    const papelSeleccionado = selectedVariante.papelVarianteId ? papelById.get(selectedVariante.papelVarianteId) : null;
    const sustratoAnchoMm = papelSeleccionado?.anchoMm ?? null;
    const sustratoAltoMm = papelSeleccionado?.altoMm ?? null;
    let pliegosPorSustrato: number | null = null;
    let orientacionSustrato: "normal" | "rotada" | null = null;
    if (sustratoAnchoMm && sustratoAltoMm) {
      const direct =
        Math.abs(sustratoAnchoMm - hojaW) < 0.01 &&
        Math.abs(sustratoAltoMm - hojaH) < 0.01;
      const directRot =
        Math.abs(sustratoAnchoMm - hojaH) < 0.01 &&
        Math.abs(sustratoAltoMm - hojaW) < 0.01;
      if (direct || directRot) {
        pliegosPorSustrato = 1;
        orientacionSustrato = direct ? "normal" : "rotada";
      } else {
        const sNormal = Math.floor(sustratoAnchoMm / hojaW) * Math.floor(sustratoAltoMm / hojaH);
        const sRot = Math.floor(sustratoAnchoMm / hojaH) * Math.floor(sustratoAltoMm / hojaW);
        pliegosPorSustrato = Math.max(1, sNormal, sRot);
        orientacionSustrato = sRot > sNormal ? "rotada" : "normal";
      }
    }
    return {
      hojaW,
      hojaH,
      piezaW,
      piezaH,
      printableW,
      printableH,
      utilW,
      utilH,
      effectiveW,
      effectiveH,
      normal,
      rotada,
      orientacion,
      cols,
      rows,
      cortesGuillotina: getGuillotinaCutsFromImposicion(
        cols,
        rows,
        tipoCorteValue === "con_demasia" ? "con_demasia" : "sin_demasia",
      ),
      piezasPorPliego: Math.max(normal, rotada),
      pliegosPorSustrato,
      orientacionSustrato,
      sustratoAnchoMm,
      sustratoAltoMm,
      margins,
    };
  }, [selectedVariante, tamanoPliegoSeleccionado, demasiaCorteMm, lineaCorteMm, papelById, imposicionPreviewRaw]);

  const imposicionPayloadConfig = React.useMemo(
    () => ({
      tipoCorte: tipoCorteValue,
      demasiaCorteMm: tipoCorteValue === "con_demasia" ? demasiaCorteMm : 0,
      lineaCorteMm,
      tamanoPliegoImpresion: {
        codigo: tamanoPliegoSeleccionado.codigo,
        nombre: tamanoPliegoSeleccionado.nombre,
        anchoMm: tamanoPliegoSeleccionado.anchoMm,
        altoMm: tamanoPliegoSeleccionado.altoMm,
      },
      mermaAdicionalPct: Number(config.mermaAdicionalPct ?? 0),
    }),
    [tipoCorteValue, demasiaCorteMm, lineaCorteMm, tamanoPliegoSeleccionado, config.mermaAdicionalPct],
  );

  React.useEffect(() => {
    if (!selectedVariante) {
      setImposicionPreviewRaw(null);
      return;
    }
    const timeout = window.setTimeout(() => {
      previewImposicionProductoVariante(selectedVariante.id, imposicionPayloadConfig)
        .then((res) => setImposicionPreviewRaw(res))
        .catch(() => setImposicionPreviewRaw(null));
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [selectedVariante, imposicionPayloadConfig]);

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
        setGeneralForm((prev) => ({
          ...prev,
          nombre: withMotor.nombre,
          descripcion: withMotor.descripcion ?? "",
          motorCodigo: withMotor.motorCodigo,
          motorVersion: withMotor.motorVersion,
        }));
        toast.success("Datos generales actualizados.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar el producto.");
      }
    });
  };

  const syncProductoCommercialState = (updated: ProductoServicio) => {
    setProductoState(updated);
    const persistedPrecio = buildPrecioConfigDraft(
      updated.precio,
      updated.unidadComercial?.trim() || "unidad",
    );
    setPrecioForm(persistedPrecio);
    setPrecioEditorDraft(persistedPrecio);
    setPrecioEspecialClientesForm(updated.precioEspecialClientes ?? []);
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
    const nextPrecio = {
      ...precioForm,
      comisiones: nextComisiones,
    } as ProductoPrecioConfig;

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
    const nextMeasurementUnit =
      precioEditorDraft.measurementUnit ?? productoState.unidadComercial?.trim() ?? "unidad";
    const next = {
      ...buildPrecioConfigForMethod(
        metodoCalculo,
        nextMeasurementUnit,
      ),
      impuestos: {
        esquemaId: precioEditorDraft.impuestos.esquemaId,
        esquemaNombre: precioEditorDraft.impuestos.esquemaNombre,
        items: precioEditorDraft.impuestos.items.map((item) => ({ ...item })),
        porcentajeTotal: precioEditorDraft.impuestos.porcentajeTotal,
      },
      comisiones: {
        items: precioEditorDraft.comisiones.items.map((item) => ({ ...item })),
        porcentajeTotal: precioEditorDraft.comisiones.porcentajeTotal,
      },
    } as ProductoPrecioConfig;
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
      item.id === itemId
        ? {
            ...item,
            activo,
          }
        : item,
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
    persistPrecioComisiones(comisiones, {
      successMessage: "Estado de comisión actualizado.",
    });
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
    setPrecioEditorDraft(buildPrecioConfigDraft(precioForm, productoState.unidadComercial?.trim() || "unidad"));
    setPrecioEditorOpen(true);
  };

  const handleCancelPrecioEditor = () => {
    setPrecioEditorDraft(buildPrecioConfigDraft(precioForm, productoState.unidadComercial?.trim() || "unidad"));
    setPrecioEditorOpen(false);
  };

  const handleSavePrecioFromEditor = () => {
    const nextPrecio = buildPrecioConfigDraft(precioEditorDraft, productoState.unidadComercial?.trim() || "unidad");
    setPrecioForm(nextPrecio);
    handleSavePrecio(nextPrecio, true);
  };

  const handleOpenPrecioEspecialClienteEditor = (item?: ProductoPrecioEspecialCliente) => {
    setPrecioEspecialClienteEditorDraft(
      buildPrecioEspecialClienteDraft(item, productoState.unidadComercial?.trim() || "unidad"),
    );
    setPrecioEspecialClienteEditorOpen(true);
  };

  const handleChangeMetodoCalculoPrecioEspecialCliente = (metodoCalculo: MetodoCalculoPrecioProducto) => {
    const nextMeasurementUnit =
      precioEspecialClienteEditorDraft.measurementUnit ?? productoState.unidadComercial?.trim() ?? "unidad";
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
    options?: { successMessage?: string; onSuccess?: (updated: ProductoServicio) => void },
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
      item.id === itemId
        ? {
            ...item,
            activo,
            updatedAt: new Date().toISOString(),
          }
        : item,
    );
    persistPrecioEspecialClientes(nextItems, {
      successMessage: "Estado del precio especial actualizado.",
    });
  };

  const handleDeletePrecioEspecialCliente = (itemId: string) => {
    const nextItems = precioEspecialClientesForm.filter((item) => item.id !== itemId);
    persistPrecioEspecialClientes(nextItems, {
      successMessage: "Precio especial eliminado.",
    });
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
        return {
          ...draft,
          detalle: {
            tiers: [...draft.detalle.tiers, { quantity: 1, price: 0 }],
          },
        };
      }
      if (current.metodoCalculo === "fijo_con_margen_variable") {
        const draft = current as PrecioEspecialClienteDraft & {
          detalle: Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>["detalle"];
        };
        return {
          ...draft,
          detalle: {
            tiers: [...draft.detalle.tiers, { quantity: 1, marginPct: 0 }],
          },
        };
      }
      if (current.metodoCalculo === "variable_por_cantidad") {
        const draft = current as PrecioEspecialClienteDraft & {
          detalle: Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>["detalle"];
        };
        return {
          ...draft,
          detalle: {
            tiers: [...draft.detalle.tiers, { quantityUntil: 1, price: 0 }],
          },
        };
      }
      if (current.metodoCalculo === "margen_variable") {
        const draft = current as PrecioEspecialClienteDraft & {
          detalle: Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>["detalle"];
        };
        return {
          ...draft,
          detalle: {
            tiers: [...draft.detalle.tiers, { quantityUntil: 1, marginPct: 0 }],
          },
        };
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
        const tiers = [...draft.detalle.tiers, { quantity: 1, price: 0 }];
        return { ...draft, detalle: { tiers } };
      }
      if (current.metodoCalculo === "fijo_con_margen_variable") {
        const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>;
        const tiers = [...draft.detalle.tiers, { quantity: 1, marginPct: 0 }];
        return { ...draft, detalle: { tiers } };
      }
      if (current.metodoCalculo === "variable_por_cantidad") {
        const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>;
        const tiers = [...draft.detalle.tiers, { quantityUntil: 1, price: 0 }];
        return { ...draft, detalle: { tiers } };
      }
      if (current.metodoCalculo === "margen_variable") {
        const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>;
        const tiers = [...draft.detalle.tiers, { quantityUntil: 1, marginPct: 0 }];
        return { ...draft, detalle: { tiers } };
      }
      return current;
    });
  };

  const removePrecioTierRow = (index: number) => {
    updatePrecioEditorDraft((current) => {
      if (current.metodoCalculo === "fijado_por_cantidad") {
        const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "fijado_por_cantidad" }>;
        const tiers = draft.detalle.tiers.filter((_, rowIndex) => rowIndex !== index);
        return draft.detalle.tiers.length > 1 ? { ...draft, detalle: { tiers } } : current;
      }
      if (current.metodoCalculo === "fijo_con_margen_variable") {
        const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>;
        const tiers = draft.detalle.tiers.filter((_, rowIndex) => rowIndex !== index);
        return draft.detalle.tiers.length > 1 ? { ...draft, detalle: { tiers } } : current;
      }
      if (current.metodoCalculo === "variable_por_cantidad") {
        const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>;
        const tiers = draft.detalle.tiers.filter((_, rowIndex) => rowIndex !== index);
        return draft.detalle.tiers.length > 1 ? { ...draft, detalle: { tiers } } : current;
      }
      if (current.metodoCalculo === "margen_variable") {
        const draft = current as Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>;
        const tiers = draft.detalle.tiers.filter((_, rowIndex) => rowIndex !== index);
        return draft.detalle.tiers.length > 1 ? { ...draft, detalle: { tiers } } : current;
      }
      return current;
    });
  };

  const handleCreateVariante = () => {
    if (!draft.nombre.trim()) {
      toast.error("El nombre de variante es obligatorio.");
      return;
    }

    startSavingVariante(async () => {
      try {
        const created = await createProductoVariante(productoState.id, {
          nombre: draft.nombre.trim(),
          anchoMm: Number(draft.anchoMm),
          altoMm: Number(draft.altoMm),
          papelVarianteId: draft.papelVarianteId || undefined,
          tipoImpresion: draft.tipoImpresion,
          caras: draft.caras,
          activo: true,
        });
        const opcionesPayload = {
          dimensiones: [
            { dimension: "tipo_impresion" as const, valores: draft.opcionesTipoImpresion },
            { dimension: "caras" as const, valores: draft.opcionesCaras },
          ],
        };
        const opciones = await updateVarianteOpcionesProductivas(created.id, opcionesPayload);
        const createdWithOptions: ProductoVariante = {
          ...created,
          opcionesProductivas: opciones.dimensiones,
        };
        setVariantes((prev) => [...prev, createdWithOptions].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setSelectedVarianteId(createdWithOptions.id);
        setDraft(createVarianteDraft(papeles));
        toast.success("Variante creada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo crear la variante.");
      }
    });
  };

  const handleToggleVariante = (variante: ProductoVariante, active: boolean) => {
    startTogglingVariante(async () => {
      try {
        const updated = await updateProductoVariante(variante.id, { activo: active });
        setVariantes((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        toast.success(active ? "Variante activada." : "Variante desactivada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar la variante.");
      }
    });
  };

  const handleDeleteVariante = (variante: ProductoVariante) => {
    startDeletingVariante(async () => {
      try {
        await deleteProductoVariante(variante.id);
        setVariantes((prev) => {
          const remaining = prev.filter((item) => item.id !== variante.id);
          if (selectedVarianteId === variante.id) {
            setSelectedVarianteId(remaining[0]?.id ?? "");
          }
          if (editingVarianteId === variante.id) {
            setEditingVarianteId("");
          }
          return remaining;
        });
        toast.success("Variante eliminada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo eliminar la variante.");
      }
    });
  };

  const handleStartEditVariante = (variante: ProductoVariante) => {
    setEditingVarianteId(variante.id);
    setEditDraft(createEditVarianteDraft(variante, papeles));
  };

  const handleSaveEditVariante = () => {
    if (!editingVariante) {
      toast.error("Selecciona una variante para editar.");
      return;
    }
    if (!editDraft.nombre.trim()) {
      toast.error("El nombre de variante es obligatorio.");
      return;
    }

    startUpdatingVariante(async () => {
      try {
        const updated = await updateProductoVariante(editingVariante.id, {
          nombre: editDraft.nombre.trim(),
          anchoMm: Number(editDraft.anchoMm),
          altoMm: Number(editDraft.altoMm),
          papelVarianteId: editDraft.papelVarianteId || undefined,
          tipoImpresion: editDraft.tipoImpresion,
          caras: editDraft.caras,
        });
        const opcionesPayload = {
          dimensiones: [
            { dimension: "tipo_impresion" as const, valores: editDraft.opcionesTipoImpresion },
            { dimension: "caras" as const, valores: editDraft.opcionesCaras },
          ],
        };
        const opciones = await updateVarianteOpcionesProductivas(updated.id, opcionesPayload);
        const updatedWithOptions: ProductoVariante = {
          ...updated,
          opcionesProductivas: opciones.dimensiones,
        };
        const nextVariantes = variantes.map((item) =>
          item.id === updatedWithOptions.id ? updatedWithOptions : item,
        );
        setVariantes(nextVariantes);
        setRutaBaseMatchingDraft((prev) =>
          normalizeRutaBaseMatchingDraftForVariantes(
            prev,
            nextVariantes,
            dimensionesBaseConsumidasDraft,
          ),
        );
        setSelectedVarianteId(updated.id);
        setEditingVarianteId("");
        toast.success("Variante actualizada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo editar la variante.");
      }
    });
  };

  const handleCancelEditVariante = () => {
    setEditingVarianteId("");
    setEditDraft(createVarianteDraft(papeles));
  };

  const handleConfirmVarianteAction = () => {
    if (!confirmAction) return;
    if (confirmAction.type === "delete") {
      handleDeleteVariante(confirmAction.variante);
      setConfirmAction(null);
      return;
    }
    handleToggleVariante(confirmAction.variante, confirmAction.nextActive);
    setConfirmAction(null);
  };

  const isEditingVariante = Boolean(editingVariante);
  const formDraft = isEditingVariante ? editDraft : draft;
  const setFormDraft = (updater: (prev: VarianteEditDraft) => VarianteEditDraft) => {
    if (isEditingVariante) {
      setEditDraft((prev) => updater(prev));
      return;
    }
    setDraft((prev) => updater(prev));
  };

  const handleAsignarRutaProducto = (routeId: string) => {
    const nextRouteId = routeId ?? "";
    const rutaNombreToast = rutaLabelById.get(nextRouteId) ?? "la ruta seleccionada";
    setRutaDefaultProductoId(nextRouteId);
    if (!usarRutaComunVariantes || !nextRouteId || nextRouteId === rutaDefaultGuardadaId) {
      return;
    }
    startSavingRutaPolicy(async () => {
      try {
        const updated = await updateProductoRutaPolicy(productoState.id, {
          usarRutaComunVariantes: true,
          procesoDefinicionDefaultId: nextRouteId,
        });
        setProductoState((prev) => ({
          ...prev,
          usarRutaComunVariantes: updated.usarRutaComunVariantes,
          procesoDefinicionDefaultId: updated.procesoDefinicionDefaultId,
          procesoDefinicionDefaultNombre: updated.procesoDefinicionDefaultNombre,
        }));
        setRutaDefaultProductoId(updated.procesoDefinicionDefaultId ?? nextRouteId);
        toast.success(`Ruta default guardada: ${rutaNombreToast}.`);
      } catch (error) {
        setRutaDefaultProductoId(rutaDefaultGuardadaId);
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la ruta default.");
      }
    });
  };

  const handleToggleRutasPorVariante = (checked: boolean) => {
    const nextUsarRutaComunVariantes = !checked;
    setUsarRutaComunVariantes(nextUsarRutaComunVariantes);
    const fallbackRutaDefaultId =
      rutaDefaultProductoId ||
      rutaDefaultGuardadaId ||
      Object.values(rutasPorVarianteDraft).find((id) => Boolean(id)) ||
      variantes.find((item) => Boolean(item.procesoDefinicionId))?.procesoDefinicionId ||
      "";
    startSavingRutaPolicy(async () => {
      try {
        const updated = await updateProductoRutaPolicy(productoState.id, {
          usarRutaComunVariantes: nextUsarRutaComunVariantes,
          procesoDefinicionDefaultId: (nextUsarRutaComunVariantes ? fallbackRutaDefaultId : rutaDefaultProductoId) || null,
        });
        setProductoState((prev) => ({
          ...prev,
          usarRutaComunVariantes: updated.usarRutaComunVariantes,
          procesoDefinicionDefaultId: updated.procesoDefinicionDefaultId,
          procesoDefinicionDefaultNombre: updated.procesoDefinicionDefaultNombre,
        }));
        setUsarRutaComunVariantes(updated.usarRutaComunVariantes);
        setRutaDefaultProductoId(updated.procesoDefinicionDefaultId ?? fallbackRutaDefaultId);
        if (updated.usarRutaComunVariantes) {
          setVariantes((prev) =>
            prev.map((item) => ({
              ...item,
              procesoDefinicionId: null,
              procesoDefinicionNombre: "",
              procesoDefinicionCodigo: "",
            })),
          );
          setRutasPorVarianteDraft({});
        } else {
          setRutasPorVarianteDraft(
            Object.fromEntries(
              variantes.map((item) => [item.id, item.procesoDefinicionId ?? ""]),
            ),
          );
        }
      } catch (error) {
        setUsarRutaComunVariantes((prev) => !prev);
        toast.error(error instanceof Error ? error.message : "No se pudo cambiar el modo de rutas.");
      }
    });
  };

  const handleAsignarRutaVariante = (varianteId: string, routeId: string) => {
    if (!routeId) {
      toast.error("Selecciona una ruta.");
      return;
    }
    startSavingRutaVariante(async () => {
      setSavingVarianteId(varianteId);
      try {
        const updated = await assignProductoVarianteRuta(varianteId, routeId);
        setVariantes((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        toast.success(`Ruta guardada en "${updated.nombre}".`);
      } catch (error) {
        setRutasPorVarianteDraft((prev) => {
          const original = variantes.find((item) => item.id === varianteId)?.procesoDefinicionId ?? "";
          return { ...prev, [varianteId]: original };
        });
        toast.error(error instanceof Error ? error.message : "No se pudo asignar la ruta.");
      } finally {
        setSavingVarianteId(null);
      }
    });
  };

  const handleRutaBaseMatchingChange = (
    varianteId: string,
    key: { tipoImpresion: "bn" | "cmyk" | null; caras: "simple_faz" | "doble_faz" | null },
    patch: Partial<RutaBaseMatchingDraft>,
  ) => {
    let nextState: Record<string, RutaBaseMatchingDraft[]> | null = null;
    setRutaBaseMatchingDraft((prev) => {
      const current = prev[varianteId] ?? [];
      const nextRow: RutaBaseMatchingDraft = {
        tipoImpresion: key.tipoImpresion,
        caras: key.caras,
        pasoPlantillaId: "",
        perfilOperativoId: "",
        ...current.find(
          (item) => item.tipoImpresion === key.tipoImpresion && item.caras === key.caras,
        ),
        ...patch,
      };
      const nextRows = current.filter(
        (item) => !(item.tipoImpresion === key.tipoImpresion && item.caras === key.caras),
      );
      nextRows.push(nextRow);
      nextState = {
        ...prev,
        [varianteId]: nextRows,
      };
      return nextState;
    });
    if (nextState) {
      persistRutaBaseMatching(nextState);
    }
  };

  const handleRutaBasePasoFijoChange = (
    varianteId: string,
    pasoPlantillaId: string,
    perfilOperativoId: string,
  ) => {
    let nextState: Record<string, RutaBasePasoFijoDraft[]> | null = null;
    setRutaBasePasosFijosDraft((prev) => {
      const current = prev[varianteId] ?? [];
      const nextRows = current.filter((item) => item.pasoPlantillaId !== pasoPlantillaId);
      if (perfilOperativoId) {
        nextRows.push({ pasoPlantillaId, perfilOperativoId });
      }
      nextState = {
        ...prev,
        [varianteId]: nextRows,
      };
      return nextState;
    });
    if (nextState) {
      persistRutaBaseMatching(rutaBaseMatchingDraft, dimensionesBaseConsumidasDraft, variantes, nextState);
    }
  };

  const persistRutaBaseMatching = (
    nextMatchingDraft: Record<string, RutaBaseMatchingDraft[]>,
    nextDimensiones = dimensionesBaseConsumidasDraft,
    nextVariantes = variantes,
    nextPasosFijosDraft = rutaBasePasosFijosDraft,
  ) => {
    startSavingRutaBaseRules(async () => {
      try {
        const normalizedDraft = normalizeRutaBaseMatchingDraftForVariantes(
          nextMatchingDraft,
          nextVariantes,
          nextDimensiones,
        );
        const updated = await updateProductoRutaPolicy(productoState.id, {
          usarRutaComunVariantes,
          procesoDefinicionDefaultId: rutaDefaultProductoId || null,
          dimensionesBaseConsumidas: nextDimensiones,
          matchingBasePorVariante: nextVariantes.map((variante) => ({
            varianteId: variante.id,
            matching: (normalizedDraft[variante.id] ?? [])
              .filter((row) => row.pasoPlantillaId && row.perfilOperativoId)
              .map((row) => ({
                tipoImpresion: row.tipoImpresion ?? undefined,
                caras: row.caras ?? undefined,
                pasoPlantillaId: row.pasoPlantillaId,
                perfilOperativoId: row.perfilOperativoId,
              })),
          })),
          pasosFijosPorVariante: nextVariantes.map((variante) => ({
            varianteId: variante.id,
            pasos: (nextPasosFijosDraft[variante.id] ?? [])
              .filter((row) => row.pasoPlantillaId && row.perfilOperativoId)
              .map((row) => ({
                pasoPlantillaId: row.pasoPlantillaId,
                perfilOperativoId: row.perfilOperativoId,
              })),
          })),
        });
        setProductoState((prev) => ({
          ...prev,
          usarRutaComunVariantes: updated.usarRutaComunVariantes,
          procesoDefinicionDefaultId: updated.procesoDefinicionDefaultId,
          procesoDefinicionDefaultNombre: updated.procesoDefinicionDefaultNombre,
          dimensionesBaseConsumidas: updated.dimensionesBaseConsumidas ?? [],
          matchingBasePorVariante: updated.matchingBasePorVariante ?? [],
          pasosFijosPorVariante: updated.pasosFijosPorVariante ?? [],
        }));
        setDimensionesBaseConsumidasDraft(updated.dimensionesBaseConsumidas ?? []);
        setRutaBaseMatchingDraft(
          buildRutaBaseMatchingDraft(
            {
              ...productoState,
              dimensionesBaseConsumidas: updated.dimensionesBaseConsumidas ?? [],
              matchingBasePorVariante: updated.matchingBasePorVariante ?? [],
            },
            variantes,
          ),
        );
        setRutaBasePasosFijosDraft(
          buildRutaBasePasosFijosDraft(
            {
              ...productoState,
              pasosFijosPorVariante: updated.pasosFijosPorVariante ?? [],
            },
            variantes,
          ),
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la ruta base.");
      }
    });
  };

  const handleToggleDimensionConsumida = (
    dimension: DimensionOpcionProductiva,
    checked: boolean,
  ) => {
    const nextDimensiones = checked
      ? Array.from(new Set([...dimensionesBaseConsumidasDraft, dimension]))
      : dimensionesBaseConsumidasDraft.filter((item) => item !== dimension);
    setDimensionesBaseConsumidasDraft(nextDimensiones);
    startSavingRutaBaseRules(async () => {
      try {
        persistRutaBaseMatching(rutaBaseMatchingDraft, nextDimensiones);
      } catch (error) {
        setDimensionesBaseConsumidasDraft(productoState.dimensionesBaseConsumidas ?? []);
        toast.error(error instanceof Error ? error.message : "No se pudieron guardar las dimensiones del producto.");
      }
    });
  };

  const openRouteEditor = async (targetVarianteId: string | null) => {
    try {
      const plantillas = await getProcesoOperacionPlantillas();
      setRouteEditorPlantillas(plantillas.filter((item) => item.activo));
    } catch {
      setRouteEditorPlantillas([]);
    }

    const targetProcesoId = targetVarianteId
      ? (rutasPorVarianteDraft[targetVarianteId] ?? "")
      : rutaDefaultProductoId;
    const target = procesos.find((item) => item.id === targetProcesoId);
    if (target) {
      setRouteEditorCodigo("");
      setRouteEditorNombre(`${target.nombre} (copia)`);
      setRouteEditorOperaciones(buildDraftFromProceso(target));
    } else {
      setRouteEditorCodigo("");
      setRouteEditorNombre("");
      setRouteEditorOperaciones([]);
    }

    setRouteEditorTemplateId("");
    setRouteEditorGuardarEnRutas(true);
    setRouteEditorTargetVarianteId(targetVarianteId);
    setRouteEditorOpen(true);
  };

  const moveOperation = (from: number, to: number) => {
    if (to < 0 || to >= routeEditorOperaciones.length || from === to) return;
    setRouteEditorOperaciones((prev) => {
      const next = prev.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleAddPlantillaStep = () => {
    const template = routeEditorPlantillas.find((item) => item.id === routeEditorTemplateId);
    if (!template) {
      toast.error("Selecciona una plantilla de paso.");
      return;
    }
    setRouteEditorOperaciones((prev) => [...prev, buildDraftFromTemplate(template)]);
  };

  const handleSaveRouteEditor = () => {
    if (!routeEditorNombre.trim()) {
      toast.error("El nombre de la ruta es obligatorio.");
      return;
    }
    if (routeEditorOperaciones.length === 0) {
      toast.error("Agrega al menos un paso.");
      return;
    }

    startSavingRouteEditor(async () => {
      try {
        const payload = {
          codigo: routeEditorCodigo.trim() || undefined,
          nombre: routeEditorNombre.trim(),
          descripcion: "",
          activo: true,
          observaciones: "",
          operaciones: routeEditorOperaciones.map((op, index) => ({
            ...op,
            orden: index + 1,
            activo: op.activo ?? true,
          })),
        };

        const saved = await createProceso({
          ...payload,
          activo: routeEditorGuardarEnRutas,
        });

        const routeId = saved.id;
        setRouteEditorOpen(false);
        if (routeEditorTargetVarianteId) {
          setRutasPorVarianteDraft((prev) => ({ ...prev, [routeEditorTargetVarianteId]: routeId }));
          await assignProductoVarianteRuta(routeEditorTargetVarianteId, routeId);
          setVariantes((prev) =>
            prev.map((item) =>
              item.id === routeEditorTargetVarianteId
                ? {
                    ...item,
                    procesoDefinicionId: routeId,
                    procesoDefinicionNombre: saved.nombre,
                    procesoDefinicionCodigo: saved.codigo,
                  }
                : item,
            ),
          );
          if (selectedVarianteId === routeEditorTargetVarianteId) {
            setRutaSeleccionadaId(routeId);
          }
        } else if (usarRutaComunVariantes) {
          setRutaDefaultProductoId(routeId);
          setRutaSeleccionadaId(routeId);
          const updated = await updateProductoRutaPolicy(productoState.id, {
            usarRutaComunVariantes: true,
            procesoDefinicionDefaultId: routeId,
          });
          setProductoState((prev) => ({
            ...prev,
            usarRutaComunVariantes: updated.usarRutaComunVariantes,
            procesoDefinicionDefaultId: updated.procesoDefinicionDefaultId,
            procesoDefinicionDefaultNombre: updated.procesoDefinicionDefaultNombre,
          }));
        }
        toast.success("Ruta creada y asignada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la ruta.");
      }
    });
  };

  const handleSaveConfig = () => {
    if (!selectedVariante) {
      toast.error("Selecciona una variante.");
      return;
    }

    startSavingConfig(async () => {
      try {
        const updated = await upsertVarianteMotorOverride(selectedVariante.id, imposicionPayloadConfig);
        setConfig(updated.parametros);
        toast.success("Configuración de imposición guardada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la imposición.");
      }
    });
  };

  const handleCotizar = () => {
    if (!selectedVariante) {
      toast.error("Selecciona una variante para cotizar.");
      return;
    }

    startCotizando(async () => {
      try {
        const result = await cotizarProductoVariante(selectedVariante.id, {
          cantidad: Number(cotizacionCantidad),
          periodo: cotizacionPeriodo,
          seleccionesBase: Object.entries(cotizacionSeleccionesBase)
            .filter(([, value]) => Boolean(value))
            .map(([dimension, valor]) => ({
              dimension: dimension as DimensionOpcionProductiva,
              valor: valor as ValorOpcionProductiva,
            })),
          checklistRespuestas: Object.entries(cotizacionChecklistRespuestas)
            .filter(([, value]) => Boolean(value?.respuestaId))
            .map(([preguntaId, value]) => ({
              preguntaId,
              respuestaId: value.respuestaId,
            })),
        });
        setCotizacion(result);
        const snapshots = await getCotizacionesProductoVariante(selectedVariante.id);
        setCotizaciones(snapshots);
        toast.success("Cotización calculada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo cotizar.");
      }
    });
  };

  const procesosCotizados = cotizacion?.bloques?.procesos ?? [];
  const materialesCotizados = (cotizacion?.bloques?.materiales ?? []) as Array<Record<string, unknown>>;
  const materialesAgrupados = React.useMemo(() => {
    const groups = new Map<
      string,
      {
        tipo: string;
        label: string;
        items: Array<Record<string, unknown>>;
        mermaOperativa: Array<Record<string, unknown>>;
        totalMermaCantidad: number;
        totalMermaCosto: number;
        totalCantidad: number;
        totalCosto: number;
      }
    >();
    for (const item of materialesCotizados) {
      const tipo = String(item.tipo ?? "");
      const current =
        groups.get(tipo) ??
        {
          tipo,
          label: getMaterialTipoLabel(tipo),
          items: [],
          mermaOperativa: [],
          totalMermaCantidad: 0,
          totalMermaCosto: 0,
          totalCantidad: 0,
          totalCosto: 0,
        };
      const cantidad = Number(item.cantidad ?? 0) || 0;
      const costo = Number(item.costo ?? 0) || 0;
      const origen = String(item.origen ?? "Base").trim().toLowerCase();
      if (origen === "merma operativa") {
        current.mermaOperativa.push(item);
        current.totalMermaCantidad += cantidad;
        current.totalMermaCosto += costo;
      } else {
        current.items.push(item);
      }
      current.totalCantidad += cantidad;
      current.totalCosto += costo;
      groups.set(tipo, current);
    }
    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [materialesCotizados]);
  const [materialesOpen, setMaterialesOpen] = React.useState<Record<string, boolean>>({});
  const [materialesMermaOpen, setMaterialesMermaOpen] = React.useState<Record<string, boolean>>({});
  const [filmTraceSheetOpen, setFilmTraceSheetOpen] = React.useState(false);
  const filmTraceViews = React.useMemo(
    () => procesosCotizados.map((item) => getLaminadoTraceView(item)).filter((item): item is LaminadoTraceView => Boolean(item)),
    [procesosCotizados],
  );
  const totalCentroCostos = procesosCotizados.reduce((acc, item) => {
    const costo = Number(item.costo ?? 0);
    return Number.isFinite(costo) ? acc + costo : acc;
  }, 0);
  const totalMaterialesCosto = materialesCotizados.reduce((acc, item) => {
    const costo = Number(item.costo ?? 0);
    return Number.isFinite(costo) ? acc + costo : acc;
  }, 0);
  const totalCostoGeneral = totalCentroCostos + totalMaterialesCosto;
  const simulacionComercial = React.useMemo(
    () =>
      simularPrecioComercial({
        precio: precioForm,
        costoTotal: cotizacion ? totalCostoGeneral : null,
        cantidad: Number(cotizacionCantidad),
      }),
    [precioForm, cotizacion, totalCostoGeneral, cotizacionCantidad],
  );
  const handleDescargarPdfCotizacion = React.useCallback(async () => {
    if (!cotizacion || !selectedVariante) return;

    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      let cursorY = margin;
      const docWithTable = doc as typeof doc & { lastAutoTable?: { finalY: number } };

      const ensureSpace = (heightNeeded: number) => {
        if (cursorY + heightNeeded > pageHeight - margin) {
          doc.addPage();
          cursorY = margin;
        }
      };

      const addSectionTitle = (title: string, subtitle?: string) => {
        ensureSpace(subtitle ? 18 : 10);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.text(title, margin, cursorY);
        cursorY += 6;
        if (subtitle) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(90, 90, 90);
          doc.text(subtitle, margin, cursorY);
          doc.setTextColor(20, 20, 20);
          cursorY += 6;
        }
        cursorY += 2;
      };

      const runTable = (options: Record<string, unknown>) => {
        autoTable(doc, {
          startY: cursorY,
          margin: { left: margin, right: margin },
          theme: "grid",
          styles: { fontSize: 9, cellPadding: 2.4, textColor: [31, 41, 55] },
          headStyles: { fillColor: [248, 250, 252], textColor: [31, 41, 55], fontStyle: "bold" },
          bodyStyles: { valign: "middle" },
          ...options,
        });
        cursorY = (docWithTable.lastAutoTable?.finalY ?? cursorY) + 6;
      };

      try {
        const logoDataUrl = await imageUrlToDataUrl(new URL("/brand/logo-saas.png", window.location.origin).toString());
        const logoW = 34;
        const logoH = 18;
        doc.addImage(logoDataUrl, "PNG", margin, cursorY, logoW, logoH);
      } catch {
        // Si falla el logo, seguimos igual con el PDF.
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Cotización técnica y comercial", margin + 40, cursorY + 7);
      cursorY += 22;

      runTable({
        body: [
          ["Producto", productoState.nombre, "Variante", selectedVariante.nombre],
          ["Cantidad", String(cotizacion.cantidad), "Período tarifa", cotizacion.periodo],
        ],
        columnStyles: {
          0: { cellWidth: 28, fontStyle: "bold", fillColor: [248, 250, 252] },
          1: { cellWidth: 63 },
          2: { cellWidth: 32, fontStyle: "bold", fillColor: [248, 250, 252] },
          3: { cellWidth: "auto" },
        },
      });

      addSectionTitle("Desglose de costos");

      runTable({
        head: [["#", "Paso", "Centro", "Origen", "Minutos", "Tarifa/h", "Costo"]],
        body: [
          ...procesosCotizados.map((item) => [
            String(item.orden ?? ""),
            item.nombre,
            item.centroCostoNombre,
            formatOrigenProcesoLabel(item.origen, null),
            formatNumber(item.totalMin),
            formatCurrency(item.tarifaHora),
            formatCurrency(item.costo),
          ]),
          ["", "", "", "", "", "Total centro de costos", formatCurrency(totalCentroCostos)],
        ],
        columnStyles: {
          0: { cellWidth: 10, halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right", fontStyle: "bold" },
        },
      });

      for (const grupo of materialesAgrupados) {
        ensureSpace(14);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(grupo.label, margin, cursorY);
        cursorY += 3;
        runTable({
          head: [["Componente", "Origen", "Cantidad", "Costo unitario", "Costo"]],
          body: [
            ...grupo.items.map((item) => {
              const nombre = String(item.nombre ?? "Componente");
              const canal = item.canal ? ` (${String(item.canal).toUpperCase()})` : "";
              const sku = item.sku ? ` · ${String(item.sku)}` : "";
              return [
                `${nombre}${canal}${sku}`,
                formatOrigenProcesoLabel(item.origen, null),
                formatNumber(Number(item.cantidad ?? 0)),
                formatNumber(Number(item.costoUnitario ?? 0)),
                formatNumber(Number(item.costo ?? 0)),
              ];
            }),
            ...grupo.mermaOperativa.map((item) => {
              const nombre = String(item.nombre ?? "Componente");
              const canal = item.canal ? ` (${String(item.canal).toUpperCase()})` : "";
              const sku = item.sku ? ` · ${String(item.sku)}` : "";
              return [
                `${nombre}${canal}${sku}`,
                "Merma operativa",
                formatNumber(Number(item.cantidad ?? 0)),
                formatNumber(Number(item.costoUnitario ?? 0)),
                formatNumber(Number(item.costo ?? 0)),
              ];
            }),
            ["", "", "", `Total ${grupo.label}`, formatCurrency(grupo.totalCosto)],
          ],
          columnStyles: {
            2: { halign: "right" },
            3: { halign: "right" },
            4: { halign: "right", fontStyle: "bold" },
          },
        });
      }

      runTable({
        body: [
          ["Total materiales", formatCurrency(totalMaterialesCosto)],
          ["Total general", formatCurrency(totalCostoGeneral)],
        ],
        columnStyles: {
          0: { fontStyle: "bold", fillColor: [248, 250, 252] },
          1: { halign: "right", fontStyle: "bold" },
        },
      });

      addSectionTitle(
        "Simulación comercial",
        simulacionComercial.descripcion ?? simulacionComercial.reason ?? undefined,
      );

      runTable({
        head: [["Concepto", "Valor", "%"]],
        body:
          simulacionComercial.status === "disponible"
            ? [
                [
                  "Costo total",
                  formatCurrency(simulacionComercial.costoTotal),
                  `${formatNumber(
                    simulacionComercial.precioFinal
                      ? (simulacionComercial.costoTotal / simulacionComercial.precioFinal) * 100
                      : 0,
                  )}%`,
                ],
                [
                  "Impuestos",
                  formatCurrency(simulacionComercial.impuestosMonto ?? 0),
                  `${formatNumber(simulacionComercial.impuestosPct)}%`,
                ],
                [
                  "Comisiones",
                  formatCurrency(simulacionComercial.comisionesMonto ?? 0),
                  `${formatNumber(simulacionComercial.comisionesPct)}%`,
                ],
                [
                  "Precio final al cliente",
                  formatCurrency(simulacionComercial.precioFinal ?? 0),
                  "100%",
                ],
                [
                  "Margen real",
                  formatCurrency(simulacionComercial.margenRealMonto ?? 0),
                  `${formatNumber(simulacionComercial.margenRealPct ?? 0)}%`,
                ],
              ]
            : [[simulacionComercial.reason ?? "La simulación comercial no está disponible.", "", ""]],
        columnStyles: {
          1: { halign: "right" },
          2: { halign: "right" },
        },
      });

      if (previewImposicion) {
        const imposicionPng = await svgMarkupToPngDataUrl(
          buildImposicionPdfSvgMarkup(previewImposicion, lineaCorteMm),
          800,
          520,
        );
        const imageWidth = contentWidth;
        const imageHeight = (520 / 800) * imageWidth;
        const imposicionTableHeight = 42;
        ensureSpace(imageHeight + imposicionTableHeight + 20);
        addSectionTitle("Imposición");
        ensureSpace(imageHeight + 12);
        doc.addImage(imposicionPng, "PNG", margin, cursorY, imageWidth, imageHeight);
        cursorY += imageHeight + 5;
        runTable({
          body: [
            ["Pliego de impresión", `${formatNumber(previewImposicion.hojaW)} x ${formatNumber(previewImposicion.hojaH)} mm`],
            ["Área útil", `${formatNumber(previewImposicion.utilW)} x ${formatNumber(previewImposicion.utilH)} mm`],
            ["Orientación", previewImposicion.orientacion === "rotada" ? "Rotada" : "Normal"],
            ["Piezas por pliego", String(previewImposicion.piezasPorPliego)],
            ["Cortes de guillotina", String(previewImposicion.cortesGuillotina)],
          ],
          columnStyles: {
            0: { fontStyle: "bold", fillColor: [248, 250, 252], cellWidth: 45 },
            1: { cellWidth: "auto" },
          },
        });
      }

      if (filmTraceViews.length) {
        const firstFilmImageHeight = (760 / 280) * 42;
        ensureSpace(firstFilmImageHeight + 80);
        addSectionTitle("Cálculo visual del film");
        for (const trace of filmTraceViews) {
          const filmPng = await svgMarkupToPngDataUrl(buildFilmPdfSvgMarkup(trace), 280, 760);
          const imageWidth = 42;
          const imageHeight = (760 / 280) * imageWidth;
          const metaRows = [
            ["Paso", `${trace.codigo} · ${trace.nombre}`],
            ["Pliegos", String(trace.pliegosTotales || trace.hojasTotales || 1)],
            ["Pliego impreso", `${formatNumber(trace.pliegoOriginalAnchoMm)} x ${formatNumber(trace.pliegoOriginalAltoMm)} mm`],
            ["Entrada en laminadora", `${formatNumber(trace.anchoHojaMm)} x ${formatNumber(trace.altoHojaMm)} mm`],
            ["Merma arranque", `${formatNumber(trace.mermaArranqueMm)} mm`],
            ["Merma cierre", `${formatNumber(trace.mermaCierreMm)} mm`],
            ["Largo total", `${formatNumber(trace.largoConsumidoMm / 1000)} m`],
          ];
          const tableApproxHeight = 10 + metaRows.length * 8;
          const blockHeight = Math.max(imageHeight, tableApproxHeight);
          ensureSpace(blockHeight + 10);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.text(`${trace.codigo} · ${trace.nombre}`, margin, cursorY);
          cursorY += 4;

          const topY = cursorY;
          doc.addImage(filmPng, "PNG", margin, topY, imageWidth, imageHeight);

          autoTable(doc, {
            startY: topY,
            margin: { left: margin + imageWidth + 8, right: margin },
            theme: "grid",
            styles: { fontSize: 9, cellPadding: 2.2, textColor: [31, 41, 55] },
            body: metaRows,
            columnStyles: {
              0: { fontStyle: "bold", fillColor: [248, 250, 252], cellWidth: 40 },
              1: { cellWidth: "auto" },
            },
          });

          cursorY = Math.max(topY + imageHeight, docWithTable.lastAutoTable?.finalY ?? topY) + 8;
        }
      }

      const filename = `cotizacion-${productoState.nombre}-${selectedVariante.nombre}`
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/gi, "-");
      doc.save(`${filename}.pdf`);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo generar el PDF.");
    }
  }, [
    cotizacion,
    filmTraceViews,
    lineaCorteMm,
    materialesAgrupados,
    previewImposicion,
    procesosCotizados,
    productoState.nombre,
    selectedVariante,
    simulacionComercial,
    totalCentroCostos,
    totalCostoGeneral,
    totalMaterialesCosto,
  ]);
  const isGeneralDirty =
    generalForm.nombre.trim() !== (productoState.nombre ?? "").trim() ||
    generalForm.descripcion.trim() !== (productoState.descripcion ?? "").trim() ||
    generalForm.familiaProductoId !== productoState.familiaProductoId ||
    (generalForm.subfamiliaProductoId || "") !== (productoState.subfamiliaProductoId || "") ||
    generalForm.motorCodigo !== productoState.motorCodigo ||
    generalForm.motorVersion !== productoState.motorVersion;
  const persistedPrecio = React.useMemo(
    () => buildPrecioConfigDraft(productoState.precio, productoState.unidadComercial?.trim() || "unidad"),
    [productoState],
  );
  const isPrecioDirty = JSON.stringify(precioForm) !== JSON.stringify(persistedPrecio);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link
            href="/costos/productos-servicios"
            className={cn(buttonVariants({ variant: "ghost" }), "-ml-3")}
          >
            <ArrowLeftIcon data-icon="inline-start" />
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

      <Tabs defaultValue="general" className="flex flex-col gap-4">
        <TabsList className="h-auto gap-1 rounded-lg bg-muted/70 p-1.5">
          <TabsTrigger value="general" className="cursor-pointer rounded-md px-4 py-2.5 text-sm font-medium transition-transform duration-150 hover:scale-[1.02] data-active:scale-100 data-active:bg-orange-600 data-active:text-white data-active:font-bold data-active:hover:bg-orange-600 data-active:hover:text-white">General</TabsTrigger>
          <TabsTrigger value="variantes" className="cursor-pointer rounded-md px-4 py-2.5 text-sm font-medium transition-transform duration-150 hover:scale-[1.02] data-active:scale-100 data-active:bg-orange-600 data-active:text-white data-active:font-bold data-active:hover:bg-orange-600 data-active:hover:text-white">Variantes</TabsTrigger>
          <TabsTrigger value="produccion" className="cursor-pointer rounded-md px-4 py-2.5 text-sm font-medium transition-transform duration-150 hover:scale-[1.02] data-active:scale-100 data-active:bg-orange-600 data-active:text-white data-active:font-bold data-active:hover:bg-orange-600 data-active:hover:text-white">Ruta base</TabsTrigger>
          <TabsTrigger value="checklist" className="cursor-pointer rounded-md px-4 py-2.5 text-sm font-medium transition-transform duration-150 hover:scale-[1.02] data-active:scale-100 data-active:bg-orange-600 data-active:text-white data-active:font-bold data-active:hover:bg-orange-600 data-active:hover:text-white">Ruta de opcionales</TabsTrigger>
          <TabsTrigger value="imposicion" className="cursor-pointer rounded-md px-4 py-2.5 text-sm font-medium transition-transform duration-150 hover:scale-[1.02] data-active:scale-100 data-active:bg-orange-600 data-active:text-white data-active:font-bold data-active:hover:bg-orange-600 data-active:hover:text-white">Imposición</TabsTrigger>
          <TabsTrigger value="cotizador" className="cursor-pointer rounded-md px-4 py-2.5 text-sm font-medium transition-transform duration-150 hover:scale-[1.02] data-active:scale-100 data-active:bg-orange-600 data-active:text-white data-active:font-bold data-active:hover:bg-orange-600 data-active:hover:text-white">Costos</TabsTrigger>
          <TabsTrigger value="precio" className="cursor-pointer rounded-md px-4 py-2.5 text-sm font-medium transition-transform duration-150 hover:scale-[1.02] data-active:scale-100 data-active:bg-orange-600 data-active:text-white data-active:font-bold data-active:hover:bg-orange-600 data-active:hover:text-white">Precio</TabsTrigger>
          <TabsTrigger value="simulacion-comercial" className="cursor-pointer rounded-md px-4 py-2.5 text-sm font-medium transition-transform duration-150 hover:scale-[1.02] data-active:scale-100 data-active:bg-orange-600 data-active:text-white data-active:font-bold data-active:hover:bg-orange-600 data-active:hover:text-white">Simulación comercial</TabsTrigger>
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
              <div className="md:col-span-2">
                <Button
                  type="button"
                  onClick={handleSaveGeneral}
                  disabled={isSavingGeneral || !isGeneralDirty}
                >
                  {isSavingGeneral ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
                  Guardar datos generales
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variantes">
          <Card>
            <CardHeader>
              <CardTitle>Variantes del producto</CardTitle>
              <CardDescription>Define tamaño, papel y valores permitidos por variante para las dimensiones base consumidas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInactiveVariantes((prev) => !prev)}
                >
                  {showInactiveVariantes ? "Ocultar inactivas" : "Mostrar inactivas"}
                </Button>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Dimensiones del producto</p>
                    <p className="text-xs text-muted-foreground">
                      Define qué dimensiones técnicas del proceso forman parte del producto y deberán resolverse en la ruta base.
                    </p>
                  </div>
                  {isSavingRutaBaseRules ? (
                    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2Icon className="size-3 animate-spin" />
                      Guardando...
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {(["tipo_impresion", "caras"] as DimensionOpcionProductiva[]).map((dimension) => (
                    <label key={`dimension-consumida-${dimension}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span>{dimensionBaseLabelByValue[dimension]}</span>
                      <Checkbox
                        checked={dimensionesBaseConsumidasDraft.includes(dimension)}
                        onCheckedChange={(checked) => handleToggleDimensionConsumida(dimension, Boolean(checked))}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <Table>
                <TableHeader className="bg-muted/50 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)]">
                  <TableRow className="border-b border-border/70">
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tamaño</TableHead>
                    {dimensionesBaseConsumidasDraft.includes("tipo_impresion") ? (
                      <TableHead>Tipo de impresión</TableHead>
                    ) : null}
                    {dimensionesBaseConsumidasDraft.includes("caras") ? (
                      <TableHead>Caras</TableHead>
                    ) : null}
                    <TableHead>Papel</TableHead>
                    <TableHead>Ruta</TableHead>
                    <TableHead className="w-[120px]">Estado</TableHead>
                    <TableHead className="w-[90px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variantesVisibles.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.nombre}</TableCell>
                      <TableCell>{item.anchoMm} x {item.altoMm} mm</TableCell>
                      {dimensionesBaseConsumidasDraft.includes("tipo_impresion") ? (
                        <TableCell>
                          {(item.opcionesProductivas?.find((opt) => opt.dimension === "tipo_impresion")?.valores ?? [item.tipoImpresion])
                            .map((value) => tipoImpresionProductoVarianteItems.find((opt) => opt.value === value)?.label ?? value)
                            .join(" / ")}
                        </TableCell>
                      ) : null}
                      {dimensionesBaseConsumidasDraft.includes("caras") ? (
                        <TableCell>
                          {(item.opcionesProductivas?.find((opt) => opt.dimension === "caras")?.valores ?? [item.caras])
                            .map((value) => carasProductoVarianteItems.find((opt) => opt.value === value)?.label ?? value)
                            .join(" / ")}
                        </TableCell>
                      ) : null}
                      <TableCell>{item.papelNombre || "Sin papel"}</TableCell>
                      <TableCell>
                        {usarRutaComunVariantes
                          ? (rutaLabelById.get(rutaDefaultProductoId) ?? "Sin ruta")
                          : (item.procesoDefinicionNombre ||
                            rutaLabelById.get(item.procesoDefinicionId ?? "") ||
                            "Sin ruta")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.activo}
                            disabled={isTogglingVariante}
                            onCheckedChange={(checked) =>
                              setConfirmAction({ type: "toggle", variante: item, nextActive: Boolean(checked) })
                            }
                          />
                          <span className="text-xs text-muted-foreground">{item.activo ? "Activa" : "Inactiva"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={isUpdatingVariante}
                            onClick={() => handleStartEditVariante(item)}
                            aria-label={`Editar variante ${item.nombre}`}
                          >
                            <PencilIcon className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={isDeletingVariante || isUpdatingVariante}
                            onClick={() => setConfirmAction({ type: "delete", variante: item })}
                            aria-label={`Eliminar variante ${item.nombre}`}
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="rounded-lg border p-4">
                <p className="mb-3 text-sm font-medium">{isEditingVariante ? "Editar variante" : "Crear variante"}</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field>
                    <FieldLabel>Nombre</FieldLabel>
                    <Input
                      value={formDraft.nombre}
                      onChange={(e) => setFormDraft((prev) => ({ ...prev, nombre: e.target.value }))}
                      placeholder="Ej: Estándar 9x5"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Ancho (mm)</FieldLabel>
                    <Input
                      value={formDraft.anchoMm}
                      onChange={(e) => setFormDraft((prev) => ({ ...prev, anchoMm: e.target.value }))}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Alto (mm)</FieldLabel>
                    <Input
                      value={formDraft.altoMm}
                      onChange={(e) => setFormDraft((prev) => ({ ...prev, altoMm: e.target.value }))}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Papel</FieldLabel>
                    <Select
                      value={formDraft.papelVarianteId}
                      onValueChange={(value) => setFormDraft((prev) => ({ ...prev, papelVarianteId: value ?? "" }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar papel">
                          {papelLabelById.get(formDraft.papelVarianteId) ?? ""}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {papeles.map((papel) => (
                          <SelectItem key={papel.id} value={papel.id}>
                            {papel.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {dimensionesBaseConsumidasDraft.includes("tipo_impresion") ? (
                    <Field>
                      <FieldLabel>Tipo de impresión permitido</FieldLabel>
                      <Select
                        value={getTipoImpresionPermitidoSelectValue(formDraft.opcionesTipoImpresion)}
                        onValueChange={(value) =>
                          setFormDraft((prev) => {
                            const selected =
                              tipoImpresionPermitidoSelectItems.find((item) => item.value === value) ??
                              tipoImpresionPermitidoSelectItems[0];
                            return {
                              ...prev,
                              opcionesTipoImpresion: selected.values,
                              tipoImpresion: selected.values.includes(prev.tipoImpresion) ? prev.tipoImpresion : selected.values[0],
                            };
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una opción">
                            {tipoImpresionPermitidoSelectItems.find(
                              (item) => item.value === getTipoImpresionPermitidoSelectValue(formDraft.opcionesTipoImpresion),
                            )?.label ?? "Selecciona una opción"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {tipoImpresionPermitidoSelectItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : null}
                  {dimensionesBaseConsumidasDraft.includes("caras") ? (
                    <Field>
                      <FieldLabel>Caras permitidas</FieldLabel>
                      <Select
                        value={getCarasPermitidasSelectValue(formDraft.opcionesCaras)}
                        onValueChange={(value) =>
                          setFormDraft((prev) => {
                            const selected =
                              carasPermitidasSelectItems.find((item) => item.value === value) ??
                              carasPermitidasSelectItems[0];
                            return {
                              ...prev,
                              opcionesCaras: selected.values,
                              caras: selected.values.includes(prev.caras) ? prev.caras : selected.values[0],
                            };
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una opción">
                            {carasPermitidasSelectItems.find(
                              (item) => item.value === getCarasPermitidasSelectValue(formDraft.opcionesCaras),
                            )?.label ?? "Selecciona una opción"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {carasPermitidasSelectItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {isEditingVariante ? (
                    <Button type="button" onClick={handleSaveEditVariante} disabled={isUpdatingVariante}>
                      {isUpdatingVariante ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
                      Guardar cambios
                    </Button>
                  ) : (
                    <Button type="button" onClick={handleCreateVariante} disabled={isSavingVariante}>
                      {isSavingVariante ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
                      Crear variante
                    </Button>
                  )}
                  {isEditingVariante ? (
                    <Button type="button" variant="outline" onClick={handleCancelEditVariante} disabled={isUpdatingVariante}>
                      Cancelar edición
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checklist">
          <Card>
            <CardHeader>
              <CardTitle>Ruta de opcionales</CardTitle>
              <CardDescription>Define servicios, acabados y otros opcionales fuera de la ruta base del producto.</CardDescription>
            </CardHeader>
            <CardContent>
              <ProductoServicioChecklistEditor
                productoId={productoState.id}
                initialChecklist={productoChecklist}
                plantillasPaso={plantillasPaso}
                materiasPrimas={materiasPrimas}
                routeStepOptions={pasosRutaOpcionales.map((item) => ({ id: item.id, label: item.nombre }))}
                onSaved={setProductoChecklist}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="produccion">
          <Card>
            <CardHeader>
              <CardTitle>Ruta base</CardTitle>
              <CardDescription>Define la ruta principal del producto y la lógica obligatoria de sus dimensiones base.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!usarRutaComunVariantes}
                    onCheckedChange={(checked) => handleToggleRutasPorVariante(Boolean(checked))}
                  />
                  <p className="text-sm font-medium">Rutas por variante</p>
                  <Tooltip>
                    <TooltipTrigger className="inline-flex items-center text-muted-foreground">
                      <InfoIcon className="size-4" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      OFF: usa ruta default del producto. ON: cada variante tiene su propia ruta.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Link href="/costos/procesos" className={buttonVariants({ variant: "outline" })}>
                  Ir al módulo Rutas
                </Link>
              </div>

              {usarRutaComunVariantes ? (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <Field className="w-[320px] max-w-[70vw]">
                      <FieldLabel>Ruta de producción (producto)</FieldLabel>
                      <Select value={rutaDefaultProductoId} onValueChange={(value) => handleAsignarRutaProducto(value ?? "")}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecciona ruta">
                            <span className="block max-w-[44vw] truncate">
                              {rutaNombreById.get(rutaDefaultProductoId) ?? rutaLabelById.get(rutaDefaultProductoId) ?? ""}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="min-w-[460px] max-w-[80vw]">
                          {procesos.map((proceso) => (
                            <SelectItem key={proceso.id} value={proceso.id}>
                              {proceso.codigo} · {proceso.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    {isSavingRutaPolicy ? (
                      <p className="pb-2 text-xs text-muted-foreground">Guardando ruta default...</p>
                    ) : null}
                  </div>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Variante</TableHead>
                          <TableHead>Ruta efectiva</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {variantes.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.nombre}</TableCell>
                            <TableCell>{rutaLabelById.get(rutaDefaultProductoId) ?? "Sin ruta default"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">En modo ruta default, la ruta se define una sola vez para todo el producto.</p>
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="space-y-3">
                    {variantes.map((item) => (
                      <div key={item.id} className="rounded-md border p-3">
                        {(() => {
                          const procesoVariante =
                            procesos.find((p) => p.id === (rutasPorVarianteDraft[item.id] ?? item.procesoDefinicionId ?? "")) ?? null;
                          return (
                            <>
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{item.nombre}{item.activo ? "" : " (inactiva)"}</p>
                          <Button type="button" variant="outline" size="sm" onClick={() => openRouteEditor(item.id)}>
                            <PlusIcon data-icon="inline-start" />
                            Agregar pasos
                          </Button>
                        </div>
                        <div className="flex flex-wrap items-end gap-2">
                          <Field className="w-[320px] max-w-[70vw]">
                            <FieldLabel className="text-xs text-muted-foreground">Ruta</FieldLabel>
                            <Select
                              value={rutasPorVarianteDraft[item.id] ?? ""}
                              onValueChange={(value) => {
                                const next = value ?? "";
                                setRutasPorVarianteDraft((prev) => ({ ...prev, [item.id]: next }));
                                if (next) {
                                  handleAsignarRutaVariante(item.id, next);
                                }
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecciona ruta">
                                  <span className="block max-w-[44vw] truncate">
                                    {rutaNombreById.get(rutasPorVarianteDraft[item.id] ?? "") ??
                                      rutaLabelById.get(rutasPorVarianteDraft[item.id] ?? "") ??
                                      ""}
                                  </span>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="min-w-[460px] max-w-[80vw]">
                                {procesos.map((proceso) => (
                                  <SelectItem key={proceso.id} value={proceso.id}>
                                    {proceso.codigo} · {proceso.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          {savingVarianteId === item.id ? (
                            <div className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Loader2Icon className="size-3 animate-spin" />
                              Guardando...
                            </div>
                          ) : null}
                        </div>
                        {procesoVariante ? (
                          <div className="mt-3 rounded border">
                            <Table>
                              <TableHeader className="bg-muted/40">
                                <TableRow>
                                  <TableHead className="w-[56px]">#</TableHead>
                                  <TableHead>Paso</TableHead>
                                  <TableHead>Centro</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {procesoVariante.operaciones.map((op) => (
                                  <TableRow key={`${item.id}-${op.id}`}>
                                    <TableCell>{op.orden}</TableCell>
                                    <TableCell>{resolveProcesoOperacionPlantilla(op, plantillasPaso)?.nombre ?? op.nombre}</TableCell>
                                    <TableCell>{op.centroCostoNombre}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">Sin ruta asignada.</p>
                        )}
                            </>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Configuración de ruta base</p>
                    <p className="text-xs text-muted-foreground">
                      Define qué paso y qué perfil operativo se usan para cada combinación técnica obligatoria del producto.
                    </p>
                  </div>
                  {isSavingRutaBaseRules ? (
                    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2Icon className="size-3 animate-spin" />
                      Guardando...
                    </div>
                  ) : null}
                </div>
                <div className="space-y-4">
                  {variantes.map((variante) => {
                    const procesoIdRutaBase = usarRutaComunVariantes
                      ? rutaDefaultProductoId
                      : (rutasPorVarianteDraft[variante.id] ?? variante.procesoDefinicionId ?? "");
                    const pasosRutaBaseDisponibles = getRutaBasePasoOptions(
                      procesoIdRutaBase,
                      procesos,
                      plantillasPaso,
                      maquinas,
                      dimensionesBaseConsumidasDraft,
                    );
                    const pasoDefaultUnico =
                      pasosRutaBaseDisponibles.length === 1 ? pasosRutaBaseDisponibles[0]?.id ?? "" : "";
                    const pasosFijosRutaBase = getRutaBasePasoFijoOptions(
                      procesoIdRutaBase,
                      procesos,
                      plantillasPaso,
                      maquinas,
                      dimensionesBaseConsumidasDraft,
                    );
                    const rows = buildMatchingRowsForVariante(
                      variante,
                      dimensionesBaseConsumidasDraft,
                      rutaBaseMatchingDraft[variante.id] ?? [],
                      pasoDefaultUnico,
                    );
                    return (
                      <React.Fragment key={`base-rules-${variante.id}`}>
                        <div className="rounded-md border">
                          <div className="border-b bg-muted/30 px-3 py-2 text-sm font-medium">
                            {variante.nombre}
                          </div>
                          <Table>
                          <TableHeader className="bg-muted/20">
                            <TableRow>
                              {dimensionesBaseConsumidasDraft.includes("tipo_impresion") ? (
                                <TableHead className="w-[180px]">Tipo de impresión</TableHead>
                              ) : null}
                              {dimensionesBaseConsumidasDraft.includes("caras") ? (
                                <TableHead className="w-[180px]">Caras</TableHead>
                              ) : null}
                              <TableHead className="w-[320px]">Paso</TableHead>
                              <TableHead>Perfil operativo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.length ? rows.map((row) => {
                              const plantilla =
                                pasosRutaBaseDisponibles.find((item) => item.id === row.pasoPlantillaId) ?? null;
                              const perfilesDisponibles = plantilla?.maquinaId
                                ? (maquinaById.get(plantilla.maquinaId)?.perfilesOperativos ?? [])
                                    .filter((item) => item.activo)
                                    .filter((item) => isPerfilCompatibleWithMatchingRow(item, row))
                                : [];
                              return (
                                <TableRow key={`${variante.id}-${row.key}`}>
                                  {dimensionesBaseConsumidasDraft.includes("tipo_impresion") ? (
                                    <TableCell>{row.tipoImpresion ? valorOpcionBaseLabelByValue[row.tipoImpresion] : "-"}</TableCell>
                                  ) : null}
                                  {dimensionesBaseConsumidasDraft.includes("caras") ? (
                                    <TableCell>{row.caras ? valorOpcionBaseLabelByValue[row.caras] : "-"}</TableCell>
                                  ) : null}
                                  <TableCell>
                                    <Select
                                      value={row.pasoPlantillaId || "__none__"}
                                      onValueChange={(next) =>
                                        {
                                          const nextPasoPlantillaId = next === "__none__" ? "" : (next ?? "");
                                          const nextPlantilla =
                                            pasosRutaBaseDisponibles.find((item) => item.id === nextPasoPlantillaId) ?? null;
                                          handleRutaBaseMatchingChange(
                                            variante.id,
                                            { tipoImpresion: row.tipoImpresion, caras: row.caras },
                                          {
                                            pasoPlantillaId: nextPasoPlantillaId,
                                              perfilOperativoId:
                                                (nextPlantilla?.maquinaId
                                                  ? (maquinaById.get(nextPlantilla.maquinaId)?.perfilesOperativos ?? [])
                                                      .filter((item) => item.activo)
                                                      .filter((item) => isPerfilCompatibleWithMatchingRow(item, row))[0]?.id
                                                  : "") ??
                                                "",
                                            },
                                          );
                                        }
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecciona paso">
                                          {plantilla?.nombre ?? "Selecciona paso"}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__">Selecciona paso</SelectItem>
                                        {pasosRutaBaseDisponibles.map((item) => (
                                          <SelectItem key={item.id} value={item.id}>
                                            {item.nombre}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={row.perfilOperativoId || "__none__"}
                                      onValueChange={(next) =>
                                        handleRutaBaseMatchingChange(
                                          variante.id,
                                          { tipoImpresion: row.tipoImpresion, caras: row.caras },
                                          { perfilOperativoId: next === "__none__" ? "" : (next ?? "") },
                                        )
                                      }
                                      disabled={!plantilla?.maquinaId}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecciona perfil">
                                          {perfilesDisponibles.find((item) => item.id === row.perfilOperativoId)?.nombre ?? "Selecciona perfil"}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__">Selecciona perfil</SelectItem>
                                        {perfilesDisponibles.map((item) => (
                                          <SelectItem key={item.id} value={item.id}>
                                            {item.nombre}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                </TableRow>
                              );
                            }) : (
                              <TableRow>
                                <TableCell
                                  colSpan={Math.max(2, dimensionesBaseConsumidasDraft.length + 2)}
                                  className="text-center text-sm text-muted-foreground"
                                >
                                  Marca al menos una dimensión consumida en la pestaña Variantes.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                          </Table>
                        </div>
                        {pasosFijosRutaBase.length ? (
                          <div className="rounded-md border">
                          <div className="border-b bg-muted/30 px-3 py-2 text-sm font-medium">
                            Pasos fijos de la ruta
                          </div>
                          <Table>
                            <TableHeader className="bg-muted/20">
                              <TableRow>
                                <TableHead className="w-[320px]">Paso</TableHead>
                                <TableHead>Perfil operativo</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pasosFijosRutaBase.map((pasoFijo) => {
                                const perfilesDisponibles = pasoFijo.maquinaId
                                  ? (maquinaById.get(pasoFijo.maquinaId)?.perfilesOperativos ?? []).filter((item) => item.activo)
                                  : [];
                                const currentPerfilId =
                                  (rutaBasePasosFijosDraft[variante.id] ?? []).find(
                                    (item) => item.pasoPlantillaId === pasoFijo.id,
                                  )?.perfilOperativoId ??
                                  pasoFijo.perfilOperativoId ??
                                  "";
                                return (
                                  <TableRow key={`${variante.id}-fijo-${pasoFijo.id}`}>
                                    <TableCell>{pasoFijo.nombre}</TableCell>
                                    <TableCell>
                                      <Select
                                        value={currentPerfilId || "__none__"}
                                        onValueChange={(next) =>
                                          handleRutaBasePasoFijoChange(
                                            variante.id,
                                            pasoFijo.id,
                                            next === "__none__" ? "" : (next ?? ""),
                                          )
                                        }
                                        disabled={!pasoFijo.maquinaId}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Selecciona perfil">
                                            {perfilesDisponibles.find((item) => item.id === currentPerfilId)?.nombre ?? "Selecciona perfil"}
                                          </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__none__">Selecciona perfil</SelectItem>
                                          {perfilesDisponibles.map((item) => (
                                            <SelectItem key={item.id} value={item.id}>
                                              {item.nombre}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {usarRutaComunVariantes ? (
              <div className="rounded-lg border">
                <div className="flex items-center justify-end border-b bg-muted/30 p-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => openRouteEditor(null)}>
                    <PlusIcon data-icon="inline-start" />
                    Agregar pasos
                  </Button>
                </div>
                <Table>
                  <TableHeader className="bg-muted/50 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)]">
                    <TableRow className="border-b border-border/70">
                      <TableHead>#</TableHead>
                      <TableHead>Paso</TableHead>
                      <TableHead>Centro de costo</TableHead>
                      <TableHead>Máquina</TableHead>
                      <TableHead>Modo / Productividad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {procesoSeleccionado?.operaciones?.map((op) => {
                      const unidadProductividad = getUnidadProductividadCompuestaLabel(
                        op.unidadSalida,
                        op.unidadTiempo,
                      );
                      const modoLabel = getModoProductividadLabel(op.modoProductividad);
                      const detalleModo =
                        op.modoProductividad === "fija"
                          ? op.tiempoFijoMin != null && op.tiempoFijoMin > 0
                            ? `${op.tiempoFijoMin} min`
                            : "-"
                          : op.productividadBase != null
                            ? `${op.productividadBase} ${unidadProductividad}`
                            : "-";
                      return (
                        <TableRow key={op.id}>
                          <TableCell>{op.orden}</TableCell>
                          <TableCell>{op.nombre}</TableCell>
                          <TableCell>{op.centroCostoNombre}</TableCell>
                          <TableCell>{op.maquinaNombre || "-"}</TableCell>
                          <TableCell>{modoLabel} · {detalleModo}</TableCell>
                        </TableRow>
                      );
                    })}
                    {!procesoSeleccionado && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                          No hay ruta efectiva seleccionada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="imposicion">
          <Card>
            <CardHeader>
              <CardTitle>Imposición</CardTitle>
              <CardDescription>Configura el tipo de corte y visualiza cómo entra la pieza en el pliego de impresión.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-5 items-end gap-2">
                <Field className="min-w-0 space-y-1">
                  <FieldLabel className="text-xs text-muted-foreground">Variante</FieldLabel>
                  <Select value={selectedVarianteId} onValueChange={(value) => setSelectedVarianteId(value ?? "")}>
                    <SelectTrigger className="h-9 w-full min-w-0">
                      <SelectValue placeholder="Selecciona variante">{varianteLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {variantesSelect.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.nombre}{item.activo ? "" : " (inactiva)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="min-w-0 space-y-1">
                  <FieldLabel className="text-xs text-muted-foreground">Pliego impresión</FieldLabel>
                  <Select
                    value={tamanoPliegoSeleccionado.codigo}
                    onValueChange={(value) => {
                      const selected = pliegosImpresion.find((item) => item.codigo === value);
                      if (!selected) return;
                      setConfig((prev) => ({
                        ...prev,
                        tamanoPliegoImpresion: {
                          codigo: selected.codigo,
                          nombre: selected.nombre,
                          anchoMm: selected.anchoMm,
                          altoMm: selected.altoMm,
                        },
                      }));
                    }}
                  >
                    <SelectTrigger className="h-9 w-full min-w-0">
                      <SelectValue>{tamanoPliegoSeleccionado.label}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {pliegosImpresion.map((item) => (
                        <SelectItem key={item.codigo} value={item.codigo}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="min-w-0 space-y-1">
                  <FieldLabel className="flex items-center gap-1 text-xs text-muted-foreground">
                    Tipo de corte
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center text-muted-foreground">
                        <InfoIcon className="size-3.5" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        {tipoCorteSelected.help}
                      </TooltipContent>
                    </Tooltip>
                  </FieldLabel>
                  <Select
                    value={tipoCorteValue}
                    onValueChange={(value) =>
                      setConfig((prev) => {
                        const demasiaActual = Number(prev.demasiaCorteMm ?? 0);
                        return {
                          ...prev,
                          tipoCorte: value,
                          demasiaCorteMm:
                            value === "con_demasia"
                              ? demasiaActual > 0
                                ? demasiaActual
                                : 2
                              : 0,
                        };
                      })
                    }
                  >
                    <SelectTrigger className="h-9 w-full min-w-0">
                      <SelectValue>{tipoCorteSelected.label}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {tipoCorteItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="min-w-0 space-y-1">
                  <FieldLabel className="flex items-center gap-1 text-xs text-muted-foreground">
                    Demasía
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center text-muted-foreground">
                        <InfoIcon className="size-3.5" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        Se aplica por igual en los 4 lados de cada pieza cuando el corte es con demasía.
                      </TooltipContent>
                    </Tooltip>
                  </FieldLabel>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      className="h-9 w-full min-w-0 pr-9"
                      disabled={tipoCorteValue !== "con_demasia"}
                      value={String(demasiaCorteMm)}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          demasiaCorteMm: Math.max(0, Number(e.target.value || 0)),
                        }))
                      }
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                      mm
                    </span>
                  </div>
                </Field>
                <Field className="min-w-0 space-y-1">
                  <FieldLabel className="flex items-center gap-1 text-xs text-muted-foreground">
                    Línea de corte
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center text-muted-foreground">
                        <InfoIcon className="size-3.5" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        Define el largo de las marcas de corte de guillotina en el diagrama.
                      </TooltipContent>
                    </Tooltip>
                  </FieldLabel>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      className="h-9 w-full min-w-0 pr-9"
                      value={String(lineaCorteMm)}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, lineaCorteMm: Math.max(0, Number(e.target.value || 0)) }))
                      }
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                      mm
                    </span>
                  </div>
                </Field>
              </div>

              {previewImposicion ? (
                <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
                  <div className="rounded-lg border p-3">
                    <div
                      className="relative overflow-hidden rounded-md border bg-muted/20"
                      onMouseEnter={() => setSvgZoom((prev) => ({ ...prev, active: true }))}
                      onMouseLeave={() => setSvgZoom((prev) => ({ ...prev, active: false, x: 50, y: 50 }))}
                      onMouseMove={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const x = ((event.clientX - rect.left) / rect.width) * 100;
                        const y = ((event.clientY - rect.top) / rect.height) * 100;
                        setSvgZoom({ active: true, x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
                      }}
                    >
                      <svg
                        viewBox="0 0 800 520"
                        className="h-[320px] w-full transition-transform duration-150 ease-out"
                        style={{
                          transform: svgZoom.active ? "scale(2.35)" : "scale(1)",
                          transformOrigin: `${svgZoom.x}% ${svgZoom.y}%`,
                        }}
                      >
                        {(() => {
                          const canvasW = 800;
                          const canvasH = 520;
                          const pad = 30;
                          const scale = Math.min((canvasW - pad * 2) / previewImposicion.hojaW, (canvasH - pad * 2) / previewImposicion.hojaH);
                          const sheetW = previewImposicion.hojaW * scale;
                          const sheetH = previewImposicion.hojaH * scale;
                          const ox = (canvasW - sheetW) / 2;
                          const oy = (canvasH - sheetH) / 2;
                          const marginLeft = previewImposicion.margins.leftMm * scale;
                          const marginRight = previewImposicion.margins.rightMm * scale;
                          const marginTop = previewImposicion.margins.topMm * scale;
                          const marginBottom = previewImposicion.margins.bottomMm * scale;
                          const printableX = ox + marginLeft;
                          const printableY = oy + marginTop;
                          const printableW = Math.max(0, sheetW - marginLeft - marginRight);
                          const printableH = Math.max(0, sheetH - marginTop - marginBottom);
                          const lineCut = previewImposicion.piezaW > 0 ? lineaCorteMm * scale : 0;
                          const utilX = printableX + lineCut;
                          const utilY = printableY + lineCut;
                          const utilW = Math.max(0, printableW - lineCut * 2);
                          const utilH = Math.max(0, printableH - lineCut * 2);
                          const effectivePieceW =
                            (previewImposicion.orientacion === "rotada"
                              ? previewImposicion.effectiveH
                              : previewImposicion.effectiveW) * scale;
                          const effectivePieceH =
                            (previewImposicion.orientacion === "rotada"
                              ? previewImposicion.effectiveW
                              : previewImposicion.effectiveH) * scale;
                          const demasiaMm = Math.max(0, demasiaCorteMm);
                          const demasiaPx = demasiaMm * scale;
                          const pieceW = Math.max(0, effectivePieceW - demasiaPx * 2);
                          const pieceH = Math.max(0, effectivePieceH - demasiaPx * 2);
                          const gridW = previewImposicion.cols * effectivePieceW;
                          const gridH = previewImposicion.rows * effectivePieceH;
                          const centeredGridX = utilX + Math.max(0, (utilW - gridW) / 2);
                          const centeredGridY = utilY + Math.max(0, (utilH - gridH) / 2);
                          const blockLeft = centeredGridX;
                          const blockTop = centeredGridY;
                          const blockRight = centeredGridX + gridW;
                          const blockBottom = centeredGridY + gridH;
                          const markLen = Math.max(0, lineaCorteMm * scale);
                          const markOffset = 1.6;

                          const cells = [];
                          const cutXMap = new Map<string, number>();
                          const cutYMap = new Map<string, number>();
                          for (let r = 0; r < previewImposicion.rows; r++) {
                            for (let c = 0; c < previewImposicion.cols; c++) {
                              const x = centeredGridX + c * effectivePieceW;
                              const y = centeredGridY + r * effectivePieceH;
                              const trimX = x + demasiaPx;
                              const trimY = y + demasiaPx;
                              const trimW = pieceW;
                              const trimH = pieceH;
                              cutXMap.set((trimX).toFixed(2), trimX);
                              cutXMap.set((trimX + trimW).toFixed(2), trimX + trimW);
                              cutYMap.set((trimY).toFixed(2), trimY);
                              cutYMap.set((trimY + trimH).toFixed(2), trimY + trimH);
                              cells.push(
                                <g key={`cell-${r}-${c}`}>
                                  <rect
                                    x={x}
                                    y={y}
                                    width={effectivePieceW}
                                    height={effectivePieceH}
                                    fill={demasiaMm > 0 ? "#e5e7eb" : "#dcfce7"}
                                    stroke={demasiaMm > 0 ? "#9ca3af" : "#16a34a"}
                                    strokeWidth="0.8"
                                  />
                                  <rect
                                    x={trimX}
                                    y={trimY}
                                    width={trimW}
                                    height={trimH}
                                    fill="#22c55e"
                                  />
                                </g>,
                              );
                            }
                          }
                          const guillotinaMarks: React.ReactNode[] = [];
                          if (markLen > 0) {
                            for (const x of cutXMap.values()) {
                              const topY = blockTop - markOffset;
                              const botY = blockBottom + markOffset;
                              guillotinaMarks.push(
                                <g key={`cut-x-${x.toFixed(2)}`}>
                                  <line x1={x} y1={topY - markLen / 2} x2={x} y2={topY + markLen / 2} stroke="#111827" strokeWidth="0.9" />
                                  <line x1={x} y1={botY - markLen / 2} x2={x} y2={botY + markLen / 2} stroke="#111827" strokeWidth="0.9" />
                                </g>,
                              );
                            }
                            for (const y of cutYMap.values()) {
                              const leftX = blockLeft - markOffset;
                              const rightX = blockRight + markOffset;
                              guillotinaMarks.push(
                                <g key={`cut-y-${y.toFixed(2)}`}>
                                  <line x1={leftX - markLen / 2} y1={y} x2={leftX + markLen / 2} y2={y} stroke="#111827" strokeWidth="0.9" />
                                  <line x1={rightX - markLen / 2} y1={y} x2={rightX + markLen / 2} y2={y} stroke="#111827" strokeWidth="0.9" />
                                </g>,
                              );
                            }
                          }

                          return (
                            <>
                              <rect x={ox} y={oy} width={sheetW} height={sheetH} fill="#fecaca" stroke="#7f1d1d" strokeWidth="1.6" />
                              <rect x={printableX} y={printableY} width={printableW} height={printableH} fill="#fff" stroke="#b91c1c" strokeWidth="0.9" />
                              <rect x={utilX} y={utilY} width={utilW} height={utilH} fill="#ecfccb" fillOpacity="0.4" />
                              {cells}
                              {guillotinaMarks}
                            </>
                          );
                        })()}
                      </svg>
                      <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-background/90 px-2 py-1 text-[11px] text-muted-foreground">
                        Hover para zoom
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="overflow-hidden rounded-md border">
                      <Table>
                        <TableHeader className="bg-muted/50 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)]">
                          <TableRow className="border-b border-border/70">
                            <TableHead colSpan={2}>Resumen técnico</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Pliegos por materia prima</TableCell>
                            <TableCell className="text-right font-medium">{previewImposicion.pliegosPorSustrato ?? "-"}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Pliego de materia prima</TableCell>
                            <TableCell className="text-right font-medium">
                              {previewImposicion.sustratoAnchoMm && previewImposicion.sustratoAltoMm
                                ? `${previewImposicion.sustratoAnchoMm} x ${previewImposicion.sustratoAltoMm} mm`
                                : "Sin dimensiones"}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Pliego de impresión</TableCell>
                            <TableCell className="text-right font-medium">{previewImposicion.hojaW} x {previewImposicion.hojaH} mm</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Márgenes no imprimibles</TableCell>
                            <TableCell className="text-right font-medium">
                              Izq:{formatNumber(previewImposicion.margins.leftMm)} Der:{formatNumber(previewImposicion.margins.rightMm)} Sup:{formatNumber(previewImposicion.margins.topMm)} Inf:{formatNumber(previewImposicion.margins.bottomMm)} mm
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Área imprimible</TableCell>
                            <TableCell className="text-right font-medium">{formatNumber(previewImposicion.printableW)} x {formatNumber(previewImposicion.printableH)} mm</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Área útil</TableCell>
                            <TableCell className="text-right font-medium">{formatNumber(previewImposicion.utilW)} x {formatNumber(previewImposicion.utilH)} mm</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Orientación</TableCell>
                            <TableCell className="text-right font-medium">{previewImposicion.orientacion === "rotada" ? "Rotada" : "Normal"}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Piezas por pliego</TableCell>
                            <TableCell className="text-right font-medium">{previewImposicion.piezasPorPliego}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Cortes de guillotina</TableCell>
                            <TableCell className="text-right font-medium">{previewImposicion.cortesGuillotina}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="text-muted-foreground">Tamaño de pieza</TableCell>
                            <TableCell className="text-right font-medium">{formatNumber(previewImposicion.piezaW)} x {formatNumber(previewImposicion.piezaH)} mm</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              ) : null}

              <Button type="button" onClick={handleSaveConfig} disabled={isSavingConfig || !selectedVariante}>
                {isSavingConfig ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
                Guardar imposición
              </Button>
            </CardContent>
          </Card>
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
                          handleChangeMetodoCalculoPrecio(
                            (value as MetodoCalculoPrecioProducto) ?? "margen_variable",
                          )
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
                      Unidad comercial: {precioForm.measurementUnit?.trim() || productoState.unidadComercial || "unidad"}
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
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleOpenPrecioComisionEditor(item)}
                                    >
                                      <PencilIcon className="size-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setPrecioComisionToDelete(item)}
                                    >
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
                    <p className="text-xs text-muted-foreground">
                      Define reglas comerciales especiales por cliente.
                    </p>
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
                {isSavingPrecio ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
                Guardar configuración de precio
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simulacion-comercial">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Simulación comercial</CardTitle>
                  <CardDescription>
                    Estima el precio final de venta a partir de la última cotización de costos y la configuración comercial del producto.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDescargarPdfCotizacion}
                  disabled={!cotizacion}
                >
                  Descargar PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Estado de simulación</p>
                    <p className="text-xs text-muted-foreground">
                      Usa la cantidad de la última cotización y la configuración base del tab Precio.
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
                        : "Sin cotización"}
                  </Badge>
                </div>
                <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                  {simulacionComercial.reason ??
                    simulacionComercial.descripcion ??
                    "La simulación comercial está lista con la última cotización calculada."}
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
                        <Tooltip>
                          <TooltipTrigger className="inline-flex items-center text-muted-foreground">
                            <InfoIcon className="size-3.5" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            Es el precio final que vería el cliente.
                          </TooltipContent>
                        </Tooltip>
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
                        <Tooltip>
                          <TooltipTrigger className="inline-flex items-center text-muted-foreground">
                            <InfoIcon className="size-3.5" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            Es la plata que queda de la venta después de cubrir el costo de producción.
                          </TooltipContent>
                        </Tooltip>
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
                        <Tooltip>
                          <TooltipTrigger className="inline-flex items-center text-muted-foreground">
                            <InfoIcon className="size-3.5" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            Muestra qué parte de la venta queda disponible después de cubrir el costo de producción.
                          </TooltipContent>
                        </Tooltip>
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
                        <Tooltip>
                          <TooltipTrigger className="inline-flex items-center text-muted-foreground">
                            <InfoIcon className="size-3.5" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            Es la plata que queda después de cubrir costo, impuestos y comisiones.
                          </TooltipContent>
                        </Tooltip>
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
                        <Tooltip>
                          <TooltipTrigger className="inline-flex items-center text-muted-foreground">
                            <InfoIcon className="size-3.5" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            Es el porcentaje del precio de venta que realmente te queda.
                          </TooltipContent>
                        </Tooltip>
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
                          <span>{precioForm.measurementUnit?.trim() || productoState.unidadComercial || "unidad"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Esquema impositivo</span>
                          <span>{precioForm.impuestos.esquemaNombre || "Sin impuestos"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Comisiones activas</span>
                          <span>{precioForm.comisiones.items.filter((item) => item.activo).length}</span>
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
                      ? "Todavía no hay una cotización de costos para simular."
                      : "La configuración actual no permite calcular un precio comercial."}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {simulacionComercial.reason ??
                      "Revisá la cotización en Costos y la configuración del tab Precio."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cotizador">
          <Card>
            <CardHeader>
              <CardTitle>Costos</CardTitle>
              <CardDescription>Ejecuta el motor de costo y guarda snapshots por variante.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Field>
                  <FieldLabel>Variante</FieldLabel>
                  <Select value={selectedVarianteId} onValueChange={(value) => setSelectedVarianteId(value ?? "")}> 
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona variante">{varianteLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {variantesSelect.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.nombre}{item.activo ? "" : " (inactiva)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Cantidad</FieldLabel>
                  <Input value={cotizacionCantidad} onChange={(e) => setCotizacionCantidad(e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel>Período tarifa (YYYY-MM)</FieldLabel>
                  <Input value={cotizacionPeriodo} onChange={(e) => setCotizacionPeriodo(e.target.value)} />
                </Field>
                <div className="flex items-end">
                  <Button type="button" onClick={handleCotizar} disabled={isCotizando || !selectedVariante}>
                    {isCotizando ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
                    Cotizar
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">Opciones base del producto</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {selectedVariante
                    ? dimensionesBaseConsumidasDraft.map((dimension) => {
                        const values = getValoresOpcionesBase(selectedVariante, dimension);
                        const selectedValue = cotizacionSeleccionesBase[dimension];
                        const useMiniCards = values.length > 0 && values.length <= 4;
                        return (
                          <Field key={`base-select-${dimension}`}>
                            <FieldLabel>{dimensionBaseLabelByValue[dimension]}</FieldLabel>
                            {useMiniCards ? (
                              <div className="flex flex-wrap gap-2">
                                {values.map((value) => {
                                  const isSelected = selectedValue === value;
                                  return (
                                    <button
                                      key={`${dimension}-${value}`}
                                      type="button"
                                      onClick={() =>
                                        setCotizacionSeleccionesBase((prev) => ({
                                          ...prev,
                                          [dimension]: isSelected ? undefined : value,
                                        }))
                                      }
                                      className={cn(
                                        "inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-sm transition-colors",
                                        isSelected
                                          ? "border-primary bg-primary/10 text-foreground"
                                          : "border-border bg-background hover:border-primary/40 hover:bg-muted/50",
                                      )}
                                    >
                                      <span className="font-medium">
                                        {valorOpcionBaseLabelByValue[value]}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <Select
                                value={selectedValue ?? "__none__"}
                                onValueChange={(value) =>
                                  setCotizacionSeleccionesBase((prev) => ({
                                    ...prev,
                                    [dimension]: value === "__none__" ? undefined : (value as ValorOpcionProductiva),
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona una opción">
                                    {selectedValue ? valorOpcionBaseLabelByValue[selectedValue] : "Selecciona una opción"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {values.length > 1 ? <SelectItem value="__none__">Selecciona una opción</SelectItem> : null}
                                  {values.map((value) => (
                                    <SelectItem key={`${dimension}-${value}`} value={value}>
                                      {valorOpcionBaseLabelByValue[value]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </Field>
                        );
                      })
                    : null}
                  {selectedVariante && dimensionesBaseConsumidasDraft.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Este producto no consume dimensiones base configurables.</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">Opcionales para cotizar</p>
                <ProductoServicioChecklistCotizador
                  checklist={productoChecklist}
                  value={cotizacionChecklistRespuestas}
                  onChange={setCotizacionChecklistRespuestas}
                />
              </div>

              {cotizacion?.warnings?.length ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  {cotizacion.warnings.map((warning, index) => (
                    <p key={index}>{warning}</p>
                  ))}
                </div>
              ) : null}

              {cotizacion ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Centro de costos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader className="bg-muted/50 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)]">
                          <TableRow className="border-b border-border/70">
                            <TableHead>#</TableHead>
                            <TableHead>Paso</TableHead>
                            <TableHead>Centro</TableHead>
                            <TableHead className="w-[180px]">Origen</TableHead>
                            <TableHead className="w-[140px] text-right">Minutos</TableHead>
                            <TableHead className="w-[140px] text-right">Tarifa/h</TableHead>
                            <TableHead className="w-[140px] text-right">Costo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {procesosCotizados.map((item) => (
                            <TableRow key={item.codigo}>
                              {/*
                                El nombre del adicional ya se muestra en "Paso".
                                En "Origen" solo mostramos la categoría funcional.
                              */}
                              {(() => {
                                return (
                                  <>
                              <TableCell>{item.orden}</TableCell>
                              <TableCell>
                                <span className="inline-flex items-center gap-1">
                                  <span>{item.nombre}</span>
                                  {item.detalleTecnico ? (
                                    <Tooltip>
                                      <TooltipTrigger
                                        className="inline-flex size-5 items-center justify-center rounded border border-border/60 text-muted-foreground transition-colors hover:bg-muted"
                                        aria-label="Ver detalle técnico"
                                      >
                                        <InfoIcon className="size-3.5" />
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-[360px] whitespace-pre-wrap text-xs">
                                        {formatDetalleTecnico(item.detalleTecnico)}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : null}
                                </span>
                              </TableCell>
                              <TableCell>{item.centroCostoNombre}</TableCell>
                              <TableCell className="w-[180px]">{formatOrigenProcesoLabel(item.origen, null)}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatNumber(item.totalMin)}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatNumber(item.tarifaHora)}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatNumber(item.costo)}</TableCell>
                                  </>
                                );
                              })()}
                            </TableRow>
                          ))}
                            <TableRow>
                              <TableCell colSpan={6} className="text-right font-medium">
                                Total
                              </TableCell>
                              <TableCell className="text-right font-semibold tabular-nums">
                              {formatCurrency(totalCentroCostos)}
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
                    <CardContent className="space-y-3">
                      {materialesAgrupados.map((grupo) => (
                        <Collapsible
                          key={grupo.tipo}
                          open={materialesOpen[grupo.tipo] ?? false}
                          onOpenChange={(open) =>
                            setMaterialesOpen((prev) => ({ ...prev, [grupo.tipo]: open }))
                          }
                        >
                          <div className="rounded-lg border">
                            <div className="flex items-center gap-2 px-3 py-3 transition-colors hover:bg-muted/60">
                              <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between text-left">
                                <div className="grid flex-1 gap-1 md:grid-cols-[minmax(0,1fr)_140px_140px] md:items-center">
                                  <div>
                                    <p className="font-medium">{grupo.label}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {grupo.items.length} componente{grupo.items.length === 1 ? "" : "s"}
                                    </p>
                                  </div>
                                  <div className="text-left md:text-right">
                                    <p className="text-xs text-muted-foreground">Cantidad total</p>
                                    <p className="tabular-nums">{formatNumber(grupo.totalCantidad)}</p>
                                  </div>
                                  <div className="text-left md:text-right">
                                    <p className="text-xs text-muted-foreground">Costo total</p>
                                    <p className="font-medium tabular-nums">{formatCurrency(grupo.totalCosto)}</p>
                                  </div>
                                </div>
                                <span className="ml-3 inline-flex items-center text-muted-foreground">
                                  {materialesOpen[grupo.tipo] ? (
                                    <ChevronDownIcon className="size-4" />
                                  ) : (
                                    <ChevronRightIcon className="size-4" />
                                  )}
                                </span>
                              </CollapsibleTrigger>
                              {grupo.tipo === "FILM" && filmTraceViews.length > 0 ? (
                                <button
                                  type="button"
                                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                  title="Ver cómo se calcularon los metros lineales del film"
                                  aria-label="Ver cómo se calcularon los metros lineales del film"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setFilmTraceSheetOpen(true);
                                  }}
                                >
                                  <InfoIcon className="size-4" />
                                </button>
                              ) : null}
                            </div>
                            <CollapsibleContent>
                              <div className="border-t">
                                <Table>
                                  <TableHeader className="bg-muted/50 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)]">
                                    <TableRow className="border-b border-border/70">
                                      <TableHead>Componente</TableHead>
                                      <TableHead className="w-[180px]">Origen</TableHead>
                                      <TableHead className="w-[140px] text-right">Cantidad</TableHead>
                                      <TableHead className="w-[140px] text-right">Costo unitario</TableHead>
                                      <TableHead className="w-[140px] text-right">Costo</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {grupo.items.map((item, idx) => {
                                      const nombre = String(item.nombre ?? "Componente");
                                      const canal = item.canal ? ` (${String(item.canal).toUpperCase()})` : "";
                                      const sku = item.sku ? ` · ${String(item.sku)}` : "";
                                      const cantidad = Number(item.cantidad ?? 0);
                                      const costoUnitario = Number(item.costoUnitario ?? 0);
                                      const costo = Number(item.costo ?? 0);
                                      return (
                                        <TableRow key={`${grupo.tipo}-${idx}`}>
                                          <TableCell>{`${nombre}${canal}${sku}`}</TableCell>
                                          <TableCell className="w-[180px]">
                                            {formatOrigenProcesoLabel(item.origen, null)}
                                          </TableCell>
                                          <TableCell className="text-right tabular-nums">{formatNumber(cantidad)}</TableCell>
                                          <TableCell className="text-right tabular-nums">{formatNumber(costoUnitario)}</TableCell>
                                          <TableCell className="text-right tabular-nums">{formatNumber(costo)}</TableCell>
                                        </TableRow>
                                      );
                                    })}
                                    {grupo.mermaOperativa.length ? (
                                      <>
                                        <TableRow
                                          className="cursor-pointer bg-amber-50/60 hover:bg-amber-50"
                                          onClick={() =>
                                            setMaterialesMermaOpen((prev) => ({
                                              ...prev,
                                              [grupo.tipo]: !(prev[grupo.tipo] ?? false),
                                            }))
                                          }
                                        >
                                          <TableCell>
                                            <div className="flex items-center gap-2">
                                              {materialesMermaOpen[grupo.tipo] ? (
                                                <ChevronDownIcon className="size-4 text-muted-foreground" />
                                              ) : (
                                                <ChevronRightIcon className="size-4 text-muted-foreground" />
                                              )}
                                              <span className="font-medium">Merma operativa</span>
                                            </div>
                                          </TableCell>
                                          <TableCell className="w-[180px]">Producto base</TableCell>
                                          <TableCell className="text-right tabular-nums">{formatNumber(grupo.totalMermaCantidad)}</TableCell>
                                          <TableCell className="text-right tabular-nums">-</TableCell>
                                          <TableCell className="text-right tabular-nums">{formatNumber(grupo.totalMermaCosto)}</TableCell>
                                        </TableRow>
                                        {materialesMermaOpen[grupo.tipo]
                                          ? grupo.mermaOperativa.map((item, idx) => {
                                              const nombre = String(item.nombre ?? "Componente");
                                              const canal = item.canal ? ` (${String(item.canal).toUpperCase()})` : "";
                                              const sku = item.sku ? ` · ${String(item.sku)}` : "";
                                              const cantidad = Number(item.cantidad ?? 0);
                                              const costoUnitario = Number(item.costoUnitario ?? 0);
                                              const costo = Number(item.costo ?? 0);
                                              return (
                                                <TableRow key={`${grupo.tipo}-merma-${idx}`} className="bg-muted/20">
                                                  <TableCell className="pl-10">{`${nombre}${canal}${sku}`}</TableCell>
                                                  <TableCell className="w-[180px]">Merma operativa</TableCell>
                                                  <TableCell className="text-right tabular-nums">{formatNumber(cantidad)}</TableCell>
                                                  <TableCell className="text-right tabular-nums">{formatNumber(costoUnitario)}</TableCell>
                                                  <TableCell className="text-right tabular-nums">{formatNumber(costo)}</TableCell>
                                                </TableRow>
                                              );
                                            })
                                          : null}
                                      </>
                                    ) : null}
                                  </TableBody>
                                </Table>
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      ))}

                      <div className="rounded-lg border">
                        <Table>
                          <TableBody>
                            <TableRow>
                              <TableCell colSpan={4} className="text-right font-medium">
                                Total materiales
                              </TableCell>
                              <TableCell className="text-right font-semibold tabular-nums">
                                {formatCurrency(totalMaterialesCosto)}
                              </TableCell>
                            </TableRow>
                            <TableRow className="bg-amber-100/60">
                              <TableCell colSpan={4} className="text-right font-semibold">
                                Total costo
                              </TableCell>
                              <TableCell className="text-right font-bold tabular-nums">
                                {formatCurrency(totalCostoGeneral)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : null}

              <Collapsible open={snapshotsOpen} onOpenChange={setSnapshotsOpen}>
                <div className="rounded-lg border">
                  <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted/60">
                    <span className="text-sm font-medium">Historial de Snapshots</span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      {cotizaciones.length}
                      {snapshotsOpen ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t">
                      <Table>
                        <TableHeader className="bg-muted/50 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)]">
                          <TableRow className="border-b border-border/70">
                            <TableHead>Snapshot</TableHead>
                            <TableHead>Cantidad</TableHead>
                            <TableHead>Período</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Unitario</TableHead>
                            <TableHead>Fecha</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cotizaciones.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-mono text-xs">{item.id.slice(0, 8)}</TableCell>
                              <TableCell>{item.cantidad}</TableCell>
                              <TableCell>{item.periodoTarifa}</TableCell>
                              <TableCell>{formatNumber(item.total)}</TableCell>
                              <TableCell>{formatNumber(item.unitario)}</TableCell>
                              <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Sheet open={filmTraceSheetOpen} onOpenChange={setFilmTraceSheetOpen}>
        <SheetContent
          side="right"
          className="overflow-y-auto px-4 py-6 data-[side=right]:w-[96vw] data-[side=right]:max-w-none sm:px-6 sm:data-[side=right]:w-[82vw] sm:data-[side=right]:max-w-none lg:px-8 lg:data-[side=right]:w-[44vw] lg:data-[side=right]:min-w-[720px] lg:data-[side=right]:max-w-none"
        >
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Cálculo visual del film</SheetTitle>
            <SheetDescription>
              Muestra cómo el sistema armó los metros lineales del laminado usando pliegos, separación entre pliegos y mermas de arranque/cierre.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {filmTraceViews.map((trace) => {
              const total = trace.largoConsumidoMm;
              const startPct = total > 0 ? (trace.mermaArranqueMm / total) * 100 : 0;
              const endPct = total > 0 ? (trace.mermaCierreMm / total) * 100 : 0;
              const totalPliegos = Math.max(1, trace.pliegosTotales || trace.hojasTotales || 1);
              const modeLabel =
                trace.modoLaminado === "dos_caras_simultaneo"
                  ? "Ambas caras en una pasada"
                  : trace.modoLaminado === "dos_caras_dos_pasadas"
                    ? "Ambas caras en dos pasadas"
                    : "Una cara";
              const orientacionLabel =
                trace.orientacionEntrada === "rotada"
                  ? "Se ingresó rotado para usar menos largo"
                  : "Se ingresó en orientación normal";
              const clipId = `film-tramo-util-${trace.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
              const maxExplicitPliegos = 10;
              const headCount = totalPliegos > maxExplicitPliegos ? 5 : totalPliegos;
              const tailCount = totalPliegos > maxExplicitPliegos ? 5 : 0;
              const omittedPliegos = Math.max(0, totalPliegos - headCount - tailCount);
              const trackTop = 20;
              const trackLeft = 80;
              const trackWidth = 120;
              const bodyContentPadding = 16;
              const minSheetHeight = totalPliegos <= maxExplicitPliegos ? 12 : 28;
              const minGapHeight = trace.gapEntreHojasMm > 0 ? (totalPliegos <= maxExplicitPliegos ? 2 : 8) : 0;
              const explicitCount = headCount + tailCount;
              const explicitGapCount = Math.max(0, explicitCount - 1 + (omittedPliegos > 0 ? 2 : 0));
              const requiredBodyContentHeight =
                explicitCount * minSheetHeight +
                explicitGapCount * minGapHeight +
                (omittedPliegos > 0 ? 44 : 0);
              const baseTrackHeight = 700;
              const baseStartHeight = Math.max(10, (startPct / 100) * baseTrackHeight);
              const baseEndHeight = Math.max(10, (endPct / 100) * baseTrackHeight);
              const baseBodyHeight = Math.max(180, baseTrackHeight - baseStartHeight - baseEndHeight);
              const baseBodyContentHeight = Math.max(120, baseBodyHeight - bodyContentPadding * 2);
              const trackHeight =
                totalPliegos <= maxExplicitPliegos && baseBodyContentHeight < requiredBodyContentHeight
                  ? baseTrackHeight + (requiredBodyContentHeight - baseBodyContentHeight) + 12
                  : baseTrackHeight;
              const viewBoxHeight = trackTop + trackHeight + 60;
              const svgHeightClass = "h-[560px]";
              const startHeight = Math.max(10, (startPct / 100) * trackHeight);
              const endHeight = Math.max(10, (endPct / 100) * trackHeight);
              const bodyTop = trackTop + startHeight;
              const bodyHeight = Math.max(180, trackHeight - startHeight - endHeight);
              const bodyContentTop = bodyTop + bodyContentPadding;
              const bodyContentHeight = Math.max(requiredBodyContentHeight, bodyHeight - bodyContentPadding * 2);
              const explicitBlocksMm =
                (headCount + tailCount) * trace.altoHojaMm +
                Math.max(0, headCount + tailCount - 1) * trace.gapEntreHojasMm;
              const omittedBlockMm =
                omittedPliegos > 0
                  ? omittedPliegos * trace.altoHojaMm + Math.max(0, omittedPliegos - 1) * trace.gapEntreHojasMm
                  : 0;
              const totalDisplayedBodyMm = Math.max(1, explicitBlocksMm + omittedBlockMm);
              const pxPerBodyMm = bodyContentHeight / totalDisplayedBodyMm;
              const explicitSheetHeight = Math.max(minSheetHeight, trace.altoHojaMm * pxPerBodyMm);
              const explicitGapHeight =
                trace.gapEntreHojasMm > 0 ? Math.max(minGapHeight, trace.gapEntreHojasMm * pxPerBodyMm) : 0;
              const omittedHeight =
                omittedPliegos > 0
                  ? Math.max(
                      44,
                      bodyContentHeight -
                        (headCount + tailCount) * explicitSheetHeight -
                        Math.max(0, headCount + tailCount - 1) * explicitGapHeight,
                    )
                  : 0;
              const blockEntries: Array<
                | { kind: "pliego"; label: string; y: number; height: number }
                | { kind: "resumen"; label: string; y: number; height: number }
                | { kind: "gap"; y: number; height: number }
              > = [];
              let cursor = bodyContentTop;
              const pushPliego = (label: string) => {
                blockEntries.push({ kind: "pliego", label, y: cursor, height: explicitSheetHeight });
                cursor += explicitSheetHeight;
              };
              const pushGap = () => {
                if (explicitGapHeight > 0) {
                  blockEntries.push({ kind: "gap", y: cursor, height: explicitGapHeight });
                  cursor += explicitGapHeight;
                }
              };

              for (let index = 0; index < headCount; index += 1) {
                pushPliego(`P${index + 1}`);
                if (index < headCount - 1 || omittedPliegos > 0 || tailCount > 0) {
                  pushGap();
                }
              }

              if (omittedPliegos > 0) {
                blockEntries.push({
                  kind: "resumen",
                  label: `+ ${omittedPliegos} pliegos`,
                  y: cursor,
                  height: omittedHeight,
                });
                cursor += omittedHeight;
                if (tailCount > 0) {
                  pushGap();
                }
              }

              for (let index = 0; index < tailCount; index += 1) {
                pushPliego(`P${totalPliegos - tailCount + index + 1}`);
                if (index < tailCount - 1) {
                  pushGap();
                }
              }

              return (
                <Card key={trace.key}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {trace.codigo} · {trace.nombre}
                    </CardTitle>
                    <CardDescription>
                      {modeLabel}. {totalPliegos} pliego{totalPliegos === 1 ? "" : "s"} · {formatNumber(trace.largoConsumidoMm / 1000)} m lineales · {trace.filmFactor} film
                      {trace.filmFactor === 1 ? "" : "s"}.
                    </CardDescription>
                    <p className="text-sm text-muted-foreground">{orientacionLabel}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
                      <div className="rounded-xl border bg-muted/20 p-4">
                        <div className="mb-3 flex items-start justify-between gap-4">
                          <div className="grid shrink-0 gap-1.5 text-[11px] text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-3 w-6 rounded-sm bg-[#f4d7c8]" />
                              <span>Merma</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-0 w-6 border-t-[1.5px] border-dashed border-red-600" />
                              <span>Gap entre pliegos</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-3 w-6 rounded-sm border border-[#dcc6b0] bg-[#fcf7f0]" />
                              <span>Tramo útil</span>
                            </div>
                          </div>
                        </div>
                        <svg viewBox={`0 0 280 ${viewBoxHeight}`} className={cn("mx-auto w-full max-w-[260px]", svgHeightClass)}>
                          <defs>
                            <clipPath id={clipId}>
                              <rect x="96" y={bodyContentTop} width="88" height={bodyContentHeight} rx="10" />
                            </clipPath>
                          </defs>
                          <rect x={trackLeft} y={trackTop} width={trackWidth} height={trackHeight} rx="26" fill="#f5efe8" stroke="#d6c4b2" />
                          <rect x={trackLeft} y={trackTop} width={trackWidth} height={startHeight} fill="#f4d7c8" />
                          <rect
                            x={trackLeft}
                            y={trackTop + trackHeight - endHeight}
                            width={trackWidth}
                            height={endHeight}
                            fill="#f4d7c8"
                          />
                          <rect
                            x="96"
                            y={bodyContentTop}
                            width="88"
                            height={bodyContentHeight}
                            rx="10"
                            fill="#fcf7f0"
                            stroke="#dcc6b0"
                            strokeDasharray="4 3"
                          />
                          <line
                            x1={trackLeft}
                            y1={bodyTop}
                            x2={trackLeft + trackWidth}
                            y2={bodyTop}
                            stroke="#c89e7b"
                            strokeWidth="2"
                          />
                          <line
                            x1={trackLeft}
                            y1={bodyTop + bodyHeight}
                            x2={trackLeft + trackWidth}
                            y2={bodyTop + bodyHeight}
                            stroke="#c89e7b"
                            strokeWidth="2"
                          />
                          <g clipPath={`url(#${clipId})`}>
                            {blockEntries.map((block, index) => (
                              <React.Fragment key={`${block.kind}-${index}-${"label" in block ? block.label : ""}`}>
                              {block.kind === "pliego" ? (
                                <>
                                  <rect
                                    x="96"
                                    y={block.y}
                                    width="88"
                                    height={block.height}
                                    fill="#fef8ee"
                                    stroke="#c9aa8a"
                                  />
                                  <text
                                    x="140"
                                    y={block.y + block.height / 2 + 5}
                                    textAnchor="middle"
                                    fontSize="14"
                                    fill="#6d4a2d"
                                  >
                                    {block.label}
                                  </text>
                                </>
                              ) : null}
                              {block.kind === "resumen" ? (
                                <>
                                  <rect
                                    x="101"
                                    y={block.y}
                                    width="78"
                                    height={block.height}
                                    rx="12"
                                    fill="#f1e0cf"
                                    stroke="#d0b49a"
                                    strokeDasharray="6 4"
                                  />
                                  <text
                                    x="140"
                                    y={block.y + block.height / 2 - 4}
                                    textAnchor="middle"
                                    fontSize="14"
                                    fill="#7b4b2a"
                                  >
                                    ...
                                  </text>
                                  <text
                                    x="140"
                                    y={block.y + block.height / 2 + 14}
                                    textAnchor="middle"
                                    fontSize="12"
                                    fill="#7b4b2a"
                                  >
                                    {block.label}
                                  </text>
                                </>
                              ) : null}
                              {block.kind === "gap" ? (
                                <>
                                  <rect
                                    x="110"
                                    y={block.y}
                                    width="60"
                                    height={block.height}
                                    fill="#f97316"
                                    opacity="0.2"
                                  />
                                  <line
                                    x1="108"
                                    y1={block.y + block.height / 2}
                                    x2="172"
                                    y2={block.y + block.height / 2}
                                    stroke="#dc2626"
                                    strokeWidth="1.5"
                                    strokeDasharray="3 2"
                                  />
                                </>
                              ) : null}
                              </React.Fragment>
                            ))}
                          </g>
                          <line x1="210" y1={bodyTop} x2="210" y2={bodyTop + bodyHeight} stroke="#b4977b" strokeDasharray="4 4" />
                        </svg>
                      </div>
                      <div className="flex min-w-0 flex-col gap-2">
                        <div className="rounded-lg border px-4 py-3">
                          <p className="text-xs text-muted-foreground">Pliegos calculados</p>
                          <p className="font-medium">{formatNumber(totalPliegos)}</p>
                        </div>
                        <div className="rounded-lg border px-4 py-3">
                          <p className="text-xs text-muted-foreground">Ancho del rollo</p>
                          <p className="font-medium">{formatNumber(trace.anchoRolloMm)} mm</p>
                        </div>
                        <div className="rounded-lg border px-4 py-3">
                          <p className="text-xs text-muted-foreground">Pliego impreso</p>
                          <p className="font-medium">
                            {formatNumber(trace.pliegoOriginalAnchoMm)} × {formatNumber(trace.pliegoOriginalAltoMm)} mm
                          </p>
                        </div>
                        <div className="rounded-lg border px-4 py-3">
                          <p className="text-xs text-muted-foreground">Entrada en laminadora</p>
                          <p className="font-medium">
                            {formatNumber(trace.anchoHojaMm)} × {formatNumber(trace.altoHojaMm)} mm
                          </p>
                        </div>
                        <div className="rounded-lg border px-4 py-3">
                          <p className="text-xs text-muted-foreground">Separación entre pliegos</p>
                          <p className="font-medium">{formatNumber(trace.gapEntreHojasMm)} mm</p>
                        </div>
                        <div className="rounded-lg border px-4 py-3">
                          <p className="text-xs text-muted-foreground">Paso lineal por pliego</p>
                          <p className="font-medium">{formatNumber(trace.pasoLinealMm)} mm</p>
                        </div>
                        <div className="rounded-lg border px-4 py-3">
                          <p className="text-xs text-muted-foreground">Velocidad usada</p>
                          <p className="font-medium">{formatNumber(trace.velocidadMmSegEfectiva)} mm/seg</p>
                        </div>
                        <div className="rounded-lg border px-4 py-3">
                          <p className="text-xs text-muted-foreground">Merma de arranque</p>
                          <p className="font-medium">{formatNumber(trace.mermaArranqueMm)} mm</p>
                        </div>
                        <div className="rounded-lg border px-4 py-3">
                          <p className="text-xs text-muted-foreground">Merma de cierre</p>
                          <p className="font-medium">{formatNumber(trace.mermaCierreMm)} mm</p>
                        </div>
                        <div className="rounded-lg border px-4 py-3">
                          <p className="text-xs text-muted-foreground">Largo total calculado</p>
                          <p className="font-medium">{formatNumber(trace.largoConsumidoMm / 1000)} m</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

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
              <Input value={precioEditorDraft.measurementUnit?.trim() || productoState.unidadComercial || "unidad"} disabled />
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
                  Cantidades fijas con precio fijo: sólo se podrán vender las cantidades definidas en esta tabla.
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="min-w-[120px]">Cantidad</TableHead>
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
                  Cantidades fijas con margen variable: sólo se podrán vender las cantidades definidas en esta tabla y cada cantidad usa su propio margen.
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="min-w-[120px]">Cantidad</TableHead>
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
                  Rangos de precio con precio fijo: cada tramo define hasta qué cantidad aplica ese precio.
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="min-w-[110px]">Rango</TableHead>
                        <TableHead className="min-w-[130px]">Hasta cantidad</TableHead>
                        <TableHead className="min-w-[130px]">Precio</TableHead>
                        <TableHead className="w-[90px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {precioEditorDraft.detalle.tiers.map((tier, index) => (
                        <TableRow key={`precio-rango-${index}`}>
                          <TableCell className="text-sm text-muted-foreground">
                            {getVariableRangeLabel(index, tier.quantityUntil)}
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
                  Cantidad libre por margen variable: cada tramo define hasta qué cantidad aplica ese margen.
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="min-w-[110px]">Rango</TableHead>
                        <TableHead className="min-w-[130px]">Hasta cantidad</TableHead>
                        <TableHead className="min-w-[130px]">Margen (%)</TableHead>
                        <TableHead className="w-[90px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {precioEditorDraft.detalle.tiers.map((tier, index) => (
                        <TableRow key={`margen-rango-${index}`}>
                          <TableCell className="text-sm text-muted-foreground">
                            {getVariableRangeLabel(index, tier.quantityUntil)}
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
                {isSavingPrecio ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
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
                <Input value={precioEspecialClienteEditorDraft.measurementUnit?.trim() || productoState.unidadComercial || "unidad"} disabled />
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
                        <TableHead>Cantidad</TableHead>
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
                        <TableHead>Cantidad</TableHead>
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
                        <TableHead>Hasta cantidad</TableHead>
                        <TableHead>Precio</TableHead>
                        <TableHead className="w-[90px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(precioEspecialClienteEditorDraft.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>["detalle"]).tiers.map((tier, index) => (
                        <TableRow key={`especial-rango-precio-${index}`}>
                          <TableCell className="text-sm text-muted-foreground">{getVariableRangeLabel(index, tier.quantityUntil)}</TableCell>
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
                        <TableHead>Hasta cantidad</TableHead>
                        <TableHead>Margen (%)</TableHead>
                        <TableHead className="w-[90px] text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(precioEspecialClienteEditorDraft.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>["detalle"]).tiers.map((tier, index) => (
                        <TableRow key={`especial-rango-margen-${index}`}>
                          <TableCell className="text-sm text-muted-foreground">{getVariableRangeLabel(index, tier.quantityUntil)}</TableCell>
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
                {isSavingPrecioEspecialClientes ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
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
                {isSavingImpuestosCatalogo ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : null}
                Aplicar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={routeEditorOpen} onOpenChange={setRouteEditorOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto px-6 sm:max-w-6xl sm:px-8">
          <SheetHeader>
            <SheetTitle>Crear ruta desde pasos</SheetTitle>
            <SheetDescription>
              Configura pasos, orden y productividad de la ruta.
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <Field>
              <FieldLabel>Código</FieldLabel>
              <Input value={routeEditorCodigo} onChange={(e) => setRouteEditorCodigo(e.target.value)} placeholder="Opcional" />
            </Field>
            <Field>
              <FieldLabel>Nombre</FieldLabel>
              <Input value={routeEditorNombre} onChange={(e) => setRouteEditorNombre(e.target.value)} placeholder="Ej: Impresión digital + corte" />
            </Field>
          </div>

          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <Switch
              checked={routeEditorGuardarEnRutas}
              onCheckedChange={(checked) => setRouteEditorGuardarEnRutas(Boolean(checked))}
            />
            <span className="text-sm">Guardar también en el módulo Rutas de producción</span>
          </div>

          <div className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_auto]">
            <Field>
              <FieldLabel>Agregar paso desde biblioteca</FieldLabel>
              <Select value={routeEditorTemplateId} onValueChange={(value) => setRouteEditorTemplateId(value ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona plantilla de paso" />
                </SelectTrigger>
                <SelectContent>
                  {routeEditorPlantillas.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nombre} · {item.tipoOperacion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button type="button" className="self-end" onClick={handleAddPlantillaStep}>
              <PlusIcon data-icon="inline-start" />
              Agregar paso
            </Button>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[44px]"></TableHead>
                  <TableHead>Paso</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead className="w-[130px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routeEditorOperaciones.map((op, index) => (
                  <TableRow
                    key={op.id}
                    draggable
                    onDragStart={() => setDraggingOpIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggingOpIndex == null) return;
                      moveOperation(draggingOpIndex, index);
                      setDraggingOpIndex(null);
                    }}
                  >
                    <TableCell className="text-muted-foreground"><GripVerticalIcon className="size-4" /></TableCell>
                    <TableCell>
                      <Input
                        value={op.nombre}
                        onChange={(e) =>
                          setRouteEditorOperaciones((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, nombre: e.target.value } : item)),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={op.tipoOperacion}
                        onValueChange={(value) =>
                          setRouteEditorOperaciones((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, tipoOperacion: value as ProcesoOperacionPayload["tipoOperacion"] } : item)),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {tipoOperacionProcesoItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={op.modoProductividad ?? "variable"}
                        onValueChange={(value) =>
                          setRouteEditorOperaciones((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, modoProductividad: value as ProcesoOperacionPayload["modoProductividad"] } : item)),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {modoProductividadProcesoItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={String(
                          op.modoProductividad === "fija"
                            ? (op.tiempoFijoMin ?? 0)
                            : (op.productividadBase ?? 0),
                        )}
                        onChange={(e) => {
                          const value = Number(e.target.value || 0);
                          setRouteEditorOperaciones((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? item.modoProductividad === "fija"
                                  ? { ...item, tiempoFijoMin: value }
                                  : { ...item, productividadBase: value }
                                : item,
                            ),
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={(op.modoProductividad === "fija" ? "minuto" : op.unidadSalida ?? "copia") as string}
                        onValueChange={(value) =>
                          setRouteEditorOperaciones((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? item.modoProductividad === "fija"
                                  ? { ...item, unidadTiempo: "minuto", unidadEntrada: "minuto", unidadSalida: "unidad" }
                                  : { ...item, unidadSalida: value as UnidadProceso, unidadTiempo: "minuto" }
                                : item,
                            ),
                          )
                        }
                        disabled={op.modoProductividad === "fija"}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {unidadProcesoItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button type="button" size="icon" variant="ghost" onClick={() => moveOperation(index, index - 1)}>
                          <ArrowUpIcon className="size-4" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" onClick={() => moveOperation(index, index + 1)}>
                          <ArrowDownIcon className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          onClick={() =>
                            setRouteEditorOperaciones((prev) => prev.filter((_, i) => i !== index))
                          }
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {routeEditorOperaciones.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                      Sin pasos. Agrega pasos desde la biblioteca.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRouteEditorOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSaveRouteEditor} disabled={isSavingRouteEditor}>
              {isSavingRouteEditor ? <Loader2Icon className="animate-spin" data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
              Guardar ruta
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={Boolean(confirmAction)} onOpenChange={(open) => (!open ? setConfirmAction(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "delete" ? "Eliminar variante" : confirmAction?.nextActive ? "Activar variante" : "Desactivar variante"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "delete"
                ? `Vas a eliminar la variante "${confirmAction.variante.nombre}". Esta acción no se puede deshacer.`
                : confirmAction?.nextActive
                  ? `Vas a activar la variante "${confirmAction?.variante.nombre}".`
                  : `Vas a desactivar la variante "${confirmAction?.variante.nombre}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmVarianteAction}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
