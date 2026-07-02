"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckIcon,
  Grid2X2Icon,
  PackageIcon,
  PlusIcon,
  SaveIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ensureSelectedOption,
  HumanSelect,
  optionFromLabel,
  optionsFromLabels,
  type HumanSelectOption,
} from "@/components/ui/human-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RuleBuilder } from "@/components/productos-servicios/rule-builder";
import {
  buscarMateriasPrimasConfigPaso,
  upsertConfigPaso,
  type LookupsConfigPaso,
  type MateriaPrimaBusquedaItem,
  type UpsertConfigPasoPayload,
  type UpsertSlotMaterialPayload,
} from "@/lib/productos-servicios-api";
import type {
  CatalogoFamilias,
  ProductoDetalle,
  RutaAlternativaDetalle,
  SlotMaterialDetalle,
} from "@/lib/productos-servicios";
import {
  criterioMotorAutoLabels,
  formulaConsumoLabels,
  getLabel,
  mecanismoCantidadLabels,
  modoActivacionLabels,
  modoSeleccionMaterialLabels,
  modoTiempoLabels,
} from "@/lib/labels-humanos";
import {
  getRuleFields,
  jsonLogicToRuleGroup,
  type RuleFieldDefinition,
  validateRuleGroup,
} from "@/lib/rule-builder";
import { getVarianteOptionChips } from "@/lib/materias-primas-variantes-display";
import { tecnologiaMaquinaItems } from "@/lib/maquinaria";
import {
  getMachineTechnology,
  machineTechnologyLabel,
} from "@/lib/maquinaria-tecnologias";

interface Props {
  producto: ProductoDetalle;
  rutaAlternativa: RutaAlternativaDetalle;
  catalogoFamilias: CatalogoFamilias;
  lookups: LookupsConfigPaso;
  embedded?: boolean;
}

type ConfigState = Record<string, UpsertConfigPasoPayload>;
type SavedConfigSnapshots = Record<string, string>;

const MODOS_ACTIVACION = [
  "OBLIGATORIO",
  "OPCIONAL",
  "CONDICIONAL",
  "NO_EJECUTAR",
];
const MODOS_SELECCION = ["HARDCODED", "COMERCIAL_ELIGE", "MOTOR_ELIGE_AUTO"];
const CRITERIOS_AUTO = [
  "MENOR_COSTO",
  "MAYOR_APROVECHAMIENTO",
  "MENOR_CAPACIDAD_QUE_CUMPLA",
];
const FORMULAS = [
  "por_unidad_productiva",
  "por_pieza",
  "por_m2",
  "por_metro_lineal",
  "fijo",
];
const TECHNOLOGY_RULE_OPTIONS = tecnologiaMaquinaItems.map((item) => ({
  value: item.value,
  label: item.label,
}));
const NESTING_ALGORITHMS = [
  "auto",
  "shelf-rollo",
  "maxrects-rollo",
  "grid-2d-single",
  "grid-2d-multi",
  "packingsolver-rectangle",
];
const MONTAJE_SOURCE_OPTIONS = [
  {
    value: "piezas_jobcontext",
    label: "Piezas del producto",
    description: "Usa cantidad, ancho y alto cargados por el comercial.",
  },
  {
    value: "pliegos_impresos",
    label: "Pliegos impresos",
    description:
      "Usa pliegos_impresos y el tamaño de pliego publicado por impresión.",
  },
];
const T2_PRODUCTIVITY_UNIT_OPTIONS = [
  {
    value: "unidades_h",
    label: "Unidades o pliegos/h",
    description: "Usa la cantidad del paso: pliegos, piezas, packs u otra unidad contable.",
  },
  {
    value: "m2_h",
    label: "m²/h",
    description: "Metros cuadrados por hora.",
  },
  {
    value: "ml_h",
    label: "ml/h",
    description: "Metros lineales por hora.",
  },
];
const T2_TIME_CALCULATION_MODE_OPTIONS = [
  {
    value: "productivity",
    label: "Productividad por hora",
    description: "Ejemplo: 120 pliegos por hora.",
  },
  {
    value: "batch_time",
    label: "Tiempo por lote",
    description: "Ejemplo: 2 pliegos cada 1 minuto.",
  },
];
const T2_QUANTITY_SOURCE_OPTIONS = [
  {
    value: "cantidad",
    label: "Cantidad efectiva del paso",
    description: "Respeta el mecanismo de cantidad configurado para el paso.",
  },
  {
    value: "cantidad_montaje",
    label: "Piezas/pliegos a montar",
    description: "Usa la cantidad definida en Piezas a montar para calcular tiempo.",
  },
  {
    value: "area_piezas_m2",
    label: "Área calculada desde piezas",
    description: "Usa el área real de las medidas cargadas al cotizar.",
  },
  {
    value: "m2_instalados",
    label: "m² instalados manuales",
    description: "Usa el campo m² instalados que carga comercial.",
  },
  {
    value: "metros_lineales",
    label: "Metros lineales cotizados",
    description: "Usa los metros lineales comerciales del producto.",
  },
  {
    value: "perimetro_piezas_m",
    label: "Perímetro total de piezas",
    description: "Suma el perímetro rectangular de todas las piezas.",
  },
];
const T2_PRODUCTIVITY_UNIT_SUFFIX: Record<string, string> = {
  unidades_h: "unid./h",
  m2_h: "m²/h",
  ml_h: "ml/h",
};
const T2_BATCH_UNIT_SUFFIX: Record<string, string> = {
  unidades_h: "unid./pliegos",
  m2_h: "m²",
  ml_h: "ml",
};

function getT2ProductivityUnitSuffix(unit: string, quantitySource: string) {
  if (unit === "ml_h" && quantitySource === "perimetro_piezas_m") {
    return "m perímetro/h";
  }
  return (
    T2_PRODUCTIVITY_UNIT_SUFFIX[unit] ?? T2_PRODUCTIVITY_UNIT_SUFFIX.unidades_h
  );
}

function getT2BatchUnitSuffix(unit: string, quantitySource: string) {
  if (unit === "ml_h" && quantitySource === "perimetro_piezas_m") {
    return "m perímetro";
  }
  return T2_BATCH_UNIT_SUFFIX[unit] ?? T2_BATCH_UNIT_SUFFIX.unidades_h;
}

function getDefaultT2ProductivityUnit(familiaCodigo?: string) {
  return familiaCodigo === "instalacion_in_situ" ? "m2_h" : "unidades_h";
}

function getDefaultT2TimeCalculationMode(familiaCodigo?: string) {
  return familiaCodigo === "embalaje" || familiaCodigo === "montaje_sobre_sustrato"
    ? "batch_time"
    : "productivity";
}

function getDefaultT2QuantitySource(familiaCodigo?: string, unit?: string) {
  if (familiaCodigo === "montaje_sobre_sustrato" && unit === "unidades_h") {
    return "cantidad_montaje";
  }
  if (unit === "unidades_h") return "cantidad";
  if (unit === "m2_h") return "area_piezas_m2";
  if (unit === "ml_h") return "metros_lineales";
  if (familiaCodigo === "instalacion_in_situ") return "area_piezas_m2";
  return "cantidad";
}

function getDefaultMecanismoCantidad(
  familiaCodigo?: string,
  mecanismosSoportados: string[] = [],
) {
  if (familiaCodigo === "impresion_por_hoja")
    return "HEREDAR_DEL_OUTPUT_CANONICO";
  if (familiaCodigo === "corte_manual") return "HEREDAR_DEL_OUTPUT_CANONICO";
  if (familiaCodigo === "montaje_sobre_sustrato") return "CALCULADO_POR_PASO";
  return mecanismosSoportados[0] ?? null;
}

function getT2QuantitySourceOptions(unit: string, familiaCodigo?: string) {
  if (familiaCodigo === "montaje_sobre_sustrato" && unit === "unidades_h") {
    return T2_QUANTITY_SOURCE_OPTIONS.filter((option) =>
      ["cantidad_montaje", "cantidad"].includes(option.value),
    );
  }
  if (unit === "m2_h") {
    return T2_QUANTITY_SOURCE_OPTIONS.filter((option) =>
      ["area_piezas_m2", "m2_instalados", "cantidad"].includes(option.value),
    );
  }
  if (unit === "ml_h") {
    return T2_QUANTITY_SOURCE_OPTIONS.filter((option) =>
      ["metros_lineales", "perimetro_piezas_m", "cantidad"].includes(
        option.value,
      ),
    );
  }
  return T2_QUANTITY_SOURCE_OPTIONS.filter(
    (option) => option.value === "cantidad",
  );
}

const COSTING_STRATEGIES = [
  "simple",
  "m2-exact",
  "consumed-length",
  "plate-segments",
];
const MODO_COLOR_LABELS: Record<string, string> = {
  SIN_IMPRESION: "Sin impresión",
  BN: "Blanco y negro",
  CMYK: "CMYK",
  "CMYK+blanco": "CMYK + Blanco",
  "CMYK+barniz": "CMYK + Barniz",
  "CMYK+blanco+barniz": "CMYK + Blanco + Barniz",
};
const PLIEGO_IMPRESION_PRESETS = [
  {
    value: "materia_prima",
    label: "Tamaño materia prima",
    description: "Usa el ancho y alto del sustrato comprado.",
    anchoMm: null,
    altoMm: null,
  },
  {
    value: "A5",
    label: "A5",
    description: "148 × 210 mm",
    anchoMm: 148,
    altoMm: 210,
  },
  {
    value: "A4",
    label: "A4",
    description: "210 × 297 mm",
    anchoMm: 210,
    altoMm: 297,
  },
  {
    value: "A3",
    label: "A3",
    description: "297 × 420 mm",
    anchoMm: 297,
    altoMm: 420,
  },
  {
    value: "A2",
    label: "A2",
    description: "420 × 594 mm",
    anchoMm: 420,
    altoMm: 594,
  },
  {
    value: "SRA4",
    label: "SRA4",
    description: "225 × 320 mm",
    anchoMm: 225,
    altoMm: 320,
  },
  {
    value: "SRA3",
    label: "SRA3",
    description: "325 × 475 mm",
    anchoMm: 325,
    altoMm: 475,
  },
  {
    value: "carta",
    label: "Carta",
    description: "216 × 279 mm",
    anchoMm: 216,
    altoMm: 279,
  },
  {
    value: "oficio",
    label: "Oficio",
    description: "216 × 356 mm",
    anchoMm: 216,
    altoMm: 356,
  },
  {
    value: "automatico",
    label: "Automático entre candidatos",
    description: "El motor elige el mejor tamaño entre candidatos activos.",
    anchoMm: null,
    altoMm: null,
  },
  {
    value: "personalizado",
    label: "Personalizado",
    description: "Cargar ancho y alto manualmente.",
    anchoMm: null,
    altoMm: null,
  },
];
const PLIEGO_IMPRESION_OPTIONS = PLIEGO_IMPRESION_PRESETS.map((preset) => ({
  value: preset.value,
  label: preset.label,
  description: preset.description,
}));
const PANEL_AXIS_OPTIONS = optionsFromLabels(
  ["automatic", "vertical", "horizontal"],
  {
    automatic: {
      label: "Automática",
      descripcion: "Prueba dividir ancho y alto, y elige el mejor resultado.",
    },
    vertical: {
      label: "Vertical",
      descripcion: "Divide el ancho de la pieza en paneles.",
    },
    horizontal: {
      label: "Horizontal",
      descripcion: "Divide el alto de la pieza en paneles.",
    },
  },
);
const PANEL_MANUAL_AXIS_OPTIONS = optionsFromLabels(
  ["vertical", "horizontal"],
  {
    vertical: {
      label: "Vertical",
      descripcion: "Divide el ancho de la pieza en paneles.",
    },
    horizontal: {
      label: "Horizontal",
      descripcion: "Divide el alto de la pieza en paneles.",
    },
  },
);
const PANEL_MODE_OPTIONS = optionsFromLabels(["automatic", "manual"], {
  automatic: {
    label: "Automático",
    descripcion: "El motor divide piezas grandes cuando no entran completas.",
  },
  manual: {
    label: "Manual",
    descripcion: "El usuario define la división de paneles.",
  },
});
const PANEL_DISTRIBUTION_OPTIONS = optionsFromLabels(["equilibrada", "libre"], {
  equilibrada: {
    label: "Equilibrada",
    descripcion: "Paneles de tamaño similar.",
  },
  libre: {
    label: "Libre",
    descripcion: "Llena cada panel hasta el máximo antes de abrir otro.",
  },
});
const PANEL_WIDTH_INTERPRETATION_OPTIONS = optionsFromLabels(
  ["total", "util"],
  {
    total: { label: "Ancho total", descripcion: "El máximo incluye solapes." },
    util: {
      label: "Ancho útil",
      descripcion: "El máximo se interpreta sin contar solapes.",
    },
  },
);
const MIN_PANEL_MAX_WIDTH_MM = 300;

const NESTING_ALGORITHM_OPTIONS = optionsFromLabels(NESTING_ALGORITHMS, {
  auto: {
    label: "Automático",
    descripcion: "El motor elige según la geometría y las piezas.",
  },
  "shelf-rollo": {
    label: "Rollo",
    descripcion: "Acomoda piezas sobre rollo de ancho fijo.",
  },
  "maxrects-rollo": {
    label: "Rollo optimizado",
    descripcion:
      "Acomoda piezas mixtas en rollo minimizando el largo consumido.",
  },
  "grid-2d-single": {
    label: "Grilla simple",
    descripcion: "Una medida repetida sobre pliego o placa.",
  },
  "grid-2d-multi": {
    label: "Grilla multi",
    descripcion: "Varias medidas sobre una o más placas.",
  },
  "packingsolver-rectangle": {
    label: "PackingSolver Rectangle",
    descripcion: "Motor profesional para rígidos sobre placa.",
  },
});
const COSTING_STRATEGY_OPTIONS = optionsFromLabels(COSTING_STRATEGIES, {
  simple: {
    label: "Simple",
    descripcion: "Usa la fórmula de consumo del slot sin costeo especial.",
  },
  "m2-exact": {
    label: "m² exactos",
    descripcion: "Cobra el área útil de las piezas.",
  },
  "consumed-length": {
    label: "Largo consumido",
    descripcion: "Cobra placa completa y último tramo proporcional.",
  },
  "plate-segments": {
    label: "Segmentos de placa",
    descripcion: "Cobra por escalones de ocupación de la placa.",
  },
});

function optionLabel(options: HumanSelectOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function normalizeForSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForSnapshot);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, normalizeForSnapshot(entryValue)]),
    );
  }
  return value;
}

function configSnapshot(config: UpsertConfigPasoPayload | undefined): string {
  return JSON.stringify(normalizeForSnapshot(config ?? null));
}

type MaquinaLookup = LookupsConfigPaso["maquinas"][number];
type PerfilLookup = MaquinaLookup["perfilesOperativos"][number];
type MateriaPrimaLookup = LookupsConfigPaso["materiasPrimas"][number];
type VarianteLookup = MateriaPrimaLookup["variantes"][number];
type CentroCostoLookup = LookupsConfigPaso["centrosCosto"][number];

const SELECCION_MATERIAL_OPTIONS = optionsFromLabels(
  MODOS_SELECCION,
  modoSeleccionMaterialLabels,
);
const FORMULA_OPTIONS = optionsFromLabels(FORMULAS, formulaConsumoLabels);
const SLOT_ROL_OPTIONS: HumanSelectOption[] = [
  { value: "COMPONENTE", label: "Componente" },
  { value: "SUSTRATO", label: "Sustrato" },
  { value: "CONSUMIBLE", label: "Consumible" },
  { value: "PACKAGING", label: "Packaging" },
];
const CANTIDAD_BASE_SLOT_OPTIONS: HumanSelectOption[] = [
  { value: "cantidad_pedida", label: "Cantidad pedida" },
  { value: "cantidad_efectiva_paso", label: "Cantidad efectiva del paso" },
  { value: "pliegos_impresos", label: "Pliegos impresos" },
];
const CRITERIO_AUTO_OPTIONS = optionsFromLabels(
  CRITERIOS_AUTO,
  criterioMotorAutoLabels,
);

function machineOption(
  maquina: Pick<MaquinaLookup, "id" | "codigo" | "nombre" | "plantilla">,
  badge?: string,
): HumanSelectOption {
  return {
    value: maquina.id,
    label: maquina.nombre,
    code: [maquina.codigo, maquina.plantilla].filter(Boolean).join(" · "),
    badge,
  };
}

function profileOption(
  perfil: Pick<PerfilLookup, "id" | "nombre"> &
    Partial<Pick<PerfilLookup, "productivityValue" | "productivityUnit">>,
  badge?: string,
): HumanSelectOption {
  return {
    value: perfil.id,
    label: perfil.nombre,
    code: null,
    badge,
  };
}

function perfilCompatibleConFamilia(
  familiaCodigo: string | undefined,
  perfil: PerfilLookup | null | undefined,
) {
  if (!familiaCodigo || !perfil) return true;
  const tipoPerfil = String(perfil.tipoPerfil ?? "").toLowerCase();
  if (familiaCodigo === "plotter_corte")
    return tipoPerfil === "corte" || tipoPerfil === "mixto";
  if (familiaCodigo === "impresion_por_area")
    return tipoPerfil === "impresion" || tipoPerfil === "mixto";
  return true;
}

function maquinaCompatibleConFamilia(
  familiaCodigo: string | undefined,
  plantillasCompatibles: string[] | undefined,
  maquina: MaquinaLookup,
) {
  if (!(plantillasCompatibles ?? []).includes(maquina.plantilla)) return false;
  if (familiaCodigo !== "plotter_corte") return true;
  if (
    String(maquina.plantilla).toUpperCase() !==
    "IMPRESORA_GRAN_FORMATO_POR_AREA"
  )
    return true;
  const params = maquina.parametrosTecnicosJson ?? {};
  return (
    params.soportaCorteIntegrado === true &&
    maquina.perfilesOperativos.some((perfil) =>
      perfilCompatibleConFamilia("plotter_corte", perfil),
    )
  );
}

function maquinaCandidataCompatibleConFamilia(
  familiaCodigo: string | undefined,
  plantillasCompatibles: string[] | undefined,
  maquina: MaquinaLookup,
) {
  return (
    maquinaCompatibleConFamilia(
      familiaCodigo,
      plantillasCompatibles,
      maquina,
    ) &&
    maquina.perfilesOperativos.some((perfil) =>
      perfilCompatibleConFamilia(familiaCodigo, perfil),
    )
  );
}

function normalizeMaquinasCandidatas(
  candidatas: NonNullable<UpsertConfigPasoPayload["maquinasCandidatas"]>,
) {
  const unique = new Map<
    string,
    {
      maquinaId: string;
      perfilDefaultId?: string | null;
      modoColorAllowedModes?: string[];
      esPreferida?: boolean;
      orden?: number;
    }
  >();
  for (const [index, candidata] of candidatas.entries()) {
    if (!candidata.maquinaId || unique.has(candidata.maquinaId)) continue;
    unique.set(candidata.maquinaId, {
      maquinaId: candidata.maquinaId,
      perfilDefaultId: candidata.perfilDefaultId ?? null,
      modoColorAllowedModes: Array.isArray(candidata.modoColorAllowedModes)
        ? Array.from(
            new Set(
              candidata.modoColorAllowedModes
                .map((item) => normalizeModoColor(item))
                .filter((item): item is string => item !== null),
            ),
          )
        : [],
      esPreferida: candidata.esPreferida,
      orden: candidata.orden ?? index,
    });
  }
  const values = Array.from(unique.values()).sort(
    (a, b) => (a.orden ?? 0) - (b.orden ?? 0),
  );
  const preferredId =
    values.find((candidata) => candidata.esPreferida)?.maquinaId ??
    values[0]?.maquinaId ??
    null;
  return values.map((candidata, index) => ({
    maquinaId: candidata.maquinaId,
    perfilDefaultId: candidata.perfilDefaultId ?? null,
    modoColorAllowedModes: candidata.modoColorAllowedModes ?? [],
    esPreferida: candidata.maquinaId === preferredId,
    orden: index,
  }));
}

function centroCostoOption(
  centro: Pick<CentroCostoLookup, "id" | "codigo" | "nombre">,
): HumanSelectOption {
  return {
    value: centro.id,
    label: centro.nombre,
    code: centro.codigo,
  };
}

function materialVariantOption(
  mp: Pick<MateriaPrimaLookup, "nombre" | "codigo" | "templateId">,
  variante: VarianteLookup,
): HumanSelectOption {
  const variantDetails = getMaterialVariantAttributeDetails(mp, variante);
  const variantLabel =
    variantDetails.length > 0
      ? variantDetails
          .map((detail) => `${detail.label}: ${detail.value}`)
          .join(" · ")
      : (variante.nombreVariante ?? variante.sku);

  return {
    value: variante.id,
    label: variantLabel,
    code: variante.sku,
    description: variante.precioReferencia
      ? `${mp.nombre} · Referencia: $${Number(variante.precioReferencia).toLocaleString("es-AR")}`
      : `${mp.nombre} · ${mp.codigo}`,
    details: variantDetails,
    group: mp.nombre,
  };
}

function varianteOptionFromBusqueda(
  mp: MateriaPrimaBusquedaItem,
  variante: MateriaPrimaBusquedaItem["variantes"][number],
): HumanSelectOption {
  return materialVariantOption(
    { nombre: mp.nombre, codigo: mp.codigo, templateId: mp.templateId },
    variante,
  );
}

type PersistedSlotCandidate = {
  materiaPrima: Pick<
    MateriaPrimaBusquedaItem,
    "id" | "codigo" | "nombre" | "familia" | "subfamilia" | "templateId"
  >;
  defaultVariante: {
    id: string;
    sku: string;
    nombreVariante: string | null;
    precioReferencia: string | null;
    atributosVarianteJson?: Record<string, unknown> | null;
  } | null;
  variantes: Array<{
    variante: {
      id: string;
      sku: string;
      nombreVariante: string | null;
      precioReferencia: string | null;
      atributosVarianteJson?: Record<string, unknown> | null;
    };
  }>;
};

function getPersistedCandidateVariantLabel(
  candidates: PersistedSlotCandidate[],
  varianteId: string | null | undefined,
) {
  const resolved = getPersistedCandidateMaterialVariant(candidates, varianteId);
  if (!resolved) return null;
  const option = varianteOptionFromBusqueda(
    resolved.materiaPrima,
    resolved.variante,
  );
  return `${resolved.materiaPrima.nombre} · ${option.label}`;
}

function getPersistedCandidateMaterialVariant(
  candidates: PersistedSlotCandidate[],
  varianteId: string | null | undefined,
) {
  if (!varianteId) return null;
  for (const candidate of candidates) {
    const variante =
      candidate.variantes.find((item) => item.variante.id === varianteId)
        ?.variante ??
      (candidate.defaultVariante?.id === varianteId
        ? candidate.defaultVariante
        : null);
    if (!variante) continue;
    const materiaPrima: MateriaPrimaBusquedaItem = {
      ...candidate.materiaPrima,
      tipoTecnico: "",
      variantes: candidate.variantes.map((item) => item.variante),
    };
    return { materiaPrima, variante };
  }
  return null;
}

function materialVariantToBusquedaItem(
  materialVariante: NonNullable<SlotMaterialDetalle["materialVariante"]>,
): MateriaPrimaBusquedaItem {
  return {
    id: materialVariante.materiaPrima.id,
    codigo: materialVariante.materiaPrima.codigo,
    nombre: materialVariante.materiaPrima.nombre,
    familia: materialVariante.materiaPrima.familia,
    subfamilia: materialVariante.materiaPrima.subfamilia,
    tipoTecnico: "",
    templateId: materialVariante.materiaPrima.templateId,
    variantes:
      materialVariante.materiaPrima.variantes?.length
        ? materialVariante.materiaPrima.variantes
        : [
            {
              id: materialVariante.id,
              sku: materialVariante.sku,
              nombreVariante: materialVariante.nombreVariante,
              precioReferencia: materialVariante.precioReferencia,
              atributosVarianteJson: materialVariante.atributosVarianteJson,
            },
          ],
  };
}

function getMaterialVariantAttributeDetails(
  mp: Pick<MateriaPrimaLookup, "nombre" | "codigo" | "templateId">,
  variante: VarianteLookup,
) {
  const chips = getVarianteOptionChips(
    {
      id: "",
      codigo: mp.codigo,
      nombre: mp.nombre,
      descripcion: "",
      familia: "sustrato",
      subfamilia: "sustrato_hoja",
      tipoTecnico: "",
      templateId: mp.templateId,
      unidadStock: "unidad",
      unidadCompra: "unidad",
      esConsumible: false,
      esRepuesto: false,
      activo: true,
      atributosTecnicos: {},
      variantes: [],
      createdAt: "",
      updatedAt: "",
    },
    {
      id: variante.id,
      sku: variante.sku,
      nombreVariante: variante.nombreVariante ?? "",
      activo: true,
      atributosVariante: variante.atributosVarianteJson ?? {},
      unidadStock: null,
      unidadCompra: null,
      precioReferencia: variante.precioReferencia
        ? Number(variante.precioReferencia)
        : null,
      moneda: "ARS",
      proveedorReferenciaId: null,
      proveedorReferenciaNombre: "",
    },
    { maxDimensiones: 7 },
  );

  return chips.map((chip) => ({ label: chip.label, value: chip.value }));
}

function humanizeCode(code: string) {
  if (code === "sustrato_principal") return "Sustrato principal";
  return code
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function slotNombre(
  slotCodigo: string,
  familia:
    | {
        slotsRequeridos: Array<{
          codigo: string;
          nombre: string;
          tipo?: string;
        }>;
      }
    | undefined,
) {
  if (slotCodigo === "sustrato_principal") return "Sustrato principal";
  return (
    familia?.slotsRequeridos.find((slot) => slot.codigo === slotCodigo)
      ?.nombre ?? humanizeCode(slotCodigo)
  );
}

function slotDisplayName(
  slot: { slotCodigo: string; slotNombre?: string | null },
  familia:
    | {
        slotsRequeridos: Array<{
          codigo: string;
          nombre: string;
          tipo?: string;
        }>;
      }
    | undefined,
) {
  return slot.slotNombre?.trim() || slotNombre(slot.slotCodigo, familia);
}

function isConsumibleMaquinaSlot(slot: {
  tipo?: string;
  codigo?: string;
  slotCodigo?: string;
}) {
  return slot.tipo === "CONSUMIBLE_MAQUINA";
}

// ─── Helpers de JSON ───────────────────────────────────────────────

function jsonToText(value: Record<string, unknown> | null | undefined): string {
  if (!value || Object.keys(value).length === 0) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function textToJson(
  text: string,
):
  | { ok: true; value: Record<string, unknown> | null }
  | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: null };
  try {
    const parsed = JSON.parse(trimmed);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return { ok: false, error: "Debe ser un objeto JSON ({ ... })" };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "JSON inválido",
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stripNestingConfig(value: Record<string, unknown> | null | undefined) {
  if (!value) return null;
  const rest = { ...value };
  delete rest.nestingConfig;
  return Object.keys(rest).length > 0 ? rest : null;
}

function getNestingConfig(params: Record<string, unknown> | null | undefined) {
  return asRecord(asRecord(params).nestingConfig);
}

function getPanelizadoConfig(
  params: Record<string, unknown> | null | undefined,
) {
  return asRecord(getNestingConfig(params).panelizado);
}

function getPliegoImpresionConfig(
  params: Record<string, unknown> | null | undefined,
) {
  return asRecord(getNestingConfig(params).pliegoImpresion);
}

function getExtraMarginsConfig(
  params: Record<string, unknown> | null | undefined,
) {
  return asRecord(getNestingConfig(params).extraMargins);
}

function getModoColorConfig(
  params: Record<string, unknown> | null | undefined,
) {
  return asRecord(asRecord(params).modoColorConfig);
}

function normalizeModoColor(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/WHITE/g, "BLANCO")
    .replace(/W/g, "BLANCO")
    .replace(/BARNIZ|VARNISH|VERNIS/g, "BARNIZ");
  if (!normalized) return null;
  if (
    [
      "SINIMPRESION",
      "SIN_IMPRESION",
      "NOIMPRESION",
      "NO_PRINT",
      "NOPRINT",
      "SINPRINT",
    ].includes(normalized)
  ) {
    return "SIN_IMPRESION";
  }
  if (["BN", "B/N", "NEGRO", "K"].includes(normalized)) return "BN";
  if (normalized === "CMYK") return "CMYK";
  if (["CMYK+BLANCO", "CMYKBLANCO"].includes(normalized)) return "CMYK+blanco";
  if (["CMYK+BARNIZ", "CMYKBARNIZ"].includes(normalized)) return "CMYK+barniz";
  if (
    [
      "CMYK+BLANCO+BARNIZ",
      "CMYK+BARNIZ+BLANCO",
      "CMYKBLANCOBARNIZ",
      "CMYKBARNIZBLANCO",
    ].includes(normalized)
  ) {
    return "CMYK+blanco+barniz";
  }
  return value.trim();
}

function modosColorFromPerfil(
  perfil: { detalleJson?: Record<string, unknown> | null } | null | undefined,
) {
  const detalle = asRecord(perfil?.detalleJson);
  const raw = detalle.colores ?? detalle.modoColor;
  const values = Array.isArray(raw) ? raw : [raw];
  return Array.from(
    new Set(
      values
        .map((value) => normalizeModoColor(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function modoColorAplica(
  familiaCodigo: string | undefined,
  cfg: UpsertConfigPasoPayload,
) {
  if (!familiaCodigo || !cfg.maquinaM1Id) return false;
  return ["impresion_por_hoja", "impresion_por_area"].includes(familiaCodigo);
}

function buildModoColorOptions(
  maquina:
    | {
        perfilesOperativos?: Array<{
          detalleJson?: Record<string, unknown> | null;
        }>;
      }
    | null
    | undefined,
  configExistente:
    | {
        modoColorOptions?: Array<{
          value: string;
          label: string;
          perfilIds: string[];
        }>;
      }
    | null
    | undefined,
  includeSinImpresion = false,
) {
  const modes = new Map<string, number>();
  if (includeSinImpresion) modes.set("SIN_IMPRESION", 0);
  for (const perfil of maquina?.perfilesOperativos ?? []) {
    for (const mode of modosColorFromPerfil(perfil)) {
      modes.set(mode, (modes.get(mode) ?? 0) + 1);
    }
  }
  const localOptions = Array.from(modes.entries()).map(([mode, count]) => ({
    value: mode,
    label: MODO_COLOR_LABELS[mode] ?? mode,
    code:
      mode === "SIN_IMPRESION"
        ? "sin perfil"
        : `${count} perfil${count === 1 ? "" : "es"}`,
  }));
  if (localOptions.length > 0) return localOptions;
  const backendOptions = configExistente?.modoColorOptions ?? [];
  const options = backendOptions.map((option) => ({
    value: option.value,
    label: option.label,
    code: `${option.perfilIds.length} perfil${option.perfilIds.length === 1 ? "" : "es"}`,
  }));
  if (
    includeSinImpresion &&
    !options.some((option) => option.value === "SIN_IMPRESION")
  ) {
    options.unshift({
      value: "SIN_IMPRESION",
      label: "Sin impresión",
      code: "sin perfil",
    });
  }
  return options;
}

function resolveModoColorAllowedModes(
  allowedModes: string[] | null | undefined,
  options: Array<{ value: string }>,
) {
  const optionValues = options.map((option) => option.value);
  const normalizedAllowed = Array.isArray(allowedModes)
    ? allowedModes
        .map((item) => normalizeModoColor(item))
        .filter((item): item is string => item !== null)
        .filter((item) => optionValues.includes(item))
    : [];
  return normalizedAllowed.length > 0 ? normalizedAllowed : optionValues;
}

function nestingAplica(
  familiaCodigo: string | undefined,
  cfg: UpsertConfigPasoPayload,
) {
  if (!familiaCodigo) return false;
  if (familiaCodigo === "pre_prensa") return false;
  if (cfg.mecanismoCantidad === "CALCULADO_POR_PASO") return true;
  return [
    "impresion_por_area",
    "impresion_por_hoja",
    "plotter_corte",
    "laminado",
    "montaje_sobre_sustrato",
  ].includes(familiaCodigo);
}

function panelizadoAplica(
  familiaCodigo: string | undefined,
  nestingConfig: Record<string, unknown>,
  maquina:
    | { parametrosTecnicosJson?: Record<string, unknown> | null }
    | null
    | undefined,
  tieneSustratoRollo: boolean,
) {
  if (familiaCodigo !== "impresion_por_area") {
    return false;
  }
  const algorithm = String(nestingConfig.algorithm ?? "auto");
  if (
    algorithm !== "auto" &&
    algorithm !== "shelf-rollo" &&
    algorithm !== "maxrects-rollo"
  )
    return false;
  const geometria = String(
    asRecord(maquina?.parametrosTecnicosJson).geometria ?? "",
  ).toUpperCase();
  return (
    geometria === "ROLLO" ||
    geometria === "MESA_EXTENSORA" ||
    geometria === "" ||
    tieneSustratoRollo
  );
}

function sanitizeNestingConfigForFamilia(
  nestingConfig: Record<string, unknown>,
  familiaCodigo: string | undefined,
) {
  if (familiaCodigo === "impresion_por_area") return nestingConfig;
  if (!("panelizado" in nestingConfig)) return nestingConfig;
  const next = { ...nestingConfig };
  delete next.panelizado;
  return next;
}

function defaultNestingSeparationForFamily(familiaCodigo: string | undefined) {
  return familiaCodigo === "impresion_por_area" ||
    familiaCodigo === "plotter_corte"
    ? 5
    : 0;
}

function getMachineMargins(
  maquina:
    | { parametrosTecnicosJson?: Record<string, unknown> | null }
    | null
    | undefined,
) {
  const params = asRecord(maquina?.parametrosTecnicosJson);
  const raw = asRecord(params.margenesNoImprimiblesMm);
  return {
    leftMm: readOptionalNumber(raw.leftMm ?? raw.izq),
    rightMm: readOptionalNumber(raw.rightMm ?? raw.der),
    topMm: readOptionalNumber(raw.topMm ?? raw.sup),
    bottomMm: readOptionalNumber(raw.bottomMm ?? raw.inf),
  };
}

function getResolvedNestingNumber(
  overrideValue: unknown,
  inheritedValue: number | undefined,
  fallback: number,
) {
  const override = readOptionalNumber(overrideValue);
  return override ?? inheritedValue ?? fallback;
}

function formatMm(value: unknown) {
  const n = readOptionalNumber(value);
  if (n === undefined) return null;
  return `${n} mm`;
}

function mmToCmInput(value: unknown) {
  const n = readOptionalNumber(value);
  if (n === undefined) return "";
  return String(n / 10);
}

function cmInputToMm(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * 10 : null;
}

type PanelAxis = "vertical" | "horizontal";
type PanelManualLayout = {
  items: Array<{
    sourcePieceId: string;
    pieceWidthMm: number;
    pieceHeightMm: number;
    axis: PanelAxis;
    panels: Array<{
      panelIndex: number;
      usefulWidthMm: number;
      usefulHeightMm: number;
      overlapStartMm: number;
      overlapEndMm: number;
      finalWidthMm: number;
      finalHeightMm: number;
    }>;
  }>;
};

function readManualLayout(value: unknown): PanelManualLayout | null {
  const raw = asRecord(value);
  if (!Array.isArray(raw.items)) return null;
  const items = raw.items
    .map((item) => {
      const row = asRecord(item);
      const panelsRaw = Array.isArray(row.panels) ? row.panels : [];
      const sourcePieceId =
        typeof row.sourcePieceId === "string" ? row.sourcePieceId : "";
      const pieceWidthMm = readOptionalNumber(row.pieceWidthMm);
      const pieceHeightMm = readOptionalNumber(row.pieceHeightMm);
      const axis: PanelAxis | null =
        row.axis === "horizontal"
          ? "horizontal"
          : row.axis === "vertical"
            ? "vertical"
            : null;
      const panels = panelsRaw
        .map((panel) => {
          const current = asRecord(panel);
          return {
            panelIndex: Math.max(
              1,
              Math.trunc(readOptionalNumber(current.panelIndex) ?? 1),
            ),
            usefulWidthMm: readOptionalNumber(current.usefulWidthMm) ?? 0,
            usefulHeightMm: readOptionalNumber(current.usefulHeightMm) ?? 0,
            overlapStartMm: readOptionalNumber(current.overlapStartMm) ?? 0,
            overlapEndMm: readOptionalNumber(current.overlapEndMm) ?? 0,
            finalWidthMm: readOptionalNumber(current.finalWidthMm) ?? 0,
            finalHeightMm: readOptionalNumber(current.finalHeightMm) ?? 0,
          };
        })
        .filter((panel) => panel.finalWidthMm > 0 && panel.finalHeightMm > 0)
        .sort((a, b) => a.panelIndex - b.panelIndex);
      if (
        !sourcePieceId ||
        !pieceWidthMm ||
        !pieceHeightMm ||
        !axis ||
        panels.length === 0
      )
        return null;
      return {
        sourcePieceId,
        pieceWidthMm,
        pieceHeightMm,
        axis,
        panels: panels.map((panel, index) => ({
          ...panel,
          panelIndex: index + 1,
        })),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);
  return items.length > 0 ? { items } : null;
}

function getProductoPanelMeasures(producto: ProductoDetalle) {
  const predefinidas = Array.isArray(producto.medidasPredefinidasJson)
    ? producto.medidasPredefinidasJson
    : [];
  if (predefinidas.length > 0) {
    return predefinidas
      .map((medida, index) => ({
        sourcePieceId: `piece-${index}-0`,
        label: medida.nombre || `Medida ${index + 1}`,
        widthMm: Number(medida.anchoMm),
        heightMm: Number(medida.altoMm),
      }))
      .filter((medida) => medida.widthMm > 0 && medida.heightMm > 0);
  }
  const widthMm = readOptionalNumber(producto.medidaDefaultAnchoMm);
  const heightMm = readOptionalNumber(producto.medidaDefaultAltoMm);
  return widthMm && heightMm
    ? [
        {
          sourcePieceId: "piece-0-0",
          label: "Medida del producto",
          widthMm,
          heightMm,
        },
      ]
    : [];
}

function buildDefaultManualLayoutForMeasures(input: {
  measures: Array<{ sourcePieceId: string; widthMm: number; heightMm: number }>;
  axis: PanelAxis;
  overlapMm: number;
  maxPanelWidthMm: number | null;
  printableWidthMm: number | null;
  widthInterpretation: "total" | "util";
}): PanelManualLayout {
  return {
    items: input.measures.map((measure) => {
      const splitDimension =
        input.axis === "vertical" ? measure.widthMm : measure.heightMm;
      const physicalLimit = Math.max(
        1,
        Math.min(
          input.maxPanelWidthMm && input.maxPanelWidthMm > 0
            ? input.maxPanelWidthMm
            : Number.POSITIVE_INFINITY,
          input.printableWidthMm && input.printableWidthMm > 0
            ? input.printableWidthMm
            : Number.POSITIVE_INFINITY,
        ),
      );
      const usefulLimit =
        input.widthInterpretation === "total"
          ? Math.max(1, physicalLimit - input.overlapMm * 2)
          : physicalLimit;
      const panelCount = Math.max(1, Math.ceil(splitDimension / usefulLimit));
      const base = Math.floor(splitDimension / panelCount);
      const remainder = Math.round(splitDimension - base * panelCount);
      const panels = Array.from({ length: panelCount }, (_, index) => {
        const segment = base + (index < remainder ? 1 : 0);
        const overlapStartMm = index === 0 ? 0 : input.overlapMm;
        const overlapEndMm = index === panelCount - 1 ? 0 : input.overlapMm;
        const usefulWidthMm =
          input.axis === "vertical" ? segment : measure.widthMm;
        const usefulHeightMm =
          input.axis === "horizontal" ? segment : measure.heightMm;
        return {
          panelIndex: index + 1,
          usefulWidthMm,
          usefulHeightMm,
          overlapStartMm,
          overlapEndMm,
          finalWidthMm:
            input.axis === "vertical"
              ? usefulWidthMm + overlapStartMm + overlapEndMm
              : measure.widthMm,
          finalHeightMm:
            input.axis === "horizontal"
              ? usefulHeightMm + overlapStartMm + overlapEndMm
              : measure.heightMm,
        };
      });
      return {
        sourcePieceId: measure.sourcePieceId,
        pieceWidthMm: measure.widthMm,
        pieceHeightMm: measure.heightMm,
        axis: input.axis,
        panels,
      };
    }),
  };
}

function recalculateManualLayoutItem(
  item: PanelManualLayout["items"][number],
): PanelManualLayout["items"][number] {
  const panels = item.panels.map((panel, index) => {
    const overlapStartMm = index === 0 ? 0 : panel.overlapStartMm;
    const overlapEndMm =
      index === item.panels.length - 1 ? 0 : panel.overlapEndMm;
    return {
      ...panel,
      panelIndex: index + 1,
      overlapStartMm,
      overlapEndMm,
      finalWidthMm:
        item.axis === "vertical"
          ? panel.usefulWidthMm + overlapStartMm + overlapEndMm
          : item.pieceWidthMm,
      finalHeightMm:
        item.axis === "horizontal"
          ? panel.usefulHeightMm + overlapStartMm + overlapEndMm
          : item.pieceHeightMm,
    };
  });
  return { ...item, panels };
}

function validateManualLayoutItem(input: {
  item: PanelManualLayout["items"][number];
  maxPanelWidthMm: number | null;
  printableWidthMm: number | null;
  widthInterpretation: "total" | "util";
}) {
  const splitDimension =
    input.item.axis === "vertical"
      ? input.item.pieceWidthMm
      : input.item.pieceHeightMm;
  const usefulTotal = input.item.panels.reduce(
    (acc, panel) =>
      acc +
      (input.item.axis === "vertical"
        ? panel.usefulWidthMm
        : panel.usefulHeightMm),
    0,
  );
  if (Math.abs(usefulTotal - splitDimension) > 1) {
    return "La suma útil de los paneles no coincide con la medida original.";
  }
  const maxLimit =
    input.maxPanelWidthMm && input.maxPanelWidthMm > 0
      ? input.maxPanelWidthMm
      : null;
  const printableLimit =
    input.printableWidthMm && input.printableWidthMm > 0
      ? input.printableWidthMm
      : null;
  for (const panel of input.item.panels) {
    const useful =
      input.item.axis === "vertical"
        ? panel.usefulWidthMm
        : panel.usefulHeightMm;
    const final =
      input.item.axis === "vertical" ? panel.finalWidthMm : panel.finalHeightMm;
    if (useful <= 0 || final <= 0)
      return "Todos los paneles deben tener medidas mayores a 0.";
    if (
      maxLimit &&
      (input.widthInterpretation === "total" ? final : useful) > maxLimit
    ) {
      return "Hay paneles que superan el ancho máximo configurado.";
    }
    if (printableLimit && final > printableLimit) {
      return "Hay paneles que no entran en el ancho imprimible estimado.";
    }
  }
  return null;
}

function getPliegoPresetValue(pliegoImpresion: Record<string, unknown>) {
  const modo =
    typeof pliegoImpresion.modo === "string"
      ? pliegoImpresion.modo
      : typeof pliegoImpresion.mode === "string"
        ? pliegoImpresion.mode
        : "";
  if (modo === "automatico" || modo === "automatic") return "automatico";
  const explicitPreset =
    typeof pliegoImpresion.preset === "string" ? pliegoImpresion.preset : null;
  if (
    explicitPreset &&
    PLIEGO_IMPRESION_PRESETS.some((preset) => preset.value === explicitPreset)
  ) {
    return explicitPreset;
  }
  const ancho = readOptionalNumber(pliegoImpresion.anchoMm);
  const alto = readOptionalNumber(pliegoImpresion.altoMm);
  if (!ancho && !alto) return "materia_prima";
  const match = PLIEGO_IMPRESION_PRESETS.find(
    (preset) => preset.anchoMm === ancho && preset.altoMm === alto,
  );
  return match?.value ?? "personalizado";
}

function getPliegoCandidatos(pliegoImpresion: Record<string, unknown>) {
  return Array.isArray(pliegoImpresion.candidatos)
    ? (pliegoImpresion.candidatos as Array<Record<string, unknown>>)
    : [];
}

function buildPliegoCandidateFromPreset(presetValue: string) {
  const preset = PLIEGO_IMPRESION_PRESETS.find(
    (item) => item.value === presetValue,
  );
  if (
    !preset ||
    preset.value === "materia_prima" ||
    preset.value === "automatico" ||
    preset.value === "personalizado" ||
    !preset.anchoMm ||
    !preset.altoMm
  ) {
    return null;
  }
  return {
    id: `${preset.value}-${Date.now()}`,
    preset: preset.value,
    nombre: preset.label,
    anchoMm: preset.anchoMm,
    altoMm: preset.altoMm,
    activo: true,
  };
}

function readOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

type SlotCompatibilidad = NonNullable<
  CatalogoFamilias["familias"][number]["slotsRequeridos"][number]["compatibilidadMaterial"]
>;

function MaterialSearchSelect({
  compatibilidad,
  placeholder,
  selectedIds = [],
  onSelect,
}: {
  compatibilidad?: SlotCompatibilidad;
  placeholder: string;
  selectedIds?: string[];
  onSelect: (materiaPrima: MateriaPrimaBusquedaItem) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [items, setItems] = React.useState<MateriaPrimaBusquedaItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    buscarMateriasPrimasConfigPaso({
      q: query,
      familias: compatibilidad?.familiasMateriaPrima,
      subfamilias: compatibilidad?.subfamiliasMateriaPrima,
      templateIds: compatibilidad?.templateIds,
      tipoTecnico: compatibilidad?.tipoTecnico,
      limit: 20,
    })
      .then((result) => {
        if (!cancelled) setItems(result);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [compatibilidad, query]);

  return (
    <div className="space-y-2">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        className="h-8 text-xs"
      />
      <div className="max-h-56 space-y-1 overflow-auto rounded border bg-white p-1">
        {loading ? (
          <div className="text-muted-foreground px-2 py-2 text-xs">
            Buscando...
          </div>
        ) : items.length === 0 ? (
          <div className="text-muted-foreground px-2 py-2 text-xs">
            Sin materias primas compatibles.
          </div>
        ) : (
          items.map((item) => {
            const selected = selectedSet.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`flex w-full items-center justify-between gap-3 rounded px-2 py-2 text-left text-xs transition ${
                  selected
                    ? "bg-muted/70 text-muted-foreground"
                    : "hover:bg-muted"
                }`}
                onClick={() => {
                  if (!selected) onSelect(item);
                }}
                disabled={selected}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {item.nombre}
                  </span>
                </span>
                <span className="text-muted-foreground shrink-0 text-[11px]">
                  {selected ? "Seleccionado" : "Seleccionar"}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

type SlotCandidateConfig = NonNullable<
  UpsertSlotMaterialPayload["candidatos"]
>[number];
type MaterialVariantSearchItem = MateriaPrimaBusquedaItem["variantes"][number];

function textAttr(attrs: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const raw = attrs[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  }
  return "";
}

function numberAttr(attrs: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const raw = attrs[key];
    const value =
      typeof raw === "string" ? Number(raw.replace(",", ".")) : Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(
    value,
  );
}

function getVariantAttributeSummary(variante: MaterialVariantSearchItem) {
  const attrs = asRecord(variante.atributosVarianteJson);
  const color = textAttr(attrs, ["colorBase", "color", "colorMaterial"]);
  const espesor = numberAttr(attrs, ["espesor", "espesorMm", "espesor_mm"]);
  const ancho = numberAttr(attrs, ["ancho", "anchoM", "ancho_m"]);
  const alto = numberAttr(attrs, ["alto", "altoM", "alto_m"]);
  const largo = numberAttr(attrs, ["largo", "largoM", "largo_m"]);
  return { attrs, color, espesor, ancho, alto, largo };
}

function materiaPrimaLooksLikeRoll(
  materiaPrima:
    | Pick<
        MateriaPrimaBusquedaItem,
        "codigo" | "nombre" | "familia" | "subfamilia"
      >
    | null
    | undefined,
) {
  const text = [
    materiaPrima?.codigo,
    materiaPrima?.nombre,
    materiaPrima?.familia,
    materiaPrima?.subfamilia,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
  return text.includes("ROLLO") || text.includes("ROLL");
}

function varianteLooksLikeRoll(
  variante:
    | { atributosVarianteJson?: Record<string, unknown> | null }
    | null
    | undefined,
) {
  const attrs = asRecord(variante?.atributosVarianteJson);
  return (
    readOptionalNumber(attrs.largoRolloMm) != null ||
    readOptionalNumber(attrs.largoRolloM) != null ||
    readOptionalNumber(attrs.rollLengthMm) != null ||
    readOptionalNumber(attrs.rollLengthM) != null ||
    readOptionalNumber(attrs.longitudRolloMm) != null ||
    readOptionalNumber(attrs.longitudRolloM) != null
  );
}

function canUseColorThicknessSelector(materiaPrima: MateriaPrimaBusquedaItem) {
  if (materiaPrima.subfamilia === "sustrato_rigido") return true;
  return materiaPrima.variantes.some((variante) => {
    const summary = getVariantAttributeSummary(variante);
    return summary.color && summary.espesor !== null;
  });
}

function getVariantMeasureLabel(
  summary: ReturnType<typeof getVariantAttributeSummary>,
) {
  if (summary.ancho !== null && summary.alto !== null) {
    return `${formatNumber(summary.ancho)} x ${formatNumber(summary.alto)} m`;
  }
  if (summary.ancho !== null && summary.largo !== null) {
    return `${formatNumber(summary.ancho)} x ${formatNumber(summary.largo)} m`;
  }
  return "";
}

function getDisplayPanelMaxWidth(value: unknown) {
  const parsed = getResolvedNestingNumber(value, undefined, 0);
  return parsed >= MIN_PANEL_MAX_WIDTH_MM ? parsed : 0;
}

function patchEnabledVariantIds(
  candidate: SlotCandidateConfig,
  varianteId: string,
  checked: boolean,
) {
  const nextIds = checked
    ? [...candidate.varianteIds, varianteId]
    : candidate.varianteIds.filter((id) => id !== varianteId);
  const safeIds =
    nextIds.length > 0 ? Array.from(new Set(nextIds)) : [varianteId];
  const defaultStillEnabled =
    candidate.defaultVarianteId &&
    safeIds.includes(candidate.defaultVarianteId);
  return {
    varianteIds: safeIds,
    defaultVarianteId: defaultStillEnabled
      ? candidate.defaultVarianteId
      : (safeIds[0] ?? null),
  };
}

function ColorThicknessVariantSelector({
  materiaPrima,
  candidate,
  onChange,
}: {
  materiaPrima: MateriaPrimaBusquedaItem;
  candidate: SlotCandidateConfig;
  onChange: (patch: Partial<SlotCandidateConfig>) => void;
}) {
  const variants = React.useMemo(
    () =>
      materiaPrima.variantes.map((variante) => ({
        variante,
        summary: getVariantAttributeSummary(variante),
      })),
    [materiaPrima.variantes],
  );
  const colors = React.useMemo(() => {
    const unique = new Set(
      variants.map((item) => item.summary.color || "Sin color").filter(Boolean),
    );
    return Array.from(unique);
  }, [variants]);
  const defaultVariant = variants.find(
    (item) => item.variante.id === candidate.defaultVarianteId,
  );
  const [selectedColor, setSelectedColor] = React.useState(
    defaultVariant?.summary.color || colors[0] || "Sin color",
  );

  React.useEffect(() => {
    if (!colors.includes(selectedColor)) {
      setSelectedColor(
        defaultVariant?.summary.color || colors[0] || "Sin color",
      );
    }
  }, [colors, defaultVariant?.summary.color, selectedColor]);

  const enabledVariantIds = React.useMemo(
    () => new Set(candidate.varianteIds),
    [candidate.varianteIds],
  );
  const visibleVariants = variants
    .filter((item) => (item.summary.color || "Sin color") === selectedColor)
    .sort((left, right) => {
      const leftEspesor = left.summary.espesor ?? Number.POSITIVE_INFINITY;
      const rightEspesor = right.summary.espesor ?? Number.POSITIVE_INFINITY;
      return leftEspesor - rightEspesor;
    });

  return (
    <div className="mb-2 space-y-3 rounded border bg-muted/20 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
          Color y espesor habilitados
        </div>
        <Badge variant="outline">
          {candidate.varianteIds.length} variantes
        </Badge>
      </div>
      <div className="space-y-1">
        <div className="text-muted-foreground text-[11px] font-medium">
          Color
        </div>
        <div className="flex flex-wrap gap-1.5">
          {colors.map((color) => {
            const count = variants.filter(
              (item) => (item.summary.color || "Sin color") === color,
            ).length;
            const active = selectedColor === color;
            return (
              <button
                key={color}
                type="button"
                className={`rounded border px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-border bg-white text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => setSelectedColor(color)}
              >
                {color}
                <span className="ml-1 text-[10px] opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-muted-foreground text-[11px] font-medium">
          Espesor
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {visibleVariants.map(({ variante, summary }) => {
            const checked = enabledVariantIds.has(variante.id);
            const medida = getVariantMeasureLabel(summary);
            const precio = variante.precioReferencia
              ? Number(variante.precioReferencia).toLocaleString("es-AR")
              : null;
            return (
              <label
                key={variante.id}
                className={`min-w-0 rounded border px-2.5 py-2 text-xs transition ${
                  checked
                    ? "border-foreground bg-white shadow-sm"
                    : "border-transparent bg-white/70 text-muted-foreground"
                }`}
              >
                <span className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={checked}
                    onChange={(event) =>
                      onChange(
                        patchEnabledVariantIds(
                          candidate,
                          variante.id,
                          event.target.checked,
                        ),
                      )
                    }
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-foreground">
                      {summary.espesor !== null
                        ? `${formatNumber(summary.espesor)} mm`
                        : variante.nombreVariante || variante.sku}
                    </span>
                    {medida ? (
                      <span className="text-muted-foreground block truncate">
                        {medida}
                      </span>
                    ) : null}
                    {precio ? (
                      <span className="text-muted-foreground block truncate">
                        Ref. ${precio}
                      </span>
                    ) : null}
                    {candidate.defaultVarianteId === variante.id ? (
                      <span className="mt-1 inline-flex rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        Predeterminada
                      </span>
                    ) : null}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Validación por tab ────────────────────────────────────────────

interface TabValidacion {
  errores: string[];
  warnings: string[];
}

function requiereMecanismoCantidad(
  cfg: UpsertConfigPasoPayload,
  familia:
    | {
        slotsRequeridos: Array<{
          codigo: string;
          requerido: boolean;
          tipo?: string;
        }>;
      }
    | undefined,
) {
  if (!cfg.modoTiempo) return true;
  if (cfg.modoTiempo !== "T-1") return true;

  const tieneMaterialesDeclarados =
    (familia?.slotsRequeridos.filter((slot) => !isConsumibleMaquinaSlot(slot))
      .length ?? 0) > 0 || (cfg.slotsMateriales?.length ?? 0) > 0;
  return tieneMaterialesDeclarados;
}

function validarBasico(
  cfg: UpsertConfigPasoPayload,
  familia:
    | {
        relacionMaquinaSoportada: string[];
        slotsRequeridos: Array<{
          codigo: string;
          requerido: boolean;
          tipo?: string;
        }>;
      }
    | undefined,
): TabValidacion {
  const errores: string[] = [];
  const warnings: string[] = [];
  const soportaManual =
    familia?.relacionMaquinaSoportada.includes("M-0") ?? false;
  const soportaMaquina =
    familia?.relacionMaquinaSoportada.includes("M-1") ?? false;
  const requiereMaquina =
    cfg.modoTiempo === "T-3" || (soportaMaquina && !soportaManual);
  if (requiereMaquina && !cfg.maquinaM1Id) {
    errores.push("Falta máquina principal");
  }
  if (cfg.maquinaM1Id && !cfg.perfilM1Id) {
    warnings.push("Sin perfil de máquina");
  }
  if (!cfg.modoTiempo) warnings.push("Modo de tiempo sin definir");
  if (requiereMecanismoCantidad(cfg, familia) && !cfg.mecanismoCantidad) {
    warnings.push("Mecanismo de cantidad sin definir");
  }
  if (!cfg.maquinaM1Id && cfg.modoTiempo && !cfg.centroCostoId) {
    warnings.push("Centro de costo horario sin definir");
  }
  if (cfg.modoTiempo === "T-2") {
    const params = asRecord(cfg.paramsPasoJson);
    const horasEstimadas = readOptionalNumber(params.horasEstimadas);
    const productividad = readOptionalNumber(params.productivityValue);
    const batchTimeMin = readOptionalNumber(params.batchTimeMin);
    const batchSize = readOptionalNumber(params.batchSize);
    const modoCalculo =
      typeof params.timeCalculationMode === "string"
        ? params.timeCalculationMode
        : "productivity";
    const campoHoras =
      typeof params.campoHorasJobContext === "string"
        ? params.campoHorasJobContext.trim()
        : "";
    if (
      !horasEstimadas &&
      !campoHoras &&
      (modoCalculo === "batch_time"
        ? !batchTimeMin || !batchSize
        : !productividad)
    ) {
      warnings.push("Tiempo del paso sin definir");
    }
  }
  return { errores, warnings };
}

function validarMateriales(
  cfg: UpsertConfigPasoPayload,
  familia:
    | {
        slotsRequeridos: Array<{
          codigo: string;
          nombre: string;
          requerido: boolean;
          tipo?: string;
        }>;
      }
    | undefined,
): TabValidacion {
  const errores: string[] = [];
  const warnings: string[] = [];
  if (!familia) return { errores, warnings };
  const slots = cfg.slotsMateriales ?? [];
  const slotsConfigurados = new Set(slots.map((s) => s.slotCodigo));
  for (const sr of familia.slotsRequeridos) {
    if (isConsumibleMaquinaSlot(sr)) continue;
    if (sr.requerido && !slotsConfigurados.has(sr.codigo)) {
      errores.push(`Falta slot requerido: ${sr.codigo}`);
    }
  }
  for (const slot of slots) {
    const slotDecl = familia.slotsRequeridos.find(
      (sr) => sr.codigo === slot.slotCodigo,
    );
    if (slotDecl && isConsumibleMaquinaSlot(slotDecl)) continue;
    if (slot.modoSeleccion === "HARDCODED" && !slot.materialVarianteId) {
      errores.push(
        `${slotDisplayName(slot, familia)}: sin variante de material`,
      );
    }
    if (slot.modoSeleccion === "MOTOR_ELIGE_AUTO" && !slot.criterioMotorAuto) {
      warnings.push(
        `${slotDisplayName(slot, familia)}: sin criterio del sistema`,
      );
    }
    if (
      (slot.modoSeleccion === "COMERCIAL_ELIGE" ||
        slot.modoSeleccion === "MOTOR_ELIGE_AUTO") &&
      (slot.candidatos?.length ?? 0) === 0
    ) {
      errores.push(
        `${slotDisplayName(slot, familia)}: sin materiales candidatos`,
      );
    }
  }
  return { errores, warnings };
}

function validarAvanzado(
  paramsPasoText: string,
  mecanismoCantidadConfigText: string,
  cfg?: UpsertConfigPasoPayload,
  familia?: { codigo: string },
): TabValidacion {
  const errores: string[] = [];
  const warnings: string[] = [];
  if (paramsPasoText.trim()) {
    const r = textToJson(paramsPasoText);
    if (!r.ok) errores.push(`Params del paso: ${r.error}`);
  }
  if (mecanismoCantidadConfigText.trim()) {
    const r = textToJson(mecanismoCantidadConfigText);
    if (!r.ok) errores.push(`Config de cantidad: ${r.error}`);
  }
  if (familia?.codigo === "impresion_por_hoja" && cfg) {
    const pliegoImpresion = getPliegoImpresionConfig(cfg.paramsPasoJson);
    const pliegoModo = getPliegoPresetValue(pliegoImpresion);
    if (pliegoModo === "automatico") {
      const candidatosValidos = getPliegoCandidatos(pliegoImpresion).filter(
        (candidato) =>
          candidato.activo !== false &&
          Number(candidato.anchoMm) > 0 &&
          Number(candidato.altoMm) > 0,
      );
      if (candidatosValidos.length === 0) {
        errores.push(
          "Pliego de impresión automático: agregá al menos un candidato activo con ancho y alto",
        );
      }
    }
    const hasAncho =
      pliegoImpresion.anchoMm !== undefined &&
      pliegoImpresion.anchoMm !== null &&
      pliegoImpresion.anchoMm !== "";
    const hasAlto =
      pliegoImpresion.altoMm !== undefined &&
      pliegoImpresion.altoMm !== null &&
      pliegoImpresion.altoMm !== "";
    if (hasAncho || hasAlto) {
      const ancho = readOptionalNumber(pliegoImpresion.anchoMm);
      const alto = readOptionalNumber(pliegoImpresion.altoMm);
      if (!ancho || ancho <= 0 || !alto || alto <= 0) {
        errores.push(
          "Pliego de impresión: completá ancho y alto mayores a 0 mm",
        );
      }
    }
  }
  return { errores, warnings };
}

function PanelManualEditorSheet({
  open,
  onOpenChange,
  measures,
  layout,
  axis,
  overlapMm,
  maxPanelWidthMm,
  printableWidthMm,
  widthInterpretation,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  measures: Array<{
    sourcePieceId: string;
    label: string;
    widthMm: number;
    heightMm: number;
  }>;
  layout: PanelManualLayout | null;
  axis: PanelAxis;
  overlapMm: number;
  maxPanelWidthMm: number | null;
  printableWidthMm: number | null;
  widthInterpretation: "total" | "util";
  onApply: (layout: PanelManualLayout) => void;
}) {
  const [draft, setDraft] = React.useState<PanelManualLayout | null>(null);
  const [selectedPieceId, setSelectedPieceId] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    const next =
      layout ??
      buildDefaultManualLayoutForMeasures({
        measures,
        axis,
        overlapMm,
        maxPanelWidthMm,
        printableWidthMm,
        widthInterpretation,
      });
    setDraft(next);
    setSelectedPieceId(next.items[0]?.sourcePieceId ?? "");
  }, [
    axis,
    layout,
    maxPanelWidthMm,
    measures,
    open,
    overlapMm,
    printableWidthMm,
    widthInterpretation,
  ]);

  const selectedItem = React.useMemo(
    () =>
      draft?.items.find((item) => item.sourcePieceId === selectedPieceId) ??
      draft?.items[0] ??
      null,
    [draft, selectedPieceId],
  );
  const selectedMeasure = measures.find(
    (measure) => measure.sourcePieceId === selectedItem?.sourcePieceId,
  );
  const validation = selectedItem
    ? validateManualLayoutItem({
        item: selectedItem,
        maxPanelWidthMm,
        printableWidthMm,
        widthInterpretation,
      })
    : null;
  const allValid =
    draft?.items.every(
      (item) =>
        !validateManualLayoutItem({
          item,
          maxPanelWidthMm,
          printableWidthMm,
          widthInterpretation,
        }),
    ) ?? false;

  const updateSelectedItem = (
    updater: (
      item: PanelManualLayout["items"][number],
    ) => PanelManualLayout["items"][number],
  ) => {
    if (!selectedItem) return;
    setDraft((current) =>
      current
        ? {
            items: current.items.map((item) =>
              item.sourcePieceId === selectedItem.sourcePieceId
                ? updater(item)
                : item,
            ),
          }
        : current,
    );
  };

  const splitEvenly = (
    item: PanelManualLayout["items"][number],
    panelCount: number,
  ) => {
    const count = Math.max(1, panelCount);
    const dimension =
      item.axis === "vertical" ? item.pieceWidthMm : item.pieceHeightMm;
    const base = Math.floor(dimension / count);
    const remainder = Math.round(dimension - base * count);
    const panels = Array.from({ length: count }, (_, index) => {
      const segment = base + (index < remainder ? 1 : 0);
      const overlapStartMm = index === 0 ? 0 : overlapMm;
      const overlapEndMm = index === count - 1 ? 0 : overlapMm;
      return {
        panelIndex: index + 1,
        usefulWidthMm: item.axis === "vertical" ? segment : item.pieceWidthMm,
        usefulHeightMm:
          item.axis === "horizontal" ? segment : item.pieceHeightMm,
        overlapStartMm,
        overlapEndMm,
        finalWidthMm:
          item.axis === "vertical"
            ? segment + overlapStartMm + overlapEndMm
            : item.pieceWidthMm,
        finalHeightMm:
          item.axis === "horizontal"
            ? segment + overlapStartMm + overlapEndMm
            : item.pieceHeightMm,
      };
    });
    return { ...item, panels };
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="!w-[760px] !max-w-[92vw] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Editor manual de paneles</SheetTitle>
          <SheetDescription>
            Definí cómo se divide cada medida cuando la pieza no entra completa
            en el ancho imprimible del rollo.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4">
          {measures.length === 0 ? (
            <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
              Este producto no tiene una medida fija o predefinida para preparar
              el layout manual.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {draft?.items.map((item, index) => {
                  const measure = measures.find(
                    (current) => current.sourcePieceId === item.sourcePieceId,
                  );
                  return (
                    <button
                      key={item.sourcePieceId}
                      type="button"
                      className={`rounded-md border px-3 py-2 text-left text-xs ${
                        item.sourcePieceId === selectedItem?.sourcePieceId
                          ? "border-foreground bg-muted"
                          : "bg-background"
                      }`}
                      onClick={() => setSelectedPieceId(item.sourcePieceId)}
                    >
                      <span className="block font-medium">
                        {measure?.label ?? `Pieza ${index + 1}`}
                      </span>
                      <span className="text-muted-foreground">
                        {item.pieceWidthMm} × {item.pieceHeightMm} mm
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedItem ? (
                <div className="space-y-4 rounded-md border bg-background p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">
                        {selectedMeasure?.label ?? "Medida seleccionada"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {selectedItem.pieceWidthMm} ×{" "}
                        {selectedItem.pieceHeightMm} mm ·{" "}
                        {selectedItem.panels.length} panel
                        {selectedItem.panels.length === 1 ? "" : "es"}
                      </div>
                    </div>
                    <HumanSelect
                      value={selectedItem.axis}
                      options={PANEL_MANUAL_AXIS_OPTIONS}
                      triggerClassName="min-h-9 min-w-40 text-xs"
                      onValueChange={(value) =>
                        updateSelectedItem((item) => {
                          const nextAxis =
                            value === "horizontal" ? "horizontal" : "vertical";
                          return splitEvenly(
                            { ...item, axis: nextAxis },
                            item.panels.length,
                          );
                        })
                      }
                    />
                  </div>

                  <div className="flex h-20 overflow-hidden rounded-md border bg-muted/20">
                    {selectedItem.panels.map((panel) => {
                      const useful =
                        selectedItem.axis === "vertical"
                          ? panel.usefulWidthMm
                          : panel.usefulHeightMm;
                      const total =
                        selectedItem.axis === "vertical"
                          ? selectedItem.pieceWidthMm
                          : selectedItem.pieceHeightMm;
                      return (
                        <div
                          key={panel.panelIndex}
                          className="flex min-w-12 items-center justify-center border-r last:border-r-0"
                          style={{
                            flexGrow: Math.max(1, useful),
                            flexBasis: `${Math.max(5, (useful / total) * 100)}%`,
                          }}
                        >
                          <span className="text-xs font-medium">
                            P{panel.panelIndex}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid gap-2">
                    {selectedItem.panels.map((panel, index) => {
                      const usefulValue =
                        selectedItem.axis === "vertical"
                          ? panel.usefulWidthMm
                          : panel.usefulHeightMm;
                      const finalValue =
                        selectedItem.axis === "vertical"
                          ? panel.finalWidthMm
                          : panel.finalHeightMm;
                      return (
                        <div
                          key={panel.panelIndex}
                          className="grid grid-cols-[80px_minmax(0,1fr)_120px] items-center gap-2 text-xs"
                        >
                          <div className="font-medium">
                            Panel {panel.panelIndex}
                          </div>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={String(usefulValue)}
                            onChange={(event) =>
                              updateSelectedItem((item) => {
                                const panels = item.panels.map(
                                  (current, currentIndex) => {
                                    if (currentIndex !== index) return current;
                                    const nextUseful =
                                      event.target.value === ""
                                        ? 1
                                        : Math.max(
                                            1,
                                            Number(event.target.value),
                                          );
                                    return {
                                      ...current,
                                      usefulWidthMm:
                                        item.axis === "vertical"
                                          ? nextUseful
                                          : item.pieceWidthMm,
                                      usefulHeightMm:
                                        item.axis === "horizontal"
                                          ? nextUseful
                                          : item.pieceHeightMm,
                                    };
                                  },
                                );
                                return recalculateManualLayoutItem({
                                  ...item,
                                  panels,
                                });
                              })
                            }
                            className="h-8 text-xs"
                          />
                          <div className="text-muted-foreground">
                            final {Math.round(finalValue)} mm
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateSelectedItem((item) =>
                          splitEvenly(item, item.panels.length + 1),
                        )
                      }
                    >
                      Agregar panel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={selectedItem.panels.length <= 1}
                      onClick={() =>
                        updateSelectedItem((item) =>
                          splitEvenly(item, item.panels.length - 1),
                        )
                      }
                    >
                      Quitar panel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateSelectedItem((item) =>
                          splitEvenly(item, item.panels.length),
                        )
                      }
                    >
                      Equilibrar
                    </Button>
                  </div>
                  {validation ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      {validation}
                    </div>
                  ) : (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                      Layout válido para las medidas actuales.
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
        <SheetFooter>
          <Button
            type="button"
            disabled={!draft || !allValid}
            onClick={() => {
              if (!draft || !allValid) return;
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Aplicar layout manual
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function ConfigPasosEditorView({
  producto,
  rutaAlternativa,
  catalogoFamilias,
  lookups,
  embedded = false,
}: Props) {
  const router = useRouter();
  const familiasMap = React.useMemo(
    () => new Map(catalogoFamilias.familias.map((f) => [f.codigo, f])),
    [catalogoFamilias],
  );
  const technologyRuleFields = React.useMemo<RuleFieldDefinition[]>(
    () =>
      rutaAlternativa.ruta.pasos.flatMap((rutaPaso) => {
        const configPaso = rutaAlternativa.configPasos.find(
          (config) => config.rutaPasoId === rutaPaso.id,
        );
        const familia = familiasMap.get(rutaPaso.familiaCodigo);
        const stepLabel = `Tecnología paso ${rutaPaso.orden} · ${
          familia?.nombre ?? rutaPaso.familiaCodigo
        }`;
        return [
          {
            key: `tecnologia_${configPaso?.id ?? rutaPaso.id}`,
            label: stepLabel,
            kind: "select" as const,
            valueKind: "string" as const,
            operators: ["=", "!="],
            options: TECHNOLOGY_RULE_OPTIONS,
          },
        ];
      }),
    [familiasMap, rutaAlternativa.configPasos, rutaAlternativa.ruta.pasos],
  );

  // Estado: por cada paso de la ruta, su configuración (existente o nueva)
  const [configs, setConfigs] = React.useState<ConfigState>(() => {
    const initial: ConfigState = {};
    for (const paso of rutaAlternativa.ruta.pasos) {
      const existente = rutaAlternativa.configPasos.find(
        (cp) => cp.rutaPasoId === paso.id,
      );
      const familia = familiasMap.get(paso.familiaCodigo);
      initial[paso.id] = {
        rutaPasoId: paso.id,
        modoActivacion:
          existente?.modoActivacion ??
          familia?.modoActivacionDefault ??
          "OBLIGATORIO",
        condicionActivacionJson:
          (existente?.condicionActivacionJson as
            Record<string, unknown> | null | undefined) ?? null,
        modoTiempo:
          existente?.modoTiempo ??
          (familia?.modosTiempoSoportados.length === 1
            ? familia.modosTiempoSoportados[0]
            : null),
        mecanismoCantidad:
          (existente?.mecanismoCantidad?.trim() || null) ??
          getDefaultMecanismoCantidad(
            paso.familiaCodigo,
            familia?.mecanismosCantidadSoportados ?? [],
          ),
        mecanismoCantidadConfigJson:
          (existente?.mecanismoCantidadConfigJson as
            Record<string, unknown> | null | undefined) ?? null,
        multiplicadoresActivos: existente?.multiplicadoresActivos ?? [],
        paramsPasoJson:
          (existente?.paramsPasoJson as
            Record<string, unknown> | null | undefined) ?? null,
        nombreVisible: existente?.nombreVisible ?? null,
        maquinaM1Id: existente?.maquinaM1?.id ?? null,
        perfilM1Id: existente?.perfilM1?.id ?? null,
        centroCostoId: existente?.maquinaM1
          ? null
          : (existente?.centroCosto?.id ?? null),
        setupOverrideMin: existente?.setupOverrideMin ?? null,
        cleanupOverrideMin: existente?.cleanupOverrideMin ?? null,
        tiempoFijoOverrideMin: existente?.tiempoFijoOverrideMin ?? null,
        maquinasCandidatas: normalizeMaquinasCandidatas(
          existente?.maquinasCandidatas?.map((candidata, index) => ({
            maquinaId: candidata.maquinaId,
            perfilDefaultId:
              candidata.perfilDefaultId ?? candidata.perfilDefault?.id ?? null,
            modoColorAllowedModes: candidata.modoColorAllowedModes ?? [],
            esPreferida: candidata.esPreferida,
            orden: candidata.orden ?? index,
          })) ?? [],
        ),
        slotsMateriales:
          existente?.slotsMateriales.map<UpsertSlotMaterialPayload>((s) => ({
            slotCodigo: s.slotCodigo,
            slotNombre: s.slotNombre ?? null,
            slotRol: (s.slotRol as UpsertSlotMaterialPayload["slotRol"]) ?? null,
            modoSeleccion: s.modoSeleccion as
              "HARDCODED" | "COMERCIAL_ELIGE" | "MOTOR_ELIGE_AUTO",
            criterioMotorAuto: s.criterioMotorAuto ?? null,
            materialVarianteId: s.materialVariante?.id ?? null,
            candidatos: s.candidatos.map((candidate) => ({
              materiaPrimaId: candidate.materiaPrimaId,
              defaultVarianteId: candidate.defaultVarianteId,
              orden: candidate.orden,
              varianteIds: candidate.variantes.map((item) => item.variante.id),
            })),
            estrategiaCosto: s.estrategiaCosto,
            formula: s.formula,
            cantidadFactor:
              s.cantidadFactor === null || s.cantidadFactor === undefined
                ? null
                : Number(s.cantidadFactor),
            cantidadBase: s.cantidadBase ?? null,
            aplicaMultiCaras: s.aplicaMultiCaras,
          })) ?? [],
      };
    }
    return initial;
  });
  const [candidateMaterials, setCandidateMaterials] = React.useState<
    Record<string, MateriaPrimaBusquedaItem>
  >(() => {
    const map: Record<string, MateriaPrimaBusquedaItem> = {};
    for (const materiaPrima of lookups.materiasPrimas) {
      map[materiaPrima.id] = {
        id: materiaPrima.id,
        codigo: materiaPrima.codigo,
        nombre: materiaPrima.nombre,
        familia: materiaPrima.familia,
        subfamilia: materiaPrima.subfamilia,
        tipoTecnico: "",
        templateId: materiaPrima.templateId,
        variantes: materiaPrima.variantes,
      };
    }
    for (const config of rutaAlternativa.configPasos) {
      for (const slot of config.slotsMateriales) {
        for (const candidate of slot.candidatos) {
          map[candidate.materiaPrimaId] = {
            id: candidate.materiaPrima.id,
            codigo: candidate.materiaPrima.codigo,
            nombre: candidate.materiaPrima.nombre,
            familia: candidate.materiaPrima.familia,
            subfamilia: candidate.materiaPrima.subfamilia,
            tipoTecnico: "",
            templateId: candidate.materiaPrima.templateId,
            variantes: candidate.variantes.map((item) => item.variante),
          };
        }
      }
    }
    return map;
  });
  const [hardcodedMaterialSelections, setHardcodedMaterialSelections] =
    React.useState<Record<string, string>>({});

  // JSON text por paso (sólo UI; al guardar se parsea de vuelta a objeto)
  const [jsonTexts] = React.useState<
    Record<string, { params: string; mecanismo: string }>
  >(() => {
    const map: Record<string, { params: string; mecanismo: string }> = {};
    for (const paso of rutaAlternativa.ruta.pasos) {
      const existente = rutaAlternativa.configPasos.find(
        (cp) => cp.rutaPasoId === paso.id,
      );
      const params = existente?.paramsPasoJson as
        Record<string, unknown> | null | undefined;
      map[paso.id] = {
        params: jsonToText(stripNestingConfig(params)),
        mecanismo: jsonToText(
          existente?.mecanismoCantidadConfigJson as
            Record<string, unknown> | null | undefined,
        ),
      };
    }
    return map;
  });
  const [savedConfigSnapshots, setSavedConfigSnapshots] =
    React.useState<SavedConfigSnapshots>(() => {
      const snapshots: SavedConfigSnapshots = {};
      for (const paso of rutaAlternativa.ruta.pasos) {
        const existente = rutaAlternativa.configPasos.find(
          (cp) => cp.rutaPasoId === paso.id,
        );
        if (existente) {
          snapshots[paso.id] = configSnapshot(configs[paso.id]);
        }
      }
      return snapshots;
    });

  const [guardando, setGuardando] = React.useState<string | null>(null);
  const [activePasoId, setActivePasoId] = React.useState(
    () => rutaAlternativa.ruta.pasos[0]?.id ?? "",
  );
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [panelEditorPasoId, setPanelEditorPasoId] = React.useState<
    string | null
  >(null);

  React.useEffect(() => {
    const ids = rutaAlternativa.ruta.pasos.map((paso) => paso.id);
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.getAttribute("role") === "combobox"
      ) {
        return;
      }
      if (!["ArrowDown", "ArrowUp", "j", "k"].includes(event.key)) return;
      event.preventDefault();
      setActivePasoId((current) => {
        const currentIndex = Math.max(0, ids.indexOf(current));
        if (event.key === "ArrowDown" || event.key === "j") {
          return ids[Math.min(ids.length - 1, currentIndex + 1)] ?? current;
        }
        return ids[Math.max(0, currentIndex - 1)] ?? current;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rutaAlternativa.ruta.pasos]);

  const updateConfig = (
    rutaPasoId: string,
    patch: Partial<UpsertConfigPasoPayload>,
  ) => {
    setConfigs((prev) => ({
      ...prev,
      [rutaPasoId]: { ...prev[rutaPasoId], ...patch },
    }));
  };

  const toggleMaquinaCandidata = (
    rutaPasoId: string,
    maquinaId: string,
    checked: boolean,
  ) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const current = cfg.maquinasCandidatas ?? [];
      const paso = rutaAlternativa.ruta.pasos.find(
        (item) => item.id === rutaPasoId,
      );
      const maquina = lookups.maquinas.find((item) => item.id === maquinaId);
      const perfilDefaultId =
        maquina?.perfilesOperativos.find((perfil) =>
          perfilCompatibleConFamilia(paso?.familiaCodigo, perfil),
        )?.id ?? null;
      const next = checked
        ? normalizeMaquinasCandidatas([
            ...current,
            {
              maquinaId,
              perfilDefaultId,
              modoColorAllowedModes: [],
              esPreferida: current.length === 0,
              orden: current.length,
            },
          ])
        : normalizeMaquinasCandidatas(
            current.filter((candidata) => candidata.maquinaId !== maquinaId),
          );
      const preferredId =
        next.find((candidata) => candidata.esPreferida)?.maquinaId ?? null;
      const preferredCandidate = preferredId
        ? next.find((candidata) => candidata.maquinaId === preferredId)
        : null;
      return {
        ...prev,
        [rutaPasoId]: {
          ...cfg,
          ...(preferredId
            ? {
                maquinaM1Id: preferredId,
                perfilM1Id: preferredCandidate?.perfilDefaultId ?? null,
                centroCostoId: null,
              }
            : {}),
          maquinasCandidatas: next,
        },
      };
    });
  };

  const setMaquinaCandidataPreferida = (
    rutaPasoId: string,
    maquinaId: string,
  ) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const current = cfg.maquinasCandidatas ?? [];
      const paso = rutaAlternativa.ruta.pasos.find(
        (item) => item.id === rutaPasoId,
      );
      const maquina = lookups.maquinas.find((item) => item.id === maquinaId);
      const candidataActual = current.find(
        (candidata) => candidata.maquinaId === maquinaId,
      );
      const perfilDefaultId =
        candidataActual?.perfilDefaultId ??
        maquina?.perfilesOperativos.find((perfil) =>
          perfilCompatibleConFamilia(paso?.familiaCodigo, perfil),
        )?.id ??
        null;
      const next = normalizeMaquinasCandidatas(
        current.map((candidata) => ({
          ...candidata,
          perfilDefaultId:
            candidata.maquinaId === maquinaId
              ? perfilDefaultId
              : (candidata.perfilDefaultId ?? null),
          esPreferida: candidata.maquinaId === maquinaId,
        })),
      );
      return {
        ...prev,
        [rutaPasoId]: {
          ...cfg,
          maquinaM1Id: maquinaId,
          perfilM1Id: perfilDefaultId,
          centroCostoId: null,
          maquinasCandidatas: next,
        },
      };
    });
  };

  const setMaquinaCandidataPerfilDefault = (
    rutaPasoId: string,
    maquinaId: string,
    perfilDefaultId: string | null,
  ) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const current = cfg.maquinasCandidatas ?? [];
      const preferred = current.some(
        (candidata) =>
          candidata.maquinaId === maquinaId && candidata.esPreferida,
      );
      const next = normalizeMaquinasCandidatas(
        current.map((candidata) =>
          candidata.maquinaId === maquinaId
            ? { ...candidata, perfilDefaultId }
            : candidata,
        ),
      );
      return {
        ...prev,
        [rutaPasoId]: {
          ...cfg,
          ...(preferred
            ? { maquinaM1Id: maquinaId, perfilM1Id: perfilDefaultId }
            : {}),
          maquinasCandidatas: next,
        },
      };
    });
  };

  const setMaquinaCandidataModoColorAllowed = (
    rutaPasoId: string,
    maquinaId: string,
    allowedModes: string[] | null,
  ) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const current = cfg.maquinasCandidatas ?? [];
      const maquina = lookups.maquinas.find((item) => item.id === maquinaId);
      const options = buildModoColorOptions(maquina, null, true);
      const optionValues = options.map((option) => option.value);
      const normalizedAllowed = Array.from(
        new Set(
          (allowedModes ?? [])
            .map((item) => normalizeModoColor(item))
            .filter((item): item is string => item !== null)
            .filter((item) => optionValues.includes(item)),
        ),
      );
      const nextAllowed =
        normalizedAllowed.length === 0 ||
        normalizedAllowed.length === optionValues.length
          ? []
          : normalizedAllowed;
      const next = normalizeMaquinasCandidatas(
        current.map((candidata) =>
          candidata.maquinaId === maquinaId
            ? { ...candidata, modoColorAllowedModes: nextAllowed }
            : candidata,
        ),
      );
      return {
        ...prev,
        [rutaPasoId]: {
          ...cfg,
          maquinasCandidatas: next,
        },
      };
    });
  };

  const toggleMultiplicador = (rutaPasoId: string, multiplicador: string) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const current = cfg.multiplicadoresActivos ?? [];
      const next = current.includes(multiplicador)
        ? current.filter((item) => item !== multiplicador)
        : [...current, multiplicador];
      return {
        ...prev,
        [rutaPasoId]: { ...cfg, multiplicadoresActivos: next },
      };
    });
  };

  const hasUnsavedChanges = React.useCallback(
    (rutaPasoId: string) => {
      const savedSnapshot = savedConfigSnapshots[rutaPasoId];
      if (!savedSnapshot) {
        return true;
      }
      return savedSnapshot !== configSnapshot(configs[rutaPasoId]);
    },
    [configs, savedConfigSnapshots],
  );

  const updateNestingConfig = (
    rutaPasoId: string,
    patch: Record<string, unknown>,
  ) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const params = asRecord(cfg.paramsPasoJson);
      const current = getNestingConfig(params);
      const nextNesting = { ...current, ...patch };
      const nextParams = { ...params, nestingConfig: nextNesting };
      return { ...prev, [rutaPasoId]: { ...cfg, paramsPasoJson: nextParams } };
    });
  };

  const updateNestingPieceBleed = (rutaPasoId: string, value: number) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const params = asRecord(cfg.paramsPasoJson);
      const current = getNestingConfig(params);
      const nextNesting: Record<string, unknown> = {
        ...current,
        pieceBleedMm: value,
      };
      delete nextNesting.separationHMm;
      delete nextNesting.separationVMm;
      delete nextNesting.exteriorMarginFromSpacing;
      const nextParams = { ...params, nestingConfig: nextNesting };
      return { ...prev, [rutaPasoId]: { ...cfg, paramsPasoJson: nextParams } };
    });
  };

  const updateNestingMargins = (
    rutaPasoId: string,
    patch: Record<string, number | null>,
  ) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const params = asRecord(cfg.paramsPasoJson);
      const current = getNestingConfig(params);
      const margins = { ...asRecord(current.margins), ...patch };
      const nextNesting = { ...current, margins };
      const nextParams = { ...params, nestingConfig: nextNesting };
      return { ...prev, [rutaPasoId]: { ...cfg, paramsPasoJson: nextParams } };
    });
  };

  const updateNestingExtraMargins = (
    rutaPasoId: string,
    patch: Record<string, number | null>,
  ) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const params = asRecord(cfg.paramsPasoJson);
      const current = getNestingConfig(params);
      const extraMargins = { ...asRecord(current.extraMargins), ...patch };
      for (const key of Object.keys(extraMargins)) {
        const value = extraMargins[key];
        if (
          value === null ||
          value === undefined ||
          value === "" ||
          Number(value) === 0
        ) {
          delete extraMargins[key];
        }
      }
      const nextNesting =
        Object.keys(extraMargins).length > 0
          ? { ...current, extraMargins }
          : Object.fromEntries(
              Object.entries(current).filter(([key]) => key !== "extraMargins"),
            );
      const nextParams = { ...params, nestingConfig: nextNesting };
      return { ...prev, [rutaPasoId]: { ...cfg, paramsPasoJson: nextParams } };
    });
  };

  const updateNestingCosting = (
    rutaPasoId: string,
    patch: Record<string, unknown>,
  ) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const params = asRecord(cfg.paramsPasoJson);
      const current = getNestingConfig(params);
      const costing = { ...asRecord(current.costing), ...patch };
      const nextNesting = { ...current, costing };
      const nextParams = { ...params, nestingConfig: nextNesting };
      return { ...prev, [rutaPasoId]: { ...cfg, paramsPasoJson: nextParams } };
    });
  };

  const updateNestingPanelizado = (
    rutaPasoId: string,
    patch: Record<string, unknown>,
  ) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const params = asRecord(cfg.paramsPasoJson);
      const current = getNestingConfig(params);
      const panelizado = { ...asRecord(current.panelizado), ...patch };
      const nextNesting = { ...current, panelizado };
      const nextParams = { ...params, nestingConfig: nextNesting };
      return { ...prev, [rutaPasoId]: { ...cfg, paramsPasoJson: nextParams } };
    });
  };

  const updateNestingPliegoImpresion = (
    rutaPasoId: string,
    patch: Record<string, unknown>,
  ) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const params = asRecord(cfg.paramsPasoJson);
      const current = getNestingConfig(params);
      const pliegoImpresion = {
        ...asRecord(current.pliegoImpresion),
        ...patch,
      };
      for (const key of Object.keys(pliegoImpresion)) {
        const value = pliegoImpresion[key];
        if (value === "" || value === null || value === undefined) {
          delete pliegoImpresion[key];
        }
      }
      const nextNesting =
        Object.keys(pliegoImpresion).length > 0
          ? { ...current, pliegoImpresion }
          : Object.fromEntries(
              Object.entries(current).filter(
                ([key]) => key !== "pliegoImpresion",
              ),
            );
      const nextParams = { ...params, nestingConfig: nextNesting };
      return { ...prev, [rutaPasoId]: { ...cfg, paramsPasoJson: nextParams } };
    });
  };

  const updateNestingPliegoPreset = (
    rutaPasoId: string,
    presetValue: string,
  ) => {
    const preset = PLIEGO_IMPRESION_PRESETS.find(
      (item) => item.value === presetValue,
    );
    if (!preset || preset.value === "materia_prima") {
      updateNestingPliegoImpresion(rutaPasoId, {
        modo: null,
        preset: null,
        anchoMm: null,
        altoMm: null,
      });
      return;
    }
    if (preset.value === "automatico") {
      updateNestingPliegoImpresion(rutaPasoId, {
        modo: "automatico",
        preset: "automatico",
        anchoMm: null,
        altoMm: null,
      });
      return;
    }
    if (preset.value === "personalizado") {
      updateNestingPliegoImpresion(rutaPasoId, {
        modo: null,
        preset: "personalizado",
      });
      return;
    }
    updateNestingPliegoImpresion(rutaPasoId, {
      modo: null,
      preset: preset.value,
      anchoMm: preset.anchoMm,
      altoMm: preset.altoMm,
    });
  };

  const updateNestingPliegoCandidato = (
    rutaPasoId: string,
    index: number,
    patch: Record<string, unknown>,
  ) => {
    const cfg = configs[rutaPasoId];
    const pliego = getPliegoImpresionConfig(cfg?.paramsPasoJson);
    const candidatos = getPliegoCandidatos(pliego).map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    );
    updateNestingPliegoImpresion(rutaPasoId, { candidatos });
  };

  const addNestingPliegoCandidato = (
    rutaPasoId: string,
    presetValue = "A4",
  ) => {
    const cfg = configs[rutaPasoId];
    const pliego = getPliegoImpresionConfig(cfg?.paramsPasoJson);
    const current = getPliegoCandidatos(pliego);
    const presetCandidate = buildPliegoCandidateFromPreset(presetValue);
    const candidate =
      presetCandidate ?? {
        id: `personalizado-${Date.now()}`,
        preset: "personalizado",
        nombre: "Personalizado",
        anchoMm: 0,
        altoMm: 0,
        activo: true,
      };
    updateNestingPliegoImpresion(rutaPasoId, {
      modo: "automatico",
      preset: "automatico",
      candidatos: [...current, candidate],
    });
  };

  const removeNestingPliegoCandidato = (rutaPasoId: string, index: number) => {
    const cfg = configs[rutaPasoId];
    const pliego = getPliegoImpresionConfig(cfg?.paramsPasoJson);
    const candidatos = getPliegoCandidatos(pliego).filter(
      (_, itemIndex) => itemIndex !== index,
    );
    updateNestingPliegoImpresion(rutaPasoId, { candidatos });
  };

  const updateStepParams = (
    rutaPasoId: string,
    patch: Record<string, unknown>,
  ) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const params = { ...asRecord(cfg.paramsPasoJson), ...patch };
      for (const key of Object.keys(params)) {
        const value = params[key];
        if (
          value === "" ||
          value === null ||
          value === undefined ||
          (typeof value === "number" && !Number.isFinite(value))
        ) {
          delete params[key];
        }
      }
      return {
        ...prev,
        [rutaPasoId]: {
          ...cfg,
          paramsPasoJson: Object.keys(params).length > 0 ? params : null,
        },
      };
    });
  };

  const updateModoColorConfig = (
    rutaPasoId: string,
    patch: Record<string, unknown>,
  ) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const params = asRecord(cfg.paramsPasoJson);
      const current = getModoColorConfig(params);
      const nextConfig = { ...current, ...patch };
      for (const key of Object.keys(nextConfig)) {
        const value = nextConfig[key];
        if (
          value === "" ||
          value === null ||
          value === undefined ||
          (Array.isArray(value) && value.length === 0)
        ) {
          delete nextConfig[key];
        }
      }
      const nextParams =
        Object.keys(nextConfig).length > 0
          ? { ...params, modoColorConfig: nextConfig }
          : Object.fromEntries(
              Object.entries(params).filter(
                ([key]) => key !== "modoColorConfig",
              ),
            );
      return { ...prev, [rutaPasoId]: { ...cfg, paramsPasoJson: nextParams } };
    });
  };

  const updateSlot = (
    rutaPasoId: string,
    slotIdx: number,
    patch: Partial<UpsertSlotMaterialPayload>,
  ) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const slots = [...(cfg.slotsMateriales ?? [])];
      slots[slotIdx] = { ...slots[slotIdx], ...patch };
      return { ...prev, [rutaPasoId]: { ...cfg, slotsMateriales: slots } };
    });
  };

  const addSlotFromFamilia = (rutaPasoId: string, slotCodigo: string) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const existente = cfg.slotsMateriales?.find(
        (s) => s.slotCodigo === slotCodigo,
      );
      if (existente) return prev; // ya existe
      const familiaCodigo = rutaAlternativa.ruta.pasos.find(
        (paso) => paso.id === rutaPasoId,
      )?.familiaCodigo;
      const nuevoSlot: UpsertSlotMaterialPayload = {
        slotCodigo,
        modoSeleccion: "HARDCODED",
        materialVarianteId: null,
        estrategiaCosto: "simple",
        formula:
          familiaCodigo === "laminado" && slotCodigo === "film"
            ? "por_metro_lineal"
            : "por_unidad_productiva",
        aplicaMultiCaras: false,
      };
      return {
        ...prev,
        [rutaPasoId]: {
          ...cfg,
          slotsMateriales: [...(cfg.slotsMateriales ?? []), nuevoSlot],
        },
      };
    });
  };

  const addSlotAdicional = (rutaPasoId: string) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const slots = cfg.slotsMateriales ?? [];
      const nextNumber =
        slots.filter((slot) => slot.slotCodigo.startsWith("componente_"))
          .length + 1;
      let slotCodigo = `componente_${nextNumber}`;
      let suffix = nextNumber;
      while (slots.some((slot) => slot.slotCodigo === slotCodigo)) {
        suffix += 1;
        slotCodigo = `componente_${suffix}`;
      }
      const nuevoSlot: UpsertSlotMaterialPayload = {
        slotCodigo,
        slotNombre: `Componente ${suffix}`,
        slotRol: "COMPONENTE",
        modoSeleccion: "HARDCODED",
        materialVarianteId: null,
        estrategiaCosto: "simple",
        formula: "por_pieza",
        cantidadFactor: 1,
        cantidadBase: "cantidad_pedida",
        aplicaMultiCaras: false,
      };
      return {
        ...prev,
        [rutaPasoId]: {
          ...cfg,
          slotsMateriales: [...slots, nuevoSlot],
        },
      };
    });
  };

  const addSlotCandidate = (
    rutaPasoId: string,
    slotIdx: number,
    materiaPrima: MateriaPrimaBusquedaItem,
  ) => {
    setCandidateMaterials((prev) => ({
      ...prev,
      [materiaPrima.id]: materiaPrima,
    }));
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const slots = [...(cfg.slotsMateriales ?? [])];
      const slot = slots[slotIdx];
      if (!slot) return prev;
      const current = slot.candidatos ?? [];
      if (
        current.some(
          (candidate) => candidate.materiaPrimaId === materiaPrima.id,
        )
      ) {
        return prev;
      }
      const variantIds = materiaPrima.variantes.map((variante) => variante.id);
      slots[slotIdx] = {
        ...slot,
        candidatos: [
          ...current,
          {
            materiaPrimaId: materiaPrima.id,
            defaultVarianteId: variantIds[0] ?? null,
            orden: current.length,
            varianteIds: variantIds,
          },
        ],
      };
      return { ...prev, [rutaPasoId]: { ...cfg, slotsMateriales: slots } };
    });
  };

  const removeSlotCandidate = (
    rutaPasoId: string,
    slotIdx: number,
    materiaPrimaId: string,
  ) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const slots = [...(cfg.slotsMateriales ?? [])];
      const slot = slots[slotIdx];
      if (!slot) return prev;
      slots[slotIdx] = {
        ...slot,
        candidatos: (slot.candidatos ?? []).filter(
          (candidate) => candidate.materiaPrimaId !== materiaPrimaId,
        ),
      };
      return { ...prev, [rutaPasoId]: { ...cfg, slotsMateriales: slots } };
    });
  };

  const updateSlotCandidate = (
    rutaPasoId: string,
    slotIdx: number,
    materiaPrimaId: string,
    patch: Partial<
      NonNullable<UpsertSlotMaterialPayload["candidatos"]>[number]
    >,
  ) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const slots = [...(cfg.slotsMateriales ?? [])];
      const slot = slots[slotIdx];
      if (!slot) return prev;
      slots[slotIdx] = {
        ...slot,
        candidatos: (slot.candidatos ?? []).map((candidate) =>
          candidate.materiaPrimaId === materiaPrimaId
            ? { ...candidate, ...patch }
            : candidate,
        ),
      };
      return { ...prev, [rutaPasoId]: { ...cfg, slotsMateriales: slots } };
    });
  };

  const removeSlot = (rutaPasoId: string, slotIdx: number) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const slots = (cfg.slotsMateriales ?? []).filter((_, i) => i !== slotIdx);
      return { ...prev, [rutaPasoId]: { ...cfg, slotsMateriales: slots } };
    });
  };

  const guardarPaso = async (rutaPasoId: string) => {
    // Parsear JSONs antes de guardar
    const jsonText = jsonTexts[rutaPasoId];
    const paso = rutaAlternativa.ruta.pasos.find((p) => p.id === rutaPasoId);
    const familia = paso ? familiasMap.get(paso.familiaCodigo) : undefined;
    const noEjecutar = configs[rutaPasoId].modoActivacion === "NO_EJECUTAR";
    const cantidadRelevante =
      !noEjecutar && requiereMecanismoCantidad(configs[rutaPasoId], familia);
    const paramsRes = textToJson(jsonText.params);
    const mecanismoRes = cantidadRelevante
      ? textToJson(jsonText.mecanismo)
      : ({ ok: true, value: null } as const);
    if (!paramsRes.ok) {
      toast.error(`JSON inválido en "Params del paso": ${paramsRes.error}`);
      return;
    }
    if (!mecanismoRes.ok) {
      toast.error(
        `JSON inválido en "Config de cantidad": ${mecanismoRes.error}`,
      );
      return;
    }
    const condicionActivacionJson =
      configs[rutaPasoId].modoActivacion === "CONDICIONAL"
        ? ((configs[rutaPasoId].condicionActivacionJson as
            Record<string, unknown> | null | undefined) ?? null)
        : null;
    if (configs[rutaPasoId].modoActivacion === "CONDICIONAL") {
      const camposRegla = getRuleFields({
        includeMeasureFields:
          producto.modoMedidas === "LIBRE" || producto.modoMedidas === "MIXTA",
        extraFields: technologyRuleFields,
      });
      const parsedRule = jsonLogicToRuleGroup(
        condicionActivacionJson,
        camposRegla,
      );
      if (parsedRule.supported) {
        const validation = validateRuleGroup(parsedRule.group, camposRegla);
        if (!validation.ok) {
          toast.error(validation.error ?? "Completá la regla de activación.");
          return;
        }
      }
    }

    setGuardando(rutaPasoId);
    try {
      const currentParams = asRecord(configs[rutaPasoId].paramsPasoJson);
      const tieneMaquinasCandidatas =
        (configs[rutaPasoId].maquinasCandidatas ?? []).length > 0;
      const nestingConfig = sanitizeNestingConfigForFamilia(
        getNestingConfig(currentParams),
        familia?.codigo,
      );
      const modoColorConfigRaw = getModoColorConfig(currentParams);
      const configExistente = rutaAlternativa.configPasos.find(
        (cp) => cp.rutaPasoId === rutaPasoId,
      );
      const maquinaSel = lookups.maquinas.find(
        (m) => m.id === configs[rutaPasoId].maquinaM1Id,
      );
      const maquinaGuardada = maquinaSel ?? configExistente?.maquinaM1 ?? null;
      const perfilGuardado =
        maquinaSel?.perfilesOperativos.find(
          (p) => p.id === configs[rutaPasoId].perfilM1Id,
        ) ??
        configExistente?.perfilM1 ??
        null;
      const modoColorOptions = buildModoColorOptions(
        maquinaGuardada,
        configExistente,
        ["impresion_por_hoja", "impresion_por_area"].includes(
          rutaAlternativa.ruta.pasos.find((paso) => paso.id === rutaPasoId)
            ?.familiaCodigo ?? "",
        ),
      );
      const modoColorAllowed = Array.isArray(modoColorConfigRaw.allowedModes)
        ? modoColorConfigRaw.allowedModes
            .map((item) => normalizeModoColor(item))
            .filter((item): item is string => item !== null)
        : [];
      const allowedForSave =
        modoColorConfigRaw.enabled === true && modoColorAllowed.length > 0
          ? modoColorAllowed.filter((mode) =>
              modoColorOptions.some((option) => option.value === mode),
            )
          : modoColorOptions.map((option) => option.value);
      const perfilDefaultMode = modosColorFromPerfil(perfilGuardado)[0] ?? "";
      const defaultForSave =
        allowedForSave.find((mode) => mode === perfilDefaultMode) ??
        allowedForSave[0] ??
        null;
      const modoColorConfig =
        !tieneMaquinasCandidatas && modoColorConfigRaw.enabled === true
          ? {
              ...modoColorConfigRaw,
              defaultMode: defaultForSave,
              comercialElige: allowedForSave.length > 1,
              allowedModes:
                allowedForSave.length === modoColorOptions.length &&
                !allowedForSave.includes("SIN_IMPRESION")
                  ? null
                  : allowedForSave,
            }
          : modoColorConfigRaw;
      const modoColorConfigClean = Object.fromEntries(
        Object.entries(modoColorConfig).filter(([, value]) => {
          if (value === "" || value === null || value === undefined)
            return false;
          if (Array.isArray(value) && value.length === 0) return false;
          return true;
        }),
      );
      const paramsPasoJson = { ...(paramsRes.value ?? {}), ...currentParams };
      delete paramsPasoJson.nestingConfig;
      delete paramsPasoJson.modoColorConfig;
      if (configs[rutaPasoId].modoTiempo === "T-2") {
        const unit =
          typeof paramsPasoJson.productivityUnit === "string"
            ? paramsPasoJson.productivityUnit
            : getDefaultT2ProductivityUnit(familia?.codigo);
        const sourceOptions = getT2QuantitySourceOptions(unit, familia?.codigo);
        const rawSource =
          typeof paramsPasoJson.productivityQuantitySource === "string"
            ? paramsPasoJson.productivityQuantitySource
            : getDefaultT2QuantitySource(familia?.codigo, unit);
        const normalizedSource =
          familia?.codigo === "montaje_sobre_sustrato" &&
          unit === "unidades_h" &&
          rawSource === "cantidad"
            ? "cantidad_montaje"
            : rawSource;
        const rawTimeMode =
          typeof paramsPasoJson.timeCalculationMode === "string"
            ? paramsPasoJson.timeCalculationMode
            : getDefaultT2TimeCalculationMode(familia?.codigo);
        paramsPasoJson.productivityUnit = unit;
        paramsPasoJson.timeCalculationMode =
          T2_TIME_CALCULATION_MODE_OPTIONS.some(
            (option) => option.value === rawTimeMode,
          )
            ? rawTimeMode
            : getDefaultT2TimeCalculationMode(familia?.codigo);
        paramsPasoJson.productivityQuantitySource = sourceOptions.some(
          (option) => option.value === normalizedSource,
        )
          ? normalizedSource
          : getDefaultT2QuantitySource(familia?.codigo, unit);
      }
      if (Object.keys(nestingConfig).length > 0) {
        paramsPasoJson.nestingConfig = nestingConfig;
      }
      if (
        !tieneMaquinasCandidatas &&
        Object.keys(modoColorConfigClean).length > 0
      ) {
        paramsPasoJson.modoColorConfig = modoColorConfigClean;
      }
      await upsertConfigPaso(rutaAlternativa.id, {
        ...configs[rutaPasoId],
        centroCostoId: configs[rutaPasoId].maquinaM1Id
          ? null
          : (configs[rutaPasoId].centroCostoId ?? null),
        condicionActivacionJson,
        mecanismoCantidad: cantidadRelevante
          ? configs[rutaPasoId].mecanismoCantidad
          : null,
        paramsPasoJson:
          Object.keys(paramsPasoJson).length > 0 ? paramsPasoJson : null,
        mecanismoCantidadConfigJson: mecanismoRes.value,
      });
      setSavedConfigSnapshots((prev) => ({
        ...prev,
        [rutaPasoId]: configSnapshot(configs[rutaPasoId]),
      }));
      toast.success("Configuración guardada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardando(null);
    }
  };

  const getPasoSummary = (
    paso: RutaAlternativaDetalle["ruta"]["pasos"][number],
  ) => {
    const familia = familiasMap.get(paso.familiaCodigo);
    const cfg = configs[paso.id];
    const jsonText = jsonTexts[paso.id];
    const configExistente = rutaAlternativa.configPasos.find(
      (cp) => cp.rutaPasoId === paso.id,
    );
    const noEjecutar = cfg.modoActivacion === "NO_EJECUTAR";
    const cantidadRelevante =
      !noEjecutar && requiereMecanismoCantidad(cfg, familia);
    const valBasico = noEjecutar
      ? { errores: [], warnings: [] }
      : validarBasico(cfg, familia);
    const valMateriales = noEjecutar
      ? { errores: [], warnings: [] }
      : validarMateriales(cfg, familia);
    const valAvanzado = noEjecutar
      ? { errores: [], warnings: [] }
      : validarAvanzado(
          jsonText.params,
          cantidadRelevante ? jsonText.mecanismo : "",
          cfg,
          familia ? { codigo: familia.codigo } : undefined,
        );
    const totalErrores =
      valBasico.errores.length +
      valMateriales.errores.length +
      valAvanzado.errores.length;
    const totalWarnings =
      valBasico.warnings.length +
      valMateriales.warnings.length +
      valAvanzado.warnings.length;
    const maquinaSel =
      lookups.maquinas.find((maquina) => maquina.id === cfg.maquinaM1Id) ??
      configExistente?.maquinaM1 ??
      null;
    const centroManual = cfg.centroCostoId
      ? lookups.centrosCosto.find((centro) => centro.id === cfg.centroCostoId)
      : null;
    const optional = cfg.modoActivacion === "OPCIONAL";
    const status =
      totalErrores > 0 || totalWarnings > 0
        ? "warning"
        : noEjecutar
          ? "skipped"
          : configExistente
            ? "done"
            : optional
              ? "optional"
              : "pending";
    return {
      familia,
      cfg,
      configExistente,
      cantidadRelevante,
      totalErrores,
      totalWarnings,
      maquinaNombre: noEjecutar
        ? "No se ejecuta"
        : (maquinaSel?.nombre ?? centroManual?.nombre ?? "Sin centro asignado"),
      status,
      optional,
      skipped: noEjecutar,
    };
  };

  const activeIdx = Math.max(
    0,
    rutaAlternativa.ruta.pasos.findIndex((paso) => paso.id === activePasoId),
  );
  const stepSummaries = rutaAlternativa.ruta.pasos.map((paso) => ({
    paso,
    summary: getPasoSummary(paso),
  }));
  const skippedCount = stepSummaries.filter(
    ({ summary }) => summary.skipped,
  ).length;
  const activeStepCount = Math.max(
    0,
    rutaAlternativa.ruta.pasos.length - skippedCount,
  );
  const doneCount = stepSummaries.filter(
    ({ summary }) => summary.status === "done",
  ).length;
  const activePaso =
    rutaAlternativa.ruta.pasos[activeIdx] ?? rutaAlternativa.ruta.pasos[0];
  const goPrev = () => {
    const prev = rutaAlternativa.ruta.pasos[Math.max(0, activeIdx - 1)];
    if (prev) setActivePasoId(prev.id);
  };
  const goNext = () => {
    const next =
      rutaAlternativa.ruta.pasos[
        Math.min(rutaAlternativa.ruta.pasos.length - 1, activeIdx + 1)
      ];
    if (next) setActivePasoId(next.id);
  };

  return (
    <div
      className={
        embedded
          ? "pasos-editor-root"
          : "pasos-editor-root flex flex-1 flex-col"
      }
    >
      <div className="editor-shell">
        <aside className="editor-side">
          <div className="side-head">
            <Link
              href={`/productos-servicios/${producto.id}?tab=pasos&rutaAltId=${rutaAlternativa.id}`}
              className="back-link"
            >
              <ArrowLeftIcon className="size-4" />
              Volver a rutas
            </Link>
            <div className="route">
              <span>{rutaAlternativa.esPreferida ? "★" : "☆"}</span>
              {rutaAlternativa.nombre}
            </div>
          </div>
          <div className="side-progress">
            <span>
              {doneCount}/{activeStepCount} activos
              {skippedCount > 0
                ? ` · ${skippedCount} omitido${skippedCount === 1 ? "" : "s"}`
                : ""}
            </span>
            <div className="bar">
              <span
                style={{
                  width: `${(doneCount / Math.max(1, activeStepCount)) * 100}%`,
                }}
              />
            </div>
          </div>
          <div className="pasos">
            {rutaAlternativa.ruta.pasos.map((paso, idx) => {
              const summary = getPasoSummary(paso);
              const pasoLabel =
                configs[paso.id]?.nombreVisible?.trim() ||
                summary.familia?.nombre ||
                paso.familiaCodigo;
              return (
                <button
                  type="button"
                  key={paso.id}
                  className={`paso-item ${summary.status} ${summary.optional ? "optional" : ""} ${paso.id === activePasoId ? "active" : ""}`}
                  onClick={() => setActivePasoId(paso.id)}
                >
                  <span className="ix">
                    {summary.skipped ? (
                      "—"
                    ) : summary.status === "done" ? (
                      <CheckIcon className="size-3" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <span className="body">
                    <span className="ttl">{pasoLabel}</span>
                    <span className="sub">{summary.maquinaNombre}</span>
                  </span>
                  <span className="status">
                    {summary.skipped
                      ? "No ejecutar"
                      : summary.status === "done"
                        ? "✓"
                        : summary.status === "warning"
                          ? "!"
                          : summary.optional
                            ? "Opt"
                            : "·"}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="kbd-panel">
            <span className="kbd-hint">
              Navegar pasos con <span className="k">↑</span>{" "}
              <span className="k">↓</span>
            </span>
          </div>
        </aside>

        <main className="editor-main">
          <div className="mini-graph">
            {rutaAlternativa.ruta.pasos.map((paso, idx) => {
              const summary = getPasoSummary(paso);
              const pasoLabel =
                configs[paso.id]?.nombreVisible?.trim() ||
                summary.familia?.nombre ||
                paso.familiaCodigo;
              return (
                <React.Fragment key={paso.id}>
                  <button
                    type="button"
                    className={`mn ${summary.status} ${summary.optional ? "optional" : ""} ${paso.id === activePasoId ? "active" : ""}`}
                    onClick={() => setActivePasoId(paso.id)}
                    title={pasoLabel}
                  >
                    <span className="d">
                      {summary.skipped
                        ? "—"
                        : summary.status === "done"
                          ? "✓"
                          : idx + 1}
                    </span>
                    <span className="lb">{pasoLabel.split(" ")[0]}</span>
                  </button>
                  {idx < rutaAlternativa.ruta.pasos.length - 1 && (
                    <div
                      className={`edge ${
                        !summary.skipped &&
                        summary.status === "done" &&
                        !getPasoSummary(rutaAlternativa.ruta.pasos[idx + 1]!)
                          .skipped &&
                        getPasoSummary(rutaAlternativa.ruta.pasos[idx + 1]!)
                          .status === "done"
                          ? "done"
                          : ""
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {activePaso
            ? rutaAlternativa.ruta.pasos
                .filter((paso) => paso.id === activePaso.id)
                .map((paso) => {
                  const idx = rutaAlternativa.ruta.pasos.findIndex(
                    (item) => item.id === paso.id,
                  );
                  const familia = familiasMap.get(paso.familiaCodigo);
                  const cfg = configs[paso.id];
                  const pasoLabel =
                    cfg.nombreVisible?.trim() ||
                    familia?.nombre ||
                    paso.familiaCodigo;
                  const jsonText = jsonTexts[paso.id];
                  const configExistente = rutaAlternativa.configPasos.find(
                    (cp) => cp.rutaPasoId === paso.id,
                  );
                  const maquinasCompatibles = lookups.maquinas.filter((m) =>
                    maquinaCompatibleConFamilia(
                      paso.familiaCodigo,
                      familia?.plantillasCompatibles,
                      m,
                    ),
                  );
                  const soportaM2 =
                    familia?.relacionMaquinaSoportada.includes("M-2") ?? false;
                  const maquinasCandidatasCompatibles = lookups.maquinas.filter(
                    (m) =>
                      maquinaCandidataCompatibleConFamilia(
                        paso.familiaCodigo,
                        familia?.plantillasCompatibles,
                        m,
                      ),
                  );
                  const candidatasCfg = normalizeMaquinasCandidatas(
                    cfg.maquinasCandidatas ?? [],
                  );
                  const candidatasSeleccionadas = new Set(
                    candidatasCfg.map((candidata) => candidata.maquinaId),
                  );
                  const candidataPreferidaId =
                    candidatasCfg.find((candidata) => candidata.esPreferida)
                      ?.maquinaId ??
                    candidatasCfg[0]?.maquinaId ??
                    null;
                  const tecnologiasCandidatas = Array.from(
                    new Set(
                      candidatasCfg
                        .map((candidata) =>
                          maquinasCandidatasCompatibles.find(
                            (maquina) => maquina.id === candidata.maquinaId,
                          ),
                        )
                        .filter((maquina): maquina is MaquinaLookup =>
                          Boolean(maquina),
                        )
                        .map(
                          (maquina) =>
                            getMachineTechnology(maquina) ?? "sin_tecnologia",
                        ),
                    ),
                  );
                  const maquinaSel = lookups.maquinas.find(
                    (m) => m.id === cfg.maquinaM1Id,
                  );
                  const maquinaGuardada =
                    maquinaSel ?? configExistente?.maquinaM1 ?? null;
                  const maquinaOptions = ensureSelectedOption(
                    maquinasCompatibles.map((m) => machineOption(m)),
                    cfg.maquinaM1Id,
                    maquinaGuardada
                      ? machineOption(maquinaGuardada, "guardada/no compatible")
                      : undefined,
                  );
                  const perfilGuardado =
                    maquinaSel?.perfilesOperativos.find(
                      (p) => p.id === cfg.perfilM1Id,
                    ) ??
                    configExistente?.perfilM1 ??
                    null;
                  const perfilOptions = ensureSelectedOption(
                    (maquinaSel?.perfilesOperativos ?? [])
                      .filter((p) =>
                        perfilCompatibleConFamilia(paso.familiaCodigo, p),
                      )
                      .map((p) => profileOption(p)),
                    cfg.perfilM1Id,
                    perfilGuardado
                      ? profileOption(perfilGuardado, "guardado/no disponible")
                      : undefined,
                  );
                  const opcionesActivacion = Array.from(
                    new Set([
                      ...(familia?.modosActivacionSoportados ??
                        MODOS_ACTIVACION),
                      "NO_EJECUTAR",
                    ]),
                  ).map((m) => optionFromLabel(m, modoActivacionLabels));
                  const opcionesTiempo = (
                    familia?.modosTiempoSoportados ?? [
                      "T-1",
                      "T-2",
                      "T-3",
                      "T-4",
                    ]
                  ).map((m) => optionFromLabel(m, modoTiempoLabels));
                  const opcionesCantidad = (
                    familia?.mecanismosCantidadSoportados ?? [
                      "DIRECT_FROM_JOBCONTEXT",
                      "HEREDAR_DEL_OUTPUT_CANONICO",
                      "CALCULADO_POR_PASO",
                      "CONVERSION",
                    ]
                  ).map((m) => {
                    const option = optionFromLabel(m, mecanismoCantidadLabels);
                    if (
                      familia?.codigo === "corte_manual" &&
                      m === "HEREDAR_DEL_OUTPUT_CANONICO"
                    ) {
                      return {
                        ...option,
                        label: "Pliegos impresos del paso anterior",
                        description:
                          "Usa la cantidad de pliegos ya impresos/montados, no la cantidad final de imanes.",
                      };
                    }
                    return option;
                  });
                  const centroGuardado = configExistente?.centroCosto ?? null;
                  const centroCostoOptions = ensureSelectedOption(
                    lookups.centrosCosto.map((centro) =>
                      centroCostoOption(centro),
                    ),
                    cfg.centroCostoId,
                    centroGuardado
                      ? centroCostoOption(centroGuardado)
                      : undefined,
                  );

                  const slotsManuales =
                    familia?.slotsRequeridos.filter(
                      (slot) => !isConsumibleMaquinaSlot(slot),
                    ) ?? [];
                  const slotsAutomaticos =
                    familia?.slotsRequeridos.filter(isConsumibleMaquinaSlot) ??
                    [];
                  const requiereMateriales =
                    slotsManuales.length > 0 ||
                    slotsAutomaticos.length > 0 ||
                    Boolean(familia?.permiteSlotsAdicionales);
                  const noEjecutar = cfg.modoActivacion === "NO_EJECUTAR";
                  const cantidadRelevante =
                    !noEjecutar && requiereMecanismoCantidad(cfg, familia);
                  const mostrarNesting = nestingAplica(familia?.codigo, cfg);
                  const mostrarSetupCleanupOverrides = Boolean(cfg.maquinaM1Id);
                  const mostrarTiempoFijoOverride =
                    cfg.modoTiempo === "T-1" && !cfg.maquinaM1Id;
                  const mostrarProductividadPropia = cfg.modoTiempo === "T-2";
                  const paramsPaso = asRecord(cfg.paramsPasoJson);
                  const productividadPropia = readOptionalNumber(
                    paramsPaso.productivityValue,
                  );
                  const horasEstimadasPaso = readOptionalNumber(
                    paramsPaso.horasEstimadas,
                  );
                  const batchTimeMin = readOptionalNumber(
                    paramsPaso.batchTimeMin,
                  );
                  const batchSize = readOptionalNumber(paramsPaso.batchSize);
                  const timeCalculationModeRaw =
                    typeof paramsPaso.timeCalculationMode === "string"
                      ? paramsPaso.timeCalculationMode
                      : getDefaultT2TimeCalculationMode(familia?.codigo);
                  const timeCalculationMode =
                    T2_TIME_CALCULATION_MODE_OPTIONS.some(
                      (option) => option.value === timeCalculationModeRaw,
                    )
                      ? timeCalculationModeRaw
                      : getDefaultT2TimeCalculationMode(familia?.codigo);
                  const productivityUnit =
                    typeof paramsPaso.productivityUnit === "string"
                      ? paramsPaso.productivityUnit
                      : getDefaultT2ProductivityUnit(familia?.codigo);
                  const productivityQuantitySourceRaw =
                    typeof paramsPaso.productivityQuantitySource === "string"
                      ? paramsPaso.productivityQuantitySource
                      : getDefaultT2QuantitySource(
                          familia?.codigo,
                          productivityUnit,
                        );
                  const normalizedProductivityQuantitySourceRaw =
                    familia?.codigo === "montaje_sobre_sustrato" &&
                    productivityUnit === "unidades_h" &&
                    productivityQuantitySourceRaw === "cantidad"
                      ? "cantidad_montaje"
                      : productivityQuantitySourceRaw;
                  const productivityQuantitySourceOptions =
                    getT2QuantitySourceOptions(
                      productivityUnit,
                      familia?.codigo,
                    );
                  const productivityQuantitySource =
                    productivityQuantitySourceOptions.some(
                      (option) =>
                        option.value === normalizedProductivityQuantitySourceRaw,
                    )
                      ? normalizedProductivityQuantitySourceRaw
                      : getDefaultT2QuantitySource(
                          familia?.codigo,
                          productivityUnit,
                        );
                  const productivityUnitSuffix = getT2ProductivityUnitSuffix(
                    productivityUnit,
                    productivityQuantitySource,
                  );
                  const batchUnitSuffix = getT2BatchUnitSuffix(
                    productivityUnit,
                    productivityQuantitySource,
                  );
                  const soportaPasoManual =
                    familia?.relacionMaquinaSoportada.includes("M-0") ?? false;
                  const requiereMaquinaPrincipal =
                    cfg.modoTiempo === "T-3" ||
                    ((familia?.relacionMaquinaSoportada.includes("M-1") ??
                      false) &&
                      !soportaPasoManual);
                  const mostrarOverridesTiempo =
                    mostrarSetupCleanupOverrides || mostrarTiempoFijoOverride;
                  const nestingConfig = getNestingConfig(cfg.paramsPasoJson);
                  const modoColorConfig = getModoColorConfig(
                    cfg.paramsPasoJson,
                  );
                  const panelizadoConfig = getPanelizadoConfig(
                    cfg.paramsPasoJson,
                  );
                  const pliegoImpresionConfig = getPliegoImpresionConfig(
                    cfg.paramsPasoJson,
                  );
                  const nestingExtraMargins = getExtraMarginsConfig(
                    cfg.paramsPasoJson,
                  );
                  const pliegoImpresionPreset = getPliegoPresetValue(
                    pliegoImpresionConfig,
                  );
                  const pliegoImpresionEsPersonalizado =
                    pliegoImpresionPreset === "personalizado";
                  const pliegoImpresionEsAutomatico =
                    pliegoImpresionPreset === "automatico";
                  const pliegoCandidatos =
                    getPliegoCandidatos(pliegoImpresionConfig);
                  const nestingMargins = asRecord(nestingConfig.margins);
                  const nestingCosting = asRecord(nestingConfig.costing);
                  const nestingCostingStrategy =
                    typeof nestingCosting.strategy === "string"
                      ? nestingCosting.strategy
                      : "simple";
                  const nestingDefineCosteo =
                    mostrarNesting && nestingCostingStrategy !== "simple";
                  const multiplicadoresSoportados =
                    familia?.multiplicadoresSoportados ?? [];
                  const sustratoPrincipal = cfg.slotsMateriales?.find(
                    (slot) => slot.slotCodigo === "sustrato_principal",
                  );
                  const varianteSustrato = lookups.materiasPrimas
                    .flatMap((materia) => materia.variantes)
                    .find(
                      (variante) =>
                        variante.id === sustratoPrincipal?.materialVarianteId,
                    );
                  const attrsSustrato = asRecord(
                    varianteSustrato?.atributosVarianteJson,
                  );
                  const sustratoRolloDisponible =
                    varianteLooksLikeRoll(varianteSustrato) ||
                    (sustratoPrincipal?.candidatos ?? []).some((candidate) => {
                      const materiaPrima =
                        candidateMaterials[candidate.materiaPrimaId];
                      if (!materiaPrima) return false;
                      if (materiaPrimaLooksLikeRoll(materiaPrima)) return true;
                      const enabledVariantIds = new Set(candidate.varianteIds);
                      return materiaPrima.variantes.some((variante) => {
                        const enabled =
                          enabledVariantIds.size === 0 ||
                          enabledVariantIds.has(variante.id);
                        return enabled && varianteLooksLikeRoll(variante);
                      });
                    });
                  const sustratoAnchoLabel = formatMm(
                    attrsSustrato.anchoMm ?? attrsSustrato.widthMm,
                  );
                  const sustratoAltoLabel = formatMm(
                    attrsSustrato.largoMm ??
                      attrsSustrato.altoMm ??
                      attrsSustrato.heightMm,
                  );
                  const maquinaParaDefaults = maquinaSel?.parametrosTecnicosJson
                    ? maquinaSel
                    : configExistente?.maquinaM1?.id === cfg.maquinaM1Id &&
                        configExistente?.maquinaM1?.parametrosTecnicosJson
                      ? configExistente.maquinaM1
                      : (maquinaSel ?? configExistente?.maquinaM1);
                  const machineMargins = getMachineMargins(maquinaParaDefaults);
                  const mostrarModoColor = modoColorAplica(
                    familia?.codigo,
                    cfg,
                  );
                  const modoColorOptions = buildModoColorOptions(
                    maquinaGuardada,
                    configExistente,
                    ["impresion_por_hoja", "impresion_por_area"].includes(
                      paso.familiaCodigo,
                    ),
                  );
                  const modoColorAllowed = Array.isArray(
                    modoColorConfig.allowedModes,
                  )
                    ? modoColorConfig.allowedModes
                        .map((item) => normalizeModoColor(item))
                        .filter((item): item is string => item !== null)
                    : [];
                  const modoColorEnabled = modoColorConfig.enabled === true;
                  const modoColorPerfilDefault =
                    modosColorFromPerfil(perfilGuardado)[0] ?? "";
                  const modoColorEffectiveAllowed =
                    modoColorEnabled && modoColorAllowed.length > 0
                      ? modoColorAllowed.filter((mode) =>
                          modoColorOptions.some(
                            (option) => option.value === mode,
                          ),
                        )
                      : modoColorOptions.map((option) => option.value);
                  const modoColorDefaultOptions = modoColorOptions.filter(
                    (option) =>
                      modoColorEffectiveAllowed.includes(option.value),
                  );
                  const modoColorDefault =
                    modoColorDefaultOptions.find(
                      (option) => option.value === modoColorPerfilDefault,
                    )?.value ??
                    modoColorDefaultOptions[0]?.value ??
                    "";
                  const modoColorIsSelectable =
                    modoColorDefaultOptions.length > 1;
                  const modoColorSummary = !modoColorEnabled
                    ? modoColorOptions.length > 1
                      ? "Sin restricción: el comercial elige entre todos los modos compatibles."
                      : modoColorOptions.length === 1
                        ? `Sin restricción: se usa ${modoColorOptions[0]?.label} automáticamente.`
                        : "La máquina/perfil todavía no declara modos de color."
                    : modoColorIsSelectable
                      ? "El comercial elegirá entre los modos permitidos."
                      : `Modo fijo: ${
                          modoColorDefaultOptions[0]?.label ??
                          "sin modo disponible"
                        }.`;
                  const defaultSeparation = defaultNestingSeparationForFamily(
                    familia?.codigo,
                  );
                  const legacySeparationH = getResolvedNestingNumber(
                    nestingConfig.separationHMm,
                    undefined,
                    defaultSeparation,
                  );
                  const legacySeparationV = getResolvedNestingNumber(
                    nestingConfig.separationVMm,
                    undefined,
                    defaultSeparation,
                  );
                  const resolvedPieceBleed = getResolvedNestingNumber(
                    nestingConfig.pieceBleedMm,
                    Math.max(legacySeparationH, legacySeparationV) / 2,
                    0,
                  );
                  const mostrarPanelizado = panelizadoAplica(
                    familia?.codigo,
                    nestingConfig,
                    maquinaParaDefaults,
                    sustratoRolloDisponible,
                  );
                  const resolvedPanelMaxWidth = getDisplayPanelMaxWidth(
                    panelizadoConfig.maxPanelWidthMm,
                  );
                  const resolvedPanelOverlap = getResolvedNestingNumber(
                    panelizadoConfig.overlapMm,
                    undefined,
                    20,
                  );
                  const panelizadoMode =
                    panelizadoConfig.mode === "manual" ? "manual" : "automatic";
                  const panelizadoAxis =
                    panelizadoConfig.axis === "automatic" ||
                    panelizadoConfig.axis === "automatica"
                      ? "automatic"
                      : panelizadoConfig.axis === "horizontal"
                        ? "horizontal"
                        : panelizadoConfig.axis === "vertical"
                          ? "vertical"
                          : "automatic";
                  const panelizadoWidthInterpretation =
                    panelizadoConfig.widthInterpretation === "util"
                      ? "util"
                      : "total";
                  const panelManualLayout = readManualLayout(
                    panelizadoConfig.manualLayout,
                  );
                  const panelMeasures = getProductoPanelMeasures(producto);
                  const rollWidthForPanelMm =
                    readOptionalNumber(attrsSustrato.anchoMm) ??
                    readOptionalNumber(attrsSustrato.widthMm) ??
                    readOptionalNumber(
                      maquinaParaDefaults?.parametrosTecnicosJson
                        ?.anchoMaxRolloMm,
                    ) ??
                    readOptionalNumber(
                      maquinaParaDefaults?.parametrosTecnicosJson?.anchoMaxMm,
                    ) ??
                    readOptionalNumber(
                      maquinaParaDefaults?.parametrosTecnicosJson?.anchoUtil,
                    );
                  const printableWidthForPanelMm =
                    rollWidthForPanelMm != null
                      ? Math.max(
                          0,
                          rollWidthForPanelMm -
                            (machineMargins.leftMm ?? 0) -
                            (machineMargins.rightMm ?? 0),
                        )
                      : null;
                  const panelSummary =
                    panelizadoConfig.enabled === true
                      ? [
                          panelizadoMode === "manual" ? "Manual" : "Automático",
                          panelizadoAxis === "automatic"
                            ? "dirección automática"
                            : panelizadoAxis === "vertical"
                              ? "vertical"
                              : "horizontal",
                          `${resolvedPanelOverlap} mm solape`,
                          resolvedPanelMaxWidth > 0
                            ? `${resolvedPanelMaxWidth} mm máx.`
                            : "máx. ancho imprimible",
                        ].join(" · ")
                      : "";
                  const valBasico = noEjecutar
                    ? { errores: [], warnings: [] }
                    : validarBasico(cfg, familia);
                  const valMateriales = noEjecutar
                    ? { errores: [], warnings: [] }
                    : validarMateriales(cfg, familia);
                  const valAvanzado = noEjecutar
                    ? { errores: [], warnings: [] }
                    : validarAvanzado(
                        jsonText.params,
                        cantidadRelevante ? jsonText.mecanismo : "",
                        cfg,
                        familia ? { codigo: familia.codigo } : undefined,
                      );
                  const totalErrores =
                    valBasico.errores.length +
                    valMateriales.errores.length +
                    valAvanzado.errores.length;
                  const totalWarnings =
                    valBasico.warnings.length +
                    valMateriales.warnings.length +
                    valAvanzado.warnings.length;
                  const pasoTieneCambios = hasUnsavedChanges(paso.id);

                  return (
                    <React.Fragment key={paso.id}>
                      <div className="step-head">
                        <div style={{ flex: 1 }}>
                          <div className="pill-row">
                            <span
                              style={{
                                color: "var(--muted-text)",
                                fontFamily: "var(--font-mono)",
                                fontSize: 12,
                              }}
                            >
                              Paso {idx + 1} de{" "}
                              {rutaAlternativa.ruta.pasos.length}
                            </span>
                            {!noEjecutar ? (
                              <span
                                className={`tag ${totalErrores === 0 && totalWarnings === 0 ? "ok" : "warm"}`}
                              >
                                <span className="d" />
                                {totalErrores > 0
                                  ? `${totalErrores} error${totalErrores === 1 ? "" : "es"}`
                                  : totalWarnings > 0
                                    ? `${totalWarnings} pendiente${totalWarnings === 1 ? "" : "s"}`
                                    : configExistente
                                      ? "Configurado"
                                      : "Pendiente"}
                              </span>
                            ) : null}
                            <span className="tag muted">
                              {cfg.modoActivacion
                                ? getLabel(
                                    modoActivacionLabels,
                                    cfg.modoActivacion,
                                  ).label
                                : "Sin activación"}
                            </span>
                          </div>
                          <h1>{pasoLabel}</h1>
                          <div className="sub">
                            {maquinaGuardada ? (
                              <>
                                Máquina:{" "}
                                <strong
                                  style={{
                                    color: "var(--ink)",
                                    fontWeight: 500,
                                  }}
                                >
                                  {maquinaGuardada.nombre}
                                </strong>
                                {perfilGuardado ? (
                                  <> · perfil {perfilGuardado.nombre}</>
                                ) : null}
                              </>
                            ) : cfg.centroCostoId ? (
                              <>
                                Centro de costo:{" "}
                                <strong
                                  style={{
                                    color: "var(--ink)",
                                    fontWeight: 500,
                                  }}
                                >
                                  {lookups.centrosCosto.find(
                                    (centro) => centro.id === cfg.centroCostoId,
                                  )?.nombre ?? "Seleccionado"}
                                </strong>
                              </>
                            ) : (
                              "Sin centro asignado"
                            )}
                          </div>
                        </div>
                        <div className="pill-row">
                          <button
                            className="btn"
                            type="button"
                            onClick={goPrev}
                            disabled={idx === 0}
                          >
                            <ArrowLeftIcon className="size-4" />
                          </button>
                          <button
                            className="btn"
                            type="button"
                            onClick={goNext}
                            disabled={
                              idx === rutaAlternativa.ruta.pasos.length - 1
                            }
                          >
                            Siguiente →
                          </button>
                          <button
                            className="btn btn-primary"
                            type="button"
                            onClick={() => guardarPaso(paso.id)}
                            disabled={
                              guardando === paso.id ||
                              totalErrores > 0 ||
                              !pasoTieneCambios
                            }
                          >
                            {pasoTieneCambios ? (
                              <SaveIcon className="size-4" />
                            ) : (
                              <CheckIcon className="size-4" />
                            )}
                            {guardando === paso.id
                              ? "Guardando..."
                              : pasoTieneCambios
                                ? "Guardar paso"
                                : "Guardado"}
                          </button>
                        </div>
                      </div>

                      <div className="config-step-content pasos-sections">
                        <section className="section-block open">
                          <div className="sb-head">
                            <span className="num">01</span>
                            <span className="ttl">Activación</span>
                            <span className="hint">
                              Cuándo se ejecuta este paso al cotizar
                            </span>
                          </div>
                          <div className="sb-body">
                            <div className="wiz-grid">
                              <div className="field md:col-span-full">
                                <LabelConTooltip
                                  label="Nombre visible del paso"
                                  tooltip="Nombre operativo que verá comercial y producción. Si lo dejás vacío, se usa el nombre técnico de la familia."
                                />
                                <Input
                                  value={cfg.nombreVisible ?? ""}
                                  placeholder={
                                    familia?.nombre ?? paso.familiaCodigo
                                  }
                                  onChange={(event) =>
                                    updateConfig(paso.id, {
                                      nombreVisible: event.target.value || null,
                                    })
                                  }
                                />
                              </div>
                              <div className="field">
                                <label>Cuándo se ejecuta</label>
                                <div className="segmented">
                                  {opcionesActivacion.map((option) => (
                                    <button
                                      key={option.value}
                                      type="button"
                                      className={
                                        cfg.modoActivacion === option.value
                                          ? "on"
                                          : ""
                                      }
                                      onClick={() =>
                                        updateConfig(paso.id, {
                                          modoActivacion: option.value,
                                        })
                                      }
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                                <span className="help">
                                  No ejecutar apaga este paso solo para esta
                                  ruta del producto.
                                </span>
                              </div>
                              <div className="field">
                                <label>Multiplicadores</label>
                                <div className="chip-row">
                                  {multiplicadoresSoportados.length > 0 ? (
                                    multiplicadoresSoportados.map(
                                      (multiplicador) => {
                                        const activo =
                                          cfg.multiplicadoresActivos?.includes(
                                            multiplicador,
                                          );
                                        return (
                                          <button
                                            key={multiplicador}
                                            type="button"
                                            className={`tag mono ${activo ? "active" : "muted dashed"}`}
                                            onClick={() =>
                                              toggleMultiplicador(
                                                paso.id,
                                                multiplicador,
                                              )
                                            }
                                            title={
                                              multiplicador === "caras"
                                                ? "Duplica tiempo y consumibles de máquina cuando el comercial elige doble faz. Los materiales se duplican por slot."
                                                : "Activa o desactiva este multiplicador para el paso."
                                            }
                                          >
                                            {multiplicador}
                                          </button>
                                        );
                                      },
                                    )
                                  ) : (
                                    <span className="tag muted dashed">
                                      Sin multiplicadores
                                    </span>
                                  )}
                                </div>
                                <span className="help">
                                  Variables que multiplican el tiempo del paso.
                                  En materiales, caras se define por slot.
                                </span>
                              </div>
                              {cfg.modoActivacion === "CONDICIONAL" && (
                                <div className="md:col-span-full">
                                  <RuleBuilder
                                    value={
                                      cfg.condicionActivacionJson as
                                        | Record<string, unknown>
                                        | null
                                        | undefined
                                    }
                                    includeMeasureFields={
                                      producto.modoMedidas === "LIBRE" ||
                                      producto.modoMedidas === "MIXTA"
                                    }
                                    extraFields={technologyRuleFields}
                                    onChange={(value) =>
                                      updateConfig(paso.id, {
                                        condicionActivacionJson: value,
                                      })
                                    }
                                  />
                                </div>
                              )}
                            </div>
                            {(valBasico.errores.length > 0 ||
                              valBasico.warnings.length > 0) && (
                              <ListaValidacion validacion={valBasico} />
                            )}
                          </div>
                        </section>

                        {!noEjecutar && (
                          <>
                            <section className="section-block open">
                              <div className="sb-head">
                                <span className="num">02</span>
                                <span className="ttl">Tiempo y costo</span>
                                <span className="chev">›</span>
                              </div>
                              <div className="sb-body">
                                <div className="wiz-grid">
                                  <div className="field">
                                    <LabelConTooltip
                                      label="¿Cómo se calcula el tiempo?"
                                      tooltip="Define la base del cálculo: tiempo fijo, productividad propia, productividad de máquina, o input manual del comercial."
                                    />
                                    <HumanSelect
                                      value={cfg.modoTiempo ?? ""}
                                      onValueChange={(v) =>
                                        updateConfig(paso.id, {
                                          modoTiempo: v || null,
                                        })
                                      }
                                      options={opcionesTiempo}
                                      placeholder="Elegir"
                                    />
                                  </div>
                                  <div className="field">
                                    <LabelConTooltip
                                      label="Centro de costo"
                                      tooltip="Centro horario usado para calcular la tarifa de este paso."
                                    />
                                    {cfg.maquinaM1Id ? (
                                      <div className="control select">
                                        <span>
                                          {maquinaGuardada?.centroCostoPrincipal
                                            ?.nombre ??
                                            "Centro heredado de máquina"}
                                        </span>
                                      </div>
                                    ) : (
                                      <HumanSelect
                                        value={cfg.centroCostoId ?? ""}
                                        onValueChange={(v) =>
                                          updateConfig(paso.id, {
                                            centroCostoId: v || null,
                                          })
                                        }
                                        options={centroCostoOptions}
                                        placeholder={
                                          lookups.centrosCosto.length === 0
                                            ? "No hay centros horarios activos"
                                            : "Elegir centro horario"
                                        }
                                      />
                                    )}
                                  </div>
                                  {mostrarTiempoFijoOverride && (
                                    <div className="field">
                                      <LabelConTooltip
                                        label={
                                          <>
                                            Tiempo fijo override{" "}
                                            <span className="hint">
                                              opcional
                                            </span>
                                          </>
                                        }
                                        tooltip="Sólo aplica en pasos sin máquina con tiempo fijo."
                                        iconSize="sm"
                                      />
                                      <Input
                                        type="number"
                                        min={0}
                                        step={0.5}
                                        value={cfg.tiempoFijoOverrideMin ?? ""}
                                        onChange={(e) =>
                                          updateConfig(paso.id, {
                                            tiempoFijoOverrideMin:
                                              e.target.value === ""
                                                ? null
                                                : Number(e.target.value),
                                          })
                                        }
                                        placeholder="—"
                                      />
                                    </div>
                                  )}
                                  {mostrarProductividadPropia && (
                                    <div className="field md:col-span-full">
                                      <LabelConTooltip
                                        label="Ritmo de trabajo manual"
                                        tooltip="Usalo para pasos manuales o externos que no dependen de una máquina. Podés cargar una productividad por hora o un tiempo por lote, por ejemplo 2 pliegos cada 1 minuto."
                                        iconSize="sm"
                                      />
                                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                        <div className="space-y-1">
                                          <span className="text-muted-foreground text-xs">
                                            Cómo querés cargar el ritmo
                                          </span>
                                          <HumanSelect
                                            value={timeCalculationMode}
                                            onValueChange={(value) =>
                                              updateStepParams(paso.id, {
                                                timeCalculationMode:
                                                  value ||
                                                  getDefaultT2TimeCalculationMode(
                                                    familia?.codigo,
                                                  ),
                                              })
                                            }
                                            options={
                                              T2_TIME_CALCULATION_MODE_OPTIONS
                                            }
                                            placeholder="Elegir forma"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <LabelConTooltip
                                            label="Tiempo fijo estimado"
                                            tooltip="Si completás este campo, el motor usa ese tiempo y no calcula por ritmo."
                                            iconSize="sm"
                                          />
                                          <div className="flex items-center gap-2">
                                            <Input
                                              type="number"
                                              min={0}
                                              step={0.25}
                                              value={horasEstimadasPaso ?? ""}
                                              onChange={(event) =>
                                                updateStepParams(paso.id, {
                                                  horasEstimadas:
                                                    event.target.value === ""
                                                      ? null
                                                      : Number(
                                                          event.target.value,
                                                        ),
                                                })
                                              }
                                              placeholder="Opcional"
                                            />
                                            <span className="text-muted-foreground whitespace-nowrap text-xs">
                                              h
                                            </span>
                                          </div>
                                        </div>
                                        {timeCalculationMode ===
                                        "batch_time" ? (
                                          <>
                                            <div className="space-y-1">
                                              <span className="text-muted-foreground text-xs">
                                                Tiempo del lote
                                              </span>
                                              <div className="flex items-center gap-2">
                                                <Input
                                                  type="number"
                                                  min={0}
                                                  step={0.25}
                                                  value={batchTimeMin ?? ""}
                                                  onChange={(event) =>
                                                    updateStepParams(paso.id, {
                                                      batchTimeMin:
                                                        event.target.value ===
                                                        ""
                                                          ? null
                                                          : Number(
                                                              event.target
                                                                .value,
                                                            ),
                                                    })
                                                  }
                                                  placeholder="Ej. 1"
                                                />
                                                <span className="text-muted-foreground whitespace-nowrap text-xs">
                                                  min
                                                </span>
                                              </div>
                                            </div>
                                            <div className="space-y-1">
                                              <span className="text-muted-foreground text-xs">
                                                Tamaño del lote
                                              </span>
                                              <div className="flex items-center gap-2">
                                                <Input
                                                  type="number"
                                                  min={0}
                                                  step={
                                                    productivityUnit ===
                                                    "unidades_h"
                                                      ? 1
                                                      : 0.25
                                                  }
                                                  value={batchSize ?? ""}
                                                  onChange={(event) =>
                                                    updateStepParams(paso.id, {
                                                      batchSize:
                                                        event.target.value ===
                                                        ""
                                                          ? null
                                                          : Number(
                                                              event.target
                                                                .value,
                                                            ),
                                                    })
                                                  }
                                                  placeholder={
                                                    productivityUnit ===
                                                    "unidades_h"
                                                      ? "Ej. 1"
                                                      : "Ej. 2"
                                                  }
                                                />
                                                <span className="text-muted-foreground whitespace-nowrap text-xs">
                                                  {batchUnitSuffix}
                                                </span>
                                              </div>
                                            </div>
                                          </>
                                        ) : (
                                          <div className="space-y-1 md:col-span-full">
                                              <span className="text-muted-foreground text-xs">
                                              Productividad por hora
                                            </span>
                                            <div className="flex items-center gap-2">
                                              <Input
                                                type="number"
                                                min={0}
                                                step={1}
                                                value={
                                                  productividadPropia ?? ""
                                                }
                                                onChange={(event) =>
                                                  updateStepParams(paso.id, {
                                                    productivityValue:
                                                      event.target.value === ""
                                                        ? null
                                                        : Number(
                                                            event.target.value,
                                                          ),
                                                  })
                                                }
                                                placeholder="Ej. 500"
                                              />
                                              <span className="text-muted-foreground whitespace-nowrap text-xs">
                                                {productivityUnitSuffix}
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                        <div className="space-y-1">
                                          <span className="text-muted-foreground text-xs">
                                            Unidad de productividad
                                          </span>
                                          <HumanSelect
                                            value={productivityUnit}
                                            onValueChange={(value) => {
                                              const nextUnit =
                                                value ||
                                                getDefaultT2ProductivityUnit(
                                                  familia?.codigo,
                                                );
                                              updateStepParams(paso.id, {
                                                productivityUnit: nextUnit,
                                                productivityQuantitySource:
                                                  getDefaultT2QuantitySource(
                                                    familia?.codigo,
                                                    nextUnit,
                                                  ),
                                              });
                                            }}
                                            options={
                                              T2_PRODUCTIVITY_UNIT_OPTIONS
                                            }
                                            placeholder="Elegir unidad"
                                          />
                                        </div>
                                        {cantidadRelevante && (
                                          <div className="space-y-1">
                                            <span className="text-muted-foreground text-xs">
                                              Cantidad operativa del paso
                                            </span>
                                            <HumanSelect
                                              value={cfg.mecanismoCantidad ?? ""}
                                              onValueChange={(v) =>
                                                updateConfig(paso.id, {
                                                  mecanismoCantidad: v || null,
                                                })
                                              }
                                              options={opcionesCantidad}
                                              placeholder="Elegir"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {mostrarProductividadPropia && (
                                    <div className="field">
                                      <LabelConTooltip
                                        label="Calcular tiempo según"
                                        tooltip="Define qué magnitud cronometra la productividad: cantidad efectiva, área, metros lineales o perímetro."
                                      />
                                      <HumanSelect
                                        value={productivityQuantitySource}
                                        onValueChange={(value) =>
                                          updateStepParams(paso.id, {
                                            productivityQuantitySource:
                                              value ||
                                              getDefaultT2QuantitySource(
                                                familia?.codigo,
                                                productivityUnit,
                                              ),
                                          })
                                        }
                                        options={productivityQuantitySourceOptions}
                                        placeholder="Elegir fuente"
                                      />
                                    </div>
                                  )}
                                  {familia?.codigo ===
                                    "montaje_sobre_sustrato" && (
                                    <div className="field">
                                      <LabelConTooltip
                                        label="Piezas a montar"
                                        tooltip="Define qué medidas usa el paso para calcular el nesting del material de montaje."
                                      />
                                      <HumanSelect
                                        value={String(
                                          paramsPaso.fuentePiezasMontaje ??
                                            "piezas_jobcontext",
                                        )}
                                        onValueChange={(value) =>
                                          updateStepParams(paso.id, {
                                            fuentePiezasMontaje:
                                              value || "piezas_jobcontext",
                                          })
                                        }
                                        options={MONTAJE_SOURCE_OPTIONS}
                                        placeholder="Elegir origen"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </section>

                            {familia &&
                              familia.relacionMaquinaSoportada.includes(
                                "M-1",
                              ) && (
                                <section className="section-block open">
                                  <div className="sb-head">
                                    <span className="num">03</span>
                                    <span className="ttl">
                                      Máquina y perfil
                                    </span>
                                    <span className="chev">›</span>
                                  </div>
                                  <div className="sb-body">
                                    <div className="wiz-grid">
                                      <div className="field">
                                        <LabelConTooltip
                                          label={
                                            <>
                                              Máquina principal{" "}
                                              {requiereMaquinaPrincipal ? (
                                                <span className="req">*</span>
                                              ) : null}
                                            </>
                                          }
                                          tooltip={
                                            requiereMaquinaPrincipal
                                              ? "Máquina del taller que ejecuta este paso. La lista filtra por compatibilidad con la familia."
                                              : "Opcional. Dejala sin asignar si este paso se ejecuta manualmente y usa centro de costo."
                                          }
                                          required={requiereMaquinaPrincipal}
                                        />
                                        <HumanSelect
                                          value={cfg.maquinaM1Id ?? ""}
                                          onValueChange={(v) =>
                                            updateConfig(paso.id, {
                                              maquinaM1Id: v || null,
                                              perfilM1Id: null,
                                              centroCostoId: null,
                                            })
                                          }
                                          options={maquinaOptions}
                                          placeholder={
                                            maquinasCompatibles.length === 0
                                              ? "No hay máquinas compatibles"
                                              : "Sin asignar"
                                          }
                                        />
                                      </div>
                                      {maquinaSel || perfilGuardado ? (
                                        <div className="field">
                                          <LabelConTooltip
                                            label="Perfil default de la máquina"
                                            tooltip="Perfil operativo base. Si el modo de color comercial está activo, el motor usa automáticamente un perfil compatible con el color elegido o default."
                                          />
                                          <HumanSelect
                                            value={cfg.perfilM1Id ?? ""}
                                            onValueChange={(v) =>
                                              updateConfig(paso.id, {
                                                perfilM1Id: v || null,
                                              })
                                            }
                                            disabled={!maquinaSel}
                                            options={perfilOptions}
                                            placeholder={
                                              maquinaSel
                                                ? "Elegir"
                                                : "Elegí máquina primero"
                                            }
                                          />
                                        </div>
                                      ) : null}
                                      {soportaM2 ? (
                                        <div className="field md:col-span-full">
                                          <LabelConTooltip
                                            label="Tecnologías / máquinas candidatas"
                                            tooltip="Máquinas que este producto puede usar para este paso. En la OT el comercial elegirá tecnología; si una tecnología tiene una sola máquina, no se muestra selector de máquina."
                                          />
                                          <div className="space-y-2 rounded-md border bg-background/70 p-3">
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                              <span>
                                                {candidatasCfg.length === 0
                                                  ? "Sin candidatas configuradas."
                                                  : `${candidatasCfg.length} máquina${candidatasCfg.length === 1 ? "" : "s"} · ${tecnologiasCandidatas.length} tecnología${tecnologiasCandidatas.length === 1 ? "" : "s"}`}
                                              </span>
                                              {candidataPreferidaId ? (
                                                <span className="tag muted">
                                                  Preferida:{" "}
                                                  {lookups.maquinas.find(
                                                    (maquina) =>
                                                      maquina.id ===
                                                      candidataPreferidaId,
                                                  )?.nombre ?? "sin máquina"}
                                                </span>
                                              ) : null}
                                            </div>
                                            {maquinasCandidatasCompatibles.length ===
                                            0 ? (
                                              <p className="text-xs text-muted-foreground">
                                                No hay máquinas compatibles con
                                                perfiles activos para esta
                                                familia.
                                              </p>
                                            ) : (
                                              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                                {maquinasCandidatasCompatibles.map(
                                                  (maquina) => {
                                                    const selected =
                                                      candidatasSeleccionadas.has(
                                                        maquina.id,
                                                      );
                                                    const preferred =
                                                      selected &&
                                                      candidataPreferidaId ===
                                                        maquina.id;
                                                    const candidataCfg =
                                                      candidatasCfg.find(
                                                        (candidata) =>
                                                          candidata.maquinaId ===
                                                          maquina.id,
                                                      );
                                                    const perfilesCompatibles =
                                                      maquina.perfilesOperativos.filter(
                                                        (perfil) =>
                                                          perfilCompatibleConFamilia(
                                                            paso.familiaCodigo,
                                                            perfil,
                                                          ),
                                                      );
                                                    return (
                                                      <div
                                                        key={maquina.id}
                                                        className={`grid gap-2 rounded-md border bg-white px-3 py-2 text-xs ${
                                                          selected
                                                            ? "border-foreground/40"
                                                            : ""
                                                        }`}
                                                      >
                                                        <div className="flex items-center gap-3">
                                                          <input
                                                            type="checkbox"
                                                            checked={selected}
                                                            onChange={(event) =>
                                                              toggleMaquinaCandidata(
                                                                paso.id,
                                                                maquina.id,
                                                                event.target
                                                                  .checked,
                                                              )
                                                            }
                                                          />
                                                          <div className="min-w-0 flex-1">
                                                            <div className="truncate font-medium text-foreground">
                                                              {maquina.nombre}
                                                            </div>
                                                            <div className="truncate text-muted-foreground">
                                                              {machineTechnologyLabel(
                                                                maquina,
                                                              )}{" "}
                                                              · {maquina.codigo}
                                                            </div>
                                                          </div>
                                                          <button
                                                            type="button"
                                                            className={`grid size-8 place-items-center rounded border ${
                                                              preferred
                                                                ? "border-foreground bg-foreground text-background"
                                                                : "bg-background text-muted-foreground"
                                                            }`}
                                                            disabled={!selected}
                                                            title="Marcar como preferida"
                                                            onClick={() =>
                                                              setMaquinaCandidataPreferida(
                                                                paso.id,
                                                                maquina.id,
                                                              )
                                                            }
                                                          >
                                                            <StarIcon
                                                              className="size-4"
                                                              fill={
                                                                preferred
                                                                  ? "currentColor"
                                                                  : "none"
                                                              }
                                                            />
                                                          </button>
                                                        </div>
                                                        {selected ? (
                                                          <div className="grid gap-1">
                                                            <span className="text-[11px] font-medium text-muted-foreground">
                                                              Perfil default
                                                            </span>
                                                            <select
                                                              className="h-8 rounded-md border bg-background px-2 text-xs"
                                                              value={
                                                                candidataCfg?.perfilDefaultId ??
                                                                ""
                                                              }
                                                              onChange={(
                                                                event,
                                                              ) =>
                                                                setMaquinaCandidataPerfilDefault(
                                                                  paso.id,
                                                                  maquina.id,
                                                                  event.target
                                                                    .value ||
                                                                    null,
                                                                )
                                                              }
                                                            >
                                                              <option value="">
                                                                Primer perfil
                                                                compatible
                                                              </option>
                                                              {perfilesCompatibles.map(
                                                                (perfil) => (
                                                                  <option
                                                                    key={
                                                                      perfil.id
                                                                    }
                                                                    value={
                                                                      perfil.id
                                                                    }
                                                                  >
                                                                    {
                                                                      perfil.nombre
                                                                    }
                                                                  </option>
                                                                ),
                                                              )}
                                                            </select>
                                                          </div>
                                                        ) : null}
                                                        {selected &&
                                                        mostrarModoColor ? (
                                                          <div className="grid gap-1">
                                                            <span className="text-[11px] font-medium text-muted-foreground">
                                                              Modos de color
                                                              habilitados
                                                            </span>
                                                            {(() => {
                                                              const candidateModoOptions =
                                                                buildModoColorOptions(
                                                                  maquina,
                                                                  null,
                                                                  true,
                                                                );
                                                              const candidateAllowed =
                                                                resolveModoColorAllowedModes(
                                                                  candidataCfg?.modoColorAllowedModes,
                                                                  candidateModoOptions,
                                                                );
                                                              return candidateModoOptions.length ===
                                                                0 ? (
                                                                <p className="text-[11px] text-muted-foreground">
                                                                  Esta máquina
                                                                  todavía no
                                                                  declara modos
                                                                  de color en
                                                                  sus perfiles.
                                                                </p>
                                                              ) : (
                                                                <div
                                                                  className={`segmented w-full text-[11px] ${
                                                                    candidateModoOptions.length >
                                                                    2
                                                                      ? "segmented-grid-2"
                                                                      : ""
                                                                  }`}
                                                                >
                                                                  {candidateModoOptions.map(
                                                                    (
                                                                      option,
                                                                    ) => {
                                                                      const optionSelected =
                                                                        candidateAllowed.includes(
                                                                          option.value,
                                                                        );
                                                                      const nextAllowed =
                                                                        optionSelected
                                                                          ? candidateAllowed.filter(
                                                                              (
                                                                                item,
                                                                              ) =>
                                                                                item !==
                                                                                option.value,
                                                                            )
                                                                          : [
                                                                              ...candidateAllowed,
                                                                              option.value,
                                                                            ];
                                                                      const safeNextAllowed =
                                                                        nextAllowed.length >
                                                                        0
                                                                          ? nextAllowed
                                                                          : [
                                                                              option.value,
                                                                            ];
                                                                      return (
                                                                        <button
                                                                          key={
                                                                            option.value
                                                                          }
                                                                          type="button"
                                                                          className={
                                                                            optionSelected
                                                                              ? "on"
                                                                              : ""
                                                                          }
                                                                          onClick={() =>
                                                                            setMaquinaCandidataModoColorAllowed(
                                                                              paso.id,
                                                                              maquina.id,
                                                                              safeNextAllowed,
                                                                            )
                                                                          }
                                                                          title={
                                                                            option.code
                                                                          }
                                                                        >
                                                                          {
                                                                            option.label
                                                                          }
                                                                        </button>
                                                                      );
                                                                    },
                                                                  )}
                                                                </div>
                                                              );
                                                            })()}
                                                            <span className="text-[11px] text-muted-foreground">
                                                              Si queda más de un
                                                              modo, el comercial
                                                              elige al agregar
                                                              el producto.
                                                            </span>
                                                          </div>
                                                        ) : null}
                                                      </div>
                                                    );
                                                  },
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ) : null}
                                      {mostrarModoColor &&
                                      (!soportaM2 ||
                                        candidatasCfg.length === 0) ? (
                                        <div className="field md:col-span-full">
                                          <LabelConTooltip
                                            label="Modo de color del producto"
                                            tooltip="Define si este producto usa todos los modos compatibles de la ruta/máquina o si limita modos específicos para cotizar."
                                          />
                                          <div className="space-y-3 rounded border bg-background/70 p-3">
                                            <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                                              {modoColorConfig.enabled ===
                                              true ? (
                                                <span>
                                                  Este producto{" "}
                                                  <strong className="text-foreground">
                                                    limita
                                                  </strong>{" "}
                                                  los modos de color que se
                                                  pueden cotizar. Si queda más
                                                  de un modo permitido, el
                                                  comercial deberá elegir al
                                                  agregar el producto.
                                                </span>
                                              ) : (
                                                <span>
                                                  Sin configuración propia: el
                                                  comercial verá todos los modos
                                                  de color compatibles con la
                                                  ruta, máquina y perfiles
                                                  disponibles.
                                                </span>
                                              )}
                                            </div>
                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.3fr)]">
                                              <label className="flex items-start gap-2 rounded-md border bg-white px-3 py-2 text-xs">
                                                <input
                                                  className="mt-0.5"
                                                  type="checkbox"
                                                  checked={
                                                    modoColorConfig.enabled ===
                                                    true
                                                  }
                                                  onChange={(e) =>
                                                    updateModoColorConfig(
                                                      paso.id,
                                                      {
                                                        enabled:
                                                          e.target.checked,
                                                        comercialElige: e.target
                                                          .checked
                                                          ? modoColorDefaultOptions.length >
                                                            1
                                                          : null,
                                                        defaultMode:
                                                          e.target.checked &&
                                                          !modoColorDefault
                                                            ? (modoColorDefaultOptions[0]
                                                                ?.value ?? null)
                                                            : modoColorDefault ||
                                                              null,
                                                      },
                                                    )
                                                  }
                                                />
                                                <span className="space-y-0.5">
                                                  <span className="block font-medium text-foreground">
                                                    Definir modos para este
                                                    producto
                                                  </span>
                                                  <span className="block text-muted-foreground">
                                                    Restringe las opciones
                                                    disponibles en Agregar
                                                    producto.
                                                  </span>
                                                </span>
                                              </label>
                                              <div className="space-y-2 rounded-md border bg-white px-3 py-2">
                                                <LabelConTooltip
                                                  label="Modos de color"
                                                  tooltip="Los modos salen de los perfiles de la máquina. Si hay más de uno permitido, el comercial elegirá al cotizar."
                                                  iconSize="sm"
                                                />
                                                {modoColorOptions.length ===
                                                0 ? (
                                                  <p className="text-xs text-muted-foreground">
                                                    La máquina/perfil todavía no
                                                    declara modos de color.
                                                  </p>
                                                ) : (
                                                  <div
                                                    className={`segmented w-full ${
                                                      modoColorOptions.length >
                                                      2
                                                        ? "segmented-grid-2"
                                                        : ""
                                                    }`}
                                                  >
                                                    {modoColorOptions.map(
                                                      (option) => {
                                                        const selected =
                                                          modoColorEffectiveAllowed.includes(
                                                            option.value,
                                                          );
                                                        const nextAllowed =
                                                          selected
                                                            ? modoColorEffectiveAllowed.filter(
                                                                (item) =>
                                                                  item !==
                                                                  option.value,
                                                              )
                                                            : [
                                                                ...modoColorEffectiveAllowed,
                                                                option.value,
                                                              ];
                                                        const safeNextAllowed =
                                                          nextAllowed.length > 0
                                                            ? nextAllowed
                                                            : [option.value];
                                                        const nextDefault =
                                                          safeNextAllowed.includes(
                                                            modoColorPerfilDefault,
                                                          )
                                                            ? modoColorPerfilDefault
                                                            : safeNextAllowed[0];
                                                        return (
                                                          <button
                                                            key={option.value}
                                                            type="button"
                                                            className={
                                                              selected
                                                                ? "on"
                                                                : ""
                                                            }
                                                            disabled={
                                                              !modoColorEnabled
                                                            }
                                                            onClick={() => {
                                                              updateModoColorConfig(
                                                                paso.id,
                                                                {
                                                                  enabled: true,
                                                                  allowedModes:
                                                                    safeNextAllowed.length ===
                                                                      modoColorOptions.length &&
                                                                    !safeNextAllowed.includes(
                                                                      "SIN_IMPRESION",
                                                                    )
                                                                      ? null
                                                                      : safeNextAllowed,
                                                                  defaultMode:
                                                                    nextDefault,
                                                                  comercialElige:
                                                                    safeNextAllowed.length >
                                                                    1,
                                                                },
                                                              );
                                                            }}
                                                            title={option.code}
                                                          >
                                                            {option.label}
                                                          </button>
                                                        );
                                                      },
                                                    )}
                                                  </div>
                                                )}
                                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                  <span>
                                                    {modoColorSummary}
                                                  </span>
                                                  {modoColorDefault ? (
                                                    <span className="tag muted">
                                                      Default por perfil:{" "}
                                                      {modoColorOptions.find(
                                                        (option) =>
                                                          option.value ===
                                                          modoColorDefault,
                                                      )?.label ??
                                                        modoColorDefault}
                                                    </span>
                                                  ) : null}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </section>
                              )}

                            {/* ── TAB MATERIALES ───────────────────────────────────── */}
                            {familia && (
                              <section className="section-block open">
                                <div className="sb-head">
                                  <span className="num">
                                    {familia.relacionMaquinaSoportada.includes(
                                      "M-1",
                                    )
                                      ? "04"
                                      : "03"}
                                  </span>
                                  <span className="ttl">Materiales</span>
                                  <span className="hint">
                                    {!requiereMateriales
                                      ? "Sin materiales en este paso"
                                      : slotsManuales.length === 0
                                        ? "Automáticos por máquina"
                                        : `${slotsManuales.length} slot(s)`}
                                  </span>
                                </div>
                                <div className="sb-body space-y-3">
                                  {!requiereMateriales ? (
                                    <p className="material-empty">
                                      Este paso no requiere materiales.{" "}
                                      <button
                                        type="button"
                                        className="slot-link"
                                      >
                                        Agregar slot
                                      </button>
                                    </p>
                                  ) : (
                                    <>
                                      <div className="flex items-center justify-between gap-2">
                                        <LabelConTooltip
                                          label={
                                            <>
                                              <PackageIcon className="mr-1 inline size-3" />
                                              Materiales que consume el paso
                                            </>
                                          }
                                          tooltip="Cada slot es un tipo de material que el paso necesita (papel, tinta, film, etc.). Podés definir si el material es fijo, lo elige el comercial, o lo elige el sistema automáticamente."
                                        />
                                        <div className="flex flex-wrap gap-1">
                                          {slotsManuales.map((slot) => {
                                            const yaExiste =
                                              cfg.slotsMateriales?.some(
                                                (s) =>
                                                  s.slotCodigo === slot.codigo,
                                              );
                                            if (yaExiste) return null;
                                            return (
                                              <Button
                                                key={slot.codigo}
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                  addSlotFromFamilia(
                                                    paso.id,
                                                    slot.codigo,
                                                  )
                                                }
                                                className="h-7 text-xs"
                                              >
                                                + {slot.nombre}
                                                {slot.requerido && (
                                                  <span className="text-red-500">
                                                    *
                                                  </span>
                                                )}
                                              </Button>
                                            );
                                          })}
                                          {familia?.permiteSlotsAdicionales ? (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() =>
                                                addSlotAdicional(paso.id)
                                              }
                                              className="h-7 text-xs"
                                            >
                                              + Agregar componente
                                            </Button>
                                          ) : null}
                                        </div>
                                      </div>

                                      {slotsAutomaticos.length > 0 && (
                                        <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                                          <div className="font-medium text-foreground">
                                            Consumibles automáticos por
                                            máquina/perfil
                                          </div>
                                          <div>
                                            {slotsAutomaticos
                                              .map((slot) =>
                                                slotNombre(
                                                  slot.codigo,
                                                  familia,
                                                ),
                                              )
                                              .join(" · ")}
                                          </div>
                                          <div>
                                            Se configuran en Maquinaria. El
                                            motor toma tinta, tóner o barniz
                                            desde la máquina y el perfil
                                            seleccionado.
                                          </div>
                                        </div>
                                      )}

                                      {(cfg.slotsMateriales ?? []).length ===
                                        0 && (
                                        <p className="text-muted-foreground py-4 text-center text-xs italic">
                                          {slotsManuales.length > 0
                                            ? "Sin slots configurados. Agregá uno con los botones de arriba."
                                            : familia?.permiteSlotsAdicionales
                                              ? "Sin componentes configurados. Agregá uno con el botón de arriba."
                                              : "No hay materiales manuales para configurar en este paso."}
                                        </p>
                                      )}

                                      {(cfg.slotsMateriales ?? []).map(
                                        (slot, slotIdx) => {
                                          const slotDecl =
                                            familia.slotsRequeridos.find(
                                              (sr) =>
                                                sr.codigo === slot.slotCodigo,
                                            );
                                          const esSlotAdicional = !slotDecl;
                                          if (
                                            slotDecl &&
                                            isConsumibleMaquinaSlot(slotDecl)
                                          ) {
                                            return (
                                              <div
                                                key={slotIdx}
                                                className="rounded border border-dashed bg-muted/20 p-2 text-xs text-muted-foreground"
                                              >
                                                {slotNombre(
                                                  slot.slotCodigo,
                                                  familia,
                                                )}{" "}
                                                se resolverá automáticamente
                                                desde Maquinaria.
                                              </div>
                                            );
                                          }
                                          const selectedCandidates =
                                            slot.candidatos ?? [];
                                          const slotUiKey = `${paso.id}:${slot.slotCodigo}:${slotIdx}`;
                                          const persistedSlot =
                                            configExistente?.slotsMateriales.find(
                                              (storedSlot) =>
                                                storedSlot.slotCodigo ===
                                                slot.slotCodigo,
                                            );
                                          const persistedHardcoded =
                                            getPersistedCandidateMaterialVariant(
                                              persistedSlot?.candidatos ?? [],
                                              slot.materialVarianteId,
                                            );
                                          const storedMaterialVariante =
                                            persistedSlot?.materialVariante ?? null;
                                          const persistedMaterialVariante =
                                            storedMaterialVariante?.id ===
                                            slot.materialVarianteId
                                              ? storedMaterialVariante
                                              : null;
                                          const persistedMaterialMateria =
                                            persistedMaterialVariante
                                              ? materialVariantToBusquedaItem(
                                                  persistedMaterialVariante,
                                                )
                                              : null;
                                          const selectedHardcodedMaterialId =
                                            hardcodedMaterialSelections[
                                              slotUiKey
                                            ] ??
                                            persistedMaterialMateria?.id ??
                                            persistedHardcoded?.materiaPrima.id ??
                                            null;
                                          const hardcodedMateria =
                                            Object.values(candidateMaterials).find(
                                              (materiaPrima) =>
                                                materiaPrima.variantes.some(
                                                  (variante) =>
                                                    variante.id ===
                                                    slot.materialVarianteId,
                                                ),
                                            ) ??
                                            (selectedHardcodedMaterialId
                                              ? (candidateMaterials[
                                                  selectedHardcodedMaterialId
                                                ] ?? null)
                                              : null) ??
                                            persistedMaterialMateria ??
                                            persistedHardcoded?.materiaPrima ??
                                            null;
                                          const hardcodedVariante =
                                            hardcodedMateria?.variantes.find(
                                              (variante) =>
                                                variante.id ===
                                                slot.materialVarianteId,
                                            ) ??
                                            (persistedMaterialMateria
                                              ?.variantes[0] ??
                                              null) ??
                                            persistedHardcoded?.variante ??
                                            null;
                                          const hardcodedVarianteLabel =
                                            hardcodedMateria &&
                                            hardcodedVariante
                                              ? varianteOptionFromBusqueda(
                                                  hardcodedMateria,
                                                  hardcodedVariante,
                                                ).label
                                              : (getPersistedCandidateVariantLabel(
                                                  persistedSlot?.candidatos ??
                                                    [],
                                                  slot.materialVarianteId,
                                                ) ??
                                                (slot.materialVarianteId
                                                  ? slot.materialVarianteId
                                                  : "Sin seleccionar"));
                                          return (
                                            <div
                                              key={slotIdx}
                                              className="bg-muted/30 space-y-2 rounded border p-2"
                                            >
                                              <div className="flex items-center justify-between">
                                                <Badge
                                                  variant="outline"
                                                  title={slot.slotCodigo}
                                                >
                                                  {slotDisplayName(slot, familia)}
                                                </Badge>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 px-2 text-red-600"
                                                  onClick={() =>
                                                    removeSlot(paso.id, slotIdx)
                                                  }
                                                >
                                                  ×
                                                </Button>
                                              </div>
                                              {esSlotAdicional ? (
                                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                                  <div className="space-y-1">
                                                    <LabelConTooltip
                                                      label="Nombre del componente"
                                                      tooltip="Nombre operativo que identifica este componente o accesorio dentro del paso."
                                                    />
                                                    <Input
                                                      value={
                                                        slot.slotNombre ?? ""
                                                      }
                                                      onChange={(event) =>
                                                        updateSlot(
                                                          paso.id,
                                                          slotIdx,
                                                          {
                                                            slotNombre:
                                                              event.target
                                                                .value || null,
                                                          },
                                                        )
                                                      }
                                                      placeholder="Ej. Portabanner, Solapa, Ojales"
                                                      className="h-9 text-xs"
                                                    />
                                                  </div>
                                                  <div className="space-y-1">
                                                    <LabelConTooltip
                                                      label="Rol"
                                                      tooltip="Clasifica el material para mostrarlo y agruparlo correctamente en cotización y costos."
                                                    />
                                                    <HumanSelect
                                                      value={
                                                        slot.slotRol ??
                                                        "COMPONENTE"
                                                      }
                                                      onValueChange={(v) =>
                                                        updateSlot(
                                                          paso.id,
                                                          slotIdx,
                                                          {
                                                            slotRol:
                                                              (v as UpsertSlotMaterialPayload["slotRol"]) ||
                                                              "COMPONENTE",
                                                          },
                                                        )
                                                      }
                                                      options={SLOT_ROL_OPTIONS}
                                                      triggerClassName="min-h-9 text-xs"
                                                    />
                                                  </div>
                                                </div>
                                              ) : null}
                                              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                                <div className="space-y-1">
                                                  <LabelConTooltip
                                                    label="¿Quién elige el material?"
                                                    tooltip="Material fijo (modelador), el comercial elige al cotizar, o el sistema elige automáticamente con un criterio."
                                                  />
                                                  <HumanSelect
                                                    value={slot.modoSeleccion}
                                                    onValueChange={(v) =>
                                                      updateSlot(
                                                        paso.id,
                                                        slotIdx,
                                                        {
                                                          modoSeleccion: (v ||
                                                            "HARDCODED") as
                                                            | "HARDCODED"
                                                            | "COMERCIAL_ELIGE"
                                                            | "MOTOR_ELIGE_AUTO",
                                                        },
                                                      )
                                                    }
                                                    options={
                                                      SELECCION_MATERIAL_OPTIONS
                                                    }
                                                    triggerClassName="min-h-9 text-xs"
                                                  />
                                                </div>
                                                <div className="space-y-1">
                                                  <LabelConTooltip
                                                    label="¿Cómo se calcula el consumo?"
                                                    tooltip="Fórmula que el motor usa para calcular cuánto material se consume (por pieza, por m², por metro lineal, etc.)."
                                                  />
                                                  <HumanSelect
                                                    value={
                                                      slot.formula ??
                                                      "por_unidad_productiva"
                                                    }
                                                    onValueChange={(v) =>
                                                      updateSlot(
                                                        paso.id,
                                                        slotIdx,
                                                        {
                                                          formula:
                                                            v ||
                                                            "por_unidad_productiva",
                                                        },
                                                      )
                                                    }
                                                    options={FORMULA_OPTIONS}
                                                    triggerClassName="min-h-9 text-xs"
                                                  />
                                                </div>
                                                <div className="space-y-1">
                                                  <LabelConTooltip
                                                    label="Costeo"
                                                    tooltip={
                                                      nestingDefineCosteo
                                                        ? "Este paso toma el costeo desde Acomodado / nesting. El valor del slot no se usa mientras esa estrategia esté activa."
                                                        : "Estrategia de costeo del material cuando no hay una estrategia activa en Acomodado / nesting."
                                                    }
                                                  />
                                                  {nestingDefineCosteo ? (
                                                    <div className="min-h-9 rounded border bg-muted/40 px-3 py-2 text-xs">
                                                      <div className="font-medium text-foreground">
                                                        {optionLabel(
                                                          COSTING_STRATEGY_OPTIONS,
                                                          nestingCostingStrategy,
                                                        )}
                                                      </div>
                                                      <div className="text-muted-foreground">
                                                        Definido en Acomodado /
                                                        nesting
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <HumanSelect
                                                      value={
                                                        slot.estrategiaCosto ??
                                                        "simple"
                                                      }
                                                      onValueChange={(v) =>
                                                        updateSlot(
                                                          paso.id,
                                                          slotIdx,
                                                          {
                                                            estrategiaCosto:
                                                              v || "simple",
                                                          },
                                                        )
                                                      }
                                                      options={
                                                        COSTING_STRATEGY_OPTIONS
                                                      }
                                                      triggerClassName="min-h-9 text-xs"
                                                    />
                                                  )}
                                                </div>
                                              </div>
                                              {esSlotAdicional ? (
                                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                                  <div className="space-y-1">
                                                    <LabelConTooltip
                                                      label="Cantidad por base"
                                                      tooltip="Multiplicador de consumo. Ej: 1 portabanner por pieza, 4 ojales por pieza."
                                                    />
                                                    <Input
                                                      type="number"
                                                      min="0"
                                                      step="0.0001"
                                                      value={
                                                        slot.cantidadFactor ??
                                                        1
                                                      }
                                                      onChange={(event) =>
                                                        updateSlot(
                                                          paso.id,
                                                          slotIdx,
                                                          {
                                                            cantidadFactor:
                                                              event.target
                                                                .value === ""
                                                                ? null
                                                                : Number(
                                                                    event
                                                                      .target
                                                                      .value,
                                                                  ),
                                                          },
                                                        )
                                                      }
                                                      className="h-9 text-xs"
                                                    />
                                                  </div>
                                                  <div className="space-y-1">
                                                    <LabelConTooltip
                                                      label="Base de consumo"
                                                      tooltip="Cantidad operativa sobre la que se aplica el factor del componente."
                                                    />
                                                    <HumanSelect
                                                      value={
                                                        slot.cantidadBase ??
                                                        "cantidad_pedida"
                                                      }
                                                      onValueChange={(v) =>
                                                        updateSlot(
                                                          paso.id,
                                                          slotIdx,
                                                          {
                                                            cantidadBase:
                                                              v ||
                                                              "cantidad_pedida",
                                                          },
                                                        )
                                                      }
                                                      options={
                                                        CANTIDAD_BASE_SLOT_OPTIONS
                                                      }
                                                      triggerClassName="min-h-9 text-xs"
                                                    />
                                                  </div>
                                                </div>
                                              ) : null}
                                              {slot.modoSeleccion ===
                                                "HARDCODED" && (
                                                <div className="space-y-2 rounded border bg-background p-3">
                                                  <LabelConTooltip
                                                    label="Material fijo"
                                                    tooltip="Elegí una materia prima compatible y luego una variante concreta para dejar fija en este paso."
                                                  />
                                                  <MaterialSearchSelect
                                                    compatibilidad={
                                                      slotDecl?.compatibilidadMaterial
                                                    }
                                                    placeholder="Buscar materia prima compatible..."
                                                    selectedIds={
                                                      hardcodedMateria
                                                        ? [hardcodedMateria.id]
                                                        : []
                                                    }
                                                    onSelect={(
                                                      materiaPrima,
                                                    ) => {
                                                      setCandidateMaterials(
                                                        (prev) => ({
                                                          ...prev,
                                                          [materiaPrima.id]:
                                                            materiaPrima,
                                                        }),
                                                      );
                                                      setHardcodedMaterialSelections(
                                                        (prev) => ({
                                                          ...prev,
                                                          [slotUiKey]:
                                                            materiaPrima.id,
                                                        }),
                                                      );
                                                      updateSlot(
                                                        paso.id,
                                                        slotIdx,
                                                        {
                                                          materialVarianteId:
                                                            materiaPrima
                                                              .variantes.length ===
                                                            1
                                                              ? (materiaPrima
                                                                  .variantes[0]
                                                                  ?.id ?? null)
                                                              : null,
                                                        },
                                                      );
                                                    }}
                                                  />
                                                  {hardcodedMateria &&
                                                  hardcodedMateria.variantes
                                                    .length > 1 ? (
                                                    <HumanSelect
                                                      value={
                                                        slot.materialVarianteId ??
                                                        ""
                                                      }
                                                      onValueChange={(v) =>
                                                        updateSlot(
                                                          paso.id,
                                                          slotIdx,
                                                          {
                                                            materialVarianteId:
                                                              v || null,
                                                          },
                                                        )
                                                      }
                                                      options={hardcodedMateria.variantes.map(
                                                        (variante) =>
                                                          varianteOptionFromBusqueda(
                                                            hardcodedMateria,
                                                            variante,
                                                          ),
                                                      )}
                                                      placeholder="Elegir variante fija"
                                                      triggerClassName="min-h-8 text-xs"
                                                    />
                                                  ) : (
                                                    <div className="text-muted-foreground text-xs">
                                                      Variante:{" "}
                                                      {hardcodedVarianteLabel}
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                              {slot.modoSeleccion !==
                                                "HARDCODED" && (
                                                <div className="space-y-2 rounded border bg-background p-3">
                                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <LabelConTooltip
                                                      label="Materiales candidatos"
                                                      tooltip="Lista de variantes entre las que podrá elegir el comercial, o entre las que el sistema resolverá automáticamente."
                                                    />
                                                    <span className="text-muted-foreground text-[11px]">
                                                      {
                                                        selectedCandidates.length
                                                      }{" "}
                                                      materia
                                                      {selectedCandidates.length ===
                                                      1
                                                        ? ""
                                                        : "s"}
                                                    </span>
                                                  </div>
                                                  <MaterialSearchSelect
                                                    compatibilidad={
                                                      slotDecl?.compatibilidadMaterial
                                                    }
                                                    placeholder="Buscar materia prima compatible..."
                                                    selectedIds={selectedCandidates.map(
                                                      (candidate) =>
                                                        candidate.materiaPrimaId,
                                                    )}
                                                    onSelect={(materiaPrima) =>
                                                      addSlotCandidate(
                                                        paso.id,
                                                        slotIdx,
                                                        materiaPrima,
                                                      )
                                                    }
                                                  />
                                                  <div className="space-y-2">
                                                    {selectedCandidates.map(
                                                      (candidate) => {
                                                        const materiaPrima =
                                                          candidateMaterials[
                                                            candidate
                                                              .materiaPrimaId
                                                          ];
                                                        const variantOptions =
                                                          materiaPrima?.variantes.map(
                                                            (variante) =>
                                                              varianteOptionFromBusqueda(
                                                                materiaPrima,
                                                                variante,
                                                              ),
                                                          ) ?? [];
                                                        const enabledVariantIds =
                                                          new Set(
                                                            candidate.varianteIds,
                                                          );
                                                        return (
                                                          <div
                                                            key={
                                                              candidate.materiaPrimaId
                                                            }
                                                            className="rounded border bg-white p-2"
                                                          >
                                                            <div className="mb-2 flex items-center justify-between gap-2">
                                                              <div className="min-w-0 text-xs">
                                                                <div className="truncate font-medium">
                                                                  {materiaPrima?.nombre ??
                                                                    candidate.materiaPrimaId}
                                                                </div>
                                                              </div>
                                                              <button
                                                                type="button"
                                                                className="text-xs text-red-600"
                                                                onClick={() =>
                                                                  removeSlotCandidate(
                                                                    paso.id,
                                                                    slotIdx,
                                                                    candidate.materiaPrimaId,
                                                                  )
                                                                }
                                                              >
                                                                Quitar
                                                              </button>
                                                            </div>
                                                            {materiaPrima &&
                                                            materiaPrima
                                                              .variantes
                                                              .length > 1 ? (
                                                              canUseColorThicknessSelector(
                                                                materiaPrima,
                                                              ) ? (
                                                                <ColorThicknessVariantSelector
                                                                  materiaPrima={
                                                                    materiaPrima
                                                                  }
                                                                  candidate={
                                                                    candidate
                                                                  }
                                                                  onChange={(
                                                                    patch,
                                                                  ) =>
                                                                    updateSlotCandidate(
                                                                      paso.id,
                                                                      slotIdx,
                                                                      candidate.materiaPrimaId,
                                                                      patch,
                                                                    )
                                                                  }
                                                                />
                                                              ) : (
                                                                <div className="mb-2 space-y-1 rounded border bg-muted/20 p-2">
                                                                  <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                                                                    Variantes
                                                                    habilitadas
                                                                    para cotizar
                                                                  </div>
                                                                  <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
                                                                    {materiaPrima.variantes.map(
                                                                      (
                                                                        variante,
                                                                      ) => {
                                                                        const checked =
                                                                          enabledVariantIds.has(
                                                                            variante.id,
                                                                          );
                                                                        const option =
                                                                          varianteOptionFromBusqueda(
                                                                            materiaPrima,
                                                                            variante,
                                                                          );
                                                                        const precioReferencia =
                                                                          variante.precioReferencia
                                                                            ? Number(
                                                                                variante.precioReferencia,
                                                                              ).toLocaleString(
                                                                                "es-AR",
                                                                              )
                                                                            : null;
                                                                        return (
                                                                          <label
                                                                            key={
                                                                              variante.id
                                                                            }
                                                                            className={`flex items-start gap-3 rounded border px-3 py-2 text-xs transition ${
                                                                              checked
                                                                                ? "border-foreground/15 bg-white shadow-sm"
                                                                                : "border-transparent bg-white/70 text-muted-foreground"
                                                                            }`}
                                                                          >
                                                                            <input
                                                                              type="checkbox"
                                                                              className="mt-0.5"
                                                                              checked={
                                                                                checked
                                                                              }
                                                                              onChange={(
                                                                                event,
                                                                              ) => {
                                                                                const nextIds =
                                                                                  event
                                                                                    .target
                                                                                    .checked
                                                                                    ? [
                                                                                        ...candidate.varianteIds,
                                                                                        variante.id,
                                                                                      ]
                                                                                    : candidate.varianteIds.filter(
                                                                                        (
                                                                                          id,
                                                                                        ) =>
                                                                                          id !==
                                                                                          variante.id,
                                                                                      );
                                                                                const safeIds =
                                                                                  nextIds.length >
                                                                                  0
                                                                                    ? Array.from(
                                                                                        new Set(
                                                                                          nextIds,
                                                                                        ),
                                                                                      )
                                                                                    : [
                                                                                        variante.id,
                                                                                      ];
                                                                                const defaultStillEnabled =
                                                                                  candidate.defaultVarianteId &&
                                                                                  safeIds.includes(
                                                                                    candidate.defaultVarianteId,
                                                                                  );
                                                                                updateSlotCandidate(
                                                                                  paso.id,
                                                                                  slotIdx,
                                                                                  candidate.materiaPrimaId,
                                                                                  {
                                                                                    varianteIds:
                                                                                      safeIds,
                                                                                    defaultVarianteId:
                                                                                      defaultStillEnabled
                                                                                        ? candidate.defaultVarianteId
                                                                                        : (safeIds[0] ??
                                                                                          null),
                                                                                  },
                                                                                );
                                                                              }}
                                                                            />
                                                                            <span className="min-w-0">
                                                                              <span className="block text-sm font-medium leading-snug text-foreground">
                                                                                {
                                                                                  materiaPrima.nombre
                                                                                }
                                                                              </span>
                                                                              {precioReferencia ? (
                                                                                <span className="text-muted-foreground block truncate">
                                                                                  Referencia:
                                                                                  $
                                                                                  {
                                                                                    precioReferencia
                                                                                  }
                                                                                </span>
                                                                              ) : null}
                                                                              {option.details &&
                                                                              option
                                                                                .details
                                                                                .length >
                                                                                0 ? (
                                                                                <span className="mt-1 flex flex-wrap gap-1">
                                                                                  {option.details.map(
                                                                                    (
                                                                                      detail,
                                                                                    ) => (
                                                                                      <span
                                                                                        key={`${option.value}-${detail.label}-${detail.value}`}
                                                                                        className="rounded border bg-muted px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground"
                                                                                      >
                                                                                        <span className="font-medium text-foreground">
                                                                                          {
                                                                                            detail.label
                                                                                          }
                                                                                          :
                                                                                        </span>{" "}
                                                                                        {
                                                                                          detail.value
                                                                                        }
                                                                                      </span>
                                                                                    ),
                                                                                  )}
                                                                                </span>
                                                                              ) : (
                                                                                <span className="text-muted-foreground mt-1 block text-[11px]">
                                                                                  Sin
                                                                                  atributos
                                                                                  de
                                                                                  variante
                                                                                  cargados.
                                                                                  Código:{" "}
                                                                                  {
                                                                                    variante.sku
                                                                                  }
                                                                                </span>
                                                                              )}
                                                                            </span>
                                                                          </label>
                                                                        );
                                                                      },
                                                                    )}
                                                                  </div>
                                                                </div>
                                                              )
                                                            ) : null}
                                                            <div className="space-y-1">
                                                              <Label className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
                                                                Variante
                                                                predeterminada
                                                              </Label>
                                                              <HumanSelect
                                                                value={
                                                                  candidate.defaultVarianteId ??
                                                                  ""
                                                                }
                                                                onValueChange={(
                                                                  v,
                                                                ) =>
                                                                  updateSlotCandidate(
                                                                    paso.id,
                                                                    slotIdx,
                                                                    candidate.materiaPrimaId,
                                                                    {
                                                                      defaultVarianteId:
                                                                        v ||
                                                                        null,
                                                                    },
                                                                  )
                                                                }
                                                                options={variantOptions.filter(
                                                                  (option) =>
                                                                    candidate.varianteIds.includes(
                                                                      option.value,
                                                                    ),
                                                                )}
                                                                placeholder="Elegir variante predeterminada"
                                                                triggerClassName="min-h-10 text-xs"
                                                                contentClassName="min-w-[520px]"
                                                              />
                                                            </div>
                                                          </div>
                                                        );
                                                      },
                                                    )}
                                                  </div>
                                                  {selectedCandidates.length ===
                                                  0 ? (
                                                    <p className="text-muted-foreground text-xs">
                                                      Agregá al menos una
                                                      materia prima candidata
                                                      para este slot.
                                                    </p>
                                                  ) : null}
                                                </div>
                                              )}
                                              {slot.modoSeleccion ===
                                                "MOTOR_ELIGE_AUTO" && (
                                                <div className="space-y-1">
                                                  <LabelConTooltip
                                                    label="Criterio del sistema"
                                                    tooltip="Cómo elige el sistema entre los candidatos: el más barato, el de mejor aprovechamiento, o el de capacidad mínima que cumpla."
                                                  />
                                                  <HumanSelect
                                                    value={
                                                      slot.criterioMotorAuto ??
                                                      ""
                                                    }
                                                    onValueChange={(v) =>
                                                      updateSlot(
                                                        paso.id,
                                                        slotIdx,
                                                        {
                                                          criterioMotorAuto:
                                                            v || null,
                                                        },
                                                      )
                                                    }
                                                    options={
                                                      CRITERIO_AUTO_OPTIONS
                                                    }
                                                    placeholder="Elegí criterio"
                                                    triggerClassName="min-h-9 text-xs"
                                                  />
                                                </div>
                                              )}
                                              <label className="flex items-center gap-2 text-xs">
                                                <input
                                                  type="checkbox"
                                                  checked={
                                                    !!slot.aplicaMultiCaras
                                                  }
                                                  onChange={(e) =>
                                                    updateSlot(
                                                      paso.id,
                                                      slotIdx,
                                                      {
                                                        aplicaMultiCaras:
                                                          e.target.checked,
                                                      },
                                                    )
                                                  }
                                                />
                                                <span>
                                                  Multiplicar consumo por caras
                                                  <span className="text-muted-foreground ml-1">
                                                    (si doble faz, consume el
                                                    doble)
                                                  </span>
                                                </span>
                                              </label>
                                            </div>
                                          );
                                        },
                                      )}

                                      {(valMateriales.errores.length > 0 ||
                                        valMateriales.warnings.length > 0) && (
                                        <ListaValidacion
                                          validacion={valMateriales}
                                        />
                                      )}
                                    </>
                                  )}
                                </div>
                              </section>
                            )}

                            {/* ── TAB AVANZADO ─────────────────────────────────────── */}
                            <section
                              className={`section-block ${advancedOpen ? "open" : "closed"}`}
                            >
                              <button
                                type="button"
                                className="sb-head"
                                onClick={() => setAdvancedOpen((open) => !open)}
                              >
                                <span className="num">
                                  {familia?.relacionMaquinaSoportada.includes(
                                    "M-1",
                                  )
                                    ? "05"
                                    : "04"}
                                </span>
                                <span className="ttl">Avanzado</span>
                                <span className="hint">
                                  Overrides y notas internas
                                </span>
                                <span className="chev">›</span>
                              </button>
                              {advancedOpen && (
                                <div className="sb-body space-y-4">
                                  <p className="text-muted-foreground text-xs">
                                    Ajustes operativos del paso. Los parámetros
                                    técnicos internos se preservan, pero no se
                                    editan desde esta vista.
                                  </p>

                                  {/* Overrides de tiempo */}
                                  {mostrarOverridesTiempo && (
                                    <div className="space-y-2">
                                      <div className="text-sm font-medium">
                                        Overrides de tiempo (minutos)
                                      </div>
                                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                        {mostrarSetupCleanupOverrides && (
                                          <>
                                            <div className="space-y-1">
                                              <LabelConTooltip
                                                label="Setup override"
                                                tooltip="Sobrescribe el tiempo de preparación del perfil de máquina. Vacío = usar el del perfil."
                                                iconSize="sm"
                                              />
                                              <Input
                                                type="number"
                                                min={0}
                                                step={0.5}
                                                value={
                                                  cfg.setupOverrideMin ?? ""
                                                }
                                                onChange={(e) =>
                                                  updateConfig(paso.id, {
                                                    setupOverrideMin:
                                                      e.target.value === ""
                                                        ? null
                                                        : Number(
                                                            e.target.value,
                                                          ),
                                                  })
                                                }
                                                placeholder="—"
                                                className="h-8 text-xs"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <LabelConTooltip
                                                label="Cleanup override"
                                                tooltip="Sobrescribe el tiempo de cierre/post-proceso del perfil de máquina. Vacío = usar el del perfil."
                                                iconSize="sm"
                                              />
                                              <Input
                                                type="number"
                                                min={0}
                                                step={0.5}
                                                value={
                                                  cfg.cleanupOverrideMin ?? ""
                                                }
                                                onChange={(e) =>
                                                  updateConfig(paso.id, {
                                                    cleanupOverrideMin:
                                                      e.target.value === ""
                                                        ? null
                                                        : Number(
                                                            e.target.value,
                                                          ),
                                                  })
                                                }
                                                placeholder="—"
                                                className="h-8 text-xs"
                                              />
                                            </div>
                                          </>
                                        )}
                                        {mostrarTiempoFijoOverride && (
                                          <div className="space-y-1">
                                            <LabelConTooltip
                                              label="Tiempo fijo override"
                                              tooltip="Sólo aplica en pasos sin máquina con tiempo fijo."
                                              iconSize="sm"
                                            />
                                            <Input
                                              type="number"
                                              min={0}
                                              step={0.5}
                                              value={
                                                cfg.tiempoFijoOverrideMin ?? ""
                                              }
                                              onChange={(e) =>
                                                updateConfig(paso.id, {
                                                  tiempoFijoOverrideMin:
                                                    e.target.value === ""
                                                      ? null
                                                      : Number(e.target.value),
                                                })
                                              }
                                              placeholder="—"
                                              className="h-8 text-xs"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {mostrarNesting && (
                                    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                                      <LabelConTooltip
                                        label={
                                          <>
                                            <Grid2X2Icon className="mr-1 inline size-3" />
                                            Acomodado / nesting
                                          </>
                                        }
                                        tooltip="Configuración del acomodo de piezas para este paso. Se guarda como nestingConfig, pero se edita desde controles visuales."
                                      />
                                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <div className="space-y-1">
                                          <LabelConTooltip
                                            label="Algoritmo"
                                            tooltip="Automático elige según la geometría de máquina/material y las medidas del trabajo."
                                            iconSize="sm"
                                          />
                                          <HumanSelect
                                            value={String(
                                              nestingConfig.algorithm ?? "auto",
                                            )}
                                            onValueChange={(v) =>
                                              updateNestingConfig(paso.id, {
                                                algorithm: v || "auto",
                                              })
                                            }
                                            options={NESTING_ALGORITHM_OPTIONS}
                                            triggerClassName="min-h-9 text-xs"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <LabelConTooltip
                                            label="Demasía por lado"
                                            tooltip="Margen extra alrededor de cada pieza. Entre dos piezas se acumulan ambos lados."
                                            iconSize="sm"
                                          />
                                          <Input
                                            type="number"
                                            min={0}
                                            step={0.5}
                                            value={String(resolvedPieceBleed)}
                                            onChange={(e) =>
                                              updateNestingPieceBleed(
                                                paso.id,
                                                e.target.value === ""
                                                  ? 0
                                                  : Number(e.target.value),
                                              )
                                            }
                                            className="h-8 text-xs"
                                          />
                                        </div>
                                      </div>
                                      {familia?.codigo ===
                                        "impresion_por_hoja" && (
                                        <div className="space-y-2 rounded border bg-background/70 p-3">
                                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                            <LabelConTooltip
                                              label="Pliego de impresión"
                                              tooltip="Tamaño real de hoja que entra a la impresora. Si queda vacío, el motor usa el tamaño del sustrato principal comprado."
                                              iconSize="sm"
                                            />
                                            {sustratoAnchoLabel &&
                                              sustratoAltoLabel && (
                                                <span className="text-muted-foreground text-xs">
                                                  Sustrato comprado:{" "}
                                                  {sustratoAnchoLabel} ×{" "}
                                                  {sustratoAltoLabel}
                                                </span>
                                              )}
                                          </div>
                                          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                            <div className="space-y-1">
                                              <LabelConTooltip
                                                label="Tamaño"
                                                tooltip="Elegí un formato estándar o personalizado si el pliego del producto tiene otra medida."
                                                iconSize="sm"
                                              />
                                              <HumanSelect
                                                value={pliegoImpresionPreset}
                                                onValueChange={(v) =>
                                                  updateNestingPliegoPreset(
                                                    paso.id,
                                                    v || "materia_prima",
                                                  )
                                                }
                                                options={
                                                  PLIEGO_IMPRESION_OPTIONS
                                                }
                                                triggerClassName="min-h-9 text-xs"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <LabelConTooltip
                                                label="Ancho del pliego"
                                                tooltip="Ancho en milímetros del pliego ya cortado para imprimir."
                                                iconSize="sm"
                                              />
                                              <Input
                                                type="number"
                                                min={1}
                                                step={1}
                                                disabled={
                                                  !pliegoImpresionEsPersonalizado
                                                }
                                                value={String(
                                                  pliegoImpresionConfig.anchoMm ??
                                                    "",
                                                )}
                                                onChange={(e) =>
                                                  updateNestingPliegoImpresion(
                                                    paso.id,
                                                    {
                                                      anchoMm:
                                                        e.target.value === ""
                                                          ? null
                                                          : Number(
                                                              e.target.value,
                                                            ),
                                                    },
                                                  )
                                                }
                                                placeholder="Usar sustrato"
                                                className="h-8 text-xs"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <LabelConTooltip
                                                label="Alto del pliego"
                                                tooltip="Alto/largo en milímetros del pliego ya cortado para imprimir."
                                                iconSize="sm"
                                              />
                                              <Input
                                                type="number"
                                                min={1}
                                                step={1}
                                                disabled={
                                                  !pliegoImpresionEsPersonalizado
                                                }
                                                value={String(
                                                  pliegoImpresionConfig.altoMm ??
                                                    "",
                                                )}
                                                onChange={(e) =>
                                                  updateNestingPliegoImpresion(
                                                    paso.id,
                                                    {
                                                      altoMm:
                                                        e.target.value === ""
                                                          ? null
                                                          : Number(
                                                              e.target.value,
                                                            ),
                                                    },
                                                  )
                                                }
                                                placeholder="Usar sustrato"
                                                className="h-8 text-xs"
                                              />
                                            </div>
                                          </div>
                                          {pliegoImpresionEsAutomatico && (
                                            <div className="space-y-2 rounded border border-dashed p-2">
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-medium">
                                                  Candidatos activos
                                                </span>
                                                <Button
                                                  type="button"
                                                  size="sm"
                                                  variant="outline"
                                                  className="h-7 gap-1 px-2 text-xs"
                                                  onClick={() =>
                                                    addNestingPliegoCandidato(
                                                      paso.id,
                                                      "A4",
                                                    )
                                                  }
                                                >
                                                  <PlusIcon className="h-3 w-3" />
                                                  Agregar candidato
                                                </Button>
                                              </div>
                                              {pliegoCandidatos.length === 0 ? (
                                                <div className="rounded bg-muted/50 px-2 py-2 text-xs text-muted-foreground">
                                                  Agregá al menos un tamaño para
                                                  que el motor pueda comparar.
                                                </div>
                                              ) : (
                                                <div className="space-y-2">
                                                  {pliegoCandidatos.map(
                                                    (candidato, index) => {
                                                      const candidatoPreset =
                                                        typeof candidato.preset ===
                                                        "string"
                                                          ? candidato.preset
                                                          : "personalizado";
                                                      return (
                                                        <div
                                                          key={`${candidato.id ?? index}-${index}`}
                                                          className="grid grid-cols-1 gap-2 rounded border bg-background/80 p-2 md:grid-cols-[80px_1fr_120px_100px_100px_36px]"
                                                        >
                                                          <label className="flex items-center gap-2 text-xs">
                                                            <input
                                                              type="checkbox"
                                                              checked={
                                                                candidato.activo !==
                                                                false
                                                              }
                                                              onChange={(e) =>
                                                                updateNestingPliegoCandidato(
                                                                  paso.id,
                                                                  index,
                                                                  {
                                                                    activo:
                                                                      e.target
                                                                        .checked,
                                                                  },
                                                                )
                                                              }
                                                            />
                                                            Activo
                                                          </label>
                                                          <div className="space-y-1">
                                                            <Label className="text-[11px]">
                                                              Nombre
                                                            </Label>
                                                            <Input
                                                              value={String(
                                                                candidato.nombre ??
                                                                  "",
                                                              )}
                                                              onChange={(e) =>
                                                                updateNestingPliegoCandidato(
                                                                  paso.id,
                                                                  index,
                                                                  {
                                                                    nombre:
                                                                      e.target
                                                                        .value,
                                                                  },
                                                                )
                                                              }
                                                              className="h-8 text-xs"
                                                            />
                                                          </div>
                                                          <div className="space-y-1">
                                                            <Label className="text-[11px]">
                                                              Preset
                                                            </Label>
                                                            <HumanSelect
                                                              value={
                                                                PLIEGO_IMPRESION_PRESETS.some(
                                                                  (preset) =>
                                                                    preset.value ===
                                                                    candidatoPreset,
                                                                )
                                                                  ? candidatoPreset
                                                                  : "personalizado"
                                                              }
                                                              onValueChange={(v) => {
                                                                const preset =
                                                                  PLIEGO_IMPRESION_PRESETS.find(
                                                                    (item) =>
                                                                      item.value ===
                                                                      v,
                                                                  );
                                                                if (
                                                                  !preset ||
                                                                  preset.value ===
                                                                    "personalizado" ||
                                                                  !preset.anchoMm ||
                                                                  !preset.altoMm
                                                                ) {
                                                                  updateNestingPliegoCandidato(
                                                                    paso.id,
                                                                    index,
                                                                    {
                                                                      preset:
                                                                        "personalizado",
                                                                    },
                                                                  );
                                                                  return;
                                                                }
                                                                updateNestingPliegoCandidato(
                                                                  paso.id,
                                                                  index,
                                                                  {
                                                                    preset:
                                                                      preset.value,
                                                                    nombre:
                                                                      preset.label,
                                                                    anchoMm:
                                                                      preset.anchoMm,
                                                                    altoMm:
                                                                      preset.altoMm,
                                                                  },
                                                                );
                                                              }}
                                                              options={PLIEGO_IMPRESION_OPTIONS.filter(
                                                                (option) =>
                                                                  ![
                                                                    "materia_prima",
                                                                    "automatico",
                                                                  ].includes(
                                                                    option.value,
                                                                  ),
                                                              )}
                                                              triggerClassName="min-h-8 text-xs"
                                                            />
                                                          </div>
                                                          <div className="space-y-1">
                                                            <Label className="text-[11px]">
                                                              Ancho mm
                                                            </Label>
                                                            <Input
                                                              type="number"
                                                              min={1}
                                                              step={1}
                                                              value={String(
                                                                candidato.anchoMm ??
                                                                  "",
                                                              )}
                                                              onChange={(e) =>
                                                                updateNestingPliegoCandidato(
                                                                  paso.id,
                                                                  index,
                                                                  {
                                                                    preset:
                                                                      "personalizado",
                                                                    anchoMm:
                                                                      e.target
                                                                        .value ===
                                                                      ""
                                                                        ? ""
                                                                        : Number(
                                                                            e
                                                                              .target
                                                                              .value,
                                                                          ),
                                                                  },
                                                                )
                                                              }
                                                              className="h-8 text-xs"
                                                            />
                                                          </div>
                                                          <div className="space-y-1">
                                                            <Label className="text-[11px]">
                                                              Alto mm
                                                            </Label>
                                                            <Input
                                                              type="number"
                                                              min={1}
                                                              step={1}
                                                              value={String(
                                                                candidato.altoMm ??
                                                                  "",
                                                              )}
                                                              onChange={(e) =>
                                                                updateNestingPliegoCandidato(
                                                                  paso.id,
                                                                  index,
                                                                  {
                                                                    preset:
                                                                      "personalizado",
                                                                    altoMm:
                                                                      e.target
                                                                        .value ===
                                                                      ""
                                                                        ? ""
                                                                        : Number(
                                                                            e
                                                                              .target
                                                                              .value,
                                                                          ),
                                                                  },
                                                                )
                                                              }
                                                              className="h-8 text-xs"
                                                            />
                                                          </div>
                                                          <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="self-end text-destructive"
                                                            onClick={() =>
                                                              removeNestingPliegoCandidato(
                                                                paso.id,
                                                                index,
                                                              )
                                                            }
                                                          >
                                                            <Trash2Icon className="h-4 w-4" />
                                                          </Button>
                                                        </div>
                                                      );
                                                    },
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                          <p className="text-muted-foreground text-xs">
                                            La imposición, el tiempo y los
                                            consumibles se calculan sobre este
                                            pliego; el sustrato principal se
                                            convierte contra el tamaño comprado
                                            cuando corresponde.
                                          </p>
                                        </div>
                                      )}
                                      <label className="flex items-center gap-2 text-xs">
                                        <input
                                          type="checkbox"
                                          checked={
                                            nestingConfig.allowRotation !==
                                            false
                                          }
                                          onChange={(e) =>
                                            updateNestingConfig(paso.id, {
                                              allowRotation: e.target.checked,
                                            })
                                          }
                                        />
                                        <span>Permitir rotar piezas</span>
                                      </label>

                                      {mostrarPanelizado && (
                                        <div className="space-y-3 rounded border border-orange-200/70 bg-orange-50/30 p-3">
                                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <label className="flex items-center gap-2 text-xs font-medium">
                                              <input
                                                type="checkbox"
                                                checked={
                                                  panelizadoConfig.enabled ===
                                                  true
                                                }
                                                onChange={(e) =>
                                                  updateNestingPanelizado(
                                                    paso.id,
                                                    {
                                                      enabled: e.target.checked,
                                                      mode: e.target.checked
                                                        ? panelizadoMode
                                                        : "automatic",
                                                      axis: e.target.checked
                                                        ? panelizadoAxis
                                                        : "automatic",
                                                      manualLayout: e.target
                                                        .checked
                                                        ? panelizadoConfig.manualLayout
                                                        : null,
                                                    },
                                                  )
                                                }
                                              />
                                              <span>
                                                Panelizar piezas grandes
                                              </span>
                                            </label>
                                            {panelSummary ? (
                                              <span className="rounded-full border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                                                {panelSummary}
                                              </span>
                                            ) : null}
                                          </div>
                                          {panelizadoConfig.enabled ===
                                            true && (
                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                              <div className="space-y-1">
                                                <LabelConTooltip
                                                  label="Modo de panelizado"
                                                  tooltip="Automático divide las piezas grandes según reglas. Manual usa el layout de paneles definido por el usuario."
                                                  iconSize="sm"
                                                />
                                                <HumanSelect
                                                  value={panelizadoMode}
                                                  onValueChange={(v) =>
                                                    updateNestingPanelizado(
                                                      paso.id,
                                                      {
                                                        mode:
                                                          v === "manual"
                                                            ? "manual"
                                                            : "automatic",
                                                        axis:
                                                          v === "manual" &&
                                                          panelizadoAxis ===
                                                            "automatic"
                                                            ? "vertical"
                                                            : panelizadoAxis,
                                                        manualLayout:
                                                          v === "manual"
                                                            ? (panelizadoConfig.manualLayout ??
                                                              null)
                                                            : null,
                                                      },
                                                    )
                                                  }
                                                  options={PANEL_MODE_OPTIONS}
                                                  triggerClassName="min-h-9 text-xs"
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <LabelConTooltip
                                                  label="Dirección de panelizado"
                                                  tooltip="Define si se divide el ancho o el alto de la pieza cuando no entra en el rollo."
                                                  iconSize="sm"
                                                />
                                                <HumanSelect
                                                  value={
                                                    panelizadoMode ===
                                                      "manual" &&
                                                    panelizadoAxis ===
                                                      "automatic"
                                                      ? "vertical"
                                                      : panelizadoAxis
                                                  }
                                                  onValueChange={(v) =>
                                                    updateNestingPanelizado(
                                                      paso.id,
                                                      {
                                                        axis:
                                                          panelizadoMode ===
                                                            "manual" &&
                                                          v === "automatic"
                                                            ? "vertical"
                                                            : v || "vertical",
                                                        manualLayout:
                                                          panelizadoMode ===
                                                          "manual"
                                                            ? null
                                                            : panelizadoConfig.manualLayout,
                                                      },
                                                    )
                                                  }
                                                  options={
                                                    panelizadoMode === "manual"
                                                      ? PANEL_MANUAL_AXIS_OPTIONS
                                                      : PANEL_AXIS_OPTIONS
                                                  }
                                                  triggerClassName="min-h-9 text-xs"
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <LabelConTooltip
                                                  label="Solape"
                                                  tooltip="Milímetros que se agregan entre paneles para poder montarlos."
                                                  iconSize="sm"
                                                />
                                                <Input
                                                  type="number"
                                                  min={0}
                                                  step={1}
                                                  value={String(
                                                    resolvedPanelOverlap,
                                                  )}
                                                  onChange={(e) =>
                                                    updateNestingPanelizado(
                                                      paso.id,
                                                      {
                                                        overlapMm:
                                                          e.target.value === ""
                                                            ? 0
                                                            : Number(
                                                                e.target.value,
                                                              ),
                                                      },
                                                    )
                                                  }
                                                  className="h-8 text-xs"
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <LabelConTooltip
                                                  label="Ancho máximo por panel (mm)"
                                                  tooltip="Límite físico de cada panel en milímetros. Si queda en 0, el motor usa el ancho útil del rollo. Valores menores a 300 mm se tratan como 0 para evitar paneles demasiado angostos."
                                                  iconSize="sm"
                                                />
                                                <Input
                                                  type="number"
                                                  min={0}
                                                  step={1}
                                                  value={String(
                                                    resolvedPanelMaxWidth,
                                                  )}
                                                  onChange={(e) =>
                                                    updateNestingPanelizado(
                                                      paso.id,
                                                      {
                                                        maxPanelWidthMm:
                                                          e.target.value === ""
                                                            ? 0
                                                            : Number(
                                                                e.target.value,
                                                              ),
                                                      },
                                                    )
                                                  }
                                                  className="h-8 text-xs"
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <LabelConTooltip
                                                  label="Distribución"
                                                  tooltip="Define cómo reparte la medida útil entre paneles."
                                                  iconSize="sm"
                                                />
                                                <HumanSelect
                                                  value={String(
                                                    panelizadoConfig.distribution ??
                                                      "equilibrada",
                                                  )}
                                                  onValueChange={(v) =>
                                                    updateNestingPanelizado(
                                                      paso.id,
                                                      {
                                                        distribution:
                                                          v || "equilibrada",
                                                      },
                                                    )
                                                  }
                                                  options={
                                                    PANEL_DISTRIBUTION_OPTIONS
                                                  }
                                                  triggerClassName="min-h-9 text-xs"
                                                />
                                              </div>
                                              <div className="space-y-1 md:col-span-2">
                                                <LabelConTooltip
                                                  label="Interpretación del ancho"
                                                  tooltip="Define si el ancho máximo contempla el panel completo o sólo la parte útil."
                                                  iconSize="sm"
                                                />
                                                <HumanSelect
                                                  value={String(
                                                    panelizadoConfig.widthInterpretation ??
                                                      "total",
                                                  )}
                                                  onValueChange={(v) =>
                                                    updateNestingPanelizado(
                                                      paso.id,
                                                      {
                                                        widthInterpretation:
                                                          v || "total",
                                                      },
                                                    )
                                                  }
                                                  options={
                                                    PANEL_WIDTH_INTERPRETATION_OPTIONS
                                                  }
                                                  triggerClassName="min-h-9 text-xs"
                                                />
                                              </div>
                                              {panelizadoMode === "manual" ? (
                                                <div className="space-y-1 md:col-span-3">
                                                  <LabelConTooltip
                                                    label="Layout manual de paneles"
                                                    tooltip="Define los cortes de panel para las medidas fijas o predefinidas del producto."
                                                    iconSize="sm"
                                                  />
                                                  <div className="flex flex-wrap items-center gap-2">
                                                    <Button
                                                      type="button"
                                                      size="sm"
                                                      variant="outline"
                                                      disabled={
                                                        panelMeasures.length ===
                                                        0
                                                      }
                                                      onClick={() =>
                                                        setPanelEditorPasoId(
                                                          paso.id,
                                                        )
                                                      }
                                                    >
                                                      Editar paneles
                                                    </Button>
                                                    <span className="text-xs text-muted-foreground">
                                                      {panelManualLayout
                                                        ? `${panelManualLayout.items.length} medida${panelManualLayout.items.length === 1 ? "" : "s"} con layout manual`
                                                        : "Sin layout manual guardado"}
                                                    </span>
                                                  </div>
                                                </div>
                                              ) : null}
                                            </div>
                                          )}
                                          <PanelManualEditorSheet
                                            open={panelEditorPasoId === paso.id}
                                            onOpenChange={(open) =>
                                              setPanelEditorPasoId(
                                                open ? paso.id : null,
                                              )
                                            }
                                            measures={panelMeasures}
                                            layout={panelManualLayout}
                                            axis={
                                              panelizadoAxis === "horizontal"
                                                ? "horizontal"
                                                : "vertical"
                                            }
                                            overlapMm={resolvedPanelOverlap}
                                            maxPanelWidthMm={
                                              resolvedPanelMaxWidth > 0
                                                ? resolvedPanelMaxWidth
                                                : null
                                            }
                                            printableWidthMm={
                                              printableWidthForPanelMm
                                            }
                                            widthInterpretation={
                                              panelizadoWidthInterpretation
                                            }
                                            onApply={(layout) =>
                                              updateNestingPanelizado(paso.id, {
                                                mode: "manual",
                                                axis:
                                                  layout.items[0]?.axis ??
                                                  (panelizadoAxis ===
                                                  "horizontal"
                                                    ? "horizontal"
                                                    : "vertical"),
                                                manualLayout: layout,
                                              })
                                            }
                                          />
                                        </div>
                                      )}

                                      <div className="space-y-2">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                          <div className="text-xs font-medium">
                                            Margen extra del pliego
                                          </div>
                                          <span className="text-muted-foreground text-xs">
                                            Se suma al margen de máquina y no
                                            cambia la separación entre piezas.
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                          {[
                                            ["leftMm", "Izq."],
                                            ["rightMm", "Der."],
                                            ["topMm", "Sup."],
                                            ["bottomMm", "Inf."],
                                          ].map(([key, label]) => (
                                            <div
                                              key={key}
                                              className="space-y-1"
                                            >
                                              <span className="text-muted-foreground text-xs">
                                                {label}
                                              </span>
                                              <Input
                                                type="number"
                                                min={0}
                                                step={0.5}
                                                value={String(
                                                  nestingExtraMargins[key] ??
                                                    "",
                                                )}
                                                onChange={(e) =>
                                                  updateNestingExtraMargins(
                                                    paso.id,
                                                    {
                                                      [key]:
                                                        e.target.value === ""
                                                          ? null
                                                          : Number(
                                                              e.target.value,
                                                            ),
                                                    },
                                                  )
                                                }
                                                placeholder="0"
                                                className="h-8 text-xs"
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="space-y-2">
                                        <div className="text-xs font-medium">
                                          Márgenes no imprimibles (cm)
                                        </div>
                                        <p className="text-muted-foreground text-xs">
                                          Margen técnico efectivo en
                                          centímetros. Si lo editás, sobrescribe
                                          el margen heredado de la máquina.
                                        </p>
                                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                          {[
                                            ["leftMm", "Izq."],
                                            ["rightMm", "Der."],
                                            ["topMm", "Sup."],
                                            ["bottomMm", "Inf."],
                                          ].map(([key, label]) => (
                                            <div
                                              key={key}
                                              className="space-y-1"
                                            >
                                              <span className="text-muted-foreground text-xs">
                                                {label} (cm)
                                              </span>
                                              <div className="relative">
                                                <Input
                                                  type="number"
                                                  min={0}
                                                  step={0.1}
                                                  value={mmToCmInput(
                                                    getResolvedNestingNumber(
                                                      nestingMargins[key],
                                                      machineMargins[
                                                        key as keyof typeof machineMargins
                                                      ],
                                                      0,
                                                    ),
                                                  )}
                                                  onChange={(e) =>
                                                    updateNestingMargins(
                                                      paso.id,
                                                      {
                                                        [key]: cmInputToMm(
                                                          e.target.value,
                                                        ),
                                                      },
                                                    )
                                                  }
                                                  className="h-8 pr-9 text-xs"
                                                />
                                                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                                                  cm
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <div className="space-y-1">
                                          <LabelConTooltip
                                            label="Costeo del sustrato"
                                            tooltip="Define cómo se cobra el material cuando hay resultado de nesting."
                                            iconSize="sm"
                                          />
                                          <HumanSelect
                                            value={String(
                                              nestingCosting.strategy ??
                                                "simple",
                                            )}
                                            onValueChange={(v) =>
                                              updateNestingCosting(paso.id, {
                                                strategy: v || "simple",
                                              })
                                            }
                                            options={COSTING_STRATEGY_OPTIONS}
                                            triggerClassName="min-h-9 text-xs"
                                          />
                                        </div>
                                        {nestingCosting.strategy ===
                                          "plate-segments" && (
                                          <div className="space-y-1">
                                            <LabelConTooltip
                                              label="Escalones de ocupación"
                                              tooltip="Porcentajes de placa que se cobran según ocupación: una placa al 60% cobra el primer escalón igual o superior."
                                              ejemplo="25, 50, 75, 100"
                                              iconSize="sm"
                                            />
                                            <Input
                                              value={
                                                Array.isArray(
                                                  nestingCosting.segmentSteps,
                                                )
                                                  ? nestingCosting.segmentSteps.join(
                                                      ", ",
                                                    )
                                                  : "25, 50, 75, 100"
                                              }
                                              onChange={(e) =>
                                                updateNestingCosting(paso.id, {
                                                  segmentSteps: e.target.value
                                                    .split(",")
                                                    .map((item) =>
                                                      Number(item.trim()),
                                                    )
                                                    .filter((item) =>
                                                      Number.isFinite(item),
                                                    ),
                                                })
                                              }
                                              className="h-8 text-xs"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {valAvanzado.errores.length > 0 && (
                                    <ListaValidacion validacion={valAvanzado} />
                                  )}
                                </div>
                              )}
                            </section>
                          </>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })
            : null}
        </main>
      </div>
    </div>
  );
}

// ─── Sub-componente: lista de validaciones ─────────────────────────

function ListaValidacion({ validacion }: { validacion: TabValidacion }) {
  if (validacion.errores.length === 0 && validacion.warnings.length === 0)
    return null;
  return (
    <div className="space-y-1 rounded border border-amber-200 bg-amber-50 p-2 text-xs">
      {validacion.errores.map((e, idx) => (
        <div key={`e-${idx}`} className="flex items-start gap-1 text-red-700">
          <AlertCircleIcon className="mt-0.5 size-3 shrink-0" />
          <span>{e}</span>
        </div>
      ))}
      {validacion.warnings.map((w, idx) => (
        <div key={`w-${idx}`} className="flex items-start gap-1 text-amber-700">
          <AlertCircleIcon className="mt-0.5 size-3 shrink-0" />
          <span>{w}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Sub-componente: resumen lateral del paso ──────────────────────
