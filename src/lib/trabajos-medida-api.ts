import { apiRequest } from "./api";
import type { CotizarResponse } from "./productos-servicios-api";
import type { PropuestaItem } from "./propuestas";
import type { Moneda } from "./moneda";

export type OperacionMedida = {
  clave: string;
  estacionId?: string | null;
  nombre: string;
  familiaCodigo: string;
  centroCostoId?: string | null;
  maquinaId?: string | null;
  horas?: number | null;
};
export type TrabajoMedidaInput = {
  nombre: string;
  descripcion: string;
  cantidad: number;
  unidad: PropuestaItem["unidadMedida"];
  precio: number;
  basePrecio: "TOTAL" | "UNITARIO";
  tipoPrecio: "FINAL" | "NETO";
  categoriaFiscal: "general" | "reducida" | "exento";
  costos: {
    modo?: "TOTAL" | "DESGLOSADO";
    totalEstimado?: number;
    materiales: number;
    detalleMateriales?: string;
    otros: Array<{ nombre: string; costo: number }>;
  };
  produccion: boolean;
  operaciones: OperacionMedida[];
  rutaOrigenId?: string | null;
  tipoCambioId?: string;
  periodo?: string;
  clienteId?: string | null;
  cotizacionId?: string;
  anteriorItemId?: string;
  huellaCalculo?: string;
  descuento?: { tipo: "PORCENTAJE" | "MONTO"; valor: number } | null;
};
export type OpcionesMedida = {
  moneda: Moneda;
  periodo: string;
  centros: Array<{ id: string; nombre: string; tarifaHora: number | null }>;
  maquinas: Array<{
    id: string;
    nombre: string;
    centroCostoPrincipalId: string | null;
    estacionId: string | null;
  }>;
  estaciones: Array<{ id: string; nombre: string }>;
  rutas: Array<{
    id: string;
    nombre: string;
    pasos: Array<{ id: string; nombre: string; familiaCodigo: string }>;
  }>;
};
export type CalculoMedida = {
  result: CotizarResponse & {
    cotizacion: NonNullable<CotizarResponse["cotizacion"]>;
  };
  huellaCalculo: string;
  resumen: {
    estimacionParcial: boolean;
    costoTotal: number;
    costosVariables: number;
    margen: number;
    contribucion: number;
    neto: number;
    impuestos: number;
    total: number;
  };
  cotizacionId?: string;
  cotizacionItemId?: string;
};
export const opcionesTrabajoMedida = () =>
  apiRequest<OpcionesMedida>("/trabajos-medida/opciones");
export const obtenerTrabajoMedida = (id: string) =>
  apiRequest<TrabajoMedidaInput>(`/trabajos-medida/${encodeURIComponent(id)}`);
export const calcularTrabajoMedida = (input: TrabajoMedidaInput) =>
  apiRequest<CalculoMedida>("/trabajos-medida/calcular", {
    method: "POST",
    body: JSON.stringify(input),
  });
export const guardarTrabajoMedida = (input: TrabajoMedidaInput) =>
  apiRequest<CalculoMedida>("/trabajos-medida/guardar", {
    method: "POST",
    body: JSON.stringify(input),
  });
export function trabajoMedidaDe(
  item: Pick<PropuestaItem, "jobContext">,
): TrabajoMedidaInput | null {
  const v = item.jobContext?.trabajoMedida;
  return v && typeof v === "object" ? (v as TrabajoMedidaInput) : null;
}

export function itemDesdeTrabajoMedida(
  calculo: CalculoMedida,
  anterior?: PropuestaItem | null,
): PropuestaItem {
  const cotizacion = calculo.result.cotizacion;
  const input = cotizacion.trabajoMedida!;
  const precio = cotizacion.desglosePrecio!;
  return {
    ...anterior,
    id: anterior?.id ?? crypto.randomUUID(),
    cotizacionItemId: calculo.cotizacionItemId,
    trabajoMedidaHuella: calculo.huellaCalculo,
    productoNombre: input.nombre,
    productoCodigo: "A-MEDIDA",
    motorCodigo: "",
    categoriaComercialCodigo: "trabajos_medida",
    categoriaComercialNombre: "Trabajos a medida",
    subcategoriaComercialCodigo: "estimado",
    subcategoriaComercialNombre: "Costo estimado",
    unidadMedida: input.unidad,
    cantidad: input.cantidad,
    precioUnitario: precio.precioBrutoTotal / input.cantidad,
    subtotal: precio.precioNetoTotal,
    impuestoPorcentaje: precio.precioNetoTotal
      ? (precio.precioBrutoTotal / precio.precioNetoTotal - 1) * 100
      : 0,
    impuestoMonto: precio.precioBrutoTotal - precio.precioNetoTotal,
    total: precio.precioBrutoTotal,
    especificaciones: { descripcion: input.descripcion },
    atributosSchema: [
      {
        key: "descripcion",
        label: "Descripción del trabajo",
        tipo: "text",
        visible: true,
        orden: 0,
      },
    ],
    cotizacion,
    pasos: input.produccion
      ? cotizacion.pasos.map((p) => ({
          nombre: p.nombreVisible || "Trabajo a medida",
          centroCosto: p.tiempo?.centroCostoNombre || "",
          minutos: p.tiempo?.totalMin ?? 0,
          origen: "manual" as const,
        }))
      : [],
    adicionales: [],
    notaProduccion: input.descripcion,
    jobContext: {
      cantidad: input.cantidad,
      notasProduccion: input.descripcion,
      trabajoMedida: input,
    },
    descuentoInput: input.descuento ?? null,
  };
}

/** Revisa que el guardado no cambie el cálculo que aceptó el usuario. */
export async function persistirTrabajoMedida(
  item: PropuestaItem,
  contexto: { cotizacionId?: string; clienteId?: string | null },
) {
  const input = trabajoMedidaDe(item);
  if (!input) throw new Error("Faltan los datos del trabajo a medida.");
  const request = { ...input, ...contexto };
  // Guardar vuelve a calcular en el servidor y rechaza una huella vencida.
  if (item.trabajoMedidaHuella)
    return guardarTrabajoMedida({
      ...request,
      tipoCambioId: input.tipoCambioId ?? item.cotizacion?.tipoCambio?.id,
      huellaCalculo: item.trabajoMedidaHuella,
    });

  // Los borradores anteriores a la huella sólo conservan sus importes.
  const calculo = await calcularTrabajoMedida(request);
  if (
    Math.abs(calculo.resumen.total - item.total) > 0.005 ||
    Math.abs(calculo.resumen.neto - item.subtotal) > 0.005 ||
    (item.cotizacion?.costos?.total != null &&
      Math.abs(calculo.resumen.costoTotal - item.cotizacion.costos.total) > 0.005)
  )
    throw new Error(
      `El cálculo de «${item.productoNombre}» cambió. Abrí el trabajo y revisá los importes antes de guardar.`,
    );
  return guardarTrabajoMedida({
    ...request,
    tipoCambioId: calculo.result.cotizacion.tipoCambio?.id,
    huellaCalculo: calculo.huellaCalculo,
  });
}
