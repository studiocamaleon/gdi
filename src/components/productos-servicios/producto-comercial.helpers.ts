"use client";

import type {
  MetodoCalculoPrecioProducto,
  ProductoPrecioComisionItem,
  ProductoPrecioComisionTipo,
  ProductoPrecioConfig,
  ProductoPrecioEspecialCliente,
  ProductoPrecioFilaCantidadMargen,
  ProductoPrecioFilaCantidadPrecio,
  ProductoPrecioFilaRangoMargen,
  ProductoPrecioFilaRangoPrecio,
  UnidadComercialProducto,
} from "@/lib/productos-servicios";
import { unidadComercialProductoItems } from "@/lib/productos-servicios";

export type PrecioComisionDraft = ProductoPrecioComisionItem;

export type PrecioEspecialClienteDraft = {
  id: string;
  clienteId: string;
  clienteNombre: string;
  descripcion: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  metodoCalculo: MetodoCalculoPrecioProducto;
  measurementUnit: string | null;
  detalle: Record<string, unknown>;
};

export const metodoCalculoPrecioLabels: Record<MetodoCalculoPrecioProducto, string> = {
  margen_variable: "Cantidad libre por margen variable",
  por_margen: "Precio fijo por margen fijo",
  precio_fijo: "Precio fijo",
  fijado_por_cantidad: "Cantidades fijas con precio fijo",
  fijo_con_margen_variable: "Cantidades fijas con margen variable",
  variable_por_cantidad: "Rangos de precio con precio fijo",
  precio_fijo_para_margen_minimo: "Precio fijo para margen mínimo",
};

export const metodoCalculoPrecioItems: Array<{ value: MetodoCalculoPrecioProducto; label: string }> = [
  { value: "margen_variable", label: metodoCalculoPrecioLabels.margen_variable },
  { value: "por_margen", label: metodoCalculoPrecioLabels.por_margen },
  { value: "precio_fijo", label: metodoCalculoPrecioLabels.precio_fijo },
  { value: "fijado_por_cantidad", label: metodoCalculoPrecioLabels.fijado_por_cantidad },
  { value: "fijo_con_margen_variable", label: metodoCalculoPrecioLabels.fijo_con_margen_variable },
  { value: "variable_por_cantidad", label: metodoCalculoPrecioLabels.variable_por_cantidad },
  { value: "precio_fijo_para_margen_minimo", label: metodoCalculoPrecioLabels.precio_fijo_para_margen_minimo },
];

export const precioComisionTipoLabels: Record<ProductoPrecioComisionTipo, string> = {
  financiera: "Financiera",
  vendedor: "Vendedor",
};

export const precioComisionTipoItems: Array<{ value: ProductoPrecioComisionTipo; label: string }> = [
  { value: "financiera", label: precioComisionTipoLabels.financiera },
  { value: "vendedor", label: precioComisionTipoLabels.vendedor },
];

export function getUnidadComercialProductoLabel(value: string | null | undefined) {
  return unidadComercialProductoItems.find((item) => item.value === value)?.label ?? value?.trim() ?? "Unidad";
}

function resolveUnidadComercialProducto(value: string | null | undefined): UnidadComercialProducto | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "unidad" || normalized === "unidades") return "unidad";
  if (normalized === "m2" || normalized === "m²" || normalized === "metro cuadrado" || normalized === "metros cuadrados") {
    return "m2";
  }
  if (
    normalized === "metro_lineal" ||
    normalized === "ml" ||
    normalized === "metro lineal" ||
    normalized === "metros lineales"
  ) {
    return "metro_lineal";
  }
  return null;
}

export function normalizeUnidadComercialProducto(value: string | null | undefined): UnidadComercialProducto {
  return resolveUnidadComercialProducto(value) ?? "unidad";
}

export function getUnidadComercialProductoSuffix(value: string | null | undefined) {
  const normalized = normalizeUnidadComercialProducto(value);
  if (normalized === "m2") return "m2";
  if (normalized === "metro_lineal") return "ml";
  return "unidad";
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}

export function formatCurrency(value: number) {
  return `$ ${formatNumber(value)}`;
}

export function buildDefaultPrecioDetalle(metodoCalculo: MetodoCalculoPrecioProducto) {
  if (metodoCalculo === "por_margen") {
    return { marginPct: 0, minimumMarginPct: 0 };
  }
  if (metodoCalculo === "precio_fijo") {
    return { price: 0, minimumPrice: 0 };
  }
  if (metodoCalculo === "precio_fijo_para_margen_minimo") {
    return { price: 0, minimumPrice: 0, minimumMarginPct: 0 };
  }
  if (metodoCalculo === "fijado_por_cantidad") {
    return { tiers: [{ quantity: 1, price: 0 }] as ProductoPrecioFilaCantidadPrecio[] };
  }
  if (metodoCalculo === "fijo_con_margen_variable") {
    return { tiers: [{ quantity: 1, marginPct: 0 }] as ProductoPrecioFilaCantidadMargen[] };
  }
  if (metodoCalculo === "variable_por_cantidad") {
    return { tiers: [{ quantityUntil: 1, price: 0 }] as ProductoPrecioFilaRangoPrecio[] };
  }
  return { tiers: [{ quantityUntil: 1, marginPct: 0 }] as ProductoPrecioFilaRangoMargen[] };
}

export function buildDefaultPrecioImpuestos() {
  return {
    esquemaId: null,
    esquemaNombre: "",
    items: [],
    porcentajeTotal: 0,
  };
}

export function buildDefaultPrecioComisiones() {
  return {
    esquemaId: null,
    esquemaIds: [] as string[],
    esquemaNombre: "",
    items: [] as ProductoPrecioComisionItem[],
    porcentajeTotal: 0,
  };
}

function clonePrecioDetalle(
  metodoCalculo: MetodoCalculoPrecioProducto,
  detalle: ProductoPrecioConfig["detalle"],
): ProductoPrecioConfig["detalle"] {
  if (metodoCalculo === "por_margen") {
    const current = detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "por_margen" }>["detalle"];
    return {
      marginPct: current.marginPct,
      minimumMarginPct: current.minimumMarginPct,
    };
  }
  if (metodoCalculo === "precio_fijo") {
    const current = detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "precio_fijo" }>["detalle"];
    return {
      price: current.price,
      minimumPrice: current.minimumPrice,
    };
  }
  if (metodoCalculo === "precio_fijo_para_margen_minimo") {
    const current = detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "precio_fijo_para_margen_minimo" }>["detalle"];
    return {
      price: current.price,
      minimumPrice: current.minimumPrice,
      minimumMarginPct: current.minimumMarginPct,
    };
  }
  if (metodoCalculo === "fijado_por_cantidad") {
    const current = detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijado_por_cantidad" }>["detalle"];
    return { tiers: current.tiers.map((tier) => ({ ...tier })) };
  }
  if (metodoCalculo === "fijo_con_margen_variable") {
    const current = detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>["detalle"];
    return { tiers: current.tiers.map((tier) => ({ ...tier })) };
  }
  if (metodoCalculo === "variable_por_cantidad") {
    const current = detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>["detalle"];
    return { tiers: current.tiers.map((tier) => ({ ...tier })) };
  }
  const current = detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>["detalle"];
  return { tiers: current.tiers.map((tier) => ({ ...tier })) };
}

export function buildPrecioConfigDraft(
  precio: ProductoPrecioConfig | null | undefined,
  measurementUnitFallback: string,
): ProductoPrecioConfig {
  const metodoCalculo = precio?.metodoCalculo ?? "margen_variable";
  const detalle = precio?.detalle ?? buildDefaultPrecioDetalle(metodoCalculo);
  return {
    metodoCalculo,
    measurementUnit: precio?.measurementUnit ?? measurementUnitFallback,
    impuestos: precio?.impuestos
      ? {
          esquemaId: precio.impuestos.esquemaId,
          esquemaNombre: precio.impuestos.esquemaNombre,
          items: precio.impuestos.items.map((item) => ({ ...item })),
          porcentajeTotal: precio.impuestos.porcentajeTotal,
        }
      : buildDefaultPrecioImpuestos(),
    comisiones: precio?.comisiones
      ? {
          esquemaId: precio.comisiones.esquemaId ?? null,
          esquemaIds: precio.comisiones.esquemaIds ?? (precio.comisiones.esquemaId ? [precio.comisiones.esquemaId] : []),
          esquemaNombre: precio.comisiones.esquemaNombre ?? "",
          items: precio.comisiones.items.map((item) => ({ ...item })),
          porcentajeTotal: precio.comisiones.porcentajeTotal,
        }
      : buildDefaultPrecioComisiones(),
    detalle: clonePrecioDetalle(metodoCalculo, detalle),
  } as ProductoPrecioConfig;
}

export function buildPrecioConfigForMethod(
  metodoCalculo: MetodoCalculoPrecioProducto,
  measurementUnit: string | null,
): ProductoPrecioConfig {
  return {
    metodoCalculo,
    measurementUnit,
    impuestos: buildDefaultPrecioImpuestos(),
    comisiones: buildDefaultPrecioComisiones(),
    detalle: buildDefaultPrecioDetalle(metodoCalculo),
  } as ProductoPrecioConfig;
}

export function buildPrecioComisionDraft(item?: ProductoPrecioComisionItem | null): PrecioComisionDraft {
  return {
    id: item?.id ?? crypto.randomUUID(),
    nombre: item?.nombre ?? "",
    tipo: item?.tipo ?? "financiera",
    porcentaje: item?.porcentaje ?? 0,
    activo: item?.activo ?? true,
  };
}

export function buildPrecioEspecialClienteDraft(
  item: ProductoPrecioEspecialCliente | null | undefined,
  measurementUnitFallback: string,
): PrecioEspecialClienteDraft {
  const now = new Date().toISOString();
  return {
    id: item?.id ?? crypto.randomUUID(),
    clienteId: item?.clienteId ?? "",
    clienteNombre: item?.clienteNombre ?? "",
    descripcion: item?.descripcion ?? "",
    activo: item?.activo ?? true,
    createdAt: item?.createdAt ?? now,
    updatedAt: item?.updatedAt ?? now,
    metodoCalculo: item?.metodoCalculo ?? "margen_variable",
    measurementUnit: item?.measurementUnit ?? measurementUnitFallback,
    detalle: clonePrecioDetalle(
      item?.metodoCalculo ?? "margen_variable",
      item?.detalle ?? buildDefaultPrecioDetalle(item?.metodoCalculo ?? "margen_variable"),
    ) as Record<string, unknown>,
  };
}

export function buildPrecioEspecialClienteFromDraft(
  draft: PrecioEspecialClienteDraft,
  clienteNombre: string,
  updatedAt: string,
): ProductoPrecioEspecialCliente {
  return {
    id: draft.id,
    clienteId: draft.clienteId,
    clienteNombre,
    descripcion: draft.descripcion,
    activo: draft.activo,
    createdAt: draft.createdAt,
    updatedAt,
    metodoCalculo: draft.metodoCalculo,
    measurementUnit: draft.measurementUnit,
    impuestos: buildDefaultPrecioImpuestos(),
    comisiones: buildDefaultPrecioComisiones(),
    detalle: draft.detalle as ProductoPrecioConfig["detalle"],
  } as ProductoPrecioEspecialCliente;
}

export function getPrecioMethodLabel(value: MetodoCalculoPrecioProducto) {
  return metodoCalculoPrecioLabels[value] ?? value;
}

export function getPrecioMethodDescription(value: MetodoCalculoPrecioProducto) {
  if (value === "margen_variable") return "Define márgenes por tramos para vender en cualquier cantidad.";
  if (value === "por_margen") return "El precio de venta se calcula desde el costo usando un margen fijo.";
  if (value === "precio_fijo") return "El precio de venta se define manualmente como un valor fijo único.";
  if (value === "fijado_por_cantidad") return "Define cantidades exactas habilitadas y un precio fijo para cada una.";
  if (value === "fijo_con_margen_variable") return "Define cantidades exactas habilitadas y un margen variable para cada una.";
  if (value === "variable_por_cantidad") return "Define rangos de cantidad con un precio fijo para cada tramo.";
  return "Define un precio fijo cuidando además el margen mínimo deseado.";
}

export function getPrecioEspecialClienteResumen(item: ProductoPrecioEspecialCliente | PrecioEspecialClienteDraft) {
  if (item.metodoCalculo === "por_margen") {
    const detail = item.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "por_margen" }>["detalle"];
    return `${detail.marginPct}%`;
  }
  if (item.metodoCalculo === "precio_fijo") {
    const detail = item.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "precio_fijo" }>["detalle"];
    return `${detail.price}`;
  }
  if (item.metodoCalculo === "fijado_por_cantidad") {
    const detail = item.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijado_por_cantidad" }>["detalle"];
    return detail.tiers.map((tier: ProductoPrecioFilaCantidadPrecio) => tier.quantity).join(", ");
  }
  if (item.metodoCalculo === "fijo_con_margen_variable") {
    const detail = item.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "fijo_con_margen_variable" }>["detalle"];
    return detail.tiers.map((tier: ProductoPrecioFilaCantidadMargen) => `${tier.quantity}: ${tier.marginPct}%`).join(", ");
  }
  if (item.metodoCalculo === "variable_por_cantidad") {
    const detail = item.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "variable_por_cantidad" }>["detalle"];
    return detail.tiers.map((tier: ProductoPrecioFilaRangoPrecio) => `Hasta ${tier.quantityUntil}`).join(", ");
  }
  const detail = item.detalle as Extract<ProductoPrecioConfig, { metodoCalculo: "margen_variable" }>["detalle"];
  return detail.tiers.map((tier: ProductoPrecioFilaRangoMargen) => `Hasta ${tier.quantityUntil}: ${tier.marginPct}%`).join(", ");
}
