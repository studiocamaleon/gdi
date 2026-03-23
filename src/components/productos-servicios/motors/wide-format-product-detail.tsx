"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { GdiSpinner } from "@/components/brand/gdi-spinner";
import type { DigitalProductDetailProps } from "@/components/productos-servicios/motors/digital-product-detail";
import { ProductoServicioChecklistEditor } from "@/components/productos-servicios/producto-servicio-checklist";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  getGranFormatoConfig,
  getGranFormatoChecklist,
  getGranFormatoRutaBase,
  updateGranFormatoConfig,
  updateGranFormatoChecklist,
  updateGranFormatoRutaBase,
  updateProductoServicio,
} from "@/lib/productos-servicios-api";
import {
  type GranFormatoImposicionConfig,
  type GranFormatoImposicionCriterioOptimizacion,
  type ProductoChecklist,
  type ProductoChecklistPayload,
  estadoProductoServicioItems,
  tipoProductoServicioItems,
  type TipoVentaGranFormato,
} from "@/lib/productos-servicios";

const wideFormatTabs = [
  { value: "general", label: "General" },
  { value: "tecnologias", label: "Tecnologías" },
  { value: "produccion", label: "Ruta base" },
  { value: "checklist", label: "Ruta de opcionales" },
  { value: "imposicion", label: "Imposición" },
  { value: "cotizador", label: "Costos" },
  { value: "precio", label: "Precio" },
  { value: "simulacion-comercial", label: "Simulación comercial" },
] as const;

const tipoVentaItems: Array<{ value: TipoVentaGranFormato; label: string }> = [
  { value: "m2", label: "Metro cuadrado" },
  { value: "metro_lineal", label: "Metro lineal" },
];
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
  { value: "menor_desperdicio", label: "Menor desperdicio" },
  { value: "menor_largo_consumido", label: "Menor largo consumido" },
];

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
  criterioOptimizacion: "menor_desperdicio",
};

function createGranFormatoImposicionMedida() {
  return {
    anchoMm: null,
    altoMm: null,
    cantidad: 1,
  };
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
  centerXMm: number;
  centerYMm: number;
  label: string;
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
  rotated: boolean;
  piecesPerRow: number;
  rows: number;
  consumedLengthMm: number;
  usefulAreaM2: number;
  consumedAreaM2: number;
  wasteAreaM2: number;
  wastePct: number;
  placements: GranFormatoImposicionPlacement[];
};

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
  });
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

function readMachinePrintableWidthMm(maquina: Maquina | null) {
  if (!maquina) {
    return null;
  }
  const direct = readNumericValue(maquina.parametrosTecnicos?.anchoImprimibleMaximo);
  if (direct != null) {
    return direct * 10;
  }
  const uvBridgeWidth = readNumericValue(maquina.parametrosTecnicos?.anchoBoca);
  if (uvBridgeWidth != null) {
    return uvBridgeWidth * 10;
  }
  const bedWidth = readNumericValue(maquina.parametrosTecnicos?.anchoCama);
  if (bedWidth != null) {
    return bedWidth * 10;
  }
  const fallback = readNumericValue(maquina.anchoUtil);
  return fallback == null ? null : fallback * 10;
}

function readMaterialVariantWidthMm(attributes: Record<string, unknown> | null | undefined) {
  const meters = readNumericValue(attributes?.ancho);
  return meters == null ? null : meters * 1000;
}

function formatMmAsCm(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "";
  }
  return String(Number((value / 10).toFixed(2)));
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

function PlaceholderTab({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
          Esta sección queda abierta para definir la lógica específica del motor de gran formato.
        </div>
      </CardContent>
    </Card>
  );
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
}: DigitalProductDetailProps) {
  const [activeTab, setActiveTab] = React.useState("general");
  const [productoState, setProductoState] = React.useState(producto);
  const [isSavingGeneral, startSavingGeneral] = React.useTransition();
  const [isSavingConfig, startSavingConfig] = React.useTransition();
  const [isLoadingConfig, setIsLoadingConfig] = React.useState(true);
  const [generalForm, setGeneralForm] = React.useState({
    nombre: producto.nombre,
    descripcion: producto.descripcion ?? "",
    familiaProductoId: producto.familiaProductoId,
    subfamiliaProductoId: producto.subfamiliaProductoId ?? "",
    motorCodigo: producto.motorCodigo,
    motorVersion: producto.motorVersion,
  });
  const [tipoVenta, setTipoVenta] = React.useState<TipoVentaGranFormato>("m2");
  const [savedTipoVenta, setSavedTipoVenta] = React.useState<TipoVentaGranFormato>("m2");
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
  const [savedImposicionSnapshot, setSavedImposicionSnapshot] = React.useState(
    normalizeImposicionSnapshot(defaultGranFormatoImposicionConfig),
  );
  const [showImposicionOverrides, setShowImposicionOverrides] = React.useState(false);
  const [isImposicion3dOpen, setIsImposicion3dOpen] = React.useState(false);
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

  const loadGranFormatoConfig = React.useCallback(async () => {
    setIsLoadingConfig(true);
    try {
      const config = await getGranFormatoConfig(productoState.id);
      setTipoVenta(config.tipoVenta);
      setSavedTipoVenta(config.tipoVenta);
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
  const tipoVentaLabel = React.useMemo(
    () => tipoVentaItems.find((item) => item.value === tipoVenta)?.label ?? "Seleccionar tipo de venta",
    [tipoVenta],
  );
  const materialBaseLabel = React.useMemo(
    () => availableBaseMaterials.find((item) => item.id === materialBaseId)?.nombre ?? "Seleccionar material base",
    [availableBaseMaterials, materialBaseId],
  );

  const availableMaterialVariants = React.useMemo(
    () => (selectedBaseMaterial?.variantes ?? []).filter((variant) => variant.activo),
    [selectedBaseMaterial],
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
  const imposicionPreviewResult = React.useMemo<{
    items: GranFormatoImposicionPreviewItem[];
    rejected: Array<{
      variant: (typeof imposicionMaterialVariants)[number];
      reason: string;
    }>;
    machineIssue: string | null;
  }>(() => {
    const medidas = imposicionConfig.medidas.filter((item) => (item.anchoMm ?? 0) > 0 && (item.altoMm ?? 0) > 0);
    if (!imposicionMachine || medidas.length === 0) {
      return {
        items: [] as GranFormatoImposicionPreviewItem[],
        rejected: [] as Array<{
          variant: (typeof imposicionMaterialVariants)[number];
          reason: string;
        }>,
        machineIssue:
          !imposicionMachine
            ? "Seleccioná una máquina compatible para evaluar la imposición."
            : "Completá al menos una medida válida para simular la imposición.",
      };
    }

    const printableWidthMmMax = readMachinePrintableWidthMm(imposicionMachine);
    if (!printableWidthMmMax || printableWidthMmMax <= 0) {
      return {
        items: [] as GranFormatoImposicionPreviewItem[],
        rejected: imposicionMaterialVariants.map((variant) => ({
          variant,
          reason: "La máquina no tiene ancho máximo imprimible configurado.",
        })),
        machineIssue: "La máquina seleccionada no tiene ancho máximo imprimible válido.",
      };
    }

    const marginLeftMm =
      imposicionConfig.margenLateralIzquierdoMmOverride ??
      readMachineMarginMm(imposicionMachine, "margenLateralIzquierdoNoImprimible") ??
      readMachineMarginMm(imposicionMachine, "margenIzquierdo") ??
      0;
    const marginRightMm =
      imposicionConfig.margenLateralDerechoMmOverride ??
      readMachineMarginMm(imposicionMachine, "margenLateralDerechoNoImprimible") ??
      readMachineMarginMm(imposicionMachine, "margenDerecho") ??
      0;
    const marginStartMm =
      imposicionConfig.margenInicioMmOverride ??
      readMachineMarginMm(imposicionMachine, "margenInicioNoImprimible") ??
      readMachineMarginMm(imposicionMachine, "margenSuperior") ??
      0;
    const marginEndMm =
      imposicionConfig.margenFinalMmOverride ??
      readMachineMarginMm(imposicionMachine, "margenFinalNoImprimible") ??
      readMachineMarginMm(imposicionMachine, "margenInferior") ??
      0;

    const accepted: GranFormatoImposicionPreviewItem[] = [];
    const rejected: Array<{
      variant: (typeof imposicionMaterialVariants)[number];
      reason: string;
    }> = [];

    for (const variant of imposicionMaterialVariants) {
        const rollWidthMm = readMaterialVariantWidthMm(variant.atributosVariante);
        if (!rollWidthMm || rollWidthMm <= 0) {
          rejected.push({
            variant,
            reason: "La variante no tiene un ancho de rollo técnico válido.",
          });
          continue;
        }

        const machineLimitedWidthMm = Math.min(rollWidthMm, printableWidthMmMax);
        const printableWidthMm = machineLimitedWidthMm - marginLeftMm - marginRightMm;
        if (printableWidthMm <= 0) {
          rejected.push({
            variant,
            reason: "Los márgenes no imprimibles consumen todo el ancho disponible.",
          });
          continue;
        }

        const evaluateOrientation = (rotated: boolean) => {
          const pieces = medidas
            .flatMap((medida) =>
              Array.from({ length: Math.max(1, medida.cantidad) }, () => ({
                width: rotated ? (medida.altoMm ?? 0) : (medida.anchoMm ?? 0),
                height: rotated ? (medida.anchoMm ?? 0) : (medida.altoMm ?? 0),
                area: ((medida.anchoMm ?? 0) * (medida.altoMm ?? 0)) / 1_000_000,
              })),
            )
            .sort((a, b) => b.height - a.height || b.width - a.width);

          let currentRowWidth = 0;
          let currentRowHeight = 0;
          let totalHeight = 0;
          let rowCount = 0;
          let maxPiecesPerRow = 0;
          let currentPieces = 0;
          let currentRowTop = marginStartMm;
          const placements: Array<{
            id: string;
            widthMm: number;
            heightMm: number;
            centerXMm: number;
            centerYMm: number;
            label: string;
          }> = [];

          for (const [pieceIndex, piece] of pieces.entries()) {
            if (piece.width > printableWidthMm) {
              return null;
            }
            const additionalWidth = currentRowWidth === 0 ? piece.width : currentRowWidth + imposicionConfig.separacionHorizontalMm + piece.width;
            if (additionalWidth <= printableWidthMm) {
              const pieceLeft = currentRowWidth === 0 ? marginLeftMm : marginLeftMm + currentRowWidth + imposicionConfig.separacionHorizontalMm;
              currentRowWidth = additionalWidth;
              currentRowHeight = Math.max(currentRowHeight, piece.height);
              currentPieces += 1;
              maxPiecesPerRow = Math.max(maxPiecesPerRow, currentPieces);
              placements.push({
                id: `piece-${pieceIndex}`,
                widthMm: piece.width,
                heightMm: piece.height,
                centerXMm: pieceLeft + piece.width / 2,
                centerYMm: currentRowTop + piece.height / 2,
                label: `${Math.round(piece.width / 10)}x${Math.round(piece.height / 10)} cm`,
              });
              continue;
            }

            totalHeight += currentRowHeight;
            if (rowCount > 0 || totalHeight > 0) {
              totalHeight += imposicionConfig.separacionVerticalMm;
            }
            rowCount += 1;
            currentRowTop = marginStartMm + totalHeight;
            currentRowWidth = piece.width;
            currentRowHeight = piece.height;
            currentPieces = 1;
            maxPiecesPerRow = Math.max(maxPiecesPerRow, currentPieces);
            placements.push({
              id: `piece-${pieceIndex}`,
              widthMm: piece.width,
              heightMm: piece.height,
              centerXMm: marginLeftMm + piece.width / 2,
              centerYMm: currentRowTop + piece.height / 2,
              label: `${Math.round(piece.width / 10)}x${Math.round(piece.height / 10)} cm`,
            });
          }

          if (currentRowHeight > 0) {
            totalHeight += currentRowHeight;
            rowCount += 1;
          }

          const consumedLengthMm = marginStartMm + marginEndMm + totalHeight;
          const usefulAreaM2 = medidas.reduce(
            (acc, item) => acc + (((item.anchoMm ?? 0) * (item.altoMm ?? 0)) / 1_000_000) * item.cantidad,
            0,
          );
          const consumedAreaM2 = (rollWidthMm * consumedLengthMm) / 1_000_000;
          const wasteAreaM2 = Math.max(0, consumedAreaM2 - usefulAreaM2);
          return {
            rotated,
            piecesPerRow: maxPiecesPerRow,
            rows: rowCount,
            consumedLengthMm,
            usefulAreaM2,
            consumedAreaM2,
            wasteAreaM2,
            wastePct: consumedAreaM2 > 0 ? (wasteAreaM2 / consumedAreaM2) * 100 : 0,
            placements,
          };
        };

        const candidates = [
          evaluateOrientation(false),
          imposicionConfig.permitirRotacion ? evaluateOrientation(true) : null,
        ].filter(Boolean) as Array<NonNullable<ReturnType<typeof evaluateOrientation>>>;

        if (candidates.length === 0) {
          rejected.push({
            variant,
            reason: "La pieza no entra en este ancho de rollo con la configuración actual.",
          });
          continue;
        }

        const best = [...candidates].sort((a, b) => {
          if (imposicionConfig.criterioOptimizacion === "menor_largo_consumido") {
            return a.consumedLengthMm - b.consumedLengthMm || a.wasteAreaM2 - b.wasteAreaM2;
          }
          return a.wasteAreaM2 - b.wasteAreaM2 || a.consumedLengthMm - b.consumedLengthMm;
        })[0];

        accepted.push({
          variant,
          rollWidthMm,
          machineLimitedWidthMm,
          printableWidthMm,
          marginLeftMm,
          marginRightMm,
          marginStartMm,
          marginEndMm,
          ...best,
        });
      }

    return {
      items: accepted.sort((a, b) => {
        const left = a as NonNullable<(typeof a)>;
        const right = b as NonNullable<(typeof b)>;
        if (imposicionConfig.criterioOptimizacion === "menor_largo_consumido") {
          return left.consumedLengthMm - right.consumedLengthMm || left.wasteAreaM2 - right.wasteAreaM2;
        }
        return left.wasteAreaM2 - right.wasteAreaM2 || left.consumedLengthMm - right.consumedLengthMm;
      }),
      rejected,
      machineIssue: null as string | null,
    };
  }, [imposicionConfig, imposicionMachine, imposicionMaterialVariants]);
  const imposicionPreview = imposicionPreviewResult.items;
  const imposicionRejectedVariants = imposicionPreviewResult.rejected;
  const imposicionBestCandidate = imposicionPreview[0] ?? null;

  React.useEffect(() => {
    setImposicionConfig((prev) => {
      const next: GranFormatoImposicionConfig = { ...prev };
      const tecnologiasSet = new Set(tecnologiasCompatibles);
      if (next.tecnologiaDefault && !tecnologiasSet.has(next.tecnologiaDefault)) {
        next.tecnologiaDefault = null;
      }

      const maquinasSet = new Set(maquinasCompatiblesIds);
      if (next.maquinaDefaultId && !maquinasSet.has(next.maquinaDefaultId)) {
        next.maquinaDefaultId = null;
      }

      const perfilesSet = new Set(perfilesCompatiblesIds);
      if (next.perfilDefaultId && !perfilesSet.has(next.perfilDefaultId)) {
        next.perfilDefaultId = null;
      }

      return normalizeImposicionSnapshot(next) === normalizeImposicionSnapshot(prev) ? prev : next;
    });
  }, [maquinasCompatiblesIds, perfilesCompatiblesIds, tecnologiasCompatibles]);

  React.useEffect(() => {
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
  }, [imposicionMachineOptions, imposicionProfileOptions, imposicionTechnologies]);

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
    setMaquinasCompatiblesIds((prev) => prev.filter((id) => filteredMachineIds.has(id)));
  }, [filteredMachineIds]);

  React.useEffect(() => {
    setPerfilesCompatiblesIds((prev) => prev.filter((id) => validProfileIds.has(id)));
  }, [validProfileIds]);

  React.useEffect(() => {
    setMaterialesCompatiblesIds((prev) => prev.filter((id) => validMaterialVariantIds.has(id)));
  }, [validMaterialVariantIds]);

  const isConfigDirty =
    tipoVenta !== savedTipoVenta ||
    JSON.stringify([...tecnologiasCompatibles].sort()) !== JSON.stringify([...savedTecnologiasCompatibles].sort()) ||
    JSON.stringify([...maquinasCompatiblesIds].sort()) !== JSON.stringify([...savedMaquinasCompatiblesIds].sort()) ||
    JSON.stringify([...perfilesCompatiblesIds].sort()) !== JSON.stringify([...savedPerfilesCompatiblesIds].sort()) ||
    materialBaseId !== savedMaterialBaseId ||
    JSON.stringify([...materialesCompatiblesIds].sort()) !== JSON.stringify([...savedMaterialesCompatiblesIds].sort()) ||
    normalizeImposicionSnapshot(imposicionConfig) !== savedImposicionSnapshot;

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
    setRutaBaseReglasImpresion((prev) => {
      const next = prev
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
      return normalizeRutaBaseReglasSnapshot(next) === normalizeRutaBaseReglasSnapshot(prev) ? prev : next;
    });
  }, [
    tecnologiasCompatibles,
    tecnologiasCompatiblesSet,
    selectedMachines,
    rutaBasePrintingPlantillas,
    routeBasePlantillaById,
    machineById,
    selectedProfilesByMachine,
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
        setGeneralForm({
          nombre: withMotor.nombre,
          descripcion: withMotor.descripcion ?? "",
          familiaProductoId: withMotor.familiaProductoId,
          subfamiliaProductoId: withMotor.subfamiliaProductoId ?? "",
          motorCodigo: withMotor.motorCodigo,
          motorVersion: withMotor.motorVersion,
        });
        toast.success("Datos generales actualizados.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar el producto.");
      }
    });
  };

  const handleSaveTecnologias = () => {
    startSavingConfig(async () => {
      try {
        const updated = await updateGranFormatoConfig(productoState.id, {
          tipoVenta,
          tecnologiasCompatibles,
          maquinasCompatibles: maquinasCompatiblesIds,
          perfilesCompatibles: perfilesCompatiblesIds,
          materialBaseId: materialBaseId || null,
          materialesCompatibles: materialesCompatiblesIds,
          imposicion: imposicionConfig,
        });
        setTipoVenta(updated.tipoVenta);
        setSavedTipoVenta(updated.tipoVenta);
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
        setImposicionConfig(updated.imposicion ?? defaultGranFormatoImposicionConfig);
        setSavedImposicionSnapshot(
          normalizeImposicionSnapshot(updated.imposicion ?? defaultGranFormatoImposicionConfig),
        );
        toast.success("Configuración técnica actualizada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la configuración técnica.");
      }
    });
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
              <div className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-end md:justify-between">
                <div className="w-full max-w-sm">
                  <p className="mb-2 text-xs text-muted-foreground">Tipo de venta</p>
                  <Select value={tipoVenta} onValueChange={(value) => setTipoVenta(value as TipoVentaGranFormato)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo de venta">{tipoVentaLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {tipoVentaItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                  <CardTitle className="text-base">Parámetros base</CardTitle>
                  <CardDescription>
                    Estos valores quedan como referencia del producto y luego podrán ser usados por Costos y Simulación comercial.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-3 md:col-span-2 xl:col-span-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Medidas a evaluar</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setImposicionConfig((prev) => ({
                            ...prev,
                            medidas: [...prev.medidas, createGranFormatoImposicionMedida()],
                          }))
                        }
                      >
                        <PlusIcon />
                        Agregar medida
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {imposicionConfig.medidas.map((medida, index) => (
                        <div key={`medida-${index}`} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto] md:items-end">
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">Ancho (cm)</p>
                            <Input
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
                            <p className="text-xs text-muted-foreground">Alto (cm)</p>
                            <Input
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
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">Cantidad</p>
                            </div>
                            <Input
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
                  <div className="space-y-2">
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
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Permitir rotación</p>
                      <p className="text-xs text-muted-foreground">Evalúa también la pieza rotada para optimizar el ancho del rollo.</p>
                    </div>
                    <Switch
                      checked={imposicionConfig.permitirRotacion}
                      onCheckedChange={(checked) =>
                        setImposicionConfig((prev) => ({ ...prev, permitirRotacion: Boolean(checked) }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="text-base">Separación y overrides de márgenes</CardTitle>
                      <CardDescription>
                        Por defecto el sistema toma los márgenes no imprimibles de la máquina seleccionada.
                      </CardDescription>
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
                      <p className="text-sm font-medium">Usar overrides</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                  <div className="hidden xl:block" />
                  {showImposicionOverrides
                    ? [
                        ["margenLateralIzquierdoMmOverride", "Margen lateral izquierdo override (mm)"],
                        ["margenLateralDerechoMmOverride", "Margen lateral derecho override (mm)"],
                        ["margenInicioMmOverride", "Margen inicio override (mm)"],
                        ["margenFinalMmOverride", "Margen final override (mm)"],
                      ].map(([key, label]) => (
                        <div key={key} className="space-y-2">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <Input
                            type="number"
                            min={0}
                            value={(imposicionConfig[key as keyof GranFormatoImposicionConfig] as number | null) ?? ""}
                            onChange={(event) =>
                              setImposicionConfig((prev) => ({
                                ...prev,
                                [key]: event.target.value ? Math.max(0, Number(event.target.value)) : null,
                              }))
                            }
                          />
                        </div>
                      ))
                    : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Contexto técnico activo</CardTitle>
                  <CardDescription>
                    La imposición se previsualiza sobre la máquina y el perfil default activos para la tecnología seleccionada.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border p-3 text-sm">
                    <p className="text-xs text-muted-foreground">Tecnología</p>
                    <p className="font-medium">{technologyLabels[imposicionTechnology] ?? "Sin tecnología"}</p>
                  </div>
                  <div className="rounded-lg border p-3 text-sm">
                    <p className="text-xs text-muted-foreground">Máquina</p>
                    <p className="font-medium">{imposicionMachine?.nombre ?? "Sin máquina default"}</p>
                  </div>
                  <div className="rounded-lg border p-3 text-sm">
                    <p className="text-xs text-muted-foreground">Perfil</p>
                    <p className="font-medium">{imposicionProfile?.nombre ?? "Sin perfil default"}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Preview por ancho de rollo</CardTitle>
                  <CardDescription>
                    El sistema compara las variantes de material compatibles y muestra cuál conviene según el criterio configurado.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {imposicionConfig.medidas.every((item) => !(item.anchoMm && item.altoMm)) ? (
                    <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                      Completá al menos una medida válida para simular la imposición.
                    </div>
                  ) : !imposicionMachine ? (
                    <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                      Seleccioná una máquina compatible para poder evaluar los márgenes no imprimibles y el ancho máximo imprimible.
                    </div>
                  ) : imposicionPreview.length === 0 ? (
                    <div className="space-y-3">
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
                            {imposicionRejectedVariants.map((item) => (
                              <div key={item.variant.id} className="rounded-md border px-3 py-2 text-sm">
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
                      {imposicionBestCandidate ? (
                        <div className="rounded-lg border bg-muted/20 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="text-sm font-medium">Mejor candidato actual</p>
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
                            <Button type="button" variant="outline" size="sm" onClick={() => setIsImposicion3dOpen(true)}>
                              Ver nesting 3D
                            </Button>
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
                              <tr key={item.variant.id} className="border-t">
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
                                <td className="px-3 py-2">{item.rollWidthMm.toLocaleString("es-AR")} mm</td>
                                <td className="px-3 py-2">{item.printableWidthMm.toLocaleString("es-AR")} mm</td>
                                <td className="px-3 py-2">{item.rotated ? "Rotada" : "Normal"}</td>
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
                            {imposicionRejectedVariants.map((item) => (
                              <div key={item.variant.id} className="rounded-md border px-3 py-2 text-sm">
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
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

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
                  <PlotterSimulator
                    key={`plotter-${imposicionBestCandidate.varianteId}-${isImposicion3dOpen ? "open" : "closed"}`}
                    rollWidth={Number((imposicionBestCandidate.rollWidthMm / 10).toFixed(2))}
                    rollLength={Number((imposicionBestCandidate.consumedLengthMm / 10).toFixed(2))}
                    marginLeft={Number((imposicionBestCandidate.marginLeftMm / 10).toFixed(2))}
                    marginRight={Number((imposicionBestCandidate.marginRightMm / 10).toFixed(2))}
                    marginStart={Number((imposicionBestCandidate.marginStartMm / 10).toFixed(2))}
                    marginEnd={Number((imposicionBestCandidate.marginEndMm / 10).toFixed(2))}
                    pieces={imposicionBestCandidate.placements.map((item, index) => ({
                      id: item.id,
                      w: Number((item.widthMm / 10).toFixed(2)),
                      h: Number((item.heightMm / 10).toFixed(2)),
                      cx: Number((((item.centerXMm - imposicionBestCandidate.rollWidthMm / 2) / 10)).toFixed(2)),
                      cy: Number((item.centerYMm / 10).toFixed(2)),
                      color: ["#ff9f43", "#0abde3", "#1dd1a1", "#ff6b6b", "#f97316", "#22c55e"][index % 6],
                      label: item.label,
                      textColor: "#111111",
                    }))}
                  />
                </div>
              ) : (
                <div className="flex h-[70vh] items-center justify-center rounded-xl border bg-muted/20 text-sm text-muted-foreground">
                  No hay un candidato válido para renderizar.
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <TabsContent value="cotizador">
          <PlaceholderTab
            title="Costos"
            description="Acá definiremos el cálculo técnico del trabajo según material, ancho útil, desperdicio y equipo."
          />
        </TabsContent>

        <TabsContent value="precio">
          <PlaceholderTab
            title="Precio"
            description="Acá definiremos la capa comercial sobre el costo técnico del trabajo de gran formato."
          />
        </TabsContent>

        <TabsContent value="simulacion-comercial">
          <PlaceholderTab
            title="Simulación comercial"
            description="Acá compararemos costo técnico, precio final y margen para trabajos de gran formato."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
