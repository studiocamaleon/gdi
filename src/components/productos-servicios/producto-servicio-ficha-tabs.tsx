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
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

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
  getCotizacionesProductoVariante,
  getProductoMotorConfig,
  getVarianteMotorOverride,
  previewImposicionProductoVariante,
  updateProductoRutaPolicy,
  upsertVarianteMotorOverride,
  updateProductoServicio,
  updateProductoVariante,
  updateVarianteOpcionesProductivas,
} from "@/lib/productos-servicios-api";
import type {
  DimensionOpcionProductiva,
  FamiliaProducto,
  MotorCostoCatalogItem,
  PliegoImpresionCatalogItem,
  CotizacionProductoSnapshotResumen,
  CotizacionProductoVariante,
  ProductoChecklist,
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
  if (raw === "DESGASTE") return "Desgaste";
  if (raw === "CONSUMIBLE_FILM") return "Consumibles de terminación";
  if (raw === "ADDITIONAL_MATERIAL_EFFECT") return "Material adicional";
  return raw || "-";
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
  procesos,
  plantillasPaso,
  materiasPrimas,
  familias,
  subfamilias,
  motores,
  checklist,
  maquinas,
}: ProductoServicioFichaTabsProps) {
  const [productoState, setProductoState] = React.useState(producto);
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
  const [isSavingGeneral, startSavingGeneral] = React.useTransition();

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
    setProductoState(producto);
    setProductoChecklist(checklist);
    setCotizacionChecklistRespuestas({});
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
  }, [producto, checklist]);

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
      setCotizaciones([]);
      return;
    }

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
      .then(setCotizaciones)
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
    const orientacion =
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
        setProductoState(withMotor);
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
  const totalCentroCostos = procesosCotizados.reduce((acc, item) => {
    const costo = Number(item.costo ?? 0);
    return Number.isFinite(costo) ? acc + costo : acc;
  }, 0);
  const totalMaterialesCosto = materialesCotizados.reduce((acc, item) => {
    const costo = Number(item.costo ?? 0);
    return Number.isFinite(costo) ? acc + costo : acc;
  }, 0);
  const totalCostoGeneral = totalCentroCostos + totalMaterialesCosto;
  const isGeneralDirty =
    generalForm.nombre.trim() !== (productoState.nombre ?? "").trim() ||
    generalForm.descripcion.trim() !== (productoState.descripcion ?? "").trim() ||
    generalForm.familiaProductoId !== productoState.familiaProductoId ||
    (generalForm.subfamiliaProductoId || "") !== (productoState.subfamiliaProductoId || "") ||
    generalForm.motorCodigo !== productoState.motorCodigo ||
    generalForm.motorVersion !== productoState.motorVersion;

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
          <TabsTrigger value="cotizador" className="cursor-pointer rounded-md px-4 py-2.5 text-sm font-medium transition-transform duration-150 hover:scale-[1.02] data-active:scale-100 data-active:bg-orange-600 data-active:text-white data-active:font-bold data-active:hover:bg-orange-600 data-active:hover:text-white">Simulador pricing</TabsTrigger>
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

        <TabsContent value="cotizador">
          <Card>
            <CardHeader>
              <CardTitle>Cotizador</CardTitle>
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
                        return (
                          <Field key={`base-select-${dimension}`}>
                            <FieldLabel>{dimensionBaseLabelByValue[dimension]}</FieldLabel>
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
                            <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between px-3 py-3 text-left transition-colors hover:bg-muted/60">
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
    </div>
  );
}
