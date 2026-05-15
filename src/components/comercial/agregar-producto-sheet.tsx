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
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  formatCurrency,
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
  origen?: "paso" | "cargo" | "mock";
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

type SlotComercialElige = {
  configPasoId: string;
  familiaCodigo: string;
  modoActivacion: string | null;
  slotCodigo: string;
  candidatos: Array<{
    variantId: string;
    label?: string;
    default?: boolean;
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
  caras: 1 | 2;
  tipoCopia: 1 | 2 | 3;
  numerosXTalonario: number;
  piezas: PiezaInput[];
  opcionalesActivados: Record<string, boolean>;
  seleccionMaterial: Record<string, string>;
  seleccionMaquina: Record<string, string>;
  seleccionModoColor: Record<string, string>;
  zonaInstalacion: string;
  m2Instalados: number;
};

type CotizacionExitosa = NonNullable<CotizarResponse["cotizacion"]>;

type AgregarProductoSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productos: ProductoListItem[];
  onAddItem: (item: PropuestaItem) => void;
  editingItem?: PropuestaItem | null;
  onSaveItem?: (item: PropuestaItem) => void;
};

const CATALOG_PRODUCTS: CatalogProduct[] = [
  {
    real: false,
    code: "TAR-001",
    name: "Tarjetas personales",
    family: "Digital",
    categoriaComercialCodigo: "impresion_hoja",
    categoriaComercialNombre: "Impresión comercial en hoja",
    subcategoriaComercialCodigo: "tarjetas",
    subcategoriaComercialNombre: "Tarjetas",
    cobro: "Por unidad",
    unidad: "u.",
    medidasMode: "fija",
    precioBase: 68,
    descripcion: "Tarjetas estándar 9 x 5 cm en papel ilustración.",
    specs: [
      {
        key: "material",
        label: "Material",
        type: "select",
        options: [
          "Papel ilustración 300g",
          "Cartulina mate 250g",
          "Reciclado 350g",
        ],
        def: "Papel ilustración 300g",
      },
      {
        key: "medidas",
        label: "Medidas",
        type: "select",
        options: ["9 x 5 cm", "8.5 x 5.5 cm", "9 x 4 cm"],
        def: "9 x 5 cm",
      },
      {
        key: "color",
        label: "Color",
        type: "select",
        options: ["4/4 + barniz", "4/4", "4/0", "1/0 negro"],
        def: "4/4 + barniz",
      },
      {
        key: "acabado",
        label: "Acabado",
        type: "select",
        options: ["Mate", "Brillante", "Soft touch"],
        def: "Mate",
      },
    ],
    adicionales: [
      { code: "cantos_redondeados", name: "Cantos redondeados", monto: 1500, origen: "mock" },
      { code: "empaque_premium", name: "Empaque premium", monto: 800, origen: "mock" },
      { code: "estampado_oro", name: "Estampado en oro", monto: 4500, origen: "mock" },
      { code: "uv_selectivo", name: "UV selectivo", monto: 3200, origen: "mock" },
    ],
    qtyDefault: 500,
    costoUnitario: 36,
    impuestoPct: 21,
  },
  {
    real: false,
    code: "VIN-120",
    name: "Vinilo impreso con instalación",
    family: "Gran formato",
    categoriaComercialCodigo: "gran_formato_flexible",
    categoriaComercialNombre: "Gran formato flexible",
    subcategoriaComercialCodigo: "vinilos_impresos",
    subcategoriaComercialNombre: "Vinilos impresos",
    cobro: "Por m²",
    unidad: "m²",
    medidasMode: "calculada",
    precioBase: 18500,
    descripcion: "Vinilo impreso solvente con instalación incluida en CABA.",
    specs: [
      {
        key: "material",
        label: "Material",
        type: "select",
        options: [
          "Vinilo blanco brillante",
          "Vinilo blanco mate",
          "Vinilo translúcido",
          "Vinilo microperforado",
        ],
        def: "Vinilo blanco brillante",
      },
      { key: "medidas", label: "Medidas", type: "text", def: "120 x 80 cm x 4" },
      {
        key: "tecnologia",
        label: "Tecnología",
        type: "select",
        options: ["Solvente", "Eco-solvente", "Látex", "UV"],
        def: "Solvente",
      },
      {
        key: "instalacion",
        label: "Instalación",
        type: "select",
        options: ["CABA", "GBA Norte", "GBA Sur", "Interior país", "Sin instalación"],
        def: "CABA",
      },
    ],
    adicionales: [
      { code: "viatico_caba", name: "Viático CABA", monto: 12000 },
      { code: "laminado_brillo", name: "Laminado brillo", monto: 8500 },
      { code: "instalacion_nocturna", name: "Instalación nocturna", monto: 15000 },
      { code: "ojales_metalicos", name: "Ojales metálicos", monto: 2500 },
    ],
    qtyDefault: 3.84,
    costoUnitario: 15470,
    impuestoPct: 21,
  },
  {
    real: false,
    code: "TAL-050",
    name: "Talonarios numerados",
    family: "Talonario",
    categoriaComercialCodigo: "editorial_encuadernacion",
    categoriaComercialNombre: "Editorial, formularios y encuadernación",
    subcategoriaComercialCodigo: "talonarios",
    subcategoriaComercialNombre: "Talonarios",
    cobro: "Por unidad",
    unidad: "u.",
    medidasMode: "fija",
    precioBase: 2800,
    descripcion: "Talonarios numerados, hasta 3 copias por hoja.",
    specs: [
      {
        key: "hojas",
        label: "Hojas",
        type: "select",
        options: [
          "25 hojas x 2 copias",
          "50 hojas x 2 copias",
          "50 hojas x 3 copias",
          "100 hojas x 3 copias",
        ],
        def: "50 hojas x 3 copias",
      },
      {
        key: "tamano",
        label: "Tamaño",
        type: "select",
        options: ["1/3 oficio", "1/2 oficio", "A5", "A6"],
        def: "1/3 oficio",
      },
      { key: "numerado", label: "Numerado", type: "text", def: "001 - 1500" },
      {
        key: "encuadernacion",
        label: "Encuadernación",
        type: "select",
        options: ["Engomado + tapa", "Espiralado", "Grapado"],
        def: "Engomado + tapa",
      },
    ],
    adicionales: [
      { code: "numerado_custom", name: "Numerado custom", monto: 2200 },
      { code: "tapa_carton_gruesa", name: "Tapa cartón gruesa", monto: 1800 },
    ],
    qtyDefault: 25,
    costoUnitario: 1540,
    impuestoPct: 21,
  },
  {
    real: false,
    code: "FOL-200",
    name: "Folletos tríptico",
    family: "Offset",
    categoriaComercialCodigo: "impresion_hoja",
    categoriaComercialNombre: "Impresión comercial en hoja",
    subcategoriaComercialCodigo: "volantes_folletos",
    subcategoriaComercialNombre: "Volantes y folletos",
    cobro: "Por unidad",
    unidad: "u.",
    medidasMode: "fija",
    precioBase: 95,
    descripcion: "Folleto A4 doblado en 3 (tríptico).",
    specs: [
      {
        key: "material",
        label: "Material",
        type: "select",
        options: ["Ilustración 150g", "Ilustración 200g", "Mate 170g"],
        def: "Ilustración 150g",
      },
      {
        key: "medidas",
        label: "Medidas",
        type: "select",
        options: ["A4 abierto", "A3 abierto", "Custom"],
        def: "A4 abierto",
      },
      {
        key: "color",
        label: "Color",
        type: "select",
        options: ["4/4", "4/1", "4/0"],
        def: "4/4",
      },
      {
        key: "plegado",
        label: "Plegado",
        type: "select",
        options: ["Tríptico", "Díptico", "Acordeón"],
        def: "Tríptico",
      },
    ],
    adicionales: [
      { code: "laminado_brillo", name: "Laminado brillo", monto: 4500 },
      { code: "uv_selectivo", name: "UV selectivo", monto: 6800 },
    ],
    qtyDefault: 1000,
    costoUnitario: 52,
    impuestoPct: 21,
  },
  {
    real: false,
    code: "LON-080",
    name: "Lona impresa",
    family: "Gran formato",
    categoriaComercialCodigo: "gran_formato_flexible",
    categoriaComercialNombre: "Gran formato flexible",
    subcategoriaComercialCodigo: "lonas_banners",
    subcategoriaComercialNombre: "Lonas y banners",
    cobro: "Por m²",
    unidad: "m²",
    medidasMode: "calculada",
    precioBase: 14200,
    descripcion: "Lona front 13 oz con ojales perimetrales.",
    specs: [
      {
        key: "material",
        label: "Material",
        type: "select",
        options: ["Lona front 13 oz", "Lona back 9 oz", "Lona blockout"],
        def: "Lona front 13 oz",
      },
      { key: "medidas", label: "Medidas", type: "text", def: "200 x 100 cm" },
      {
        key: "terminacion",
        label: "Terminación",
        type: "select",
        options: ["Ojales perimetrales", "Dobladillo + ojales", "Bolsillos"],
        def: "Ojales perimetrales",
      },
      {
        key: "instalacion",
        label: "Instalación",
        type: "select",
        options: ["Sin instalación", "CABA", "GBA"],
        def: "Sin instalación",
      },
    ],
    adicionales: [
      { code: "anti_viento", name: "Refuerzo anti-viento", monto: 5200 },
      { code: "bolsillos_canos", name: "Bolsillos para caños", monto: 3800 },
    ],
    qtyDefault: 2,
    costoUnitario: 11800,
    impuestoPct: 21,
  },
  {
    real: false,
    code: "BAN-040",
    name: "Banner roll-up",
    family: "Stand",
    categoriaComercialCodigo: "gran_formato_flexible",
    categoriaComercialNombre: "Gran formato flexible",
    subcategoriaComercialCodigo: "rollups_displays",
    subcategoriaComercialNombre: "Roll-ups y displays",
    cobro: "Por unidad",
    unidad: "u.",
    medidasMode: "fija",
    precioBase: 48000,
    descripcion: "Banner roll-up 85 x 200 cm con bolsa de transporte.",
    specs: [
      {
        key: "material",
        label: "Material",
        type: "select",
        options: ["Polipropileno", "Lona vinílica"],
        def: "Polipropileno",
      },
      {
        key: "medidas",
        label: "Medidas",
        type: "select",
        options: ["85 x 200 cm", "100 x 200 cm", "120 x 200 cm"],
        def: "85 x 200 cm",
      },
      {
        key: "estructura",
        label: "Estructura",
        type: "select",
        options: ["Aluminio estándar", "Aluminio premium"],
        def: "Aluminio estándar",
      },
      {
        key: "bolsa",
        label: "Bolsa",
        type: "select",
        options: ["Incluida", "No incluida"],
        def: "Incluida",
      },
    ],
    adicionales: [
      { code: "diseno_arte", name: "Diseño de arte", monto: 18000 },
      { code: "envio_corredor", name: "Envío corredor", monto: 6500 },
    ],
    qtyDefault: 2,
    costoUnitario: 28000,
    impuestoPct: 21,
  },
];

const RECENT_CODES = ["TAR-001", "VIN-120", "FOL-200"];
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
  caras: 1,
  tipoCopia: 1,
  numerosXTalonario: 50,
  piezas: [],
  opcionalesActivados: {},
  seleccionMaterial: {},
  seleccionMaquina: {},
  seleccionModoColor: {},
  zonaInstalacion: "CABA",
  m2Instalados: 0,
};

function materialSelectionKey(configPasoId: string, slotCodigo: string) {
  return `${configPasoId}_${slotCodigo}`;
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

function getCantidadDefault(producto: ProductoListItem) {
  if (producto.unidadComercial === "m2") return 1;
  if (producto.unidadComercial === "metro_lineal") return 1;
  if (producto.subcategoriaComercial?.codigo === "tarjetas") return 500;
  if (producto.subcategoriaComercial?.codigo === "talonarios") return 25;
  return 1;
}

function formatDefaultMedidas(producto: ProductoListItem) {
  if (producto.medidaDefaultAnchoMm && producto.medidaDefaultAltoMm) {
    const ancho = Number(producto.medidaDefaultAnchoMm);
    const alto = Number(producto.medidaDefaultAltoMm);
    if (Number.isFinite(ancho) && Number.isFinite(alto)) {
      return `${Math.round(ancho)} x ${Math.round(alto)} mm`;
    }
  }
  return producto.modoMedidas === "LIBRE" ? "Medidas libres" : "A definir";
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

function getSlotsComercialElige(ruta: RutaAlternativaDetalle | null) {
  return (
    ruta?.configPasos.flatMap((config) =>
      config.slotsMateriales
        .filter((slot) => slot.modoSeleccion === "COMERCIAL_ELIGE")
        .map((slot) => ({
          configPasoId: config.id,
          familiaCodigo: config.rutaPaso.familiaCodigo,
          modoActivacion: config.modoActivacion,
          slotCodigo: slot.slotCodigo,
          candidatos:
            (slot.materialesCandidatosJson as Array<{
              variantId: string;
              label?: string;
              default?: boolean;
            }>) ?? [],
        })),
    ) ?? []
  );
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
  if (["BN", "B/N", "K", "NEGRO", "BLACK"].includes(normalized)) return "BN";
  if (normalized === "CMYK") return "CMYK";
  if (["CMYK+BLANCO", "CMYKBLANCO"].includes(normalized)) return "CMYK+blanco";
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
        const comercialElige =
          modoConfig.comercialElige === true ||
          (modoConfig.enabled !== false && options.length > 1);
        if (!comercialElige) return null;
        return {
          configPasoId: config.id,
          familiaCodigo: config.rutaPaso.familiaCodigo,
          modoActivacion: config.modoActivacion,
          options,
          defaultMode: normalizeModoColor(modoConfig.defaultMode),
        };
      })
      .filter((modo): modo is ModoColorComercial => modo !== null) ?? []
  );
}

function getPasosConCandidatas(ruta: RutaAlternativaDetalle | null) {
  return (
    ruta?.configPasos
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

function getOpcionales(producto: ProductoListItem | ProductoDetalle): CatalogAdicional[] {
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
    const ruta =
      producto.rutasAlternativas.find((item) => item.esPreferida) ??
      producto.rutasAlternativas[0];
    for (const config of ruta?.configPasos ?? []) {
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
    descripcion: producto.descripcion ?? categoria.nombre,
    specs: schema
      .filter((spec) => spec.visible)
      .sort((a, b) => a.orden - b.orden)
      .map((spec) => ({
        key: spec.key,
        label: spec.label,
        type: spec.tipo === "select" ? "select" : "text",
        def: getCommercialSpecFallback(producto, spec.key, atributos),
      })),
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

function getCotizacionPasos(cotizacion: CotizacionExitosa): PasoProduccionPropuesta[] {
  return cotizacion.pasos
    .filter((paso) => paso.activado)
    .map((paso) => ({
      nombre: humanizeCodigo(paso.familiaCodigo),
      centroCosto: paso.tiempo ? "Producción" : "Proceso",
      minutos: paso.tiempo?.totalMin ?? 0,
      origen: "base",
    }));
}

function defaultSpecs(product: CatalogProduct) {
  return Object.fromEntries(product.specs.map((spec) => [spec.key, spec.def]));
}

function buildJobContext(
  productoDetalle: ProductoDetalle | null,
  config: MotorConfigState,
  qty: number,
  slotsComercialElige: SlotComercialElige[],
) {
  const cantidadTrabajo =
    productoDetalle?.modoMedidas === "LIBRE"
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

  if (productoDetalle?.modoMedidas === "LIBRE" && config.piezas.length > 0) {
    ctx.piezas = config.piezas.map((pieza) => ({
      cantidad: pieza.cantidad,
      anchoMm: pieza.anchoMm,
      altoMm: pieza.altoMm,
    }));
    ctx.piezaAnchoMaxMm = Math.max(...config.piezas.map((pieza) => pieza.anchoMm));
    ctx.piezaAltoMaxMm = Math.max(...config.piezas.map((pieza) => pieza.altoMm));
    ctx.piezaAreaTotalM2 = config.piezas.reduce(
      (total, pieza) =>
        total + (pieza.cantidad * pieza.anchoMm * pieza.altoMm) / 1_000_000,
      0,
    );
    if (config.piezas.length === 1) {
      ctx.medidaCustomMm = {
        anchoMm: config.piezas[0].anchoMm,
        altoMm: config.piezas[0].altoMm,
      };
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
    const variantId = config.seleccionMaterial[key];
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
  if (
    product.unidad === "m²" &&
    productoDetalle?.modoMedidas === "LIBRE" &&
    config?.piezas.length
  ) {
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
      .filter((paso) => paso.modoActivacion !== "OPCIONAL")
      .flatMap((paso) => paso.slotsMateriales)
      .filter(
        (slot) =>
          slot.modoSeleccion === "HARDCODED" &&
          MATERIAL_BASE_SLOT_CODES.has(slot.slotCodigo),
      )
      .map((slot) => slot.materialVariante?.nombreVariante ?? slot.materialVariante?.sku)
      .filter((value): value is string => Boolean(value)) ?? [];
  const selectedMaterials = slotsComercialElige
    .filter((slot) => slot.modoActivacion !== "OPCIONAL")
    .map((slot) => {
      const selectedId =
        config.seleccionMaterial[materialSelectionKey(slot.configPasoId, slot.slotCodigo)];
      return slot.candidatos.find((candidate) => candidate.variantId === selectedId)?.label;
    })
    .filter((value): value is string => Boolean(value));

  const baseMaterials = [...hardcodedMaterials, ...selectedMaterials];
  if (selectedMaterials.length > 0) {
    setSpec("material", Array.from(new Set(selectedMaterials)).join(" · "));
  } else if (!hasUsefulSpecValue(base.material) && baseMaterials.length > 0) {
    setSpec("material", Array.from(new Set(baseMaterials)).join(" · "));
  }
  if (productoDetalle?.modoMedidas === "LIBRE" && config.piezas.length > 0) {
    const medidas = config.piezas
      .map((pieza) => `${pieza.cantidad}u ${pieza.anchoMm} x ${pieza.altoMm} mm`)
      .join(" · ");
    setSpec("medidas", medidas);
    setSpec("formato_medidas", medidas);
    setSpec("m2_medidas_instaladas", medidas);
  } else if (productoDetalle) {
    const medidas = formatDefaultMedidas(productoDetalle);
    setSpec("medidas", medidas);
    setSpec("formato_medidas", medidas);
  }
  if (hasSpec("caras") || product.subcategoriaComercialCodigo === "tarjetas") {
    setSpec("caras", config.caras === 2 ? "Doble faz" : "Simple faz");
  }
  const modosColor = getModosColorComercial(rutaSeleccionada);
  const selectedModoColorLabels = modosColor
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
    normalized !== "medidas libres" &&
    !normalized.includes("opcional")
  );
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
  },
) {
  const totals = getTotals(product, qty, adi);
  const cotizacion = getCotizacionExitosa(options?.cotizacion ?? null);
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
  const terminacion = selectedAdicionales.length > 0 ? 16 : 8;
  const pasos: PasoProduccionPropuesta[] = cotizacion
    ? getCotizacionPasos(cotizacion)
    : [
        { nombre: "Preprensa", centroCosto: "Preprensa", minutos: 12, origen: "base" },
        {
          nombre: product.family === "Gran formato" ? "Impresión gran formato" : "Impresión",
          centroCosto: product.family,
          minutos: product.unidad === "m²" ? 42 : 28,
          origen: "base",
        },
        {
          nombre: "Terminación",
          centroCosto: "Terminación",
          minutos: terminacion,
          origen: selectedAdicionales.length > 0 ? "opcional" : "base",
        },
      ];
  const precioUnitario = cotizacion ? getCotizacionUnitario(cotizacion) : product.precioBase;
  const subtotal = cotizacion ? getCotizacionNeto(cotizacion) : totals.subtotalConAdi;
  const impuestoMonto = cotizacion ? getCotizacionImpuestos(cotizacion) : totals.impuestos;
  const total = cotizacion ? getCotizacionTotal(cotizacion) : totals.total;
  const impuestoPorcentaje =
    cotizacion && subtotal > 0 ? (impuestoMonto / subtotal) * 100 : product.impuestoPct;
  const costoEstimado = cotizacion?.costos.total ?? totals.costoEstimado;
  const cantidadComercial = calcularCantidadComercial(
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
    especificaciones,
    pasos,
    costos: {
      materiales: Math.round(cotizacion?.costos.materialesTotal ?? costoEstimado * 0.46),
      produccion: Math.round(cotizacion?.costos.tiempoTotal ?? costoEstimado * 0.34),
      terminacion: Math.round(cotizacion ? 0 : costoEstimado * 0.16),
      terceros: Math.round(cotizacion?.costos.cargosDirectosTotal ?? costoEstimado * 0.04),
    },
    costeo: cotizacion
      ? {
          origen: "motor",
          cantidadEfectiva: cotizacion.cantidadEfectiva,
          cantidadPedida: cotizacion.cantidadPedida,
          cantidadComercialPricing: cotizacion.cantidadComercialPricing,
          unidadComercialPricing: cotizacion.unidadComercialPricing,
          costos: cotizacion.costos,
          pasos: cotizacion.pasos,
          cargosDirectosCotizacion: cotizacion.cargosDirectosCotizacion,
          desglosePrecio: cotizacion.desglosePrecio,
        }
      : undefined,
    adicionales,
    notaProduccion: notaProduccion || undefined,
    rutaAlternativaId: options?.motorConfig.rutaAlternativaId ?? null,
    jobContext,
    atributosSchema: product.specs.map((spec, index) => ({
      key: spec.key,
      label: spec.label,
      tipo: spec.type,
      visible: product.real
        ? hasUsefulSpecValue(especificaciones[spec.key])
        : true,
      orden: (index + 1) * 10,
    })),
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
  if (item.costeo?.cantidadPedida && item.costeo.cantidadPedida > 0) {
    return item.costeo.cantidadPedida;
  }
  return item.cantidad;
}

function cotizacionFromItem(item: PropuestaItem): CotizarResponse | null {
  if (item.costeo?.origen !== "motor") return null;
  return {
    exitoso: true,
    errores: [],
    cotizacion: {
      productoId: item.motorCodigo,
      productoNombre: item.productoNombre,
      rutaNombre: item.rutaAlternativaId ?? "Ruta seleccionada",
      cantidadEfectiva: item.costeo.cantidadEfectiva,
      cantidadPedida: item.costeo.cantidadPedida,
      cantidadComercialPricing: item.costeo.cantidadComercialPricing,
      unidadComercialPricing: item.costeo.unidadComercialPricing,
      costos: item.costeo.costos,
      desglosePrecio: item.costeo.desglosePrecio,
      pasos: item.costeo.pasos,
      cargosDirectosCotizacion: item.costeo.cargosDirectosCotizacion,
    },
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
  const recientes = RECENT_CODES.map((code) =>
    products.find((product) => product.code === code),
  ).filter(Boolean) as CatalogProduct[];
  const visibleRecientes = recientes.length > 0 ? recientes : products.slice(0, 3);
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
  const slotsComercialElige = React.useMemo(
    () => getSlotsComercialElige(rutaSel),
    [rutaSel],
  );
  const slotsMaterialesPrincipales = slotsComercialElige.filter(
    (slot) => slot.modoActivacion !== "OPCIONAL",
  );
  const slotsMaterialesOpcionalesPorPaso = React.useMemo(
    () => getSlotsOpcionalesPorPaso(slotsComercialElige),
    [slotsComercialElige],
  );
  const pasosConCandidatas = getPasosConCandidatas(rutaSel);
  const modosColorComercial = getModosColorComercial(rutaSel).filter(
    (modo) =>
      modo.modoActivacion !== "OPCIONAL" ||
      Boolean(motorConfig.opcionalesActivados[modo.configPasoId]),
  );
  const modosColorVisibles = modosColorComercial.filter(
    (modo) => modo.options.length > 1,
  );
  const necesitaInstalacion = getProductoNecesitaInstalacion(productoDetalle);

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
    setMotorConfig((current) => ({
      ...current,
      piezas: [
        ...current.piezas,
        {
          uiKey: `pz-${Date.now()}-${current.piezas.length}`,
          cantidad: 1,
          anchoMm: 1000,
          altoMm: 500,
        },
      ],
    }));
  }, [setMotorConfig]);

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

  const renderMaterialSelect = (slot: SlotComercialElige) => {
    const key = materialSelectionKey(slot.configPasoId, slot.slotCodigo);
    const selected = motorConfig.seleccionMaterial[key] ?? "";
    return (
      <div className="ap-spec" key={key}>
        <label>{humanizeCodigo(slot.slotCodigo)}</label>
        <select
          className="ap-native-select"
          value={selected}
          onChange={(event) => setMaterial(key, event.target.value)}
        >
          <option value="">Motor elige / sin selección</option>
          {slot.candidatos.map((candidate) => (
            <option key={candidate.variantId} value={candidate.variantId}>
              {candidate.label ?? candidate.variantId}
              {candidate.default ? " · sugerido" : ""}
            </option>
          ))}
        </select>
      </div>
    );
  };
  const usaCaras =
    rutaSel?.configPasos.some(
      (config) =>
        config.multiplicadoresActivos.includes("caras") ||
        config.slotsMateriales.some((slot) => slot.aplicaMultiCaras),
    ) ||
    ["tarjetas", "volantes_folletos", "papeleria_comercial", "stickers_hoja"].includes(
      product.subcategoriaComercialCodigo,
    );
  const esTalonario = product.subcategoriaComercialCodigo === "talonarios";
  const hasQuantityShortcuts = !["m²", "m2", "ml"].includes(product.unidad.toLowerCase());
  const quantityShortcuts = hasQuantityShortcuts ? [100, 200, 300, 400] : [];

  return (
    <>
      <div className="ap-product-banner">
        <button type="button" className="ap-back" onClick={onBack}>
          <ArrowLeftIcon />
          Cambiar producto
        </button>
        <div className="ap-pb-body">
          <div className="ap-pb-head">
            <span className="code">{product.code}</span>
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
          <div className="sub">
            Inputs reales que viajan al Motor Universal para cotizar y producir.
          </div>
        </div>

        {product.real && productoDetalle?.rutasAlternativas.length ? (
          <div className="ap-specs">
            {productoDetalle.rutasAlternativas.length > 1 ? (
              <div className="ap-spec">
                <label>Ruta alternativa</label>
                <select
                  className="ap-native-select"
                  value={motorConfig.rutaAlternativaId}
                  onChange={(event) =>
                    setMotorConfig((current) => ({
                      ...current,
                      rutaAlternativaId: event.target.value,
                      opcionalesActivados: {},
                      seleccionMaterial: {},
                      seleccionMaquina: {},
                      seleccionModoColor: {},
                    }))
                  }
                >
                  {productoDetalle.rutasAlternativas.map((ruta) => (
                    <option key={ruta.id} value={ruta.id}>
                      {ruta.nombre}
                      {ruta.esPreferida ? " · preferida" : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {productoDetalle.modoMedidas === "LIBRE" ? (
              <div className="ap-spec ap-spec-wide">
                <label>Piezas / medidas libres</label>
                <div className="ap-piezas">
                  {motorConfig.piezas.map((pieza, index) => (
                    <div className="ap-pieza-row" key={pieza.uiKey}>
                      <input
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
            ) : (
              <div className="ap-spec ap-spec-wide">
                <label>Cantidad</label>
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
                      step={product.unidad === "m²" ? 0.1 : 1}
                      min="0"
                      onChange={(event) => setQty(Number.parseFloat(event.target.value) || 0)}
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
              </div>
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
              return (
                <div className="ap-spec" key={modo.configPasoId}>
                  <label>
                    {modosColorVisibles.length === 1
                      ? "Modo de color"
                      : `${humanizeCodigo(modo.familiaCodigo)} · color`}
                  </label>
                  {modo.options.length <= 3
                    ? renderSegmentedControl(
                        "Modo de color",
                        value,
                        modo.options.map((option) => ({
                          value: normalizeModoColor(option.value) ?? option.value,
                          label: option.label,
                        })),
                        (nextValue) => setModoColor(modo.configPasoId, nextValue),
                      )
                    : (
                        <select
                          className="ap-native-select"
                          value={value}
                          onChange={(event) => setModoColor(modo.configPasoId, event.target.value)}
                        >
                          {modo.options.map((option) => {
                            const optionValue = normalizeModoColor(option.value) ?? option.value;
                            return (
                              <option key={optionValue} value={optionValue}>
                                {option.label}
                              </option>
                            );
                          })}
                        </select>
                      )}
                </div>
              );
            })}

            {slotsMaterialesPrincipales.map((slot) => renderMaterialSelect(slot))}

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
          <div className="ap-qty">
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
              step={product.unidad === "m²" ? 0.1 : 1}
              min="0"
              onChange={(event) => setQty(Number.parseFloat(event.target.value) || 0)}
            />
            <span className="ap-qty-unit">{product.unidad}</span>
            <button type="button" className="ap-qty-btn" onClick={() => setQty(qty + 1)}>
              <PlusIcon />
            </button>
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
        {product.adicionales.length > 0 ? (
          <div className="ap-adicionales">
            {product.adicionales.map((adicional) => {
              const selected = adi.includes(adicional.code);
              const slotsPaso = slotsMaterialesOpcionalesPorPaso.get(adicional.code) ?? [];
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
                    <span className="cb">{selected ? <CheckIcon /> : null}</span>
                    <span className="lb">{adicional.name}</span>
                    <span className="mt mono">
                      {product.real
                        ? adicional.origen === "cargo"
                          ? "cargo"
                          : "paso"
                        : `+ ${formatCurrency(adicional.monto ?? 0)}`}
                    </span>
                  </button>
                  {product.real && selected && slotsPaso.length > 0 ? (
                    <div className="ap-optional-slots">
                      {slotsPaso.map((slot) => renderMaterialSelect(slot))}
                    </div>
                  ) : null}
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
            disabled={cotizando || !productoDetalle}
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
            <div className="ap-empty">
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
    () =>
      productos.length > 0
        ? productos.map(mapProductoReal)
        : CATALOG_PRODUCTS,
    [productos],
  );
  const isEditing = Boolean(editingItem);

  const totals = product ? getTotals(product, qty, adi) : null;
  const cotizacionExitosa = getCotizacionExitosa(cotizacion);

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
        nextProduct = {
          real: false,
          code: itemToEdit.productoCodigo,
          name: itemToEdit.productoNombre,
          family: itemToEdit.subcategoriaComercialNombre,
          categoriaComercialCodigo: itemToEdit.categoriaComercialCodigo,
          categoriaComercialNombre: itemToEdit.categoriaComercialNombre,
          subcategoriaComercialCodigo: itemToEdit.subcategoriaComercialCodigo,
          subcategoriaComercialNombre: itemToEdit.subcategoriaComercialNombre,
          cobro:
            itemToEdit.unidadMedida === "m2"
              ? "Por m²"
              : itemToEdit.unidadMedida === "metro_lineal"
                ? "Por metro lineal"
                : "Por unidad",
          unidad:
            itemToEdit.unidadMedida === "m2"
              ? "m²"
              : itemToEdit.unidadMedida === "metro_lineal"
                ? "ml"
                : "u.",
          medidasMode: itemToEdit.jobContext?.piezas ? "calculada" : "fija",
          precioBase: itemToEdit.precioUnitario,
          descripcion: itemToEdit.varianteNombre ?? itemToEdit.categoriaComercialNombre,
          specs: itemToEdit.atributosSchema.map((attr) => ({
            key: attr.key,
            label: attr.label,
            type: attr.tipo === "select" ? "select" : "text",
            def: itemToEdit.especificaciones[attr.key] ?? "",
          })),
          adicionales: itemToEdit.adicionales.map((adicional) => ({
            code: adicional,
            name: adicional,
            origen: "mock" as const,
          })),
          qtyDefault: itemToEdit.cantidad,
          costoUnitario: 0,
          impuestoPct: itemToEdit.impuestoPorcentaje,
        };
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
      setQty(getQtyFromItem(itemToEdit));
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
    setQty(next.qtyDefault);
    setSpecs(defaultSpecs(next));
    setAdi([]);
    setNotaProduccion("");
    setCotizacion(null);
    setCotizacionError(null);
    const rutaPreferida =
      detalle?.rutasAlternativas.find((ruta) => ruta.esPreferida) ??
      detalle?.rutasAlternativas[0] ??
      null;
    setMotorConfig({
      ...DEFAULT_MOTOR_CONFIG,
      rutaAlternativaId: rutaPreferida?.id ?? "",
      piezas:
        detalle?.modoMedidas === "LIBRE"
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
    const rutaSel = getRutaSeleccionada(productoDetalle, motorConfig.rutaAlternativaId);
    const slotsComercialElige = getSlotsComercialElige(rutaSel);
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
      const nextItem = buildItem(product, qty, specs, adi, {
        productoDetalle,
        motorConfig,
        slotsComercialElige: getSlotsComercialElige(rutaSel),
        cotizacion,
        notaProduccion,
        itemId: editingItem?.id,
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
