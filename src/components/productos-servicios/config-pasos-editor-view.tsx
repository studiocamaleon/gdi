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
  SaveIcon,
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
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import { RuleBuilder } from "@/components/productos-servicios/rule-builder";
import {
  upsertConfigPaso,
  type LookupsConfigPaso,
  type UpsertConfigPasoPayload,
  type UpsertSlotMaterialPayload,
} from "@/lib/productos-servicios-api";
import type {
  CatalogoFamilias,
  ProductoDetalle,
  RutaAlternativaDetalle,
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
  validateRuleGroup,
} from "@/lib/rule-builder";
import { getVarianteOptionChips } from "@/lib/materias-primas-variantes-display";

interface Props {
  producto: ProductoDetalle;
  rutaAlternativa: RutaAlternativaDetalle;
  catalogoFamilias: CatalogoFamilias;
  lookups: LookupsConfigPaso;
  embedded?: boolean;
}

type ConfigState = Record<string, UpsertConfigPasoPayload>;
type SavedConfigSnapshots = Record<string, string>;

const MODOS_ACTIVACION = ["OBLIGATORIO", "OPCIONAL", "CONDICIONAL"];
const MODOS_SELECCION = ["HARDCODED", "COMERCIAL_ELIGE", "MOTOR_ELIGE_AUTO"];
const CRITERIOS_AUTO = ["MENOR_COSTO", "MAYOR_APROVECHAMIENTO", "MENOR_CAPACIDAD_QUE_CUMPLA"];
const FORMULAS = [
  "por_unidad_productiva",
  "por_pieza",
  "por_m2",
  "por_metro_lineal",
  "fijo",
];
const NESTING_ALGORITHMS = [
  "auto",
  "shelf-rollo",
  "maxrects-rollo",
  "grid-2d-single",
  "grid-2d-multi",
  "packingsolver-rectangle",
];
const COSTING_STRATEGIES = ["simple", "m2-exact", "consumed-length", "plate-segments"];
const PLIEGO_IMPRESION_PRESETS = [
  { value: "materia_prima", label: "Tamaño materia prima", description: "Usa el ancho y alto del sustrato comprado.", anchoMm: null, altoMm: null },
  { value: "A5", label: "A5", description: "148 × 210 mm", anchoMm: 148, altoMm: 210 },
  { value: "A4", label: "A4", description: "210 × 297 mm", anchoMm: 210, altoMm: 297 },
  { value: "A3", label: "A3", description: "297 × 420 mm", anchoMm: 297, altoMm: 420 },
  { value: "A2", label: "A2", description: "420 × 594 mm", anchoMm: 420, altoMm: 594 },
  { value: "SRA4", label: "SRA4", description: "225 × 320 mm", anchoMm: 225, altoMm: 320 },
  { value: "SRA3", label: "SRA3", description: "320 × 450 mm", anchoMm: 320, altoMm: 450 },
  { value: "carta", label: "Carta", description: "216 × 279 mm", anchoMm: 216, altoMm: 279 },
  { value: "oficio", label: "Oficio", description: "216 × 356 mm", anchoMm: 216, altoMm: 356 },
  { value: "personalizado", label: "Personalizado", description: "Cargar ancho y alto manualmente.", anchoMm: null, altoMm: null },
];
const PLIEGO_IMPRESION_OPTIONS = PLIEGO_IMPRESION_PRESETS.map((preset) => ({
  value: preset.value,
  label: preset.label,
  description: preset.description,
}));
const PANEL_AXIS_OPTIONS = optionsFromLabels(["vertical", "horizontal"], {
  vertical: { label: "Vertical", descripcion: "Divide el ancho de la pieza en paneles." },
  horizontal: { label: "Horizontal", descripcion: "Divide el alto de la pieza en paneles." },
});
const PANEL_DISTRIBUTION_OPTIONS = optionsFromLabels(["equilibrada", "libre"], {
  equilibrada: { label: "Equilibrada", descripcion: "Paneles de tamaño similar." },
  libre: { label: "Libre", descripcion: "Llena cada panel hasta el máximo antes de abrir otro." },
});
const PANEL_WIDTH_INTERPRETATION_OPTIONS = optionsFromLabels(["total", "util"], {
  total: { label: "Ancho total", descripcion: "El máximo incluye solapes." },
  util: { label: "Ancho útil", descripcion: "El máximo se interpreta sin contar solapes." },
});

const NESTING_ALGORITHM_OPTIONS = optionsFromLabels(NESTING_ALGORITHMS, {
  auto: { label: "Automático", descripcion: "El motor elige según la geometría y las piezas." },
  "shelf-rollo": { label: "Rollo", descripcion: "Acomoda piezas sobre rollo de ancho fijo." },
  "maxrects-rollo": { label: "Rollo optimizado", descripcion: "Acomoda piezas mixtas en rollo minimizando el largo consumido." },
  "grid-2d-single": { label: "Grilla simple", descripcion: "Una medida repetida sobre pliego o placa." },
  "grid-2d-multi": { label: "Grilla multi", descripcion: "Varias medidas sobre una o más placas." },
  "packingsolver-rectangle": { label: "PackingSolver Rectangle", descripcion: "Motor profesional para rígidos sobre placa." },
});
const COSTING_STRATEGY_OPTIONS = optionsFromLabels(COSTING_STRATEGIES, {
  simple: { label: "Simple", descripcion: "Usa la fórmula de consumo del slot sin costeo especial." },
  "m2-exact": { label: "m² exactos", descripcion: "Cobra el área útil de las piezas." },
  "consumed-length": { label: "Largo consumido", descripcion: "Cobra placa completa y último tramo proporcional." },
  "plate-segments": { label: "Segmentos de placa", descripcion: "Cobra por escalones de ocupación de la placa." },
});

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
const CRITERIO_AUTO_OPTIONS = optionsFromLabels(CRITERIOS_AUTO, criterioMotorAutoLabels);

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

function perfilCompatibleConFamilia(familiaCodigo: string | undefined, perfil: PerfilLookup | null | undefined) {
  if (!familiaCodigo || !perfil) return true;
  const tipoPerfil = String(perfil.tipoPerfil ?? "").toLowerCase();
  if (familiaCodigo === "plotter_corte") return tipoPerfil === "corte" || tipoPerfil === "mixto";
  if (familiaCodigo === "impresion_por_area") return tipoPerfil === "impresion" || tipoPerfil === "mixto";
  return true;
}

function maquinaCompatibleConFamilia(
  familiaCodigo: string | undefined,
  plantillasCompatibles: string[] | undefined,
  maquina: MaquinaLookup,
) {
  if (!(plantillasCompatibles ?? []).includes(maquina.plantilla)) return false;
  if (familiaCodigo !== "plotter_corte") return true;
  if (String(maquina.plantilla).toUpperCase() !== "IMPRESORA_GRAN_FORMATO_POR_AREA") return true;
  const params = maquina.parametrosTecnicosJson ?? {};
  return (
    params.soportaCorteIntegrado === true &&
    maquina.perfilesOperativos.some((perfil) => perfilCompatibleConFamilia("plotter_corte", perfil))
  );
}

function centroCostoOption(centro: Pick<CentroCostoLookup, "id" | "codigo" | "nombre">): HumanSelectOption {
  return {
    value: centro.id,
    label: centro.nombre,
    code: centro.codigo,
  };
}

function materialVariantOptions(materiasPrimas: MateriaPrimaLookup[]) {
  const options: HumanSelectOption[] = [];
  for (const mp of materiasPrimas) {
    for (const variante of mp.variantes) {
      options.push(materialVariantOption(mp, variante));
    }
  }
  return options;
}

function materialVariantOption(
  mp: Pick<MateriaPrimaLookup, "nombre" | "codigo" | "templateId">,
  variante: VarianteLookup,
): HumanSelectOption {
  const variantDetails = getMaterialVariantAttributeDetails(mp, variante);
  const variantLabel =
    variantDetails.length > 0
      ? variantDetails.map((detail) => `${detail.label}: ${detail.value}`).join(" · ")
      : variante.nombreVariante ?? variante.sku;

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
      precioReferencia: variante.precioReferencia ? Number(variante.precioReferencia) : null,
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
  familia: { slotsRequeridos: Array<{ codigo: string; nombre: string; tipo?: string }> } | undefined,
) {
  if (slotCodigo === "sustrato_principal") return "Sustrato principal";
  return familia?.slotsRequeridos.find((slot) => slot.codigo === slotCodigo)?.nombre ?? humanizeCode(slotCodigo);
}

function isConsumibleMaquinaSlot(slot: { tipo?: string; codigo?: string; slotCodigo?: string }) {
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

function textToJson(text: string): { ok: true; value: Record<string, unknown> | null } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: null };
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: "Debe ser un objeto JSON ({ ... })" };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "JSON inválido" };
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

function getPanelizadoConfig(params: Record<string, unknown> | null | undefined) {
  return asRecord(getNestingConfig(params).panelizado);
}

function getPliegoImpresionConfig(params: Record<string, unknown> | null | undefined) {
  return asRecord(getNestingConfig(params).pliegoImpresion);
}

function getExtraMarginsConfig(params: Record<string, unknown> | null | undefined) {
  return asRecord(getNestingConfig(params).extraMargins);
}

function nestingAplica(familiaCodigo: string | undefined, cfg: UpsertConfigPasoPayload) {
  if (!familiaCodigo) return false;
  if (familiaCodigo === "pre_prensa") return false;
  if (cfg.mecanismoCantidad === "CALCULADO_POR_PASO") return true;
  return ["impresion_por_area", "impresion_por_hoja", "plotter_corte", "laminado"].includes(familiaCodigo);
}

function panelizadoAplica(
  familiaCodigo: string | undefined,
  nestingConfig: Record<string, unknown>,
  maquina: { parametrosTecnicosJson?: Record<string, unknown> | null } | null | undefined,
) {
  if (!familiaCodigo || !["impresion_por_area", "plotter_corte"].includes(familiaCodigo)) {
    return false;
  }
  const algorithm = String(nestingConfig.algorithm ?? "auto");
  if (algorithm !== "auto" && algorithm !== "shelf-rollo" && algorithm !== "maxrects-rollo") return false;
  const geometria = String(asRecord(maquina?.parametrosTecnicosJson).geometria ?? "").toUpperCase();
  return familiaCodigo === "plotter_corte" || geometria === "ROLLO" || geometria === "";
}

function getMachineMargins(maquina: { parametrosTecnicosJson?: Record<string, unknown> | null } | null | undefined) {
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

function getPliegoPresetValue(pliegoImpresion: Record<string, unknown>) {
  const explicitPreset =
    typeof pliegoImpresion.preset === "string" ? pliegoImpresion.preset : null;
  if (explicitPreset && PLIEGO_IMPRESION_PRESETS.some((preset) => preset.value === explicitPreset)) {
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

function readOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
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
        slotsRequeridos: Array<{ codigo: string; requerido: boolean; tipo?: string }>;
      }
    | undefined,
) {
  if (!cfg.modoTiempo) return true;
  if (cfg.modoTiempo !== "T-1") return true;

  const tieneMaterialesDeclarados =
    (familia?.slotsRequeridos.filter((slot) => !isConsumibleMaquinaSlot(slot)).length ?? 0) > 0 ||
    (cfg.slotsMateriales?.length ?? 0) > 0;
  return tieneMaterialesDeclarados;
}

function validarBasico(
  cfg: UpsertConfigPasoPayload,
  familia:
    | {
        relacionMaquinaSoportada: string[];
        slotsRequeridos: Array<{ codigo: string; requerido: boolean; tipo?: string }>;
      }
    | undefined,
): TabValidacion {
  const errores: string[] = [];
  const warnings: string[] = [];
  if (familia?.relacionMaquinaSoportada.includes("M-1") && !cfg.maquinaM1Id) {
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
  return { errores, warnings };
}

function validarMateriales(
  cfg: UpsertConfigPasoPayload,
  familia: { slotsRequeridos: Array<{ codigo: string; nombre: string; requerido: boolean; tipo?: string }> } | undefined,
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
    const slotDecl = familia.slotsRequeridos.find((sr) => sr.codigo === slot.slotCodigo);
    if (slotDecl && isConsumibleMaquinaSlot(slotDecl)) continue;
    if (slot.modoSeleccion === "HARDCODED" && !slot.materialVarianteId) {
      errores.push(`${slotNombre(slot.slotCodigo, familia)}: sin variante de material`);
    }
    if (slot.modoSeleccion === "MOTOR_ELIGE_AUTO" && !slot.criterioMotorAuto) {
      warnings.push(`${slotNombre(slot.slotCodigo, familia)}: sin criterio del sistema`);
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
    const hasAncho = pliegoImpresion.anchoMm !== undefined && pliegoImpresion.anchoMm !== null && pliegoImpresion.anchoMm !== "";
    const hasAlto = pliegoImpresion.altoMm !== undefined && pliegoImpresion.altoMm !== null && pliegoImpresion.altoMm !== "";
    if (hasAncho || hasAlto) {
      const ancho = readOptionalNumber(pliegoImpresion.anchoMm);
      const alto = readOptionalNumber(pliegoImpresion.altoMm);
      if (!ancho || ancho <= 0 || !alto || alto <= 0) {
        errores.push("Pliego de impresión: completá ancho y alto mayores a 0 mm");
      }
    }
  }
  return { errores, warnings };
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

  // Estado: por cada paso de la ruta, su configuración (existente o nueva)
  const [configs, setConfigs] = React.useState<ConfigState>(() => {
    const initial: ConfigState = {};
    for (const paso of rutaAlternativa.ruta.pasos) {
      const existente = rutaAlternativa.configPasos.find((cp) => cp.rutaPasoId === paso.id);
      const familia = familiasMap.get(paso.familiaCodigo);
      initial[paso.id] = {
        rutaPasoId: paso.id,
        modoActivacion: existente?.modoActivacion ?? familia?.modoActivacionDefault ?? "OBLIGATORIO",
        condicionActivacionJson: (existente?.condicionActivacionJson as Record<string, unknown> | null | undefined) ?? null,
        modoTiempo:
          existente?.modoTiempo ??
          (familia?.modosTiempoSoportados.length === 1
            ? familia.modosTiempoSoportados[0]
            : null),
        mecanismoCantidad:
          existente?.mecanismoCantidad ??
          (familia?.mecanismosCantidadSoportados.length === 1
            ? familia.mecanismosCantidadSoportados[0]
            : null),
        mecanismoCantidadConfigJson: (existente?.mecanismoCantidadConfigJson as Record<string, unknown> | null | undefined) ?? null,
        multiplicadoresActivos: existente?.multiplicadoresActivos ?? [],
        paramsPasoJson: (existente?.paramsPasoJson as Record<string, unknown> | null | undefined) ?? null,
        maquinaM1Id: existente?.maquinaM1?.id ?? null,
        perfilM1Id: existente?.perfilM1?.id ?? null,
        centroCostoId: existente?.maquinaM1 ? null : (existente?.centroCosto?.id ?? null),
        setupOverrideMin: existente?.setupOverrideMin ?? null,
        cleanupOverrideMin: existente?.cleanupOverrideMin ?? null,
        tiempoFijoOverrideMin: existente?.tiempoFijoOverrideMin ?? null,
        slotsMateriales: existente?.slotsMateriales.map<UpsertSlotMaterialPayload>((s) => ({
          slotCodigo: s.slotCodigo,
          modoSeleccion: s.modoSeleccion as "HARDCODED" | "COMERCIAL_ELIGE" | "MOTOR_ELIGE_AUTO",
          criterioMotorAuto: s.criterioMotorAuto ?? null,
          materialVarianteId: s.materialVariante?.id ?? null,
          materialesCandidatosJson: (s.materialesCandidatosJson as Array<Record<string, unknown>>) ?? [],
          estrategiaCosto: s.estrategiaCosto,
          formula: s.formula,
          aplicaMultiCaras: s.aplicaMultiCaras,
        })) ?? [],
      };
    }
    return initial;
  });

  // JSON text por paso (sólo UI; al guardar se parsea de vuelta a objeto)
  const [jsonTexts] = React.useState<Record<string, { params: string; mecanismo: string }>>(
    () => {
      const map: Record<string, { params: string; mecanismo: string }> = {};
      for (const paso of rutaAlternativa.ruta.pasos) {
        const existente = rutaAlternativa.configPasos.find((cp) => cp.rutaPasoId === paso.id);
        const params = existente?.paramsPasoJson as Record<string, unknown> | null | undefined;
        map[paso.id] = {
          params: jsonToText(stripNestingConfig(params)),
          mecanismo: jsonToText(existente?.mecanismoCantidadConfigJson as Record<string, unknown> | null | undefined),
        };
      }
      return map;
    },
  );
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

  const updateConfig = (rutaPasoId: string, patch: Partial<UpsertConfigPasoPayload>) => {
    setConfigs((prev) => ({ ...prev, [rutaPasoId]: { ...prev[rutaPasoId], ...patch } }));
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
        if (value === null || value === undefined || value === "" || Number(value) === 0) {
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
      const pliegoImpresion = { ...asRecord(current.pliegoImpresion), ...patch };
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
              Object.entries(current).filter(([key]) => key !== "pliegoImpresion"),
            );
      const nextParams = { ...params, nestingConfig: nextNesting };
      return { ...prev, [rutaPasoId]: { ...cfg, paramsPasoJson: nextParams } };
    });
  };

  const updateNestingPliegoPreset = (rutaPasoId: string, presetValue: string) => {
    const preset = PLIEGO_IMPRESION_PRESETS.find((item) => item.value === presetValue);
    if (!preset || preset.value === "materia_prima") {
      updateNestingPliegoImpresion(rutaPasoId, {
        preset: null,
        anchoMm: null,
        altoMm: null,
      });
      return;
    }
    if (preset.value === "personalizado") {
      updateNestingPliegoImpresion(rutaPasoId, { preset: "personalizado" });
      return;
    }
    updateNestingPliegoImpresion(rutaPasoId, {
      preset: preset.value,
      anchoMm: preset.anchoMm,
      altoMm: preset.altoMm,
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
      const existente = cfg.slotsMateriales?.find((s) => s.slotCodigo === slotCodigo);
      if (existente) return prev; // ya existe
      const nuevoSlot: UpsertSlotMaterialPayload = {
        slotCodigo,
        modoSeleccion: "HARDCODED",
        materialVarianteId: null,
        estrategiaCosto: "simple",
        formula: "por_unidad_productiva",
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
    const cantidadRelevante = requiereMecanismoCantidad(configs[rutaPasoId], familia);
    const paramsRes = textToJson(jsonText.params);
    const mecanismoRes = cantidadRelevante
      ? textToJson(jsonText.mecanismo)
      : ({ ok: true, value: null } as const);
    if (!paramsRes.ok) {
      toast.error(`JSON inválido en "Params del paso": ${paramsRes.error}`);
      return;
    }
    if (!mecanismoRes.ok) {
      toast.error(`JSON inválido en "Config de cantidad": ${mecanismoRes.error}`);
      return;
    }
    const condicionActivacionJson =
      configs[rutaPasoId].modoActivacion === "CONDICIONAL"
        ? (configs[rutaPasoId].condicionActivacionJson as Record<string, unknown> | null | undefined) ?? null
        : null;
    if (configs[rutaPasoId].modoActivacion === "CONDICIONAL") {
      const camposRegla = getRuleFields({
        includeMeasureFields: producto.modoMedidas === "LIBRE",
      });
      const parsedRule = jsonLogicToRuleGroup(condicionActivacionJson, camposRegla);
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
      const nestingConfig = getNestingConfig(configs[rutaPasoId].paramsPasoJson);
      const paramsPasoJson = {
        ...(paramsRes.value ?? {}),
        ...(Object.keys(nestingConfig).length > 0 ? { nestingConfig } : {}),
      };
      await upsertConfigPaso(rutaAlternativa.id, {
        ...configs[rutaPasoId],
        centroCostoId: configs[rutaPasoId].maquinaM1Id
          ? null
          : (configs[rutaPasoId].centroCostoId ?? null),
        condicionActivacionJson,
        mecanismoCantidad: cantidadRelevante ? configs[rutaPasoId].mecanismoCantidad : null,
        paramsPasoJson: Object.keys(paramsPasoJson).length > 0 ? paramsPasoJson : null,
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

  const getPasoSummary = (paso: RutaAlternativaDetalle["ruta"]["pasos"][number]) => {
    const familia = familiasMap.get(paso.familiaCodigo);
    const cfg = configs[paso.id];
    const jsonText = jsonTexts[paso.id];
    const configExistente = rutaAlternativa.configPasos.find((cp) => cp.rutaPasoId === paso.id);
    const cantidadRelevante = requiereMecanismoCantidad(cfg, familia);
    const valBasico = validarBasico(cfg, familia);
    const valMateriales = validarMateriales(cfg, familia);
    const valAvanzado = validarAvanzado(
      jsonText.params,
      cantidadRelevante ? jsonText.mecanismo : "",
      cfg,
      familia ? { codigo: familia.codigo } : undefined,
    );
    const totalErrores =
      valBasico.errores.length + valMateriales.errores.length + valAvanzado.errores.length;
    const totalWarnings =
      valBasico.warnings.length + valMateriales.warnings.length + valAvanzado.warnings.length;
    const maquinaSel =
      lookups.maquinas.find((maquina) => maquina.id === cfg.maquinaM1Id) ??
      configExistente?.maquinaM1 ??
      null;
    const centroManual = cfg.centroCostoId
      ? lookups.centrosCosto.find((centro) => centro.id === cfg.centroCostoId)
      : null;
    const optional = cfg.modoActivacion === "OPCIONAL";
    const status = totalErrores > 0 || totalWarnings > 0
      ? "warning"
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
      maquinaNombre: maquinaSel?.nombre ?? centroManual?.nombre ?? "Sin centro asignado",
      status,
      optional,
    };
  };

  const activeIdx = Math.max(
    0,
    rutaAlternativa.ruta.pasos.findIndex((paso) => paso.id === activePasoId),
  );
  const doneCount = rutaAlternativa.ruta.pasos.filter(
    (paso) => getPasoSummary(paso).status === "done",
  ).length;
  const activePaso = rutaAlternativa.ruta.pasos[activeIdx] ?? rutaAlternativa.ruta.pasos[0];
  const goPrev = () => {
    const prev = rutaAlternativa.ruta.pasos[Math.max(0, activeIdx - 1)];
    if (prev) setActivePasoId(prev.id);
  };
  const goNext = () => {
    const next = rutaAlternativa.ruta.pasos[Math.min(rutaAlternativa.ruta.pasos.length - 1, activeIdx + 1)];
    if (next) setActivePasoId(next.id);
  };

  return (
    <div className={embedded ? "pasos-editor-root" : "pasos-editor-root flex flex-1 flex-col"}>
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
            <div className="sub">{rutaAlternativa.ruta.codigo} · v{rutaAlternativa.rutaVersion}</div>
          </div>
          <div className="side-progress">
            <span>{doneCount}/{rutaAlternativa.ruta.pasos.length} pasos</span>
            <div className="bar">
              <span style={{ width: `${(doneCount / Math.max(1, rutaAlternativa.ruta.pasos.length)) * 100}%` }} />
            </div>
          </div>
          <div className="pasos">
            {rutaAlternativa.ruta.pasos.map((paso, idx) => {
              const summary = getPasoSummary(paso);
              return (
                <button
                  type="button"
                  key={paso.id}
                  className={`paso-item ${summary.status} ${summary.optional ? "optional" : ""} ${paso.id === activePasoId ? "active" : ""}`}
                  onClick={() => setActivePasoId(paso.id)}
                >
                  <span className="ix">
                    {summary.status === "done" ? <CheckIcon className="size-3" /> : idx + 1}
                  </span>
                  <span className="body">
                    <span className="ttl">{summary.familia?.nombre ?? paso.familiaCodigo}</span>
                    <span className="sub">{summary.maquinaNombre}</span>
                  </span>
                  <span className="status">
                    {summary.status === "done"
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
            <span className="kbd-hint">Navegar pasos con <span className="k">↑</span> <span className="k">↓</span></span>
          </div>
        </aside>

        <main className="editor-main">
          <div className="mini-graph">
            {rutaAlternativa.ruta.pasos.map((paso, idx) => {
              const summary = getPasoSummary(paso);
              return (
                <React.Fragment key={paso.id}>
                  <button
                    type="button"
                    className={`mn ${summary.status} ${summary.optional ? "optional" : ""} ${paso.id === activePasoId ? "active" : ""}`}
                    onClick={() => setActivePasoId(paso.id)}
                    title={summary.familia?.nombre ?? paso.familiaCodigo}
                  >
                    <span className="d">{summary.status === "done" ? "✓" : idx + 1}</span>
                    <span className="lb">{(summary.familia?.nombre ?? paso.familiaCodigo).split(" ")[0]}</span>
                  </button>
                  {idx < rutaAlternativa.ruta.pasos.length - 1 && (
                    <div
                      className={`edge ${
                        summary.status === "done" &&
                        getPasoSummary(rutaAlternativa.ruta.pasos[idx + 1]!).status === "done"
                          ? "done"
                          : ""
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {activePaso ? (
            rutaAlternativa.ruta.pasos
              .filter((paso) => paso.id === activePaso.id)
              .map((paso) => {
          const idx = rutaAlternativa.ruta.pasos.findIndex((item) => item.id === paso.id);
          const familia = familiasMap.get(paso.familiaCodigo);
          const cfg = configs[paso.id];
          const jsonText = jsonTexts[paso.id];
          const configExistente = rutaAlternativa.configPasos.find(
            (cp) => cp.rutaPasoId === paso.id,
          );
          const maquinasCompatibles = lookups.maquinas.filter((m) =>
            maquinaCompatibleConFamilia(paso.familiaCodigo, familia?.plantillasCompatibles, m),
          );
          const maquinaSel = lookups.maquinas.find((m) => m.id === cfg.maquinaM1Id);
          const maquinaGuardada = maquinaSel ?? configExistente?.maquinaM1 ?? null;
          const maquinaOptions = ensureSelectedOption(
            maquinasCompatibles.map((m) => machineOption(m)),
            cfg.maquinaM1Id,
            maquinaGuardada
              ? machineOption(maquinaGuardada, "guardada/no compatible")
              : undefined,
          );
          const perfilGuardado =
            maquinaSel?.perfilesOperativos.find((p) => p.id === cfg.perfilM1Id) ??
            configExistente?.perfilM1 ??
            null;
          const perfilOptions = ensureSelectedOption(
            (maquinaSel?.perfilesOperativos ?? [])
              .filter((p) => perfilCompatibleConFamilia(paso.familiaCodigo, p))
              .map((p) => profileOption(p)),
            cfg.perfilM1Id,
            perfilGuardado
              ? profileOption(perfilGuardado, "guardado/no disponible")
              : undefined,
          );
          const opcionesActivacion = (familia?.modosActivacionSoportados ?? MODOS_ACTIVACION).map(
            (m) => optionFromLabel(m, modoActivacionLabels),
          );
          const opcionesTiempo = (
            familia?.modosTiempoSoportados ?? ["T-1", "T-2", "T-3", "T-4"]
          ).map((m) => optionFromLabel(m, modoTiempoLabels));
          const opcionesCantidad = (
            familia?.mecanismosCantidadSoportados ?? [
              "DIRECT_FROM_JOBCONTEXT",
              "HEREDAR_DEL_OUTPUT_CANONICO",
              "CALCULADO_POR_PASO",
              "CONVERSION",
            ]
          ).map((m) => optionFromLabel(m, mecanismoCantidadLabels));
          const opcionesVariantes = materialVariantOptions(lookups.materiasPrimas);
          const centroGuardado = configExistente?.centroCosto ?? null;
          const centroCostoOptions = ensureSelectedOption(
            lookups.centrosCosto.map((centro) => centroCostoOption(centro)),
            cfg.centroCostoId,
            centroGuardado ? centroCostoOption(centroGuardado) : undefined,
          );

          const slotsManuales = familia?.slotsRequeridos.filter(
            (slot) => !isConsumibleMaquinaSlot(slot),
          ) ?? [];
          const slotsAutomaticos = familia?.slotsRequeridos.filter(isConsumibleMaquinaSlot) ?? [];
          const requiereMateriales = slotsManuales.length > 0 || slotsAutomaticos.length > 0;
          const cantidadRelevante = requiereMecanismoCantidad(cfg, familia);
          const mostrarNesting = nestingAplica(familia?.codigo, cfg);
          const mostrarSetupCleanupOverrides = Boolean(cfg.maquinaM1Id);
          const mostrarTiempoFijoOverride = cfg.modoTiempo === "T-1" && !cfg.maquinaM1Id;
          const mostrarOverridesTiempo = mostrarSetupCleanupOverrides || mostrarTiempoFijoOverride;
          const nestingConfig = getNestingConfig(cfg.paramsPasoJson);
          const panelizadoConfig = getPanelizadoConfig(cfg.paramsPasoJson);
          const pliegoImpresionConfig = getPliegoImpresionConfig(cfg.paramsPasoJson);
          const nestingExtraMargins = getExtraMarginsConfig(cfg.paramsPasoJson);
          const pliegoImpresionPreset = getPliegoPresetValue(pliegoImpresionConfig);
          const pliegoImpresionEsPersonalizado = pliegoImpresionPreset === "personalizado";
          const nestingMargins = asRecord(nestingConfig.margins);
          const nestingCosting = asRecord(nestingConfig.costing);
          const sustratoPrincipal = cfg.slotsMateriales?.find(
            (slot) => slot.slotCodigo === "sustrato_principal",
          );
          const varianteSustrato = lookups.materiasPrimas
            .flatMap((materia) => materia.variantes)
            .find((variante) => variante.id === sustratoPrincipal?.materialVarianteId);
          const attrsSustrato = asRecord(varianteSustrato?.atributosVarianteJson);
          const sustratoAnchoLabel = formatMm(attrsSustrato.anchoMm ?? attrsSustrato.widthMm);
          const sustratoAltoLabel = formatMm(
            attrsSustrato.largoMm ?? attrsSustrato.altoMm ?? attrsSustrato.heightMm,
          );
          const maquinaParaDefaults =
            maquinaSel?.parametrosTecnicosJson
              ? maquinaSel
              : configExistente?.maquinaM1?.id === cfg.maquinaM1Id &&
                  configExistente?.maquinaM1?.parametrosTecnicosJson
                ? configExistente.maquinaM1
                : maquinaSel ?? configExistente?.maquinaM1;
          const machineMargins = getMachineMargins(maquinaParaDefaults);
          const resolvedSeparationH = getResolvedNestingNumber(nestingConfig.separationHMm, undefined, 0);
          const resolvedSeparationV = getResolvedNestingNumber(nestingConfig.separationVMm, undefined, 0);
          const mostrarPanelizado = panelizadoAplica(familia?.codigo, nestingConfig, maquinaParaDefaults);
          const resolvedPanelMaxWidth = getResolvedNestingNumber(panelizadoConfig.maxPanelWidthMm, undefined, 0);
          const resolvedPanelOverlap = getResolvedNestingNumber(panelizadoConfig.overlapMm, undefined, 20);
          const valBasico = validarBasico(cfg, familia);
          const valMateriales = validarMateriales(cfg, familia);
          const valAvanzado = validarAvanzado(
            jsonText.params,
            cantidadRelevante ? jsonText.mecanismo : "",
            cfg,
            familia ? { codigo: familia.codigo } : undefined,
          );
          const totalErrores =
            valBasico.errores.length + valMateriales.errores.length + valAvanzado.errores.length;
          const totalWarnings =
            valBasico.warnings.length + valMateriales.warnings.length + valAvanzado.warnings.length;
          const pasoTieneCambios = hasUnsavedChanges(paso.id);

          return (
            <React.Fragment key={paso.id}>
            <div className="step-head">
              <div style={{ flex: 1 }}>
                <div className="pill-row">
                  <span style={{ color: "var(--muted-text)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                    Paso {idx + 1} de {rutaAlternativa.ruta.pasos.length}
                  </span>
                  <span className={`tag ${totalErrores === 0 && totalWarnings === 0 ? "ok" : "warm"}`}>
                    <span className="d" />
                    {totalErrores > 0
                      ? `${totalErrores} error${totalErrores === 1 ? "" : "es"}`
                      : totalWarnings > 0
                        ? `${totalWarnings} pendiente${totalWarnings === 1 ? "" : "s"}`
                        : configExistente
                          ? "Configurado"
                          : "Pendiente"}
                  </span>
                  <span className="tag muted">
                    {cfg.modoActivacion ? getLabel(modoActivacionLabels, cfg.modoActivacion).label : "Sin activación"}
                  </span>
                </div>
                <h1>{familia?.nombre ?? paso.familiaCodigo}</h1>
                <div className="sub">
                  {maquinaGuardada ? (
                    <>
                      Máquina: <strong style={{ color: "var(--ink)", fontWeight: 500 }}>{maquinaGuardada.nombre}</strong>
                      {perfilGuardado ? <> · perfil {perfilGuardado.nombre}</> : null}
                    </>
                  ) : cfg.centroCostoId ? (
                    <>
                      Centro de costo: <strong style={{ color: "var(--ink)", fontWeight: 500 }}>
                        {lookups.centrosCosto.find((centro) => centro.id === cfg.centroCostoId)?.nombre ?? "Seleccionado"}
                      </strong>
                    </>
                  ) : (
                    "Sin centro asignado"
                  )}
                </div>
              </div>
              <div className="pill-row">
                <button className="btn" type="button" onClick={goPrev} disabled={idx === 0}>
                  <ArrowLeftIcon className="size-4" />
                </button>
                <button className="btn" type="button" onClick={goNext} disabled={idx === rutaAlternativa.ruta.pasos.length - 1}>
                  Siguiente →
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => guardarPaso(paso.id)}
                  disabled={guardando === paso.id || totalErrores > 0 || !pasoTieneCambios}
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
                  <span className="hint">Cuándo se ejecuta este paso al cotizar</span>
                </div>
                <div className="sb-body">
                  <div className="wiz-grid">
                    <div className="field">
                      <label>Cuándo se ejecuta</label>
                      <div className="segmented">
                        {opcionesActivacion.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={cfg.modoActivacion === option.value ? "on" : ""}
                            onClick={() => updateConfig(paso.id, { modoActivacion: option.value })}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <span className="help">Los pasos opcionales no se ejecutan a menos que el comercial los active.</span>
                    </div>
                    <div className="field">
                      <label>Multiplicadores</label>
                      <div className="chip-row">
                        {(cfg.multiplicadoresActivos?.length ? cfg.multiplicadoresActivos : ["caras"]).map((multiplicador) => (
                          <span key={multiplicador} className="tag mono">{multiplicador}</span>
                        ))}
                        <span className="tag muted dashed">+ Agregar</span>
                      </div>
                      <span className="help">Variables que multiplican el costo del paso (ej: caras, colores).</span>
                    </div>
                    {cfg.modoActivacion === "CONDICIONAL" && (
                      <div className="md:col-span-full">
                        <RuleBuilder
                          value={cfg.condicionActivacionJson as Record<string, unknown> | null | undefined}
                          includeMeasureFields={producto.modoMedidas === "LIBRE"}
                          onChange={(value) =>
                            updateConfig(paso.id, { condicionActivacionJson: value })
                          }
                        />
                      </div>
                    )}
                  </div>
                  {(valBasico.errores.length > 0 || valBasico.warnings.length > 0) && (
                    <ListaValidacion validacion={valBasico} />
                  )}
                </div>
              </section>

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
                        onValueChange={(v) => updateConfig(paso.id, { modoTiempo: v || null })}
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
                          <span>{maquinaGuardada?.centroCostoPrincipal?.nombre ?? "Centro heredado de máquina"}</span>
                        </div>
                      ) : (
                        <HumanSelect
                          value={cfg.centroCostoId ?? ""}
                          onValueChange={(v) => updateConfig(paso.id, { centroCostoId: v || null })}
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
                              Tiempo fijo override <span className="hint">opcional</span>
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
                              tiempoFijoOverrideMin: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          placeholder="—"
                        />
                      </div>
                    )}
                    {cantidadRelevante && (
                      <div className="field">
                        <LabelConTooltip
                          label="¿De dónde sale la cantidad?"
                          tooltip="Cómo el motor decide cuántas unidades produce este paso."
                        />
                        <HumanSelect
                          value={cfg.mecanismoCantidad ?? ""}
                          onValueChange={(v) => updateConfig(paso.id, { mecanismoCantidad: v || null })}
                          options={opcionesCantidad}
                          placeholder="Elegir"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {familia && familia.relacionMaquinaSoportada.includes("M-1") && (
                <section className="section-block open">
                  <div className="sb-head">
                    <span className="num">03</span>
                    <span className="ttl">Máquina y perfil</span>
                    <span className="chev">›</span>
                  </div>
                  <div className="sb-body">
                    <div className="wiz-grid">
                      <div className="field">
                        <LabelConTooltip
                          label={
                            <>
                              Máquina principal <span className="req">*</span>
                            </>
                          }
                          tooltip="Máquina del taller que ejecuta este paso. La lista filtra por compatibilidad con la familia."
                          required
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
                            label="Perfil de la máquina"
                            tooltip="Configuración operativa específica. Define la productividad."
                          />
                          <HumanSelect
                            value={cfg.perfilM1Id ?? ""}
                            onValueChange={(v) => updateConfig(paso.id, { perfilM1Id: v || null })}
                            disabled={!maquinaSel}
                            options={perfilOptions}
                            placeholder={maquinaSel ? "Elegir" : "Elegí máquina primero"}
                          />
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
                        <span className="num">{familia.relacionMaquinaSoportada.includes("M-1") ? "04" : "03"}</span>
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
                          <button type="button" className="slot-link">
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
                            const yaExiste = cfg.slotsMateriales?.some(
                              (s) => s.slotCodigo === slot.codigo,
                            );
                            if (yaExiste) return null;
                            return (
                              <Button
                                key={slot.codigo}
                                variant="outline"
                                size="sm"
                                onClick={() => addSlotFromFamilia(paso.id, slot.codigo)}
                                className="h-7 text-xs"
                              >
                                + {slot.nombre}
                                {slot.requerido && <span className="text-red-500">*</span>}
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      {slotsAutomaticos.length > 0 && (
                        <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                          <div className="font-medium text-foreground">Consumibles automáticos por máquina/perfil</div>
                          <div>
                            {slotsAutomaticos.map((slot) => slotNombre(slot.codigo, familia)).join(" · ")}
                          </div>
                          <div>
                            Se configuran en Maquinaria. El motor toma tinta, tóner o barniz desde la máquina y el perfil seleccionado.
                          </div>
                        </div>
                      )}

                      {(cfg.slotsMateriales ?? []).length === 0 && (
                        <p className="text-muted-foreground py-4 text-center text-xs italic">
                          {slotsManuales.length > 0
                            ? "Sin slots configurados. Agregá uno con los botones de arriba."
                            : "No hay materiales manuales para configurar en este paso."}
                        </p>
                      )}

                      {(cfg.slotsMateriales ?? []).map((slot, slotIdx) => {
                        const slotDecl = familia.slotsRequeridos.find((sr) => sr.codigo === slot.slotCodigo);
                        if (slotDecl && isConsumibleMaquinaSlot(slotDecl)) {
                          return (
                            <div key={slotIdx} className="rounded border border-dashed bg-muted/20 p-2 text-xs text-muted-foreground">
                              {slotNombre(slot.slotCodigo, familia)} se resolverá automáticamente desde Maquinaria.
                            </div>
                          );
                        }
                        return (
                        <div key={slotIdx} className="bg-muted/30 space-y-2 rounded border p-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" title={slot.slotCodigo}>
                              {slotNombre(slot.slotCodigo, familia)}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-red-600"
                              onClick={() => removeSlot(paso.id, slotIdx)}
                            >
                              ×
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                            <div className="space-y-1">
                              <LabelConTooltip
                                label="¿Quién elige el material?"
                                tooltip="Material fijo (modelador), el comercial elige al cotizar, o el sistema elige automáticamente con un criterio."
                              />
                              <HumanSelect
                                value={slot.modoSeleccion}
                                onValueChange={(v) =>
                                  updateSlot(paso.id, slotIdx, {
                                    modoSeleccion: (v || "HARDCODED") as
                                      | "HARDCODED"
                                      | "COMERCIAL_ELIGE"
                                      | "MOTOR_ELIGE_AUTO",
                                  })
                                }
                                options={SELECCION_MATERIAL_OPTIONS}
                                triggerClassName="min-h-9 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <LabelConTooltip
                                label="¿Cómo se calcula el consumo?"
                                tooltip="Fórmula que el motor usa para calcular cuánto material se consume (por pieza, por m², por metro lineal, etc.)."
                              />
                              <HumanSelect
                                value={slot.formula ?? "por_unidad_productiva"}
                                onValueChange={(v) =>
                                  updateSlot(paso.id, slotIdx, { formula: v || "por_unidad_productiva" })
                                }
                                options={FORMULA_OPTIONS}
                                triggerClassName="min-h-9 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <LabelConTooltip
                                label="Costeo"
                                tooltip="Estrategia de costeo del material. Las estrategias de nesting usan el acomodo calculado por el paso."
                              />
                              <HumanSelect
                                value={slot.estrategiaCosto ?? "simple"}
                                onValueChange={(v) =>
                                  updateSlot(paso.id, slotIdx, { estrategiaCosto: v || "simple" })
                                }
                                options={COSTING_STRATEGY_OPTIONS}
                                triggerClassName="min-h-9 text-xs"
                              />
                            </div>
                          </div>
                          {slot.modoSeleccion === "HARDCODED" && (
                            <HumanSelect
                              value={slot.materialVarianteId ?? ""}
                              onValueChange={(v) =>
                                updateSlot(paso.id, slotIdx, { materialVarianteId: v || null })
                              }
                              options={opcionesVariantes}
                              placeholder="Elegir variante de material"
                              triggerClassName="min-h-9 text-xs"
                              contentClassName="max-h-80"
                            />
                          )}
                          {slot.modoSeleccion === "MOTOR_ELIGE_AUTO" && (
                            <div className="space-y-1">
                              <LabelConTooltip
                                label="Criterio del sistema"
                                tooltip="Cómo elige el sistema entre los candidatos: el más barato, el de mejor aprovechamiento, o el de capacidad mínima que cumpla."
                              />
                              <HumanSelect
                                value={slot.criterioMotorAuto ?? ""}
                                onValueChange={(v) =>
                                  updateSlot(paso.id, slotIdx, { criterioMotorAuto: v || null })
                                }
                                options={CRITERIO_AUTO_OPTIONS}
                                placeholder="Elegí criterio"
                                triggerClassName="min-h-9 text-xs"
                              />
                            </div>
                          )}
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={!!slot.aplicaMultiCaras}
                              onChange={(e) =>
                                updateSlot(paso.id, slotIdx, { aplicaMultiCaras: e.target.checked })
                              }
                            />
                            <span>
                              Multiplicar consumo por caras
                              <span className="text-muted-foreground ml-1">
                                (si doble faz, consume el doble)
                              </span>
                            </span>
                          </label>
                        </div>
                        );
                      })}

                      {(valMateriales.errores.length > 0 || valMateriales.warnings.length > 0) && (
                        <ListaValidacion validacion={valMateriales} />
                      )}
                        </>
                      )}
                      </div>
                    </section>
                  )}

                  {/* ── TAB AVANZADO ─────────────────────────────────────── */}
                  <section className={`section-block ${advancedOpen ? "open" : "closed"}`}>
                    <button type="button" className="sb-head" onClick={() => setAdvancedOpen((open) => !open)}>
                      <span className="num">{familia?.relacionMaquinaSoportada.includes("M-1") ? "05" : "04"}</span>
                      <span className="ttl">Avanzado</span>
                      <span className="hint">Overrides y notas internas</span>
                      <span className="chev">›</span>
                    </button>
                    {advancedOpen && (
                    <div className="sb-body space-y-4">
                    <p className="text-muted-foreground text-xs">
                      Ajustes operativos del paso. Los parámetros técnicos internos se preservan, pero no se editan desde esta vista.
                    </p>

                    {/* Overrides de tiempo */}
                    {mostrarOverridesTiempo && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Overrides de tiempo (minutos)</div>
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
                                  value={cfg.setupOverrideMin ?? ""}
                                  onChange={(e) =>
                                    updateConfig(paso.id, {
                                      setupOverrideMin: e.target.value === "" ? null : Number(e.target.value),
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
                                  value={cfg.cleanupOverrideMin ?? ""}
                                  onChange={(e) =>
                                    updateConfig(paso.id, {
                                      cleanupOverrideMin: e.target.value === "" ? null : Number(e.target.value),
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
                                value={cfg.tiempoFijoOverrideMin ?? ""}
                                onChange={(e) =>
                                  updateConfig(paso.id, {
                                    tiempoFijoOverrideMin: e.target.value === "" ? null : Number(e.target.value),
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
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <div className="space-y-1">
                            <LabelConTooltip
                              label="Algoritmo"
                              tooltip="Automático elige según la geometría de máquina/material y las medidas del trabajo."
                              iconSize="sm"
                            />
                            <HumanSelect
                              value={String(nestingConfig.algorithm ?? "auto")}
                              onValueChange={(v) => updateNestingConfig(paso.id, { algorithm: v || "auto" })}
                              options={NESTING_ALGORITHM_OPTIONS}
                              triggerClassName="min-h-9 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <LabelConTooltip
                              label="Separación horizontal"
                              tooltip="Espacio entre piezas en el eje horizontal."
                              iconSize="sm"
                            />
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              value={String(resolvedSeparationH)}
                              onChange={(e) =>
                                updateNestingConfig(paso.id, {
                                  separationHMm: e.target.value === "" ? 0 : Number(e.target.value),
                                })
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <LabelConTooltip
                              label="Separación vertical"
                              tooltip="Espacio entre filas o piezas en el eje vertical."
                              iconSize="sm"
                            />
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              value={String(resolvedSeparationV)}
                              onChange={(e) =>
                                updateNestingConfig(paso.id, {
                                  separationVMm: e.target.value === "" ? 0 : Number(e.target.value),
                                })
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                        {familia?.codigo === "impresion_por_hoja" && (
                          <div className="space-y-2 rounded border bg-background/70 p-3">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                              <LabelConTooltip
                                label="Pliego de impresión"
                                tooltip="Tamaño real de hoja que entra a la impresora. Si queda vacío, el motor usa el tamaño del sustrato principal comprado."
                                iconSize="sm"
                              />
                              {sustratoAnchoLabel && sustratoAltoLabel && (
                                <span className="text-muted-foreground text-xs">
                                  Sustrato comprado: {sustratoAnchoLabel} × {sustratoAltoLabel}
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
                                  onValueChange={(v) => updateNestingPliegoPreset(paso.id, v || "materia_prima")}
                                  options={PLIEGO_IMPRESION_OPTIONS}
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
                                  disabled={!pliegoImpresionEsPersonalizado}
                                  value={String(pliegoImpresionConfig.anchoMm ?? "")}
                                  onChange={(e) =>
                                    updateNestingPliegoImpresion(paso.id, {
                                      anchoMm: e.target.value === "" ? null : Number(e.target.value),
                                    })
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
                                  disabled={!pliegoImpresionEsPersonalizado}
                                  value={String(pliegoImpresionConfig.altoMm ?? "")}
                                  onChange={(e) =>
                                    updateNestingPliegoImpresion(paso.id, {
                                      altoMm: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                  placeholder="Usar sustrato"
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>
                            <p className="text-muted-foreground text-xs">
                              La imposición, el tiempo y los consumibles se calculan sobre este pliego; el sustrato principal se convierte contra el tamaño comprado cuando corresponde.
                            </p>
                          </div>
                        )}
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={nestingConfig.allowRotation !== false}
                            onChange={(e) => updateNestingConfig(paso.id, { allowRotation: e.target.checked })}
                          />
                          <span>Permitir rotar piezas</span>
                        </label>

                        {mostrarPanelizado && (
                          <div className="space-y-3 rounded border bg-background/70 p-3">
                            <label className="flex items-center gap-2 text-xs font-medium">
                              <input
                                type="checkbox"
                                checked={panelizadoConfig.enabled === true}
                                onChange={(e) =>
                                  updateNestingPanelizado(paso.id, {
                                    enabled: e.target.checked,
                                    mode: "automatic",
                                  })
                                }
                              />
                              <span>Panelizar piezas grandes</span>
                            </label>
                            {panelizadoConfig.enabled === true && (
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                <div className="space-y-1">
                                  <LabelConTooltip
                                    label="Eje de panelizado"
                                    tooltip="Define si se divide el ancho o el alto de la pieza cuando no entra en el rollo."
                                    iconSize="sm"
                                  />
                                  <HumanSelect
                                    value={String(panelizadoConfig.axis ?? "vertical")}
                                    onValueChange={(v) => updateNestingPanelizado(paso.id, { axis: v || "vertical" })}
                                    options={PANEL_AXIS_OPTIONS}
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
                                    value={String(resolvedPanelOverlap)}
                                    onChange={(e) =>
                                      updateNestingPanelizado(paso.id, {
                                        overlapMm: e.target.value === "" ? 0 : Number(e.target.value),
                                      })
                                    }
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <LabelConTooltip
                                    label="Ancho máximo por panel"
                                    tooltip="Límite físico de cada panel. Si queda en 0, el motor usa el ancho útil del rollo."
                                    iconSize="sm"
                                  />
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={String(resolvedPanelMaxWidth)}
                                    onChange={(e) =>
                                      updateNestingPanelizado(paso.id, {
                                        maxPanelWidthMm: e.target.value === "" ? 0 : Number(e.target.value),
                                      })
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
                                    value={String(panelizadoConfig.distribution ?? "equilibrada")}
                                    onValueChange={(v) =>
                                      updateNestingPanelizado(paso.id, { distribution: v || "equilibrada" })
                                    }
                                    options={PANEL_DISTRIBUTION_OPTIONS}
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
                                    value={String(panelizadoConfig.widthInterpretation ?? "total")}
                                    onValueChange={(v) =>
                                      updateNestingPanelizado(paso.id, { widthInterpretation: v || "total" })
                                    }
                                    options={PANEL_WIDTH_INTERPRETATION_OPTIONS}
                                    triggerClassName="min-h-9 text-xs"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-xs font-medium">Margen extra del pliego</div>
                            <span className="text-muted-foreground text-xs">
                              Se suma al margen de máquina y no cambia la separación entre piezas.
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                            {[
                              ["leftMm", "Izq."],
                              ["rightMm", "Der."],
                              ["topMm", "Sup."],
                              ["bottomMm", "Inf."],
                            ].map(([key, label]) => (
                              <div key={key} className="space-y-1">
                                <span className="text-muted-foreground text-xs">{label}</span>
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.5}
                                  value={String(nestingExtraMargins[key] ?? "")}
                                  onChange={(e) =>
                                    updateNestingExtraMargins(paso.id, {
                                      [key]: e.target.value === "" ? null : Number(e.target.value),
                                    })
                                  }
                                  placeholder="0"
                                  className="h-8 text-xs"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs font-medium">Márgenes no imprimibles</div>
                          <p className="text-muted-foreground text-xs">
                            Margen técnico efectivo. Si lo editás, sobrescribe el margen heredado de la máquina.
                          </p>
                          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                            {[
                              ["leftMm", "Izq."],
                              ["rightMm", "Der."],
                              ["topMm", "Sup."],
                              ["bottomMm", "Inf."],
                            ].map(([key, label]) => (
                              <div key={key} className="space-y-1">
                                <span className="text-muted-foreground text-xs">{label}</span>
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.5}
                                  value={String(
                                    getResolvedNestingNumber(
                                      nestingMargins[key],
                                      machineMargins[key as keyof typeof machineMargins],
                                      0,
                                    ),
                                  )}
                                  onChange={(e) =>
                                    updateNestingMargins(paso.id, {
                                      [key]: e.target.value === "" ? 0 : Number(e.target.value),
                                    })
                                  }
                                  className="h-8 text-xs"
                                />
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
                              value={String(nestingCosting.strategy ?? "simple")}
                              onValueChange={(v) => updateNestingCosting(paso.id, { strategy: v || "simple" })}
                              options={COSTING_STRATEGY_OPTIONS}
                              triggerClassName="min-h-9 text-xs"
                            />
                          </div>
                          {nestingCosting.strategy === "plate-segments" && (
                            <div className="space-y-1">
                              <LabelConTooltip
                                label="Escalones de ocupación"
                                tooltip="Porcentajes de placa que se cobran según ocupación: una placa al 60% cobra el primer escalón igual o superior."
                                ejemplo="25, 50, 75, 100"
                                iconSize="sm"
                              />
                              <Input
                                value={Array.isArray(nestingCosting.segmentSteps) ? nestingCosting.segmentSteps.join(", ") : "25, 50, 75, 100"}
                                onChange={(e) =>
                                  updateNestingCosting(paso.id, {
                                    segmentSteps: e.target.value
                                      .split(",")
                                      .map((item) => Number(item.trim()))
                                      .filter((item) => Number.isFinite(item)),
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
            </div>
            </React.Fragment>
          );
        })
          ) : null}
        </main>
      </div>
    </div>
  );
}

// ─── Sub-componente: lista de validaciones ─────────────────────────

function ListaValidacion({ validacion }: { validacion: TabValidacion }) {
  if (validacion.errores.length === 0 && validacion.warnings.length === 0) return null;
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
