import type { CotizarResponse } from "@/lib/productos-servicios-api";

export type TipoPropuesta = "orden_trabajo" | "presupuesto";

export type UnidadPropuesta = "unidad" | "m2" | "metro_lineal";

type CotizacionMotorSnapshot = NonNullable<CotizarResponse["cotizacion"]>;

export type PasoProduccionPropuesta = {
  nombre: string;
  centroCosto: string;
  minutos: number;
  origen: "base" | "opcional" | "manual";
};

export type CostoPropuesta = {
  materiales: number;
  produccion: number;
  terminacion: number;
  terceros: number;
};

export type CosteoPropuestaSnapshot = {
  origen: "motor";
  cantidadEfectiva: number;
  cantidadPedida: number;
  cantidadComercialPricing?: number;
  unidadComercialPricing?: string;
  costos: CotizacionMotorSnapshot["costos"];
  pasos: CotizacionMotorSnapshot["pasos"];
  cargosDirectosCotizacion: CotizacionMotorSnapshot["cargosDirectosCotizacion"];
  desglosePrecio?: CotizacionMotorSnapshot["desglosePrecio"];
};

export type PropuestaItem = {
  id: string;
  productoNombre: string;
  productoCodigo: string;
  motorCodigo: string;
  categoriaComercialCodigo: string;
  categoriaComercialNombre: string;
  subcategoriaComercialCodigo: string;
  subcategoriaComercialNombre: string;
  varianteNombre?: string;
  unidadMedida: UnidadPropuesta;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  impuestoPorcentaje: number;
  impuestoMonto: number;
  total: number;
  fechaEntrega?: string;
  especificaciones: Record<string, string>;
  pasos: PasoProduccionPropuesta[];
  costos: CostoPropuesta;
  costeo?: CosteoPropuestaSnapshot;
  adicionales: string[];
  rutaAlternativaId?: string | null;
  jobContext?: Record<string, unknown>;
  atributosSchema: Array<{
    key: string;
    label: string;
    tipo: string;
    visible: boolean;
    orden: number;
  }>;
};

export type PropuestaResumen = {
  subtotal: number;
  impuestos: number;
  total: number;
  cantidadItems: number;
};

export type CatalogoPropuestaItem = {
  id: string;
  nombre: string;
  codigo: string;
  motorCodigo: string;
  categoriaComercialCodigo: string;
  categoriaComercialNombre: string;
  subcategoriaComercialCodigo: string;
  subcategoriaComercialNombre: string;
  descripcion: string;
  unidadMedida: UnidadPropuesta;
  precioUnitario: number;
  impuestoPorcentaje: number;
  especificaciones: Record<string, string>;
  pasos: PasoProduccionPropuesta[];
  costos: CostoPropuesta;
  adicionales: string[];
  atributosSchema: PropuestaItem["atributosSchema"];
};

export const MOCK_VENDEDOR = {
  id: "current",
  nombreCompleto: "Lucas Gomez",
};

export const CANALES_VENTA = [
  { value: "mostrador", label: "Mostrador" },
  { value: "web", label: "Web" },
  { value: "vendedor_externo", label: "Vendedor externo" },
  { value: "telefono", label: "Telefono" },
];

export const MOCK_CLIENTES_PROPUESTA = [
  { id: "mock-c1", nombre: "Grafica Corporearte" },
  { id: "mock-c2", nombre: "Distribuidora Norte S.A." },
  { id: "mock-c3", nombre: "Restaurant Don Carlos" },
];

export const MOCK_CATALOGO_PROPUESTA: CatalogoPropuestaItem[] = [
  {
    id: "cat-tarjetas",
    nombre: "Tarjetas personales",
    codigo: "TAR-001",
    motorCodigo: "impresion_digital_laser",
    categoriaComercialCodigo: "impresion_hoja",
    categoriaComercialNombre: "Impresión comercial en hoja",
    subcategoriaComercialCodigo: "tarjetas",
    subcategoriaComercialNombre: "Tarjetas",
    descripcion: "Digital laser sobre couche 300 g, doble faz.",
    unidadMedida: "unidad",
    precioUnitario: 68,
    impuestoPorcentaje: 21,
    especificaciones: {
      material: "Couche 300 g",
      medidas: "9 x 5 cm",
      impresion: "CMYK",
      caras: "Doble faz",
      terminacion: "Laminado mate",
    },
    atributosSchema: schemaAtributos([
      ["material", "Material"],
      ["medidas", "Medidas/Formato"],
      ["impresion", "Impresión"],
      ["caras", "Caras"],
      ["terminacion", "Terminación"],
    ]),
    pasos: [
      { nombre: "Preprensa", centroCosto: "Preprensa", minutos: 12, origen: "base" },
      { nombre: "Impresion digital", centroCosto: "Impresion", minutos: 28, origen: "base" },
      { nombre: "Corte guillotina", centroCosto: "Terminacion", minutos: 18, origen: "base" },
      { nombre: "Laminado mate", centroCosto: "Terminacion", minutos: 24, origen: "opcional" },
    ],
    costos: {
      materiales: 11800,
      produccion: 14800,
      terminacion: 8200,
      terceros: 0,
    },
    adicionales: ["Laminado mate", "Control de color"],
  },
  {
    id: "cat-vinilo",
    nombre: "Vinilo impreso con instalacion",
    codigo: "VIN-120",
    motorCodigo: "gran_formato",
    categoriaComercialCodigo: "gran_formato_flexible",
    categoriaComercialNombre: "Gran formato flexible",
    subcategoriaComercialCodigo: "vinilos_impresos",
    subcategoriaComercialNombre: "Vinilos impresos",
    descripcion: "Gran formato por m2 con viatico de instalacion.",
    unidadMedida: "m2",
    precioUnitario: 18500,
    impuestoPorcentaje: 21,
    especificaciones: {
      material: "Vinilo blanco brillante",
      medidas: "120 x 80 cm x 4",
      tecnologia: "Solvente",
      terminacion: "Laminado brillo",
      instalacion: "CABA",
    },
    atributosSchema: schemaAtributos([
      ["material", "Material"],
      ["medidas", "Medidas"],
      ["tecnologia", "Tecnología"],
      ["terminacion", "Terminación"],
      ["instalacion", "Instalación"],
    ]),
    pasos: [
      { nombre: "RIP y preprensa", centroCosto: "Preprensa", minutos: 10, origen: "base" },
      { nombre: "Impresion gran formato", centroCosto: "Gran formato", minutos: 42, origen: "base" },
      { nombre: "Laminado", centroCosto: "Terminacion", minutos: 25, origen: "opcional" },
      { nombre: "Instalacion", centroCosto: "Comercial", minutos: 90, origen: "manual" },
    ],
    costos: {
      materiales: 26400,
      produccion: 19800,
      terminacion: 10200,
      terceros: 3000,
    },
    adicionales: ["Viatico CABA", "Laminado brillo"],
  },
  {
    id: "cat-talonario",
    nombre: "Talonarios numerados",
    codigo: "TAL-050",
    motorCodigo: "talonario",
    categoriaComercialCodigo: "editorial_encuadernacion",
    categoriaComercialNombre: "Editorial, formularios y encuadernación",
    subcategoriaComercialCodigo: "talonarios",
    subcategoriaComercialNombre: "Talonarios",
    descripcion: "Duplicado, numerado, abrochado y embloc.",
    unidadMedida: "unidad",
    precioUnitario: 2800,
    impuestoPorcentaje: 21,
    especificaciones: {
      formato: "A5",
      copias_hojas: "Duplicado · 50 juegos",
      numeracion: "Correlativa",
      encuadernacion: "Abrochado + embloc",
      terminacion: "Tapa color",
    },
    atributosSchema: schemaAtributos([
      ["formato", "Formato"],
      ["copias_hojas", "Copias/Hojas"],
      ["numeracion", "Numeración"],
      ["encuadernacion", "Encuadernación"],
      ["terminacion", "Terminación"],
    ]),
    pasos: [
      { nombre: "Imposicion", centroCosto: "Preprensa", minutos: 18, origen: "base" },
      { nombre: "Impresion frente", centroCosto: "Impresion", minutos: 38, origen: "base" },
      { nombre: "Numerado", centroCosto: "Terminacion", minutos: 35, origen: "base" },
      { nombre: "Abrochado y embloc", centroCosto: "Terminacion", minutos: 48, origen: "base" },
    ],
    costos: {
      materiales: 32500,
      produccion: 22800,
      terminacion: 18400,
      terceros: 0,
    },
    adicionales: ["Numeracion correlativa", "Tapa color"],
  },
];

export const MOCK_ITEMS: PropuestaItem[] = [
  buildPropuestaItem(MOCK_CATALOGO_PROPUESTA[0], 500, "mock-item-1"),
  buildPropuestaItem(MOCK_CATALOGO_PROPUESTA[1], 3.84, "mock-item-2"),
  buildPropuestaItem(MOCK_CATALOGO_PROPUESTA[2], 25, "mock-item-3"),
];

export function offsetDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatUnidad(unidad: UnidadPropuesta) {
  if (unidad === "m2") return "m²";
  if (unidad === "metro_lineal") return "ml";
  return "u.";
}

export function calcularResumen(items: PropuestaItem[]): PropuestaResumen {
  return items.reduce<PropuestaResumen>(
    (acc, item) => ({
      subtotal: acc.subtotal + item.subtotal,
      impuestos: acc.impuestos + item.impuestoMonto,
      total: acc.total + item.total,
      cantidadItems: acc.cantidadItems + 1,
    }),
    { subtotal: 0, impuestos: 0, total: 0, cantidadItems: 0 },
  );
}

export function calcularCostoTotal(item: PropuestaItem) {
  if (item.costeo?.origen === "motor") {
    return item.costeo.costos.total;
  }

  return (
    item.costos.materiales +
    item.costos.produccion +
    item.costos.terminacion +
    item.costos.terceros
  );
}

function schemaAtributos(items: Array<[string, string]>): PropuestaItem["atributosSchema"] {
  return items.map(([key, label], index) => ({
    key,
    label,
    tipo: "text",
    visible: true,
    orden: (index + 1) * 10,
  }));
}

export function buildPropuestaItem(
  catalogoItem: CatalogoPropuestaItem,
  cantidad: number,
  id = crypto.randomUUID(),
): PropuestaItem {
  const subtotal = Math.round(catalogoItem.precioUnitario * cantidad);
  const impuestoMonto = Math.round(
    subtotal * (catalogoItem.impuestoPorcentaje / 100),
  );

  return {
    id,
    productoNombre: catalogoItem.nombre,
    productoCodigo: catalogoItem.codigo,
    motorCodigo: catalogoItem.motorCodigo,
    categoriaComercialCodigo: catalogoItem.categoriaComercialCodigo,
    categoriaComercialNombre: catalogoItem.categoriaComercialNombre,
    subcategoriaComercialCodigo: catalogoItem.subcategoriaComercialCodigo,
    subcategoriaComercialNombre: catalogoItem.subcategoriaComercialNombre,
    varianteNombre: catalogoItem.descripcion,
    unidadMedida: catalogoItem.unidadMedida,
    cantidad,
    precioUnitario: catalogoItem.precioUnitario,
    subtotal,
    impuestoPorcentaje: catalogoItem.impuestoPorcentaje,
    impuestoMonto,
    total: subtotal + impuestoMonto,
    especificaciones: catalogoItem.especificaciones,
    pasos: catalogoItem.pasos,
    costos: catalogoItem.costos,
    adicionales: catalogoItem.adicionales,
    atributosSchema: catalogoItem.atributosSchema,
  };
}
