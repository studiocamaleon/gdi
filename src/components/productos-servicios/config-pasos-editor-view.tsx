"use client";

import * as React from "react";
import { formatearMoneda, monedaDe } from "@/lib/moneda";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  DropletIcon,
  Grid2X2Icon,
  GripVerticalIcon,
  LockIcon,
  LockOpenIcon,
  PackageIcon,
  PlusIcon,
  RulerIcon,
  SaveIcon,
  SearchIcon,
  Share2Icon,
  SlidersHorizontalIcon,
  StarIcon,
  Trash2Icon,
  XIcon,
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
import { Switch } from "@/components/ui/switch";
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
import { PasoTercerizadoPanel } from "@/components/productos-servicios/paso-tercerizado-panel";
import { SelectBuscable } from "@/components/ui/select-buscable";
import maq from "@/components/productos-servicios/en-que-maquina.module.css";
import trab from "@/components/productos-servicios/el-trabajo.module.css";
import {
  pendientesDePaso,
  type PendientePaso,
  nivelPendientes,
  resumenPendientes,
} from "@/lib/pendientes-paso";
import {
  GRUPOS_EJE,
  GRUPOS_DONDE,
  opcionesDeEje,
  opcionesDeMaterial,
  GRUPOS_MATERIAL,
  opcionesPiezasMontar,
  modosActivacionOfrecidos,
  MODO_ACTIVACION_LABELS,
  type EjePaso,
  type ContextoOpcion,
  type OpcionPaso,
  type GrupoEje,
  type PatchOpcion,
  unidadCantidadDe,
} from "@/lib/editor-paso/schema";
import {
  SELECCION_MATERIAL_OPTIONS,
  FORMULA_OPTIONS,
  CRITERIO_AUTO_OPTIONS,
  costingStrategyOptions,
  ROLLO_COSTEO_OPTIONS,
  SLOT_ROL_OPTIONS,
  CANTIDAD_BASE_SLOT_OPTIONS,
  CANTIDAD_BASE_SLOT_OPTIONS_INSUMO,
} from "@/lib/editor-paso/catalogo-materiales";
import {
  MONTAJE_SOURCE_OPTIONS,
  TALONARIO_MODE_OPTIONS,
  T2_PRODUCTIVITY_UNIT_OPTIONS,
  normalizeT2ProductivityUnit,
  etiquetaFuenteDerivada,
  T2_TIME_CALCULATION_MODE_OPTIONS,
  TIEMPO_MANUAL_UNIDAD_OPTIONS,
  getT2ProductivityUnitSuffix,
  getT2BatchUnitSuffix,
  getDefaultT2ProductivityUnit,
  getDefaultT2TimeCalculationMode,
  getDefaultT2QuantitySource,
  getDefaultMecanismoCantidad,
  getT2QuantitySourceOptions,
  getRitmoMagnitudOptions,
  getTiempoManualConfig,
  isConsumibleMaquinaSlot,
  requiereMecanismoCantidad,
  getModoColorConfig,
  modoColorAplica,
  nestingAplica,
  humanizarOutputCanonico,
} from "@/lib/editor-paso/catalogo-tiempo";
import {
  actualizarPasoExtra,
  buscarMateriasPrimasConfigPaso,
  guardarConfiguracionBaseFamiliaSistema,
  guardarConfiguracionBasePasoTenant,
  reordenarPasosRutaAlt,
  upsertConfigPaso,
  type LookupsConfigPaso,
  type MateriaPrimaBusquedaItem,
  type UpsertConfigPasoPayload,
  type UpsertSlotMaterialPayload,
} from "@/lib/productos-servicios-api";
import type {
  FamiliaListItem,
  CatalogoFamilias,
  PasoExtra,
  ProductoDetalle,
  RutaAlternativaDetalle,
  SlotMaterialDetalle,
} from "@/lib/productos-servicios";
import {
  FUENTE_MEDIDA_PERSONALIZACION_PREFIX,
  getPersonalizaciones,
} from "@/lib/producto-personalizaciones";
import { PasoExtraEditor } from "@/components/productos-servicios/paso-extra-editor";
import { ParamsFamiliaFields } from "@/components/productos-servicios/params-familia-fields";
import { EfectosPasoFields } from "@/components/productos-servicios/efectos-paso-fields";
import { TiemposExtraPasoFields } from "@/components/productos-servicios/tiempos-extra-paso-fields";
import { NivelesPasoFields } from "@/components/productos-servicios/niveles-paso-fields";
import { CostosDirectosPasoPanel } from "@/components/productos-servicios/costos-directos-paso-panel";
import { leerNivelesPaso } from "@/lib/niveles-paso";
import {
  getLabel,
  mecanismoCantidadLabels,
  modoActivacionLabels,
  modoTiempoLabels,
} from "@/lib/labels-humanos";
import {
  getRuleFields,
  jsonLogicToRuleGroup,
  type RuleFieldDefinition,
  type RuleOperator,
  validateRuleGroup,
} from "@/lib/rule-builder";
import { getVarianteOptionChips } from "@/lib/materias-primas-variantes-display";
import { getMateriaPrimaTemplate } from "@/lib/materia-prima-templates";
import { derivarMetricas } from "@/components/carteleria/geometria";
import {
  NIVELES_COBERTURA,
  NIVEL_COBERTURA_LABELS,
} from "@/lib/cobertura-toner";
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
  catalogoCargos?: import("@/lib/productos-servicios").CargoDirectoCatalogo[];
  embedded?: boolean;
  configuracionBase?: {
    familiaCodigo: string;
    origen: "sistema" | "tenant";
    volverHref: string;
  };
}

type ConfigState = Record<string, UpsertConfigPasoPayload>;
type SavedConfigSnapshots = Record<string, string>;

const MODOS_ACTIVACION = [
  "OBLIGATORIO",
  "OPCIONAL",
  "CONDICIONAL",
  "NO_EJECUTAR",
];
const TECHNOLOGY_RULE_OPTIONS = tecnologiaMaquinaItems.map((item) => ({
  value: item.value,
  label: item.label,
}));
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
const PLIEGO_ORIGEN_COSTO_OPTIONS = [
  {
    value: "derivado",
    label: "Derivado de la materia prima",
    description:
      "Todos los tamaños se cortan de la materia prima del paso: el costo de cada candidato es proporcional al área que usa.",
  },
  {
    value: "por_candidato",
    label: "Materia prima por candidato",
    description:
      "Cada tamaño se compra ya cortado: asignale su materia prima y el motor compara los precios reales.",
  },
];
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
  familia: Pick<FamiliaListItem, "tiposPerfilCompatibles"> | null | undefined,
  perfil: PerfilLookup | null | undefined,
) {
  // [Tanda B] La ficha declara los tipos de perfil (`tiposPerfilCompatibles`);
  // antes había una copia local (plotter→corte, área→impresión) que se
  // desactualizaba sola. Sin declaración = acepta cualquiera (regla del API).
  if (!familia || !perfil) return true;
  const tipos = familia.tiposPerfilCompatibles;
  if (!tipos || tipos.length === 0) return true;
  return tipos.includes(String(perfil.tipoPerfil ?? "").toUpperCase());
}

function maquinaCompatibleConFamilia(
  familia:
    | Pick<FamiliaListItem, "tiposPerfilCompatibles" | "nestingConfig">
    | null
    | undefined,
  plantillasCompatibles: string[] | undefined,
  maquina: MaquinaLookup,
) {
  if (!(plantillasCompatibles ?? []).includes(maquina.plantilla)) return false;
  // [Tanda B] Exigencia del corte sobre rollo (estrategia declarada) en
  // impresora híbrida — espeja el guard del backend (config-pasos.service).
  if (familia?.nestingConfig?.estrategia !== "corte_rollo") return true;
  if (
    String(maquina.plantilla).toUpperCase() !==
    "IMPRESORA_GRAN_FORMATO_POR_AREA"
  )
    return true;
  const params = maquina.parametrosTecnicosJson ?? {};
  return (
    params.soportaCorteIntegrado === true &&
    maquina.perfilesOperativos.some((perfil) =>
      perfilCompatibleConFamilia(familia, perfil),
    )
  );
}

/**
 * Rediseño UI — color e iniciales del chip de tecnología en las tiles de
 * máquinas candidatas (paleta del mockup "Máquina y perfil").
 */
const TECH_CHIP_STYLES: Record<string, { bg: string; ini: string }> = {
  uv: { bg: "#6d4bd8", ini: "UV" },
  dtf_textil: { bg: "#d9803a", ini: "DT" },
  dtf_uv: { bg: "#c9599a", ini: "DU" },
  inkjet: { bg: "#2f8fd6", ini: "IJ" },
  eco_solvente: { bg: "#3aa38c", ini: "ES" },
  laser: { bg: "#526075", ini: "LS" },
  latex: { bg: "#4c9f70", ini: "LX" },
  sublimacion: { bg: "#a3557f", ini: "SB" },
};

function techChipStyle(tech: string | null) {
  return (tech && TECH_CHIP_STYLES[tech]) || { bg: "#6e6e76", ini: "M" };
}

/** Chip de materia prima: color por categoría + iniciales (mockup Materiales). */
function matChipStyle(nombre: string, familia?: string | null) {
  const base = `${familia ?? ""} ${nombre}`.toLowerCase();
  const bg = /lona|mesh/.test(base)
    ? "#3aa38c"
    : /vinilo/.test(base)
      ? "#6d4bd8"
      : /papel|cartulina|obra/.test(base)
        ? "#2f8fd6"
        : /film|laminad|transfer/.test(base)
          ? "#a3557f"
          : /placa|rigido|rígido|pvc|mdf|acril/.test(base)
            ? "#d9803a"
            : "#6e6e76";
  const palabras = nombre.trim().split(/\s+/);
  const ini =
    palabras.length >= 2
      ? `${palabras[0][0] ?? ""}${palabras[1][0] ?? ""}`.toUpperCase()
      : nombre.slice(0, 2).toUpperCase();
  return { bg, ini };
}

/** Swatches de tinta para las pills de modo de color (visual only). */
function modoColorSwatches(value: string): Array<{ bg: string; borde?: boolean }> {
  const v = value.toUpperCase();
  if (v.includes("SIN_IMPRESION") || v === "SIN IMPRESIÓN") return [];
  const sw: Array<{ bg: string; borde?: boolean }> = [];
  if (v.includes("CMYK")) {
    sw.push(
      { bg: "#22b8e0" },
      { bg: "#e0339b" },
      { bg: "#f2c11c" },
      { bg: "#1b1b20" },
    );
  } else if (v.includes("BN") || v.includes("NEGRO")) {
    sw.push({ bg: "#1b1b20" });
  }
  if (v.includes("BLANCO") || v.includes("WHITE")) {
    sw.push({ bg: "#ffffff", borde: true });
  }
  if (v.includes("BARNIZ")) {
    sw.push({ bg: "linear-gradient(135deg, #e5e7eb, #9ca3af)" });
  }
  return sw;
}

function maquinaCandidataCompatibleConFamilia(
  familia:
    | Pick<FamiliaListItem, "tiposPerfilCompatibles" | "nestingConfig">
    | null
    | undefined,
  plantillasCompatibles: string[] | undefined,
  maquina: MaquinaLookup,
) {
  return (
    maquinaCompatibleConFamilia(familia, plantillasCompatibles, maquina) &&
    maquina.perfilesOperativos.some((perfil) =>
      perfilCompatibleConFamilia(familia, perfil),
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
      perfilDefaultPorModo?: Record<string, string> | null;
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
      // Claves del mapa por-modo normalizadas (mismos códigos que el motor);
      // entradas vacías → null.
      perfilDefaultPorModo: (() => {
        const mapa = candidata.perfilDefaultPorModo;
        if (!mapa || typeof mapa !== "object") return null;
        const saneado: Record<string, string> = {};
        for (const [modo, perfilId] of Object.entries(mapa)) {
          const clave = normalizeModoColor(modo);
          if (clave && typeof perfilId === "string" && perfilId) {
            saneado[clave] = perfilId;
          }
        }
        return Object.keys(saneado).length > 0 ? saneado : null;
      })(),
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
    perfilDefaultPorModo: candidata.perfilDefaultPorModo ?? null,
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
  // El trigger del select usa este label y lo TRUNCA en una línea. Con el
  // "Etiqueta: valor · …" completo se leía como un volcado de datos (parecía un
  // <select> nativo). Dejamos sólo los valores → un resumen corto que trunca
  // con gracia; el dropdown sigue mostrando los atributos como chips (details).
  const variantLabel =
    variantDetails.length > 0
      ? variantDetails.map((detail) => detail.value).join(" · ")
      : (variante.nombreVariante ?? variante.sku);

  return {
    value: variante.id,
    label: variantLabel,
    // El SKU y el precio de referencia sobran en la lista: los tags (details)
    // ya dicen la variante. El label se oculta en el ítem para no repetir los
    // tags (el trigger sí lo usa).
    details: variantDetails,
    hideLabelInItem: variantDetails.length > 0,
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

// ─── Helpers de JSON ───────────────────────────────────────────────

function jsonToText(value: Record<string, unknown> | null | undefined): string {
  if (!value || Object.keys(value).length === 0) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

// B.3.3 — Herencia explícita: `origen { rutaPasoId, capacidad }` vive dentro
// del JSON de "Config de cantidad" (el textarea sigue siendo la fuente al
// guardar); estos helpers leen/escriben esa clave sin pisar el resto.
type OrigenHerencia = { rutaPasoId: string; capacidad: string };

// Herencia por MAGNITUD PUBLICADA (H6): "hereda «puntos de soldadura» del que
// lo publique". El motor la resuelve leyendo la key plana del jobContext — es
// el patrón que usan los pasos de cartelería (soldadura←puntos, pintura←m²).
type SeleccionHerencia = OrigenHerencia | { campoOutput: string };

function leerOrigenHerencia(texto: string): Partial<OrigenHerencia> | null {
  const r = textToJson(texto);
  if (!r.ok || !r.value) return null;
  const o = r.value.origen;
  return o && typeof o === "object" && !Array.isArray(o)
    ? (o as Partial<OrigenHerencia>)
    : null;
}

function leerCampoOutputHerencia(texto: string): string | null {
  const r = textToJson(texto);
  if (!r.ok || !r.value) return null;
  const c = r.value.campoOutput;
  return typeof c === "string" && c.trim() ? c : null;
}

function escribirOrigenHerencia(
  texto: string,
  sel: SeleccionHerencia | null,
): string {
  const r = textToJson(texto);
  const obj: Record<string, unknown> = r.ok && r.value ? { ...r.value } : {};
  // Las dos formas son mutuamente excluyentes: al fijar una, se limpia la otra.
  delete obj.origen;
  delete obj.campoOutput;
  if (sel && "campoOutput" in sel) obj.campoOutput = sel.campoOutput;
  else if (sel) obj.origen = sel;
  return jsonToText(obj);
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

// G-F3 sub-fase 2 — borrador de config para un paso extra (mismo shape que
// un config-paso, para reusar el panel). Slots/candidatas quedan vacíos hasta
// la sub-fase 3 (se persisten aparte en el JSON embebido del extra).
function buildExtraConfigDraft(
  extra: PasoExtra,
  familia: CatalogoFamilias["familias"][number] | undefined,
): UpsertConfigPasoPayload {
  const num = (v: string | null) => (v != null ? Number(v) : null);
  return {
    rutaPasoId: extra.id,
    modoActivacion:
      extra.modoActivacion ?? familia?.modoActivacionDefault ?? "OBLIGATORIO",
    condicionActivacionJson:
      (extra.condicionActivacionJson as Record<string, unknown> | null) ?? null,
    modoTiempo:
      extra.modoTiempo ??
      (familia?.modosTiempoSoportados.length === 1
        ? familia.modosTiempoSoportados[0]
        : null),
    mecanismoCantidad:
      (extra.mecanismoCantidad?.trim() || null) ??
      getDefaultMecanismoCantidad(
        familia,
        familia?.mecanismosCantidadSoportados ?? [],
      ),
    mecanismoCantidadConfigJson:
      (extra.mecanismoCantidadConfigJson as Record<string, unknown> | null) ??
      null,
    multiplicadoresActivos: extra.multiplicadoresActivos ?? [],
    paramsPasoJson:
      (extra.paramsPasoJson as Record<string, unknown> | null) ?? null,
    nombreVisible: extra.nombreVisible ?? null,
    maquinaM1Id: extra.maquinaM1Id ?? null,
    perfilM1Id: extra.perfilM1Id ?? null,
    centroCostoId: extra.maquinaM1Id ? null : (extra.centroCostoId ?? null),
    setupOverrideMin: num(extra.setupOverrideMin),
    cleanupOverrideMin: num(extra.cleanupOverrideMin),
    tiempoFijoOverrideMin: num(extra.tiempoFijoOverrideMin),
    // Sub-fase 3: slots persistidos en configSlotsMaterialesJson (mismo shape).
    slotsMateriales: Array.isArray(extra.configSlotsMaterialesJson)
      ? (extra.configSlotsMaterialesJson as UpsertConfigPasoPayload["slotsMateriales"])
      : [],
    // M-2: candidatas persistidas en configMaquinasCandidatasJson (mismo shape).
    maquinasCandidatas: normalizeMaquinasCandidatas(
      Array.isArray(extra.configMaquinasCandidatasJson)
        ? (extra.configMaquinasCandidatasJson as NonNullable<
            UpsertConfigPasoPayload["maquinasCandidatas"]
          >)
        : [],
    ),
  };
}

function buildExtraJsonText(extra: PasoExtra): {
  params: string;
  mecanismo: string;
} {
  return {
    params: jsonToText(
      stripNestingConfig(
        extra.paramsPasoJson as Record<string, unknown> | null | undefined,
      ),
    ),
    mecanismo: jsonToText(
      extra.mecanismoCantidadConfigJson as
        | Record<string, unknown>
        | null
        | undefined,
    ),
  };
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

/**
 * Config de tiempo manual por paso (`paramsPasoJson.tiempoManual`).
 * Ver docs/tiempo-manual-por-paso-diseno.md: el comercial estima el tiempo
 * al cotizar y el motor lo usa como runMin (gana sobre cualquier modoTiempo).
 */
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

// Orden canónico de los modos: de menos a más tinta (sin impresión → 1 tinta →
// CMYK → refuerzos → completo). El orden natural (carga de perfiles) dejaba
// "CMYK + Blanco" antes que "CMYK", que se lee al revés. Debe coincidir con el
// del sheet de Agregar producto (MODO_COLOR_ORDEN en agregar-producto-sheet).
const MODO_COLOR_ORDEN = [
  "SIN_IMPRESION",
  "BN",
  "CMYK",
  "CMYK+blanco",
  "CMYK+barniz",
  "CMYK+blanco+barniz",
];

function ordenarModosColor<T extends { value: string }>(options: T[]): T[] {
  const rango = (option: T) => {
    const index = MODO_COLOR_ORDEN.indexOf(
      normalizeModoColor(option.value) ?? option.value,
    );
    // Modos fuera de la escala (custom del tenant) al final, en su orden.
    return index === -1 ? MODO_COLOR_ORDEN.length : index;
  };
  return options
    .map((option, index) => ({ option, index }))
    .sort((a, b) => rango(a.option) - rango(b.option) || a.index - b.index)
    .map((item) => item.option);
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
  if (localOptions.length > 0) return ordenarModosColor(localOptions);
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
  return ordenarModosColor(options);
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

function panelizadoAplica(
  familia: Pick<FamiliaListItem, "nestingConfig"> | null | undefined,
  nestingConfig: Record<string, unknown>,
  maquina:
    | { parametrosTecnicosJson?: Record<string, unknown> | null }
    | null
    | undefined,
  tieneSustratoRollo: boolean,
) {
  // [Tanda B] Panelizado = impresión sobre material continuo (declarado).
  if (familia?.nestingConfig?.superficie !== "segun_material") {
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
  familia: Pick<FamiliaListItem, "nestingConfig"> | null | undefined,
) {
  // [Tanda B] Sólo el acomodado sobre material continuo conserva panelizado.
  if (familia?.nestingConfig?.superficie === "segun_material")
    return nestingConfig;
  if (!("panelizado" in nestingConfig)) return nestingConfig;
  const next = { ...nestingConfig };
  delete next.panelizado;
  return next;
}

function defaultNestingSeparationForFamily(
  familia: Pick<FamiliaListItem, "separacionNestingDefaultMm"> | null | undefined,
) {
  // [Tanda B] La ficha declara la separación default; antes 5 mm cableados.
  return familia?.separacionNestingDefaultMm ?? 0;
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
  return String(n / 10).replace(".", ",");
}

function decimalInputText(value: unknown) {
  const n = readOptionalNumber(value);
  return n === undefined ? "" : String(n).replace(".", ",");
}

function cmInputToMm(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed * 10 : null;
}

function parseLocalizedDecimalInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /[.,]$/.test(trimmed)) return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function DecimalDraftInput({
  value,
  onValueChange,
  onBlurValue,
  ...props
}: Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onBlur"
> & {
  value: number | string | null | undefined;
  onValueChange: (value: number | null) => void;
  onBlurValue?: (value: number | null) => void;
}) {
  const externalText = value == null ? "" : String(value);
  const [draft, setDraft] = React.useState(externalText);
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) setDraft(externalText);
  }, [externalText, focused]);

  return (
    <input
      {...props}
      inputMode="decimal"
      value={draft}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onChange={(event) => {
        const raw = event.target.value;
        // Permite estados intermedios necesarios para escribir con teclado
        // español: "4," debe permanecer visible hasta que llegue el decimal.
        if (raw !== "" && !/^\d*(?:[.,]\d*)?$/.test(raw)) return;
        setDraft(raw);
        if (raw === "") {
          onValueChange(null);
          return;
        }
        const parsed = parseLocalizedDecimalInput(raw);
        if (parsed !== null) onValueChange(parsed);
      }}
      onBlur={(event) => {
        const parsed = parseLocalizedDecimalInput(event.target.value);
        if (parsed !== null) onValueChange(parsed);
        onBlurValue?.(parsed);
        setFocused(false);
      }}
    />
  );
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

function getPliegoOrigenCosto(
  pliegoImpresion: Record<string, unknown>,
): "derivado" | "por_candidato" {
  return pliegoImpresion.origenCosto === "por_candidato"
    ? "por_candidato"
    : "derivado";
}

function getCandidatoMateriaPrimaVarianteId(
  candidato: Record<string, unknown>,
): string | null {
  return typeof candidato.materiaPrimaVarianteId === "string" &&
    candidato.materiaPrimaVarianteId.trim()
    ? candidato.materiaPrimaVarianteId
    : null;
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
  onDeselect,
  pinnedItems,
  renderDetail,
}: {
  compatibilidad?: SlotCompatibilidad;
  placeholder: string;
  selectedIds?: string[];
  onSelect: (materiaPrima: MateriaPrimaBusquedaItem) => void;
  /** Con esto, la fila seleccionada se puede DESELECCIONAR desde la lista y
   *  su detalle se abre inline (modo unificado, como el diseño). */
  onDeselect?: (materiaPrimaId: string) => void;
  /** Materiales ya elegidos: se fijan arriba aunque no matcheen la búsqueda. */
  pinnedItems?: MateriaPrimaBusquedaItem[];
  /** Detalle inline debajo de una fila seleccionada (variantes, default…). */
  renderDetail?: (item: MateriaPrimaBusquedaItem) => React.ReactNode;
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

  // Modo unificado (diseño "Materiales que consume"): los elegidos van fijos
  // arriba, cada fila es un check que agrega/saca, y el detalle se abre inline.
  if (renderDetail) {
    const pinned = pinnedItems ?? [];
    const pinnedIds = new Set(pinned.map((it) => it.id));
    // Tal cual el buscador de máquinas (pedido del usuario): un SelectBuscable
    // con dropdown que abre al click (sin listar todo inline), y los materiales
    // ELEGIDOS como filas abajo con su detalle y "Quitar". La búsqueda recarga
    // async (onBuscar → setQuery) para no perder el server-side.
    const opcionesAgregar = items
      .filter((it) => !pinnedIds.has(it.id))
      .map((it) => ({
        value: it.id,
        label: it.nombre,
        grupo: humanizeEnumLabel(it.familia) || null,
        detalle:
          [humanizeEnumLabel(it.subfamilia), ...materialRowSpecChips(it)]
            .filter(Boolean)
            .join(" · ") || null,
      }));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SelectBuscable
          value=""
          onChange={(id) => {
            const mat = items.find((it) => it.id === id);
            if (mat) onSelect(mat);
          }}
          onBuscar={(q) => setQuery(q)}
          opciones={opcionesAgregar}
          placeholder={
            loading && items.length === 0
              ? "Cargando materias compatibles…"
              : opcionesAgregar.length === 0 && pinned.length > 0
                ? "Todas las compatibles ya están agregadas"
                : "Agregar materia prima…"
          }
          placeholderBusqueda={placeholder}
          vacio={loading ? "Buscando…" : "Sin materias primas que coincidan."}
          ariaLabel="Agregar materia prima al paso"
          minimoParaBuscar={0}
          disabled={loading && items.length === 0}
        />
        {pinned.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted-text, #6e6e76)" }}>
            Todavía no agregaste materiales. Buscá arriba y agregá los que usa
            este paso.
          </p>
        ) : (
          <div
            style={{
              border: "1px solid var(--hairline, #e5e2db)",
              borderRadius: 9,
              overflow: "hidden",
            }}
          >
            {pinned.map((item, i) => {
              const chip = matChipStyle(item.nombre, item.familia);
              const meta = [
                humanizeEnumLabel(item.familia),
                humanizeEnumLabel(item.subfamilia),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <React.Fragment key={item.id}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      borderTop:
                        i > 0
                          ? "1px solid var(--hairline, #eeebe4)"
                          : undefined,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        flexShrink: 0,
                        display: "grid",
                        placeItems: "center",
                        fontFamily: "var(--font-mono, ui-monospace)",
                        fontSize: 10,
                        fontWeight: 500,
                        letterSpacing: "0.02em",
                        background: "var(--fg, #14141a)",
                        color: "#fff",
                      }}
                    >
                      {chip.ini}
                    </span>
                    <span
                      className="ps-mat-info"
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      <span className="ps-mat-nm block truncate">
                        {item.nombre}
                      </span>
                      <span className="ps-mat-meta block truncate">{meta}</span>
                    </span>
                    {/* Sin chips de medida/“N variantes” acá: la fila ya elegida
                        muestra su detalle (variante + medidas) abajo; repetirlo
                        en el encabezado era ruido (feedback del usuario). */}
                    {onDeselect ? (
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: 12, flexShrink: 0 }}
                        onClick={() => onDeselect(item.id)}
                      >
                        Quitar
                      </button>
                    ) : null}
                  </div>
                  <div
                    style={{
                      padding: "10px 12px 12px 48px",
                      background: "var(--surface-2, #fafaf9)",
                      borderTop: "1px solid var(--hairline, #eeebe4)",
                    }}
                  >
                    {renderDetail(item)}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="ps-search">
        <SearchIcon className="size-[15px]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
        />
      </div>
      <div className="ps-mat-list max-h-72 overflow-auto pr-0.5">
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
            const chip = matChipStyle(item.nombre, item.familia);
            const meta = [
              humanizeEnumLabel(item.familia),
              humanizeEnumLabel(item.subfamilia),
            ]
              .filter(Boolean)
              .join(" · ");
            const specs = materialRowSpecChips(item);
            return (
              <button
                key={item.id}
                type="button"
                className="ps-mat"
                onClick={() => {
                  if (!selected) onSelect(item);
                }}
                disabled={selected}
              >
                <span
                  aria-hidden
                  style={{
                    width: 15,
                    height: 15,
                    borderRadius: 4,
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    border: selected
                      ? "1.5px solid var(--fg, #14141a)"
                      : "1.5px solid var(--hairline-strong, #c8c4ba)",
                    background: selected ? "var(--fg, #14141a)" : "transparent",
                    color: "#fff",
                  }}
                >
                  {selected ? (
                    <CheckIcon className="size-2.5" strokeWidth={3.4} />
                  ) : null}
                </span>
                <span
                  className="ps-mat-chip"
                  style={{ background: chip.bg }}
                >
                  {chip.ini}
                </span>
                <span className="ps-mat-info">
                  <span className="ps-mat-nm block truncate">
                    {item.nombre}
                  </span>
                  <span className="ps-mat-meta block truncate">{meta}</span>
                </span>
                <span className="hidden items-center gap-1.5 sm:flex">
                  {specs.map((spec) => (
                    <span key={spec} className="ps-spec-chip">
                      {spec}
                    </span>
                  ))}
                </span>
                <span
                  className={`ps-mat-add ${selected ? "sel" : ""}`}
                >
                  {selected ? (
                    <>
                      <CheckIcon className="size-3" strokeWidth={2.4} />
                      Seleccionado
                    </>
                  ) : (
                    <>
                      <PlusIcon className="size-3" strokeWidth={2.4} />
                      Seleccionar
                    </>
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/** "SUSTRATO_ROLLO_FLEXIBLE" → "Sustrato rollo flexible" (meta de la fila). */
function humanizeEnumLabel(value: string | null | undefined) {
  if (!value) return "";
  const limpio = value.replace(/_/g, " ").trim().toLowerCase();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

/** Hasta 3 chips de especificación de la primera variante (mockup Materiales). */
function materialRowSpecChips(item: MateriaPrimaBusquedaItem): string[] {
  const variante = item.variantes[0];
  if (!variante) return [];
  const summary = getVariantAttributeSummary(variante);
  const chips: string[] = [];
  const medida = getVariantMeasureLabel(variante, item.templateId);
  if (medida) chips.push(medida);
  if (summary.espesor != null) chips.push(`${formatNumber(summary.espesor)} mm`);
  if (summary.color) chips.push(summary.color);
  if (item.variantes.length > 1) {
    chips.push(`${item.variantes.length} variantes`);
  }
  return chips.slice(0, 3);
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

// Normaliza la unidad de UNA dimensión para el listado: mm → cm (los mm se leen
// raro en materiales grandes), y m/cm quedan como están. Devuelve "N sym" — con
// la unidad SIEMPRE, también en la primera medida.
function formatMedidaDimension(
  raw: unknown,
  unit: string | undefined,
): string | null {
  const value =
    typeof raw === "string" ? Number(raw.replace(",", ".")) : Number(raw);
  if (!Number.isFinite(value)) return null;
  if (unit === "mm") return `${formatNumber(value / 10)} cm`;
  return unit ? `${formatNumber(value)} ${unit}` : formatNumber(value);
}

// La medida del material en el listado ("Ancho × Largo"). Antes pegaba "m" al
// final y nada en la primera medida — un rollo de film DTF (ancho en mm, largo
// en m) salía "300 x 100 m", como si 300 fueran metros. Ahora lee la unidad de
// cada dimensión del template y la muestra en ambas, normalizando mm → cm.
function getVariantMeasureLabel(
  variante: MaterialVariantSearchItem,
  templateId: string | null | undefined,
) {
  const attrs = asRecord(variante.atributosVarianteJson);
  const template = templateId ? getMateriaPrimaTemplate(templateId) : null;
  if (template) {
    const fieldByKey = new Map(
      template.camposTecnicos.map((field) => [field.key, field]),
    );
    const anchoField = fieldByKey.get("ancho");
    const segundoField = fieldByKey.get("alto") ?? fieldByKey.get("largo");
    const anchoTxt = anchoField
      ? formatMedidaDimension(attrs[anchoField.key], anchoField.unit)
      : null;
    const segundoTxt = segundoField
      ? formatMedidaDimension(attrs[segundoField.key], segundoField.unit)
      : null;
    if (anchoTxt && segundoTxt) return `${anchoTxt} × ${segundoTxt}`;
    if (anchoTxt) return anchoTxt;
    if (segundoTxt) return segundoTxt;
  }
  // Sin template: números crudos, sin inventar unidades.
  const summary = getVariantAttributeSummary(variante);
  if (summary.ancho !== null && summary.alto !== null) {
    return `${formatNumber(summary.ancho)} × ${formatNumber(summary.alto)}`;
  }
  if (summary.ancho !== null && summary.largo !== null) {
    return `${formatNumber(summary.ancho)} × ${formatNumber(summary.largo)}`;
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
      <div className="space-y-1.5">
        <div className="text-foreground text-xs font-semibold">Color</div>
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
                aria-pressed={active}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "border-foreground bg-foreground text-white shadow-sm"
                    : "border-border bg-white/60 text-muted-foreground hover:border-foreground/30"
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
      <div className="space-y-1.5">
        <div className="text-foreground text-xs font-semibold">Espesor</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {visibleVariants.map(({ variante, summary }) => {
            const checked = enabledVariantIds.has(variante.id);
            const medida = getVariantMeasureLabel(variante, materiaPrima.templateId);
            const esDefault = candidate.defaultVarianteId === variante.id;
            return (
              <button
                key={variante.id}
                type="button"
                aria-pressed={checked}
                onClick={() =>
                  onChange(
                    patchEnabledVariantIds(candidate, variante.id, !checked),
                  )
                }
                className={`min-w-0 rounded-lg border px-3 py-2.5 text-left text-xs transition ${
                  checked
                    ? "border-foreground bg-white shadow-sm"
                    : "border-border bg-white/60 text-muted-foreground hover:border-foreground/30"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-semibold text-foreground">
                    {summary.espesor !== null
                      ? `${formatNumber(summary.espesor)} mm`
                      : variante.nombreVariante || variante.sku}
                  </span>
                  <span
                    aria-hidden
                    className={`flex size-4 shrink-0 items-center justify-center rounded-full border transition ${
                      checked
                        ? "border-foreground bg-foreground text-white"
                        : "border-border"
                    }`}
                  >
                    {checked ? (
                      <CheckIcon className="size-2.5" strokeWidth={3} />
                    ) : null}
                  </span>
                </span>
                {medida ? (
                  <span className="mt-0.5 block truncate text-muted-foreground">
                    {medida}
                  </span>
                ) : null}
                {esDefault ? (
                  <span className="mt-1.5 inline-flex rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Predeterminada
                  </span>
                ) : null}
              </button>
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
        /** [Tanda D] Validación genérica de params requeridos de la ficha. */
        editorParamsGenerico?: boolean;
        paramsPasoSchema?: FamiliaListItem["paramsPasoSchema"];
        /** E.1 — defaults declarados: lo que cubren no se advierte. */
        defaults?: {
          centroCostoId: string | null;
          productividadHora: number | null;
          tiempoFijoMin: number | null;
        } | null;
      }
    | undefined,
  contexto?: { familiaCodigo?: string },
): TabValidacion {
  const errores: string[] = [];
  const warnings: string[] = [];

  // Params del oficio: el backend CORTA la cotización si un param REQUERIDO
  // sin default de fábrica falta (agrandaría nada y cobraría de menos en
  // silencio). Se adelanta acá para que el modelador lo vea al configurar y
  // no al cotizar — y la lista sale de la FICHA (paramsPasoSchema), no de
  // nombres de familia. [Tanda D: eran dos bloques hardcodeados]
  if (familia?.editorParamsGenerico) {
    const params = asRecord(cfg.paramsPasoJson);
    for (const param of familia.paramsPasoSchema ?? []) {
      if (!param.requerido || param.default !== undefined) continue;
      if (param.visibleCuando) {
        const controlador = familia.paramsPasoSchema?.find(
          (candidate) => candidate.campo === param.visibleCuando?.campo,
        );
        const valorControlador =
          params[param.visibleCuando.campo] ?? controlador?.default;
        if (valorControlador !== param.visibleCuando.valor) continue;
      }
      const valor = params[param.campo];
      const vacio =
        param.tipo === "multi-enum"
          ? !Array.isArray(valor) || valor.length === 0
          : param.tipo === "number"
            ? !readOptionalNumber(valor)
            : valor === undefined || valor === null || valor === "";
      if (vacio) errores.push(`Sin ${param.etiqueta.toLowerCase()}`);
    }
  }
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
  if (
    !cfg.maquinaM1Id &&
    cfg.modoTiempo &&
    !cfg.centroCostoId &&
    // E.1 — el default declarado del paso lo cubre: el motor lo aplica vivo.
    !familia?.defaults?.centroCostoId
  ) {
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
    const tiempoManualHabilitado =
      asRecord(params.tiempoManual).habilitado === true;
    if (
      !horasEstimadas &&
      !campoHoras &&
      !tiempoManualHabilitado &&
      (modoCalculo === "batch_time"
        ? !batchTimeMin || !batchSize
        : !productividad &&
          // E.1 — el ritmo default declarado del paso lo cubre.
          !familia?.defaults?.productividadHora)
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
          /** Selección por capacidad de fábrica (derivadores E2): con esto,
           *  un slot MOTOR_ELIGE_AUTO sin criterio NO está incompleto. */
          criterioCapacidadDefault?: unknown;
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
    if (
      slot.modoSeleccion === "HEREDA_DE_PASO" &&
      (!slot.heredaDeRutaPasoId || !slot.heredaDeSlotCodigo)
    ) {
      errores.push(
        `${slotDisplayName(slot, familia)}: sin paso/material de origen`,
      );
    }
    if (
      slot.modoSeleccion === "MOTOR_ELIGE_AUTO" &&
      !slot.criterioMotorAuto &&
      // La familia puede traer el criterio DE FÁBRICA (selección por
      // capacidad declarada, ej. la fuente LED por watts): sin criterio en
      // el slot NO falta nada — el motor usa el default declarado.
      !slotDecl?.criterioCapacidadDefault
    ) {
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
  familia?: Pick<FamiliaListItem, "codigo" | "nestingConfig">,
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
  if (familia?.nestingConfig?.estrategia === "pliego_digital" && cfg) {
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
      if (getPliegoOrigenCosto(pliegoImpresion) === "por_candidato") {
        const sinMateriaPrima = candidatosValidos.filter(
          (candidato) => !getCandidatoMateriaPrimaVarianteId(candidato),
        );
        if (sinMateriaPrima.length > 0) {
          warnings.push(
            `Origen de costo por candidato: ${sinMateriaPrima.length} candidato(s) sin materia prima asignada van a competir con el costo derivado del material del paso`,
          );
        }
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
  catalogoCargos = [],
  embedded = false,
  configuracionBase,
}: Props) {
  const router = useRouter();
  const familiasMap = React.useMemo(
    () => new Map(catalogoFamilias.familias.map((f) => [f.codigo, f])),
    [catalogoFamilias],
  );
  // Personalizaciones del producto: un paso puede tomar su medida de una de ellas.
  const personalizaciones = React.useMemo(
    () => getPersonalizaciones(producto.personalizacionesJson),
    [producto.personalizacionesJson],
  );
  // Variables de regla POR PASO: "Si <Tecnología> de <Paso>", "Si <Quién
  // hace el paso> de <Paso>". Una definición por variable con el selector de
  // paso aparte (no un item de lista por cada paso). Extensible: agregar
  // una variable nueva acá y su clave `<prefijo><configPasoId>` al jobContext.
  const technologyRuleFields = React.useMemo<RuleFieldDefinition[]>(() => {
    const pasos = rutaAlternativa.ruta.pasos.map((rutaPaso) => {
      const configPaso = rutaAlternativa.configPasos.find(
        (config) => config.rutaPasoId === rutaPaso.id,
      );
      const familia = familiasMap.get(rutaPaso.familiaCodigo);
      return {
        value: configPaso?.id ?? rutaPaso.id,
        label: `Paso ${rutaPaso.orden} · ${
          familia?.nombre ?? rutaPaso.familiaCodigo
        }`,
      };
    });
    if (pasos.length === 0) return [];
    return [
      {
        key: "tecnologia_",
        label: "Tecnología",
        kind: "select" as const,
        valueKind: "string" as const,
        operators: ["=", "!="] as RuleOperator[],
        options: TECHNOLOGY_RULE_OPTIONS,
        pasos,
      },
      {
        key: "quienHace_",
        label: "Quién hace el paso",
        kind: "select" as const,
        valueKind: "string" as const,
        operators: ["=", "!="] as RuleOperator[],
        options: [
          { value: "empresa", label: "Lo produce la empresa" },
          { value: "proveedor", label: "La hace un proveedor" },
        ],
        pasos,
      },
    ];
  }, [familiasMap, rutaAlternativa.configPasos, rutaAlternativa.ruta.pasos]);

  // Estado: por cada paso de la ruta, su configuración (existente o nueva)
  const [configs, setConfigs] = React.useState<ConfigState>(() => {
    const initial: ConfigState = {};
    for (const paso of rutaAlternativa.ruta.pasos) {
      const existente = rutaAlternativa.configPasos.find(
        (cp) => cp.rutaPasoId === paso.id,
      );
      const familia = familiasMap.get(paso.familiaCodigo);
      const base = !existente
        ? (familia?.configBase as Partial<UpsertConfigPasoPayload> | null)
        : null;
      initial[paso.id] = {
        rutaPasoId: paso.id,
        modoActivacion:
          existente?.modoActivacion ??
          base?.modoActivacion ??
          familia?.modoActivacionDefault ??
          "OBLIGATORIO",
        condicionActivacionJson:
          (existente?.condicionActivacionJson as
            Record<string, unknown> | null | undefined) ??
          base?.condicionActivacionJson ??
          null,
        modoTiempo:
          existente?.modoTiempo ??
          base?.modoTiempo ??
          (familia?.modosTiempoSoportados.length === 1
            ? familia.modosTiempoSoportados[0]
            : null),
        mecanismoCantidad:
          (existente?.mecanismoCantidad?.trim() || null) ??
          (base?.mecanismoCantidad?.trim() || null) ??
          getDefaultMecanismoCantidad(
            familia,
            familia?.mecanismosCantidadSoportados ?? [],
          ),
        mecanismoCantidadConfigJson:
          (existente?.mecanismoCantidadConfigJson as
            Record<string, unknown> | null | undefined) ??
          base?.mecanismoCantidadConfigJson ??
          null,
        multiplicadoresActivos:
          existente?.multiplicadoresActivos ??
          base?.multiplicadoresActivos ??
          [],
        paramsPasoJson:
          (existente?.paramsPasoJson as
            Record<string, unknown> | null | undefined) ??
          base?.paramsPasoJson ??
          null,
        nombreVisible:
          existente?.nombreVisible ??
          paso.nombreVisible ??
          base?.nombreVisible ??
          null,
        maquinaM1Id: existente?.maquinaM1?.id ?? base?.maquinaM1Id ?? null,
        perfilM1Id: existente?.perfilM1?.id ?? base?.perfilM1Id ?? null,
        centroCostoId: existente?.maquinaM1
          ? null
          : (existente?.centroCosto?.id ?? base?.centroCostoId ?? null),
        setupOverrideMin:
          existente?.setupOverrideMin ?? base?.setupOverrideMin ?? null,
        cleanupOverrideMin:
          existente?.cleanupOverrideMin ?? base?.cleanupOverrideMin ?? null,
        tiempoFijoOverrideMin:
          existente?.tiempoFijoOverrideMin ??
          base?.tiempoFijoOverrideMin ??
          null,
        dotacionOperarios:
          existente?.dotacionOperarios ?? base?.dotacionOperarios ?? 1,
        requiereRutaPasoIds: existente?.requiereRutaPasoIds ?? [],
        maquinasCandidatas: normalizeMaquinasCandidatas(
          existente?.maquinasCandidatas?.map((candidata, index) => ({
            maquinaId: candidata.maquinaId,
            perfilDefaultId:
              candidata.perfilDefaultId ?? candidata.perfilDefault?.id ?? null,
            perfilDefaultPorModo:
              ((
                candidata as {
                  perfilDefaultPorModoJson?: Record<string, string> | null;
                }
              ).perfilDefaultPorModoJson as Record<string, string> | null) ??
              null,
            modoColorAllowedModes: candidata.modoColorAllowedModes ?? [],
            esPreferida: candidata.esPreferida,
            orden: candidata.orden ?? index,
          })) ??
            base?.maquinasCandidatas ??
            [],
        ),
        slotsMateriales:
          existente?.slotsMateriales.map<UpsertSlotMaterialPayload>((s) => ({
            slotCodigo: s.slotCodigo,
            slotNombre: s.slotNombre ?? null,
            slotRol: (s.slotRol as UpsertSlotMaterialPayload["slotRol"]) ?? null,
            modoSeleccion: s.modoSeleccion as
              | "HARDCODED"
              | "COMERCIAL_ELIGE"
              | "MOTOR_ELIGE_AUTO"
              | "HEREDA_DE_PASO",
            heredaDeRutaPasoId: s.heredaDeRutaPasoId ?? null,
            heredaDeSlotCodigo: s.heredaDeSlotCodigo ?? null,
            criterioMotorAuto: s.criterioMotorAuto ?? null,
            materialVarianteId: s.materialVariante?.id ?? null,
            candidatos: s.candidatos.map((candidate) => ({
              materiaPrimaId: candidate.materiaPrimaId,
              defaultVarianteId: candidate.defaultVarianteId,
              orden: candidate.orden,
              varianteIds: candidate.variantes.map((item) => item.variante.id),
              todasLasVariantes: candidate.todasLasVariantes ?? false,
            })),
            formula: s.formula,
            cantidadFactor:
              s.cantidadFactor === null || s.cantidadFactor === undefined
                ? null
                : Number(s.cantidadFactor),
            cantidadBase: s.cantidadBase ?? null,
            aplicaMultiCaras: s.aplicaMultiCaras,
          })) ??
          base?.slotsMateriales ??
          [],
        // E.2 — config NUEVA de una familia declarada tercerizada: el panel
        // nace prendido y precargado desde los defaults (el producto pisa).
        tercerizado:
          existente?.tercerizado ??
          base?.tercerizado ??
          familia?.defaults?.tercerizado ??
          false,
        proveedorId:
          existente?.proveedorId ??
          base?.proveedorId ??
          (existente ? null : (familia?.defaults?.proveedorId ?? null)),
        fuenteCostoTercerizado:
          existente?.fuenteCostoTercerizado ??
          base?.fuenteCostoTercerizado ??
          (existente
            ? null
            : (familia?.defaults?.fuenteCostoTercerizado ?? null)),
        tercerizadoConfigJson:
          (existente?.tercerizadoConfigJson as
            | Record<string, unknown>
            | null
            | undefined) ??
          base?.tercerizadoConfigJson ??
          null,
        plazoProveedorDias:
          existente?.plazoProveedorDias ??
          base?.plazoProveedorDias ??
          (existente ? null : (familia?.defaults?.plazoProveedorDias ?? null)),
        tercerizadoEntradas:
          existente?.tercerizadoEntradas?.map((e) => ({
            valores: e.valoresJson,
            cantidad: e.cantidad,
            costo: Number(e.costo),
          })) ??
          base?.tercerizadoEntradas ??
          [],
      };
    }
    // G-F3 sub-fase 2 — borradores para los pasos extras (mismo panel).
    for (const extra of rutaAlternativa.pasosExtras ?? []) {
      initial[extra.id] = buildExtraConfigDraft(
        extra,
        familiasMap.get(extra.familiaCodigo),
      );
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
    // Hidrata el material de cada candidato al lookup. Sirve para los pasos de
    // la ruta base Y para los pasos extra (montaje, etc.): ambos traen sus
    // slotsMateriales hidratados por el detalle. Sin recorrer los extras, sus
    // candidatos guardados no encontraban su materia prima y el editor mostraba
    // el UUID crudo + "Variante no disponible".
    // Las variantes se FUSIONAN con lo que ya haya en el mapa: la misma
    // materia prima puede ser candidata en DOS slots con variantes distintas
    // (la chapa: hoja 1220×2440 en Chapa trasera, tarifa por m² en Cenefas).
    // Pisar la entrada dejaba al otro slot con chips ajenos y su
    // predeterminada como "Valor no disponible".
    const mergeVariantes = (
      previas: MateriaPrimaBusquedaItem["variantes"] | undefined,
      nuevas: MateriaPrimaBusquedaItem["variantes"],
    ) => {
      const porId = new Map((previas ?? []).map((v) => [v.id, v]));
      for (const v of nuevas) if (!porId.has(v.id)) porId.set(v.id, v);
      return [...porId.values()];
    };
    const hidratarSlots = (
      slotsMateriales: (typeof rutaAlternativa.configPasos)[number]["slotsMateriales"],
    ) => {
      for (const slot of slotsMateriales) {
        for (const candidate of slot.candidatos) {
          map[candidate.materiaPrimaId] = {
            id: candidate.materiaPrima.id,
            codigo: candidate.materiaPrima.codigo,
            nombre: candidate.materiaPrima.nombre,
            familia: candidate.materiaPrima.familia,
            subfamilia: candidate.materiaPrima.subfamilia,
            tipoTecnico: "",
            templateId: candidate.materiaPrima.templateId,
            variantes: mergeVariantes(
              map[candidate.materiaPrimaId]?.variantes,
              candidate.variantes.map((item) => item.variante),
            ),
          };
        }
        // Slot HARDCODED: el material fijo viene en `materialVariante`, no en
        // candidatos. Sin esto, el resumen del guiado no puede nombrarlo y
        // cae al opaco "Material definido" (H17 del relevamiento del editor).
        const fijo = slot.materialVariante;
        if (fijo?.materiaPrima) {
          map[fijo.materiaPrima.id] = {
            id: fijo.materiaPrima.id,
            codigo: fijo.materiaPrima.codigo,
            nombre: fijo.materiaPrima.nombre,
            familia: fijo.materiaPrima.familia,
            subfamilia: fijo.materiaPrima.subfamilia,
            tipoTecnico: "",
            templateId: fijo.materiaPrima.templateId,
            variantes: mergeVariantes(
              map[fijo.materiaPrima.id]?.variantes,
              fijo.materiaPrima.variantes ?? [],
            ),
          };
        }
      }
    };
    for (const config of rutaAlternativa.configPasos) {
      hidratarSlots(config.slotsMateriales);
    }
    for (const extra of rutaAlternativa.pasosExtras ?? []) {
      hidratarSlots(extra.slotsMateriales ?? []);
    }
    return map;
  });
  const [hardcodedMaterialSelections, setHardcodedMaterialSelections] =
    React.useState<Record<string, string>>({});
  // Picker de MP por candidato de pliego (origen de costo 'por_candidato'):
  // qué fila tiene el buscador abierto y la materia elegida a medio resolver
  // (cuando tiene varias variantes). Key: `${pasoId}:${indexCandidato}`.

  // JSON text por paso (sólo UI; al guardar se parsea de vuelta a objeto)
  const [jsonTexts, setJsonTexts] = React.useState<
    Record<string, { params: string; mecanismo: string }>
  >(() => {
    const map: Record<string, { params: string; mecanismo: string }> = {};
    for (const paso of rutaAlternativa.ruta.pasos) {
      const existente = rutaAlternativa.configPasos.find(
        (cp) => cp.rutaPasoId === paso.id,
      );
      const familia = familiasMap.get(paso.familiaCodigo);
      const base = !existente
        ? (familia?.configBase as Partial<UpsertConfigPasoPayload> | null)
        : null;
      const params = (existente?.paramsPasoJson ?? base?.paramsPasoJson) as
        Record<string, unknown> | null | undefined;
      map[paso.id] = {
        params: jsonToText(stripNestingConfig(params)),
        mecanismo: jsonToText(
          (existente?.mecanismoCantidadConfigJson ??
            base?.mecanismoCantidadConfigJson) as
            Record<string, unknown> | null | undefined,
        ),
      };
    }
    for (const extra of rutaAlternativa.pasosExtras ?? []) {
      map[extra.id] = buildExtraJsonText(extra);
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
  // G-F3: paso extra en edición. "new" = alta; PasoExtra = edición; null = panel base.
  const [editingExtra, setEditingExtra] = React.useState<
    PasoExtra | "new" | null
  >(null);
  const [ordenOptimista, setOrdenOptimista] = React.useState<string[] | null>(
    null,
  );
  const [pasoArrastradoId, setPasoArrastradoId] = React.useState<string | null>(
    null,
  );
  const [pasoDestinoId, setPasoDestinoId] = React.useState<string | null>(null);
  const [guardandoOrden, setGuardandoOrden] = React.useState(false);
  const pasosExtras = React.useMemo(
    () => rutaAlternativa.pasosExtras ?? [],
    [rutaAlternativa.pasosExtras],
  );
  // Sync: un extra creado después del mount (o traído por refresh) necesita su
  // borrador en `configs`/`jsonTexts` para poder editarse en el panel.
  React.useEffect(() => {
    setConfigs((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const extra of pasosExtras) {
        if (!next[extra.id]) {
          next[extra.id] = buildExtraConfigDraft(
            extra,
            familiasMap.get(extra.familiaCodigo),
          );
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setJsonTexts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const extra of pasosExtras) {
        if (!next[extra.id]) {
          next[extra.id] = buildExtraJsonText(extra);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rutaAlternativa.pasosExtras]);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  // E.3.2 v2 — el asistente guiado es un wizard FLOTANTE (feedback del
  // usuario: no mezclar guiado y detallado en la misma vista). Abre solo
  // cuando la alternativa está sin configurar; siempre disponible a botón.
  const [asistenteAbierto, setAsistenteAbierto] = React.useState(
    // Deshabilitado 2026-07-31: el asistente ya no auto-abre. Antes:
    //   () => rutaAlternativa.configPasos.length === 0
    false,
  );
  // Vista del panel del paso: el detallado clásico o el esquema guiado
  // EXPANDIDO (mismo cuerpo que el asistente, a página completa). Ambas
  // conviven mientras el usuario decide con cuál quedarse; la elección
  // se recuerda por navegador.
  const [vistaEditor, setVistaEditorState] = React.useState<
    "detallado" | "guiado"
  >("guiado");
  // La preferencia guardada se lee POST-hidratación: leer localStorage en
  // el estado inicial hacía divergir SSR y cliente (hydration mismatch).
  React.useEffect(() => {
    try {
      const guardada = window.localStorage.getItem("editorPasoVista");
      // Honrar AMBAS vistas guardadas (antes sólo restauraba "guiado" y la
      // elección "detallado" se perdía en cada recarga).
      if (guardada === "guiado" || guardada === "detallado") {
        setVistaEditorState(guardada);
      }
    } catch {
      // sin storage: queda el default
    }
  }, []);
  const setVistaEditor = (vista: "detallado" | "guiado") => {
    setVistaEditorState(vista);
    try {
      window.localStorage.setItem("editorPasoVista", vista);
    } catch {
      // sin storage (privado): la elección vive sólo en la sesión
    }
  };
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
          perfilCompatibleConFamilia(
            familiasMap.get(paso?.familiaCodigo ?? ""),
            perfil,
          ),
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
          perfilCompatibleConFamilia(
            familiasMap.get(paso?.familiaCodigo ?? ""),
            perfil,
          ),
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

  const setMaquinaCandidataPerfilPorModo = (
    rutaPasoId: string,
    maquinaId: string,
    modo: string,
    perfilId: string | null,
  ) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const current = cfg.maquinasCandidatas ?? [];
      const next = normalizeMaquinasCandidatas(
        current.map((candidata) => {
          if (candidata.maquinaId !== maquinaId) return candidata;
          const mapa = { ...(candidata.perfilDefaultPorModo ?? {}) };
          if (perfilId) mapa[modo] = perfilId;
          else delete mapa[modo];
          return {
            ...candidata,
            perfilDefaultPorModo:
              Object.keys(mapa).length > 0 ? mapa : null,
          };
        }),
      );
      return {
        ...prev,
        [rutaPasoId]: { ...cfg, maquinasCandidatas: next },
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

  // Cobertura de tóner por defecto del paso (láser). Vive en paramsPasoJson: se
  // guarda con el "Guardar paso" (currentParams) y el motor la lee por paso.
  const setCoberturaPaso = (rutaPasoId: string, nivel: string) => {
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      const params = asRecord(cfg.paramsPasoJson);
      const nextParams = { ...params, coberturaDefault: nivel };
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

  /**
   * Escribe los params del paso en el estado Y en el textarea del detallado.
   *
   * Los dos tienen que moverse juntos porque `guardarPaso` los MEZCLA
   * (`{...textarea, ...estado}`): si sólo se toca el estado, una clave BORRADA
   * desde el guiado —apagar "el comercial puede ajustar el tiempo", quitar los
   * niveles— reaparece desde el texto viejo al guardar y el cambio no persiste
   * nunca. Las claves que se agregan o cambian sí funcionaban; sólo el borrado
   * se perdía, que es lo que lo hacía difícil de ver.
   */
  const aplicarParamsPaso = (
    rutaPasoId: string,
    recalcular: (
      params: Record<string, unknown>,
    ) => Record<string, unknown> | null,
  ) => {
    // Actualización FUNCIONAL a propósito: leer `configs` del closure hacía que
    // dos cambios en el mismo tick (o un handler con estado viejo) pisaran lo
    // que el otro había escrito — y en params eso es perder config del paso.
    setConfigs((prev) => {
      const cfg = prev[rutaPasoId];
      if (!cfg) return prev;
      const siguiente = recalcular(asRecord(cfg.paramsPasoJson));
      // El texto se sincroniza acá, con el MISMO valor que va al estado. Es un
      // setState dentro de otro updater: se ejecuta más de una vez en dev, pero
      // siempre con el mismo resultado, así que es idempotente.
      setJsonTexts((textos) => ({
        ...textos,
        [rutaPasoId]: {
          ...textos[rutaPasoId],
          params: jsonToText(stripNestingConfig(siguiente)),
        },
      }));
      return {
        ...prev,
        [rutaPasoId]: { ...cfg, paramsPasoJson: siguiente },
      };
    });
  };

  const updateStepParams = (
    rutaPasoId: string,
    patch: Record<string, unknown>,
  ) => {
    aplicarParamsPaso(rutaPasoId, (previos) => {
      const params = { ...previos, ...patch };
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
      return Object.keys(params).length > 0 ? params : null;
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

  const updateTiempoManualConfig = (
    rutaPasoId: string,
    patch: Record<string, unknown>,
  ) => {
    aplicarParamsPaso(rutaPasoId, (params) => {
      const current = getTiempoManualConfig(params);
      const nextConfig = { ...current, ...patch };
      for (const key of Object.keys(nextConfig)) {
        const value = nextConfig[key];
        if (
          value === "" ||
          value === null ||
          value === undefined ||
          (typeof value === "number" && !Number.isFinite(value))
        ) {
          delete nextConfig[key];
        }
      }
      const nextParams =
        nextConfig.habilitado === true
          ? { ...params, tiempoManual: nextConfig }
          : Object.fromEntries(
              Object.entries(params).filter(([key]) => key !== "tiempoManual"),
            );
      return Object.keys(nextParams).length > 0 ? nextParams : null;
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
        // [Tanda B] La fórmula forzada la declara el SLOT de la ficha
        // (film de laminado → por metro lineal); antes copia local.
        formula:
          familiasMap
            .get(familiaCodigo ?? "")
            ?.slotsRequeridos?.find((slot) => slot.codigo === slotCodigo)
            ?.formulaForzada ?? "por_unidad_productiva",
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
    const extraGuardar = pasosExtras.find((e) => e.id === rutaPasoId) ?? null;
    const paso = rutaAlternativa.ruta.pasos.find((p) => p.id === rutaPasoId);
    const familiaCodigoGuardar =
      extraGuardar?.familiaCodigo ?? paso?.familiaCodigo;
    const familia = familiaCodigoGuardar
      ? familiasMap.get(familiaCodigoGuardar)
      : undefined;
    const noEjecutar = configs[rutaPasoId].modoActivacion === "NO_EJECUTAR";
    const cantidadRelevante =
      !noEjecutar && requiereMecanismoCantidad(configs[rutaPasoId], familia);
    const paramsRes = textToJson(jsonText.params);
    const mecanismoRes = cantidadRelevante
      ? textToJson(jsonText.mecanismo)
      : ({ ok: true, value: null } as const);
    if (!paramsRes.ok) {
      toast.error(`JSON inválido en "Params del paso": ${paramsRes.error}`);
      return false;
    }
    if (!mecanismoRes.ok) {
      toast.error(
        `JSON inválido en "Config de cantidad": ${mecanismoRes.error}`,
      );
      return false;
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
          return false;
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
        familia,
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
        familia?.esImpresion === true,
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
            : getDefaultT2ProductivityUnit(familia);
        const sourceOptions = getT2QuantitySourceOptions(
          unit,
          familia,
          paramsPasoJson,
        );
        const rawSource =
          typeof paramsPasoJson.productivityQuantitySource === "string"
            ? paramsPasoJson.productivityQuantitySource
            : getDefaultT2QuantitySource(familia, unit);
        const normalizedSource =
          familia?.ritmoDefault?.fuenteCantidad === "cantidad_montaje" &&
          unit === "unidades_h" &&
          rawSource === "cantidad"
            ? "cantidad_montaje"
            : rawSource;
        const rawTimeMode =
          typeof paramsPasoJson.timeCalculationMode === "string"
            ? paramsPasoJson.timeCalculationMode
            : getDefaultT2TimeCalculationMode(familia);
        paramsPasoJson.productivityUnit = unit;
        paramsPasoJson.timeCalculationMode =
          T2_TIME_CALCULATION_MODE_OPTIONS.some(
            (option) => option.value === rawTimeMode,
          )
            ? rawTimeMode
            : getDefaultT2TimeCalculationMode(familia);
        paramsPasoJson.productivityQuantitySource = sourceOptions.some(
          (option) => option.value === normalizedSource,
        )
          ? normalizedSource
          : getDefaultT2QuantitySource(familia, unit);
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
      const cfgActual = configs[rutaPasoId];
      const centroCostoIdEfectivo = cfgActual.maquinaM1Id
        ? null
        : (cfgActual.centroCostoId ?? null);
      const mecanismoCantidadEfectivo = cantidadRelevante
        ? (cfgActual.mecanismoCantidad ?? null)
        : null;
      const paramsPasoJsonEfectivo =
        Object.keys(paramsPasoJson).length > 0 ? paramsPasoJson : null;
      if (extraGuardar) {
        // Paso extra: mismo config computado, persistido vía el endpoint de
        // pasos-extras. Slots y candidatas M-2 se guardan embebidos en
        // configSlotsMaterialesJson / configMaquinasCandidatasJson.
        await actualizarPasoExtra(rutaPasoId, {
          // El input del nombre no trimea por tecla (se comía los espacios);
          // el valor se limpia acá, al persistir.
          nombreVisible: cfgActual.nombreVisible?.trim() || null,
          modoActivacion: cfgActual.modoActivacion ?? undefined,
          condicionActivacionJson,
          modoTiempo: cfgActual.modoTiempo ?? undefined,
          mecanismoCantidad: mecanismoCantidadEfectivo ?? undefined,
          mecanismoCantidadConfigJson: mecanismoRes.value ?? null,
          multiplicadoresActivos: cfgActual.multiplicadoresActivos ?? [],
          paramsPasoJson: paramsPasoJsonEfectivo ?? undefined,
          maquinaM1Id: cfgActual.maquinaM1Id ?? null,
          perfilM1Id: cfgActual.maquinaM1Id
            ? (cfgActual.perfilM1Id ?? null)
            : null,
          centroCostoId: centroCostoIdEfectivo,
          setupOverrideMin: cfgActual.setupOverrideMin ?? null,
          cleanupOverrideMin: cfgActual.cleanupOverrideMin ?? null,
          tiempoFijoOverrideMin: cfgActual.tiempoFijoOverrideMin ?? null,
          configSlotsMaterialesJson: cfgActual.slotsMateriales ?? [],
          configMaquinasCandidatasJson: cfgActual.maquinasCandidatas ?? [],
        });
      } else {
        const payload = {
          ...cfgActual,
          nombreVisible: cfgActual.nombreVisible?.trim() || null,
          centroCostoId: centroCostoIdEfectivo,
          condicionActivacionJson,
          mecanismoCantidad: mecanismoCantidadEfectivo,
          paramsPasoJson: paramsPasoJsonEfectivo,
          mecanismoCantidadConfigJson: mecanismoRes.value,
          requiereRutaPasoIds: configuracionBase
            ? []
            : cfgActual.requiereRutaPasoIds,
        };
        if (configuracionBase) {
          if (configuracionBase.origen === "sistema") {
            await guardarConfiguracionBaseFamiliaSistema(
              configuracionBase.familiaCodigo,
              payload,
            );
          } else {
            await guardarConfiguracionBasePasoTenant(
              configuracionBase.familiaCodigo,
              payload,
            );
          }
        } else {
          await upsertConfigPaso(rutaAlternativa.id, payload);
        }
      }
      setSavedConfigSnapshots((prev) => ({
        ...prev,
        [rutaPasoId]: configSnapshot(configs[rutaPasoId]),
      }));
      toast.success("Configuración guardada");
      router.refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
      return false;
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
    // Un paso tercerizado no se produce internamente: no aplican las
    // validaciones de máquina/material/producción (su costo lo valida el backend).
    const sinValidacionProduccion = noEjecutar || cfg.tercerizado;
    const valBasico = sinValidacionProduccion
      ? { errores: [], warnings: [] }
      : validarBasico(cfg, familia, { familiaCodigo: paso.familiaCodigo });
    const valMateriales = sinValidacionProduccion
      ? { errores: [], warnings: [] }
      : validarMateriales(cfg, familia);
    const valAvanzado = sinValidacionProduccion
      ? { errores: [], warnings: [] }
      : validarAvanzado(
          jsonText.params,
          cantidadRelevante ? jsonText.mecanismo : "",
          cfg,
          familia,
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
  // G-F3 sub-fase 2 — el paso activo puede ser un paso base o un paso extra.
  // Para el panel de config los tratamos igual (mismo borrador `configs`).
  const activeExtra = pasosExtras.find((e) => e.id === activePasoId) ?? null;
  const activePaso = activeExtra
    ? {
        id: activeExtra.id,
        orden: 0,
        familiaCodigo: activeExtra.familiaCodigo,
        icono: null,
        activo: activeExtra.activo,
      }
    : (rutaAlternativa.ruta.pasos.find((p) => p.id === activePasoId) ??
      rutaAlternativa.ruta.pasos[0]);
  // Secuencia unificada (base + extras por posición) para numerar el display.
  const pasosUnificados = React.useMemo(() => {
    const ordenBase = new Map(
      rutaAlternativa.configPasos.map((config) => [
        config.rutaPasoId,
        config.ordenFlujo,
      ]),
    );
    const hayOrdenExplicito =
      [...ordenBase.values()].some((orden) => orden != null) ||
      pasosExtras.some((extra) => extra.ordenFlujo != null);
    if (hayOrdenExplicito) {
      const ids = [
        ...rutaAlternativa.ruta.pasos.map((paso) => paso.id),
        ...pasosExtras.map((extra) => extra.id),
      ].sort((a, b) => {
        const extraA = pasosExtras.find((extra) => extra.id === a);
        const extraB = pasosExtras.find((extra) => extra.id === b);
        const ordenA = ordenBase.get(a) ?? extraA?.ordenFlujo ?? null;
        const ordenB = ordenBase.get(b) ?? extraB?.ordenFlujo ?? null;
        if (ordenA == null && ordenB == null) return 0;
        if (ordenA == null) return 1;
        if (ordenB == null) return -1;
        return ordenA - ordenB;
      });
      if (
        ordenOptimista?.length === ids.length &&
        ordenOptimista.every((id) => ids.includes(id))
      ) {
        return ordenOptimista;
      }
      return ids;
    }

    const alInicio = pasosExtras
      .filter((e) => e.insertarDespuesDeRutaPasoId == null)
      .sort((a, b) => a.ordenInterno - b.ordenInterno);
    const despues = new Map<string, typeof pasosExtras>();
    for (const e of pasosExtras) {
      if (e.insertarDespuesDeRutaPasoId == null) continue;
      const arr = despues.get(e.insertarDespuesDeRutaPasoId) ?? [];
      arr.push(e);
      despues.set(e.insertarDespuesDeRutaPasoId, arr);
    }
    const ids: string[] = alInicio.map((e) => e.id);
    for (const bp of [...rutaAlternativa.ruta.pasos].sort(
      (a, b) => a.orden - b.orden,
    )) {
      ids.push(bp.id);
      for (const e of (despues.get(bp.id) ?? []).sort(
        (a, b) => a.ordenInterno - b.ordenInterno,
      )) {
        ids.push(e.id);
      }
    }
    if (
      ordenOptimista?.length === ids.length &&
      ordenOptimista.every((id) => ids.includes(id))
    ) {
      return ordenOptimista;
    }
    return ids;
  }, [
    rutaAlternativa.ruta.pasos,
    rutaAlternativa.configPasos,
    pasosExtras,
    ordenOptimista,
  ]);

  const guardarOrdenPasos = async (pasoIds: string[]) => {
    if (guardandoOrden || pasoIds.join("|") === pasosUnificados.join("|"))
      return;
    const anterior = [...pasosUnificados];
    setOrdenOptimista(pasoIds);
    setGuardandoOrden(true);
    try {
      await reordenarPasosRutaAlt(rutaAlternativa.id, pasoIds);
      toast.success("Orden de la ruta actualizado");
      router.refresh();
    } catch (error) {
      setOrdenOptimista(anterior);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo cambiar el orden de la ruta",
      );
    } finally {
      setGuardandoOrden(false);
      setPasoArrastradoId(null);
      setPasoDestinoId(null);
    }
  };

  const moverPaso = (origenId: string, destinoId: string, despues: boolean) => {
    if (origenId === destinoId) return;
    const siguiente = pasosUnificados.filter((id) => id !== origenId);
    const destino = siguiente.indexOf(destinoId);
    if (destino < 0) return;
    siguiente.splice(destino + (despues ? 1 : 0), 0, origenId);
    void guardarOrdenPasos(siguiente);
  };
  // Secuencia unificada en el shape que consumen las vistas del esquema
  // (asistente flotante y vista guiada expandida).
  const pasosAsistente: PasoAsistente[] = pasosUnificados.map((id) => {
    const base = rutaAlternativa.ruta.pasos.find((p) => p.id === id);
    const extra = pasosExtras.find((e) => e.id === id);
    const familiaCodigo = base?.familiaCodigo ?? extra?.familiaCodigo ?? "";
    return {
      id,
      familiaCodigo,
      nombre:
        configs[id]?.nombreVisible?.trim() ||
        familiasMap.get(familiaCodigo)?.nombre ||
        humanizeCode(familiaCodigo),
      esExtra: Boolean(extra),
      orden: base?.orden ?? null,
      modoActivacion:
        configs[id]?.modoActivacion ??
        familiasMap.get(familiaCodigo)?.modoActivacionDefault ??
        "OBLIGATORIO",
    };
  });
  // Props compartidos por las dos presentaciones del esquema (asistente
  // flotante y vista guiada expandida): una fuente, dos shells.
  // Herencia explícita: el TEXTO (jsonTexts) es la fuente al guardar, pero la
  // pregunta del esquema, los pendientes y el detector de cambios sin guardar
  // leen configs.mecanismoCantidadConfigJson. Hay que actualizar los DOS: si
  // no, "Aplicar" no marcaba cambios, el asistente salteaba el guardado y el
  // click parecía no hacer nada.
  const aplicarOrigenHerencia = (
    pasoId: string,
    sel: SeleccionHerencia | null,
  ) => {
    const texto = escribirOrigenHerencia(
      jsonTexts[pasoId]?.mecanismo ?? "",
      sel,
    );
    setJsonTexts((prev) => ({
      ...prev,
      [pasoId]: {
        ...(prev[pasoId] ?? { params: "", mecanismo: "" }),
        mecanismo: texto,
      },
    }));
    const parsed = textToJson(texto);
    if (parsed.ok) {
      setConfigs((prev) => ({
        ...prev,
        [pasoId]: {
          ...prev[pasoId],
          mecanismoCantidadConfigJson: parsed.value,
        },
      }));
    }
  };
  const onHerenciaEsquema = aplicarOrigenHerencia;
  const reglaPropsEsquema = {
    includeMeasureFields:
      producto.modoMedidas === "LIBRE" || producto.modoMedidas === "MIXTA",
    extraFields: technologyRuleFields,
  };
  const materialesApiEsquema: MaterialesApiAsistente = {
    updateSlot,
    removeSlot,
    addSlotAdicional,
    addSlotCandidate,
    removeSlotCandidate,
    updateSlotCandidate,
    candidateMaterials,
    setCandidateMaterials,
    hardcodedMaterialSelections,
    setHardcodedMaterialSelections,
    getPersistedSlot: (pasoId, slotCodigo) =>
      rutaAlternativa.configPasos
        .find((cp) => cp.rutaPasoId === pasoId)
        ?.slotsMateriales.find((s) => s.slotCodigo === slotCodigo) ?? null,
  };
  const nestingApiEsquema: NestingApi = {
    updateNestingConfig,
    updateNestingPieceBleed,
    updateNestingMargins,
    updateNestingExtraMargins,
    updateNestingCosting,
    updateNestingPanelizado,
    updateNestingPliegoImpresion,
    updateNestingPliegoPreset,
    updateNestingPliegoCandidato,
    addNestingPliegoCandidato,
    removeNestingPliegoCandidato,
  };
  const panelMeasuresProducto = getProductoPanelMeasures(producto);
  // Navegación sobre la secuencia unificada (pasos base + extras en posición).
  const goPrev = () => {
    const i = pasosUnificados.indexOf(activePasoId);
    const prev = pasosUnificados[Math.max(0, i - 1)];
    if (prev) setActivePasoId(prev);
  };
  const goNext = () => {
    const i = pasosUnificados.indexOf(activePasoId);
    const next = pasosUnificados[Math.min(pasosUnificados.length - 1, i + 1)];
    if (next) setActivePasoId(next);
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
              href={
                configuracionBase?.volverHref ??
                `/productos-servicios/${producto.id}?tab=pasos&rutaAltId=${rutaAlternativa.id}`
              }
              className="back-link"
            >
              <ArrowLeftIcon className="size-4" />
              {configuracionBase ? "Volver a pasos" : "Volver a rutas"}
            </Link>
            <div
              className="route"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span>{rutaAlternativa.nombre}</span>
              {rutaAlternativa.esPreferida ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: "var(--surface-2, #f1efe8)",
                    color: "var(--muted-text, #6e6e76)",
                    border: "1px solid var(--hairline, #e5e2db)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {configuracionBase
                    ? "Configuración reutilizable"
                    : "Ruta predeterminada"}
                </span>
              ) : null}
            </div>
          </div>
          <div className="side-progress">
            <span>
              {configuracionBase
                ? doneCount === activeStepCount
                  ? "Configuración completa"
                  : "Configuración pendiente"
                : `${(() => {
                // El "Paso X de Y" vive acá (feedback 2026-08-06): antes
                // estaba arriba de las preguntas y duplicaba este sidebar.
                const n = pasosUnificados.indexOf(activePasoId);
                return n >= 0
                  ? `Paso ${n + 1} de ${pasosUnificados.length} · `
                  : "";
                  })()}${doneCount}/${activeStepCount} activos${
                    skippedCount > 0
                      ? ` · ${skippedCount} omitido${skippedCount === 1 ? "" : "s"}`
                      : ""
                  }`}
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
            {pasosUnificados.map((pasoId) => {
              const extra = pasosExtras.find((item) => item.id === pasoId);
              if (extra) {
                const familiaExtra = familiasMap.get(extra.familiaCodigo);
                const activo = extra.id === activePasoId;
                const nombreExtra =
                  configs[extra.id]?.nombreVisible?.trim() ||
                  familiaExtra?.nombre ||
                  extra.familiaCodigo;
                return (
                  <button
                    type="button"
                    key={extra.id}
                    draggable={!guardandoOrden}
                    className={`paso-item extra ${activo ? "active" : ""}`}
                    style={{
                      cursor: guardandoOrden ? "wait" : "grab",
                      opacity: pasoArrastradoId === extra.id ? 0.55 : 1,
                      outline:
                        pasoDestinoId === extra.id &&
                        pasoArrastradoId !== extra.id
                          ? "2px solid var(--ink)"
                          : undefined,
                    }}
                    onDragStart={(event) => {
                      setPasoArrastradoId(extra.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", extra.id);
                    }}
                    onDragEnd={() => {
                      setPasoArrastradoId(null);
                      setPasoDestinoId(null);
                    }}
                    onDragOver={(event) => {
                      if (!pasoArrastradoId) return;
                      event.preventDefault();
                      setPasoDestinoId(extra.id);
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setPasoDestinoId(null);
                      const origen =
                        pasoArrastradoId ||
                        event.dataTransfer.getData("text/plain");
                      const rect = event.currentTarget.getBoundingClientRect();
                      moverPaso(
                        origen,
                        extra.id,
                        event.clientY > rect.top + rect.height / 2,
                      );
                    }}
                    onClick={() => {
                      setActivePasoId(extra.id);
                      setEditingExtra(null);
                    }}
                  >
                    <span className="ix" aria-hidden>
                      <GripVerticalIcon className="size-3.5" />
                    </span>
                    <span className="body">
                      <span className="ttl">{nombreExtra}</span>
                      <span className="sub">
                        {extra.maquinaM1?.nombre ??
                          extra.centroCosto?.nombre ??
                          "Sin recurso"}
                      </span>
                    </span>
                    <span className="status">Extra</span>
                  </button>
                );
              }

              const paso = rutaAlternativa.ruta.pasos.find(
                (item) => item.id === pasoId,
              );
              if (!paso) return null;
              const summary = getPasoSummary(paso);
              const pasoLabel =
                configs[paso.id]?.nombreVisible?.trim() ||
                summary.familia?.nombre ||
                paso.familiaCodigo;
              // Completitud del paso: verde si tiene todo para cotizar, ámbar
              // si le faltan datos (errores o pendientes bloqueantes).
              const completo =
                summary.totalErrores === 0 &&
                nivelPendientes(
                  pendientesDePaso(summary.cfg, summary.familia),
                ) !== "faltan";
              return (
                <button
                  type="button"
                  key={paso.id}
                  draggable={!guardandoOrden && !configuracionBase}
                  className={`paso-item ${summary.status} ${summary.optional ? "optional" : ""} ${paso.id === activePasoId ? "active" : ""}`}
                  style={{
                    cursor: guardandoOrden ? "wait" : "grab",
                    opacity: pasoArrastradoId === paso.id ? 0.55 : 1,
                    outline:
                      pasoDestinoId === paso.id && pasoArrastradoId !== paso.id
                        ? "2px solid var(--ink)"
                        : undefined,
                  }}
                  onDragStart={(event) => {
                    setPasoArrastradoId(paso.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", paso.id);
                  }}
                  onDragEnd={() => {
                    setPasoArrastradoId(null);
                    setPasoDestinoId(null);
                  }}
                  onDragOver={(event) => {
                    if (!pasoArrastradoId) return;
                    event.preventDefault();
                    setPasoDestinoId(paso.id);
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setPasoDestinoId(null);
                    const origen =
                      pasoArrastradoId ||
                      event.dataTransfer.getData("text/plain");
                    const rect = event.currentTarget.getBoundingClientRect();
                    moverPaso(
                      origen,
                      paso.id,
                      event.clientY > rect.top + rect.height / 2,
                    );
                  }}
                  onClick={() => {
                    setActivePasoId(paso.id);
                    setEditingExtra(null);
                  }}
                >
                  <span
                    className="ix"
                    style={
                      summary.skipped
                        ? undefined
                        : {
                            background: completo ? "#22a06b" : "#e0a11b",
                            borderColor: completo ? "#22a06b" : "#e0a11b",
                            color: "#fff",
                          }
                    }
                  >
                    {summary.skipped ? (
                      "—"
                    ) : completo ? (
                      <CheckIcon className="size-3" />
                    ) : (
                      <span
                        aria-hidden
                        style={{ fontWeight: 800, fontSize: 12, lineHeight: 1 }}
                      >
                        !
                      </span>
                    )}
                  </span>
                  <span className="body">
                    <span className="ttl">{pasoLabel}</span>
                    <span className="sub">{summary.maquinaNombre}</span>
                    {/* Estado del paso activo (feedback 2026-08-06): el
                        "Listo para cotizar" / faltantes vive acá, no arriba
                        de las preguntas. Sólo en el paso seleccionado para
                        no ensuciar la lista. */}
                    {paso.id === activePasoId && !summary.skipped
                      ? (() => {
                          const lineaBase: React.CSSProperties = {
                            display: "block",
                            marginTop: 2,
                            fontSize: 11,
                            fontWeight: 550,
                            lineHeight: 1.4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          };
                          if (summary.totalErrores > 0) {
                            return (
                              <span
                                style={{ ...lineaBase, color: "#b3412c" }}
                              >
                                {summary.totalErrores} error
                                {summary.totalErrores === 1 ? "" : "es"} por
                                corregir
                              </span>
                            );
                          }
                          const pend = pendientesDePaso(
                            summary.cfg,
                            summary.familia,
                          );
                          const resumen = resumenPendientes(pend);
                          if (resumen && nivelPendientes(pend) === "faltan") {
                            return (
                              <span
                                title={resumen}
                                style={{ ...lineaBase, color: "#8a6d3b" }}
                              >
                                Para cotizar bien — {resumen}
                              </span>
                            );
                          }
                          // "Listo para cotizar" lo dice el check verde de la
                          // izquierda (feedback del usuario). Sólo queda el
                          // recordatorio de guardar si el paso está completo
                          // pero todavía no se persistió.
                          if (summary.configExistente) return null;
                          return (
                            <span style={{ ...lineaBase, color: "#8a6d3b" }}>
                              Guardá el paso
                            </span>
                          );
                        })()
                      : null}
                  </span>
                  <span
                    className="status"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                    title={
                      !summary.optional && !summary.skipped
                        ? "Paso obligatorio"
                        : "Paso opcional"
                    }
                  >
                    {!configuracionBase ? (
                      <GripVerticalIcon
                        className="size-3.5"
                        aria-label="Arrastrar para cambiar posición"
                      />
                    ) : null}
                    {!summary.optional && !summary.skipped ? (
                      // Cerrado (OBLIGATORIO) en ámbar para diferenciarlo a
                      // simple vista del abierto (opcional), que queda gris.
                      // El color NO habla del estado del paso (eso es el check).
                      <LockIcon
                        className="size-3.5"
                        style={{ color: "#e0a11b" }}
                        aria-label="Paso obligatorio"
                      />
                    ) : (
                      <LockOpenIcon
                        className="size-3.5"
                        style={{ color: "var(--muted-text, #8a857b)" }}
                        aria-label="Paso opcional"
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {!configuracionBase ? <div className="pasos-extras-side">
            <button
              type="button"
              className={`pe-add-btn ${editingExtra === "new" ? "active" : ""}`}
              onClick={() => setEditingExtra("new")}
            >
              + Agregar paso extra
            </button>
          </div> : null}
          {!configuracionBase ? <div className="kbd-panel">
            <span className="kbd-hint">
              Arrastrá para ordenar · Navegá con <span className="k">↑</span>{" "}
              <span className="k">↓</span>
            </span>
          </div> : null}
        </aside>

        <main className="editor-main">
          {/* G-F3: el alta mínima (familia + posición) usa un form aparte; la
              configuración del extra usa el mismo panel que los demás pasos. */}
          {editingExtra ? (
            <PasoExtraEditor
              productoId={producto.id}
              rutaAlternativa={rutaAlternativa}
              catalogoFamilias={catalogoFamilias}
              lookups={lookups}
              includeMeasureFields={
                producto.modoMedidas === "LIBRE" ||
                producto.modoMedidas === "MIXTA"
              }
              ruleExtraFields={technologyRuleFields}
              extra={editingExtra === "new" ? null : editingExtra}
              pasosOrdenados={pasosAsistente.map((paso) => ({
                id: paso.id,
                nombre: paso.nombre,
                esExtra: paso.esExtra,
              }))}
              onSaved={() => {
                setEditingExtra(null);
                router.refresh();
              }}
              onCreated={(creado) => {
                // Recién creado (mínimo): lo seleccionamos para configurarlo
                // con el panel completo, y refrescamos para traerlo del server.
                setActivePasoId(creado.id);
                setEditingExtra(null);
                router.refresh();
              }}
              onDeleted={() => {
                setActivePasoId(rutaAlternativa.ruta.pasos[0]?.id ?? "");
                setEditingExtra(null);
                router.refresh();
              }}
              onCancel={() => setEditingExtra(null)}
            />
          ) : (
          <>
          {/* El stepper horizontal (mini-graph) se quitó 2026-08-06:
              duplicaba la lista del sidebar (feedback del usuario). */}
          {activePaso && configs[activePaso.id]
            ? [activePaso]
                .map((paso) => {
                  const idx = pasosUnificados.indexOf(paso.id);
                  const esExtra = Boolean(activeExtra);
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
                      familia,
                      familia?.plantillasCompatibles,
                      m,
                    ),
                  );
                  const soportaM2 =
                    familia?.relacionMaquinaSoportada.includes("M-2") ?? false;
                  const maquinasCandidatasCompatibles = lookups.maquinas.filter(
                    (m) =>
                      maquinaCandidataCompatibleConFamilia(
                        familia,
                        familia?.plantillasCompatibles,
                        m,
                      ),
                  );
                  const candidatasCfg = normalizeMaquinasCandidatas(
                    cfg.maquinasCandidatas ?? [],
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
                        perfilCompatibleConFamilia(familia, p),
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
                    // [Tanda B] Si la ficha declara qué hereda por default
                    // (`outputHeredadoDefault`), la opción lo nombra — antes
                    // sólo corte_manual tenía este copy, cableado.
                    if (
                      m === "HEREDAR_DEL_OUTPUT_CANONICO" &&
                      familia?.outputHeredadoDefault
                    ) {
                      return {
                        ...option,
                        label: `${humanizarOutputCanonico(
                          familia.outputHeredadoDefault,
                        )} del paso anterior`,
                        description:
                          "Usa lo que publicó el paso anterior, no la cantidad final del pedido.",
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
                  const mostrarNesting = nestingAplica(familia, cfg);
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
                      : getDefaultT2TimeCalculationMode(familia);
                  const timeCalculationMode =
                    T2_TIME_CALCULATION_MODE_OPTIONS.some(
                      (option) => option.value === timeCalculationModeRaw,
                    )
                      ? timeCalculationModeRaw
                      : getDefaultT2TimeCalculationMode(familia);
                  const productivityUnit =
                    typeof paramsPaso.productivityUnit === "string"
                      ? paramsPaso.productivityUnit
                      : getDefaultT2ProductivityUnit(familia);
                  const productivityQuantitySourceRaw =
                    typeof paramsPaso.productivityQuantitySource === "string"
                      ? paramsPaso.productivityQuantitySource
                      : getDefaultT2QuantitySource(familia, productivityUnit);
                  const normalizedProductivityQuantitySourceRaw =
                    familia?.codigo === "montaje_sobre_sustrato" &&
                    productivityUnit === "unidades_h" &&
                    productivityQuantitySourceRaw === "cantidad"
                      ? "cantidad_montaje"
                      : productivityQuantitySourceRaw;
                  const productivityQuantitySourceOptions =
                    getT2QuantitySourceOptions(
                      productivityUnit,
                      familia,
                      paramsPaso,
                    );
                  const productivityQuantitySource =
                    productivityQuantitySourceOptions.some(
                      (option) =>
                        option.value === normalizedProductivityQuantitySourceRaw,
                    )
                      ? normalizedProductivityQuantitySourceRaw
                      : getDefaultT2QuantitySource(familia, productivityUnit);
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
                  const multiplicadoresSoportados =
                    familia?.multiplicadoresSoportados ?? [];
                  const maquinaParaDefaults = maquinaSel?.parametrosTecnicosJson
                    ? maquinaSel
                    : configExistente?.maquinaM1?.id === cfg.maquinaM1Id &&
                        configExistente?.maquinaM1?.parametrosTecnicosJson
                      ? configExistente.maquinaM1
                      : (maquinaSel ?? configExistente?.maquinaM1);
                  const mostrarModoColor = modoColorAplica(familia, cfg);
                  const modoColorOptions = buildModoColorOptions(
                    maquinaGuardada,
                    configExistente,
                    familia?.esImpresion === true,
                  );
                  const modoColorPerfilDefault =
                    modosColorFromPerfil(perfilGuardado)[0] ?? "";
                  const valBasico =
                    noEjecutar || cfg.tercerizado
                      ? { errores: [], warnings: [] }
                      : validarBasico(cfg, familia, {
                          familiaCodigo: paso.familiaCodigo,
                        });
                  const valMateriales = noEjecutar
                    ? { errores: [], warnings: [] }
                    : validarMateriales(cfg, familia);
                  const valAvanzado = noEjecutar
                    ? { errores: [], warnings: [] }
                    : validarAvanzado(
                        jsonText.params,
                        cantidadRelevante ? jsonText.mecanismo : "",
                        cfg,
                        familia,
                      );
                  // Un paso tercerizado no usa máquina/material: su validez es
                  // la de su fuente de costo (la chequea el backend), no estas
                  // validaciones de producción.
                  const totalErrores = cfg.tercerizado
                    ? 0
                    : valBasico.errores.length +
                      valMateriales.errores.length +
                      valAvanzado.errores.length;
                  const totalWarnings = cfg.tercerizado
                    ? 0
                    : valBasico.warnings.length +
                      valMateriales.warnings.length +
                      valAvanzado.warnings.length;
                  const pasoTieneCambios = hasUnsavedChanges(paso.id);

                  return (
                    <React.Fragment key={paso.id}>
                      {/* Header mínimo (feedback 2026-08-06): el número de
                          paso, el estado Configurado y el "Listo para cotizar"
                          viven en el sidebar; el centro de costo ya se lee ahí.
                          Los botones Siguiente/Guardar flotan al pie del scroll
                          (barra sticky al final del paso). */}
                      {/* Header sin badge de activación (vive en "Cuándo se
                          ejecuta"), sin nombre (vive resaltado en el sidebar)
                          y sin "Perfil: X" (es un default — el motor suele
                          elegir otro compatible; nombrarlo lo hacía parecer
                          fijo). Queda sólo el toggle de vista (feedback del
                          usuario, 2026-08-11). */}
                      <div className="step-head">
                        <div style={{ flex: 1 }}>
                          {activeExtra ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingExtra(activeExtra)}
                            >
                              Editar ubicación o eliminar
                            </Button>
                          ) : null}
                        </div>
                        {/* Re-habilitado 2026-08-11 (pedido del usuario):
                            el toggle Detallado/Guiado vuelve para comparar
                            vistas. OJO: el detallado está CONGELADO — las
                            mejoras nuevas (panel de geometría, criterios
                            como params, tercerizado manual) viven sólo en
                            el guiado. El Asistente flotante sigue oculto. */}
                        <div className="pill-row">
                          <button
                            className="btn"
                            type="button"
                            aria-pressed={vistaEditor === "detallado"}
                            style={
                              vistaEditor === "detallado"
                                ? { fontWeight: 650 }
                                : { opacity: 0.6 }
                            }
                            onClick={() => setVistaEditor("detallado")}
                          >
                            Detallado
                          </button>
                          <button
                            className="btn"
                            type="button"
                            aria-pressed={vistaEditor === "guiado"}
                            style={
                              vistaEditor === "guiado"
                                ? { fontWeight: 650 }
                                : { opacity: 0.6 }
                            }
                            onClick={() => setVistaEditor("guiado")}
                          >
                            Guiado
                          </button>
                          {false && (
                            <button
                              className="btn"
                              type="button"
                              onClick={() => setAsistenteAbierto(true)}
                            >
                              Asistente guiado
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="config-step-content pasos-sections">
                        {vistaEditor === "guiado" ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 14,
                              maxWidth: 980,
                            }}
                          >
                            <SeccionesEsquemaPaso
                              configuracionBase={Boolean(configuracionBase)}
                              pasoActual={{
                                id: paso.id,
                                nombre:
                                  cfg.nombreVisible?.trim() ||
                                  familia?.nombre ||
                                  paso.familiaCodigo,
                                familiaCodigo: paso.familiaCodigo,
                                esExtra,
                                orden: paso.orden,
                              }}
                                cfg={cfg}
                                configs={configs}
                                familia={familia}
                              pasos={pasosAsistente}
                              familiasMap={familiasMap}
                              lookups={lookups}
                              jsonTexts={jsonTexts}
                              vivos={pendientesDePaso(cfg, familia)}
                              onPatch={(pasoId, patch) => updateConfig(pasoId, patch)}
                              onParams={(pasoId, patch) => updateStepParams(pasoId, patch)}
                              onHerencia={onHerenciaEsquema}
                              onAddSlotFamilia={(pasoId, slotCodigo) =>
                                addSlotFromFamilia(pasoId, slotCodigo)
                              }
                              reglaProps={reglaPropsEsquema}
                              updateTiempoManualConfig={updateTiempoManualConfig}
                              updateModoColorConfig={updateModoColorConfig}
                              toggleMaquinaCandidata={toggleMaquinaCandidata}
                              setMaquinaCandidataPreferida={setMaquinaCandidataPreferida}
                              setMaquinaCandidataPerfilDefault={setMaquinaCandidataPerfilDefault}
                              setMaquinaCandidataModoColorAllowed={
                                setMaquinaCandidataModoColorAllowed
                              }
                              setMaquinaCandidataPerfilPorModo={
                                setMaquinaCandidataPerfilPorModo
                              }
                              setCoberturaPaso={setCoberturaPaso}
                              materialesApi={materialesApiEsquema}
                              nestingApi={nestingApiEsquema}
                              panelEditorPasoId={panelEditorPasoId}
                              setPanelEditorPasoId={setPanelEditorPasoId}
                              panelMeasures={panelMeasuresProducto}
                            />
                          </div>
                        ) : (
                          <>
                        <section className="section-block open">
                          <div className="sb-head">
                            <span className="num">T</span>
                            <span className="ttl">Tercerización</span>
                            <span className="hint">
                              ¿Este paso lo compra un proveedor?
                            </span>
                          </div>
                          <div className="sb-body">
                            <PasoTercerizadoPanel
                              value={cfg}
                              esImpresion={
                                familiasMap.get(paso.familiaCodigo)
                                  ?.esImpresion === true
                              }
                              onChange={(patch) => updateConfig(paso.id, patch)}
                              onToggle={(tercerizado) =>
                                updateConfig(
                                  paso.id,
                                  tercerizado
                                    ? {
                                        tercerizado: true,
                                        // Fuente por default (el panel muestra
                                        // matriz): hay que persistirla, no dejarla
                                        // sólo en el display.
                                        fuenteCostoTercerizado:
                                          cfg.fuenteCostoTercerizado ?? "matriz",
                                        maquinaM1Id: null,
                                        perfilM1Id: null,
                                        // No se produce internamente: los
                                        // multiplicadores (caras, tipoCopia) no
                                        // aplican y no deben quedar persistidos.
                                        multiplicadoresActivos: [],
                                      }
                                    : { tercerizado: false },
                                )
                              }
                            />
                          </div>
                        </section>
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
                                  label={
                                    configuracionBase
                                      ? "Nombre visible por defecto"
                                      : "Nombre visible del paso"
                                  }
                                  tooltip={
                                    configuracionBase
                                      ? "Nombre que se propondrá al usar este paso en un producto. Cada producto puede personalizarlo después."
                                      : "Nombre operativo que verá comercial y producción. Si lo dejás vacío, se usa el nombre técnico de la familia."
                                  }
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
                                      {configuracionBase &&
                                      option.value === "NO_EJECUTAR"
                                        ? "No usar por defecto"
                                        : option.label}
                                    </button>
                                  ))}
                                </div>
                                <span className="help">
                                  No ejecutar apaga este paso solo para esta
                                  ruta del producto.
                                </span>
                              </div>
                              {!cfg.tercerizado && (
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
                              )}
                              {/* Arrastre entre opcionales: este paso puede
                                  exigir que otros se ejecuten. Ver
                                  docs/modificaciones-fisicas-lona-diseno.md */}
                              <div className="field md:col-span-full">
                                <LabelConTooltip
                                  label="Este paso necesita que también se ejecuten"
                                  tooltip="Al activarse, enciende esos pasos aunque sean OPCIONALES y el comercial no los haya tildado. Ej: colocar ojales necesita el refuerzo perimetral. Los pasos elegidos siguen pudiendo activarse por su cuenta."
                                />
                                <div className="flex flex-wrap gap-2">
                                  {rutaAlternativa.ruta.pasos
                                    .filter((otro) => otro.id !== paso.id)
                                    .map((otro) => {
                                      const requeridos =
                                        cfg.requiereRutaPasoIds ?? [];
                                      const elegido = requeridos.includes(
                                        otro.id,
                                      );
                                      // El nombre real de la familia antes de
                                      // humanizar el código: para una familia
                                      // tenant el código es un UUID (mismo bug
                                      // que tuvo el motor en la Etapa C).
                                      const nombreOtro =
                                        configs[otro.id]?.nombreVisible?.trim() ||
                                        familiasMap.get(otro.familiaCodigo)
                                          ?.nombre ||
                                        humanizeCode(otro.familiaCodigo);
                                      return (
                                        <label
                                          key={otro.id}
                                          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={elegido}
                                            onChange={(e) =>
                                              updateConfig(paso.id, {
                                                requiereRutaPasoIds: e.target
                                                  .checked
                                                  ? [...requeridos, otro.id]
                                                  : requeridos.filter(
                                                      (id) => id !== otro.id,
                                                    ),
                                              })
                                            }
                                          />
                                          <span>{nombreOtro}</span>
                                        </label>
                                      );
                                    })}
                                </div>
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

                        {/* Un paso tercerizado no se produce internamente: no tiene
                            tiempo/costo, máquina, materiales ni overrides. Sólo se
                            configura su Activación (sin multiplicadores). */}
                        {!noEjecutar && !cfg.tercerizado && (
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
                                            : familia?.defaults?.centroCostoId
                                              ? `Usando el del paso: ${
                                                  lookups.centrosCosto.find(
                                                    (c) =>
                                                      c.id ===
                                                      familia?.defaults
                                                        ?.centroCostoId,
                                                  )?.nombre ?? "default"
                                                }`
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
                                  <div className="field">
                                    <LabelConTooltip
                                      label={
                                        <>
                                          Operarios{" "}
                                          <span className="hint">dotación</span>
                                        </>
                                      }
                                      tooltip="Cuántas personas ocupa el paso. Multiplica sólo el costo de mano de obra (un paso a 2 personas consume el doble de horas-hombre); la máquina no cambia."
                                      iconSize="sm"
                                    />
                                    <Input
                                      type="number"
                                      min={1}
                                      step={1}
                                      value={cfg.dotacionOperarios ?? 1}
                                      onChange={(e) =>
                                        updateConfig(paso.id, {
                                          dotacionOperarios: Math.max(
                                            1,
                                            Math.round(
                                              Number(e.target.value) || 1,
                                            ),
                                          ),
                                        })
                                      }
                                    />
                                  </div>
                                  {personalizaciones.length > 0 &&
                                    (() => {
                                      const params = asRecord(
                                        cfg.paramsPasoJson,
                                      );
                                      const legacy =
                                        typeof params.fuenteMedida === "string" &&
                                        params.fuenteMedida.startsWith(
                                          FUENTE_MEDIDA_PERSONALIZACION_PREFIX,
                                        )
                                          ? [
                                              params.fuenteMedida.slice(
                                                FUENTE_MEDIDA_PERSONALIZACION_PREFIX.length,
                                              ),
                                            ]
                                          : [];
                                      const seleccionadas = Array.isArray(
                                        params.fuenteMedidaPersonalizaciones,
                                      )
                                        ? (
                                            params.fuenteMedidaPersonalizaciones as unknown[]
                                          ).filter(
                                            (c): c is string =>
                                              typeof c === "string",
                                          )
                                        : legacy;
                                      const toggle = (
                                        codigo: string,
                                        checked: boolean,
                                      ) => {
                                        const next = checked
                                          ? [...seleccionadas, codigo]
                                          : seleccionadas.filter(
                                              (c) => c !== codigo,
                                            );
                                        updateStepParams(paso.id, {
                                          fuenteMedidaPersonalizaciones:
                                            next.length ? next : undefined,
                                          fuenteMedida: "",
                                        });
                                      };
                                      return (
                                        <div className="field">
                                          <LabelConTooltip
                                            label={
                                              <>
                                                Fuente de medida{" "}
                                                <span className="hint">
                                                  personalización
                                                </span>
                                              </>
                                            }
                                            tooltip="Elegí qué estampas imprime/costea este paso. Si se imprimen juntas (ej. varias estampas en un mismo DTF), marcá todas: el paso suma sus áreas. Sin ninguna marcada, usa la medida global del producto."
                                            iconSize="sm"
                                          />
                                          <div
                                            style={{
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: 6,
                                              border: "1px solid var(--hairline, #e5e7eb)",
                                              borderRadius: 8,
                                              padding: "8px 10px",
                                            }}
                                          >
                                            {personalizaciones.map((p) => (
                                              <label
                                                key={p.codigo}
                                                style={{
                                                  display: "flex",
                                                  alignItems: "center",
                                                  gap: 8,
                                                  cursor: "pointer",
                                                  fontSize: 13,
                                                }}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={seleccionadas.includes(
                                                    p.codigo,
                                                  )}
                                                  onChange={(e) =>
                                                    toggle(
                                                      p.codigo,
                                                      e.target.checked,
                                                    )
                                                  }
                                                />
                                                <span style={{ fontWeight: 500 }}>
                                                  {p.nombre}
                                                </span>
                                                <span
                                                  style={{
                                                    color: "var(--muted, #6b7280)",
                                                    fontSize: 11,
                                                  }}
                                                >
                                                  {p.modoMedida === "FIJA"
                                                    ? `${p.anchoMm}×${p.altoMm} mm (fija)`
                                                    : "medida del cliente"}
                                                </span>
                                              </label>
                                            ))}
                                          </div>
                                          <div
                                            className="hint"
                                            style={{ marginTop: 4 }}
                                          >
                                            {seleccionadas.length === 0
                                              ? "Sin estampas marcadas → usa la medida del producto (global)."
                                              : seleccionadas.length > 1
                                                ? `Se costean juntas: el paso suma las ${seleccionadas.length} áreas.`
                                                : "El paso costea el área de esa estampa."}
                                          </div>
                                        </div>
                                      );
                                    })()}
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
                                                    familia,
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
                                                placeholder={
                                                  familia?.defaults
                                                    ?.productividadHora
                                                    ? `Usando el ritmo del paso: ${familia.defaults.productividadHora}/h`
                                                    : "Ej. 500"
                                                }
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
                                                  familia,
                                                );
                                              updateStepParams(paso.id, {
                                                productivityUnit: nextUnit,
                                                productivityQuantitySource:
                                                  getDefaultT2QuantitySource(familia, nextUnit),
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
                                  {cantidadRelevante &&
                                    cfg.mecanismoCantidad ===
                                      "HEREDAR_DEL_OUTPUT_CANONICO" &&
                                    (() => {
                                      // B.3.3 — herencia explícita: señalar
                                      // el paso origen y qué capacidad usa.
                                      const pasosPrevios =
                                        rutaAlternativa.ruta.pasos.filter(
                                          (p) => p.orden < paso.orden,
                                        );
                                      const origen = leerOrigenHerencia(
                                        jsonTexts[paso.id]?.mecanismo ?? "",
                                      );
                                      const origenPasoId =
                                        typeof origen?.rutaPasoId === "string"
                                          ? origen.rutaPasoId
                                          : null;
                                      const origenCapacidad =
                                        typeof origen?.capacidad === "string"
                                          ? origen.capacidad
                                          : "unidades_procesadas";
                                      const setOrigen = (
                                        o: OrigenHerencia | null,
                                      ) => aplicarOrigenHerencia(paso.id, o);
                                      const nombrePaso = (p: {
                                        id: string;
                                        familiaCodigo: string;
                                      }) =>
                                        configs[p.id]?.nombreVisible?.trim() ||
                                        familiasMap.get(p.familiaCodigo)
                                          ?.nombre ||
                                        humanizeCode(p.familiaCodigo);
                                      const heredablesDe = (
                                        familiaCodigo: string,
                                      ) =>
                                        (
                                          familiasMap.get(familiaCodigo)
                                            ?.capacidades ?? []
                                        ).filter((c) => c.heredable);
                                      const familiaOrigenCodigo =
                                        pasosPrevios.find(
                                          (p) => p.id === origenPasoId,
                                        )?.familiaCodigo;
                                      const capacidadesOrigen =
                                        familiaOrigenCodigo
                                          ? heredablesDe(familiaOrigenCodigo)
                                          : [];
                                      return (
                                        <div className="field">
                                          <LabelConTooltip
                                            label="¿De qué paso hereda la cantidad?"
                                            tooltip="Señalá el paso origen: la cantidad de este paso sale de lo que ese paso dejó. En Automático el sistema usa la regla histórica (el output natural del paso anterior)."
                                          />
                                          <div className="grid gap-2 sm:grid-cols-2">
                                            <HumanSelect
                                              value={origenPasoId ?? "auto"}
                                              onValueChange={(v) => {
                                                if (!v || v === "auto") {
                                                  setOrigen(null);
                                                  return;
                                                }
                                                setOrigen({
                                                  rutaPasoId: v,
                                                  capacidad: origenCapacidad,
                                                });
                                              }}
                                              options={[
                                                {
                                                  value: "auto",
                                                  label:
                                                    "Automático (regla histórica)",
                                                  description:
                                                    "Como hasta ahora: el output natural del paso anterior.",
                                                },
                                                ...pasosPrevios.map((p) => {
                                                  const deja = heredablesDe(
                                                    p.familiaCodigo,
                                                  )
                                                    .map((c) =>
                                                      c.nombre.toLowerCase(),
                                                    )
                                                    .join(", ");
                                                  return {
                                                    value: p.id,
                                                    label: nombrePaso(p),
                                                    description: deja
                                                      ? `Deja: ${deja}`
                                                      : undefined,
                                                  };
                                                }),
                                              ]}
                                              placeholder="Elegir paso"
                                            />
                                            {origenPasoId ? (
                                              <HumanSelect
                                                value={origenCapacidad}
                                                onValueChange={(v) =>
                                                  setOrigen({
                                                    rutaPasoId: origenPasoId,
                                                    capacidad:
                                                      v ||
                                                      "unidades_procesadas",
                                                  })
                                                }
                                                options={capacidadesOrigen.map(
                                                  (c) => ({
                                                    value: c.key,
                                                    label: c.nombre,
                                                  }),
                                                )}
                                                placeholder="Qué número usa"
                                              />
                                            ) : null}
                                          </div>
                                        </div>
                                      );
                                    })()}
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
                                              getDefaultT2QuantitySource(familia, productivityUnit),
                                          })
                                        }
                                        options={productivityQuantitySourceOptions}
                                        placeholder="Elegir fuente"
                                      />
                                    </div>
                                  )}
                                  {familia?.codigo === "pre_prensa" && (
                                    <div className="field">
                                      <LabelConTooltip
                                        label="Modo talonario"
                                        tooltip="Para talonarios: agrupa los talonarios de a N poses por pliego (mismo número lado a lado, sale apilado en orden) y define qué hacer con los talonarios sueltos que no completan el pliego: compartirlo entre sus números (menos papel, más armado manual) o imprimirlos con poses vacías (más papel, listo para abrochar)."
                                      />
                                      <HumanSelect
                                        value={String(
                                          paramsPaso.modoTalonarioIncompleto ??
                                            "off",
                                        )}
                                        onValueChange={(value) =>
                                          updateStepParams(paso.id, {
                                            modoTalonarioIncompleto:
                                              value === "off" ? null : value,
                                          })
                                        }
                                        options={TALONARIO_MODE_OPTIONS}
                                        placeholder="Elegir modo"
                                      />
                                    </div>
                                  )}
                                  {familia ? (
                                    <ParamsFamiliaFields
                                      familia={familia}
                                      params={paramsPaso}
                                      onChange={(patch) =>
                                        updateStepParams(paso.id, patch)
                                      }
                                    />
                                  ) : null}
                                  <TiempoComercialDetalladoEditor
                                    pasoId={paso.id}
                                    cfg={cfg}
                                    familia={familia}
                                    conSwitch
                                    updateTiempoManualConfig={updateTiempoManualConfig}
                                  />
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
                                        <CandidatasDetalladoEditor
                                          pasoId={paso.id}
                                          cfg={cfg}
                                          familia={familia}
                                          lookups={lookups}
                                          maquinasCandidatasCompatibles={maquinasCandidatasCompatibles}
                                          mostrarModoColor={mostrarModoColor}
                                          toggleMaquinaCandidata={toggleMaquinaCandidata}
                                          setMaquinaCandidataPreferida={setMaquinaCandidataPreferida}
                                          setMaquinaCandidataPerfilDefault={setMaquinaCandidataPerfilDefault}
                                          setMaquinaCandidataModoColorAllowed={setMaquinaCandidataModoColorAllowed}
                                          setMaquinaCandidataPerfilPorModo={setMaquinaCandidataPerfilPorModo}
                                        />
                                      ) : null}
                                      {mostrarModoColor &&
                                      (!soportaM2 ||
                                        candidatasCfg.length === 0) ? (
                                        <ModoColorDetalladoEditor
                                          pasoId={paso.id}
                                          cfg={cfg}
                                          modoColorOptions={modoColorOptions}
                                          modoColorPerfilDefault={modoColorPerfilDefault}
                                          updateModoColorConfig={updateModoColorConfig}
                                        />
                                      ) : null}
                                    </div>
                                  </div>
                                </section>
                              )}

                            {/* ── TAB MATERIALES ───────────────────────────────────── */}
                            {/* Sub-fase 3: los extras persisten slots en configSlotsMaterialesJson. */}
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
                                        <div className="ps-auto">
                                          <span className="ps-auto-ic">
                                            <DropletIcon className="size-4" />
                                          </span>
                                          <div className="min-w-0">
                                            <div className="ps-auto-tt">
                                              Consumibles automáticos ·{" "}
                                              {slotsAutomaticos
                                                .map((slot) =>
                                                  slotNombre(
                                                    slot.codigo,
                                                    familia,
                                                  ),
                                                )
                                                .join(" · ")}
                                            </div>
                                            <div className="ps-auto-ss">
                                              Se toman de la máquina y el
                                              perfil seleccionado. Se
                                              configuran en Maquinaria.
                                            </div>
                                          </div>
                                          <span className="ps-badge-auto">
                                            auto
                                          </span>
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
                                          const persistedSlot =
                                            configExistente?.slotsMateriales.find(
                                              (storedSlot) =>
                                                storedSlot.slotCodigo ===
                                                slot.slotCodigo,
                                            );
                                          const opcionesHerencia =
                                            rutaAlternativa.ruta.pasos
                                              .filter(
                                                (origen) =>
                                                  (rutaAlternativa.configPasos.find(
                                                    (candidate) =>
                                                      candidate.rutaPasoId ===
                                                      origen.id,
                                                  )?.ordenFlujo ??
                                                    origen.orden) <
                                                  (configExistente?.ordenFlujo ??
                                                    paso.orden),
                                              )
                                              .flatMap((origen) => {
                                                const cfgOrigen =
                                                  configs[origen.id];
                                                const nombreOrigen =
                                                  cfgOrigen?.nombreVisible?.trim() ||
                                                  familiasMap.get(
                                                    origen.familiaCodigo,
                                                  )?.nombre ||
                                                  humanizeCode(
                                                    origen.familiaCodigo,
                                                  );
                                                return (
                                                  cfgOrigen?.slotsMateriales ??
                                                  []
                                                )
                                                  .filter(
                                                    (sourceSlot) =>
                                                      sourceSlot.modoSeleccion !==
                                                      "HEREDA_DE_PASO",
                                                  )
                                                  .map((sourceSlot) => ({
                                                    value: `${origen.id}::${sourceSlot.slotCodigo}`,
                                                    label: `Hereda de: ${nombreOrigen} · ${sourceSlot.slotNombre || sourceSlot.slotCodigo}`,
                                                  }));
                                              });
                                          return (
                                            <div
                                              key={slotIdx}
                                              className="ps-slot"
                                            >
                                              <div className="ps-slot-head">
                                                <span
                                                  className="ps-slot-tag"
                                                  title={slot.slotCodigo}
                                                >
                                                  {slotDisplayName(slot, familia)}
                                                </span>
                                                <button
                                                  type="button"
                                                  className="ps-x"
                                                  title="Quitar slot"
                                                  onClick={() =>
                                                    removeSlot(paso.id, slotIdx)
                                                  }
                                                >
                                                  <XIcon className="size-3.5" />
                                                </button>
                                              </div>
                                              <div className="ps-slot-body space-y-4">
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
                                                            "HARDCODED") as UpsertSlotMaterialPayload["modoSeleccion"],
                                                          heredaDeRutaPasoId:
                                                            v === "HEREDA_DE_PASO"
                                                              ? slot.heredaDeRutaPasoId ?? null
                                                              : null,
                                                          heredaDeSlotCodigo:
                                                            v === "HEREDA_DE_PASO"
                                                              ? slot.heredaDeSlotCodigo ?? null
                                                              : null,
                                                        },
                                                      )
                                                    }
                                                    options={
                                                      SELECCION_MATERIAL_OPTIONS
                                                    }
                                                    triggerClassName="min-h-9 text-xs"
                                                  />
                                                </div>
                                                {slot.modoSeleccion !== "HEREDA_DE_PASO" && <div className="space-y-1">
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
                                                </div>}
                                                {/* [Costeo del sustrato → nesting]
                                                    El control de "Costeo" por slot
                                                    se removió: el costeo lo posee el
                                                    nesting (Acomodo), fuente única
                                                    `nestingConfig.costing`. El
                                                    material define qué/cuánto/precio,
                                                    no cómo se cobra el desperdicio.
                                                    Ver docs/editor-pasos-preguntas-orden.md §10.5. */}
                                              </div>
                                              {slot.modoSeleccion === "HEREDA_DE_PASO" && (
                                                <div className="space-y-1">
                                                  <LabelConTooltip
                                                    label="Material de origen"
                                                    tooltip="Usa el material ya resuelto en un paso anterior, sin volver a sumarlo al costo."
                                                  />
                                                  <HumanSelect
                                                    value={
                                                      slot.heredaDeRutaPasoId &&
                                                      slot.heredaDeSlotCodigo
                                                        ? `${slot.heredaDeRutaPasoId}::${slot.heredaDeSlotCodigo}`
                                                        : ""
                                                    }
                                                    onValueChange={(value) => {
                                                      const [rutaPasoId, slotCodigo] =
                                                        value.split("::");
                                                      updateSlot(paso.id, slotIdx, {
                                                        heredaDeRutaPasoId: rutaPasoId || null,
                                                        heredaDeSlotCodigo: slotCodigo || null,
                                                      });
                                                    }}
                                                    options={opcionesHerencia}
                                                    placeholder="Elegí un material de un paso anterior"
                                                    triggerClassName="min-h-9 text-xs"
                                                  />
                                                </div>
                                              )}
                                              {slot.modoSeleccion !== "HEREDA_DE_PASO" && (esSlotAdicional ||
                                              slotDecl?.tipo ===
                                                "INSUMO_PASO") ? (
                                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                                  <div className="space-y-1">
                                                    <LabelConTooltip
                                                      label="Base de consumo"
                                                      tooltip="Cantidad operativa sobre la que se aplica el factor. Ej: broches por talonario (cantidad pedida), cartón por pila de talonario."
                                                    />
                                                    <HumanSelect
                                                      value={
                                                        slot.cantidadBase ??
                                                        (esSlotAdicional
                                                          ? "cantidad_pedida"
                                                          : "formula")
                                                      }
                                                      onValueChange={(v) =>
                                                        updateSlot(
                                                          paso.id,
                                                          slotIdx,
                                                          {
                                                            cantidadBase:
                                                              v === "formula"
                                                                ? null
                                                                : v ||
                                                                  (esSlotAdicional
                                                                    ? "cantidad_pedida"
                                                                    : null),
                                                          },
                                                        )
                                                      }
                                                      options={
                                                        esSlotAdicional
                                                          ? CANTIDAD_BASE_SLOT_OPTIONS
                                                          : CANTIDAD_BASE_SLOT_OPTIONS_INSUMO
                                                      }
                                                      triggerClassName="min-h-9 text-xs"
                                                    />
                                                  </div>
                                                  <div className="space-y-1">
                                                    <LabelConTooltip
                                                      label="Cantidad por base"
                                                      tooltip="Multiplicador de consumo. Ej: 2 broches por talonario, 4 ojales por pieza."
                                                    />
                                                    <Input
                                                      type="number"
                                                      min="0"
                                                      step="0.0001"
                                                      disabled={
                                                        !esSlotAdicional &&
                                                        !slot.cantidadBase
                                                      }
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
                                                </div>
                                              ) : null}
                                              {slot.modoSeleccion === "HARDCODED" && (
                                                <MaterialFijoSlotDetalladoEditor
                                                  pasoId={paso.id}
                                                  slotIdx={slotIdx}
                                                  slot={slot}
                                                  slotDecl={slotDecl}
                                                  persistedSlot={persistedSlot}
                                                  candidateMaterials={candidateMaterials}
                                                  setCandidateMaterials={setCandidateMaterials}
                                                  hardcodedMaterialSelections={hardcodedMaterialSelections}
                                                  setHardcodedMaterialSelections={setHardcodedMaterialSelections}
                                                  updateSlot={updateSlot}
                                                />
                                              )}
                                              {slot.modoSeleccion !== "HARDCODED" && slot.modoSeleccion !== "HEREDA_DE_PASO" && (
                                                <CandidatosSlotDetalladoEditor
                                                  pasoId={paso.id}
                                                  slotIdx={slotIdx}
                                                  slot={slot}
                                                  slotDecl={slotDecl}
                                                  candidateMaterials={candidateMaterials}
                                                  addSlotCandidate={addSlotCandidate}
                                                  removeSlotCandidate={removeSlotCandidate}
                                                  updateSlotCandidate={updateSlotCandidate}
                                                />
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
                                              {slot.modoSeleccion !== "HEREDA_DE_PASO" && <label
                                                className={`ps-multi ${
                                                  slot.aplicaMultiCaras
                                                    ? "on"
                                                    : ""
                                                }`}
                                              >
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
                                                <span className="ps-cb">
                                                  <CheckIcon strokeWidth={3.4} />
                                                </span>
                                                <span>
                                                  Multiplicar consumo por caras{" "}
                                                  <span className="text-muted-foreground">
                                                    (doble faz)
                                                  </span>
                                                </span>
                                              </label>}
                                              </div>
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
                                    <div className="ps-card">
                                      <div className="ps-card-head">
                                        <span className="ps-ic">
                                          <ClockIcon />
                                        </span>
                                        <span className="ps-tt">
                                          Overrides de tiempo
                                        </span>
                                        <span className="ps-hint">
                                          Vacío = hereda del perfil
                                        </span>
                                      </div>
                                      <div className="ps-card-body ps-grid2">
                                        {mostrarSetupCleanupOverrides && (
                                          <>
                                            <div className="space-y-2">
                                              <LabelConTooltip
                                                label="Setup override"
                                                tooltip="Sobrescribe el tiempo de preparación del perfil de máquina. Vacío = usar el del perfil."
                                                iconSize="sm"
                                              />
                                              <div className="ps-inp">
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
                                                  placeholder="Hereda del perfil"
                                                />
                                                <span className="ps-u">
                                                  min
                                                </span>
                                              </div>
                                            </div>
                                            <div className="space-y-2">
                                              <LabelConTooltip
                                                label="Cleanup override"
                                                tooltip="Sobrescribe el tiempo de cierre/post-proceso del perfil de máquina. Vacío = usar el del perfil."
                                                iconSize="sm"
                                              />
                                              <div className="ps-inp">
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
                                                  placeholder="Hereda del perfil"
                                                />
                                                <span className="ps-u">
                                                  min
                                                </span>
                                              </div>
                                            </div>
                                          </>
                                        )}
                                        {mostrarTiempoFijoOverride && (
                                          <div className="space-y-2">
                                            <LabelConTooltip
                                              label="Tiempo fijo override"
                                              tooltip="Sólo aplica en pasos sin máquina con tiempo fijo."
                                              iconSize="sm"
                                            />
                                            <div className="ps-inp">
                                              <Input
                                                type="number"
                                                min={0}
                                                step={0.5}
                                                value={
                                                  cfg.tiempoFijoOverrideMin ??
                                                  ""
                                                }
                                                onChange={(e) =>
                                                  updateConfig(paso.id, {
                                                    tiempoFijoOverrideMin:
                                                      e.target.value === ""
                                                        ? null
                                                        : Number(
                                                            e.target.value,
                                                          ),
                                                  })
                                                }
                                                placeholder="Hereda del perfil"
                                              />
                                              <span className="ps-u">min</span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {familia?.codigo ===
                                    "montaje_sobre_sustrato" &&
                                    (() => {
                                      // Fuente de medida del CONSUMO de material:
                                      // qué piezas nestea el montaje. Es material,
                                      // no tiempo — por eso vive acá, junto al
                                      // nesting, y NO dentro de la rama de tiempo
                                      // (antes se ocultaba al elegir "por lote").
                                      // Además de las opciones fijas ofrece los
                                      // outputs GEOMÉTRICOS de los pasos anteriores
                                      // (el bastidor: tiras de cenefa, chapa…).
                                      // docs/fuente-de-medida-de-consumo-diseno.md §6.
                                      const nombreDe = (p: {
                                        id: string;
                                        familiaCodigo: string;
                                      }) =>
                                        configs[p.id]?.nombreVisible?.trim() ||
                                        familiasMap.get(p.familiaCodigo)
                                          ?.nombre ||
                                        humanizeCode(p.familiaCodigo);
                                      const fuentesGeometricas =
                                        rutaAlternativa.ruta.pasos
                                          .filter((p) => p.orden < paso.orden)
                                          .flatMap((p) =>
                                            (
                                              familiasMap.get(p.familiaCodigo)
                                                ?.outputsGeometricos ?? []
                                            ).map((o) => ({
                                              value: `output:${o.key}`,
                                              label: `${o.etiqueta} · ${nombreDe(p)}`,
                                              description: `Mide sobre "${o.etiqueta}" que publica el paso "${nombreDe(p)}".`,
                                            })),
                                          );
                                      return (
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
                                            options={[
                                              ...MONTAJE_SOURCE_OPTIONS,
                                              ...fuentesGeometricas,
                                            ]}
                                            placeholder="Elegir origen"
                                          />
                                        </div>
                                      );
                                    })()}
                                  {mostrarNesting && (
                                    <AcomodadoDetalladoEditor
                                      pasoId={paso.id}
                                      cfg={cfg}
                                      familia={familia}
                                      lookups={lookups}
                                      maquinaParaDefaults={maquinaParaDefaults}
                                      candidateMaterials={candidateMaterials}
                                      panelEditorPasoId={panelEditorPasoId}
                                      setPanelEditorPasoId={setPanelEditorPasoId}
                                      panelMeasures={panelMeasuresProducto}
                                      nestingApi={{
                                        updateNestingConfig,
                                        updateNestingPieceBleed,
                                        updateNestingMargins,
                                        updateNestingExtraMargins,
                                        updateNestingCosting,
                                        updateNestingPanelizado,
                                        updateNestingPliegoImpresion,
                                        updateNestingPliegoPreset,
                                        updateNestingPliegoCandidato,
                                        addNestingPliegoCandidato,
                                        removeNestingPliegoCandidato,
                                      }}
                                      onParams={updateStepParams}
                                    />
                                  )}

                                  {valAvanzado.errores.length > 0 && (
                                    <ListaValidacion validacion={valAvanzado} />
                                  )}
                                </div>
                              )}
                            </section>
                          </>
                        )}
                          </>
                        )}

                        {!configuracionBase ? (
                          <CostosDirectosPasoPanel
                            configPaso={esExtra ? null : (configExistente ?? null)}
                            pasoExtra={esExtra ? activeExtra : null}
                            catalogoCargos={catalogoCargos}
                            // Los niveles se editan primero en `configs`; el
                            // detalle persistido sólo cambia al guardar. Leer
                            // de `cfg` mantiene esta sección sincronizada en
                            // el mismo render, sin guardar ni recargar.
                            niveles={leerNivelesPaso(cfg?.paramsPasoJson)}
                            onBeforeMutate={
                              pasoTieneCambios
                                ? () => guardarPaso(paso.id)
                                : undefined
                            }
                            includeMeasureFields={
                              producto.modoMedidas === "LIBRE" ||
                              producto.modoMedidas === "MIXTA"
                            }
                            ruleExtraFields={technologyRuleFields}
                          />
                        ) : null}
                      </div>

                      {/* Botonera flotante (feedback 2026-08-06): sólo los
                          botones quedan siempre visibles — sticky al borde
                          inferior de .editor-main (el contenedor con scroll),
                          no un header entero que tape contenido. */}
                      <div
                        style={{
                          position: "sticky",
                          bottom: 12,
                          zIndex: 30,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          width: "fit-content",
                          marginLeft: "auto",
                          marginTop: 14,
                          padding: "8px 10px",
                          borderRadius: 12,
                          background: "var(--surface, #fff)",
                          border: "1px solid var(--hairline, #e6e2dc)",
                          boxShadow: "0 8px 24px rgba(20, 16, 12, 0.14)",
                        }}
                      >
                          {!configuracionBase ? (
                            <>
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
                                disabled={idx === pasosUnificados.length - 1}
                              >
                                Siguiente →
                              </button>
                            </>
                          ) : null}
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
                    </React.Fragment>
                  );
                })
            : null}
          </>
          )}
        </main>
      </div>
      {asistenteAbierto ? (
        <AsistenteGuiado
          pasos={pasosAsistente}
          configs={configs}
          familiasMap={familiasMap}
          lookups={lookups}
          jsonTexts={jsonTexts}
          onPatch={(pasoId, patch) => updateConfig(pasoId, patch)}
          onParams={(pasoId, patch) => updateStepParams(pasoId, patch)}
          onHerencia={onHerenciaEsquema}
          onAddSlotFamilia={(pasoId, slotCodigo) =>
            addSlotFromFamilia(pasoId, slotCodigo)
          }
          onGuardarPaso={async (pasoId) => {
            await guardarPaso(pasoId);
          }}
          guardando={guardando}
          tieneCambios={(pasoId) => hasUnsavedChanges(pasoId)}
          reglaProps={reglaPropsEsquema}
          updateTiempoManualConfig={updateTiempoManualConfig}
          updateModoColorConfig={updateModoColorConfig}
          toggleMaquinaCandidata={toggleMaquinaCandidata}
          setMaquinaCandidataPreferida={setMaquinaCandidataPreferida}
          setMaquinaCandidataPerfilDefault={setMaquinaCandidataPerfilDefault}
          setMaquinaCandidataModoColorAllowed={
            setMaquinaCandidataModoColorAllowed
          }
          setMaquinaCandidataPerfilPorModo={setMaquinaCandidataPerfilPorModo}
          setCoberturaPaso={setCoberturaPaso}
          materialesApi={materialesApiEsquema}
          nestingApi={nestingApiEsquema}
          panelEditorPasoId={panelEditorPasoId}
          setPanelEditorPasoId={setPanelEditorPasoId}
          panelMeasures={getProductoPanelMeasures(producto)}
          onCerrar={() => setAsistenteAbierto(false)}
        />
      ) : null}
    </div>
  );
}




// ─── Acomodado / nesting: LA card del detallado, extraída (sub-fase D) ──
// Algoritmo, demasía, pliego de impresión, panelizado, márgenes extra y
// costeo del sustrato — una sola card cohesiva. La usan el detallado y
// el asistente guiado vía el esquema (oficio.acomodado).

interface NestingApi {
  updateNestingConfig: (pasoId: string, patch: Record<string, unknown>) => void;
  updateNestingPieceBleed: (pasoId: string, value: number) => void;
  updateNestingMargins: (
    pasoId: string,
    patch: Record<string, number | null>,
  ) => void;
  updateNestingExtraMargins: (
    pasoId: string,
    patch: Record<string, number | null>,
  ) => void;
  updateNestingCosting: (pasoId: string, patch: Record<string, unknown>) => void;
  updateNestingPanelizado: (
    pasoId: string,
    patch: Record<string, unknown>,
  ) => void;
  updateNestingPliegoImpresion: (
    pasoId: string,
    patch: Record<string, unknown>,
  ) => void;
  updateNestingPliegoPreset: (pasoId: string, preset: string) => void;
  updateNestingPliegoCandidato: (
    pasoId: string,
    index: number,
    patch: Record<string, unknown>,
  ) => void;
  addNestingPliegoCandidato: (pasoId: string, presetValue?: string) => void;
  removeNestingPliegoCandidato: (pasoId: string, index: number) => void;
}

/** Input de escalones de ocupación (% de placa) como CHIPS: se escribe un
 *  número y con espacio / enter / coma se crea un badge; Backspace en vacío
 *  borra el último. Más claro que la lista separada por comas — el usuario ve
 *  que cada valor quedó tomado. Ordena y deduplica; sólo 1–100. */
function EscalonesChips({
  value,
  onChange,
}: {
  value: number[];
  onChange: (steps: number[]) => void;
}) {
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const steps = value.length > 0 ? value : [25, 50, 75, 100];

  const commit = () => {
    const n = Number(draft.trim());
    setDraft("");
    if (!Number.isFinite(n) || n <= 0 || n > 100 || steps.includes(n)) return;
    onChange([...steps, n].sort((a, b) => a - b));
  };
  const removeAt = (idx: number) =>
    onChange(steps.filter((_, i) => i !== idx));

  return (
    <span
      className={trab.ctl}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 5,
        alignItems: "center",
        cursor: "text",
        paddingTop: 4,
        paddingBottom: 4,
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {steps.map((s, idx) => (
        <span
          key={`${s}-${idx}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            height: 22,
            padding: "0 3px 0 8px",
            borderRadius: 5,
            fontSize: 11.5,
            fontFamily: "var(--font-mono, ui-monospace)",
            background: "var(--surface-2, #f2f0ea)",
            color: "var(--fg-2, #2c2c33)",
            border: "1px solid var(--hairline, #e5e2db)",
          }}
        >
          {s}%
          <button
            type="button"
            aria-label={`Quitar ${s}%`}
            onClick={(e) => {
              e.stopPropagation();
              removeAt(idx);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 15,
              height: 15,
              borderRadius: "50%",
              border: 0,
              background: "transparent",
              color: "var(--muted-text, #6e6e76)",
              cursor: "pointer",
              padding: 0,
              fontSize: 13,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={draft}
        inputMode="numeric"
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (
            e.key === "Backspace" &&
            draft === "" &&
            steps.length > 0
          ) {
            e.preventDefault();
            removeAt(steps.length - 1);
          }
        }}
        onBlur={commit}
        placeholder={steps.length === 0 ? "25" : ""}
        style={{
          border: 0,
          outline: 0,
          background: "transparent",
          font: "inherit",
          fontSize: "12.5px",
          width: 42,
          minWidth: 0,
          flex: "1 0 42px",
          color: "var(--fg, #14141a)",
        }}
      />
    </span>
  );
}

function AcomodadoDetalladoEditor({
  pasoId,
  cfg,
  familia,
  lookups,
  maquinaParaDefaults,
  candidateMaterials,
  panelEditorPasoId,
  setPanelEditorPasoId,
  panelMeasures,
  nestingApi,
  onParams,
}: {
  pasoId: string;
  cfg: UpsertConfigPasoPayload;
  familia: FamiliaListItem | undefined;
  lookups: LookupsConfigPaso;
  maquinaParaDefaults:
    | {
        /** Columna universal: ancho de rollo canónico de la máquina. */
        anchoUtil?: number | string | null;
        parametrosTecnicosJson?: Record<string, unknown> | null;
      }
    | null
    | undefined;
  panelMeasures: ReturnType<typeof getProductoPanelMeasures>;
  candidateMaterials: Record<string, MateriaPrimaBusquedaItem>;
  panelEditorPasoId: string | null;
  setPanelEditorPasoId: React.Dispatch<React.SetStateAction<string | null>>;
  nestingApi: NestingApi;
  /** Escribe en paramsPasoJson (lo usa la imposición para el modo talonario). */
  onParams: (rutaPasoId: string, patch: Record<string, unknown>) => void;
}) {
  const {
    updateNestingConfig,
    updateNestingPieceBleed,
    updateNestingMargins,
    updateNestingExtraMargins,
    updateNestingCosting,
    updateNestingPanelizado,
    updateNestingPliegoImpresion,
    updateNestingPliegoPreset,
    updateNestingPliegoCandidato,
    addNestingPliegoCandidato,
    removeNestingPliegoCandidato,
  } = nestingApi;
  const [mpPickerCandidatoAbierto, setMpPickerCandidatoAbierto] =
    React.useState<string | null>(null);
  const [mpMateriaPorCandidato, setMpMateriaPorCandidato] = React.useState<
    Record<string, MateriaPrimaBusquedaItem>
  >({});
  const nestingConfig = getNestingConfig(cfg.paramsPasoJson);
  const sustratoPrincipal = cfg.slotsMateriales?.find(
    (slot) => slot.slotCodigo === "sustrato_principal",
  );
  const varianteSustrato = lookups.materiasPrimas
    .flatMap((materia) => materia.variantes)
    .find(
      (variante) => variante.id === sustratoPrincipal?.materialVarianteId,
    );
  const attrsSustrato = asRecord(varianteSustrato?.atributosVarianteJson);
  const sustratoRolloDisponible =
    varianteLooksLikeRoll(varianteSustrato) ||
    (sustratoPrincipal?.candidatos ?? []).some((candidate) => {
      const materiaPrima = candidateMaterials[candidate.materiaPrimaId];
      if (!materiaPrima) return false;
      if (materiaPrimaLooksLikeRoll(materiaPrima)) return true;
      const enabledVariantIds = new Set(candidate.varianteIds);
      return materiaPrima.variantes.some((variante) => {
        const enabled =
          enabledVariantIds.size === 0 || enabledVariantIds.has(variante.id);
        return enabled && varianteLooksLikeRoll(variante);
      });
    });
  const defaultSeparation = defaultNestingSeparationForFamily(familia);
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
  const rollWidthForPanelMm =
    readOptionalNumber(attrsSustrato.anchoMm) ??
    readOptionalNumber(attrsSustrato.widthMm) ??
    // Ancho de la máquina = anchoUtil (columna canónica) primero; el resto es
    // fallback legacy. Sync con el motor (nesting-config.ts).
    readOptionalNumber(maquinaParaDefaults?.anchoUtil) ??
    readOptionalNumber(
      maquinaParaDefaults?.parametrosTecnicosJson?.anchoUtil,
    ) ??
    readOptionalNumber(
      maquinaParaDefaults?.parametrosTecnicosJson?.anchoMaxRolloMm,
    ) ??
    readOptionalNumber(
      maquinaParaDefaults?.parametrosTecnicosJson?.anchoMaxMm,
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
  const pliegoOrigenCosto = getPliegoOrigenCosto(
    pliegoImpresionConfig,
  );
  const pliegoPorCandidato =
    pliegoImpresionEsAutomatico &&
    pliegoOrigenCosto === "por_candidato";
  const sustratoCompatibilidad =
    familia?.slotsRequeridos?.find(
      (slot) => slot.codigo === "sustrato_principal",
    )?.compatibilidadMaterial;
  const variantesLookup = lookups.materiasPrimas.flatMap(
    (materia) =>
      materia.variantes.map((variante) => ({
        materia,
        variante,
      })),
  );
  const nestingMargins = asRecord(nestingConfig.margins);
  const nestingCosting = asRecord(nestingConfig.costing);
  const sustratoAnchoLabel = formatMm(
    attrsSustrato.anchoMm ?? attrsSustrato.widthMm,
  );
  const sustratoAltoLabel = formatMm(
    attrsSustrato.largoMm ??
      attrsSustrato.altoMm ??
      attrsSustrato.heightMm,
  );
  const machineMargins = getMachineMargins(maquinaParaDefaults);
  const resolvedPieceBleed = getResolvedNestingNumber(
    nestingConfig.pieceBleedMm,
    Math.max(legacySeparationH, legacySeparationV) / 2,
    0,
  );
  const mostrarPanelizado = panelizadoAplica(
    familia,
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
            ? `${formatNumber(resolvedPanelMaxWidth / 10)} cm máx.`
            : "máx. ancho imprimible",
        ].join(" · ")
      : "";
  return (
    <>
                                    <>
                                    <div className={trab.root}>
                                      <div className={trab.sec}>
                                        <h4 className={trab.h4}>
                                          Acomodado de las piezas
                                        </h4>
                                        <p className={trab.hint}>
                                          Cómo entra cada pieza en el material y
                                          cuánto se cobra por ella.
                                        </p>
                                        <div className="space-y-4">
                                      {/* El selector de Algoritmo se retiró: la física
                                          (superficie del paso, geometría de máquina y
                                          material) ya determina cuál corre, y de 116 pasos
                                          uno solo lo había tocado. El motor sigue
                                          respetando `nestingConfig.algorithm` si viniera
                                          de una config antigua. */}
                                      <div
                                        className={trab.frow}
                                        style={{ marginBottom: 13 }}
                                      >
                                        <span className={trab.frowlb}>
                                          Demasía por lado
                                        </span>
                                        <span
                                          className={trab.ctl}
                                          style={{ width: 104 }}
                                        >
                                          <input
                                            className={trab.num}
                                            inputMode="decimal"
                                            value={String(resolvedPieceBleed)}
                                            onChange={(e) =>
                                              updateNestingPieceBleed(
                                                pasoId,
                                                e.target.value === ""
                                                  ? 0
                                                  : Number(e.target.value),
                                              )
                                            }
                                          />
                                          <span className={trab.u}>mm</span>
                                        </span>
                                        <span className={trab.frowlb}>
                                          de material extra alrededor de cada
                                          pieza, para el corte
                                        </span>
                                      </div>
                                      {familia?.codigo ===
                                      "impresion_por_hoja" ? (
                                        <ImposicionCuadernilloEditor
                                          pasoId={pasoId}
                                          nestingConfig={nestingConfig}
                                          updateNestingConfig={
                                            updateNestingConfig
                                          }
                                          modoTalonario={String(
                                            asRecord(cfg.paramsPasoJson)
                                              .modoTalonarioIncompleto ?? "off",
                                          )}
                                          onModoTalonario={(modo) =>
                                            onParams(pasoId, {
                                              modoTalonarioIncompleto:
                                                modo === "off" ? null : modo,
                                            })
                                          }
                                        />
                                      ) : null}
                                      {familia?.codigo ===
                                        "impresion_por_hoja" && (
                                        <div className={trab.pliego}>
                                          <div className={trab.pliegoHead}>
                                            <span className={trab.pliegoT}>
                                              Pliego de impresión
                                            </span>
                                            {sustratoAnchoLabel &&
                                            sustratoAltoLabel ? (
                                              <span className={trab.pliegoSust}>
                                                sustrato {sustratoAnchoLabel} ×{" "}
                                                {sustratoAltoLabel}
                                              </span>
                                            ) : null}
                                          </div>
                                          <div className={trab.grid3}>
                                            <span className={trab.fl}>
                                              <span className={trab.k}>
                                                Tamaño
                                              </span>
                                              <span
                                                className={`${trab.ctl} ${trab.sel}`}
                                              >
                                                <select
                                                  value={pliegoImpresionPreset}
                                                  onChange={(e) =>
                                                    updateNestingPliegoPreset(
                                                      pasoId,
                                                      e.target.value ||
                                                        "materia_prima",
                                                    )
                                                  }
                                                >
                                                  {PLIEGO_IMPRESION_OPTIONS.map(
                                                    (o) => (
                                                      <option
                                                        key={o.value}
                                                        value={o.value}
                                                      >
                                                        {o.label}
                                                      </option>
                                                    ),
                                                  )}
                                                </select>
                                              </span>
                                            </span>
                                            <span className={trab.fl}>
                                              <span className={trab.k}>
                                                Ancho del pliego
                                              </span>
                                              <span className={trab.ctl}>
                                                <input
                                                  className={trab.num}
                                                  inputMode="decimal"
                                                  disabled={
                                                    !pliegoImpresionEsPersonalizado
                                                  }
                                                  placeholder="usar sustrato"
                                                  value={String(
                                                    pliegoImpresionConfig.anchoMm ??
                                                      "",
                                                  )}
                                                  onChange={(e) =>
                                                    updateNestingPliegoImpresion(
                                                      pasoId,
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
                                                />
                                                <span className={trab.u}>mm</span>
                                              </span>
                                            </span>
                                            <span className={trab.fl}>
                                              <span className={trab.k}>
                                                Alto del pliego
                                              </span>
                                              <span className={trab.ctl}>
                                                <input
                                                  className={trab.num}
                                                  inputMode="decimal"
                                                  disabled={
                                                    !pliegoImpresionEsPersonalizado
                                                  }
                                                  placeholder="usar sustrato"
                                                  value={String(
                                                    pliegoImpresionConfig.altoMm ??
                                                      "",
                                                  )}
                                                  onChange={(e) =>
                                                    updateNestingPliegoImpresion(
                                                      pasoId,
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
                                                />
                                                <span className={trab.u}>mm</span>
                                              </span>
                                            </span>
                                          </div>
                                          {pliegoImpresionEsAutomatico && (
                                            <div className={trab.cand}>
                                              <span
                                                className={trab.fl}
                                                style={{ maxWidth: 320 }}
                                              >
                                                <span className={trab.k}>
                                                  Origen del costo
                                                </span>
                                                <span
                                                  className={`${trab.ctl} ${trab.sel}`}
                                                >
                                                  <select
                                                    value={pliegoOrigenCosto}
                                                    onChange={(e) =>
                                                      updateNestingPliegoImpresion(
                                                        pasoId,
                                                        {
                                                          origenCosto:
                                                            e.target.value ===
                                                            "por_candidato"
                                                              ? "por_candidato"
                                                              : "derivado",
                                                        },
                                                      )
                                                    }
                                                  >
                                                    {PLIEGO_ORIGEN_COSTO_OPTIONS.map(
                                                      (o) => (
                                                        <option
                                                          key={o.value}
                                                          value={o.value}
                                                        >
                                                          {o.label}
                                                        </option>
                                                      ),
                                                    )}
                                                  </select>
                                                </span>
                                              </span>
                                              <div className={trab.candHead}>
                                                <span className={trab.candTitle}>
                                                  Candidatos activos
                                                </span>
                                                <button
                                                  type="button"
                                                  className={trab.addcand}
                                                  onClick={() =>
                                                    addNestingPliegoCandidato(
                                                      pasoId,
                                                      "A4",
                                                    )
                                                  }
                                                >
                                                  <svg
                                                    width="12"
                                                    height="12"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                  >
                                                    <path d="M12 5v14M5 12h14" />
                                                  </svg>
                                                  Agregar candidato
                                                </button>
                                              </div>
                                              {pliegoCandidatos.length === 0 ? (
                                                <div className={trab.candEmpty}>
                                                  Agregá al menos un tamaño para
                                                  que el motor pueda comparar.
                                                </div>
                                              ) : (
                                                <div className={trab.candList}>
                                                  {pliegoCandidatos.map(
                                                    (candidato, index) => {
                                                      const candidatoPreset =
                                                        typeof candidato.preset ===
                                                        "string"
                                                          ? candidato.preset
                                                          : "personalizado";
                                                      const candidatoKey = `${pasoId}:${index}`;
                                                      const candidatoMpVarianteId =
                                                        getCandidatoMateriaPrimaVarianteId(
                                                          candidato,
                                                        );
                                                      const candidatoMpLookup =
                                                        candidatoMpVarianteId
                                                          ? variantesLookup.find(
                                                              (item) =>
                                                                item.variante
                                                                  .id ===
                                                                candidatoMpVarianteId,
                                                            )
                                                          : undefined;
                                                      const candidatoMpMateria =
                                                        mpMateriaPorCandidato[
                                                          candidatoKey
                                                        ];
                                                      return (
                                                        <React.Fragment
                                                          key={`${candidato.id ?? index}-${index}`}
                                                        >
                                                          <div
                                                            className={trab.crow}
                                                          >
                                                            <label
                                                              className={trab.cx}
                                                            >
                                                              <input
                                                                type="checkbox"
                                                                checked={
                                                                  candidato.activo !==
                                                                  false
                                                                }
                                                                onChange={(e) =>
                                                                  updateNestingPliegoCandidato(
                                                                    pasoId,
                                                                    index,
                                                                    {
                                                                      activo:
                                                                        e.target
                                                                          .checked,
                                                                    },
                                                                  )
                                                                }
                                                              />
                                                              Activa
                                                            </label>
                                                            <span
                                                              className={trab.fl}
                                                            >
                                                              <span
                                                                className={
                                                                  trab.k
                                                                }
                                                              >
                                                                Nombre
                                                              </span>
                                                              <span
                                                                className={
                                                                  trab.ctl
                                                                }
                                                              >
                                                                <input
                                                                  value={String(
                                                                    candidato.nombre ??
                                                                      "",
                                                                  )}
                                                                  onChange={(e) =>
                                                                    updateNestingPliegoCandidato(
                                                                      pasoId,
                                                                      index,
                                                                      {
                                                                        nombre:
                                                                          e.target
                                                                            .value,
                                                                      },
                                                                    )
                                                                  }
                                                                  style={{
                                                                    border: 0,
                                                                    outline: 0,
                                                                    background:
                                                                      "transparent",
                                                                    font: "inherit",
                                                                    fontSize:
                                                                      "12.5px",
                                                                    width: "100%",
                                                                    minWidth: 0,
                                                                    color:
                                                                      "var(--c-ink)",
                                                                  }}
                                                                />
                                                              </span>
                                                            </span>
                                                            <span
                                                              className={trab.fl}
                                                            >
                                                              <span
                                                                className={
                                                                  trab.k
                                                                }
                                                              >
                                                                Preset
                                                              </span>
                                                              <span
                                                                className={`${trab.ctl} ${trab.sel}`}
                                                              >
                                                                <select
                                                                  value={
                                                                    PLIEGO_IMPRESION_PRESETS.some(
                                                                      (preset) =>
                                                                        preset.value ===
                                                                        candidatoPreset,
                                                                    )
                                                                      ? candidatoPreset
                                                                      : "personalizado"
                                                                  }
                                                                  onChange={(
                                                                    e,
                                                                  ) => {
                                                                    const v =
                                                                      e.target
                                                                        .value;
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
                                                                        pasoId,
                                                                        index,
                                                                        {
                                                                          preset:
                                                                            "personalizado",
                                                                        },
                                                                      );
                                                                      return;
                                                                    }
                                                                    updateNestingPliegoCandidato(
                                                                      pasoId,
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
                                                                >
                                                                  {PLIEGO_IMPRESION_OPTIONS.filter(
                                                                    (option) =>
                                                                      ![
                                                                        "materia_prima",
                                                                        "automatico",
                                                                      ].includes(
                                                                        option.value,
                                                                      ),
                                                                  ).map((o) => (
                                                                    <option
                                                                      key={
                                                                        o.value
                                                                      }
                                                                      value={
                                                                        o.value
                                                                      }
                                                                    >
                                                                      {o.label}
                                                                    </option>
                                                                  ))}
                                                                </select>
                                                              </span>
                                                            </span>
                                                            <span
                                                              className={trab.fl}
                                                            >
                                                              <span
                                                                className={
                                                                  trab.k
                                                                }
                                                              >
                                                                Ancho
                                                              </span>
                                                              <span
                                                                className={
                                                                  trab.ctl
                                                                }
                                                              >
                                                                <input
                                                                  className={
                                                                    trab.num
                                                                  }
                                                                  inputMode="decimal"
                                                                  value={String(
                                                                    candidato.anchoMm ??
                                                                      "",
                                                                  )}
                                                                  onChange={(e) =>
                                                                    updateNestingPliegoCandidato(
                                                                      pasoId,
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
                                                                />
                                                                <span
                                                                  className={
                                                                    trab.u
                                                                  }
                                                                >
                                                                  mm
                                                                </span>
                                                              </span>
                                                            </span>
                                                            <span
                                                              className={trab.fl}
                                                            >
                                                              <span
                                                                className={
                                                                  trab.k
                                                                }
                                                              >
                                                                Alto
                                                              </span>
                                                              <span
                                                                className={
                                                                  trab.ctl
                                                                }
                                                              >
                                                                <input
                                                                  className={
                                                                    trab.num
                                                                  }
                                                                  inputMode="decimal"
                                                                  value={String(
                                                                    candidato.altoMm ??
                                                                      "",
                                                                  )}
                                                                  onChange={(e) =>
                                                                    updateNestingPliegoCandidato(
                                                                      pasoId,
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
                                                                />
                                                                <span
                                                                  className={
                                                                    trab.u
                                                                  }
                                                                >
                                                                  mm
                                                                </span>
                                                              </span>
                                                            </span>
                                                            <button
                                                              type="button"
                                                              className={
                                                                trab.del
                                                              }
                                                              title="Quitar candidato"
                                                              onClick={() =>
                                                                removeNestingPliegoCandidato(
                                                                  pasoId,
                                                                  index,
                                                                )
                                                              }
                                                            >
                                                              <Trash2Icon className="h-4 w-4" />
                                                            </button>
                                                          </div>
                                                          {pliegoPorCandidato && (
                                                            <div
                                                              className={
                                                                trab.cmp
                                                              }
                                                            >
                                                              <div
                                                                className={
                                                                  trab.cmpRow
                                                                }
                                                              >
                                                                <span>
                                                                  Materia prima
                                                                  propia
                                                                </span>
                                                                {candidatoMpVarianteId ? (
                                                                  <span
                                                                    className={
                                                                      trab.cmpChip
                                                                    }
                                                                  >
                                                                    {candidatoMpLookup
                                                                      ? `${candidatoMpLookup.materia.nombre} · ${candidatoMpLookup.variante.sku}`
                                                                      : typeof candidato.materiaPrimaSku ===
                                                                          "string"
                                                                        ? candidato.materiaPrimaSku
                                                                        : "Variante seleccionada"}
                                                                    {candidatoMpLookup
                                                                      ?.variante
                                                                      .precioReferencia
                                                                      ? ` · ${formatearMoneda(Number(candidatoMpLookup.variante.precioReferencia), monedaDe(candidatoMpLookup.variante.moneda))}`
                                                                      : ""}
                                                                  </span>
                                                                ) : (
                                                                  <span>
                                                                    Sin asignar:
                                                                    compite con el
                                                                    costo derivado
                                                                    del material
                                                                    del paso.
                                                                  </span>
                                                                )}
                                                                <button
                                                                  type="button"
                                                                  className={
                                                                    trab.cmpBtn
                                                                  }
                                                                  onClick={() =>
                                                                    setMpPickerCandidatoAbierto(
                                                                      mpPickerCandidatoAbierto ===
                                                                        candidatoKey
                                                                        ? null
                                                                        : candidatoKey,
                                                                    )
                                                                  }
                                                                >
                                                                  {candidatoMpVarianteId
                                                                    ? "Cambiar"
                                                                    : "Elegir"}
                                                                </button>
                                                                {candidatoMpVarianteId && (
                                                                  <button
                                                                    type="button"
                                                                    className={`${trab.cmpBtn} ${trab.cmpBtnDel}`}
                                                                    onClick={() => {
                                                                      updateNestingPliegoCandidato(
                                                                        pasoId,
                                                                        index,
                                                                        {
                                                                          materiaPrimaVarianteId:
                                                                            null,
                                                                          materiaPrimaSku:
                                                                            null,
                                                                        },
                                                                      );
                                                                      setMpMateriaPorCandidato(
                                                                        (
                                                                          prev,
                                                                        ) => {
                                                                          const next =
                                                                            {
                                                                              ...prev,
                                                                            };
                                                                          delete next[
                                                                            candidatoKey
                                                                          ];
                                                                          return next;
                                                                        },
                                                                      );
                                                                    }}
                                                                  >
                                                                    Quitar
                                                                  </button>
                                                                )}
                                                              </div>
                                                              {mpPickerCandidatoAbierto ===
                                                                candidatoKey && (
                                                                <div className="space-y-2">
                                                                  <MaterialSearchSelect
                                                                    compatibilidad={
                                                                      sustratoCompatibilidad
                                                                    }
                                                                    placeholder="Buscar materia prima para este candidato..."
                                                                    selectedIds={
                                                                      candidatoMpLookup
                                                                        ? [
                                                                            candidatoMpLookup
                                                                              .materia
                                                                              .id,
                                                                          ]
                                                                        : []
                                                                    }
                                                                    onSelect={(
                                                                      materiaPrima,
                                                                    ) => {
                                                                      if (
                                                                        materiaPrima
                                                                          .variantes
                                                                          .length ===
                                                                        1
                                                                      ) {
                                                                        const variante =
                                                                          materiaPrima
                                                                            .variantes[0];
                                                                        updateNestingPliegoCandidato(
                                                                          pasoId,
                                                                          index,
                                                                          {
                                                                            materiaPrimaVarianteId:
                                                                              variante.id,
                                                                            materiaPrimaSku:
                                                                              variante.sku,
                                                                          },
                                                                        );
                                                                        setMpPickerCandidatoAbierto(
                                                                          null,
                                                                        );
                                                                        setMpMateriaPorCandidato(
                                                                          (
                                                                            prev,
                                                                          ) => {
                                                                            const next =
                                                                              {
                                                                                ...prev,
                                                                              };
                                                                            delete next[
                                                                              candidatoKey
                                                                            ];
                                                                            return next;
                                                                          },
                                                                        );
                                                                        return;
                                                                      }
                                                                      setMpMateriaPorCandidato(
                                                                        (
                                                                          prev,
                                                                        ) => ({
                                                                          ...prev,
                                                                          [candidatoKey]:
                                                                            materiaPrima,
                                                                        }),
                                                                      );
                                                                    }}
                                                                  />
                                                                  {candidatoMpMateria &&
                                                                    candidatoMpMateria
                                                                      .variantes
                                                                      .length >
                                                                      1 && (
                                                                      <HumanSelect
                                                                        value=""
                                                                        onValueChange={(
                                                                          varianteId,
                                                                        ) => {
                                                                          const variante =
                                                                            candidatoMpMateria.variantes.find(
                                                                              (
                                                                                item,
                                                                              ) =>
                                                                                item.id ===
                                                                                varianteId,
                                                                            );
                                                                          if (
                                                                            !variante
                                                                          )
                                                                            return;
                                                                          updateNestingPliegoCandidato(
                                                                            pasoId,
                                                                            index,
                                                                            {
                                                                              materiaPrimaVarianteId:
                                                                                variante.id,
                                                                              materiaPrimaSku:
                                                                                variante.sku,
                                                                            },
                                                                          );
                                                                          setMpPickerCandidatoAbierto(
                                                                            null,
                                                                          );
                                                                          setMpMateriaPorCandidato(
                                                                            (
                                                                              prev,
                                                                            ) => {
                                                                              const next =
                                                                                {
                                                                                  ...prev,
                                                                                };
                                                                              delete next[
                                                                                candidatoKey
                                                                              ];
                                                                              return next;
                                                                            },
                                                                          );
                                                                        }}
                                                                        options={candidatoMpMateria.variantes.map(
                                                                          (
                                                                            variante,
                                                                          ) => ({
                                                                            value:
                                                                              variante.id,
                                                                            label:
                                                                              variante.nombreVariante?.trim() ||
                                                                              variante.sku,
                                                                            description:
                                                                              variante.precioReferencia
                                                                                ? `${formatearMoneda(Number(variante.precioReferencia), monedaDe(variante.moneda))} · ${variante.sku}`
                                                                                : variante.sku,
                                                                          }),
                                                                        )}
                                                                        placeholder="Elegir variante"
                                                                      />
                                                                    )}
                                                                </div>
                                                              )}
                                                            </div>
                                                          )}
                                                        </React.Fragment>
                                                      );
                                                    },
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                          <p className={trab.hint}>
                                            La imposición, el tiempo y los
                                            consumibles se calculan sobre este
                                            pliego; el sustrato principal se
                                            convierte contra el tamaño comprado
                                            cuando corresponde.
                                          </p>
                                        </div>
                                      )}
                                      <button
                                        type="button"
                                        className={trab.sw2}
                                        aria-pressed={
                                          nestingConfig.allowRotation !== false
                                        }
                                        onClick={() =>
                                          updateNestingConfig(pasoId, {
                                            allowRotation:
                                              nestingConfig.allowRotation ===
                                              false,
                                          })
                                        }
                                      >
                                        <span className={trab.tr} />
                                        <span>
                                          <span className={trab.sw2t}>
                                            Permitir rotar piezas
                                          </span>
                                          <span className={trab.sw2d}>
                                            El nesting puede girar la pieza 90°
                                            si así entra mejor. Apagalo cuando el
                                            material tiene veta o dirección de
                                            impresión.
                                          </span>
                                        </span>
                                      </button>

                                      {mostrarPanelizado && (
                                        <>
                                            <button
                                              type="button"
                                              className={trab.sw2}
                                              aria-pressed={
                                                panelizadoConfig.enabled === true
                                              }
                                              onClick={() => {
                                                const next =
                                                  panelizadoConfig.enabled !==
                                                  true;
                                                updateNestingPanelizado(pasoId, {
                                                  enabled: next,
                                                  mode: next
                                                    ? panelizadoMode
                                                    : "automatic",
                                                  axis: next
                                                    ? panelizadoAxis
                                                    : "automatic",
                                                  manualLayout: next
                                                    ? panelizadoConfig.manualLayout
                                                    : null,
                                                });
                                              }}
                                            >
                                              <span className={trab.tr} />
                                              <span>
                                                <span className={trab.sw2t}>
                                                  Panelizar piezas grandes
                                                </span>
                                                <span className={trab.sw2d}>
                                                  Si la pieza no entra en el
                                                  ancho del material, se corta en
                                                  paneles que después se
                                                  empalman.
                                                </span>
                                              </span>
                                            </button>
                                          {panelizadoConfig.enabled ===
                                            true && (
                                            <div className={trab.subtog}>
                                              <div className={trab.prow2}>
                                                <span>
                                                  <span className={trab.p2a}>
                                                    Modo
                                                  </span>
                                                  <span className={trab.p2b}>
                                                    Automático corta la cantidad
                                                    mínima de paneles que entren
                                                    en el ancho útil.
                                                  </span>
                                                </span>
                                                <HumanSelect
                                                  value={panelizadoMode}
                                                  onValueChange={(v) =>
                                                    updateNestingPanelizado(
                                                      pasoId,
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
                                              <div className={trab.prow2}>
                                                <span>
                                                  <span className={trab.p2a}>
                                                    Dirección
                                                  </span>
                                                  <span className={trab.p2b}>
                                                    Por dónde se parte la pieza.
                                                    Automática elige la que
                                                    genere menos paneles.
                                                  </span>
                                                </span>
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
                                                      pasoId,
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
                                              <div className={trab.prow2}>
                                                <span>
                                                  <span className={trab.p2a}>
                                                    Solape
                                                  </span>
                                                  <span className={trab.p2b}>
                                                    Material compartido entre
                                                    paneles contiguos para
                                                    empalmar. Se suma al consumo.
                                                  </span>
                                                </span>
                                                <span className={trab.ctl}>
                                                  <input
                                                    className={trab.num}
                                                    inputMode="decimal"
                                                    value={String(
                                                      resolvedPanelOverlap,
                                                    )}
                                                    onChange={(e) =>
                                                      updateNestingPanelizado(
                                                        pasoId,
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
                                                  />
                                                  <span className={trab.u}>
                                                    mm
                                                  </span>
                                                </span>
                                              </div>
                                              <div className={trab.prow2}>
                                                <span>
                                                  <span className={trab.p2a}>
                                                    Ancho máx. por panel
                                                  </span>
                                                  <span className={trab.p2b}>
                                                    Vacío = el ancho imprimible
                                                    de la máquina.
                                                  </span>
                                                </span>
                                                <span className={trab.ctl}>
                                                  {/* Se edita en cm y se guarda en mm. La regla
                                                      "<30 cm se trata como 0" se aplica al blur. */}
                                                  <input
                                                    className={trab.num}
                                                    inputMode="decimal"
                                                    placeholder="ancho imprimible"
                                                    value={mmToCmInput(
                                                      getResolvedNestingNumber(
                                                        panelizadoConfig.maxPanelWidthMm,
                                                        undefined,
                                                        0,
                                                      ),
                                                    )}
                                                    onChange={(e) =>
                                                      updateNestingPanelizado(
                                                        pasoId,
                                                        {
                                                          maxPanelWidthMm:
                                                            cmInputToMm(
                                                              e.target.value,
                                                            ) ?? 0,
                                                        },
                                                      )
                                                    }
                                                    onBlur={(e) => {
                                                      const valorMm =
                                                        cmInputToMm(
                                                          e.target.value,
                                                        ) ?? 0;
                                                      if (
                                                        valorMm > 0 &&
                                                        valorMm <
                                                          MIN_PANEL_MAX_WIDTH_MM
                                                      ) {
                                                        updateNestingPanelizado(
                                                          pasoId,
                                                          { maxPanelWidthMm: 0 },
                                                        );
                                                      }
                                                    }}
                                                  />
                                                  <span className={trab.u}>
                                                    cm
                                                  </span>
                                                </span>
                                              </div>
                                              <div className={trab.prow2}>
                                                <span>
                                                  <span className={trab.p2a}>
                                                    Distribución
                                                  </span>
                                                  <span className={trab.p2b}>
                                                    Equilibrada reparte el ancho
                                                    en paneles iguales; llenar
                                                    deja el resto en el último.
                                                  </span>
                                                </span>
                                                <HumanSelect
                                                  value={String(
                                                    panelizadoConfig.distribution ??
                                                      "equilibrada",
                                                  )}
                                                  onValueChange={(v) =>
                                                    updateNestingPanelizado(
                                                      pasoId,
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
                                              <div className={trab.prow2}>
                                                <span>
                                                  <span className={trab.p2a}>
                                                    Interpretación del ancho
                                                  </span>
                                                  <span className={trab.p2b}>
                                                    Si el máximo de arriba
                                                    incluye el solape o es el
                                                    ancho neto visible.
                                                  </span>
                                                </span>
                                                <HumanSelect
                                                  value={String(
                                                    panelizadoConfig.widthInterpretation ??
                                                      "total",
                                                  )}
                                                  onValueChange={(v) =>
                                                    updateNestingPanelizado(
                                                      pasoId,
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
                                                <div className={trab.prow2}>
                                                  <span>
                                                    <span className={trab.p2a}>
                                                      Layout manual de paneles
                                                    </span>
                                                    <span className={trab.p2b}>
                                                      {panelManualLayout
                                                        ? `${panelManualLayout.items.length} medida${panelManualLayout.items.length === 1 ? "" : "s"} con layout manual`
                                                        : "Sin layout manual guardado"}
                                                    </span>
                                                  </span>
                                                  <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={
                                                      panelMeasures.length === 0
                                                    }
                                                    onClick={() =>
                                                      setPanelEditorPasoId(
                                                        pasoId,
                                                      )
                                                    }
                                                  >
                                                    Editar paneles
                                                  </Button>
                                                </div>
                                              ) : null}
                                            </div>
                                          )}
                                          <PanelManualEditorSheet
                                            open={panelEditorPasoId === pasoId}
                                            onOpenChange={(open) =>
                                              setPanelEditorPasoId(
                                                open ? pasoId : null,
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
                                              updateNestingPanelizado(pasoId, {
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
                                        </>
                                      )}

                                      </div>
                                    </div>
                                    </div>

                                    {/* Bloque propio: su primer .sec pierde el
                                        padding-top por .sec:first-child y quedaba
                                        pegado a la línea de arriba. Se separa con
                                        un margen (pedido del usuario 2026-08-13). */}
                                    <div
                                      className={trab.root}
                                      style={{ marginTop: 16 }}
                                    >
                                      <div
                                        className={`${trab.sec} ${trab.secLast}`}
                                      >
                                        <h4 className={trab.h4}>
                                          Márgenes del pliego
                                        </h4>
                                        <p className={trab.hint}>
                                          Bordes del material que el nesting no
                                          puede usar. Se acumulan: primero el de
                                          la máquina, después el de este paso.
                                        </p>
                                        <div className={trab.marg}>
                                          {(() => {
                                            const lados = [
                                              ["topMm", "Sup."],
                                              ["rightMm", "Der."],
                                              ["bottomMm", "Inf."],
                                              ["leftMm", "Izq."],
                                            ] as const;
                                            const marginOverride = lados.some(
                                              ([k]) => nestingMargins[k] != null,
                                            );
                                            const cm = (k: string) =>
                                              formatNumber(
                                                (Number(
                                                  (
                                                    machineMargins as Record<
                                                      string,
                                                      unknown
                                                    >
                                                  )[k],
                                                ) || 0) / 10,
                                              );
                                            return (
                                              <div className={trab.mgrp}>
                                                <span>
                                                  <span className={trab.mgrpa}>
                                                    No imprimible
                                                    <span
                                                      className={trab.pill}
                                                    >
                                                      heredado {cm("topMm")} ·{" "}
                                                      {cm("rightMm")} ·{" "}
                                                      {cm("bottomMm")} ·{" "}
                                                      {cm("leftMm")} cm
                                                    </span>
                                                  </span>
                                                  <span className={trab.mgrpb}>
                                                    Lo impone el cabezal:
                                                    ninguna máquina imprime al
                                                    ras del borde. Viene de la
                                                    máquina preferida — editá
                                                    solo si esta ruta usa un
                                                    borde distinto.
                                                  </span>
                                                  {marginOverride ? (
                                                    <span
                                                      className={trab.inhrow}
                                                    >
                                                      <span>
                                                        Sobrescribís el margen
                                                        de la máquina.
                                                      </span>
                                                      <button
                                                        type="button"
                                                        className={trab.lnk}
                                                        onClick={() =>
                                                          updateNestingMargins(
                                                            pasoId,
                                                            {
                                                              topMm: null,
                                                              rightMm: null,
                                                              bottomMm: null,
                                                              leftMm: null,
                                                            },
                                                          )
                                                        }
                                                      >
                                                        Volver al heredado
                                                      </button>
                                                    </span>
                                                  ) : null}
                                                </span>
                                                <span className={trab.mfields}>
                                                  {lados.map(([key, label]) => (
                                                    <span
                                                      key={key}
                                                      className={trab.mf}
                                                    >
                                                      <span
                                                        className={trab.mfk}
                                                      >
                                                        {label}
                                                      </span>
                                                      <span
                                                        className={trab.ctl}
                                                      >
                                                        <DecimalDraftInput
                                                          className={trab.num}
                                                          value={mmToCmInput(
                                                            getResolvedNestingNumber(
                                                              nestingMargins[
                                                                key
                                                              ],
                                                              machineMargins[
                                                                key as keyof typeof machineMargins
                                                              ],
                                                              0,
                                                            ),
                                                          )}
                                                          onValueChange={(value) =>
                                                            updateNestingMargins(
                                                              pasoId,
                                                              {
                                                                [key]: value == null
                                                                  ? null
                                                                  : value * 10,
                                                              },
                                                            )
                                                          }
                                                        />
                                                        <span
                                                          className={trab.u}
                                                        >
                                                          cm
                                                        </span>
                                                      </span>
                                                    </span>
                                                  ))}
                                                </span>
                                              </div>
                                            );
                                          })()}
                                          <div className={trab.mgrp}>
                                            <span>
                                              <span className={trab.mgrpa}>
                                                Extra de este paso
                                              </span>
                                              <span className={trab.mgrpb}>
                                                Se suma al anterior y sale del
                                                área útil, pero no cambia la
                                                separación entre piezas. Sirve
                                                para pinza, agarre o refilado
                                                posterior.
                                              </span>
                                            </span>
                                            <span className={trab.mfields}>
                                              {(
                                                [
                                                  ["topMm", "Sup."],
                                                  ["rightMm", "Der."],
                                                  ["bottomMm", "Inf."],
                                                  ["leftMm", "Izq."],
                                                ] as const
                                              ).map(([key, label]) => (
                                                <span
                                                  key={key}
                                                  className={trab.mf}
                                                >
                                                  <span className={trab.mfk}>
                                                    {label}
                                                  </span>
                                                  <span className={trab.ctl}>
                                                    <DecimalDraftInput
                                                      className={trab.num}
                                                      value={decimalInputText(
                                                        nestingExtraMargins[
                                                          key
                                                        ],
                                                      )}
                                                      onValueChange={(value) =>
                                                        updateNestingExtraMargins(
                                                          pasoId,
                                                          {
                                                            [key]: value,
                                                          },
                                                        )
                                                      }
                                                      placeholder="0"
                                                    />
                                                    <span className={trab.u}>
                                                      mm
                                                    </span>
                                                  </span>
                                                </span>
                                              ))}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* El costeo del sustrato se muestra SIEMPRE, para que Acomodo
                                        sea consistente en todos los pasos que lo tienen. En SHEET
                                        (placa/pliego) es un selector de estrategia. En ROLLO hoy hay
                                        una sola forma —largo consumido × ancho útil, incluido el
                                        sobrante que no se reutiliza— y se muestra RESUELTA
                                        (informativa): el motor la deriva del sustrato, no se guarda
                                        un valor que ignoraría (sería dato muerto). Cuando se modelen
                                        distintas estrategias de rollo, esto pasa a selector.
                                        Ver docs/editor-pasos-preguntas-orden.md §10.5. */}
                                    {(
                                      <div className={trab.root}>
                                      <div className={trab.pliego}>
                                        <div className={trab.pliegoHead}>
                                          <span className={trab.pliegoT}>
                                            Costeo del sustrato
                                          </span>
                                        </div>
                                        <p
                                          className={trab.hint}
                                          style={{ margin: "-4px 0 0" }}
                                        >
                                          {sustratoRolloDisponible
                                            ? ROLLO_COSTEO_OPTIONS[0].description
                                            : "Cómo se cobra el material cuando hay resultado de nesting."}
                                        </p>
                                        <div
                                          style={{
                                            display: "grid",
                                            gridTemplateColumns:
                                              "repeat(auto-fit, minmax(220px, 1fr))",
                                            gap: 12,
                                            alignItems: "end",
                                          }}
                                        >
                                          {sustratoRolloDisponible ? (
                                            <span className={trab.fl}>
                                              <span className={trab.k}>
                                                Estrategia
                                              </span>
                                              <span
                                                className={trab.ctl}
                                                style={{
                                                  alignItems: "center",
                                                  fontWeight: 500,
                                                  color: "var(--fg, #14141a)",
                                                }}
                                              >
                                                {ROLLO_COSTEO_OPTIONS[0].label}
                                              </span>
                                            </span>
                                          ) : (
                                          <>
                                          <span className={trab.fl}>
                                            <span className={trab.k}>
                                              Estrategia
                                            </span>
                                            <span
                                              className={`${trab.ctl} ${trab.sel}`}
                                            >
                                              <select
                                                value={String(
                                                  nestingCosting.strategy ??
                                                    "simple",
                                                )}
                                                onChange={(e) =>
                                                  updateNestingCosting(pasoId, {
                                                    strategy:
                                                      e.target.value || "simple",
                                                  })
                                                }
                                              >
                                                {costingStrategyOptions(
                                                  familia?.codigo ===
                                                    "impresion_por_hoja"
                                                    ? "pliego"
                                                    : "placa",
                                                ).map((o) => (
                                                  <option
                                                    key={o.value}
                                                    value={o.value}
                                                  >
                                                    {o.label}
                                                  </option>
                                                ))}
                                              </select>
                                            </span>
                                          </span>
                                          {nestingCosting.strategy ===
                                            "plate-segments" && (
                                            <span className={trab.fl}>
                                              <span className={trab.k}>
                                                Escalones de ocupación{" "}
                                                <span
                                                  style={{
                                                    color:
                                                      "var(--muted-text-2, #92929b)",
                                                  }}
                                                >
                                                  · % de placa, ej 25, 50, 75,
                                                  100
                                                </span>
                                              </span>
                                              <EscalonesChips
                                                value={
                                                  Array.isArray(
                                                    nestingCosting.segmentSteps,
                                                  )
                                                    ? (nestingCosting.segmentSteps as number[])
                                                    : [25, 50, 75, 100]
                                                }
                                                onChange={(steps) =>
                                                  updateNestingCosting(pasoId, {
                                                    segmentSteps: steps,
                                                  })
                                                }
                                              />
                                            </span>
                                          )}
                                          </>
                                          )}
                                        </div>
                                      </div>
                                      </div>
                                    )}
                                    </>
    </>
  );
}

// ─── Material fijo del slot: LA UI del detallado, extraída ─────────────
// (sub-fase C). La usan el detallado y el asistente guiado vía el esquema
// (materiales.material).

function MaterialFijoSlotDetalladoEditor({
  pasoId,
  slotIdx,
  slot,
  slotDecl,
  persistedSlot,
  candidateMaterials,
  setCandidateMaterials,
  hardcodedMaterialSelections,
  setHardcodedMaterialSelections,
  updateSlot,
}: {
  pasoId: string;
  slotIdx: number;
  slot: UpsertSlotMaterialPayload;
  slotDecl: { compatibilidadMaterial?: SlotCompatibilidad } | null | undefined;
  persistedSlot: SlotMaterialDetalle | null | undefined;
  candidateMaterials: Record<string, MateriaPrimaBusquedaItem>;
  setCandidateMaterials: React.Dispatch<
    React.SetStateAction<Record<string, MateriaPrimaBusquedaItem>>
  >;
  hardcodedMaterialSelections: Record<string, string>;
  setHardcodedMaterialSelections: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  updateSlot: (
    pasoId: string,
    slotIdx: number,
    patch: Partial<UpsertSlotMaterialPayload>,
  ) => void;
}) {
  const slotUiKey = `${pasoId}:${slot.slotCodigo}:${slotIdx}`;
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>
          Qué material se usa
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--muted-text, #6e6e76)",
            marginTop: 2,
          }}
        >
          Un solo material, con la variante ya definida. Elegilo de la lista.
        </div>
      </div>
      <MaterialSearchSelect
        compatibilidad={slotDecl?.compatibilidadMaterial}
        placeholder="Buscar materia prima compatible..."
        selectedIds={hardcodedMateria ? [hardcodedMateria.id] : []}
        onSelect={(materiaPrima) => {
          setCandidateMaterials((prev) => ({
            ...prev,
            [materiaPrima.id]: materiaPrima,
          }));
          setHardcodedMaterialSelections((prev) => ({
            ...prev,
            [slotUiKey]: materiaPrima.id,
          }));
          updateSlot(pasoId, slotIdx, {
            materialVarianteId:
              materiaPrima.variantes.length === 1
                ? (materiaPrima.variantes[0]?.id ?? null)
                : null,
          });
        }}
        onDeselect={() => {
          setHardcodedMaterialSelections((prev) => {
            const next = { ...prev };
            delete next[slotUiKey];
            return next;
          });
          updateSlot(pasoId, slotIdx, { materialVarianteId: null });
        }}
        pinnedItems={hardcodedMateria ? [hardcodedMateria] : []}
        renderDetail={(item) =>
          item.variantes.length > 1 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--muted-text, #6e6e76)",
                }}
              >
                Variante que se usa
              </span>
              <HumanSelect
                value={slot.materialVarianteId ?? ""}
                onValueChange={(v) =>
                  updateSlot(pasoId, slotIdx, {
                    materialVarianteId: v || null,
                  })
                }
                options={item.variantes.map((variante) =>
                  varianteOptionFromBusqueda(item, variante),
                )}
                placeholder="Elegir variante fija"
                triggerClassName="min-h-8 text-xs"
              />
            </div>
          ) : (
            <div className="text-muted-foreground text-xs">
              Variante: {hardcodedVarianteLabel}
            </div>
          )
        }
      />
    </div>
  );
}

// ─── Candidatos del slot: LA UI del detallado, extraída ────────────────
// (materiales.candidatos en el esquema).

function CandidatosSlotDetalladoEditor({
  pasoId,
  slotIdx,
  slot,
  slotDecl,
  candidateMaterials,
  addSlotCandidate,
  removeSlotCandidate,
  updateSlotCandidate,
}: {
  pasoId: string;
  slotIdx: number;
  slot: UpsertSlotMaterialPayload;
  slotDecl: { compatibilidadMaterial?: SlotCompatibilidad } | null | undefined;
  candidateMaterials: Record<string, MateriaPrimaBusquedaItem>;
  addSlotCandidate: (
    pasoId: string,
    slotIdx: number,
    materiaPrima: MateriaPrimaBusquedaItem,
  ) => void;
  removeSlotCandidate: (
    pasoId: string,
    slotIdx: number,
    materiaPrimaId: string,
  ) => void;
  updateSlotCandidate: (
    pasoId: string,
    slotIdx: number,
    materiaPrimaId: string,
    patch: Partial<
      NonNullable<UpsertSlotMaterialPayload["candidatos"]>[number]
    >,
  ) => void;
}) {
  const selectedCandidates = slot.candidatos ?? [];

  // El detalle inline de un material seleccionado: switch de "todas las
  // variantes", el selector de variantes (chips o color×espesor) y la
  // predeterminada. Es el `.det` del diseño, debajo de la fila de la lista.
  const renderDetalle = (materiaPrima: MateriaPrimaBusquedaItem) => {
    const candidate = selectedCandidates.find(
      (c) => c.materiaPrimaId === materiaPrima.id,
    );
    if (!candidate) return null;
    const variantOptions =
      materiaPrima.variantes.map((variante) =>
        varianteOptionFromBusqueda(materiaPrima, variante),
      ) ?? [];
    const enabledVariantIds = new Set(candidate.varianteIds);
    const sinHabilitadas =
      !candidate.todasLasVariantes && candidate.varianteIds.length === 0;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Switch
            id={`usar-todas-${candidate.materiaPrimaId}`}
            checked={candidate.todasLasVariantes ?? false}
            onCheckedChange={(valor) =>
              updateSlotCandidate(pasoId, slotIdx, candidate.materiaPrimaId, {
                todasLasVariantes: valor,
              })
            }
            style={{ flexShrink: 0 }}
          />
          <LabelConTooltip
            htmlFor={`usar-todas-${candidate.materiaPrimaId}`}
            label="Usar todas las variantes activas al cotizar en la orden."
            tooltip={`Las variantes nuevas de ${materiaPrima.nombre} se suman solas — no hace falta re-editar el paso.`}
          />
        </div>

        {!candidate.todasLasVariantes && materiaPrima.variantes.length > 1 ? (
          canUseColorThicknessSelector(materiaPrima) ? (
            <ColorThicknessVariantSelector
              materiaPrima={materiaPrima}
              candidate={candidate}
              onChange={(patch) =>
                updateSlotCandidate(
                  pasoId,
                  slotIdx,
                  candidate.materiaPrimaId,
                  patch,
                )
              }
            />
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {materiaPrima.variantes.map((variante) => {
                const activo = enabledVariantIds.has(variante.id);
                const option = varianteOptionFromBusqueda(
                  materiaPrima,
                  variante,
                );
                return (
                  <button
                    key={variante.id}
                    type="button"
                    onClick={() => {
                      const next = activo
                        ? candidate.varianteIds.filter(
                            (id) => id !== variante.id,
                          )
                        : [...candidate.varianteIds, variante.id];
                      const safe =
                        next.length > 0
                          ? Array.from(new Set(next))
                          : [variante.id];
                      const defOk =
                        candidate.defaultVarianteId &&
                        safe.includes(candidate.defaultVarianteId);
                      updateSlotCandidate(
                        pasoId,
                        slotIdx,
                        candidate.materiaPrimaId,
                        {
                          varianteIds: safe,
                          defaultVarianteId: defOk
                            ? candidate.defaultVarianteId
                            : (safe[0] ?? null),
                        },
                      );
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      height: 27,
                      padding: "0 10px",
                      borderRadius: 6,
                      fontFamily: "var(--font-mono, ui-monospace)",
                      fontSize: 11.5,
                      cursor: "pointer",
                      background: activo
                        ? "var(--fg, #14141a)"
                        : "var(--surface, #fff)",
                      color: activo ? "#fff" : "var(--fg-2, #2c2c33)",
                      border: `1px solid ${activo ? "var(--fg, #14141a)" : "var(--hairline, #e5e2db)"}`,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: activo
                          ? "#7fd3a8"
                          : "var(--hairline-strong, #c8c4ba)",
                      }}
                    />
                    {option.label}
                  </button>
                );
              })}
            </div>
          )
        ) : null}

        {sinHabilitadas ? (
          <div
            style={{
              fontSize: 11.5,
              color: "#9a6a11",
              background: "#fdf7e6",
              border: "1px solid #e8d7a6",
              borderRadius: 7,
              padding: "7px 10px",
            }}
          >
            Sin variantes habilitadas, este material no se puede usar. Activá
            al menos una.
          </div>
        ) : null}

        {variantOptions.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                color: "var(--muted-text-2, #92929b)",
              }}
            >
              Variante predeterminada
            </span>
            <HumanSelect
              value={candidate.defaultVarianteId ?? ""}
              onValueChange={(v) =>
                updateSlotCandidate(pasoId, slotIdx, candidate.materiaPrimaId, {
                  defaultVarianteId: v || null,
                })
              }
              options={variantOptions.filter(
                (option) =>
                  candidate.todasLasVariantes ||
                  candidate.varianteIds.includes(option.value),
              )}
              placeholder="Elegir variante predeterminada"
              contentClassName="min-w-[520px]"
            />
          </div>
        ) : null}
      </div>
    );
  };

  const pinned = selectedCandidates
    .map((c) => candidateMaterials[c.materiaPrimaId])
    .filter((m): m is MateriaPrimaBusquedaItem => Boolean(m));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>
            Materia prima de este material
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--muted-text, #6e6e76)",
              marginTop: 2,
              maxWidth: "72ch",
            }}
          >
            {slot.modoSeleccion === "MOTOR_ELIGE_AUTO"
              ? "Entre estos elige el sistema con el criterio de abajo. Necesita al menos dos para poder comparar."
              : "Entre estos elige el comercial al cotizar. Si dejás uno solo, no hay nada que elegir."}
          </div>
        </div>
        <span
          className={
            selectedCandidates.length > 0
              ? "ps-count-ok"
              : "text-muted-foreground text-[11px]"
          }
          style={{ whiteSpace: "nowrap", flexShrink: 0 }}
        >
          {selectedCandidates.length} seleccionada
          {selectedCandidates.length === 1 ? "" : "s"}
        </span>
      </div>
      <MaterialSearchSelect
        compatibilidad={slotDecl?.compatibilidadMaterial}
        placeholder="Buscar materia prima compatible..."
        selectedIds={selectedCandidates.map((c) => c.materiaPrimaId)}
        onSelect={(materiaPrima) =>
          addSlotCandidate(pasoId, slotIdx, materiaPrima)
        }
        onDeselect={(id) => removeSlotCandidate(pasoId, slotIdx, id)}
        pinnedItems={pinned}
        renderDetail={renderDetalle}
      />
      {selectedCandidates.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Agregá al menos una materia prima candidata para este slot.
        </p>
      ) : null}
    </div>
  );
}

// ─── Consumo como frase: las 3 formas ─────────────────────────────────
// "Cómo se calcula el consumo" se declara eligiendo UNA de tres formas y se
// lee como una regla (igual que Tiempo). Reemplaza los dos selectores
// circulares "Con qué fórmula" + "¿Por cada cuántos?" que se mandaban uno al
// otro. Ver docs/consumo-frase-natural-diseno.md. [[project_tiempo_frase_natural]]

// La fórmula, dicha como magnitud natural (lo que el paso mide), no como
// nombre técnico. "Por unidad producida" → "lo que produce el paso".
const FORMULA_MIDE_FRASE: Record<string, string> = {
  por_unidad_productiva: "lo que produce el paso",
  por_m2: "los m² que ocupan las piezas",
  por_metro_lineal: "los metros lineales que consume",
  por_pieza: "una unidad por cada pieza pedida",
  fijo: "una sola unidad, fija por trabajo",
};

// Opción A: nombrar la magnitud concreta que produce el paso, en vez del
// genérico "lo que produce el paso". Sale de lo que el paso ya declara (mismo
// dato que Tiempo). Para un paso que acomoda un sustrato la magnitud es el
// pliego/placa; con derivador/herencia, su unidad principal. null → genérico.
function magnitudProducePaso(
  cfg: UpsertConfigPasoPayload,
  familia: Parameters<typeof unidadCantidadDe>[1],
): string | null {
  const declarada = unidadCantidadDe(cfg, familia);
  if (declarada) return declarada;
  // Sólo el pliego de impresión por hoja se nombra con confianza. Placa
  // rígida, rollo (vinilo, lona) y demás varían demasiado para adivinar el
  // sustantivo — y "los placas" en un rollo era doblemente falso. Genérico.
  if (familia?.codigo === "impresion_por_hoja") return "pliegos";
  return null;
}

// La frase de "por_unidad_productiva" con la magnitud concreta si se conoce.
// Forma NEUTRA a propósito: la magnitud va entre paréntesis, como aposición,
// no detrás de un artículo. `los ${magnitud}` fallaba para casi todo sustantivo
// ("los pintura", "los placa", "los m²"…) porque el género y el número los pone
// el sustantivo, no el template. El paréntesis sirve para cualquier magnitud.
function fraseUnidadProductiva(magnitud: string | null): string {
  return magnitud
    ? `lo que produce el paso (${magnitud})`
    : FORMULA_MIDE_FRASE.por_unidad_productiva;
}

const FORMA_TINTS = {
  mide: { bg: "#e6f1fb", fg: "#185fa5" },
  regla: { bg: "#eeedfe", fg: "#534ab7" },
  derivado: { bg: "#faeeda", fg: "#854f0b" },
} as const;

function FormaConsumoSeccion({
  icono,
  tint,
  titulo,
  subtitulo,
  children,
}: {
  icono: React.ReactNode;
  tint: { bg: string; fg: string };
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 26,
            height: 26,
            borderRadius: 7,
            background: tint.bg,
            color: tint.fg,
            flexShrink: 0,
          }}
        >
          {icono}
        </span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{titulo}</span>
        <span style={{ fontSize: 12, color: "var(--muted-text-2, #92929b)" }}>
          {subtitulo}
        </span>
      </div>
      <div style={{ paddingLeft: 35 }}>{children}</div>
    </div>
  );
}

// Un enlace de texto para cambiar de forma (sin peso de botón).
function EnlaceForma({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        marginTop: 10,
        border: 0,
        background: "none",
        padding: 0,
        fontSize: 12,
        color: "var(--muted-text, #6e6e76)",
        textDecoration: "underline",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

const fraseConectorStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--muted-text, #6e6e76)",
};

/**
 * "Cómo se calcula el consumo" — las 3 formas. Reemplaza a la vez el select de
 * fórmula (materiales.consumo) y la base×factor (materiales.base):
 *  1. Lo mide el paso — sustrato y lo que sigue la geometría (fórmula).
 *  2. Regla propia — N por base (broches por pila, ojales por pieza).
 *  3. Lo deriva la geometría — sembrado LED, perfil en barras, cableado; se
 *     lee la regla real (no perillas muertas), con opción de pisarla.
 */
function ConsumoReglaGuiado({
  slot,
  decl,
  familia,
  paramsPaso,
  esAdicional,
  materialLabel,
  magnitudProduceLabel,
  fuenteLabel,
  onSlotPatch,
}: {
  slot: UpsertSlotMaterialPayload;
  decl:
    | {
        codigo: string;
        nombre?: string;
        tipo?: string;
        magnitudDerivada?: string;
        cantidadFija?: number;
        formulaForzada?: string;
      }
    | null
    | undefined;
  familia: { multiplicadoresSoportados?: string[] } | null | undefined;
  paramsPaso: Record<string, unknown>;
  esAdicional: boolean;
  /** Sustantivo del material para la frase ("broche", "módulo"); null si no. */
  materialLabel: string | null;
  /** Magnitud concreta que produce el paso ("pliegos", "m²"); null → genérico. */
  magnitudProduceLabel: string | null;
  /** Fuente heredada de "Sobre qué mide" para el "de …" inline; null si no. */
  fuenteLabel: string | null;
  onSlotPatch: (patch: Partial<UpsertSlotMaterialPayload>) => void;
}) {
  // modulos_led no declara magnitudDerivada pero su cantidad la fija el
  // derivador (sembrado). Lo tratamos como derivado para no mostrar perillas
  // que el motor ignora — la confusión de raíz del caso LED.
  const derivado = Boolean(
    decl &&
      (decl.magnitudDerivada ||
        decl.cantidadFija !== undefined ||
        decl.codigo === "modulos_led"),
  );
  const forzada = Boolean(decl?.formulaForzada) && !derivado;
  const reglaPropia = Boolean(slot.cantidadBase);
  const permiteReglaPropia =
    esAdicional || decl?.tipo === "INSUMO_PASO" || derivado;

  const dePart = fuenteLabel ? (
    <>
      {" "}
      <span style={fraseConectorStyle}>de</span>{" "}
      <span
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--fg-2, #2c2c33)",
        }}
      >
        {fuenteLabel}
      </span>
    </>
  ) : null;

  // ── Forma 3: lo deriva la geometría ─────────────────────────────────
  if (derivado && !reglaPropia) {
    let detalle: React.ReactNode;
    if (decl?.cantidadFija !== undefined) {
      detalle = (
        <>
          <b>{decl.cantidadFija} por cartel</b> — con varios carteles idénticos
          se multiplica; cada uno se elige por los watts de SU cartel.
        </>
      );
    } else if (decl?.codigo === "perfil_estructural") {
      const params = paramsPaso ?? {};
      const tipoBastidor =
        String(params.tipoBastidor ?? "doble").toLowerCase() === "simple"
          ? "frontlight"
          : "backlight";
      const profundidadM = (Number(params.profundidadMm) || 100) / 1000;
      const m = derivarMetricas({
        tipoCartel: tipoBastidor,
        width: 1,
        height: 0.8,
        depth: profundidadM,
        sepRefuerzoVcm: Number(params.sepRefuerzoVcm ?? 100) || 0,
        sepRefuerzoHcm: Number(params.sepRefuerzoHcm ?? 0) || 0,
        cenefa: false,
        solapaCenefaCm: Number(params.solapaCenefaCm ?? 2) || 0,
        pintura: false,
        fondo: false,
        perfilLadoM: 0.04,
        densidadLed: 1,
        coberturaLedM2: 0.0625,
      });
      detalle = (
        <>
          los <b>metros de perfil del bastidor</b>, comprados en{" "}
          <b>barras enteras</b> cuando la variante declara su largo. Ej.: 1,00 ×
          0,80 m → <b>{m.mlTotal.toFixed(1).replace(".", ",")} ml</b>.
        </>
      );
    } else if (decl?.codigo === "modulos_led") {
      detalle = (
        <>
          <b>los módulos</b> que siembra el paso: uno cada <i>paso</i> de la
          variante, en grilla sobre la medida del cartel, × la densidad.
        </>
      );
    } else if (decl?.codigo === "cableado") {
      detalle = (
        <>
          <b>los metros de cable</b>: perímetro × 1,4 + 12 cm por módulo.
        </>
      );
    } else {
      detalle = (
        <>
          <b>{decl?.magnitudDerivada}</b>, la magnitud que publica la geometría
          del paso.
        </>
      );
    }
    return (
      <FormaConsumoSeccion
        icono={<Share2Icon size={15} />}
        tint={FORMA_TINTS.derivado}
        titulo="Lo deriva la geometría"
        subtitulo="la regla la fija el paso"
      >
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          <span style={fraseConectorStyle}>Gasta </span>
          {detalle}
        </div>
        {permiteReglaPropia ? (
          <EnlaceForma
            onClick={() => onSlotPatch({ cantidadBase: "cantidad_pedida" })}
          >
            <SlidersHorizontalIcon size={13} /> …o pisala con una regla propia
          </EnlaceForma>
        ) : null}
      </FormaConsumoSeccion>
    );
  }

  // ── Forma 2: regla propia (N por base) ──────────────────────────────
  if (reglaPropia) {
    return (
      <FormaConsumoSeccion
        icono={<SlidersHorizontalIcon size={15} />}
        tint={FORMA_TINTS.regla}
        titulo="Regla propia"
        subtitulo="N por base"
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 7,
            lineHeight: 2,
          }}
        >
          <span style={fraseConectorStyle}>Gasta</span>
          <Input
            type="number"
            min={0}
            step={0.0001}
            value={slot.cantidadFactor ?? 1}
            onChange={(event) =>
              onSlotPatch({
                cantidadFactor:
                  event.target.value === "" ? null : Number(event.target.value),
              })
            }
            style={{ maxWidth: 84 }}
          />
          {materialLabel ? (
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              {materialLabel}
            </span>
          ) : null}
          <span style={fraseConectorStyle}>por cada</span>
          <div style={{ minWidth: 220 }}>
            <HumanSelect
              value={slot.cantidadBase ?? "cantidad_pedida"}
              onValueChange={(v) =>
                onSlotPatch({ cantidadBase: v || "cantidad_pedida" })
              }
              options={CANTIDAD_BASE_SLOT_OPTIONS}
              placeholder="Base"
            />
          </div>
        </div>
        <EnlaceForma
          onClick={() =>
            onSlotPatch({ cantidadBase: null, cantidadFactor: null })
          }
        >
          <ArrowLeftIcon size={13} />{" "}
          {derivado ? "Volver a lo que deriva la geometría" : "Volver a lo que mide el paso"}
        </EnlaceForma>
      </FormaConsumoSeccion>
    );
  }

  // ── Forma 1: lo mide el paso (fórmula) ──────────────────────────────
  return (
    <FormaConsumoSeccion
      icono={<RulerIcon size={15} />}
      tint={FORMA_TINTS.mide}
      titulo="Lo mide el paso"
      subtitulo="sustrato y lo que sigue la geometría"
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 7,
          lineHeight: 2,
        }}
      >
        <span style={fraseConectorStyle}>Gasta</span>
        {forzada ? (
          <>
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              {decl?.formulaForzada === "por_unidad_productiva"
                ? fraseUnidadProductiva(magnitudProduceLabel)
                : (FORMULA_MIDE_FRASE[decl?.formulaForzada ?? ""] ??
                  decl?.formulaForzada)}
            </span>
            <span style={fraseConectorStyle}>— lo fija el paso</span>
          </>
        ) : (
          <div style={{ minWidth: 240 }}>
            <HumanSelect
              value={slot.formula ?? "por_unidad_productiva"}
              onValueChange={(v) =>
                onSlotPatch({ formula: v || "por_unidad_productiva" })
              }
              options={FORMULA_OPTIONS.map((o) => ({
                value: o.value,
                label:
                  o.value === "por_unidad_productiva"
                    ? fraseUnidadProductiva(magnitudProduceLabel)
                    : (FORMULA_MIDE_FRASE[o.value] ?? o.label),
              }))}
              placeholder="Qué mide"
            />
          </div>
        )}
        {dePart}
      </div>
      {permiteReglaPropia ? (
        <EnlaceForma
          onClick={() => onSlotPatch({ cantidadBase: "cantidad_pedida" })}
        >
          <SlidersHorizontalIcon size={13} /> …o usá una regla propia (N por base)
        </EnlaceForma>
      ) : null}
    </FormaConsumoSeccion>
  );
}

/** Handlers y caches del editor que necesitan los componentes de
 *  materiales extraídos cuando se renderizan dentro del asistente. */
interface MaterialesApiAsistente {
  updateSlot: (
    pasoId: string,
    slotIdx: number,
    patch: Partial<UpsertSlotMaterialPayload>,
  ) => void;
  removeSlot: (pasoId: string, slotIdx: number) => void;
  addSlotAdicional: (pasoId: string) => void;
  addSlotCandidate: (
    pasoId: string,
    slotIdx: number,
    materiaPrima: MateriaPrimaBusquedaItem,
  ) => void;
  removeSlotCandidate: (
    pasoId: string,
    slotIdx: number,
    materiaPrimaId: string,
  ) => void;
  updateSlotCandidate: (
    pasoId: string,
    slotIdx: number,
    materiaPrimaId: string,
    patch: Partial<
      NonNullable<UpsertSlotMaterialPayload["candidatos"]>[number]
    >,
  ) => void;
  candidateMaterials: Record<string, MateriaPrimaBusquedaItem>;
  setCandidateMaterials: React.Dispatch<
    React.SetStateAction<Record<string, MateriaPrimaBusquedaItem>>
  >;
  hardcodedMaterialSelections: Record<string, string>;
  setHardcodedMaterialSelections: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  getPersistedSlot: (
    pasoId: string,
    slotCodigo: string,
  ) => SlotMaterialDetalle | null;
}


/** Ritmo T-2 del asistente guiado (tiempo.productividad / tiempo.batch):
 *  mismos params que el detallado, con estado local para tipeo a medias. */
function RitmoGuiado({
  variante,
  pasoId,
  cfg,
  familia,
  onParams,
  pasos,
  familiasMap,
  jsonTexts,
  onPatch,
  onHerencia,
}: {
  variante: "productividad" | "batch" | "fijo";
  pasoId: string;
  cfg: UpsertConfigPasoPayload;
  familia: FamiliaListItem | undefined;
  onParams: (pasoId: string, patch: Record<string, unknown>) => void;
  // Para inlinear el control de cantidad ("6 puntos de soldadura por hora").
  pasos: PasoAsistente[];
  familiasMap: Map<string, FamiliaListItem>;
  jsonTexts: Record<string, { params: string; mecanismo: string }>;
  onPatch: (pasoId: string, patch: Partial<UpsertConfigPasoPayload>) => void;
  onHerencia: (pasoId: string, sel: SeleccionHerencia | null) => void;
}) {
  const params = asRecord(cfg.paramsPasoJson);
  // Normalizada: hay pasos guardados con el alias "piezas_h" y el selector
  // mostraba "Valor no disponible" (H7 del relevamiento del editor).
  const unidad =
    typeof params.productivityUnit === "string"
      ? normalizeT2ProductivityUnit(params.productivityUnit)
      : getDefaultT2ProductivityUnit(familia);
  const fuente =
    typeof params.productivityQuantitySource === "string"
      ? params.productivityQuantitySource
      : getDefaultT2QuantitySource(familia, unidad);
  // T3b: el control ABIERTO dice lo mismo que el resumen — si el sistema
  // sabe qué cuenta el paso (ml de perfil, puntos soldadura, cortes), lo
  // nombra en el sufijo del input y en el selector de unidad. La fuente
  // derivada elegida ("cortes de hierro") le gana a la magnitud principal.
  const unidadCantidad =
    etiquetaFuenteDerivada(familia, fuente) ?? unidadCantidadDe(cfg, familia);
  // ── Fuente INLINE de la frase ("… de [Tiras de cenefa] …"), reemplaza al
  // bloque "Qué monta". Sólo en pasos que montan sobre un material. Hereda por
  // default la fuente del material (Materiales → ¿Sobre qué mide? = fuenteMedida
  // del slot SUSTRATO), con override. Ver project_tiempo_frase_natural.
  const pasoMontaFuente = (familia?.fuentesPiezasNesting?.length ?? 0) > 0;
  const ordenActualTiempo = pasos.find((p) => p.id === pasoId)?.orden ?? null;
  const fuenteHeredadaTiempo =
    (cfg.slotsMateriales ?? []).find(
      (s) =>
        s.slotRol === "SUSTRATO" &&
        typeof s.fuenteMedida === "string" &&
        s.fuenteMedida,
    )?.fuenteMedida ?? null;
  const opcionesFuenteTiempo = [
    ...MONTAJE_SOURCE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    ...pasos
      .filter(
        (p) =>
          p.orden != null &&
          ordenActualTiempo != null &&
          p.orden < ordenActualTiempo,
      )
      .flatMap((p) =>
        (familiasMap.get(p.familiaCodigo)?.outputsGeometricos ?? []).map(
          (o) => ({
            value: `output:${o.key}`,
            label: `${o.etiqueta} · ${p.nombre}`,
          }),
        ),
      ),
  ];
  const valorFuenteTiempo = String(
    params.fuentePiezasMontaje ?? fuenteHeredadaTiempo ?? "piezas_jobcontext",
  );
  const fuenteTiempoEsHeredada =
    typeof params.fuentePiezasMontaje !== "string" ||
    params.fuentePiezasMontaje === fuenteHeredadaTiempo;
  // Paso 2 (filtro chico): con una fuente de MONTAJE elegida (no "las del
  // trabajo"), las magnitudes `derivada:*` son de la ESTRUCTURA del paso, no de
  // lo que se monta → no aplican y se esconden del selector de magnitud.
  const ocultarDerivadasPorMontaje =
    pasoMontaFuente && valorFuenteTiempo !== "piezas_jobcontext";
  // ── La regla ÚNICA del tiempo variable (feedback del usuario): la misma
  // oración "[N] [magnitud] cada [T] [min|h]" expresa productividad
  // ("120 pliegos cada 1 hora") y tanda ("3 piezas cada 1 min"). La única
  // diferencia semántica —la tanda REDONDEA hacia arriba— es el interruptor
  // "tandas enteras". Storage: ON → batchSize/batchTimeMin (batch_time);
  // OFF → productivityValue = N×60÷Tmin (lineal, se re-expresa por hora).
  const esTandaEntera =
    (typeof params.timeCalculationMode === "string"
      ? params.timeCalculationMode
      : getDefaultT2TimeCalculationMode(familia)) === "batch_time";
  const [reglaN, setReglaN] = React.useState(() => {
    if (esTandaEntera) {
      return params.batchSize != null ? String(params.batchSize) : "";
    }
    return params.productivityValue != null
      ? String(params.productivityValue)
      : "";
  });
  const [reglaUnidadT, setReglaUnidadT] = React.useState<"min" | "h">(() => {
    if (!esTandaEntera) return "h";
    const t = Number(params.batchTimeMin);
    return Number.isFinite(t) && t >= 60 && t % 30 === 0 ? "h" : "min";
  });
  const [reglaT, setReglaT] = React.useState(() => {
    if (!esTandaEntera) return params.productivityValue != null ? "1" : "";
    const t = Number(params.batchTimeMin);
    if (!Number.isFinite(t) || params.batchTimeMin == null) return "";
    return t >= 60 && t % 30 === 0 ? String(t / 60) : String(t);
  });
  /** Persiste la regla. SIEMPRE proporcional exacto (decisión del usuario:
   *  nada de bloques/tandas) → storage `productivity` con el ritmo por hora
   *  equivalente. Las configs viejas en `batch_time` se leen tal cual y se
   *  normalizan a proporcional al primer edit. */
  // El "tiempo variable" (regla n/hora) ES T-2. La UI hacía `cfg.modoTiempo ??
  // modosTiempoSoportados[0]` sólo para MOSTRAR, pero nunca lo persistía; el
  // motor hace `paso.modoTiempo ?? 'T-1'` (fallback distinto) e IGNORABA la
  // regla — el ritmo quedaba muerto (el corte del bastidor cobraba 0). Al
  // escribir la regla persistimos el modo para que UI y motor coincidan.
  const modoTiempoVariable = (
    familia?.modosTiempoSoportados?.includes("T-2")
      ? "T-2"
      : (familia?.modosTiempoSoportados?.[0] ?? "T-2")
  ) as UpsertConfigPasoPayload["modoTiempo"];
  const escribirRegla = (
    nTexto: string,
    tTexto: string,
    unidadT: "min" | "h",
  ) => {
    const n = numOrNull(nTexto);
    const t = numOrNull(tTexto);
    const tMin = t == null ? null : unidadT === "h" ? t * 60 : t;
    onPatch(pasoId, { modoTiempo: modoTiempoVariable });
    onParams(pasoId, {
      timeCalculationMode: "productivity",
      productivityValue:
        n == null || tMin == null || tMin <= 0
          ? null
          : Math.round(((n * 60) / tMin) * 10000) / 10000,
      batchSize: null,
      batchTimeMin: null,
    });
  };
  const [horasTexto, setHorasTexto] = React.useState(
    params.horasEstimadas != null ? String(params.horasEstimadas) : "",
  );
  const numOrNull = (texto: string) => {
    const n = Number(texto);
    return texto.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
  };
  const filaStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  };
  const notaStyle: React.CSSProperties = {
    fontSize: 12.5,
    color: "var(--muted-text, #6e6e76)",
  };
  // Para el desplegable de magnitudes usamos el nombre NEUTRO de lo que cuenta
  // el paso (ml de perfil, la magnitud principal), NO la fuente derivada ya
  // elegida: si pasáramos `unidadCantidad` (que prioriza la derivada elegida,
  // p. ej. "cortes de hierro"), la opción genérica "cantidad" quedaría
  // etiquetada igual que la opción `derivada:cortes` y aparecería duplicada.
  const unidadCantidadNeutra = unidadCantidadDe(cfg, familia);
  const magnitudes = getRitmoMagnitudOptions(
    familia,
    params,
    unidadCantidadNeutra,
  );
  // ── Selector UNIFICADO de magnitud (feedback del usuario: "El ritmo
  // cuenta" y "El ritmo se multiplica por" mostrados juntos eran confusos
  // y en parte duplicados). UNA lista para la oración del ritmo:
  //  · elegir "la cantidad pedida / pliegos impresos / la calcula el paso"
  //    resuelve el mecanismo de cantidad Y pone el reloj a contar cantidad;
  //  · elegir "m² / metros de perímetro / borde" pone el reloj a contar esa
  //    magnitud (el mecanismo queda aparte, para materiales y herencias).
  // Vale para productividad Y tanda — la tanda tenía la magnitud suelta.
  const puedeElegirMecanismo =
    requiereMecanismoCantidad(cfg, familia) &&
    (familia?.mecanismosCantidadSoportados?.length ?? 4) > 1;
  const cantidadSel = opcionesCantidadUnificada(
    pasoId,
    pasos,
    familia,
    familiasMap,
    jsonTexts,
    cfg,
  );
  const opcionesMagnitud: {
    value: string;
    label: string;
    description?: string;
  }[] = [];
  if (puedeElegirMecanismo) {
    opcionesMagnitud.push(...cantidadSel.options);
  } else {
    const cantidadOp = magnitudes.find((m) => m.fuente === "cantidad");
    if (cantidadOp) {
      opcionesMagnitud.push({
        value: `q:${cantidadOp.value}`,
        label: cantidadOp.label,
      });
    }
  }
  for (const m of magnitudes) {
    if (m.fuente === "cantidad") continue;
    // No escondemos la magnitud ya elegida (rompería el selector); sí las demás
    // derivadas cuando hay fuente de montaje.
    if (
      ocultarDerivadasPorMontaje &&
      m.fuente.startsWith("derivada:") &&
      m.fuente !== fuente
    )
      continue;
    opcionesMagnitud.push({ value: `q:${m.value}`, label: m.label });
  }
  const valorMagnitud =
    fuente !== "cantidad"
      ? `q:${unidad}|${fuente}`
      : puedeElegirMecanismo
        ? cantidadSel.valor
        : `q:${magnitudes.find((m) => m.fuente === "cantidad")?.value ?? `${unidad}|cantidad`}`;
  const elegirMagnitud = (v: string) => {
    if (v.startsWith("q:")) {
      const elegida = magnitudes.find((m) => `q:${m.value}` === v);
      if (!elegida) return;
      onParams(pasoId, {
        productivityUnit: elegida.unidad,
        productivityQuantitySource: elegida.fuente,
      });
      return;
    }
    // Opción de cantidad (mecanismo/herencia): además de resolver el
    // mecanismo, el reloj pasa a contar la cantidad del paso.
    aplicarCantidadUnificada(v, pasoId, onPatch, onHerencia);
    onParams(pasoId, {
      productivityUnit: "unidades_h",
      productivityQuantitySource: "cantidad",
    });
  };
  const selectorMagnitud = (
    <div style={{ minWidth: 200 }}>
      <HumanSelect
        value={valorMagnitud}
        onValueChange={(v) => v && elegirMagnitud(v)}
        options={opcionesMagnitud}
        placeholder="Elegir magnitud"
      />
    </div>
  );
  const selectorFuenteTiempo = pasoMontaFuente ? (
    <>
      <span style={notaStyle}>de</span>
      <div style={{ minWidth: 170 }}>
        <HumanSelect
          value={valorFuenteTiempo}
          onValueChange={(v) =>
            v && onParams(pasoId, { fuentePiezasMontaje: v })
          }
          options={opcionesFuenteTiempo}
          placeholder="Elegir fuente"
        />
      </div>
    </>
  ) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {variante === "fijo" ? (
        // Tiempo fijo: el paso tarda lo mismo sin importar la cantidad. Se
        // guarda en `horasEstimadas`, que el motor prefiere sobre el ritmo.
        <div style={filaStyle}>
          <Input
            value={horasTexto}
            onChange={(e) => {
              setHorasTexto(e.target.value);
              const n = Number(e.target.value);
              onParams(pasoId, {
                horasEstimadas:
                  e.target.value.trim() !== "" && Number.isFinite(n) && n >= 0
                    ? n
                    : null,
              });
            }}
            placeholder="Ej: 1,5"
            inputMode="decimal"
            style={{ maxWidth: 110 }}
          />
          <span style={notaStyle}>h por orden, sin importar la cantidad</span>
        </div>
      ) : (
        // LA regla del tiempo variable, como oración horizontal (estilo
        // regla condicional): "[120] [pliegos ▾] cada [1] [hora ▾]" o
        // "[3] [piezas ▾] cada [1] [min ▾]". "Productividad por hora" y
        // "Tiempo por lote" eran la MISMA oración con distinto redondeo:
        // el interruptor de abajo es la única diferencia real.
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={filaStyle}>
            <Input
              value={reglaN}
              onChange={(e) => {
                setReglaN(e.target.value);
                escribirRegla(e.target.value, reglaT, reglaUnidadT);
              }}
              placeholder={
                familia?.defaults?.productividadHora
                  ? `${familia.defaults.productividadHora}`
                  : "Ej: 60"
              }
              inputMode="decimal"
              style={{ maxWidth: 92, textAlign: "right" }}
            />
            {selectorMagnitud}
            {selectorFuenteTiempo}
            <span style={notaStyle}>cada</span>
            <Input
              value={reglaT}
              onChange={(e) => {
                setReglaT(e.target.value);
                escribirRegla(reglaN, e.target.value, reglaUnidadT);
              }}
              placeholder="1"
              inputMode="decimal"
              style={{ maxWidth: 72, textAlign: "right" }}
            />
            <div style={{ width: 110, flexShrink: 0 }}>
              <HumanSelect
                value={reglaUnidadT}
                onValueChange={(v) => {
                  const nueva = v === "h" ? "h" : "min";
                  if (nueva === reglaUnidadT) return;
                  setReglaUnidadT(nueva);
                  // El tiempo no cambia: se re-expresa en la unidad nueva.
                  const t = Number(reglaT);
                  if (reglaT.trim() !== "" && Number.isFinite(t)) {
                    const convertido = nueva === "h" ? t / 60 : t * 60;
                    setReglaT(String(convertido));
                    escribirRegla(reglaN, String(convertido), nueva);
                  }
                }}
                options={[
                  { value: "min", label: "min" },
                  { value: "h", label: "horas" },
                ]}
                placeholder="unidad"
              />
            </div>
          </div>
          {pasoMontaFuente ? (
            <div
              style={{
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: fuenteTiempoEsHeredada
                  ? "var(--muted-text, #6e6e76)"
                  : "#8a6d3b",
              }}
            >
              {fuenteTiempoEsHeredada
                ? "Mide sobre la misma fuente que el material (heredado de ¿Sobre qué mide?)."
                : "El tiempo mide sobre otra fuente que el consumo del material."}
            </div>
          ) : null}
          {/* Sin nota de ejemplo: la regla escala proporcional exacto y se
              sobreentiende (feedback del usuario). */}
        </div>
      )}
      {/* Antes había un "Equivale a X · el sistema lo guarda como Y": la
          primera mitad repetía el control de ritmo de arriba y la segunda
          exponía la unidad interna. La UI es para el usuario, no cuenta cómo
          trabaja el sistema por dentro. */}
    </div>
  );
}

/**
 * "Hojas 1 a 4" → "páginas 1-8, 25-32". En caballete se eligen HOJAS, y cada
 * hoja arrastra dos páginas del principio y dos del final del documento: sin
 * esta traducción, nadie entiende qué está pidiendo.
 */
function describirHojasEnPaginas(
  modo: string,
  desde: number,
  hasta: number,
  paginasRef: number,
): string | null {
  if (modo === "todas") return null;
  if (!paginasRef || paginasRef < 4) {
    return "Cargá las páginas por defecto para ver qué páginas incluye.";
  }
  const N = Math.max(4, Math.ceil(paginasRef / 4) * 4);
  const H = N / 4;
  const indices =
    modo === "tapa"
      ? [1]
      : modo === "interior"
        ? Array.from({ length: H - 1 }, (_, i) => i + 2)
        : Array.from({ length: H }, (_, i) => i + 1).filter(
            (h) => h >= desde && h <= Math.min(hasta, H),
          );
  if (indices.length === 0) return "Ninguna hoja: revisá el rango.";
  const paginas = indices
    .flatMap((i) => [N - 2 * i + 2, 2 * i - 1, 2 * i, N - 2 * i + 1])
    .sort((a, b) => a - b);
  // Colapsar correlativas en rangos legibles.
  const rangos: string[] = [];
  let ini = paginas[0];
  let prev = paginas[0];
  for (const p of paginas.slice(1)) {
    if (p === prev + 1) {
      prev = p;
      continue;
    }
    rangos.push(ini === prev ? `${ini}` : `${ini}-${prev}`);
    ini = p;
    prev = p;
  }
  rangos.push(ini === prev ? `${ini}` : `${ini}-${prev}`);
  return `Con ${paginasRef} páginas: incluye las páginas ${rangos.join(", ")}.`;
}

/**
 * Imposición de cuadernillo en el paso de impresión
 * (docs/imposicion-cuadernillos-diseno.md): activa el esquema caballete y sus
 * parámetros, incluido QUÉ HOJAS imprime este paso — lo que permite tapa e
 * interior en papeles o colores distintos. Vive en `nestingConfig.imposicion`;
 * el comercial NO lo toca (él sólo carga las páginas al cotizar).
 */
function ImposicionCuadernilloEditor({
  pasoId,
  nestingConfig,
  updateNestingConfig,
  modoTalonario,
  onModoTalonario,
}: {
  pasoId: string;
  nestingConfig: Record<string, unknown>;
  updateNestingConfig: (
    rutaPasoId: string,
    patch: Record<string, unknown>,
  ) => void;
  /** Modo de agrupado por talonario (paramsPaso.modoTalonarioIncompleto).
   *  Va acá porque es el MISMO eje que la imposición: un pliego se impone o
   *  normal, o como cuadernillo, o como talonario — nunca dos a la vez. */
  modoTalonario: string;
  onModoTalonario: (modo: string) => void;
}) {
  const imposicion = asRecord(nestingConfig.imposicion);
  const activa =
    String(imposicion.esquema ?? "").toLowerCase() === "caballete";
  const modoImposicion = activa
    ? "caballete"
    : modoTalonario === "aprovechar_pliego"
      ? "talonario_aprovechar"
      : modoTalonario === "pose_completa"
        ? "talonario_poses"
        : "ninguna";
  const aplicarImposicion = (v: string) => {
    // Cada modo escribe donde vive: caballete → nestingConfig.imposicion;
    // talonario → paramsPaso.modoTalonarioIncompleto. Son excluyentes, así que
    // al elegir uno se apaga el otro. El motor lee lo de siempre → golden igual.
    updateNestingConfig(pasoId, {
      imposicion: v === "caballete" ? { esquema: "caballete" } : null,
    });
    onModoTalonario(
      v === "talonario_aprovechar"
        ? "aprovechar_pliego"
        : v === "talonario_poses"
          ? "pose_completa"
          : "off",
    );
  };
  const patch = (cambios: Record<string, unknown>) =>
    updateNestingConfig(pasoId, {
      imposicion: { esquema: "caballete", ...imposicion, ...cambios },
    });
  // Qué hojas imprime este paso: lo que permite tapa y interior en papeles
  // (o colores) distintos. Se elige por HOJA, y el sistema traduce a páginas.
  const hojasRaw = imposicion.hojas;
  const hojasModo =
    typeof hojasRaw === "string"
      ? hojasRaw
      : String(asRecord(hojasRaw).modo || "todas");
  const rangoDesde = Number(asRecord(hojasRaw).desde) || 1;
  const rangoHasta = Number(asRecord(hojasRaw).hasta) || 1;
  const paginasRef = Number(imposicion.paginasDefault) || 0;
  const traduccion = describirHojasEnPaginas(
    hojasModo,
    rangoDesde,
    rangoHasta,
    paginasRef,
  );
  return (
    <div className="space-y-2">
      <LabelConTooltip
        label="Imposición del pliego"
        tooltip="Cómo se acomodan las piezas en el pliego. Normal (sueltas), como cuadernillo abrochado al lomo, o agrupando talonarios. Son excluyentes: el pliego se impone de una sola forma."
        iconSize="sm"
      />
      <HumanSelect
        value={modoImposicion}
        onValueChange={aplicarImposicion}
        options={[
          {
            value: "ninguna",
            label: "Sin imposición",
            description: "Acomodo normal de piezas sueltas.",
          },
          {
            value: "caballete",
            label: "Cuadernillo a caballete",
            description:
              "Hojas anidadas y abrochadas al lomo (revista, folleto multipágina).",
          },
          {
            value: "talonario_aprovechar",
            label: "Talonario · compartir pliego",
            description:
              "Los talonarios sueltos comparten pliego para gastar el mínimo de papel.",
          },
          {
            value: "talonario_poses",
            label: "Talonario · poses vacías",
            description:
              "Cada talonario en su pose completa, listo para abrochar (más papel).",
          },
        ]}
      />
      {activa ? (
        <div className="space-y-2">
          <LabelConTooltip
            label="Qué hojas imprime este paso"
            tooltip="Permite que la tapa salga en otro papel (o a color) que el interior: se agregan DOS pasos de impresión, uno con la tapa y otro con el interior. En caballete se elige por hoja, no por página: cada hoja lleva dos páginas del principio y dos del final."
            iconSize="sm"
          />
          <HumanSelect
            value={hojasModo}
            onValueChange={(v) =>
              patch({
                hojas:
                  v === "rango"
                    ? { modo: "rango", desde: rangoDesde, hasta: rangoHasta }
                    : v,
              })
            }
            options={[
              {
                value: "todas",
                label: "Todas las hojas",
                description: "Un solo paso imprime la revista entera.",
              },
              {
                value: "tapa",
                label: "Solo la tapa (hoja 1)",
                description: "La hoja exterior: tapa, contratapa y sus retiros.",
              },
              {
                value: "interior",
                label: "Interior (sin la tapa)",
                description: "Todas las hojas menos la exterior.",
              },
              {
                value: "rango",
                label: "Rango de hojas",
                description: "Ej. el pliego central a color.",
              },
            ]}
          />
          {hojasModo === "rango" ? (
            <div className="ps-grid2">
              <div className="space-y-2">
                <LabelConTooltip label="Desde la hoja" iconSize="sm" />
                <Input
                  type="number"
                  min={1}
                  value={String(rangoDesde)}
                  onChange={(e) =>
                    patch({
                      hojas: {
                        modo: "rango",
                        desde: Number(e.target.value) || 1,
                        hasta: rangoHasta,
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <LabelConTooltip label="Hasta la hoja" iconSize="sm" />
                <Input
                  type="number"
                  min={1}
                  value={String(rangoHasta)}
                  onChange={(e) =>
                    patch({
                      hojas: {
                        modo: "rango",
                        desde: rangoDesde,
                        hasta: Number(e.target.value) || 1,
                      },
                    })
                  }
                />
              </div>
            </div>
          ) : null}
          {traduccion ? (
            <p className="ps-hint text-xs text-muted-foreground">{traduccion}</p>
          ) : null}
        </div>
      ) : null}
      {activa ? (
        <div className="ps-grid2">
          <div className="space-y-2">
            <LabelConTooltip
              label="Páginas por defecto"
              tooltip="Sugerencia para el cotizador; el comercial la puede pisar. Vacío = el comercial siempre las carga."
              iconSize="sm"
            />
            <Input
              type="number"
              min={4}
              step={4}
              placeholder="ej. 16"
              value={
                imposicion.paginasDefault != null
                  ? String(imposicion.paginasDefault)
                  : ""
              }
              onChange={(e) =>
                patch({
                  paginasDefault:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </div>
          <div className="space-y-2">
            <LabelConTooltip
              label="Máx. hojas anidadas"
              tooltip="Tope físico del caballete: pasado este espesor la cotización corta y sugiere anillado o alzado. Default 25."
              iconSize="sm"
            />
            <Input
              type="number"
              min={1}
              placeholder="25"
              value={
                imposicion.maxHojas != null ? String(imposicion.maxHojas) : ""
              }
              onChange={(e) =>
                patch({
                  maxHojas:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Origen de herencia (tiempo.herencia): señalar el paso y qué capacidad
 *  usa. Vivía en la card transicional; ahora lo renderiza el esquema. */
function HerenciaOrigenGuiada({
  pasoId,
  pasos,
  familiasMap,
  jsonTexts,
  onHerencia,
}: {
  pasoId: string;
  pasos: PasoAsistente[];
  familiasMap: Map<string, FamiliaListItem>;
  jsonTexts: Record<string, { params: string; mecanismo: string }>;
  onHerencia: (pasoId: string, sel: SeleccionHerencia | null) => void;
}) {
  const texto = jsonTexts[pasoId]?.mecanismo ?? "";
  const campoActual = leerCampoOutputHerencia(texto);
  const origenActual = leerOrigenHerencia(texto);

  // Las magnitudes que dejan los pasos anteriores, con su NOMBRE real
  // ("puntos de soldadura", "m² a pintar"), no colapsadas a "unidades". Cada
  // una se hereda por su key de output (mecanismo H6: `campoOutput`), que es
  // como el motor las resuelve del jobContext.
  const previos = pasos.filter(
    (_, i) => i < pasos.findIndex((x) => x.id === pasoId),
  );
  const magnitudes: {
    key: string;
    etiqueta: string;
    pasoNombre: string;
  }[] = [];
  const vistas = new Set<string>();
  for (const p of previos) {
    const pubs = familiasMap.get(p.familiaCodigo)?.outputsPublicables ?? [];
    for (const o of pubs) {
      if (vistas.has(o.key)) continue;
      vistas.add(o.key);
      magnitudes.push({ key: o.key, etiqueta: o.etiqueta, pasoNombre: p.nombre });
    }
  }

  // Valor mostrado: la magnitud elegida (campoOutput) o, si viniera una
  // herencia por origen explícito legacy, esa capacidad; si no, automático.
  const valor =
    campoActual ??
    (typeof origenActual?.capacidad === "string"
      ? origenActual.capacidad
      : "auto");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <HumanSelect
        value={valor}
        onValueChange={(v) =>
          onHerencia(pasoId, !v || v === "auto" ? null : { campoOutput: v })
        }
        options={[
          {
            value: "auto",
            label: "Automático (del paso anterior)",
            description:
              "Toma la cantidad final que viene del paso previo, sin fijar una magnitud.",
          },
          ...magnitudes.map((m) => ({
            value: m.key,
            label: m.etiqueta.charAt(0).toUpperCase() + m.etiqueta.slice(1),
            description: `La publica ${m.pasoNombre}`,
          })),
        ]}
        placeholder="¿Qué magnitud hereda?"
      />
    </div>
  );
}

// Copy de cada método NO-heredar, pensado para el usuario (no el nombre
// interno del mecanismo). El de HEREDAR se expande por magnitud, así que no
// vive acá.
const CANTIDAD_METODO_LABEL: Record<string, string> = {
  DIRECT_FROM_JOBCONTEXT: "La cantidad pedida",
  CALCULADO_POR_PASO: "La que calcula el paso",
  CONVERSION: "Conversión por empaque",
};
const CANTIDAD_METODO_DESC: Record<string, string> = {
  DIRECT_FROM_JOBCONTEXT: "La que pide el comercial al cotizar (ej: 30 carteles).",
  CALCULADO_POR_PASO: "El paso la calcula solo (acomodo de piezas, geometría).",
  CONVERSION: "Convierte la cantidad a otra unidad (ej: piezas por caja).",
};

// ─── "Sobre qué cantidad se aplica": UN solo control (Opción A) ──────────
// Fusiona el método (mecanismoCantidad) y la magnitud heredada (campoOutput)
// en un desplegable. Antes eran dos filas — "Base de cantidad" + "Hereda de" —
// que confundían: la magnitud ya se nombra arriba en el ritmo, y elegir "de
// qué paso" por separado sobraba. Acá se elige directo QUÉ número multiplica
// al ritmo.
/** Opciones + valor actual del selector de cantidad fusionado (mecanismo +
 *  magnitudes heredables). Compartido entre la sección "Sobre qué cantidad"
 *  y la ORACIÓN del ritmo (selector unificado de magnitud). Codificación:
 *  "m:<mecanismo>" métodos directos · "h:<campoOutput>" heredar una
 *  magnitud · "h:" heredar automático. */
function opcionesCantidadUnificada(
  pasoId: string,
  pasos: PasoAsistente[],
  familia: FamiliaListItem | undefined,
  familiasMap: Map<string, FamiliaListItem>,
  jsonTexts: Record<string, { params: string; mecanismo: string }>,
  cfg: UpsertConfigPasoPayload,
): {
  valor: string;
  options: { value: string; label: string; description?: string }[];
} {
  const mecanismos = familia?.mecanismosCantidadSoportados ?? [
    "DIRECT_FROM_JOBCONTEXT",
    "HEREDAR_DEL_OUTPUT_CANONICO",
    "CALCULADO_POR_PASO",
    "CONVERSION",
  ];
  const mecanismoActual =
    cfg.mecanismoCantidad ??
    getDefaultMecanismoCantidad(familia, mecanismos) ??
    mecanismos[0];
  const campoActual = leerCampoOutputHerencia(jsonTexts[pasoId]?.mecanismo ?? "");

  // Las magnitudes que dejan los pasos anteriores, con su nombre real.
  const previos = pasos.filter(
    (_, i) => i < pasos.findIndex((x) => x.id === pasoId),
  );
  const magnitudes: {
    key: string;
    etiqueta: string;
    pasoNombre: string;
    opcional: boolean;
  }[] = [];
  const vistas = new Set<string>();
  for (const p of previos) {
    // Herencia de un paso OPCIONAL/CONDICIONAL: si ese paso no corre, el output
    // no se publica y la cantidad queda ambigua (feedback del usuario sobre
    // "Piezas laminadas" cuando el Laminado es opcional). Lo marcamos para
    // avisar en el selector.
    const opcional =
      p.modoActivacion === "OPCIONAL" || p.modoActivacion === "CONDICIONAL";
    for (const o of familiasMap.get(p.familiaCodigo)?.outputsPublicables ?? []) {
      if (vistas.has(o.key)) continue;
      vistas.add(o.key);
      magnitudes.push({
        key: o.key,
        etiqueta: o.etiqueta,
        pasoNombre: p.nombre,
        opcional,
      });
    }
  }

  const heredaSoportado = mecanismos.includes("HEREDAR_DEL_OUTPUT_CANONICO");

  const valor =
    mecanismoActual === "HEREDAR_DEL_OUTPUT_CANONICO"
      ? `h:${campoActual ?? ""}`
      : `m:${mecanismoActual}`;

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const options: {
    value: string;
    label: string;
    description?: string;
  }[] = [];
  for (const m of mecanismos) {
    if (m === "HEREDAR_DEL_OUTPUT_CANONICO") continue;
    // Cuando el paso CALCULA su cantidad y la familia declara qué unidad es
    // (derivador.unidadPrincipal: "ml de perfil"), el label la DICE en vez del
    // genérico "La que calcula el paso". Transversal: cualquier familia con
    // derivador se beneficia (pedido del usuario 2026-08-13).
    const unidadCalculada =
      m === "CALCULADO_POR_PASO"
        ? (familia?.derivador?.unidadPrincipal ?? null)
        : null;
    options.push({
      value: `m:${m}`,
      label: unidadCalculada ? cap(unidadCalculada) : (CANTIDAD_METODO_LABEL[m] ?? m),
      description: CANTIDAD_METODO_DESC[m],
    });
  }
  if (heredaSoportado) {
    for (const mg of magnitudes) {
      options.push({
        value: `h:${mg.key}`,
        label: cap(mg.etiqueta),
        description: mg.opcional
          ? `Depende de "${mg.pasoNombre}" (OPCIONAL): si ese paso no corre, esta cantidad no existe. Para algo firme usá "La cantidad pedida".`
          : `Emitida por el paso: ${mg.pasoNombre}`,
      });
    }
    options.push({
      value: "h:",
      label: "La del paso anterior",
      description: "Sin fijar una magnitud: toma la cantidad del paso previo.",
    });
  }

  return { valor, options };
}

/** Aplica una opción "m:"/"h:" del selector de cantidad fusionado. */
function aplicarCantidadUnificada(
  v: string,
  pasoId: string,
  onPatch: (pasoId: string, patch: Partial<UpsertConfigPasoPayload>) => void,
  onHerencia: (pasoId: string, sel: SeleccionHerencia | null) => void,
) {
  if (v.startsWith("h:")) {
    const key = v.slice(2);
    onPatch(pasoId, { mecanismoCantidad: "HEREDAR_DEL_OUTPUT_CANONICO" });
    onHerencia(pasoId, key ? { campoOutput: key } : null);
    return;
  }
  const mecanismo = v.slice(2);
  onPatch(pasoId, { mecanismoCantidad: mecanismo || null });
  onHerencia(pasoId, null);
}

function CantidadUnificadaGuiada({
  pasoId,
  pasos,
  familia,
  familiasMap,
  jsonTexts,
  cfg,
  onPatch,
  onHerencia,
}: {
  pasoId: string;
  pasos: PasoAsistente[];
  familia: FamiliaListItem | undefined;
  familiasMap: Map<string, FamiliaListItem>;
  jsonTexts: Record<string, { params: string; mecanismo: string }>;
  cfg: UpsertConfigPasoPayload;
  onPatch: (pasoId: string, patch: Partial<UpsertConfigPasoPayload>) => void;
  onHerencia: (pasoId: string, sel: SeleccionHerencia | null) => void;
}) {
  const { valor, options } = opcionesCantidadUnificada(
    pasoId,
    pasos,
    familia,
    familiasMap,
    jsonTexts,
    cfg,
  );
  return (
    <HumanSelect
      value={valor}
      onValueChange={(v) =>
        v && aplicarCantidadUnificada(v, pasoId, onPatch, onHerencia)
      }
      options={options}
      placeholder="Elegir"
    />
  );
}

// ─── Tiempo del comercial: LA UI del detallado, extraída como componente ─
// La usan el detallado y el asistente guiado vía el esquema
// (tiempo.comercial — PRIMERA pregunta de Tiempo y costo).

function TiempoComercialDetalladoEditor({
  pasoId,
  cfg,
  familia,
  conSwitch = false,
  parte,
  updateTiempoManualConfig,
}: {
  pasoId: string;
  cfg: UpsertConfigPasoPayload;
  familia: FamiliaListItem | undefined;
  /** El eje renderiza las dos mitades por separado; sin `parte` van juntas
   *  (detallado congelado). */
  parte?: "pregunta" | "ayudas";
  /** El detallado congelado no tiene la bifurcación del eje: necesita su
   *  propio interruptor para prender el tiempo del comercial. En el guiado
   *  esa decisión ya la tomaron las dos tarjetas de arriba. */
  conSwitch?: boolean;
  updateTiempoManualConfig: (
    pasoId: string,
    patch: Record<string, unknown>,
  ) => void;
}) {
  const tiempoManualConfig = getTiempoManualConfig(cfg.paramsPasoJson);
  const tiempoManualHabilitado = tiempoManualConfig.habilitado === true;
  const tiempoManualUnidad =
    tiempoManualConfig.unidadInput === "h" ? "h" : "min";
  const tiempoManualDefaultMin = readOptionalNumber(
    tiempoManualConfig.defaultMin,
  );

  const interruptor = conSwitch ? (
    <label className="flex items-start gap-2 rounded-md border bg-white px-3 py-2 text-xs">
      <input
        className="mt-0.5"
        type="checkbox"
        checked={tiempoManualHabilitado}
        onChange={(e) =>
          updateTiempoManualConfig(pasoId, { habilitado: e.target.checked })
        }
      />
      <span className="space-y-0.5">
        <span className="block font-medium text-foreground">
          El comercial estima el tiempo al cotizar
        </span>
        <span className="block text-muted-foreground">
          Muestra un input de tiempo en el cotizador. Sin valor ingresado, el
          paso se calcula como siempre.
        </span>
      </span>
    </label>
  ) : null;

  if (!tiempoManualHabilitado) return interruptor;

  const bloque: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    borderLeft: "2px solid var(--hairline, #eeebe4)",
    paddingLeft: 16,
    paddingTop: 4,
  };
  const tituloStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 600 };
  const hintStyle: React.CSSProperties = {
    fontSize: 11.5,
    color: "var(--muted-text, #6e6e76)",
    marginTop: 2,
    maxWidth: "64ch",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11.5,
    fontWeight: 450,
    color: "var(--fg-2, #2c2c33)",
  };
  const minutos = (valor: unknown, campo: string, ancho = 112) => (
    <div style={{ ...CAJA_EJE, width: ancho }}>
      <input
        value={readOptionalNumber(valor) ?? ""}
        inputMode="numeric"
        onChange={(e) =>
          updateTiempoManualConfig(pasoId, {
            [campo]: e.target.value === "" ? null : Number(e.target.value),
          })
        }
        style={{
          border: 0,
          outline: 0,
          background: "transparent",
          width: "100%",
          minWidth: 0,
          fontSize: 13,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      />
      <span
        style={{ fontSize: 11, color: "var(--muted-text-2, #92929b)" }}
      >
        min
      </span>
    </div>
  );

  const pregunta = (
    <div style={bloque}>
      {/* Mismo armado que los bloques del eje: encabezado al costado de sus
          campos, no arriba. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(140px, 200px) minmax(0, 1fr)",
          gap: 18,
          alignItems: "start",
        }}
      >
        <div>
          <div style={tituloStyle}>Qué se le pide al comercial</div>
          <div style={hintStyle}>
            Este texto aparece en el presupuesto, al lado del campo que tiene
            que completar.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* La pregunta y su unidad van en la misma fila: el input de texto solo
          ocupaba un renglón entero sin necesitarlo. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 168px",
          gap: 12,
          alignItems: "end",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={labelStyle}>Pregunta</label>
          <Input
            type="text"
            value={
              typeof tiempoManualConfig.etiqueta === "string"
                ? tiempoManualConfig.etiqueta
                : ""
            }
            onChange={(e) =>
              updateTiempoManualConfig(pasoId, {
                etiqueta: e.target.value || null,
              })
            }
            placeholder={`Ej. "Tiempo estimado de ${(cfg.nombreVisible?.trim() || familia?.nombre || "trabajo").toLowerCase()}"`}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={labelStyle}>Carga el tiempo en</label>
          {/* Nota para quien lea el código: el motor toma lo que carga el
              comercial como el tiempo TOTAL del paso
              (`runMin = tiempoManualMin`), sin multiplicarlo por la cantidad.
              Ver docs/editor-pasos-preguntas-orden.md. */}
          <HumanSelect
            value={tiempoManualUnidad}
            onValueChange={(value) =>
              updateTiempoManualConfig(pasoId, {
                unidadInput: value === "h" ? "h" : "min",
              })
            }
            options={TIEMPO_MANUAL_UNIDAD_OPTIONS}
            placeholder="Elegir unidad"
          />
        </div>
      </div>
      {/* Va con la pregunta, no con las ayudas: no es una pista para contestar
          mejor, es si se puede seguir sin contestar — el motor corta la
          cotización con `tiempo_manual_requerido`. Interruptor y no checkbox:
          es una política que se prende o se apaga. */}
      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          cursor: "pointer",
        }}
      >
        <Switch
          checked={tiempoManualConfig.obligatorio === true}
          onCheckedChange={(valor) =>
            updateTiempoManualConfig(pasoId, { obligatorio: valor || null })
          }
          style={{ marginTop: 2, flexShrink: 0 }}
        />
        <span>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 500 }}>
            Obligatorio para presupuestar
          </span>
          <span
            style={{
              display: "block",
              fontSize: 11.5,
              color: "var(--muted-text, #6e6e76)",
              marginTop: 2,
            }}
          >
            Sin este tiempo cargado, el ítem no se puede agregar a la OT. Típico
            en corte láser.
          </span>
        </span>
      </label>
      {tiempoManualConfig.obligatorio === true &&
      tiempoManualDefaultMin == null ? (
        <div style={{ fontSize: 11.5, color: "#b7791f" }}>
          Sin valor sugerido, la cotización queda bloqueada hasta que el
          comercial cargue el tiempo. Es lo esperable en pasos tipo láser —
          confirmá que es lo que querés.
        </div>
      ) : null}
        </div>
      </div>
    </div>
  );

  const ayudas = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* La pregunta y su unidad viven acá desde el árbol de tiempo: la
          decisión (No/Puede/Debe) son pills del esquema; esto es el detalle
          fino de CÓMO se le pregunta al comercial. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 168px",
          gap: 12,
          alignItems: "end",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={labelStyle}>Pregunta</label>
          <Input
            type="text"
            value={
              typeof tiempoManualConfig.etiqueta === "string"
                ? tiempoManualConfig.etiqueta
                : ""
            }
            onChange={(e) =>
              updateTiempoManualConfig(pasoId, {
                etiqueta: e.target.value || null,
              })
            }
            placeholder={`Ej. "Tiempo estimado de ${(cfg.nombreVisible?.trim() || familia?.nombre || "trabajo").toLowerCase()}"`}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={labelStyle}>Carga el tiempo en</label>
          <HumanSelect
            value={tiempoManualUnidad}
            onValueChange={(value) =>
              updateTiempoManualConfig(pasoId, {
                unidadInput: value === "h" ? "h" : "min",
              })
            }
            options={TIEMPO_MANUAL_UNIDAD_OPTIONS}
            placeholder="Elegir unidad"
          />
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={labelStyle}>Valor sugerido</label>
          {minutos(tiempoManualConfig.defaultMin, "defaultMin")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={labelStyle}>Rango aceptado</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {minutos(tiempoManualConfig.minMin, "minMin", 104)}
            <span
              style={{ fontSize: 12.5, color: "var(--muted-text, #6e6e76)" }}
            >
              a
            </span>
            {minutos(tiempoManualConfig.maxMin, "maxMin", 104)}
          </div>
        </div>
      </div>
      {tiempoManualConfig.obligatorio === true &&
      tiempoManualDefaultMin == null ? (
        <div style={{ fontSize: 11.5, color: "#b7791f" }}>
          Sin valor sugerido, la cotización queda bloqueada hasta que el
          comercial cargue el tiempo. Es lo esperable en pasos tipo láser —
          confirmá que es lo que querés.
        </div>
      ) : null}
    </div>
  );

  // El eje pide las dos mitades por separado para poder mandar las ayudas al
  // final (son opcionales); el detallado congelado las muestra juntas.
  if (parte === "ayudas") return ayudas;
  if (parte === "pregunta") return pregunta;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {interruptor}
      {pregunta}
      <div style={bloque}>
        <div>
          <div style={tituloStyle}>Ayudas y validación</div>
          <div style={hintStyle}>
            Opcional. Sirve para que dos comerciales no coticen el mismo trabajo
            con tiempos muy distintos.
          </div>
        </div>
        {ayudas}
      </div>
    </div>
  );
}

// ─── Árbol de tiempo: el valor del tiempo FIJO (pregunta ②) ─────────────
// Un solo concepto para los dos storages históricos: T-1 guarda minutos en
// config; las familias sin T-1 en el menú guardan horas en params (F0.3:
// las escrituras nuevas prefieren T-1 cuando el menú lo permite).

function TiempoFijoValorEditor({
  pasoId,
  cfg,
  familia,
  onPatch,
  onParams,
}: {
  pasoId: string;
  cfg: UpsertConfigPasoPayload;
  familia: FamiliaListItem | undefined;
  onPatch: (pasoId: string, patch: Partial<UpsertConfigPasoPayload>) => void;
  onParams: (pasoId: string, patch: Record<string, unknown>) => void;
}) {
  const params = asRecord(cfg.paramsPasoJson);
  const soportaT1 = (familia?.modosTiempoSoportados ?? []).includes("T-1");
  const modoEfectivo =
    cfg.modoTiempo ?? familia?.modosTiempoSoportados?.[0] ?? null;
  const horas = readOptionalNumber(params.horasEstimadas);
  const minutos =
    modoEfectivo === "T-1"
      ? readOptionalNumber(cfg.tiempoFijoOverrideMin)
      : horas != null
        ? horas * 60
        : null;
  const [unidad, setUnidad] = React.useState<"min" | "h">(() =>
    minutos != null && minutos >= 60 && minutos % 30 === 0 ? "h" : "min",
  );
  const valorMostrado =
    minutos == null ? "" : unidad === "h" ? minutos / 60 : minutos;
  const defaultFamiliaMin = readOptionalNumber(
    familia?.defaults?.tiempoFijoMin,
  );

  const escribirMin = (min: number | null) => {
    if (soportaT1) {
      // Camino nuevo: T-1 + minutos en config; se limpian los relojes del
      // storage viejo (horas de T-2) para no apilar.
      onPatch(pasoId, { modoTiempo: "T-1", tiempoFijoOverrideMin: min });
      onParams(pasoId, { horasEstimadas: null, timeCalculationMode: null });
    } else {
      // Familia sin T-1 en el menú (pintura, montaje): el fijo vive en T-2.
      // Persistimos el modo: sin esto modoTiempo quedaba null y el motor caía a
      // T-1 (ignorando el tiempo_fijo de T-2). Mismo bug que el tiempo variable.
      onPatch(pasoId, {
        modoTiempo: (modoEfectivo ??
          "T-2") as UpsertConfigPasoPayload["modoTiempo"],
      });
      onParams(pasoId, {
        horasEstimadas: min == null ? null : min / 60,
        timeCalculationMode: "tiempo_fijo",
      });
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ ...CAJA_EJE, width: 132 }}>
        <input
          value={valorMostrado}
          inputMode="decimal"
          placeholder={
            defaultFamiliaMin != null
              ? `Usando el del paso: ${
                  unidad === "h" ? defaultFamiliaMin / 60 : defaultFamiliaMin
                }`
              : unidad === "h"
                ? "Ej. 2"
                : "Ej. 15"
          }
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") return escribirMin(null);
            const v = Number(raw.replace(",", "."));
            if (!Number.isFinite(v)) return;
            escribirMin(unidad === "h" ? v * 60 : v);
          }}
          style={{
            border: 0,
            outline: 0,
            background: "transparent",
            width: "100%",
            minWidth: 0,
            fontSize: 13,
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
          }}
        />
      </div>
      <HumanSelect
        value={unidad}
        onValueChange={(value) => setUnidad(value === "h" ? "h" : "min")}
        options={[
          { value: "min", label: "minutos" },
          { value: "h", label: "horas" },
        ]}
        placeholder="unidad"
      />
    </div>
  );
}

// ─── Árbol de tiempo: panel "Lo dice la máquina" (① = máquina) ──────────
// Explica de dónde sale el reloj —perfil o primitiva del oficio— sin
// perillas: donde decide la máquina, el panel narra (mismo patrón que
// "Lo decide la geometría" en materiales).

function TiempoMaquinaPanel({
  familia,
  maquina,
}: {
  cfg: UpsertConfigPasoPayload;
  familia: FamiliaListItem | undefined;
  maquina: LookupsConfigPaso["maquinas"][number] | null;
}) {
  const primitiva = familia?.primitivaTiempo ?? null;

  // Sin nombrar el perfil ni su velocidad (feedback del usuario): el perfil
  // del paso es un DEFAULT — el motor muchas veces elige otro compatible
  // según el material o el modo de color, y mostrar "perfil X · 45 PPM"
  // hacía parecer que es fijo.
  let titulo: string;
  let detalle: string;
  if (primitiva === "guillotina_por_cortes") {
    titulo = "Lo define el plan de corte";
    detalle =
      "Tandas (pliegos ÷ cuántos entran por bajada, según gramaje) × cortes del plan de imposición × segundos por corte, más la recarga entre tandas. Los valores viven en el perfil de la guillotina.";
  } else if (primitiva) {
    titulo = "Lo define el plan de trabajo del oficio";
    detalle =
      "Esta familia calcula el tiempo con un algoritmo propio; el perfil operativo de la máquina aporta sus parámetros.";
  } else if (maquina) {
    titulo = "Lo define el perfil operativo de la máquina";
    detalle =
      "El tiempo sale de la velocidad del perfil que la máquina use en cada trabajo.";
  } else {
    titulo = "Lo define el perfil operativo de la máquina";
    detalle =
      "Elegí la máquina en «Máquina que utiliza»: la velocidad de su perfil operativo define este tiempo. Acá no hay nada que configurar.";
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px dashed var(--hairline-strong, #c9c2b8)",
        background: "var(--surface-2, #fafaf9)",
        maxWidth: "72ch",
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        style={{ marginTop: 2, flexShrink: 0, opacity: 0.55 }}
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4M12 8h.01" />
      </svg>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>
          {titulo}
        </span>
        <span
          style={{
            display: "block",
            fontSize: 11.5,
            color: "var(--muted-text, #6e6e76)",
            marginTop: 2,
          }}
        >
          {detalle}
        </span>
      </span>
    </div>
  );
}

// ─── Modo de color: LA UI del detallado, extraída como componente ──────
// La usan el detallado (gate mostrarModoColor && sin candidatas) y el
// asistente guiado vía el esquema (maquina.modo_color).

function ModoColorDetalladoEditor({
  pasoId,
  cfg,
  modoColorOptions,
  modoColorPerfilDefault,
  updateModoColorConfig,
}: {
  pasoId: string;
  cfg: UpsertConfigPasoPayload;
  modoColorOptions: ReturnType<typeof buildModoColorOptions>;
  modoColorPerfilDefault: string;
  updateModoColorConfig: (
    pasoId: string,
    patch: Record<string, unknown>,
  ) => void;
}) {
  const modoColorConfig = getModoColorConfig(cfg.paramsPasoJson);
  const modoColorAllowed = Array.isArray(modoColorConfig.allowedModes)
    ? modoColorConfig.allowedModes
        .map((item) => normalizeModoColor(item))
        .filter((item): item is string => item !== null)
    : [];
  const modoColorEnabled = modoColorConfig.enabled === true;
  const modoColorEffectiveAllowed =
    modoColorEnabled && modoColorAllowed.length > 0
      ? modoColorAllowed.filter((mode) =>
          modoColorOptions.some((option) => option.value === mode),
        )
      : modoColorOptions.map((option) => option.value);
  const modoColorDefaultOptions = modoColorOptions.filter((option) =>
    modoColorEffectiveAllowed.includes(option.value),
  );
  const modoColorDefault =
    modoColorDefaultOptions.find(
      (option) => option.value === modoColorPerfilDefault,
    )?.value ??
    modoColorDefaultOptions[0]?.value ??
    "";
  const modoColorIsSelectable = modoColorDefaultOptions.length > 1;
  const modoColorSummary = !modoColorEnabled
    ? modoColorOptions.length > 1
      ? "Sin restricción: el comercial elige entre todos los modos compatibles."
      : modoColorOptions.length === 1
        ? `Sin restricción: se usa ${modoColorOptions[0]?.label} automáticamente.`
        : "La máquina/perfil todavía no declara modos de color."
    : modoColorIsSelectable
      ? "El comercial elegirá entre los modos permitidos."
      : `Modo fijo: ${
          modoColorDefaultOptions[0]?.label ?? "sin modo disponible"
        }.`;
  return (
    <>

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
                                                      pasoId,
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
                                                                pasoId,
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
                                      
    </>
  );
}

// ─── Candidatas M-2: LA UI del detallado, extraída como componente ─────
// (decisión del usuario en la revisión del editor declarativo: el guiado
// usa exactamente esta UI, no cards propias). La usan el detallado y el
// asistente; los handlers viven en el editor y se pasan por props.

function CandidatasDetalladoEditor({
  pasoId,
  cfg,
  familia,
  lookups,
  maquinasCandidatasCompatibles,
  mostrarModoColor,
  toggleMaquinaCandidata,
  setMaquinaCandidataPreferida,
  setMaquinaCandidataPerfilDefault,
  setMaquinaCandidataModoColorAllowed,
  setMaquinaCandidataPerfilPorModo,
}: {
  pasoId: string;
  cfg: UpsertConfigPasoPayload;
  familia: FamiliaListItem | undefined;
  lookups: LookupsConfigPaso;
  maquinasCandidatasCompatibles: LookupsConfigPaso["maquinas"];
  mostrarModoColor: boolean;
  toggleMaquinaCandidata: (pasoId: string, maquinaId: string, checked: boolean) => void;
  setMaquinaCandidataPreferida: (pasoId: string, maquinaId: string) => void;
  setMaquinaCandidataPerfilDefault: (pasoId: string, maquinaId: string, perfilId: string | null) => void;
  setMaquinaCandidataModoColorAllowed: (pasoId: string, maquinaId: string, modes: string[]) => void;
  setMaquinaCandidataPerfilPorModo: (
    pasoId: string,
    maquinaId: string,
    modo: string,
    perfilId: string | null,
  ) => void;
}) {
  const candidatasCfg = cfg.maquinasCandidatas ?? [];
  const candidatasSeleccionadas = new Set(
    candidatasCfg.map((candidata) => candidata.maquinaId),
  );
  const candidataPreferidaId =
    candidatasCfg.find((candidata) => candidata.esPreferida)?.maquinaId ?? null;
  void lookups;
  // Sólo se muestran las máquinas AGREGADAS a esta ruta; el resto se buscan y
  // se agregan desde el selector de arriba (pedido del usuario 2026-08-13). Así
  // una ruta que usa 2 máquinas no arrastra el catálogo entero destildado.
  const maquinasSeleccionadas = maquinasCandidatasCompatibles.filter((m) =>
    candidatasSeleccionadas.has(m.id),
  );
  const opcionesAgregar = maquinasCandidatasCompatibles
    .filter((m) => !candidatasSeleccionadas.has(m.id))
    .map((m) => ({
      value: m.id,
      label: m.nombre,
      grupo: machineTechnologyLabel(m),
      detalle: m.codigo,
    }));

  return (
    <div className={maq.sec}>
      {maquinasCandidatasCompatibles.length === 0 ? (
        <p className={maq.empty}>
          No hay máquinas compatibles con perfiles activos para esta familia.
        </p>
      ) : (
        <>
          <SelectBuscable
            value=""
            onChange={(id) => toggleMaquinaCandidata(pasoId, id, true)}
            opciones={opcionesAgregar}
            placeholder={
              opcionesAgregar.length === 0
                ? "Todas las máquinas compatibles ya están agregadas"
                : "Agregar máquina…"
            }
            placeholderBusqueda="Buscar máquina o tecnología…"
            vacio="No hay máquinas que coincidan."
            ariaLabel="Agregar máquina al paso"
            disabled={opcionesAgregar.length === 0}
            minimoParaBuscar={0}
          />
          {maquinasSeleccionadas.length === 0 ? (
            <p className={maq.empty}>
              Todavía no agregaste máquinas. Buscá arriba y agregá las que hacen
              este paso.
            </p>
          ) : (
            <div className={maq.list}>
              {maquinasSeleccionadas.map((maquina) => {
            const selected = candidatasSeleccionadas.has(maquina.id);
            const isPreferida =
              selected && candidataPreferidaId === maquina.id;
            const chip = techChipStyle(getMachineTechnology(maquina));
            const cfgCand = candidatasCfg.find(
              (item) => item.maquinaId === maquina.id,
            );
            const perfilesCompatibles = maquina.perfilesOperativos.filter(
              (perfil) => perfilCompatibleConFamilia(familia, perfil),
            );
            const candidateModoOptions = mostrarModoColor
              ? buildModoColorOptions(maquina, null, true)
              : [];
            const candidateAllowed = resolveModoColorAllowedModes(
              cfgCand?.modoColorAllowedModes,
              candidateModoOptions,
            );
            return (
              <React.Fragment key={maquina.id}>
                <div className={`${maq.mrow} ${maq.on}`}>
                  <span className={maq.av}>{chip.ini}</span>
                  <span className={maq.nm}>
                    <span className={maq.a}>
                      <span className={maq.txt}>{maquina.nombre}</span>
                      {isPreferida ? (
                        <span className={maq.badge}>
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            stroke="none"
                          >
                            <path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8L12 3.6Z" />
                          </svg>
                          Preferida
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className={maq.sp} />
                  <span className={maq.tag}>
                    {machineTechnologyLabel(maquina)}
                  </span>
                  {selected && !isPreferida ? (
                    <button
                      type="button"
                      className={maq.pref}
                      onClick={(event) => {
                        event.stopPropagation();
                        setMaquinaCandidataPreferida(pasoId, maquina.id);
                      }}
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      >
                        <path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8L12 3.6Z" />
                      </svg>
                      Preferir
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={maq.quitar}
                    onClick={() =>
                      toggleMaquinaCandidata(pasoId, maquina.id, false)
                    }
                    aria-label={`Quitar ${maquina.nombre} del paso`}
                    title="Quitar del paso"
                  >
                    <XIcon size={14} />
                  </button>
                </div>

                {selected ? (
                  <div className={maq.det}>
                    <div className={maq.frow}>
                      {/* El "Perfil por defecto" general es el único control de
                          perfil cuando el paso NO tiene modos de color. Con
                          modos, cada modo lleva su propio "Perfil para <modo>"
                          (abajo) y este default general se maneja solo — sin un
                          título "por defecto" que no dice a qué modo pertenece
                          (pedido del usuario 2026-08-13). */}
                      {!(
                        mostrarModoColor && candidateModoOptions.length > 0
                      ) ? (
                        <span className={maq.fl}>
                          <span className={maq.k}>Perfil por defecto</span>
                          <span
                            className={`${maq.ctl} ${maq.sel}`}
                            style={{ minWidth: 210 }}
                          >
                            <select
                              value={cfgCand?.perfilDefaultId ?? ""}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) =>
                                setMaquinaCandidataPerfilDefault(
                                  pasoId,
                                  maquina.id,
                                  event.target.value || null,
                                )
                              }
                            >
                              <option value="">Primer perfil compatible</option>
                              {perfilesCompatibles.map((perfil) => (
                                <option key={perfil.id} value={perfil.id}>
                                  {perfil.nombre}
                                </option>
                              ))}
                            </select>
                          </span>
                        </span>
                      ) : null}
                      {mostrarModoColor && candidateModoOptions.length > 0 ? (
                        <span
                          className={maq.fl}
                          style={{ flex: 1, minWidth: 280 }}
                        >
                          <span className={maq.k}>
                            Modos de color habilitados
                          </span>
                          <span className={maq.modes}>
                            {candidateModoOptions.map((option) => {
                              const optionSelected = candidateAllowed.includes(
                                option.value,
                              );
                              const nextAllowed = optionSelected
                                ? candidateAllowed.filter(
                                    (item) => item !== option.value,
                                  )
                                : [...candidateAllowed, option.value];
                              const safeNextAllowed =
                                nextAllowed.length > 0
                                  ? nextAllowed
                                  : [option.value];
                              const swatches = modoColorSwatches(option.value);
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  className={maq.mchip}
                                  aria-pressed={optionSelected}
                                  title={option.code ?? undefined}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setMaquinaCandidataModoColorAllowed(
                                      pasoId,
                                      maquina.id,
                                      safeNextAllowed,
                                    );
                                  }}
                                >
                                  {swatches.length > 0 ? (
                                    <span className={maq.ink}>
                                      {swatches.map((sw, swIdx) => (
                                        <i
                                          key={swIdx}
                                          className={sw.borde ? maq.w : undefined}
                                          style={{ background: sw.bg }}
                                        />
                                      ))}
                                    </span>
                                  ) : (
                                    <span className={maq.none} />
                                  )}
                                  {option.label}
                                </button>
                              );
                            })}
                          </span>
                        </span>
                      ) : null}
                    </div>
                    {/* Perfil POR MODO: cada modo habilitado que imprime lleva
                        su propio "Perfil para <modo>", apilados y en el orden de
                        los modos (rediseño 2026-08-13). Reemplaza al viejo
                        "default general + desempate sólo para ambiguos", que
                        dejaba un título "por defecto" sin decir a qué modo
                        servía. La opción "Automático" cae al fallback interno
                        del motor (default general → primer perfil compatible).
                        "Sin impresión" no aparece: no tiene perfil. */}
                    {mostrarModoColor
                      ? (() => {
                          const perfilesDelModo = (modo: string) =>
                            maquina.perfilesOperativos.filter((perfil) =>
                              modosColorFromPerfil(perfil).includes(modo),
                            );
                          const modosConPerfil = candidateModoOptions.filter(
                            (option) =>
                              candidateAllowed.includes(option.value) &&
                              perfilesDelModo(option.value).length > 0,
                          );
                          if (modosConPerfil.length === 0) return null;
                          const mapa = cfgCand?.perfilDefaultPorModo ?? {};
                          return (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  "repeat(auto-fit, minmax(210px, 260px))",
                                gap: "10px 12px",
                              }}
                            >
                              {modosConPerfil.map((option) => (
                                <span className={maq.fl} key={option.value}>
                                  <span className={maq.k}>
                                    Perfil para {option.label}
                                  </span>
                                  <span
                                    className={`${maq.ctl} ${maq.sel}`}
                                    style={{ minWidth: 0 }}
                                  >
                                    <select
                                      value={mapa[option.value] ?? ""}
                                      onClick={(event) =>
                                        event.stopPropagation()
                                      }
                                      onChange={(event) =>
                                        setMaquinaCandidataPerfilPorModo(
                                          pasoId,
                                          maquina.id,
                                          option.value,
                                          event.target.value || null,
                                        )
                                      }
                                    >
                                      <option value="">Automático</option>
                                      {perfilesDelModo(option.value).map(
                                        (perfil) => (
                                          <option
                                            key={perfil.id}
                                            value={perfil.id}
                                          >
                                            {perfil.nombre}
                                          </option>
                                        ),
                                      )}
                                    </select>
                                  </span>
                                </span>
                              ))}
                            </div>
                          );
                        })()
                      : null}
                    {mostrarModoColor &&
                    candidateModoOptions.length > 0 &&
                    candidateAllowed.length === 0 ? (
                      <div className={maq.warnmsg}>
                        Sin modos habilitados esta máquina no puede correr el
                        paso. Habilitá al menos uno.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </React.Fragment>
            );
              })}
            </div>
          )}
        </>
      )}

      {/* Sin pie explicativo: decía que las demás candidatas "quedan
          disponibles si la preferida está ocupada o en mantenimiento" — es
          FALSO (la preferida es sólo el default) y de paso era texto de más
          (feedback del usuario, 2026-08-11). */}
    </div>
  );
}

// ─── Editor declarativo (sub-fase A) — renderer de secciones-pregunta ──
// Renderiza TODAS las opciones visibles de una sección del esquema:
// abiertas si su pendiente está vivo, colapsadas con resumen + "Cambiar"
// si están resueltas. Nada desaparece: paridad visible.

/**
 * Encabezado de un GRUPO de cards (sin fondo, como en el diseño): un check de
 * estado, el título con un chip de conteo, la descripción, y una acción a la
 * derecha (p.ej. "Agregar componente"). Lo usan los grupos que tienen varias
 * cards debajo — hoy, los materiales.
 */
function EncabezadoGrupo({
  titulo,
  conteo,
  descripcion,
  resuelto,
  derecha,
}: {
  titulo: string;
  conteo?: string;
  descripcion?: string;
  resuelto: boolean;
  derecha?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "2px 2px 4px",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          borderRadius: "50%",
          flexShrink: 0,
          marginTop: 1,
          ...(resuelto
            ? { background: "#22a06b", color: "#fff" }
            : {
                background: "color-mix(in srgb, #b7791f 14%, transparent)",
                border: "1px solid #d8b671",
              }),
        }}
      >
        {resuelto ? <CheckIcon className="size-3" strokeWidth={3} /> : null}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          {titulo}
          {conteo ? (
            <span
              style={{
                fontFamily: "var(--font-mono, ui-monospace)",
                fontSize: 10.5,
                color: "var(--muted-text-2, #92929b)",
                border: "1px solid var(--hairline, #e5e2db)",
                borderRadius: 5,
                padding: "2px 7px",
                background: "var(--surface, #fff)",
              }}
            >
              {conteo}
            </span>
          ) : null}
        </div>
        {descripcion ? (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--muted-text, #6e6e76)",
              marginTop: 2,
              maxWidth: "66ch",
            }}
          >
            {descripcion}
          </div>
        ) : null}
      </div>
      {derecha ? <div style={{ flexShrink: 0 }}>{derecha}</div> : null}
    </div>
  );
}

/**
 * La card de EJE (docs/editor-pasos-preguntas-orden.md §3).
 *
 * Un eje es UNA decisión ("cuánto tarda este paso"), aunque el modelo la
 * guarde en doce campos. Cerrada muestra el estado en una línea; abierta, un
 * formulario partido en sub-bloques con nombre — "dónde se hace", "ritmo de
 * trabajo", "sobre qué cantidad se aplica" — en vez de una lista de preguntas
 * que hay que abrir de a una.
 *
 * Adentro, cada opción se muestra con su ETIQUETA corta ("Centro productivo"):
 * la pregunta larga ya la contesta el título del grupo. Las que no declaran
 * grupo caen en un bloque final, así ninguna se pierde.
 */
function EjeGuiado({
  titulo,
  subtitulo,
  opciones,
  grupos,
  resumenPrincipal,
  ctx,
  pendientesVivos,
  onAplicar,
  renderComponente,
  accionExtra,
  fijo = false,
  ocultarCheck = false,
  enLista = false,
}: {
  titulo: string;
  subtitulo?: string;
  /** Opciones de la card ya filtradas (por eje, o por material en un slot). */
  opciones: OpcionPaso[];
  /** Sus sub-bloques, en orden. */
  grupos: GrupoEje[];
  /** Claves cuyo resumen define la card, en orden de prioridad: es lo que se
   *  lee con la card cerrada. Sin esto la línea arrancaría por la primera
   *  opción declarada, que casi nunca es la que importa. */
  resumenPrincipal: string[];
  ctx: ContextoOpcion;
  pendientesVivos: Set<string>;
  onAplicar: (patch: PatchOpcion) => void;
  renderComponente: (id: string) => React.ReactNode;
  /** Un control extra a la izquierda del "Cambiar" (p.ej. "Quitar" material). */
  accionExtra?: React.ReactNode;
  /**
   * `fijo`: encabezado de sección siempre abierto, sin fondo ni "Cambiar" —
   * el check del encabezado dice si está resuelto. Para las secciones que se
   * revisan de arriba a abajo. Sin `fijo` (materiales), la card colapsa.
   */
  fijo?: boolean;
  /**
   * Oculta el círculo de check del encabezado. Las cards de material lo piden:
   * el check verde las hacía confundir con las SECCIONES (que sí lo llevan).
   */
  ocultarCheck?: boolean;
  /**
   * `enLista`: la card no lleva fondo ni borde propios — es una fila de una
   * lista compartida (la separación la da el contenedor). El encabezado entero
   * es el que abre/cierra (un chevron en vez del botón "Cambiar"). Lo usan los
   * materiales para no verse como cards sueltas.
   */
  enLista?: boolean;
}) {
  const sinResolver = (op: OpcionPaso) =>
    op.origenValor(ctx) === "sin-definir" ||
    (op.pendiente != null && pendientesVivos.has(op.pendiente));
  const faltaAlgo = opciones.some(sinResolver);
  const [colapsado, setColapsado] = React.useState(!faltaAlgo);
  const abierto = fijo || !colapsado;
  if (opciones.length === 0) return null;

  // La línea del eje: primero lo que lo define (el ritmo, no "se calcula
  // solo"), después el resto hasta tres.
  const porClave = new Map(opciones.map((op) => [op.clave, op]));
  const principales = resumenPrincipal
    .map((clave) => porClave.get(clave))
    .filter((op): op is OpcionPaso => op != null);
  const resto = opciones.filter((op) => !principales.includes(op));
  const ordenadas = [...principales, ...resto];
  const resumenes = ordenadas.map((op) => op.resumen(ctx));
  const linea =
    resumenes.length > 3
      ? `${resumenes.slice(0, 3).join(" · ")} · +${resumenes.length - 3}`
      : resumenes.join(" · ");

  const porOrden = (a: OpcionPaso, b: OpcionPaso) =>
    (a.orden ?? 999) - (b.orden ?? 999);
  const gruposConOpciones = [
    ...grupos.map((grupo) => ({
      grupo,
      items: opciones.filter((op) => op.grupo === grupo.id).sort(porOrden),
    })),
    { grupo: { id: "__resto" } as GrupoEje, items: opciones.filter((op) => !op.grupo) },
  ].filter((g) => g.items.length > 0);

  const etiquetaDe = (op: OpcionPaso) =>
    typeof op.etiqueta === "function"
      ? op.etiqueta(ctx)
      : (op.etiqueta ?? op.pregunta);

  return (
    <div
      style={
        enLista
          ? {
              // Fila de una lista: sin card propia, la separa el contenedor.
              display: "flex",
              flexDirection: "column",
            }
          : fijo
          ? {
              // Patrón "Materiales que consume": el encabezado va SIN fondo y
              // sólo la parte que se parametriza lleva card. Ver más abajo.
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }
          : {
              border: "1px solid var(--hairline, #e6e2dc)",
              borderRadius: 12,
              background: "var(--surface-1, #fff)",
              padding: abierto ? "14px 16px 16px" : "10px 14px",
              display: "flex",
              flexDirection: "column",
              gap: abierto ? 16 : 4,
            }
      }
    >
      <div
        onClick={enLista ? () => setColapsado(!colapsado) : undefined}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: enLista ? "center" : "flex-start",
          gap: 10,
          ...(fijo ? { padding: "2px 2px 0" } : {}),
          ...(enLista
            ? { padding: "11px 13px", cursor: "pointer" }
            : {}),
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 15,
              fontWeight: 650,
            }}
          >
            {ocultarCheck ? null : (
              <span
                aria-hidden
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  flexShrink: 0,
                  ...(faltaAlgo
                    ? {
                        background:
                          "color-mix(in srgb, #b7791f 14%, transparent)",
                        border: "1px solid #d8b671",
                      }
                    : { background: "#22a06b", color: "#fff" }),
                }}
              >
                {faltaAlgo ? null : (
                  <CheckIcon className="size-2.5" strokeWidth={3.2} />
                )}
              </span>
            )}
            {titulo}
          </div>
          {(() => {
            // El resumen bajo el título sólo aporta con la card CERRADA (dice
            // qué quedó elegido sin abrir). Abierta, los controles ya lo dicen
            // y la línea sólo repite — se esconde en las filas de lista.
            const texto = fijo
              ? subtitulo
              : enLista && abierto
              ? null
              : abierto
              ? (subtitulo ?? linea)
              : linea;
            if (!texto) return null;
            return (
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--muted-text, #6e6e76)",
                  marginTop: 2,
                  marginLeft: ocultarCheck ? 0 : 23,
                  maxWidth: 560,
                }}
              >
                {texto}
              </div>
            );
          })()}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
          }}
        >
          {enLista ? (
            <span
              onClick={(event) => event.stopPropagation()}
              style={{ display: "inline-flex", alignItems: "center" }}
            >
              {accionExtra}
            </span>
          ) : (
            accionExtra
          )}
          {fijo ? null : enLista ? (
            <svg
              aria-hidden
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                color: "var(--muted-text-2, #92929b)",
                flexShrink: 0,
                transition: "transform .15s ease",
                transform: abierto ? "rotate(180deg)" : "none",
              }}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          ) : (
            <button
              type="button"
              className="btn"
              style={{ fontSize: 12, whiteSpace: "nowrap" }}
              onClick={() => setColapsado(!colapsado)}
            >
              {abierto ? "Listo" : "Cambiar"}
            </button>
          )}
        </div>
      </div>

      {abierto ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            // En modo fijo, sólo el contenido lleva card (el encabezado va
            // suelto, como en Materiales). Sin fijo, ya vive dentro del card.
            ...(enLista
              ? { padding: "2px 13px 14px" }
              : fijo
              ? {
                  border: "1px solid var(--hairline, #e6e2dc)",
                  borderRadius: 12,
                  background: "var(--surface-1, #fff)",
                  padding: "14px 16px",
                }
              : {}),
          }}
        >
          {gruposConOpciones.map(({ grupo, items }, idx) => (
            <div
              key={grupo.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                // `arriba`: bloques a todo el ancho, separados por línea
                // horizontal. `lado`: cuelgan de una línea vertical, que
                // muestra que son consecuencia de la bifurcación de arriba.
                ...(grupo.encabezado === "arriba"
                  ? {
                      // Longhand a propósito: mezclar `padding` (shorthand) con
                      // paddingTop/Bottom condicionales hacía que React avisara
                      // "removing a style property during rerender".
                      paddingTop: idx === 0 ? 2 : 15,
                      paddingBottom:
                        idx === gruposConOpciones.length - 1 ? 2 : 15,
                      borderBottom:
                        idx < gruposConOpciones.length - 1
                          ? "1px solid var(--hairline, #eee7de)"
                          : undefined,
                    }
                  : grupo.estilo === "campos"
                    ? {
                        borderLeft: "2px solid var(--hairline, #eee7de)",
                        paddingLeft: 16,
                        paddingTop: idx > 0 ? 4 : 6,
                      }
                    : {}),
              }}
            >
              {/* El encabezado del bloque va al COSTADO de sus campos, no
                  arriba: el eje tiene ancho de sobra y apilar título, ayuda y
                  controles hacía la card el doble de alta de lo necesario. */}
              <div
                style={
                  grupo.titulo && grupo.encabezado !== "arriba"
                    ? {
                        display: "grid",
                        gridTemplateColumns: "minmax(140px, 200px) minmax(0, 1fr)",
                        gap: 18,
                        alignItems: "start",
                      }
                    : undefined
                }
              >
                {grupo.titulo ? (
                  <div
                    style={
                      grupo.encabezado === "arriba"
                        ? { marginBottom: 11 }
                        : undefined
                    }
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                      {grupo.titulo}
                    </div>
                    {grupo.ayuda ? (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--muted-text, #6e6e76)",
                          marginTop: 2,
                          maxWidth: "70ch",
                        }}
                      >
                        {typeof grupo.ayuda === "function"
                          ? grupo.ayuda(ctx)
                          : grupo.ayuda}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      grupo.estilo === "campos"
                        ? (grupo.columnas ??
                          "repeat(auto-fit, minmax(230px, 1fr))")
                        : "1fr",
                    gap: 12,
                    alignItems: grupo.alinearItems ?? "start",
                  }}
                >
              {items.map((opcion) => (
                <div
                  key={opcion.clave}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                    ...(opcion.anchoCompleto || grupo.estilo !== "campos"
                      ? { gridColumn: "1 / -1" }
                      : {}),
                  }}
                >
                  {grupo.estilo === "bifurcacion" ||
                  etiquetaDe(opcion).trim() === "" ? null : (
                    <label
                      style={{
                        fontSize: 11.5,
                        fontWeight: 450,
                        color: "var(--fg-2, #2c2c33)",
                      }}
                    >
                      {etiquetaDe(opcion)}
                    </label>
                  )}
                  {/* La ayuda de la opción sólo donde el grupo no la cubre y
                      todavía no hay respuesta: si ya está contestada, el texto
                      estira la card y hace perder el hilo. */}
                  {sinResolver(opcion) && opcion.ayuda ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--muted-text, #6e6e76)",
                        maxWidth: 560,
                      }}
                    >
                      {typeof opcion.ayuda === "function"
                        ? opcion.ayuda(ctx)
                        : opcion.ayuda}
                    </div>
                  ) : null}
                  <ControlGuiado
                    opcion={opcion}
                    ctx={ctx}
                    onAplicar={onAplicar}
                    renderComponente={renderComponente}
                    variante="eje"
                  />
                </div>
              ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const ORIGEN_BADGE: Record<string, string | null> = {
  config: null,
  "default-paso": "del paso",
  "default-maquina": "de la máquina",
  "sin-definir": "sin definir",
};

function OpcionGuiadaFila({
  opcion,
  ctx,
  abiertaInicial,
  pendienteVivo,
  onAplicar,
  renderComponente,
}: {
  opcion: OpcionPaso;
  ctx: ContextoOpcion;
  abiertaInicial: boolean;
  pendienteVivo: boolean;
  onAplicar: (patch: PatchOpcion) => void;
  renderComponente: (id: string) => React.ReactNode;
}) {
  const [abierta, setAbierta] = React.useState(abiertaInicial);
  const resumen = opcion.resumen(ctx);
  const origen = opcion.origenValor(ctx);
  const badge = ORIGEN_BADGE[origen];
  // Respondida = tiene un valor efectivo (propio o default) y su
  // pendiente del motor ya no está vivo. Se recalcula en vivo: el check
  // se pone verde apenas el modelador responde.
  const respondida = origen !== "sin-definir" && !pendienteVivo;
  const notaStyle: React.CSSProperties = {
    fontSize: 12.5,
    color: "var(--muted-text, #6e6e76)",
  };

  return (
    <div
      style={{
        border: "1px solid var(--hairline, #e6e2dc)",
        borderRadius: 10,
        padding: abierta ? "12px 14px" : "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        background: "var(--surface-1, #fff)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 14.5,
              fontWeight: 600,
            }}
          >
            {/* Check visual por pregunta: verde si está respondida (aunque
                sea por default del paso), ámbar si falta — mismo lenguaje
                que los chips de pasos del header. */}
            <span
              aria-hidden
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 14,
                height: 14,
                borderRadius: "50%",
                flexShrink: 0,
                ...(respondida
                  ? { background: "#22a06b", color: "#fff" }
                  : {
                      background:
                        "color-mix(in srgb, #b7791f 14%, transparent)",
                      border: "1px solid #d8b671",
                    }),
              }}
            >
              {respondida ? (
                <CheckIcon className="size-2.5" strokeWidth={3.2} />
              ) : null}
            </span>
            {opcion.pregunta}
          </div>
          {!abierta ? (
            <div style={{ ...notaStyle, marginTop: 2, marginLeft: 21 }}>
              {resumen}
              {badge ? (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 11,
                    color:
                      origen === "sin-definir" ? "#8a6d3b" : "#7a7a80",
                  }}
                >
                  · {badge}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="btn"
          style={{ fontSize: 12, whiteSpace: "nowrap" }}
          onClick={() => setAbierta(!abierta)}
        >
          {abierta ? "Listo" : "Cambiar"}
        </button>
      </div>
      {abierta ? (
        <>
          {opcion.ayuda ? (
            <div style={notaStyle}>
              {typeof opcion.ayuda === "function"
                ? opcion.ayuda(ctx)
                : opcion.ayuda}
            </div>
          ) : null}
          <ControlGuiado
            opcion={opcion}
            ctx={ctx}
            onAplicar={onAplicar}
            renderComponente={renderComponente}
          />
        </>
      ) : null}
    </div>
  );
}

/** Caja de control del eje: 34px, borde fino, el mismo alto para todos. */
const CAJA_EJE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: 34,
  border: "1px solid var(--hairline, #e5e2db)",
  borderRadius: 7,
  background: "var(--surface, #fff)",
  padding: "0 9px",
  gap: 6,
};

function ControlGuiado({
  opcion,
  ctx,
  onAplicar,
  renderComponente,
  variante,
}: {
  opcion: OpcionPaso;
  ctx: ContextoOpcion;
  onAplicar: (patch: PatchOpcion) => void;
  renderComponente: (id: string) => React.ReactNode;
  /** "eje" = adentro de una card de eje: controles compactos y alineados. */
  variante?: "eje";
}) {
  const control = opcion.control;
  const enEje = variante === "eje";

  // Segmented: dos o tres opciones excluyentes que en el eje se leen mejor
  // como un solo control que como botones sueltos.
  if (control.tipo === "pills" && enEje && control.presentacion === "tarjetas") {
    // Tarjetas con radio: una decisión importante (quién elige el material),
    // no un toggle de pasada. Como la bifurcación del tiempo.
    const actual = control.valor(ctx);
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 8,
        }}
      >
        {control.opciones(ctx).map((op) => {
          const activa = actual === op.value;
          return (
            <button
              key={op.value}
              type="button"
              onClick={() => onAplicar(control.aplicar(ctx, op.value))}
              style={{
                textAlign: "left",
                borderRadius: 8,
                padding: "7px 10px",
                background: "var(--surface, #fff)",
                border: activa
                  ? "1.5px solid var(--fg, #14141a)"
                  : "1px solid var(--hairline, #e5e2db)",
                cursor: "pointer",
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              <span
                aria-hidden
                style={{
                  marginTop: 1,
                  width: 13,
                  height: 13,
                  borderRadius: "50%",
                  flexShrink: 0,
                  border: activa
                    ? "4px solid var(--fg, #14141a)"
                    : "1px solid var(--hairline-strong, #c8c4ba)",
                }}
              />
              <span style={{ minWidth: 0 }}>
                <span
                  style={{ display: "block", fontSize: 12.5, fontWeight: 500 }}
                >
                  {op.label}
                </span>
                {op.descripcion ? (
                  <span
                    style={{
                      display: "block",
                      fontSize: 11,
                      color: "var(--muted-text, #6e6e76)",
                      marginTop: 1,
                      lineHeight: 1.3,
                    }}
                  >
                    {op.descripcion}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (control.tipo === "pills" && enEje) {
    const actual = control.valor(ctx);
    return (
      <div
        style={{
          display: "inline-flex",
          background: "var(--surface-2, #f3f1ec)",
          border: "1px solid var(--hairline, #e5e2db)",
          borderRadius: 8,
          padding: 2.5,
          gap: 2,
          width: "fit-content",
          maxWidth: "100%",
          flexWrap: "wrap",
        }}
      >
        {control.opciones(ctx).map((op) => {
          const activa = actual === op.value;
          return (
            <button
              key={op.value}
              type="button"
              title={op.descripcion}
              onClick={() => onAplicar(control.aplicar(ctx, op.value))}
              style={{
                border: 0,
                background: activa ? "var(--fg, #14141a)" : "transparent",
                color: activa ? "#fff" : "var(--muted-text, #6e6e76)",
                padding: "5.5px 11px",
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {op.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (control.tipo === "numero" && enEje) {
    const valor = control.valor(ctx) ?? 0;
    const min = control.min ?? 0;
    const max = control.max ?? Number.MAX_SAFE_INTEGER;
    if (control.stepper) {
      const paso = (delta: number) =>
        onAplicar(
          control.aplicar(ctx, Math.min(max, Math.max(min, valor + delta))),
        );
      const botonStyle: React.CSSProperties = {
        width: 32,
        height: "100%",
        border: 0,
        background: "var(--surface-2, #fafaf9)",
        fontSize: 15,
        lineHeight: 1,
        color: "var(--muted-text, #6e6e76)",
        cursor: "pointer",
      };
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: 34,
            width: 118,
            border: "1px solid var(--hairline, #e5e2db)",
            borderRadius: 7,
            overflow: "hidden",
            background: "var(--surface, #fff)",
          }}
        >
          <button
            type="button"
            aria-label="Uno menos"
            style={botonStyle}
            onClick={() => paso(-(control.step ?? 1))}
          >
            −
          </button>
          <input
            value={valor}
            inputMode="numeric"
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) {
                onAplicar(control.aplicar(ctx, Math.min(max, Math.max(min, n))));
              }
            }}
            style={{
              flex: 1,
              minWidth: 0,
              border: 0,
              outline: 0,
              textAlign: "center",
              fontSize: 13,
              fontVariantNumeric: "tabular-nums",
              background: "transparent",
            }}
          />
          <button
            type="button"
            aria-label="Uno más"
            style={botonStyle}
            onClick={() => paso(control.step ?? 1)}
          >
            +
          </button>
        </div>
      );
    }
    return (
      <div style={{ ...CAJA_EJE, maxWidth: 200 }}>
        <input
          value={valor}
          inputMode="decimal"
          placeholder={control.placeholder?.(ctx)}
          onChange={(e) => {
            const n = Number(e.target.value);
            onAplicar(
              control.aplicar(ctx, e.target.value === "" || !Number.isFinite(n) ? null : n),
            );
          }}
          style={{
            border: 0,
            outline: 0,
            background: "transparent",
            width: "100%",
            minWidth: 0,
            fontSize: 13,
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
          }}
        />
        {control.sufijo ? (
          <span
            style={{
              fontSize: 11,
              color: "var(--muted-text-2, #92929b)",
              whiteSpace: "nowrap",
            }}
          >
            {control.sufijo(ctx)}
          </span>
        ) : null}
      </div>
    );
  }

  if (control.tipo === "texto") {
    return (
      <Input
        value={control.valor(ctx)}
        placeholder={control.placeholder?.(ctx)}
        onChange={(e) => onAplicar(control.aplicar(ctx, e.target.value))}
      />
    );
  }
  if (control.tipo === "pills") {
    const actual = control.valor(ctx);
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {control.opciones(ctx).map((op) => (
          <Button
            key={op.value}
            type="button"
            size="sm"
            variant={actual === op.value ? "default" : "outline"}
            onClick={() => onAplicar(control.aplicar(ctx, op.value))}
          >
            {op.label}
          </Button>
        ))}
      </div>
    );
  }
  if (control.tipo === "select") {
    return (
      <HumanSelect
        value={control.valor(ctx)}
        onValueChange={(v) => onAplicar(control.aplicar(ctx, v))}
        options={control.opciones(ctx).map((op) => ({
          value: op.value,
          label: op.label,
          description: op.descripcion,
        }))}
      />
    );
  }
  if (control.tipo === "toggles") {
    const activos = new Set(control.activos(ctx));
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {control.opciones(ctx).map((op) => (
          <Button
            key={op.value}
            type="button"
            size="sm"
            variant={activos.has(op.value) ? "default" : "outline"}
            onClick={() => {
              const proximos = activos.has(op.value)
                ? [...activos].filter((v) => v !== op.value)
                : [...activos, op.value];
              onAplicar(control.aplicar(ctx, proximos));
            }}
          >
            {op.label}
          </Button>
        ))}
      </div>
    );
  }
  if (control.tipo === "numero") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Input
          type="number"
          min={control.min}
          step={control.step}
          value={control.valor(ctx) ?? ""}
          placeholder={control.placeholder?.(ctx)}
          onChange={(e) =>
            onAplicar(
              control.aplicar(
                ctx,
                e.target.value === "" ? null : Number(e.target.value),
              ),
            )
          }
          style={{ maxWidth: 160 }}
        />
        {control.sufijo ? (
          <span
            style={{ fontSize: 12.5, color: "var(--muted-text, #6e6e76)" }}
          >
            {control.sufijo(ctx)}
          </span>
        ) : null}
      </div>
    );
  }
  if (control.tipo === "componente") {
    return <>{renderComponente(control.id)}</>;
  }
  return null;
}

// ─── E.3.2 v2 — Asistente guiado FLOTANTE (paridad con el detallado) ───
// Sheet como el wizard de pasos: recorre la ruta paso a paso y muestra las
// question-cards del motor de pendientes APILADAS (no desaparecen al
// resolverse: quedan con ✓ y se pueden seguir editando — feedback del
// usuario sobre las candidatas). Guarda cada paso al avanzar. El objetivo
// es paridad total con el modo detallado para poder reemplazarlo.

interface PasoAsistente {
  id: string;
  nombre: string;
  familiaCodigo: string;
  esExtra: boolean;
  orden: number | null;
  /** Modo de activación efectivo (config → default de familia). Lo usa el
   *  arrastre para no ofrecer obligatorios/no-ejecutar como destinos. */
  modoActivacion?: string | null;
}

/** Las secciones-pregunta del ESQUEMA para UN paso, con su tarjeta de
 *  estado final. Es el CUERPO compartido de las dos presentaciones
 *  guiadas: el asistente flotante (Sheet) y la vista expandida del
 *  editor (toggle Detallado/Guiado). Una fuente, dos shells. */
function SeccionesEsquemaPaso({
  configuracionBase = false,
  pasoActual,
  cfg,
  configs,
  familia,
  pasos,
  familiasMap,
  lookups,
  jsonTexts,
  vivos,
  onPatch,
  onParams,
  onHerencia,
  onAddSlotFamilia,
  reglaProps,
  updateTiempoManualConfig,
  updateModoColorConfig,
  toggleMaquinaCandidata,
  setMaquinaCandidataPreferida,
  setMaquinaCandidataPerfilDefault,
  setMaquinaCandidataModoColorAllowed,
  setMaquinaCandidataPerfilPorModo,
  setCoberturaPaso,
  materialesApi,
  nestingApi,
  panelEditorPasoId,
  setPanelEditorPasoId,
  panelMeasures,
}: {
  configuracionBase?: boolean;
  pasoActual: PasoAsistente;
  cfg: UpsertConfigPasoPayload;
  configs: Record<string, UpsertConfigPasoPayload>;
  familia: FamiliaListItem | undefined;
  pasos: PasoAsistente[];
  familiasMap: Map<string, FamiliaListItem>;
  lookups: LookupsConfigPaso;
  jsonTexts: Record<string, { params: string; mecanismo: string }>;
  vivos: PendientePaso[];
  onPatch: (pasoId: string, patch: Partial<UpsertConfigPasoPayload>) => void;
  onParams: (pasoId: string, patch: Record<string, unknown>) => void;
  onHerencia: (pasoId: string, sel: SeleccionHerencia | null) => void;
  onAddSlotFamilia: (pasoId: string, slotCodigo: string) => void;
  reglaProps: {
    includeMeasureFields: boolean;
    extraFields: RuleFieldDefinition[];
  };
  updateTiempoManualConfig: (
    pasoId: string,
    patch: Record<string, unknown>,
  ) => void;
  updateModoColorConfig: (
    pasoId: string,
    patch: Record<string, unknown>,
  ) => void;
  toggleMaquinaCandidata: (
    pasoId: string,
    maquinaId: string,
    checked: boolean,
  ) => void;
  setMaquinaCandidataPreferida: (pasoId: string, maquinaId: string) => void;
  setMaquinaCandidataPerfilDefault: (
    pasoId: string,
    maquinaId: string,
    perfilId: string | null,
  ) => void;
  setMaquinaCandidataModoColorAllowed: (
    pasoId: string,
    maquinaId: string,
    modes: string[],
  ) => void;
  setMaquinaCandidataPerfilPorModo: (
    pasoId: string,
    maquinaId: string,
    modo: string,
    perfilId: string | null,
  ) => void;
  setCoberturaPaso: (pasoId: string, nivel: string) => void;
  materialesApi: MaterialesApiAsistente;
  nestingApi: NestingApi;
  panelEditorPasoId: string | null;
  setPanelEditorPasoId: React.Dispatch<React.SetStateAction<string | null>>;
  panelMeasures: ReturnType<typeof getProductoPanelMeasures>;
}) {
  const notaStyle: React.CSSProperties = {
    fontSize: 12.5,
    color: "var(--muted-text, #6e6e76)",
  };
  const cardStyle: React.CSSProperties = {
    border: "1px solid var(--hairline, #e6e2dc)",
    borderRadius: 12,
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  };
  return (
    <>
      {/* Editor declarativo: Activación (A) + Tiempo y costo +
          Máquina y perfil (B) salen del ESQUEMA — completas, con
          abierto/colapsado/Cambiar. Las cards de abajo son
          transicionales hasta migrar materiales y tercerización
          (C-D). */}
      {(() => {
        const ctx = {
          cfg,
          familia,
          paramsPaso: asRecord(cfg.paramsPasoJson),
          otrosPasos: pasos
            .filter((p) => p.id !== pasoActual.id)
            .map((p) => ({
              id: p.id,
              nombre: p.nombre,
              modoActivacion: p.modoActivacion ?? null,
              orden: p.orden,
              // Outputs geométricos SÓLO de pasos anteriores (aguas arriba): la
              // fuente de medida del montaje mide algo ya publicado. Paridad
              // con el detallado (docs/fuente-de-medida-de-consumo-diseno.md §6).
              outputsGeometricos:
                p.orden != null &&
                pasoActual.orden != null &&
                p.orden < pasoActual.orden
                  ? (familiasMap.get(p.familiaCodigo)?.outputsGeometricos ?? [])
                  : [],
            })),
          // Los lookups del API traen `materiasPrimas` VACÍO (la búsqueda es
          // on-demand): los resúmenes del esquema no podían NOMBRAR el
          // material fijo y caían al opaco "Material definido" (H17). Se
          // completan con los materiales ya hidratados de los slots.
          lookups: {
            ...lookups,
            materiasPrimas: Object.values(materialesApi.candidateMaterials),
          },
        };
        const pendientesVivos = new Set(vivos.map((pend) => pend.tipo));
        const onAplicar = (patch: PatchOpcion) => {
          if (patch.tipo === "config") onPatch(pasoActual.id, patch.patch);
          else if (patch.tipo === "config-y-params") {
            // Atómico para la UI: ambos handlers usan setState funcional,
            // así que componen sin pisarse (bifurcación Fijo↔Ritmo).
            onPatch(pasoActual.id, patch.config);
            onParams(pasoActual.id, patch.params);
          } else onParams(pasoActual.id, patch.patch);
        };
        const maquinasCompatibles = lookups.maquinas.filter((m) =>
          maquinaCompatibleConFamilia(
            familia,
            familia?.plantillasCompatibles,
            m,
          ),
        );
        const maquinaSel =
          lookups.maquinas.find((m) => m.id === cfg.maquinaM1Id) ?? null;
        const renderComponente = (id: string): React.ReactNode => {
          if (id === "centro-productivo") {
            // Con máquina: el centro lo pone ella → se muestra read-only en vez
            // de esconder la sección "Dónde se hace". Sin máquina: el selector.
            if (cfg.maquinaM1Id) {
              const centro = maquinaSel?.centroCostoPrincipal?.nombre;
              return (
                <div
                  title="El centro lo define la máquina del paso"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    height: 34,
                    maxWidth: "100%",
                    padding: "0 10px",
                    border: "1px dashed var(--border-strong, #c8c4ba)",
                    borderRadius: 7,
                    background: "var(--surface-2, #fafaf9)",
                    fontSize: 12.5,
                    color: "var(--fg, #14141a)",
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      color: "var(--muted-text-2, #92929b)",
                      flexShrink: 0,
                    }}
                  >
                    <rect x="3" y="8" width="18" height="12" rx="2" />
                    <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M12 12v4" />
                  </svg>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {centro ?? "Sin centro en la máquina"}
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontFamily: "var(--font-mono, ui-monospace)",
                      color: "var(--muted-text-2, #92929b)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    lo pone la máquina
                  </span>
                </div>
              );
            }
            return (
              <HumanSelect
                value={cfg.centroCostoId ?? ""}
                onValueChange={(v) =>
                  onPatch(pasoActual.id, { centroCostoId: v || null })
                }
                options={lookups.centrosCosto.map((c) => ({
                  value: c.id,
                  label: c.nombre,
                }))}
                placeholder={
                  lookups.centrosCosto.length === 0
                    ? "No hay centros"
                    : "Elegir centro"
                }
              />
            );
          }
          if (id === "regla-condicional") {
            return (
              <RuleBuilder
                value={
                  cfg.condicionActivacionJson as
                    | Record<string, unknown>
                    | null
                    | undefined
                }
                includeMeasureFields={reglaProps.includeMeasureFields}
                extraFields={reglaProps.extraFields}
                onChange={(value) =>
                  onPatch(pasoActual.id, {
                    condicionActivacionJson: value,
                  })
                }
              />
            );
          }
          if (id === "activacion-modo") {
            const modo = cfg.modoActivacion ?? "OBLIGATORIO";
            const ofrecidos = modosActivacionOfrecidos(ctx);
            const normales = ofrecidos.filter((m) => m !== "NO_EJECUTAR");
            const apaga = ofrecidos.includes("NO_EJECUTAR");
            const botonModo = (m: string, apagado = false) => {
              const activo = modo === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onPatch(pasoActual.id, { modoActivacion: m })}
                  style={{
                    border: 0,
                    background: activo
                      ? apagado
                        ? "#5c5c66"
                        : "var(--fg, #14141a)"
                      : "transparent",
                    color: activo ? "#fff" : "var(--muted-text, #6e6e76)",
                    padding: "6px 12px",
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 500,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {configuracionBase && m === "NO_EJECUTAR"
                    ? "No usar por defecto"
                    : (MODO_ACTIVACION_LABELS[m] ?? m)}
                </button>
              );
            };
            return (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 9 }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    background: "var(--surface-2, #f3f1ec)",
                    border: "1px solid var(--hairline, #e5e2db)",
                    borderRadius: 8,
                    padding: 2.5,
                    gap: 2,
                    width: "fit-content",
                    maxWidth: "100%",
                    flexWrap: "wrap",
                  }}
                >
                  {normales.map((m) => botonModo(m))}
                  {/* "No se usa acá" no es un modo más: apaga el paso. Va
                      separado y en gris, para que no se elija de pasada. */}
                  {apaga ? (
                    <span
                      aria-hidden
                      style={{
                        width: 1,
                        background: "var(--hairline, #e5e2db)",
                        margin: "4px 4px",
                      }}
                    />
                  ) : null}
                  {apaga ? botonModo("NO_EJECUTAR", true) : null}
                </div>
                {/* Sin frase-consecuencia debajo: con las etiquetas nuevas
                    (Siempre/Opcional/Condicional/Omitir) los botones se
                    explican solos (feedback del usuario). */}
              </div>
            );
          }
          if (id === "co-ejecucion") {
            const requeridos = cfg.requiereRutaPasoIds ?? [];
            // Sólo destinos que el arrastre puede encender de verdad:
            // un OBLIGATORIO corre igual se lo tilde o no, y un NO_EJECUTAR
            // nunca corre (feedback del usuario). Las selecciones legacy
            // sobre pasos hoy-obligatorios se muestran para poder destildar.
            const otros = pasos.filter(
              (p) =>
                p.id !== pasoActual.id &&
                (requeridos.includes(p.id) ||
                  p.modoActivacion == null ||
                  (p.modoActivacion !== "OBLIGATORIO" &&
                    p.modoActivacion !== "NO_EJECUTAR")),
            );
            const corresSiempre =
              (cfg.modoActivacion ?? "OBLIGATORIO") === "OBLIGATORIO";
            return (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 9 }}
              >
                {/* El encabezado lo dibuja el control y no el grupo: el
                    contador y el "Ninguno" van en esa misma línea. */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 9,
                    marginBottom: -1,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                      Enciende también estos pasos
                    </div>
                    {/* Un paso obligatorio arrastra igual (el motor lo trata
                        como activo), y eso vuelve obligatorio de hecho al
                        arrastrado. Se avisa en vez de esconder la pregunta. */}
                    <div
                      style={{
                        fontSize: 11.5,
                        marginTop: 2,
                        maxWidth: "70ch",
                        color: corresSiempre
                          ? "#9a6a11"
                          : "var(--muted-text, #6e6e76)",
                      }}
                    >
                      {corresSiempre
                        ? "Como este paso corre siempre, los que arrastre van a correr siempre también."
                        : "Cuando este paso se activa, prende los que elijas — aunque sean opcionales."}
                    </div>
                  </div>
                  {/* Sin seleccionados no hay contador ni "ninguno": la
                      palabra quedaba colgada en la UI (feedback usuario). */}
                  {requeridos.length > 0 ? (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--muted-text-2, #92929b)",
                        whiteSpace: "nowrap",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {`${requeridos.length} de ${otros.length}`}
                    </span>
                  ) : null}
                  {requeridos.length > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        onPatch(pasoActual.id, { requiereRutaPasoIds: [] })
                      }
                      style={{
                        marginLeft: "auto",
                        border: 0,
                        background: "none",
                        padding: 0,
                        fontSize: 11.5,
                        color: "var(--muted-text, #6e6e76)",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Ninguno
                    </button>
                  ) : null}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {otros.map((p) => {
                    const elegido = requeridos.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={elegido}
                        onClick={() =>
                          onPatch(pasoActual.id, {
                            requiereRutaPasoIds: elegido
                              ? requeridos.filter((id2) => id2 !== p.id)
                              : [...requeridos, p.id],
                          })
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          height: 30,
                          padding: "0 11px",
                          borderRadius: 7,
                          fontSize: 12.5,
                          cursor: "pointer",
                          background: elegido
                            ? "var(--fg, #14141a)"
                            : "var(--surface, #fff)",
                          border: `1px solid ${elegido ? "var(--fg, #14141a)" : "var(--hairline, #e5e2db)"}`,
                          color: elegido ? "#fff" : "var(--fg-2, #2c2c33)",
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            width: 13,
                            height: 13,
                            borderRadius: 4,
                            flexShrink: 0,
                            display: "grid",
                            placeItems: "center",
                            background: elegido ? "#fff" : "transparent",
                            border: `1.5px solid ${elegido ? "#fff" : "var(--hairline-strong, #c8c4ba)"}`,
                            color: "var(--fg, #14141a)",
                          }}
                        >
                          {elegido ? (
                            <CheckIcon className="size-2" strokeWidth={4} />
                          ) : null}
                        </span>
                        {p.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }
          if (id === "tiempo-fijo-valor") {
            // El VALOR del tiempo fijo — un solo concepto para los dos
            // storages históricos (árbol de tiempo, F0.3).
            return (
              <TiempoFijoValorEditor
                pasoId={pasoActual.id}
                cfg={cfg}
                familia={familia}
                onPatch={onPatch}
                onParams={onParams}
              />
            );
          }
          if (id === "tiempo-maquina-panel") {
            // ① = máquina → panel que explica (perfil o primitiva), cero
            // perillas. Patrón "Lo decide la geometría" de materiales.
            return (
              <TiempoMaquinaPanel
                cfg={cfg}
                familia={familia}
                maquina={maquinaSel}
              />
            );
          }
          if (id === "ritmo-productividad" || id === "ritmo-batch") {
            // El "fijo" ya no vive acá: subió a tiempo-fijo-valor (la
            // pregunta ② del árbol) — estas preguntas sólo aparecen en RITMO.
            return (
              <RitmoGuiado
                variante={id === "ritmo-batch" ? "batch" : "productividad"}
                pasoId={pasoActual.id}
                cfg={cfg}
                familia={familia}
                onParams={onParams}
                pasos={pasos}
                familiasMap={familiasMap}
                jsonTexts={jsonTexts}
                onPatch={onPatch}
                onHerencia={onHerencia}
              />
            );
          }
          if (id === "cantidad-unificada") {
            return (
              <CantidadUnificadaGuiada
                pasoId={pasoActual.id}
                pasos={pasos}
                familia={familia}
                familiasMap={familiasMap}
                jsonTexts={jsonTexts}
                cfg={cfg}
                onPatch={onPatch}
                onHerencia={onHerencia}
              />
            );
          }
          if (id === "herencia-origen") {
            return (
              <HerenciaOrigenGuiada
                pasoId={pasoActual.id}
                pasos={pasos}
                familiasMap={familiasMap}
                jsonTexts={jsonTexts}
                onHerencia={onHerencia}
              />
            );
          }
          if (id === "maquina-m1") {
            return (
              <HumanSelect
                value={cfg.maquinaM1Id ?? ""}
                onValueChange={(id2) => {
                  const maq = maquinasCompatibles.find(
                    (m) => m.id === id2,
                  );
                  onPatch(pasoActual.id, {
                    maquinaM1Id: id2 || null,
                    perfilM1Id: maq?.perfilesOperativos[0]?.id ?? null,
                    centroCostoId: null,
                  });
                }}
                options={maquinasCompatibles.map((m) => ({
                  value: m.id,
                  label: m.nombre,
                }))}
                placeholder="Elegir máquina"
              />
            );
          }
          if (id === "perfil-m1") {
            return (
              <HumanSelect
                value={cfg.perfilM1Id ?? ""}
                onValueChange={(id2) =>
                  onPatch(pasoActual.id, { perfilM1Id: id2 || null })
                }
                options={(maquinaSel?.perfilesOperativos ?? [])
                  .filter((perfil) =>
                    perfilCompatibleConFamilia(familia, perfil),
                  )
                  .map((perfil) => ({
                    value: perfil.id,
                    label: perfil.nombre,
                  }))}
                placeholder="Perfil operativo"
              />
            );
          }
          if (id === "candidatas-detallado") {
            return (
              <CandidatasDetalladoEditor
                pasoId={pasoActual.id}
                cfg={cfg}
                familia={familia}
                lookups={lookups}
                maquinasCandidatasCompatibles={lookups.maquinas.filter(
                  (m) =>
                    maquinaCandidataCompatibleConFamilia(
                      familia,
                      familia?.plantillasCompatibles,
                      m,
                    ),
                )}
                mostrarModoColor={modoColorAplica(familia, cfg)}
                toggleMaquinaCandidata={toggleMaquinaCandidata}
                setMaquinaCandidataPreferida={setMaquinaCandidataPreferida}
                setMaquinaCandidataPerfilDefault={
                  setMaquinaCandidataPerfilDefault
                }
                setMaquinaCandidataPerfilPorModo={
                  setMaquinaCandidataPerfilPorModo
                }
                setMaquinaCandidataModoColorAllowed={
                  setMaquinaCandidataModoColorAllowed
                }
              />
            );
          }
          if (id === "cobertura-toner") {
            const paramsCob = (cfg.paramsPasoJson ?? {}) as Record<
              string,
              unknown
            >;
            const nivelActual =
              typeof paramsCob.coberturaDefault === "string"
                ? paramsCob.coberturaDefault
                : "alta";
            return (
              <HumanSelect
                value={nivelActual}
                onValueChange={(v) =>
                  setCoberturaPaso(pasoActual.id, v || "alta")
                }
                options={NIVELES_COBERTURA.map((nivel) => ({
                  value: nivel,
                  label: NIVEL_COBERTURA_LABELS[nivel],
                }))}
              />
            );
          }
          if (id === "agregar-slot") {
            const configurados = new Set(
              (cfg.slotsMateriales ?? []).map((s) => s.slotCodigo),
            );
            const slotsManuales = (familia?.slotsRequeridos ?? []).filter(
              (s) => !isConsumibleMaquinaSlot(s),
            );
            return (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {slotsManuales
                  .filter((s) => !configurados.has(s.codigo))
                  .map((s) => (
                    <Button
                      key={s.codigo}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onAddSlotFamilia(pasoActual.id, s.codigo)
                      }
                    >
                      + {s.nombre}
                      {s.requerido ? (
                        <span style={{ color: "#c0392b" }}>*</span>
                      ) : null}
                    </Button>
                  ))}
                {familia?.permiteSlotsAdicionales ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      materialesApi.addSlotAdicional(pasoActual.id)
                    }
                  >
                    + Agregar componente
                  </Button>
                ) : null}
              </div>
            );
          }
          if (id === "tercerizado-panel") {
            // Sin onToggle: el "quién lo hace" ya lo maneja el eje Identidad
            // (pills); acá va sólo la config del proveedor, al estilo del diseño.
            return (
              <PasoTercerizadoPanel
                value={cfg}
                esImpresion={familia?.esImpresion === true}
                onChange={(patch) => onPatch(pasoActual.id, patch)}
              />
            );
          }
          if (id === "params-familia") {
            // T4-H15: los parámetros propios de la familia, en el guiado —
            // el mismo componente del detallado (una opción, un editor).
            return familia ? (
              <ParamsFamiliaFields
                familia={familia}
                params={asRecord(cfg.paramsPasoJson)}
                onChange={(patch) => onParams(pasoActual.id, patch)}
              />
            ) : null;
          }
          if (id === "tiempos-extra-paso") {
            // Preparación y traslados: minutos que no dependen de la cantidad,
            // con su propio centro y su propia dotación. Escribe en
            // paramsPasoJson, como los efectos y los params de familia.
            return (
              <TiemposExtraPasoFields
                params={asRecord(cfg.paramsPasoJson)}
                centros={lookups.centrosCosto.map((c) => ({
                  id: c.id,
                  nombre: c.nombre,
                }))}
                centroDelPaso={
                  cfg.maquinaM1Id
                    ? (maquinaSel?.centroCostoPrincipal?.nombre ?? null)
                    : (lookups.centrosCosto.find(
                        (c) => c.id === cfg.centroCostoId,
                      )?.nombre ?? null)
                }
                dotacionDelPaso={cfg.dotacionOperarios ?? 1}
                onChange={(patch) => onParams(pasoActual.id, patch)}
              />
            );
          }
          if (id === "niveles-paso") {
            // Un paso, varias variantes que elige el comercial.
            return (
              <NivelesPasoFields
                params={asRecord(cfg.paramsPasoJson)}
                dotacionDelPaso={cfg.dotacionOperarios ?? 1}
                onChange={(patch) => onParams(pasoActual.id, patch)}
              />
            );
          }
          if (id === "efectos-paso") {
            // [Efectos] Lo que el paso le exige al trabajo. Escribe en
            // paramsPasoJson igual que los params de familia, así el motor
            // lo lee sin una columna nueva.
            return (
              <EfectosPasoFields
                params={asRecord(cfg.paramsPasoJson)}
                onChange={(patch) => onParams(pasoActual.id, patch)}
              />
            );
          }
          if (id === "tiempo-comercial-ayudas") {
            return (
              <TiempoComercialDetalladoEditor
                pasoId={pasoActual.id}
                cfg={cfg}
                familia={familia}
                parte="ayudas"
                updateTiempoManualConfig={updateTiempoManualConfig}
              />
            );
          }
          if (id === "acomodado-detallado") {
            return (
              <div className="pasos-sections">
                <AcomodadoDetalladoEditor
                  pasoId={pasoActual.id}
                  cfg={cfg}
                  familia={familia}
                  lookups={lookups}
                  maquinaParaDefaults={maquinaSel}
                  candidateMaterials={materialesApi.candidateMaterials}
                  panelEditorPasoId={panelEditorPasoId}
                  setPanelEditorPasoId={setPanelEditorPasoId}
                  panelMeasures={panelMeasures}
                  nestingApi={nestingApi}
                  onParams={onParams}
                />
              </div>
            );
          }
          if (id === "modo-color-detallado") {
            const perfilSel =
              maquinaSel?.perfilesOperativos.find(
                (perfil) => perfil.id === cfg.perfilM1Id,
              ) ?? null;
            return (
              <div className="pasos-sections">
                <ModoColorDetalladoEditor
                  pasoId={pasoActual.id}
                  cfg={cfg}
                  modoColorOptions={buildModoColorOptions(
                    maquinaSel,
                    null,
                    familia?.esImpresion === true,
                  )}
                  modoColorPerfilDefault={
                    modosColorFromPerfil(perfilSel)[0] ?? ""
                  }
                  updateModoColorConfig={updateModoColorConfig}
                />
              </div>
            );
          }
          return null;
        };
        const noEjecutar = cfg.modoActivacion === "NO_EJECUTAR";
        return (
          <>
            {/* Sub-fase D: la bifurcación tercerizado va PRIMERA
                (E.2); si la familia la declara aparece colapsada. */}
            <EjeGuiado
              titulo="Información básica"
              subtitulo="Cómo se llama acá y quién lo hace."
              opciones={opcionesDeEje("identidad", ctx).filter(
                (o) => o.clave !== "quien.proveedor",
              )}
              grupos={GRUPOS_EJE.identidad}
              fijo
              resumenPrincipal={["activacion.nombre", "quien.tercerizado"]}
              ctx={ctx}
              pendientesVivos={pendientesVivos}
              onAplicar={onAplicar}
              renderComponente={renderComponente}
            />
            {/* El proveedor: su propia card (no anidada en "Qué paso es").
                Sólo cuando el paso es tercerizado — si no, las opciones filtradas
                quedan vacías y el EjeGuiado no renderiza nada. */}
            <EjeGuiado
              titulo="El proveedor"
              subtitulo="A quién se le compra este paso, cómo cotiza y en cuánto entrega."
              opciones={opcionesDeEje("identidad", ctx).filter(
                (o) => o.clave === "quien.proveedor",
              )}
              grupos={[{ id: "proveedor" }]}
              fijo
              resumenPrincipal={["quien.proveedor"]}
              ctx={ctx}
              pendientesVivos={pendientesVivos}
              onAplicar={onAplicar}
              renderComponente={renderComponente}
            />
            <EjeGuiado
              titulo="Ejecución de este paso"
              subtitulo="Si corre siempre, si es opcional o si depende de una condición del pedido."
              opciones={opcionesDeEje("activacion", ctx)}
              grupos={GRUPOS_EJE.activacion}
              fijo
              resumenPrincipal={["activacion.cuando", "activacion.regla"]}
              ctx={ctx}
              pendientesVivos={pendientesVivos}
              onAplicar={onAplicar}
              renderComponente={renderComponente}
            />
            {/* Tercerizado o apagado: no se produce internamente —
                sin tiempo/costo ni máquina (mismo criterio que el
                detallado congelado). Excepción: tercerizado con
                "materiales propios" sí configura materiales, porque
                salen de nuestro inventario. */}
            {!noEjecutar &&
            (!cfg.tercerizado ||
              (cfg.tercerizadoConfigJson as { materialesPropios?: boolean } | null)
                ?.materialesPropios === true) ? (
              <>
                {/* Dónde se hace: justo después de "Ejecución de este paso"
                    (feedback del usuario). Sólo interno y sin máquina: con
                    máquina el centro lo pone ella y los operarios no aplican. */}
                {!cfg.tercerizado &&
                !cfg.maquinaM1Id &&
                (cfg.maquinasCandidatas?.length ?? 0) === 0 ? (
                  <EjeGuiado
                    titulo="Dónde se hace"
                    subtitulo="El centro que pone la tarifa por hora y los operarios que ejecutan el paso."
                    opciones={opcionesDeEje("tiempo", ctx).filter((o) =>
                      ["tiempo.centro", "tiempo.dotacion"].includes(o.clave),
                    )}
                    grupos={GRUPOS_DONDE}
                    fijo
                    resumenPrincipal={["tiempo.centro", "tiempo.dotacion"]}
                    ctx={ctx}
                    pendientesVivos={pendientesVivos}
                    onAplicar={onAplicar}
                    renderComponente={renderComponente}
                  />
                ) : null}
                {!cfg.tercerizado ? (
                  <EjeGuiado
                    titulo="Máquina que utiliza"
                    subtitulo="Marcá las máquinas que pueden hacer este paso y elegí cuál se usa por defecto."
                    opciones={opcionesDeEje("maquina", ctx)}
                    grupos={GRUPOS_EJE.maquina}
                    fijo
                    resumenPrincipal={[
                      "maquina.maquina",
                      "maquina.candidatas",
                      "maquina.perfil",
                    ]}
                    ctx={ctx}
                    pendientesVivos={pendientesVivos}
                    onAplicar={onAplicar}
                    renderComponente={renderComponente}
                  />
                ) : null}
                {/* Materiales (sub-fase C): agregar a nivel paso + un
                    grupo por slot configurado, cada uno con las
                    preguntas del esquema evaluadas con ese slot. */}
                {/* Encabezado de grupo (sin fondo): cada material es su
                    card debajo. "Agregar componente" agrega un material. */}
                {(() => {
                  const slotsVisibles = (cfg.slotsMateriales ?? []).filter(
                    (sl) => {
                      const d = familia?.slotsRequeridos.find(
                        (sr) => sr.codigo === sl.slotCodigo,
                      );
                      return !(d && isConsumibleMaquinaSlot(d));
                    },
                  );
                  // Sólo si el paso PUEDE consumir materiales (feedback del
                  // usuario): la familia declara slots propios, permite
                  // agregarlos, o hay slots ya configurados. Diseño o
                  // pre-prensa no pueden agregar nada — la card era ruido.
                  const familiaDeclaraMateriales = (
                    familia?.slotsRequeridos ?? []
                  ).some((sr) => !isConsumibleMaquinaSlot(sr));
                  if (
                    !familiaDeclaraMateriales &&
                    familia?.permiteSlotsAdicionales !== true &&
                    slotsVisibles.length === 0
                  ) {
                    return null;
                  }
                  const materialesFaltan = vivos.some(
                    (pnd) => pnd.slotCodigo != null,
                  );
                  return (
                    <>
                      <EncabezadoGrupo
                        titulo="Materiales que consume"
                        conteo={
                          slotsVisibles.length === 1
                            ? "1 componente"
                            : `${slotsVisibles.length} componentes`
                        }
                        descripcion="Un componente por cada tipo de material que gasta el paso: sustrato, tinta, perfilería, chapa. Cada uno define qué se usa, quién lo elige y cuánto se descuenta."
                        resuelto={slotsVisibles.length > 0 && !materialesFaltan}
                      />
                      {/* Los botones para agregar material van FULL-WIDTH debajo
                          del encabezado: como `derecha` (flexShrink:0) aplastaban
                          el título a 1 palabra cuando la familia tiene varios
                          slots (LED). Ya envuelven solos. */}
                      <div style={{ padding: "0 2px 2px" }}>
                        {renderComponente("agregar-slot")}
                      </div>
                    </>
                  );
                })()}
                {(() => {
                  const visiblesSlots = (cfg.slotsMateriales ?? [])
                    .map((slot, slotIdx) => ({ slot, slotIdx }))
                    .filter(({ slot }) => {
                      const d = familia?.slotsRequeridos.find(
                        (sr) => sr.codigo === slot.slotCodigo,
                      );
                      return !(d && isConsumibleMaquinaSlot(d));
                    });
                  if (visiblesSlots.length === 0) return null;
                  return (
                    <div
                      style={{
                        border: "1px solid var(--hairline, #e6e2dc)",
                        borderRadius: 10,
                        overflow: "hidden",
                        background: "var(--surface-1, #fff)",
                      }}
                    >
                      {visiblesSlots.map(({ slot, slotIdx }, filaIdx) => {
                  const decl =
                    familia?.slotsRequeridos.find(
                      (sr) => sr.codigo === slot.slotCodigo,
                    ) ?? null;
                  const ctxSlot = {
                    ...ctx,
                    slot: {
                      payload: slot,
                      decl,
                      esAdicional: !decl,
                    },
                  };
                  const pendSlot = new Set(
                    vivos
                      .filter(
                        (p) =>
                          !p.slotCodigo ||
                          p.slotCodigo === slot.slotCodigo,
                      )
                      .map((p) => p.tipo),
                  );
                  const onAplicarSlot = (patch: PatchOpcion) => {
                    if (patch.tipo === "slot") {
                      materialesApi.updateSlot(
                        pasoActual.id,
                        slotIdx,
                        patch.patch,
                      );
                    } else onAplicar(patch);
                  };
                  const renderComponenteSlot = (
                    id: string,
                  ): React.ReactNode => {
                    if (id === "material-heredado-detallado") {
                      const indiceActual = pasos.findIndex(
                        (candidate) => candidate.id === pasoActual.id,
                      );
                      const opciones = pasos
                        .filter((_, sourceIndex) => sourceIndex < indiceActual)
                        .flatMap((origen) => {
                          const cfgOrigen = configs[origen.id];
                          return (cfgOrigen?.slotsMateriales ?? [])
                            .filter(
                              (sourceSlot) =>
                                sourceSlot.modoSeleccion !== "HEREDA_DE_PASO",
                            )
                            .map((sourceSlot) => ({
                              value: `${origen.id}::${sourceSlot.slotCodigo}`,
                              label: `Hereda de: ${origen.nombre} · ${sourceSlot.slotNombre || sourceSlot.slotCodigo}`,
                            }));
                        });
                      return (
                        <div className="space-y-2">
                          <HumanSelect
                            value={
                              slot.heredaDeRutaPasoId &&
                              slot.heredaDeSlotCodigo
                                ? `${slot.heredaDeRutaPasoId}::${slot.heredaDeSlotCodigo}`
                                : ""
                            }
                            onValueChange={(value) => {
                              const [rutaPasoId, slotCodigo] = value.split("::");
                              materialesApi.updateSlot(
                                pasoActual.id,
                                slotIdx,
                                {
                                  heredaDeRutaPasoId: rutaPasoId || null,
                                  heredaDeSlotCodigo: slotCodigo || null,
                                },
                              );
                            }}
                            options={opciones}
                            placeholder="Elegí un material de un paso anterior"
                          />
                          <p className="text-muted-foreground text-xs">
                            Se usa para formato, nesting y operación; el costo
                            permanece únicamente en el paso de origen.
                          </p>
                        </div>
                      );
                    }
                    if (id === "material-fijo-detallado") {
                      return (
                        <div className="pasos-sections">
                          <MaterialFijoSlotDetalladoEditor
                            pasoId={pasoActual.id}
                            slotIdx={slotIdx}
                            slot={slot}
                            slotDecl={decl}
                            persistedSlot={materialesApi.getPersistedSlot(
                              pasoActual.id,
                              slot.slotCodigo,
                            )}
                            candidateMaterials={
                              materialesApi.candidateMaterials
                            }
                            setCandidateMaterials={
                              materialesApi.setCandidateMaterials
                            }
                            hardcodedMaterialSelections={
                              materialesApi.hardcodedMaterialSelections
                            }
                            setHardcodedMaterialSelections={
                              materialesApi.setHardcodedMaterialSelections
                            }
                            updateSlot={materialesApi.updateSlot}
                          />
                        </div>
                      );
                    }
                    if (id === "candidatos-slot-detallado") {
                      return (
                        <div className="pasos-sections">
                          <CandidatosSlotDetalladoEditor
                            pasoId={pasoActual.id}
                            slotIdx={slotIdx}
                            slot={slot}
                            slotDecl={decl}
                            candidateMaterials={
                              materialesApi.candidateMaterials
                            }
                            addSlotCandidate={
                              materialesApi.addSlotCandidate
                            }
                            removeSlotCandidate={
                              materialesApi.removeSlotCandidate
                            }
                            updateSlotCandidate={
                              materialesApi.updateSlotCandidate
                            }
                          />
                        </div>
                      );
                    }
                    if (id === "base-consumo") {
                      // Plegado dentro de "consumo-formula" (las 3 formas).
                      return null;
                    }
                    if (id === "consumo-formula") {
                      // Opción B: mostrar la fuente inline sólo cuando NO es la
                      // default ("las piezas del trabajo"): en un sustrato común
                      // agregar "de las piezas…" es ruido; en cenefa/bastidor
                      // (fuente = output geométrico) sí aporta.
                      const fuenteLabel =
                        slot.fuenteMedida &&
                        slot.fuenteMedida !== "piezas_jobcontext"
                          ? (opcionesPiezasMontar(ctxSlot).find(
                              (o) => o.value === slot.fuenteMedida,
                            )?.label ?? null)
                          : null;
                      return (
                        <ConsumoReglaGuiado
                          slot={slot}
                          decl={decl}
                          familia={familia}
                          paramsPaso={asRecord(cfg.paramsPasoJson)}
                          esAdicional={!decl}
                          materialLabel={null}
                          magnitudProduceLabel={magnitudProducePaso(
                            cfg,
                            familia,
                          )}
                          fuenteLabel={fuenteLabel}
                          onSlotPatch={(patch) =>
                            materialesApi.updateSlot(
                              pasoActual.id,
                              slotIdx,
                              patch,
                            )
                          }
                        />
                      );
                    }
                    return renderComponente(id);
                  };
                  return (
                    <div
                      key={`${slot.slotCodigo}:${slotIdx}`}
                      style={{
                        borderTop:
                          filaIdx > 0
                            ? "1px solid var(--hairline, #eee7de)"
                            : undefined,
                      }}
                    >
                      <EjeGuiado
                        titulo={
                          familia
                            ? slotDisplayName(slot, familia)
                            : (slot.slotNombre ?? slot.slotCodigo)
                        }
                        opciones={opcionesDeMaterial(ctxSlot)}
                        grupos={GRUPOS_MATERIAL}
                        resumenPrincipal={[
                          "materiales.material",
                          "materiales.candidatos",
                          "materiales.quien",
                          "materiales.consumo",
                        ]}
                        ctx={ctxSlot}
                        pendientesVivos={pendSlot}
                        onAplicar={onAplicarSlot}
                        renderComponente={renderComponenteSlot}
                        ocultarCheck
                        enLista
                        accionExtra={
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              materialesApi.removeSlot(pasoActual.id, slotIdx)
                            }
                          >
                            <Trash2Icon className="size-3.5" />
                            Quitar
                          </Button>
                        }
                      />
                    </div>
                  );
                      })}
                    </div>
                  );
                })()}
                {/* Acomodo · Parámetros del oficio · Efectos — "El trabajo" se
                    disolvió en tres secciones de un solo concepto; cada una
                    filtra el eje "trabajo" por clave y se auto-oculta con 0
                    opciones (EjeGuiado devuelve null). Van DESPUÉS de Materiales
                    y ANTES de Tiempo: el acomodo define cuántas piezas entran, y
                    de ahí sale la cantidad que el tiempo multiplica (H-2). El
                    estado vacío se quitó (su "agregar material" era redundante
                    con "Agregar componente" de Materiales).
                    Ver docs/editor-pasos-preguntas-orden.md §10. */}
                {cfg.tercerizado ? null : (
                  <>
                    <EjeGuiado
                      titulo="Nesting"
                      subtitulo="Cómo se acomodan y aprovechan las piezas en el material."
                      opciones={opcionesDeEje("trabajo", ctx).filter(
                        (o) => o.clave === "oficio.acomodado",
                      )}
                      grupos={GRUPOS_EJE.trabajo}
                      fijo
                      resumenPrincipal={["oficio.acomodado"]}
                      ctx={ctx}
                      pendientesVivos={pendientesVivos}
                      onAplicar={onAplicar}
                      renderComponente={renderComponente}
                    />
                    <EjeGuiado
                      titulo="Parámetros del oficio"
                      subtitulo="Los números propios de este oficio que el motor usa para calcular el paso."
                      opciones={opcionesDeEje("trabajo", ctx).filter(
                        (o) => o.clave === "oficio.params_familia",
                      )}
                      grupos={GRUPOS_EJE.trabajo}
                      fijo
                      resumenPrincipal={["oficio.params_familia"]}
                      ctx={ctx}
                      pendientesVivos={pendientesVivos}
                      onAplicar={onAplicar}
                      renderComponente={renderComponente}
                    />
                    <EjeGuiado
                      titulo="Efectos"
                      subtitulo="Lo que el paso le exige al trabajo: material extra para agarre, envoltura o refilado."
                      opciones={opcionesDeEje("trabajo", ctx).filter(
                        (o) => o.clave === "oficio.efectos",
                      )}
                      grupos={GRUPOS_EJE.trabajo}
                      fijo
                      resumenPrincipal={["oficio.efectos"]}
                      ctx={ctx}
                      pendientesVivos={pendientesVivos}
                      onAplicar={onAplicar}
                      renderComponente={renderComponente}
                    />
                  </>
                )}
                {/* Tiempo que consume: ÚLTIMO — depende de todo lo anterior (el
                    ritmo sale del perfil de la máquina, la cantidad del
                    acomodado). */}
                {!cfg.tercerizado ? (
                  <EjeGuiado
                    titulo="Tiempo que consume"
                    subtitulo={
                      (cfg.modoTiempo ??
                        familia?.modosTiempoSoportados?.[0]) === "T-3"
                        ? "El tiempo lo define la máquina con el perfil operativo que use en cada trabajo."
                        : "Cómo se calcula el tiempo de este paso, y si el comercial puede ajustarlo al cotizar."
                    }
                    opciones={opcionesDeEje("tiempo", ctx).filter(
                      (o) =>
                        !["tiempo.centro", "tiempo.dotacion"].includes(o.clave),
                    )}
                    grupos={GRUPOS_EJE.tiempo}
                    fijo
                    resumenPrincipal={[
                      "tiempo.productividad",
                      "tiempo.fijo_valor",
                      "tiempo.cantidad_operativa",
                    ]}
                    ctx={ctx}
                    pendientesVivos={pendientesVivos}
                    onAplicar={onAplicar}
                    renderComponente={renderComponente}
                  />
                ) : null}

              </>
            ) : null}
          </>
        );
      })()}

      {/* Sin card de cierre "✓ Listo para cotizar" (feedback del usuario):
          el estado ya vive en el sidebar por paso, y el texto no agregaba
          nada configurable. La card de FALTANTES sí queda — apunta a las
          preguntas en ámbar cuando hay bloqueantes. */}
      {vivos.filter((pend) => pend.bloqueante).length > 0 ? (
        <div style={cardStyle}>
          <div style={{ fontSize: 15, fontWeight: 650, color: "#8a6d3b" }}>
            {resumenPendientes(vivos)}
          </div>
          <div style={notaStyle}>
            Las preguntas marcadas en ámbar arriba son las que faltan.
          </div>
        </div>
      ) : null}
    </>
  );
}


function AsistenteGuiado({
  pasos,
  configs,
  familiasMap,
  lookups,
  jsonTexts,
  onPatch,
  onParams,
  onHerencia,
  onAddSlotFamilia,
  onGuardarPaso,
  guardando,
  tieneCambios,
  reglaProps,
  updateTiempoManualConfig,
  updateModoColorConfig,
  toggleMaquinaCandidata,
  setMaquinaCandidataPreferida,
  setMaquinaCandidataPerfilDefault,
  setMaquinaCandidataModoColorAllowed,
  setMaquinaCandidataPerfilPorModo,
  setCoberturaPaso,
  materialesApi,
  nestingApi,
  panelEditorPasoId,
  setPanelEditorPasoId,
  panelMeasures,
  onCerrar,
}: {
  pasos: PasoAsistente[];
  configs: Record<string, UpsertConfigPasoPayload>;
  familiasMap: Map<string, FamiliaListItem>;
  lookups: LookupsConfigPaso;
  jsonTexts: Record<string, { params: string; mecanismo: string }>;
  onPatch: (pasoId: string, patch: Partial<UpsertConfigPasoPayload>) => void;
  onParams: (pasoId: string, patch: Record<string, unknown>) => void;
  onHerencia: (pasoId: string, sel: SeleccionHerencia | null) => void;
  onAddSlotFamilia: (pasoId: string, slotCodigo: string) => void;
  onGuardarPaso: (pasoId: string) => Promise<void>;
  guardando: string | null;
  tieneCambios: (pasoId: string) => boolean;
  reglaProps: {
    includeMeasureFields: boolean;
    extraFields: RuleFieldDefinition[];
  };
  updateTiempoManualConfig: (
    pasoId: string,
    patch: Record<string, unknown>,
  ) => void;
  updateModoColorConfig: (
    pasoId: string,
    patch: Record<string, unknown>,
  ) => void;
  toggleMaquinaCandidata: (
    pasoId: string,
    maquinaId: string,
    checked: boolean,
  ) => void;
  setMaquinaCandidataPreferida: (pasoId: string, maquinaId: string) => void;
  setMaquinaCandidataPerfilDefault: (
    pasoId: string,
    maquinaId: string,
    perfilId: string | null,
  ) => void;
  setMaquinaCandidataModoColorAllowed: (
    pasoId: string,
    maquinaId: string,
    modes: string[],
  ) => void;
  setMaquinaCandidataPerfilPorModo: (
    pasoId: string,
    maquinaId: string,
    modo: string,
    perfilId: string | null,
  ) => void;
  setCoberturaPaso: (pasoId: string, nivel: string) => void;
  materialesApi: MaterialesApiAsistente;
  nestingApi: NestingApi;
  panelEditorPasoId: string | null;
  setPanelEditorPasoId: React.Dispatch<React.SetStateAction<string | null>>;
  panelMeasures: ReturnType<typeof getProductoPanelMeasures>;
  onCerrar: () => void;
}) {
  const [indice, setIndice] = React.useState(0);
  const pasoActual = pasos[indice];
  const cfg = pasoActual ? configs[pasoActual.id] : undefined;
  const familia = pasoActual
    ? familiasMap.get(pasoActual.familiaCodigo)
    : undefined;

  // Con la sub-fase D todos los pendientes viven en el ESQUEMA: las
  // question-cards transicionales se retiraron; sólo queda el estado
  // vivo para los badges y el cierre "listo para cotizar".
  const vivos = React.useMemo(
    () => (cfg ? pendientesDePaso(cfg, familia) : []),
    [cfg, familia],
  );

  const avanzar = async () => {
    if (!pasoActual) return;
    if (tieneCambios(pasoActual.id)) await onGuardarPaso(pasoActual.id);
    if (indice >= pasos.length - 1) onCerrar();
    else setIndice(indice + 1);
  };

  if (!pasoActual || !cfg) return null;

  return (
    <Sheet open disablePointerDismissal onOpenChange={(o) => !o && onCerrar()}>
      <SheetContent
        className="flex w-full flex-col gap-0"
        style={{ maxWidth: 760 }}
      >
        <SheetHeader
          style={{ padding: "18px 24px 10px", borderBottom: "1px solid var(--hairline, #eee)" }}
        >
          <SheetTitle>Asistente de configuración</SheetTitle>
          <SheetDescription>
            Recorre los pasos de la ruta y pregunta sólo lo que falta; lo que
            el paso ya declara no se vuelve a preguntar.
          </SheetDescription>
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}
          >
            {pasos.map((paso, i) => {
              const pend = pendientesDePaso(
                configs[paso.id],
                familiasMap.get(paso.familiaCodigo),
              );
              const bloq = pend.filter((x) => x.bloqueante).length;
              const completo = bloq === 0;
              return (
                <button
                  key={paso.id}
                  type="button"
                  className="btn"
                  style={{
                    fontSize: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    opacity: i === indice ? 1 : 0.7,
                    fontWeight: i === indice ? 650 : 400,
                  }}
                  onClick={() => setIndice(i)}
                >
                  {/* Badge de completitud: check verde si no quedan
                      pendientes bloqueantes; contador ámbar si faltan. */}
                  <span
                    aria-hidden
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 15,
                      height: 15,
                      borderRadius: "50%",
                      flexShrink: 0,
                      fontSize: 9.5,
                      fontWeight: 700,
                      lineHeight: 1,
                      ...(completo
                        ? {
                            background: "#22a06b",
                            color: "#fff",
                            boxShadow:
                              "0 0 0 2px color-mix(in srgb, #22a06b 22%, transparent)",
                          }
                        : {
                            background:
                              "color-mix(in srgb, #b7791f 14%, transparent)",
                            color: "#8a6d3b",
                            border: "1px solid #d8b671",
                          }),
                    }}
                  >
                    {completo ? (
                      <CheckIcon className="size-2.5" strokeWidth={3.2} />
                    ) : (
                      bloq
                    )}
                  </span>
                  {paso.nombre}
                </button>
              );
            })}
          </div>
        </SheetHeader>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "18px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {pasoActual.nombre}
          </div>

          <SeccionesEsquemaPaso
            pasoActual={pasoActual}
            cfg={cfg}
            configs={configs}
            familia={familia}
            pasos={pasos}
            familiasMap={familiasMap}
            lookups={lookups}
            jsonTexts={jsonTexts}
            vivos={vivos}
            onPatch={onPatch}
            onParams={onParams}
            onHerencia={onHerencia}
            onAddSlotFamilia={onAddSlotFamilia}
            reglaProps={reglaProps}
            updateTiempoManualConfig={updateTiempoManualConfig}
            updateModoColorConfig={updateModoColorConfig}
            toggleMaquinaCandidata={toggleMaquinaCandidata}
            setMaquinaCandidataPreferida={setMaquinaCandidataPreferida}
            setMaquinaCandidataPerfilDefault={setMaquinaCandidataPerfilDefault}
            setMaquinaCandidataModoColorAllowed={
              setMaquinaCandidataModoColorAllowed
            }
            setMaquinaCandidataPerfilPorModo={setMaquinaCandidataPerfilPorModo}
            setCoberturaPaso={setCoberturaPaso}
            materialesApi={materialesApi}
            nestingApi={nestingApi}
            panelEditorPasoId={panelEditorPasoId}
            setPanelEditorPasoId={setPanelEditorPasoId}
            panelMeasures={panelMeasures}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            padding: "14px 24px",
            borderTop: "1px solid var(--hairline, #eee)",
          }}
        >
          <Button
            variant="ghost"
            onClick={() => (indice === 0 ? onCerrar() : setIndice(indice - 1))}
          >
            {indice === 0 ? "Cerrar" : "← Paso anterior"}
          </Button>
          <Button onClick={avanzar} disabled={guardando === pasoActual.id}>
            {guardando === pasoActual.id
              ? "Guardando…"
              : indice >= pasos.length - 1
                ? tieneCambios(pasoActual.id)
                  ? "Guardar y terminar"
                  : "Terminar"
                : tieneCambios(pasoActual.id)
                  ? "Guardar y seguir →"
                  : "Seguir →"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
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
