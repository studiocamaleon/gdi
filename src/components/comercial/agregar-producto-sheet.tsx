"use client";

import * as React from "react";
import Link from "next/link";
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
import {
  arrastradosPorDependencia,
  opcionalesActivadosEfectivos,
} from "@/lib/arrastre-opcionales";
import { esConfigPasoEjecutable } from "@/lib/config-paso-activacion";
import {
  type BaseDelPaso,
  type NivelesPasoConfig,
  NIVEL_PERSONALIZADO,
  describirNivel,
  leerNivelesPaso,
  nivelEfectivo,
  nivelPasoKey,
  nombreNivel,
} from "@/lib/niveles-paso";
import { etiquetaValorParam } from "@/lib/params-familia";
import { ProductoSheetHeaderConstelacion } from "./producto-sheet-header";
import {
  type CampoEditableComercial,
  type PasoConParamsComercial,
  buildConfigPasoRuntime,
  getParamsComercialDeRuta,
  valorEfectivoCampo,
} from "@/lib/params-comercial";
import { toast } from "sonner";

import {
  getHerramientaMedidasArchivo,
  getHerramientaEditorSello,
} from "@/lib/producto-herramientas";
import { leerMedidasPdf } from "@/lib/pdf-medidas";
import {
  CotizadorTercerizadoCostoManual,
  CotizadorTercerizadoSelectors,
  tercerizadoManualPasos,
  getTercerizadoCantidades,
  tercerizadoEjes,
  tercerizadoMatrizPasos,
} from "@/components/comercial/cotizador-tercerizado-selectors";
import {
  CarteleriaConfigurador,
  type CarteleriaTecnologia,
  type CarteleriaValor,
} from "@/components/carteleria/carteleria-editor-sheet";
import cartS from "@/components/carteleria/carteleria.module.css";
import matS from "./materiales-compacto.module.css";
import plS from "./params-planilla.module.css";
import seC from "./cotizador-seccion.module.css";
import {
  SelloEditorSheet,
  type DisenoSello,
  type SelloEditorModel,
} from "@/components/comercial/sello-editor-sheet";

import {
  formatCurrency,
  formatUnitPrice,
  type CotizacionPropuestaSnapshot,
  type PasoProduccionPropuesta,
  type PropuestaItem,
  type UnidadPropuesta,
} from "@/lib/propuestas";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import {
  cotizar,
  getCatalogoFamilias,
  getProductoById,
  type CotizarResponse,
} from "@/lib/productos-servicios-api";
import type {
  ConfigPasoDetalle,
  FamiliaListItem,
  ProductoDetalle,
  MedidaPredefinidaProducto,
  ProductoListItem,
  RutaAlternativaDetalle,
} from "@/lib/productos-servicios";
import {
  esMedidaPliegoUtil,
  getMedidaDefault,
  getMedidasPredefinidas,
  medidaLabel,
} from "@/lib/producto-medidas";
import { resolverPlanchaUtil } from "@/lib/medida-plancha";
import {
  prioridadIdsVarianteRollo,
  resolverAnchoRolloLineal,
} from "@/lib/medida-rollo-lineal";
import {
  getSlotMaterialVariantDisplay,
  getSlotMaterialVariantSortValue,
  sortSlotMaterialVariantsByThickness,
} from "@/lib/materiales-slot-display";
import { evaluarJsonLogicBoolean } from "@/lib/json-logic";
import {
  getMachineTechnology,
  machineTechnologyLabel,
} from "@/lib/maquinaria-tecnologias";
import { getCurrentPeriodo } from "@/lib/costos";
import {
  getPersonalizaciones,
  personalizacionAreaKey,
  personalizacionAreaM2,
  type PersonalizacionProducto,
} from "@/lib/producto-personalizaciones";
import { usePuede } from "@/components/navigation/permisos-provider";

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
  /** Sólo cargos: 'MONTO_FIJO_PLANO' | 'PORCENTAJE_SOBRE_BASE' | 'POR_UNIDAD_INPUT'. */
  modoCalculo?: string;
  /** Config efectiva: catálogo + override de la asociación. */
  configCargo?: Record<string, unknown>;
};

type CargoInputDescriptor = {
  key: string;
  label: string;
  unidad?: string;
  tipo: "number" | "select";
  opciones?: Array<{ value: string; label: string }>;
  activaciones: Array<{
    asociacionId: string;
    modoActivacion: string;
    condicionActivacionJson: unknown;
  }>;
  cargoNombre: string;
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
  /** Nombre visible del paso. Desambigua cuando dos pasos piden el MISMO slot
   *  (revista: tapa e interior piden los dos "sustrato principal"). */
  nombrePaso: string | null;
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
    atributosVarianteJson?: Record<string, unknown> | null;
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
  /** Páginas del documento (imposición de cuadernillo); null = usar default del paso. */
  paginas: number | null;
  profundidadCm: number | null;
  piezas: PiezaInput[];
  opcionalesActivados: Record<string, boolean>;
  seleccionMaterial: Record<string, string>;
  seleccionMaquina: Record<string, string>;
  seleccionPerfil: Record<string, string>;
  seleccionModoColor: Record<string, string>;
  /**
   * Nivel elegido por paso (zona de colocación, dificultad de diseño). Viaja al
   * motor como `nivelPaso_<configPasoId>`. Ver src/lib/niveles-paso.ts.
   */
  seleccionNivel: Record<string, string>;
  /** Valores de eje elegidos por paso tercerizado con matriz (`tercerizado_<configPasoId>`). */
  seleccionTercerizado: Record<string, Record<string, string>>;
  /**
   * Costo cotizado por el proveedor para ESTE trabajo, por paso tercerizado
   * con fuente `manual` (`tercerizadoCostoManual_<configPasoId>` al motor).
   * Null/ausente = usar el costo estimado de referencia del paso, si existe.
   */
  tercerizadoCostoManual: Record<string, number | null>;
  /**
   * Params del paso que el modelador dejó abiertos y el comercial cambió
   * (`configPasoRuntime[configPasoId]` al motor). Ausente = usar la sugerencia.
   * Ver docs/modificaciones-fisicas-lona-diseno.md
   */
  paramsComercial: Record<string, Record<string, unknown>>;
  /** Datos declarados por costos directos ($/km, viajes, zona, etc.). */
  cargoInputs: Record<string, string | number>;
  modoCotizacionLineal: ModoCotizacionLineal;
  zonaInstalacion: string;
  m2Instalados: number;
  /**
   * Estado por personalización (área de decoración con medida propia). La clave
   * es el `codigo` de la personalización. Para FIJA la medida es la del producto
   * (no editable); para CLIENTE el comercial la ingresa. `activa` gobierna las
   * opcionales. Ver docs/personalizaciones-diseno.md
   */
  personalizaciones: Record<
    string,
    { activa: boolean; anchoMm: number; altoMm: number }
  >;
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
  uv: {
    abbr: "UV",
    color: "#6d4bd8",
    desc: "Rígidos y flexibles · seca al instante",
  },
  eco_solvente: {
    abbr: "ES",
    color: "#2f8fd6",
    desc: "Vinilos y lonas · exterior",
  },
  latex: { abbr: "LX", color: "#1f9d6b", desc: "Interior/exterior · sin olor" },
  laser: { abbr: "LS", color: "#4a4a52", desc: "Papelería · corto tiraje" },
  dtf_uv: { abbr: "DU", color: "#c9599a", desc: "Transfer sobre objetos" },
  dtf_textil: { abbr: "DT", color: "#d9803a", desc: "Estampado en telas" },
  sublimacion: {
    abbr: "SB",
    color: "#db2777",
    desc: "Sublimación sobre poliéster",
  },
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
    <svg
      className="ap-sheet-ico"
      viewBox="0 0 26 26"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="6"
        y="3"
        width="14"
        height="20"
        rx="2"
        fill="#fff"
        stroke="#14141a"
        strokeWidth="1.6"
      />
      <line x1="9" y1="8" x2="17" y2="8" stroke="#14141a" strokeWidth="1.4" />
      <line x1="9" y1="12" x2="17" y2="12" stroke="#b8b6b1" strokeWidth="1.4" />
      <line x1="9" y1="16" x2="14" y2="16" stroke="#b8b6b1" strokeWidth="1.4" />
    </svg>
  ),
  "2": (
    <svg
      className="ap-sheet-ico"
      viewBox="0 0 26 26"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="13"
        height="18"
        rx="2"
        fill="#fff"
        stroke="#b8b6b1"
        strokeWidth="1.5"
      />
      <rect
        x="10"
        y="3"
        width="13"
        height="18"
        rx="2"
        fill="#fff"
        stroke="#14141a"
        strokeWidth="1.6"
      />
      <line x1="13" y1="8" x2="20" y2="8" stroke="#14141a" strokeWidth="1.4" />
      <line
        x1="13"
        y1="12"
        x2="20"
        y2="12"
        stroke="#b8b6b1"
        strokeWidth="1.4"
      />
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
  // Blanks comprados (merchandising / textil): nutren la OT con el producto base
  // y su variante. Ver docs/ot-merchandising-info-diseno.md
  producto_tipo: "Tipo de producto",
  producto_base: "Producto base",
  talle: "Talle",
  color_prenda: "Color",
  material_base: "Material base",
  personalizaciones: "Estampas",
  paginas: "Páginas",
  profundidad: "Profundidad",
};

const ENRICHED_SPEC_ORDER = [
  "medidas",
  "material",
  "caras",
  "paginas",
  "profundidad",
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
  paginas: null,
  profundidadCm: null,
  piezas: [],
  opcionalesActivados: {},
  seleccionMaterial: {},
  seleccionMaquina: {},
  seleccionPerfil: {},
  seleccionModoColor: {},
  seleccionNivel: {},
  seleccionTercerizado: {},
  tercerizadoCostoManual: {},
  paramsComercial: {},
  cargoInputs: {},
  modoCotizacionLineal: "directo",
  zonaInstalacion: "CABA",
  m2Instalados: 0,
  personalizaciones: {},
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
  const firstWithDefault = slot.candidatos.find(
    (candidate) => candidate.defaultVarianteId,
  );
  if (firstWithDefault?.defaultVarianteId)
    return firstWithDefault.defaultVarianteId;
  if (
    slot.candidatos.length === 1 &&
    slot.candidatos[0]?.variantes.length === 1
  ) {
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

// Resalta en negrita las palabras de la búsqueda dentro del texto.
function highlightMatch(text: string, tokens: string[]): React.ReactNode {
  if (tokens.length === 0) return text;
  const escaped = tokens.map((token) =>
    token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const tokenSet = new Set(tokens);
  return text.split(regex).map((part, index) =>
    part && tokenSet.has(part.toLowerCase()) ? (
      <span
        key={index}
        style={{
          background: "rgba(255, 106, 43, 0.22)",
          color: "inherit",
          borderRadius: "3px",
          padding: "0 1px",
          boxShadow: "0 0 0 1px rgba(255, 106, 43, 0.28)",
        }}
      >
        {part}
      </span>
    ) : (
      part
    ),
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
  const tiers = Array.isArray(config.detalle?.tiers)
    ? config.detalle.tiers
    : [];
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
  return product
    ? getExactPricingQuantitiesFromConfig(product.precioConfigJson)
    : [];
}

function coerceQtyToPricingOptions(
  qty: number,
  product: CatalogProduct | null,
) {
  const exactQuantities = getExactPricingQuantities(product);
  if (exactQuantities.length === 0) return qty;
  return exactQuantities.includes(qty) ? qty : (exactQuantities[0] ?? qty);
}

function getCantidadDefault(producto: ProductoListItem) {
  const exactQuantities = getExactPricingQuantitiesFromConfig(
    producto.precioConfigJson,
  );
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

function modoMedidasPermitePersonalizada(
  modoMedidas: string | null | undefined,
) {
  return modoMedidas === "LIBRE" || modoMedidas === "MIXTA";
}

/** Pliego activo del paso de impresión por hoja: la variante de papel que el
 *  comercial eligió para el slot (o la default del slot). */
function getPliegoActivoDeImpresion(
  configPaso: ConfigPasoDetalle,
  config: Pick<MotorConfigState, "seleccionMaterial">,
): { anchoMm: number; altoMm: number } | null {
  const slot =
    configPaso.slotsMateriales.find(
      (item) =>
        (item.slotRol ?? "").toUpperCase() === "SUSTRATO" ||
        // `sustrato_principal` (impresión), `sustrato_corte` (plotter), etc.
        item.slotCodigo.startsWith("sustrato"),
    ) ?? configPaso.slotsMateriales[0];
  if (!slot) return null;
  const key = materialSelectionKey(configPaso.id, slot.slotCodigo);
  const seleccionadaId = config.seleccionMaterial[key] || null;
  const variantes = [
    ...(slot.materialVariante ? [slot.materialVariante] : []),
    ...slot.candidatos.flatMap(
      (candidato) => candidato.materiaPrima.variantes ?? [],
    ),
  ];
  const porId = (id: string | null | undefined) =>
    id ? variantes.find((variante) => variante.id === id) : undefined;
  // HARDCODED significa exactamente la variante vinculada al slot. Algunos
  // productos viejos conservan candidatos residuales; tomar su default hacía
  // que el sheet sintetizara una medida distinta de la que costea el motor.
  const variante =
    prioridadIdsVarianteRollo({
      selectionMode: slot.modoSeleccion,
      hardcodedId: slot.materialVariante?.id,
      selectedId: seleccionadaId,
      candidateDefaultIds: slot.candidatos.map(
        (candidato) => candidato.defaultVarianteId,
      ),
    })
      .map(porId)
      .find(Boolean) ??
    variantes[0] ??
    null;
  const attrs = getRecord(variante?.atributosVarianteJson);
  const anchoMm = getNumberFromUnknown(attrs.anchoMm) ?? 0;
  const altoMm =
    getNumberFromUnknown(attrs.altoMm) ??
    getNumberFromUnknown(attrs.largoMm) ??
    0;
  return anchoMm > 0 && altoMm > 0 ? { anchoMm, altoMm } : null;
}

/**
 * Medidas del producto con las planchas (`tipo: "pliego_util"`) RESUELTAS:
 * pieza = pliego de la variante activa − márgenes (espejo del motor, ver
 * `src/lib/medida-plancha.ts`). Una plancha que no se puede resolver (paso de
 * impresión sin máquina/papel) queda con dims 0 y la card se deshabilita.
 */
function resolverMedidasPredefinidas(
  producto: ProductoDetalle | null,
  config: MotorConfigState,
  includeConfig: (config: ConfigPasoDetalle) => boolean = () => true,
): MedidaPredefinidaProducto[] {
  if (!producto) return [];
  const base = getMedidasPredefinidas(producto);
  if (!base.some((medida) => medida.tipo === "pliego_util")) return base;
  let plancha: { anchoMm: number; altoMm: number } | null = null;
  const rutaSel = getRutaSeleccionada(producto, config.rutaAlternativaId ?? "");
  for (const configPaso of rutaSel?.configPasos ?? []) {
    if (configPaso.rutaPaso.familiaCodigo !== "impresion_por_hoja") continue;
    if (!isExecutableConfigPaso(configPaso) || !includeConfig(configPaso)) {
      continue;
    }
    const pliego = getPliegoActivoDeImpresion(configPaso, config);
    if (!pliego) continue;
    const machine = getActiveMachineForConfig(configPaso, config);
    const resuelta = resolverPlanchaUtil({
      pliegoAnchoMm: pliego.anchoMm,
      pliegoAltoMm: pliego.altoMm,
      maquinaParametrosTecnicos: machine?.parametrosTecnicosJson ?? null,
      pasoParams: (configPaso.paramsPasoJson ?? null) as Record<
        string,
        unknown
      > | null,
    });
    if (resuelta) {
      plancha = resuelta;
      break;
    }
  }
  return base.map((medida) =>
    medida.tipo === "pliego_util"
      ? {
          ...medida,
          anchoMm: plancha?.anchoMm ?? 0,
          altoMm: plancha?.altoMm ?? 0,
        }
      : medida,
  );
}

function getSelectedPredefinedMeasure(
  producto: ProductoDetalle | null,
  medidaPredefinidaId: string,
  medidasResueltas?: MedidaPredefinidaProducto[],
) {
  if (!producto || !modoMedidasUsaPredefinidas(producto.modoMedidas))
    return null;
  const medidas = medidasResueltas ?? getMedidasPredefinidas(producto);
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
  if (
    !label ||
    label.includes(" mm") ||
    label === `${medida.anchoMm} x ${medida.altoMm} mm`
  ) {
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
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
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
  return esConfigPasoEjecutable(config);
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
    cargosDirectosPaso: extra.cargosDirectosPaso ?? [],
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
  if (modo === "OPCIONAL")
    return Boolean(motorConfig.opcionalesActivados[config.id]);
  if (modo === "CONDICIONAL") {
    return evaluarJsonLogicBoolean(
      config.condicionActivacionJson,
      ruleContext,
      false,
    );
  }
  return modo === "OBLIGATORIO";
}

function isConfigPasoAvailableForOptionalToggle(
  config: ConfigPasoDetalle,
  ruleContext: Record<string, unknown>,
) {
  if (!isExecutableConfigPaso(config)) return false;
  if (config.modoActivacion === "CONDICIONAL") {
    return evaluarJsonLogicBoolean(
      config.condicionActivacionJson,
      ruleContext,
      false,
    );
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
        // Un paso tercerizado no se produce internamente: su costo sale de la
        // matriz/tarifa del proveedor, no lo multiplican caras ni tipoCopia.
        !config.tercerizado &&
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
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Imposición de cuadernillo (revista/folleto abrochado): la ruta la activa el
 * paso de impresión vía `nestingConfig.imposicion.esquema='caballete'`. Cuando
 * está, el comercial carga las PÁGINAS del documento.
 * Ver docs/imposicion-cuadernillos-diseno.md.
 */
function getImposicionCaballeteDeRuta(
  ruta: RutaAlternativaDetalle | null,
  includeConfig: (config: ConfigPasoDetalle) => boolean,
): { paginasDefault: number | null } | null {
  for (const config of ruta?.configPasos ?? []) {
    if (!includeConfig(config)) continue;
    const params = asRecord(config.paramsPasoJson);
    const nesting = asRecord(params.nestingConfig);
    const imposicion = asRecord(nesting.imposicion);
    if (String(imposicion.esquema ?? "").toLowerCase() === "caballete") {
      const def = Number(imposicion.paginasDefault);
      return { paginasDefault: Number.isFinite(def) && def > 0 ? def : null };
    }
  }
  return null;
}

/**
 * Cartelería (backlight/light box): si la ruta tiene un bastidor DOBLE sin
 * profundidad fija en el paso, el comercial carga la profundidad del cajón.
 * Ver docs/carteleria-configurador-diseno.md §4.3.
 */
function getProfundidadDeRuta(
  ruta: RutaAlternativaDetalle | null,
  includeConfig: (config: ConfigPasoDetalle) => boolean,
): { profundidadDefaultMm: number | null } | null {
  for (const config of ruta?.configPasos ?? []) {
    if (!includeConfig(config)) continue;
    if (config.rutaPaso?.familiaCodigo !== "estructura_bastidor") continue;
    const params = asRecord(config.paramsPasoJson);
    if (String(params.tipoBastidor ?? "doble").toLowerCase() === "simple") {
      continue;
    }
    const fija = Number(params.profundidadMm);
    return {
      profundidadDefaultMm: Number.isFinite(fija) && fija > 0 ? fija : null,
    };
  }
  return null;
}

/**
 * Cartelería: la ruta tiene configurador 3D si trae un paso de bastidor.
 * Devuelve los configPasoId de los dos pasos (estructura + iluminación) y los
 * params del paso como defaults del editor (los overrides del comercial van
 * por `paramsComercial` → `configPasoRuntime`, el canal que ya existe).
 */
/**
 * §17 derivadores (2026-08-05): el configurador 3D queda A UN COSTADO hasta
 * que vuelva como capa de visualización sobre el modelado declarativo. Los
 * componentes (src/components/carteleria/) quedan en el repo sin cablear.
 */
const CONFIGURADOR_3D_CARTELERIA_ACTIVO = false;

function getCarteleriaDeRuta(
  ruta: RutaAlternativaDetalle | null,
  includeConfig: (config: ConfigPasoDetalle) => boolean,
): {
  tipoCartel: "backlight" | "frontlight";
  estructuraConfigPasoId: string;
  ledConfigPasoId: string | null;
  impresionConfigPasoId: string | null;
  /** Pasos de la ruta REAL (§15): opcionales que activan los toggles. */
  pinturaConfigPasoId: string | null;
  fondoConfigPasoId: string | null;
  cenefaConfigPasoId: string | null;
  paramsEstructura: Record<string, unknown>;
  paramsLed: Record<string, unknown>;
} | null {
  let estructura: ConfigPasoDetalle | null = null;
  let led: ConfigPasoDetalle | null = null;
  let impresion: ConfigPasoDetalle | null = null;
  let pintura: ConfigPasoDetalle | null = null;
  let fondo: ConfigPasoDetalle | null = null;
  let cenefa: ConfigPasoDetalle | null = null;
  for (const config of ruta?.configPasos ?? []) {
    if (!includeConfig(config)) continue;
    const familia = config.rutaPaso?.familiaCodigo;
    if (familia === "estructura_bastidor") estructura = config;
    if (familia === "iluminacion_led") led = config;
    if (familia === "impresion_por_area") impresion = config;
    if (familia === "pintura_superficial") pintura = config;
    // Los pasos de trabajo_manual de la ruta se distinguen por su ROL,
    // marcado por la provisión en paramsPasoJson.carteleriaRol.
    const rol = String(asRecord(config.paramsPasoJson).carteleriaRol ?? "");
    if (rol === "chapa_fondo") fondo = config;
    if (rol === "cenefa") cenefa = config;
  }
  if (!estructura) return null;
  const paramsEstructura = asRecord(estructura.paramsPasoJson);
  const tipoBastidor = String(
    paramsEstructura.tipoBastidor ?? "doble",
  ).toLowerCase();
  return {
    tipoCartel: tipoBastidor === "simple" ? "frontlight" : "backlight",
    estructuraConfigPasoId: estructura.id,
    ledConfigPasoId: led?.id ?? null,
    impresionConfigPasoId: impresion?.id ?? null,
    pinturaConfigPasoId: pintura?.id ?? null,
    fondoConfigPasoId: fondo?.id ?? null,
    cenefaConfigPasoId: cenefa?.id ?? null,
    paramsEstructura,
    paramsLed: led ? asRecord(led.paramsPasoJson) : {},
  };
}

function routeUsesTipoCopia(
  ruta: RutaAlternativaDetalle | null,
  includeConfig: (config: ConfigPasoDetalle) => boolean,
) {
  return (
    ruta?.configPasos.some(
      (config) =>
        includeConfig(config) &&
        !config.tercerizado &&
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
          nombrePaso: config.nombreVisible?.trim() || null,
          candidatos: slot.candidatos.map((candidate) => ({
            materiaPrimaId: candidate.materiaPrimaId,
            label: candidate.materiaPrima.nombre,
            defaultVarianteId: candidate.defaultVarianteId,
            // Modo "todas las variantes": la lista fija del candidato viene
            // vacía y la fuente son las variantes ACTIVAS del material (igual
            // que el motor). Sin esto, los pickers quedaban mudos aunque el
            // motor resolviera bien.
            variantes: sortSlotMaterialVariantsByThickness(
              (candidate.todasLasVariantes
                ? (candidate.materiaPrima.variantes ?? []).map((v) => ({
                    variante: {
                      id: v.id,
                      sku: v.sku,
                      nombreVariante: v.nombreVariante,
                      precioReferencia: v.precioReferencia,
                atributosVarianteJson: (v.atributosVarianteJson ??
                  null) as Record<string, unknown> | null,
                    },
                  }))
                : candidate.variantes
              ).map((item) => {
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
            atributosVarianteJson: item.variante.atributosVarianteJson ?? null,
                  sortEspesor: getSlotMaterialVariantSortValue(variante),
                  espesorLabel: getVariantThicknessLabel(
                    item.variante.atributosVarianteJson,
                  ),
                  anchoLabel: getVariantWidthLabel(
                    item.variante.atributosVarianteJson,
                  ),
            anchoMm: getVariantWidthMm(item.variante.atributosVarianteJson),
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

// Resuelve el modelo de sello (tamaño de polímero + líneas) para el editor.
// Prioriza el cuerpo elegido por el comercial; si el producto tiene el cuerpo
// fijo (HARDCODED / MOTOR_ELIGE_AUTO) lo lee del material resuelto del slot.
function getSelloModelDeRuta(
  ruta: RutaAlternativaDetalle | null,
  slotsComercialElige: SlotComercialElige[],
  config: MotorConfigState,
  includeConfig: (config: ConfigPasoDetalle) => boolean = () => true,
): SelloEditorModel | null {
  for (const slot of slotsComercialElige) {
    const { variant } = findSelectedCandidateVariant(slot, config);
    if (variant?.sello) return variant.sello;
  }
  const configPasos =
    ruta?.configPasos.filter(isExecutableConfigPaso).filter(includeConfig) ??
    [];
  for (const configPaso of configPasos) {
    for (const slot of configPaso.slotsMateriales) {
      const sello = getSelloModelDeVariante(
        slot.materialVariante?.atributosVarianteJson,
        slot.materialVariante?.nombreVariante ?? slot.slotNombre ?? "Sello",
      );
      if (sello) return sello;
    }
  }
  return null;
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

type MaquinaCandidataComercial = NonNullable<
  ConfigPasoDetalle["maquinasCandidatas"]
>[number];

type TecnologiaCandidataComercial = {
  value: string;
  label: string;
  candidatas: MaquinaCandidataComercial[];
};

function getPreferredCandidate(candidates: MaquinaCandidataComercial[]) {
  return (
    candidates.find((candidate) => candidate.esPreferida) ??
    candidates[0] ??
    null
  );
}

/** Un paso de plotter de corte cuya máquina declara varios perfiles de
 *  complejidad (Corte fácil / Corte complejo): el comercial elige el nivel
 *  según el trabajo y eso viaja como override de perfil
 *  (`perfilSeleccionado_<configPasoId>`, que el motor ya valida). */
type ComplejidadCorteComercial = {
  configPasoId: string;
  nombreVisible: string | null;
  familiaCodigo: string;
  modoActivacion: string;
  /** Perfil default del paso (queda seleccionado sin override). */
  defaultId: string | null;
  /** Ordenadas de más rápida a más lenta (fácil → complejo). */
  opciones: Array<{ perfilId: string; nombre: string }>;
};

/** Letra grande = corte fácil (formas grandes), letra chica = corte complejo
 *  (detalle intrincado). Mismo rol visual que los cuadraditos del modo de
 *  color: se entiende sin leer. */
function complejidadCorteGlyph(rank: number, total: number) {
  const sizes = total <= 2 ? [20, 11] : [20, 15, 10];
  const size = sizes[Math.min(rank, sizes.length - 1)] ?? 10;
  const y = 13 + size * 0.36;
  return (
    <svg
      className="ap-sheet-ico"
      viewBox="0 0 26 26"
      fill="none"
      aria-hidden="true"
    >
      <text
        x="13"
        y={y}
        textAnchor="middle"
        fontSize={size}
        fontWeight={800}
        fill="#14141a"
      >
        A
      </text>
    </svg>
  );
}

function getComplejidadCorte(
  ruta: RutaAlternativaDetalle | null,
  motorConfig: Pick<MotorConfigState, "seleccionMaquina">,
  includeConfig: (config: ConfigPasoDetalle) => boolean = () => true,
): ComplejidadCorteComercial[] {
  return (
    ruta?.configPasos
      .filter(isExecutableConfigPaso)
      .filter(includeConfig)
      .map((config): ComplejidadCorteComercial | null => {
        if (config.rutaPaso.familiaCodigo !== "plotter_corte") return null;
        const params = (config.paramsPasoJson ?? {}) as Record<string, unknown>;
        const candidata = getActiveCandidateForConfig(config, motorConfig);
        const maquina = candidata?.maquina ?? config.maquinaM1;
        const perfiles = (maquina?.perfilesOperativos ?? []).filter(
          (perfil) =>
            perfil.activo !== false &&
            perfil.nombre &&
            ["corte", "mixto"].includes(
              (perfil.tipoPerfil ?? "").toLowerCase(),
            ),
        );
        // Más m²/h = corte más fácil: eso ordena fácil → complejo y decide
        // el tamaño de la letra del glyph.
        const ordenados = [...perfiles].sort((a, b) => {
          const pa = Number(a.productivityValue ?? NaN);
          const pb = Number(b.productivityValue ?? NaN);
          if (Number.isFinite(pa) && Number.isFinite(pb)) return pb - pa;
          if (Number.isFinite(pa)) return -1;
          if (Number.isFinite(pb)) return 1;
          return 0;
        });
        const defaultId =
          (candidata?.perfilDefaultId &&
          ordenados.some((p) => p.id === candidata.perfilDefaultId)
            ? candidata.perfilDefaultId
            : null) ??
          (config.perfilM1?.id &&
          ordenados.some((p) => p.id === config.perfilM1?.id)
            ? config.perfilM1.id
            : null) ??
          ordenados[0]?.id ??
          null;
        // Curaduría del modelador: sólo los niveles expuestos por producto
        // (∪ el default, que no se puede des-exponer). Sin lista declarada,
        // se exponen todos. Con UN nivel efectivo no hay decisión → sin
        // selector, el motor usa el perfil default del paso.
        const expuestosRaw = params.perfilesExpuestosComercial;
        const expuestos = Array.isArray(expuestosRaw)
          ? expuestosRaw.filter((v): v is string => typeof v === "string")
          : null;
        const opciones = expuestos
          ? ordenados.filter(
              (p) => p.id === defaultId || expuestos.includes(p.id),
            )
          : ordenados;
        if (opciones.length < 2) return null;
        return {
          configPasoId: config.id,
          nombreVisible: config.nombreVisible ?? null,
          familiaCodigo: config.rutaPaso.familiaCodigo,
          modoActivacion: config.modoActivacion ?? "OBLIGATORIO",
          defaultId,
          opciones: opciones.map((perfil) => ({
            perfilId: perfil.id,
            nombre: perfil.nombre ?? "Perfil",
          })),
        };
      })
      .filter((item): item is ComplejidadCorteComercial => item !== null) ?? []
  );
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

// Los modos se listan de menos a más tinta: sin impresión → 1 tinta → CMYK →
// CMYK con cada refuerzo → CMYK completo. El orden natural (el de los perfiles
// de la máquina) dejaba CMYK+Blanco antes que CMYK, que se lee al revés.
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
    // Modos que no están en la escala (custom del tenant) van al final, en su
    // orden original.
    return index === -1 ? MODO_COLOR_ORDEN.length : index;
  };
  return options
    .map((option, index) => ({ option, index }))
    .sort((a, b) => rango(a.option) - rango(b.option) || a.index - b.index)
    .map((item) => item.option);
}

function getModoColorOptionsForConfig(
  config: ConfigPasoDetalle,
  motorConfig?: Pick<MotorConfigState, "seleccionMaquina">,
) {
  const candidatas = config.maquinasCandidatas ?? [];
  if (candidatas.length > 0 && motorConfig) {
    // Unión de modos sobre las candidatas: el modo de color es la decisión
    // visible y la máquina viene implícita en la opción elegida (elegir
    // "Color" en la C8003 no requiere cambiar de máquina a mano).
    // PERO si las candidatas abarcan más de una tecnología (UV vs eco), la
    // unión se limita a la tecnología ACTIVA: los modos de la otra tecnología
    // no existen para la máquina elegida (bug: "CMYK + Blanco" listado bajo
    // eco-solvente) y elegirlos cambiaría la tecnología por la espalda.
    // Orden FIJO (preferida primero, luego el orden de las candidatas) para
    // que las cards no se reordenen al seleccionar.
    const tecnologias = new Set(candidatas.map(getCandidateTechnology));
    const activa = getActiveCandidateForConfig(config, motorConfig);
    const pool =
      tecnologias.size > 1 && activa
        ? candidatas.filter(
            (candidate) =>
              getCandidateTechnology(candidate) ===
              getCandidateTechnology(activa),
          )
        : candidatas;
    const preferida = getPreferredCandidate(pool);
    const ordenadas = [
      ...(preferida ? [preferida] : []),
      ...pool.filter((candidate) => candidate !== preferida),
    ];
    const union = new Map<
      string,
      {
        value: string;
        label: string;
        perfilIds: string[];
        maquinaId: string;
        maquinaNombre: string;
      }
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
    if (union.size > 0) return ordenarModosColor(Array.from(union.values()));
  }
  const activeCandidate = motorConfig
    ? getActiveCandidateForConfig(config, motorConfig)
    : null;
  if (activeCandidate) {
    const derivedOptions = buildModoColorOptionsFromCandidate(activeCandidate);
    if (derivedOptions.length) return ordenarModosColor(derivedOptions);
    if (activeCandidate.modoColorOptions?.length) {
      return ordenarModosColor(activeCandidate.modoColorOptions);
    }
  }
  return ordenarModosColor(config.modoColorOptions ?? []);
}

/**
 * Modo efectivo de un paso: lo guardado SOLO vale si sigue existiendo entre
 * las opciones vigentes (al cambiar de tecnología la lista se achica y una
 * selección vieja — p. ej. CMYK+Blanco en eco-solvente — debe caer al
 * default). Mismo resolutor para el render y para el payload del motor.
 */
function resolveModoColorSeleccionado(
  modo: Pick<ModoColorComercial, "options" | "defaultMode">,
  stored: string | null | undefined,
) {
  const values = modo.options.map(
    (option) => normalizeModoColor(option.value) ?? option.value,
  );
  const storedNorm = normalizeModoColor(stored);
  if (storedNorm && values.includes(storedNorm)) return storedNorm;
  if (modo.defaultMode && values.includes(modo.defaultMode)) {
    return modo.defaultMode;
  }
  return values[0] ?? null;
}

function getModoColorsFromPerfil(
  perfil: { detalleJson?: Record<string, unknown> | null } | null | undefined,
) {
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

function buildModoColorOptionsFromCandidate(
  candidate: MaquinaCandidataComercial,
) {
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
        const usaModosPorCandidata =
          (config.maquinasCandidatas?.length ?? 0) > 0;
        const allowedModes =
          !usaModosPorCandidata && Array.isArray(modoConfig.allowedModes)
          ? modoConfig.allowedModes.map(normalizeModoColor).filter(Boolean)
          : [];
        const options = getModoColorOptionsForConfig(
          config,
          motorConfig,
        ).filter(
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
 * Pasos de la ruta con NIVELES: un paso, varias variantes que elige el
 * comercial (zona de colocación, dificultad de diseño). Es una decisión
 * excluyente, como el modo de color. Ver docs/cargos-por-paso-analisis-y-plan.md §8.
 */
type NivelComercial = {
  configPasoId: string;
  nombreVisible: string | null;
  familiaCodigo: string;
  modoActivacion: string | null;
  config: NivelesPasoConfig;
  /** Lo que vale el paso cuando el nivel no pisa nada (para el resumen). */
  base: BaseDelPaso;
};

/** ¿El paso deja que el comercial ajuste el tiempo al cotizar? */
function tienePasoTiempoManual(config: ConfigPasoDetalle): boolean {
  const params = (config.paramsPasoJson ?? {}) as Record<string, unknown>;
  const tiempoManual = params.tiempoManual as Record<string, unknown> | null;
  return Boolean(tiempoManual && tiempoManual.habilitado === true);
}

function getNivelesComercial(
  ruta: RutaAlternativaDetalle | null,
  includeConfig: (config: ConfigPasoDetalle) => boolean = () => true,
): NivelComercial[] {
  return (
    ruta?.configPasos
      .filter(isExecutableConfigPaso)
      .filter(includeConfig)
      .map((config) => {
        const niveles = leerNivelesPaso(config.paramsPasoJson);
        if (!niveles) return null;
        const params = (config.paramsPasoJson ?? {}) as Record<string, unknown>;
        const bloques = Array.isArray(params.tiemposExtra)
          ? params.tiemposExtra
          : [];
        // Paso con niveles Y con tiempo ajustable: el nivel "Personalizado"
        // hace explícito el camino que antes convivía suelto (elegí un nivel /
        // escribí un tiempo, sin decir cuál gana).
        const opciones = tienePasoTiempoManual(config)
          ? [
              ...niveles.opciones,
              {
                codigo: NIVEL_PERSONALIZADO,
                nombre: "Personalizado",
                esDefault: false,
                overrides: {},
              },
            ]
          : niveles.opciones;
        const item: NivelComercial = {
          configPasoId: config.id,
          nombreVisible: config.nombreVisible ?? null,
          familiaCodigo: config.rutaPaso.familiaCodigo,
          modoActivacion: config.modoActivacion,
          config: { ...niveles, opciones },
          base: {
            // Sin nivel aplicado: es el punto de partida contra el que cada
            // nivel se compara.
            tiempoFijoMin: getTiempoFijoDeclaradoMin(config, {}),
            bloques: bloques.map((bloque, indice) => {
              const item = (bloque ?? {}) as Record<string, unknown>;
              const min = Number(item.minutos);
              return {
                id:
                  typeof item.id === "string" && item.id.trim()
                    ? item.id.trim()
                    : `extra_${indice}`,
                minutos: Number.isFinite(min) && min > 0 ? min : 0,
              };
            }),
          },
        };
        return item;
      })
      .filter((item): item is NivelComercial => item !== null) ?? []
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
  /**
   * Lo que el campo propone antes de que el comercial toque nada: **el tiempo
   * que el modelador configuró en el paso** (con el nivel elegido aplicado),
   * y sólo si el paso no declara ninguno, el `defaultMin` de las ayudas. Dos
   * declaraciones del mismo hecho no pueden competir: si el paso dice 30 min,
   * el campo arranca en 30.
   */
  defaultMin: number | null;
  minMin: number | null;
  maxMin: number | null;
  etiqueta: string | null;
};

/**
 * Tiempo FIJO que el paso declara, en minutos, con el nivel elegido aplicado.
 * Null cuando el paso se calcula por ritmo: ahí los minutos dependen de la
 * cantidad y el sheet no puede saberlos sin cotizar.
 */
function getTiempoFijoDeclaradoMin(
  config: ConfigPasoDetalle,
  seleccionNivel: Record<string, string>,
): number | null {
  const niveles = leerNivelesPaso(config.paramsPasoJson);
  // En "Personalizado" no corre ningún nivel: la sugerencia sale de la base.
  if (niveles && seleccionNivel[config.id] !== NIVEL_PERSONALIZADO) {
    const nivel = nivelEfectivo(niveles, seleccionNivel[config.id]);
    if (nivel.overrides.tiempoFijoMin != null) {
      return nivel.overrides.tiempoFijoMin > 0
        ? nivel.overrides.tiempoFijoMin
        : null;
    }
  }
  const override = Number(config.tiempoFijoOverrideMin);
  if (Number.isFinite(override) && override > 0) return override;
  const params = (config.paramsPasoJson ?? {}) as Record<string, unknown>;
  const horas = Number(params.horasEstimadas);
  return Number.isFinite(horas) && horas > 0 ? horas * 60 : null;
}

function getTiemposManualesComercial(
  ruta: RutaAlternativaDetalle | null,
  includeConfig: (config: ConfigPasoDetalle) => boolean = () => true,
  seleccionNivel: Record<string, string> = {},
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
          Record<string, unknown> | undefined;
        if (
          !tiempoManual ||
          typeof tiempoManual !== "object" ||
          tiempoManual.habilitado !== true
        ) {
          return null;
        }
        // Con niveles, el tiempo a mano SÓLO se pide en "Personalizado": los
        // demás niveles ya declaran cuánto lleva, y ofrecer las dos cosas a la
        // vez dejaba al comercial sin saber cuál manda.
        if (
          leerNivelesPaso(config.paramsPasoJson) &&
          seleccionNivel[config.id] !== NIVEL_PERSONALIZADO
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
          // El tiempo del paso manda sobre la sugerencia de las ayudas.
          defaultMin:
            getTiempoFijoDeclaradoMin(config, seleccionNivel) ??
            positiveOrNull(tiempoManual.defaultMin),
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
  for (const item of getTiemposManualesComercial(
    ruta,
    includeConfig,
    config.seleccionNivel,
  )) {
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
          (config.maquinasCandidatas ?? [])
            .reduce((map, candidate) => {
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
            }, new Map<string, TecnologiaCandidataComercial>())
            .values(),
        ),
      })) ?? []
  );
}

function getActiveMachineForConfig(
  config: ConfigPasoDetalle,
  motorConfig: MotorConfigState,
) {
  return (
    getActiveCandidateForConfig(config, motorConfig)?.maquina ??
    config.maquinaM1
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
  ruleContext: Record<string, unknown>,
) {
  return isConfigPasoVisibleForContext(config, motorConfig, ruleContext);
}

function getActiveConfigPasos(
  ruta: RutaAlternativaDetalle | null,
  motorConfig: MotorConfigState,
  ruleContext: Record<string, unknown>,
) {
  return (
    ruta?.configPasos.filter((config) =>
      isActiveConfigPaso(config, motorConfig, ruleContext),
    ) ?? []
  );
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

function getTextAttr(
  attrs: Record<string, unknown> | null | undefined,
  keys: string[],
) {
  for (const key of keys) {
    const raw = attrs?.[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  }
  return null;
}

function getVariantThicknessLabel(
  attrs: Record<string, unknown> | null | undefined,
) {
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

function getVariantWidthLabel(
  attrs: Record<string, unknown> | null | undefined,
) {
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
): {
  nombre: string;
  widthMm: number;
  heightMm: number;
  lineasMax: number;
} | null {
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
  return {
    nombre: modelo,
    widthMm: w,
    heightMm: h,
    lineasMax: Math.round(lineas),
  };
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

function getVariantColorLabel(
  attrs: Record<string, unknown> | null | undefined,
) {
  return getTextAttr(attrs, ["colorBase", "color", "colorMaterial"]);
}

function candidateUsesColorThickness(candidate: SlotMaterialCandidato) {
  return candidate.variantes.some(
    (variant) => variant.colorLabel && variant.espesorLabel,
  );
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

// ── Materiales del cotizador: fila compacta que expande (Propuesta B) ──────
// Cada material es un renglón (avatar + slot + variante elegida); al tocarlo
// se despliegan las variantes como renglones con radio, igual que la lista de
// máquinas del editor de rutas. Sin <select> nativo ni Radix.
type VariantOpcionCompacta = {
  value: string;
  title: string;
  spec: string;
  isDefault: boolean;
  missingPrice: boolean;
};
type VariantGrupoCompacto = {
  label: string | null;
  opciones: VariantOpcionCompacta[];
};

function MaterialSelectorCompacto({
  etiquetaSlot,
  grupos,
  selected,
  onSelect,
  alerta,
  hint,
  sinTarjeta,
}: {
  etiquetaSlot: string;
  grupos: VariantGrupoCompacto[];
  selected: string;
  onSelect: (variantId: string) => void;
  alerta?: string | null;
  hint?: string | null;
  /** Dentro de la tarjeta de un opcional: sin caja ni barra negra propias —
   *  esa barra ya la usa el nombre del paso. */
  sinTarjeta?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const opciones = grupos.flatMap((grupo) => grupo.opciones);
  const elegida =
    opciones.find((opcion) => opcion.value === selected) ?? opciones[0];
  const chevron = (
    <svg
      className={matS.chev}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
  return (
    <div className={sinTarjeta ? undefined : matS.group}>
      {sinTarjeta ? (
        <span className={seC.sub}>{etiquetaSlot}</span>
      ) : (
        <div className={matS.gh}>{etiquetaSlot}</div>
      )}
      <button
        type="button"
        className={matS.selrow}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={matS.pick}>
          {elegida?.title ?? "Elegir variante"}
          {elegida?.spec ? (
            <span className={matS.pickSpec}> · {elegida.spec}</span>
          ) : null}
        </span>
        <span className={matS.right}>
          {elegida?.isDefault ? (
            <span className={matS.badge}>Predet.</span>
          ) : null}
          {elegida?.missingPrice ? (
            <span className={matS.warnTag}>sin precio</span>
          ) : null}
          {chevron}
        </span>
      </button>
      {open ? (
        <div
          className={matS.variants}
          role="radiogroup"
          aria-label={etiquetaSlot}
        >
          {grupos.map((grupo, gi) => (
            <React.Fragment key={grupo.label ?? `g${gi}`}>
              {grupo.label ? (
                <div className={matS.ghead}>{grupo.label}</div>
              ) : null}
              {grupo.opciones.map((opcion) => {
                const on = opcion.value === selected;
                return (
                  <button
                    key={opcion.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={`${matS.srow} ${on ? matS.srowOn : ""}`}
                    onClick={() => {
                      onSelect(opcion.value);
                      setOpen(false);
                    }}
                  >
                    <span className={matS.radio} aria-hidden="true" />
                    <span className={matS.st}>{opcion.title}</span>
                    {opcion.spec ? (
                      <span className={matS.ss}>· {opcion.spec}</span>
                    ) : null}
                    {opcion.isDefault ? (
                      <span className={matS.rec}>Recomendado</span>
                    ) : null}
                    {opcion.missingPrice ? (
                      <span className={matS.warnTag}>sin precio</span>
                    ) : null}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      ) : null}
      {alerta ? (
        <div className={matS.alert}>{alerta}</div>
      ) : hint ? (
        <div className={matS.hint}>{hint}</div>
      ) : null}
    </div>
  );
}

function findSelectedCandidateVariant(
  slot: SlotComercialElige,
  config: Pick<MotorConfigState, "seleccionMaterial">,
) {
  const key = materialSelectionKey(slot.configPasoId, slot.slotCodigo);
  const selected =
    config.seleccionMaterial[key] || defaultSlotCandidateId(slot) || "";
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
        config.seleccionMaterial[
          materialSelectionKey(slot.configPasoId, slot.slotCodigo)
        ] || defaultSlotCandidateId(slot);
      const selectedCandidate =
        slot.candidatos.find(
          (candidate) =>
            candidate.variantes.some(
              (variant) => variant.variantId === selectedId,
            ) ||
            Boolean(selectedId && candidate.defaultVarianteId === selectedId),
        ) ??
        (!selectedId && slot.candidatos.length === 1
          ? slot.candidatos[0]
          : null);
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
  return (
    getActiveMachineForConfig(config, motorConfig)?.plantilla?.toUpperCase() ??
    ""
  );
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
  for (const paso of getActiveConfigPasos(
    rutaSeleccionada,
    config,
    ruleContext,
  )) {
    const familia = paso.rutaPaso.familiaCodigo;
    const template = getMachineTemplate(paso, config);
    if (familia.startsWith("impresion_") || template.includes("IMPRESORA")) {
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
        descripcion:
          cargo.cargoDirectoCatalogo.descripcion?.trim() ||
          "Cargo directo opcional de la cotización.",
        origen: "cargo",
        modoCalculo: cargo.cargoDirectoCatalogo.modoCalculo,
        configCargo: {
          ...asRecord(cargo.cargoDirectoCatalogo.configJson),
          ...asRecord(cargo.configOverrideJson),
        },
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
        const niveles = leerNivelesPaso(config.paramsPasoJson);
        const nivelElegido = motorConfig?.seleccionNivel[config.id];
        const nivelSeleccionado = niveles
          ? nivelElegido === NIVEL_PERSONALIZADO
            ? null
            : nivelEfectivo(niveles, nivelElegido).codigo
          : null;
        const configAvailable = isConfigPasoAvailableForOptionalToggle(
          config,
          ruleContext,
        );
        if (config.modoActivacion === "OPCIONAL") {
          if (configAvailable) {
            opcionales.set(config.id, {
              code: config.id,
              // Nombre manual del modelador → nombre real de la familia
              // (resuelto en el server; para tenant el código es un UUID) →
              // recién ahí humanizar el código.
              name:
                config.nombreVisible?.trim() ||
                config.rutaPaso.familiaNombre ||
                humanizeCodigo(config.rutaPaso.familiaCodigo),
              descripcion: "Paso productivo opcional.",
              origen: "paso",
              configPasoId: config.id,
            });
          }
        }
        for (const cargo of config.cargosDirectosPaso) {
          if (cargo.modoActivacion !== "OPCIONAL") continue;
          if (
            cargo.nivelCodigo &&
            cargo.nivelCodigo !== nivelSeleccionado
          ) {
            continue;
          }
          const parentActive = motorConfig
            ? isConfigPasoVisibleForContext(config, motorConfig, ruleContext)
            : configAvailable;
          if (!parentActive) continue;
          opcionales.set(cargo.id, {
            code: cargo.id,
            name: cargo.cargoDirectoCatalogo.nombre,
            descripcion:
              cargo.cargoDirectoCatalogo.descripcion?.trim() ||
              "Cargo directo opcional del paso.",
            origen: "cargo",
            configPasoId: config.id,
            modoCalculo: cargo.cargoDirectoCatalogo.modoCalculo,
            configCargo: {
              ...asRecord(cargo.cargoDirectoCatalogo.configJson),
              ...asRecord(cargo.configOverrideJson),
            },
          });
        }
      }
    }
  }

  return Array.from(opcionales.values());
}

function getCargoInputDescriptors(
  producto: ProductoDetalle | null,
  ruta: RutaAlternativaDetalle | null,
  includeConfig: (config: ConfigPasoDetalle) => boolean,
  seleccionNivel: Record<string, string>,
): CargoInputDescriptor[] {
  if (!producto) return [];
  const asociaciones = [
    ...producto.cargosDirectosCotizacion,
    ...(ruta?.configPasos ?? [])
      .filter(includeConfig)
      .flatMap((config) => {
        const niveles = leerNivelesPaso(config.paramsPasoJson);
        const nivelSeleccionado = niveles
          ? seleccionNivel[config.id] === NIVEL_PERSONALIZADO
            ? null
            : nivelEfectivo(niveles, seleccionNivel[config.id]).codigo
          : null;
        return config.cargosDirectosPaso.filter(
          (asociacion) =>
            !asociacion.nivelCodigo ||
            asociacion.nivelCodigo === nivelSeleccionado,
        );
      }),
  ];
  const porKey = new Map<string, CargoInputDescriptor>();

  for (const asociacion of asociaciones) {
    const catalogo = asociacion.cargoDirectoCatalogo;
    const config = {
      ...asRecord(catalogo.configJson),
      ...asRecord(asociacion.configOverrideJson),
    };
    if (catalogo.modoCalculo === "POR_UNIDAD_INPUT") {
      const key =
        typeof config.inputCantidad === "string"
          ? config.inputCantidad.trim()
          : "";
      if (!key) continue;
      const existente = porKey.get(key);
      if (existente) {
        existente.activaciones.push({
          asociacionId: asociacion.id,
          modoActivacion: asociacion.modoActivacion,
          condicionActivacionJson: asociacion.condicionActivacionJson,
        });
        continue;
      }
      porKey.set(key, {
        key,
        label: humanizeCodigo(key),
        unidad: typeof config.unidad === "string" ? config.unidad : undefined,
        tipo: "number",
        activaciones: [
          {
            asociacionId: asociacion.id,
            modoActivacion: asociacion.modoActivacion,
            condicionActivacionJson: asociacion.condicionActivacionJson,
          },
        ],
        cargoNombre: catalogo.nombre,
      });
      continue;
    }

    const zonas = Array.isArray(config.zonas) ? config.zonas : [];
    if (catalogo.modoCalculo !== "MONTO_FIJO_PLANO" || zonas.length === 0) {
      continue;
    }
    const opciones = zonas
      .map((raw) => asRecord(raw))
      .filter((item) => typeof item.codigo === "string")
      .map((item) => ({
        value: String(item.codigo),
        label: String(item.nombre ?? item.codigo),
      }));
    if (opciones.length === 0) continue;
    const existente = porKey.get("zonaInstalacion");
    porKey.set("zonaInstalacion", {
      key: "zonaInstalacion",
      label: "Zona",
      tipo: "select",
      opciones: Array.from(
        new Map(
          [...(existente?.opciones ?? []), ...opciones].map((item) => [
            item.value,
            item,
          ]),
        ).values(),
      ),
      activaciones: [
        ...(existente?.activaciones ?? []),
        {
          asociacionId: asociacion.id,
          modoActivacion: asociacion.modoActivacion,
          condicionActivacionJson: asociacion.condicionActivacionJson,
        },
      ],
      cargoNombre: catalogo.nombre,
    });
  }
  return [...porKey.values()];
}

function isCargoInputVisible(
  input: CargoInputDescriptor,
  motorConfig: MotorConfigState,
  ruleContext: Record<string, unknown>,
) {
  return input.activaciones.some((activacion) => {
    if (activacion.modoActivacion === "OPCIONAL") {
      return Boolean(motorConfig.opcionalesActivados[activacion.asociacionId]);
    }
    if (activacion.modoActivacion === "CONDICIONAL") {
      return evaluarJsonLogicBoolean(
        activacion.condicionActivacionJson,
        ruleContext,
        false,
      );
    }
    return activacion.modoActivacion === "OBLIGATORIO";
  });
}

function mapProductoReal(
  producto: ProductoListItem | ProductoDetalle,
): CatalogProduct {
  const categoria = producto.subcategoriaComercial.categoria;
  const subcategoria = producto.subcategoriaComercial;
  const atributos = producto.atributosComercialesJson ?? {};
  const schema = subcategoria.atributosSchemaJson.length
    ? subcategoria.atributosSchemaJson
    : [
        {
          key: "detalle",
          label: "Detalle",
          tipo: "text",
          visible: true,
          orden: 10,
        },
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
    minimoComercialCantidad:
      Number(producto.minimoComercialCantidad ?? 0) || null,
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
          type: (spec.tipo === "select"
            ? "select"
            : "text") as CatalogSpec["type"],
          def,
        };
      })
      .filter((spec) =>
        shouldShowCommercialSpec(spec, spec.def, { real: true }),
      ),
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
    const item = product.adicionales.find(
      (adicional) => adicional.code === code,
    );
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

  return {
    subtotal,
    adicionalesMonto,
    subtotalConAdi,
    impuestos,
    costoEstimado,
    total,
    margen,
  };
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
  if (cotizacion.desglosePrecio)
    return cotizacion.desglosePrecio.margenEfectivoPct;
  const neto = getCotizacionNeto(cotizacion);
  return neto > 0 ? ((neto - cotizacion.costos.total) / neto) * 100 : 0;
}

function labelPrecioUnitario(unidad: string) {
  if (unidad === "m²") return "Precio por m²";
  if (unidad === "ml") return "Precio por metro lineal";
  return "Precio por unidad";
}

function isMetroLinealConMedidasVariables(
  productoDetalle: ProductoDetalle | null,
) {
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

function usaCantidadComercialParaPiezas(
  productoDetalle: ProductoDetalle | null,
) {
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
    resolverMedidasPredefinidas(productoDetalle, config),
  );
  if (medidaPredefinida) {
    // Una plancha (pliego_util) SIN resolver tiene dims 0: cotizarla mandaría
    // una pieza 0×0 al motor (el mismo OOM que este guard evita).
    return !(medidaPredefinida.anchoMm > 0 && medidaPredefinida.altoMm > 0);
  }
  if (config.piezas.length === 0) return true;
  return config.piezas.some(
    (pieza) => !(pieza.anchoMm > 0) || !(pieza.altoMm > 0),
  );
}

function getCotizacionPasos(
  cotizacion: CotizacionExitosa,
): PasoProduccionPropuesta[] {
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
  const rutaSel = getRutaSeleccionada(
    productoDetalle,
    config.rutaAlternativaId,
  );
  for (const slot of slotsComercialElige) {
    if (slot.formula !== "por_metro_lineal") continue;
    const configPaso = rutaSel?.configPasos.find(
      (paso) => paso.id === slot.configPasoId,
    );
    if (configPaso && !includeConfig(configPaso)) continue;
    const key = materialSelectionKey(slot.configPasoId, slot.slotCodigo);
    const selected =
      config.seleccionMaterial[key] || defaultSlotCandidateId(slot);
    if (!selected) continue;
    for (const candidate of slot.candidatos) {
      const variant = candidate.variantes.find(
        (item) => item.variantId === selected,
      );
      if (!variant?.anchoMm) continue;
      const machine = configPaso
        ? getActiveMachineForConfig(configPaso, config)
        : null;
      const resolved = resolverAnchoRolloLineal({
        materialWidthMm: variant.anchoMm,
        machineWidthMm: machine?.anchoUtil,
        machineParams: getRecord(machine?.parametrosTecnicosJson),
        stepParams: getRecord(configPaso?.paramsPasoJson),
      });
      if (resolved) return resolved;
    }
  }
  // Si el slot del sustrato no usa fórmula por metro lineal (ej. Plotter CAD),
  // igual se toma su rollo HARDCODED. El material real manda sobre la boca de
  // la máquina: un papel de 914 mm en una máquina de 920 mm tiene 904 mm útiles
  // después de descontar márgenes de 5 + 5 mm.
  for (const configPaso of rutaSel?.configPasos ?? []) {
    if (configPaso.rutaPaso.familiaCodigo !== "impresion_por_area") continue;
    if (!includeConfig(configPaso)) continue;
    const machine = getActiveMachineForConfig(configPaso, config);
    const sustrato = getPliegoActivoDeImpresion(configPaso, config);
    const resolved = resolverAnchoRolloLineal({
      materialWidthMm: sustrato?.anchoMm,
      machineWidthMm: machine?.anchoUtil,
      machineParams: getRecord(machine?.parametrosTecnicosJson),
      stepParams: getRecord(configPaso.paramsPasoJson),
    });
    if (resolved) return resolved;
  }
  // Fallback: corte sobre rollo (plotter de corte con sustrato propio, ej.
  // vinilo). El slot de sustrato es HARDCODED — no lo elige el comercial, así
  // que no entra por el loop de `slotsComercialElige` de arriba, y el paso no
  // es `impresion_por_area`. El ancho de trabajo lo da el ROLLO cargado (el
  // vinilo), no la boca de la máquina: se puede cargar un vinilo más angosto.
  // El motor sintetiza la pieza = ancho útil × ml igual que en impresión.
  for (const configPaso of rutaSel?.configPasos ?? []) {
    if (configPaso.rutaPaso.familiaCodigo !== "plotter_corte") continue;
    if (!includeConfig(configPaso)) continue;
    const sustrato = getPliegoActivoDeImpresion(configPaso, config);
    if (!sustrato || sustrato.anchoMm <= 0) continue;
    const machine = getActiveMachineForConfig(configPaso, config);
    const resolved = resolverAnchoRolloLineal({
      materialWidthMm: sustrato.anchoMm,
      machineWidthMm: machine?.anchoUtil,
      machineParams: getRecord(machine?.parametrosTecnicosJson),
      stepParams: getRecord(configPaso.paramsPasoJson),
    });
    if (resolved) return resolved;
  }
  return null;
}

/**
 * Estado efectivo de una personalización combinando la definición del producto
 * con lo que el comercial cargó en el sheet. Para FIJA la medida es siempre la
 * del producto; para CLIENTE se toma la del comercial (con la del producto como
 * sugerencia). `activa` respeta el toggle salvo que sea obligatoria.
 */
function personalizacionEstadoEfectivo(
  p: PersonalizacionProducto,
  config: MotorConfigState,
): { activa: boolean; anchoMm: number; altoMm: number } {
  const estado = config.personalizaciones?.[p.codigo];
  const activa = p.obligatoria ? true : (estado?.activa ?? false);
  if (p.modoMedida === "FIJA") {
    return { activa, anchoMm: p.anchoMm, altoMm: p.altoMm };
  }
  return {
    activa,
    anchoMm: estado?.anchoMm ?? p.anchoMm,
    altoMm: estado?.altoMm ?? p.altoMm,
  };
}

function buildJobContext(
  productoDetalle: ProductoDetalle | null,
  config: MotorConfigState,
  qty: number,
  slotsComercialElige: SlotComercialElige[],
  includeConfig: (config: ConfigPasoDetalle) => boolean = () => true,
) {
  const medidaPredefinidaCruda = getSelectedPredefinedMeasure(
    productoDetalle,
    config.medidaPredefinidaId,
    resolverMedidasPredefinidas(productoDetalle, config, includeConfig),
  );
  // Plancha sin resolver (dims 0): no hay pieza válida que mandar al motor.
  const medidaPredefinida =
    medidaPredefinidaCruda &&
    medidaPredefinidaCruda.anchoMm > 0 &&
    medidaPredefinidaCruda.altoMm > 0
      ? medidaPredefinidaCruda
      : null;
  const cotizaConPiezas = usaPiezasParaCotizar(productoDetalle, config);
  const cotizaLinealDirecto =
    isMetroLinealConMedidasVariables(productoDetalle) &&
    config.modoCotizacionLineal === "directo";
  const piezasUsanCantidadComercial =
    cotizaConPiezas && usaCantidadComercialParaPiezas(productoDetalle);
  const usaMedidaPersonalizadaReal =
    cotizaConPiezas && config.piezas.length > 0;
  const cantidadTrabajo = cotizaLinealDirecto
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
  // Imposición de cuadernillo: las páginas del documento viajan al motor
  // (lo cargado por el comercial, o el default del paso de impresión).
  const imposicionRuta = getImposicionCaballeteDeRuta(
    getRutaSeleccionada(productoDetalle, config.rutaAlternativaId ?? ""),
    includeConfig,
  );
  if (imposicionRuta) {
    const paginas = config.paginas ?? imposicionRuta.paginasDefault;
    if (paginas && paginas > 0) ctx.paginas = paginas;
  }
  // Cartelería: la profundidad del cajón viaja al motor en mm (lo cargado por
  // el comercial, o la fija del paso de bastidor).
  const profundidadRuta = getProfundidadDeRuta(
    getRutaSeleccionada(productoDetalle, config.rutaAlternativaId ?? ""),
    includeConfig,
  );
  if (profundidadRuta) {
    const profundidadMm =
      config.profundidadCm != null && config.profundidadCm > 0
        ? config.profundidadCm * 10
        : profundidadRuta.profundidadDefaultMm;
    if (profundidadMm && profundidadMm > 0) ctx.profundidadMm = profundidadMm;
  }
  // Avanzado: caras por paso — el override gana sobre `caras` global en el
  // motor solo para ese paso (ej. original doble faz, duplicado simple).
  for (const [configPasoId, carasPaso] of Object.entries(
    config.carasPorPaso ?? {},
  )) {
    if (carasPaso === 1 || carasPaso === 2) {
      ctx[`caras_${configPasoId}`] = carasPaso;
    }
  }
  const materialLinealMetrics = cotizaLinealDirecto
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

  // Producto sin medida propia (merchandising: taza, remera): la "pieza" que se
  // produce/imprime ES la estampa de la personalización. Sintetiza piezas desde
  // las personalizaciones activas para que un paso de impresión por área tenga
  // qué nestear/costear/validar (requires_piezas). Ver
  // docs/productos-comprados-merchandising-diseno.md
  const piezasDesdePersonalizaciones = getPersonalizaciones(
    productoDetalle?.personalizacionesJson,
  )
    .map((p) => personalizacionEstadoEfectivo(p, config))
    .filter(
      (estado) => estado.activa && estado.anchoMm > 0 && estado.altoMm > 0,
    )
    .map((estado, index) => ({
      uiKey: `pers-pieza-${index}`,
      cantidad: cantidadTrabajo,
      anchoMm: estado.anchoMm,
      altoMm: estado.altoMm,
    }));

  const piezasContexto = usaMedidaPersonalizadaReal
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
      : piezasDesdePersonalizaciones.length > 0
        ? piezasDesdePersonalizaciones
        : [];

  if (piezasContexto.length > 0) {
    ctx.piezas = piezasContexto.map((pieza) => ({
      cantidad: piezasUsanCantidadComercial ? qty : pieza.cantidad,
      anchoMm: pieza.anchoMm,
      altoMm: pieza.altoMm,
    }));
    ctx.piezaAnchoMaxMm = Math.max(
      ...piezasContexto.map((pieza) => pieza.anchoMm),
    );
    ctx.piezaAltoMaxMm = Math.max(
      ...piezasContexto.map((pieza) => pieza.altoMm),
    );
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
  ctx.cargoInputs = config.cargoInputs;
  for (const [key, value] of Object.entries(config.cargoInputs)) {
    if (key && value !== "") ctx[key] = value;
  }

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
    const variantId =
      config.seleccionMaterial[key] || defaultSlotCandidateId(slot);
    if (!variantId) continue;
    slotMateriales[key] = variantId;
    ctx[`slotMaterial_${key}`] = variantId;
    if (slotCounts[slot.slotCodigo] === 1) {
      slotMateriales[slot.slotCodigo] = variantId;
      ctx[`slotMaterial_${slot.slotCodigo}`] = variantId;
    }
  }
  if (Object.keys(slotMateriales).length > 0)
    ctx.slotMateriales = slotMateriales;

  for (const [configPasoId, maquinaId] of Object.entries(
    config.seleccionMaquina,
  )) {
    if (maquinaId) ctx[`maquinaSeleccionada_${configPasoId}`] = maquinaId;
  }

  // Override explícito de perfil de impresión elegido por el comercial
  // ("Modificar perfil"). El motor lo valida contra la máquina activa.
  for (const [configPasoId, perfilId] of Object.entries(
    config.seleccionPerfil,
  )) {
    if (perfilId) ctx[`perfilSeleccionado_${configPasoId}`] = perfilId;
  }

  const rutaSel = getRutaSeleccionada(
    productoDetalle,
    config.rutaAlternativaId,
  );

  // Valores de eje de un paso tercerizado con matriz → el motor hace el lookup.
  // El eje `cantidad` se toma de `qty` (la cantidad del ítem es la fuente única),
  // no de un campo aparte; los demás ejes vienen de la selección del comercial.
  for (const cp of tercerizadoMatrizPasos(rutaSel?.configPasos ?? [])) {
    const elegidos = config.seleccionTercerizado?.[cp.id] ?? {};
    const usaCantidad = tercerizadoEjes(cp).some(
      (eje) => eje.clave === "cantidad",
    );
    const valores = usaCantidad
      ? { ...elegidos, cantidad: String(qty) }
      : elegidos;
    if (Object.keys(valores).length > 0) ctx[`tercerizado_${cp.id}`] = valores;
  }

  // Fuente `manual`: la cotización del proveedor para ESTE trabajo. Sin valor
  // no se manda nada — el motor usa el costo estimado de referencia si existe.
  for (const cp of tercerizadoManualPasos(rutaSel?.configPasos ?? [])) {
    const costo = config.tercerizadoCostoManual?.[cp.id];
    if (typeof costo === "number" && Number.isFinite(costo) && costo > 0) {
      ctx[`tercerizadoCostoManual_${cp.id}`] = costo;
    }
  }

  // Params abiertos al comercial: sólo de pasos ACTIVOS y sólo lo que cambió.
  // Quedan en el snapshot del ítem, así que llegan a la OT.
  // Activación EFECTIVA: incluye los pasos que otro exige (ojales enciende el
  // refuerzo). Sin esto, los params de un paso arrastrado se descartaban.
  const opcionalesEfectivos = opcionalesActivadosEfectivos(
    rutaSel?.configPasos ?? [],
    config.opcionalesActivados,
  );
  const runtimeParams = buildConfigPasoRuntime(
    rutaSel?.configPasos ?? [],
    config.paramsComercial ?? {},
    (configPasoId, modoActivacion) =>
      modoActivacion !== "OPCIONAL" ||
      Boolean(opcionalesEfectivos[configPasoId]),
  );
  // (El merge espejo de cartelería murió con la Etapa 3 de derivadores:
  // `buildConfigPasoRuntime` ya no filtra campos client-side — la autoridad
  // es `paramsEfectivos` del motor, que acepta los `expuestoAlComercial`
  // declarados por la familia.)
  if (Object.keys(runtimeParams).length > 0) {
    ctx.configPasoRuntime = runtimeParams;
  }

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
  // Tercerizado sin máquina: la tecnología la elige el comercial en el editor y
  // viaja en tercerizadoConfigJson. Se refleja en jobContext.tecnologia para que
  // los reportes por tecnología cuenten al tercerizado (si ya hay tecnología de
  // máquina, esa gana). docs/productos-tercerizados-diseno.md
  if (!ctx.tecnologia) {
    for (const configPaso of rutaSel?.configPasos ?? []) {
      if (!configPaso.tercerizado || !includeConfig(configPaso)) continue;
      const tec = (
        configPaso.tercerizadoConfigJson as { tecnologia?: unknown } | null
      )?.tecnologia;
      if (typeof tec === "string" && tec) {
        ctx.tecnologia = tec;
        break;
      }
    }
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
    const selected = resolveModoColorSeleccionado(
      modo,
      config.seleccionModoColor[modo.configPasoId],
    );
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

  // Nivel del paso (zona de colocación, dificultad de diseño): la clave viaja
  // SIEMPRE que el paso corra, aunque el comercial no haya tocado nada — el
  // motor cae en el nivel por defecto y así lo cotizado y lo mostrado coinciden.
  const nivelesComercial = getNivelesComercial(rutaSel, includeConfig).filter(
    (item) =>
      item.modoActivacion !== "OPCIONAL" ||
      Boolean(config.opcionalesActivados[item.configPasoId]),
  );
  for (const item of nivelesComercial) {
    const elegido = nivelEfectivo(
      item.config,
      config.seleccionNivel[item.configPasoId],
    );
    ctx[nivelPasoKey(item.configPasoId)] = elegido.codigo;
  }

  // Tiempo estimado por el comercial (docs/tiempo-manual-por-paso-diseno.md):
  // minutos por paso. Sin valor efectivo no se manda la clave y el motor
  // calcula el paso como siempre.
  const tiemposManuales = getTiemposManualesComercial(
    rutaSel,
    includeConfig,
    config.seleccionNivel,
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

  // Personalizaciones (áreas de decoración con medida propia): publican el área
  // TOTAL en m² bajo `personalizacion_<codigo>_areaM2` para que el paso marcado
  // con `fuenteMedida` la use en vez de la medida global. Área total = medida ×
  // cantidad de unidades (una personalización por unidad producida). Solo las
  // activas; las opcionales inactivas no emiten clave (el paso da 0).
  // Ver docs/personalizaciones-diseno.md
  const personalizaciones = getPersonalizaciones(
    productoDetalle?.personalizacionesJson,
  );
  if (personalizaciones.length > 0) {
    const detalles: Array<{
      codigo: string;
      nombre: string;
      anchoMm: number;
      altoMm: number;
      areaM2: number;
    }> = [];
    for (const p of personalizaciones) {
      const estado = personalizacionEstadoEfectivo(p, config);
      if (!estado.activa) continue;
      const areaM2 = personalizacionAreaM2(estado, cantidadTrabajo);
      ctx[personalizacionAreaKey(p.codigo)] = areaM2;
      detalles.push({
        codigo: p.codigo,
        nombre: p.nombre,
        anchoMm: estado.anchoMm,
        altoMm: estado.altoMm,
        areaM2,
      });
    }
    if (detalles.length > 0) ctx.personalizaciones = detalles;
  }

  return ctx;
}

function calcularCantidadComercial(
  product: CatalogProduct,
  productoDetalle: ProductoDetalle | null,
  config: MotorConfigState | undefined,
  qty: number,
) {
  if (
    config &&
    usaPiezasParaCotizar(productoDetalle, config) &&
    config.piezas.length
  ) {
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
      if (
        aplicado.politica === "BLOQUEAR" &&
        aplicado.cantidadReal < aplicado.cantidadMinima
      ) {
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
  const cantidadReal = calcularCantidadComercial(
    product,
    productoDetalle,
    config,
    qty,
  );
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
  const hasSpec = (key: string) =>
    product.specs.some((spec) => spec.key === key);
  const setSpec = (key: string, value: string | undefined) => {
    if (!value) return;
    if (!hasSpec(key) && !ENRICHED_SPEC_LABELS[key]) return;
    if (!hasUsefulSpecValue(value)) return;
    base[key] = value;
  };
  const rutaSeleccionada = getRutaSeleccionada(
    productoDetalle,
    config.rutaAlternativaId,
  );
  const hardcodedMaterials =
    rutaSeleccionada?.configPasos
      .filter((paso) =>
        isConfigPasoVisibleForContext(paso, config, ruleContext),
      )
      .flatMap((paso) => paso.slotsMateriales)
      .filter(
        (slot) =>
          slot.modoSeleccion === "HARDCODED" &&
          MATERIAL_BASE_SLOT_CODES.has(slot.slotCodigo),
      )
      .map(
        (slot) =>
          slot.materialVariante?.nombreVariante ?? slot.materialVariante?.sku,
      )
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
    const piezasUsanCantidadComercial =
      usaCantidadComercialParaPiezas(productoDetalle);
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
      .map(
        ([medida, cantidad]) =>
          `${cantidad.toLocaleString("es-AR")} u. × ${medida}`,
      )
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
    resolverMedidasPredefinidas(productoDetalle, config),
  );
  if (
    medidaPredefinida &&
    medidaPredefinida.anchoMm > 0 &&
    medidaPredefinida.altoMm > 0 &&
    !usaMedidasPersonalizadas
  ) {
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
      setSpec("caras", [...(detallePorPaso ?? []), resto].join(" · "));
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
        modo.options.find(
          (option) => normalizeModoColor(option.value) === value,
        )?.label ?? value;
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
  const tecnologiaLabel =
    processLabels.length > 0 ? processLabels.join(" / ") : "";
  if (tecnologiaLabel) {
    setSpec("tecnologia", tecnologiaLabel);
    setSpec("tecnologia_proceso", tecnologiaLabel);
    setSpec("proceso", tecnologiaLabel);
  }

  // Blank comprado (merchandising / textil): nutre la OT con el producto base y
  // su variante (talle/color/material) + las estampas. El blank se detecta por
  // sus atributos de variante (tipoPrenda/tipoObjeto/categoria) en cualquier slot
  // HARDCODED o elegido. Ver docs/ot-merchandising-info-diseno.md
  const esBlankAttrs = (
    attrs: Record<string, unknown> | null | undefined,
  ): attrs is Record<string, unknown> =>
    Boolean(
      attrs &&
        typeof attrs === "object" &&
        (typeof attrs.tipoPrenda === "string" ||
          typeof attrs.tipoObjeto === "string"),
    );
  const blankAttrsCandidatos: Array<
    Record<string, unknown> | null | undefined
  > = [
    // Slots HARDCODED (material fijo del paso).
    ...(rutaSeleccionada?.configPasos ?? [])
      .filter((paso) =>
        isConfigPasoVisibleForContext(paso, config, ruleContext),
      )
      .flatMap((paso) => paso.slotsMateriales)
      .map((slot) => slot.materialVariante?.atributosVarianteJson),
    // Slots COMERCIAL_ELIGE: el comercial eligió la variante al cotizar (vive en
    // config.seleccionMaterial, no en el paso). Ej: la remera/talle/color.
    ...slotsComercialElige.map((slot) => {
      const key = materialSelectionKey(slot.configPasoId, slot.slotCodigo);
      const selected =
        config.seleccionMaterial[key] || defaultSlotCandidateId(slot);
      if (!selected) return undefined;
      for (const cand of slot.candidatos) {
        const variante = cand.variantes.find((v) => v.variantId === selected);
        if (variante) return variante.atributosVarianteJson;
      }
      return undefined;
    }),
  ];
  const blankVariante = blankAttrsCandidatos.find(esBlankAttrs);
  if (blankVariante) {
    const readStr = (k: string) =>
      typeof blankVariante[k] === "string"
        ? (blankVariante[k] as string).trim()
        : "";
    const esTextil = Boolean(readStr("tipoPrenda"));
    const tipo = readStr("tipoPrenda") || readStr("tipoObjeto");
    const categoria = readStr("categoria");
    const material = readStr("material");
    const color = readStr("color");
    const talle = readStr("talle");
    if (categoria || tipo) {
      setSpec(
        "producto_tipo",
        `${esTextil ? "Textil" : "Objeto"}${categoria ? ` · ${categoria}` : ""}`,
      );
    }
    if (tipo) {
      setSpec(
        "producto_base",
        `${tipo}${material ? ` ${material.toLowerCase()}` : ""}`,
      );
    }
    if (talle && talle.toLowerCase() !== "único") setSpec("talle", talle);
    if (color) setSpec("color_prenda", color);
    if (material) setSpec("material_base", material);
  }

  // Estampas (personalizaciones activas): nombre · medida · técnica.
  const personalizacionesFicha = getPersonalizaciones(
    productoDetalle?.personalizacionesJson,
  )
    .map((p) => ({ p, estado: personalizacionEstadoEfectivo(p, config) }))
    .filter(
      ({ estado }) => estado.activa && estado.anchoMm > 0 && estado.altoMm > 0,
    )
    .map(({ p, estado }) => {
      const medida = formatMedidasCm(estado.anchoMm, estado.altoMm);
      return `${p.nombre} · ${medida}${tecnologiaLabel ? ` · ${tecnologiaLabel}` : ""}`;
    });
  if (personalizacionesFicha.length > 0) {
    setSpec("personalizaciones", personalizacionesFicha.join("\n"));
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
  // Imposición de cuadernillo: las páginas quedan en la ficha/OT.
  const imposicionSpec = getImposicionCaballeteDeRuta(
    rutaSeleccionada,
    isExecutableConfigPaso,
  );
  if (imposicionSpec) {
    const paginasSpec = config.paginas ?? imposicionSpec.paginasDefault;
    if (paginasSpec && paginasSpec > 0) {
      setSpec("paginas", `${paginasSpec} páginas`);
    }
  }
  // Cartelería: la profundidad del cajón queda en la ficha/OT.
  const profundidadSpec = getProfundidadDeRuta(
    rutaSeleccionada,
    isExecutableConfigPaso,
  );
  if (profundidadSpec) {
    const profundidadMmSpec =
      config.profundidadCm != null && config.profundidadCm > 0
        ? config.profundidadCm * 10
        : profundidadSpec.profundidadDefaultMm;
    if (profundidadMmSpec && profundidadMmSpec > 0) {
      setSpec("profundidad", `${profundidadMmSpec / 10} cm de profundidad`);
    }
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
  if (!hasUsefulSpecValue(value) || !hasUsefulSpecValue(modoColor))
    return false;
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
  if (
    spec.key === "uso_aplicacion" &&
    value?.trim().toLowerCase() === "interior / exterior"
  ) {
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
    throw new Error(
      "La propuesta solo puede agregar productos cotizados por el Motor Universal.",
    );
  }
  const selectedAdicionales = product.adicionales
    .filter((adicional) => adi.includes(adicional.code))
    .map((adicional) => adicional.name);
  const cargosCotizados =
    cotizacion?.cargosDirectosCotizacion.map((cargo) => cargo.cargoNombre) ??
    [];
  const adicionales = Array.from(
    new Set([...selectedAdicionales, ...cargosCotizados]),
  );
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
    visible: shouldShowCommercialSpec(
      spec,
      especificaciones[spec.key],
      product,
      especificaciones,
    ),
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
    motorCodigo:
      product.id ?? product.family.toLowerCase().replaceAll(" ", "_"),
    categoriaComercialCodigo: product.categoriaComercialCodigo,
    categoriaComercialNombre: product.categoriaComercialNombre,
    subcategoriaComercialCodigo: product.subcategoriaComercialCodigo,
    subcategoriaComercialNombre: product.subcategoriaComercialNombre,
    // `varianteNombre` es la referencia visual del renglón (la ficha lo pinta
    // como "· <ref>") y es propio del centro de copiado, donde todos los ítems
    // comparten producto y se distinguen por archivo/tomo. Un producto de
    // catálogo se distingue por su NOMBRE: acá venía la descripción comercial
    // y aparecía pegada al nombre en la ficha.
    varianteNombre: undefined,
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
      .filter(
        ([key, value]) =>
          key.startsWith("maquinaSeleccionada_") && typeof value === "string",
      )
      .map(([key, value]) => [
        key.replace("maquinaSeleccionada_", ""),
        value as string,
      ]),
  );
  const seleccionModoColor = Object.fromEntries(
    Object.entries(ctx)
      .filter(
        ([key, value]) =>
          key.startsWith("modoColor_") && typeof value === "string",
      )
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
  const seleccionNivel = Object.fromEntries(
    Object.entries(ctx)
      .filter(
        ([key, value]) =>
          key.startsWith("nivelPaso_") && typeof value === "string",
      )
      .map(([key, value]) => [key.replace("nivelPaso_", ""), value as string]),
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
      if (
        !Number.isFinite(cantidad) ||
        !Number.isFinite(anchoMm) ||
        !Number.isFinite(altoMm)
      ) {
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
  const medidaModo = typeof ctx.medidaModo === "string" ? ctx.medidaModo : "";
  const restaurarPiezasPersonalizadas =
    medidaModo === "personalizada" ||
    (!medidaModo && !medidaPredefinidaId && piezas.length > 0);

  // Personalizaciones guardadas: reconstruye el estado por código desde el
  // detalle publicado en el jobContext (activa=true porque solo se guardaron las
  // emitidas). Las medidas se restauran; las opcionales no listadas quedan en su
  // default (obligatoria=activa) al leer el producto.
  const personalizacionesGuardadas = Array.isArray(ctx.personalizaciones)
    ? (ctx.personalizaciones as Array<Record<string, unknown>>).reduce<
        MotorConfigState["personalizaciones"]
      >((acc, raw) => {
        const codigo = typeof raw.codigo === "string" ? raw.codigo : "";
        if (!codigo) return acc;
        acc[codigo] = {
          activa: true,
          anchoMm: Number(raw.anchoMm) || 0,
          altoMm: Number(raw.altoMm) || 0,
        };
        return acc;
      }, {})
    : {};

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
      Number.isFinite(Number(ctx.numerosXTalonario)) &&
      Number(ctx.numerosXTalonario) > 0
        ? Number(ctx.numerosXTalonario)
        : DEFAULT_MOTOR_CONFIG.numerosXTalonario,
    piezas: restaurarPiezasPersonalizadas ? piezas : [],
    opcionalesActivados: Object.fromEntries(
      Object.entries(opcionalesRaw).map(([key, value]) => [
        key,
        Boolean(value),
      ]),
    ),
    seleccionMaterial: Object.fromEntries(
      Object.entries(slotMaterialesRaw)
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => [key, value as string]),
    ),
    seleccionMaquina,
    seleccionPerfil,
    seleccionModoColor,
    seleccionNivel,
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
      Number.isFinite(Number(ctx.m2_instalados)) &&
      Number(ctx.m2_instalados) > 0
        ? Number(ctx.m2_instalados)
        : DEFAULT_MOTOR_CONFIG.m2Instalados,
    personalizaciones: personalizacionesGuardadas,
    // Imposición de cuadernillo y cartelería: sin esto, reabrir el ítem
    // perdía las páginas, la profundidad y lo tocado en el configurador 3D.
    paginas:
      Number.isFinite(Number(ctx.paginas)) && Number(ctx.paginas) > 0
        ? Number(ctx.paginas)
        : null,
    profundidadCm:
      Number.isFinite(Number(ctx.profundidadMm)) &&
      Number(ctx.profundidadMm) > 0
        ? Number(ctx.profundidadMm) / 10
        : null,
    paramsComercial:
      ctx.configPasoRuntime &&
      typeof ctx.configPasoRuntime === "object" &&
      !Array.isArray(ctx.configPasoRuntime)
        ? (ctx.configPasoRuntime as Record<string, Record<string, unknown>>)
        : {},
    cargoInputs:
      ctx.cargoInputs &&
      typeof ctx.cargoInputs === "object" &&
      !Array.isArray(ctx.cargoInputs)
        ? (ctx.cargoInputs as Record<string, string | number>)
        : {},
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
  const { moneda } = useConfigRegional();
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [filtrosAbiertos, setFiltrosAbiertos] = React.useState(false);
  const activeResultRef = React.useRef<HTMLButtonElement | null>(null);
  const families = React.useMemo(
    () => [
      "Todos",
      ...Array.from(new Set(products.map((product) => product.family))),
    ],
    [products],
  );

  // Busca por título (y código), no por el texto descriptivo. Cada palabra de
  // la consulta debe estar presente (AND).
  const queryTokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = products.filter((product) => {
    if (family !== "Todos" && product.family !== family) return false;
    if (queryTokens.length === 0) return true;
    const haystack = `${product.code} ${product.name}`.toLowerCase();
    return queryTokens.every((token) => haystack.includes(token));
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
          placeholder="Buscar por nombre o código..."
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
        <span className="kbd">↑↓ Enter</span>
      </div>

      {/* Filtros por categoría plegados: por defecto sólo se ven los productos;
          el botón despliega los chips si hace falta afinar. */}
      <div className="ap-filters">
        <button
          type="button"
          className={`ap-chip ${family !== "Todos" ? "on" : ""}`}
          onClick={() => setFiltrosAbiertos((v) => !v)}
          aria-expanded={filtrosAbiertos}
        >
          {family === "Todos" ? "Filtrar por categoría" : family}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              marginLeft: 4,
              transform: filtrosAbiertos ? "rotate(180deg)" : "none",
              transition: "transform .15s",
            }}
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {filtrosAbiertos
          ? families.map((item) => (
              <button
                key={item}
                type="button"
                className={`ap-chip ${family === item ? "on" : ""}`}
                onClick={() => {
                  setFamily(item);
                  setFiltrosAbiertos(false);
                }}
              >
                {item}
                {item !== "Todos" ? (
                  <span className="ct">
                    {
                      products.filter((product) => product.family === item)
                        .length
                    }
                  </span>
                ) : null}
              </button>
            ))
          : null}
      </div>

      <div className="ap-section">
        <div className="ap-section-head">
          <span>Catálogo</span>
          <span className="ap-section-hint">
            {filtered.length} producto{filtered.length === 1 ? "" : "s"}
          </span>
        </div>
        <div
          className="ap-list"
          role="listbox"
          aria-label="Productos del catálogo"
        >
          {filtered.map((product, index) => (
            <button
              key={product.code}
              ref={
                activeProduct?.code === product.code ? activeResultRef : null
              }
              type="button"
              role="option"
              className={`ap-prod ${activeProduct?.code === product.code ? "is-keyboard-target" : ""}`}
              aria-selected={activeProduct?.code === product.code}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onPick(product)}
            >
              <span className="ap-prod-main">
                <span className="ap-prod-head">
                  <span
                    className={`tipo-chip tipo-${familyColor(product.family)}`}
                  >
                    <span className="d" />
                    {product.family}
                  </span>
                </span>
                <span className="ap-prod-name">
                  {highlightMatch(product.name, queryTokens)}
                </span>
                <span className="ap-prod-desc">{product.descripcion}</span>
              </span>
              <span className="ap-prod-meta">
                <span className="ap-mode">
                  <ApAtomMode mode={product.cobro} />
                  {product.cobro}
                </span>
                {!product.real ? (
                  <span className="ap-precio">
                    Referencia{" "}
                    <strong>
                      {formatCurrency(product.precioBase, moneda)}
                    </strong>{" "}
                    / {product.unidad}
                  </span>
                ) : null}
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
                Probá quitar el filtro <strong>{family}</strong> o ajustar la
                búsqueda.
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
  /** Los PDF medidos se retienen en el padre para subirlos al guardar. */
  setPlanosAdjuntos: React.Dispatch<React.SetStateAction<File[]>>;
  notaProduccion: string;
  setNotaProduccion: (value: string) => void;
  cotizacion: CotizarResponse | null;
  cotizando: boolean;
  cotizacionError: string | null;
  onCotizar: () => void;
  onBack: () => void;
  onClose: () => void;
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
  setPlanosAdjuntos,
  notaProduccion,
  setNotaProduccion,
  cotizacion,
  cotizando,
  cotizacionError,
  onCotizar,
  onBack,
  onClose,
}: ConfigStepProps) {
  const { moneda } = useConfigRegional();
  const fmt = (v: number) => formatCurrency(v, moneda);
  const etiquetaImpactoCargo = (cargo: CatalogAdicional) => {
    const config = cargo.configCargo ?? {};
    if (cargo.modoCalculo === "MONTO_FIJO_PLANO") {
      const monto = Number(config.monto ?? 0);
      if (Number.isFinite(monto) && monto > 0) return `+ ${fmt(monto)}`;
      if (Array.isArray(config.zonas) && config.zonas.length > 0)
        return "Según zona";
    }
    if (cargo.modoCalculo === "PORCENTAJE_SOBRE_BASE") {
      const porcentaje = Number(
        config.porcentaje ?? config.porcentajeDefault ?? 0,
      );
      if (Number.isFinite(porcentaje) && porcentaje > 0)
        return `+ ${formatNumberForSpec(porcentaje)}%`;
    }
    if (cargo.modoCalculo === "POR_UNIDAD_INPUT") {
      const precio = Number(config.precioPorUnidad ?? 0);
      const unidad =
        typeof config.unidad === "string" ? config.unidad.trim() : "";
      if (Number.isFinite(precio) && precio > 0) {
        return `+ ${formatUnitPrice(precio, moneda)}${unidad ? ` / ${unidad}` : ""}`;
      }
      return "Según cantidad";
    }
    return "Importe variable";
  };
  const verMargenes = usePuede("finanzas.ver_margenes");
  const totals = getTotals(product, qty, adi);
  const cotizacionExitosa = getCotizacionExitosa(cotizacion);
  const cotizacionErrores =
    cotizacion && !cotizacion.exitoso ? cotizacion.errores : [];
  const rutaSel = getRutaSeleccionada(
    productoDetalle,
    motorConfig.rutaAlternativaId,
  );
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
  // Un opcional de paso agrega producción; un cargo directo sólo suma plata a la
  // cotización. Son dos decisiones distintas para el comercial, así que se
  // muestran en secciones separadas (los del catálogo demo no traen `origen`).
  const opcionalesPasos = React.useMemo(
    () => opcionalesRuta.filter((opcional) => opcional.origen !== "cargo"),
    [opcionalesRuta],
  );
  const cargosOpcionales = React.useMemo(
    () => opcionalesRuta.filter((opcional) => opcional.origen === "cargo"),
    [opcionalesRuta],
  );
  const cargoInputs = React.useMemo(
    () =>
      getCargoInputDescriptors(
        productoDetalle,
        rutaSel,
        includeVisibleConfig,
        motorConfig.seleccionNivel,
      ),
    [
      includeVisibleConfig,
      motorConfig.seleccionNivel,
      productoDetalle,
      rutaSel,
    ],
  );
  const cargoInputKeys = React.useMemo(
    () => new Set(cargoInputs.map((input) => input.key)),
    [cargoInputs],
  );
  React.useEffect(() => {
    if (cargoInputs.length === 0) return;
    setMotorConfig((current) => {
      const next = { ...current.cargoInputs };
      let changed = false;
      for (const input of cargoInputs) {
        if (next[input.key] !== undefined) continue;
        next[input.key] =
          input.tipo === "select" ? (input.opciones?.[0]?.value ?? "") : 1;
        changed = true;
      }
      return changed ? { ...current, cargoInputs: next } : current;
    });
  }, [cargoInputs, setMotorConfig]);
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
  // Slots que aparecen en más de un paso: ahí el código de slot solo es
  // ambiguo y hay que anteponer el nombre del paso.
  const slotCodigosDuplicados = React.useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const slot of slotsComercialElige) {
      cuenta.set(slot.slotCodigo, (cuenta.get(slot.slotCodigo) ?? 0) + 1);
    }
    return new Set(
      [...cuenta.entries()].filter(([, n]) => n > 1).map(([codigo]) => codigo),
    );
  }, [slotsComercialElige]);
  // Configurador de sello: activo si el producto tiene la herramienta y hay un
  // cuerpo de sello elegido (variante con tamaño de polímero + líneas de texto).
  const editorSelloHabilitado = getHerramientaEditorSello(
    productoDetalle?.atributosComercialesJson,
  ).enabled;
  const selloModel: SelloEditorModel | null = React.useMemo(() => {
    if (!editorSelloHabilitado) return null;
    return getSelloModelDeRuta(
      rutaSel,
      slotsComercialElige,
      motorConfig,
      includeVisibleConfig,
    );
  }, [
    editorSelloHabilitado,
    rutaSel,
    slotsComercialElige,
    motorConfig,
    includeVisibleConfig,
  ]);
  const [selloEditorAbierto, setSelloEditorAbierto] = React.useState(false);
  const slotsMaterialesOpcionalesPorPaso = React.useMemo(
    () => getSlotsOpcionalesPorPaso(slotsComercialElige),
    [slotsComercialElige],
  );
  // Pasos con tiempo estimado por el comercial (visibles según ruta/opcionales).
  const tiemposManualesComercial = React.useMemo(
    () =>
      getTiemposManualesComercial(
        rutaSel,
        includeVisibleConfig,
        motorConfig.seleccionNivel,
      ),
    [rutaSel, includeVisibleConfig, motorConfig.seleccionNivel],
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
  // Niveles del paso: misma regla que el tiempo manual — los de pasos que
  // corren siempre van con los datos del producto; los de pasos opcionales,
  // dentro de la card del opcional activado.
  const nivelesComercialRuta = React.useMemo(
    () => getNivelesComercial(rutaSel, includeVisibleConfig),
    [rutaSel, includeVisibleConfig],
  );
  const nivelesPorConfigPaso = React.useMemo(
    () =>
      new Map(nivelesComercialRuta.map((item) => [item.configPasoId, item])),
    [nivelesComercialRuta],
  );
  const nivelesPrincipales = nivelesComercialRuta.filter(
    (item) => item.modoActivacion !== "OPCIONAL",
  );
  // Complejidad del corte (plotter): misma regla que los niveles — pasos que
  // corren siempre van con los datos del producto; los opcionales, dentro de
  // la card del opcional activado.
  const complejidadCorteRuta = React.useMemo(
    () =>
      getComplejidadCorte(
        rutaSel,
        { seleccionMaquina: motorConfig.seleccionMaquina },
        includeVisibleConfig,
      ),
    [rutaSel, motorConfig.seleccionMaquina, includeVisibleConfig],
  );
  const complejidadPorConfigPaso = React.useMemo(
    () =>
      new Map(complejidadCorteRuta.map((item) => [item.configPasoId, item])),
    [complejidadCorteRuta],
  );
  const complejidadesPrincipales = complejidadCorteRuta.filter(
    (item) => item.modoActivacion !== "OPCIONAL",
  );
  // Catálogo de familias: hace falta el `paramsPasoSchema` para renderizar los
  // campos que el modelador abrió al comercial.
  const [familiasCatalogo, setFamiliasCatalogo] = React.useState<
    Map<string, FamiliaListItem>
  >(new Map());
  React.useEffect(() => {
    let cancelado = false;
    getCatalogoFamilias()
      .then((catalogo) => {
        if (cancelado) return;
        setFamiliasCatalogo(
          new Map(catalogo.familias.map((f) => [f.codigo, f])),
        );
      })
      .catch(() => {
        // Sin catálogo no se ofrecen los campos editables; el motor sigue
        // usando lo que modeló el modelador.
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // Params que el modelador dejó abiertos al comercial.
  const pasosConParamsComercial = React.useMemo(
    () =>
      getParamsComercialDeRuta(rutaSel?.configPasos ?? [], familiasCatalogo),
    [rutaSel, familiasCatalogo],
  );
  // Los params de pasos NO opcionales van con los datos del producto; los de
  // pasos opcionales se configuran en la card del opcional activado, igual que
  // el tiempo manual y los materiales.
  const pasosParamsComercialPrincipales = pasosConParamsComercial.filter(
    (paso) => paso.modoActivacion !== "OPCIONAL",
  );
  const paramsComercialPorConfigPaso = React.useMemo(
    () =>
      new Map(pasosConParamsComercial.map((paso) => [paso.configPasoId, paso])),
    [pasosConParamsComercial],
  );
  // Activación EFECTIVA en el sheet: un paso puede estar encendido porque OTRO
  // lo exige, no porque el comercial lo tildara. Sin esto su card no aparecía y
  // no había dónde completar sus params.
  const opcionalesEfectivosSheet = React.useMemo(
    () =>
      opcionalesActivadosEfectivos(
        rutaSel?.configPasos ?? [],
        motorConfig.opcionalesActivados,
      ),
    [rutaSel, motorConfig.opcionalesActivados],
  );
  const arrastradosSheet = React.useMemo(
    () =>
      arrastradosPorDependencia(
        rutaSel?.configPasos ?? [],
        motorConfig.opcionalesActivados,
      ),
    [rutaSel, motorConfig.opcionalesActivados],
  );

  // Sólo los pasos se configuran: un cargo de paso comparte el `configPasoId`
  // del padre y, si entrara acá, duplicaría la card con su tiempo y sus params.
  const opcionalesConfigurables = React.useMemo(
    () =>
      opcionalesPasos
        .map((opcional) => ({
          opcional,
          slots: slotsMaterialesOpcionalesPorPaso.get(opcional.code) ?? [],
          tiempoManual: opcional.configPasoId
            ? (tiemposManualesPorConfigPaso.get(opcional.configPasoId) ?? null)
            : null,
          paramsComercial: opcional.configPasoId
            ? (paramsComercialPorConfigPaso.get(opcional.configPasoId) ?? null)
            : null,
          nivel: opcional.configPasoId
            ? (nivelesPorConfigPaso.get(opcional.configPasoId) ?? null)
            : null,
          complejidad: opcional.configPasoId
            ? (complejidadPorConfigPaso.get(opcional.configPasoId) ?? null)
            : null,
        }))
        .filter(
          (item) =>
            product.real &&
            (adi.includes(item.opcional.code) ||
              (item.opcional.configPasoId
                ? Boolean(opcionalesEfectivosSheet[item.opcional.configPasoId])
                : false)) &&
            (item.slots.length > 0 ||
              item.tiempoManual !== null ||
              item.paramsComercial !== null ||
              item.nivel !== null ||
              item.complejidad !== null),
        ),
    [
      adi,
      complejidadPorConfigPaso,
      nivelesPorConfigPaso,
      opcionalesEfectivosSheet,
      opcionalesPasos,
      paramsComercialPorConfigPaso,
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
      productoDetalle && modoMedidasUsaPredefinidas(productoDetalle.modoMedidas)
        ? resolverMedidasPredefinidas(
            productoDetalle,
            motorConfig,
            includeVisibleConfig,
          )
        : [],
    [productoDetalle, motorConfig, includeVisibleConfig],
  );
  const usaMedidaMixta = productoDetalle?.modoMedidas === "MIXTA";
  const usaMedidaPersonalizada =
    modoMedidasPermitePersonalizada(productoDetalle?.modoMedidas) &&
    (productoDetalle?.modoMedidas !== "MIXTA" || motorConfig.piezas.length > 0);
  const piezasUsanCantidadComercial =
    usaCantidadComercialParaPiezas(productoDetalle);
  const piezaFocusRefs = React.useRef<Record<string, HTMLInputElement | null>>(
    {},
  );
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

  const personalizaciones = React.useMemo(
    () => getPersonalizaciones(productoDetalle?.personalizacionesJson),
    [productoDetalle],
  );

  const updatePersonalizacion = React.useCallback(
    (
      p: PersonalizacionProducto,
      patch: Partial<{ activa: boolean; anchoMm: number; altoMm: number }>,
    ) => {
      setMotorConfig((current) => {
        const previo =
          current.personalizaciones[p.codigo] ??
          personalizacionEstadoEfectivo(p, current);
        return {
          ...current,
          personalizaciones: {
            ...current.personalizaciones,
            [p.codigo]: { ...previo, ...patch },
          },
        };
      });
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
    () =>
      getHerramientaMedidasArchivo(productoDetalle?.atributosComercialesJson),
    [productoDetalle],
  );
  const [leyendoPlanos, setLeyendoPlanos] = React.useState(false);
  const [arrastrandoPlanos, setArrastrandoPlanos] = React.useState(false);

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
        // Retener los PDF que leyeron bien, para subirlos al guardar la orden.
        const claveFile = (f: File) => `${f.name}::${f.size}`;
        const okFiles = lista.filter((_, j) => resultados[j]?.ok);
        if (okFiles.length > 0) {
          setPlanosAdjuntos((prev) => {
            const vistos = new Set(prev.map(claveFile));
            const agregar = okFiles.filter((f) => !vistos.has(claveFile(f)));
            return agregar.length > 0 ? [...prev, ...agregar] : prev;
          });
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
          const archivosOk = resultados.filter(
            (resultado) => resultado.ok,
          ).length;
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
    [setMotorConfig, setPlanosAdjuntos],
  );

  const getPiezaMeasureValue = React.useCallback(
    (pieza: PiezaInput, field: "anchoCm" | "altoCm") => {
      const draft = piezaMeasureDrafts[pieza.uiKey]?.[field];
      if (draft !== undefined) return draft;
      return formatCmInputFromMm(
        field === "anchoCm" ? pieza.anchoMm : pieza.altoMm,
      );
    },
    [piezaMeasureDrafts],
  );

  const updatePiezaMeasure = React.useCallback(
    (
      index: number,
      pieza: PiezaInput,
      field: "anchoCm" | "altoCm",
      value: string,
    ) => {
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

  const commitPiezaMeasure = React.useCallback(
    (pieza: PiezaInput, field: "anchoCm" | "altoCm") => {
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
    },
    [],
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
    const codigosValidos = new Set(
      opcionalesRuta.map((opcional) => opcional.code),
    );
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
    const optionalCodes = new Set(
      opcionalesRuta.map((opcional) => opcional.code),
    );
    const materialKeys = new Set(
      slotsComercialElige.map((slot) =>
        materialSelectionKey(slot.configPasoId, slot.slotCodigo),
      ),
    );
    const machineKeys = new Set(
      pasosConTecnologias.map((paso) => paso.configPasoId),
    );
    const colorKeys = new Set(
      modosColorComercial.map((modo) => modo.configPasoId),
    );

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
        const selected = normalizeModoColor(
          seleccionModoColor[modo.configPasoId],
        );
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
    const requested = opts?.columns ?? (options.length <= 2 ? 2 : 3);
    // Nunca más columnas que opciones: 2 tecnologías no deben quedar en una
    // grilla de 3 (llena 2/3 y deja hueco a la derecha), y un único modo de
    // color ocupa el ancho entero en vez de media fila. Así cada grupo llena
    // la fila y los bordes derechos quedan alineados entre secciones.
    const columns = Math.max(1, Math.min(options.length, requested));
    const layout = opts?.layout ?? "row";
    // columns === 1 → sin clase numerada: la grilla base es una sola columna
    // a ancho completo (evita sumar un `ap-choice-grid-1` global).
    const colsClass = columns >= 2 ? `ap-choice-grid-${columns}` : "";
    return (
      <div
        className={`ap-choice-grid ${colsClass} ap-choice-${layout}`}
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
    medidas: Array<{
      id: string;
      nombre: string;
      anchoMm: number;
      altoMm: number;
      tipo?: MedidaPredefinidaProducto["tipo"];
    }>,
    onSelect: (id: string) => void,
    allowCustom: boolean,
  ) => (
    <div className="ap-size-grid" role="radiogroup" aria-label="Medida">
      {medidas.map((medida) => {
        const esPlancha = esMedidaPliegoUtil(medida);
        const resuelta = medida.anchoMm > 0 && medida.altoMm > 0;
        // Plancha sin resolver: falta máquina o papel en el paso de impresión.
        // Se muestra deshabilitada en vez de esconderse (que se sepa que existe).
        const size = resuelta
          ? formatMedidasCm(medida.anchoMm, medida.altoMm)
          : "se resuelve al elegir papel y máquina";
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
            disabled={esPlancha && !resuelta}
            title={
              esPlancha && resuelta
                ? "Área útil del pliego: se recalcula si cambia el papel o la máquina"
                : undefined
            }
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

  const renderMaterialSelect = (
    slot: SlotComercialElige,
    options?: {
      showHint?: boolean;
      collapseSingleCandidate?: boolean;
      sinTarjeta?: boolean;
    },
  ) => {
    const key = materialSelectionKey(slot.configPasoId, slot.slotCodigo);
    // Con dos pasos pidiendo el MISMO slot (revista: tapa e interior piden los
    // dos "sustrato principal"), el código de slot solo no alcanza: se antepone
    // el nombre del paso. Con uno solo se deja limpio.
    const etiquetaSlot =
      slotCodigosDuplicados.has(slot.slotCodigo) && slot.nombrePaso
        ? `${slot.nombrePaso} · ${humanizeCodigo(slot.slotCodigo)}`
        : humanizeCodigo(slot.slotCodigo);
    const selected =
      motorConfig.seleccionMaterial[key] || defaultSlotCandidateId(slot) || "";
    const selectedCandidate =
      slot.candidatos.find((candidate) =>
        candidate.variantes.some((variant) => variant.variantId === selected),
      ) ?? slot.candidatos.find((candidate) => candidate.defaultVarianteId);
    const selectedVariant = selectedCandidate?.variantes.find(
      (variant) => variant.variantId === selected,
    );
    // Cada material es UNA fila que expande sus variantes (Propuesta B): sin
    // <select> nativo ni tarjetas grandes. Se agrupa por candidato (si hay más
    // de uno) o por color (materiales con color+espesor); título = atributos
    // que distinguen la variante, spec = specs compartidas.
    const multiplesCandidatos = slot.candidatos.length > 1;
    const gruposVariante = new Map<string, VariantGrupoCompacto>();
    let totalOpciones = 0;
    for (const candidate of slot.candidatos) {
      const usaColorEspesor =
        candidate.variantes.length > 1 &&
        candidateUsesColorThickness(candidate);
      const cards = usaColorEspesor
        ? null
        : describeCandidateVariants(candidate);
      for (const variant of candidate.variantes) {
        const card = cards?.get(variant.variantId);
        const title = usaColorEspesor
          ? (variant.espesorLabel ?? variant.label)
          : (card?.title ?? variant.label);
        const spec =
          !usaColorEspesor && card && card.specs.length > 0
            ? card.specs.map((s) => s.value).join(" · ")
            : "";
        const groupLabel = usaColorEspesor
          ? variant.colorLabel || "Sin color"
          : multiplesCandidatos
            ? candidate.label
            : null;
        const gk = groupLabel ?? "__ungrouped";
        let grupo = gruposVariante.get(gk);
        if (!grupo) {
          grupo = { label: groupLabel, opciones: [] };
          gruposVariante.set(gk, grupo);
        }
        grupo.opciones.push({
          value: variant.variantId,
          title,
          spec,
          isDefault: variant.variantId === candidate.defaultVarianteId,
          missingPrice: variant.missingPrice === true,
        });
        totalOpciones += 1;
      }
    }
    const grupos = [...gruposVariante.values()];

    if (slot.candidatos.length === 0) {
      return (
        <div className={options?.sinTarjeta ? undefined : matS.group} key={key}>
          {options?.sinTarjeta ? (
            <span className={seC.sub}>{etiquetaSlot}</span>
          ) : (
            <div className={matS.gh}>{etiquetaSlot}</div>
          )}
          <div className={matS.empty}>Sin materiales candidatos</div>
        </div>
      );
    }

    const alerta = selectedVariant?.missingPrice
      ? "Sin precio cargado para la variante elegida"
      : null;
    const hint =
      !alerta && options?.showHint !== false && totalOpciones <= 1
        ? selectedVariant?.isFallbackLabel
          ? `Sin atributos descriptivos. Código interno: ${selectedVariant.sku}`
          : (selectedVariant?.description ?? null)
        : null;

    return (
      <MaterialSelectorCompacto
        key={key}
        etiquetaSlot={etiquetaSlot}
        grupos={grupos}
        selected={selected}
        onSelect={(variantId) => setMaterial(key, variantId)}
        alerta={alerta}
        hint={hint}
        sinTarjeta={options?.sinTarjeta}
      />
    );
  };

  const renderLinearMaterialWidthSelect = (slot: SlotComercialElige) => {
    const key = materialSelectionKey(slot.configPasoId, slot.slotCodigo);
    const selected =
      motorConfig.seleccionMaterial[key] || defaultSlotCandidateId(slot) || "";
    const selectedCandidate =
      slot.candidatos.find((candidate) =>
        candidate.variantes.some((variant) => variant.variantId === selected),
      ) ?? slot.candidatos.find((candidate) => candidate.defaultVarianteId);
    const selectedVariant = selectedCandidate?.variantes.find(
      (variant) => variant.variantId === selected,
    );
    const selectMaterial = (materiaPrimaId: string) => {
      const candidate = slot.candidatos.find(
        (item) => item.materiaPrimaId === materiaPrimaId,
      );
      const variantId =
        candidate?.defaultVarianteId ??
        (candidate?.variantes.length === 1
          ? candidate.variantes[0]?.variantId
          : undefined) ??
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
              <option
                key={candidate.materiaPrimaId}
                value={candidate.materiaPrimaId}
              >
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
                  variant.anchoLabel ?? variant.espesorLabel ?? variant.label,
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
          !config.tercerizado &&
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
  const setTiempoManualPaso = (
    configPasoId: string,
    rawValue: string,
    unidad: "min" | "h",
  ) => {
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

  const setParamComercial = (
    configPasoId: string,
    campo: string,
    valor: unknown,
  ) => {
    setMotorConfig((current) => ({
      ...current,
      paramsComercial: {
        ...current.paramsComercial,
        [configPasoId]: {
          ...(current.paramsComercial?.[configPasoId] ?? {}),
          [campo]: valor,
        },
      },
    }));
  };

  const renderParamComercialField = (
    paso: PasoConParamsComercial,
    campo: CampoEditableComercial,
    opciones: { soloEtiqueta?: boolean } = {},
  ) => {
    const elegido = motorConfig.paramsComercial?.[paso.configPasoId];
    const valor = valorEfectivoCampo(campo, elegido);
    const key = `param-${paso.configPasoId}-${campo.campo}`;
    // Dentro de la card del opcional el nombre del paso ya está en el título:
    // repetirlo en cada campo sería ruido.
    const label = opciones.soloEtiqueta
      ? campo.etiqueta
      : `${paso.nombre} · ${campo.etiqueta}`;

    if (campo.tipo === "multi-enum") {
      const seleccion = Array.isArray(valor) ? valor.map(String) : [];
      return (
        <div className="ap-spec ap-spec-wide" key={key}>
          <label>{label}</label>
          <div className="ap-chip-row">
            {campo.valoresPermitidos.map((opcion) => {
              const activo = seleccion.includes(opcion);
              return (
                <button
                  key={opcion}
                  type="button"
                  className={`ap-chip ${activo ? "on" : ""}`}
                  onClick={() =>
                    setParamComercial(
                      paso.configPasoId,
                      campo.campo,
                      campo.valoresPermitidos.filter((v) =>
                        v === opcion ? !activo : seleccion.includes(v),
                      ),
                    )
                  }
                >
                  {etiquetaValorParam(opcion)}
                </button>
              );
            })}
          </div>
          {seleccion.length === 0 ? (
            <div className="ap-minimum-alert is-blocked">
              <CircleAlertIcon />
              <span>
                Elegí al menos uno o la cotización no va a poder calcularse.
              </span>
            </div>
          ) : null}
        </div>
      );
    }

    if (campo.tipo === "number") {
      return (
        <div className="ap-spec" key={key}>
          <label>{label}</label>
          <input
            type="number"
            min={0}
            step={1}
            value={typeof valor === "number" ? valor : ""}
            placeholder="Sugerido"
            onChange={(event) =>
              setParamComercial(
                paso.configPasoId,
                campo.campo,
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
          />
        </div>
      );
    }

    if (campo.tipo === "boolean") {
      return (
        <div className="ap-spec ap-spec-wide" key={key}>
          <label className="ap-check">
            <input
              type="checkbox"
              checked={valor !== false}
              onChange={(event) =>
                setParamComercial(
                  paso.configPasoId,
                  campo.campo,
                  event.target.checked,
                )
              }
            />
            <span>{label}</span>
          </label>
        </div>
      );
    }

    return null;
  };

  // Planilla densa de params de pasos, agrupada por paso (el nombre del paso
  // encabeza el grupo y el label del campo se acorta). Reemplaza los inputs
  // full-width sueltos por una tabla compacta a lo ancho del sheet.
  const renderParamPlanilla = () => (
    <div className={plS.plan}>
      {pasosParamsComercialPrincipales.map((paso) => (
        <div className={plS.group} key={paso.configPasoId}>
          <div className={plS.gh}>{paso.nombre}</div>
          {paso.campos.map((campo) => {
            const elegido = motorConfig.paramsComercial?.[paso.configPasoId];
            const valor = valorEfectivoCampo(campo, elegido);
            const rowKey = `plan-${paso.configPasoId}-${campo.campo}`;

            if (campo.tipo === "number") {
              return (
                <div className={plS.prow} key={rowKey}>
                  <span className={plS.plabel}>{campo.etiqueta}</span>
                  <span className={plS.field}>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={typeof valor === "number" ? valor : ""}
                      placeholder="Sugerido"
                      onChange={(event) =>
                        setParamComercial(
                          paso.configPasoId,
                          campo.campo,
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                        )
                      }
                    />
                  </span>
                </div>
              );
            }

            if (campo.tipo === "boolean") {
              return (
                <label className={plS.prow} key={rowKey}>
                  <span className={plS.plabel}>{campo.etiqueta}</span>
                  <span className={plS.check}>
                    <input
                      type="checkbox"
                      checked={valor !== false}
                      onChange={(event) =>
                        setParamComercial(
                          paso.configPasoId,
                          campo.campo,
                          event.target.checked,
                        )
                      }
                    />
                  </span>
                </label>
              );
            }

            const seleccion = Array.isArray(valor) ? valor.map(String) : [];
            return (
              <div key={rowKey}>
                <div className={plS.prow}>
                  <span className={plS.plabel}>{campo.etiqueta}</span>
                  <span className={plS.chips}>
                    {campo.valoresPermitidos.map((opcion) => {
                      const activo = seleccion.includes(opcion);
                      return (
                        <button
                          key={opcion}
                          type="button"
                          className={`${plS.chip} ${activo ? plS.chipOn : ""}`}
                          onClick={() =>
                            setParamComercial(
                              paso.configPasoId,
                              campo.campo,
                              campo.valoresPermitidos.filter((v) =>
                                v === opcion ? !activo : seleccion.includes(v),
                              ),
                            )
                          }
                        >
                          {etiquetaValorParam(opcion)}
                        </button>
                      );
                    })}
                  </span>
                </div>
                {seleccion.length === 0 ? (
                  <div className={plS.alert}>
                    <CircleAlertIcon />
                    <span>
                      Elegí al menos uno o la cotización no va a poder
                      calcularse.
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  /**
   * `sinTarjeta`: dentro de la tarjeta de un opcional va con rótulo liviano
   * (la barra negra ya la usa el nombre del paso); suelto en la grilla de
   * specs va como un campo más de la grilla.
   */
  const renderTiempoManualField = (
    tiempoPaso: TiempoManualComercial,
    opts?: { sinTarjeta?: boolean },
  ) => {
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
    if (opts?.sinTarjeta) {
      // El nombre del paso ya está en la barra negra del opcional: repetirlo
      // acá ("DISEÑO GRÁFICO · TIEMPO ESTIMADO") es decirlo dos veces.
      const corto = tiempoPaso.etiqueta || "Tiempo estimado";
      return (
        <div key={`tiempo-${tiempoPaso.configPasoId}`}>
          <span className={seC.sub}>
            {corto} ({unidadLabel})
          </span>
          <div className="ap-spec">
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
        </div>
      );
    }
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
  /**
   * Nivel del paso: opciones excluyentes, como el modo de color — y con la
   * MISMA tarjeta de encabezado negro que el resto del sheet
   * (`cotizador-seccion.module.css`: "que TODO el sheet sea una pila de
   * tarjetas parejas"). Ver docs/cargos-por-paso-analisis-y-plan.md §8.
   */
  const renderNivelField = (
    item: NivelComercial,
    opts?: { sinTarjeta?: boolean },
  ) => {
    const nombrePaso =
      item.nombreVisible?.trim() || humanizeCodigo(item.familiaCodigo);
    const elegido = nivelEfectivo(
      item.config,
      motorConfig.seleccionNivel[item.configPasoId],
    );
    // El fallback vive acá y no en el lector: si el lector normalizara, el
    // editor no dejaría escribir un espacio (ver src/lib/niveles-paso.ts).
    const etiqueta = item.config.etiqueta.trim() || "¿Qué nivel?";
    const control = renderChoiceCards(
      etiqueta,
      elegido.codigo,
      item.config.opciones.map((opcion) => ({
        value: opcion.codigo,
        label: nombreNivel(opcion),
        desc:
          opcion.codigo === NIVEL_PERSONALIZADO
            ? "el tiempo lo cargás vos"
            : (describirNivel(opcion, item.base) ?? undefined),
      })),
      (codigo) =>
        setMotorConfig((current) => ({
          ...current,
          seleccionNivel: {
            ...current.seleccionNivel,
            [item.configPasoId]: codigo,
          },
        })),
    );
    if (opts?.sinTarjeta) {
      return (
        <div key={`nivel-${item.configPasoId}`}>
          <span className={seC.sub} title={nombrePaso}>
            {etiqueta}
          </span>
          {control}
        </div>
      );
    }
    return (
      <div className={seC.card} key={`nivel-${item.configPasoId}`}>
        <div className={seC.gh} title={nombrePaso}>
          {etiqueta}
        </div>
        <div className={seC.body}>{control}</div>
      </div>
    );
  };
  const renderComplejidadField = (
    item: ComplejidadCorteComercial,
    opts?: { sinTarjeta?: boolean },
  ) => {
    const nombrePaso =
      item.nombreVisible?.trim() || humanizeCodigo(item.familiaCodigo);
    const value =
      motorConfig.seleccionPerfil[item.configPasoId] || item.defaultId || "";
    const control = renderChoiceCards(
      "Complejidad del corte",
      value,
      item.opciones.map((opcion, indice) => ({
        value: opcion.perfilId,
        label: opcion.nombre,
        desc: opcion.perfilId === item.defaultId ? "por defecto" : undefined,
        glyph: complejidadCorteGlyph(indice, item.opciones.length),
      })),
      // Elegir el default = sin override (el motor resuelve solo); cualquier
      // otro nivel viaja como perfilSeleccionado_<paso>.
      (next) =>
        setPerfil(item.configPasoId, next === item.defaultId ? "" : next),
      { columns: item.opciones.length <= 2 ? 2 : 3, layout: "row" },
    );
    if (opts?.sinTarjeta) {
      return (
        <div key={`complejidad-${item.configPasoId}`}>
          <span className={seC.sub} title={nombrePaso}>
            Complejidad del corte
          </span>
          {control}
        </div>
      );
    }
    return (
      <div className={seC.card} key={`complejidad-${item.configPasoId}`}>
        <div className={seC.gh} title={nombrePaso}>
          {complejidadesPrincipales.length === 1
            ? "Complejidad del corte"
            : `${nombrePaso} · complejidad`}
        </div>
        <div className={seC.body}>{control}</div>
      </div>
    );
  };
  // El bloque de copias (tipo de copia + hojas por talonario) se muestra si el
  // producto es de subcategoría "talonarios" O si su ruta realmente usa
  // `tipoCopia` (algún talonario está en otra subcategoría, ej. papelería).
  const esTalonario =
    product.subcategoriaComercialCodigo === "talonarios" ||
    routeUsesTipoCopia(rutaSel, isExecutableConfigPaso);
  const imposicionCaballete = getImposicionCaballeteDeRuta(
    rutaSel,
    isExecutableConfigPaso,
  );
  const profundidadCartel = getProfundidadDeRuta(
    rutaSel,
    isExecutableConfigPaso,
  );
  // Con una sola pieza, la profundidad se muestra INLINE como tercer input
  // junto a Ancho × Alto (deja de ser un campo colgado). Con varias piezas cae
  // al bloque aparte (es product-level, no per-pieza).
  const profundidadInline =
    Boolean(profundidadCartel) && motorConfig.piezas.length === 1;
  // Configurador 3D de cartelería (herramienta estilo sello): edita EN VIVO el
  // motorConfig (medidas, profundidad, params comerciales de los dos pasos) y
  // el precio se re-cotiza solo con el debounce del sheet.
  // §17 derivadores (2026-08-05): A UN COSTADO — el cartel se cotiza por el
  // flujo genérico (medidas + profundidad + opcionales + materiales + params
  // expuestos). Reactivar cuando vuelva como capa de visualización.
  const carteleriaInfo = CONFIGURADOR_3D_CARTELERIA_ACTIVO
    ? getCarteleriaDeRuta(rutaSel, isExecutableConfigPaso)
    : null;
  const carteleriaValor: CarteleriaValor | null = React.useMemo(() => {
    if (!carteleriaInfo) return null;
    const overrides = asRecord(
      motorConfig.paramsComercial?.[carteleriaInfo.estructuraConfigPasoId],
    );
    const overridesLed = carteleriaInfo.ledConfigPasoId
      ? asRecord(motorConfig.paramsComercial?.[carteleriaInfo.ledConfigPasoId])
      : {};
    const base = carteleriaInfo.paramsEstructura;
    const num = (v: unknown, def: number) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : def;
    };
    const pieza = motorConfig.piezas[0];
    return {
      anchoCm: num(pieza?.anchoMm, 2400) / 10,
      altoCm: num(pieza?.altoMm, 1200) / 10,
      profundidadCm:
        motorConfig.profundidadCm ??
        (num(base.profundidadMm, 0) / 10 ||
          (profundidadCartel?.profundidadDefaultMm ?? 180) / 10),
      sepRefuerzoVcm: num(overrides.sepRefuerzoVcm ?? base.sepRefuerzoVcm, 100),
      sepRefuerzoHcm: num(overrides.sepRefuerzoHcm ?? base.sepRefuerzoHcm, 0),
      // §15: los toggles activan PASOS OPCIONALES de la ruta real.
      cenefa: carteleriaInfo.cenefaConfigPasoId
        ? Boolean(
            motorConfig.opcionalesActivados[carteleriaInfo.cenefaConfigPasoId],
          )
        : false,
      solapaCenefaCm: num(overrides.solapaCenefaCm ?? base.solapaCenefaCm, 2),
      pintura: carteleriaInfo.pinturaConfigPasoId
        ? Boolean(
            motorConfig.opcionalesActivados[carteleriaInfo.pinturaConfigPasoId],
          )
        : false,
      fondo: carteleriaInfo.fondoConfigPasoId
        ? Boolean(
            motorConfig.opcionalesActivados[carteleriaInfo.fondoConfigPasoId],
          )
        : false,
      dobleFaz:
        carteleriaInfo.impresionConfigPasoId != null &&
        motorConfig.carasPorPaso?.[carteleriaInfo.impresionConfigPasoId] === 2,
      densidad: num(
        overridesLed.densidad ?? carteleriaInfo.paramsLed.densidad,
        1,
      ),
    };
  }, [carteleriaInfo, motorConfig, profundidadCartel]);
  const aplicarCarteleria = React.useCallback(
    (valor: CarteleriaValor) => {
      if (!carteleriaInfo) return;
      setMotorConfig((prev) => {
        const piezas = prev.piezas.length
          ? prev.piezas.map((p, i) =>
              i === 0
                ? {
                    ...p,
                    anchoMm: valor.anchoCm * 10,
                    altoMm: valor.altoCm * 10,
                  }
                : p,
            )
          : [{ anchoMm: valor.anchoCm * 10, altoMm: valor.altoCm * 10 }];
        const paramsComercial = { ...(prev.paramsComercial ?? {}) };
        paramsComercial[carteleriaInfo.estructuraConfigPasoId] = {
          ...asRecord(paramsComercial[carteleriaInfo.estructuraConfigPasoId]),
          sepRefuerzoVcm: valor.sepRefuerzoVcm,
          sepRefuerzoHcm: valor.sepRefuerzoHcm,
          solapaCenefaCm: valor.solapaCenefaCm,
        };
        // Toggles → activación de los pasos opcionales de la ruta real (§15).
        const opcionalesActivados = { ...prev.opcionalesActivados };
        const setOpcional = (id: string | null, on: boolean) => {
          if (!id) return;
          if (on) opcionalesActivados[id] = true;
          else delete opcionalesActivados[id];
        };
        setOpcional(carteleriaInfo.cenefaConfigPasoId, valor.cenefa);
        setOpcional(carteleriaInfo.pinturaConfigPasoId, valor.pintura);
        setOpcional(carteleriaInfo.fondoConfigPasoId, valor.fondo);
        if (carteleriaInfo.ledConfigPasoId) {
          paramsComercial[carteleriaInfo.ledConfigPasoId] = {
            ...asRecord(paramsComercial[carteleriaInfo.ledConfigPasoId]),
            densidad: valor.densidad,
          };
        }
        const carasPorPaso = { ...prev.carasPorPaso };
        if (carteleriaInfo.impresionConfigPasoId) {
          if (valor.dobleFaz) {
            carasPorPaso[carteleriaInfo.impresionConfigPasoId] = 2;
          } else {
            delete carasPorPaso[carteleriaInfo.impresionConfigPasoId];
          }
        }
        return {
          ...prev,
          piezas: piezas as typeof prev.piezas,
          profundidadCm: valor.profundidadCm,
          paramsComercial,
          opcionalesActivados,
          carasPorPaso,
        };
      });
    },
    [carteleriaInfo, setMotorConfig],
  );
  const metroLinealConMedidasVariables =
    isMetroLinealConMedidasVariables(productoDetalle);
  const mostrarEditorPiezas = usaPiezasParaCotizar(
    productoDetalle,
    motorConfig,
  );
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
    (slot) =>
      !slotKeysLinealDirecto.has(
        materialSelectionKey(slot.configPasoId, slot.slotCodigo),
      ),
  );
  const hasQuantityShortcuts = !["m²", "m2", "ml"].includes(
    product.unidad.toLowerCase(),
  );
  // Un producto tercerizado con matriz define su cantidad por el eje `cantidad`:
  // esas cantidades manejan el campo de cantidad del ítem (botones fijos), igual
  // que un producto con precios por cantidad exacta. Así hay un solo campo.
  const tercerizadoCantidades = getTercerizadoCantidades(
    rutaSel?.configPasos ?? [],
  );
  const pricingQuantities =
    tercerizadoCantidades.length > 0
      ? tercerizadoCantidades
      : getExactPricingQuantities(product);
  const usesExactPricingQuantities = pricingQuantities.length > 0;
  const quantityShortcuts = usesExactPricingQuantities
    ? pricingQuantities
    : hasQuantityShortcuts
      ? [100, 200, 300, 400]
      : [];
  const isAllowedQuantity =
    !usesExactPricingQuantities || pricingQuantities.includes(qty);
  const minimoComercialStatus = getMinimumCommercialStatus(
    product,
    productoDetalle,
    motorConfig,
    qty,
    cotizacionExitosa,
  );
  // "¿Cuántos entran por plancha?" — la pregunta del mostrador, respondida
  // con la imposición que la cotización ya calculó (cero cálculo nuevo). Sólo
  // cuando entran varias por pliego; con la medida "Plancha completa" elegida
  // el dato es trivial (entra 1) y no se muestra. Si el producto tiene una
  // plancha con nombre propio, la frase usa ese nombre.
  const entranPorPliego = React.useMemo(() => {
    if (!cotizacionExitosa) return null;
    const medidaSel =
      usaMedidaMixta && motorConfig.piezas.length > 0
        ? null
        : getSelectedPredefinedMeasure(
            productoDetalle,
            motorConfig.medidaPredefinidaId,
            medidasPredefinidas,
          );
    if (medidaSel && esMedidaPliegoUtil(medidaSel)) return null;
    const paso = cotizacionExitosa.pasos.find(
      (item) => item.familiaCodigo === "impresion_por_hoja" && item.activado,
    );
    const imposicion = getRecord(
      getRecord(paso?.outputsCanonicos).imposicion_calculada,
    );
    const porPliego = getNumberFromUnknown(imposicion.piezasPorPliego) ?? 0;
    const pliegos = getNumberFromUnknown(imposicion.pliegosNecesarios) ?? 0;
    if (porPliego < 2 || pliegos <= 0) return null;
    const plancha = medidasPredefinidas.find((medida) =>
      esMedidaPliegoUtil(medida),
    );
    // El nombre de la plancha va tal cual lo escribió la empresa ("Plancha
    // SRA3"): bajarlo a minúsculas rompería siglas como SRA3.
    const nombrePlancha = plancha ? medidaLabel(plancha) : "pliego";
    return `Entran ${porPliego} por ${nombrePlancha} · este pedido usa ${pliegos}`;
  }, [
    cotizacionExitosa,
    medidasPredefinidas,
    motorConfig.medidaPredefinidaId,
    motorConfig.piezas.length,
    productoDetalle,
    usaMedidaMixta,
  ]);
  // Transparencia del rollo (DTF/vinilo por metro): el comercial cotiza sobre
  // un ancho útil fijo (anchoUtil de la máquina − márgenes) que hoy no ve.
  // Gemelo del "Entran N por plancha", pero para rollo: ancho útil, consumo en
  // ml y cuántas piezas entran a lo ancho. Cero cálculo nuevo — todo sale de
  // getSelectedLinearMaterialMetrics y de la cotización viva.
  const infoRolloLineal = React.useMemo(() => {
    if (!metroLinealConMedidasVariables) return null;
    const metrics = getSelectedLinearMaterialMetrics(
      productoDetalle,
      slotsComercialElige,
      motorConfig,
      includeVisibleConfig,
    );
    const anchoUtilCm =
      metrics?.usableWidthMm && metrics.usableWidthMm > 0
        ? metrics.usableWidthMm / 10
        : null;
    const paso = cotizacionExitosa?.pasos.find(
      (item) => item.familiaCodigo === "impresion_por_area" && item.activado,
    );
    const nd = paso?.nestingResult;
    const consumoMm = getNumberFromUnknown(nd?.consumedLengthMm);
    const consumoMl = consumoMm && consumoMm > 0 ? consumoMm / 1000 : null;
    // "Entran a lo ancho" = la franja horizontal más poblada del layout
    // (agrupa placements por su Y). Robusto a maxrects, que no arma grilla.
    const placements = Array.isArray(nd?.placements) ? nd.placements : [];
    let entranAncho = 0;
    if (placements.length > 0) {
      const porFila = new Map<number, number>();
      for (const p of placements) {
        const fila = Math.round(getNumberFromUnknown(p.yMm) ?? 0);
        porFila.set(fila, (porFila.get(fila) ?? 0) + 1);
      }
      entranAncho = Math.max(...porFila.values());
    }
    return { anchoUtilCm, consumoMl, entranAncho };
  }, [
    cotizacionExitosa,
    includeVisibleConfig,
    metroLinealConMedidasVariables,
    motorConfig,
    productoDetalle,
    slotsComercialElige,
  ]);

  const renderCantidadCard = () => (
    <div className={seC.card}>
      <div className={seC.gh}>Cantidad</div>
      <div className={seC.body}>{renderQuantityControl()}</div>
    </div>
  );

  const renderQuantityControl = () => {
    if (usesExactPricingQuantities) {
      return (
        <div className="ap-qty-line">
          <div
            className="ap-qty-shortcuts ap-qty-options ap-qty-options-equal"
            aria-label="Cantidades permitidas"
            style={
              {
                "--ap-qty-count": pricingQuantities.length,
              } as React.CSSProperties
            }
          >
            {pricingQuantities.map((value) => (
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
          <button
            type="button"
            className="ap-qty-btn"
            onClick={() => setQty(qty + 1)}
          >
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

  const renderPiezasEditor = (options?: {
    hideCantidad?: boolean;
    /** Título de la card. En medida MIXTA la card de arriba ya se llama
     *  "Medida" (la elección): este editor pasa a llamarse "A medida" para
     *  no repetir el mismo título dos veces (feedback del usuario). */
    titulo?: string;
  }) => {
    const mostrarProf = profundidadInline;
    // Override del grid (sin tocar globals ni sumar clases): suma "× [prof]".
    const gridConProf = options?.hideCantidad
      ? "minmax(80px, 1fr) auto minmax(80px, 1fr) auto minmax(80px, 1fr) 38px"
      : "minmax(60px, 0.8fr) auto minmax(80px, 1fr) auto minmax(80px, 1fr) auto minmax(80px, 1fr) 38px";
    const estiloGrid = mostrarProf
      ? { gridTemplateColumns: gridConProf }
      : undefined;
    const inputProf = mostrarProf ? (
      <>
        <span>x</span>
        <label className="ap-input-unit">
          <input
            type="text"
            inputMode="decimal"
            value={motorConfig.profundidadCm ?? ""}
            placeholder={
              profundidadCartel?.profundidadDefaultMm
                ? String(profundidadCartel.profundidadDefaultMm / 10)
                : "Prof."
            }
            onChange={(event) => {
              const value = Number(event.target.value);
              updateMotorConfig({
                profundidadCm:
                  Number.isFinite(value) && value > 0 ? value : null,
              });
            }}
            aria-label="Profundidad del cajón en cm"
          />
          <span>cm</span>
        </label>
      </>
    ) : null;
    return (
    <div className={seC.card}>
      <div className={seC.gh}>{options?.titulo ?? "Medida"}</div>
      <div className={seC.body}>
      <div className="ap-piezas">
        <div
          className={`ap-pieza-head${options?.hideCantidad ? " ap-pieza-head-medidas" : ""}`}
          style={estiloGrid}
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
          {mostrarProf ? (
            <>
              <span>Prof.</span>
              <span />
            </>
          ) : null}
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
            style={estiloGrid}
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
                            updatePieza(index, {
                              cantidad: Number(event.target.value) || 0,
                            })
                  }
                  aria-label="Cantidad de piezas"
                />
                <span>x</span>
              </>
            )}
            <label className="ap-input-unit">
              <input
                ref={(node) => {
                          if (options?.hideCantidad)
                            piezaFocusRefs.current[pieza.uiKey] = node;
                }}
                type="text"
                inputMode="decimal"
                value={getPiezaMeasureValue(pieza, "anchoCm")}
                onChange={(event) =>
                          updatePiezaMeasure(
                            index,
                            pieza,
                            "anchoCm",
                            event.target.value,
                          )
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
                          updatePiezaMeasure(
                            index,
                            pieza,
                            "altoCm",
                            event.target.value,
                          )
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
            {index === 0 ? inputProf : null}
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
                          · leída{" "}
                          {formatCmFromMm(pieza.origen.anchoDetectadoMm)} ×{" "}
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
                  if (
                    (event.key === "Enter" || event.key === " ") &&
                    !leyendoPlanos
                  ) {
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
                    if (event.target.files)
                      handleAdjuntarPlanos(event.target.files);
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
                    Arrastrá los PDF acá o hacé clic. Cada página se agrega como
                    una fila con su medida.
              </span>
            </div>
          </div>
        ) : null}
        <button type="button" className="adi-add" onClick={addPieza}>
          <PlusIcon />
          Agregar pieza
        </button>
      </div>
      {mostrarProf ? (
        <span className="ap-section-hint">
              La profundidad define los metros de perfil, la cenefa y los
              conectores del bastidor.
        </span>
      ) : null}
      </div>
    </div>
    );
  };

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

  // ── SHEET DE CARTELERÍA (§12 del doc) ──────────────────────────────
  // Un producto de cartelería NO usa el cuerpo genérico (medidas duplicadas,
  // opcionales vacíos, materiales sueltos): el configurador 3D ES el sheet.
  // Medidas, cantidad, tecnología, lona, caño, chapas, LED, anclajes y notas
  // viven adentro; el pie del sheet (precio + Agregar a la OT) sigue siendo
  // el del padre.
  if (carteleriaInfo && carteleriaValor) {
    const tecnoPaso = pasosConTecnologias.find(
      (paso) => paso.configPasoId === carteleriaInfo.impresionConfigPasoId,
    );
    const tecnologias: CarteleriaTecnologia[] = (tecnoPaso?.tecnologias ?? [])
      .filter((tech) => tech.candidatas.length > 0)
      .map((tech) => ({
        value: tech.value,
        label: tech.label,
        maquinaId: tech.candidatas[0].maquinaId,
        maquinaIds: tech.candidatas.map((candidate) => candidate.maquinaId),
      }));
    return (
      <>
        <ProductoSheetHeaderConstelacion
          name={product.name}
          desc="Configurador de cartelería · el precio lo cotiza el motor en vivo"
          eyebrow={`${product.family} · ${product.cobro}`}
          onBack={onBack}
          onClose={onClose}
          sticky
        />
        <div className={cartS.sheetHost}>
          <CarteleriaConfigurador
            tipoCartel={carteleriaInfo.tipoCartel}
            valor={carteleriaValor}
            onChange={aplicarCarteleria}
            slots={slotsComercialElige.filter((slot) =>
              [
                carteleriaInfo.estructuraConfigPasoId,
                carteleriaInfo.ledConfigPasoId,
                carteleriaInfo.impresionConfigPasoId,
                carteleriaInfo.pinturaConfigPasoId,
                carteleriaInfo.fondoConfigPasoId,
                carteleriaInfo.cenefaConfigPasoId,
              ].includes(slot.configPasoId),
            )}
            getMaterial={(configPasoId, slotCodigo) =>
              motorConfig.seleccionMaterial[
                materialSelectionKey(configPasoId, slotCodigo)
              ] ?? ""
            }
            setMaterial={(configPasoId, slotCodigo, variantId) =>
              setMaterial(
                materialSelectionKey(configPasoId, slotCodigo),
                variantId,
              )
            }
            estructuraConfigPasoId={carteleriaInfo.estructuraConfigPasoId}
            ledConfigPasoId={carteleriaInfo.ledConfigPasoId}
            impresionConfigPasoId={carteleriaInfo.impresionConfigPasoId}
            pinturaConfigPasoId={carteleriaInfo.pinturaConfigPasoId}
            fondoConfigPasoId={carteleriaInfo.fondoConfigPasoId}
            cenefaConfigPasoId={carteleriaInfo.cenefaConfigPasoId}
            tecnologias={tecnologias}
            maquinaSeleccionadaId={
              carteleriaInfo.impresionConfigPasoId
                ? (motorConfig.seleccionMaquina[
                    carteleriaInfo.impresionConfigPasoId
                  ] ?? "")
                : ""
            }
            onSelectTecnologia={(tec) => {
              if (!carteleriaInfo.impresionConfigPasoId) return;
              setMotorConfig((current) => ({
                ...current,
                seleccionMaquina: {
                  ...current.seleccionMaquina,
                  [carteleriaInfo.impresionConfigPasoId as string]:
                    tec.maquinaId,
                },
              }));
            }}
            coberturaLedM2={0.0625}
            cotizacion={cotizacion}
            cotizando={cotizando}
            qty={qty}
            setQty={setQty}
            notaProduccion={notaProduccion}
            setNotaProduccion={setNotaProduccion}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <ProductoSheetHeaderConstelacion
        name={product.name}
        desc={product.descripcion}
        eyebrow={`${product.family} · ${product.cobro}`}
        onBack={onBack}
        onClose={onClose}
        sticky
      />

      <div className="ap-config-section">
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
                      seleccionNivel: {},
                    })),
                )}
              </div>
            ) : null}

            {rutaSel ? (
              <CotizadorTercerizadoSelectors
                configPasos={rutaSel.configPasos}
                seleccion={motorConfig.seleccionTercerizado}
                renderSegmented={renderSegmentedControl}
                onChange={(configPasoId, ejeClave, valorClave) => {
                  setMotorConfig((current) => ({
                    ...current,
                    seleccionTercerizado: {
                      ...current.seleccionTercerizado,
                      [configPasoId]: {
                        ...(current.seleccionTercerizado[configPasoId] ?? {}),
                        [ejeClave]: valorClave,
                      },
                    },
                  }));
                }}
              />
            ) : null}

            {metroLinealConMedidasVariables ? (
              <>
                <div className={seC.card}>
                  <div className={seC.gh}>Modo de cotización</div>
                  <div className={seC.body}>
                    {renderSegmentedControl(
                      "Modo de cotización lineal",
                      motorConfig.modoCotizacionLineal,
                      [
                        { value: "directo", label: "Ingresar ml" },
                        { value: "nesting", label: "Calcular por piezas" },
                      ],
                      (value) =>
                        setModoCotizacionLineal(value as ModoCotizacionLineal),
                    )}
                  </div>
                </div>
                {mostrarEditorPiezas ? (
                  <>
                    {renderPiezasEditor()}
                    {infoRolloLineal?.consumoMl ? (
                      <div className="ap-minimum-alert">
                        <Grid2X2Icon />
                        <span>
                          Consume{" "}
                          {infoRolloLineal.consumoMl.toLocaleString("es-AR", {
                            maximumFractionDigits: 2,
                          })}{" "}
                          ml de rollo
                          {infoRolloLineal.entranAncho >= 2
                            ? ` · entran ${infoRolloLineal.entranAncho} a lo ancho`
                            : ""}
                          {infoRolloLineal.anchoUtilCm
                            ? ` · ${infoRolloLineal.anchoUtilCm.toLocaleString(
                                "es-AR",
                                {
                                  maximumFractionDigits: 1,
                                },
                              )} cm útil`
                            : ""}
                        </span>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    {slotsMaterialesLinealDirecto.map((slot) =>
                      renderLinearMaterialWidthSelect(slot),
                    )}
                    <div className="ap-spec ap-spec-wide">
                      <label>Largo a cotizar</label>
                      {renderQuantityControl()}
                    </div>
                    {infoRolloLineal?.anchoUtilCm ? (
                      <div className="ap-minimum-alert">
                        <Grid2X2Icon />
                        <span>
                          Rollo de{" "}
                          {infoRolloLineal.anchoUtilCm.toLocaleString("es-AR", {
                            maximumFractionDigits: 1,
                          })}{" "}
                          cm útil
                        </span>
                      </div>
                    ) : null}
                  </>
                )}
              </>
            ) : usaMedidaPersonalizada && !usaMedidaMixta ? (
              <>
                {renderPiezasEditor({
                  hideCantidad: piezasUsanCantidadComercial,
                })}
                {piezasUsanCantidadComercial ? renderCantidadCard() : null}
              </>
            ) : (
              <>
                {usaMedidaMixta || medidasPredefinidas.length > 1 ? (
                  <div className={seC.card}>
                    <div className={seC.gh}>Medida</div>
                    <div className={seC.body}>
                    {renderMedidaCards(
                      usaMedidaMixta && motorConfig.piezas.length > 0
                        ? CUSTOM_MEASURE_ID
                          : (getSelectedPredefinedMeasure(
                            productoDetalle,
                            motorConfig.medidaPredefinidaId,
                            medidasPredefinidas,
                            )?.id ?? ""),
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
                          updateMotorConfig({
                            medidaPredefinidaId: value,
                            piezas: [],
                          });
                      },
                      usaMedidaMixta,
                    )}
                    </div>
                  </div>
                ) : null}
              {usaMedidaMixta && motorConfig.piezas.length > 0
                ? renderPiezasEditor({
                    hideCantidad: piezasUsanCantidadComercial,
                    titulo: "A medida",
                  })
                : null}
              {renderCantidadCard()}
              {entranPorPliego ? (
                // Sin modificador is-warning/is-blocked: banda neutra
                // informativa, misma anatomía que el aviso del mínimo.
                <div className="ap-minimum-alert">
                  <Grid2X2Icon />
                  <span>{entranPorPliego}</span>
                </div>
              ) : null}
              {minimoComercialStatus ? (
                <div
                  className={`ap-minimum-alert ${
                      minimoComercialStatus.kind === "blocked"
                        ? "is-blocked"
                        : "is-warning"
                  }`}
                >
                  <CircleAlertIcon />
                  <span>{minimoComercialStatus.message}</span>
                </div>
              ) : null}
              </>
            )}

            {/* Costo del proveedor (fuente `manual`): después de la Medida —
                el comercial primero define QUÉ cotiza y recién ahí carga lo
                que el proveedor le pasó. */}
            {rutaSel ? (
              <CotizadorTercerizadoCostoManual
                configPasos={rutaSel.configPasos}
                valores={motorConfig.tercerizadoCostoManual}
                simboloMoneda={moneda.simbolo}
                nombreDe={(cp) =>
                  cp.nombreVisible?.trim() ||
                  cp.rutaPaso.familiaNombre ||
                  humanizeCodigo(cp.rutaPaso.familiaCodigo)
                }
                onChange={(configPasoId, valor) =>
                  setMotorConfig((current) => ({
                    ...current,
                    tercerizadoCostoManual: {
                      ...current.tercerizadoCostoManual,
                      [configPasoId]: valor,
                    },
                  }))
                }
              />
            ) : null}

            {usaCaras ? (
              <div className={seC.card}>
                <div className={seC.gh}>Caras</div>
                <div className={seC.body}>
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
                    (value) =>
                      updateMotorConfig({ caras: Number(value) as 1 | 2 }),
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
              </div>
            ) : null}

            {personalizaciones.length > 0 ? (
              <div className="ap-spec ap-spec-wide">
                <div className="ap-pers-sechead">
                  <label>Personalización</label>
                  <span className="ap-pers-counter">
                    <b>
                      {
                        personalizaciones.filter(
                          (p) =>
                            personalizacionEstadoEfectivo(p, motorConfig)
                              .activa,
                        ).length
                      }
                    </b>{" "}
                    de {personalizaciones.length} incluidas
                  </span>
                </div>
                <div className="ap-personalizaciones">
                  {personalizaciones.map((p) => {
                    const estado = personalizacionEstadoEfectivo(
                      p,
                      motorConfig,
                    );
                    const esCliente = p.modoMedida === "CLIENTE";
                    const toggle = p.obligatoria
                      ? undefined
                      : () =>
                          updatePersonalizacion(p, { activa: !estado.activa });
                    return (
                      <div
                        key={p.id}
                        className={`ap-pers-item${estado.activa ? " on" : ""}`}
                      >
                        <div
                          className="ap-pers-head"
                          onClick={toggle}
                          data-toggleable={toggle ? "true" : undefined}
                        >
                          <span className="ap-pers-ico" aria-hidden="true">
                            <StampIcon />
                          </span>
                          <div className="ap-pers-txt">
                            <div className="ap-pers-nombre">
                              {p.nombre}
                              {!esCliente ? (
                                <span className="ap-pers-badge">
                                  Medida fija
                                </span>
                              ) : null}
                            </div>
                            <div className="ap-pers-meta">
                              {estado.activa ? (
                                <>
                                  Medida{" "}
                                  <span className="measured">
                                    {formatCmFromMm(estado.anchoMm)} ×{" "}
                                    {formatCmFromMm(estado.altoMm)} cm
                                  </span>
                                </>
                              ) : (
                                "No incluida en esta orden"
                              )}
                            </div>
                          </div>
                          <div className="ap-pers-toggle">
                            <span className="state-lbl">
                              {p.obligatoria ? "Incluida" : "Incluir"}
                            </span>
                            {!p.obligatoria ? (
                              <button
                                type="button"
                                className="ap-pers-switch"
                                role="switch"
                                aria-checked={estado.activa}
                                aria-label={`Incluir ${p.nombre}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggle?.();
                                }}
                              />
                            ) : null}
                          </div>
                        </div>
                        {esCliente ? (
                          <div
                            className="ap-pers-body-wrap"
                            aria-hidden={!estado.activa}
                          >
                            <div className="ap-pers-body-inner">
                              <div className="ap-pers-body">
                                <div className="cap">Medida de la estampa</div>
                                <div className="ap-pers-measure-row">
                                  <label className="ap-pers-dim">
                                    <span className="dim-cap">Ancho</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.1"
                                      tabIndex={estado.activa ? undefined : -1}
                                      value={
                                        estado.anchoMm
                                          ? estado.anchoMm / 10
                                          : ""
                                      }
                                      onChange={(event) =>
                                        updatePersonalizacion(p, {
                                          anchoMm:
                                            (Number(event.target.value) || 0) *
                                            10,
                                        })
                                      }
                                      aria-label="Ancho de la personalización en cm"
                                    />
                                    <span className="unit">cm</span>
                                  </label>
                                  <span className="x">×</span>
                                  <label className="ap-pers-dim">
                                    <span className="dim-cap">Alto</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.1"
                                      tabIndex={estado.activa ? undefined : -1}
                                      value={
                                        estado.altoMm ? estado.altoMm / 10 : ""
                                      }
                                      onChange={(event) =>
                                        updatePersonalizacion(p, {
                                          altoMm:
                                            (Number(event.target.value) || 0) *
                                            10,
                                        })
                                      }
                                      aria-label="Alto de la personalización en cm"
                                    />
                                    <span className="unit">cm</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
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

            {imposicionCaballete ? (
              <div className="ap-spec">
                <label>Páginas del documento</label>
                <input
                  type="number"
                  min="4"
                  step="4"
                  placeholder={String(imposicionCaballete.paginasDefault ?? 16)}
                  value={motorConfig.paginas ?? ""}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    updateMotorConfig({
                      paginas:
                        Number.isFinite(value) && value > 0 ? value : null,
                    });
                  }}
                />
                {motorConfig.paginas && motorConfig.paginas % 4 !== 0 ? (
                  <span className="ap-section-hint">
                    Se completa a {Math.ceil(motorConfig.paginas / 4) * 4}{" "}
                    páginas con blancas al final (el caballete arma de a 4).
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* Cartelería (patrón `paginas`): la ruta tiene un bastidor doble
                sin profundidad fija — el comercial la carga acá. En cm (el
                motor la recibe en mm). Volvió al flujo genérico cuando el
                configurador 3D quedó a un costado (§17 derivadores). */}
            {profundidadCartel && !profundidadInline ? (
              <div className="ap-spec">
                <label>Profundidad del cajón</label>
                <input
                  type="number"
                  min="1"
                  placeholder={
                    profundidadCartel.profundidadDefaultMm
                      ? String(profundidadCartel.profundidadDefaultMm / 10)
                      : "18"
                  }
                  value={motorConfig.profundidadCm ?? ""}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    updateMotorConfig({
                      profundidadCm:
                        Number.isFinite(value) && value > 0 ? value : null,
                    });
                  }}
                />
                <span className="ap-section-hint">
                  En cm. Define los metros de perfil, la cenefa y los conectores
                  del bastidor.
                </span>
              </div>
            ) : null}

            {pasosConTecnologias.map((paso) => {
              const allCandidates = paso.tecnologias.flatMap(
                (tech) => tech.candidatas,
              );
              const selectedId =
                motorConfig.seleccionMaquina[paso.configPasoId] || "";
              const selectedCandidate =
                allCandidates.find(
                  (candidate) => candidate.maquinaId === selectedId,
                ) ?? null;
              const selectedTechnologyValue = selectedCandidate
                ? getCandidateTechnology(selectedCandidate)
                : "";
              const selectedTechnology =
                paso.tecnologias.find(
                  (tech) => tech.value === selectedTechnologyValue,
                ) ?? null;
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
                const tech = paso.tecnologias.find(
                  (item) => item.value === technologyValue,
                );
                const candidate = tech
                  ? getPreferredCandidate(tech.candidatas)
                  : null;
                if (candidate)
                  setMaquina(paso.configPasoId, candidate.maquinaId);
              };
              const labelPaso =
                paso.nombreVisible?.trim() ||
                humanizeCodigo(paso.familiaCodigo);
              return (
                <div className={seC.card} key={paso.configPasoId}>
                  <div className={seC.gh}>
                    {mostrarTecnologia
                      ? pasosConTecnologias.length === 1
                        ? "Tecnología de impresión"
                        : `${labelPaso} · tecnología`
                      : pasosConTecnologias.length === 1
                        ? "Máquina"
                        : `${labelPaso} · máquina`}
                  </div>
                  <div className={seC.body}>
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
                        onChange={(event) =>
                          setMaquina(paso.configPasoId, event.target.value)
                        }
                      >
                        {selectedTechnology.candidatas.map((candidata) => (
                          <option
                            key={candidata.maquinaId}
                            value={candidata.maquinaId}
                          >
                            {candidata.maquina.nombre}
                            {candidata.esPreferida ? " · preferida" : ""}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {modosColorVisibles.map((modo) => {
              const value =
                resolveModoColorSeleccionado(
                  modo,
                  motorConfig.seleccionModoColor[modo.configPasoId],
                ) ?? "";
              // Si los modos vienen de máquinas distintas, la card muestra la
              // máquina asociada y elegir el modo también activa esa máquina.
              const maquinasEnOpciones = new Set(
                modo.options
                  .map((option) => option.maquinaId)
                  .filter((id): id is string => Boolean(id)),
              );
              const multiMaquina = maquinasEnOpciones.size > 1;
              const modoOptions = modo.options.map((option) => {
                const optionValue =
                  normalizeModoColor(option.value) ?? option.value;
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
                    (normalizeModoColor(option.value) ?? option.value) ===
                    nextValue,
                );
                if (opcion?.maquinaId) {
                  setMaquina(modo.configPasoId, opcion.maquinaId);
                }
                setModoColor(modo.configPasoId, nextValue);
              };
              return (
                <div className={seC.card} key={modo.configPasoId}>
                  <div className={seC.gh}>
                    {modosColorVisibles.length === 1
                      ? "Modo de color"
                      : `${modo.nombreVisible?.trim() || humanizeCodigo(modo.familiaCodigo)} · color`}
                  </div>
                  <div className={seC.body}>
                  {renderChoiceCards(
                    "Modo de color",
                    value,
                    modoOptions,
                    seleccionarModo,
                      {
                        columns: modoOptions.length <= 2 ? 2 : 3,
                        layout: "row",
                      },
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
                            <option value="">Automático (recomendado)</option>
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
                </div>
              );
            })}

            {complejidadesPrincipales.map((item) =>
              renderComplejidadField(item),
            )}

            {nivelesPrincipales.map((item) => renderNivelField(item))}

            {tiemposManualesPrincipales.map((tiempoPaso) =>
              renderTiempoManualField(tiempoPaso),
            )}

            {pasosParamsComercialPrincipales.length > 0
              ? renderParamPlanilla()
              : null}

            {slotsMaterialesGenerales.length > 0 ? (
              <div className={matS.list}>
                {slotsMaterialesGenerales.map((slot) =>
                  renderMaterialSelect(slot),
                )}
              </div>
            ) : null}

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
                {!cargoInputKeys.has("zonaInstalacion") ? (
                  <div className="ap-spec">
                    <label>Zona de instalación</label>
                    <select
                      className="ap-native-select"
                      value={motorConfig.zonaInstalacion}
                      onChange={(event) =>
                        updateMotorConfig({
                          zonaInstalacion: event.target.value,
                        })
                      }
                    >
                      {ZONAS_VIATICO.map((zona) => (
                        <option key={zona.value} value={zona.value}>
                          {zona.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {!cargoInputKeys.has("m2Instalados") ? (
                  <div className="ap-spec">
                    <label>m² instalados</label>
                    <input
                      type="number"
                      min="0"
                      value={motorConfig.m2Instalados}
                      onChange={(event) =>
                        updateMotorConfig({
                          m2Instalados: Number(event.target.value) || 0,
                        })
                      }
                    />
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : (
          <>
            {renderCantidadCard()}
            {minimoComercialStatus ? (
              <div
                className={`ap-minimum-alert ${minimoComercialStatus.kind === "blocked" ? "is-blocked" : "is-warning"}`}
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
            Pasos de producción que el comercial puede activar para este
            producto.
          </div>
        </div>
        {opcionalesPasos.length > 0 ? (
          <div className="ap-adicionales">
            {opcionalesPasos.map((adicional) => {
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
                        + {fmt(adicional.monto ?? 0)}
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
              Este producto no tiene pasos opcionales disponibles para activar.
            </div>
          </div>
        )}
        {opcionalesConfigurables.length > 0 ? (
          <div className="ap-optional-configs">
            <div className="ap-optional-config-head">
              <div className="ttl">Configurar opcionales activados</div>
            </div>
            <div className="ap-optional-config-grid">
              {opcionalesConfigurables.map(
                ({
                  opcional,
                  slots,
                  tiempoManual,
                  paramsComercial,
                  nivel,
                  complejidad,
                }) => {
                  const arrastrado = opcional.configPasoId
                    ? arrastradosSheet.has(opcional.configPasoId)
                    : false;
                const tiempoPendiente = Boolean(
                    tiempoManual &&
                    getTiempoManualError(tiempoManual, motorConfig),
                );
                return (
                  // UNA tarjeta por opcional: el nombre del paso VA en la barra
                  // negra, con la × al lado. Adentro los bloques llevan rótulo
                  // liviano — dos barras negras anidadas no jerarquizan nada.
                  <div className={seC.card} key={opcional.code}>
                    <div className={`${seC.gh} ${seC.ghRow}`}>
                      <span>{opcional.name}</span>
                      {/* El estado sólo habla cuando algo falta: un "Configurado"
                          permanente ocupa lugar para decir lo que ya se ve. */}
                      {tiempoPendiente ? (
                        <span className={seC.ghNota}>falta el tiempo</span>
                      ) : null}
                      {arrastrado ? (
                        // Lo encendió otro paso que lo necesita: quitarlo acá
                        // dejaría la cotización inconsistente.
                        <span className={seC.ghNota}>lo exige otro paso</span>
                      ) : (
                        <button
                          type="button"
                          className={seC.ghQuit}
                          onClick={() => setOpcional(opcional.code, false)}
                          title={`Quitar ${opcional.name}`}
                          aria-label={`Quitar ${opcional.name}`}
                        >
                          <XIcon aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <div className={`${seC.body} ap-optional-config-fields`}>
                      {nivel
                        ? renderNivelField(nivel, { sinTarjeta: true })
                        : null}
                      {complejidad
                        ? renderComplejidadField(complejidad, {
                            sinTarjeta: true,
                          })
                        : null}
                      {slots.length > 0 ? (
                        <div className={matS.list}>
                          {slots.map((slot) =>
                            renderMaterialSelect(slot, {
                              showHint: false,
                              collapseSingleCandidate: true,
                              sinTarjeta: true,
                            }),
                          )}
                        </div>
                      ) : null}
                      {tiempoManual
                        ? renderTiempoManualField(tiempoManual, {
                            sinTarjeta: true,
                          })
                        : null}
                      {paramsComercial?.campos.map((campo) =>
                        renderParamComercialField(paramsComercial, campo, {
                          soloEtiqueta: true,
                        }),
                      )}
                    </div>
                    {/* Sin pie "Seleccionado: …": repetía lo que la tarjeta del
                        material ya muestra en su propia fila. */}
                  </div>
                );
                },
              )}
            </div>
          </div>
        ) : null}
      </div>

      {cargosOpcionales.length > 0 ? (
        <div className="ap-config-section">
          <div className="ap-cs-head">
            <div className="ttl">Cargos</div>
            <div className="sub">
              Costos directos que se generan al ejecutar el trabajo. No crean
              pasos de producción adicionales.
            </div>
          </div>
          <div className="ap-adicionales">
            {cargosOpcionales.map((cargo) => {
              const selected = adi.includes(cargo.code);
              return (
                <div key={cargo.code}>
                  <button
                    type="button"
                    className={`ap-adi ${selected ? "on" : ""}`}
                    onClick={() =>
                      product.real
                        ? setOpcional(cargo.code, !selected)
                        : toggleAdi(cargo.code)
                    }
                    title={cargo.descripcion}
                  >
                    <span className="cb" />
                    <span className="lb">{cargo.name}</span>
                    {product.real ? (
                      <span className="mt mono">
                        {etiquetaImpactoCargo(cargo)}
                      </span>
                    ) : (
                      <span className="mt mono">+ {fmt(cargo.monto ?? 0)}</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {cargoInputs.some((input) =>
        isCargoInputVisible(input, motorConfig, ruleContext),
      ) ? (
        <div className="ap-config-section">
          <div className="ap-cs-head">
            <div className="ttl">Datos para calcular costos directos</div>
            <div className="sub">
              El motor usa estos valores para calcular importes por zona o por
              unidad.
            </div>
          </div>
          <div className="ap-specs">
            {cargoInputs
              .filter((input) =>
                isCargoInputVisible(input, motorConfig, ruleContext),
              )
              .map((input) => (
                <div className="ap-spec" key={input.key}>
                  <label>
                    {input.label}
                    {input.unidad ? ` (${input.unidad})` : ""}
                  </label>
                  {input.tipo === "select" ? (
                    <select
                      className="ap-native-select"
                      value={String(motorConfig.cargoInputs[input.key] ?? "")}
                      onChange={(event) =>
                        setMotorConfig((current) => ({
                          ...current,
                          cargoInputs: {
                            ...current.cargoInputs,
                            [input.key]: event.target.value,
                          },
                        }))
                      }
                    >
                      {(input.opciones ?? []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={motorConfig.cargoInputs[input.key] ?? 0}
                      onChange={(event) =>
                        setMotorConfig((current) => ({
                          ...current,
                          cargoInputs: {
                            ...current.cargoInputs,
                            [input.key]: Number(event.target.value) || 0,
                          },
                        }))
                      }
                    />
                  )}
                  <small className="text-muted-foreground">
                    Para calcular: {input.cargoNombre}
                  </small>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      <div className="ap-config-section">
        <div className="ap-cs-head">
          <div className="ttl">Notas para producción</div>
          <div className="sub">
            Información extra para el taller (opcional).
          </div>
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
        <div
          className={`ap-summary${cotizando && cotizacionExitosa ? " is-updating" : ""}`}
        >
          <div className="ap-sum-head">
            {cotizacionExitosa
              ? "Detalle del cálculo"
              : cotizando
                ? "Calculando"
                : "Precio"}
            {cotizacionExitosa?.desglosePrecio?.precioEspecialCliente ? (
              <span
                className="ap-sum-especial"
                title="Este producto tiene un precio especial configurado para el cliente de la orden."
              >
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
            <div
              className="ap-empty ap-calculating"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="ap-calc-loader" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="ttl">Calculando con el Motor Universal</div>
              <div className="sub">
                Estamos procesando cantidad, opciones y ruta seleccionada.
              </div>
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
                  <span className="lbl">
                    {labelPrecioUnitario(product.unidad)}
                  </span>
                  <span className="val mono">
                    {formatUnitPrice(
                      getCotizacionUnitario(cotizacionExitosa),
                      moneda,
                    )}
                  </span>
                </div>
                <div className="row">
                  <span className="lbl">Cantidad cotizada</span>
                  <span className="val mono">
                    {(
                      cotizacionExitosa.cantidadComercialPricing ??
                      cotizacionExitosa.cantidadEfectiva
                    ).toLocaleString("es-AR")}{" "}
                    {product.unidad}
                  </span>
                </div>
                <div className="row">
                  <span className="lbl">Subtotal neto</span>
                  <span className="val mono">
                    {fmt(getCotizacionNeto(cotizacionExitosa))}
                  </span>
                </div>
                <div className="row sub">
                  <span className="lbl">+ Impuestos</span>
                  <span className="val mono">
                    {fmt(getCotizacionImpuestos(cotizacionExitosa))}
                  </span>
                </div>
                <div className="row total">
                  <span className="lbl">Total con impuestos</span>
                  <span className="val mono">
                    {fmt(getCotizacionTotal(cotizacionExitosa))}
                  </span>
                </div>
              </div>
              {/* El vendedor cotiza sobre el precio, no sobre la ganancia:
                  sin el permiso no ve cuánto deja el trabajo. El API tampoco
                  se lo manda. */}
              {verMargenes && (
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
              )}
            </>
          ) : (
            <div className="ap-empty">
              <div className="ttl">Completá los datos para ver el precio</div>
              <div className="sub">
                El precio se calcula automáticamente con el Motor Universal a
                medida que cargás cantidad, medidas y opcionales.
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
                {fmt(product.precioBase)})
              </span>
              <span className="val mono">{fmt(totals.subtotal)}</span>
            </div>
            {adi.length > 0 ? (
              <div className="row">
                <span className="lbl">+ Opcionales ({adi.length})</span>
                <span className="val mono">{fmt(totals.adicionalesMonto)}</span>
              </div>
            ) : null}
            <div className="row sub">
              <span className="lbl">+ Impuestos ({product.impuestoPct}%)</span>
              <span className="val mono">{fmt(totals.impuestos)}</span>
            </div>
            <div className="row sub muted">
              <span className="lbl">Costo estimado</span>
              <span className="val mono">{fmt(totals.costoEstimado)}</span>
            </div>
            <div className="row total">
              <span className="lbl">Total con impuestos</span>
              <span className="val mono">{fmt(totals.total)}</span>
            </div>
          </div>
          {verMargenes && (
            <div className="ap-sum-margen">
              <div className="m-head">
                <span>Margen bruto</span>
                <span className={`m-val ${totals.margen < 25 ? "warn" : ""}`}>
                  {totals.margen.toFixed(1)}%
                </span>
              </div>
              <div className="m-track">
                <span
                  style={{
                    width: `${Math.min(100, Math.max(0, totals.margen))}%`,
                  }}
                />
              </div>
            </div>
          )}
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
  const { moneda } = useConfigRegional();
  const [step, setStep] = React.useState<"select" | "config">("select");
  const [product, setProduct] = React.useState<CatalogProduct | null>(null);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const openerRef = React.useRef<HTMLElement | null>(null);
  // El scroll del cuerpo es el mismo elemento en los dos pasos: sin resetearlo,
  // al entrar a configurar un producto la vista arranca donde quedó el listado.
  const bodyRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step, product?.id]);
  const [productoDetalle, setProductoDetalle] =
    React.useState<ProductoDetalle | null>(null);
  const [query, setQuery] = React.useState("");
  const [family, setFamily] = React.useState("Todos");
  const [qty, setQty] = React.useState(0);
  const [specs, setSpecs] = React.useState<Record<string, string>>({});
  const [adi, setAdi] = React.useState<string[]>([]);
  const [motorConfig, setMotorConfig] =
    React.useState<MotorConfigState>(DEFAULT_MOTOR_CONFIG);
  // PDF medidos retenidos: se suben como Archivos del ítem al guardar (Fase 2
  // del lector de planos). Transitorio; ver docs/planos-persistir-diseno.md.
  const [planosAdjuntos, setPlanosAdjuntos] = React.useState<File[]>([]);
  const [notaProduccion, setNotaProduccion] = React.useState("");
  const [loadingProductId, setLoadingProductId] = React.useState<string | null>(
    null,
  );
  const [cotizacion, setCotizacion] = React.useState<CotizarResponse | null>(
    null,
  );
  const [cotizando, setCotizando] = React.useState(false);
  const [cotizacionError, setCotizacionError] = React.useState<string | null>(
    null,
  );
  // La respuesta anterior puede seguir mostrándose durante el debounce, pero
  // deja de ser confirmable apenas cambia cualquier input cotizable.
  const [cotizacionDesactualizada, setCotizacionDesactualizada] =
    React.useState(true);
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
    ? getMinimumCommercialStatus(
        product,
        productoDetalle,
        motorConfig,
        qty,
        cotizacionExitosa,
      )
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
      (config) =>
        isConfigPasoVisibleForContext(config, motorConfig, ruleContext),
      motorConfig,
    );
  }, [motorConfig, product, productoDetalle, qty]);
  const isBlockedByTiempoManual = Boolean(tiempoManualBloqueo);

  React.useEffect(() => {
    if (!product) return;
    const coercedQty = coerceQtyToPricingOptions(qty, product);
    if (coercedQty !== qty) setQty(coercedQty);
  }, [product, qty]);

  // Producto tercerizado con matriz: si la cantidad actual no es una de las
  // cantidades definidas por el proveedor, arranca en la primera (evita cotizar
  // con una cantidad fuera de la lista y deja la cotización lista de una).
  React.useEffect(() => {
    if (!productoDetalle) return;
    const ruta = getRutaSeleccionada(
      productoDetalle,
      motorConfig.rutaAlternativaId,
    );
    const cantidades = getTercerizadoCantidades(ruta?.configPasos ?? []);
    if (cantidades.length > 0 && !cantidades.includes(qty))
      setQty(cantidades[0]);
  }, [productoDetalle, motorConfig.rutaAlternativaId, qty]);

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
        toast.error(
          "No pude encontrar el producto original para editar este item.",
        );
        return;
      }

      if (cancelled) return;
      suppressNextCotizacionClear.current = true;
      const nextMotorConfig = motorConfigFromItem(itemToEdit);
      const activeOptionCodes = Object.entries(
        nextMotorConfig.opcionalesActivados,
      )
        .filter(([, value]) => value)
        .map(([key]) => key);
      const selectedAdicionales = Array.from(
        new Set([
          ...activeOptionCodes,
          ...nextProduct.adicionales
            .filter((adicional) =>
              itemToEdit.adicionales.includes(adicional.name),
            )
            .map((adicional) => adicional.code),
        ]),
      );

      setProduct(nextProduct);
      setProductoDetalle(detalle);
      setQty(
        coerceQtyToPricingOptions(getQtyFromItem(itemToEdit), nextProduct),
      );
      setSpecs({
        ...defaultSpecs(nextProduct),
        ...itemToEdit.especificaciones,
      });
      setAdi(selectedAdicionales);
      setMotorConfig(nextMotorConfig);
      setNotaProduccion(itemToEdit.notaProduccion ?? "");
      setCotizacion(cotizacionFromItem(itemToEdit));
      setCotizacionDesactualizada(false);
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
        detalle = augmentDetalleConPasosExtras(
          await getProductoById(picked.id),
        );
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
    setCotizacionDesactualizada(true);
    setCotizacionError(null);
    setPlanosAdjuntos([]);
    const rutaPreferida =
      detalle?.rutasAlternativas.find((ruta) => ruta.esPreferida) ??
      detalle?.rutasAlternativas[0] ??
      null;
    const medidaDefault = detalle ? getMedidaDefault(detalle) : null;
    const iniciaConPiezas =
      detalle?.modoMedidas === "LIBRE" ||
      isMetroLinealConMedidasVariables(detalle);
    setMotorConfig({
      ...DEFAULT_MOTOR_CONFIG,
      rutaAlternativaId: rutaPreferida?.id ?? "",
      medidaPredefinidaId: medidaDefault?.id ?? "",
      piezas: iniciaConPiezas ? [createDefaultPiezaInput()] : [],
      numerosXTalonario:
        next.subcategoriaComercialCodigo === "talonarios" ? 50 : 50,
    });
    setStep("config");
  }, []);

  const toggleAdi = React.useCallback((code: string) => {
    setAdi((prev) =>
      prev.includes(code)
        ? prev.filter((item) => item !== code)
        : [...prev, code],
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
    const slotsComercialElige = getSlotsParaCotizacion(
      rutaSel,
      productoDetalle,
      motorConfig,
      (config) =>
        isConfigPasoVisibleForContext(config, motorConfig, ruleContext),
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
        setCotizacionError(
          res.errores[0]?.mensaje ?? "El motor no pudo cotizar este producto.",
        );
      } else {
        setCotizacionDesactualizada(false);
      }
    } catch (error) {
      if (seq !== cotizacionSeqRef.current) return;
      setCotizacionError(
        error instanceof Error
          ? error.message
          : "No se pudo conectar con el motor.",
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
      setCotizacionDesactualizada(false);
      return;
    }
    // Invalida también cualquier request que ya estuviera en vuelo. El precio
    // anterior queda visible, pero no se puede confirmar hasta que coincida con
    // la configuración actual.
    cotizacionSeqRef.current += 1;
    setCotizacionDesactualizada(true);
    const handle = setTimeout(() => {
      void cotizarActual();
    }, 450);
    return () => clearTimeout(handle);
  }, [cotizarActual, adi, step, isBlockedByMinimum]);

  const addCurrent = React.useCallback(
    (keepOpen: boolean) => {
      if (!product) return;
      if (product.real && (!cotizacionExitosa || cotizacionDesactualizada)) {
        toast.error(
          "Esperá a que termine la cotización actualizada del producto.",
        );
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
      const slotsComercialElige = getSlotsParaCotizacion(
        rutaSel,
        productoDetalle,
        motorConfig,
        (config) =>
          isConfigPasoVisibleForContext(config, motorConfig, ruleContext),
      );
      const construido = buildItem(product, qty, specs, adi, {
        productoDetalle,
        motorConfig,
        slotsComercialElige,
        ruleContext,
        cotizacion,
        notaProduccion,
        itemId: editingItem?.id,
        fechaEntrega: editingItem?.fechaEntrega ?? fechaEntregaDefault,
      });
      // Los PDF medidos viajan como campo transitorio: se suben al guardar.
      const nextItem: PropuestaItem =
        planosAdjuntos.length > 0
          ? { ...construido, planosPendientes: planosAdjuntos }
          : construido;
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
        setCotizacionDesactualizada(true);
        setCotizacionError(null);
        setPlanosAdjuntos([]);
        return;
      }
      close();
    },
    [
      adi,
      close,
      cotizacion,
      cotizacionDesactualizada,
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
      // Sin esta dep el callback puede quedarse con una lista vieja de planos
      // y no subir los que el comercial acaba de adjuntar.
      planosAdjuntos,
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
      setCotizacionDesactualizada(true);
      setCotizacionError(null);
      setCotizando(false);
      suppressNextCotizacionClear.current = false;
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("aria-hidden"));
    const onTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const disponibles = focusables();
      if (disponibles.length === 0) return;
      const first = disponibles[0];
      const last = disponibles[disponibles.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onTab);
    return () => {
      document.removeEventListener("keydown", onTab);
      document.body.style.overflow = overflowAnterior;
      openerRef.current?.focus();
    };
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

  // Cartelería toma la pantalla completa: el configurador 3D necesita las
  // tres columnas (params · 3D · listado), no el drawer angosto.
  const esCarteleriaFull =
    CONFIGURADOR_3D_CARTELERIA_ACTIVO &&
    step === "config" &&
    Boolean(
      getCarteleriaDeRuta(
        getRutaSeleccionada(productoDetalle, motorConfig.rutaAlternativaId),
        isExecutableConfigPaso,
      ),
    );

  return (
    <>
      <div className="sheet-backdrop" onClick={close} />
      <div
        ref={dialogRef}
        className={`sheet sheet-ap${esCarteleriaFull ? ` ${cartS.sheetFull}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ap-title"
      >
        {step === "select" ? (
          <div className="sheet-head ap-head">
            <div className="body">
              <div className="ap-eyebrow">
                <BriefcaseBusinessIcon />
                Comercial · Nueva orden
              </div>
              <h2 id="ap-title">Agregar producto a la OT</h2>
              <div className="sub">
                Elegí un producto del catálogo para configurar cantidad, datos
                reales y opcionales.
              </div>
            </div>
            <button
              type="button"
              className="close"
              onClick={close}
              aria-label="Cerrar"
            >
              <XIcon />
            </button>
          </div>
        ) : null}

        <div
          ref={bodyRef}
          className={`sheet-body ap-body${esCarteleriaFull ? ` ${cartS.sheetBodyFull}` : ""}`}
        >
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
              setPlanosAdjuntos={setPlanosAdjuntos}
              notaProduccion={notaProduccion}
              setNotaProduccion={setNotaProduccion}
              cotizacion={cotizacion}
              cotizando={cotizando}
              cotizacionError={cotizacionError}
              onCotizar={cotizarActual}
              onBack={back}
              onClose={close}
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
                    ? cotizando || cotizacionDesactualizada
                      ? "Cotizando..."
                      : cotizacionExitosa
                        ? formatCurrency(
                            getCotizacionTotal(cotizacionExitosa),
                            moneda,
                          )
                        : "Pendiente"
                    : formatCurrency(totals.total, moneda)}
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
                      cotizacionDesactualizada ||
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
                    cotizacionDesactualizada ||
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
                ¿No está en el catálogo?{" "}
                <Link href="/productos-servicios/nuevo" className="ap-link">
                  Crear producto custom →
                </Link>
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
