"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BriefcaseBusinessIcon,
  CheckIcon,
  Grid2X2Icon,
  ListIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  formatCurrency,
  type CotizacionPropuestaSnapshot,
  type PasoProduccionPropuesta,
  type PropuestaItem,
  type UnidadPropuesta,
} from "@/lib/propuestas";
import {
  cotizar,
  getProductoById,
  type CotizarResponse,
} from "@/lib/productos-servicios-api";
import type {
  ProductoDetalle,
  ProductoListItem,
  RutaAlternativaDetalle,
} from "@/lib/productos-servicios";
import {
  getMedidaDefault,
  getMedidasPredefinidas,
  medidaLabel,
} from "@/lib/producto-medidas";
import {
  getSlotMaterialVariantDisplay,
  getSlotMaterialVariantSortValue,
  sortSlotMaterialVariantsByThickness,
} from "@/lib/materiales-slot-display";

type CatalogSpec = {
  key: string;
  label: string;
  type: "select" | "text";
  options?: string[];
  def: string;
};

type CatalogAdicional = {
  code: string;
  name: string;
  monto?: number;
  descripcion?: string;
  origen?: "paso" | "cargo";
};

type CatalogProduct = {
  id?: string;
  real: boolean;
  code: string;
  name: string;
  family: string;
  categoriaComercialCodigo: string;
  categoriaComercialNombre: string;
  subcategoriaComercialCodigo: string;
  subcategoriaComercialNombre: string;
  cobro: "Por unidad" | "Por m²" | "Por metro lineal";
  unidad: "u." | "m²" | "ml";
  medidasMode: "fija" | "calculada";
  precioBase: number;
  precioConfigJson?: unknown;
  descripcion: string;
  specs: CatalogSpec[];
  adicionales: CatalogAdicional[];
  qtyDefault: number;
  costoUnitario: number;
  impuestoPct: number;
};

type PiezaInput = {
  uiKey: string;
  cantidad: number;
  anchoMm: number;
  altoMm: number;
};

type ModoCotizacionLineal = "nesting" | "directo";

type SlotComercialElige = {
  configPasoId: string;
  familiaCodigo: string;
  modoActivacion: string | null;
  modoSeleccion: string;
  formula: string;
  slotCodigo: string;
  candidatos: SlotMaterialCandidato[];
};

type SlotMaterialCandidato = {
  materiaPrimaId: string;
  label: string;
  defaultVarianteId?: string | null;
  variantes: Array<{
    variantId: string;
    label: string;
    description: string;
    sku: string;
    isFallbackLabel: boolean;
    sortEspesor: number | null;
    espesorLabel: string | null;
    anchoLabel: string | null;
    anchoMm: number | null;
    colorLabel: string | null;
    missingPrice: boolean;
  }>;
};

type ModoColorComercial = {
  configPasoId: string;
  familiaCodigo: string;
  modoActivacion: string | null;
  options: Array<{
    value: string;
    label: string;
    perfilIds: string[];
  }>;
  defaultMode?: string;
};

type MotorConfigState = {
  rutaAlternativaId: string;
  medidaPredefinidaId: string;
  caras: 1 | 2;
  tipoCopia: 1 | 2 | 3;
  numerosXTalonario: number;
  piezas: PiezaInput[];
  opcionalesActivados: Record<string, boolean>;
  seleccionMaterial: Record<string, string>;
  seleccionMaquina: Record<string, string>;
  seleccionModoColor: Record<string, string>;
  modoCotizacionLineal: ModoCotizacionLineal;
  zonaInstalacion: string;
  m2Instalados: number;
};

type CotizacionExitosa = CotizacionPropuestaSnapshot;

type AgregarProductoSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productos: ProductoListItem[];
  fechaEntregaDefault: string;
  onAddItem: (item: PropuestaItem) => void;
  editingItem?: PropuestaItem | null;
  onSaveItem?: (item: PropuestaItem) => void;
};

const ZONAS_VIATICO = [
  { value: "CABA", label: "CABA" },
  { value: "GBA_NORTE", label: "GBA Norte" },
  { value: "GBA_OESTE", label: "GBA Oeste" },
  { value: "GBA_SUR", label: "GBA Sur" },
  { value: "FUERA_AMBA", label: "Fuera AMBA" },
];
const MATERIAL_BASE_SLOT_CODES = new Set([
  "sustrato_principal",
  "material_principal",
  "material_base",
  "soporte_principal",
]);

const DEFAULT_MOTOR_CONFIG: MotorConfigState = {
  rutaAlternativaId: "",
  medidaPredefinidaId: "",
  caras: 1,
  tipoCopia: 1,
  numerosXTalonario: 50,
  piezas: [],
  opcionalesActivados: {},
  seleccionMaterial: {},
  seleccionMaquina: {},
  seleccionModoColor: {},
  modoCotizacionLineal: "nesting",
  zonaInstalacion: "CABA",
  m2Instalados: 0,
};

function materialSelectionKey(configPasoId: string, slotCodigo: string) {
  return `${configPasoId}_${slotCodigo}`;
}

function defaultSlotCandidateId(slot: SlotComercialElige) {
  const firstWithDefault = slot.candidatos.find((candidate) => candidate.defaultVarianteId);
  if (firstWithDefault?.defaultVarianteId) return firstWithDefault.defaultVarianteId;
  if (slot.candidatos.length === 1 && slot.candidatos[0]?.variantes.length === 1) {
    return slot.candidatos[0].variantes[0]?.variantId;
  }
  return undefined;
}

function familyColor(family: string) {
  return (
    {
      Digital: "v",
      "Gran formato": "f",
      Offset: "d",
      Talonario: "g",
      Stand: "v",
    }[family] ?? "g"
  );
}

function ApAtomMode({ mode }: { mode: CatalogProduct["cobro"] }) {
  return mode === "Por m²" ? <Grid2X2Icon /> : <ListIcon />;
}

function getExactPricingQuantitiesFromConfig(precioConfigJson: unknown) {
  if (!precioConfigJson || typeof precioConfigJson !== "object") return [];
  const config = precioConfigJson as {
    metodoCalculo?: unknown;
    detalle?: { tiers?: unknown };
  };
  if (
    config.metodoCalculo !== "fijado_por_cantidad" &&
    config.metodoCalculo !== "fijo_con_margen_variable"
  ) {
    return [];
  }
  const tiers = Array.isArray(config.detalle?.tiers) ? config.detalle.tiers : [];
  return Array.from(
    new Set(
      tiers
        .map((tier) =>
          tier && typeof tier === "object"
            ? Number((tier as { quantity?: unknown }).quantity)
            : NaN,
        )
        .filter((quantity) => Number.isFinite(quantity) && quantity > 0),
    ),
  ).sort((a, b) => a - b);
}

function getExactPricingQuantities(product: CatalogProduct | null) {
  return product ? getExactPricingQuantitiesFromConfig(product.precioConfigJson) : [];
}

function coerceQtyToPricingOptions(qty: number, product: CatalogProduct | null) {
  const exactQuantities = getExactPricingQuantities(product);
  if (exactQuantities.length === 0) return qty;
  return exactQuantities.includes(qty) ? qty : (exactQuantities[0] ?? qty);
}

function getCantidadDefault(producto: ProductoListItem) {
  const exactQuantities = getExactPricingQuantitiesFromConfig(producto.precioConfigJson);
  if (exactQuantities.length > 0) return exactQuantities[0] ?? 1;
  if (producto.unidadComercial === "m2") return 1;
  if (producto.unidadComercial === "metro_lineal") return 1;
  if (producto.subcategoriaComercial?.codigo === "tarjetas") return 500;
  if (producto.subcategoriaComercial?.codigo === "talonarios") return 25;
  return 1;
}

function formatDefaultMedidas(producto: ProductoListItem) {
  const medidaDefault = getMedidaDefault(producto);
  if (medidaDefault) {
    return `${Math.round(medidaDefault.anchoMm)} x ${Math.round(medidaDefault.altoMm)} mm`;
  }
  if (producto.medidaDefaultAnchoMm && producto.medidaDefaultAltoMm) {
    const ancho = Number(producto.medidaDefaultAnchoMm);
    const alto = Number(producto.medidaDefaultAltoMm);
    if (Number.isFinite(ancho) && Number.isFinite(alto)) {
      return `${Math.round(ancho)} x ${Math.round(alto)} mm`;
    }
  }
  return producto.modoMedidas === "LIBRE" ? "Medidas libres" : "A definir";
}

function getSelectedPredefinedMeasure(
  producto: ProductoDetalle | null,
  medidaPredefinidaId: string,
) {
  if (!producto || producto.modoMedidas !== "FIJA") return null;
  const medidas = getMedidasPredefinidas(producto);
  return (
    medidas.find((medida) => medida.id === medidaPredefinidaId) ??
    medidas.find((medida) => medida.esDefault) ??
    medidas[0] ??
    null
  );
}

function formatMedidaPredefinidaSpec(
  medida: ReturnType<typeof getSelectedPredefinedMeasure>,
) {
  if (!medida) return "";
  const size = `${medida.anchoMm} x ${medida.altoMm} mm`;
  const label = medidaLabel(medida);
  return label === size ? size : `${label} · ${size}`;
}

function stringFromAttribute(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function stringFromAttributes(
  atributos: Record<string, unknown>,
  keys: string[],
  fallback: string,
) {
  for (const key of keys) {
    const value = atributos[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function getCommercialSpecFallback(
  producto: ProductoListItem | ProductoDetalle,
  key: string,
  atributos: Record<string, unknown>,
) {
  const medidas = formatDefaultMedidas(producto);
  const fallbackByKey: Record<string, string> = {
    medidas,
    formato_medidas: stringFromAttributes(
      atributos,
      ["formato_medidas", "medidas", "formato"],
      medidas,
    ),
    tipo_copia: stringFromAttributes(
      atributos,
      ["tipo_copia", "copias_hojas"],
      "A definir",
    ),
    hojas_por_talonario: stringFromAttributes(
      atributos,
      ["hojas_por_talonario", "hojas", "copias_hojas"],
      "A definir",
    ),
    encuadernacion_base: stringFromAttributes(
      atributos,
      ["encuadernacion_base", "encuadernacion"],
      "A definir",
    ),
    impresion: stringFromAttributes(
      atributos,
      ["impresion", "impresion_color", "color"],
      "A definir",
    ),
    tecnologia: stringFromAttributes(
      atributos,
      ["tecnologia", "tecnologia_proceso", "proceso"],
      "A definir",
    ),
    servicio_vendido: stringFromAttributes(
      atributos,
      ["servicio_vendido", "servicio"],
      "A definir",
    ),
    servicio_proceso: stringFromAttributes(
      atributos,
      ["servicio_proceso", "servicio", "proceso"],
      "A definir",
    ),
    area_aplicacion: stringFromAttributes(
      atributos,
      ["area_aplicacion", "area"],
      "A definir",
    ),
  };

  return stringFromAttribute(atributos[key], fallbackByKey[key] ?? "A definir");
}

function humanizeCodigo(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function getRutaSeleccionada(
  producto: ProductoDetalle | null,
  rutaAlternativaId: string,
) {
  if (!producto) return null;
  return (
    producto.rutasAlternativas.find((ruta) => ruta.id === rutaAlternativaId) ??
    producto.rutasAlternativas.find((ruta) => ruta.esPreferida) ??
    producto.rutasAlternativas[0] ??
    null
  );
}

function isExecutableConfigPaso(
  config: RutaAlternativaDetalle["configPasos"][number],
) {
  return config.rutaPaso.activo && config.modoActivacion !== "NO_EJECUTAR";
}

function mapSlotMaterial(
  config: RutaAlternativaDetalle["configPasos"][number],
  slot: RutaAlternativaDetalle["configPasos"][number]["slotsMateriales"][number],
): SlotComercialElige {
  return {
          configPasoId: config.id,
          familiaCodigo: config.rutaPaso.familiaCodigo,
          modoActivacion: config.modoActivacion,
          modoSeleccion: slot.modoSeleccion,
          formula: slot.formula,
          slotCodigo: slot.slotCodigo,
          candidatos: slot.candidatos.map((candidate) => ({
            materiaPrimaId: candidate.materiaPrimaId,
            label: candidate.materiaPrima.nombre,
            defaultVarianteId: candidate.defaultVarianteId,
            variantes: sortSlotMaterialVariantsByThickness(
              candidate.variantes.map((item) => {
                const variante = {
                  sku: item.variante.sku,
                  nombreVariante: item.variante.nombreVariante,
                  precioReferencia: item.variante.precioReferencia,
                  atributosVarianteJson: item.variante.atributosVarianteJson,
                };
                const display = getSlotMaterialVariantDisplay(
                  candidate.materiaPrima,
                  variante,
                );
                return {
                  variantId: item.variante.id,
                  label: display.label,
                  description: display.description,
                  sku: display.fallbackCode,
                  isFallbackLabel: display.details.length === 0,
                  sortEspesor: getSlotMaterialVariantSortValue(variante),
                  espesorLabel: getVariantThicknessLabel(
                    item.variante.atributosVarianteJson,
                  ),
                  anchoLabel: getVariantWidthLabel(
                    item.variante.atributosVarianteJson,
                  ),
                  anchoMm: getVariantWidthMm(
                    item.variante.atributosVarianteJson,
                  ),
                  colorLabel: getVariantColorLabel(
                    item.variante.atributosVarianteJson,
                  ),
                  missingPrice: Number(item.variante.precioReferencia ?? 0) <= 0,
                };
              }),
            ),
          })),
        };
}

function getSlotsComercialElige(ruta: RutaAlternativaDetalle | null) {
  return (
    ruta?.configPasos
      .filter(isExecutableConfigPaso)
      .flatMap((config) =>
        config.slotsMateriales
          .filter((slot) => slot.modoSeleccion === "COMERCIAL_ELIGE")
          .map((slot) => mapSlotMaterial(config, slot)),
      ) ?? []
  );
}

function getSlotsMaterialesLinealDirecto(ruta: RutaAlternativaDetalle | null) {
  return (
    ruta?.configPasos
      .filter(isExecutableConfigPaso)
      .flatMap((config) =>
        config.slotsMateriales
          .filter(
            (slot) =>
              slot.formula === "por_metro_lineal" &&
              (slot.modoSeleccion === "COMERCIAL_ELIGE" ||
                slot.modoSeleccion === "MOTOR_ELIGE_AUTO"),
          )
          .map((slot) => mapSlotMaterial(config, slot)),
      ) ?? []
  );
}

function mergeSlotsMateriales(slots: SlotComercialElige[]) {
  const deduped = new Map<string, SlotComercialElige>();
  for (const slot of slots) {
    deduped.set(materialSelectionKey(slot.configPasoId, slot.slotCodigo), slot);
  }
  return Array.from(deduped.values());
}

function getSlotsParaCotizacion(
  ruta: RutaAlternativaDetalle | null,
  productoDetalle: ProductoDetalle | null,
  config: Pick<MotorConfigState, "modoCotizacionLineal">,
) {
  const slotsComerciales = getSlotsComercialElige(ruta);
  if (
    isMetroLinealConMedidasVariables(productoDetalle) &&
    config.modoCotizacionLineal === "directo"
  ) {
    return mergeSlotsMateriales([
      ...slotsComerciales,
      ...getSlotsMaterialesLinealDirecto(ruta),
    ]);
  }
  return slotsComerciales;
}

function getModoColorConfig(params: unknown): {
  enabled?: boolean;
  comercialElige?: boolean;
  defaultMode?: string;
  allowedModes?: string[];
} {
  if (!params || typeof params !== "object") return {};
  const config = (params as { modoColorConfig?: unknown }).modoColorConfig;
  if (!config || typeof config !== "object") return {};
  return config as {
    enabled?: boolean;
    comercialElige?: boolean;
    defaultMode?: string;
    allowedModes?: string[];
  };
}

function normalizeModoColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/WHITE/g, "BLANCO")
    .replace(/W/g, "BLANCO")
    .replace(/BARNIZ|VARNISH|VERNIS/g, "BARNIZ");
  if (!normalized) return undefined;
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
  if (["BN", "B/N", "K", "NEGRO", "BLACK"].includes(normalized)) return "BN";
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

function getModosColorComercial(ruta: RutaAlternativaDetalle | null) {
  return (
    ruta?.configPasos
      .filter(isExecutableConfigPaso)
      .map((config) => {
        const modoConfig = getModoColorConfig(config.paramsPasoJson);
        const allowedModes = Array.isArray(modoConfig.allowedModes)
          ? modoConfig.allowedModes.map(normalizeModoColor).filter(Boolean)
          : [];
        const options = (config.modoColorOptions ?? []).filter(
          (option) =>
            allowedModes.length === 0 ||
            allowedModes.includes(normalizeModoColor(option.value) ?? ""),
        );
        if (options.length === 0) return null;
        const enabled = modoConfig.enabled === true;
        const comercialElige =
          modoConfig.comercialElige === true ||
          (modoConfig.enabled !== false && options.length > 1);
        if (!enabled && !comercialElige && options.length !== 1) return null;
        const modo: ModoColorComercial = {
          configPasoId: config.id,
          familiaCodigo: config.rutaPaso.familiaCodigo,
          modoActivacion: config.modoActivacion,
          options,
          defaultMode: normalizeModoColor(modoConfig.defaultMode),
        };
        return modo;
      })
      .filter((modo): modo is ModoColorComercial => modo !== null) ?? []
  );
}

function getPasosConCandidatas(ruta: RutaAlternativaDetalle | null) {
  return (
    ruta?.configPasos
      .filter(isExecutableConfigPaso)
      .filter((config) => (config.maquinasCandidatas?.length ?? 0) > 1)
      .map((config) => ({
        configPasoId: config.id,
        familiaCodigo: config.rutaPaso.familiaCodigo,
        candidatas: config.maquinasCandidatas ?? [],
      })) ?? []
  );
}

function getProductoNecesitaInstalacion(producto: ProductoDetalle | null) {
  return (
    producto?.cargosDirectosCotizacion.some(
      (cargo) => cargo.cargoDirectoCatalogo.codigo === "viatico",
    ) ?? false
  );
}

function getSlotsOpcionalesPorPaso(slots: SlotComercialElige[]) {
  const map = new Map<string, SlotComercialElige[]>();
  for (const slot of slots) {
    if (slot.modoActivacion !== "OPCIONAL") continue;
    map.set(slot.configPasoId, [...(map.get(slot.configPasoId) ?? []), slot]);
  }
  return map;
}

function isActiveConfigPaso(
  config: RutaAlternativaDetalle["configPasos"][number],
  motorConfig: MotorConfigState,
) {
  return (
    isExecutableConfigPaso(config) &&
    (config.modoActivacion !== "OPCIONAL" ||
      Boolean(motorConfig.opcionalesActivados[config.id]))
  );
}

function getActiveConfigPasos(
  ruta: RutaAlternativaDetalle | null,
  motorConfig: MotorConfigState,
) {
  return ruta?.configPasos.filter((config) => isActiveConfigPaso(config, motorConfig)) ?? [];
}

function formatNumberForSpec(value: number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function parseDecimalInput(value: string) {
  const normalized = value.trim().replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getTextAttr(attrs: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const raw = attrs?.[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  }
  return null;
}

function getVariantThicknessLabel(attrs: Record<string, unknown> | null | undefined) {
  const entries = [
    { value: attrs?.espesor, unit: "mm" },
    { value: attrs?.espesorMm, unit: "mm" },
    { value: attrs?.espesor_mm, unit: "mm" },
    { value: attrs?.espesorMicrones, unit: "mic" },
  ];
  const entry = entries.find(
    ({ value }) => value !== undefined && value !== null && value !== "",
  );
  const raw = entry?.value;
  const value =
    typeof raw === "string" ? Number(raw.replace(",", ".")) : Number(raw);
  if (!Number.isFinite(value)) return null;
  return `${formatNumberForSpec(value)} ${entry?.unit ?? "mm"}`;
}

function getVariantWidthLabel(attrs: Record<string, unknown> | null | undefined) {
  const value = getVariantWidthMm(attrs);
  return value ? `${formatNumberForSpec(value / 10)} cm` : null;
}

function getVariantWidthMm(attrs: Record<string, unknown> | null | undefined) {
  const mmEntries = [
    attrs?.anchoMm,
    attrs?.ancho_mm,
    attrs?.anchoRolloMm,
    attrs?.anchoUtilMm,
    attrs?.widthMm,
  ];
  const rawMm = mmEntries.find(
    (value) => value !== undefined && value !== null && value !== "",
  );
  const valueMm =
    typeof rawMm === "string" ? Number(rawMm.replace(",", ".")) : Number(rawMm);
  if (Number.isFinite(valueMm) && valueMm > 0) return valueMm;

  const rawAncho = attrs?.ancho;
  const ancho =
    typeof rawAncho === "string"
      ? Number(rawAncho.replace(",", "."))
      : Number(rawAncho);
  if (!Number.isFinite(ancho) || ancho <= 0) return null;
  return ancho <= 10 ? ancho * 1000 : ancho;
}

function getVariantColorLabel(attrs: Record<string, unknown> | null | undefined) {
  return getTextAttr(attrs, ["colorBase", "color", "colorMaterial"]);
}

function candidateUsesColorThickness(candidate: SlotMaterialCandidato) {
  return candidate.variantes.some((variant) => variant.colorLabel && variant.espesorLabel);
}

function getSelectedMaterialSummaries(
  slotsComercialElige: SlotComercialElige[],
  config: MotorConfigState,
) {
  const requiredSlots = slotsComercialElige.filter(
    (slot) => slot.modoActivacion !== "OPCIONAL",
  );
  const baseSlots = requiredSlots.filter((slot) =>
    MATERIAL_BASE_SLOT_CODES.has(slot.slotCodigo),
  );
  const slotsForSummary = baseSlots.length > 0 ? baseSlots : requiredSlots;

  return slotsForSummary
    .map((slot) => {
      const selectedId =
        config.seleccionMaterial[materialSelectionKey(slot.configPasoId, slot.slotCodigo)] ||
        defaultSlotCandidateId(slot);
      const selectedCandidate = slot.candidatos.find((candidate) =>
        candidate.variantes.some((variant) => variant.variantId === selectedId),
      );
      const selectedVariant = selectedCandidate?.variantes.find(
        (variant) => variant.variantId === selectedId,
      );
      if (!selectedCandidate && !selectedVariant) return null;
      return {
        material: selectedCandidate?.label,
        espesor: selectedVariant?.espesorLabel ?? null,
      };
    })
    .filter(
      (
        summary,
      ): summary is { material: string | undefined; espesor: string | null } =>
        summary !== null,
    );
}

const IMPRESSION_TECH_LABELS: Record<string, string> = {
  LATEX: "Látex",
  SOLVENTE: "Solvente",
  UV: "UV",
  SUBLIMACION: "Sublimación",
  DTF_UV: "DTF UV",
  DTF_TEXTIL: "DTF textil",
};

function getMachineTemplate(config: RutaAlternativaDetalle["configPasos"][number]) {
  return config.maquinaM1?.plantilla?.toUpperCase() ?? "";
}

function getImpressionProcessLabel(
  config: RutaAlternativaDetalle["configPasos"][number],
) {
  const tecnologia = config.maquinaM1?.parametrosTecnicosJson?.tecnologia;
  const normalizedTech =
    typeof tecnologia === "string" ? tecnologia.trim().toUpperCase() : "";
  const techLabel = IMPRESSION_TECH_LABELS[normalizedTech];
  return techLabel ? `Impresión ${techLabel}` : "Impresión";
}

function getProcessLabels(
  rutaSeleccionada: RutaAlternativaDetalle | null,
  config: MotorConfigState,
) {
  const labels: string[] = [];
  for (const paso of getActiveConfigPasos(rutaSeleccionada, config)) {
    const familia = paso.rutaPaso.familiaCodigo;
    const template = getMachineTemplate(paso);
    if (
      familia.startsWith("impresion_") ||
      template.includes("IMPRESORA")
    ) {
      labels.push(getImpressionProcessLabel(paso));
      continue;
    }
    if (familia.includes("laser") || template.includes("LASER")) {
      labels.push("Láser");
      continue;
    }
    if (familia === "cnc" || template.includes("CNC")) {
      labels.push("CNC");
    }
  }
  return Array.from(new Set(labels));
}

function getOpcionales(
  producto: ProductoListItem | ProductoDetalle,
  rutaSeleccionada?: RutaAlternativaDetalle | null,
): CatalogAdicional[] {
  const opcionales = new Map<string, CatalogAdicional>();

  if ("cargosDirectosCotizacion" in producto) {
    for (const cargo of producto.cargosDirectosCotizacion) {
      if (cargo.modoActivacion !== "OPCIONAL") continue;
      opcionales.set(cargo.id, {
        code: cargo.id,
        name: cargo.cargoDirectoCatalogo.nombre,
        descripcion: "Cargo directo opcional de la cotización.",
        origen: "cargo",
      });
    }
  }

  if ("cargosDirectosCotizacion" in producto) {
    const rutas = rutaSeleccionada
      ? [rutaSeleccionada]
      : producto.rutasAlternativas;
    for (const ruta of rutas) {
      for (const config of ruta.configPasos) {
        if (!isExecutableConfigPaso(config)) continue;
        if (config.modoActivacion === "OPCIONAL") {
          opcionales.set(config.id, {
            code: config.id,
            name: humanizeCodigo(config.rutaPaso.familiaCodigo),
            descripcion: "Paso productivo opcional.",
            origen: "paso",
          });
        }
        for (const cargo of config.cargosDirectosPaso) {
          if (cargo.modoActivacion !== "OPCIONAL") continue;
          opcionales.set(cargo.id, {
            code: cargo.id,
            name: cargo.cargoDirectoCatalogo.nombre,
            descripcion: "Cargo directo opcional del paso.",
            origen: "cargo",
          });
        }
      }
    }
  }

  return Array.from(opcionales.values());
}

function mapProductoReal(producto: ProductoListItem | ProductoDetalle): CatalogProduct {
  const categoria = producto.subcategoriaComercial.categoria;
  const subcategoria = producto.subcategoriaComercial;
  const atributos = producto.atributosComercialesJson ?? {};
  const schema = subcategoria.atributosSchemaJson.length
    ? subcategoria.atributosSchemaJson
    : [
        { key: "detalle", label: "Detalle", tipo: "text", visible: true, orden: 10 },
      ];
  const unidad =
    producto.unidadComercial === "m2"
      ? "m²"
      : producto.unidadComercial === "metro_lineal"
        ? "ml"
        : "u.";

  return {
    id: producto.id,
    real: true,
    code: producto.codigo,
    name: producto.nombre,
    family: subcategoria.nombre,
    categoriaComercialCodigo: categoria.codigo,
    categoriaComercialNombre: categoria.nombre,
    subcategoriaComercialCodigo: subcategoria.codigo,
    subcategoriaComercialNombre: subcategoria.nombre,
    cobro:
      producto.unidadComercial === "m2"
        ? "Por m²"
        : producto.unidadComercial === "metro_lineal"
          ? "Por metro lineal"
          : "Por unidad",
    unidad,
    medidasMode: producto.modoMedidas === "LIBRE" ? "calculada" : "fija",
    precioBase: 0,
    precioConfigJson: producto.precioConfigJson,
    descripcion: producto.descripcion ?? categoria.nombre,
    specs: schema
      .filter((spec) => spec.visible)
      .sort((a, b) => a.orden - b.orden)
      .map((spec) => {
        const def = getCommercialSpecFallback(producto, spec.key, atributos);
        return {
          key: spec.key,
          label: spec.label,
          type: (spec.tipo === "select" ? "select" : "text") as CatalogSpec["type"],
          def,
        };
      })
      .filter((spec) => shouldShowCommercialSpec(spec, spec.def, { real: true })),
    adicionales: getOpcionales(producto),
    qtyDefault: getCantidadDefault(producto),
    costoUnitario: 0,
    impuestoPct: 0,
  };
}

function getTotals(product: CatalogProduct, qty: number, adi: string[]) {
  if (product.real) {
    return {
      subtotal: 0,
      adicionalesMonto: 0,
      subtotalConAdi: 0,
      impuestos: 0,
      costoEstimado: 0,
      total: 0,
      margen: 0,
    };
  }
  const subtotal = Math.round(qty * product.precioBase);
  const adicionalesMonto = adi.reduce((sum, code) => {
    const item = product.adicionales.find((adicional) => adicional.code === code);
    return sum + (item?.monto ?? 0);
  }, 0);
  const subtotalConAdi = subtotal + adicionalesMonto;
  const impuestos = Math.round(subtotalConAdi * (product.impuestoPct / 100));
  const costoEstimado = Math.round(qty * product.costoUnitario);
  const total = subtotalConAdi + impuestos;
  const margen =
    subtotalConAdi > 0
      ? ((subtotalConAdi - costoEstimado) / subtotalConAdi) * 100
      : 0;

  return { subtotal, adicionalesMonto, subtotalConAdi, impuestos, costoEstimado, total, margen };
}

function getCotizacionExitosa(res: CotizarResponse | null) {
  return res?.exitoso && res.cotizacion ? res.cotizacion : null;
}

function getCotizacionNeto(cotizacion: CotizacionExitosa) {
  return (
    cotizacion.desglosePrecio?.precioNetoTotal ??
    cotizacion.precio?.precioTotal ??
    cotizacion.costos.total
  );
}

function getCotizacionTotal(cotizacion: CotizacionExitosa) {
  return (
    cotizacion.desglosePrecio?.precioBrutoTotal ??
    cotizacion.precio?.precioTotal ??
    cotizacion.costos.total
  );
}

function getCotizacionUnitario(cotizacion: CotizacionExitosa) {
  return (
    cotizacion.desglosePrecio?.precioBrutoUnitario ??
    cotizacion.precio?.precioUnitario ??
    cotizacion.costos.unitario
  );
}

function getCotizacionImpuestos(cotizacion: CotizacionExitosa) {
  if (cotizacion.desglosePrecio) {
    return (
      cotizacion.desglosePrecio.precioBrutoTotal -
      cotizacion.desglosePrecio.precioNetoTotal
    );
  }
  return 0;
}

function getCotizacionMargen(cotizacion: CotizacionExitosa) {
  if (cotizacion.desglosePrecio) return cotizacion.desglosePrecio.margenEfectivoPct;
  const neto = getCotizacionNeto(cotizacion);
  return neto > 0 ? ((neto - cotizacion.costos.total) / neto) * 100 : 0;
}

function labelPrecioUnitario(unidad: string) {
  if (unidad === "m²") return "Precio por m²";
  if (unidad === "ml") return "Precio por metro lineal";
  return "Precio por unidad";
}

function isMetroLinealConMedidasVariables(productoDetalle: ProductoDetalle | null) {
  return (
    productoDetalle?.unidadComercial === "metro_lineal" &&
    (productoDetalle.modoMedidas === "LIBRE" ||
      productoDetalle.modoMedidas === "COMERCIAL_ELIGE")
  );
}

function usaPiezasParaCotizar(
  productoDetalle: ProductoDetalle | null,
  config: Pick<MotorConfigState, "modoCotizacionLineal">,
) {
  return (
    (productoDetalle?.modoMedidas === "LIBRE" &&
      !isMetroLinealConMedidasVariables(productoDetalle)) ||
    (isMetroLinealConMedidasVariables(productoDetalle) &&
      config.modoCotizacionLineal === "nesting")
  );
}

function getCotizacionPasos(cotizacion: CotizacionExitosa): PasoProduccionPropuesta[] {
  return cotizacion.pasos
    .filter((paso) => paso.activado)
    .map((paso) => ({
      nombre: paso.nombreVisible?.trim() || humanizeCodigo(paso.familiaCodigo),
      centroCosto: paso.tiempo ? "Producción" : "Proceso",
      minutos: paso.tiempo?.totalMin ?? 0,
      origen: "base",
    }));
}

function defaultSpecs(product: CatalogProduct) {
  return Object.fromEntries(product.specs.map((spec) => [spec.key, spec.def]));
}

function getSelectedLinearMaterialWidthMm(
  slotsComercialElige: SlotComercialElige[],
  config: MotorConfigState,
) {
  for (const slot of slotsComercialElige) {
    if (slot.formula !== "por_metro_lineal") continue;
    const key = materialSelectionKey(slot.configPasoId, slot.slotCodigo);
    const selected = config.seleccionMaterial[key] || defaultSlotCandidateId(slot);
    if (!selected) continue;
    for (const candidate of slot.candidatos) {
      const variant = candidate.variantes.find((item) => item.variantId === selected);
      if (variant?.anchoMm) return variant.anchoMm;
    }
  }
  return null;
}

function buildJobContext(
  productoDetalle: ProductoDetalle | null,
  config: MotorConfigState,
  qty: number,
  slotsComercialElige: SlotComercialElige[],
) {
  const medidaPredefinida = getSelectedPredefinedMeasure(
    productoDetalle,
    config.medidaPredefinidaId,
  );
  const cotizaConPiezas = usaPiezasParaCotizar(productoDetalle, config);
  const cotizaLinealDirecto =
    isMetroLinealConMedidasVariables(productoDetalle) &&
    config.modoCotizacionLineal === "directo";
  const cantidadTrabajo =
    cotizaLinealDirecto
      ? 1
      : cotizaConPiezas
      ? config.piezas.reduce(
          (total, pieza) =>
            total + (Number.isFinite(pieza.cantidad) ? pieza.cantidad : 0),
          0,
        ) || 1
      : qty;
  const ctx: Record<string, unknown> = {
    cantidad: cantidadTrabajo,
    caras: config.caras,
    tipoCopia: config.tipoCopia,
    numerosXTalonario: config.numerosXTalonario,
    opcionalesActivados: config.opcionalesActivados,
  };
  const anchoMaterialLinealMm =
    cotizaLinealDirecto
      ? getSelectedLinearMaterialWidthMm(slotsComercialElige, config)
      : null;
  const piezaLinealDirecta =
    anchoMaterialLinealMm && qty > 0
      ? [
          {
            uiKey: "lineal-directo",
            cantidad: 1,
            anchoMm: anchoMaterialLinealMm,
            altoMm: qty * 1000,
          },
        ]
      : [];

  const piezasContexto =
    cotizaConPiezas && config.piezas.length > 0
      ? config.piezas
      : piezaLinealDirecta.length > 0
        ? piezaLinealDirecta
      : medidaPredefinida
        ? [
            {
              uiKey: medidaPredefinida.id,
              cantidad: cantidadTrabajo,
              anchoMm: medidaPredefinida.anchoMm,
              altoMm: medidaPredefinida.altoMm,
            },
          ]
        : [];

  if (piezasContexto.length > 0) {
    ctx.piezas = piezasContexto.map((pieza) => ({
      cantidad: pieza.cantidad,
      anchoMm: pieza.anchoMm,
      altoMm: pieza.altoMm,
    }));
    ctx.piezaAnchoMaxMm = Math.max(...piezasContexto.map((pieza) => pieza.anchoMm));
    ctx.piezaAltoMaxMm = Math.max(...piezasContexto.map((pieza) => pieza.altoMm));
    ctx.piezaAreaTotalM2 = piezasContexto.reduce(
      (total, pieza) =>
        total + (pieza.cantidad * pieza.anchoMm * pieza.altoMm) / 1_000_000,
      0,
    );
    if (piezasContexto.length === 1) {
      ctx.medidaCustomMm = {
        anchoMm: piezasContexto[0].anchoMm,
        altoMm: piezasContexto[0].altoMm,
      };
    }
    if (medidaPredefinida) {
      ctx.medidaPredefinidaId = medidaPredefinida.id;
      ctx.medidaPredefinidaNombre = medidaLabel(medidaPredefinida);
    }
  }

  if (isMetroLinealConMedidasVariables(productoDetalle)) {
    ctx.modoCotizacionLineal = config.modoCotizacionLineal;
    if (cotizaLinealDirecto) {
      ctx.cantidadComercialPricing = qty;
      ctx.cantidadComercial = qty;
      ctx.metrosLineales = qty;
      if (anchoMaterialLinealMm) {
        ctx.anchoMaterialMm = anchoMaterialLinealMm;
        ctx.largoMaterialMm = qty * 1000;
      }
    }
  }

  if (config.m2Instalados > 0) ctx.m2_instalados = config.m2Instalados;
  if (config.zonaInstalacion) ctx.zonaInstalacion = config.zonaInstalacion;

  const slotCounts = slotsComercialElige.reduce<Record<string, number>>(
    (acc, slot) => ({
      ...acc,
      [slot.slotCodigo]: (acc[slot.slotCodigo] ?? 0) + 1,
    }),
    {},
  );
  const slotMateriales: Record<string, string> = {};
  for (const slot of slotsComercialElige) {
    const key = materialSelectionKey(slot.configPasoId, slot.slotCodigo);
    const variantId = config.seleccionMaterial[key] || defaultSlotCandidateId(slot);
    if (!variantId) continue;
    slotMateriales[key] = variantId;
    ctx[`slotMaterial_${key}`] = variantId;
    if (slotCounts[slot.slotCodigo] === 1) {
      slotMateriales[slot.slotCodigo] = variantId;
      ctx[`slotMaterial_${slot.slotCodigo}`] = variantId;
    }
  }
  if (Object.keys(slotMateriales).length > 0) ctx.slotMateriales = slotMateriales;

  for (const [configPasoId, maquinaId] of Object.entries(config.seleccionMaquina)) {
    if (maquinaId) ctx[`maquinaSeleccionada_${configPasoId}`] = maquinaId;
  }

  const rutaSel = getRutaSeleccionada(productoDetalle, config.rutaAlternativaId);
  const modosColorComercial = getModosColorComercial(rutaSel).filter(
    (modo) =>
      modo.modoActivacion !== "OPCIONAL" ||
      Boolean(config.opcionalesActivados[modo.configPasoId]),
  );
  const modoColorPorPaso: Record<string, string> = {};
  for (const modo of modosColorComercial) {
    const selected =
      normalizeModoColor(config.seleccionModoColor[modo.configPasoId]) ??
      modo.defaultMode ??
      normalizeModoColor(modo.options[0]?.value);
    if (!selected) continue;
    modoColorPorPaso[modo.configPasoId] = selected;
    ctx[`modoColor_${modo.configPasoId}`] = selected;
    if (modosColorComercial.length === 1) ctx.modoColor = selected;
  }
  if (Object.keys(modoColorPorPaso).length > 0) {
    ctx.modoColorPorPaso = modoColorPorPaso;
  }

  return ctx;
}

function calcularCantidadComercial(
  product: CatalogProduct,
  productoDetalle: ProductoDetalle | null,
  config: MotorConfigState | undefined,
  qty: number,
) {
  if (config && usaPiezasParaCotizar(productoDetalle, config) && config.piezas.length) {
    const totalPiezas = config.piezas.reduce(
      (total, pieza) =>
        total + (Number.isFinite(pieza.cantidad) ? pieza.cantidad : 0),
      0,
    );
    if (product.unidad !== "m²" && product.unidad !== "ml") {
      return totalPiezas > 0 ? totalPiezas : qty;
    }
    if (product.unidad === "ml") return qty;

    const areaTotalM2 = config.piezas.reduce(
      (total, pieza) =>
        total + (pieza.cantidad * pieza.anchoMm * pieza.altoMm) / 1_000_000,
      0,
    );
    return areaTotalM2 > 0 ? areaTotalM2 : qty;
  }

  return qty;
}

function buildPresentableSpecs(
  product: CatalogProduct,
  productoDetalle: ProductoDetalle | null,
  config: MotorConfigState,
  specs: Record<string, string>,
  slotsComercialElige: SlotComercialElige[],
) {
  const base = Object.fromEntries(
    product.specs.map((spec) => [spec.key, specs[spec.key] ?? spec.def]),
  );
  const hasSpec = (key: string) => product.specs.some((spec) => spec.key === key);
  const setSpec = (key: string, value: string | undefined) => {
    if (!value) return;
    if (!hasSpec(key) || !hasUsefulSpecValue(value)) return;
    base[key] = value;
  };
  const rutaSeleccionada = getRutaSeleccionada(productoDetalle, config.rutaAlternativaId);
  const hardcodedMaterials =
    rutaSeleccionada?.configPasos
      .filter(
        (paso) => isExecutableConfigPaso(paso) && paso.modoActivacion !== "OPCIONAL",
      )
      .flatMap((paso) => paso.slotsMateriales)
      .filter(
        (slot) =>
          slot.modoSeleccion === "HARDCODED" &&
          MATERIAL_BASE_SLOT_CODES.has(slot.slotCodigo),
      )
      .map((slot) => slot.materialVariante?.nombreVariante ?? slot.materialVariante?.sku)
      .filter((value): value is string => Boolean(value)) ?? [];
  const selectedMaterialSummaries = getSelectedMaterialSummaries(
    slotsComercialElige,
    config,
  );
  const selectedMaterials = selectedMaterialSummaries
    .map((summary) => summary.material)
    .filter((value): value is string => Boolean(value));
  const selectedThicknesses = selectedMaterialSummaries
    .map((summary) => summary.espesor)
    .filter((value): value is string => Boolean(value));

  const baseMaterials = [...hardcodedMaterials, ...selectedMaterials];
  if (selectedMaterials.length > 0) {
    setSpec("material", Array.from(new Set(selectedMaterials)).join(" · "));
  } else if (!hasUsefulSpecValue(base.material) && baseMaterials.length > 0) {
    setSpec("material", Array.from(new Set(baseMaterials)).join(" · "));
  }
  if (selectedThicknesses.length > 0) {
    const espesor = Array.from(new Set(selectedThicknesses)).join(" · ");
    setSpec("espesor", espesor);
    setSpec("espesor_material", espesor);
  }
  if (usaPiezasParaCotizar(productoDetalle, config) && config.piezas.length > 0) {
    const medidas = config.piezas
      .map((pieza) => {
        const unidad = pieza.cantidad === 1 ? "unidad" : "unidades";
        return `${pieza.cantidad} ${unidad} · ${pieza.anchoMm} x ${pieza.altoMm} mm`;
      })
      .join("\n");
    setSpec("medidas", medidas);
    setSpec("formato_medidas", medidas);
    setSpec("m2_medidas_instaladas", medidas);
  } else if (productoDetalle) {
    const medidas = formatDefaultMedidas(productoDetalle);
    setSpec("medidas", medidas);
    setSpec("formato_medidas", medidas);
  }
  const medidaPredefinida = getSelectedPredefinedMeasure(
    productoDetalle,
    config.medidaPredefinidaId,
  );
  if (medidaPredefinida) {
    const medidas = formatMedidaPredefinidaSpec(medidaPredefinida);
    setSpec("medidas", medidas);
    setSpec("formato_medidas", medidas);
  }
  if (hasSpec("caras") || product.subcategoriaComercialCodigo === "tarjetas") {
    setSpec("caras", config.caras === 2 ? "Doble faz" : "Simple faz");
  }
  const modosColor = getModosColorComercial(rutaSeleccionada);
  const selectedModoColorLabels = modosColor
    .filter(
      (modo) =>
        modo.modoActivacion !== "OPCIONAL" ||
        Boolean(config.opcionalesActivados[modo.configPasoId]),
    )
    .map((modo) => {
      const value =
        normalizeModoColor(config.seleccionModoColor[modo.configPasoId]) ??
        modo.defaultMode ??
        normalizeModoColor(modo.options[0]?.value);
      if (!value) return null;
      const label =
        modo.options.find((option) => normalizeModoColor(option.value) === value)?.label ??
        value;
      return modosColor.length > 1
        ? `${humanizeCodigo(modo.familiaCodigo)}: ${label}`
        : label;
    })
    .filter((value): value is string => Boolean(value));
  if (selectedModoColorLabels.length > 0) {
    setSpec("impresion", selectedModoColorLabels.join(" · "));
    setSpec("color", selectedModoColorLabels.join(" · "));
    base.modo_color = selectedModoColorLabels.join(" · ");
  }
  const processLabels = getProcessLabels(rutaSeleccionada, config);
  if (processLabels.length > 0) {
    const proceso = processLabels.join(" / ");
    setSpec("tecnologia", proceso);
    setSpec("tecnologia_proceso", proceso);
    setSpec("proceso", proceso);
  }
  if (product.subcategoriaComercialCodigo === "talonarios") {
    const tipoCopia =
      config.tipoCopia === 1
        ? "Simple"
        : config.tipoCopia === 2
          ? "Duplicado"
          : "Triplicado";
    setSpec("tipo_copia", tipoCopia);
    setSpec("hojas_por_talonario", `${config.numerosXTalonario} hojas`);
    setSpec("copias_hojas", `${tipoCopia} · ${config.numerosXTalonario} hojas`);
  }
  if (hasSpec("zona")) setSpec("zona", config.zonaInstalacion);
  if (hasSpec("m2_medidas_instaladas")) {
    setSpec(
      "m2_medidas_instaladas",
      config.m2Instalados > 0 ? `${config.m2Instalados} m²` : undefined,
    );
  }
  return base;
}

function hasUsefulSpecValue(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length > 0 &&
    normalized !== "a definir" &&
    !normalized.includes("opcional")
  );
}

function shouldShowCommercialSpec(
  spec: CatalogSpec,
  value: string | undefined,
  product: Pick<CatalogProduct, "real">,
) {
  const hiddenKeys = new Set(["tipo_pieza", "tipoPieza", "tipo_de_pieza"]);
  if (hiddenKeys.has(spec.key)) return false;
  if (spec.key === "uso_aplicacion" && value?.trim().toLowerCase() === "interior / exterior") {
    return false;
  }
  return product.real ? hasUsefulSpecValue(value) : true;
}

function buildItem(
  product: CatalogProduct,
  qty: number,
  specs: Record<string, string>,
  adi: string[],
  options?: {
    productoDetalle: ProductoDetalle | null;
    motorConfig: MotorConfigState;
    slotsComercialElige: SlotComercialElige[];
    cotizacion?: CotizarResponse | null;
    notaProduccion?: string;
    itemId?: string;
    fechaEntrega?: string;
  },
) {
  const cotizacion = getCotizacionExitosa(options?.cotizacion ?? null);
  if (!cotizacion) {
    throw new Error("La propuesta solo puede agregar productos cotizados por el Motor Universal.");
  }
  const selectedAdicionales = product.adicionales
    .filter((adicional) => adi.includes(adicional.code))
    .map((adicional) => adicional.name);
  const cargosCotizados =
    cotizacion?.cargosDirectosCotizacion.map((cargo) => cargo.cargoNombre) ?? [];
  const adicionales = Array.from(new Set([...selectedAdicionales, ...cargosCotizados]));
  const especificaciones = options
    ? buildPresentableSpecs(
        product,
        options.productoDetalle,
        options.motorConfig,
        specs,
        options.slotsComercialElige,
      )
    : Object.fromEntries(
        product.specs.map((spec) => [spec.key, specs[spec.key] ?? spec.def]),
      );
  const unidadMedida: UnidadPropuesta =
    product.unidad === "m²"
      ? "m2"
      : product.unidad === "ml"
        ? "metro_lineal"
        : "unidad";
  const pasos: PasoProduccionPropuesta[] = getCotizacionPasos(cotizacion);
  const precioUnitario = getCotizacionUnitario(cotizacion);
  const subtotal = getCotizacionNeto(cotizacion);
  const impuestoMonto = getCotizacionImpuestos(cotizacion);
  const total = getCotizacionTotal(cotizacion);
  const impuestoPorcentaje =
    subtotal > 0 ? (impuestoMonto / subtotal) * 100 : product.impuestoPct;
  const cantidadComercial =
    cotizacion.cantidadComercialPricing ??
    calcularCantidadComercial(
      product,
      options?.productoDetalle ?? null,
      options?.motorConfig,
      qty,
    );
  const jobContext = options
    ? buildJobContext(
        options.productoDetalle,
        options.motorConfig,
        qty,
        options.slotsComercialElige,
      )
    : undefined;
  const notaProduccion = options?.notaProduccion?.trim() ?? "";
  if (jobContext && notaProduccion) {
    jobContext.notasProduccion = notaProduccion;
  }
  const atributosSchema = product.specs.map((spec, index) => ({
    key: spec.key,
    label: spec.label,
    tipo: spec.type,
    visible: shouldShowCommercialSpec(spec, especificaciones[spec.key], product),
    orden: (index + 1) * 10,
  }));
  if (especificaciones.modo_color && !atributosSchema.some((attr) => attr.key === "modo_color")) {
    atributosSchema.push({
      key: "modo_color",
      label: "Modo de color",
      tipo: "text",
      visible: true,
      orden: atributosSchema.length * 10 + 10,
    });
  }

  return {
    id: options?.itemId ?? crypto.randomUUID(),
    productoNombre: product.name,
    productoCodigo: product.code,
    motorCodigo: product.id ?? product.family.toLowerCase().replaceAll(" ", "_"),
    categoriaComercialCodigo: product.categoriaComercialCodigo,
    categoriaComercialNombre: product.categoriaComercialNombre,
    subcategoriaComercialCodigo: product.subcategoriaComercialCodigo,
    subcategoriaComercialNombre: product.subcategoriaComercialNombre,
    varianteNombre: product.descripcion,
    unidadMedida,
    cantidad: cantidadComercial,
    precioUnitario,
    subtotal,
    impuestoPorcentaje,
    impuestoMonto,
    total,
    fechaEntrega: options?.fechaEntrega || undefined,
    especificaciones,
    cotizacion,
    pasos,
    adicionales,
    notaProduccion: notaProduccion || undefined,
    rutaAlternativaId: options?.motorConfig.rutaAlternativaId ?? null,
    jobContext,
    atributosSchema,
  } satisfies PropuestaItem;
}

function motorConfigFromItem(item: PropuestaItem): MotorConfigState {
  const ctx = (item.jobContext ?? {}) as Record<string, unknown>;
  const opcionalesRaw =
    typeof ctx.opcionalesActivados === "object" &&
    ctx.opcionalesActivados !== null &&
    !Array.isArray(ctx.opcionalesActivados)
      ? (ctx.opcionalesActivados as Record<string, unknown>)
      : {};
  const slotMaterialesRaw =
    typeof ctx.slotMateriales === "object" &&
    ctx.slotMateriales !== null &&
    !Array.isArray(ctx.slotMateriales)
      ? (ctx.slotMateriales as Record<string, unknown>)
      : {};
  const seleccionMaquina = Object.fromEntries(
    Object.entries(ctx)
      .filter(([key, value]) => key.startsWith("maquinaSeleccionada_") && typeof value === "string")
      .map(([key, value]) => [
        key.replace("maquinaSeleccionada_", ""),
        value as string,
      ]),
  );
  const seleccionModoColor = Object.fromEntries(
    Object.entries(ctx)
      .filter(([key, value]) => key.startsWith("modoColor_") && typeof value === "string")
      .map(([key, value]) => [key.replace("modoColor_", ""), value as string]),
  );
  const piezasRaw = Array.isArray(ctx.piezas) ? ctx.piezas : [];
  const piezas = piezasRaw
    .map((pieza, index) => {
      const current = pieza as Record<string, unknown>;
      const cantidad = Number(current.cantidad ?? 0);
      const anchoMm = Number(current.anchoMm ?? 0);
      const altoMm = Number(current.altoMm ?? 0);
      if (!Number.isFinite(cantidad) || !Number.isFinite(anchoMm) || !Number.isFinite(altoMm)) {
        return null;
      }
      return {
        uiKey: `edit-pz-${index}-${item.id}`,
        cantidad,
        anchoMm,
        altoMm,
      };
    })
    .filter((pieza): pieza is PiezaInput => pieza != null);

  return {
    ...DEFAULT_MOTOR_CONFIG,
    rutaAlternativaId: item.rutaAlternativaId ?? "",
    medidaPredefinidaId:
      typeof ctx.medidaPredefinidaId === "string" ? ctx.medidaPredefinidaId : "",
    caras: Number(ctx.caras) === 2 ? 2 : 1,
    tipoCopia:
      Number(ctx.tipoCopia) === 3 ? 3 : Number(ctx.tipoCopia) === 2 ? 2 : 1,
    numerosXTalonario:
      Number.isFinite(Number(ctx.numerosXTalonario)) && Number(ctx.numerosXTalonario) > 0
        ? Number(ctx.numerosXTalonario)
        : DEFAULT_MOTOR_CONFIG.numerosXTalonario,
    piezas,
    opcionalesActivados: Object.fromEntries(
      Object.entries(opcionalesRaw).map(([key, value]) => [key, Boolean(value)]),
    ),
    seleccionMaterial: Object.fromEntries(
      Object.entries(slotMaterialesRaw)
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => [key, value as string]),
    ),
    seleccionMaquina,
    seleccionModoColor,
    modoCotizacionLineal:
      typeof ctx.modoCotizacionLineal === "string" &&
      ctx.modoCotizacionLineal === "directo"
        ? "directo"
        : "nesting",
    zonaInstalacion:
      typeof ctx.zonaInstalacion === "string"
        ? ctx.zonaInstalacion
        : DEFAULT_MOTOR_CONFIG.zonaInstalacion,
    m2Instalados:
      Number.isFinite(Number(ctx.m2_instalados)) && Number(ctx.m2_instalados) > 0
        ? Number(ctx.m2_instalados)
        : DEFAULT_MOTOR_CONFIG.m2Instalados,
  };
}

function getQtyFromItem(item: PropuestaItem) {
  const ctxCantidad = Number(item.jobContext?.cantidad);
  if (Number.isFinite(ctxCantidad) && ctxCantidad > 0) return ctxCantidad;
  if (item.cotizacion.cantidadPedida && item.cotizacion.cantidadPedida > 0) {
    return item.cotizacion.cantidadPedida;
  }
  return item.cantidad;
}

function cotizacionFromItem(item: PropuestaItem): CotizarResponse | null {
  return {
    exitoso: true,
    errores: [],
    cotizacion: item.cotizacion,
  };
}

type SelectStepProps = {
  query: string;
  setQuery: (query: string) => void;
  family: string;
  setFamily: (family: string) => void;
  onPick: (product: CatalogProduct) => void;
  products: CatalogProduct[];
  loadingProductId?: string | null;
};

function ApSelectStep({
  query,
  setQuery,
  family,
  setFamily,
  onPick,
  products,
  loadingProductId,
}: SelectStepProps) {
  const visibleRecientes = products.slice(0, 3);
  const families = React.useMemo(
    () => ["Todos", ...Array.from(new Set(products.map((product) => product.family)))],
    [products],
  );

  const filtered = products.filter((product) => {
    if (family !== "Todos" && product.family !== family) return false;
    if (!query) return true;
    const normalized = query.toLowerCase();
    return [product.code, product.name, product.descripcion]
      .join(" ")
      .toLowerCase()
      .includes(normalized);
  });

  return (
    <>
      <div className="ap-search">
        <SearchIcon />
        <input
          autoFocus
          placeholder="Buscar por código, nombre o descripción..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span className="kbd">⌘K</span>
      </div>

      <div className="ap-filters">
        {families.map((item) => (
          <button
            key={item}
            type="button"
            className={`ap-chip ${family === item ? "on" : ""}`}
            onClick={() => setFamily(item)}
          >
            {item}
            {item !== "Todos" ? (
              <span className="ct">
                {products.filter((product) => product.family === item).length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {!query && family === "Todos" ? (
        <div className="ap-section">
          <div className="ap-section-head">
            <span>Recientes</span>
            <span className="ap-section-hint">Usados en las últimas órdenes</span>
          </div>
          <div className="ap-recent">
            {visibleRecientes.map((product) => (
              <button
                key={product.code}
                type="button"
                className="ap-recent-row"
                onClick={() => onPick(product)}
              >
                <span className={`ap-fam-dot tipo-${familyColor(product.family)}`} />
                <span className="lb">
                  <span className="nm">{product.name}</span>
                  <span className="cd">
                    {product.code} · {product.family}
                  </span>
                </span>
                {loadingProductId === product.id ? (
                  <span className="ap-section-hint">Cargando</span>
                ) : (
                  <ArrowRightIcon />
                )}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="ap-section">
        <div className="ap-section-head">
          <span>Catálogo</span>
          <span className="ap-section-hint">
            {filtered.length} producto{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="ap-list">
          {filtered.map((product) => (
            <button
              key={product.code}
              type="button"
              className="ap-prod"
              onClick={() => onPick(product)}
            >
              <span className="ap-prod-main">
                <span className="ap-prod-head">
                  <span className="code">{product.code}</span>
                  <span className={`tipo-chip tipo-${familyColor(product.family)}`}>
                    <span className="d" />
                    {product.family}
                  </span>
                </span>
                <span className="ap-prod-name">{product.name}</span>
                <span className="ap-prod-desc">{product.descripcion}</span>
              </span>
              <span className="ap-prod-meta">
                <span className="ap-mode">
                  <ApAtomMode mode={product.cobro} />
                  {product.cobro}
                </span>
                <span className="ap-precio">
                  {product.real ? (
                    <>Precio por motor</>
                  ) : (
                    <>
                      Referencia <strong>{formatCurrency(product.precioBase)}</strong> /{" "}
                      {product.unidad}
                    </>
                  )}
                </span>
              </span>
              <span className="ap-prod-pick">
                {loadingProductId === product.id ? "..." : <ArrowRightIcon />}
              </span>
            </button>
          ))}
          {filtered.length === 0 ? (
            <div className="ap-empty">
              <div className="ttl">Sin resultados</div>
              <div className="sub">
                Probá quitar el filtro <strong>{family}</strong> o ajustar la búsqueda.
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

type ConfigStepProps = {
  product: CatalogProduct;
  productoDetalle: ProductoDetalle | null;
  qty: number;
  setQty: (qty: number) => void;
  adi: string[];
  toggleAdi: (code: string) => void;
  motorConfig: MotorConfigState;
  setMotorConfig: React.Dispatch<React.SetStateAction<MotorConfigState>>;
  notaProduccion: string;
  setNotaProduccion: (value: string) => void;
  cotizacion: CotizarResponse | null;
  cotizando: boolean;
  cotizacionError: string | null;
  onCotizar: () => void;
  onBack: () => void;
};

function ApConfigStep({
  product,
  productoDetalle,
  qty,
  setQty,
  adi,
  toggleAdi,
  motorConfig,
  setMotorConfig,
  notaProduccion,
  setNotaProduccion,
  cotizacion,
  cotizando,
  cotizacionError,
  onCotizar,
  onBack,
}: ConfigStepProps) {
  const totals = getTotals(product, qty, adi);
  const cotizacionExitosa = getCotizacionExitosa(cotizacion);
  const cotizacionErrores = cotizacion && !cotizacion.exitoso ? cotizacion.errores : [];
  const rutaSel = getRutaSeleccionada(productoDetalle, motorConfig.rutaAlternativaId);
  const opcionalesRuta = React.useMemo(
    () =>
      product.real && productoDetalle
        ? getOpcionales(productoDetalle, rutaSel)
        : product.adicionales,
    [product, productoDetalle, rutaSel],
  );
  const slotsComercialElige = React.useMemo(
    () => getSlotsComercialElige(rutaSel),
    [rutaSel],
  );
  const slotsLinealesDirectos = React.useMemo(
    () => getSlotsMaterialesLinealDirecto(rutaSel),
    [rutaSel],
  );
  const slotsMaterialesPrincipales = slotsComercialElige.filter(
    (slot) => slot.modoActivacion !== "OPCIONAL",
  );
  const slotsMaterialesOpcionalesPorPaso = React.useMemo(
    () => getSlotsOpcionalesPorPaso(slotsComercialElige),
    [slotsComercialElige],
  );
  const opcionalesConfigurables = React.useMemo(
    () =>
      opcionalesRuta
        .map((opcional) => ({
          opcional,
          slots: slotsMaterialesOpcionalesPorPaso.get(opcional.code) ?? [],
        }))
        .filter(
          (item) =>
            product.real &&
            adi.includes(item.opcional.code) &&
            item.slots.length > 0,
        ),
    [adi, opcionalesRuta, product.real, slotsMaterialesOpcionalesPorPaso],
  );
  const pasosConCandidatas = getPasosConCandidatas(rutaSel);
  const modosColorComercial = getModosColorComercial(rutaSel).filter(
    (modo) =>
      modo.modoActivacion !== "OPCIONAL" ||
      Boolean(motorConfig.opcionalesActivados[modo.configPasoId]),
  );
  const modosColorVisibles = modosColorComercial;
  const necesitaInstalacion = getProductoNecesitaInstalacion(productoDetalle);
  const medidasPredefinidas = React.useMemo(
    () =>
      productoDetalle?.modoMedidas === "FIJA"
        ? getMedidasPredefinidas(productoDetalle)
        : [],
    [productoDetalle],
  );
  const cantidadPiezaRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const focusPiezaCantidadKey = React.useRef<string | null>(null);

  const updateMotorConfig = React.useCallback(
    (patch: Partial<MotorConfigState>) => {
      setMotorConfig((current) => ({ ...current, ...patch }));
    },
    [setMotorConfig],
  );

  const updatePieza = React.useCallback(
    (index: number, patch: Partial<PiezaInput>) => {
      setMotorConfig((current) => ({
        ...current,
        piezas: current.piezas.map((pieza, idx) =>
          idx === index ? { ...pieza, ...patch } : pieza,
        ),
      }));
    },
    [setMotorConfig],
  );

  const addPieza = React.useCallback(() => {
    const uiKey = `pz-${Date.now()}-${Math.random()}`;
    focusPiezaCantidadKey.current = uiKey;
    setMotorConfig((current) => ({
      ...current,
      piezas: [
        ...current.piezas,
        {
          uiKey,
          cantidad: 1,
          anchoMm: 1000,
          altoMm: 500,
        },
      ],
    }));
  }, [setMotorConfig]);

  React.useEffect(() => {
    const uiKey = focusPiezaCantidadKey.current;
    if (!uiKey) return;
    const input = cantidadPiezaRefs.current[uiKey];
    if (!input) return;
    input.focus();
    input.select();
    focusPiezaCantidadKey.current = null;
  }, [motorConfig.piezas.length]);

  const removePieza = React.useCallback(
    (index: number) => {
      setMotorConfig((current) => ({
        ...current,
        piezas: current.piezas.filter((_, idx) => idx !== index),
      }));
    },
    [setMotorConfig],
  );

  const setOpcional = React.useCallback(
    (id: string, checked: boolean) => {
      setMotorConfig((current) => ({
        ...current,
        opcionalesActivados: {
          ...current.opcionalesActivados,
          [id]: checked,
        },
      }));
      if (checked) {
        if (!adi.includes(id)) toggleAdi(id);
      } else if (adi.includes(id)) {
        toggleAdi(id);
      }
    },
    [adi, setMotorConfig, toggleAdi],
  );

  React.useEffect(() => {
    if (!product.real) return;
    const codigosValidos = new Set(opcionalesRuta.map((opcional) => opcional.code));
    const codigosInvalidos = adi.filter((code) => !codigosValidos.has(code));
    if (codigosInvalidos.length === 0) return;

    setMotorConfig((current) => {
      const opcionalesActivados = { ...current.opcionalesActivados };
      for (const code of codigosInvalidos) {
        delete opcionalesActivados[code];
      }
      return { ...current, opcionalesActivados };
    });
    for (const code of codigosInvalidos) {
      toggleAdi(code);
    }
  }, [adi, opcionalesRuta, product.real, setMotorConfig, toggleAdi]);

  const setMaterial = React.useCallback(
    (key: string, value: string) => {
      setMotorConfig((current) => ({
        ...current,
        seleccionMaterial: {
          ...current.seleccionMaterial,
          [key]: value,
        },
      }));
    },
    [setMotorConfig],
  );

  const setMaquina = React.useCallback(
    (configPasoId: string, value: string) => {
      setMotorConfig((current) => ({
        ...current,
        seleccionMaquina: {
          ...current.seleccionMaquina,
          [configPasoId]: value,
        },
      }));
    },
    [setMotorConfig],
  );

  const setModoColor = React.useCallback(
    (configPasoId: string, value: string) => {
      setMotorConfig((current) => ({
        ...current,
        seleccionModoColor: {
          ...current.seleccionModoColor,
          [configPasoId]: normalizeModoColor(value) ?? value,
        },
      }));
    },
    [setMotorConfig],
  );

  const renderSegmentedControl = (
    name: string,
    value: string,
    options: Array<{ value: string; label: string }>,
    onChange: (value: string) => void,
  ) => (
    <div className="ap-segmented" role="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={selected ? "active" : ""}
            role="radio"
            aria-checked={selected}
            aria-label={`${name}: ${option.label}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );

  const renderOptionList = (
    name: string,
    value: string,
    options: Array<{ value: string; label: string }>,
    onChange: (value: string) => void,
  ) => (
    <div className="ap-option-list" role="radiogroup" aria-label={name}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={selected ? "active" : ""}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
          >
            <span className="ap-option-dot" aria-hidden="true" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );

  const renderMaterialSelect = (slot: SlotComercialElige, options?: { showHint?: boolean }) => {
    const key = materialSelectionKey(slot.configPasoId, slot.slotCodigo);
    const selected = motorConfig.seleccionMaterial[key] || defaultSlotCandidateId(slot) || "";
    const selectedCandidate =
      slot.candidatos.find((candidate) =>
        candidate.variantes.some((variant) => variant.variantId === selected),
      ) ?? slot.candidatos.find((candidate) => candidate.defaultVarianteId);
    const selectedVariant = selectedCandidate?.variantes.find(
      (variant) => variant.variantId === selected,
    );
    const useAttributePicker = selectedCandidate
      ? selectedCandidate.variantes.length > 1 && candidateUsesColorThickness(selectedCandidate)
      : false;
    const colorOptions = useAttributePicker && selectedCandidate
      ? Array.from(
          new Set(
            selectedCandidate.variantes.map((variant) => variant.colorLabel || "Sin color"),
          ),
        )
      : [];
    const selectedColor =
      selectedVariant?.colorLabel ||
      selectedCandidate?.variantes.find((variant) => variant.colorLabel)?.colorLabel ||
      colorOptions[0] ||
      "Sin color";
    const variantsBySelectedColor = selectedCandidate?.variantes.filter(
      (variant) => (variant.colorLabel || "Sin color") === selectedColor,
    ) ?? [];
    const selectMaterial = (materiaPrimaId: string) => {
      const candidate = slot.candidatos.find((item) => item.materiaPrimaId === materiaPrimaId);
      const variantId =
        candidate?.defaultVarianteId ??
        (candidate?.variantes.length === 1 ? candidate.variantes[0]?.variantId : undefined) ??
        candidate?.variantes[0]?.variantId ??
        "";
      setMaterial(key, variantId);
    };
    return (
      <div
        className={`ap-spec ${selectedCandidate && selectedCandidate.variantes.length > 1 ? "ap-spec-wide" : ""}`}
        key={key}
      >
        <label>{humanizeCodigo(slot.slotCodigo)}</label>
        <select
          className="ap-native-select"
          value={selectedCandidate?.materiaPrimaId ?? ""}
          onChange={(event) => selectMaterial(event.target.value)}
        >
          {slot.candidatos.length === 0 ? (
            <option value="">Sin materiales candidatos configurados</option>
          ) : !selectedCandidate ? (
            <option value="">Elegí material</option>
          ) : null}
          {slot.candidatos.map((candidate) => (
            <option key={candidate.materiaPrimaId} value={candidate.materiaPrimaId}>
              {candidate.label}
            </option>
          ))}
        </select>
        {selectedCandidate && selectedCandidate.variantes.length > 1 ? (
          useAttributePicker ? (
            <div className="ap-material-attrs">
              <div className="ap-material-attr-block">
                <div className="ap-material-attr-label">Color</div>
                <div className="ap-material-color-row">
                  {colorOptions.map((color) => {
                    const firstVariantForColor = selectedCandidate.variantes.find(
                      (variant) => (variant.colorLabel || "Sin color") === color,
                    );
                    const active = selectedColor === color;
                    const count = selectedCandidate.variantes.filter(
                      (variant) => (variant.colorLabel || "Sin color") === color,
                    ).length;
                    return (
                      <button
                        key={color}
                        type="button"
                        className={`ap-material-color ${active ? "active" : ""}`}
                        onClick={() => {
                          if (firstVariantForColor) {
                            setMaterial(key, firstVariantForColor.variantId);
                          }
                        }}
                      >
                        <span>{color}</span>
                        <small>{count}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="ap-material-attr-block">
                <div className="ap-material-attr-label">Espesor</div>
                <div className="ap-material-thickness-grid">
                  {variantsBySelectedColor.map((variant) => {
                    const active = variant.variantId === selected;
                    const isDefault =
                      variant.variantId === selectedCandidate.defaultVarianteId;
                    return (
                      <button
                        key={variant.variantId}
                        type="button"
                        className={`ap-material-thickness ${active ? "active" : ""}`}
                        onClick={() => setMaterial(key, variant.variantId)}
                      >
                        <span className="ap-material-thickness-title">
                          {variant.espesorLabel ?? variant.label}
                          {isDefault ? (
                            <StarIcon className="ap-material-default-star" aria-label="Predeterminado" />
                          ) : null}
                        </span>
                        {variant.missingPrice ? (
                          <span className="ap-material-price-alert">
                            Sin precio cargado
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
          <div className="ap-variant-section">
            <div className="ap-variant-head">
              <span>Variante</span>
              <small>{selectedCandidate.label}</small>
            </div>
            <div className="ap-variant-grid">
              {selectedCandidate.variantes.map((variant) => {
                const active = variant.variantId === selected;
                const isDefault =
                  variant.variantId === selectedCandidate.defaultVarianteId;
                return (
                  <button
                    key={variant.variantId}
                    type="button"
                    className={`ap-variant-card ${active ? "active" : ""}`}
                    onClick={() => setMaterial(key, variant.variantId)}
                  >
                    <span className="ap-variant-title">{variant.label}</span>
                    <span className="ap-variant-meta">
                      {variant.isFallbackLabel
                        ? `Sin atributos descriptivos · ${variant.sku}`
                        : variant.description}
                    </span>
                    {isDefault ? (
                      <span className="ap-variant-badge">Predeterminada</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
          )
        ) : null}
        {options?.showHint !== false && !useAttributePicker && selectedVariant?.isFallbackLabel ? (
          <p className="ap-spec-hint">
            Esta variante no tiene atributos descriptivos cargados. Código interno:{" "}
            {selectedVariant.sku}
          </p>
        ) : options?.showHint !== false && !useAttributePicker && selectedVariant?.description ? (
          <p className="ap-spec-hint">{selectedVariant.description}</p>
        ) : null}
      </div>
    );
  };

  const renderLinearMaterialWidthSelect = (slot: SlotComercialElige) => {
    const key = materialSelectionKey(slot.configPasoId, slot.slotCodigo);
    const selected = motorConfig.seleccionMaterial[key] || defaultSlotCandidateId(slot) || "";
    const selectedCandidate =
      slot.candidatos.find((candidate) =>
        candidate.variantes.some((variant) => variant.variantId === selected),
      ) ?? slot.candidatos.find((candidate) => candidate.defaultVarianteId);
    const selectedVariant = selectedCandidate?.variantes.find(
      (variant) => variant.variantId === selected,
    );
    const selectMaterial = (materiaPrimaId: string) => {
      const candidate = slot.candidatos.find((item) => item.materiaPrimaId === materiaPrimaId);
      const variantId =
        candidate?.defaultVarianteId ??
        (candidate?.variantes.length === 1 ? candidate.variantes[0]?.variantId : undefined) ??
        candidate?.variantes[0]?.variantId ??
        "";
      setMaterial(key, variantId);
    };
    const variantOptions = selectedCandidate?.variantes ?? [];

    return (
      <React.Fragment key={`lineal-${key}`}>
        <div className="ap-spec">
          <label>Material</label>
          <select
            className="ap-native-select"
            value={selectedCandidate?.materiaPrimaId ?? ""}
            onChange={(event) => selectMaterial(event.target.value)}
          >
            {slot.candidatos.length === 0 ? (
              <option value="">Sin materiales candidatos configurados</option>
            ) : !selectedCandidate ? (
              <option value="">Elegí material</option>
            ) : null}
            {slot.candidatos.map((candidate) => (
              <option key={candidate.materiaPrimaId} value={candidate.materiaPrimaId}>
                {candidate.label}
              </option>
            ))}
          </select>
        </div>
        <div className="ap-spec ap-spec-wide">
          <label>Ancho de material</label>
          {variantOptions.length > 1 ? (
            renderSegmentedControl(
              "Ancho de material",
              selected,
              variantOptions.map((variant) => ({
                value: variant.variantId,
                label:
                  variant.anchoLabel ??
                  variant.espesorLabel ??
                  variant.label,
              })),
              (value) => setMaterial(key, value),
            )
          ) : (
            <div className="ctrl-input">
              <span>
                {selectedVariant?.anchoLabel ??
                  selectedVariant?.espesorLabel ??
                  selectedVariant?.label ??
                  "Sin ancho configurado"}
              </span>
            </div>
          )}
        </div>
      </React.Fragment>
    );
  };
  const usaCaras =
    rutaSel?.configPasos.filter(isExecutableConfigPaso).some(
      (config) =>
        config.multiplicadoresActivos.includes("caras") ||
        config.slotsMateriales.some((slot) => slot.aplicaMultiCaras),
    ) ||
    ["tarjetas", "volantes_folletos", "papeleria_comercial", "stickers_hoja"].includes(
      product.subcategoriaComercialCodigo,
    );
  const esTalonario = product.subcategoriaComercialCodigo === "talonarios";
  const metroLinealConMedidasVariables = isMetroLinealConMedidasVariables(productoDetalle);
  const mostrarEditorPiezas = usaPiezasParaCotizar(productoDetalle, motorConfig);
  const mostrarMaterialLinealDirecto =
    metroLinealConMedidasVariables && !mostrarEditorPiezas;
  const slotsMaterialesLinealDirecto = mostrarMaterialLinealDirecto
    ? slotsLinealesDirectos.filter((slot) => slot.modoActivacion !== "OPCIONAL")
    : [];
  const slotKeysLinealDirecto = new Set(
    slotsMaterialesLinealDirecto.map((slot) =>
      materialSelectionKey(slot.configPasoId, slot.slotCodigo),
    ),
  );
  const slotsMaterialesGenerales = slotsMaterialesPrincipales.filter(
    (slot) => !slotKeysLinealDirecto.has(materialSelectionKey(slot.configPasoId, slot.slotCodigo)),
  );
  const hasQuantityShortcuts = !["m²", "m2", "ml"].includes(product.unidad.toLowerCase());
  const exactPricingQuantities = getExactPricingQuantities(product);
  const usesExactPricingQuantities = exactPricingQuantities.length > 0;
  const quantityShortcuts = usesExactPricingQuantities
    ? exactPricingQuantities
    : hasQuantityShortcuts
      ? [100, 200, 300, 400]
      : [];
  const isAllowedQuantity =
    !usesExactPricingQuantities || exactPricingQuantities.includes(qty);

  const renderQuantityControl = () => {
    if (usesExactPricingQuantities) {
      return (
        <div className="ap-qty-line">
          <div className="ap-qty-shortcuts ap-qty-options" aria-label="Cantidades permitidas">
            {exactPricingQuantities.map((value) => (
              <button
                key={value}
                type="button"
                className={qty === value ? "active" : ""}
                onClick={() => setQty(value)}
              >
                {value.toLocaleString("es-AR")}
              </button>
            ))}
          </div>
          <span className="ap-qty-unit">{product.unidad}</span>
        </div>
      );
    }

    return (
      <div className="ap-qty-line">
        <div className="ap-qty compact">
          <button
            type="button"
            className="ap-qty-btn"
            onClick={() => setQty(Math.max(0, qty - 1))}
          >
            <MinusIcon />
          </button>
          <input
            type="number"
            value={qty}
            step={product.unidad === "m²" || product.unidad === "ml" ? 0.1 : 1}
            min="0"
            onChange={(event) => setQty(parseDecimalInput(event.target.value))}
          />
          <span className="ap-qty-unit">{product.unidad}</span>
          <button type="button" className="ap-qty-btn" onClick={() => setQty(qty + 1)}>
            <PlusIcon />
          </button>
        </div>
        {hasQuantityShortcuts ? (
          <div className="ap-qty-shortcuts" aria-label="Atajos de cantidad">
            {quantityShortcuts.map((value) => (
              <button
                key={value}
                type="button"
                className={qty === value ? "active" : ""}
                onClick={() => setQty(value)}
              >
                {value}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderPiezasEditor = () => (
    <div className="ap-spec ap-spec-wide">
      <div className="ap-piezas">
        <div className="ap-pieza-head" aria-hidden="true">
          <span>Cantidad</span>
          <span />
          <span>Ancho</span>
          <span />
          <span>Alto</span>
          <span />
          <span />
        </div>
        {motorConfig.piezas.map((pieza, index) => (
          <div className="ap-pieza-row" key={pieza.uiKey}>
            <input
              ref={(node) => {
                cantidadPiezaRefs.current[pieza.uiKey] = node;
              }}
              type="number"
              min="1"
              value={pieza.cantidad}
              onChange={(event) =>
                updatePieza(index, { cantidad: Number(event.target.value) || 0 })
              }
              aria-label="Cantidad de piezas"
            />
            <span>x</span>
            <input
              type="number"
              min="0"
              value={pieza.anchoMm}
              onChange={(event) =>
                updatePieza(index, { anchoMm: Number(event.target.value) || 0 })
              }
              aria-label="Ancho en mm"
            />
            <span>x</span>
            <input
              type="number"
              min="0"
              value={pieza.altoMm}
              onChange={(event) =>
                updatePieza(index, { altoMm: Number(event.target.value) || 0 })
              }
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                addPieza();
              }}
              aria-label="Alto en mm"
            />
            <span>mm</span>
            <button
              type="button"
              className="ap-qty-btn"
              onClick={() => removePieza(index)}
              aria-label="Quitar pieza"
            >
              <XIcon />
            </button>
          </div>
        ))}
        <button type="button" className="adi-add" onClick={addPieza}>
          <PlusIcon />
          Agregar pieza
        </button>
      </div>
    </div>
  );

  const setModoCotizacionLineal = (modo: ModoCotizacionLineal) => {
    setMotorConfig((current) => ({
      ...current,
      modoCotizacionLineal: modo,
      piezas:
        modo === "nesting" && current.piezas.length === 0
          ? [
              {
                uiKey: `pz-${Date.now()}`,
                cantidad: 1,
                anchoMm: 1000,
                altoMm: 500,
              },
            ]
          : current.piezas,
    }));
  };

  return (
    <>
      <div className="ap-product-banner">
        <button type="button" className="ap-back" onClick={onBack}>
          <ArrowLeftIcon />
          Cambiar producto
        </button>
        <div className="ap-pb-body">
          <div className="ap-pb-head">
            <span className={`tipo-chip tipo-${familyColor(product.family)}`}>
              <span className="d" />
              {product.family}
            </span>
            <span className="ap-pb-mode">
              <ApAtomMode mode={product.cobro} />
              {product.cobro}
            </span>
          </div>
          <div className="ap-pb-name">{product.name}</div>
          <div className="ap-pb-desc">{product.descripcion}</div>
        </div>
      </div>

      <div className="ap-config-section">
        <div className="ap-cs-head">
          <div className="ttl">Datos para calcular</div>
        </div>

        {product.real && productoDetalle?.rutasAlternativas.length ? (
          <div className="ap-specs">
            {productoDetalle.rutasAlternativas.length > 1 ? (
              <div className="ap-spec">
                <label>Seleccionar ruta de producción</label>
                {renderSegmentedControl(
                  "Seleccionar ruta de producción",
                  motorConfig.rutaAlternativaId,
                  productoDetalle.rutasAlternativas.map((ruta) => ({
                    value: ruta.id,
                    label: ruta.nombre,
                  })),
                  (value) =>
                    setMotorConfig((current) => ({
                      ...current,
                      rutaAlternativaId: value,
                      opcionalesActivados: {},
                      seleccionMaterial: {},
                      seleccionMaquina: {},
                      seleccionModoColor: {},
                    })),
                )}
              </div>
            ) : null}

            {metroLinealConMedidasVariables ? (
              <>
                <div className="ap-spec ap-spec-wide">
                  <label>Modo de cotización lineal</label>
                  {renderSegmentedControl(
                    "Modo de cotización lineal",
                    motorConfig.modoCotizacionLineal,
                    [
                      { value: "nesting", label: "Calcular por piezas" },
                      { value: "directo", label: "Ingresar ml" },
                    ],
                    (value) => setModoCotizacionLineal(value as ModoCotizacionLineal),
                  )}
                </div>
                {mostrarEditorPiezas ? (
                  renderPiezasEditor()
                ) : (
                  <>
                    {slotsMaterialesLinealDirecto.map((slot) =>
                      renderLinearMaterialWidthSelect(slot),
                    )}
                    <div className="ap-spec ap-spec-wide">
                      <label>Largo a cotizar</label>
                      {renderQuantityControl()}
                    </div>
                  </>
                )}
              </>
            ) : productoDetalle.modoMedidas === "LIBRE" ? (
              renderPiezasEditor()
            ) : (
              <>
                {medidasPredefinidas.length > 1 ? (
                  <div className="ap-spec ap-spec-wide">
                    <label>Medida</label>
                    {renderSegmentedControl(
                      "Medida",
                      getSelectedPredefinedMeasure(
                        productoDetalle,
                        motorConfig.medidaPredefinidaId,
                      )?.id ?? "",
                      medidasPredefinidas.map((medida) => ({
                        value: medida.id,
                        label: medidaLabel(medida),
                      })),
                      (value) => updateMotorConfig({ medidaPredefinidaId: value }),
                    )}
                  </div>
                ) : null}
              <div className="ap-spec ap-spec-wide">
                <label>Cantidad</label>
                {renderQuantityControl()}
              </div>
              </>
            )}

            {usaCaras ? (
              <div className="ap-spec">
                <label>Caras</label>
                {renderSegmentedControl(
                  "Caras",
                  String(motorConfig.caras),
                  [
                    { value: "1", label: "Simple faz" },
                    { value: "2", label: "Doble faz" },
                  ],
                  (value) =>
                    updateMotorConfig({ caras: Number(value) as 1 | 2 }),
                )}
              </div>
            ) : null}

            {esTalonario ? (
              <>
                <div className="ap-spec">
                  <label>Tipo de copia</label>
                  <select
                    className="ap-native-select"
                    value={String(motorConfig.tipoCopia)}
                    onChange={(event) =>
                      updateMotorConfig({
                        tipoCopia: Number(event.target.value) as 1 | 2 | 3,
                      })
                    }
                  >
                    <option value="1">Simple</option>
                    <option value="2">Duplicado</option>
                    <option value="3">Triplicado</option>
                  </select>
                </div>
                <div className="ap-spec">
                  <label>Hojas por talonario</label>
                  <input
                    type="number"
                    min="1"
                    value={motorConfig.numerosXTalonario}
                    onChange={(event) =>
                      updateMotorConfig({
                        numerosXTalonario: Number(event.target.value) || 1,
                      })
                    }
                  />
                </div>
              </>
            ) : null}

            {modosColorVisibles.map((modo) => {
              const value =
                normalizeModoColor(motorConfig.seleccionModoColor[modo.configPasoId]) ??
                modo.defaultMode ??
                normalizeModoColor(modo.options[0]?.value) ??
                "";
              const modoOptions = modo.options.map((option) => ({
                value: normalizeModoColor(option.value) ?? option.value,
                label: option.label,
              }));
              return (
                <div
                  className={`ap-spec ${modoOptions.length > 2 ? "ap-spec-wide" : ""}`}
                  key={modo.configPasoId}
                >
                  <label>
                    {modosColorVisibles.length === 1
                      ? "Modo de color"
                      : `${humanizeCodigo(modo.familiaCodigo)} · color`}
                  </label>
                  {modoOptions.length > 2
                    ? renderOptionList(
                        "Modo de color",
                        value,
                        modoOptions,
                        (nextValue) => setModoColor(modo.configPasoId, nextValue),
                      )
                    : renderSegmentedControl(
                        "Modo de color",
                        value,
                        modoOptions,
                        (nextValue) => setModoColor(modo.configPasoId, nextValue),
                      )}
                </div>
              );
            })}

            {slotsMaterialesGenerales.map((slot) => renderMaterialSelect(slot))}

            {pasosConCandidatas.map((paso) => {
              const selectedId = motorConfig.seleccionMaquina[paso.configPasoId] ?? "";
              return (
                <div className="ap-spec" key={paso.configPasoId}>
                  <label>{humanizeCodigo(paso.familiaCodigo)} · máquina</label>
                  <select
                    className="ap-native-select"
                    value={selectedId}
                    onChange={(event) => setMaquina(paso.configPasoId, event.target.value)}
                  >
                    <option value="">Usar preferida</option>
                    {paso.candidatas.map((candidata) => (
                      <option key={candidata.maquinaId} value={candidata.maquinaId}>
                        {candidata.maquina.nombre}
                        {candidata.esPreferida ? " · preferida" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}

            {necesitaInstalacion ? (
              <>
                <div className="ap-spec">
                  <label>Zona de instalación</label>
                  <select
                    className="ap-native-select"
                    value={motorConfig.zonaInstalacion}
                    onChange={(event) =>
                      updateMotorConfig({ zonaInstalacion: event.target.value })
                    }
                  >
                    {ZONAS_VIATICO.map((zona) => (
                      <option key={zona.value} value={zona.value}>
                        {zona.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ap-spec">
                  <label>m² instalados</label>
                  <input
                    type="number"
                    min="0"
                    value={motorConfig.m2Instalados}
                    onChange={(event) =>
                      updateMotorConfig({ m2Instalados: Number(event.target.value) || 0 })
                    }
                  />
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <div className="ap-spec ap-spec-wide">
            <label>Cantidad</label>
            {renderQuantityControl()}
          </div>
        )}
      </div>

      <div className="ap-config-section">
        <div className="ap-cs-head">
          <div className="ttl">Opcionales</div>
          <div className="sub">
            Pasos o cargos que el comercial puede activar para este producto.
          </div>
        </div>
        {opcionalesRuta.length > 0 ? (
          <div className="ap-adicionales">
            {opcionalesRuta.map((adicional) => {
              const selected = adi.includes(adicional.code);
              return (
                <div key={adicional.code}>
                  <button
                    type="button"
                    className={`ap-adi ${selected ? "on" : ""}`}
                    onClick={() =>
                      product.real
                        ? setOpcional(adicional.code, !selected)
                        : toggleAdi(adicional.code)
                    }
                    title={adicional.descripcion}
                  >
                    <span className="cb" />
                    <span className="lb">{adicional.name}</span>
                    {!product.real ? (
                      <span className="mt mono">
                        + {formatCurrency(adicional.monto ?? 0)}
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="ap-empty">
            <div className="ttl">Sin opcionales configurados</div>
            <div className="sub">
              Este producto no tiene pasos o cargos opcionales disponibles para activar.
            </div>
          </div>
        )}
        {opcionalesConfigurables.length > 0 ? (
          <div className="ap-optional-configs">
            <div className="ap-optional-config-head">
              <div className="ttl">Configurar opcionales activados</div>
              <div className="sub">
                Completá los datos necesarios para cotizar los opcionales seleccionados.
              </div>
            </div>
            <div className="ap-optional-config-grid">
              {opcionalesConfigurables.map(({ opcional, slots }) => (
                <div className="ap-optional-config-card" key={opcional.code}>
                  <div className="ap-optional-config-title">
                    <span className="cb">
                      <CheckIcon />
                    </span>
                    <span>{opcional.name}</span>
                  </div>
                  <div className="ap-optional-config-fields">
                    {slots.map((slot) => renderMaterialSelect(slot, { showHint: false }))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="ap-config-section">
        <div className="ap-cs-head">
          <div className="ttl">Notas para producción</div>
          <div className="sub">Información extra para el taller (opcional).</div>
        </div>
        <textarea
          className="ap-notas"
          placeholder="Ej: entregar enrollado en tubo, llamar al cliente al 50% del avance, etc."
          rows={3}
          value={notaProduccion}
          onChange={(event) => setNotaProduccion(event.target.value)}
        />
      </div>

      {product.real ? (
        <div className="ap-config-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onCotizar}
            disabled={cotizando || !productoDetalle || !isAllowedQuantity}
          >
            {cotizando ? "Cotizando..." : "Cotizar"}
          </button>
          <span>
            Previsualizá el precio con los datos y opcionales seleccionados antes de
            agregarlo a la OT.
          </span>
        </div>
      ) : null}

      {product.real ? (
        <div className="ap-summary">
          <div className="ap-sum-head">
            {cotizando ? "Calculando" : cotizacionExitosa ? "Detalle del cálculo" : "Precio"}
          </div>
          {cotizando ? (
            <div className="ap-empty ap-calculating" aria-live="polite" aria-busy="true">
              <div className="ap-calc-loader" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="ttl">Calculando con el Motor Universal</div>
              <div className="sub">Estamos procesando cantidad, opciones y ruta seleccionada.</div>
            </div>
          ) : cotizacionError || cotizacionErrores.length > 0 ? (
            <div className="ap-empty ap-empty-error">
              <div className="ttl">No se pudo cotizar</div>
              <div className="sub">
                {cotizacionError ??
                  cotizacionErrores[0]?.mensaje ??
                  "Revisá los datos del producto y volvé a intentar."}
              </div>
            </div>
          ) : cotizacionExitosa ? (
            <>
              <div className="ap-sum-grid">
                <div className="row">
                  <span className="lbl">{labelPrecioUnitario(product.unidad)}</span>
                  <span className="val mono">
                    {formatCurrency(getCotizacionUnitario(cotizacionExitosa))}
                  </span>
                </div>
                <div className="row">
                  <span className="lbl">Cantidad cotizada</span>
                  <span className="val mono">
                    {(cotizacionExitosa.cantidadComercialPricing ?? cotizacionExitosa.cantidadEfectiva).toLocaleString("es-AR")}{" "}
                    {product.unidad}
                  </span>
                </div>
                <div className="row">
                  <span className="lbl">Subtotal neto</span>
                  <span className="val mono">
                    {formatCurrency(getCotizacionNeto(cotizacionExitosa))}
                  </span>
                </div>
                <div className="row sub">
                  <span className="lbl">+ Impuestos</span>
                  <span className="val mono">
                    {formatCurrency(getCotizacionImpuestos(cotizacionExitosa))}
                  </span>
                </div>
                <div className="row total">
                  <span className="lbl">Total con impuestos</span>
                  <span className="val mono">
                    {formatCurrency(getCotizacionTotal(cotizacionExitosa))}
                  </span>
                </div>
              </div>
              <div className="ap-sum-margen">
                <div className="m-head">
                  <span>Margen bruto</span>
                  <span
                    className={`m-val ${getCotizacionMargen(cotizacionExitosa) < 25 ? "warn" : ""}`}
                  >
                    {getCotizacionMargen(cotizacionExitosa).toFixed(1)}%
                  </span>
                </div>
                <div className="m-track">
                  <span
                    style={{
                      width: `${Math.min(100, Math.max(0, getCotizacionMargen(cotizacionExitosa)))}%`,
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="ap-empty">
              <div className="ttl">Cotización pendiente</div>
              <div className="sub">
                Tocá Cotizar para previsualizar el precio con el Motor Universal.
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="ap-summary">
          <div className="ap-sum-head">Vista previa del cálculo</div>
          <div className="ap-sum-grid">
            <div className="row">
              <span className="lbl">
                Subtotal ({qty.toLocaleString("es-AR")} {product.unidad} x{" "}
                {formatCurrency(product.precioBase)})
              </span>
              <span className="val mono">{formatCurrency(totals.subtotal)}</span>
            </div>
            {adi.length > 0 ? (
              <div className="row">
                <span className="lbl">+ Opcionales ({adi.length})</span>
                <span className="val mono">{formatCurrency(totals.adicionalesMonto)}</span>
              </div>
            ) : null}
            <div className="row sub">
              <span className="lbl">+ Impuestos ({product.impuestoPct}%)</span>
              <span className="val mono">{formatCurrency(totals.impuestos)}</span>
            </div>
            <div className="row sub muted">
              <span className="lbl">Costo estimado</span>
              <span className="val mono">{formatCurrency(totals.costoEstimado)}</span>
            </div>
            <div className="row total">
              <span className="lbl">Total con impuestos</span>
              <span className="val mono">{formatCurrency(totals.total)}</span>
            </div>
          </div>
          <div className="ap-sum-margen">
            <div className="m-head">
              <span>Margen bruto</span>
              <span className={`m-val ${totals.margen < 25 ? "warn" : ""}`}>
                {totals.margen.toFixed(1)}%
              </span>
            </div>
            <div className="m-track">
              <span style={{ width: `${Math.min(100, Math.max(0, totals.margen))}%` }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function AgregarProductoSheet({
  open,
  onOpenChange,
  productos,
  fechaEntregaDefault,
  onAddItem,
  editingItem = null,
  onSaveItem,
}: AgregarProductoSheetProps) {
  const [step, setStep] = React.useState<"select" | "config">("select");
  const [product, setProduct] = React.useState<CatalogProduct | null>(null);
  const [productoDetalle, setProductoDetalle] = React.useState<ProductoDetalle | null>(null);
  const [query, setQuery] = React.useState("");
  const [family, setFamily] = React.useState("Todos");
  const [qty, setQty] = React.useState(0);
  const [specs, setSpecs] = React.useState<Record<string, string>>({});
  const [adi, setAdi] = React.useState<string[]>([]);
  const [motorConfig, setMotorConfig] =
    React.useState<MotorConfigState>(DEFAULT_MOTOR_CONFIG);
  const [notaProduccion, setNotaProduccion] = React.useState("");
  const [loadingProductId, setLoadingProductId] = React.useState<string | null>(null);
  const [cotizacion, setCotizacion] = React.useState<CotizarResponse | null>(null);
  const [cotizando, setCotizando] = React.useState(false);
  const [cotizacionError, setCotizacionError] = React.useState<string | null>(null);
  const suppressNextCotizacionClear = React.useRef(false);
  const catalogProducts = React.useMemo(
    () => productos.map(mapProductoReal),
    [productos],
  );
  const isEditing = Boolean(editingItem);

  const totals = product ? getTotals(product, qty, adi) : null;
  const cotizacionExitosa = getCotizacionExitosa(cotizacion);

  React.useEffect(() => {
    if (!product) return;
    const coercedQty = coerceQtyToPricingOptions(qty, product);
    if (coercedQty !== qty) setQty(coercedQty);
  }, [product, qty]);

  React.useEffect(() => {
    if (!open || !editingItem) return;
    let cancelled = false;
    const itemToEdit = editingItem;

    async function hydrateEdit() {
      const baseProduct =
        catalogProducts.find(
          (candidate) =>
            candidate.id === itemToEdit.motorCodigo ||
            candidate.code === itemToEdit.productoCodigo,
        ) ?? null;
      let nextProduct: CatalogProduct | null = baseProduct;
      let detalle: ProductoDetalle | null = null;

      if (baseProduct?.real && baseProduct.id) {
        setLoadingProductId(baseProduct.id);
        try {
          detalle = await getProductoById(baseProduct.id);
          nextProduct = mapProductoReal(detalle);
        } catch {
          toast.error("No pude cargar el producto para editarlo.");
        } finally {
          setLoadingProductId(null);
        }
      }

      if (!nextProduct) {
        toast.error("No pude encontrar el producto original para editar este item.");
        return;
      }

      if (cancelled) return;
      suppressNextCotizacionClear.current = true;
      const nextMotorConfig = motorConfigFromItem(itemToEdit);
      const activeOptionCodes = Object.entries(nextMotorConfig.opcionalesActivados)
        .filter(([, value]) => value)
        .map(([key]) => key);
      const selectedAdicionales = Array.from(
        new Set([
          ...activeOptionCodes,
          ...nextProduct.adicionales
            .filter((adicional) => itemToEdit.adicionales.includes(adicional.name))
            .map((adicional) => adicional.code),
        ]),
      );

      setProduct(nextProduct);
      setProductoDetalle(detalle);
      setQty(coerceQtyToPricingOptions(getQtyFromItem(itemToEdit), nextProduct));
      setSpecs({
        ...defaultSpecs(nextProduct),
        ...itemToEdit.especificaciones,
      });
      setAdi(selectedAdicionales);
      setMotorConfig(nextMotorConfig);
      setNotaProduccion(itemToEdit.notaProduccion ?? "");
      setCotizacion(cotizacionFromItem(itemToEdit));
      setCotizacionError(null);
      setCotizando(false);
      setStep("config");
    }

    void hydrateEdit();
    return () => {
      cancelled = true;
    };
  }, [catalogProducts, editingItem, open]);

  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  const back = React.useCallback(() => setStep("select"), []);

  const pick = React.useCallback(async (picked: CatalogProduct) => {
    let next = picked;
    let detalle: ProductoDetalle | null = null;
    if (picked.real && picked.id) {
      setLoadingProductId(picked.id);
      try {
        detalle = await getProductoById(picked.id);
        next = mapProductoReal(detalle);
      } catch {
        toast.error("No pude cargar los opcionales completos del producto.");
      } finally {
        setLoadingProductId(null);
      }
    }

    setProduct(next);
    setProductoDetalle(detalle);
    setQty(coerceQtyToPricingOptions(next.qtyDefault, next));
    setSpecs(defaultSpecs(next));
    setAdi([]);
    setNotaProduccion("");
    setCotizacion(null);
    setCotizacionError(null);
    const rutaPreferida =
      detalle?.rutasAlternativas.find((ruta) => ruta.esPreferida) ??
      detalle?.rutasAlternativas[0] ??
      null;
    const medidaDefault = detalle ? getMedidaDefault(detalle) : null;
    const iniciaConPiezas =
      detalle?.modoMedidas === "LIBRE" || isMetroLinealConMedidasVariables(detalle);
    setMotorConfig({
      ...DEFAULT_MOTOR_CONFIG,
      rutaAlternativaId: rutaPreferida?.id ?? "",
      medidaPredefinidaId: medidaDefault?.id ?? "",
      piezas:
        iniciaConPiezas
          ? [
              {
                uiKey: `pz-${Date.now()}`,
                cantidad: 1,
                anchoMm: 1000,
                altoMm: 500,
              },
            ]
          : [],
      numerosXTalonario: next.subcategoriaComercialCodigo === "talonarios" ? 50 : 50,
    });
    setStep("config");
  }, []);

  const toggleAdi = React.useCallback((code: string) => {
    setAdi((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code],
    );
  }, []);

  React.useEffect(() => {
    if (suppressNextCotizacionClear.current) {
      suppressNextCotizacionClear.current = false;
      return;
    }
    setCotizacion(null);
    setCotizacionError(null);
  }, [adi, motorConfig, product?.id, qty]);

  const cotizarActual = React.useCallback(async () => {
    if (!product?.real || !product.id || !productoDetalle) return;
    const coercedQty = coerceQtyToPricingOptions(qty, product);
    if (coercedQty !== qty) {
      setQty(coercedQty);
      return;
    }
    const rutaSel = getRutaSeleccionada(productoDetalle, motorConfig.rutaAlternativaId);
    const slotsComercialElige = getSlotsParaCotizacion(
      rutaSel,
      productoDetalle,
      motorConfig,
    );
    setCotizando(true);
    setCotizacion(null);
    setCotizacionError(null);
    try {
      const res = await cotizar({
        productoId: product.id,
        rutaAlternativaId: motorConfig.rutaAlternativaId || null,
        jobContext: buildJobContext(
          productoDetalle,
          motorConfig,
          qty,
          slotsComercialElige,
        ) as never,
        periodo: "2026-03",
      });
      setCotizacion(res);
      if (!res.exitoso) {
        setCotizacionError(res.errores[0]?.mensaje ?? "El motor no pudo cotizar este producto.");
      }
    } catch (error) {
      setCotizacionError(
        error instanceof Error ? error.message : "No se pudo conectar con el motor.",
      );
    } finally {
      setCotizando(false);
    }
  }, [motorConfig, product, productoDetalle, qty]);

  const addCurrent = React.useCallback(
    (keepOpen: boolean) => {
      if (!product) return;
      if (product.real && !cotizacionExitosa) {
        toast.error("Primero cotizá el producto para previsualizar el precio.");
        return;
      }
      const rutaSel = getRutaSeleccionada(productoDetalle, motorConfig.rutaAlternativaId);
      const slotsComercialElige = getSlotsParaCotizacion(
        rutaSel,
        productoDetalle,
        motorConfig,
      );
      const nextItem = buildItem(product, qty, specs, adi, {
        productoDetalle,
        motorConfig,
        slotsComercialElige,
        cotizacion,
        notaProduccion,
        itemId: editingItem?.id,
        fechaEntrega: editingItem?.fechaEntrega ?? fechaEntregaDefault,
      });
      if (editingItem) {
        onSaveItem?.(nextItem);
        toast.success(`${product.name} actualizado.`);
        close();
        return;
      }
      onAddItem(nextItem);
      toast.success(`${product.name} agregado a la propuesta.`);
      if (keepOpen) {
        setStep("select");
        setProduct(null);
        setProductoDetalle(null);
        setQty(0);
        setSpecs({});
        setAdi([]);
        setNotaProduccion("");
        setMotorConfig(DEFAULT_MOTOR_CONFIG);
        setCotizacion(null);
        setCotizacionError(null);
        return;
      }
      close();
    },
    [
      adi,
      close,
      cotizacion,
      cotizacionExitosa,
      editingItem,
      fechaEntregaDefault,
      motorConfig,
      onAddItem,
      onSaveItem,
      product,
      productoDetalle,
      qty,
      notaProduccion,
      specs,
    ],
  );

  React.useEffect(() => {
    if (!open) {
      setStep("select");
      setProduct(null);
      setProductoDetalle(null);
      setQuery("");
      setFamily("Todos");
      setQty(0);
      setSpecs({});
      setAdi([]);
      setNotaProduccion("");
      setMotorConfig(DEFAULT_MOTOR_CONFIG);
      setLoadingProductId(null);
      setCotizacion(null);
      setCotizacionError(null);
      setCotizando(false);
      suppressNextCotizacionClear.current = false;
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (step === "config") back();
      else close();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [back, close, open, step]);

  if (!open) return null;

  return (
    <>
      <div className="sheet-backdrop" onClick={close} />
      <div className="sheet sheet-ap" role="dialog" aria-modal="true" aria-labelledby="ap-title">
        <div className="sheet-head ap-head">
          <div className="body">
            <div className="ap-eyebrow">
              <BriefcaseBusinessIcon />
              Comercial · Nueva orden
            </div>
            <h2 id="ap-title">{isEditing ? "Editar producto de la OT" : "Agregar producto a la OT"}</h2>
            <div className="sub">
              {step === "select"
                ? "Elegí un producto del catálogo para configurar cantidad, datos reales y opcionales."
                : isEditing
                  ? "Actualizá los datos de cálculo y opcionales del producto seleccionado."
                  : "Configurá los datos de cálculo y opcionales del producto seleccionado."}
            </div>
          </div>
          <div className="ap-steps">
            <span className={`ap-step ${step === "select" ? "on" : "done"}`}>
              <span className="n">{step === "select" ? "1" : <CheckIcon />}</span>
              Producto
            </span>
            <span className="ap-step-rule" />
            <span className={`ap-step ${step === "config" ? "on" : ""}`}>
              <span className="n">2</span>
              Configurar
            </span>
          </div>
          <button type="button" className="close" onClick={close} aria-label="Cerrar">
            <XIcon />
          </button>
        </div>

        <div className="sheet-body ap-body">
          {step === "select" ? (
            <ApSelectStep
              query={query}
              setQuery={setQuery}
              family={family}
              setFamily={setFamily}
              onPick={pick}
              products={catalogProducts}
              loadingProductId={loadingProductId}
            />
          ) : product ? (
            <ApConfigStep
              product={product}
              productoDetalle={productoDetalle}
              qty={qty}
              setQty={setQty}
              adi={adi}
              toggleAdi={toggleAdi}
              motorConfig={motorConfig}
              setMotorConfig={setMotorConfig}
              notaProduccion={notaProduccion}
              setNotaProduccion={setNotaProduccion}
              cotizacion={cotizacion}
              cotizando={cotizando}
              cotizacionError={cotizacionError}
              onCotizar={cotizarActual}
              onBack={back}
            />
          ) : null}
        </div>

        <div className="sheet-foot ap-foot">
          {step === "config" && product && totals ? (
            <>
              <button type="button" className="btn" onClick={back}>
                <ArrowLeftIcon />
                Volver
              </button>
              <span className="ap-foot-spacer" />
              <div className="ap-foot-total">
                <span className="lbl">Total c/ imp.</span>
                <span className="val mono">
                  {product.real
                    ? cotizando
                      ? "Cotizando..."
                      : cotizacionExitosa
                        ? formatCurrency(getCotizacionTotal(cotizacionExitosa))
                        : "Pendiente"
                    : formatCurrency(totals.total)}
                </span>
              </div>
              {!isEditing ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => addCurrent(true)}
                  disabled={product.real && (!cotizacionExitosa || cotizando)}
                >
                  Guardar y agregar otro
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => addCurrent(false)}
                disabled={product.real && (!cotizacionExitosa || cotizando)}
              >
                {isEditing ? <CheckIcon /> : <PlusIcon />}
                {isEditing ? "Guardar cambios" : "Agregar a la OT"}
              </button>
            </>
          ) : (
            <>
              <span className="ap-foot-hint">
                ¿No está en el catálogo? <button type="button" className="ap-link">Crear producto custom →</button>
              </span>
              <span className="ap-foot-spacer" />
              <button type="button" className="btn" onClick={close}>
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
