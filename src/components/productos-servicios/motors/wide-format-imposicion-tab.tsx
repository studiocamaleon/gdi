"use client";

import * as React from "react";
import { ChevronDownIcon, InfoIcon, PrinterIcon, SaveIcon, Trash2Icon, TrophyIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import type { ProductTabProps } from "@/components/productos-servicios/product-detail-types";
import { GdiSpinner } from "@/components/brand/gdi-spinner";
import { WideFormatNestingCard } from "@/components/productos-servicios/motors/wide-format-nesting-card";
import {
  buildDefaultManualLayout,
  buildManualLayoutFromPlacements,
  buildManualLayoutFromNestingPieces,
  buildWideFormatSimulatorDataFromPreview,
  buildWideFormatSimulatorDataFromCandidate,
  cloneWideFormatManualLayout,
} from "@/components/productos-servicios/motors/wide-format-nesting.helpers";
import { WideFormatPanelEditorSheet } from "@/components/productos-servicios/motors/wide-format-panel-editor-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ProductoTabSection } from "@/components/productos-servicios/producto-tab-section";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProductoServicioChecklistCotizador } from "@/components/productos-servicios/producto-servicio-checklist";
import { getVarianteOptionChips } from "@/lib/materias-primas-variantes-display";
import type { MateriaPrimaVariante } from "@/lib/materias-primas";
import { getMaquinaTecnologia, tecnologiaMaquinaItems } from "@/lib/maquinaria";
import { getGranFormatoChecklist, getGranFormatoConfig, previewGranFormatoCostos, updateGranFormatoConfig } from "@/lib/productos-servicios-api";
import type {
  GranFormatoCostosCandidateResumen,
  GranFormatoCostosCorridaTrabajo,
  GranFormatoCostosGrupoTrabajo,
  GranFormatoCostosResponse,
  GranFormatoImposicionConfig,
  GranFormatoImposicionCriterioOptimizacion,
  GranFormatoPanelizadoDireccion,
  GranFormatoPanelizadoDistribucion,
  GranFormatoPanelizadoInterpretacionAnchoMaximo,
  GranFormatoPanelizadoModo,
  ProductoChecklist,
} from "@/lib/productos-servicios";

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
  { value: "util", label: "Solo ancho útil" },
];

const technologyLabels: Record<string, string> = Object.fromEntries(
  tecnologiaMaquinaItems.map((item) => [item.value, item.label]),
);

const uuidLikePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type GranFormatoImposicionPreviewItem = {
  variant: MateriaPrimaVariante;
  rollWidthMm: number;
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
  wasteAreaM2: number;
  wastePct: number;
  placements: GranFormatoCostosCandidateResumen["placements"];
};

type GranFormatoImposicionPreviewResultState = {
  items: GranFormatoImposicionPreviewItem[];
  simulacionHibrida: boolean;
  corridasTrabajo: GranFormatoCostosCorridaTrabajo[];
  gruposTrabajo: GranFormatoCostosGrupoTrabajo[];
  rejected: Array<{
    variant: MateriaPrimaVariante;
    reason: string;
  }>;
  machineIssue: string | null;
  medidasOriginales: GranFormatoCostosResponse["medidasOriginales"];
  medidasEfectivas: GranFormatoCostosResponse["medidasEfectivas"];
  mutacionesAplicadas: GranFormatoCostosResponse["mutacionesAplicadas"];
  traceChecklist: GranFormatoCostosResponse["traceChecklist"];
};

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

function createGranFormatoImposicionMedida() {
  return {
    anchoMm: null,
    altoMm: null,
    cantidad: 1,
  };
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

function createEmptyChecklist(productoId: string): ProductoChecklist {
  return {
    productoId,
    activo: true,
    preguntas: [],
    createdAt: null,
    updatedAt: null,
  };
}

function createEmptyImposicionPreviewResult(machineIssue: string | null): GranFormatoImposicionPreviewResultState {
  return {
    items: [],
    simulacionHibrida: false,
    corridasTrabajo: [],
    gruposTrabajo: [],
    rejected: [],
    machineIssue,
    medidasOriginales: [],
    medidasEfectivas: [],
    mutacionesAplicadas: [],
    traceChecklist: [],
  };
}

function normalizeChecklistCotizadorSnapshot(value: Record<string, { respuestaId: string }>) {
  return JSON.stringify(
    Object.entries(value)
      .filter(([, item]) => Boolean(item?.respuestaId))
      .map(([preguntaId, item]) => ({ preguntaId, respuestaId: item.respuestaId }))
      .sort((a, b) => a.preguntaId.localeCompare(b.preguntaId)),
  );
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
      ? { items: config.panelizadoManualLayout.items.map((item) => ({ ...item, panels: item.panels.map((panel) => ({ ...panel })) })) }
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
      ? { items: config.panelizadoManualLayout.items.map((item) => ({ ...item, panels: item.panels.map((panel) => ({ ...panel })) })) }
      : null,
  };
}

function readNumericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readMachineMarginMm(maquina: ProductTabProps["maquinas"][number] | null, key: string) {
  const raw = maquina?.parametrosTecnicos?.[key];
  const cm = readNumericValue(raw);
  return cm == null ? null : cm * 10;
}

function formatMmAsCm(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "";
  return String(Number((value / 10).toFixed(2)));
}

function formatMeasureSummary(medidas: Array<{ anchoMm: number; altoMm: number; cantidad: number }>) {
  if (!medidas.length) return "Sin medidas";
  return medidas.map((item) => `${formatMmAsCm(item.anchoMm)} × ${formatMmAsCm(item.altoMm)} cm × ${item.cantidad}`).join(" · ");
}

function formatChecklistMutationSummary(item: GranFormatoCostosResponse["mutacionesAplicadas"][number]) {
  const delta =
    item.ejes === "ambos"
      ? `${formatMmAsCm(item.deltaAnchoMm)} cm ancho y ${formatMmAsCm(item.deltaAltoMm)} cm alto`
      : item.ejes === "ancho"
        ? `${formatMmAsCm(item.deltaAnchoMm)} cm en ancho`
        : `${formatMmAsCm(item.deltaAltoMm)} cm en alto`;
  return `${item.respuesta}: +${formatMmAsCm(item.valorMmPorLado)} cm por lado (${delta})`;
}

function getPanelizadoModoLabel(value: GranFormatoPanelizadoModo | null | undefined) {
  if (value === "manual") return "Manual";
  return "Automático";
}

function getPanelizadoInterpretacionLabel(value: GranFormatoPanelizadoInterpretacionAnchoMaximo | null | undefined) {
  return panelizadoInterpretacionItems.find((item) => item.value === value)?.label ?? "Ancho total del panel";
}

function isUuidLike(value: string | null | undefined) {
  return Boolean(value && uuidLikePattern.test(value.trim()));
}

function getMachineDisplayLabel(machine: ProductTabProps["maquinas"][number] | null | undefined) {
  if (!machine) return "Seleccionar máquina";
  const codigo = machine.codigo?.trim();
  const nombre = machine.nombre?.trim();
  if (nombre && !isUuidLike(nombre)) {
    return codigo ? `${codigo} · ${nombre}` : nombre;
  }
  if (codigo) return codigo;
  if (nombre) return nombre;
  return "Máquina";
}

function getProfileDisplayLabel(
  profile: ProductTabProps["maquinas"][number]["perfilesOperativos"][number] | null | undefined,
) {
  if (!profile) return "Seleccionar perfil";
  const nombre = profile.nombre?.trim();
  if (nombre && !isUuidLike(nombre)) return nombre;
  const parts = [
    profile.tipoPerfil ? profile.tipoPerfil.charAt(0).toUpperCase() + profile.tipoPerfil.slice(1) : null,
    profile.printMode ? profile.printMode.toUpperCase() : null,
    profile.printSides
      ? profile.printSides === "simple_faz"
        ? "Simple faz"
        : "Doble faz"
      : null,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");
  return profile.id;
}

function buildDefaultPeriodo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function WideFormatImposicionTab(props: ProductTabProps) {
  const [tecnologiasCompatibles, setTecnologiasCompatibles] = React.useState<string[]>([]);
  const [maquinasCompatiblesIds, setMaquinasCompatiblesIds] = React.useState<string[]>([]);
  const [perfilesCompatiblesIds, setPerfilesCompatiblesIds] = React.useState<string[]>([]);
  const [materialBaseId, setMaterialBaseId] = React.useState("");
  const [materialesCompatiblesIds, setMaterialesCompatiblesIds] = React.useState<string[]>([]);
  const [imposicionConfig, setImposicionConfig] = React.useState<GranFormatoImposicionConfig>(defaultGranFormatoImposicionConfig);
  const [savedImposicionSnapshot, setSavedImposicionSnapshot] = React.useState(normalizeImposicionSnapshot(defaultGranFormatoImposicionConfig));
  const [aplicaChecklistATodasLasTecnologias, setAplicaChecklistATodasLasTecnologias] = React.useState(true);
  const [checklistComun, setChecklistComun] = React.useState<ProductoChecklist>(createEmptyChecklist(props.producto.id));
  const [checklistsPorTecnologia, setChecklistsPorTecnologia] = React.useState<Record<string, ProductoChecklist>>({});
  const [imposicionChecklistRespuestas, setImposicionChecklistRespuestas] = React.useState<Record<string, { respuestaId: string }>>({});
  const [imposicionSimulationConfig, setImposicionSimulationConfig] = React.useState<GranFormatoImposicionConfig | null>(null);
  const [imposicionSimulationChecklistSnapshot, setImposicionSimulationChecklistSnapshot] = React.useState<string | null>(null);
  const [imposicionPreviewResult, setImposicionPreviewResult] = React.useState<GranFormatoImposicionPreviewResultState>(
    createEmptyImposicionPreviewResult("Todavía no ejecutaste una simulación de imposición."),
  );
  const [isLoadingConfig, setIsLoadingConfig] = React.useState(true);
  const [isSavingConfig, startSavingConfig] = React.useTransition();
  const [isSimulatingImposicion, startSimulatingImposicion] = React.useTransition();
  const [costosPeriodo] = React.useState(buildDefaultPeriodo());
  const [showImposicionOverrides, setShowImposicionOverrides] = React.useState(false);
  const [selectedPreviewCandidateKey, setSelectedPreviewCandidateKey] = React.useState("");
  const [isPanelEditorOpen, setIsPanelEditorOpen] = React.useState(false);
  const [isImposicion3dOpen, setIsImposicion3dOpen] = React.useState(false);
  const [expandedCorridas, setExpandedCorridas] = React.useState<Record<string, boolean>>({});
  const [imposicion3dPreview, setImposicion3dPreview] = React.useState<GranFormatoCostosResponse["nestingPreview"] | GranFormatoCostosGrupoTrabajo["nestingPreview"]>(null);
  const [imposicion3dTitle, setImposicion3dTitle] = React.useState("Visualización 3D del nesting");
  const [panelEditorSelection, setPanelEditorSelection] = React.useState<{
    printableWidthMm: number;
    initialLayout: NonNullable<GranFormatoImposicionConfig["panelizadoManualLayout"]> | null;
  } | null>(null);

  const loadConfig = React.useCallback(async () => {
    setIsLoadingConfig(true);
    try {
      const [config, checklistConfig] = await Promise.all([
        getGranFormatoConfig(props.producto.id),
        getGranFormatoChecklist(props.producto.id),
      ]);
      setTecnologiasCompatibles(config.tecnologiasCompatibles);
      setMaquinasCompatiblesIds(config.maquinasCompatibles);
      setPerfilesCompatiblesIds(config.perfilesCompatibles);
      setMaterialBaseId(config.materialBaseId ?? "");
      setMaterialesCompatiblesIds(config.materialesCompatibles);
      const nextImposicion = {
        ...(config.imposicion ?? defaultGranFormatoImposicionConfig),
        panelizadoInterpretacionAnchoMaximo: config.imposicion?.panelizadoInterpretacionAnchoMaximo ?? "total",
        medidas:
          config.imposicion?.medidas?.length
            ? config.imposicion.medidas
            : config.imposicion?.piezaAnchoMm && config.imposicion?.piezaAltoMm
              ? [{ anchoMm: config.imposicion.piezaAnchoMm, altoMm: config.imposicion.piezaAltoMm, cantidad: config.imposicion.cantidadReferencia ?? 1 }]
              : [createGranFormatoImposicionMedida()],
      };
      setImposicionConfig(nextImposicion);
      setSavedImposicionSnapshot(normalizeImposicionSnapshot(nextImposicion));
      setImposicionSimulationConfig(null);
      setImposicionSimulationChecklistSnapshot(null);
      setImposicionPreviewResult(createEmptyImposicionPreviewResult("Todavía no ejecutaste una simulación de imposición."));
      setAplicaChecklistATodasLasTecnologias(checklistConfig.aplicaATodasLasTecnologias);
      setChecklistComun(
        checklistConfig.checklistComun?.preguntas.length
          ? checklistConfig.checklistComun
          : createEmptyChecklist(props.producto.id),
      );
      setChecklistsPorTecnologia(
        Object.fromEntries(checklistConfig.checklistsPorTecnologia.map((item) => [item.tecnologia, item.checklist])),
      );
      const hasOverrides =
        nextImposicion.margenLateralIzquierdoMmOverride != null ||
        nextImposicion.margenLateralDerechoMmOverride != null ||
        nextImposicion.margenInicioMmOverride != null ||
        nextImposicion.margenFinalMmOverride != null;
      setShowImposicionOverrides(hasOverrides);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la configuración de imposición.");
    } finally {
      setIsLoadingConfig(false);
    }
  }, [props.producto.id]);

  React.useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const availableBaseMaterials = React.useMemo(
    () =>
      props.materiasPrimas.filter(
        (item) => item.activo && item.subfamilia === "sustrato_rollo_flexible" && item.variantes.some((variant) => variant.activo),
      ),
    [props.materiasPrimas],
  );
  const selectedBaseMaterial = React.useMemo(
    () => availableBaseMaterials.find((item) => item.id === materialBaseId) ?? null,
    [availableBaseMaterials, materialBaseId],
  );
  const availableMaterialVariants = React.useMemo(
    () => (selectedBaseMaterial?.variantes ?? []).filter((variant) => variant.activo),
    [selectedBaseMaterial],
  );
  const selectedMachines = React.useMemo(
    () => props.maquinas.filter((machine) => maquinasCompatiblesIds.includes(machine.id)),
    [maquinasCompatiblesIds, props.maquinas],
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
      if (selected) return selected;
    }
    return imposicionMachineOptions[0] ?? null;
  }, [imposicionConfig.maquinaDefaultId, imposicionMachineOptions]);
  const imposicionProfileOptions = React.useMemo(() => {
    if (!imposicionMachine) return [];
    return imposicionMachine.perfilesOperativos.filter(
      (profile) => profile.activo && perfilesCompatiblesIds.includes(profile.id),
    );
  }, [imposicionMachine, perfilesCompatiblesIds]);
  const imposicionProfile = React.useMemo(() => {
    if (imposicionConfig.perfilDefaultId) {
      const selected = imposicionProfileOptions.find((profile) => profile.id === imposicionConfig.perfilDefaultId);
      if (selected) return selected;
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
  const checklistCotizadorImposicion = React.useMemo(() => {
    if (aplicaChecklistATodasLasTecnologias) return checklistComun;
    return checklistsPorTecnologia[imposicionTechnology] ?? createEmptyChecklist(props.producto.id);
  }, [
    aplicaChecklistATodasLasTecnologias,
    checklistComun,
    checklistsPorTecnologia,
    imposicionTechnology,
    props.producto.id,
  ]);
  const hasImposicionSimulation = imposicionSimulationConfig != null;
  const imposicionSimulationSnapshot = React.useMemo(
    () => (imposicionSimulationConfig ? normalizeImposicionSnapshot(imposicionSimulationConfig) : null),
    [imposicionSimulationConfig],
  );
  const imposicionChecklistSnapshot = React.useMemo(
    () => normalizeChecklistCotizadorSnapshot(imposicionChecklistRespuestas),
    [imposicionChecklistRespuestas],
  );
  const isImposicionSimulationStale =
    hasImposicionSimulation &&
    (imposicionSimulationSnapshot !== normalizeImposicionSnapshot(imposicionConfig) ||
      imposicionSimulationChecklistSnapshot !== imposicionChecklistSnapshot);
  const imposicionPreview = imposicionPreviewResult.items;
  const imposicionCorridasTrabajo = imposicionPreviewResult.corridasTrabajo;
  const imposicionGruposTrabajo = imposicionPreviewResult.gruposTrabajo;
  const isHybridImposicion = imposicionPreviewResult.simulacionHibrida && imposicionCorridasTrabajo.length > 0;
  const groupsByCorrida = React.useMemo(
    () =>
      Object.fromEntries(
        imposicionCorridasTrabajo.map((corrida) => [
          corrida.corridaId,
          imposicionGruposTrabajo.filter((grupo) => grupo.corridaId === corrida.corridaId),
        ]),
      ) as Record<string, GranFormatoCostosGrupoTrabajo[]>,
    [imposicionCorridasTrabajo, imposicionGruposTrabajo],
  );
  const imposicionRejectedVariants = imposicionPreviewResult.rejected;
  const imposicionBestCandidate = imposicionPreview[0] ?? null;
  const selectedPreviewCandidate =
    imposicionPreview.find(
      (item) =>
        `${item.variant.id}-${item.panelizado ? item.panelAxis ?? "panel" : "normal"}-${item.panelMode ?? "na"}-${Math.round(item.consumedLengthMm)}` ===
        selectedPreviewCandidateKey,
    ) ?? imposicionBestCandidate;
  const imposicionManualLayoutActual = React.useMemo(
    () =>
      imposicionConfig.panelizadoModo === "manual" && imposicionConfig.panelizadoManualLayout
        ? cloneWideFormatManualLayout(imposicionConfig.panelizadoManualLayout)
        : buildManualLayoutFromPlacements(selectedPreviewCandidate?.placements ?? imposicionBestCandidate?.placements ?? []),
    [
      imposicionBestCandidate?.placements,
      imposicionConfig.panelizadoManualLayout,
      imposicionConfig.panelizadoModo,
      selectedPreviewCandidate?.placements,
    ],
  );
  const panelEditorPrintableWidthMm =
    selectedPreviewCandidate?.printableWidthMm ?? imposicionBestCandidate?.printableWidthMm ?? 0;
  const imposicionPreviewHasValidMeasures = (imposicionSimulationConfig ?? imposicionConfig).medidas.some(
    (item) => (item.anchoMm ?? 0) > 0 && (item.altoMm ?? 0) > 0 && (item.cantidad ?? 0) > 0,
  );
  const isConfigDirty = normalizeImposicionSnapshot(imposicionConfig) !== savedImposicionSnapshot;
  const summaryMeasuresCount = imposicionConfig.medidas.filter(
    (item) => (item.anchoMm ?? 0) > 0 && (item.altoMm ?? 0) > 0 && (item.cantidad ?? 0) > 0,
  ).length;

  React.useEffect(() => {
    const tecnologiasSet = new Set(tecnologiasCompatibles);
    const maquinasSet = new Set(maquinasCompatiblesIds);
    const perfilesSet = new Set(perfilesCompatiblesIds);
    const tecnologiaDefault = imposicionConfig.tecnologiaDefault;
    const maquinaDefaultId = imposicionConfig.maquinaDefaultId;
    const perfilDefaultId = imposicionConfig.perfilDefaultId;
    const hasInvalidTecnologia = typeof tecnologiaDefault === "string" && tecnologiaDefault.length > 0 && !tecnologiasSet.has(tecnologiaDefault);
    const hasInvalidMaquina = typeof maquinaDefaultId === "string" && maquinaDefaultId.length > 0 && !maquinasSet.has(maquinaDefaultId);
    const hasInvalidPerfil = typeof perfilDefaultId === "string" && perfilDefaultId.length > 0 && !perfilesSet.has(perfilDefaultId);
    if (!hasInvalidTecnologia && !hasInvalidMaquina && !hasInvalidPerfil) return;
    setImposicionConfig((prev) => {
      const next = { ...prev };
      if (next.tecnologiaDefault && !tecnologiasSet.has(next.tecnologiaDefault)) next.tecnologiaDefault = null;
      if (next.maquinaDefaultId && !maquinasSet.has(next.maquinaDefaultId)) next.maquinaDefaultId = null;
      if (next.perfilDefaultId && !perfilesSet.has(next.perfilDefaultId)) next.perfilDefaultId = null;
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
    if (!needsTecnologiaDefault && !needsMaquinaDefault && !needsPerfilDefault) return;
    setImposicionConfig((prev) => {
      const next = { ...prev };
      if (!next.tecnologiaDefault && imposicionTechnologies.length > 0) next.tecnologiaDefault = imposicionTechnologies[0];
      if (!next.maquinaDefaultId && imposicionMachineOptions.length > 0) next.maquinaDefaultId = imposicionMachineOptions[0].id;
      if (!next.perfilDefaultId && imposicionProfileOptions.length > 0) next.perfilDefaultId = imposicionProfileOptions[0].id;
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

  const handleSaveConfig = () => {
    startSavingConfig(async () => {
      try {
        const updated = await updateGranFormatoConfig(props.producto.id, {
          tecnologiasCompatibles,
          maquinasCompatibles: maquinasCompatiblesIds,
          perfilesCompatibles: perfilesCompatiblesIds,
          materialBaseId: materialBaseId || null,
          materialesCompatibles: materialesCompatiblesIds,
          imposicion: imposicionConfig,
        });
        setTecnologiasCompatibles(updated.tecnologiasCompatibles);
        setMaquinasCompatiblesIds(updated.maquinasCompatibles);
        setPerfilesCompatiblesIds(updated.perfilesCompatibles);
        setMaterialBaseId(updated.materialBaseId ?? "");
        setMaterialesCompatiblesIds(updated.materialesCompatibles);
        const nextImposicion = {
          ...(updated.imposicion ?? defaultGranFormatoImposicionConfig),
          panelizadoInterpretacionAnchoMaximo: updated.imposicion?.panelizadoInterpretacionAnchoMaximo ?? "total",
          medidas:
            updated.imposicion?.medidas?.length
              ? updated.imposicion.medidas
              : [createGranFormatoImposicionMedida()],
        };
        setImposicionConfig(nextImposicion);
        setSavedImposicionSnapshot(normalizeImposicionSnapshot(nextImposicion));
        toast.success("Configuración técnica actualizada.");
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la configuración técnica.");
      }
    });
  };

  const simulateImposition = React.useCallback((config: GranFormatoImposicionConfig) => {
    const effectiveConfig = cloneGranFormatoImposicionConfig(config);
    setImposicionSimulationConfig(effectiveConfig);
    setImposicionSimulationChecklistSnapshot(normalizeChecklistCotizadorSnapshot(imposicionChecklistRespuestas));

    const medidasValidas = effectiveConfig.medidas.filter((item) => (item.anchoMm ?? 0) > 0 && (item.altoMm ?? 0) > 0 && (item.cantidad ?? 0) > 0);
    if (!medidasValidas.length) {
      setImposicionPreviewResult(createEmptyImposicionPreviewResult("Completá al menos una medida válida para simular la imposición."));
      toast.error("Completá al menos una medida válida para simular la imposición.");
      return;
    }
    if (!imposicionMachine) {
      setImposicionPreviewResult(createEmptyImposicionPreviewResult("Seleccioná una máquina compatible para evaluar la imposición."));
      toast.error("Seleccioná una máquina compatible para simular la imposición.");
      return;
    }

    startSimulatingImposicion(async () => {
      try {
        const result = await previewGranFormatoCostos(props.producto.id, {
          periodo: costosPeriodo,
          tecnologia: effectiveConfig.tecnologiaDefault ?? undefined,
          persistirSnapshot: false,
          incluirCandidatos: true,
          medidas: medidasValidas.map((item) => ({
            anchoMm: item.anchoMm ?? 0,
            altoMm: item.altoMm ?? 0,
            cantidad: item.cantidad ?? 1,
          })),
          checklistRespuestas: Object.entries(imposicionChecklistRespuestas)
            .filter(([, value]) => Boolean(value?.respuestaId))
            .map(([preguntaId, value]) => ({
              preguntaId,
              respuestaId: value.respuestaId,
            })),
          panelizado: {
            activo: effectiveConfig.panelizadoActivo,
            modo: effectiveConfig.panelizadoModo,
            direccion: effectiveConfig.panelizadoDireccion,
            solapeMm: effectiveConfig.panelizadoSolapeMm,
            anchoMaxPanelMm: effectiveConfig.panelizadoAnchoMaxPanelMm,
            distribucion: effectiveConfig.panelizadoDistribucion,
            interpretacionAnchoMaximo: effectiveConfig.panelizadoInterpretacionAnchoMaximo,
            manualLayout: effectiveConfig.panelizadoModo === "manual" ? effectiveConfig.panelizadoManualLayout : null,
          },
        });

        const variantById = new Map(imposicionMaterialVariants.map((item) => [item.id, item]));
        const items = (result.candidatos ?? [])
          .map((candidate) => {
            const variant = variantById.get(candidate.variantId);
            if (!variant) return null;
            return {
              variant,
              rollWidthMm: candidate.rollWidthMm,
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
              wasteAreaM2: candidate.wasteAreaM2,
              wastePct: candidate.wastePct,
              placements: candidate.placements,
            };
          })
          .filter((item): item is GranFormatoImposicionPreviewItem => Boolean(item));

        setImposicionPreviewResult({
          items,
          simulacionHibrida: result.simulacionHibrida === true,
          corridasTrabajo: result.corridasTrabajo ?? [],
          gruposTrabajo: result.gruposTrabajo ?? [],
          rejected: [],
          machineIssue:
            items.length > 0 || (result.corridasTrabajo?.length ?? 0) > 0
              ? null
              : "No se pudo resolver la imposición con la configuración actual.",
          medidasOriginales: result.medidasOriginales ?? [],
          medidasEfectivas: result.medidasEfectivas ?? [],
          mutacionesAplicadas: result.mutacionesAplicadas ?? [],
          traceChecklist: result.traceChecklist ?? [],
        });
        setSelectedPreviewCandidateKey("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo simular la imposición.";
        setImposicionPreviewResult(createEmptyImposicionPreviewResult(message));
        toast.error(message);
      }
    });
  }, [
    imposicionChecklistRespuestas,
    imposicionMachine,
    imposicionMaterialVariants,
    props.producto.id,
    startSimulatingImposicion,
    costosPeriodo,
  ]);

  const handleSimularImposicion = () => {
    void simulateImposition(imposicionConfig);
  };

  const handleOpenPanelEditor = () => {
    if (!imposicionManualLayoutActual) {
      toast.error("No hay paneles disponibles para editar. Simulá una imposición con panelizado primero.");
      return;
    }
    setPanelEditorSelection({
      printableWidthMm: panelEditorPrintableWidthMm,
      initialLayout: imposicionManualLayoutActual,
    });
    setIsPanelEditorOpen(true);
  };

  const handleOpenImposicion3d = React.useCallback(
    (
      preview: GranFormatoCostosResponse["nestingPreview"] | GranFormatoCostosGrupoTrabajo["nestingPreview"],
      title = "Visualización 3D del nesting",
    ) => {
      if (!preview) {
        toast.error("No hay un nesting 3D disponible para este resultado.");
        return;
      }
      setImposicion3dPreview(preview);
      setImposicion3dTitle(title);
      setIsImposicion3dOpen(true);
    },
    [],
  );

  const handleOpenHybridGroupPanelEditor = React.useCallback(
    (grupo: GranFormatoCostosGrupoTrabajo) => {
      const sourcePieceIds = (grupo.nestingPreview?.pieces ?? [])
        .map((piece) => piece.sourcePieceId)
        .filter((value): value is string => Boolean(value));
      if (!sourcePieceIds.length || !grupo.nestingPreview) {
        toast.error("No hay paneles disponibles para editar en este grupo.");
        return;
      }
      const existingItems =
        imposicionConfig.panelizadoManualLayout?.items.filter((item) => sourcePieceIds.includes(item.sourcePieceId)) ?? [];
      setPanelEditorSelection({
        printableWidthMm: Math.round(
          (grupo.nestingPreview.rollWidth - grupo.nestingPreview.marginLeft - grupo.nestingPreview.marginRight) * 10,
        ),
        initialLayout:
          existingItems.length > 0
            ? { items: existingItems.map((item) => ({ ...item, panels: item.panels.map((panel) => ({ ...panel })) })) }
            : buildManualLayoutFromNestingPieces(grupo.nestingPreview.pieces),
      });
      setIsPanelEditorOpen(true);
    },
    [imposicionConfig],
  );

  const handleApplyPanelEditor = (layout: NonNullable<typeof imposicionManualLayoutActual>) => {
    const nextConfig = {
      ...imposicionConfig,
      panelizadoActivo: true,
      panelizadoModo: "manual" as const,
      panelizadoManualLayout: layout,
    };
    setImposicionConfig(nextConfig);
    setPanelEditorSelection(null);
    setIsPanelEditorOpen(false);
    void simulateImposition(nextConfig);
  };

  const handleRestoreAutomaticPanelLayout = () => {
    const nextConfig = {
      ...imposicionConfig,
      panelizadoModo: "automatico" as const,
      panelizadoManualLayout: null,
    };
    setImposicionConfig(nextConfig);
    setPanelEditorSelection(null);
    setIsPanelEditorOpen(false);
    void simulateImposition(nextConfig);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Imposición</CardTitle>
        <CardDescription>
          Definí el baseline técnico de impresión para gran formato: defaults de impresión, medidas, checklist previo, panelizado y evaluación de candidatos por rollo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ProductoTabSection
          title="Resumen de configuración"
          description="Lectura rápida del estado técnico actual de la imposición, la máquina base, el panelizado y los cambios pendientes."
          icon={InfoIcon}
          contentClassName="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        >
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Tecnología / máquina</p>
            <p className="mt-1 text-sm font-medium">
              {technologyLabels[imposicionTechnology] ?? imposicionTechnology ?? "Sin tecnología"} {imposicionMachine ? `· ${imposicionMachine.nombre}` : ""}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Perfil por defecto</p>
            <p className="mt-1 text-sm font-medium">{imposicionProfile?.nombre ?? "Sin perfil"}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Medidas válidas</p>
            <p className="mt-1 text-sm font-medium">{summaryMeasuresCount}</p>
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Estado</p>
            <p className="mt-1 text-sm font-medium">{isConfigDirty ? "Hay cambios pendientes" : "Sin cambios pendientes"}</p>
          </div>
        </ProductoTabSection>
        <ProductoTabSection
          title="Parámetros de imposición"
          description="Definí el baseline técnico del producto: defaults de impresión, optimización y márgenes que luego usará el resto del flujo."
          icon={PrinterIcon}
        >
          <div className="space-y-5">
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
                        {getMachineDisplayLabel(imposicionMachine)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Seleccionar máquina</SelectItem>
                      {imposicionMachineOptions.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {getMachineDisplayLabel(item)}
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
                        {getProfileDisplayLabel(imposicionProfile)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Seleccionar perfil</SelectItem>
                      {imposicionProfileOptions.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {getProfileDisplayLabel(item)}
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
                <p className="text-sm text-muted-foreground">Ajustá cómo el sistema evalúa alternativas de nesting para este producto.</p>
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
                        {imposicionOptimizationItems.find((item) => item.value === imposicionConfig.criterioOptimizacion)?.label ?? "Seleccionar criterio"}
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
                    <LabelWithTooltip label="Permitir rotación" tooltip="Evalúa orientaciones alternativas para mejorar el aprovechamiento del rollo." />
                  </p>
                  <Switch checked={imposicionConfig.permitirRotacion} onCheckedChange={(checked) => setImposicionConfig((prev) => ({ ...prev, permitirRotacion: Boolean(checked) }))} />
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-3">
                  <p className="text-sm font-medium">
                    <LabelWithTooltip label="Apto para panelizado" tooltip="Si una pieza no entra entera en ningún rollo, el sistema podrá dividirla en paneles automáticamente." />
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
              </div>
              {imposicionConfig.panelizadoActivo ? (
                <div className="mt-4 rounded-xl border border-orange-200/70 bg-orange-50/40 p-4">
                  <div className="mb-4">
                    <h5 className="text-sm font-semibold text-orange-900">Parámetros de panelizado</h5>
                    <p className="text-sm text-orange-900/75">
                      Estos parámetros solo aplican cuando el producto permite dividir piezas en paneles para entrar en el ancho disponible del rollo.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(220px,1.3fr)_minmax(220px,1.3fr)_minmax(0,1fr)_minmax(220px,1.2fr)]">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Modo de panelizado</p>
                      <Select
                        value={imposicionConfig.panelizadoModo ?? "automatico"}
                        onValueChange={(value) =>
                          setImposicionConfig((prev) => ({
                            ...prev,
                            panelizadoModo: value as GranFormatoPanelizadoModo,
                            panelizadoManualLayout:
                              value === "manual"
                                ? prev.panelizadoManualLayout ??
                                  buildDefaultManualLayout(
                                    prev.medidas,
                                    prev.panelizadoDireccion === "horizontal" ? "horizontal" : "vertical",
                                  )
                                : null,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {getPanelizadoModoLabel(imposicionConfig.panelizadoModo)}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="automatico">Automático</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Dirección de panelizado</p>
                      <Select
                        value={imposicionConfig.panelizadoDireccion ?? "automatica"}
                        onValueChange={(value) => setImposicionConfig((prev) => ({ ...prev, panelizadoDireccion: value as GranFormatoPanelizadoDireccion }))}
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {panelizadoDireccionItems.find((item) => item.value === imposicionConfig.panelizadoDireccion)?.label ?? "Automática"}
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
                      <p className="text-xs text-muted-foreground">Ancho máximo de panel (cm)</p>
                      <Input type="number" min={1} step="0.1" value={formatMmAsCm(imposicionConfig.panelizadoAnchoMaxPanelMm)} onChange={(event) => setImposicionConfig((prev) => ({ ...prev, panelizadoAnchoMaxPanelMm: event.target.value ? Math.max(1, Number(event.target.value) * 10) : null }))} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Interpretar ancho máximo como</p>
                      <Select
                        value={imposicionConfig.panelizadoInterpretacionAnchoMaximo ?? "total"}
                        onValueChange={(value) => setImposicionConfig((prev) => ({ ...prev, panelizadoInterpretacionAnchoMaximo: value as GranFormatoPanelizadoInterpretacionAnchoMaximo }))}
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {getPanelizadoInterpretacionLabel(imposicionConfig.panelizadoInterpretacionAnchoMaximo)}
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
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Distribución de paneles</p>
                      <Select
                        value={imposicionConfig.panelizadoDistribucion ?? "equilibrada"}
                        onValueChange={(value) => setImposicionConfig((prev) => ({ ...prev, panelizadoDistribucion: value as GranFormatoPanelizadoDistribucion }))}
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {panelizadoDistribucionItems.find((item) => item.value === imposicionConfig.panelizadoDistribucion)?.label ?? "Equilibrada"}
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
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Solape por panel (mm)</p>
                      <Input type="number" min={0} value={imposicionConfig.panelizadoSolapeMm ?? ""} onChange={(event) => setImposicionConfig((prev) => ({ ...prev, panelizadoSolapeMm: event.target.value ? Math.max(0, Number(event.target.value)) : null }))} />
                    </div>
                  </div>
                </div>
              ) : null}
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
                      <p className="text-xs text-muted-foreground">Máquina: {formatMmAsCm(item.machineMm)} cm</p>
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
                        <p className="mt-2 text-xs text-muted-foreground">{overrideValue != null ? "Override activo" : "Usando valor heredado de máquina"}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 rounded-xl border bg-background p-4">
                <div className="mb-4">
                  <h5 className="text-sm font-semibold">Márgenes entre piezas para impresión</h5>
                  <p className="text-sm text-muted-foreground">Definí la separación técnica mínima entre piezas dentro del nesting.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Separación horizontal (mm)</p>
                    <Input type="number" min={0} value={imposicionConfig.separacionHorizontalMm} onChange={(event) => setImposicionConfig((prev) => ({ ...prev, separacionHorizontalMm: Math.max(0, Number(event.target.value || 0)) }))} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Separación vertical (mm)</p>
                    <Input type="number" min={0} value={imposicionConfig.separacionVerticalMm} onChange={(event) => setImposicionConfig((prev) => ({ ...prev, separacionVerticalMm: Math.max(0, Number(event.target.value || 0)) }))} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ProductoTabSection>

        <ProductoTabSection
          title="Simulador de imposición"
          description="Cargá medidas reales del trabajo, aplicá opcionales y evaluá cómo responde el producto frente a cada ancho de rollo disponible."
          icon={TrophyIcon}
          actions={
            <Button type="button" className="gap-2 self-start bg-orange-500 text-white hover:bg-orange-500/90" disabled={isSimulatingImposicion} onClick={handleSimularImposicion}>
              <PrinterIcon className="size-4" />
              Simular imposición
            </Button>
          }
        >
          <div className="space-y-5">
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
                  <div key={`medida-${index}`} className="grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto_auto] md:items-end">
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
                            next[index] = { ...next[index], anchoMm: event.target.value ? Number(event.target.value) * 10 : null };
                            const first = next[0] ?? createGranFormatoImposicionMedida();
                            return { ...prev, medidas: next, piezaAnchoMm: first.anchoMm, piezaAltoMm: first.altoMm, cantidadReferencia: first.cantidad };
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
                            next[index] = { ...next[index], altoMm: event.target.value ? Number(event.target.value) * 10 : null };
                            const first = next[0] ?? createGranFormatoImposicionMedida();
                            return { ...prev, medidas: next, piezaAnchoMm: first.anchoMm, piezaAltoMm: first.altoMm, cantidadReferencia: first.cantidad };
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
                            next[index] = { ...next[index], cantidad: Math.max(1, Number(event.target.value || 1)) };
                            const first = next[0] ?? createGranFormatoImposicionMedida();
                            return { ...prev, medidas: next, piezaAnchoMm: first.anchoMm, piezaAltoMm: first.altoMm, cantidadReferencia: first.cantidad };
                          })
                        }
                      />
                    </div>
                    <div className="flex md:justify-end">
                      <Button type="button" variant="ghost" size="icon" aria-label="Agregar nueva medida" onClick={() => setImposicionConfig((prev) => ({ ...prev, medidas: [...prev.medidas, createGranFormatoImposicionMedida()] }))}>
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
                            return { ...prev, medidas: safe, piezaAnchoMm: first.anchoMm, piezaAltoMm: first.altoMm, cantidadReferencia: first.cantidad };
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
                <h4 className="text-sm font-semibold">Opcionales para simular</h4>
                <p className="text-sm text-muted-foreground">
                  Estas respuestas pueden sumar costos, materiales o modificar la medida efectiva del trabajo antes de imponer.
                </p>
              </div>
              <ProductoServicioChecklistCotizador checklist={checklistCotizadorImposicion} value={imposicionChecklistRespuestas} onChange={setImposicionChecklistRespuestas} />
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
                    {imposicionPreviewResult.medidasOriginales.length > 0 ? (
                      <div className="rounded-lg border bg-background p-4 text-sm">
                        <p><span className="font-medium">Original:</span> {formatMeasureSummary(imposicionPreviewResult.medidasOriginales)}</p>
                        <p><span className="font-medium">Efectiva:</span> {formatMeasureSummary(imposicionPreviewResult.medidasEfectivas)}</p>
                        {imposicionPreviewResult.mutacionesAplicadas.length > 0 ? (
                          <div className="mt-2 space-y-1 text-muted-foreground">
                            {imposicionPreviewResult.mutacionesAplicadas.map((item) => (
                              <p key={`${item.reglaId}-${item.respuestaId}`}>{formatChecklistMutationSummary(item)}</p>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-muted-foreground">No se aplicaron mutaciones sobre la medida.</p>
                        )}
                      </div>
                    ) : null}
                    <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                      {imposicionPreviewResult.machineIssue ??
                        (imposicionRejectedVariants.length > 0
                          ? "No se pudo resolver la imposición con la configuración actual."
                          : "No hay variantes de material disponibles para evaluar.")}
                    </div>
                  </div>
                ) : (
                  <>
                    {isImposicionSimulationStale ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Hay cambios sin simular. El resultado mostrado corresponde a la última simulación ejecutada.
                      </div>
                    ) : null}
                    {imposicionPreviewResult.medidasOriginales.length > 0 ? (
                      <div className="rounded-lg border bg-background p-4 text-sm">
                        <p><span className="font-medium">Original:</span> {formatMeasureSummary(imposicionPreviewResult.medidasOriginales)}</p>
                        <p><span className="font-medium">Efectiva:</span> {formatMeasureSummary(imposicionPreviewResult.medidasEfectivas)}</p>
                        {imposicionPreviewResult.mutacionesAplicadas.length > 0 ? (
                          <div className="mt-2 space-y-1 text-muted-foreground">
                            {imposicionPreviewResult.mutacionesAplicadas.map((item) => (
                              <p key={`${item.reglaId}-${item.respuestaId}`}>{formatChecklistMutationSummary(item)}</p>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-muted-foreground">No se aplicaron mutaciones sobre la medida.</p>
                        )}
                      </div>
                    ) : null}

                    {!isHybridImposicion && imposicionBestCandidate ? (
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
                                  <span className="rounded border px-2 py-0.5 text-xs">{imposicionBestCandidate.variant.sku}</span>
                                )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {!isHybridImposicion && selectedPreviewCandidate ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setImposicion3dPreview(null);
                            setImposicion3dTitle("Visualización 3D del nesting");
                            setIsImposicion3dOpen(true);
                          }}
                        >
                          Ver nesting 3D
                        </Button>
                        {selectedPreviewCandidate?.panelizado ? (
                          <Button type="button" variant="outline" onClick={handleOpenPanelEditor}>
                            Editar paneles
                          </Button>
                        ) : null}
                      </div>
                    ) : null}

                    {isHybridImposicion ? (
                      <div className="space-y-4">
                        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-950">
                          Esta imposición se resolvió como una simulación híbrida. El resultado principal ahora está organizado por corridas consolidadas y no por candidatos sueltos por rollo.
                        </div>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-semibold">Corridas resultantes</p>
                            <p className="text-xs text-muted-foreground">
                              Cada corrida agrupa grupos completos y/o panelizados que comparten la misma variante exacta del rollo.
                            </p>
                          </div>
                          {imposicionCorridasTrabajo.map((corrida, corridaIndex) => {
                            const groups = groupsByCorrida[corrida.corridaId] ?? [];
                            const isOpen = expandedCorridas[corrida.corridaId] === true;
                            return (
                              <Collapsible
                                key={corrida.corridaId}
                                open={isOpen}
                                onOpenChange={(open) =>
                                  setExpandedCorridas((prev) => ({ ...prev, [corrida.corridaId]: open }))
                                }
                              >
                                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5">
                                  <div className="flex items-start justify-between gap-3 p-4">
                                    <CollapsibleTrigger className="flex min-w-0 flex-1 cursor-pointer items-start justify-between gap-3 text-left">
                                      <div className="space-y-3">
                                        <div className="space-y-1">
                                          <p className="text-sm font-semibold">Corrida {corridaIndex + 1}</p>
                                          <p className="text-sm text-muted-foreground">Variante de rollo: {corrida.varianteNombre}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {corrida.varianteChips.map((chip) => (
                                            <Badge key={`${corrida.corridaId}-${chip.label}-${chip.value}`} variant="outline">
                                              {chip.label}: {chip.value}
                                            </Badge>
                                          ))}
                                          <Badge variant="secondary">Grupos: {corrida.groupCount}</Badge>
                                          <Badge variant="secondary">Completos: {corrida.gruposCompletos}</Badge>
                                          <Badge variant="secondary">Panelizados: {corrida.gruposPanelizados}</Badge>
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                          <div className="rounded-lg border bg-background/80 p-3">
                                            <p className="text-xs text-muted-foreground">Piezas en corrida</p>
                                            <p className="mt-1 font-semibold">{corrida.piecesCount}</p>
                                          </div>
                                          <div className="rounded-lg border bg-background/80 p-3">
                                            <p className="text-xs text-muted-foreground">Largo consolidado</p>
                                            <p className="mt-1 font-semibold">{formatMmAsCm(corrida.largoConsumidoMm)} cm</p>
                                          </div>
                                          <div className="rounded-lg border bg-background/80 p-3">
                                            <p className="text-xs text-muted-foreground">Desperdicio</p>
                                            <p className="mt-1 font-semibold">{corrida.desperdicioPct.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%</p>
                                          </div>
                                          <div className="rounded-lg border bg-background/80 p-3">
                                            <p className="text-xs text-muted-foreground">Ancho imprimible</p>
                                            <p className="mt-1 font-semibold">{formatMmAsCm(corrida.anchoImprimibleMm)} cm</p>
                                          </div>
                                        </div>
                                      </div>
                                      <span className="inline-flex items-center gap-1 rounded-md border bg-background/80 px-3 py-2 text-sm">
                                        Ver detalle
                                        <ChevronDownIcon className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                                      </span>
                                    </CollapsibleTrigger>
                                    {corrida.nestingPreview ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleOpenImposicion3d(corrida.nestingPreview, `Visualización 3D · Corrida ${corridaIndex + 1}`)}
                                      >
                                        Ver nesting 3D
                                      </Button>
                                    ) : null}
                                  </div>
                                  <CollapsibleContent className="border-t bg-background/70 p-4">
                                    <div className="space-y-4">
                                      <div>
                                        <p className="text-sm font-semibold">Detalle de composición</p>
                                        <p className="text-xs text-muted-foreground">
                                          Cada grupo explica qué subconjunto salió completo o panelizado dentro de la corrida.
                                        </p>
                                      </div>
                                      <div className="grid gap-3 xl:grid-cols-2">
                                        {groups.map((grupo, groupIndex) => (
                                          <div key={grupo.grupoId} className="rounded-lg border p-4">
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="space-y-1">
                                                <p className="text-sm font-semibold">Grupo {groupIndex + 1}</p>
                                                <p className="text-sm text-muted-foreground">Variante de rollo: {grupo.varianteNombre}</p>
                                              </div>
                                              <div className="flex flex-wrap justify-end gap-2">
                                                <Badge variant={grupo.panelizado ? "default" : "outline"}>
                                                  {grupo.panelizado ? "Panelizado" : "Completo"}
                                                </Badge>
                                                {grupo.nestingPreview ? (
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleOpenImposicion3d(grupo.nestingPreview, `Visualización 3D · Corrida ${corridaIndex + 1} · Grupo ${groupIndex + 1}`)}
                                                  >
                                                    Ver nesting 3D
                                                  </Button>
                                                ) : null}
                                                {grupo.panelizado ? (
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleOpenHybridGroupPanelEditor(grupo)}
                                                  >
                                                    Editar paneles
                                                  </Button>
                                                ) : null}
                                              </div>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                              {grupo.varianteChips.map((chip) => (
                                                <Badge key={`${grupo.grupoId}-${chip.label}-${chip.value}`} variant="outline">
                                                  {chip.label}: {chip.value}
                                                </Badge>
                                              ))}
                                            </div>
                                            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                              <div className="rounded-lg border bg-muted/20 p-3">
                                                <p className="text-xs text-muted-foreground">Piezas asignadas</p>
                                                <p className="mt-1 font-semibold">{grupo.piecesCount}</p>
                                              </div>
                                              <div className="rounded-lg border bg-muted/20 p-3">
                                                <p className="text-xs text-muted-foreground">Largo parcial</p>
                                                <p className="mt-1 font-semibold">{formatMmAsCm(grupo.largoConsumidoMm)} cm</p>
                                              </div>
                                              <div className="rounded-lg border bg-muted/20 p-3">
                                                <p className="text-xs text-muted-foreground">Desperdicio parcial</p>
                                                <p className="mt-1 font-semibold">{grupo.desperdicioPct.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%</p>
                                              </div>
                                              <div className="rounded-lg border bg-muted/20 p-3">
                                                <p className="text-xs text-muted-foreground">Ancho imprimible</p>
                                                <p className="mt-1 font-semibold">{formatMmAsCm(grupo.anchoImprimibleMm)} cm</p>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </CollapsibleContent>
                                </div>
                              </Collapsible>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
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
                            {imposicionPreview.map((item) => {
                              const rowKey = `${item.variant.id}-${item.panelizado ? item.panelAxis ?? "panel" : "normal"}-${item.panelMode ?? "na"}-${Math.round(item.consumedLengthMm)}`;
                              const isSelected =
                                selectedPreviewCandidate != null &&
                                rowKey ===
                                  `${selectedPreviewCandidate.variant.id}-${selectedPreviewCandidate.panelizado ? selectedPreviewCandidate.panelAxis ?? "panel" : "normal"}-${selectedPreviewCandidate.panelMode ?? "na"}-${Math.round(selectedPreviewCandidate.consumedLengthMm)}`;
                              return (
                              <tr
                                key={rowKey}
                                className={`border-t cursor-pointer ${isSelected ? "bg-orange-50" : ""}`}
                                onClick={() => setSelectedPreviewCandidateKey(rowKey)}
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
                                    <p>{item.orientacion === "mixta" ? "Mixta" : item.orientacion === "rotada" ? "Rotada" : "Normal"}</p>
                                    {item.panelizado ? (
                                      <p className="text-xs text-muted-foreground">
                                        {getPanelizadoModoLabel(item.panelMode)} · Panelizado {item.panelAxis === "vertical" ? "vertical" : "horizontal"} · {item.panelCount} paneles · {item.panelDistribution === "libre" ? "Libre" : "Equilibrada"}
                                        {item.panelMaxWidthMm != null ? ` · Máx. ${formatMmAsCm(item.panelMaxWidthMm)} cm` : ""}
                                        {item.panelWidthInterpretation ? ` · ${getPanelizadoInterpretacionLabel(item.panelWidthInterpretation)}` : ""}
                                      </p>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-3 py-2">{item.piecesPerRow}</td>
                                <td className="px-3 py-2">{item.rows}</td>
                                <td className="px-3 py-2">{(item.consumedLengthMm / 1000).toLocaleString("es-AR", { maximumFractionDigits: 3 })} m</td>
                                <td className="px-3 py-2">
                                  {item.wastePct.toLocaleString("es-AR", { maximumFractionDigits: 2 })}% · {item.wasteAreaM2.toLocaleString("es-AR", { maximumFractionDigits: 3 })} m2
                                </td>
                              </tr>
                            )})}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </ProductoTabSection>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Acción final</p>
            <p className="text-xs text-muted-foreground">
              Guardá la configuración técnica de imposición cuando termines de revisar defaults, medidas y panelizado.
            </p>
          </div>
          <Button type="button" onClick={handleSaveConfig} disabled={isSavingConfig || isLoadingConfig || !isConfigDirty}>
            {isSavingConfig ? <GdiSpinner className="size-4" data-icon="inline-start" /> : <SaveIcon className="size-4" data-icon="inline-start" />}
            Guardar cambios
          </Button>
        </div>
      </CardContent>
      <WideFormatPanelEditorSheet
        open={isPanelEditorOpen}
        onOpenChange={(open) => {
          setIsPanelEditorOpen(open);
          if (!open) setPanelEditorSelection(null);
        }}
        context="imposicion"
        initialLayout={panelEditorSelection?.initialLayout ?? imposicionManualLayoutActual}
        currentMode={imposicionConfig.panelizadoModo}
        printableWidthMm={panelEditorSelection?.printableWidthMm ?? panelEditorPrintableWidthMm}
        panelizadoSolapeMm={imposicionConfig.panelizadoSolapeMm}
        panelizadoDistribucion={imposicionConfig.panelizadoDistribucion}
        panelizadoAnchoMaxPanelMm={imposicionConfig.panelizadoAnchoMaxPanelMm}
        panelizadoInterpretacionAnchoMaximo={imposicionConfig.panelizadoInterpretacionAnchoMaximo}
        onApply={handleApplyPanelEditor}
        onRestoreAutomatic={handleRestoreAutomaticPanelLayout}
      />
      <Sheet open={isImposicion3dOpen} onOpenChange={setIsImposicion3dOpen}>
        <SheetContent side="right" className="!w-[72vw] !max-w-none md:!w-[68vw] lg:!w-[64vw] xl:!w-[62vw] sm:!max-w-none">
          <SheetHeader>
            <SheetTitle>{imposicion3dTitle}</SheetTitle>
            <SheetDescription>
              Render del candidato seleccionado, con márgenes no imprimibles y distribución de piezas sobre el rollo.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            {imposicion3dPreview ? (
              <WideFormatNestingCard
                title={imposicion3dTitle}
                description="Representación visual del resultado seleccionado sobre el rollo y el área imprimible."
                simulator={buildWideFormatSimulatorDataFromPreview(imposicion3dPreview)}
              />
            ) : selectedPreviewCandidate ? (
              <WideFormatNestingCard
                title={imposicion3dTitle}
                description="Representación visual del candidato seleccionado sobre el rollo y el área imprimible."
                simulator={buildWideFormatSimulatorDataFromCandidate(selectedPreviewCandidate)}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
