"use client";

import * as React from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EraserIcon,
  InfoIcon,
  ListRestartIcon,
  PencilIcon,
  PlusIcon,
  RefreshCcwIcon,
  SearchIcon,
  Settings2Icon,
  ToggleLeftIcon,
} from "lucide-react";
import { toast } from "sonner";

import { getCentrosCosto } from "@/lib/costos-api";
import type { CentroCosto } from "@/lib/costos";
import { getMaquinas } from "@/lib/maquinaria-api";
import type { Maquina, PlantillaMaquinaria } from "@/lib/maquinaria";
import {
  getPlantillaMaquinariaLabel,
  plantillaMaquinariaItems,
} from "@/lib/maquinaria-templates";
import {
  getProcesoTemplateBase,
  type ProcesoTemplateOperation,
} from "@/lib/procesos-templates";
import {
  createProcesoOperacionPlantilla,
  createProceso,
  evaluarProcesoCosto,
  getProcesoOperacionPlantillas,
  getProcesos,
  toggleProcesoOperacionPlantilla,
  updateProcesoOperacionPlantilla,
  type ProcesoCostoSnapshot,
  toggleProceso,
  updateProceso,
} from "@/lib/procesos-api";
import {
  estadoConfiguracionProcesoItems,
  modoProductividadProcesoItems,
  type Proceso,
  type ProcesoOperacionPlantilla,
  type ProcesoOperacionPlantillaPayload,
  type ProcesoOperacionPayload,
  type ProcesoPayload,
  tipoOperacionProcesoItems,
  tipoProcesoItems,
  unidadProcesoItems,
  type TipoProceso,
} from "@/lib/procesos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ProcesosPanelProps = {
  initialProcesos: Proceso[];
  initialBibliotecaOperaciones: ProcesoOperacionPlantilla[];
  centrosCosto: CentroCosto[];
  maquinas: Maquina[];
};

type LocalOperacion = ProcesoOperacionPayload & {
  id: string;
  reglaVelocidadTexto?: string;
  advancedMode?: boolean;
  mermaRuleMode?: "fija" | "por_tirada";
  mermaTiers?: Array<{
    id: string;
    minTirada?: number;
    maxTirada?: number;
    mermaPct?: number;
  }>;
};

type FormState = {
  codigo: string;
  nombre: string;
  descripcion: string;
  tipoProceso: TipoProceso;
  plantillaMaquinaria: PlantillaMaquinaria | "";
  activo: boolean;
  observaciones: string;
  operaciones: LocalOperacion[];
};

type BibliotecaFormState = {
  nombre: string;
  tipoProceso: TipoProceso;
  tipoOperacion: ProcesoOperacionPayload["tipoOperacion"];
  centroCostoId: string;
  maquinaId: string;
  perfilOperativoId: string;
  setupMin?: number;
  cleanupMin?: number;
  modoProductividad: ProcesoOperacionPayload["modoProductividad"];
  productividadBase?: number;
  unidadEntrada: ProcesoOperacionPayload["unidadEntrada"];
  unidadSalida: ProcesoOperacionPayload["unidadSalida"];
  unidadTiempo: ProcesoOperacionPayload["unidadTiempo"];
  mermaRunPct?: number;
  activo: boolean;
  observaciones: string;
};

const EMPTY_SELECT_VALUE = "__none__";
const DEFAULT_PLANTILLA: PlantillaMaquinaria = "impresora_laser";

function buildSystemOperacionCodigo(index: number) {
  return `OP-${String(index + 1).padStart(3, "0")}`;
}

function buildDefaultOperacion(index = 0): LocalOperacion {
  return {
    id: crypto.randomUUID(),
    nombre: "",
    tipoOperacion: "impresion",
    centroCostoId: "",
    modoProductividad: "fija",
    unidadEntrada: "ninguna",
    unidadSalida: "ninguna",
    unidadTiempo: "minuto",
    reglaVelocidadTexto: "",
    advancedMode: false,
    mermaRuleMode: "fija",
    mermaTiers: [],
    activo: true,
    orden: index + 1,
  };
}

function buildOperacionFromTemplate(
  templateOperation: ProcesoTemplateOperation,
  index: number,
): LocalOperacion {
  return {
    id: crypto.randomUUID(),
    nombre: templateOperation.nombre || "",
    tipoOperacion: templateOperation.tipoOperacion || "impresion",
    centroCostoId: "",
    maquinaId: undefined,
    perfilOperativoId: undefined,
    modoProductividad: templateOperation.modoProductividad || "fija",
    unidadEntrada: templateOperation.unidadEntrada || "ninguna",
    unidadSalida: templateOperation.unidadSalida || "ninguna",
    unidadTiempo: "minuto",
    reglaVelocidadTexto: "",
    advancedMode: false,
    mermaRuleMode: "fija",
    mermaTiers: [],
    activo: templateOperation.activo ?? true,
    orden: index + 1,
  };
}

function buildOperacionFromBiblioteca(
  template: ProcesoOperacionPlantilla,
  index: number,
  maquinas: Maquina[],
): LocalOperacion {
  const maquina = template.maquinaId
    ? maquinas.find((item) => item.id === template.maquinaId)
    : null;
  const perfil = template.perfilOperativoId
    ? maquina?.perfilesOperativos.find((item) => item.id === template.perfilOperativoId)
    : null;
  const mappedUnit = mapMachineUnitToProceso(
    perfil?.unidadProductividad || maquina?.unidadProduccionPrincipal || "",
  );
  const unidadSalida =
    template.unidadSalida !== "ninguna"
      ? template.unidadSalida
      : (mappedUnit?.unidadSalida ?? "ninguna");
  const unidadTiempo =
    template.unidadTiempo !== "minuto" || template.unidadSalida !== "ninguna"
      ? template.unidadTiempo
      : (mappedUnit?.unidadTiempo ?? template.unidadTiempo);
  const setupMin = template.setupMin ?? getSetupFromPerfil(perfil);
  const productividadBase = template.productividadBase ?? (perfil?.productividad ?? undefined);

  return {
    id: crypto.randomUUID(),
    nombre: template.nombre,
    tipoOperacion: template.tipoOperacion,
    centroCostoId: maquina?.centroCostoPrincipalId ?? template.centroCostoId ?? "",
    maquinaId: template.maquinaId ?? undefined,
    perfilOperativoId: template.perfilOperativoId ?? undefined,
    modoProductividad: template.perfilOperativoId ? "fija" : template.modoProductividad,
    setupMin,
    cleanupMin: template.cleanupMin ?? undefined,
    productividadBase,
    unidadEntrada: template.unidadEntrada || "ninguna",
    unidadSalida,
    unidadTiempo,
    mermaRunPct: template.mermaRunPct ?? undefined,
    reglaVelocidadTexto: toPrettyJson(template.reglaVelocidad ?? undefined),
    mermaRuleMode: "fija",
    mermaTiers: [],
    advancedMode: false,
    activo: template.activo,
    orden: index + 1,
  };
}

function createEmptyForm(
  tipoProceso: TipoProceso = "maquinaria",
  plantilla: PlantillaMaquinaria = DEFAULT_PLANTILLA,
): FormState {
  const plantillaMaquinaria = tipoProceso === "manual" ? "" : plantilla;
  const template =
    plantillaMaquinaria !== "" ? getProcesoTemplateBase(plantillaMaquinaria) : null;
  const operaciones =
    template?.operations.map((operation, index) =>
      buildOperacionFromTemplate(operation, index),
    ) ?? [buildDefaultOperacion()];

  return {
    codigo: "",
    nombre: "",
    descripcion: "",
    tipoProceso,
    plantillaMaquinaria,
    activo: true,
    observaciones: "",
    operaciones,
  };
}

function createEmptyBibliotecaForm(): BibliotecaFormState {
  return {
    nombre: "",
    tipoProceso: "maquinaria",
    tipoOperacion: "impresion",
    centroCostoId: "",
    maquinaId: "",
    perfilOperativoId: "",
    modoProductividad: "fija",
    unidadEntrada: "ninguna",
    unidadSalida: "ninguna",
    unidadTiempo: "minuto",
    activo: true,
    observaciones: "",
  };
}

function toOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getPlantillaProcesoLabel(plantilla: PlantillaMaquinaria | null) {
  if (!plantilla) {
    return "No aplica";
  }

  return getPlantillaMaquinariaLabel(plantilla);
}

function getTipoProcesoLabel(tipoProceso: TipoProceso) {
  return tipoProcesoItems.find((item) => item.value === tipoProceso)?.label ?? tipoProceso;
}

function getTipoOperacionLabel(tipoOperacion: ProcesoOperacionPayload["tipoOperacion"]) {
  return (
    tipoOperacionProcesoItems.find((item) => item.value === tipoOperacion)?.label ??
    tipoOperacion
  );
}

function getEstadoConfiguracionProcesoLabel(
  estado: Proceso["estadoConfiguracion"],
) {
  return (
    estadoConfiguracionProcesoItems.find((item) => item.value === estado)?.label ??
    estado
  );
}

function getUnidadProcesoLabel(value: ProcesoOperacionPayload["unidadEntrada"]) {
  if (!value) {
    return "No aplica";
  }

  return unidadProcesoItems.find((item) => item.value === value)?.label ?? value;
}

function buildProductividadBaseExample(
  unidadSalida: ProcesoOperacionPayload["unidadSalida"],
  unidadTiempo: ProcesoOperacionPayload["unidadTiempo"],
) {
  const salida = getUnidadProcesoLabel(unidadSalida).toLowerCase();
  const tiempo = getUnidadProcesoLabel(unidadTiempo).toLowerCase();

  if (
    !unidadSalida ||
    !unidadTiempo ||
    unidadSalida === "ninguna" ||
    unidadTiempo === "ninguna"
  ) {
    return "Ejemplo: si produces 120 hojas por minuto, ingresa 120.";
  }

  return `Ejemplo: si produces 120 ${salida} por ${tiempo}, ingresa 120.`;
}

function getCurrentPeriodo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function toPrettyJson(value: Record<string, unknown> | undefined) {
  if (!value) {
    return "";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function parseOptionalJson(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return JSON.parse(trimmed) as Record<string, unknown>;
}

function buildEmptyMermaTier() {
  return {
    id: crypto.randomUUID(),
    minTirada: undefined,
    maxTirada: undefined,
    mermaPct: undefined,
  };
}

function parseMermaRuleToBuilder(rule: Record<string, unknown> | null | undefined): {
  mode: "fija" | "por_tirada";
  tiers: Array<{
    id: string;
    minTirada?: number;
    maxTirada?: number;
    mermaPct?: number;
  }>;
} {
  if (!rule || rule.tipo !== "tabla_v1") {
    return { mode: "fija", tiers: [] };
  }

  const ejes = Array.isArray(rule.ejes) ? rule.ejes : [];
  const hasTiradaAxis = ejes.some(
    (axis) =>
      axis &&
      typeof axis === "object" &&
      !Array.isArray(axis) &&
      (axis as { key?: unknown }).key === "tirada",
  );
  if (!hasTiradaAxis) {
    return { mode: "fija", tiers: [] };
  }

  const filas = Array.isArray(rule.filas) ? rule.filas : [];
  const tiers = filas.flatMap((fila) => {
      if (!fila || typeof fila !== "object" || Array.isArray(fila)) {
        return [];
      }

      const typedFila = fila as {
        tirada?: { min?: unknown; max?: unknown };
        mermaRunPct?: unknown;
      };
      const range = typedFila.tirada ?? {};
      const minTirada =
        typeof range.min === "number" && Number.isFinite(range.min)
          ? range.min
          : undefined;
      const maxTirada =
        typeof range.max === "number" && Number.isFinite(range.max)
          ? range.max
          : undefined;
      const mermaPct =
        typeof typedFila.mermaRunPct === "number" && Number.isFinite(typedFila.mermaRunPct)
          ? typedFila.mermaRunPct
          : undefined;

      return [
        {
          id: crypto.randomUUID(),
          minTirada,
          maxTirada,
          mermaPct,
        },
      ];
    });

  return {
    mode: tiers.length ? "por_tirada" : "fija",
    tiers,
  };
}

function buildMermaRuleFromBuilder(
  mode: "fija" | "por_tirada",
  tiers: Array<{
    minTirada?: number;
    maxTirada?: number;
    mermaPct?: number;
  }>,
  fallbackMermaPct?: number,
) {
  if (mode !== "por_tirada") {
    return undefined;
  }

  const filas = tiers
    .filter(
      (tier) =>
        tier.mermaPct !== undefined &&
        (tier.minTirada !== undefined || tier.maxTirada !== undefined),
    )
    .map((tier) => ({
      tirada: {
        min: tier.minTirada,
        max: tier.maxTirada,
      },
      mermaRunPct: tier.mermaPct,
    }));

  if (!filas.length) {
    return undefined;
  }

  return {
    tipo: "tabla_v1",
    target: "merma_run_pct",
    ejes: [{ key: "tirada", type: "number_range" }],
    filas,
    fallback: {
      type: "const",
      value: fallbackMermaPct ?? 0,
    },
  } as Record<string, unknown>;
}

function getVelocidadRuleExample(
  mode: ProcesoOperacionPayload["modoProductividad"],
): Record<string, unknown> {
  if (mode === "tabla") {
    return {
      tipo: "tabla_v1",
      ejes: [
        { key: "tirada", type: "number_range" },
        { key: "calidad", type: "enum" },
      ],
      filas: [
        {
          tirada: { min: 1, max: 200 },
          calidad: "alta",
          productividad: 85,
        },
        {
          tirada: { min: 201, max: 5000 },
          calidad: "alta",
          productividad: 140,
        },
      ],
      fallback: { type: "productividad_base" },
    };
  }

  return {
    tipo: "formula_v1",
    expresion: {
      op: "mul",
      args: [{ var: "PB" }, { var: "factor_material" }, { var: "factor_calidad" }],
    },
    variables: {
      factor_material: { source: "context", key: "material.factor", default: 1 },
      factor_calidad: { source: "context", key: "calidad.factor", default: 1 },
    },
    bounds: { min: 0.0001 },
  };
}

function mapMachineUnitToProceso(
  unidad:
    | Maquina["perfilesOperativos"][number]["unidadProductividad"]
    | Maquina["unidadProduccionPrincipal"]
    | "",
) {
  if (unidad === "ppm") {
    return { unidadSalida: "copia" as const, unidadTiempo: "minuto" as const };
  }

  if (unidad === "m2_h") {
    return { unidadSalida: "m2" as const, unidadTiempo: "hora" as const };
  }

  if (unidad === "piezas_h") {
    return { unidadSalida: "pieza" as const, unidadTiempo: "hora" as const };
  }

  return null;
}

function getSetupFromPerfil(
  perfil: Maquina["perfilesOperativos"][number] | null | undefined,
) {
  if (!perfil) {
    return undefined;
  }

  const parseFiniteNumber = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  };

  const detalle = perfil.detalle ?? {};
  const setupFromPreparacion =
    parseFiniteNumber(perfil.setupEstimadoMin) ??
    parseFiniteNumber(perfil.tiempoPreparacionMin) ??
    parseFiniteNumber(detalle.tiempoPreparacionMin) ??
    parseFiniteNumber(detalle.tiempoSetupMin) ??
    parseFiniteNumber(detalle.setupMin) ??
    parseFiniteNumber(detalle.setup);
  if (setupFromPreparacion !== undefined) {
    return setupFromPreparacion;
  }

  const setupParts = [
    parseFiniteNumber(perfil.tiempoRipMin) ?? parseFiniteNumber(detalle.tiempoRipMin),
  ].filter((value): value is number => value !== undefined);

  if (!setupParts.length) {
    return undefined;
  }

  const total = setupParts.reduce((acc, value) => acc + value, 0);
  return Number.isFinite(total) ? total : undefined;
}

function renderTooltipIcon(text?: string) {
  if (!text) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger>
        <span
          role="img"
          aria-label="Informacion del campo"
          className="inline-flex items-center text-muted-foreground hover:text-foreground"
        >
          <InfoIcon className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function ProcesosPanel({
  initialProcesos,
  initialBibliotecaOperaciones,
  centrosCosto,
  maquinas,
}: ProcesosPanelProps) {
  const [procesos, setProcesos] = React.useState(initialProcesos);
  const [bibliotecaOperaciones, setBibliotecaOperaciones] = React.useState(
    initialBibliotecaOperaciones,
  );
  const [bibliotecaSearchTerm, setBibliotecaSearchTerm] = React.useState("");
  const [showInactiveBiblioteca, setShowInactiveBiblioteca] = React.useState(false);
  const [showInactiveRutas, setShowInactiveRutas] = React.useState(false);
  const [bibliotecaSheetOpen, setBibliotecaSheetOpen] = React.useState(false);
  const [editingBibliotecaId, setEditingBibliotecaId] = React.useState<string | null>(
    null,
  );
  const [bibliotecaForm, setBibliotecaForm] = React.useState<BibliotecaFormState>(
    () => createEmptyBibliotecaForm(),
  );
  const [allCentrosCosto, setAllCentrosCosto] = React.useState(centrosCosto);
  const [allMaquinas, setAllMaquinas] = React.useState(maquinas);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editingProcesoId, setEditingProcesoId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(() => createEmptyForm());
  const [expandedOperacionId, setExpandedOperacionId] = React.useState<string | null>(
    null,
  );
  const [isRefreshing, startRefreshing] = React.useTransition();
  const [isSaving, startSaving] = React.useTransition();
  const [activeTab, setActiveTab] = React.useState("general");
  const [selectedOperacionTemplateId, setSelectedOperacionTemplateId] =
    React.useState(EMPTY_SELECT_VALUE);
  const [operacionTemplateSearch, setOperacionTemplateSearch] = React.useState("");
  const [isOperacionTemplatePickerOpen, setIsOperacionTemplatePickerOpen] =
    React.useState(false);
  const [evaluacionPeriodo, setEvaluacionPeriodo] = React.useState(getCurrentPeriodo);
  const [evaluacionCantidad, setEvaluacionCantidad] = React.useState("100");
  const [evaluacionResultado, setEvaluacionResultado] =
    React.useState<ProcesoCostoSnapshot | null>(null);
  const [isEvaluando, startEvaluando] = React.useTransition();

  const procesosFiltrados = React.useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();
    const visibles = showInactiveRutas
      ? procesos
      : procesos.filter((proceso) => proceso.activo);

    return visibles.filter((proceso) => {
      if (!normalizedTerm) {
        return true;
      }

      const plantillaLabel = getPlantillaProcesoLabel(proceso.plantillaMaquinaria);
      const tipoProcesoLabel = getTipoProcesoLabel(proceso.tipoProceso);

      return (
        proceso.codigo.toLowerCase().includes(normalizedTerm) ||
        proceso.nombre.toLowerCase().includes(normalizedTerm) ||
        plantillaLabel.toLowerCase().includes(normalizedTerm) ||
        tipoProcesoLabel.toLowerCase().includes(normalizedTerm)
      );
    });
  }, [procesos, searchTerm, showInactiveRutas]);

  const resumen = React.useMemo(() => {
    const activos = procesos.filter((item) => item.activo).length;
    const listos = procesos.filter(
      (item) => item.estadoConfiguracion === "lista",
    ).length;

    return {
      total: procesos.length,
      activos,
      listos,
    };
  }, [procesos]);

  const bibliotecaFiltrada = React.useMemo(() => {
    const normalized = bibliotecaSearchTerm.trim().toLowerCase();
    const visibles = showInactiveBiblioteca
      ? bibliotecaOperaciones
      : bibliotecaOperaciones.filter((item) => item.activo);
    if (!normalized) {
      return visibles;
    }

    return visibles.filter((item) => {
      const tipoLabel = getTipoOperacionLabel(item.tipoOperacion).toLowerCase();
      const tipoProcesoLabel = getTipoProcesoLabel(item.tipoProceso).toLowerCase();
      const centroLabel = item.centroCostoNombre.toLowerCase();
      const maquinaLabel = item.maquinaNombre.toLowerCase();
      const perfilLabel = item.perfilOperativoNombre.toLowerCase();
      return (
        item.nombre.toLowerCase().includes(normalized) ||
        tipoLabel.includes(normalized) ||
        tipoProcesoLabel.includes(normalized) ||
        centroLabel.includes(normalized) ||
        maquinaLabel.includes(normalized) ||
        perfilLabel.includes(normalized)
      );
    });
  }, [bibliotecaOperaciones, bibliotecaSearchTerm, showInactiveBiblioteca]);

  const maquinasCompatibles = React.useMemo(() => {
    if (form.tipoProceso !== "maquinaria" || !form.plantillaMaquinaria) {
      return allMaquinas;
    }

    return allMaquinas.filter(
      (maquina) => maquina.plantilla === form.plantillaMaquinaria,
    );
  }, [allMaquinas, form.plantillaMaquinaria, form.tipoProceso]);

  const bibliotecaMaquinas = React.useMemo(() => {
    if (bibliotecaForm.tipoProceso !== "maquinaria") {
      return [];
    }

    return allMaquinas;
  }, [allMaquinas, bibliotecaForm.tipoProceso]);

  const bibliotecaMaquinaSeleccionada = React.useMemo(() => {
    if (!bibliotecaForm.maquinaId) {
      return null;
    }

    return allMaquinas.find((item) => item.id === bibliotecaForm.maquinaId) ?? null;
  }, [allMaquinas, bibliotecaForm.maquinaId]);

  const bibliotecaPerfilSeleccionado = React.useMemo(() => {
    if (!bibliotecaMaquinaSeleccionada || !bibliotecaForm.perfilOperativoId) {
      return null;
    }

    return (
      bibliotecaMaquinaSeleccionada.perfilesOperativos.find(
        (item) => item.id === bibliotecaForm.perfilOperativoId,
      ) ?? null
    );
  }, [bibliotecaForm.perfilOperativoId, bibliotecaMaquinaSeleccionada]);

  const bibliotecaCentroBloqueado = Boolean(
    bibliotecaForm.maquinaId && bibliotecaMaquinaSeleccionada?.centroCostoPrincipalId,
  );

  const operationTemplateItems = React.useMemo(() => {
    return bibliotecaOperaciones.filter((item) => {
      if (!item.activo) {
        return false;
      }

      if (form.tipoProceso === "mixto") {
        return true;
      }

      return item.tipoProceso === form.tipoProceso;
    });
  }, [bibliotecaOperaciones, form.tipoProceso]);

  const filteredOperationTemplateItems = React.useMemo(() => {
    const normalized = operacionTemplateSearch.trim().toLowerCase();
    if (!normalized) {
      return operationTemplateItems;
    }

    return operationTemplateItems.filter((item) => {
      const tipoLabel = getTipoOperacionLabel(item.tipoOperacion).toLowerCase();
      const tipoProcesoLabel = getTipoProcesoLabel(item.tipoProceso).toLowerCase();
      const centroLabel = item.centroCostoNombre.toLowerCase();
      const maquinaLabel = item.maquinaNombre.toLowerCase();
      const perfilLabel = item.perfilOperativoNombre.toLowerCase();
      return (
        item.nombre.toLowerCase().includes(normalized) ||
        tipoLabel.includes(normalized) ||
        tipoProcesoLabel.includes(normalized) ||
        centroLabel.includes(normalized) ||
        maquinaLabel.includes(normalized) ||
        perfilLabel.includes(normalized)
      );
    });
  }, [operacionTemplateSearch, operationTemplateItems]);

  const selectedOperacionTemplate = React.useMemo(
    () =>
      operationTemplateItems.find((item) => item.id === selectedOperacionTemplateId) ?? null,
    [operationTemplateItems, selectedOperacionTemplateId],
  );

  const shouldShowOperacionTemplateResults =
    isOperacionTemplatePickerOpen && operacionTemplateSearch.trim().length > 0;

  React.useEffect(() => {
    if (
      selectedOperacionTemplateId !== EMPTY_SELECT_VALUE &&
      !operationTemplateItems.some(
        (item) => item.id === selectedOperacionTemplateId,
      )
    ) {
      setSelectedOperacionTemplateId(EMPTY_SELECT_VALUE);
    }
  }, [operationTemplateItems, selectedOperacionTemplateId]);

  React.useEffect(() => {
    if (bibliotecaForm.tipoProceso !== "maquinaria") {
      if (bibliotecaForm.maquinaId || bibliotecaForm.perfilOperativoId) {
        setBibliotecaForm((prev) => ({
          ...prev,
          maquinaId: "",
          perfilOperativoId: "",
        }));
      }
      return;
    }

    if (
      bibliotecaForm.perfilOperativoId &&
      !bibliotecaMaquinaSeleccionada?.perfilesOperativos.some(
        (perfil) => perfil.id === bibliotecaForm.perfilOperativoId,
      )
    ) {
      setBibliotecaForm((prev) => ({
        ...prev,
        perfilOperativoId: "",
      }));
    }
  }, [
    bibliotecaForm.maquinaId,
    bibliotecaForm.perfilOperativoId,
    bibliotecaForm.tipoProceso,
    bibliotecaMaquinaSeleccionada,
  ]);

  React.useEffect(() => {
    if (bibliotecaForm.tipoProceso !== "maquinaria") {
      return;
    }

    if (!bibliotecaMaquinaSeleccionada) {
      return;
    }

    const mappedUnit = mapMachineUnitToProceso(
      bibliotecaPerfilSeleccionado?.unidadProductividad ||
        bibliotecaMaquinaSeleccionada.unidadProduccionPrincipal ||
        "",
    );
    const shouldSetUnitSalida =
      !bibliotecaForm.unidadSalida || bibliotecaForm.unidadSalida === "ninguna";
    const shouldSetUnitTiempo =
      !bibliotecaForm.unidadTiempo ||
      (bibliotecaForm.unidadTiempo === "minuto" && shouldSetUnitSalida);

    setBibliotecaForm((prev) => {
      const setupFromPerfil = getSetupFromPerfil(bibliotecaPerfilSeleccionado);
      const next = {
        ...prev,
        centroCostoId:
          bibliotecaMaquinaSeleccionada.centroCostoPrincipalId ?? prev.centroCostoId,
        setupMin:
          prev.perfilOperativoId && bibliotecaPerfilSeleccionado
            ? setupFromPerfil
            : prev.setupMin,
        productividadBase:
          prev.perfilOperativoId && bibliotecaPerfilSeleccionado
            ? (bibliotecaPerfilSeleccionado.productividad ?? prev.productividadBase)
            : prev.productividadBase,
        modoProductividad:
          prev.perfilOperativoId ? "fija" : prev.modoProductividad,
        unidadSalida:
          shouldSetUnitSalida && mappedUnit ? mappedUnit.unidadSalida : prev.unidadSalida,
        unidadTiempo:
          shouldSetUnitTiempo && mappedUnit ? mappedUnit.unidadTiempo : prev.unidadTiempo,
      };

      if (
        next.centroCostoId === prev.centroCostoId &&
        next.setupMin === prev.setupMin &&
        next.productividadBase === prev.productividadBase &&
        next.modoProductividad === prev.modoProductividad &&
        next.unidadSalida === prev.unidadSalida &&
        next.unidadTiempo === prev.unidadTiempo
      ) {
        return prev;
      }

      return next;
    });
  }, [
    bibliotecaForm.tipoProceso,
    bibliotecaForm.unidadSalida,
    bibliotecaForm.unidadTiempo,
    bibliotecaMaquinaSeleccionada,
    bibliotecaPerfilSeleccionado,
  ]);

  const getPerfilOperativo = React.useCallback(
    (maquinaId?: string, perfilId?: string) => {
      if (!maquinaId || !perfilId) {
        return null;
      }

      const maquina = allMaquinas.find((item) => item.id === maquinaId);
      if (!maquina) {
        return null;
      }

      return maquina.perfilesOperativos.find((item) => item.id === perfilId) ?? null;
    },
    [allMaquinas],
  );

  const getMaquina = React.useCallback(
    (maquinaId?: string) => {
      if (!maquinaId) {
        return null;
      }

      return allMaquinas.find((item) => item.id === maquinaId) ?? null;
    },
    [allMaquinas],
  );

  const reloadAll = React.useCallback(() => {
    startRefreshing(async () => {
      try {
        const [nextProcesos, nextCentros, nextMaquinas, nextBiblioteca] = await Promise.all([
          getProcesos(),
          getCentrosCosto(),
          getMaquinas(),
          getProcesoOperacionPlantillas(),
        ]);
        setProcesos(nextProcesos);
        setAllCentrosCosto(nextCentros);
        setAllMaquinas(nextMaquinas);
        setBibliotecaOperaciones(nextBiblioteca);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo refrescar rutas de produccion.",
        );
      }
    });
  }, []);

  const openCreateSheet = React.useCallback(() => {
    setEditingProcesoId(null);
    const nextForm = createEmptyForm("maquinaria", DEFAULT_PLANTILLA);
    setForm(nextForm);
    setExpandedOperacionId(nextForm.operaciones[0]?.id ?? null);
    setActiveTab("general");
    setSelectedOperacionTemplateId(EMPTY_SELECT_VALUE);
    setOperacionTemplateSearch("");
    setIsOperacionTemplatePickerOpen(false);
    setEvaluacionResultado(null);
    setSheetOpen(true);
  }, []);

  const openEditSheet = React.useCallback(
    (proceso: Proceso) => {
      setEditingProcesoId(proceso.id);
      const nextForm: FormState = {
        codigo: proceso.codigo,
        nombre: proceso.nombre,
        descripcion: proceso.descripcion,
        tipoProceso: proceso.tipoProceso,
        plantillaMaquinaria: proceso.plantillaMaquinaria ?? "",
        activo: proceso.activo,
        observaciones: proceso.observaciones,
        operaciones: proceso.operaciones.map((operacion, index) => {
          const maquina = operacion.maquinaId
            ? allMaquinas.find((item) => item.id === operacion.maquinaId)
            : null;
          const mermaBuilder = parseMermaRuleToBuilder(operacion.reglaMerma ?? undefined);
          const isAdvancedConfigured =
            Boolean(operacion.cleanupMin) ||
            operacion.modoProductividad !== "fija" ||
            Boolean(operacion.reglaVelocidad) ||
            Boolean(operacion.reglaMerma) ||
            operacion.unidadEntrada !== "ninguna" ||
            operacion.unidadSalida !== "ninguna" ||
            operacion.unidadTiempo !== "minuto";

          return {
            id: operacion.id || crypto.randomUUID(),
            nombre: operacion.nombre,
            tipoOperacion: operacion.tipoOperacion,
            centroCostoId:
              operacion.maquinaId && maquina?.centroCostoPrincipalId
                ? maquina.centroCostoPrincipalId
                : operacion.centroCostoId,
            maquinaId: operacion.maquinaId || undefined,
            perfilOperativoId: operacion.perfilOperativoId || undefined,
            orden: operacion.orden ?? index + 1,
            setupMin: operacion.setupMin ?? undefined,
            cleanupMin: operacion.cleanupMin ?? undefined,
            modoProductividad: operacion.modoProductividad,
            productividadBase: operacion.productividadBase ?? undefined,
            unidadEntrada: operacion.unidadEntrada || "ninguna",
            unidadSalida: operacion.unidadSalida || "ninguna",
            unidadTiempo: operacion.unidadTiempo || "minuto",
            mermaRunPct: operacion.mermaRunPct ?? undefined,
            reglaVelocidadTexto: toPrettyJson(operacion.reglaVelocidad ?? undefined),
            mermaRuleMode: mermaBuilder.mode,
            mermaTiers: mermaBuilder.tiers,
            advancedMode: isAdvancedConfigured,
            activo: operacion.activo,
          };
        }),
      };
      setForm(nextForm);
      setExpandedOperacionId(nextForm.operaciones[0]?.id ?? null);
      setActiveTab("general");
      setSelectedOperacionTemplateId(EMPTY_SELECT_VALUE);
      setOperacionTemplateSearch("");
      setIsOperacionTemplatePickerOpen(false);
      setEvaluacionResultado(null);
      setSheetOpen(true);
    },
    [allMaquinas],
  );

  const updateOperacion = React.useCallback(
    (id: string, updater: (prev: LocalOperacion) => LocalOperacion) => {
      setForm((prev) => ({
        ...prev,
        operaciones: prev.operaciones.map((operacion) =>
          operacion.id === id ? updater(operacion) : operacion,
        ),
      }));
    },
    [],
  );

  const removeOperacion = React.useCallback((id: string) => {
    setForm((prev) => {
      if (prev.operaciones.length <= 1) {
        return prev;
      }

      const currentIndex = prev.operaciones.findIndex((item) => item.id === id);
      const nextOperaciones = prev.operaciones.filter((operacion) => operacion.id !== id);
      const fallbackExpanded =
        nextOperaciones[currentIndex] ?? nextOperaciones[currentIndex - 1] ?? nextOperaciones[0];

      setExpandedOperacionId((current) =>
        current === id ? (fallbackExpanded?.id ?? null) : current,
      );

      return {
        ...prev,
        operaciones: nextOperaciones,
      };
    });
  }, []);

  const addOperacion = React.useCallback(() => {
    setForm((prev) => {
      const nextOperacion = buildDefaultOperacion(prev.operaciones.length);
      setExpandedOperacionId(nextOperacion.id);
      return {
        ...prev,
        operaciones: [...prev.operaciones, nextOperacion],
      };
    });
  }, []);

  const addOperacionFromTemplate = React.useCallback(() => {
    if (!selectedOperacionTemplateId || selectedOperacionTemplateId === EMPTY_SELECT_VALUE) {
      toast.error("Selecciona un paso de la biblioteca.");
      return;
    }

    const template = operationTemplateItems.find((item) => item.id === selectedOperacionTemplateId);
    if (!template) {
      toast.error("La plantilla de paso seleccionada no esta disponible.");
      return;
    }

    setForm((prev) => {
      const nextOperacion = buildOperacionFromBiblioteca(
        template,
        prev.operaciones.length,
        allMaquinas,
      );
      setExpandedOperacionId(nextOperacion.id);
      return {
        ...prev,
        operaciones: [...prev.operaciones, nextOperacion],
      };
    });
    setSelectedOperacionTemplateId(EMPTY_SELECT_VALUE);
    setOperacionTemplateSearch("");
    setIsOperacionTemplatePickerOpen(false);
  }, [allMaquinas, operationTemplateItems, selectedOperacionTemplateId]);

  const moveOperacion = React.useCallback((id: string, direction: "up" | "down") => {
    setForm((prev) => {
      const fromIndex = prev.operaciones.findIndex((item) => item.id === id);
      if (fromIndex === -1) {
        return prev;
      }

      const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= prev.operaciones.length) {
        return prev;
      }

      const nextOperaciones = [...prev.operaciones];
      const [moved] = nextOperaciones.splice(fromIndex, 1);
      nextOperaciones.splice(toIndex, 0, moved);

      return {
        ...prev,
        operaciones: nextOperaciones,
      };
    });
    setExpandedOperacionId(id);
  }, []);

  const applyTemplateOperations = React.useCallback(() => {
    if (form.tipoProceso === "manual") {
      toast.error("Una ruta manual no usa plantilla de maquinaria.");
      return;
    }

    if (!form.plantillaMaquinaria) {
      toast.error("Selecciona una plantilla para cargar pasos base.");
      return;
    }

    const template = getProcesoTemplateBase(form.plantillaMaquinaria);
    if (!template) {
      toast.error("La plantilla seleccionada no tiene base de pasos definida.");
      return;
    }

    setForm((prev) => {
      const nextOperaciones = template.operations.map((operation, index) =>
        buildOperacionFromTemplate(operation, index),
      );
      setExpandedOperacionId(nextOperaciones[0]?.id ?? null);
      return {
        ...prev,
        operaciones: nextOperaciones,
      };
    });
  }, [form.plantillaMaquinaria, form.tipoProceso]);

  const clearTemplateOperations = React.useCallback(() => {
    setForm((prev) => {
      setExpandedOperacionId(null);
      return {
        ...prev,
        operaciones: [],
      };
    });
  }, []);

  const handleTipoProcesoChange = React.useCallback((nextTipoProceso: TipoProceso) => {
    setForm((prev) => {
      const isManual = nextTipoProceso === "manual";
      const nextPlantilla =
        isManual
          ? ""
          : nextTipoProceso === "maquinaria"
            ? prev.plantillaMaquinaria || DEFAULT_PLANTILLA
            : prev.plantillaMaquinaria;

      const nextOperaciones = prev.operaciones.map((operacion) => ({
        ...operacion,
        maquinaId: isManual ? undefined : operacion.maquinaId,
        perfilOperativoId: isManual ? undefined : operacion.perfilOperativoId,
      }));

      return {
        ...prev,
        tipoProceso: nextTipoProceso,
        plantillaMaquinaria: nextPlantilla,
        operaciones: nextOperaciones,
      };
    });
  }, []);

  const handlePlantillaChange = React.useCallback(
    (value: string | null) => {
      const nextPlantilla =
        !value || value === EMPTY_SELECT_VALUE ? "" : (value as PlantillaMaquinaria);

      setForm((prev) => {
        const nextOperaciones = prev.operaciones.map((operacion) => {
          if (!operacion.maquinaId || !nextPlantilla || prev.tipoProceso !== "maquinaria") {
            return operacion;
          }

          const maquina = allMaquinas.find((item) => item.id === operacion.maquinaId);
          if (!maquina || maquina.plantilla === nextPlantilla) {
            return operacion;
          }

          return {
            ...operacion,
            maquinaId: undefined,
            perfilOperativoId: undefined,
          };
        });

        return {
          ...prev,
          plantillaMaquinaria: nextPlantilla,
          operaciones: nextOperaciones,
        };
      });
    },
    [allMaquinas],
  );

  const buildPayload = React.useCallback((): ProcesoPayload | null => {
    if (!form.nombre.trim()) {
      toast.error("El nombre de la ruta es obligatorio.");
      return null;
    }

    if (form.tipoProceso === "maquinaria" && !form.plantillaMaquinaria) {
      toast.error("Las rutas de maquinaria requieren plantilla de maquinaria.");
      return null;
    }

    if (!form.operaciones.length) {
      toast.error("Debes agregar al menos un paso.");
      return null;
    }

    const operations = form.operaciones.map((operacion, index) => ({
      nombre: operacion.nombre.trim(),
      tipoOperacion: operacion.tipoOperacion,
      centroCostoId: operacion.centroCostoId || undefined,
      maquinaId: operacion.maquinaId || undefined,
      perfilOperativoId: operacion.perfilOperativoId || undefined,
      orden: index + 1,
      setupMin: operacion.setupMin,
      cleanupMin: operacion.cleanupMin,
      modoProductividad: operacion.modoProductividad,
      productividadBase: operacion.productividadBase,
      unidadEntrada: operacion.unidadEntrada || "ninguna",
      unidadSalida: operacion.unidadSalida || "ninguna",
      unidadTiempo: operacion.unidadTiempo || "minuto",
      mermaRunPct: operacion.mermaRunPct,
      reglaVelocidad: undefined as Record<string, unknown> | undefined,
      reglaMerma: undefined as Record<string, unknown> | undefined,
      activo: operacion.activo,
    }));

    for (const [index, operacion] of operations.entries()) {
      const source = form.operaciones[index];
      const perfil = getPerfilOperativo(operacion.maquinaId, operacion.perfilOperativoId);
      const maquina = getMaquina(operacion.maquinaId);
      const mappedUnit = mapMachineUnitToProceso(
        perfil?.unidadProductividad || maquina?.unidadProduccionPrincipal || "",
      );

      if (operacion.maquinaId) {
        if (!maquina?.centroCostoPrincipalId) {
          toast.error(
            `La maquina de la operacion ${index + 1} no tiene centro de costo principal configurado.`,
          );
          return null;
        }
        operacion.centroCostoId = maquina.centroCostoPrincipalId;
      }

      if (operacion.productividadBase === undefined && perfil?.productividad !== null) {
        operacion.productividadBase = perfil?.productividad ?? undefined;
      }

      if (operacion.setupMin === undefined) {
        operacion.setupMin = getSetupFromPerfil(perfil);
      }

      if (operacion.perfilOperativoId) {
        operacion.modoProductividad = "fija";
      }

      if ((operacion.unidadSalida === "ninguna" || !operacion.unidadSalida) && mappedUnit) {
        operacion.unidadSalida = mappedUnit.unidadSalida;
      }

      if (
        (!operacion.unidadTiempo || operacion.unidadTiempo === "minuto") &&
        mappedUnit &&
        (source.unidadSalida === "ninguna" || !source.unidadSalida)
      ) {
        operacion.unidadTiempo = mappedUnit.unidadTiempo;
      }

      try {
        operacion.reglaVelocidad = parseOptionalJson(source.reglaVelocidadTexto || "");
      } catch {
        toast.error(`La regla de velocidad de la operacion ${index + 1} no es JSON valido.`);
        return null;
      }

      if (!operacion.nombre) {
        toast.error("Cada paso debe tener nombre.");
        return null;
      }

      if (!operacion.centroCostoId && !operacion.maquinaId) {
        toast.error("Cada paso debe tener centro o maquina con centro principal.");
        return null;
      }

      if (
        form.tipoProceso === "manual" &&
        (operacion.maquinaId || operacion.perfilOperativoId)
      ) {
        toast.error("Una ruta manual no puede guardar maquina ni perfil operativo.");
        return null;
      }

      if (operacion.cleanupMin !== undefined && operacion.cleanupMin < 0) {
        toast.error("Cleanup no puede ser negativo.");
        return null;
      }

      if (operacion.productividadBase !== undefined && operacion.productividadBase < 0) {
        toast.error("Productividad base no puede ser negativa.");
        return null;
      }

      if (operacion.modoProductividad === "fija") {
        if (!operacion.productividadBase || operacion.productividadBase <= 0) {
          toast.error(
            `La operacion ${index + 1} en modo fija requiere Productividad base mayor a 0 (manual o absorbida del perfil).`,
          );
          return null;
        }
      }

      if (operacion.modoProductividad === "formula" && !operacion.reglaVelocidad) {
        toast.error(
          `La operacion ${index + 1} en modo formula requiere una regla de velocidad.`,
        );
        return null;
      }

      if (operacion.modoProductividad === "tabla" && !operacion.reglaVelocidad) {
        toast.error(
          `La operacion ${index + 1} en modo tabla requiere una regla de velocidad.`,
        );
        return null;
      }

      if (
        operacion.mermaRunPct !== undefined &&
        (operacion.mermaRunPct < 0 || operacion.mermaRunPct > 100)
      ) {
        toast.error("Merma debe estar entre 0 y 100.");
        return null;
      }

      const mermaRuleMode = source.mermaRuleMode ?? "fija";
      const mermaTiers = source.mermaTiers ?? [];

      if (mermaRuleMode === "por_tirada") {
        if (!mermaTiers.length) {
          toast.error(
            `La operacion ${index + 1} en merma por tirada requiere al menos un tramo.`,
          );
          return null;
        }

        const normalizedRanges = mermaTiers
          .map((tier, tierIndex) => {
            const min = tier.minTirada;
            const max = tier.maxTirada;
            const mermaPct = tier.mermaPct;

            if (mermaPct === undefined || mermaPct < 0 || mermaPct > 100) {
              toast.error(
                `Tramo ${tierIndex + 1} de merma en operacion ${index + 1} debe tener merma entre 0 y 100.`,
              );
              return null;
            }

            if (min === undefined && max === undefined) {
              toast.error(
                `Tramo ${tierIndex + 1} de merma en operacion ${index + 1} requiere minimo o maximo de tirada.`,
              );
              return null;
            }

            if ((min !== undefined && min < 0) || (max !== undefined && max < 0)) {
              toast.error(
                `Tramo ${tierIndex + 1} de merma en operacion ${index + 1} no admite tirada negativa.`,
              );
              return null;
            }

            if (min !== undefined && max !== undefined && max < min) {
              toast.error(
                `Tramo ${tierIndex + 1} de merma en operacion ${index + 1} tiene rango invalido.`,
              );
              return null;
            }

            return {
              start: min ?? Number.NEGATIVE_INFINITY,
              end: max ?? Number.POSITIVE_INFINITY,
            };
          })
          .filter(
            (item): item is { start: number; end: number } => item !== null,
          )
          .sort((a, b) => a.start - b.start);

        for (let rangeIndex = 1; rangeIndex < normalizedRanges.length; rangeIndex += 1) {
          const previous = normalizedRanges[rangeIndex - 1];
          const current = normalizedRanges[rangeIndex];
          if (current.start <= previous.end) {
            toast.error(
              `Los tramos de merma en operacion ${index + 1} se superponen. Ajusta los rangos.`,
            );
            return null;
          }
        }
      }

      operacion.reglaMerma = buildMermaRuleFromBuilder(
        mermaRuleMode,
        mermaTiers,
        operacion.mermaRunPct,
      );
    }

    return {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || undefined,
      tipoProceso: form.tipoProceso,
      plantillaMaquinaria: form.plantillaMaquinaria || undefined,
      activo: form.activo,
      observaciones: form.observaciones.trim() || undefined,
      operaciones: operations,
    };
  }, [form, getMaquina, getPerfilOperativo]);

  const handleSave = React.useCallback(() => {
    startSaving(async () => {
      const payload = buildPayload();
      if (!payload) {
        return;
      }

      try {
        const saved = editingProcesoId
          ? await updateProceso(editingProcesoId, payload)
          : await createProceso(payload);

        setProcesos((prev) => {
          if (!editingProcesoId) {
            return [...prev, saved].sort((a, b) => a.nombre.localeCompare(b.nombre));
          }

          return prev
            .map((item) => (item.id === editingProcesoId ? saved : item))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
        });

        toast.success(editingProcesoId ? "Ruta actualizada." : "Ruta creada.");
        setSheetOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo guardar la ruta de produccion.",
        );
      }
    });
  }, [buildPayload, editingProcesoId]);

  const handleEvaluarCosto = React.useCallback(() => {
    if (!editingProcesoId) {
      toast.error("Primero guarda la ruta para poder evaluarla.");
      return;
    }

    startEvaluando(async () => {
      const cantidad = Number(evaluacionCantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        toast.error("La cantidad objetivo debe ser mayor a 0.");
        return;
      }

      const contexto: Record<string, unknown> = { tirada: cantidad };

      try {
        const result = await evaluarProcesoCosto(editingProcesoId, {
          periodo: evaluacionPeriodo,
          cantidadObjetivo: cantidad,
          contexto,
        });
        setEvaluacionResultado(result);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo evaluar costo tecnico.",
        );
      }
    });
  }, [editingProcesoId, evaluacionCantidad, evaluacionPeriodo]);

  const handleToggle = React.useCallback((procesoId: string) => {
    startSaving(async () => {
      try {
        const updated = await toggleProceso(procesoId);
        setProcesos((prev) =>
          prev
            .map((item) => (item.id === updated.id ? updated : item))
            .sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo actualizar el estado.",
        );
      }
    });
  }, []);

  const openCreateBibliotecaSheet = React.useCallback(() => {
    setEditingBibliotecaId(null);
    setBibliotecaForm(createEmptyBibliotecaForm());
    setBibliotecaSheetOpen(true);
  }, []);

  const openEditBibliotecaSheet = React.useCallback(
    (item: ProcesoOperacionPlantilla) => {
      setEditingBibliotecaId(item.id);
      setBibliotecaForm({
        nombre: item.nombre,
        tipoProceso: item.tipoProceso,
        tipoOperacion: item.tipoOperacion,
        centroCostoId: item.centroCostoId ?? "",
        maquinaId: item.maquinaId ?? "",
        perfilOperativoId: item.perfilOperativoId ?? "",
        setupMin: item.setupMin ?? undefined,
        cleanupMin: item.cleanupMin ?? undefined,
        modoProductividad: item.modoProductividad,
        productividadBase: item.productividadBase ?? undefined,
        unidadEntrada: item.unidadEntrada,
        unidadSalida: item.unidadSalida,
        unidadTiempo: item.unidadTiempo,
        mermaRunPct: item.mermaRunPct ?? undefined,
        activo: item.activo,
        observaciones: item.observaciones,
      });
      setBibliotecaSheetOpen(true);
    },
    [],
  );

  const buildBibliotecaPayload = React.useCallback(
    (): ProcesoOperacionPlantillaPayload | null => {
      if (!bibliotecaForm.nombre.trim()) {
        toast.error("Nombre de plantilla es obligatorio.");
        return null;
      }

      if (bibliotecaForm.setupMin !== undefined && bibliotecaForm.setupMin < 0) {
        toast.error("Setup no puede ser negativo.");
        return null;
      }

      if (bibliotecaForm.cleanupMin !== undefined && bibliotecaForm.cleanupMin < 0) {
        toast.error("Cleanup no puede ser negativo.");
        return null;
      }

      if (
        bibliotecaForm.productividadBase !== undefined &&
        bibliotecaForm.productividadBase < 0
      ) {
        toast.error("Productividad base no puede ser negativa.");
        return null;
      }

      if (
        bibliotecaForm.mermaRunPct !== undefined &&
        (bibliotecaForm.mermaRunPct < 0 || bibliotecaForm.mermaRunPct > 100)
      ) {
        toast.error("Merma debe estar entre 0 y 100.");
        return null;
      }

      if (bibliotecaForm.tipoProceso !== "maquinaria") {
        if (bibliotecaForm.maquinaId || bibliotecaForm.perfilOperativoId) {
          toast.error("Solo una plantilla de maquinaria puede definir maquina/perfil.");
          return null;
        }
      }

      if (bibliotecaForm.tipoProceso === "maquinaria" && !bibliotecaForm.maquinaId) {
        toast.error("En tipo de ruta Maquinaria, la maquina es obligatoria.");
        return null;
      }

      if (!bibliotecaForm.maquinaId && bibliotecaForm.perfilOperativoId) {
        toast.error("No se puede definir perfil sin maquina.");
        return null;
      }

      if (!bibliotecaForm.maquinaId && !bibliotecaForm.centroCostoId) {
        toast.error("Debes seleccionar centro de costo o maquina.");
        return null;
      }

      return {
        nombre: bibliotecaForm.nombre.trim(),
        tipoProceso: bibliotecaForm.tipoProceso,
        tipoOperacion: bibliotecaForm.tipoOperacion,
        centroCostoId: bibliotecaForm.centroCostoId || undefined,
        maquinaId: bibliotecaForm.maquinaId || undefined,
        perfilOperativoId: bibliotecaForm.perfilOperativoId || undefined,
        setupMin: bibliotecaForm.setupMin,
        cleanupMin: bibliotecaForm.cleanupMin,
        modoProductividad: bibliotecaForm.modoProductividad,
        productividadBase: bibliotecaForm.productividadBase,
        unidadEntrada: bibliotecaForm.unidadEntrada,
        unidadSalida: bibliotecaForm.unidadSalida,
        unidadTiempo: bibliotecaForm.unidadTiempo,
        mermaRunPct: bibliotecaForm.mermaRunPct,
        observaciones: bibliotecaForm.observaciones.trim() || undefined,
        activo: bibliotecaForm.activo,
      };
    },
    [bibliotecaForm],
  );

  const handleSaveBiblioteca = React.useCallback(() => {
    startSaving(async () => {
      const payload = buildBibliotecaPayload();
      if (!payload) {
        return;
      }

      try {
        await (editingBibliotecaId
          ? await updateProcesoOperacionPlantilla(editingBibliotecaId, payload)
          : await createProcesoOperacionPlantilla(payload));
        const refreshed = await getProcesoOperacionPlantillas();
        setBibliotecaOperaciones(refreshed);

        toast.success(
          editingBibliotecaId
            ? "Plantilla de paso actualizada."
            : "Plantilla de paso creada.",
        );
        setBibliotecaSheetOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo guardar la plantilla de paso.",
        );
      }
    });
  }, [buildBibliotecaPayload, editingBibliotecaId]);

  const handleToggleBiblioteca = React.useCallback((id: string) => {
    startSaving(async () => {
      try {
        await toggleProcesoOperacionPlantilla(id);
        const refreshed = await getProcesoOperacionPlantillas();
        setBibliotecaOperaciones(refreshed);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el estado de la plantilla de paso.",
        );
      }
    });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Rutas de produccion</h1>
          <p className="text-sm text-muted-foreground">
            Define rutas productivas por tipo de ruta para costos y cotizacion futura.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="sidebar" onClick={reloadAll} disabled={isRefreshing || isSaving}>
            <RefreshCcwIcon className={isRefreshing ? "animate-spin" : ""} />
            Refrescar
          </Button>
          <Button variant="brand" onClick={openCreateSheet} disabled={isSaving}>
            <PlusIcon />
            Nueva ruta de produccion
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Rutas totales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{resumen.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Rutas activas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{resumen.activos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Rutas listas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{resumen.listos}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rutas" className="gap-3">
        <TabsList
          variant="line"
          className="w-fit max-w-full justify-start overflow-x-auto px-0"
        >
          <TabsTrigger value="rutas">Listado de rutas</TabsTrigger>
          <TabsTrigger value="biblioteca">Biblioteca de pasos</TabsTrigger>
        </TabsList>

        <TabsContent value="rutas" className="m-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Listado de Rutas de Produccion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por codigo, nombre, tipo o plantilla"
                  className="max-w-sm"
                />
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch
                    checked={showInactiveRutas}
                    onCheckedChange={setShowInactiveRutas}
                  />
                  Mostrar inactivas
                </label>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codigo</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Plantilla</TableHead>
                    <TableHead>Pasos</TableHead>
                    <TableHead>Configuracion</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {procesosFiltrados.map((proceso) => (
                    <TableRow key={proceso.id}>
                      <TableCell className="font-medium">{proceso.codigo}</TableCell>
                      <TableCell>{proceso.nombre}</TableCell>
                      <TableCell>{getTipoProcesoLabel(proceso.tipoProceso)}</TableCell>
                      <TableCell>{getPlantillaProcesoLabel(proceso.plantillaMaquinaria)}</TableCell>
                      <TableCell>{proceso.operaciones.length}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {getEstadoConfiguracionProcesoLabel(proceso.estadoConfiguracion)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={proceso.activo ? "default" : "outline"}>
                          {proceso.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="sidebar"
                            size="sm"
                            onClick={() => openEditSheet(proceso)}
                          >
                            <PencilIcon />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggle(proceso.id)}
                          >
                            <ToggleLeftIcon />
                            {proceso.activo ? "Desactivar" : "Activar"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="biblioteca" className="m-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Biblioteca de pasos</CardTitle>
                <FieldDescription>
                  Crea plantillas reutilizables para armar rutas mas rapido y con criterios
                  estandar.
                </FieldDescription>
              </div>
              <Button variant="brand" size="sm" onClick={openCreateBibliotecaSheet}>
                <PlusIcon />
                Nueva plantilla
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  value={bibliotecaSearchTerm}
                  onChange={(event) => setBibliotecaSearchTerm(event.target.value)}
                  placeholder="Buscar por nombre, tipo, ruta, maquina o perfil"
                  className="max-w-sm"
                />
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch
                    checked={showInactiveBiblioteca}
                    onCheckedChange={setShowInactiveBiblioteca}
                  />
                  Mostrar inactivas
                </label>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo ruta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Centro costo</TableHead>
                    <TableHead>Maquina/Perfil</TableHead>
                    <TableHead>Modo prod.</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[260px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bibliotecaFiltrada.length ? (
                    bibliotecaFiltrada.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.nombre}</TableCell>
                        <TableCell>{getTipoProcesoLabel(item.tipoProceso)}</TableCell>
                        <TableCell>{getTipoOperacionLabel(item.tipoOperacion)}</TableCell>
                        <TableCell>{item.centroCostoNombre || "Sin centro"}</TableCell>
                        <TableCell>
                          {item.maquinaId
                            ? `${item.maquinaNombre}${item.perfilOperativoId ? ` / ${item.perfilOperativoNombre}` : ""}`
                            : "Sin maquina"}
                        </TableCell>
                        <TableCell>
                          {modoProductividadProcesoItems.find(
                            (mode) => mode.value === item.modoProductividad,
                          )?.label ?? item.modoProductividad}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.activo ? "default" : "outline"}>
                            {item.activo ? "Activa" : "Inactiva"}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-middle text-right">
                          <div className="flex justify-end gap-2 whitespace-nowrap">
                            <Button
                              variant="sidebar"
                              size="sm"
                              className="min-w-[92px] justify-center"
                              onClick={() => openEditBibliotecaSheet(item)}
                            >
                              <PencilIcon />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="min-w-[112px] justify-center"
                              onClick={() => handleToggleBiblioteca(item.id)}
                            >
                              <ToggleLeftIcon />
                              {item.activo ? "Desactivar" : "Activar"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-sm text-muted-foreground"
                      >
                        No hay plantillas que coincidan con la busqueda.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="flex w-screen max-w-none flex-col overflow-hidden data-[side=right]:w-[94vw] data-[side=right]:sm:max-w-[94vw] xl:data-[side=right]:w-[1120px] xl:data-[side=right]:sm:max-w-[1120px]">
          <SheetHeader className="px-4 pb-3 md:px-6">
            <SheetTitle>{editingProcesoId ? "Editar ruta de produccion" : "Nueva ruta de produccion"}</SheetTitle>
            <SheetDescription>
              Los codigos se generan automaticamente. Al elegir maquina/perfil, el sistema
              autocompleta centro y absorbe productividad/setup/unidades cuando estan vacios. El
              tiempo de corrida (run) se calcula en la evaluacion tecnica segun cantidad y
              productividad.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-6 md:px-6">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="mt-3 flex flex-col gap-6"
            >
              <TabsList className="mx-auto w-full max-w-5xl justify-start overflow-x-auto">
                <TabsTrigger value="general">1. Datos base</TabsTrigger>
                <TabsTrigger value="operaciones">2. Pasos</TabsTrigger>
                {editingProcesoId ? (
                  <TabsTrigger value="costo">3. Costo tecnico</TabsTrigger>
                ) : null}
              </TabsList>

              <TabsContent value="general" className="m-0">
                <Card className="mx-auto w-full max-w-5xl">
                  <CardHeader>
                    <CardTitle className="text-base">Datos de la ruta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup className="grid gap-4 md:grid-cols-2">
                      <Field>
                        <FieldLabel>Codigo</FieldLabel>
                        <Input
                          value={form.codigo}
                          readOnly
                          disabled
                          placeholder="Se genera al guardar"
                        />
                      </Field>

                      <Field>
                        <FieldLabel>Nombre de la ruta</FieldLabel>
                        <Input
                          value={form.nombre}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, nombre: event.target.value }))
                          }
                          placeholder="Ruta UV rollo con corte"
                        />
                      </Field>

                      <Field>
                        <FieldLabel>Tipo de ruta</FieldLabel>
                        <Select
                          value={form.tipoProceso}
                          onValueChange={(value) =>
                            handleTipoProcesoChange(value as TipoProceso)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue>
                              {tipoProcesoItems.find((item) => item.value === form.tipoProceso)
                                ?.label ?? form.tipoProceso}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {tipoProcesoItems.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field>
                        <FieldLabel>Plantilla de maquinaria</FieldLabel>
                        <Select
                          value={form.plantillaMaquinaria || EMPTY_SELECT_VALUE}
                          onValueChange={handlePlantillaChange}
                          disabled={form.tipoProceso === "manual"}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona plantilla">
                              {form.plantillaMaquinaria
                                ? getPlantillaMaquinariaLabel(form.plantillaMaquinaria)
                                : "No aplica"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={EMPTY_SELECT_VALUE}>No aplica</SelectItem>
                            {plantillaMaquinariaItems.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field className="md:col-span-2">
                        <FieldLabel>Descripcion</FieldLabel>
                        <Textarea
                          value={form.descripcion}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, descripcion: event.target.value }))
                          }
                          rows={3}
                        />
                      </Field>

                      <Field>
                        <FieldLabel>Activo</FieldLabel>
                        <div className="flex h-9 items-center">
                          <Switch
                            checked={form.activo}
                            onCheckedChange={(checked) =>
                              setForm((prev) => ({ ...prev, activo: checked }))
                            }
                          />
                        </div>
                      </Field>

                      <Field className="md:col-span-2">
                        <FieldLabel>Observaciones</FieldLabel>
                        <Textarea
                          value={form.observaciones}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, observaciones: event.target.value }))
                          }
                          rows={3}
                        />
                      </Field>
                    </FieldGroup>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="operaciones" className="m-0">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">Pasos</h3>
                  </div>

                  <Card className="relative z-20 overflow-visible">
                    <CardContent className="grid gap-3 overflow-visible p-3">
                      <p className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        Anadir paso
                        {renderTooltipIcon(
                          "Se copia la plantilla seleccionada y luego puedes editarla sin afectar la biblioteca.",
                        )}
                      </p>

                      <div className="flex flex-wrap items-start gap-2">
                        <div className="relative z-30 min-w-[280px] flex-1">
                          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={operacionTemplateSearch}
                            onChange={(event) => {
                              setOperacionTemplateSearch(event.target.value);
                              setSelectedOperacionTemplateId(EMPTY_SELECT_VALUE);
                              setIsOperacionTemplatePickerOpen(true);
                            }}
                            onFocus={() => setIsOperacionTemplatePickerOpen(true)}
                            onBlur={() =>
                              window.setTimeout(
                                () => setIsOperacionTemplatePickerOpen(false),
                                120,
                              )
                            }
                            className="pl-9"
                            placeholder="Buscar en biblioteca (nombre, tipo, ruta, centro, maquina)"
                          />
                          {shouldShowOperacionTemplateResults ? (
                            <div className="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover shadow-sm">
                              <div className="max-h-56 overflow-y-auto">
                                {filteredOperationTemplateItems.slice(0, 20).map((item) => {
                                  const isSelected = selectedOperacionTemplate?.id === item.id;
                                  return (
                                    <button
                                      key={item.id}
                                      type="button"
                                      className={`w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/40 ${
                                        isSelected ? "bg-muted" : ""
                                      }`}
                                      onMouseDown={(event) => event.preventDefault()}
                                      onClick={() => {
                                        setSelectedOperacionTemplateId(item.id);
                                        setOperacionTemplateSearch(item.nombre);
                                        setIsOperacionTemplatePickerOpen(false);
                                      }}
                                    >
                                      <p className="font-medium">{item.nombre}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {getTipoOperacionLabel(item.tipoOperacion)} ·{" "}
                                        {getTipoProcesoLabel(item.tipoProceso)} ·{" "}
                                        {item.centroCostoNombre || "Sin centro"} ·{" "}
                                        {item.maquinaId ? item.maquinaNombre : "Sin maquina"}
                                      </p>
                                    </button>
                                  );
                                })}
                                {!filteredOperationTemplateItems.length ? (
                                  <p className="px-3 py-2 text-xs text-muted-foreground">
                                    No se encontraron plantillas para la busqueda.
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <Button
                          variant="brand"
                          size="sm"
                          onClick={addOperacionFromTemplate}
                          disabled={!selectedOperacionTemplate}
                        >
                          <PlusIcon />
                          Anadir paso desde biblioteca
                        </Button>
                        <Button variant="outline" size="sm" onClick={addOperacion}>
                          <PlusIcon />
                          Crear paso en blanco
                        </Button>
                        <Tooltip>
                          <TooltipTrigger>
                            <span>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={applyTemplateOperations}
                                aria-label="Cargar pasos base"
                              >
                                <ListRestartIcon className="h-4 w-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Cargar pasos base
                          </TooltipContent>
                        </Tooltip>
                        {!editingProcesoId ? (
                          <Tooltip>
                            <TooltipTrigger>
                              <span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={clearTemplateOperations}
                                  aria-label="Vaciar pasos de plantilla"
                                >
                                  <EraserIcon className="h-4 w-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              Vaciar pasos de plantilla
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>

                  {form.operaciones.map((operacion, index) => {
                    const maquinaSeleccionada = operacion.maquinaId
                      ? allMaquinas.find((maquina) => maquina.id === operacion.maquinaId)
                      : null;
                    const isExpanded = expandedOperacionId === operacion.id;
                    const centroLabel = operacion.centroCostoId
                      ? (() => {
                          const centro = allCentrosCosto.find(
                            (item) => item.id === operacion.centroCostoId,
                          );
                          return centro ? `${centro.codigo} - ${centro.nombre}` : "Centro no disponible";
                        })()
                      : "Sin centro";
                    const maquinaLabel = operacion.maquinaId
                      ? `${maquinaSeleccionada?.codigo ?? "MAQ"} - ${maquinaSeleccionada?.nombre ?? "Maquina no disponible"}`
                      : "Sin maquina";

                    const mismatchWarning =
                      maquinaSeleccionada &&
                      operacion.centroCostoId &&
                      maquinaSeleccionada.centroCostoPrincipalId &&
                      operacion.centroCostoId !== maquinaSeleccionada.centroCostoPrincipalId
                        ? `Advertencia: ${maquinaSeleccionada.nombre} tiene otro centro principal (${maquinaSeleccionada.centroCostoPrincipalNombre}). Se mantiene el centro configurado en la operacion.`
                        : null;

                    return (
                      <Card key={operacion.id}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-auto px-0 text-left"
                            onClick={() =>
                              setExpandedOperacionId((prev) =>
                                prev === operacion.id ? null : operacion.id,
                              )
                            }
                          >
                            <span className="inline-flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDownIcon className="h-4 w-4" />
                              ) : (
                                <ChevronRightIcon className="h-4 w-4" />
                              )}
                              <CardTitle className="text-sm">Paso #{index + 1}</CardTitle>
                            </span>
                          </Button>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => moveOperacion(operacion.id, "up")}
                              disabled={index === 0}
                              aria-label={`Subir operacion ${index + 1}`}
                            >
                              <ArrowUpIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => moveOperacion(operacion.id, "down")}
                              disabled={index === form.operaciones.length - 1}
                              aria-label={`Bajar operacion ${index + 1}`}
                            >
                              <ArrowDownIcon className="h-4 w-4" />
                            </Button>
                            <Switch
                              checked={operacion.activo}
                              onCheckedChange={(checked) =>
                                updateOperacion(operacion.id, (prev) => ({
                                  ...prev,
                                  activo: checked,
                                }))
                              }
                              aria-label={`Activar operacion ${index + 1}`}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeOperacion(operacion.id)}
                              disabled={form.operaciones.length <= 1}
                            >
                              Quitar
                            </Button>
                          </div>
                        </CardHeader>
                        {isExpanded ? (
                          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          <Field>
                            <FieldLabel>Codigo</FieldLabel>
                            <Input value={buildSystemOperacionCodigo(index)} readOnly disabled />
                          </Field>

                          <Field>
                            <FieldLabel>Nombre</FieldLabel>
                            <Input
                              value={operacion.nombre}
                              onChange={(event) =>
                                updateOperacion(operacion.id, (prev) => ({
                                  ...prev,
                                  nombre: event.target.value,
                                }))
                              }
                            />
                          </Field>

                          <Field>
                            <FieldLabel>Tipo de paso</FieldLabel>
                            <Select
                              value={operacion.tipoOperacion}
                              onValueChange={(value) =>
                                updateOperacion(operacion.id, (prev) => ({
                                  ...prev,
                                  tipoOperacion:
                                    value as ProcesoOperacionPayload["tipoOperacion"],
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue>
                                  {tipoOperacionProcesoItems.find(
                                    (item) => item.value === operacion.tipoOperacion,
                                  )?.label ?? operacion.tipoOperacion}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {tipoOperacionProcesoItems.map((item) => (
                                  <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>

                          <Field data-disabled={form.tipoProceso === "manual"}>
                            <FieldLabel>Maquina</FieldLabel>
                            <Select
                              value={operacion.maquinaId || EMPTY_SELECT_VALUE}
                              onValueChange={(value) =>
                                updateOperacion(operacion.id, (prev) => {
                                  const nextMachineId =
                                    !value || value === EMPTY_SELECT_VALUE
                                      ? undefined
                                      : value;
                                  const nextMachine = nextMachineId
                                    ? allMaquinas.find((item) => item.id === nextMachineId)
                                    : null;
                                  const mappedUnit = mapMachineUnitToProceso(
                                    nextMachine?.unidadProduccionPrincipal || "",
                                  );
                                  const shouldSetUnitSalida =
                                    !prev.unidadSalida || prev.unidadSalida === "ninguna";
                                  const shouldSetUnitTiempo =
                                    !prev.unidadTiempo ||
                                    (prev.unidadTiempo === "minuto" && shouldSetUnitSalida);

                                  return {
                                    ...prev,
                                    maquinaId: nextMachineId,
                                    perfilOperativoId: undefined,
                                    centroCostoId:
                                      nextMachineId
                                        ? (nextMachine?.centroCostoPrincipalId ?? "")
                                        : prev.centroCostoId,
                                    setupMin:
                                      nextMachineId && nextMachineId !== prev.maquinaId
                                        ? undefined
                                        : prev.setupMin,
                                    unidadSalida:
                                      shouldSetUnitSalida && mappedUnit
                                        ? mappedUnit.unidadSalida
                                        : prev.unidadSalida,
                                    unidadTiempo:
                                      shouldSetUnitTiempo && mappedUnit
                                        ? mappedUnit.unidadTiempo
                                        : prev.unidadTiempo,
                                  };
                                })
                              }
                              disabled={form.tipoProceso === "manual"}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona maquina">
                                  {operacion.maquinaId
                                    ? (() => {
                                        const maquina = allMaquinas.find(
                                          (item) => item.id === operacion.maquinaId,
                                        );
                                        return maquina
                                          ? `${maquina.codigo} - ${maquina.nombre}`
                                          : "Maquina no disponible";
                                      })()
                                    : form.tipoProceso === "manual"
                                      ? "No aplica"
                                      : "Selecciona maquina"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={EMPTY_SELECT_VALUE}>Sin maquina</SelectItem>
                                {maquinasCompatibles.map((maquina) => (
                                  <SelectItem key={maquina.id} value={maquina.id}>
                                    {maquina.codigo} - {maquina.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>

                          <Field data-disabled={Boolean(operacion.maquinaId)}>
                            <FieldLabel>Centro de costo</FieldLabel>
                            <Select
                              value={operacion.centroCostoId || EMPTY_SELECT_VALUE}
                              onValueChange={(value) =>
                                updateOperacion(operacion.id, (prev) => ({
                                  ...prev,
                                  centroCostoId:
                                    !value || value === EMPTY_SELECT_VALUE ? "" : value,
                                }))
                              }
                              disabled={Boolean(operacion.maquinaId)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona centro">
                                  {operacion.centroCostoId
                                    ? (() => {
                                        const centro = allCentrosCosto.find(
                                          (item) => item.id === operacion.centroCostoId,
                                        );
                                        return centro
                                          ? `${centro.codigo} - ${centro.nombre}`
                                          : "Centro no disponible";
                                      })()
                                    : "Selecciona centro"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={EMPTY_SELECT_VALUE}>Sin seleccionar</SelectItem>
                                {allCentrosCosto.map((centro) => (
                                  <SelectItem key={centro.id} value={centro.id}>
                                    {centro.codigo} - {centro.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>

                          <Field
                            data-disabled={
                              form.tipoProceso === "manual" || !maquinaSeleccionada
                            }
                          >
                            <FieldLabel>Perfil operativo</FieldLabel>
                            <Select
                              value={operacion.perfilOperativoId || EMPTY_SELECT_VALUE}
                              onValueChange={(value) => {
                                const nextPerfilId =
                                  !value || value === EMPTY_SELECT_VALUE
                                    ? undefined
                                    : value;
                                const perfilSeleccionado = nextPerfilId
                                  ? maquinaSeleccionada?.perfilesOperativos.find(
                                      (item) => item.id === nextPerfilId,
                                    ) ?? null
                                  : null;
                                const setupFromPerfil = getSetupFromPerfil(perfilSeleccionado);
                                if (nextPerfilId && setupFromPerfil === undefined) {
                                  toast.warning(
                                    `El perfil ${perfilSeleccionado?.nombre ?? ""} no tiene setup configurado.`,
                                  );
                                }

                                updateOperacion(operacion.id, (prev) => {
                                  const perfil = getPerfilOperativo(prev.maquinaId, nextPerfilId);
                                  const mappedUnit = mapMachineUnitToProceso(
                                    perfil?.unidadProductividad ||
                                      maquinaSeleccionada?.unidadProduccionPrincipal ||
                                      "",
                                  );
                                  const shouldSetUnitSalida =
                                    !prev.unidadSalida || prev.unidadSalida === "ninguna";
                                  const shouldSetUnitTiempo =
                                    !prev.unidadTiempo ||
                                    (prev.unidadTiempo === "minuto" && shouldSetUnitSalida);

                                  return {
                                    ...prev,
                                    perfilOperativoId: nextPerfilId,
                                    modoProductividad: nextPerfilId ? "fija" : prev.modoProductividad,
                                    productividadBase:
                                      nextPerfilId
                                        ? (perfil?.productividad ?? prev.productividadBase)
                                        : prev.productividadBase,
                                    setupMin: nextPerfilId ? setupFromPerfil : prev.setupMin,
                                    unidadSalida:
                                      shouldSetUnitSalida && mappedUnit
                                        ? mappedUnit.unidadSalida
                                        : prev.unidadSalida,
                                    unidadTiempo:
                                      shouldSetUnitTiempo && mappedUnit
                                        ? mappedUnit.unidadTiempo
                                        : prev.unidadTiempo,
                                  };
                                });
                              }}
                              disabled={form.tipoProceso === "manual" || !maquinaSeleccionada}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona perfil">
                                  {operacion.perfilOperativoId
                                    ? (() => {
                                        const perfil = maquinaSeleccionada?.perfilesOperativos.find(
                                          (item) => item.id === operacion.perfilOperativoId,
                                        );
                                        return perfil?.nombre ?? "Perfil no disponible";
                                      })()
                                    : form.tipoProceso === "manual"
                                      ? "No aplica"
                                      : "Selecciona perfil"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={EMPTY_SELECT_VALUE}>Sin perfil</SelectItem>
                                {maquinaSeleccionada?.perfilesOperativos.map((perfil) => (
                                  <SelectItem key={perfil.id} value={perfil.id}>
                                    {perfil.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>

                          {mismatchWarning ? (
                            <p className="md:col-span-2 xl:col-span-3 text-xs text-muted-foreground">
                              {mismatchWarning}
                            </p>
                          ) : null}

                          <Field>
                            <FieldLabel>Setup (min)</FieldLabel>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={operacion.setupMin ?? ""}
                              onChange={(event) =>
                                updateOperacion(operacion.id, (prev) => ({
                                  ...prev,
                                  setupMin: toOptionalNumber(event.target.value),
                                }))
                              }
                            />
                          </Field>

                          <Field>
                            <FieldLabel className="inline-flex items-center gap-1">
                              Productividad base
                              {renderTooltipIcon(
                                `Rendimiento nominal de la operacion. Se usa para estimar tiempo variable junto con el modo de productividad. ${buildProductividadBaseExample(
                                  operacion.unidadSalida,
                                  operacion.unidadTiempo,
                                )}`,
                              )}
                            </FieldLabel>
                            <Input
                              type="number"
                              min={0}
                              step="0.0001"
                              value={operacion.productividadBase ?? ""}
                              onChange={(event) =>
                                updateOperacion(operacion.id, (prev) => ({
                                  ...prev,
                                  productividadBase: toOptionalNumber(event.target.value),
                                }))
                              }
                            />
                          </Field>

                          <Field>
                            <FieldLabel className="inline-flex items-center gap-1">
                              Merma (%)
                              {renderTooltipIcon(
                                "Porcentaje estimado de desperdicio total del paso. Ejemplo: 2.5 significa 2.5%.",
                              )}
                            </FieldLabel>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step="0.0001"
                              value={operacion.mermaRunPct ?? ""}
                              onChange={(event) =>
                                updateOperacion(operacion.id, (prev) => ({
                                  ...prev,
                                  mermaRunPct: toOptionalNumber(event.target.value),
                                }))
                              }
                            />
                          </Field>

                          <Field className="md:col-span-2 xl:col-span-3">
                            <FieldLabel>Modo avanzado</FieldLabel>
                            <div className="flex h-9 items-center">
                              <Switch
                                checked={Boolean(operacion.advancedMode)}
                                onCheckedChange={(checked) =>
                                  updateOperacion(operacion.id, (prev) => ({
                                    ...prev,
                                    advancedMode: checked,
                                  }))
                                }
                                aria-label={`Modo avanzado operacion ${index + 1}`}
                              />
                            </div>
                          </Field>

                          {operacion.advancedMode ? (
                            <div className="md:col-span-2 xl:col-span-3 space-y-3 rounded-md border p-3">
                              <p className="text-xs font-medium text-muted-foreground">
                                Configuracion avanzada
                              </p>
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                <Field>
                                  <FieldLabel className="inline-flex items-center gap-1">
                                    Modo productividad
                                    {renderTooltipIcon(
                                      "Como se calcula la velocidad del paso: fija (valor unico), formula (segun variables) o tabla (por tramos/condiciones).",
                                    )}
                                  </FieldLabel>
                                  <Select
                                    value={operacion.modoProductividad || "fija"}
                                    onValueChange={(value) =>
                                      updateOperacion(operacion.id, (prev) => ({
                                        ...prev,
                                        modoProductividad:
                                          value as ProcesoOperacionPayload["modoProductividad"],
                                      }))
                                    }
                                    disabled={Boolean(operacion.perfilOperativoId)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue>
                                        {modoProductividadProcesoItems.find(
                                          (item) =>
                                            item.value ===
                                            (operacion.modoProductividad || "fija"),
                                        )?.label ?? operacion.modoProductividad}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {modoProductividadProcesoItems.map((item) => (
                                        <SelectItem key={item.value} value={item.value}>
                                          {item.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </Field>

                                <Field>
                                  <FieldLabel className="inline-flex items-center gap-1">
                                    Cleanup (min)
                                    {renderTooltipIcon(
                                      "Minutos para cierre, limpieza y dejar el puesto listo al terminar el paso.",
                                    )}
                                  </FieldLabel>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={operacion.cleanupMin ?? ""}
                                    onChange={(event) =>
                                      updateOperacion(operacion.id, (prev) => ({
                                        ...prev,
                                        cleanupMin: toOptionalNumber(event.target.value),
                                      }))
                                    }
                                  />
                                </Field>

                                <Field>
                                  <FieldLabel className="inline-flex items-center gap-1">
                                    Unidad entrada
                                    {renderTooltipIcon(
                                      "Unidad del insumo que consume este paso (ej.: hoja, m2, pieza). Puede quedar en No aplica si no interviene en el calculo.",
                                    )}
                                  </FieldLabel>
                                  <Select
                                    value={operacion.unidadEntrada || "ninguna"}
                                    onValueChange={(value) =>
                                      updateOperacion(operacion.id, (prev) => ({
                                        ...prev,
                                        unidadEntrada:
                                          value as ProcesoOperacionPayload["unidadEntrada"],
                                      }))
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue>
                                        {unidadProcesoItems.find(
                                          (item) =>
                                            item.value ===
                                            (operacion.unidadEntrada || "ninguna"),
                                        )?.label ?? operacion.unidadEntrada}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {unidadProcesoItems.map((item) => (
                                        <SelectItem key={item.value} value={item.value}>
                                          {item.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </Field>

                                <Field>
                                  <FieldLabel className="inline-flex items-center gap-1">
                                    Unidad salida
                                    {renderTooltipIcon(
                                      "Unidad de producto resultante del paso (ej.: copia, m2, pieza).",
                                    )}
                                  </FieldLabel>
                                  <Select
                                    value={operacion.unidadSalida || "ninguna"}
                                    onValueChange={(value) =>
                                      updateOperacion(operacion.id, (prev) => ({
                                        ...prev,
                                        unidadSalida:
                                          value as ProcesoOperacionPayload["unidadSalida"],
                                      }))
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue>
                                        {unidadProcesoItems.find(
                                          (item) =>
                                            item.value ===
                                            (operacion.unidadSalida || "ninguna"),
                                        )?.label ?? operacion.unidadSalida}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {unidadProcesoItems.map((item) => (
                                        <SelectItem key={item.value} value={item.value}>
                                          {item.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </Field>

                                <Field>
                                  <FieldLabel className="inline-flex items-center gap-1">
                                    Unidad tiempo
                                    {renderTooltipIcon(
                                      "Base temporal de la productividad. Ejemplo: minuto u hora.",
                                    )}
                                  </FieldLabel>
                                  <Select
                                    value={operacion.unidadTiempo || "minuto"}
                                    onValueChange={(value) =>
                                      updateOperacion(operacion.id, (prev) => ({
                                        ...prev,
                                        unidadTiempo:
                                          value as ProcesoOperacionPayload["unidadTiempo"],
                                      }))
                                    }
                                    disabled={Boolean(
                                      mapMachineUnitToProceso(
                                        getPerfilOperativo(
                                          operacion.maquinaId,
                                          operacion.perfilOperativoId,
                                        )?.unidadProductividad ||
                                          maquinaSeleccionada?.unidadProduccionPrincipal ||
                                          "",
                                      ),
                                    )}
                                  >
                                    <SelectTrigger>
                                      <SelectValue>
                                        {unidadProcesoItems.find(
                                          (item) =>
                                            item.value ===
                                            (operacion.unidadTiempo || "minuto"),
                                        )?.label ?? operacion.unidadTiempo}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {unidadProcesoItems.map((item) => (
                                        <SelectItem key={item.value} value={item.value}>
                                          {item.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </Field>

                                {(operacion.modoProductividad === "formula" ||
                                  operacion.modoProductividad === "tabla") && (
                                  <Field className="md:col-span-2 xl:col-span-3">
                                    <FieldLabel className="inline-flex items-center gap-1">
                                      Regla velocidad (JSON)
                                      {renderTooltipIcon(
                                        "Define como calcular la productividad en modo formula o tabla.",
                                      )}
                                    </FieldLabel>
                                    <div className="mb-2 flex justify-end">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          updateOperacion(operacion.id, (prev) => ({
                                            ...prev,
                                            reglaVelocidadTexto: JSON.stringify(
                                              getVelocidadRuleExample(prev.modoProductividad),
                                              null,
                                              2,
                                            ),
                                          }))
                                        }
                                      >
                                        Cargar ejemplo
                                      </Button>
                                    </div>
                                    <Textarea
                                      value={operacion.reglaVelocidadTexto || ""}
                                      onChange={(event) =>
                                        updateOperacion(operacion.id, (prev) => ({
                                          ...prev,
                                          reglaVelocidadTexto: event.target.value,
                                        }))
                                      }
                                      rows={8}
                                      placeholder='{"tipo":"formula_v1"}'
                                    />
                                  </Field>
                                )}

                                <Field className="md:col-span-2 xl:col-span-3">
                                  <FieldLabel className="inline-flex items-center gap-1">
                                    Regla merma
                                    {renderTooltipIcon(
                                      "Define si la merma usa un valor fijo o tramos por tirada. La merma general (%) se usa como fallback.",
                                    )}
                                  </FieldLabel>
                                  <div className="grid gap-3 md:grid-cols-[minmax(0,16rem)_auto] md:items-end">
                                    <Field>
                                      <FieldLabel>Estrategia</FieldLabel>
                                      <Select
                                        value={operacion.mermaRuleMode || "fija"}
                                        onValueChange={(value) =>
                                          updateOperacion(operacion.id, (prev) => ({
                                            ...prev,
                                            mermaRuleMode: value as "fija" | "por_tirada",
                                            mermaTiers:
                                              value === "por_tirada" &&
                                              (!prev.mermaTiers || !prev.mermaTiers.length)
                                                ? [buildEmptyMermaTier()]
                                                : prev.mermaTiers,
                                          }))
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue>
                                            {(operacion.mermaRuleMode || "fija") === "por_tirada"
                                              ? "Merma por tirada"
                                              : "Merma fija"}
                                          </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="fija">Merma fija</SelectItem>
                                          <SelectItem value="por_tirada">
                                            Merma por tirada
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </Field>

                                    {operacion.mermaRuleMode === "por_tirada" ? (
                                      <div className="flex justify-start md:justify-end">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            updateOperacion(operacion.id, (prev) => ({
                                              ...prev,
                                              mermaTiers: [
                                                ...(prev.mermaTiers || []),
                                                buildEmptyMermaTier(),
                                              ],
                                            }))
                                          }
                                        >
                                          <PlusIcon className="h-4 w-4" />
                                          Agregar tramo
                                        </Button>
                                      </div>
                                    ) : null}
                                  </div>

                                  {operacion.mermaRuleMode === "por_tirada" ? (
                                    <div className="mt-3 space-y-2 rounded-md border p-3">
                                      {(operacion.mermaTiers || []).map((tier, tierIndex) => (
                                        <div
                                          key={tier.id}
                                          className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]"
                                        >
                                          <Input
                                            type="number"
                                            min={0}
                                            step="1"
                                            value={tier.minTirada ?? ""}
                                            onChange={(event) =>
                                              updateOperacion(operacion.id, (prev) => ({
                                                ...prev,
                                                mermaTiers: (prev.mermaTiers || []).map((item) =>
                                                  item.id === tier.id
                                                    ? {
                                                        ...item,
                                                        minTirada: toOptionalNumber(
                                                          event.target.value,
                                                        ),
                                                      }
                                                    : item,
                                                ),
                                              }))
                                            }
                                            placeholder={`Desde tirada (tramo ${tierIndex + 1})`}
                                          />
                                          <Input
                                            type="number"
                                            min={0}
                                            step="1"
                                            value={tier.maxTirada ?? ""}
                                            onChange={(event) =>
                                              updateOperacion(operacion.id, (prev) => ({
                                                ...prev,
                                                mermaTiers: (prev.mermaTiers || []).map((item) =>
                                                  item.id === tier.id
                                                    ? {
                                                        ...item,
                                                        maxTirada: toOptionalNumber(
                                                          event.target.value,
                                                        ),
                                                      }
                                                    : item,
                                                ),
                                              }))
                                            }
                                            placeholder={`Hasta tirada (tramo ${tierIndex + 1})`}
                                          />
                                          <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step="0.0001"
                                            value={tier.mermaPct ?? ""}
                                            onChange={(event) =>
                                              updateOperacion(operacion.id, (prev) => ({
                                                ...prev,
                                                mermaTiers: (prev.mermaTiers || []).map((item) =>
                                                  item.id === tier.id
                                                    ? {
                                                        ...item,
                                                        mermaPct: toOptionalNumber(
                                                          event.target.value,
                                                        ),
                                                      }
                                                    : item,
                                                ),
                                              }))
                                            }
                                            placeholder="Merma (%)"
                                          />
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              updateOperacion(operacion.id, (prev) => ({
                                                ...prev,
                                                mermaTiers: (prev.mermaTiers || []).filter(
                                                  (item) => item.id !== tier.id,
                                                ),
                                              }))
                                            }
                                          >
                                            Quitar
                                          </Button>
                                        </div>
                                      ))}

                                      {!(operacion.mermaTiers || []).length ? (
                                        <p className="text-xs text-muted-foreground">
                                          Agrega al menos un tramo para usar merma por tirada.
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      Se aplica la merma general (%) definida en esta operacion.
                                    </p>
                                  )}
                                </Field>
                              </div>
                            </div>
                          ) : null}
                          </CardContent>
                        ) : (
                          <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Nombre</p>
                              <p className="text-sm font-medium">{operacion.nombre || "Sin nombre"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Tipo</p>
                              <p className="text-sm">
                                {tipoOperacionProcesoItems.find(
                                  (item) => item.value === operacion.tipoOperacion,
                                )?.label ?? operacion.tipoOperacion}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Maquina</p>
                              <p className="text-sm">{maquinaLabel}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Centro</p>
                              <p className="text-sm">{centroLabel}</p>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              {editingProcesoId ? (
                <TabsContent value="costo" className="m-0">
                  <Card className="mx-auto w-full max-w-5xl">
                  <CardHeader>
                    <CardTitle className="text-base">Evaluacion tecnica de la ruta</CardTitle>
                    <FieldDescription>
                      Simula costo tecnico por paso usando tarifas publicadas del periodo y
                      reglas de productividad.
                    </FieldDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FieldGroup className="grid gap-3 md:grid-cols-3">
                      <Field>
                        <FieldLabel>Periodo</FieldLabel>
                        <Input
                          value={evaluacionPeriodo}
                          onChange={(event) => setEvaluacionPeriodo(event.target.value)}
                          placeholder="YYYY-MM"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Cantidad objetivo</FieldLabel>
                        <Input
                          type="number"
                          min={0}
                          step="0.0001"
                          value={evaluacionCantidad}
                          onChange={(event) => setEvaluacionCantidad(event.target.value)}
                        />
                      </Field>
                      <Field className="flex items-end">
                        <Button
                          variant="brand"
                          className="w-full"
                          onClick={handleEvaluarCosto}
                          disabled={!editingProcesoId || isEvaluando}
                        >
                          {isEvaluando ? "Evaluando..." : "Evaluar costo tecnico"}
                        </Button>
                      </Field>
                    </FieldGroup>

                    <div className="rounded-md border p-3">
                      <p className="text-sm font-medium">Contexto de evaluacion actual</p>
                      <p className="text-xs text-muted-foreground">
                        Por ahora el sistema usa contexto tecnico minimo:{" "}
                        <span className="font-mono">{"{ tirada: cantidad objetivo }"}</span>.
                        Cuando exista el modulo de Productos y servicios se sumaran campos guiados
                        de calidad, material y extras.
                      </p>
                    </div>

                    {evaluacionResultado ? (
                      <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-3">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-sm">Costo tiempo total</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-2xl font-semibold">
                                {evaluacionResultado.costoTiempoTotal.toFixed(2)}
                              </p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-sm">Periodo</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-lg font-semibold">{evaluacionResultado.periodo}</p>
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-sm">Valida para cotizar</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <Badge
                                variant={
                                  evaluacionResultado.validaParaCotizar ? "default" : "outline"
                                }
                              >
                                {evaluacionResultado.validaParaCotizar ? "Si" : "No"}
                              </Badge>
                            </CardContent>
                          </Card>
                        </div>

                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Op</TableHead>
                              <TableHead>Modo</TableHead>
                              <TableHead>Run (min)</TableHead>
                              <TableHead>Productividad</TableHead>
                              <TableHead>Tarifa</TableHead>
                              <TableHead>Costo tiempo</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {evaluacionResultado.operaciones.map((operacion) => (
                              <TableRow key={operacion.operacionId}>
                                <TableCell>
                                  {operacion.codigo} - {operacion.nombre}
                                </TableCell>
                                <TableCell>{operacion.modoProductividad}</TableCell>
                                <TableCell>{operacion.runMin.toFixed(2)}</TableCell>
                                <TableCell>
                                  {operacion.productividadAplicada !== null
                                    ? operacion.productividadAplicada.toFixed(4)
                                    : "-"}
                                </TableCell>
                                <TableCell>
                                  {operacion.tarifaCentro !== null
                                    ? operacion.tarifaCentro.toFixed(2)
                                    : "Sin tarifa"}
                                </TableCell>
                                <TableCell>{operacion.costoTiempo.toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        {evaluacionResultado.advertencias.length ? (
                          <div className="space-y-1 rounded-md border p-3 text-sm">
                            <p className="font-medium">Advertencias</p>
                            {evaluacionResultado.advertencias.map((warning) => (
                              <p key={warning} className="text-muted-foreground">
                                {warning}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                  </Card>
                </TabsContent>
              ) : null}
            </Tabs>
          </div>

          <SheetFooter className="sticky bottom-0 border-t bg-background px-4 py-3 md:px-6">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={handleSave} disabled={isSaving}>
              <Settings2Icon />
              {isSaving ? "Guardando..." : "Guardar ruta"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={bibliotecaSheetOpen} onOpenChange={setBibliotecaSheetOpen}>
        <SheetContent className="flex w-screen max-w-none flex-col overflow-hidden data-[side=right]:w-[96vw] data-[side=right]:sm:max-w-[760px]">
          <SheetHeader className="px-4 pb-3 md:px-6">
            <SheetTitle>
              {editingBibliotecaId
                ? "Editar plantilla de paso"
                : "Nueva plantilla de paso"}
            </SheetTitle>
            <SheetDescription>
              Define un paso reutilizable para cargarlo luego desde la biblioteca en la
              configuracion de rutas de produccion.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-6 md:px-6">
            <Card className="mx-auto w-full">
              <CardContent className="pt-6">
                <FieldGroup className="grid gap-4 md:grid-cols-2">
                  <Field className="md:col-span-2">
                    <FieldLabel>Nombre</FieldLabel>
                    <Input
                      value={bibliotecaForm.nombre}
                      onChange={(event) =>
                        setBibliotecaForm((prev) => ({
                          ...prev,
                          nombre: event.target.value,
                        }))
                      }
                      placeholder="Laminado brillante estandar"
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Tipo de paso</FieldLabel>
                    <Select
                      value={bibliotecaForm.tipoOperacion}
                      onValueChange={(value) =>
                        setBibliotecaForm((prev) => ({
                          ...prev,
                          tipoOperacion:
                            value as ProcesoOperacionPayload["tipoOperacion"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {getTipoOperacionLabel(bibliotecaForm.tipoOperacion)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {tipoOperacionProcesoItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>Tipo de ruta</FieldLabel>
                    <Select
                      value={bibliotecaForm.tipoProceso}
                      onValueChange={(value) =>
                        setBibliotecaForm((prev) => ({
                          ...prev,
                          tipoProceso: value as TipoProceso,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {getTipoProcesoLabel(bibliotecaForm.tipoProceso)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {tipoProcesoItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  {bibliotecaForm.tipoProceso === "maquinaria" ? (
                    <Field>
                      <FieldLabel>Maquina</FieldLabel>
                      <Select
                        value={bibliotecaForm.maquinaId || EMPTY_SELECT_VALUE}
                        onValueChange={(value) => {
                          const nextMaquinaId =
                            value && value !== EMPTY_SELECT_VALUE ? value : "";
                          const nextMaquina = nextMaquinaId
                            ? allMaquinas.find((item) => item.id === nextMaquinaId)
                            : null;
                          setBibliotecaForm((prev) => ({
                            ...prev,
                            maquinaId: nextMaquinaId,
                            perfilOperativoId: "",
                            centroCostoId:
                              nextMaquinaId && nextMaquina?.centroCostoPrincipalId
                                ? nextMaquina.centroCostoPrincipalId
                                : prev.centroCostoId,
                            setupMin:
                              nextMaquinaId && nextMaquinaId !== prev.maquinaId
                                ? undefined
                                : prev.setupMin,
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {bibliotecaForm.maquinaId
                              ? `${bibliotecaMaquinaSeleccionada?.codigo ?? "MAQ"} - ${bibliotecaMaquinaSeleccionada?.nombre ?? "Maquina no disponible"}`
                              : "Selecciona maquina"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={EMPTY_SELECT_VALUE}>Selecciona maquina</SelectItem>
                          {bibliotecaMaquinas.map((maquina) => (
                            <SelectItem key={maquina.id} value={maquina.id}>
                              {maquina.codigo} - {maquina.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : null}

                  {bibliotecaForm.tipoProceso === "maquinaria" ? (
                    <Field data-disabled={bibliotecaCentroBloqueado}>
                      <FieldLabel>Centro de costo</FieldLabel>
                      <Select
                        value={bibliotecaForm.centroCostoId || EMPTY_SELECT_VALUE}
                        onValueChange={(value) =>
                          setBibliotecaForm((prev) => ({
                            ...prev,
                            centroCostoId:
                              !value || value === EMPTY_SELECT_VALUE ? "" : value,
                          }))
                        }
                        disabled={bibliotecaCentroBloqueado}
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {bibliotecaForm.centroCostoId
                              ? (() => {
                                  const centro = allCentrosCosto.find(
                                    (item) => item.id === bibliotecaForm.centroCostoId,
                                  );
                                  return centro
                                    ? `${centro.codigo} - ${centro.nombre}`
                                    : "Centro no disponible";
                                })()
                              : "Selecciona centro"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={EMPTY_SELECT_VALUE}>Sin seleccionar</SelectItem>
                          {allCentrosCosto.map((centro) => (
                            <SelectItem key={centro.id} value={centro.id}>
                              {centro.codigo} - {centro.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : (
                    <Field>
                      <FieldLabel>Centro de costo</FieldLabel>
                      <Select
                        value={bibliotecaForm.centroCostoId || EMPTY_SELECT_VALUE}
                        onValueChange={(value) =>
                          setBibliotecaForm((prev) => ({
                            ...prev,
                            centroCostoId:
                              !value || value === EMPTY_SELECT_VALUE ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {bibliotecaForm.centroCostoId
                              ? (() => {
                                  const centro = allCentrosCosto.find(
                                    (item) => item.id === bibliotecaForm.centroCostoId,
                                  );
                                  return centro
                                    ? `${centro.codigo} - ${centro.nombre}`
                                    : "Centro no disponible";
                                })()
                              : "Selecciona centro"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={EMPTY_SELECT_VALUE}>Sin seleccionar</SelectItem>
                          {allCentrosCosto.map((centro) => (
                            <SelectItem key={centro.id} value={centro.id}>
                              {centro.codigo} - {centro.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}

                  {bibliotecaForm.tipoProceso === "maquinaria" ? (
                    <Field data-disabled={!bibliotecaMaquinaSeleccionada}>
                      <FieldLabel>Perfil operativo (opcional)</FieldLabel>
                      <Select
                        value={bibliotecaForm.perfilOperativoId || EMPTY_SELECT_VALUE}
                        onValueChange={(value) => {
                          const nextPerfilId =
                            value && value !== EMPTY_SELECT_VALUE ? value : "";
                          const perfil = nextPerfilId
                            ? bibliotecaMaquinaSeleccionada?.perfilesOperativos.find(
                                (item) => item.id === nextPerfilId,
                              ) ?? null
                            : null;
                          const setupFromPerfil = getSetupFromPerfil(perfil);
                          if (nextPerfilId && setupFromPerfil === undefined) {
                            toast.warning(
                              `El perfil ${perfil?.nombre ?? ""} no tiene setup configurado.`,
                            );
                          }
                          setBibliotecaForm((prev) => ({
                            ...prev,
                            perfilOperativoId: nextPerfilId,
                            setupMin: nextPerfilId ? setupFromPerfil : prev.setupMin,
                            productividadBase: nextPerfilId
                              ? (perfil?.productividad ?? prev.productividadBase)
                              : prev.productividadBase,
                            modoProductividad: nextPerfilId ? "fija" : prev.modoProductividad,
                          }));
                        }}
                        disabled={!bibliotecaMaquinaSeleccionada}
                      >
                        <SelectTrigger>
                          <SelectValue>
                            {bibliotecaForm.perfilOperativoId
                              ? bibliotecaMaquinaSeleccionada?.perfilesOperativos.find(
                                  (item) => item.id === bibliotecaForm.perfilOperativoId,
                                )?.nombre ?? "Perfil no disponible"
                              : "Sin perfil"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={EMPTY_SELECT_VALUE}>Sin perfil</SelectItem>
                          {bibliotecaMaquinaSeleccionada?.perfilesOperativos.map((perfil) => (
                            <SelectItem key={perfil.id} value={perfil.id}>
                              {perfil.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : null}

                  <Field>
                    <FieldLabel className="inline-flex items-center gap-1">
                      Setup (min)
                      {renderTooltipIcon(
                        "Tiempo de preparacion del paso. Si eliges perfil operativo, se autocompleta desde ese perfil de maquina.",
                      )}
                    </FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      step="0.0001"
                      value={bibliotecaForm.setupMin ?? ""}
                      onChange={(event) =>
                        setBibliotecaForm((prev) => ({
                          ...prev,
                          setupMin: toOptionalNumber(event.target.value),
                        }))
                      }
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Cleanup (min)</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      step="0.0001"
                      value={bibliotecaForm.cleanupMin ?? ""}
                      onChange={(event) =>
                        setBibliotecaForm((prev) => ({
                          ...prev,
                          cleanupMin: toOptionalNumber(event.target.value),
                        }))
                      }
                    />
                  </Field>

                  <Field>
                    <FieldLabel className="inline-flex items-center gap-1">
                      Modo productividad
                      {renderTooltipIcon(
                        "Como se calcula la velocidad del paso: fija (valor unico), formula (segun variables) o tabla (por tramos/condiciones).",
                      )}
                    </FieldLabel>
                    <Select
                      value={bibliotecaForm.modoProductividad}
                      onValueChange={(value) =>
                        setBibliotecaForm((prev) => ({
                          ...prev,
                          modoProductividad:
                            value as ProcesoOperacionPayload["modoProductividad"],
                        }))
                      }
                      disabled={Boolean(bibliotecaForm.perfilOperativoId)}
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {modoProductividadProcesoItems.find(
                            (item) => item.value === bibliotecaForm.modoProductividad,
                          )?.label ?? bibliotecaForm.modoProductividad}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {modoProductividadProcesoItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel>Productividad base</FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      step="0.0001"
                      value={bibliotecaForm.productividadBase ?? ""}
                      onChange={(event) =>
                        setBibliotecaForm((prev) => ({
                          ...prev,
                          productividadBase: toOptionalNumber(event.target.value),
                        }))
                      }
                    />
                  </Field>

                  <Field>
                    <FieldLabel className="inline-flex items-center gap-1">
                      Unidad tiempo
                      {renderTooltipIcon(
                        "Base temporal de la productividad. Ejemplo: minuto u hora.",
                      )}
                    </FieldLabel>
                    <Select
                      value={bibliotecaForm.unidadTiempo}
                      onValueChange={(value) =>
                        setBibliotecaForm((prev) => ({
                          ...prev,
                          unidadTiempo: value as ProcesoOperacionPayload["unidadTiempo"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {getUnidadProcesoLabel(bibliotecaForm.unidadTiempo)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {unidadProcesoItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel className="inline-flex items-center gap-1">
                      Unidad entrada
                      {renderTooltipIcon(
                        "Unidad del insumo que consume este paso (ej.: hoja, m2, pieza). Puede quedar en No aplica si no interviene en el calculo.",
                      )}
                    </FieldLabel>
                    <Select
                      value={bibliotecaForm.unidadEntrada}
                      onValueChange={(value) =>
                        setBibliotecaForm((prev) => ({
                          ...prev,
                          unidadEntrada: value as ProcesoOperacionPayload["unidadEntrada"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {getUnidadProcesoLabel(bibliotecaForm.unidadEntrada)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {unidadProcesoItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel className="inline-flex items-center gap-1">
                      Unidad salida
                      {renderTooltipIcon(
                        "Unidad de producto resultante del paso (ej.: copia, m2, pieza).",
                      )}
                    </FieldLabel>
                    <Select
                      value={bibliotecaForm.unidadSalida}
                      onValueChange={(value) =>
                        setBibliotecaForm((prev) => ({
                          ...prev,
                          unidadSalida: value as ProcesoOperacionPayload["unidadSalida"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {getUnidadProcesoLabel(bibliotecaForm.unidadSalida)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {unidadProcesoItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel className="inline-flex items-center gap-1">
                      Merma (%)
                      {renderTooltipIcon(
                        "Porcentaje esperado de desperdicio del paso sobre la corrida.",
                      )}
                    </FieldLabel>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.0001"
                      value={bibliotecaForm.mermaRunPct ?? ""}
                      onChange={(event) =>
                        setBibliotecaForm((prev) => ({
                          ...prev,
                          mermaRunPct: toOptionalNumber(event.target.value),
                        }))
                      }
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Activa</FieldLabel>
                    <div className="flex h-9 items-center">
                      <Switch
                        checked={bibliotecaForm.activo}
                        onCheckedChange={(checked) =>
                          setBibliotecaForm((prev) => ({ ...prev, activo: checked }))
                        }
                      />
                    </div>
                  </Field>

                  <Field className="md:col-span-2">
                    <FieldLabel>Observaciones</FieldLabel>
                    <Textarea
                      rows={3}
                      value={bibliotecaForm.observaciones}
                      onChange={(event) =>
                        setBibliotecaForm((prev) => ({
                          ...prev,
                          observaciones: event.target.value,
                        }))
                      }
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>
          </div>

          <SheetFooter className="sticky bottom-0 border-t bg-background px-4 py-3 md:px-6">
            <Button variant="outline" onClick={() => setBibliotecaSheetOpen(false)}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={handleSaveBiblioteca} disabled={isSaving}>
              <Settings2Icon />
              {isSaving ? "Guardando..." : "Guardar plantilla"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
