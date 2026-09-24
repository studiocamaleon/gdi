import type {
  FrecuenciaGastoFijo,
  GastoFijo,
  GastoFijoPayload,
} from "@/lib/gastos-fijos-api";
import { numeroMoneda, parsearMonto, type Moneda } from "@/lib/moneda";

export type FormularioGastoFijo = {
  nombre: string;
  valor: string;
  frecuencia: FrecuenciaGastoFijo;
  metodoPagoId: string;
  proveedorId: string;
  notas: string;
  categoriaEgresoId: string;
  documento: string;
  vigenteDesde: string;
  fin: "nunca" | "en" | "despues";
  vigenteHasta: string;
  repeticiones: string;
  generarObligaciones: boolean;
  generarDesde: string;
  diaVencimiento: string;
};

export const CUOTAS_POR_ANIO: Record<FrecuenciaGastoFijo, number> = {
  MENSUAL: 12,
  BIMESTRAL: 6,
  TRIMESTRAL: 4,
  SEMESTRAL: 2,
  ANUAL: 1,
};

export function periodoActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

export function formularioVacio(categoriaEgresoId = ""): FormularioGastoFijo {
  return {
    nombre: "",
    valor: "",
    frecuencia: "MENSUAL",
    metodoPagoId: "",
    proveedorId: "",
    notas: "",
    categoriaEgresoId,
    documento: "",
    vigenteDesde: periodoActual(),
    fin: "nunca",
    vigenteHasta: "",
    repeticiones: "",
    generarObligaciones: false,
    generarDesde: periodoActual(),
    diaVencimiento: "10",
  };
}

export function desdeGasto(g: GastoFijo, moneda: Moneda): FormularioGastoFijo {
  return {
    nombre: g.nombre,
    valor: numeroMoneda(g.valor, moneda),
    frecuencia: g.frecuencia,
    metodoPagoId: g.metodoPagoId ?? "",
    proveedorId: g.proveedorId ?? "",
    notas: g.notas ?? "",
    categoriaEgresoId: g.categoriaEgresoId,
    documento: g.documento ?? "",
    vigenteDesde: g.vigenteDesde,
    fin: g.vigenteHasta ? "en" : "nunca",
    vigenteHasta: g.vigenteHasta ?? "",
    repeticiones: "",
    generarObligaciones: g.programacion?.activa ?? false,
    generarDesde:
      g.programacion?.desde ??
      (g.vigenteDesde > periodoActual() ? g.vigenteDesde : periodoActual()),
    diaVencimiento: String(g.programacion?.diaVencimiento ?? 10),
  };
}

/** Último mes incluido: una cuota anual cubre doce meses, también al cruzar de año. */
export function calcularVigenteHasta(f: FormularioGastoFijo): string | null {
  if (f.fin === "nunca") return null;
  if (f.fin === "en") return f.vigenteHasta || null;
  const repeticiones = Number(f.repeticiones);
  const [anio, mes] = f.vigenteDesde.split("-").map(Number);
  if (!anio || !mes || !Number.isInteger(repeticiones) || repeticiones < 1)
    return null;
  const indice =
    anio * 12 +
    mes -
    1 +
    repeticiones * (12 / CUOTAS_POR_ANIO[f.frecuencia]) -
    1;
  return `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, "0")}`;
}

export function vigenteEnMes(g: GastoFijo, mes: string) {
  return (
    g.activo &&
    g.vigenteDesde <= mes &&
    (!g.vigenteHasta || g.vigenteHasta >= mes)
  );
}

export function payloadGastoFijo(
  f: FormularioGastoFijo,
  moneda: Moneda,
  activo: boolean,
): GastoFijoPayload {
  const valor = parsearMonto(f.valor, moneda);
  if (valor === null || valor < 0)
    throw new Error("Ingresá un importe válido, igual o mayor a cero.");
  if (!f.nombre.trim()) throw new Error("El gasto necesita una descripción.");
  if (!f.categoriaEgresoId)
    throw new Error("Elegí una categoría para el gasto.");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(f.vigenteDesde))
    throw new Error("Elegí el mes de inicio de la vigencia.");
  const hasta = calcularVigenteHasta(f);
  if (f.fin !== "nunca" && !hasta)
    throw new Error(
      f.fin === "en"
        ? "Elegí el mes de fin de la vigencia."
        : "Ingresá una cantidad entera de períodos, mayor a cero.",
    );
  if (hasta && hasta < f.vigenteDesde)
    throw new Error("La vigencia no puede terminar antes de empezar.");
  if (f.generarObligaciones) {
    if (valor <= 0)
      throw new Error("La generación necesita un importe mayor que cero.");
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(f.generarDesde) ||
      f.generarDesde < f.vigenteDesde ||
      (hasta && f.generarDesde > hasta)
    )
      throw new Error(
        "Elegí un inicio de generación dentro de la vigencia del gasto.",
      );
    if (
      !Number.isInteger(Number(f.diaVencimiento)) ||
      Number(f.diaVencimiento) < 1 ||
      Number(f.diaVencimiento) > 31
    )
      throw new Error("El día de vencimiento debe estar entre 1 y 31.");
  }
  return {
    nombre: f.nombre.trim(),
    categoriaEgresoId: f.categoriaEgresoId,
    valor,
    frecuencia: f.frecuencia,
    proveedorId: f.proveedorId || null,
    metodoPagoId: f.metodoPagoId || null,
    documento: f.documento.trim() || null,
    vigenteDesde: f.vigenteDesde,
    vigenteHasta: hasta,
    notas: f.notas.trim() || null,
    activo,
    programacion: {
      activa: f.generarObligaciones,
      desde: f.generarObligaciones ? f.generarDesde : f.vigenteDesde,
      diaVencimiento: f.generarObligaciones ? Number(f.diaVencimiento) : 10,
    },
  };
}
