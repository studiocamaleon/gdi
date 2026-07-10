"use client";

import * as React from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BriefcaseBusinessIcon,
  CheckIcon,
  CircleAlertIcon,
  FileUpIcon,
  Grid2X2Icon,
  ListIcon,
  MinusIcon,
  PaperclipIcon,
  PlusIcon,
  SearchIcon,
  StampIcon,
  StarIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  getHerramientaMedidasArchivo,
  getHerramientaEditorSello,
} from "@/lib/producto-herramientas";
import { leerMedidasPdf } from "@/lib/pdf-medidas";
import {
  SelloEditorSheet,
  type DisenoSello,
  type SelloEditorModel,
} from "@/components/comercial/sello-editor-sheet";

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
  ConfigPasoDetalle,
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
import { evaluarJsonLogicBoolean } from "@/lib/json-logic";
import { getMachineTechnology, machineTechnologyLabel } from "@/lib/maquinaria-tecnologias";
import { getCurrentPeriodo } from "@/lib/costos";

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
  configPasoId?: string;
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
  minimoComercialPolitica: "NONE" | "ADVERTIR_FACTURAR_MINIMO" | "BLOQUEAR";
  minimoComercialCantidad: number | null;
  minimoComercialBase: "cantidad_comercial" | "pliegos_impresos";
  descripcion: string;
  specs: CatalogSpec[];
  adicionales: CatalogAdicional[];
  qtyDefault: number;
  costoUnitario: number;
  impuestoPct: number;
};

type PiezaOrigenArchivo = {
  archivoNombre: string;
  pagina: number;
  totalPaginas: number;
  anchoDetectadoMm: number;
  altoDetectadoMm: number;
};

type PiezaInput = {
  uiKey: string;
  cantidad: number;
  anchoMm: number;
  altoMm: number;
  origen?: PiezaOrigenArchivo;
};

type ModoCotizacionLineal = "nesting" | "directo";

type SlotComercialElige = {
  configPasoId: string;
  familiaCodigo: string;
  modoActivacion: string | null;
  condicionActivacionJson: unknown;
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
    details: Array<{ label: string; value: string }>;
    sku: string;
    isFallbackLabel: boolean;
    sortEspesor: number | null;
    espesorLabel: string | null;
    anchoLabel: string | null;
    anchoMm: number | null;
    colorLabel: string | null;
    missingPrice: boolean;
    /** Modelo del sello si la variante es un cuerpo de sello (para el editor). */
    sello: {
      nombre: string;
      widthMm: number;
      heightMm: number;
      lineasMax: number;
    } | null;
  }>;
};

type MachineMarginsMm = {
  leftMm: number;
  rightMm: number;
};

type ModoColorComercial = {
  configPasoId: string;
  familiaCodigo: string;
  nombreVisible: string | null;
  modoActivacion: string | null;
  condicionActivacionJson: unknown;
  options: Array<{
    value: string;
    label: string;
    perfilIds: string[];
    /** Máquina asociada al modo (candidatas M-2): elegir el modo la activa. */
    maquinaId?: string;
    maquinaNombre?: string;
  }>;
  defaultMode?: string;
};

type MotorConfigState = {
  rutaAlternativaId: string;
  medidaPredefinidaId: string;
  caras: 1 | 2;
  /** Avanzado: override de caras por paso (`caras_<configPasoId>` al motor). */
  carasPorPaso: Record<string, 1 | 2>;
  /**
   * Tiempo estimado por el comercial por paso, en MINUTOS
   * (`tiempoManualMin_<configPasoId>` al motor). Ausente = usar el valor
   * sugerido del paso; null = el comercial vació el input (sin valor).
   */
  tiempoManualPorPaso: Record<string, number | null>;
  /** Diseño del sello (texto/tipografía) del configurador; null si no aplica. */
  disenoSello: DisenoSello | null;
  tipoCopia: 1 | 2 | 3;
  numerosXTalonario: number;
  piezas: PiezaInput[];
  opcionalesActivados: Record<string, boolean>;
  seleccionMaterial: Record<string, string>;
  seleccionMaquina: Record<string, string>;
  seleccionPerfil: Record<string, string>;
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
  /** Cliente seleccionado en la OT: activa precios especiales por cliente. */
  clienteId?: string | null;
};

const ZONAS_VIATICO = [
  { value: "CABA", label: "CABA" },
  { value: "GBA_NORTE", label: "GBA Norte" },
  { value: "GBA_OESTE", label: "GBA Oeste" },
  { value: "GBA_SUR", label: "GBA Sur" },
  { value: "FUERA_AMBA", label: "Fuera AMBA" },
];

const MODO_COLOR_LABELS: Record<string, string> = {
  SIN_IMPRESION: "Sin impresión",
  BN: "Blanco y negro",
  CMYK: "CMYK",
  "CMYK+blanco": "CMYK + Blanco",
  "CMYK+barniz": "CMYK + Barniz",
  "CMYK+blanco+barniz": "CMYK + Blanco + Barniz",
};

const MODO_COLOR_DESCRIPTIONS: Record<string, string> = {
  SIN_IMPRESION: "Material en crudo",
  BN: "1 tinta · escala de grises",
  CMYK: "Full color · 4 tintas",
  "CMYK+blanco": "Base blanca · sustratos oscuros o transp.",
  "CMYK+barniz": "Reserva de barniz UV · brillo selectivo",
  "CMYK+blanco+barniz": "Blanco de base + barniz selectivo",
};

const TECHNOLOGY_META: Record<
  string,
  { abbr: string; color: string; desc: string }
> = {
  uv: { abbr: "UV", color: "#6d4bd8", desc: "Rígidos y flexibles · seca al instante" },
  eco_solvente: { abbr: "ES", color: "#2f8fd6", desc: "Vinilos y lonas · exterior" },
  latex: { abbr: "LX", color: "#1f9d6b", desc: "Interior/exterior · sin olor" },
  laser: { abbr: "LS", color: "#4a4a52", desc: "Papelería · corto tiraje" },
  dtf_uv: { abbr: "DU", color: "#c9599a", desc: "Transfer sobre objetos" },
  dtf_textil: { abbr: "DT", color: "#d9803a", desc: "Estampado en telas" },
  sublimacion: { abbr: "SB", color: "#db2777", desc: "Sublimación sobre poliéster" },
  inkjet: { abbr: "IJ", color: "#0ea5e9", desc: "Inyección de tinta" },
};

function getTechnologyMeta(value: string) {
  return (
    TECHNOLOGY_META[value] ?? {
      abbr: value.slice(0, 2).toUpperCase() || "··",
      color: "#4a4a52",
      desc: "",
    }
  );
}

// Swatch visual del modo de color: material en crudo, escala de grises, o
// grilla CMYK con indicadores opcionales de blanco (punto) y barniz (brillo).
function renderModoColorSwatch(value: string) {
  if (value === "SIN_IMPRESION") {
    return <span className="ap-cmode none" aria-hidden="true" />;
  }
  if (value === "BN") {
    return <span className="ap-cmode bw" aria-hidden="true" />;
  }
  if (value.startsWith("CMYK")) {
    const hasWhite = value.includes("blanco");
    const hasBarniz = value.includes("barniz");
    return (
      <span className="ap-cmode cmyk" aria-hidden="true">
        <i className="c" />
        <i className="m" />
        <i className="y" />
        <i className="k" />
        {hasWhite ? <span className="wdot" /> : null}
        {hasBarniz ? <span className="vsheen" /> : null}
      </span>
    );
  }
  return <span className="ap-cmode none" aria-hidden="true" />;
}

const CARAS_ICONS: Record<string, React.ReactNode> = {
  "1": (
    <svg className="ap-sheet-ico" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <rect x="6" y="3" width="14" height="20" rx="2" fill="#fff" stroke="#14141a" strokeWidth="1.6" />
      <line x1="9" y1="8" x2="17" y2="8" stroke="#14141a" strokeWidth="1.4" />
      <line x1="9" y1="12" x2="17" y2="12" stroke="#b8b6b1" strokeWidth="1.4" />
      <line x1="9" y1="16" x2="14" y2="16" stroke="#b8b6b1" strokeWidth="1.4" />
    </svg>
  ),
  "2": (
    <svg className="ap-sheet-ico" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="13" height="18" rx="2" fill="#fff" stroke="#b8b6b1" strokeWidth="1.5" />
      <rect x="10" y="3" width="13" height="18" rx="2" fill="#fff" stroke="#14141a" strokeWidth="1.6" />
      <line x1="13" y1="8" x2="20" y2="8" stroke="#14141a" strokeWidth="1.4" />
      <line x1="13" y1="12" x2="20" y2="12" stroke="#b8b6b1" strokeWidth="1.4" />
    </svg>
  ),
};

const ENRICHED_SPEC_LABELS: Record<string, string> = {
  medidas: "Medidas",
  formato_medidas: "Medidas",
  material: "Material",
  caras: "Caras",
  tipo_copia: "Copias",
  espesor: "Espesor",
  espesor_material: "Espesor",
  tecnologia: "Tecnología",
  tecnologia_proceso: "Tecnología",
  proceso: "Proceso",
  modo_color: "Modo de color",
};

const ENRICHED_SPEC_ORDER = [
  "medidas",
  "material",
  "caras",
  "tipo_copia",
  "espesor",
  "tecnologia",
  "modo_color",
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
  carasPorPaso: {},
  tiempoManualPorPaso: {},
  disenoSello: null,
  tipoCopia: 1,
  numerosXTalonario: 50,
  piezas: [],
  opcionalesActivados: {},
  seleccionMaterial: {},
  seleccionMaquina: {},
  seleccionPerfil: {},
  seleccionModoColor: {},
  modoCotizacionLineal: "nesting",
  zonaInstalacion: "CABA",
  m2Instalados: 0,
};

const CUSTOM_MEASURE_ID = "__custom_measure__";

function createDefaultPiezaInput(): PiezaInput {
  return {
    uiKey: `pz-${Date.now()}-${Math.random()}`,
    cantidad: 1,
    anchoMm: 0,
    altoMm: 0,
  };
}

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
    return formatMedidasCm(medidaDefault.anchoMm, medidaDefault.altoMm);
  }
  if (producto.medidaDefaultAnchoMm && producto.medidaDefaultAltoMm) {
    const ancho = Number(producto.medidaDefaultAnchoMm);
    const alto = Number(producto.medidaDefaultAltoMm);
    if (Number.isFinite(ancho) && Number.isFinite(alto)) {
      return formatMedidasCm(ancho, alto);
    }
  }
  return modoMedidasPermitePersonalizada(producto.modoMedidas)
    ? "Medida personalizada"
    : "A definir";
}

function modoMedidasUsaPredefinidas(modoMedidas: string | null | undefined) {
  return (
    modoMedidas === "FIJA" ||
    modoMedidas === "COMERCIAL_ELIGE" ||
    modoMedidas === "MIXTA"
  );
}

function modoMedidasPermitePersonalizada(modoMedidas: string | null | undefined) {
  return modoMedidas === "LIBRE" || modoMedidas === "MIXTA";
}

function getSelectedPredefinedMeasure(
  producto: ProductoDetalle | null,
  medidaPredefinidaId: string,
) {
  if (!producto || !modoMedidasUsaPredefinidas(producto.modoMedidas)) return null;
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
  const size = formatMedidasCm(medida.anchoMm, medida.altoMm);
  const label = medidaLabel(medida);
  if (!label || label.includes(" mm") || label === `${medida.anchoMm} x ${medida.altoMm} mm`) {
    return size;
  }
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

/**
 * M-2 en extras — un paso extra como ConfigPasoDetalle sintético, para que
 * toda la lógica del sheet (tecnologías, modo color, opcionales, condicionales)
 * lo trate igual que un paso normal. Clave: id = extra.id, así el override
 * `maquinaSeleccionada_${configPasoId}` y `opcionalesActivados[id]` matchean
 * las claves que el motor resuelve para extras.
 */
function pasoExtraToSyntheticConfig(
  ruta: RutaAlternativaDetalle,
  extra: NonNullable<RutaAlternativaDetalle["pasosExtras"]>[number],
): ConfigPasoDetalle {
  // Orden pseudo-fraccional: intercala el extra después del paso referenciado
  // (null = antes de todos), respetando ordenInterno entre extras hermanos.
  const baseOrden = extra.insertarDespuesDeRutaPasoId
    ? (ruta.ruta.pasos.find((p) => p.id === extra.insertarDespuesDeRutaPasoId)
        ?.orden ?? ruta.ruta.pasos.length)
    : 0;
  return {
    id: extra.id,
    rutaPasoId: extra.id,
    rutaPaso: {
      id: extra.id,
      orden: baseOrden + (extra.ordenInterno + 1) / 1000,
      familiaCodigo: extra.familiaCodigo,
      activo: extra.activo,
    },
    modoActivacion: extra.modoActivacion,
    condicionActivacionJson: extra.condicionActivacionJson,
    modoTiempo: extra.modoTiempo,
    mecanismoCantidad: extra.mecanismoCantidad,
    mecanismoCantidadConfigJson: extra.mecanismoCantidadConfigJson,
    multiplicadoresActivos: extra.multiplicadoresActivos ?? [],
    paramsPasoJson: extra.paramsPasoJson,
    nombreVisible: extra.nombreVisible,
    maquinaM1: extra.maquinaM1 ?? null,
    perfilM1: extra.perfilM1 ?? null,
    centroCosto: extra.centroCosto
      ? {
          id: extra.centroCosto.id,
          codigo: extra.centroCosto.codigo,
          nombre: extra.centroCosto.nombre,
          unidadBaseFutura: extra.centroCosto.unidadBaseFutura ?? "",
        }
      : null,
    slotsMateriales: extra.slotsMateriales ?? [],
    maquinasCandidatas: extra.maquinasCandidatas ?? [],
    cargosDirectosPaso: [],
  };
}

/**
 * Suma a cada ruta alternativa sus pasos extras activos como configPasos
 * sintéticos (ordenados por posición). Se aplica al setear productoDetalle,
 * así todos los consumidores del sheet ven extras y pasos normales uniformes.
 */
function augmentDetalleConPasosExtras(
  detalle: ProductoDetalle,
): ProductoDetalle {
  return {
    ...detalle,
    rutasAlternativas: detalle.rutasAlternativas.map((ruta) => {
      const extras = (ruta.pasosExtras ?? []).filter((extra) => extra.activo);
      if (extras.length === 0) return ruta;
      const sinteticos = extras.map((extra) =>
        pasoExtraToSyntheticConfig(ruta, extra),
      );
      return {
        ...ruta,
        configPasos: [...ruta.configPasos, ...sinteticos].sort(
          (a, b) => a.rutaPaso.orden - b.rutaPaso.orden,
        ),
      };
    }),
  };
}

function isConfigPasoVisibleForContext(
  config: ConfigPasoDetalle,
  motorConfig: MotorConfigState,
  ruleContext: Record<string, unknown>,
) {
  if (!isExecutableConfigPaso(config)) return false;
  const modo = config.modoActivacion ?? "OBLIGATORIO";
  if (modo === "OPCIONAL") return Boolean(motorConfig.opcionalesActivados[config.id]);
  if (modo === "CONDICIONAL") {
    return evaluarJsonLogicBoolean(config.condicionActivacionJson, ruleContext, false);
  }
  return modo === "OBLIGATORIO";
}

function isConfigPasoAvailableForOptionalToggle(
  config: ConfigPasoDetalle,
  ruleContext: Record<string, unknown>,
) {
  if (!isExecutableConfigPaso(config)) return false;
  if (config.modoActivacion === "CONDICIONAL") {
    return evaluarJsonLogicBoolean(config.condicionActivacionJson, ruleContext, false);
  }
  return true;
}

function routeUsesCaras(
  ruta: RutaAlternativaDetalle | null,
  includeConfig: (config: ConfigPasoDetalle) => boolean,
) {
  return (
    ruta?.configPasos.some(
      (config) =>
        includeConfig(config) &&
        (config.multiplicadoresActivos.includes("caras") ||
          config.slotsMateriales.some((slot) => slot.aplicaMultiCaras)),
    ) ?? false
  );
}

function condicionRefiereTipoCopia(condicion: unknown): boolean {
  if (!condicion) return false;
  return JSON.stringify(condicion).includes("tipoCopia");
}

/**
 * `true` si la ruta usa `tipoCopia` para activar pasos o multiplicar cantidad
 * (algún paso con `tipoCopia` en multiplicadoresActivos, o una condición de
 * activación que referencia `tipoCopia`). Es la forma robusta de saber si
 * corresponde el selector — no depende de que el producto esté en la
 * subcategoría "talonarios".
 */
function routeUsesTipoCopia(
  ruta: RutaAlternativaDetalle | null,
  includeConfig: (config: ConfigPasoDetalle) => boolean,
) {
  return (
    ruta?.configPasos.some(
      (config) =>
        includeConfig(config) &&
        (config.multiplicadoresActivos.includes("tipoCopia") ||
          condicionRefiereTipoCopia(config.condicionActivacionJson)),
    ) ?? false
  );
}

function mapSlotMaterial(
  config: RutaAlternativaDetalle["configPasos"][number],
  slot: RutaAlternativaDetalle["configPasos"][number]["slotsMateriales"][number],
): SlotComercialElige {
  return {
          configPasoId: config.id,
          familiaCodigo: config.rutaPaso.familiaCodigo,
          modoActivacion: config.modoActivacion,
          condicionActivacionJson: config.condicionActivacionJson,
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
                  details: display.details,
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
                  sello: getSelloModelDeVariante(
                    item.variante.atributosVarianteJson,
                    display.label,
                  ),
                };
              }),
            ),
          })),
        };
}

function getSlotsComercialElige(
  ruta: RutaAlternativaDetalle | null,
  includeConfig: (config: ConfigPasoDetalle) => boolean = () => true,
) {
  return (
    ruta?.configPasos
      .filter(isExecutableConfigPaso)
      .filter(includeConfig)
      .flatMap((config) =>
        config.slotsMateriales
          .filter((slot) => slot.modoSeleccion === "COMERCIAL_ELIGE")
          .map((slot) => mapSlotMaterial(config, slot)),
      ) ?? []
  );
}

function getSlotsMaterialesLinealDirecto(
  ruta: RutaAlternativaDetalle | null,
  includeConfig: (config: ConfigPasoDetalle) => boolean = () => true,
) {
  return (
    ruta?.configPasos
      .filter(isExecutableConfigPaso)
      .filter(includeConfig)
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
  includeConfig?: (config: ConfigPasoDetalle) => boolean,
) {
  const slotsComerciales = getSlotsComercialElige(ruta, includeConfig);
  if (
    isMetroLinealConMedidasVariables(productoDetalle) &&
    config.modoCotizacionLineal === "directo"
  ) {
    return mergeSlotsMateriales([
      ...slotsComerciales,
      ...getSlotsMaterialesLinealDirecto(ruta, includeConfig),
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

type MaquinaCandidataComercial = NonNullable<ConfigPasoDetalle["maquinasCandidatas"]>[number];

type TecnologiaCandidataComercial = {
  value: string;
  label: string;
  candidatas: MaquinaCandidataComercial[];
};

function getPreferredCandidate(candidates: MaquinaCandidataComercial[]) {
  return candidates.find((candidate) => candidate.esPreferida) ?? candidates[0] ?? null;
}

function getActiveCandidateForConfig(
  config: ConfigPasoDetalle,
  motorConfig: Pick<MotorConfigState, "seleccionMaquina">,
) {
  const candidates = config.maquinasCandidatas ?? [];
  const selectedId = motorConfig.seleccionMaquina[config.id];
  const selected = selectedId
    ? candidates.find((candidate) => candidate.maquinaId === selectedId)
    : null;
  return selected ?? getPreferredCandidate(candidates);
}

function getModoColorOptionsForConfig(
  config: ConfigPasoDetalle,
  motorConfig?: Pick<MotorConfigState, "seleccionMaquina">,
) {
  const candidatas = config.maquinasCandidatas ?? [];
  if (candidatas.length > 0 && motorConfig) {
    // Unión de modos sobre TODAS las candidatas: el modo de color es la
    // decisión visible y la máquina viene implícita en la opción elegida
    // (elegir "Color" en la C8003 no requiere cambiar de máquina a mano).
    // Orden FIJO (preferida primero, luego el orden de las candidatas) para
    // que las cards no se reordenen al seleccionar.
    const preferida = getPreferredCandidate(candidatas);
    const ordenadas = [
      ...(preferida ? [preferida] : []),
      ...candidatas.filter((candidate) => candidate !== preferida),
    ];
    const union = new Map<
      string,
      { value: string; label: string; perfilIds: string[]; maquinaId: string; maquinaNombre: string }
    >();
    for (const candidate of ordenadas) {
      const derived = buildModoColorOptionsFromCandidate(candidate).length
        ? buildModoColorOptionsFromCandidate(candidate)
        : (candidate.modoColorOptions ?? []);
      for (const option of derived) {
        const key = normalizeModoColor(option.value) ?? option.value;
        if (union.has(key)) continue;
        union.set(key, {
          ...option,
          maquinaId: candidate.maquinaId,
          maquinaNombre: candidate.maquina.nombre,
        });
      }
    }
    if (union.size > 0) return Array.from(union.values());
  }
  const activeCandidate = motorConfig
    ? getActiveCandidateForConfig(config, motorConfig)
    : null;
  if (activeCandidate) {
    const derivedOptions = buildModoColorOptionsFromCandidate(activeCandidate);
    if (derivedOptions.length) return derivedOptions;
    if (activeCandidate.modoColorOptions?.length) {
      return activeCandidate.modoColorOptions;
    }
  }
  return config.modoColorOptions ?? [];
}

function getModoColorsFromPerfil(perfil: { detalleJson?: Record<string, unknown> | null } | null | undefined) {
  const detalle =
    perfil?.detalleJson && typeof perfil.detalleJson === "object"
      ? perfil.detalleJson
      : {};
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

function buildModoColorOptionsFromCandidate(candidate: MaquinaCandidataComercial) {
  const allowedValues = Array.isArray(candidate.modoColorAllowedModes)
    ? candidate.modoColorAllowedModes
        .map((mode) => normalizeModoColor(mode))
        .filter((mode): mode is string => Boolean(mode))
    : [];
  const allowed = allowedValues.length > 0 ? new Set(allowedValues) : null;
  const modes = new Map<string, Set<string>>();
  if (!allowed || allowed.has("SIN_IMPRESION")) {
    modes.set("SIN_IMPRESION", new Set<string>());
  }
  for (const perfil of candidate.maquina.perfilesOperativos ?? []) {
    if (perfil.activo === false) continue;
    for (const mode of getModoColorsFromPerfil(perfil)) {
      if (allowed && !allowed.has(mode)) continue;
      const current = modes.get(mode) ?? new Set<string>();
      current.add(perfil.id);
      modes.set(mode, current);
    }
  }
  return Array.from(modes.entries()).map(([value, perfilIds]) => ({
    value,
    label: MODO_COLOR_LABELS[value] ?? value,
    perfilIds: Array.from(perfilIds),
  }));
}

function getModosColorComercial(
  ruta: RutaAlternativaDetalle | null,
  includeConfig: (config: ConfigPasoDetalle) => boolean = () => true,
  motorConfig?: Pick<MotorConfigState, "seleccionMaquina">,
) {
  return (
    ruta?.configPasos
      .filter(isExecutableConfigPaso)
      .filter(includeConfig)
      .map((config) => {
        const modoConfig = getModoColorConfig(config.paramsPasoJson);
        const usaModosPorCandidata = (config.maquinasCandidatas?.length ?? 0) > 0;
        const allowedModes = !usaModosPorCandidata && Array.isArray(modoConfig.allowedModes)
          ? modoConfig.allowedModes.map(normalizeModoColor).filter(Boolean)
          : [];
        const options = getModoColorOptionsForConfig(config, motorConfig).filter(
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
          nombreVisible: config.nombreVisible ?? null,
          modoActivacion: config.modoActivacion,
          condicionActivacionJson: config.condicionActivacionJson,
          options,
          defaultMode: normalizeModoColor(modoConfig.defaultMode),
        };
        return modo;
      })
      .filter((modo): modo is ModoColorComercial => modo !== null) ?? []
  );
}

/**
 * Pasos de la ruta que piden tiempo estimado por el comercial
 * (`paramsPasoJson.tiempoManual`, docs/tiempo-manual-por-paso-diseno.md).
 * El valor viaja al motor como `tiempoManualMin_<configPasoId>` (minutos).
 */
type TiempoManualComercial = {
  configPasoId: string;
  familiaCodigo: string;
  nombreVisible: string | null;
  modoActivacion: string | null;
  obligatorio: boolean;
  unidadInput: "min" | "h";
  defaultMin: number | null;
  minMin: number | null;
  maxMin: number | null;
  etiqueta: string | null;
};

function getTiemposManualesComercial(
  ruta: RutaAlternativaDetalle | null,
  includeConfig: (config: ConfigPasoDetalle) => boolean = () => true,
) {
  const positiveOrNull = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  return (
    ruta?.configPasos
      .filter(isExecutableConfigPaso)
      .filter(includeConfig)
      .map((config) => {
        const params = (config.paramsPasoJson ?? {}) as Record<string, unknown>;
        const tiempoManual = params.tiempoManual as
          | Record<string, unknown>
          | undefined;
        if (
          !tiempoManual ||
          typeof tiempoManual !== "object" ||
          tiempoManual.habilitado !== true
        ) {
          return null;
        }
        const item: TiempoManualComercial = {
          configPasoId: config.id,
          familiaCodigo: config.rutaPaso.familiaCodigo,
          nombreVisible: config.nombreVisible ?? null,
          modoActivacion: config.modoActivacion,
          obligatorio: tiempoManual.obligatorio === true,
          unidadInput: tiempoManual.unidadInput === "h" ? "h" : "min",
          defaultMin: positiveOrNull(tiempoManual.defaultMin),
          minMin: positiveOrNull(tiempoManual.minMin),
          maxMin: positiveOrNull(tiempoManual.maxMin),
          etiqueta:
            typeof tiempoManual.etiqueta === "string" &&
            tiempoManual.etiqueta.trim()
              ? tiempoManual.etiqueta.trim()
              : null,
        };
        return item;
      })
      .filter((item): item is TiempoManualComercial => item !== null) ?? []
  );
}

/**
 * Minutos efectivos del paso: lo que tocó el comercial gana; si no tocó nada,
 * aplica el valor sugerido del paso; input vaciado (null) = sin valor.
 */
function getTiempoManualEfectivoMin(
  item: TiempoManualComercial,
  config: Pick<MotorConfigState, "tiempoManualPorPaso">,
) {
  const raw = config.tiempoManualPorPaso[item.configPasoId];
  if (raw === undefined) return item.defaultMin;
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0
    ? raw
    : null;
}

function getTiempoManualError(
  item: TiempoManualComercial,
  config: Pick<MotorConfigState, "tiempoManualPorPaso">,
) {
  const nombre =
    item.etiqueta ||
    `${item.nombreVisible?.trim() || humanizeCodigo(item.familiaCodigo)} · tiempo estimado`;
  const efectivo = getTiempoManualEfectivoMin(item, config);
  if (efectivo == null) {
    return item.obligatorio
      ? `Ingresá "${nombre}" para poder agregar el producto.`
      : null;
  }
  const formatear = (minutos: number) =>
    item.unidadInput === "h" ? `${minutos / 60} h` : `${minutos} min`;
  if (item.minMin != null && efectivo < item.minMin) {
    return `"${nombre}" debe ser al menos ${formatear(item.minMin)}.`;
  }
  if (item.maxMin != null && efectivo > item.maxMin) {
    return `"${nombre}" no puede superar ${formatear(item.maxMin)}.`;
  }
  return null;
}

/** Primer error de tiempo manual entre los pasos visibles (null = todo OK). */
function getTiempoManualBloqueo(
  ruta: RutaAlternativaDetalle | null,
  includeConfig: (config: ConfigPasoDetalle) => boolean,
  config: MotorConfigState,
) {
  for (const item of getTiemposManualesComercial(ruta, includeConfig)) {
    const error = getTiempoManualError(item, config);
    if (error) return error;
  }
  return null;
}

function getCandidateTechnology(candidate: MaquinaCandidataComercial) {
  return getMachineTechnology(candidate.maquina) ?? "sin_tecnologia";
}

function getPasosConTecnologias(
  ruta: RutaAlternativaDetalle | null,
  includeConfig: (config: ConfigPasoDetalle) => boolean = () => true,
) {
  return (
    ruta?.configPasos
      .filter(isExecutableConfigPaso)
      .filter(includeConfig)
      .filter((config) => (config.maquinasCandidatas?.length ?? 0) > 1)
      .map((config) => ({
        configPasoId: config.id,
        familiaCodigo: config.rutaPaso.familiaCodigo,
        nombreVisible: config.nombreVisible ?? null,
        tecnologias: Array.from(
          (config.maquinasCandidatas ?? []).reduce((map, candidate) => {
            const value = getCandidateTechnology(candidate);
            const current = map.get(value);
            if (current) {
              current.candidatas.push(candidate);
            } else {
              map.set(value, {
                value,
                label: machineTechnologyLabel(candidate.maquina),
                candidatas: [candidate],
              });
            }
            return map;
          }, new Map<string, TecnologiaCandidataComercial>()).values(),
        ),
      })) ?? []
  );
}

function getActiveMachineForConfig(
  config: ConfigPasoDetalle,
  motorConfig: MotorConfigState,
) {
  return getActiveCandidateForConfig(config, motorConfig)?.maquina ?? config.maquinaM1;
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
  ruleContext: Record<string, unknown>,
) {
  return isConfigPasoVisibleForContext(config, motorConfig, ruleContext);
}

function getActiveConfigPasos(
  ruta: RutaAlternativaDetalle | null,
  motorConfig: MotorConfigState,
  ruleContext: Record<string, unknown>,
) {
  return ruta?.configPasos.filter((config) => isActiveConfigPaso(config, motorConfig, ruleContext)) ?? [];
}

function formatNumberForSpec(value: number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function mmToCm(value: number) {
  return value / 10;
}

function cmToMm(value: number) {
  return value * 10;
}

function formatCmFromMm(value: number) {
  const mm = Number(value);
  if (!Number.isFinite(mm)) return "0";
  return formatNumberForSpec(mmToCm(mm));
}

function formatCmInputFromMm(value: number) {
  const mm = Number(value);
  if (!Number.isFinite(mm) || mm <= 0) return "";
  return formatNumberForSpec(mmToCm(mm));
}

function formatMedidasCm(anchoMm: number, altoMm: number) {
  return `${formatCmFromMm(anchoMm)} x ${formatCmFromMm(altoMm)} cm`;
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

/**
 * Modelo del cuerpo del sello a partir de los atributos de su variante
 * (anchoPolimero × altoPolimero + lineasTexto). Devuelve null si no es un sello.
 */
function getSelloModelDeVariante(
  attrs: Record<string, unknown> | null | undefined,
  fallbackNombre: string,
): { nombre: string; widthMm: number; heightMm: number; lineasMax: number } | null {
  if (!attrs) return null;
  const num = (v: unknown) => {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const w = num(attrs.anchoPolimero);
  const h = num(attrs.altoPolimero);
  const lineas = num(attrs.lineasTexto);
  if (w === null || h === null || lineas === null) return null;
  const modelo =
    typeof attrs.modelo === "string" && attrs.modelo.trim()
      ? attrs.modelo.trim()
      : fallbackNombre;
  return { nombre: modelo, widthMm: w, heightMm: h, lineasMax: Math.round(lineas) };
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

function getNumberFromUnknown(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getMachineMarginsMm(
  machine: NonNullable<ConfigPasoDetalle["maquinaM1"]> | null | undefined,
): MachineMarginsMm {
  const params = getRecord(machine?.parametrosTecnicosJson);
  const source = getRecord(params.margenesNoImprimiblesMm);
  const uniform =
    getNumberFromUnknown(params.margenNoImprimibleMm) ??
    getNumberFromUnknown(params.margenNoImprimible);
  const left =
    getNumberFromUnknown(source.leftMm) ??
    getNumberFromUnknown(source.izq) ??
    getNumberFromUnknown(source.left) ??
    uniform ??
    0;
  const right =
    getNumberFromUnknown(source.rightMm) ??
    getNumberFromUnknown(source.der) ??
    getNumberFromUnknown(source.right) ??
    uniform ??
    0;

  return {
    leftMm: Math.max(0, left),
    rightMm: Math.max(0, right),
  };
}

function getVariantColorLabel(attrs: Record<string, unknown> | null | undefined) {
  return getTextAttr(attrs, ["colorBase", "color", "colorMaterial"]);
}

function candidateUsesColorThickness(candidate: SlotMaterialCandidato) {
  return candidate.variantes.some((variant) => variant.colorLabel && variant.espesorLabel);
}

type VariantCardDisplay = {
  title: string;
  specs: Array<{ label: string; value: string }>;
};

// Descompone las variantes de un candidato en: título (los atributos que
// distinguen a una variante de sus hermanas — ej. "Brillante" vs "Mate") y
// especificaciones compartidas (ej. Ancho/Largo del rollo). Genérico: sirve
// para cualquier opcional con alternativas, no solo laminado.
function describeCandidateVariants(
  candidate: SlotMaterialCandidato,
): Map<string, VariantCardDisplay> {
  const valuesByLabel = new Map<string, Set<string>>();
  for (const variant of candidate.variantes) {
    for (const detail of variant.details) {
      const set = valuesByLabel.get(detail.label) ?? new Set<string>();
      set.add(detail.value);
      valuesByLabel.set(detail.label, set);
    }
  }
  const varyingLabels = new Set(
    Array.from(valuesByLabel.entries())
      .filter(([, values]) => values.size > 1)
      .map(([label]) => label),
  );
  const cards = new Map<string, VariantCardDisplay>();
  for (const variant of candidate.variantes) {
    const distinguishing = variant.details.filter((detail) =>
      varyingLabels.has(detail.label),
    );
    const shared = variant.details.filter(
      (detail) => !varyingLabels.has(detail.label),
    );
    const title =
      distinguishing.map((detail) => detail.value).join(" · ") || variant.label;
    cards.set(variant.variantId, { title, specs: shared });
  }
  return cards;
}

function findSelectedCandidateVariant(
  slot: SlotComercialElige,
  config: Pick<MotorConfigState, "seleccionMaterial">,
) {
  const key = materialSelectionKey(slot.configPasoId, slot.slotCodigo);
  const selected = config.seleccionMaterial[key] || defaultSlotCandidateId(slot) || "";
  const candidate =
    slot.candidatos.find((item) =>
      item.variantes.some((variant) => variant.variantId === selected),
    ) ??
    slot.candidatos.find((item) => item.defaultVarianteId) ??
    slot.candidatos[0] ??
    null;
  const variant =
    candidate?.variantes.find((item) => item.variantId === selected) ??
    candidate?.variantes.find(
      (item) => item.variantId === candidate.defaultVarianteId,
    ) ??
    candidate?.variantes[0] ??
    null;
  return { candidate, variant };
}

// Resumen de una línea para el pie de la card del opcional:
// "Laminado film BOPP · Brillante · 330 mm × 150 m".
function describeSlotSelection(
  slot: SlotComercialElige,
  config: Pick<MotorConfigState, "seleccionMaterial">,
): string | null {
  const { candidate, variant } = findSelectedCandidateVariant(slot, config);
  if (!candidate) return null;
  const parts: string[] = [];
  if (candidate.label) parts.push(candidate.label);
  if (variant) {
    const card = describeCandidateVariants(candidate).get(variant.variantId);
    const specsText = (card?.specs ?? []).map((spec) => spec.value).join(" × ");
    if (card?.title) parts.push(card.title);
    if (specsText) parts.push(specsText);
    if (!card?.title && !specsText) parts.push(variant.label);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
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
      const selectedCandidate =
        slot.candidatos.find(
          (candidate) =>
            candidate.variantes.some((variant) => variant.variantId === selectedId) ||
            Boolean(selectedId && candidate.defaultVarianteId === selectedId),
        ) ??
        (!selectedId && slot.candidatos.length === 1 ? slot.candidatos[0] : null);
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

function getMachineTemplate(
  config: RutaAlternativaDetalle["configPasos"][number],
  motorConfig: MotorConfigState,
) {
  return getActiveMachineForConfig(config, motorConfig)?.plantilla?.toUpperCase() ?? "";
}

function getImpressionProcessLabel(
  config: RutaAlternativaDetalle["configPasos"][number],
  motorConfig: MotorConfigState,
) {
  const machine = getActiveMachineForConfig(config, motorConfig);
  const techLabel = machine ? machineTechnologyLabel(machine) : null;
  return techLabel ? `Impresión ${techLabel}` : "Impresión";
}

function getProcessLabels(
  rutaSeleccionada: RutaAlternativaDetalle | null,
  config: MotorConfigState,
  ruleContext: Record<string, unknown>,
) {
  const labels: string[] = [];
  for (const paso of getActiveConfigPasos(rutaSeleccionada, config, ruleContext)) {
    const familia = paso.rutaPaso.familiaCodigo;
    const template = getMachineTemplate(paso, config);
    if (
      familia.startsWith("impresion_") ||
      template.includes("IMPRESORA")
    ) {
      labels.push(getImpressionProcessLabel(paso, config));
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
  motorConfig?: MotorConfigState,
  ruleContext: Record<string, unknown> = {},
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
        const configAvailable = isConfigPasoAvailableForOptionalToggle(
          config,
          ruleContext,
        );
        if (config.modoActivacion === "OPCIONAL") {
          if (configAvailable) {
            opcionales.set(config.id, {
              code: config.id,
              // Nombre manual del modelador; el código de familia es fallback.
              name:
                config.nombreVisible?.trim() ||
                humanizeCodigo(config.rutaPaso.familiaCodigo),
              descripcion: "Paso productivo opcional.",
              origen: "paso",
              configPasoId: config.id,
            });
          }
        }
        for (const cargo of config.cargosDirectosPaso) {
          if (cargo.modoActivacion !== "OPCIONAL") continue;
          const parentActive = motorConfig
            ? isConfigPasoVisibleForContext(config, motorConfig, ruleContext)
            : configAvailable;
          if (!parentActive) continue;
          opcionales.set(cargo.id, {
            code: cargo.id,
            name: cargo.cargoDirectoCatalogo.nombre,
            descripcion: "Cargo directo opcional del paso.",
            origen: "cargo",
            configPasoId: config.id,
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
    medidasMode: modoMedidasPermitePersonalizada(producto.modoMedidas)
      ? "calculada"
      : "fija",
    precioBase: 0,
    precioConfigJson: producto.precioConfigJson,
    minimoComercialPolitica: producto.minimoComercialPolitica ?? "NONE",
    minimoComercialCantidad: Number(producto.minimoComercialCantidad ?? 0) || null,
    minimoComercialBase: producto.minimoComercialBase ?? "cantidad_comercial",
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

function getCotizacionCantidadReal(
  cotizacion: CotizacionExitosa,
  fallback: number,
) {
  return (
    cotizacion.cantidadComercialReal ??
    cotizacion.cantidadPedida ??
    cotizacion.cantidadEfectiva ??
    fallback
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
    (modoMedidasPermitePersonalizada(productoDetalle.modoMedidas) ||
      productoDetalle.modoMedidas === "COMERCIAL_ELIGE")
  );
}

function usaPiezasParaCotizar(
  productoDetalle: ProductoDetalle | null,
  config: Pick<MotorConfigState, "modoCotizacionLineal">,
) {
  return (
    (modoMedidasPermitePersonalizada(productoDetalle?.modoMedidas) &&
      !isMetroLinealConMedidasVariables(productoDetalle)) ||
    (isMetroLinealConMedidasVariables(productoDetalle) &&
      config.modoCotizacionLineal === "nesting")
  );
}

function usaCantidadComercialParaPiezas(productoDetalle: ProductoDetalle | null) {
  return (
    productoDetalle?.unidadComercial === "unidad" &&
    modoMedidasPermitePersonalizada(productoDetalle.modoMedidas) &&
    !isMetroLinealConMedidasVariables(productoDetalle)
  );
}

/**
 * `true` cuando el producto cotiza por piezas con medida personalizada pero
 * todavía no hay una medida válida ingresada (ancho/alto <= 0).
 *
 * La cotización en tiempo real NO debe dispararse en este estado: enviar una
 * pieza 0×0 al motor de nesting de rígidos hace que la grilla se calcule como
 * `área / 0` → columnas/filas infinitas → el motor agota la memoria (OOM) y
 * tumba la API. Con medida predefinida seleccionada las dimensiones vienen de
 * ahí (válidas), así que ese caso no bloquea.
 */
function medidasPersonalizadasIncompletas(
  productoDetalle: ProductoDetalle | null,
  config: MotorConfigState,
): boolean {
  if (!usaPiezasParaCotizar(productoDetalle, config)) return false;
  const medidaPredefinida = getSelectedPredefinedMeasure(
    productoDetalle,
    config.medidaPredefinidaId,
  );
  if (medidaPredefinida) return false;
  if (config.piezas.length === 0) return true;
  return config.piezas.some(
    (pieza) => !(pieza.anchoMm > 0) || !(pieza.altoMm > 0),
  );
}

/**
 * Muestra de color aproximada a partir del nombre de la variante. El backend
 * hoy sólo nos da el `colorLabel` (texto), no un hex, así que mapeamos los
 * colores frecuentes de sustratos a una muestra visual y caemos a un gris
 * neutro con aro para lo desconocido. `ring` agrega un borde interno para que
 * los colores muy claros (blanco, crema) no se pierdan contra el fondo.
 */
const SUBSTRATE_SWATCHES: Array<{ match: RegExp; background: string; ring?: boolean }> = [
  {
    match: /transparente|cristal|clear|incoloro/i,
    background:
      "repeating-conic-gradient(#dedede 0% 25%, #ffffff 0% 50%) 50% / 8px 8px",
    ring: true,
  },
  { match: /blanc|white/i, background: "#fafafa", ring: true },
  { match: /negr|black/i, background: "#1c1c1e" },
  { match: /gris|gray|grey|plom/i, background: "#9aa0a6" },
  { match: /plat|silver|alumini/i, background: "linear-gradient(135deg,#e2e2e4,#b7b9bd)", ring: true },
  { match: /dorad|\boro\b|gold/i, background: "linear-gradient(135deg,#e8cf8a,#c8a13a)" },
  { match: /roj|red|bordo|granate/i, background: "#d93636" },
  { match: /azul|blue|celeste/i, background: "#2f6fe0" },
  { match: /verde|green/i, background: "#1f9d57" },
  { match: /amarill|yellow/i, background: "#e6b800" },
  { match: /naranj|orange/i, background: "#e2712b" },
  { match: /beige|crema|marfil|ivory|hueso/i, background: "#efe7d6", ring: true },
  { match: /madera|wood|roble|nogal/i, background: "linear-gradient(135deg,#c8a06a,#9c6b3a)" },
];

function substrateColorSwatch(label: string | null): { background: string; ring: boolean } {
  const name = (label ?? "").trim();
  if (name) {
    for (const entry of SUBSTRATE_SWATCHES) {
      if (entry.match.test(name)) {
        return { background: entry.background, ring: entry.ring ?? false };
      }
    }
  }
  return { background: "#cfccc6", ring: true };
}

/** Sigla corta para el chip del sustrato: respeta siglas ya en mayúsculas (PVC, MDF). */
function materialChipInitials(label: string): string {
  const cleaned = label.replace(/[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, " ").trim();
  if (!cleaned) return "—";
  const firstWord = cleaned.split(/\s+/)[0];
  if (/^[A-Z0-9]{2,4}$/.test(firstWord)) return firstWord.slice(0, 4);
  return firstWord.slice(0, 3).toUpperCase();
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

function getSelectedLinearMaterialMetrics(
  productoDetalle: ProductoDetalle | null,
  slotsComercialElige: SlotComercialElige[],
  config: MotorConfigState,
  includeConfig: (config: ConfigPasoDetalle) => boolean = () => true,
) {
  const rutaSel = getRutaSeleccionada(productoDetalle, config.rutaAlternativaId);
  for (const slot of slotsComercialElige) {
    if (slot.formula !== "por_metro_lineal") continue;
    const configPaso = rutaSel?.configPasos.find((paso) => paso.id === slot.configPasoId);
    if (configPaso && !includeConfig(configPaso)) continue;
    const key = materialSelectionKey(slot.configPasoId, slot.slotCodigo);
    const selected = config.seleccionMaterial[key] || defaultSlotCandidateId(slot);
    if (!selected) continue;
    for (const candidate of slot.candidatos) {
      const variant = candidate.variantes.find((item) => item.variantId === selected);
      if (!variant?.anchoMm) continue;
      const margins = getMachineMarginsMm(
        configPaso ? getActiveMachineForConfig(configPaso, config) : null,
      );
      const usableWidthMm = Math.max(
        0,
        variant.anchoMm - margins.leftMm - margins.rightMm,
      );
      return {
        materialWidthMm: variant.anchoMm,
        usableWidthMm: usableWidthMm > 0 ? usableWidthMm : variant.anchoMm,
        margins,
      };
    }
  }
  // Fallback: si no hay un slot de material por metro lineal (ej: plotter CAD,
  // impresión por área sobre rollo), el ancho lo aporta el rollo de la máquina
  // de impresión (anchoUtil). El motor sintetiza la pieza = ancho útil × ml.
  for (const configPaso of rutaSel?.configPasos ?? []) {
    if (configPaso.rutaPaso.familiaCodigo !== "impresion_por_area") continue;
    if (!includeConfig(configPaso)) continue;
    const machine = getActiveMachineForConfig(configPaso, config);
    const anchoRolloMm = getNumberFromUnknown(machine?.anchoUtil);
    if (!anchoRolloMm || anchoRolloMm <= 0) continue;
    const margins = getMachineMarginsMm(machine);
    const usableWidthMm = Math.max(
      0,
      anchoRolloMm - margins.leftMm - margins.rightMm,
    );
    return {
      materialWidthMm: anchoRolloMm,
      usableWidthMm: usableWidthMm > 0 ? usableWidthMm : anchoRolloMm,
      margins,
    };
  }
  return null;
}

function buildJobContext(
  productoDetalle: ProductoDetalle | null,
  config: MotorConfigState,
  qty: number,
  slotsComercialElige: SlotComercialElige[],
  includeConfig: (config: ConfigPasoDetalle) => boolean = () => true,
) {
  const medidaPredefinida = getSelectedPredefinedMeasure(
    productoDetalle,
    config.medidaPredefinidaId,
  );
  const cotizaConPiezas = usaPiezasParaCotizar(productoDetalle, config);
  const cotizaLinealDirecto =
    isMetroLinealConMedidasVariables(productoDetalle) &&
    config.modoCotizacionLineal === "directo";
  const piezasUsanCantidadComercial =
    cotizaConPiezas && usaCantidadComercialParaPiezas(productoDetalle);
  const usaMedidaPersonalizadaReal = cotizaConPiezas && config.piezas.length > 0;
  const cantidadTrabajo =
    cotizaLinealDirecto
      ? 1
      : piezasUsanCantidadComercial
      ? qty
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
    medidaModo: usaMedidaPersonalizadaReal ? "personalizada" : "predefinida",
  };
  // Avanzado: caras por paso — el override gana sobre `caras` global en el
  // motor solo para ese paso (ej. original doble faz, duplicado simple).
  for (const [configPasoId, carasPaso] of Object.entries(
    config.carasPorPaso ?? {},
  )) {
    if (carasPaso === 1 || carasPaso === 2) {
      ctx[`caras_${configPasoId}`] = carasPaso;
    }
  }
  const materialLinealMetrics =
    cotizaLinealDirecto
      ? getSelectedLinearMaterialMetrics(
          productoDetalle,
          slotsComercialElige,
          config,
          includeConfig,
        )
      : null;
  const anchoMaterialLinealMm = materialLinealMetrics?.materialWidthMm ?? null;
  const anchoUtilLinealMm = materialLinealMetrics?.usableWidthMm ?? null;
  const piezaLinealDirecta =
    anchoUtilLinealMm && qty > 0
      ? [
          {
            uiKey: "lineal-directo",
            cantidad: 1,
            anchoMm: anchoUtilLinealMm,
            altoMm: qty * 1000,
          },
        ]
      : [];

  const piezasContexto =
    usaMedidaPersonalizadaReal
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
      cantidad: piezasUsanCantidadComercial ? qty : pieza.cantidad,
      anchoMm: pieza.anchoMm,
      altoMm: pieza.altoMm,
    }));
    ctx.piezaAnchoMaxMm = Math.max(...piezasContexto.map((pieza) => pieza.anchoMm));
    ctx.piezaAltoMaxMm = Math.max(...piezasContexto.map((pieza) => pieza.altoMm));
    ctx.piezaAreaTotalM2 = piezasContexto.reduce(
      (total, pieza) =>
        total +
        ((piezasUsanCantidadComercial ? qty : pieza.cantidad) *
          pieza.anchoMm *
          pieza.altoMm) /
          1_000_000,
      0,
    );
    ctx.piezaPerimetroTotalM = piezasContexto.reduce((total, pieza) => {
      const cantidadPieza = piezasUsanCantidadComercial ? qty : pieza.cantidad;
      const perimetroMm = 2 * (pieza.anchoMm + pieza.altoMm);
      return total + (cantidadPieza * perimetroMm) / 1000;
    }, 0);
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
        ctx.anchoUtilMaterialMm = anchoUtilLinealMm;
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

  // Override explícito de perfil de impresión elegido por el comercial
  // ("Modificar perfil"). El motor lo valida contra la máquina activa.
  for (const [configPasoId, perfilId] of Object.entries(config.seleccionPerfil)) {
    if (perfilId) ctx[`perfilSeleccionado_${configPasoId}`] = perfilId;
  }

  const rutaSel = getRutaSeleccionada(productoDetalle, config.rutaAlternativaId);
  const tecnologiasActivas = new Set<string>();
  for (const configPaso of rutaSel?.configPasos ?? []) {
    if (!includeConfig(configPaso)) continue;
    const machine = getActiveMachineForConfig(configPaso, config);
    if (!machine) continue;
    const technology = getMachineTechnology(machine);
    if (!technology) continue;
    ctx[`tecnologia_${configPaso.id}`] = technology;
    ctx[`tecnologia_${configPaso.rutaPasoId}`] = technology;
    tecnologiasActivas.add(technology);
  }
  if (tecnologiasActivas.size === 1) {
    ctx.tecnologia = Array.from(tecnologiasActivas)[0];
  }

  const modosColorComercial = getModosColorComercial(
    rutaSel,
    includeConfig,
    config,
  ).filter(
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

  // Diseño del sello (configurador): viaja como dato de producción, no afecta el
  // costeo. Se refleja también en especificaciones para la ficha/OT.
  if (config.disenoSello) {
    ctx.disenoSello = config.disenoSello;
  }

  // Tiempo estimado por el comercial (docs/tiempo-manual-por-paso-diseno.md):
  // minutos por paso. Sin valor efectivo no se manda la clave y el motor
  // calcula el paso como siempre.
  const tiemposManuales = getTiemposManualesComercial(
    rutaSel,
    includeConfig,
  ).filter(
    (item) =>
      item.modoActivacion !== "OPCIONAL" ||
      Boolean(config.opcionalesActivados[item.configPasoId]),
  );
  for (const item of tiemposManuales) {
    const efectivo = getTiempoManualEfectivoMin(item, config);
    if (efectivo != null) {
      ctx[`tiempoManualMin_${item.configPasoId}`] = efectivo;
    }
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
    if (usaCantidadComercialParaPiezas(productoDetalle)) {
      return qty;
    }

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

function formatCommercialQuantity(value: number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 4,
  }).format(value);
}

function getMinimumCommercialStatus(
  product: CatalogProduct,
  productoDetalle: ProductoDetalle | null,
  config: MotorConfigState | undefined,
  qty: number,
  cotizacion?: CotizacionExitosa | null,
) {
  const minimo = product.minimoComercialCantidad;
  if (
    !product.real ||
    product.minimoComercialPolitica === "NONE" ||
    !minimo ||
    minimo <= 0
  ) {
    return null;
  }
  if (product.minimoComercialBase === "pliegos_impresos") {
    const aplicado = cotizacion?.minimoComercialAplicado;
    if (aplicado?.base === "pliegos_impresos") {
      const realLabel = `${formatCommercialQuantity(aplicado.cantidadReal)} ${aplicado.unidadLabel}`;
      const minimoLabel = `${formatCommercialQuantity(aplicado.cantidadMinima)} ${aplicado.unidadLabel}`;
      if (aplicado.politica === "BLOQUEAR" && aplicado.cantidadReal < aplicado.cantidadMinima) {
        return {
          kind: "blocked" as const,
          message: `Se necesitan ${realLabel}, pero este producto requiere un mínimo de ${minimoLabel}.`,
          cantidadReal: aplicado.cantidadReal,
          minimo: aplicado.cantidadMinima,
        };
      }
      if (aplicado.aplicado) {
        return {
          kind: "warning" as const,
          message: `Se necesitan ${realLabel}, pero se cobrará el mínimo de ${minimoLabel}.`,
          cantidadReal: aplicado.cantidadReal,
          minimo: aplicado.cantidadMinima,
        };
      }
      return null;
    }
    return {
      kind: "info" as const,
      message: `El mínimo de ${formatCommercialQuantity(minimo)} pliegos se verificará al cotizar porque depende del nesting.`,
      cantidadReal: 0,
      minimo,
    };
  }
  const cantidadReal = calcularCantidadComercial(product, productoDetalle, config, qty);
  if (cantidadReal >= minimo) return null;
  const minimoLabel = `${formatCommercialQuantity(minimo)} ${product.unidad}`;
  if (product.minimoComercialPolitica === "BLOQUEAR") {
    return {
      kind: "blocked" as const,
      message: `Este producto requiere un mínimo de ${minimoLabel}.`,
      cantidadReal,
      minimo,
    };
  }
  return {
    kind: "warning" as const,
    message: `Cantidad menor al mínimo comercial. Se cobrará como ${minimoLabel}.`,
    cantidadReal,
    minimo,
  };
}

function buildPresentableSpecs(
  product: CatalogProduct,
  productoDetalle: ProductoDetalle | null,
  config: MotorConfigState,
  qty: number,
  specs: Record<string, string>,
  slotsComercialElige: SlotComercialElige[],
  ruleContext: Record<string, unknown>,
) {
  const base = Object.fromEntries(
    product.specs.map((spec) => [spec.key, specs[spec.key] ?? spec.def]),
  );
  const hasSpec = (key: string) => product.specs.some((spec) => spec.key === key);
  const setSpec = (key: string, value: string | undefined) => {
    if (!value) return;
    if (!hasSpec(key) && !ENRICHED_SPEC_LABELS[key]) return;
    if (!hasUsefulSpecValue(value)) return;
    base[key] = value;
  };
  const rutaSeleccionada = getRutaSeleccionada(productoDetalle, config.rutaAlternativaId);
  const hardcodedMaterials =
    rutaSeleccionada?.configPasos
      .filter(
        (paso) => isConfigPasoVisibleForContext(paso, config, ruleContext),
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
  const usaMedidasPersonalizadas =
    usaPiezasParaCotizar(productoDetalle, config) && config.piezas.length > 0;
  if (usaMedidasPersonalizadas) {
    // Agrupamos por medida sumando cantidades para mostrar "N u. × ancho x alto".
    // Sin esto, dos piezas del mismo tamaño (frecuente al leer varios PDF)
    // colapsaban a una sola línea perdiendo la cantidad. La cantidad lleva
    // "u." para que no se lea como una dimensión más ("100 × 2 × 2 cm").
    // Espejo de buildJobContext: para productos por unidad la cantidad que
    // cotiza el motor es la comercial (qty), no la de la fila de pieza.
    const piezasUsanCantidadComercial = usaCantidadComercialParaPiezas(productoDetalle);
    const grupos = new Map<string, number>();
    for (const pieza of config.piezas) {
      const medida = formatMedidasCm(pieza.anchoMm, pieza.altoMm);
      const cantidad = piezasUsanCantidadComercial
        ? qty
        : Number.isFinite(pieza.cantidad)
          ? pieza.cantidad
          : 0;
      grupos.set(medida, (grupos.get(medida) ?? 0) + cantidad);
    }
    const medidas = Array.from(grupos.entries())
      .map(([medida, cantidad]) => `${cantidad.toLocaleString("es-AR")} u. × ${medida}`)
      .join("\n");
    setSpec("medidas", medidas);
    setSpec("formato_medidas", medidas);
    setSpec("m2_medidas_instaladas", medidas);
  } else if (productoDetalle) {
    const medidas =
      productoDetalle.unidadComercial === "metro_lineal"
        ? `${qty.toLocaleString("es-AR")} ml`
        : formatDefaultMedidas(productoDetalle);
    setSpec("medidas", medidas);
    setSpec("formato_medidas", medidas);
  }
  const medidaPredefinida = getSelectedPredefinedMeasure(
    productoDetalle,
    config.medidaPredefinidaId,
  );
  if (medidaPredefinida && !usaMedidasPersonalizadas) {
    const medidas = formatMedidaPredefinidaSpec(medidaPredefinida);
    setSpec("medidas", medidas);
    setSpec("formato_medidas", medidas);
  }
  const usaCaras = routeUsesCaras(rutaSeleccionada, (paso) =>
    isConfigPasoVisibleForContext(paso, config, ruleContext),
  );
  if (usaCaras) {
    // Se muestra siempre que el producto use caras (aunque el schema no declare
    // el atributo): `setSpec` lo habilita porque "caras" está en
    // ENRICHED_SPEC_LABELS, y el item lo surfacea como spec "Faz".
    // Con overrides por paso (avanzado), el detalle por paso reemplaza al
    // global para que producción sepa qué copia va doble faz.
    const overrides = Object.entries(config.carasPorPaso ?? {}).filter(
      ([, caras]) => caras === 1 || caras === 2,
    );
    const overridesDistintos = overrides.filter(
      ([, caras]) => caras !== config.caras,
    );
    if (overridesDistintos.length > 0) {
      const detallePorPaso = rutaSeleccionada?.configPasos
        .filter((paso) =>
          overrides.some(([configPasoId]) => configPasoId === paso.id),
        )
        .map((paso) => {
          const caras = config.carasPorPaso[paso.id];
          const nombre =
            paso.nombreVisible?.trim() ||
            humanizeCodigo(paso.rutaPaso.familiaCodigo);
          return `${nombre}: ${caras === 2 ? "doble" : "simple"} faz`;
        });
      const resto = `Resto: ${config.caras === 2 ? "doble" : "simple"} faz`;
      setSpec(
        "caras",
        [...(detallePorPaso ?? []), resto].join(" · "),
      );
    } else {
      setSpec("caras", config.caras === 2 ? "Doble faz" : "Simple faz");
    }
  }
  const modosColor = getModosColorComercial(
    rutaSeleccionada,
    (paso) => isConfigPasoVisibleForContext(paso, config, ruleContext),
    config,
  );
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
        ? `${modo.nombreVisible?.trim() || humanizeCodigo(modo.familiaCodigo)}: ${label}`
        : label;
    })
    .filter((value): value is string => Boolean(value));
  if (selectedModoColorLabels.length > 0) {
    setSpec("impresion", selectedModoColorLabels.join(" · "));
    setSpec("color", selectedModoColorLabels.join(" · "));
    base.modo_color = selectedModoColorLabels.join(" · ");
  }
  const processLabels = getProcessLabels(rutaSeleccionada, config, ruleContext);
  if (processLabels.length > 0) {
    const proceso = processLabels.join(" / ");
    setSpec("tecnologia", proceso);
    setSpec("tecnologia_proceso", proceso);
    setSpec("proceso", proceso);
  }
  const usaTipoCopia = routeUsesTipoCopia(
    rutaSeleccionada,
    isExecutableConfigPaso,
  );
  if (product.subcategoriaComercialCodigo === "talonarios" || usaTipoCopia) {
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

function hasUsefulSpecValue(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length > 0 &&
    normalized !== "a definir" &&
    !normalized.includes("opcional")
  );
}

function isModoColorDuplicateSpec(
  key: string,
  value: string | undefined,
  specs?: Record<string, string>,
) {
  if (!["impresion", "impresion_color", "color"].includes(key)) return false;
  const modoColor = specs?.modo_color;
  if (!hasUsefulSpecValue(value) || !hasUsefulSpecValue(modoColor)) return false;
  return value.trim().toLowerCase() === modoColor.trim().toLowerCase();
}

function shouldShowCommercialSpec(
  spec: CatalogSpec,
  value: string | undefined,
  product: Pick<CatalogProduct, "real">,
  specs?: Record<string, string>,
) {
  const hiddenKeys = new Set(["tipo_pieza", "tipoPieza", "tipo_de_pieza"]);
  if (hiddenKeys.has(spec.key)) return false;
  if (isModoColorDuplicateSpec(spec.key, value, specs)) return false;
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
    ruleContext: Record<string, unknown>;
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
        qty,
        specs,
        options.slotsComercialElige,
        options.ruleContext,
      )
    : Object.fromEntries(
        product.specs.map((spec) => [spec.key, specs[spec.key] ?? spec.def]),
      );
  if (cotizacion.minimoComercialAplicado?.aplicado) {
    const minimo = cotizacion.minimoComercialAplicado;
    especificaciones.minimo_comercial = `Se necesitan ${formatCommercialQuantity(minimo.cantidadReal)} ${minimo.unidadLabel}; se cobra mínimo de ${formatCommercialQuantity(minimo.cantidadMinima)} ${minimo.unidadLabel}.`;
  }
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
  const cantidadComercial = getCotizacionCantidadReal(
    cotizacion,
    calcularCantidadComercial(
      product,
      options?.productoDetalle ?? null,
      options?.motorConfig,
      qty,
    ),
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
    visible: shouldShowCommercialSpec(spec, especificaciones[spec.key], product, especificaciones),
    orden: (index + 1) * 10,
  }));
  if (
    hasUsefulSpecValue(especificaciones.minimo_comercial) &&
    !atributosSchema.some((attr) => attr.key === "minimo_comercial")
  ) {
    atributosSchema.push({
      key: "minimo_comercial",
      label: "Mínimo comercial",
      tipo: "text",
      visible: true,
      orden: 95,
    });
  }
  for (const key of ENRICHED_SPEC_ORDER) {
    if (!hasUsefulSpecValue(especificaciones[key])) continue;
    if (atributosSchema.some((attr) => attr.key === key)) continue;
    atributosSchema.push({
      key,
      label: ENRICHED_SPEC_LABELS[key] ?? humanizeCodigo(key),
      tipo: "text",
      visible: true,
      orden: 1_000 + ENRICHED_SPEC_ORDER.indexOf(key) * 10,
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
  const seleccionPerfil = Object.fromEntries(
    Object.entries(ctx)
      .filter(
        ([key, value]) =>
          key.startsWith("perfilSeleccionado_") && typeof value === "string",
      )
      .map(([key, value]) => [
        key.replace("perfilSeleccionado_", ""),
        value as string,
      ]),
  );
  const tiempoManualPorPaso = Object.fromEntries(
    Object.entries(ctx)
      .filter(
        ([key, value]) =>
          key.startsWith("tiempoManualMin_") &&
          Number.isFinite(Number(value)) &&
          Number(value) > 0,
      )
      .map(([key, value]) => [
        key.replace("tiempoManualMin_", ""),
        Number(value),
      ]),
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
  const medidaPredefinidaId =
    typeof ctx.medidaPredefinidaId === "string" ? ctx.medidaPredefinidaId : "";
  const medidaModo =
    typeof ctx.medidaModo === "string" ? ctx.medidaModo : "";
  const restaurarPiezasPersonalizadas =
    medidaModo === "personalizada" ||
    (!medidaModo && !medidaPredefinidaId && piezas.length > 0);

  return {
    ...DEFAULT_MOTOR_CONFIG,
    rutaAlternativaId: item.rutaAlternativaId ?? "",
    medidaPredefinidaId,
    caras: Number(ctx.caras) === 2 ? 2 : 1,
    tiempoManualPorPaso,
    disenoSello:
      ctx.disenoSello && typeof ctx.disenoSello === "object"
        ? (ctx.disenoSello as DisenoSello)
        : null,
    tipoCopia:
      Number(ctx.tipoCopia) === 3 ? 3 : Number(ctx.tipoCopia) === 2 ? 2 : 1,
    numerosXTalonario:
      Number.isFinite(Number(ctx.numerosXTalonario)) && Number(ctx.numerosXTalonario) > 0
        ? Number(ctx.numerosXTalonario)
        : DEFAULT_MOTOR_CONFIG.numerosXTalonario,
    piezas: restaurarPiezasPersonalizadas ? piezas : [],
    opcionalesActivados: Object.fromEntries(
      Object.entries(opcionalesRaw).map(([key, value]) => [key, Boolean(value)]),
    ),
    seleccionMaterial: Object.fromEntries(
      Object.entries(slotMaterialesRaw)
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => [key, value as string]),
    ),
    seleccionMaquina,
    seleccionPerfil,
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
  const [activeIndex, setActiveIndex] = React.useState(0);
  const activeResultRef = React.useRef<HTMLButtonElement | null>(null);
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
  const activeProduct =
    filtered.length > 0
      ? filtered[Math.min(activeIndex, filtered.length - 1)]
      : null;

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query, family]);

  React.useEffect(() => {
    if (activeIndex > filtered.length - 1) {
      setActiveIndex(Math.max(0, filtered.length - 1));
    }
  }, [activeIndex, filtered.length]);

  React.useEffect(() => {
    activeResultRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeIndex]);

  return (
    <>
      <div className="ap-search">
        <SearchIcon />
        <input
          autoFocus
          placeholder="Buscar por código, nombre o descripción..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((current) =>
                filtered.length === 0
                  ? 0
                  : Math.min(current + 1, filtered.length - 1),
              );
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => Math.max(current - 1, 0));
              return;
            }
            if (event.key !== "Enter" || !activeProduct) return;
            event.preventDefault();
            onPick(activeProduct);
          }}
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
                  <span className="cd">{product.family}</span>
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
          {filtered.map((product, index) => (
            <button
              key={product.code}
              ref={activeProduct?.code === product.code ? activeResultRef : null}
              type="button"
              className={`ap-prod ${activeProduct?.code === product.code ? "is-keyboard-target" : ""}`}
              aria-selected={activeProduct?.code === product.code}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onPick(product)}
            >
              <span className="ap-prod-main">
                <span className="ap-prod-head">
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
  const slotsParaReglas = React.useMemo(
    () =>
      getSlotsParaCotizacion(rutaSel, productoDetalle, {
        modoCotizacionLineal: motorConfig.modoCotizacionLineal,
      }),
    [motorConfig.modoCotizacionLineal, productoDetalle, rutaSel],
  );
  const ruleContext = React.useMemo(
    () => buildJobContext(productoDetalle, motorConfig, qty, slotsParaReglas),
    [motorConfig, productoDetalle, qty, slotsParaReglas],
  );
  const includeVisibleConfig = React.useCallback(
    (config: ConfigPasoDetalle) =>
      isConfigPasoVisibleForContext(config, motorConfig, ruleContext),
    [motorConfig, ruleContext],
  );
  const opcionalesRuta = React.useMemo(
    () =>
      product.real && productoDetalle
        ? getOpcionales(productoDetalle, rutaSel, motorConfig, ruleContext)
        : product.adicionales,
    [motorConfig, product, productoDetalle, rutaSel, ruleContext],
  );
  const slotsComercialElige = React.useMemo(
    () => getSlotsComercialElige(rutaSel, includeVisibleConfig),
    [includeVisibleConfig, rutaSel],
  );
  const slotsLinealesDirectos = React.useMemo(
    () => getSlotsMaterialesLinealDirecto(rutaSel, includeVisibleConfig),
    [includeVisibleConfig, rutaSel],
  );
  const slotsMaterialesPrincipales = slotsComercialElige.filter(
    (slot) => slot.modoActivacion !== "OPCIONAL",
  );
  // Configurador de sello: activo si el producto tiene la herramienta y hay un
  // cuerpo de sello elegido (variante con tamaño de polímero + líneas de texto).
  const editorSelloHabilitado = getHerramientaEditorSello(
    productoDetalle?.atributosComercialesJson,
  ).enabled;
  const selloModel: SelloEditorModel | null = React.useMemo(() => {
    if (!editorSelloHabilitado) return null;
    for (const slot of slotsComercialElige) {
      const { variant } = findSelectedCandidateVariant(slot, motorConfig);
      if (variant?.sello) return variant.sello;
    }
    return null;
  }, [editorSelloHabilitado, slotsComercialElige, motorConfig]);
  const [selloEditorAbierto, setSelloEditorAbierto] = React.useState(false);
  const slotsMaterialesOpcionalesPorPaso = React.useMemo(
    () => getSlotsOpcionalesPorPaso(slotsComercialElige),
    [slotsComercialElige],
  );
  // Pasos con tiempo estimado por el comercial (visibles según ruta/opcionales).
  const tiemposManualesComercial = React.useMemo(
    () => getTiemposManualesComercial(rutaSel, includeVisibleConfig),
    [rutaSel, includeVisibleConfig],
  );
  const tiemposManualesPorConfigPaso = React.useMemo(
    () =>
      new Map(
        tiemposManualesComercial.map((item) => [item.configPasoId, item]),
      ),
    [tiemposManualesComercial],
  );
  // Los inputs de tiempo de pasos NO opcionales van con los datos del producto;
  // los de pasos opcionales se configuran en la card del opcional activado.
  const tiemposManualesPrincipales = tiemposManualesComercial.filter(
    (item) => item.modoActivacion !== "OPCIONAL",
  );
  const opcionalesConfigurables = React.useMemo(
    () =>
      opcionalesRuta
        .map((opcional) => ({
          opcional,
          slots: slotsMaterialesOpcionalesPorPaso.get(opcional.code) ?? [],
          tiempoManual: opcional.configPasoId
            ? (tiemposManualesPorConfigPaso.get(opcional.configPasoId) ?? null)
            : null,
        }))
        .filter(
          (item) =>
            product.real &&
            adi.includes(item.opcional.code) &&
            (item.slots.length > 0 || item.tiempoManual !== null),
        ),
    [
      adi,
      opcionalesRuta,
      product.real,
      slotsMaterialesOpcionalesPorPaso,
      tiemposManualesPorConfigPaso,
    ],
  );
  const pasosConTecnologias = React.useMemo(
    () => getPasosConTecnologias(rutaSel, includeVisibleConfig),
    [includeVisibleConfig, rutaSel],
  );
  const pasosQueRequierenTecnologia = React.useMemo(
    () => new Set(pasosConTecnologias.map((paso) => paso.configPasoId)),
    [pasosConTecnologias],
  );
  const modosColorComercial = React.useMemo(
    () => getModosColorComercial(rutaSel, includeVisibleConfig, motorConfig),
    [includeVisibleConfig, motorConfig, rutaSel],
  );
  const modosColorVisibles = modosColorComercial.filter(
    (modo) =>
      !pasosQueRequierenTecnologia.has(modo.configPasoId) ||
      Boolean(motorConfig.seleccionMaquina[modo.configPasoId]),
  );
  const necesitaInstalacion = getProductoNecesitaInstalacion(productoDetalle);
  const medidasPredefinidas = React.useMemo(
    () =>
      modoMedidasUsaPredefinidas(productoDetalle?.modoMedidas)
        ? getMedidasPredefinidas(productoDetalle)
        : [],
    [productoDetalle],
  );
  const usaMedidaMixta = productoDetalle?.modoMedidas === "MIXTA";
  const usaMedidaPersonalizada =
    modoMedidasPermitePersonalizada(productoDetalle?.modoMedidas) &&
    (productoDetalle?.modoMedidas !== "MIXTA" || motorConfig.piezas.length > 0);
  const piezasUsanCantidadComercial = usaCantidadComercialParaPiezas(productoDetalle);
  const piezaFocusRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const focusPiezaCantidadKey = React.useRef<string | null>(null);
  const planosInputRef = React.useRef<HTMLInputElement | null>(null);
  const [piezaMeasureDrafts, setPiezaMeasureDrafts] = React.useState<
    Record<string, { anchoCm?: string; altoCm?: string }>
  >({});

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
    const pieza = createDefaultPiezaInput();
    focusPiezaCantidadKey.current = pieza.uiKey;
    setMotorConfig((current) => ({
      ...current,
      piezas: [...current.piezas, pieza],
    }));
  }, [setMotorConfig]);

  React.useEffect(() => {
    const uiKey = focusPiezaCantidadKey.current;
    if (!uiKey) return;
    const input = piezaFocusRefs.current[uiKey];
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

  const herramientaMedidasArchivo = React.useMemo(
    () => getHerramientaMedidasArchivo(productoDetalle?.atributosComercialesJson),
    [productoDetalle],
  );
  const [leyendoPlanos, setLeyendoPlanos] = React.useState(false);
  const [arrastrandoPlanos, setArrastrandoPlanos] = React.useState(false);
  // Slot cuyo desplegable de material está abierto (selector tipo lista).
  const [openMaterialSlot, setOpenMaterialSlot] = React.useState<string | null>(null);

  const handleAdjuntarPlanos = React.useCallback(
    async (files: FileList | File[]) => {
      const lista = Array.from(files);
      if (lista.length === 0) return;
      setLeyendoPlanos(true);
      try {
        const resultados = await leerMedidasPdf(lista);
        const nuevas: PiezaInput[] = [];
        const errores: string[] = [];
        for (const resultado of resultados) {
          if (!resultado.ok) {
            errores.push(`${resultado.archivoNombre}: ${resultado.error}`);
            continue;
          }
          for (const pagina of resultado.paginas) {
            nuevas.push({
              uiKey: `pz-${Date.now()}-${Math.random()}`,
              cantidad: 1,
              anchoMm: pagina.anchoMm,
              altoMm: pagina.altoMm,
              origen: {
                archivoNombre: pagina.archivoNombre,
                pagina: pagina.pagina,
                totalPaginas: pagina.totalPaginas,
                anchoDetectadoMm: pagina.anchoMm,
                altoDetectadoMm: pagina.altoMm,
              },
            });
          }
        }
        if (nuevas.length > 0) {
          setMotorConfig((current) => {
            const previas = current.piezas.filter(
              (pieza) => pieza.origen || pieza.anchoMm > 0 || pieza.altoMm > 0,
            );
            return {
              ...current,
              medidaPredefinidaId: "",
              piezas: [...previas, ...nuevas],
            };
          });
          const archivosOk = resultados.filter((resultado) => resultado.ok).length;
          toast.success(
            `${nuevas.length} ${nuevas.length === 1 ? "medida leída" : "medidas leídas"} de ${archivosOk} ${archivosOk === 1 ? "archivo" : "archivos"}`,
          );
        }
        if (errores.length > 0) {
          toast.error(errores.join(" · "));
        }
      } finally {
        setLeyendoPlanos(false);
      }
    },
    [setMotorConfig],
  );

  const getPiezaMeasureValue = React.useCallback(
    (pieza: PiezaInput, field: "anchoCm" | "altoCm") => {
      const draft = piezaMeasureDrafts[pieza.uiKey]?.[field];
      if (draft !== undefined) return draft;
      return formatCmInputFromMm(field === "anchoCm" ? pieza.anchoMm : pieza.altoMm);
    },
    [piezaMeasureDrafts],
  );

  const updatePiezaMeasure = React.useCallback(
    (index: number, pieza: PiezaInput, field: "anchoCm" | "altoCm", value: string) => {
      setPiezaMeasureDrafts((current) => ({
        ...current,
        [pieza.uiKey]: { ...current[pieza.uiKey], [field]: value },
      }));
      const normalized = value.trim().replace(",", ".");
      if (normalized === "") {
        updatePieza(index, { [field === "anchoCm" ? "anchoMm" : "altoMm"]: 0 });
        return;
      }
      const parsed = Number.parseFloat(normalized);
      if (Number.isFinite(parsed)) {
        updatePieza(index, {
          [field === "anchoCm" ? "anchoMm" : "altoMm"]: cmToMm(parsed),
        });
      }
    },
    [updatePieza],
  );

  const commitPiezaMeasure = React.useCallback((pieza: PiezaInput, field: "anchoCm" | "altoCm") => {
    setPiezaMeasureDrafts((current) => {
      const currentDraft = current[pieza.uiKey];
      if (!currentDraft || currentDraft[field] === undefined) return current;
      const nextDraft = { ...currentDraft };
      delete nextDraft[field];
      const next = { ...current };
      if (nextDraft.anchoCm === undefined && nextDraft.altoCm === undefined) {
        delete next[pieza.uiKey];
      } else {
        next[pieza.uiKey] = nextDraft;
      }
      return next;
    });
  }, []);

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

  React.useEffect(() => {
    if (!product.real) return;
    const optionalCodes = new Set(opcionalesRuta.map((opcional) => opcional.code));
    const materialKeys = new Set(
      slotsComercialElige.map((slot) =>
        materialSelectionKey(slot.configPasoId, slot.slotCodigo),
      ),
    );
    const machineKeys = new Set(pasosConTecnologias.map((paso) => paso.configPasoId));
    const colorKeys = new Set(modosColorComercial.map((modo) => modo.configPasoId));

    setMotorConfig((current) => {
      const opcionalesActivados = Object.fromEntries(
        Object.entries(current.opcionalesActivados).filter(([key]) =>
          optionalCodes.has(key),
        ),
      );
      const seleccionMaterial = Object.fromEntries(
        Object.entries(current.seleccionMaterial).filter(([key]) =>
          materialKeys.has(key),
        ),
      );
      const seleccionMaquina = Object.fromEntries(
        Object.entries(current.seleccionMaquina).filter(([key]) =>
          machineKeys.has(key),
        ),
      );
      for (const paso of pasosConTecnologias) {
        if (seleccionMaquina[paso.configPasoId]) continue;
        const preferredCandidate = getPreferredCandidate(
          paso.tecnologias.flatMap((tech) => tech.candidatas),
        );
        if (preferredCandidate) {
          seleccionMaquina[paso.configPasoId] = preferredCandidate.maquinaId;
        }
      }
      const seleccionModoColor = Object.fromEntries(
        Object.entries(current.seleccionModoColor).filter(([key]) =>
          colorKeys.has(key),
        ),
      );
      for (const modo of modosColorComercial) {
        const selected = normalizeModoColor(seleccionModoColor[modo.configPasoId]);
        const validValues = new Set(
          modo.options
            .map((option) => normalizeModoColor(option.value))
            .filter((value): value is string => Boolean(value)),
        );
        if (selected && validValues.has(selected)) continue;
        const fallback =
          modo.defaultMode && validValues.has(modo.defaultMode)
            ? modo.defaultMode
            : Array.from(validValues)[0];
        if (fallback) {
          seleccionModoColor[modo.configPasoId] = fallback;
        } else {
          delete seleccionModoColor[modo.configPasoId];
        }
      }

      if (
        Object.keys(opcionalesActivados).length ===
          Object.keys(current.opcionalesActivados).length &&
        Object.keys(seleccionMaterial).length ===
          Object.keys(current.seleccionMaterial).length &&
        Object.keys(seleccionMaquina).length ===
          Object.keys(current.seleccionMaquina).length &&
        Object.entries(seleccionMaquina).every(
          ([key, value]) => current.seleccionMaquina[key] === value,
        ) &&
        Object.keys(seleccionModoColor).length ===
          Object.keys(current.seleccionModoColor).length &&
        Object.entries(seleccionModoColor).every(
          ([key, value]) => current.seleccionModoColor[key] === value,
        )
      ) {
        return current;
      }

      return {
        ...current,
        opcionalesActivados,
        seleccionMaterial,
        seleccionMaquina,
        seleccionModoColor,
      };
    });
  }, [
    modosColorComercial,
    opcionalesRuta,
    pasosConTecnologias,
    product.real,
    setMotorConfig,
    slotsComercialElige,
  ]);

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
      setMotorConfig((current) => {
        // Al cambiar de máquina se descarta el override de perfil del paso:
        // el perfil pertenece a la máquina anterior.
        const seleccionPerfil = { ...current.seleccionPerfil };
        if (current.seleccionMaquina[configPasoId] !== value) {
          delete seleccionPerfil[configPasoId];
        }
        return {
          ...current,
          seleccionMaquina: {
            ...current.seleccionMaquina,
            [configPasoId]: value,
          },
          seleccionPerfil,
        };
      });
    },
    [setMotorConfig],
  );

  const setPerfil = React.useCallback(
    (configPasoId: string, value: string) => {
      setMotorConfig((current) => {
        const seleccionPerfil = { ...current.seleccionPerfil };
        if (value) seleccionPerfil[configPasoId] = value;
        else delete seleccionPerfil[configPasoId];
        return { ...current, seleccionPerfil };
      });
    },
    [setMotorConfig],
  );

  const setModoColor = React.useCallback(
    (configPasoId: string, value: string) => {
      setMotorConfig((current) => {
        // Al cambiar el modo de color se descarta el override de perfil del
        // paso: el perfil elegido pertenecía al modo anterior.
        const seleccionPerfil = { ...current.seleccionPerfil };
        const next = normalizeModoColor(value) ?? value;
        if (current.seleccionModoColor[configPasoId] !== next) {
          delete seleccionPerfil[configPasoId];
        }
        return {
          ...current,
          seleccionModoColor: {
            ...current.seleccionModoColor,
            [configPasoId]: next,
          },
          seleccionPerfil,
        };
      });
    },
    [setMotorConfig],
  );

  const renderSegmentedControl = (
    name: string,
    value: string,
    options: Array<{ value: string; label: string }>,
    onChange: (value: string) => void,
    equalWidth = false,
    wrapFourColumns = false,
  ) => (
    <div
      className={`ap-segmented${equalWidth ? " ap-segmented-equal" : ""}${options.length === 1 ? " ap-segmented-single" : ""}${wrapFourColumns ? " ap-segmented-grid-4" : ""}`}
      role="radiogroup"
      style={
        equalWidth
          ? ({ "--ap-segmented-count": options.length } as React.CSSProperties)
          : undefined
      }
    >
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

  const renderChoiceCards = (
    name: string,
    value: string,
    options: Array<{
      value: string;
      label: string;
      desc?: string;
      glyph?: React.ReactNode;
    }>,
    onChange: (value: string) => void,
    opts?: { columns?: 2 | 3; layout?: "row" | "tile" },
  ) => {
    const columns = opts?.columns ?? (options.length <= 2 ? 2 : 3);
    const layout = opts?.layout ?? "row";
    return (
      <div
        className={`ap-choice-grid ap-choice-grid-${columns} ap-choice-${layout}`}
        role="radiogroup"
        aria-label={name}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              className={`ap-choice ${selected ? "on" : ""}`}
              role="radio"
              aria-checked={selected}
              aria-label={`${name}: ${option.label}`}
              onClick={() => onChange(option.value)}
            >
              {option.glyph ? (
                <span className="ap-choice-glyph">{option.glyph}</span>
              ) : null}
              <span className="ap-choice-txt">
                <span className="ap-choice-nm">{option.label}</span>
                {option.desc ? (
                  <span className="ap-choice-desc">{option.desc}</span>
                ) : null}
              </span>
              <span className="ap-choice-tick" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    );
  };

  const renderMedidaCards = (
    selectedId: string,
    medidas: Array<{ id: string; nombre: string; anchoMm: number; altoMm: number }>,
    onSelect: (id: string) => void,
    allowCustom: boolean,
  ) => (
    <div className="ap-size-grid" role="radiogroup" aria-label="Medida">
      {medidas.map((medida) => {
        const size = formatMedidasCm(medida.anchoMm, medida.altoMm);
        const rawLabel = medidaLabel(medida);
        const isMmFallback = rawLabel.includes(" mm");
        const name = isMmFallback ? size : rawLabel;
        const real = isMmFallback ? null : size;
        const selected = medida.id === selectedId;
        return (
          <button
            key={medida.id}
            type="button"
            className={`ap-size ${selected ? "on" : ""}`}
            role="radio"
            aria-checked={selected}
            aria-label={`Medida: ${name}`}
            onClick={() => onSelect(medida.id)}
          >
            <span className="ap-size-name">{name}</span>
            {real ? <span className="ap-size-real">{real}</span> : null}
          </button>
        );
      })}
      {allowCustom ? (
        <button
          type="button"
          className={`ap-size ap-size-custom ${selectedId === CUSTOM_MEASURE_ID ? "on" : ""}`}
          role="radio"
          aria-checked={selectedId === CUSTOM_MEASURE_ID}
          aria-label="Medida: a medida"
          onClick={() => onSelect(CUSTOM_MEASURE_ID)}
        >
          <span className="ap-size-name">
            <span className="ap-size-plus" aria-hidden="true">
              +
            </span>
            A medida
          </span>
          <span className="ap-size-hint">Definir cm</span>
        </button>
      ) : null}
    </div>
  );

  const renderOptionList = (
    name: string,
    value: string,
    options: Array<{ value: string; label: string }>,
    onChange: (value: string) => void,
  ) => (
    <div
      className={`ap-option-list${options.length > 2 ? " ap-option-list-grid-2" : ""}`}
      role="radiogroup"
      aria-label={name}
    >
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

  const renderMaterialCardInner = (
    candidate: SlotMaterialCandidato,
    trailing: React.ReactNode,
  ) => {
    const variantCount = candidate.variantes.length;
    return (
      <>
        <span className="ap-mat-badge" aria-hidden="true">
          {materialChipInitials(candidate.label)}
        </span>
        <span className="ap-mat-text">
          <span className="ap-mat-name">{candidate.label}</span>
          {variantCount > 1 ? (
            <span className="ap-mat-meta">{variantCount} variantes</span>
          ) : null}
        </span>
        {trailing}
      </>
    );
  };

  const renderFilmChips = (
    slot: SlotComercialElige,
    selectedMateriaPrimaId: string,
    onSelect: (materiaPrimaId: string) => void,
  ) => {
    const slotKey = materialSelectionKey(slot.configPasoId, slot.slotCodigo);
    const open = openMaterialSlot === slotKey;
    const selectedCandidate =
      slot.candidatos.find(
        (candidate) => candidate.materiaPrimaId === selectedMateriaPrimaId,
      ) ?? slot.candidatos[0];
    if (!selectedCandidate) return null;

    // Un solo candidato: tarjeta informativa, sin desplegable.
    if (slot.candidatos.length === 1) {
      return (
        <div className="ap-mat-select">
          <div className="ap-mat-card is-static">
            {renderMaterialCardInner(selectedCandidate, null)}
          </div>
        </div>
      );
    }

    return (
      <div className={`ap-mat-select ${open ? "is-open" : ""}`}>
        <button
          type="button"
          className="ap-mat-card ap-mat-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpenMaterialSlot(open ? null : slotKey)}
        >
          {renderMaterialCardInner(
            selectedCandidate,
            <svg
              className="ap-mat-chev"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>,
          )}
        </button>
        {open ? (
          <div
            className="ap-mat-list"
            role="radiogroup"
            aria-label={humanizeCodigo(slot.slotCodigo)}
          >
            {slot.candidatos.map((candidate) => {
              const on = candidate.materiaPrimaId === selectedCandidate.materiaPrimaId;
              return (
                <button
                  key={candidate.materiaPrimaId}
                  type="button"
                  className={`ap-mat-card ap-mat-option ${on ? "on" : ""}`}
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    onSelect(candidate.materiaPrimaId);
                    setOpenMaterialSlot(null);
                  }}
                >
                  {renderMaterialCardInner(
                    candidate,
                    <span className="ap-mat-radio" aria-hidden="true" />,
                  )}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  const renderMaterialSelect = (
    slot: SlotComercialElige,
    options?: { showHint?: boolean; collapseSingleCandidate?: boolean },
  ) => {
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
    const materialOptions = slot.candidatos.map((candidate) => ({
      value: candidate.materiaPrimaId,
      label: candidate.label,
    }));
    // Con un solo candidato el selector no ofrece elección: es ruido. En las
    // cards de opcionales (donde el nombre ya está en el encabezado) lo
    // colapsamos y dejamos solo las variantes.
    const hideFilmSelector =
      Boolean(options?.collapseSingleCandidate) && materialOptions.length === 1;
    return (
      <div
        className={`ap-spec ${
          (selectedCandidate && selectedCandidate.variantes.length > 1) ||
          materialOptions.length > 2
            ? "ap-spec-wide"
            : ""
        }`}
        key={key}
      >
        {materialOptions.length === 0 ? (
          <>
            <label>{humanizeCodigo(slot.slotCodigo)}</label>
            <div className="ctrl-input">
              <span>Sin materiales candidatos configurados</span>
            </div>
          </>
        ) : hideFilmSelector ? null : (
          <>
            <label>{humanizeCodigo(slot.slotCodigo)}</label>
            {renderFilmChips(
              slot,
              selectedCandidate?.materiaPrimaId ?? "",
              selectMaterial,
            )}
          </>
        )}
        {selectedCandidate && selectedCandidate.variantes.length > 1 ? (
          useAttributePicker ? (
            <div className="ap-material-attrs">
              <div className="ap-material-attr-block">
                <div className="ap-material-attr-label">
                  Color
                  <span className="ap-sub-count">
                    {colorOptions.length}{" "}
                    {colorOptions.length === 1 ? "disponible" : "disponibles"}
                  </span>
                </div>
                <div className="ap-sub-swatches" role="radiogroup" aria-label="Color">
                  {colorOptions.map((color) => {
                    const firstVariantForColor = selectedCandidate.variantes.find(
                      (variant) => (variant.colorLabel || "Sin color") === color,
                    );
                    const active = selectedColor === color;
                    const swatch = substrateColorSwatch(
                      color === "Sin color" ? null : color,
                    );
                    return (
                      <button
                        key={color}
                        type="button"
                        className={`ap-sub-swatch ${active ? "on" : ""}`}
                        role="radio"
                        aria-checked={active}
                        onClick={() => {
                          if (firstVariantForColor) {
                            setMaterial(key, firstVariantForColor.variantId);
                          }
                        }}
                      >
                        <span
                          className={`ap-sub-swatch-dot ${swatch.ring ? "ring" : ""}`}
                          style={{ background: swatch.background }}
                          aria-hidden="true"
                        />
                        <span>{color}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="ap-material-attr-block">
                <div className="ap-material-attr-label">
                  Espesor
                  {selectedColor && selectedColor !== "Sin color" ? (
                    <span className="ap-sub-count">{selectedColor}</span>
                  ) : null}
                </div>
                <div className="ap-sub-thicks" role="radiogroup" aria-label="Espesor">
                  {variantsBySelectedColor.map((variant) => {
                    const active = variant.variantId === selected;
                    const isDefault =
                      variant.variantId === selectedCandidate.defaultVarianteId;
                    return (
                      <button
                        key={variant.variantId}
                        type="button"
                        className={`ap-sub-thick ${active ? "on" : ""}`}
                        role="radio"
                        aria-checked={active}
                        onClick={() => setMaterial(key, variant.variantId)}
                      >
                        <span className="ap-sub-thick-radio" aria-hidden="true" />
                        <span className="ap-sub-thick-name">
                          {variant.espesorLabel ?? variant.label}
                          {isDefault ? (
                            <span className="ap-sub-rec">Recomendado</span>
                          ) : null}
                        </span>
                        {variant.missingPrice ? (
                          <span className="ap-material-price-alert">Sin precio</span>
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
              {hideFilmSelector ? null : <small>{selectedCandidate.label}</small>}
            </div>
            <div className="ap-variant-grid">
              {(() => {
                const variantCards = describeCandidateVariants(selectedCandidate);
                return selectedCandidate.variantes.map((variant) => {
                  const active = variant.variantId === selected;
                  const isDefault =
                    variant.variantId === selectedCandidate.defaultVarianteId;
                  const card = variantCards.get(variant.variantId);
                  return (
                    <button
                      key={variant.variantId}
                      type="button"
                      className={`ap-variant-card ${active ? "active" : ""}`}
                      role="radio"
                      aria-checked={active}
                      onClick={() => setMaterial(key, variant.variantId)}
                    >
                      <span className="ap-variant-top">
                        <span className="ap-variant-pip" aria-hidden="true" />
                        <span className="ap-variant-title">
                          {card?.title ?? variant.label}
                        </span>
                        {isDefault ? (
                          <span className="ap-variant-badge">Predeterminada</span>
                        ) : null}
                      </span>
                      {card && card.specs.length > 0 ? (
                        <span className="ap-variant-specs">
                          {card.specs.map((spec) => (
                            <span className="ap-variant-spec" key={spec.label}>
                              <span className="k">{spec.label}</span>
                              <span className="v">{spec.value}</span>
                            </span>
                          ))}
                        </span>
                      ) : null}
                      {variant.isFallbackLabel ? (
                        <span className="ap-variant-meta">
                          Sin atributos descriptivos · {variant.sku}
                        </span>
                      ) : null}
                      {variant.missingPrice ? (
                        <span className="ap-variant-alert">Sin precio cargado</span>
                      ) : null}
                    </button>
                  );
                });
              })()}
            </div>
          </div>
          )
        ) : null}
        {options?.showHint !== false &&
        materialOptions.length <= 1 &&
        !useAttributePicker &&
        selectedVariant?.isFallbackLabel ? (
          <p className="ap-spec-hint">
            Esta variante no tiene atributos descriptivos cargados. Código interno:{" "}
            {selectedVariant.sku}
          </p>
        ) : options?.showHint !== false &&
          materialOptions.length <= 1 &&
          !useAttributePicker &&
          selectedVariant?.description ? (
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
  const usaCaras = routeUsesCaras(rutaSel, includeVisibleConfig);
  // Avanzado "caras por paso": pasos visibles que reaccionan a caras. Solo
  // tiene sentido ofrecer el override cuando hay más de uno.
  const pasosConCaras = React.useMemo(
    () =>
      rutaSel?.configPasos.filter(
        (config) =>
          isExecutableConfigPaso(config) &&
          includeVisibleConfig(config) &&
          (config.multiplicadoresActivos.includes("caras") ||
            config.slotsMateriales.some((slot) => slot.aplicaMultiCaras)),
      ) ?? [],
    [rutaSel, includeVisibleConfig],
  );
  const setCarasPaso = (configPasoId: string, value: string) => {
    setMotorConfig((prev) => {
      const next = { ...prev.carasPorPaso };
      if (value === "1" || value === "2") {
        next[configPasoId] = Number(value) as 1 | 2;
      } else {
        delete next[configPasoId];
      }
      return { ...prev, carasPorPaso: next };
    });
  };
  const setTiempoManualPaso = (configPasoId: string, rawValue: string, unidad: "min" | "h") => {
    setMotorConfig((prev) => {
      const parsed = Number(rawValue.replace(",", "."));
      const minutos =
        rawValue.trim() !== "" && Number.isFinite(parsed) && parsed > 0
          ? unidad === "h"
            ? parsed * 60
            : parsed
          : null;
      return {
        ...prev,
        tiempoManualPorPaso: {
          ...prev.tiempoManualPorPaso,
          [configPasoId]: minutos,
        },
      };
    });
  };
  const renderTiempoManualField = (tiempoPaso: TiempoManualComercial) => {
    const nombrePaso =
      tiempoPaso.nombreVisible?.trim() ||
      humanizeCodigo(tiempoPaso.familiaCodigo);
    const label = tiempoPaso.etiqueta || `${nombrePaso} · tiempo estimado`;
    const unidadLabel = tiempoPaso.unidadInput === "h" ? "horas" : "min";
    const efectivoMin = getTiempoManualEfectivoMin(tiempoPaso, motorConfig);
    const displayValue =
      efectivoMin == null
        ? ""
        : tiempoPaso.unidadInput === "h"
          ? efectivoMin / 60
          : efectivoMin;
    const error = getTiempoManualError(tiempoPaso, motorConfig);
    return (
      <div className="ap-spec" key={`tiempo-${tiempoPaso.configPasoId}`}>
        <label>
          {label} ({unidadLabel})
        </label>
        <input
          type="number"
          min={0}
          step={tiempoPaso.unidadInput === "h" ? 0.25 : 1}
          value={displayValue}
          placeholder={tiempoPaso.obligatorio ? "Requerido" : "Automático"}
          onChange={(event) =>
            setTiempoManualPaso(
              tiempoPaso.configPasoId,
              event.target.value,
              tiempoPaso.unidadInput,
            )
          }
        />
        {error ? (
          <div className="ap-minimum-alert is-blocked">
            <CircleAlertIcon />
            <span>{error}</span>
          </div>
        ) : null}
      </div>
    );
  };
  // El bloque de copias (tipo de copia + hojas por talonario) se muestra si el
  // producto es de subcategoría "talonarios" O si su ruta realmente usa
  // `tipoCopia` (algún talonario está en otra subcategoría, ej. papelería).
  const esTalonario =
    product.subcategoriaComercialCodigo === "talonarios" ||
    routeUsesTipoCopia(rutaSel, isExecutableConfigPaso);
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
  const minimoComercialStatus = getMinimumCommercialStatus(
    product,
    productoDetalle,
    motorConfig,
    qty,
    cotizacionExitosa,
  );

  const renderQuantityControl = () => {
    if (usesExactPricingQuantities) {
      return (
        <div className="ap-qty-line">
          <div
            className="ap-qty-shortcuts ap-qty-options ap-qty-options-equal"
            aria-label="Cantidades permitidas"
            style={{ "--ap-qty-count": exactPricingQuantities.length } as React.CSSProperties}
          >
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

  const renderPiezasEditor = (options?: { hideCantidad?: boolean }) => (
    <div className="ap-spec ap-spec-wide">
      <div className="ap-piezas">
        <div
          className={`ap-pieza-head${options?.hideCantidad ? " ap-pieza-head-medidas" : ""}`}
          aria-hidden="true"
        >
          {options?.hideCantidad ? null : (
            <>
              <span>Cantidad</span>
              <span />
            </>
          )}
          <span>Ancho</span>
          <span />
          <span>Alto</span>
          <span />
        </div>
        {motorConfig.piezas.map((pieza, index) => {
          const ajustada =
            pieza.origen != null &&
            (pieza.anchoMm !== pieza.origen.anchoDetectadoMm ||
              pieza.altoMm !== pieza.origen.altoDetectadoMm);
          return (
          <React.Fragment key={pieza.uiKey}>
          <div
            className={`ap-pieza-row${options?.hideCantidad ? " ap-pieza-row-medidas" : ""}`}
          >
            {options?.hideCantidad ? null : (
              <>
                <input
                  ref={(node) => {
                    piezaFocusRefs.current[pieza.uiKey] = node;
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
              </>
            )}
            <label className="ap-input-unit">
              <input
                ref={(node) => {
                  if (options?.hideCantidad) piezaFocusRefs.current[pieza.uiKey] = node;
                }}
                type="text"
                inputMode="decimal"
                value={getPiezaMeasureValue(pieza, "anchoCm")}
                onChange={(event) =>
                  updatePiezaMeasure(index, pieza, "anchoCm", event.target.value)
                }
                onBlur={() => commitPiezaMeasure(pieza, "anchoCm")}
                aria-label="Ancho en cm"
              />
              <span>cm</span>
            </label>
            <span>x</span>
            <label className="ap-input-unit">
              <input
                type="text"
                inputMode="decimal"
                value={getPiezaMeasureValue(pieza, "altoCm")}
                onChange={(event) =>
                  updatePiezaMeasure(index, pieza, "altoCm", event.target.value)
                }
                onBlur={() => commitPiezaMeasure(pieza, "altoCm")}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  addPieza();
                }}
                aria-label="Alto en cm"
              />
              <span>cm</span>
            </label>
            <button
              type="button"
              className="ap-qty-btn"
              onClick={() => removePieza(index)}
              aria-label="Quitar pieza"
            >
              <XIcon />
            </button>
          </div>
          {pieza.origen ? (
            <div className="ap-pieza-origen">
              <PaperclipIcon />
              <span className="nm" title={pieza.origen.archivoNombre}>
                {pieza.origen.archivoNombre}
              </span>
              {pieza.origen.totalPaginas > 1 ? (
                <span className="pg">
                  pág {pieza.origen.pagina}/{pieza.origen.totalPaginas}
                </span>
              ) : null}
              {ajustada ? (
                <span className="adj">· ajustada</span>
              ) : (
                <span className="det">
                  · leída {formatCmFromMm(pieza.origen.anchoDetectadoMm)} ×{" "}
                  {formatCmFromMm(pieza.origen.altoDetectadoMm)} cm
                </span>
              )}
            </div>
          ) : null}
          </React.Fragment>
          );
        })}
        {herramientaMedidasArchivo.enabled ? (
          <div
            className={`ap-planos-tool${arrastrandoPlanos ? " is-dragging" : ""}${leyendoPlanos ? " is-loading" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (!leyendoPlanos) planosInputRef.current?.click();
            }}
            onKeyDown={(event) => {
              if ((event.key === "Enter" || event.key === " ") && !leyendoPlanos) {
                event.preventDefault();
                planosInputRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (!arrastrandoPlanos) setArrastrandoPlanos(true);
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setArrastrandoPlanos(true);
            }}
            onDragLeave={(event) => {
              if (
                event.relatedTarget instanceof Node &&
                event.currentTarget.contains(event.relatedTarget)
              ) {
                return;
              }
              setArrastrandoPlanos(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setArrastrandoPlanos(false);
              if (event.dataTransfer.files?.length) {
                handleAdjuntarPlanos(event.dataTransfer.files);
              }
            }}
          >
            <input
              ref={planosInputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="ap-planos-input"
              style={{ display: "none" }}
              onChange={(event) => {
                if (event.target.files) handleAdjuntarPlanos(event.target.files);
                event.target.value = "";
              }}
            />
            <div className="ap-planos-cta">
              <FileUpIcon />
              <span className="ap-planos-title">
                {leyendoPlanos
                  ? "Leyendo archivos…"
                  : arrastrandoPlanos
                    ? "Soltá los archivos para leer sus medidas"
                    : "Adjuntar archivos para medir"}
              </span>
              <span className="ap-planos-hint">
                Arrastrá los PDF acá o hacé clic. Cada página se agrega como una
                fila con su medida.
              </span>
            </div>
          </div>
        ) : null}
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
          ? [createDefaultPiezaInput()]
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
          <div className="ap-specs ap-specs-calculo">
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
            ) : usaMedidaPersonalizada && !usaMedidaMixta ? (
              <>
                {renderPiezasEditor({ hideCantidad: piezasUsanCantidadComercial })}
                {piezasUsanCantidadComercial ? (
                  <div className="ap-spec ap-spec-wide">
                    <label>Cantidad</label>
                    {renderQuantityControl()}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                {usaMedidaMixta || medidasPredefinidas.length > 1 ? (
                  <div className="ap-spec ap-spec-wide">
                    <label>Medida</label>
                    {renderMedidaCards(
                      usaMedidaMixta && motorConfig.piezas.length > 0
                        ? CUSTOM_MEASURE_ID
                        : getSelectedPredefinedMeasure(
                            productoDetalle,
                            motorConfig.medidaPredefinidaId,
                          )?.id ?? "",
                      medidasPredefinidas,
                      (value) => {
                        if (value === CUSTOM_MEASURE_ID) {
                          updateMotorConfig({
                            medidaPredefinidaId: "",
                            piezas:
                              motorConfig.piezas.length > 0
                                ? motorConfig.piezas
                                : [createDefaultPiezaInput()],
                          });
                          return;
                        }
                        updateMotorConfig({ medidaPredefinidaId: value, piezas: [] });
                      },
                      usaMedidaMixta,
                    )}
                  </div>
                ) : null}
              {usaMedidaMixta && motorConfig.piezas.length > 0
                ? renderPiezasEditor({ hideCantidad: piezasUsanCantidadComercial })
                : null}
              <div className="ap-spec ap-spec-wide">
                <label>Cantidad</label>
                {renderQuantityControl()}
              </div>
              {minimoComercialStatus ? (
                <div
                  className={`ap-minimum-alert ${
                    minimoComercialStatus.kind === "blocked" ? "is-blocked" : "is-warning"
                  }`}
                >
                  <CircleAlertIcon />
                  <span>{minimoComercialStatus.message}</span>
                </div>
              ) : null}
              </>
            )}

            {usaCaras ? (
              <div className="ap-spec ap-spec-wide">
                <label>Caras</label>
                {renderChoiceCards(
                  "Caras",
                  String(motorConfig.caras),
                  [
                    {
                      value: "1",
                      label: "Simple faz",
                      desc: "Impresión de un solo lado",
                      glyph: CARAS_ICONS["1"],
                    },
                    {
                      value: "2",
                      label: "Doble faz",
                      desc: "Frente y dorso",
                      glyph: CARAS_ICONS["2"],
                    },
                  ],
                  (value) => updateMotorConfig({ caras: Number(value) as 1 | 2 }),
                  { columns: 2, layout: "row" },
                )}
                {pasosConCaras.length > 1 ? (
                  <details className="ap-perfil-avanzado">
                    <summary>
                      {Object.keys(motorConfig.carasPorPaso).length > 0
                        ? "Caras por paso (modificado)"
                        : "Definir caras por paso"}
                    </summary>
                    {pasosConCaras.map((configPaso) => {
                      const nombre =
                        configPaso.nombreVisible?.trim() ||
                        humanizeCodigo(configPaso.rutaPaso.familiaCodigo);
                      const override =
                        motorConfig.carasPorPaso[configPaso.id] ?? "";
                      return (
                        <div
                          key={configPaso.id}
                          className="mt-2 flex items-center justify-between gap-3"
                        >
                          <span className="min-w-0 truncate text-xs">
                            {nombre}
                          </span>
                          <select
                            className="ap-native-select"
                            style={{ maxWidth: 220 }}
                            value={String(override)}
                            onChange={(event) =>
                              setCarasPaso(configPaso.id, event.target.value)
                            }
                          >
                            <option value="">
                              Global (
                              {motorConfig.caras === 2
                                ? "doble faz"
                                : "simple faz"}
                              )
                            </option>
                            <option value="1">Simple faz</option>
                            <option value="2">Doble faz</option>
                          </select>
                        </div>
                      );
                    })}
                  </details>
                ) : null}
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

            {pasosConTecnologias.map((paso) => {
              const allCandidates = paso.tecnologias.flatMap((tech) => tech.candidatas);
              const selectedId = motorConfig.seleccionMaquina[paso.configPasoId] || "";
              const selectedCandidate =
                allCandidates.find((candidate) => candidate.maquinaId === selectedId) ?? null;
              const selectedTechnologyValue = selectedCandidate
                ? getCandidateTechnology(selectedCandidate)
                : "";
              const selectedTechnology =
                paso.tecnologias.find((tech) => tech.value === selectedTechnologyValue) ??
                null;
              // Si el selector de modo de color de este paso ya trae la máquina
              // en cada opción, la elección de máquina es implícita: no hace
              // falta ni el selector de tecnología (cuando hay una sola) ni el
              // dropdown de máquina.
              const modoManejaMaquina = modosColorVisibles.some(
                (modo) =>
                  modo.configPasoId === paso.configPasoId &&
                  modo.options.some((option) => option.maquinaId),
              );
              const mostrarTecnologia = paso.tecnologias.length > 1;
              const mostrarDropdownMaquina =
                !modoManejaMaquina &&
                (selectedTechnology?.candidatas.length ?? 0) > 1;
              if (!mostrarTecnologia && !mostrarDropdownMaquina) return null;
              const techOptions = paso.tecnologias.map((tech) => {
                const meta = getTechnologyMeta(tech.value);
                return {
                  value: tech.value,
                  label: tech.label,
                  desc:
                    meta.desc ||
                    `${tech.candidatas.length} máquina${tech.candidatas.length === 1 ? "" : "s"}`,
                  glyph: (
                    <span
                      className="ap-tech-chip"
                      style={{ background: meta.color }}
                    >
                      {meta.abbr}
                    </span>
                  ),
                };
              });
              const setTechnology = (technologyValue: string) => {
                const tech = paso.tecnologias.find((item) => item.value === technologyValue);
                const candidate = tech ? getPreferredCandidate(tech.candidatas) : null;
                if (candidate) setMaquina(paso.configPasoId, candidate.maquinaId);
              };
              const labelPaso =
                paso.nombreVisible?.trim() || humanizeCodigo(paso.familiaCodigo);
              return (
                <div className="ap-spec ap-spec-wide" key={paso.configPasoId}>
                  <label>
                    {mostrarTecnologia
                      ? pasosConTecnologias.length === 1
                        ? "Tecnología de impresión"
                        : `${labelPaso} · tecnología`
                      : pasosConTecnologias.length === 1
                        ? "Máquina"
                        : `${labelPaso} · máquina`}
                  </label>
                  {mostrarTecnologia
                    ? renderChoiceCards(
                        "Tecnología de impresión",
                        selectedTechnology?.value ?? "",
                        techOptions,
                        setTechnology,
                        { columns: 3, layout: "tile" },
                      )
                    : null}
                  {mostrarDropdownMaquina && selectedTechnology ? (
                    <select
                      className="ap-native-select"
                      value={selectedId}
                      onChange={(event) => setMaquina(paso.configPasoId, event.target.value)}
                    >
                      {selectedTechnology.candidatas.map((candidata) => (
                        <option key={candidata.maquinaId} value={candidata.maquinaId}>
                          {candidata.maquina.nombre}
                          {candidata.esPreferida ? " · preferida" : ""}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              );
            })}

            {modosColorVisibles.map((modo) => {
              const value =
                normalizeModoColor(motorConfig.seleccionModoColor[modo.configPasoId]) ??
                modo.defaultMode ??
                normalizeModoColor(modo.options[0]?.value) ??
                "";
              // Si los modos vienen de máquinas distintas, la card muestra la
              // máquina asociada y elegir el modo también activa esa máquina.
              const maquinasEnOpciones = new Set(
                modo.options
                  .map((option) => option.maquinaId)
                  .filter((id): id is string => Boolean(id)),
              );
              const multiMaquina = maquinasEnOpciones.size > 1;
              const modoOptions = modo.options.map((option) => {
                const optionValue = normalizeModoColor(option.value) ?? option.value;
                return {
                  value: optionValue,
                  label: option.label,
                  desc:
                    multiMaquina && option.maquinaNombre
                      ? option.maquinaNombre
                      : MODO_COLOR_DESCRIPTIONS[optionValue],
                  glyph: renderModoColorSwatch(optionValue),
                };
              });
              const seleccionarModo = (nextValue: string) => {
                const opcion = modo.options.find(
                  (option) =>
                    (normalizeModoColor(option.value) ?? option.value) === nextValue,
                );
                if (opcion?.maquinaId) {
                  setMaquina(modo.configPasoId, opcion.maquinaId);
                }
                setModoColor(modo.configPasoId, nextValue);
              };
              return (
                <div className="ap-spec ap-spec-wide" key={modo.configPasoId}>
                  <label>
                    {modosColorVisibles.length === 1
                      ? "Modo de color"
                      : `${modo.nombreVisible?.trim() || humanizeCodigo(modo.familiaCodigo)} · color`}
                  </label>
                  {renderChoiceCards(
                    "Modo de color",
                    value,
                    modoOptions,
                    seleccionarModo,
                    { columns: modoOptions.length <= 2 ? 2 : 3, layout: "row" },
                  )}
                  {(() => {
                    // Avanzado: override explícito del perfil de impresión.
                    // Sólo lista perfiles de la máquina activa que matchean el
                    // modo de color elegido (option.perfilIds); el motor
                    // resuelve automático salvo decisión técnica del comercial.
                    const config = rutaSel?.configPasos.find(
                      (item) => item.id === modo.configPasoId,
                    );
                    if (!config) return null;
                    const candidataActiva = getActiveCandidateForConfig(
                      config,
                      motorConfig,
                    );
                    const maquinaActiva =
                      candidataActiva?.maquina ?? config.maquinaM1;
                    const opcionModo = modo.options.find(
                      (option) =>
                        (normalizeModoColor(option.value) ?? option.value) ===
                        value,
                    );
                    const idsModo = new Set(opcionModo?.perfilIds ?? []);
                    const perfilesDelModo = (
                      maquinaActiva?.perfilesOperativos ?? []
                    ).filter(
                      (perfil) =>
                        perfil.activo !== false &&
                        perfil.nombre &&
                        idsModo.has(perfil.id),
                    );
                    if (perfilesDelModo.length < 2) return null;
                    const perfilDefaultId =
                      candidataActiva?.perfilDefaultId ??
                      config.perfilM1?.id ??
                      null;
                    const overrideActual =
                      motorConfig.seleccionPerfil[modo.configPasoId] ?? "";
                    const perfilOverride = perfilesDelModo.find(
                      (perfil) => perfil.id === overrideActual,
                    );
                    return (
                      <details className="ap-perfil-avanzado">
                        <summary>
                          {perfilOverride
                            ? `Perfil de impresión: ${perfilOverride.nombre} (modificado)`
                            : "Modificar perfil de impresión"}
                        </summary>
                        <select
                          className="ap-native-select"
                          value={overrideActual}
                          onChange={(event) =>
                            setPerfil(modo.configPasoId, event.target.value)
                          }
                        >
                          <option value="">
                            Automático (recomendado)
                          </option>
                          {perfilesDelModo.map((perfil) => (
                            <option key={perfil.id} value={perfil.id}>
                              {perfil.nombre}
                              {perfilDefaultId === perfil.id
                                ? " · default"
                                : ""}
                            </option>
                          ))}
                        </select>
                      </details>
                    );
                  })()}
                </div>
              );
            })}

            {tiemposManualesPrincipales.map((tiempoPaso) =>
              renderTiempoManualField(tiempoPaso),
            )}

            {slotsMaterialesGenerales.map((slot) => renderMaterialSelect(slot))}

            {editorSelloHabilitado && selloModel ? (
              <div className="ap-spec ap-spec-wide">
                <label>Diseño del sello</label>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setSelloEditorAbierto(true)}
                >
                  <StampIcon />
                  {motorConfig.disenoSello
                    ? "Editar diseño del sello"
                    : "Diseñar sello"}
                </button>
                {motorConfig.disenoSello ? (
                  <div className="ap-optional-config-summary">
                    <span className="lbl">Diseño:</span>
                    <span className="mono">
                      {motorConfig.disenoSello.lineas
                        .map((l) => l.text.trim())
                        .filter(Boolean)
                        .join(" · ") || "sin texto"}
                    </span>
                  </div>
                ) : null}
                <SelloEditorSheet
                  open={selloEditorAbierto}
                  onOpenChange={setSelloEditorAbierto}
                  model={selloModel}
                  tipoLabel={product.subcategoriaComercialNombre}
                  initial={motorConfig.disenoSello}
                  onSave={(diseno) =>
                    setMotorConfig((prev) => ({ ...prev, disenoSello: diseno }))
                  }
                />
              </div>
            ) : null}

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
          <>
            <div className="ap-spec ap-spec-wide">
              <label>Cantidad</label>
              {renderQuantityControl()}
            </div>
            {minimoComercialStatus ? (
              <div
                className={`ap-minimum-alert ${
                  minimoComercialStatus.kind === "blocked" ? "is-blocked" : "is-warning"
                }`}
              >
                <CircleAlertIcon />
                <span>{minimoComercialStatus.message}</span>
              </div>
            ) : null}
          </>
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
              {opcionalesConfigurables.map(({ opcional, slots, tiempoManual }) => {
                const resumen = slots
                  .map((slot) => describeSlotSelection(slot, motorConfig))
                  .filter((item): item is string => Boolean(item));
                const tiempoPendiente = Boolean(
                  tiempoManual && getTiempoManualError(tiempoManual, motorConfig),
                );
                return (
                  <div className="ap-optional-config-card" key={opcional.code}>
                    <div className="ap-optional-config-title">
                      <span className="ttl">{opcional.name}</span>
                      <span className="state">
                        <span className="d" aria-hidden="true" />
                        {tiempoPendiente ? "Falta el tiempo" : "Configurado"}
                      </span>
                      <button
                        type="button"
                        className="quit"
                        onClick={() => setOpcional(opcional.code, false)}
                      >
                        Quitar opcional
                      </button>
                    </div>
                    <div className="ap-optional-config-fields">
                      {slots.map((slot) =>
                        renderMaterialSelect(slot, {
                          showHint: false,
                          collapseSingleCandidate: true,
                        }),
                      )}
                      {tiempoManual
                        ? renderTiempoManualField(tiempoManual)
                        : null}
                    </div>
                    {resumen.length > 0 ? (
                      <div className="ap-optional-config-summary">
                        <span className="lbl">Seleccionado:</span>
                        {resumen.map((item, index) => (
                          <React.Fragment key={item}>
                            {index > 0 ? <span className="sep">/</span> : null}
                            <span className="mono">{item}</span>
                          </React.Fragment>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
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
        <div className="ap-config-actions ap-config-actions-auto">
          <span>
            El precio se calcula automáticamente al cambiar cantidad, medidas u
            opcionales.
          </span>
          <button
            type="button"
            className="ap-link"
            onClick={onCotizar}
            disabled={cotizando || !productoDetalle || !isAllowedQuantity}
          >
            {cotizando ? "Calculando…" : "Recalcular"}
          </button>
        </div>
      ) : null}

      {product.real ? (
        <div className={`ap-summary${cotizando && cotizacionExitosa ? " is-updating" : ""}`}>
          <div className="ap-sum-head">
            {cotizacionExitosa ? "Detalle del cálculo" : cotizando ? "Calculando" : "Precio"}
            {cotizacionExitosa?.desglosePrecio?.precioEspecialCliente ? (
              <span className="ap-sum-especial" title="Este producto tiene un precio especial configurado para el cliente de la orden.">
                <StarIcon aria-hidden="true" />
                Precio especial del cliente
              </span>
            ) : null}
            {cotizando && cotizacionExitosa ? (
              <span className="ap-sum-updating" aria-live="polite">
                actualizando…
              </span>
            ) : null}
          </div>
          {cotizando && !cotizacionExitosa ? (
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
              <div className="ttl">Completá los datos para ver el precio</div>
              <div className="sub">
                El precio se calcula automáticamente con el Motor Universal a medida
                que cargás cantidad, medidas y opcionales.
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
  clienteId = null,
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
  // Token de secuencia: descarta respuestas de cotizaciones que quedaron viejas
  // (el usuario cambió algo mientras una estaba en vuelo).
  const cotizacionSeqRef = React.useRef(0);
  const catalogProducts = React.useMemo(
    () => productos.map(mapProductoReal),
    [productos],
  );
  const isEditing = Boolean(editingItem);

  const totals = product ? getTotals(product, qty, adi) : null;
  const cotizacionExitosa = getCotizacionExitosa(cotizacion);
  const minimoComercialStatus = product
    ? getMinimumCommercialStatus(product, productoDetalle, motorConfig, qty, cotizacionExitosa)
    : null;
  const isBlockedByMinimum = minimoComercialStatus?.kind === "blocked";
  // Tiempo estimado por el comercial: bloquea el alta si un paso obligatorio
  // quedó sin valor o si el valor está fuera del rango configurado. El error
  // puntual se muestra inline junto al input del paso.
  const tiempoManualBloqueo = React.useMemo(() => {
    if (!product?.real || !productoDetalle) return null;
    const rutaSel = getRutaSeleccionada(
      productoDetalle,
      motorConfig.rutaAlternativaId,
    );
    const slotsParaReglas = getSlotsParaCotizacion(
      rutaSel,
      productoDetalle,
      motorConfig,
    );
    const ruleContext = buildJobContext(
      productoDetalle,
      motorConfig,
      qty,
      slotsParaReglas,
    );
    return getTiempoManualBloqueo(
      rutaSel,
      (config) => isConfigPasoVisibleForContext(config, motorConfig, ruleContext),
      motorConfig,
    );
  }, [motorConfig, product, productoDetalle, qty]);
  const isBlockedByTiempoManual = Boolean(tiempoManualBloqueo);

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
          detalle = augmentDetalleConPasosExtras(
            await getProductoById(baseProduct.id),
          );
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
        detalle = augmentDetalleConPasosExtras(await getProductoById(picked.id));
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
          ? [createDefaultPiezaInput()]
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

  const cotizarActual = React.useCallback(async () => {
    if (!product?.real || !product.id || !productoDetalle) return;
    // No cotizar mientras falten medidas válidas: enviar una pieza 0×0 al
    // motor de rígidos provoca un OOM que tumba la API. Cortamos antes de
    // marcar "Cotizando" para que el estado quede a la espera de la medida.
    if (medidasPersonalizadasIncompletas(productoDetalle, motorConfig)) {
      setCotizando(false);
      return;
    }
    const coercedQty = coerceQtyToPricingOptions(qty, product);
    if (coercedQty !== qty) {
      setQty(coercedQty);
      return;
    }
    const rutaSel = getRutaSeleccionada(productoDetalle, motorConfig.rutaAlternativaId);
    const slotsParaReglas = getSlotsParaCotizacion(
      rutaSel,
      productoDetalle,
      motorConfig,
    );
    const ruleContext = buildJobContext(productoDetalle, motorConfig, qty, slotsParaReglas);
    const slotsComercialElige = getSlotsParaCotizacion(
      rutaSel,
      productoDetalle,
      motorConfig,
      (config) => isConfigPasoVisibleForContext(config, motorConfig, ruleContext),
    );
    const includeVisibleConfig = (config: ConfigPasoDetalle) =>
      isConfigPasoVisibleForContext(config, motorConfig, ruleContext);
    const jobContext = buildJobContext(
      productoDetalle,
      motorConfig,
      qty,
      slotsComercialElige,
      includeVisibleConfig,
    );
    const seq = ++cotizacionSeqRef.current;
    setCotizando(true);
    // No limpiamos la cotización anterior: la mantenemos visible (atenuada)
    // mientras llega la nueva, para evitar el salto/parpadeo del panel.
    setCotizacionError(null);
    try {
      const res = await cotizar({
        productoId: product.id,
        rutaAlternativaId: motorConfig.rutaAlternativaId || null,
        jobContext: jobContext as never,
        clienteId,
        periodo: getCurrentPeriodo(),
      });
      if (seq !== cotizacionSeqRef.current) return; // llegó una cotización más nueva
      setCotizacion(res);
      if (!res.exitoso) {
        setCotizacionError(res.errores[0]?.mensaje ?? "El motor no pudo cotizar este producto.");
      }
    } catch (error) {
      if (seq !== cotizacionSeqRef.current) return;
      setCotizacionError(
        error instanceof Error ? error.message : "No se pudo conectar con el motor.",
      );
    } finally {
      if (seq === cotizacionSeqRef.current) setCotizando(false);
    }
  }, [clienteId, motorConfig, product, productoDetalle, qty]);

  // Cotización en tiempo real: al cambiar cantidad, medidas, opcionales o ruta
  // se recotiza sola con un pequeño debounce (no hace falta apretar "Cotizar").
  // Mantiene el precio anterior visible durante el debounce para que se sienta
  // fluido, y `cotizacionSeqRef` descarta respuestas que quedaron viejas.
  React.useEffect(() => {
    if (step !== "config") return;
    if (isBlockedByMinimum) return;
    // Al hidratar un item existente conservamos la cotización guardada y no
    // recotizamos hasta el primer cambio real del usuario.
    if (suppressNextCotizacionClear.current) {
      suppressNextCotizacionClear.current = false;
      return;
    }
    const handle = setTimeout(() => {
      void cotizarActual();
    }, 450);
    return () => clearTimeout(handle);
  }, [cotizarActual, adi, step, isBlockedByMinimum]);

  const addCurrent = React.useCallback(
    (keepOpen: boolean) => {
      if (!product) return;
      if (product.real && !cotizacionExitosa) {
        toast.error("Primero cotizá el producto para previsualizar el precio.");
        return;
      }
      const minimumStatus = getMinimumCommercialStatus(
        product,
        productoDetalle,
        motorConfig,
        qty,
        cotizacionExitosa,
      );
      if (minimumStatus?.kind === "blocked") {
        toast.error(minimumStatus.message);
        return;
      }
      if (tiempoManualBloqueo) {
        toast.error(tiempoManualBloqueo);
        return;
      }
      const rutaSel = getRutaSeleccionada(productoDetalle, motorConfig.rutaAlternativaId);
      const slotsParaReglas = getSlotsParaCotizacion(
        rutaSel,
        productoDetalle,
        motorConfig,
      );
      const ruleContext = buildJobContext(productoDetalle, motorConfig, qty, slotsParaReglas);
      const slotsComercialElige = getSlotsParaCotizacion(
        rutaSel,
        productoDetalle,
        motorConfig,
        (config) => isConfigPasoVisibleForContext(config, motorConfig, ruleContext),
      );
      const nextItem = buildItem(product, qty, specs, adi, {
        productoDetalle,
        motorConfig,
        slotsComercialElige,
        ruleContext,
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
      tiempoManualBloqueo,
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
                  disabled={
                    product.real &&
                    (!cotizacionExitosa ||
                      cotizando ||
                      isBlockedByMinimum ||
                      isBlockedByTiempoManual)
                  }
                >
                  Guardar y agregar otro
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => addCurrent(false)}
                disabled={
                  product.real &&
                  (!cotizacionExitosa ||
                    cotizando ||
                    isBlockedByMinimum ||
                    isBlockedByTiempoManual)
                }
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
