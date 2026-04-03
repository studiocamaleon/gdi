// ---------------------------------------------------------------------------
// Propuestas – tipos, mock data y helpers
// ---------------------------------------------------------------------------

import type {
  ProductoPrecioConfig,
  CotizacionProductoVariante,
  GranFormatoCostosResponse,
  TipoImpresionProductoVariante,
  CarasProductoVariante,
  DimensionOpcionProductiva,
  ValorOpcionProductiva,
  UnidadComercialProducto,
} from "@/lib/productos-servicios";

export type TipoPropuesta = "orden_trabajo" | "presupuesto";

// ---------------------------------------------------------------------------
// Catalogo types (para buscar y agregar productos a una propuesta)
// ---------------------------------------------------------------------------

export type CatalogoVariante = {
  id: string;
  nombre: string;
  anchoMm: number;
  altoMm: number;
  papelNombre: string;
  tipoImpresion: TipoImpresionProductoVariante;
  caras: CarasProductoVariante;
  opcionesProductivas: Array<{
    dimension: DimensionOpcionProductiva;
    valores: ValorOpcionProductiva[];
  }> | null;
};

export type CatalogoProducto = {
  id: string;
  nombre: string;
  codigo: string;
  motorCodigo: string;
  unidadComercial: UnidadComercialProducto;
  variantes: CatalogoVariante[];
  precio: ProductoPrecioConfig;
  /** Costo unitario mock para simulacion de precio (se reemplazara con API real) */
  costoUnitarioMock: number;
};

// ---------------------------------------------------------------------------
// PropuestaItem (enriquecido con datos de producto real)
// ---------------------------------------------------------------------------

export type PropuestaItem = {
  id: string;
  // Identidad producto
  productoId: string;
  productoNombre: string;
  productoCodigo: string;
  motorCodigo: string;
  // Digital laser specific (opcional para otros motores)
  varianteId?: string;
  varianteNombre?: string;
  tipoImpresion?: TipoImpresionProductoVariante;
  caras?: CarasProductoVariante;
  anchoMm?: number;
  altoMm?: number;
  // Cantidad y precios (compartido)
  unidadMedida: UnidadComercialProducto;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  impuestoPorcentaje: number;
  impuestoMonto: number;
  total: number;
  // Configuracion de precio (para recalcular simulacion comercial)
  precioConfig?: ProductoPrecioConfig;
  // Fecha de entrega especifica (si no se define, hereda fechaEstimada de la orden)
  fechaEntrega?: string;
  // Display
  especificaciones: Record<string, string>;
  // Cotizacion digital (ruta de produccion, materiales, etc.)
  cotizacion: CotizacionProductoVariante | null;
  // Gran formato specific
  granFormato?: {
    tecnologia: string;
    medidas: Array<{ anchoMm: number; altoMm: number; cantidad: number }>;
    costosResponse: GranFormatoCostosResponse;
  };
};

export type PropuestaResumen = {
  subtotal: number;
  impuestos: number;
  total: number;
  cantidadItems: number;
};

// ---------------------------------------------------------------------------
// Mock data – Clientes, vendedor, canales
// ---------------------------------------------------------------------------

export const MOCK_CLIENTES = [
  { id: "c1", nombre: "Distribuidora Norte S.A." },
  { id: "c2", nombre: "Farmacia del Pueblo" },
  { id: "c3", nombre: "Estudio Juridico Ramirez & Asoc." },
  { id: "c4", nombre: "Municipalidad de San Martin" },
  { id: "c5", nombre: "Restaurant Don Carlos" },
  { id: "c6", nombre: "Imprenta Express SRL" },
];

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

// ---------------------------------------------------------------------------
// IVA helper (shared across mock pricing configs)
// ---------------------------------------------------------------------------

const IVA_21 = {
  esquemaId: null,
  esquemaNombre: "IVA 21%",
  items: [{ nombre: "IVA", porcentaje: 21 }],
  porcentajeTotal: 21,
};

const SIN_COMISIONES = {
  esquemaId: null,
  esquemaIds: [],
  esquemaNombre: "Sin comisiones",
  items: [],
  porcentajeTotal: 0,
};

// ---------------------------------------------------------------------------
// Mock catalogo de productos (Digital Laser)
// ---------------------------------------------------------------------------

export const MOCK_CATALOGO_PRODUCTOS: CatalogoProducto[] = [
  // 1. Tarjeta personal — fijado_por_cantidad, 2 variantes, opciones BN/CMYK + caras
  {
    id: "prod-1",
    nombre: "Tarjeta personal",
    codigo: "TAR-001",
    motorCodigo: "impresion_digital_laser",
    unidadComercial: "unidad",
    costoUnitarioMock: 5.8,
    precio: {
      metodoCalculo: "fijado_por_cantidad",
      measurementUnit: null,
      impuestos: IVA_21,
      comisiones: SIN_COMISIONES,
      detalle: {
        tiers: [
          { quantity: 100, price: 1800 },
          { quantity: 250, price: 3600 },
          { quantity: 500, price: 6200 },
          { quantity: 1000, price: 10500 },
        ],
      },
    },
    variantes: [
      {
        id: "var-1a",
        nombre: "Estandar 9x5 — Couche 300g",
        anchoMm: 90,
        altoMm: 50,
        papelNombre: "Couche 300g",
        tipoImpresion: "cmyk",
        caras: "doble_faz",
        opcionesProductivas: [
          { dimension: "tipo_impresion", valores: ["bn", "cmyk"] },
          { dimension: "caras", valores: ["simple_faz", "doble_faz"] },
        ],
      },
      {
        id: "var-1b",
        nombre: "Premium 9x5 — Opalina 250g",
        anchoMm: 90,
        altoMm: 50,
        papelNombre: "Opalina 250g",
        tipoImpresion: "cmyk",
        caras: "doble_faz",
        opcionesProductivas: [
          { dimension: "tipo_impresion", valores: ["bn", "cmyk"] },
          { dimension: "caras", valores: ["simple_faz", "doble_faz"] },
        ],
      },
    ],
  },

  // 2. Folleto A4 triptico — margen_variable, 1 variante, opciones BN/CMYK (caras fijo doble)
  {
    id: "prod-2",
    nombre: "Folleto A4 triptico",
    codigo: "FOL-042",
    motorCodigo: "impresion_digital_laser",
    unidadComercial: "unidad",
    costoUnitarioMock: 38,
    precio: {
      metodoCalculo: "margen_variable",
      measurementUnit: null,
      impuestos: IVA_21,
      comisiones: SIN_COMISIONES,
      detalle: {
        tiers: [
          { quantityUntil: 50, marginPct: 55 },
          { quantityUntil: 100, marginPct: 50 },
          { quantityUntil: 500, marginPct: 42 },
          { quantityUntil: 2000, marginPct: 35 },
        ],
      },
    },
    variantes: [
      {
        id: "var-2a",
        nombre: "A4 Couche 150g",
        anchoMm: 297,
        altoMm: 210,
        papelNombre: "Couche 150g",
        tipoImpresion: "cmyk",
        caras: "doble_faz",
        opcionesProductivas: [
          { dimension: "tipo_impresion", valores: ["bn", "cmyk"] },
        ],
      },
    ],
  },

  // 3. Volante media carta — precio_fijo, 1 variante, sin opciones productivas
  {
    id: "prod-3",
    nombre: "Volante media carta",
    codigo: "VOL-010",
    motorCodigo: "impresion_digital_laser",
    unidadComercial: "unidad",
    costoUnitarioMock: 15,
    precio: {
      metodoCalculo: "precio_fijo",
      measurementUnit: null,
      impuestos: IVA_21,
      comisiones: SIN_COMISIONES,
      detalle: {
        price: 45,
        minimumPrice: 35,
      },
    },
    variantes: [
      {
        id: "var-3a",
        nombre: "Media carta Bond 90g",
        anchoMm: 140,
        altoMm: 215,
        papelNombre: "Bond 90g",
        tipoImpresion: "cmyk",
        caras: "simple_faz",
        opcionesProductivas: null,
      },
    ],
  },

  // 4. Recibo media carta — fijo_con_margen_variable, 2 variantes, opciones solo caras
  {
    id: "prod-4",
    nombre: "Recibo media carta",
    codigo: "REC-005",
    motorCodigo: "impresion_digital_laser",
    unidadComercial: "unidad",
    costoUnitarioMock: 8,
    precio: {
      metodoCalculo: "fijo_con_margen_variable",
      measurementUnit: null,
      impuestos: IVA_21,
      comisiones: SIN_COMISIONES,
      detalle: {
        tiers: [
          { quantity: 500, marginPct: 50 },
          { quantity: 1000, marginPct: 42 },
          { quantity: 2000, marginPct: 35 },
        ],
      },
    },
    variantes: [
      {
        id: "var-4a",
        nombre: "BN — Bond 75g",
        anchoMm: 140,
        altoMm: 215,
        papelNombre: "Bond 75g",
        tipoImpresion: "bn",
        caras: "simple_faz",
        opcionesProductivas: [
          { dimension: "caras", valores: ["simple_faz", "doble_faz"] },
        ],
      },
      {
        id: "var-4b",
        nombre: "CMYK — Bond 75g",
        anchoMm: 140,
        altoMm: 215,
        papelNombre: "Bond 75g",
        tipoImpresion: "cmyk",
        caras: "simple_faz",
        opcionesProductivas: [
          { dimension: "caras", valores: ["simple_faz", "doble_faz"] },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Mock items pre-cargados en la propuesta (conforman al tipo enriquecido)
// ---------------------------------------------------------------------------

export const MOCK_ITEMS: PropuestaItem[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function calcularResumen(items: PropuestaItem[]): PropuestaResumen {
  let subtotal = 0;
  let impuestos = 0;

  for (const item of items) {
    subtotal += item.subtotal;
    impuestos += item.impuestoMonto;
  }

  return {
    subtotal,
    impuestos,
    total: subtotal + impuestos,
    cantidadItems: items.length,
  };
}

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

/**
 * Returns a date string (YYYY-MM-DD) offset from today by `days`.
 */
export function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Labels legibles para opciones de motor digital.
 */
export const LABEL_TIPO_IMPRESION: Record<TipoImpresionProductoVariante, string> = {
  bn: "Blanco y negro",
  cmyk: "Full color",
};

export const LABEL_CARAS: Record<CarasProductoVariante, string> = {
  simple_faz: "Simple faz",
  doble_faz: "Doble faz",
};

/**
 * Determina si un metodo de precio usa cantidades fijas.
 */
export function esCantidadFija(metodo: string): boolean {
  return metodo === "fijado_por_cantidad" || metodo === "fijo_con_margen_variable";
}

/**
 * Extrae las cantidades fijas de un ProductoPrecioConfig (solo para metodos fijos).
 */
export function getCantidadesFijas(precio: ProductoPrecioConfig): number[] {
  if (precio.metodoCalculo === "fijado_por_cantidad") {
    return precio.detalle.tiers.map((t) => t.quantity);
  }
  if (precio.metodoCalculo === "fijo_con_margen_variable") {
    return precio.detalle.tiers.map((t) => t.quantity);
  }
  return [];
}

/**
 * Construye el mapa de especificaciones para display en ItemRow.
 */
export function buildEspecificaciones(
  variante: CatalogoVariante,
  tipoImpresion: TipoImpresionProductoVariante,
  caras: CarasProductoVariante,
): Record<string, string> {
  return {
    Material: variante.papelNombre,
    Medidas: `${variante.anchoMm / 10} x ${variante.altoMm / 10} cm`,
    Impresion: LABEL_TIPO_IMPRESION[tipoImpresion],
    Caras: LABEL_CARAS[caras],
  };
}
