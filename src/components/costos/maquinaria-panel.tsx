"use client";

import * as React from "react";
import {
  CalculatorIcon,
  InfoIcon,
  LoaderCircleIcon,
  PencilIcon,
  PlusIcon,
  RefreshCcwIcon,
  SaveIcon,
  SearchIcon,
  Settings2Icon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  createMaquina,
  getMaquinas,
  toggleMaquina,
  updateMaquina,
} from "@/lib/maquinaria-api";
import { getMateriasPrimas } from "@/lib/materias-primas-api";
import {
  EstadoConfiguracionMaquina,
  estadoConfiguracionMaquinaItems,
  estadoMaquinaItems,
  geometriaTrabajoMaquinaItems,
  Maquina,
  MaquinaPayload,
  PlantillaMaquinaria,
  tipoComponenteDesgasteMaquinaItems,
  tipoConsumibleMaquinaItems,
  tipoPerfilOperativoMaquinaItems,
  unidadConsumoMaquinaItems,
  unidadDesgasteMaquinaItems,
  unidadProduccionMaquinaItems,
  type MaquinariaTemplateField,
} from "@/lib/maquinaria";
import {
  getMaquinariaTemplate,
  getPlantillaMaquinariaLabel,
  plantillaMaquinariaItems,
} from "@/lib/maquinaria-templates";
import { getCatalogoFabricantesPorPlantilla } from "@/lib/maquinaria-catalogos";
import { getTechnicalPresetForMachine } from "@/lib/maquinaria-tech-presets";
import { unidadMateriaPrimaItems, type MateriaPrima } from "@/lib/materias-primas";
import { CentroCosto, Planta } from "@/lib/costos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
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
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type MaquinariaPanelProps = {
  initialMaquinas: Maquina[];
  plantas: Planta[];
  centrosCosto: CentroCosto[];
};

type LocalPerfilOperativo = MaquinaPayload["perfilesOperativos"][number] & { id: string };
type LocalConsumible = MaquinaPayload["consumibles"][number] & { id: string };
type LocalDesgaste = MaquinaPayload["componentesDesgaste"][number] & { id: string };
type TemplateFieldEntry = {
  sectionId: string;
  sectionTitle: string;
  field: MaquinariaTemplateField;
};

const EMPTY_SELECT_VALUE = "__none__";
const OTHER_SELECT_VALUE = "__other__";
const PRESET_FIELD_CLASSNAME = "border-sky-300 bg-sky-50/70";
const COMBINED_PRODUCTIVITY_UNITS = ["ppm", "m2_h", "piezas_h"] as const;
const COMBINED_PRODUCTIVITY_UNIT_SET = new Set<string>(COMBINED_PRODUCTIVITY_UNITS);
const PERFIL_DIRECT_FIELD_KEYS = new Set([
  "nombre",
  "productividad",
  "tiempoPreparacionMin",
  "tiempoRipMin",
  "cantidadPasadas",
  "dobleFaz",
  "anchoAplicable",
  "altoAplicable",
  "modoTrabajo",
]);
const PERFIL_MODE_SOURCE_KEYS = new Set(["modoTrabajo", "modoImpresion", "tipoOperacion"]);
const PERFIL_TIME_FIELD_KEYS = new Set([
  "tiempoPreparacionMin",
  "tiempoRipMin",
]);
const CONSUMIBLE_DIRECT_FIELD_KEYS = new Set([
  "materiaPrimaVarianteId",
  "nombre",
  "tipo",
  "unidad",
  "rendimientoEstimado",
  "consumoBase",
  "perfilOperativoNombre",
  "activo",
  "observaciones",
]);
const DESGASTE_DIRECT_FIELD_KEYS = new Set([
  "materiaPrimaVarianteId",
  "nombre",
  "tipo",
  "vidaUtilEstimada",
  "unidadDesgaste",
  "modoProrrateo",
  "activo",
  "observaciones",
]);
const MACHINE_DIRECT_FIELD_KEYS = new Set([
  "anchoUtil",
  "largoUtil",
  "altoUtil",
  "espesorMaximo",
  "pesoMaximo",
]);
const SHEET_FORMAT_DIMENSIONS_CM: Record<string, { ancho: number; alto: number }> = {
  a5: { ancho: 14.8, alto: 21 },
  a4: { ancho: 21, alto: 29.7 },
  a3: { ancho: 29.7, alto: 42 },
  sra3: { ancho: 32, alto: 45 },
};
const UNIT_LABELS: Record<string, string> = {
  cm: "cm",
  mm: "mm",
  m2: "m2",
  m2_h: "m2/h",
  metro_lineal: "m lineal",
  unidades_min: "unid/min",
  piezas_h: "piezas/h",
  copias_min: "copias/min",
  ppm: "ppm",
  rpm: "rpm",
  kw: "kW",
  g_m2: "g/m2",
  kg: "kg",
  litros: "L",
  mm_s: "mm/s",
  min: "min",
  horas: "h",
  porcentaje: "%",
  dpi: "dpi",
  micrones: "micrones",
};

function getPerfilFieldPlaceholder(fieldItem: MaquinariaTemplateField) {
  if (PERFIL_TIME_FIELD_KEYS.has(fieldItem.key)) {
    return undefined;
  }

  return fieldItem.placeholder;
}
const PRINTER_TEMPLATES_WITH_INK_CONSUMPTION = new Set<PlantillaMaquinaria>([
  "impresora_dtf",
  "impresora_dtf_uv",
  "impresora_uv_mesa_extensora",
  "impresora_uv_cilindrica",
  "impresora_uv_flatbed",
  "impresora_uv_rollo",
  "impresora_solvente",
  "impresora_inyeccion_tinta",
  "impresora_latex",
  "impresora_sublimacion_gran_formato",
  "impresora_laser",
]);
const PRINTER_CHANNEL_OPTIONS = [
  { value: "cian", label: "Cian" },
  { value: "magenta", label: "Magenta" },
  { value: "amarillo", label: "Amarillo" },
  { value: "negro", label: "Negro" },
  { value: "blanco", label: "Blanco" },
  { value: "barniz", label: "Barniz" },
];
const PRINTER_CHANNEL_OPTION_BY_VALUE = new Map(
  PRINTER_CHANNEL_OPTIONS.map((item) => [item.value, item]),
);
const PRINTER_CHANNEL_META: Record<string, { label: string; dotClassName: string }> = {
  cian: { label: "Cian", dotClassName: "bg-cyan-500" },
  magenta: { label: "Magenta", dotClassName: "bg-fuchsia-500" },
  amarillo: { label: "Amarillo", dotClassName: "bg-yellow-400" },
  negro: { label: "Negro", dotClassName: "bg-black" },
  blanco: { label: "Blanco", dotClassName: "bg-white border" },
  barniz: { label: "Barniz", dotClassName: "bg-amber-100 border" },
};
const A4_AREA_M2 = 0.06237;
const DEFAULT_FULL_COLOR_COVERAGE_PERCENT = 40;

function formatTechnicalValue(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getUnitLabel(unit?: string) {
  if (!unit) {
    return "";
  }

  return UNIT_LABELS[unit] ?? formatTechnicalValue(unit);
}

function getVariantFunctionalName(
  nombreVariante: string | null | undefined,
  atributosVariante: Record<string, unknown> | null | undefined,
) {
  const normalizedNombre = String(nombreVariante ?? "").trim();
  if (normalizedNombre) {
    return normalizedNombre;
  }

  const rawColor = atributosVariante?.color;
  if (typeof rawColor === "string" && rawColor.trim()) {
    return formatTechnicalValue(rawColor.trim());
  }

  return "Variante sin nombre";
}

function supportsPrinterInkConsumption(templateId: PlantillaMaquinaria) {
  return PRINTER_TEMPLATES_WITH_INK_CONSUMPTION.has(templateId);
}

function getRequiredPrinterChannels(
  parametrosTecnicos?: Record<string, unknown>,
  templateId?: PlantillaMaquinaria,
) {
  const configuracionColor = String(parametrosTecnicos?.configuracionColor ?? "")
    .trim()
    .toLowerCase();
  const configuracionCanales = String(parametrosTecnicos?.configuracionCanales ?? "")
    .trim()
    .toLowerCase();
  const blancoDisponible = Boolean(parametrosTecnicos?.blancoDisponible);
  const barnizDisponible = Boolean(parametrosTecnicos?.barnizDisponible);

  if (configuracionColor === "bn") {
    return ["negro"];
  }

  if (
    templateId === "impresora_laser" &&
    !configuracionCanales &&
    !configuracionColor
  ) {
    // Solo como fallback cuando no se definio color en paso 1.
    return ["negro"];
  }

  const required = new Set<string>(["cian", "magenta", "amarillo", "negro"]);

  if (configuracionCanales) {
    if (!configuracionCanales.includes("cmyk")) {
      required.clear();
      required.add("negro");
    }
    if (configuracionCanales.includes("blanco")) {
      required.add("blanco");
    }
    if (configuracionCanales.includes("barniz")) {
      required.add("barniz");
    }
  } else {
    if (blancoDisponible) {
      required.add("blanco");
    }
    if (barnizDisponible) {
      required.add("barniz");
    }
  }

  return PRINTER_CHANNEL_OPTIONS.map((item) => item.value).filter((value) => required.has(value));
}

function getUnidadMateriaPrimaLabel(value?: string | null) {
  if (!value) {
    return "";
  }
  return unidadMateriaPrimaItems.find((item) => item.value === value)?.label ?? formatTechnicalValue(value);
}

function mapUnidadMateriaPrimaToConsumo(value?: string | null): LocalConsumible["unidad"] | null {
  if (!value) {
    return null;
  }
  const direct: Record<string, LocalConsumible["unidad"]> = {
    unidad: "unidad",
    ml: "ml",
    litro: "litro",
    gramo: "gramo",
    kg: "kg",
    m2: "m2",
    metro_lineal: "metro_lineal",
  };
  return direct[value] ?? null;
}

function getTemplateFieldGroup(entry: TemplateFieldEntry): {
  key: string;
  title: string;
  description: string;
} {
  const normalizedKey = entry.field.key.toLowerCase();
  const normalizedLabel = entry.field.label.toLowerCase();
  const haystack = `${normalizedKey} ${normalizedLabel}`;

  if (haystack.includes("margen")) {
    return {
      key: "margenes",
      title: "Margenes y areas no imprimibles",
      description: "Define zonas no productivas y limites utiles de impresion/corte.",
    };
  }

  if (
    haystack.includes("ancho") ||
    haystack.includes("alto") ||
    haystack.includes("largo") ||
    haystack.includes("diametro") ||
    haystack.includes("espesor") ||
    haystack.includes("peso") ||
    haystack.includes("gramaje") ||
    haystack.includes("volumen") ||
    haystack.includes("area") ||
    haystack.includes("cama") ||
    haystack.includes("formato")
  ) {
    return {
      key: "dimensiones",
      title: "Dimensiones y capacidad fisica",
      description: "Limites mecanicos y de formato que condicionan el uso del equipo.",
    };
  }

  if (
    haystack.includes("material") ||
    haystack.includes("sustrato") ||
    haystack.includes("media") ||
    haystack.includes("objeto")
  ) {
    return {
      key: "materiales",
      title: "Materiales y sustratos",
      description: "Compatibilidades de materiales que impactan proceso y costos.",
    };
  }

  if (
    haystack.includes("resolucion") ||
    haystack.includes("calidad") ||
    haystack.includes("pasada") ||
    haystack.includes("modo") ||
    haystack.includes("canal")
  ) {
    return {
      key: "calidad",
      title: "Calidad y configuracion de proceso",
      description: "Parametros que afectan terminacion y consistencia de salida.",
    };
  }

  if (
    haystack.includes("velocidad") ||
    haystack.includes("productividad") ||
    haystack.includes("tiempo") ||
    haystack.includes("avance") ||
    haystack.includes("desplazamiento") ||
    haystack.includes("corte") ||
    haystack.includes("grabado") ||
    haystack.includes("rpm")
  ) {
    return {
      key: "rendimiento",
      title: "Rendimiento operativo",
      description: "Velocidades y rendimientos nominales para estimar capacidad real.",
    };
  }

  if (
    haystack.includes("potencia") ||
    haystack.includes("consumo") ||
    haystack.includes("temperatura") ||
    haystack.includes("spindle") ||
    haystack.includes("laser") ||
    haystack.includes("uv")
  ) {
    return {
      key: "energia",
      title: "Potencia y energia",
      description: "Datos electricos/energeticos utiles para operacion y costeo tecnico.",
    };
  }

  return {
    key: "otros",
    title: "Otros parametros tecnicos",
    description: "Campos tecnicos especificos de la plantilla que no encajan en otros grupos.",
  };
}

function getNumericParamValue(source: Record<string, unknown> | undefined, key: string) {
  const raw = source?.[key];
  if (raw === null || raw === undefined || raw === "") {
    return undefined;
  }

  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function getDerivedPrintableAreaParams(source: Record<string, unknown> | undefined) {
  const anchoMaxHoja = getNumericParamValue(source, "anchoMaxHoja");
  const altoMaxHoja = getNumericParamValue(source, "altoMaxHoja");
  const margenSuperior = getNumericParamValue(source, "margenSuperior") ?? 0;
  const margenInferior = getNumericParamValue(source, "margenInferior") ?? 0;
  const margenIzquierdo = getNumericParamValue(source, "margenIzquierdo") ?? 0;
  const margenDerecho = getNumericParamValue(source, "margenDerecho") ?? 0;

  if (anchoMaxHoja === undefined || altoMaxHoja === undefined) {
    return null;
  }

  const anchoImprimible = Number((anchoMaxHoja - margenIzquierdo - margenDerecho).toFixed(2));
  const altoImprimible = Number((altoMaxHoja - margenSuperior - margenInferior).toFixed(2));

  if (anchoImprimible <= 0 || altoImprimible <= 0) {
    return null;
  }

  const areaImprimibleMaxima = Number(((anchoImprimible * altoImprimible) / 10000).toFixed(4));

  return {
    anchoImprimible,
    altoImprimible,
    areaImprimibleMaxima,
  };
}

function toTemplateMultiselectValue(raw: unknown) {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function mapTemplateUnitToProductivityUnit(
  templateUnit?: string,
): LocalPerfilOperativo["unidadProductividad"] | undefined {
  switch (templateUnit) {
    case "ppm":
      return "ppm";
    case "m2_h":
      return "m2_h";
    case "piezas_h":
      return "piezas_h";
    case "metro_lineal":
      return "metro_lineal";
    case "copias_min":
      return "ppm";
    case "hora":
      return "hora";
    case "hoja":
      return "hoja";
    case "copia":
      return "copia";
    case "pieza":
      return "pieza";
    case "ciclo":
      return "ciclo";
    default:
      return undefined;
  }
}

function toCombinedProductivityUnit(
  unit?: LocalPerfilOperativo["unidadProductividad"],
): (typeof COMBINED_PRODUCTIVITY_UNITS)[number] {
  switch (unit) {
    case "ppm":
      return "ppm";
    case "m2_h":
      return "m2_h";
    case "piezas_h":
      return "piezas_h";
    case "copia":
    case "hoja":
      return "ppm";
    case "pieza":
    case "ciclo":
      return "piezas_h";
    case "m2":
    case "metro_lineal":
    case "hora":
    case "a4_equiv":
    default:
      return "m2_h";
  }
}

function toModeTrabajoLabel(
  field: MaquinariaTemplateField,
  value: string,
) {
  return field.options?.find((option) => option.value === value)?.label ?? value;
}

function getTemplateSelectOptions(
  fieldItem: MaquinariaTemplateField | undefined,
  fallback: Array<{ value: string; label: string }>,
) {
  if (!fieldItem?.options || fieldItem.options.length === 0) {
    return fallback;
  }

  return fieldItem.options.map((option) => ({
    value: option.value,
    label: option.label,
  }));
}

function pickDefaultSelectValue(
  fieldItem: MaquinariaTemplateField | undefined,
  preferred: string,
) {
  const options = fieldItem?.options ?? [];
  if (options.some((option) => option.value === preferred)) {
    return preferred;
  }

  return options[0]?.value ?? preferred;
}

function toFiniteNumberOrUndefined(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getConsumibleUnitSymbol(unit?: LocalConsumible["unidad"]) {
  switch (unit) {
    case "gramo":
      return "g";
    case "ml":
      return "ml";
    case "litro":
      return "L";
    case "kg":
      return "kg";
    default:
      return formatTechnicalValue(unit || "unidad");
  }
}

function calculateConsumptionPerSquareMeter(params: {
  contenido: number;
  rendimientoPaginasA4: number;
  coberturaIsoFabricantePercent: number;
  coberturaObjetivoPercent: number;
}) {
  const {
    contenido,
    rendimientoPaginasA4,
    coberturaIsoFabricantePercent,
    coberturaObjetivoPercent,
  } = params;
  if (
    !Number.isFinite(contenido) ||
    !Number.isFinite(rendimientoPaginasA4) ||
    !Number.isFinite(coberturaIsoFabricantePercent) ||
    !Number.isFinite(coberturaObjetivoPercent) ||
    contenido <= 0 ||
    rendimientoPaginasA4 <= 0 ||
    coberturaIsoFabricantePercent <= 0 ||
    coberturaObjetivoPercent <= 0
  ) {
    return null;
  }

  const consumoIsoPorA4 = contenido / rendimientoPaginasA4;
  const consumoIsoPorM2 = consumoIsoPorA4 / A4_AREA_M2;
  const consumoObjetivoPorM2 =
    consumoIsoPorM2 * (coberturaObjetivoPercent / coberturaIsoFabricantePercent);

  return {
    consumoIsoPorM2,
    consumoObjetivoPorM2,
  };
}

function renderRequiredAsterisk(required?: boolean) {
  if (!required) {
    return null;
  }

  return (
    <span className="ml-1 font-semibold text-destructive" aria-label="Campo obligatorio">
      *
    </span>
  );
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

function getPerfilValueByTemplateField(
  perfil: LocalPerfilOperativo,
  fieldItem: MaquinariaTemplateField,
) {
  switch (fieldItem.key) {
    case "nombre":
      return perfil.nombre;
    case "productividad":
      return perfil.productividad ?? "";
    case "tiempoPreparacionMin":
      return perfil.tiempoPreparacionMin ?? "";
    case "tiempoRipMin":
      return perfil.tiempoRipMin ?? "";
    case "cantidadPasadas":
      return perfil.cantidadPasadas ?? "";
    case "dobleFaz":
      return Boolean(perfil.dobleFaz);
    case "anchoAplicable":
      return perfil.anchoAplicable ?? "";
    case "altoAplicable":
      return perfil.altoAplicable ?? "";
    case "modoTrabajo":
      return perfil.modoTrabajo || "";
    default: {
      const fromDetail = perfil.detalle?.[fieldItem.key];
      if (fromDetail !== undefined && fromDetail !== null) {
        return fromDetail;
      }

      if (PERFIL_MODE_SOURCE_KEYS.has(fieldItem.key) && perfil.modoTrabajo && fieldItem.options) {
        const normalizedMode = perfil.modoTrabajo.trim().toLowerCase();
        const option = fieldItem.options.find(
          (item) =>
            item.label.trim().toLowerCase() === normalizedMode ||
            item.value.trim().toLowerCase() === normalizedMode,
        );
        if (option) {
          return option.value;
        }
      }

      if (fieldItem.kind === "boolean") {
        return false;
      }
      if (fieldItem.kind === "multiselect") {
        return [];
      }
      return "";
    }
  }
}

function getConsumibleValueByTemplateField(
  consumible: LocalConsumible,
  fieldItem: MaquinariaTemplateField,
) {
  switch (fieldItem.key) {
    case "materiaPrimaVarianteId":
      return consumible.materiaPrimaVarianteId;
    case "nombre":
      return consumible.nombre;
    case "tipo":
      return consumible.tipo;
    case "unidad":
      return consumible.unidad;
    case "rendimientoEstimado":
      return consumible.rendimientoEstimado ?? "";
    case "consumoBase":
      return consumible.consumoBase ?? "";
    case "perfilOperativoNombre":
      return consumible.perfilOperativoNombre ?? "";
    case "activo":
      return Boolean(consumible.activo);
    case "observaciones":
      return consumible.observaciones ?? "";
    default: {
      const fromDetail = consumible.detalle?.[fieldItem.key];
      if (fromDetail !== undefined && fromDetail !== null) {
        return fromDetail;
      }

      if (fieldItem.kind === "boolean") {
        return false;
      }
      if (fieldItem.kind === "multiselect") {
        return [];
      }
      return "";
    }
  }
}

function getDesgasteValueByTemplateField(
  desgaste: LocalDesgaste,
  fieldItem: MaquinariaTemplateField,
) {
  switch (fieldItem.key) {
    case "materiaPrimaVarianteId":
      return desgaste.materiaPrimaVarianteId;
    case "nombre":
      return desgaste.nombre;
    case "tipo":
      return desgaste.tipo;
    case "vidaUtilEstimada":
      return desgaste.vidaUtilEstimada ?? "";
    case "unidadDesgaste":
      return desgaste.unidadDesgaste;
    case "modoProrrateo":
      return desgaste.modoProrrateo ?? "";
    case "activo":
      return Boolean(desgaste.activo);
    case "observaciones":
      return desgaste.observaciones ?? "";
    default: {
      const fromDetail = desgaste.detalle?.[fieldItem.key];
      if (fromDetail !== undefined && fromDetail !== null) {
        return fromDetail;
      }

      if (fieldItem.kind === "boolean") {
        return false;
      }
      if (fieldItem.kind === "multiselect") {
        return [];
      }
      return "";
    }
  }
}

function createLocalId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function createPerfilOperativo(
  unidadProductividad: LocalPerfilOperativo["unidadProductividad"] = "m2_h",
): LocalPerfilOperativo {
  return {
    id: createLocalId(),
    nombre: "",
    tipoPerfil: "impresion",
    activo: true,
    productividad: undefined,
    unidadProductividad,
  };
}

function createConsumible(consumibleTemplateFields: MaquinariaTemplateField[] = []): LocalConsumible {
  const tipoField = consumibleTemplateFields.find((fieldItem) => fieldItem.key === "tipo");
  const unidadField = consumibleTemplateFields.find((fieldItem) => fieldItem.key === "unidad");

  return {
    id: createLocalId(),
    materiaPrimaVarianteId: "",
    nombre: "",
    tipo: pickDefaultSelectValue(tipoField, "otro") as LocalConsumible["tipo"],
    unidad: pickDefaultSelectValue(unidadField, "unidad") as LocalConsumible["unidad"],
    activo: true,
    rendimientoEstimado: undefined,
    consumoBase: undefined,
    observaciones: "",
  };
}

function createDesgaste(desgasteTemplateFields: MaquinariaTemplateField[] = []): LocalDesgaste {
  const tipoField = desgasteTemplateFields.find((fieldItem) => fieldItem.key === "tipo");
  const unidadField = desgasteTemplateFields.find((fieldItem) => fieldItem.key === "unidadDesgaste");

  return {
    id: createLocalId(),
    materiaPrimaVarianteId: "",
    nombre: "",
    tipo: pickDefaultSelectValue(tipoField, "otro") as LocalDesgaste["tipo"],
    unidadDesgaste: pickDefaultSelectValue(unidadField, "horas") as LocalDesgaste["unidadDesgaste"],
    activo: true,
    vidaUtilEstimada: undefined,
    modoProrrateo: "",
    observaciones: "",
  };
}

function createMaquinaForm(plantaId = ""): MaquinaPayload {
  return {
    codigo: undefined,
    nombre: "",
    plantilla: "impresora_laser",
    plantaId,
    centroCostoPrincipalId: undefined,
    estado: "activa",
    estadoConfiguracion: "borrador",
    geometriaTrabajo: "pliego",
    unidadProduccionPrincipal: "copia",
    activo: true,
    observaciones: "",
    perfilesOperativos: [],
    consumibles: [],
    componentesDesgaste: [],
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function toPayload(
  form: MaquinaPayload,
  perfiles: LocalPerfilOperativo[],
  consumibles: LocalConsumible[],
  desgastes: LocalDesgaste[],
): MaquinaPayload {
  const derivedPrintableArea =
    form.plantilla.startsWith("impresora_")
      ? getDerivedPrintableAreaParams(form.parametrosTecnicos)
      : null;

  return {
    ...form,
    codigo: form.codigo?.trim() || undefined,
    estadoConfiguracion: undefined,
    anchoUtil:
      form.plantilla === "impresora_laser" && derivedPrintableArea
        ? derivedPrintableArea.anchoImprimible
        : form.anchoUtil,
    largoUtil:
      form.plantilla === "impresora_laser" && derivedPrintableArea
        ? derivedPrintableArea.altoImprimible
        : form.largoUtil,
    centroCostoPrincipalId:
      form.centroCostoPrincipalId && form.centroCostoPrincipalId !== EMPTY_SELECT_VALUE
        ? form.centroCostoPrincipalId
        : undefined,
    fabricante: form.fabricante?.trim() || undefined,
    modelo: form.modelo?.trim() || undefined,
    numeroSerie: form.numeroSerie?.trim() || undefined,
    observaciones: form.observaciones?.trim() || undefined,
    perfilesOperativos: perfiles.map(({ id, ...item }) => {
      void id;
      return item;
    }),
    consumibles: consumibles.map(({ id, ...item }) => {
      void id;
      const detalle = { ...(item.detalle ?? {}) } as Record<string, unknown>;
      if ("syncKey" in detalle) {
        delete detalle.syncKey;
      }
      return {
        ...item,
        detalle: Object.keys(detalle).length > 0 ? detalle : undefined,
      };
    }),
    componentesDesgaste: desgastes.map(({ id, ...item }) => {
      void id;
      return item;
    }),
  };
}

function fromMaquina(maquina: Maquina): {
  form: MaquinaPayload;
  perfiles: LocalPerfilOperativo[];
  consumibles: LocalConsumible[];
  desgastes: LocalDesgaste[];
} {
  return {
    form: {
      codigo: maquina.codigo,
      nombre: maquina.nombre,
      plantilla: maquina.plantilla,
      plantillaVersion: maquina.plantillaVersion,
      fabricante: maquina.fabricante,
      modelo: maquina.modelo,
      numeroSerie: maquina.numeroSerie,
      plantaId: maquina.plantaId,
      centroCostoPrincipalId: maquina.centroCostoPrincipalId || undefined,
      estado: maquina.estado,
      estadoConfiguracion: maquina.estadoConfiguracion,
      geometriaTrabajo: maquina.geometriaTrabajo,
      unidadProduccionPrincipal: maquina.unidadProduccionPrincipal,
      anchoUtil:
        maquina.anchoUtil ?? getNumericParamValue(maquina.parametrosTecnicos ?? undefined, "anchoUtil"),
      largoUtil:
        maquina.largoUtil ?? getNumericParamValue(maquina.parametrosTecnicos ?? undefined, "largoUtil"),
      altoUtil:
        maquina.altoUtil ?? getNumericParamValue(maquina.parametrosTecnicos ?? undefined, "altoUtil"),
      espesorMaximo:
        maquina.espesorMaximo ??
        getNumericParamValue(maquina.parametrosTecnicos ?? undefined, "espesorMaximo"),
      pesoMaximo:
        maquina.pesoMaximo ?? getNumericParamValue(maquina.parametrosTecnicos ?? undefined, "pesoMaximo"),
      fechaAlta: maquina.fechaAlta || undefined,
      activo: maquina.activo,
      observaciones: maquina.observaciones,
      parametrosTecnicos: maquina.parametrosTecnicos ?? undefined,
      capacidadesAvanzadas: maquina.capacidadesAvanzadas ?? undefined,
      perfilesOperativos: [],
      consumibles: [],
      componentesDesgaste: [],
    },
    perfiles: maquina.perfilesOperativos.map((item) => ({
      id: item.id,
      nombre: item.nombre,
      tipoPerfil: item.tipoPerfil,
      activo: item.activo,
      anchoAplicable: item.anchoAplicable ?? undefined,
      altoAplicable: item.altoAplicable ?? undefined,
      modoTrabajo: item.modoTrabajo || undefined,
      productividad: item.productividad ?? undefined,
      unidadProductividad: toCombinedProductivityUnit(item.unidadProductividad || undefined),
      tiempoPreparacionMin: item.tiempoPreparacionMin ?? undefined,
      tiempoRipMin: item.tiempoRipMin ?? undefined,
      cantidadPasadas: item.cantidadPasadas ?? undefined,
      dobleFaz: item.dobleFaz,
      detalle: item.detalle ?? undefined,
    })),
    consumibles: maquina.consumibles.map((item) => ({
      id: item.id,
      materiaPrimaVarianteId: item.materiaPrimaVarianteId,
      nombre: item.nombre,
      tipo: item.tipo,
      unidad: item.unidad,
      rendimientoEstimado: item.rendimientoEstimado ?? undefined,
      consumoBase: item.consumoBase ?? undefined,
      perfilOperativoNombre: item.perfilOperativoNombre || undefined,
      activo: item.activo,
      detalle: item.detalle ?? undefined,
      observaciones: item.observaciones || undefined,
    })),
    desgastes: maquina.componentesDesgaste.map((item) => ({
      id: item.id,
      materiaPrimaVarianteId: item.materiaPrimaVarianteId,
      nombre: item.nombre,
      tipo: item.tipo,
      unidadDesgaste: item.unidadDesgaste,
      vidaUtilEstimada: item.vidaUtilEstimada ?? undefined,
      modoProrrateo: item.modoProrrateo || undefined,
      activo: item.activo,
      detalle: item.detalle ?? undefined,
      observaciones: item.observaciones || undefined,
    })),
  };
}

export function MaquinariaPanel({ initialMaquinas, plantas, centrosCosto }: MaquinariaPanelProps) {
  const [maquinas, setMaquinas] = React.useState(initialMaquinas);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<MaquinaPayload>(() => createMaquinaForm(plantas[0]?.id ?? ""));
  const [perfiles, setPerfiles] = React.useState<LocalPerfilOperativo[]>([]);
  const [selectedPerfilId, setSelectedPerfilId] = React.useState<string | null>(null);
  const [selectedConsumiblePerfilId, setSelectedConsumiblePerfilId] = React.useState<string | null>(null);
  const [sameConsumptionAllProfiles, setSameConsumptionAllProfiles] = React.useState(true);
  const [consumibles, setConsumibles] = React.useState<LocalConsumible[]>([]);
  const [desgastes, setDesgastes] = React.useState<LocalDesgaste[]>([]);
  const [isReloading, startReloading] = React.useTransition();
  const [isSaving, startSaving] = React.useTransition();
  const [isTogglingId, setIsTogglingId] = React.useState<string | null>(null);
  const [filterText, setFilterText] = React.useState("");
  const [filterPlantilla, setFilterPlantilla] = React.useState<PlantillaMaquinaria | "all">("all");
  const [filterEstado, setFilterEstado] = React.useState<MaquinaPayload["estado"] | "all">("all");
  const [filterPlantaId, setFilterPlantaId] = React.useState<string | "all">("all");
  const [quickEditId, setQuickEditId] = React.useState<string | null>(null);
  const [quickEditNombre, setQuickEditNombre] = React.useState("");
  const [quickEditEstado, setQuickEditEstado] = React.useState<MaquinaPayload["estado"]>("activa");
  const [activeConfigTab, setActiveConfigTab] = React.useState<
    "general" | "perfiles" | "consumibles" | "desgaste"
  >("general");
  const [lastAppliedPresetKey, setLastAppliedPresetKey] = React.useState("");
  const [presetAppliedParamKeys, setPresetAppliedParamKeys] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [fabricanteSearch, setFabricanteSearch] = React.useState("");
  const [modeloSearch, setModeloSearch] = React.useState("");
  const [isFabricanteOtro, setIsFabricanteOtro] = React.useState(false);
  const [isModeloOtro, setIsModeloOtro] = React.useState(false);
  const [materiasPrimas, setMateriasPrimas] = React.useState<MateriaPrima[]>([]);
  const [openConsumibleCalculatorId, setOpenConsumibleCalculatorId] = React.useState<string | null>(null);
  const [consumibleCalculatorDraftById, setConsumibleCalculatorDraftById] = React.useState<
    Record<
      string,
      { contenido: string; rendimiento: string; coberturaIsoFabricante: string; cobertura: string }
    >
  >({});
  const showPrinterConsumiblesStep = React.useMemo(
    () => supportsPrinterInkConsumption(form.plantilla),
    [form.plantilla],
  );
  const requiredPrinterChannels = React.useMemo(
    () =>
      showPrinterConsumiblesStep
        ? getRequiredPrinterChannels(form.parametrosTecnicos, form.plantilla)
        : [],
    [form.parametrosTecnicos, form.plantilla, showPrinterConsumiblesStep],
  );

  const getConsumibleCalculatorDraft = React.useCallback(
    (consumibleId: string) =>
      consumibleCalculatorDraftById[consumibleId] ?? {
        contenido: "",
        rendimiento: "",
        coberturaIsoFabricante: "5",
        cobertura: String(DEFAULT_FULL_COLOR_COVERAGE_PERCENT),
      },
    [consumibleCalculatorDraftById],
  );
  const updateConsumibleCalculatorDraft = React.useCallback(
    (
      consumibleId: string,
      patch: Partial<{
        contenido: string;
        rendimiento: string;
        coberturaIsoFabricante: string;
        cobertura: string;
      }>,
    ) => {
      setConsumibleCalculatorDraftById((current) => ({
        ...current,
        [consumibleId]: {
          ...getConsumibleCalculatorDraft(consumibleId),
          ...patch,
        },
      }));
    },
    [getConsumibleCalculatorDraft],
  );

  const templateInfo = React.useMemo(() => getMaquinariaTemplate(form.plantilla), [form.plantilla]);
  const templateMachineFields = React.useMemo(() => {
    if (!templateInfo) {
      return [];
    }

    const sections = templateInfo.sections.filter(
      (sectionItem) =>
        sectionItem.id === "capacidades_fisicas" || sectionItem.id === "parametros_tecnicos",
    );

    return sections.flatMap((sectionItem) =>
      sectionItem.fields
        .filter((fieldItem) => fieldItem.scope === "maquina")
        .map((fieldItem) => ({
          sectionId: sectionItem.id,
          sectionTitle: sectionItem.title,
          field: fieldItem,
        })),
    );
  }, [templateInfo]);
  const templateEditableFields = React.useMemo(
    () =>
      templateMachineFields.filter(
        (entry) => !MACHINE_DIRECT_FIELD_KEYS.has(entry.field.key),
      ),
    [templateMachineFields],
  );
  const requiredTemplateMachineKeySet = React.useMemo(
    () =>
      new Set(
        templateMachineFields
          .filter((entry) => entry.field.required)
          .map((entry) => entry.field.key),
      ),
    [templateMachineFields],
  );
  const perfilTemplateFields = React.useMemo(
    () =>
      templateInfo?.sections
        .find((sectionItem) => sectionItem.id === "perfiles_operativos")
        ?.fields.filter(
          (fieldItem) =>
            fieldItem.scope === "perfil_operativo" && fieldItem.key !== "calidad",
        ) ?? [],
    [templateInfo],
  );
  const printerChannelSourceFieldLabels = React.useMemo(() => {
    const colorLabel = templateMachineFields.find(
      (entry) => entry.field.key === "configuracionColor",
    )?.field.label;
    const canalesLabel = templateMachineFields.find(
      (entry) => entry.field.key === "configuracionCanales",
    )?.field.label;
    return { colorLabel, canalesLabel };
  }, [templateMachineFields]);
  const printerChannelSourceHelpText = React.useMemo(() => {
    const labels = [
      printerChannelSourceFieldLabels.colorLabel,
      printerChannelSourceFieldLabels.canalesLabel,
    ].filter((item): item is string => Boolean(item && item.trim()));
    if (labels.length === 0) {
      return "Parametros tecnicos del Paso 1";
    }
    return labels.join(" + ");
  }, [printerChannelSourceFieldLabels.canalesLabel, printerChannelSourceFieldLabels.colorLabel]);
  const consumibleTemplateFields = React.useMemo(
    () =>
      templateInfo?.sections
        .find((sectionItem) => sectionItem.id === "consumibles")
        ?.fields.filter((fieldItem) => fieldItem.scope === "consumible") ?? [],
    [templateInfo],
  );
  const desgasteTemplateFields = React.useMemo(
    () =>
      templateInfo?.sections
        .find((sectionItem) => sectionItem.id === "desgaste_repuestos")
        ?.fields.filter((fieldItem) => fieldItem.scope === "desgaste") ?? [],
    [templateInfo],
  );
  const consumibleTemplateFieldByKey = React.useMemo(
    () => new Map(consumibleTemplateFields.map((fieldItem) => [fieldItem.key, fieldItem])),
    [consumibleTemplateFields],
  );
  const desgasteTemplateFieldByKey = React.useMemo(
    () => new Map(desgasteTemplateFields.map((fieldItem) => [fieldItem.key, fieldItem])),
    [desgasteTemplateFields],
  );
  const consumibleTipoOptions = React.useMemo(
    () =>
      getTemplateSelectOptions(
        consumibleTemplateFieldByKey.get("tipo"),
        tipoConsumibleMaquinaItems as Array<{ value: string; label: string }>,
      ),
    [consumibleTemplateFieldByKey],
  );
  const consumibleUnidadOptions = React.useMemo(
    () =>
      getTemplateSelectOptions(
        consumibleTemplateFieldByKey.get("unidad"),
        unidadConsumoMaquinaItems as Array<{ value: string; label: string }>,
      ),
    [consumibleTemplateFieldByKey],
  );
  const desgasteTipoOptions = React.useMemo(
    () =>
      getTemplateSelectOptions(
        desgasteTemplateFieldByKey.get("tipo"),
        tipoComponenteDesgasteMaquinaItems as Array<{ value: string; label: string }>,
      ),
    [desgasteTemplateFieldByKey],
  );
  const desgasteUnidadOptions = React.useMemo(
    () =>
      getTemplateSelectOptions(
        desgasteTemplateFieldByKey.get("unidadDesgaste"),
        unidadDesgasteMaquinaItems as Array<{ value: string; label: string }>,
      ),
    [desgasteTemplateFieldByKey],
  );
  const consumibleExtraTemplateFields = React.useMemo(
    () => consumibleTemplateFields.filter((fieldItem) => !CONSUMIBLE_DIRECT_FIELD_KEYS.has(fieldItem.key)),
    [consumibleTemplateFields],
  );
  const desgasteExtraTemplateFields = React.useMemo(
    () => desgasteTemplateFields.filter((fieldItem) => !DESGASTE_DIRECT_FIELD_KEYS.has(fieldItem.key)),
    [desgasteTemplateFields],
  );
  const variantesConsumibleDisponibles = React.useMemo(
    () =>
      materiasPrimas
        .filter((materiaPrima) => materiaPrima.activo && materiaPrima.esConsumible)
        .flatMap((materiaPrima) =>
          materiaPrima.variantes
            .filter((variante) => variante.activo)
            .map((variante) => ({
              value: variante.id,
              label: `${materiaPrima.nombre} - ${getVariantFunctionalName(
                variante.nombreVariante,
                variante.atributosVariante,
              )}`,
              sku: variante.sku,
              precioReferencia: variante.precioReferencia,
              unidadStock: materiaPrima.unidadStock,
              nombre: materiaPrima.nombre,
              nombreVariante: getVariantFunctionalName(
                variante.nombreVariante,
                variante.atributosVariante,
              ),
              subfamilia: materiaPrima.subfamilia,
            })),
        )
        .sort((a, b) => a.label.localeCompare(b.label)),
    [materiasPrimas],
  );
  const variantesConsumibleImpresion = React.useMemo(
    () =>
      variantesConsumibleDisponibles.filter(
        (item) => item.subfamilia === "tinta_impresion" || item.subfamilia === "toner",
      ),
    [variantesConsumibleDisponibles],
  );
  const variantesRepuestoDisponibles = React.useMemo(
    () =>
      materiasPrimas
        .filter((materiaPrima) => materiaPrima.activo && materiaPrima.esRepuesto)
        .flatMap((materiaPrima) =>
          materiaPrima.variantes
            .filter((variante) => variante.activo)
            .map((variante) => ({
              value: variante.id,
              label: `${materiaPrima.nombre} - ${variante.nombreVariante || variante.sku}`,
              sku: variante.sku,
              precioReferencia: variante.precioReferencia,
              unidadStock: materiaPrima.unidadStock,
              nombre: materiaPrima.nombre,
            })),
        )
        .sort((a, b) => a.label.localeCompare(b.label)),
    [materiasPrimas],
  );
  const varianteConsumibleById = React.useMemo(
    () => new Map(variantesConsumibleDisponibles.map((item) => [item.value, item])),
    [variantesConsumibleDisponibles],
  );
  const varianteConsumibleImpresionById = React.useMemo(
    () => new Map(variantesConsumibleImpresion.map((item) => [item.value, item])),
    [variantesConsumibleImpresion],
  );
  const varianteRepuestoById = React.useMemo(
    () => new Map(variantesRepuestoDisponibles.map((item) => [item.value, item])),
    [variantesRepuestoDisponibles],
  );
  const perfilTemplateProductividadField = React.useMemo(
    () => perfilTemplateFields.find((fieldItem) => fieldItem.key === "productividad"),
    [perfilTemplateFields],
  );
  const templatePerfilProductivityUnit = React.useMemo(() => {
    const mapped = mapTemplateUnitToProductivityUnit(perfilTemplateProductividadField?.unit);
    return mapped ? toCombinedProductivityUnit(mapped) : undefined;
  }, [perfilTemplateProductividadField?.unit]);
  const defaultPerfilUnidadProductividad = React.useMemo(() => {
    if (templatePerfilProductivityUnit) {
      return templatePerfilProductivityUnit;
    }

    return toCombinedProductivityUnit(form.unidadProduccionPrincipal);
  }, [form.unidadProduccionPrincipal, templatePerfilProductivityUnit]);
  const catalogoFabricantes = React.useMemo(
    () => getCatalogoFabricantesPorPlantilla(form.plantilla),
    [form.plantilla],
  );
  const fabricantesCatalogo = React.useMemo(
    () => catalogoFabricantes.map((item) => item.fabricante),
    [catalogoFabricantes],
  );
  const modelosCatalogo = React.useMemo(() => {
    if (!form.fabricante) {
      return [];
    }

    const selected = catalogoFabricantes.find((item) => item.fabricante === form.fabricante);
    return selected?.modelos ?? [];
  }, [catalogoFabricantes, form.fabricante]);
  const modelosCatalogoGlobal = React.useMemo(
    () =>
      Array.from(
        new Set(catalogoFabricantes.flatMap((item) => item.modelos)),
      ).sort((a, b) => a.localeCompare(b)),
    [catalogoFabricantes],
  );
  const unidadProduccionPrincipalItems = React.useMemo(
    () =>
      unidadProduccionMaquinaItems.filter(
        (item) => item.value !== "ppm" && item.value !== "m2_h" && item.value !== "piezas_h",
      ),
    [],
  );
  const unidadProductividadItems = React.useMemo(
    () =>
      unidadProduccionMaquinaItems.filter((item) =>
        COMBINED_PRODUCTIVITY_UNIT_SET.has(item.value),
      ),
    [],
  );
  const fabricantesFiltrados = React.useMemo(() => {
    const normalized = fabricanteSearch.trim().toLowerCase();
    if (!normalized) {
      return fabricantesCatalogo;
    }

    return fabricantesCatalogo.filter((item) => item.toLowerCase().includes(normalized));
  }, [fabricanteSearch, fabricantesCatalogo]);
  const modelosFiltrados = React.useMemo(() => {
    const source = modelosCatalogo.length > 0 ? modelosCatalogo : modelosCatalogoGlobal;
    const normalized = modeloSearch.trim().toLowerCase();
    if (!normalized) {
      return source;
    }

    return source.filter((item) => item.toLowerCase().includes(normalized));
  }, [modeloSearch, modelosCatalogo, modelosCatalogoGlobal]);
  const plantaLabelById = React.useMemo(
    () => new Map(plantas.map((planta) => [planta.id, planta.nombre])),
    [plantas],
  );
  const centroLabelById = React.useMemo(
    () =>
      new Map(
        centrosCosto.map((centro) => [
          centro.id,
          `${centro.codigo} - ${centro.nombre}`,
        ]),
      ),
    [centrosCosto],
  );
  const centrosByPlanta = React.useMemo(
    () => centrosCosto.filter((centro) => centro.plantaId === form.plantaId),
    [centrosCosto, form.plantaId],
  );

  const maquinariaResumen = React.useMemo(() => {
    const maquinasActivas = maquinas.filter((maquina) => maquina.activo).length;
    const maquinasConPerfiles = maquinas.filter((maquina) => maquina.perfilesOperativos.length > 0).length;
    const maquinasListas = maquinas.filter(
      (maquina) => maquina.estadoConfiguracion === ("lista" as EstadoConfiguracionMaquina),
    ).length;

    return { maquinasActivas, maquinasConPerfiles, maquinasListas };
  }, [maquinas]);

  const filteredMaquinas = React.useMemo(() => {
    const normalized = filterText.trim().toLowerCase();

    return maquinas.filter((maquina) => {
      if (filterPlantilla !== "all" && maquina.plantilla !== filterPlantilla) {
        return false;
      }
      if (filterEstado !== "all" && maquina.estado !== filterEstado) {
        return false;
      }
      if (filterPlantaId !== "all" && maquina.plantaId !== filterPlantaId) {
        return false;
      }

      if (!normalized) {
        return true;
      }

      return (
        maquina.codigo.toLowerCase().includes(normalized) ||
        maquina.nombre.toLowerCase().includes(normalized) ||
        maquina.plantaNombre.toLowerCase().includes(normalized)
      );
    });
  }, [filterEstado, filterPlantilla, filterPlantaId, filterText, maquinas]);
  const selectedConsumiblePerfil = React.useMemo(
    () => perfiles.find((perfil) => perfil.id === selectedConsumiblePerfilId) ?? null,
    [perfiles, selectedConsumiblePerfilId],
  );
  const consumibleAnchorPerfilNombre = React.useMemo(
    () => perfiles.find((perfil) => perfil.nombre.trim())?.nombre.trim() ?? "",
    [perfiles],
  );
  const consumiblesPerfilActual = React.useMemo(() => {
    const nombrePerfil = sameConsumptionAllProfiles
      ? consumibleAnchorPerfilNombre
      : selectedConsumiblePerfil?.nombre?.trim();
    if (!nombrePerfil) {
      return [];
    }
    return consumibles.filter(
      (item) => (item.perfilOperativoNombre ?? "").trim() === nombrePerfil,
    );
  }, [
    consumibleAnchorPerfilNombre,
    consumibles,
    sameConsumptionAllProfiles,
    selectedConsumiblePerfil?.nombre,
  ]);
  const activeConsumibleCalculator = React.useMemo(
    () =>
      openConsumibleCalculatorId
        ? consumibles.find((item) => item.id === openConsumibleCalculatorId) ?? null
        : null,
    [consumibles, openConsumibleCalculatorId],
  );

  const reload = React.useCallback(() => {
    startReloading(async () => {
      try {
        const nextMaquinas = await getMaquinas();
        setMaquinas(nextMaquinas);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo actualizar maquinaria.");
      }
    });
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const data = await getMateriasPrimas();
        if (isMounted) {
          setMateriasPrimas(data);
        }
      } catch (error) {
        if (isMounted) {
          toast.error(
            error instanceof Error
              ? error.message
              : "No se pudo cargar el catalogo de materias primas.",
          );
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!form.centroCostoPrincipalId) {
      return;
    }

    const isAvailable = centrosByPlanta.some(
      (centro) => centro.id === form.centroCostoPrincipalId,
    );

    if (!isAvailable) {
      setForm((current) => ({
        ...current,
        centroCostoPrincipalId: undefined,
      }));
    }
  }, [centrosByPlanta, form.centroCostoPrincipalId]);

  React.useEffect(() => {
    if (form.plantilla !== "impresora_laser") {
      setIsFabricanteOtro(false);
      setIsModeloOtro(false);
      setFabricanteSearch("");
      setModeloSearch("");
      return;
    }

    if (!form.fabricante || !fabricantesCatalogo.includes(form.fabricante)) {
      setIsFabricanteOtro(Boolean(form.fabricante));
      return;
    }

    setIsFabricanteOtro(false);

    if (form.modelo && !modelosCatalogo.includes(form.modelo)) {
      setForm((current) => ({ ...current, modelo: "" }));
    }
    if (form.modelo && !modelosCatalogo.includes(form.modelo)) {
      setIsModeloOtro(true);
    } else {
      setIsModeloOtro(false);
    }
  }, [fabricantesCatalogo, form.fabricante, form.modelo, form.plantilla, modelosCatalogo]);

  React.useEffect(() => {
    const preset = getTechnicalPresetForMachine(form.plantilla, form.fabricante, form.modelo);
    if (!preset) {
      if (lastAppliedPresetKey) {
        setLastAppliedPresetKey("");
        setPresetAppliedParamKeys(new Set());
      }
      return;
    }

    const presetKey = `${form.plantilla}:${preset.fabricante}:${preset.modelo}`;
    if (presetKey === lastAppliedPresetKey) {
      return;
    }

    setForm((current) => {
      const currentParams = current.parametrosTecnicos ?? {};
      const nextParams = { ...currentParams, ...preset.parametrosTecnicos };
      const derived = getDerivedPrintableAreaParams(nextParams);

      return {
        ...current,
        parametrosTecnicos: derived
          ? { ...nextParams, areaImprimibleMaxima: derived.areaImprimibleMaxima }
          : nextParams,
      };
    });
    setLastAppliedPresetKey(presetKey);
    setPresetAppliedParamKeys(new Set(Object.keys(preset.parametrosTecnicos)));
  }, [form.fabricante, form.modelo, form.plantilla, lastAppliedPresetKey]);

  React.useEffect(() => {
    if (!templatePerfilProductivityUnit) {
      return;
    }

    setPerfiles((current) =>
      current.map((item) =>
        item.unidadProductividad === templatePerfilProductivityUnit
          ? item
          : { ...item, unidadProductividad: templatePerfilProductivityUnit },
      ),
    );
  }, [templatePerfilProductivityUnit]);

  React.useEffect(() => {
    if (perfiles.length === 0) {
      if (selectedPerfilId !== null) {
        setSelectedPerfilId(null);
      }
      if (selectedConsumiblePerfilId !== null) {
        setSelectedConsumiblePerfilId(null);
      }
      return;
    }

    if (!selectedPerfilId || !perfiles.some((item) => item.id === selectedPerfilId)) {
      setSelectedPerfilId(perfiles[0].id);
    }
    if (
      !selectedConsumiblePerfilId ||
      !perfiles.some((item) => item.id === selectedConsumiblePerfilId)
    ) {
      setSelectedConsumiblePerfilId(perfiles[0].id);
    }
  }, [perfiles, selectedConsumiblePerfilId, selectedPerfilId]);

  React.useEffect(() => {
    if (!showPrinterConsumiblesStep) {
      return;
    }

    const perfilesValidos = perfiles
      .map((perfil) => perfil.nombre.trim())
      .filter(Boolean);
    if (perfilesValidos.length === 0 || requiredPrinterChannels.length === 0) {
      return;
    }

    setConsumibles((current) => {
      const currentByPerfilYCanal = new Map<string, LocalConsumible>();
      current.forEach((item) => {
        const perfilNombre = String(item.perfilOperativoNombre ?? "").trim();
        const color = String(item.detalle?.color ?? "").trim().toLowerCase();
        if (!perfilNombre || !color) {
          return;
        }
        currentByPerfilYCanal.set(`${perfilNombre}::${color}`, item);
      });

      const anchorPerfil = perfilesValidos[0];
      const anchorByCanal = new Map<string, LocalConsumible>();
      requiredPrinterChannels.forEach((channel) => {
        const anchor = currentByPerfilYCanal.get(`${anchorPerfil}::${channel}`);
        if (anchor) {
          anchorByCanal.set(channel, anchor);
        }
      });

      const next: LocalConsumible[] = [];
      perfilesValidos.forEach((perfilNombre) => {
        requiredPrinterChannels.forEach((channel) => {
          const existing = currentByPerfilYCanal.get(`${perfilNombre}::${channel}`);
          const anchor = anchorByCanal.get(channel);
          const base = existing ?? anchor;
          const syncKey = String(base?.detalle?.syncKey ?? "") || createLocalId();

          if (base) {
            next.push({
              ...base,
              id: existing ? existing.id : createLocalId(),
              perfilOperativoNombre: perfilNombre,
              detalle: {
                ...(base.detalle ?? {}),
                color: channel,
                syncKey,
              },
            });
            return;
          }

          const tipo: LocalConsumible["tipo"] =
            channel === "barniz"
              ? "barniz"
              : form.plantilla === "impresora_laser"
                ? "toner"
                : "tinta";
          next.push({
            ...createConsumible(consumibleTemplateFields),
            id: createLocalId(),
            nombre: `${tipo === "barniz" ? "Barniz" : tipo === "toner" ? "Toner" : "Tinta"} ${channel}`,
            tipo,
            unidad: "ml",
            perfilOperativoNombre: perfilNombre,
            activo: true,
            detalle: { color: channel, syncKey },
          });
        });
      });

      const isSame =
        current.length === next.length &&
        current.every((item, index) => {
          const other = next[index];
          return (
            item.id === other.id &&
            item.perfilOperativoNombre === other.perfilOperativoNombre &&
            item.materiaPrimaVarianteId === other.materiaPrimaVarianteId &&
            item.tipo === other.tipo &&
            item.unidad === other.unidad &&
            item.consumoBase === other.consumoBase &&
            String(item.detalle?.color ?? "") === String(other.detalle?.color ?? "")
          );
        });
      return isSame ? current : next;
    });
  }, [
    consumibleTemplateFields,
    form.plantilla,
    perfiles,
    requiredPrinterChannels,
    showPrinterConsumiblesStep,
  ]);

  const resetEditor = React.useCallback(() => {
    setEditingId(null);
    setForm(createMaquinaForm(plantas[0]?.id ?? ""));
    setPerfiles([]);
    setSelectedPerfilId(null);
    setSelectedConsumiblePerfilId(null);
    setSameConsumptionAllProfiles(true);
    setConsumibles([]);
    setDesgastes([]);
    setLastAppliedPresetKey("");
    setPresetAppliedParamKeys(new Set());
    setFabricanteSearch("");
    setModeloSearch("");
    setIsFabricanteOtro(false);
    setIsModeloOtro(false);
    setActiveConfigTab("general");
  }, [plantas]);

  const openCreate = React.useCallback(() => {
    resetEditor();
    setIsSheetOpen(true);
  }, [resetEditor]);

  const openEdit = React.useCallback((maquina: Maquina) => {
    const parsed = fromMaquina(maquina);
    setEditingId(maquina.id);
    setForm(parsed.form);
    setPerfiles(parsed.perfiles);
    setSelectedPerfilId(parsed.perfiles[0]?.id ?? null);
    setSelectedConsumiblePerfilId(parsed.perfiles[0]?.id ?? null);
    setSameConsumptionAllProfiles(true);
    setConsumibles(parsed.consumibles);
    setDesgastes(parsed.desgastes);
    setLastAppliedPresetKey("");
    setPresetAppliedParamKeys(new Set());
    setFabricanteSearch("");
    setModeloSearch("");
    const catalogo = getCatalogoFabricantesPorPlantilla(parsed.form.plantilla);
    const fabricanteEnCatalogo = catalogo.some(
      (item) => item.fabricante === (parsed.form.fabricante ?? ""),
    );
    setIsFabricanteOtro(Boolean(parsed.form.fabricante) && !fabricanteEnCatalogo);
    const modelos = catalogo.find((item) => item.fabricante === parsed.form.fabricante)?.modelos ?? [];
    setIsModeloOtro(Boolean(parsed.form.modelo) && !modelos.includes(parsed.form.modelo ?? ""));
    setActiveConfigTab("general");
    setIsSheetOpen(true);
  }, []);

  const handleTemplateChange = React.useCallback((value: PlantillaMaquinaria) => {
    const nextSupportsPrinterConsumibles = supportsPrinterInkConsumption(value);
    const template = getMaquinariaTemplate(value);
    const nextConsumibleFields =
      template?.sections
        .find((sectionItem) => sectionItem.id === "consumibles")
        ?.fields.filter((fieldItem) => fieldItem.scope === "consumible") ?? [];
    const nextDesgasteFields =
      template?.sections
        .find((sectionItem) => sectionItem.id === "desgaste_repuestos")
        ?.fields.filter((fieldItem) => fieldItem.scope === "desgaste") ?? [];

    const defaultConsumible = createConsumible(nextConsumibleFields);
    const defaultDesgaste = createDesgaste(nextDesgasteFields);
    const nextConsumibleTipoOptions = getTemplateSelectOptions(
      nextConsumibleFields.find((fieldItem) => fieldItem.key === "tipo"),
      tipoConsumibleMaquinaItems as Array<{ value: string; label: string }>,
    );
    const nextConsumibleUnidadOptions = getTemplateSelectOptions(
      nextConsumibleFields.find((fieldItem) => fieldItem.key === "unidad"),
      unidadConsumoMaquinaItems as Array<{ value: string; label: string }>,
    );
    const nextDesgasteTipoOptions = getTemplateSelectOptions(
      nextDesgasteFields.find((fieldItem) => fieldItem.key === "tipo"),
      tipoComponenteDesgasteMaquinaItems as Array<{ value: string; label: string }>,
    );
    const nextDesgasteUnidadOptions = getTemplateSelectOptions(
      nextDesgasteFields.find((fieldItem) => fieldItem.key === "unidadDesgaste"),
      unidadDesgasteMaquinaItems as Array<{ value: string; label: string }>,
    );

    setForm((current) => ({
      ...current,
      plantilla: value,
      fabricante: value === current.plantilla ? current.fabricante : "",
      modelo: value === current.plantilla ? current.modelo : "",
      geometriaTrabajo: template?.geometry ?? current.geometriaTrabajo,
      unidadProduccionPrincipal: template?.defaultProductionUnit ?? current.unidadProduccionPrincipal,
    }));
    setConsumibles((current) => {
      if (!nextSupportsPrinterConsumibles) {
        return [];
      }
      return current.map((item) => ({
        ...item,
        tipo: nextConsumibleTipoOptions.some((option) => option.value === item.tipo)
          ? item.tipo
          : defaultConsumible.tipo,
        unidad: nextConsumibleUnidadOptions.some((option) => option.value === item.unidad)
          ? item.unidad
          : defaultConsumible.unidad,
      }));
    });
    setDesgastes((current) =>
      current.map((item) => ({
        ...item,
        tipo: nextDesgasteTipoOptions.some((option) => option.value === item.tipo)
          ? item.tipo
          : defaultDesgaste.tipo,
        unidadDesgaste: nextDesgasteUnidadOptions.some((option) => option.value === item.unidadDesgaste)
          ? item.unidadDesgaste
          : defaultDesgaste.unidadDesgaste,
      })),
    );
    setLastAppliedPresetKey("");
    setPresetAppliedParamKeys(new Set());
    setFabricanteSearch("");
    setModeloSearch("");
    setIsFabricanteOtro(false);
    setIsModeloOtro(false);
    if (!nextSupportsPrinterConsumibles) {
      setSelectedConsumiblePerfilId(null);
      setSameConsumptionAllProfiles(true);
    }
  }, []);

  const handleSave = React.useCallback(() => {
    if ((editingId && !(form.codigo ?? "").trim()) || !form.nombre.trim() || !form.plantaId) {
      toast.error("Completa nombre y planta.");
      return;
    }

    for (const entry of templateMachineFields) {
      const fieldItem = entry.field;
      if (!fieldItem.required) {
        continue;
      }

      const directValue = MACHINE_DIRECT_FIELD_KEYS.has(fieldItem.key)
        ? (() => {
            switch (fieldItem.key) {
              case "anchoUtil":
                return form.anchoUtil;
              case "largoUtil":
                return form.largoUtil;
              case "altoUtil":
                return form.altoUtil;
              case "espesorMaximo":
                return form.espesorMaximo;
              case "pesoMaximo":
                return form.pesoMaximo;
              default:
                return undefined;
            }
          })()
        : undefined;
      const rawValue =
        directValue !== undefined ? directValue : (form.parametrosTecnicos ?? {})[fieldItem.key];
      const currentValue =
        fieldItem.kind === "multiselect" ? toTemplateMultiselectValue(rawValue) : rawValue;
      const hasValue = Array.isArray(currentValue)
        ? currentValue.length > 0
        : fieldItem.kind === "boolean"
          ? true
          : String(currentValue ?? "").trim().length > 0;

      if (!hasValue) {
        toast.error(`Completa ${fieldItem.label} en parametros de maquina.`);
        return;
      }
    }

    for (const perfil of perfiles) {
      const perfilLabel = perfil.nombre.trim() || "sin nombre";

      for (const fieldItem of perfilTemplateFields) {
        if (!fieldItem.required || fieldItem.key === "nombre" || fieldItem.key === "productividad") {
          continue;
        }

        const currentValue = getPerfilValueByTemplateField(perfil, fieldItem);
        const hasValue = Array.isArray(currentValue)
          ? currentValue.length > 0
          : fieldItem.kind === "boolean"
            ? true
            : String(currentValue ?? "").trim().length > 0;

        if (!hasValue) {
          toast.error(
            `Completa ${fieldItem.label} en el perfil ${perfilLabel}.`,
          );
          return;
        }
      }
    }

    if (showPrinterConsumiblesStep) {
      for (const consumible of consumibles) {
        const consumibleLabel = consumible.nombre.trim() || "sin nombre";
        const color = String(consumible.detalle?.color ?? "").trim();

        if (!consumible.perfilOperativoNombre?.trim()) {
          toast.error(`Completa perfil operativo en el consumible ${consumibleLabel}.`);
          return;
        }
        if (!color) {
          toast.error(`Completa canal/color en el consumible ${consumibleLabel}.`);
          return;
        }
        if (!isUuid(consumible.materiaPrimaVarianteId)) {
          toast.error(`Selecciona una variante valida en el consumible ${consumibleLabel}.`);
          return;
        }
        if (!varianteConsumibleImpresionById.has(consumible.materiaPrimaVarianteId)) {
          toast.error(
            `El consumible ${consumibleLabel} referencia una variante inexistente o inactiva.`,
          );
          return;
        }

        for (const fieldItem of consumibleTemplateFields) {
          if (!fieldItem.required) {
            continue;
          }

          const currentValue = getConsumibleValueByTemplateField(consumible, fieldItem);
          const hasValue = Array.isArray(currentValue)
            ? currentValue.length > 0
            : fieldItem.kind === "boolean"
              ? true
              : String(currentValue ?? "").trim().length > 0;

          if (!hasValue) {
            toast.error(`Completa ${fieldItem.label} en el consumible ${consumibleLabel}.`);
            return;
          }
        }
      }
    }

    for (const desgaste of desgastes) {
      const desgasteLabel = desgaste.nombre.trim() || "sin nombre";
      if (!isUuid(desgaste.materiaPrimaVarianteId)) {
        toast.error(`Selecciona una variante valida en el componente ${desgasteLabel}.`);
        return;
      }
      if (!varianteRepuestoById.has(desgaste.materiaPrimaVarianteId)) {
        toast.error(
          `El componente ${desgasteLabel} referencia una variante inexistente o inactiva.`,
        );
        return;
      }

      for (const fieldItem of desgasteTemplateFields) {
        if (!fieldItem.required) {
          continue;
        }

        const currentValue = getDesgasteValueByTemplateField(desgaste, fieldItem);
        const hasValue = Array.isArray(currentValue)
          ? currentValue.length > 0
          : fieldItem.kind === "boolean"
            ? true
            : String(currentValue ?? "").trim().length > 0;

        if (!hasValue) {
          toast.error(`Completa ${fieldItem.label} en el componente ${desgasteLabel}.`);
          return;
        }
      }
    }

    const payload = toPayload(
      form,
      perfiles,
      showPrinterConsumiblesStep ? consumibles : [],
      desgastes,
    );

    startSaving(async () => {
      try {
        if (editingId) {
          await updateMaquina(editingId, payload);
          toast.success("Maquina actualizada.");
        } else {
          await createMaquina(payload);
          toast.success("Maquina creada.");
        }

        setIsSheetOpen(false);
        resetEditor();
        const next = await getMaquinas();
        setMaquinas(next);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la maquina.");
      }
    });
  }, [
    consumibleTemplateFields,
    consumibles,
    desgasteTemplateFields,
    desgastes,
    editingId,
    form,
    perfilTemplateFields,
    perfiles,
    resetEditor,
    showPrinterConsumiblesStep,
    templateMachineFields,
    varianteConsumibleImpresionById,
    varianteRepuestoById,
  ]);

  const selectedPerfil = React.useMemo(
    () => perfiles.find((item) => item.id === selectedPerfilId) ?? null,
    [perfiles, selectedPerfilId],
  );
  const formatoObjetivoField = React.useMemo(
    () => perfilTemplateFields.find((fieldItem) => fieldItem.key === "formatoObjetivo"),
    [perfilTemplateFields],
  );
  const selectedFormatoObjetivo = React.useMemo(() => {
    if (!selectedPerfil || !formatoObjetivoField) {
      return "";
    }

    const value = getPerfilValueByTemplateField(selectedPerfil, formatoObjetivoField);
    return typeof value === "string" ? value : "";
  }, [formatoObjetivoField, selectedPerfil]);

  const handleToggle = React.useCallback((id: string) => {
    setIsTogglingId(id);
    startSaving(async () => {
      try {
        await toggleMaquina(id);
        const next = await getMaquinas();
        setMaquinas(next);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo cambiar el estado.");
      } finally {
        setIsTogglingId(null);
      }
    });
  }, []);

  const handleQuickEditStart = React.useCallback((maquina: Maquina) => {
    setQuickEditId(maquina.id);
    setQuickEditNombre(maquina.nombre);
    setQuickEditEstado(maquina.estado);
  }, []);

  const handleQuickEditCancel = React.useCallback(() => {
    setQuickEditId(null);
    setQuickEditNombre("");
    setQuickEditEstado("activa");
  }, []);

  const handleQuickEditSave = React.useCallback(
    (maquina: Maquina) => {
      if (!quickEditNombre.trim()) {
        toast.error("El nombre no puede quedar vacio.");
        return;
      }

      const parsed = fromMaquina(maquina);
      const payload = toPayload(
        {
          ...parsed.form,
          nombre: quickEditNombre.trim(),
          estado: quickEditEstado,
        },
        parsed.perfiles,
        parsed.consumibles,
        parsed.desgastes,
      );

      startSaving(async () => {
        try {
          await updateMaquina(maquina.id, payload);
          const next = await getMaquinas();
          setMaquinas(next);
          handleQuickEditCancel();
          toast.success("Edicion rapida aplicada.");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "No se pudo guardar la edicion rapida.");
        }
      });
    },
    [handleQuickEditCancel, quickEditEstado, quickEditNombre],
  );

  const groupedTemplateEditableFields = React.useMemo(() => {
    const grouped = new Map<
      string,
      { title: string; description: string; entries: TemplateFieldEntry[] }
    >();

    for (const entry of templateEditableFields) {
      const group = getTemplateFieldGroup(entry);
      const current = grouped.get(group.key);

      if (!current) {
        grouped.set(group.key, {
          title: group.title,
          description: group.description,
          entries: [entry],
        });
        continue;
      }

      current.entries.push(entry);
    }

    const groupOrder = [
      "dimensiones",
      "margenes",
      "materiales",
      "calidad",
      "rendimiento",
      "energia",
      "otros",
    ];

    return groupOrder
      .map((groupKey) => {
        const group = grouped.get(groupKey);
        if (!group || group.entries.length === 0) {
          return null;
        }

        return {
          key: groupKey,
          title: group.title,
          description: group.description,
          entries: group.entries,
        };
      })
      .filter(Boolean) as Array<{
      key: string;
      title: string;
      description: string;
      entries: TemplateFieldEntry[];
    }>;
  }, [templateEditableFields]);

  const derivedPrintableArea = React.useMemo(
    () =>
      form.plantilla.startsWith("impresora_")
        ? getDerivedPrintableAreaParams(form.parametrosTecnicos)
        : null,
    [form.parametrosTecnicos, form.plantilla],
  );
  const derivedLaserWorkingSize = React.useMemo(() => {
    if (form.plantilla !== "impresora_laser" || !derivedPrintableArea) {
      return null;
    }

    return {
      anchoUtil: derivedPrintableArea.anchoImprimible,
      largoUtil: derivedPrintableArea.altoImprimible,
    };
  }, [derivedPrintableArea, form.plantilla]);

  const visibleCapacityFields = React.useMemo(() => {
    switch (form.geometriaTrabajo) {
      case "pliego":
        return {
          anchoUtil: true,
          largoUtil: true,
          altoUtil: false,
          espesorMaximo: false,
          pesoMaximo: false,
        };
      case "rollo":
        return {
          anchoUtil: true,
          largoUtil: false,
          altoUtil: false,
          espesorMaximo: true,
          pesoMaximo: true,
        };
      case "plano":
        return {
          anchoUtil: true,
          largoUtil: true,
          altoUtil: false,
          espesorMaximo: true,
          pesoMaximo: true,
        };
      case "cilindrico":
        return {
          anchoUtil: false,
          largoUtil: true,
          altoUtil: false,
          espesorMaximo: false,
          pesoMaximo: true,
        };
      case "volumen":
        return {
          anchoUtil: true,
          largoUtil: true,
          altoUtil: true,
          espesorMaximo: false,
          pesoMaximo: true,
        };
      default:
        return {
          anchoUtil: true,
          largoUtil: true,
          altoUtil: true,
          espesorMaximo: true,
          pesoMaximo: true,
        };
    }
  }, [form.geometriaTrabajo]);

  const progressByTab = React.useMemo(() => {
    const generalChecks = [
      Boolean((form.codigo ?? "").trim()),
      Boolean(form.nombre.trim()),
      Boolean(form.plantilla),
      Boolean(form.plantaId),
      Boolean(form.estado),
      Boolean(form.unidadProduccionPrincipal),
    ];
    const generalDone = generalChecks.filter(Boolean).length;
    const general = Math.round((generalDone / generalChecks.length) * 100);

    const perfilesTotal = perfiles.length * 3;
    const perfilesDone = perfiles.reduce((acc, perfil) => {
      return (
        acc +
        Number(Boolean(perfil.nombre.trim())) +
        Number(perfil.productividad !== undefined && !Number.isNaN(perfil.productividad)) +
        Number(Boolean(perfil.unidadProductividad))
      );
    }, 0);
    const perfilesProgress =
      perfilesTotal === 0 ? 0 : Math.round((perfilesDone / perfilesTotal) * 100);

    const consumiblesTotal = consumibles.length * 4;
    const consumiblesDone = consumibles.reduce((acc, consumible) => {
      const color = String(consumible.detalle?.color ?? "").trim();
      return (
        acc +
        Number(Boolean(consumible.perfilOperativoNombre?.trim())) +
        Number(Boolean(consumible.materiaPrimaVarianteId)) +
        Number(consumible.consumoBase !== undefined && !Number.isNaN(consumible.consumoBase)) +
        Number(Boolean(color))
      );
    }, 0);
    const consumiblesProgress =
      consumiblesTotal === 0 ? 0 : Math.round((consumiblesDone / consumiblesTotal) * 100);

    const desgasteTotal = desgastes.length * 4;
    const desgasteDone = desgastes.reduce((acc, desgaste) => {
      return (
        acc +
        Number(Boolean(desgaste.nombre.trim())) +
        Number(Boolean(desgaste.tipo)) +
        Number(Boolean(desgaste.unidadDesgaste)) +
        Number(desgaste.vidaUtilEstimada !== undefined && !Number.isNaN(desgaste.vidaUtilEstimada))
      );
    }, 0);
    const desgasteProgress =
      desgasteTotal === 0 ? 0 : Math.round((desgasteDone / desgasteTotal) * 100);

    const total = Math.round(
      (general + perfilesProgress + consumiblesProgress + desgasteProgress) / 4,
    );

    return {
      general,
      perfiles: perfilesProgress,
      consumibles: consumiblesProgress,
      desgaste: desgasteProgress,
      total,
    };
  }, [consumibles, desgastes, form.codigo, form.estado, form.nombre, form.plantaId, form.plantilla, form.unidadProduccionPrincipal, perfiles]);

  const isPresetParamField = React.useCallback(
    (fieldKey: string) => presetAppliedParamKeys.has(fieldKey),
    [presetAppliedParamKeys],
  );

  const getTemplateFieldValue = React.useCallback(
    (fieldItem: MaquinariaTemplateField) => {
      const directValue = MACHINE_DIRECT_FIELD_KEYS.has(fieldItem.key)
        ? (() => {
            switch (fieldItem.key) {
              case "anchoUtil":
                return form.anchoUtil;
              case "largoUtil":
                return form.largoUtil;
              case "altoUtil":
                return form.altoUtil;
              case "espesorMaximo":
                return form.espesorMaximo;
              case "pesoMaximo":
                return form.pesoMaximo;
              default:
                return undefined;
            }
          })()
        : undefined;
      const current =
        directValue !== undefined ? directValue : (form.parametrosTecnicos ?? {})[fieldItem.key];

      if (fieldItem.kind === "boolean") {
        return Boolean(current);
      }
      if (fieldItem.kind === "multiselect") {
        return toTemplateMultiselectValue(current);
      }
      if (current === undefined || current === null) {
        return "";
      }
      return String(current);
    },
    [
      form.altoUtil,
      form.anchoUtil,
      form.espesorMaximo,
      form.largoUtil,
      form.parametrosTecnicos,
      form.pesoMaximo,
    ],
  );

  const setTemplateFieldValue = React.useCallback(
    (
      fieldItem: MaquinariaTemplateField,
      value: string | boolean | string[] | null,
    ) => {
      if (fieldItem.key === "areaImprimibleMaxima") {
        return;
      }

      if (MACHINE_DIRECT_FIELD_KEYS.has(fieldItem.key)) {
        const numericValue = toFiniteNumberOrUndefined(String(value));
        setForm((current) => {
          const nextParams = { ...(current.parametrosTecnicos ?? {}) };
          delete nextParams[fieldItem.key];
          const base = {
            ...current,
            parametrosTecnicos: Object.keys(nextParams).length > 0 ? nextParams : undefined,
          };

          switch (fieldItem.key) {
            case "anchoUtil":
              return { ...base, anchoUtil: numericValue };
            case "largoUtil":
              return { ...base, largoUtil: numericValue };
            case "altoUtil":
              return { ...base, altoUtil: numericValue };
            case "espesorMaximo":
              return { ...base, espesorMaximo: numericValue };
            case "pesoMaximo":
              return { ...base, pesoMaximo: numericValue };
            default:
              return base;
          }
        });
        return;
      }

      setPresetAppliedParamKeys((current) => {
        if (!current.has(fieldItem.key)) {
          return current;
        }
        const next = new Set(current);
        next.delete(fieldItem.key);
        if (
          fieldItem.key === "anchoMaxHoja" ||
          fieldItem.key === "altoMaxHoja" ||
          fieldItem.key === "margenSuperior" ||
          fieldItem.key === "margenInferior" ||
          fieldItem.key === "margenIzquierdo" ||
          fieldItem.key === "margenDerecho"
        ) {
          next.delete("areaImprimibleMaxima");
        }
        return next;
      });

      setForm((current) => {
        const currentParams = current.parametrosTecnicos ?? {};
        const nextParams: Record<string, unknown> = { ...currentParams };

        if (fieldItem.kind === "boolean") {
          nextParams[fieldItem.key] = Boolean(value);
        } else if (fieldItem.kind === "number") {
          nextParams[fieldItem.key] = toFiniteNumberOrUndefined(String(value)) ?? null;
        } else if (fieldItem.kind === "multiselect") {
          const normalized = Array.isArray(value)
            ? value.map((itemValue) => itemValue.trim()).filter(Boolean)
            : toTemplateMultiselectValue(value);
          nextParams[fieldItem.key] = normalized.length > 0 ? normalized : null;
        } else {
          const normalized = String(value).trim();
          nextParams[fieldItem.key] = normalized || null;
        }

        return {
          ...current,
          parametrosTecnicos:
            fieldItem.key === "anchoMaxHoja" ||
            fieldItem.key === "altoMaxHoja" ||
            fieldItem.key === "margenSuperior" ||
            fieldItem.key === "margenInferior" ||
            fieldItem.key === "margenIzquierdo" ||
            fieldItem.key === "margenDerecho"
              ? (() => {
                  const derived = getDerivedPrintableAreaParams(nextParams);
                  if (!derived) {
                    return nextParams;
                  }

                  return {
                    ...nextParams,
                    areaImprimibleMaxima: derived.areaImprimibleMaxima,
                  };
                })()
              : nextParams,
        };
      });
    },
    [],
  );

  const setPerfilTemplateFieldValue = React.useCallback(
    (
      perfilId: string,
      fieldItem: MaquinariaTemplateField,
      value: string | boolean | string[] | null,
    ) => {
      setPerfiles((current) =>
        current.map((item) => {
          if (item.id !== perfilId) {
            return item;
          }

          const next: LocalPerfilOperativo = { ...item };
          const detail = { ...(item.detalle ?? {}) };
          const isDirectField = PERFIL_DIRECT_FIELD_KEYS.has(fieldItem.key);

          if (fieldItem.key === "nombre") {
            next.nombre = String(value);
          } else if (fieldItem.key === "formatoObjetivo") {
            const normalized = String(value || "").trim();
            if (!normalized) {
              delete detail[fieldItem.key];
              next.anchoAplicable = undefined;
              next.altoAplicable = undefined;
            } else {
              detail[fieldItem.key] = normalized;
              if (normalized === "personalizado") {
                next.anchoAplicable = item.anchoAplicable;
                next.altoAplicable = item.altoAplicable;
              } else {
                const dimension = SHEET_FORMAT_DIMENSIONS_CM[normalized];
                if (dimension) {
                  next.anchoAplicable = dimension.ancho;
                  next.altoAplicable = dimension.alto;
                } else {
                  next.anchoAplicable = undefined;
                  next.altoAplicable = undefined;
                }
              }
            }
          } else if (fieldItem.key === "productividad") {
            next.productividad = toFiniteNumberOrUndefined(String(value));
          } else if (fieldItem.key === "tiempoPreparacionMin") {
            next.tiempoPreparacionMin = toFiniteNumberOrUndefined(String(value));
          } else if (fieldItem.key === "tiempoRipMin") {
            next.tiempoRipMin = toFiniteNumberOrUndefined(String(value));
          } else if (fieldItem.key === "cantidadPasadas") {
            next.cantidadPasadas = toFiniteNumberOrUndefined(String(value));
          } else if (fieldItem.key === "dobleFaz") {
            next.dobleFaz = Boolean(value);
          } else if (fieldItem.key === "anchoAplicable") {
            next.anchoAplicable = toFiniteNumberOrUndefined(String(value));
          } else if (fieldItem.key === "altoAplicable") {
            next.altoAplicable = toFiniteNumberOrUndefined(String(value));
          } else if (fieldItem.key === "modoTrabajo") {
            next.modoTrabajo = String(value || "").trim() || undefined;
          } else if (!isDirectField) {
            if (fieldItem.kind === "boolean") {
              detail[fieldItem.key] = Boolean(value);
            } else if (fieldItem.kind === "number") {
              const numeric = toFiniteNumberOrUndefined(String(value));
              if (numeric === undefined) {
                delete detail[fieldItem.key];
              } else {
                detail[fieldItem.key] = numeric;
              }
            } else if (fieldItem.kind === "multiselect") {
              const normalized = Array.isArray(value)
                ? value.map((itemValue) => itemValue.trim()).filter(Boolean)
                : [];
              if (normalized.length === 0) {
                delete detail[fieldItem.key];
              } else {
                detail[fieldItem.key] = normalized;
              }
            } else {
              const normalized = String(value || "").trim();
              if (!normalized) {
                delete detail[fieldItem.key];
              } else {
                detail[fieldItem.key] = normalized;
              }
            }
          }

          if (PERFIL_MODE_SOURCE_KEYS.has(fieldItem.key)) {
            const normalized = String(value || "").trim();
            if (!normalized) {
              next.modoTrabajo = undefined;
            } else {
              next.modoTrabajo = toModeTrabajoLabel(fieldItem, normalized);
            }
          }

          if (fieldItem.key === "productividad" && templatePerfilProductivityUnit) {
            next.unidadProductividad = templatePerfilProductivityUnit;
          }

          if (!isDirectField) {
            next.detalle = Object.keys(detail).length > 0 ? detail : undefined;
          }

          return next;
        }),
      );
    },
    [templatePerfilProductivityUnit],
  );

  const setConsumibleTemplateFieldValue = React.useCallback(
    (
      consumibleId: string,
      fieldItem: MaquinariaTemplateField,
      value: string | boolean | string[] | null,
    ) => {
      setConsumibles((current) =>
        current.map((item) => {
          if (item.id !== consumibleId) {
            return item;
          }

          const next: LocalConsumible = { ...item };
          const detail = { ...(item.detalle ?? {}) };
          const isDirectField = CONSUMIBLE_DIRECT_FIELD_KEYS.has(fieldItem.key);

          if (fieldItem.key === "materiaPrimaVarianteId") {
            const nextId = String(value || "").trim();
            next.materiaPrimaVarianteId = nextId;
            const selected = varianteConsumibleById.get(nextId);
            if (selected) {
              next.nombre = selected.nombre;
              const mappedUnit = mapUnidadMateriaPrimaToConsumo(selected.unidadStock);
              if (mappedUnit) {
                next.unidad = mappedUnit;
              }
            }
          } else if (fieldItem.key === "nombre") {
            next.nombre = String(value || "");
          } else if (fieldItem.key === "tipo") {
            next.tipo = String(value || "").trim() as LocalConsumible["tipo"];
          } else if (fieldItem.key === "unidad") {
            next.unidad = String(value || "").trim() as LocalConsumible["unidad"];
          } else if (fieldItem.key === "rendimientoEstimado") {
            next.rendimientoEstimado = toFiniteNumberOrUndefined(String(value || ""));
          } else if (fieldItem.key === "consumoBase") {
            next.consumoBase = toFiniteNumberOrUndefined(String(value || ""));
          } else if (fieldItem.key === "perfilOperativoNombre") {
            next.perfilOperativoNombre = String(value || "").trim() || undefined;
          } else if (fieldItem.key === "activo") {
            next.activo = Boolean(value);
          } else if (fieldItem.key === "observaciones") {
            next.observaciones = String(value || "");
          } else if (!isDirectField) {
            if (fieldItem.kind === "boolean") {
              detail[fieldItem.key] = Boolean(value);
            } else if (fieldItem.kind === "number") {
              const numeric = toFiniteNumberOrUndefined(String(value || ""));
              if (numeric === undefined) {
                delete detail[fieldItem.key];
              } else {
                detail[fieldItem.key] = numeric;
              }
            } else if (fieldItem.kind === "multiselect") {
              const normalized = Array.isArray(value)
                ? value.map((itemValue) => itemValue.trim()).filter(Boolean)
                : [];
              if (normalized.length === 0) {
                delete detail[fieldItem.key];
              } else {
                detail[fieldItem.key] = normalized;
              }
            } else {
              const normalized = String(value || "").trim();
              if (!normalized) {
                delete detail[fieldItem.key];
              } else {
                detail[fieldItem.key] = normalized;
              }
            }
          }

          if (!isDirectField) {
            next.detalle = Object.keys(detail).length > 0 ? detail : undefined;
          }

          return next;
        }),
      );
    },
    [varianteConsumibleById],
  );

  const setDesgasteTemplateFieldValue = React.useCallback(
    (
      desgasteId: string,
      fieldItem: MaquinariaTemplateField,
      value: string | boolean | string[] | null,
    ) => {
      setDesgastes((current) =>
        current.map((item) => {
          if (item.id !== desgasteId) {
            return item;
          }

          const next: LocalDesgaste = { ...item };
          const detail = { ...(item.detalle ?? {}) };
          const isDirectField = DESGASTE_DIRECT_FIELD_KEYS.has(fieldItem.key);

          if (fieldItem.key === "materiaPrimaVarianteId") {
            const nextId = String(value || "").trim();
            next.materiaPrimaVarianteId = nextId;
            const selected = varianteRepuestoById.get(nextId);
            if (selected) {
              next.nombre = selected.nombre;
            }
          } else if (fieldItem.key === "nombre") {
            next.nombre = String(value || "");
          } else if (fieldItem.key === "tipo") {
            next.tipo = String(value || "").trim() as LocalDesgaste["tipo"];
          } else if (fieldItem.key === "vidaUtilEstimada") {
            next.vidaUtilEstimada = toFiniteNumberOrUndefined(String(value || ""));
          } else if (fieldItem.key === "unidadDesgaste") {
            next.unidadDesgaste = String(value || "").trim() as LocalDesgaste["unidadDesgaste"];
          } else if (fieldItem.key === "modoProrrateo") {
            next.modoProrrateo = String(value || "");
          } else if (fieldItem.key === "activo") {
            next.activo = Boolean(value);
          } else if (fieldItem.key === "observaciones") {
            next.observaciones = String(value || "");
          } else if (!isDirectField) {
            if (fieldItem.kind === "boolean") {
              detail[fieldItem.key] = Boolean(value);
            } else if (fieldItem.kind === "number") {
              const numeric = toFiniteNumberOrUndefined(String(value || ""));
              if (numeric === undefined) {
                delete detail[fieldItem.key];
              } else {
                detail[fieldItem.key] = numeric;
              }
            } else if (fieldItem.kind === "multiselect") {
              const normalized = Array.isArray(value)
                ? value.map((itemValue) => itemValue.trim()).filter(Boolean)
                : [];
              if (normalized.length === 0) {
                delete detail[fieldItem.key];
              } else {
                detail[fieldItem.key] = normalized;
              }
            } else {
              const normalized = String(value || "").trim();
              if (!normalized) {
                delete detail[fieldItem.key];
              } else {
                detail[fieldItem.key] = normalized;
              }
            }
          }

          if (!isDirectField) {
            next.detalle = Object.keys(detail).length > 0 ? detail : undefined;
          }

          return next;
        }),
      );
    },
    [varianteRepuestoById],
  );

  const updatePrinterConsumibleRow = React.useCallback(
    (
      consumibleId: string,
      patch: Partial<LocalConsumible>,
      detailPatch?: Record<string, unknown>,
    ) => {
      setConsumibles((current) =>
        current.map((item) => {
          const edited = current.find((row) => row.id === consumibleId);
          if (!edited) {
            return item;
          }
          const editedSyncKey = String(edited.detalle?.syncKey ?? "");
          const itemSyncKey = String(item.detalle?.syncKey ?? "");
          const shouldUpdate = sameConsumptionAllProfiles
            ? editedSyncKey.length > 0 && itemSyncKey === editedSyncKey
            : item.id === consumibleId;
          if (!shouldUpdate) {
            return item;
          }
          const nextDetail = {
            ...(item.detalle ?? {}),
            ...(detailPatch ?? {}),
          };
          return {
            ...item,
            ...patch,
            detalle: Object.keys(nextDetail).length > 0 ? nextDetail : undefined,
          };
        }),
      );
    },
    [sameConsumptionAllProfiles],
  );

  const removePrinterConsumibleRow = React.useCallback((consumibleId: string) => {
    setConsumibles((current) => {
      const edited = current.find((item) => item.id === consumibleId);
      if (!edited) {
        return current;
      }
      if (!sameConsumptionAllProfiles) {
        return current.filter((item) => item.id !== consumibleId);
      }
      const editedSyncKey = String(edited.detalle?.syncKey ?? "");
      if (!editedSyncKey) {
        return current.filter((item) => item.id !== consumibleId);
      }
      return current.filter((item) => String(item.detalle?.syncKey ?? "") !== editedSyncKey);
    });
  }, [sameConsumptionAllProfiles]);

  return (
    <section className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Maquinaria</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Configura maquinas desde plantillas del sistema. Los perfiles operativos, consumibles y desgaste se usan como base de costos tecnicos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={reload} disabled={isReloading}>
            {isReloading ? <LoaderCircleIcon className="animate-spin" data-icon="inline-start" /> : <RefreshCcwIcon data-icon="inline-start" />}
            Actualizar
          </Button>
          <Button onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            Nueva maquina
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Registradas</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold">{maquinas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Activas</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold">{maquinariaResumen.maquinasActivas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Configuracion lista</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold">{maquinariaResumen.maquinasListas}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-3 md:grid-cols-4">
            <Field>
              <FieldLabel>Buscar</FieldLabel>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={filterText}
                  onChange={(event) => setFilterText(event.target.value)}
                  placeholder="Codigo, nombre o planta"
                />
              </div>
            </Field>
            <Field>
              <FieldLabel>Plantilla</FieldLabel>
              <Select
                value={filterPlantilla}
                onValueChange={(value) =>
                  setFilterPlantilla((value as PlantillaMaquinaria | "all") ?? "all")
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {filterPlantilla === "all"
                      ? "Todas"
                      : plantillaMaquinariaItems.find((item) => item.value === filterPlantilla)?.label ??
                        formatTechnicalValue(filterPlantilla)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Todas</SelectItem>
                    {plantillaMaquinariaItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Estado</FieldLabel>
              <Select
                value={filterEstado}
                onValueChange={(value) =>
                  setFilterEstado((value as MaquinaPayload["estado"] | "all") ?? "all")
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {filterEstado === "all"
                      ? "Todos"
                      : estadoMaquinaItems.find((item) => item.value === filterEstado)?.label ??
                        formatTechnicalValue(filterEstado)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Todos</SelectItem>
                    {estadoMaquinaItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Planta</FieldLabel>
                <Select
                  value={filterPlantaId}
                  onValueChange={(value) => setFilterPlantaId(value ?? "all")}
                >
                  <SelectTrigger>
                  <SelectValue>
                    {filterPlantaId === "all"
                      ? "Todas"
                      : plantaLabelById.get(filterPlantaId) ?? "Planta no disponible"}
                  </SelectValue>
                  </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Todas</SelectItem>
                    {plantas.map((planta) => (
                      <SelectItem key={planta.id} value={planta.id}>
                        {planta.nombre}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {filteredMaquinas.length === 0 ? (
        <Empty className="min-h-[380px] rounded-2xl border border-dashed border-border/70 bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Settings2Icon />
            </EmptyMedia>
            <EmptyTitle>Sin maquinas cargadas</EmptyTitle>
            <EmptyDescription>
              Crea la primera maquina desde una plantilla. Puedes comenzar con los campos minimos y completar perfiles/consumibles en pasos.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Listado</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codigo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Plantilla</TableHead>
                  <TableHead>Planta</TableHead>
                  <TableHead>Perfiles</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaquinas.map((maquina) => (
                  <TableRow key={maquina.id}>
                    <TableCell className="font-medium">{maquina.codigo}</TableCell>
                    <TableCell>
                      {quickEditId === maquina.id ? (
                        <Input
                          value={quickEditNombre}
                          onChange={(event) => setQuickEditNombre(event.target.value)}
                        />
                      ) : (
                        maquina.nombre
                      )}
                    </TableCell>
                    <TableCell>{getPlantillaMaquinariaLabel(maquina.plantilla)}</TableCell>
                    <TableCell>{maquina.plantaNombre}</TableCell>
                    <TableCell>{maquina.perfilesOperativos.length}</TableCell>
                    <TableCell>
                      {quickEditId === maquina.id ? (
                        <Select
                          value={quickEditEstado}
                          onValueChange={(value) =>
                            setQuickEditEstado(value as MaquinaPayload["estado"])
                          }
                        >
                          <SelectTrigger>
                            <SelectValue>
                              {estadoMaquinaItems.find((item) => item.value === quickEditEstado)?.label ??
                                formatTechnicalValue(quickEditEstado)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {estadoMaquinaItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={maquina.activo ? "default" : "secondary"}>
                          {estadoMaquinaItems.find((item) => item.value === maquina.estado)?.label ?? maquina.estado}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {quickEditId === maquina.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleQuickEditSave(maquina)}
                              disabled={isSaving}
                            >
                              <SaveIcon data-icon="inline-start" />
                              Guardar
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleQuickEditCancel}>
                              <XIcon data-icon="inline-start" />
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleQuickEditStart(maquina)}>
                              <PencilIcon data-icon="inline-start" />
                              Edicion rapida
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openEdit(maquina)}>
                              <PencilIcon data-icon="inline-start" />
                              Editar
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggle(maquina.id)}
                          disabled={isTogglingId === maquina.id}
                        >
                          {isTogglingId === maquina.id ? (
                            <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
                          ) : (
                            <Trash2Icon data-icon="inline-start" />
                          )}
                          {maquina.activo ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-screen max-w-none overflow-y-auto data-[side=right]:w-[94vw] data-[side=right]:sm:max-w-[94vw] xl:data-[side=right]:w-[1120px] xl:data-[side=right]:sm:max-w-[1120px]">
          <SheetHeader className="px-4 pb-3 md:px-6">
            <SheetTitle>{editingId ? "Editar maquina" : "Nueva maquina"}</SheetTitle>
            <SheetDescription>
              Completa datos base y luego agrega perfiles, consumibles y desgaste para mejorar el costeo tecnico.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-6 md:px-6">
          <Tabs
            value={activeConfigTab}
            onValueChange={(value) =>
              setActiveConfigTab(
                (value as "general" | "perfiles" | "consumibles" | "desgaste") || "general",
              )
            }
            className="mt-3 flex flex-col gap-6"
          >
            <Card className="mx-auto w-full max-w-5xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Progreso de alta</CardTitle>
                <FieldDescription>
                  Completa los datos base y luego avanza por perfiles, consumibles y desgaste.
                </FieldDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-destructive">*</span> Campo obligatorio
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Total</span>
                    <span className="text-muted-foreground">{progressByTab.total}%</span>
                  </div>
                  <Progress value={progressByTab.total} />
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Datos base</p>
                    <Progress value={progressByTab.general} />
                    <p className="text-xs">{progressByTab.general}%</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Perfiles</p>
                    <Progress value={progressByTab.perfiles} />
                    <p className="text-xs">{progressByTab.perfiles}%</p>
                  </div>
                  {showPrinterConsumiblesStep ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Consumibles</p>
                      <Progress value={progressByTab.consumibles} />
                      <p className="text-xs">{progressByTab.consumibles}%</p>
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Desgaste</p>
                    <Progress value={progressByTab.desgaste} />
                    <p className="text-xs">{progressByTab.desgaste}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <TabsList className="mx-auto w-full max-w-5xl justify-start overflow-x-auto">
              <TabsTrigger value="general">1. Datos base</TabsTrigger>
              <TabsTrigger value="perfiles">2. Perfiles operativos</TabsTrigger>
              {showPrinterConsumiblesStep ? (
                <TabsTrigger value="consumibles">3. Consumibles</TabsTrigger>
              ) : null}
              <TabsTrigger value="desgaste">
                {showPrinterConsumiblesStep ? "4. Desgaste y repuestos" : "3. Desgaste y repuestos"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="m-0">
              <div className="flex flex-col gap-4">
                <Card className="mx-auto w-full max-w-5xl">
                  <CardHeader>
                    <CardTitle className="text-base">1. Identificacion de la maquina</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup className="grid gap-4 md:grid-cols-2">
                      <Field>
                        <div className="flex items-center gap-1">
                          <FieldLabel htmlFor="codigo">Codigo</FieldLabel>
                          <Tooltip>
                            <TooltipTrigger className="inline-flex items-center text-muted-foreground">
                              <InfoIcon className="size-4" />
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              Identificador unico por tenant generado por el sistema.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          id="codigo"
                          value={editingId ? form.codigo ?? "" : "Se asignara automaticamente al guardar"}
                          disabled
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="nombre">
                          Nombre
                          {renderRequiredAsterisk(true)}
                        </FieldLabel>
                        <Input
                          id="nombre"
                          value={form.nombre}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, nombre: event.target.value }))
                          }
                        />
                      </Field>
                      <Field>
                        <div className="flex items-center gap-1">
                          <FieldLabel>
                            Plantilla
                            {renderRequiredAsterisk(true)}
                          </FieldLabel>
                          <Tooltip>
                            <TooltipTrigger className="inline-flex items-center text-muted-foreground">
                              <InfoIcon className="size-4" />
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              La plantilla define campos y defaults tecnicos. No se recomienda cambiarla despues.
                            </TooltipContent>
                          </Tooltip>
                          {renderTooltipIcon(templateInfo?.help.summary)}
                        </div>
                        <Select
                          value={form.plantilla}
                          onValueChange={(value) => handleTemplateChange(value as PlantillaMaquinaria)}
                        >
                          <SelectTrigger>
                            <SelectValue>
                              {plantillaMaquinariaItems.find((item) => item.value === form.plantilla)?.label ??
                                formatTechnicalValue(form.plantilla)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {plantillaMaquinariaItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel>Numero de serie</FieldLabel>
                        <Input
                          value={form.numeroSerie || ""}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, numeroSerie: event.target.value }))
                          }
                          placeholder="Opcional"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Fecha de alta</FieldLabel>
                        <Input
                          type="date"
                          value={form.fechaAlta || ""}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              fechaAlta: event.target.value || undefined,
                            }))
                          }
                        />
                      </Field>
                      {form.plantilla === "impresora_laser" ? (
                        <>
                          <Field>
                            <div className="flex items-center gap-1">
                              <FieldLabel>Fabricante</FieldLabel>
                              {renderTooltipIcon("Selecciona del catalogo o usa Otro si no aparece.")}
                            </div>
                            {isFabricanteOtro ? (
                              <div className="space-y-2">
                                <Input
                                  value={form.fabricante || ""}
                                  onChange={(event) =>
                                    setForm((current) => ({
                                      ...current,
                                      fabricante: event.target.value,
                                      modelo: "",
                                    }))
                                  }
                                  placeholder="Escribe fabricante"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setIsFabricanteOtro(false);
                                    setForm((current) => ({
                                      ...current,
                                      fabricante: "",
                                      modelo: "",
                                    }));
                                  }}
                                >
                                  Volver al listado
                                </Button>
                              </div>
                            ) : (
                              <Select
                                value={form.fabricante || EMPTY_SELECT_VALUE}
                                onValueChange={(value) => {
                                  const normalized = typeof value === "string" ? value : "";
                                  if (value === OTHER_SELECT_VALUE) {
                                    setIsFabricanteOtro(true);
                                    setFabricanteSearch("");
                                    setForm((current) => ({
                                      ...current,
                                      fabricante: "",
                                      modelo: "",
                                    }));
                                    return;
                                  }

                                  setFabricanteSearch("");
                                  setForm((current) => ({
                                    ...current,
                                    fabricante: normalized === EMPTY_SELECT_VALUE ? "" : normalized,
                                    modelo: "",
                                  }));
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar fabricante">
                                    {form.fabricante || "Seleccionar fabricante"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <div className="sticky top-0 z-10 border-b bg-popover p-2">
                                    <Input
                                      value={fabricanteSearch}
                                      onChange={(event) => setFabricanteSearch(event.target.value)}
                                      onKeyDown={(event) => event.stopPropagation()}
                                      onClick={(event) => event.stopPropagation()}
                                      placeholder="Buscar fabricante"
                                    />
                                  </div>
                                  <SelectGroup>
                                    <SelectItem value={EMPTY_SELECT_VALUE}>
                                      Seleccionar fabricante
                                    </SelectItem>
                                    {fabricantesFiltrados.map((fabricante) => (
                                      <SelectItem key={fabricante} value={fabricante}>
                                        {fabricante}
                                      </SelectItem>
                                    ))}
                                    {fabricantesFiltrados.length === 0 ? (
                                      <div className="px-2 py-2 text-xs text-muted-foreground">
                                        Sin resultados para la busqueda.
                                      </div>
                                    ) : null}
                                    <SelectItem value={OTHER_SELECT_VALUE}>Otro</SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            )}
                          </Field>
                          <Field>
                            <div className="flex items-center gap-1">
                              <FieldLabel>Modelo</FieldLabel>
                              {renderTooltipIcon("El listado se filtra segun el fabricante seleccionado.")}
                            </div>
                            {isModeloOtro || isFabricanteOtro ? (
                              <div className="space-y-2">
                                <Input
                                  value={form.modelo || ""}
                                  onChange={(event) =>
                                    setForm((current) => ({
                                      ...current,
                                      modelo: event.target.value,
                                    }))
                                  }
                                  placeholder="Escribe modelo"
                                />
                                {!isFabricanteOtro ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setIsModeloOtro(false);
                                      setForm((current) => ({ ...current, modelo: "" }));
                                    }}
                                  >
                                    Volver al listado
                                  </Button>
                                ) : null}
                              </div>
                            ) : (
                              <Select
                                value={form.modelo || EMPTY_SELECT_VALUE}
                                onValueChange={(value) => {
                                  const normalized = typeof value === "string" ? value : "";
                                  if (value === OTHER_SELECT_VALUE) {
                                    setIsModeloOtro(true);
                                    setModeloSearch("");
                                    setForm((current) => ({ ...current, modelo: "" }));
                                    return;
                                  }

                                  setModeloSearch("");
                                  setForm((current) => ({
                                    ...current,
                                    modelo: normalized === EMPTY_SELECT_VALUE ? "" : normalized,
                                  }));
                                }}
                                disabled={!form.fabricante}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar modelo">
                                    {form.modelo || "Seleccionar modelo"}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <div className="sticky top-0 z-10 border-b bg-popover p-2">
                                    <Input
                                      value={modeloSearch}
                                      onChange={(event) => setModeloSearch(event.target.value)}
                                      onKeyDown={(event) => event.stopPropagation()}
                                      onClick={(event) => event.stopPropagation()}
                                      placeholder="Buscar modelo"
                                    />
                                  </div>
                                  <SelectGroup>
                                    <SelectItem value={EMPTY_SELECT_VALUE}>
                                      Seleccionar modelo
                                    </SelectItem>
                                    {modelosFiltrados.map((modelo) => (
                                      <SelectItem key={modelo} value={modelo}>
                                        {modelo}
                                      </SelectItem>
                                    ))}
                                    {modelosFiltrados.length === 0 ? (
                                      <div className="px-2 py-2 text-xs text-muted-foreground">
                                        Sin resultados para la busqueda.
                                      </div>
                                    ) : null}
                                    <SelectItem value={OTHER_SELECT_VALUE}>Otro</SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            )}
                          </Field>
                        </>
                      ) : (
                        <>
                          <Field>
                            <FieldLabel>Fabricante</FieldLabel>
                            <Input
                              value={form.fabricante || ""}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, fabricante: event.target.value }))
                              }
                            />
                          </Field>
                          <Field>
                            <FieldLabel>Modelo</FieldLabel>
                            <Input
                              value={form.modelo || ""}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, modelo: event.target.value }))
                              }
                            />
                          </Field>
                        </>
                      )}
                    </FieldGroup>
                  </CardContent>
                </Card>

                <Card className="mx-auto w-full max-w-5xl">
                  <CardHeader>
                    <CardTitle className="text-base">2. Estado operativo y costeo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup className="grid gap-4 md:grid-cols-2">
                      <Field>
                        <FieldLabel>
                          Estado operativo
                          {renderRequiredAsterisk(true)}
                        </FieldLabel>
                        <Select
                          value={form.estado}
                          onValueChange={(value) =>
                            setForm((current) => ({
                              ...current,
                              estado: value as MaquinaPayload["estado"],
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue>
                              {estadoMaquinaItems.find((item) => item.value === form.estado)?.label ??
                                formatTechnicalValue(form.estado)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {estadoMaquinaItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <div className="flex items-center gap-1">
                          <FieldLabel>Completitud de ficha</FieldLabel>
                          {renderTooltipIcon("Se calcula automaticamente al guardar segun los datos cargados.")}
                        </div>
                        <Input
                          value={
                            estadoConfiguracionMaquinaItems.find(
                              (item) => item.value === (form.estadoConfiguracion || "borrador"),
                            )?.label ?? "Borrador"
                          }
                          disabled
                        />
                      </Field>
                      <Field>
                        <div className="flex items-center gap-1">
                          <FieldLabel>
                            Geometria de trabajo
                            {renderRequiredAsterisk(true)}
                          </FieldLabel>
                          {renderTooltipIcon("Se completa automaticamente segun la plantilla seleccionada.")}
                        </div>
                        <Select
                          value={form.geometriaTrabajo}
                          disabled
                          onValueChange={(value) =>
                            setForm((current) => ({
                              ...current,
                              geometriaTrabajo: value as MaquinaPayload["geometriaTrabajo"],
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue>
                              {geometriaTrabajoMaquinaItems.find(
                                (item) => item.value === form.geometriaTrabajo,
                              )?.label ?? formatTechnicalValue(form.geometriaTrabajo)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {geometriaTrabajoMaquinaItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel>
                          Unidad de produccion
                          {renderRequiredAsterisk(true)}
                        </FieldLabel>
                        <Select
                          value={form.unidadProduccionPrincipal}
                          onValueChange={(value) =>
                            setForm((current) => ({
                              ...current,
                              unidadProduccionPrincipal:
                                value as MaquinaPayload["unidadProduccionPrincipal"],
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue>
                              {unidadProduccionMaquinaItems.find(
                                (item) => item.value === form.unidadProduccionPrincipal,
                              )?.label ?? formatTechnicalValue(form.unidadProduccionPrincipal)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {unidadProduccionPrincipalItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field className="md:col-span-2">
                        <div className="flex items-center justify-between rounded-md border p-3">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1">
                              <FieldLabel>Maquina activa</FieldLabel>
                              {renderTooltipIcon("La maquina puede usarse en operacion y costeo.")}
                            </div>
                          </div>
                          <Switch
                            checked={form.activo}
                            onCheckedChange={(checked) =>
                              setForm((current) => ({ ...current, activo: checked }))
                            }
                          />
                        </div>
                      </Field>
                    </FieldGroup>
                  </CardContent>
                </Card>

                <Card className="mx-auto w-full max-w-5xl">
                  <CardHeader>
                    <CardTitle className="text-base">3. Planta y centro de costo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup className="grid gap-4 md:grid-cols-2">
                      <Field>
                        <FieldLabel>
                          Planta
                          {renderRequiredAsterisk(true)}
                        </FieldLabel>
                        <Select
                          value={form.plantaId}
                          onValueChange={(value) =>
                            setForm((current) => ({
                              ...current,
                              plantaId: value ?? current.plantaId,
                              centroCostoPrincipalId: undefined,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar planta">
                              {plantaLabelById.get(form.plantaId) ?? "Seleccionar planta"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {plantas.map((planta) => (
                                <SelectItem key={planta.id} value={planta.id}>
                                  {planta.nombre}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel>Centro de costo principal</FieldLabel>
                        <Select
                          value={form.centroCostoPrincipalId || EMPTY_SELECT_VALUE}
                          onValueChange={(value) =>
                            setForm((current) => ({
                              ...current,
                              centroCostoPrincipalId:
                                value === EMPTY_SELECT_VALUE || value === null
                                  ? undefined
                                  : value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue>
                              {form.centroCostoPrincipalId
                                ? centroLabelById.get(form.centroCostoPrincipalId) ??
                                  "Centro no disponible"
                                : "Sin centro principal"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value={EMPTY_SELECT_VALUE}>Sin centro principal</SelectItem>
                              {centrosByPlanta.map((centro) => (
                                <SelectItem key={centro.id} value={centro.id}>
                                  {centro.codigo} - {centro.nombre}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    </FieldGroup>
                  </CardContent>
                </Card>

                <Card className="mx-auto w-full max-w-5xl">
                  <CardHeader>
                    <CardTitle className="text-base">4. Capacidades fisicas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup className="grid gap-4 md:grid-cols-4">
                      {visibleCapacityFields.anchoUtil ? (
                        <Field>
                          <FieldLabel>
                            Ancho util (cm)
                            {renderRequiredAsterisk(requiredTemplateMachineKeySet.has("anchoUtil"))}
                          </FieldLabel>
                          <Input
                            className="max-w-48"
                            type="number"
                            value={
                              form.plantilla === "impresora_laser" && derivedLaserWorkingSize
                                ? derivedLaserWorkingSize.anchoUtil
                                : form.anchoUtil ?? ""
                            }
                            disabled={form.plantilla === "impresora_laser"}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  anchoUtil: toFiniteNumberOrUndefined(event.target.value),
                                }))
                              }
                          />
                        </Field>
                      ) : null}
                      {visibleCapacityFields.largoUtil ? (
                        <Field>
                          <div className="flex items-center gap-1">
                            <FieldLabel>
                              Largo util (cm)
                              {renderRequiredAsterisk(requiredTemplateMachineKeySet.has("largoUtil"))}
                            </FieldLabel>
                            {form.plantilla === "impresora_laser"
                              ? renderTooltipIcon("Se deriva automaticamente desde hoja maxima y margenes.")
                              : null}
                          </div>
                          <Input
                            className="max-w-48"
                            type="number"
                            value={
                              form.plantilla === "impresora_laser" && derivedLaserWorkingSize
                                ? derivedLaserWorkingSize.largoUtil
                                : form.largoUtil ?? ""
                            }
                            disabled={form.plantilla === "impresora_laser"}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  largoUtil: toFiniteNumberOrUndefined(event.target.value),
                                }))
                              }
                          />
                        </Field>
                      ) : null}
                      {visibleCapacityFields.altoUtil ? (
                        <Field>
                          <FieldLabel>
                            Alto util (cm)
                            {renderRequiredAsterisk(requiredTemplateMachineKeySet.has("altoUtil"))}
                          </FieldLabel>
                          <Input
                            className="max-w-48"
                            type="number"
                            value={form.altoUtil ?? ""}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                altoUtil: toFiniteNumberOrUndefined(event.target.value),
                              }))
                            }
                          />
                        </Field>
                      ) : null}
                      {visibleCapacityFields.espesorMaximo ? (
                        <Field>
                          <FieldLabel>
                            Espesor maximo (mm)
                            {renderRequiredAsterisk(requiredTemplateMachineKeySet.has("espesorMaximo"))}
                          </FieldLabel>
                          <Input
                            className="max-w-48"
                            type="number"
                            value={form.espesorMaximo ?? ""}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                espesorMaximo: toFiniteNumberOrUndefined(event.target.value),
                              }))
                            }
                          />
                        </Field>
                      ) : null}
                      {visibleCapacityFields.pesoMaximo ? (
                        <Field>
                          <FieldLabel>
                            Peso maximo (kg)
                            {renderRequiredAsterisk(requiredTemplateMachineKeySet.has("pesoMaximo"))}
                          </FieldLabel>
                          <Input
                            className="max-w-48"
                            type="number"
                            value={form.pesoMaximo ?? ""}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                pesoMaximo: toFiniteNumberOrUndefined(event.target.value),
                              }))
                            }
                          />
                        </Field>
                      ) : null}
                    </FieldGroup>
                  </CardContent>
                </Card>

                {templateEditableFields.length > 0 ? (
                  <Card className="mx-auto w-full max-w-5xl">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">5. Parametros por plantilla</CardTitle>
                        <Tooltip>
                          <TooltipTrigger className="inline-flex items-center text-muted-foreground">
                            <InfoIcon className="size-4" />
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Estos campos salen del catalogo tecnico y cambian segun el tipo de maquina.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {derivedPrintableArea ? (
                        <div className="mb-4 grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Ancho imprimible calculado</p>
                            <p className="text-sm font-medium">{derivedPrintableArea.anchoImprimible} cm</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Alto imprimible calculado</p>
                            <p className="text-sm font-medium">{derivedPrintableArea.altoImprimible} cm</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Area imprimible maxima calculada</p>
                            <p className="text-sm font-medium">{derivedPrintableArea.areaImprimibleMaxima} m2</p>
                          </div>
                        </div>
                      ) : null}
                      <div className="space-y-6">
                        {groupedTemplateEditableFields.map((group) => (
                          <section key={group.key} className="space-y-3">
                            <div className="flex items-center gap-1">
                              <h4 className="text-sm font-semibold">{group.title}</h4>
                              {renderTooltipIcon(group.description)}
                            </div>
                            <FieldGroup className="grid gap-4 md:grid-cols-2">
                              {group.entries.map((entry) => {
                                const rawValue = getTemplateFieldValue(entry.field);
                                const isPresetField = isPresetParamField(entry.field.key);

                                if (entry.field.kind === "select") {
                                  const currentValue = String(rawValue || "");
                                  return (
                                    <Field key={`${entry.sectionId}:${entry.field.key}`}>
                                      <div className="flex items-center gap-1">
                                        <FieldLabel>
                                          {entry.field.label}
                                          {renderRequiredAsterisk(entry.field.required)}
                                          {entry.field.unit ? ` (${getUnitLabel(entry.field.unit)})` : ""}
                                        </FieldLabel>
                                        {renderTooltipIcon(entry.field.tooltip || entry.field.description)}
                                      </div>
                                      <Select
                                        value={currentValue}
                                        onValueChange={(value) =>
                                          setTemplateFieldValue(entry.field, value ?? "")
                                        }
                                      >
                                        <SelectTrigger className={isPresetField ? PRESET_FIELD_CLASSNAME : ""}>
                                          <SelectValue placeholder={entry.field.placeholder || "Seleccionar"}>
                                            {(entry.field.options ?? []).find(
                                              (option) => option.value === currentValue,
                                            )?.label ??
                                              (currentValue
                                                ? formatTechnicalValue(currentValue)
                                                : entry.field.placeholder || "Seleccionar")}
                                          </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectGroup>
                                            {(entry.field.options ?? []).map((option) => (
                                              <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                              </SelectItem>
                                            ))}
                                          </SelectGroup>
                                        </SelectContent>
                                      </Select>
                                    </Field>
                                  );
                                }

                                if (entry.field.kind === "boolean") {
                                  return (
                                    <Field key={`${entry.sectionId}:${entry.field.key}`}>
                                      <div className="flex items-center gap-1">
                                        <FieldLabel>
                                          {entry.field.label}
                                          {renderRequiredAsterisk(entry.field.required)}
                                          {entry.field.unit ? ` (${getUnitLabel(entry.field.unit)})` : ""}
                                        </FieldLabel>
                                        {renderTooltipIcon(entry.field.tooltip || entry.field.description)}
                                      </div>
                                      <div
                                        className={`flex items-center justify-between rounded-md border p-3 ${
                                          isPresetField ? "border-sky-300 bg-sky-50/70" : ""
                                        }`}
                                      >
                                        <span className="text-sm text-muted-foreground">Habilitado</span>
                                        <Switch
                                          checked={Boolean(rawValue)}
                                          onCheckedChange={(checked) =>
                                            setTemplateFieldValue(entry.field, checked)
                                          }
                                        />
                                      </div>
                                    </Field>
                                  );
                                }

                                if (entry.field.kind === "textarea") {
                                  return (
                                    <Field key={`${entry.sectionId}:${entry.field.key}`} className="md:col-span-2">
                                      <div className="flex items-center gap-1">
                                        <FieldLabel>
                                          {entry.field.label}
                                          {renderRequiredAsterisk(entry.field.required)}
                                          {entry.field.unit ? ` (${getUnitLabel(entry.field.unit)})` : ""}
                                        </FieldLabel>
                                        {renderTooltipIcon(entry.field.tooltip || entry.field.description)}
                                      </div>
                                      <Textarea
                                        className={isPresetField ? PRESET_FIELD_CLASSNAME : ""}
                                        rows={2}
                                        value={String(rawValue ?? "")}
                                        onChange={(event) =>
                                          setTemplateFieldValue(entry.field, event.target.value)
                                        }
                                        placeholder={entry.field.placeholder}
                                      />
                                    </Field>
                                  );
                                }

                                if (entry.field.kind === "multiselect") {
                                  const valueList = Array.isArray(rawValue) ? rawValue.join(", ") : "";
                                  return (
                                    <Field key={`${entry.sectionId}:${entry.field.key}`} className="md:col-span-2">
                                      <div className="flex items-center gap-1">
                                        <FieldLabel>
                                          {entry.field.label}
                                          {renderRequiredAsterisk(entry.field.required)}
                                          {entry.field.unit ? ` (${getUnitLabel(entry.field.unit)})` : ""}
                                        </FieldLabel>
                                        {renderTooltipIcon(entry.field.tooltip || entry.field.description)}
                                      </div>
                                      <Textarea
                                        className={isPresetField ? PRESET_FIELD_CLASSNAME : ""}
                                        rows={2}
                                        value={valueList}
                                        onChange={(event) =>
                                          setTemplateFieldValue(
                                            entry.field,
                                            event.target.value
                                              .split(",")
                                              .map((itemValue) => itemValue.trim())
                                              .filter(Boolean),
                                          )
                                        }
                                        placeholder={entry.field.placeholder || "Valor 1, Valor 2"}
                                      />
                                    </Field>
                                  );
                                }

                                return (
                                  <Field key={`${entry.sectionId}:${entry.field.key}`}>
                                    <div className="flex items-center gap-1">
                                      <FieldLabel>
                                        {entry.field.label}
                                        {renderRequiredAsterisk(entry.field.required)}
                                        {entry.field.unit ? ` (${getUnitLabel(entry.field.unit)})` : ""}
                                      </FieldLabel>
                                      {renderTooltipIcon(entry.field.tooltip || entry.field.description)}
                                    </div>
                                    <Input
                                      className={isPresetField ? PRESET_FIELD_CLASSNAME : ""}
                                      disabled={entry.field.key === "areaImprimibleMaxima"}
                                      type={entry.field.kind === "number" ? "number" : "text"}
                                      value={String(rawValue ?? "")}
                                      onChange={(event) =>
                                        setTemplateFieldValue(entry.field, event.target.value)
                                      }
                                      placeholder={entry.field.placeholder}
                                    />
                                  </Field>
                                );
                              })}
                            </FieldGroup>
                          </section>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                <Card className="mx-auto w-full max-w-5xl">
                  <CardHeader>
                    <CardTitle className="text-base">6. Observaciones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Field>
                      <FieldLabel>Observaciones</FieldLabel>
                      <Textarea
                        value={form.observaciones || ""}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, observaciones: event.target.value }))
                        }
                        rows={3}
                      />
                    </Field>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="perfiles" className="m-0">
              <Card className="mx-auto w-full max-w-5xl">
                <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base">Perfiles operativos</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const nextPerfil = createPerfilOperativo(defaultPerfilUnidadProductividad);
                      setPerfiles((current) => [...current, nextPerfil]);
                      setSelectedPerfilId(nextPerfil.id);
                    }}
                  >
                    <PlusIcon data-icon="inline-start" />
                    Agregar perfil
                  </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {perfiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay perfiles. Recomendado: crear al menos uno para reflejar la productividad real de la maquina.
                    </p>
                  ) : null}
                  {perfiles.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-48">Nombre</TableHead>
                            <TableHead className="min-w-36">Tipo</TableHead>
                            <TableHead className="min-w-32">
                              {perfilTemplateProductividadField?.label || "Productividad"}
                            </TableHead>
                            <TableHead className="min-w-40">Unidad</TableHead>
                            <TableHead className="min-w-40">Modo trabajo</TableHead>
                            <TableHead className="w-24">Activo</TableHead>
                            <TableHead className="w-28 text-right">Quitar</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {perfiles.map((perfil) => (
                            <TableRow
                              key={perfil.id}
                              onClick={() => setSelectedPerfilId(perfil.id)}
                              className={selectedPerfilId === perfil.id ? "bg-muted/30" : ""}
                            >
                              <TableCell>
                                <Input
                                  value={perfil.nombre}
                                  onChange={(event) =>
                                    setPerfiles((current) =>
                                      current.map((item) =>
                                        item.id === perfil.id
                                          ? { ...item, nombre: event.target.value }
                                          : item,
                                      ),
                                    )
                                  }
                                  placeholder="Nombre del perfil"
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={perfil.tipoPerfil}
                                  onValueChange={(value) =>
                                    setPerfiles((current) =>
                                      current.map((item) =>
                                        item.id === perfil.id
                                          ? { ...item, tipoPerfil: value as LocalPerfilOperativo["tipoPerfil"] }
                                          : item,
                                      ),
                                    )
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue>
                                      {tipoPerfilOperativoMaquinaItems.find(
                                        (item) => item.value === perfil.tipoPerfil,
                                      )?.label ?? formatTechnicalValue(perfil.tipoPerfil)}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {tipoPerfilOperativoMaquinaItems.map((item) => (
                                        <SelectItem key={item.value} value={item.value}>
                                          {item.label}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={perfil.productividad ?? ""}
                                  onChange={(event) =>
                                    setPerfiles((current) =>
                                      current.map((item) =>
                                        item.id === perfil.id
                                          ? {
                                              ...item,
                                              productividad: toFiniteNumberOrUndefined(event.target.value),
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={perfil.unidadProductividad || defaultPerfilUnidadProductividad}
                                  disabled={Boolean(templatePerfilProductivityUnit)}
                                  onValueChange={(value) =>
                                    setPerfiles((current) =>
                                      current.map((item) =>
                                        item.id === perfil.id
                                          ? {
                                              ...item,
                                              unidadProductividad:
                                                value as LocalPerfilOperativo["unidadProductividad"],
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue>
                                      {unidadProductividadItems.find(
                                        (item) =>
                                          item.value ===
                                          (perfil.unidadProductividad || defaultPerfilUnidadProductividad),
                                      )?.label ??
                                        formatTechnicalValue(
                                          perfil.unidadProductividad || defaultPerfilUnidadProductividad,
                                        )}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {unidadProductividadItems.map((item) => (
                                        <SelectItem key={item.value} value={item.value}>
                                          {item.label}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm text-muted-foreground">
                                  {perfil.modoTrabajo || "Definido por parametros del perfil"}
                                </p>
                              </TableCell>
                              <TableCell>
                                <Switch
                                  checked={perfil.activo}
                                  onCheckedChange={(checked) =>
                                    setPerfiles((current) =>
                                      current.map((item) =>
                                        item.id === perfil.id ? { ...item, activo: checked } : item,
                                      ),
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setPerfiles((current) => current.filter((item) => item.id !== perfil.id))
                                  }
                                >
                                  <Trash2Icon data-icon="inline-start" />
                                  Quitar
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}
                  {selectedPerfil ? (
                    <div className="rounded-lg border p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">Configuracion del perfil</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedPerfil.nombre.trim() || "Perfil sin nombre"}
                          </p>
                        </div>
                        {templatePerfilProductivityUnit ? (
                          <Badge variant="secondary">Unidad fija: {templatePerfilProductivityUnit}</Badge>
                        ) : null}
                      </div>
                      <FieldGroup className="grid gap-3 md:grid-cols-6">
                        {perfilTemplateFields
                          .filter((fieldItem) => fieldItem.key !== "nombre" && fieldItem.key !== "productividad")
                          .map((fieldItem) => {
                            const rawValue = getPerfilValueByTemplateField(selectedPerfil, fieldItem);
                            const isModeField = PERFIL_MODE_SOURCE_KEYS.has(fieldItem.key);
                            const helper = fieldItem.description;
                            const currentSelectValue =
                              typeof rawValue === "string" && rawValue.trim().length > 0
                                ? rawValue
                                : EMPTY_SELECT_VALUE;

                            if (fieldItem.kind === "boolean") {
                              return (
                                <Field key={`${selectedPerfil.id}-${fieldItem.key}`}>
                                  <div className="flex min-h-10 items-start gap-1">
                                    <FieldLabel>
                                      {fieldItem.label}
                                      {renderRequiredAsterisk(fieldItem.required)}
                                    </FieldLabel>
                                    {renderTooltipIcon(helper)}
                                  </div>
                                  <div className="flex h-10 items-center justify-end rounded-md border px-3">
                                    <Switch
                                      checked={Boolean(rawValue)}
                                      onCheckedChange={(checked) =>
                                        setPerfilTemplateFieldValue(selectedPerfil.id, fieldItem, checked)
                                      }
                                    />
                                  </div>
                                </Field>
                              );
                            }

                            if (fieldItem.kind === "select") {
                              return (
                                <Field key={`${selectedPerfil.id}-${fieldItem.key}`}>
                                  <div className="flex min-h-10 items-start gap-1">
                                    <FieldLabel>
                                      {fieldItem.label}
                                      {renderRequiredAsterisk(fieldItem.required)}
                                    </FieldLabel>
                                    {renderTooltipIcon(helper)}
                                  </div>
                                  <Select
                                    value={currentSelectValue}
                                    onValueChange={(value) => {
                                      const normalized = typeof value === "string" ? value : "";
                                      setPerfilTemplateFieldValue(
                                        selectedPerfil.id,
                                        fieldItem,
                                        normalized === EMPTY_SELECT_VALUE ? "" : normalized,
                                      );
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder={fieldItem.placeholder || "Seleccionar"}>
                                        {fieldItem.options?.find((option) => option.value === currentSelectValue)?.label ??
                                          (currentSelectValue !== EMPTY_SELECT_VALUE
                                            ? formatTechnicalValue(currentSelectValue)
                                            : fieldItem.placeholder || "Seleccionar")}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectGroup>
                                        <SelectItem value={EMPTY_SELECT_VALUE}>Sin seleccionar</SelectItem>
                                        {(fieldItem.options ?? []).map((option) => (
                                          <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectGroup>
                                    </SelectContent>
                                  </Select>
                                  {isModeField && selectedPerfil.modoTrabajo ? (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Modo: {selectedPerfil.modoTrabajo}
                                    </p>
                                  ) : null}
                                </Field>
                              );
                            }

                            if (fieldItem.kind === "textarea") {
                              return (
                                <Field key={`${selectedPerfil.id}-${fieldItem.key}`} className="md:col-span-6">
                                  <div className="flex min-h-10 items-start gap-1">
                                    <FieldLabel>
                                      {fieldItem.label}
                                      {renderRequiredAsterisk(fieldItem.required)}
                                    </FieldLabel>
                                    {renderTooltipIcon(helper)}
                                  </div>
                                  <Textarea
                                    rows={2}
                                    value={String(rawValue ?? "")}
                                    onChange={(event) =>
                                      setPerfilTemplateFieldValue(
                                        selectedPerfil.id,
                                        fieldItem,
                                        event.target.value,
                                      )
                                    }
                                    placeholder={fieldItem.placeholder}
                                  />
                                </Field>
                              );
                            }

                            if (fieldItem.kind === "multiselect") {
                              const listValue = Array.isArray(rawValue) ? rawValue.join(", ") : "";
                              return (
                                <Field key={`${selectedPerfil.id}-${fieldItem.key}`} className="md:col-span-6">
                                  <div className="flex min-h-10 items-start gap-1">
                                    <FieldLabel>
                                      {fieldItem.label}
                                      {renderRequiredAsterisk(fieldItem.required)}
                                    </FieldLabel>
                                    {renderTooltipIcon(helper)}
                                  </div>
                                  <Textarea
                                    rows={2}
                                    value={listValue}
                                    onChange={(event) =>
                                      setPerfilTemplateFieldValue(
                                        selectedPerfil.id,
                                        fieldItem,
                                        event.target.value
                                          .split(",")
                                          .map((itemValue) => itemValue.trim())
                                          .filter(Boolean),
                                      )
                                    }
                                    placeholder={fieldItem.placeholder || "Valor 1, Valor 2"}
                                  />
                                </Field>
                              );
                            }

                            const inputType = fieldItem.kind === "number" ? "number" : "text";
                            const inputValue = String(rawValue ?? "");
                            const unitLabel = getUnitLabel(fieldItem.unit);

                            return (
                              <Field key={`${selectedPerfil.id}-${fieldItem.key}`}>
                                <div className="flex min-h-10 items-start gap-1">
                                  <FieldLabel>
                                    {fieldItem.label}
                                    {renderRequiredAsterisk(fieldItem.required)}
                                  </FieldLabel>
                                  {renderTooltipIcon(helper)}
                                </div>
                                <Input
                                  type={inputType}
                                  value={inputValue}
                                  onChange={(event) =>
                                    setPerfilTemplateFieldValue(
                                      selectedPerfil.id,
                                      fieldItem,
                                      event.target.value,
                                    )
                                  }
                                  placeholder={getPerfilFieldPlaceholder(fieldItem)}
                                />
                                {unitLabel ? <p className="mt-1 text-xs text-muted-foreground">{unitLabel}</p> : null}
                              </Field>
                            );
                          })}
                        {selectedFormatoObjetivo === "personalizado" ? (
                          <>
                            <Field>
                              <div className="flex min-h-10 items-start gap-1">
                                <FieldLabel>Ancho personalizado (cm)</FieldLabel>
                                {renderTooltipIcon("Medida de impresion util para el formato personalizado.")}
                              </div>
                              <Input
                                type="number"
                                value={selectedPerfil.anchoAplicable ?? ""}
                                onChange={(event) =>
                                  setPerfiles((current) =>
                                    current.map((item) =>
                                      item.id === selectedPerfil.id
                                        ? {
                                            ...item,
                                            anchoAplicable: toFiniteNumberOrUndefined(event.target.value),
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="21"
                              />
                            </Field>
                            <Field>
                              <div className="flex min-h-10 items-start gap-1">
                                <FieldLabel>Alto personalizado (cm)</FieldLabel>
                                {renderTooltipIcon("Medida de impresion util para el formato personalizado.")}
                              </div>
                              <Input
                                type="number"
                                value={selectedPerfil.altoAplicable ?? ""}
                                onChange={(event) =>
                                  setPerfiles((current) =>
                                    current.map((item) =>
                                      item.id === selectedPerfil.id
                                        ? {
                                            ...item,
                                            altoAplicable: toFiniteNumberOrUndefined(event.target.value),
                                          }
                                        : item,
                                    ),
                                  )
                                }
                                placeholder="29.7"
                              />
                            </Field>
                          </>
                        ) : null}
                      </FieldGroup>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>

            {showPrinterConsumiblesStep ? (
              <TabsContent value="consumibles" className="m-0">
                <Card className="mx-auto w-full max-w-5xl">
                <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base">Consumibles por perfil</CardTitle>
                    <FieldDescription>
                      Define consumo por canal en {getUnidadMateriaPrimaLabel("ml")}/m2 o{" "}
                      {getUnidadMateriaPrimaLabel("gramo")}/m2 segun el insumo vinculado.
                    </FieldDescription>
                    <FieldDescription>
                      Los canales se generan automaticamente desde el Paso 1 (Datos base), usando:{" "}
                      {printerChannelSourceHelpText}.
                    </FieldDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                      <span className="text-xs text-muted-foreground">
                        Mismo consumo en todos los perfiles
                      </span>
                      <Switch
                        checked={sameConsumptionAllProfiles}
                        onCheckedChange={(checked) => {
                          setSameConsumptionAllProfiles(checked);
                          if (!checked) {
                            return;
                          }
                          const perfilesValidos = perfiles
                            .map((perfil) => perfil.nombre.trim())
                            .filter(Boolean);
                          if (perfilesValidos.length === 0) {
                            return;
                          }
                          const perfilAncla = perfilesValidos[0];
                          const baseRows = consumibles.filter(
                            (item) =>
                              (item.perfilOperativoNombre ?? "").trim() === perfilAncla,
                          );
                          if (baseRows.length === 0) {
                            return;
                          }
                          setConsumibles(
                            perfilesValidos.flatMap((perfilNombre) =>
                              baseRows.map((row) => ({
                                ...row,
                                id:
                                  perfilNombre === perfilAncla ? row.id : createLocalId(),
                                perfilOperativoNombre: perfilNombre,
                                detalle: {
                                  ...(row.detalle ?? {}),
                                  syncKey:
                                    String(row.detalle?.syncKey ?? "") || createLocalId(),
                                },
                              })),
                            ),
                          );
                        }}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!sameConsumptionAllProfiles ? (
                    <Field className="max-w-sm">
                      <FieldLabel>Perfil operativo</FieldLabel>
                      <Select
                        value={selectedConsumiblePerfilId || EMPTY_SELECT_VALUE}
                        onValueChange={(value) =>
                          setSelectedConsumiblePerfilId(
                            value === EMPTY_SELECT_VALUE ? null : value,
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar perfil">
                            {selectedConsumiblePerfil?.nombre?.trim() || "Seleccionar perfil"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value={EMPTY_SELECT_VALUE}>Sin seleccionar</SelectItem>
                            {perfiles.map((perfil) => (
                              <SelectItem key={perfil.id} value={perfil.id}>
                                {perfil.nombre || "Perfil sin nombre"}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : null}

                    {consumiblesPerfilActual.length === 0 ? (
                      <div className="rounded-md border border-dashed p-4">
                        <p className="text-sm text-muted-foreground">
                          {requiredPrinterChannels.length === 0
                            ? `No hay canales de consumibles para mostrar. Configura primero ${printerChannelSourceHelpText} en el Paso 1.`
                            : perfiles.length === 0
                              ? "No hay perfiles operativos. Crea al menos un perfil en el Paso 2 para cargar consumibles."
                              : "Aun no hay filas de consumibles para este perfil. Revisa la configuracion en pasos anteriores."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {requiredPrinterChannels.length === 0 ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setActiveConfigTab("general")}
                            >
                              Ir al Paso 1 (Datos base)
                            </Button>
                          ) : null}
                          {perfiles.length === 0 ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setActiveConfigTab("perfiles")}
                            >
                              Ir al Paso 2 (Perfiles)
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Canal</TableHead>
                              <TableHead>Consumo</TableHead>
                              <TableHead>Unidad</TableHead>
                              <TableHead>Material vinculado</TableHead>
                              <TableHead>Activo</TableHead>
                              <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {consumiblesPerfilActual.map((consumible) => {
                              const color = String(consumible.detalle?.color ?? "cian");
                              const availableChannelOptions =
                                requiredPrinterChannels.length > 0
                                  ? requiredPrinterChannels
                                      .map((value) => PRINTER_CHANNEL_OPTION_BY_VALUE.get(value))
                                      .filter(
                                        (item): item is { value: string; label: string } => Boolean(item),
                                      )
                                  : PRINTER_CHANNEL_OPTIONS;
                              const canalMeta =
                                PRINTER_CHANNEL_META[color] ?? {
                                  label: formatTechnicalValue(color),
                                  dotClassName: "bg-muted",
                                };
                              const variante = varianteConsumibleImpresionById.get(
                                consumible.materiaPrimaVarianteId,
                              );
                              const unidadConsumo = consumible.unidad || "ml";
                              const varianteDisplay = variante
                                ? variante.label
                                : consumible.materiaPrimaVarianteId
                                  ? "Material no disponible"
                                  : "Seleccionar variante";
                              return (
                                <TableRow key={consumible.id}>
                                  <TableCell>
                                    <Select
                                      value={color}
                                      onValueChange={(value) => {
                                        const tipo =
                                          value === "barniz"
                                            ? "barniz"
                                            : variante?.subfamilia === "toner"
                                              ? "toner"
                                              : "tinta";
                                        updatePrinterConsumibleRow(
                                          consumible.id,
                                          {
                                            tipo,
                                            nombre: `${tipo === "barniz" ? "Barniz" : "Tinta"} ${value}`,
                                          },
                                          { color: value },
                                        );
                                      }}
                                    >
                                      <SelectTrigger>
                                        <SelectValue>
                                          <span className="inline-flex items-center gap-2">
                                            <span
                                              className={`inline-block size-3 rounded-full ${canalMeta.dotClassName}`}
                                            />
                                            {canalMeta.label}
                                          </span>
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectGroup>
                                          {availableChannelOptions.map((item) => (
                                            <SelectItem key={item.value} value={item.value}>
                                              <span className="inline-flex items-center gap-2">
                                                <span
                                                  className={`inline-block size-3 rounded-full ${PRINTER_CHANNEL_META[item.value]?.dotClassName ?? "bg-muted"}`}
                                                />
                                                {item.label}
                                              </span>
                                            </SelectItem>
                                          ))}
                                        </SelectGroup>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Input
                                        type="number"
                                        value={consumible.consumoBase ?? ""}
                                        onChange={(event) =>
                                          updatePrinterConsumibleRow(consumible.id, {
                                            consumoBase: toFiniteNumberOrUndefined(event.target.value),
                                          })
                                        }
                                      />
                                      <Button
                                        type="button"
                                        size="icon"
                                        variant="outline"
                                        className="shrink-0"
                                        onClick={() =>
                                          setOpenConsumibleCalculatorId((current) =>
                                            current === consumible.id ? null : consumible.id,
                                          )
                                        }
                                        title="Abrir calculadora de consumo"
                                      >
                                        <CalculatorIcon />
                                      </Button>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {unidadConsumo}/m2
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={consumible.materiaPrimaVarianteId || EMPTY_SELECT_VALUE}
                                      onValueChange={(value) => {
                                        const safeValue = String(value ?? "");
                                        const nextId =
                                          safeValue === EMPTY_SELECT_VALUE ? "" : safeValue;
                                        const nextVariante =
                                          varianteConsumibleImpresionById.get(nextId);
                                        const mappedUnit =
                                          mapUnidadMateriaPrimaToConsumo(
                                            nextVariante?.unidadStock,
                                          ) ?? "ml";
                                        const tipo =
                                          nextVariante?.subfamilia === "toner"
                                            ? "toner"
                                            : color === "barniz"
                                              ? "barniz"
                                              : "tinta";
                                        updatePrinterConsumibleRow(consumible.id, {
                                          materiaPrimaVarianteId: nextId,
                                          unidad: mappedUnit,
                                          tipo,
                                          nombre:
                                            nextVariante?.nombre ??
                                            `${tipo === "barniz" ? "Barniz" : "Tinta"} ${color}`,
                                        });
                                      }}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar variante">
                                          {varianteDisplay}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent className="min-w-[224px] md:min-w-[280px]">
                                        <SelectGroup>
                                          <SelectItem value={EMPTY_SELECT_VALUE}>
                                            Sin seleccionar
                                          </SelectItem>
                                          {variantesConsumibleImpresion.map((item) => (
                                            <SelectItem key={item.value} value={item.value}>
                                              {item.label}
                                            </SelectItem>
                                          ))}
                                        </SelectGroup>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <Switch
                                      checked={consumible.activo}
                                      onCheckedChange={(checked) =>
                                        updatePrinterConsumibleRow(consumible.id, {
                                          activo: checked,
                                        })
                                      }
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          const syncKey = createLocalId();
                                          if (sameConsumptionAllProfiles) {
                                            const perfilesValidos = perfiles
                                              .map((perfil) => perfil.nombre.trim())
                                              .filter(Boolean);
                                            setConsumibles((current) => [
                                              ...current,
                                              ...perfilesValidos.map((perfilNombre) => ({
                                                ...consumible,
                                                id: createLocalId(),
                                                perfilOperativoNombre: perfilNombre,
                                                detalle: {
                                                  ...(consumible.detalle ?? {}),
                                                  syncKey,
                                                },
                                              })),
                                            ]);
                                            return;
                                          }
                                          const perfilNombre =
                                            selectedConsumiblePerfil?.nombre?.trim() || "";
                                          if (!perfilNombre) {
                                            return;
                                          }
                                          setConsumibles((current) => [
                                            ...current,
                                            {
                                              ...consumible,
                                              id: createLocalId(),
                                              perfilOperativoNombre: perfilNombre,
                                            },
                                          ]);
                                        }}
                                      >
                                        <PlusIcon data-icon="inline-start" />
                                        Duplicar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => removePrinterConsumibleRow(consumible.id)}
                                      >
                                        <Trash2Icon data-icon="inline-start" />
                                        Quitar
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                                
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  {activeConsumibleCalculator ? (
                    (() => {
                      const calculatorDraft = getConsumibleCalculatorDraft(activeConsumibleCalculator.id);
                      const coveragePercent =
                        toFiniteNumberOrUndefined(calculatorDraft.cobertura) ??
                        DEFAULT_FULL_COLOR_COVERAGE_PERCENT;
                      const coverageIsoFabricantePercent =
                        toFiniteNumberOrUndefined(calculatorDraft.coberturaIsoFabricante) ?? 5;
                      const consumoCalculado = calculateConsumptionPerSquareMeter({
                        contenido:
                          toFiniteNumberOrUndefined(calculatorDraft.contenido) ?? Number.NaN,
                        rendimientoPaginasA4:
                          toFiniteNumberOrUndefined(calculatorDraft.rendimiento) ?? Number.NaN,
                        coberturaIsoFabricantePercent: coverageIsoFabricantePercent,
                        coberturaObjetivoPercent: coveragePercent,
                      });
                      const unitSymbol = getConsumibleUnitSymbol(activeConsumibleCalculator.unidad);
                      return (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
                          <div className="w-full max-w-lg rounded-lg border bg-background shadow-xl">
                            <div className="flex items-center justify-between border-b px-4 py-3">
                              <p className="text-sm font-semibold">Calculadora de consumo</p>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => setOpenConsumibleCalculatorId(null)}
                                title="Cerrar calculadora"
                              >
                                <XIcon />
                              </Button>
                            </div>
                            <div className="space-y-3 px-4 py-4">
                              <Badge variant="secondary" className="text-xs">
                                40% recomendado para costeo full color
                              </Badge>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <Field>
                                  <FieldLabel>
                                    Contenido ({unitSymbol})
                                  </FieldLabel>
                                  <Input
                                    inputMode="decimal"
                                    placeholder={`Ej: 100 ${unitSymbol}`}
                                    value={calculatorDraft.contenido}
                                    onChange={(event) =>
                                      updateConsumibleCalculatorDraft(activeConsumibleCalculator.id, {
                                        contenido: event.target.value,
                                      })
                                    }
                                  />
                                </Field>
                                <Field>
                                  <FieldLabel>Rendimiento ISO @ A4</FieldLabel>
                                  <Input
                                    inputMode="decimal"
                                    placeholder="Ej: 2000"
                                    value={calculatorDraft.rendimiento}
                                    onChange={(event) =>
                                      updateConsumibleCalculatorDraft(activeConsumibleCalculator.id, {
                                        rendimiento: event.target.value,
                                      })
                                    }
                                    />
                                </Field>
                                <Field>
                                  <FieldLabel>Cobertura ISO fabricante (%)</FieldLabel>
                                  <Input
                                    inputMode="decimal"
                                    placeholder="5"
                                    value={calculatorDraft.coberturaIsoFabricante}
                                    onChange={(event) =>
                                      updateConsumibleCalculatorDraft(activeConsumibleCalculator.id, {
                                        coberturaIsoFabricante: event.target.value,
                                      })
                                    }
                                  />
                                </Field>
                                <Field>
                                  <FieldLabel>Cobertura (%)</FieldLabel>
                                  <Input
                                    inputMode="decimal"
                                    placeholder="40"
                                    value={calculatorDraft.cobertura}
                                    onChange={(event) =>
                                      updateConsumibleCalculatorDraft(activeConsumibleCalculator.id, {
                                        cobertura: event.target.value,
                                      })
                                    }
                                  />
                                </Field>
                              </div>
                              {consumoCalculado ? (
                                <div className="rounded-md border p-3 text-sm">
                                  <p className="text-muted-foreground">
                                    ISO al {coverageIsoFabricantePercent}%:{" "}
                                    <span className="font-medium text-foreground">
                                      {consumoCalculado.consumoIsoPorM2.toFixed(4)} {unitSymbol}/m2
                                    </span>
                                  </p>
                                  <p className="text-muted-foreground">
                                    Full Color ({coveragePercent}%):{" "}
                                    <span className="font-medium text-foreground">
                                      {consumoCalculado.consumoObjetivoPorM2.toFixed(4)} {unitSymbol}/m2
                                    </span>
                                  </p>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  Completa contenido, rendimiento y cobertura para calcular consumo por m2.
                                </p>
                              )}
                            </div>
                            <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpenConsumibleCalculatorId(null)}
                              >
                                Cancelar
                              </Button>
                              <Button
                                type="button"
                                disabled={!consumoCalculado}
                                onClick={() => {
                                  if (!consumoCalculado) {
                                    return;
                                  }
                                  updatePrinterConsumibleRow(activeConsumibleCalculator.id, {
                                    consumoBase: Number(consumoCalculado.consumoObjetivoPorM2.toFixed(4)),
                                  });
                                  setOpenConsumibleCalculatorId(null);
                                }}
                              >
                                Usar valor Full Color
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : null}
                  </CardContent>
                </Card>
              </TabsContent>
            ) : null}

            <TabsContent value="desgaste" className="m-0">
              <Card className="mx-auto w-full max-w-5xl">
                <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base">Desgaste y repuestos</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDesgastes((current) => [...current, createDesgaste(desgasteTemplateFields)])
                    }
                  >
                    <PlusIcon data-icon="inline-start" />
                    Agregar componente
                  </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {desgastes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sin componentes de desgaste. Recomendado: registrar al menos fusor/cabezales/fresas segun plantilla.
                    </p>
                  ) : null}
                  {desgastes.map((desgaste) => (
                    <div key={desgaste.id} className="rounded-lg border p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-medium">Componente de desgaste</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setDesgastes((current) => current.filter((item) => item.id !== desgaste.id))
                          }
                        >
                          <Trash2Icon data-icon="inline-start" />
                          Quitar
                        </Button>
                      </div>
                      <FieldGroup className="grid gap-3 md:grid-cols-12">
                        <Field className="md:col-span-6">
                          <div className="flex min-h-10 items-start gap-1">
                            <FieldLabel>
                              {desgasteTemplateFieldByKey.get("nombre")?.label ?? "Nombre"}
                              {renderRequiredAsterisk(desgasteTemplateFieldByKey.get("nombre")?.required)}
                            </FieldLabel>
                            {renderTooltipIcon(desgasteTemplateFieldByKey.get("nombre")?.description)}
                          </div>
                          <Input
                            value={desgaste.nombre}
                            onChange={(event) =>
                              setDesgasteTemplateFieldValue(
                                desgaste.id,
                                desgasteTemplateFieldByKey.get("nombre") ?? {
                                  key: "nombre",
                                  label: "Nombre",
                                  scope: "desgaste",
                                  kind: "text",
                                  description: "",
                                },
                                event.target.value,
                              )
                            }
                          />
                        </Field>
                        <Field className="md:col-span-3">
                          <div className="flex min-h-10 items-start gap-1">
                            <FieldLabel>
                              {desgasteTemplateFieldByKey.get("tipo")?.label ?? "Tipo"}
                              {renderRequiredAsterisk(desgasteTemplateFieldByKey.get("tipo")?.required)}
                            </FieldLabel>
                            {renderTooltipIcon(desgasteTemplateFieldByKey.get("tipo")?.description)}
                          </div>
                          <Select
                            value={desgaste.tipo}
                            onValueChange={(value) => {
                              const fieldItem = desgasteTemplateFieldByKey.get("tipo");
                              if (!fieldItem) {
                                setDesgastes((current) =>
                                  current.map((item) =>
                                    item.id === desgaste.id
                                      ? { ...item, tipo: value as LocalDesgaste["tipo"] }
                                      : item,
                                  ),
                                );
                                return;
                              }
                              setDesgasteTemplateFieldValue(desgaste.id, fieldItem, value);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue>
                                {desgasteTipoOptions.find((item) => item.value === desgaste.tipo)?.label ??
                                  formatTechnicalValue(desgaste.tipo)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {desgasteTipoOptions.map((item) => (
                                  <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field className="md:col-span-3">
                          <div className="flex min-h-10 items-start gap-1">
                            <FieldLabel>
                              {desgasteTemplateFieldByKey.get("unidadDesgaste")?.label ?? "Unidad desgaste"}
                              {renderRequiredAsterisk(
                                desgasteTemplateFieldByKey.get("unidadDesgaste")?.required,
                              )}
                            </FieldLabel>
                            {renderTooltipIcon(desgasteTemplateFieldByKey.get("unidadDesgaste")?.description)}
                          </div>
                          <Select
                            value={desgaste.unidadDesgaste}
                            onValueChange={(value) => {
                              const fieldItem = desgasteTemplateFieldByKey.get("unidadDesgaste");
                              if (!fieldItem) {
                                setDesgastes((current) =>
                                  current.map((item) =>
                                    item.id === desgaste.id
                                      ? {
                                          ...item,
                                          unidadDesgaste: value as LocalDesgaste["unidadDesgaste"],
                                        }
                                      : item,
                                  ),
                                );
                                return;
                              }
                              setDesgasteTemplateFieldValue(desgaste.id, fieldItem, value);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue>
                                {desgasteUnidadOptions.find((item) => item.value === desgaste.unidadDesgaste)
                                  ?.label ?? formatTechnicalValue(desgaste.unidadDesgaste)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {desgasteUnidadOptions.map((item) => (
                                  <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field className="md:col-span-3">
                          <div className="flex min-h-10 items-start gap-1">
                            <FieldLabel>
                              {desgasteTemplateFieldByKey.get("vidaUtilEstimada")?.label ?? "Vida util estimada"}{" "}
                              (segun unidad)
                              {renderRequiredAsterisk(
                                desgasteTemplateFieldByKey.get("vidaUtilEstimada")?.required,
                              )}
                            </FieldLabel>
                            {renderTooltipIcon(desgasteTemplateFieldByKey.get("vidaUtilEstimada")?.description)}
                          </div>
                          <Input
                            type="number"
                            value={desgaste.vidaUtilEstimada ?? ""}
                            onChange={(event) =>
                              setDesgasteTemplateFieldValue(
                                desgaste.id,
                                desgasteTemplateFieldByKey.get("vidaUtilEstimada") ?? {
                                  key: "vidaUtilEstimada",
                                  label: "Vida util estimada",
                                  scope: "desgaste",
                                  kind: "number",
                                  description: "",
                                },
                                event.target.value,
                              )
                            }
                          />
                        </Field>
                        <Field className="md:col-span-6">
                          <div className="flex min-h-10 items-start gap-1">
                            <FieldLabel>
                              {desgasteTemplateFieldByKey.get("materiaPrimaVarianteId")?.label ??
                                "Variante de materia prima"}
                              {renderRequiredAsterisk(
                                desgasteTemplateFieldByKey.get("materiaPrimaVarianteId")?.required ?? true,
                              )}
                            </FieldLabel>
                          </div>
                          <Select
                            value={desgaste.materiaPrimaVarianteId || EMPTY_SELECT_VALUE}
                            onValueChange={(value) =>
                              setDesgasteTemplateFieldValue(
                                desgaste.id,
                                desgasteTemplateFieldByKey.get("materiaPrimaVarianteId") ?? {
                                  key: "materiaPrimaVarianteId",
                                  label: "Variante de materia prima",
                                  scope: "desgaste",
                                  kind: "select",
                                  description: "",
                                },
                                value === EMPTY_SELECT_VALUE ? "" : value,
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar variante" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value={EMPTY_SELECT_VALUE}>Sin seleccionar</SelectItem>
                                {variantesRepuestoDisponibles.map((item) => (
                                  <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          {desgaste.materiaPrimaVarianteId ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Costo ref.: $
                              {Number(
                                varianteRepuestoById.get(desgaste.materiaPrimaVarianteId)?.precioReferencia ?? 0,
                              ).toFixed(2)}{" "}
                              por {getUnidadMateriaPrimaLabel(varianteRepuestoById.get(desgaste.materiaPrimaVarianteId)?.unidadStock)}
                            </p>
                          ) : null}
                        </Field>
                        {desgasteExtraTemplateFields.map((fieldItem) => {
                          const rawValue = getDesgasteValueByTemplateField(desgaste, fieldItem);
                          const key = `${desgaste.id}-${fieldItem.key}`;

                          if (fieldItem.kind === "boolean") {
                            return (
                              <Field key={key} className="md:col-span-3">
                                <div className="flex min-h-10 items-start gap-1">
                                  <FieldLabel>
                                    {fieldItem.label}
                                    {renderRequiredAsterisk(fieldItem.required)}
                                  </FieldLabel>
                                  {renderTooltipIcon(fieldItem.description)}
                                </div>
                                <div className="flex h-10 items-center justify-end rounded-md border px-3">
                                  <Switch
                                    checked={Boolean(rawValue)}
                                    onCheckedChange={(checked) =>
                                      setDesgasteTemplateFieldValue(desgaste.id, fieldItem, checked)
                                    }
                                  />
                                </div>
                              </Field>
                            );
                          }

                          if (fieldItem.kind === "select") {
                            const currentSelectValue =
                              typeof rawValue === "string" && rawValue.trim().length > 0
                                ? rawValue
                                : EMPTY_SELECT_VALUE;
                            return (
                              <Field key={key} className="md:col-span-3">
                                <div className="flex min-h-10 items-start gap-1">
                                  <FieldLabel>
                                    {fieldItem.label}
                                    {renderRequiredAsterisk(fieldItem.required)}
                                  </FieldLabel>
                                  {renderTooltipIcon(fieldItem.description)}
                                </div>
                                <Select
                                  value={currentSelectValue}
                                  onValueChange={(value) =>
                                    setDesgasteTemplateFieldValue(
                                      desgaste.id,
                                      fieldItem,
                                      value === EMPTY_SELECT_VALUE ? "" : value,
                                    )
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder={fieldItem.placeholder || "Seleccionar"}>
                                      {fieldItem.options?.find((option) => option.value === currentSelectValue)
                                        ?.label ??
                                        (currentSelectValue !== EMPTY_SELECT_VALUE
                                          ? formatTechnicalValue(currentSelectValue)
                                          : fieldItem.placeholder || "Seleccionar")}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      <SelectItem value={EMPTY_SELECT_VALUE}>Sin seleccionar</SelectItem>
                                      {(fieldItem.options ?? []).map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </Field>
                            );
                          }

                          const inputType = fieldItem.kind === "number" ? "number" : "text";
                          return (
                            <Field key={key} className="md:col-span-3">
                              <div className="flex min-h-10 items-start gap-1">
                                <FieldLabel>
                                  {fieldItem.label}
                                  {renderRequiredAsterisk(fieldItem.required)}
                                </FieldLabel>
                                {renderTooltipIcon(fieldItem.description)}
                              </div>
                              <Input
                                type={inputType}
                                value={String(rawValue ?? "")}
                                onChange={(event) =>
                                  setDesgasteTemplateFieldValue(desgaste.id, fieldItem, event.target.value)
                                }
                                placeholder={fieldItem.placeholder}
                              />
                            </Field>
                          );
                        })}
                        <Field className="md:col-span-6">
                          <div className="flex min-h-10 items-start gap-1">
                            <FieldLabel>
                              Modo prorrateo
                              {renderRequiredAsterisk(
                                desgasteTemplateFieldByKey.get("modoProrrateo")?.required,
                              )}
                            </FieldLabel>
                          </div>
                          <Input
                            value={desgaste.modoProrrateo || ""}
                            onChange={(event) =>
                              setDesgasteTemplateFieldValue(
                                desgaste.id,
                                {
                                  key: "modoProrrateo",
                                  label: "Modo prorrateo",
                                  scope: "desgaste",
                                  kind: "text",
                                  description: "",
                                },
                                event.target.value,
                              )
                            }
                            placeholder="Ejemplo: lineal por horas"
                          />
                        </Field>
                        <Field className="md:col-span-3">
                          <div className="flex min-h-10 items-start gap-1">
                            <FieldLabel>Activo</FieldLabel>
                          </div>
                          <div className="flex h-10 items-center justify-end rounded-md border px-3">
                            <Switch
                              checked={desgaste.activo}
                              onCheckedChange={(checked) =>
                                setDesgasteTemplateFieldValue(
                                  desgaste.id,
                                  {
                                    key: "activo",
                                    label: "Activo",
                                    scope: "desgaste",
                                    kind: "boolean",
                                    description: "",
                                  },
                                  checked,
                                )
                              }
                            />
                          </div>
                        </Field>
                      </FieldGroup>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          </div>

          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsSheetOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
              ) : null}
              {editingId ? "Guardar cambios" : "Crear maquina"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}
