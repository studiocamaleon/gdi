/**
 * Egresos y Cuentas por pagar — contrato del frontend.
 * Espejo de apps/api/src/egresos/egresos.types.ts.
 * Ver docs/egresos-y-cuentas-por-pagar-diseno.md
 */

export const NATURALEZAS_EGRESO = [
  "COSTO_PRODUCCION",
  "GASTO_ESTRUCTURA",
  "INVERSION",
  "RETIRO_SOCIOS",
  "NO_RESULTADO",
] as const;

export type NaturalezaEgreso = (typeof NATURALEZAS_EGRESO)[number];

export const NATURALEZA_LABELS: Record<NaturalezaEgreso, string> = {
  COSTO_PRODUCCION: "Costo de producción",
  GASTO_ESTRUCTURA: "Gasto de estructura",
  INVERSION: "Inversión",
  RETIRO_SOCIOS: "Retiro de socios",
  NO_RESULTADO: "No incide en resultado",
};

/**
 * Ayuda corta por naturaleza, para que el usuario no tenga que leer el doc.
 * Es la única explicación que va a ver de por qué una multa no afecta la
 * tarifa de una máquina.
 */
export const NATURALEZA_AYUDA: Record<NaturalezaEgreso, string> = {
  COSTO_PRODUCCION: "Escala con el trabajo: material, tercerizado, consumibles.",
  GASTO_ESTRUCTURA: "Se paga igual haya o no trabajo: alquiler, sueldos, servicios.",
  INVERSION: "Sale plata pero no es gasto del mes: una máquina, una obra.",
  RETIRO_SOCIOS: "Distribución de utilidades. No es un gasto.",
  NO_RESULTADO: "Mueve la caja y nada más: adelantos, préstamos, ajustes.",
};

export const EGRESO_ESTADOS = [
  "pendiente",
  "parcial",
  "pagado",
  "anulado",
] as const;

export type EgresoEstado = (typeof EGRESO_ESTADOS)[number];

export const EGRESO_ESTADO_LABELS: Record<EgresoEstado, string> = {
  pendiente: "Pendiente",
  parcial: "Pago parcial",
  pagado: "Pagado",
  anulado: "Anulado",
};

export const TIPOS_COMPROBANTE_COMPRA = [
  "FA",
  "FB",
  "FC",
  "ND",
  "NC",
  "TICKET",
  "RECIBO",
  "SIN_DOCUMENTO",
] as const;

export type TipoComprobanteCompra = (typeof TIPOS_COMPROBANTE_COMPRA)[number];

export const TIPO_COMPROBANTE_LABELS: Record<TipoComprobanteCompra, string> = {
  FA: "Factura A",
  FB: "Factura B",
  FC: "Factura C",
  ND: "Nota de débito",
  NC: "Nota de crédito",
  TICKET: "Ticket",
  RECIBO: "Recibo",
  SIN_DOCUMENTO: "Sin documento",
};

export type CategoriaEgreso = {
  id: string;
  codigo: string;
  nombre: string;
  naturaleza: NaturalezaEgreso;
  esSistema: boolean;
  activo: boolean;
  orden: number;
  incideEnResultado: boolean;
};

export type Egreso = {
  id: string;
  numero: string;
  descripcion: string;
  beneficiarioNombre: string;
  proveedorId: string | null;
  proveedorNombre: string | null;
  categoriaEgresoId: string;
  categoriaNombre: string;
  naturaleza: NaturalezaEgreso | null;
  /** ISO date (YYYY-MM-DD). */
  fechaCompetencia: string;
  /** ISO date o null = fue de contado. */
  fechaVencimiento: string | null;
  moneda: string;
  neto: number;
  iva: number;
  otrosImpuestos: number;
  total: number;
  pagadoTotal: number;
  saldo: number;
  tipoComprobante: string | null;
  puntoVenta: string | null;
  numeroComprobante: string | null;
  estado: EgresoEstado;
  origen: string;
  anuladoEl: string | null;
  motivoAnulacion: string | null;
  registradoPorNombre: string | null;
  notas: string | null;
};

export type PagoDeEgreso = {
  id: string;
  numero: string;
  fecha: string;
  monto: number;
  metodoNombre: string;
  cuentaNombre: string;
  referencia: string | null;
  anuladoEl: string | null;
  motivoAnulacion: string | null;
  registradoPorNombre: string | null;
};

export type ResumenEgresos = {
  /** Saldo total que se debe (sólo egresos con vencimiento). */
  aPagar: number;
  vencido: number;
  estaSemana: number;
  /** Saldo sumado de las cuentas activas: el contraste que importa. */
  cuentas: number;
  egresosPendientes: number;
};

export type ReporteEgresos = {
  desde: string;
  hasta: string;
  /** Todo lo que salió de la caja en el período. */
  totalSalida: number;
  /** Sólo lo que es gasto: costo de producción + estructura. */
  totalResultado: number;
  egresos: number;
  naturalezas: Array<{
    naturaleza: NaturalezaEgreso;
    monto: number;
    pct: number;
    incideEnResultado: boolean;
  }>;
  categorias: Array<{
    categoriaId: string;
    nombre: string;
    naturaleza: NaturalezaEgreso;
    monto: number;
    pct: number;
    egresos: number;
  }>;
};

/**
 * Cuántos días faltan (negativo = vencido). Se calcula sobre fechas ISO en
 * texto para no arrastrar la zona horaria: comparar Date en SSR desalinea la
 * hidratación (ver src/lib/fecha.ts).
 */
export function diasHastaVencimiento(
  fechaVencimiento: string,
  hoyIso: string,
): number {
  const a = Date.parse(`${fechaVencimiento}T00:00:00Z`);
  const b = Date.parse(`${hoyIso}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

/** Etiqueta del vencimiento, en el lenguaje en que se pregunta. */
export function etiquetaVencimiento(dias: number): string {
  if (dias < -1) return `vencido hace ${Math.abs(dias)} días`;
  if (dias === -1) return "venció ayer";
  if (dias === 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  return `en ${dias} días`;
}

/** Tono del vencimiento para la fila: vencido, urgente o normal. */
export function tonoVencimiento(dias: number): "vencido" | "urgente" | "" {
  if (dias < 0) return "vencido";
  if (dias <= 7) return "urgente";
  return "";
}
