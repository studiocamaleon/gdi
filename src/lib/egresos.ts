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

/**
 * Qué comprobantes traen el IVA DISCRIMINADO.
 *
 * Es lo único que habilita el crédito fiscal, y por lo tanto lo único donde
 * tiene sentido cargar el IVA aparte:
 *   · Factura A y las notas que la ajustan — el IVA viene en su propio renglón.
 *   · Factura B — el IVA está adentro del precio y NO se discrimina: para el
 *     que compra, el importe es el importe.
 *   · Factura C (monotributista) — no hay IVA en absoluto.
 *   · Ticket, recibo y sin documento — tampoco.
 *
 * Pedir el IVA igual en esos casos no es sólo ruido en la pantalla: cualquier
 * número que se cargue ahí se lleva un crédito fiscal que no existe, y el
 * Libro IVA Compras sale mal.
 */
const COMPROBANTES_CON_IVA: readonly TipoComprobanteCompra[] = [
  "FA",
  "ND",
  "NC",
];

export function discriminaIva(tipo: string | null | undefined): boolean {
  return COMPROBANTES_CON_IVA.includes(tipo as TipoComprobanteCompra);
}

/**
 * Las alícuotas de IVA vigentes en Argentina. `null` = "a mano", para la
 * factura con dos alícuotas mezcladas o cuando el proveedor redondeó distinto
 * y el número tiene que coincidir con el papel.
 */
export const ALICUOTAS_IVA = [21, 10.5, 27, 5, 2.5, 0] as const;

/**
 * El IVA de un neto a una alícuota, redondeado a centavos.
 *
 * Redondea sobre centésimos y no sobre el float crudo: 10,5% de 1.234,55 da
 * 129,62775 y sin esto quedaría un total con seis decimales.
 */
export function ivaDeNeto(neto: number, alicuotaPct: number): number {
  return Math.round(neto * alicuotaPct) / 100;
}

/**
 * Largos del comprobante argentino: 4 dígitos el punto de venta, 8 el número.
 * Es la misma convención con la que el sistema los IMPRIME
 * (`notificaciones-comprobantes.service.ts`, `cuenta-corriente.service.ts`),
 * así que lo que se carga y lo que se muestra coinciden.
 */
export const LARGO_PUNTO_VENTA = 4;
export const LARGO_NUMERO_COMPROBANTE = 8;

/**
 * Rellena con ceros a la izquierda lo que se tipeó.
 *
 * Nadie escribe "0001" teniendo el 1 en la mano, pero el número guardado tiene
 * que coincidir con el del papel para que después se pueda buscar por él —y
 * para que el único de "misma factura del mismo proveedor" haga su trabajo:
 * "1" y "0001" son la misma factura y sin esto entrarían dos veces.
 *
 * Lo que no es sólo dígitos se deja intacto: si alguien pegó "0001-00012345"
 * o una letra, el dato es suyo y prefiero que lo vea a que se lo deformemos.
 */
export function completarCeros(valor: string, largo: number): string {
  const limpio = valor.trim();
  if (!limpio || !/^\d+$/.test(limpio)) return limpio;
  return limpio.padStart(largo, "0");
}

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

export const REGIMENES_RETENCION = [
  "SICORE_GANANCIAS",
  "IVA_RG2854",
  "IIBB_CONVENIO",
  "SUSS",
  "otro",
] as const;

export type RegimenRetencion = (typeof REGIMENES_RETENCION)[number];

export const REGIMEN_RETENCION_LABELS: Record<RegimenRetencion, string> = {
  SICORE_GANANCIAS: "Ganancias (SICORE)",
  IVA_RG2854: "IVA",
  IIBB_CONVENIO: "Ingresos brutos",
  SUSS: "SUSS",
  otro: "Otro",
};

/** Tramos de antigüedad — los mismos que Cuentas por cobrar. */
export const TRAMOS_AGING = [
  "a_vencer",
  "d0_30",
  "d31_60",
  "d61_90",
  "d90_mas",
] as const;

export type TramoAging = (typeof TRAMOS_AGING)[number];

export const TRAMO_AGING_LABELS: Record<TramoAging, string> = {
  a_vencer: "A vencer",
  d0_30: "0-30 días",
  d31_60: "31-60",
  d61_90: "61-90",
  d90_mas: "+90",
};

export type SaldoProveedor = {
  proveedorId: string | null;
  nombre: string;
  cuit: string | null;
  egresos: number;
  aging: Record<TramoAging, number>;
  total: number;
  /** Vencido hace más de 60 días: el KPI de riesgo. */
  vencidoGrave: number;
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

export const FRECUENCIAS_RECURRENTE = [
  "mensual",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
] as const;

export type FrecuenciaRecurrente = (typeof FRECUENCIAS_RECURRENTE)[number];

/** Índice por string: la frecuencia viaja como texto desde el API. */
export const FRECUENCIA_LABELS: Record<string, string> = {
  mensual: "Mensual",
  bimestral: "Cada 2 meses",
  trimestral: "Cada 3 meses",
  semestral: "Cada 6 meses",
  anual: "Anual",
};

export type GastoRecurrente = {
  id: string;
  descripcion: string;
  categoriaEgresoId: string;
  categoriaNombre: string;
  naturaleza: NaturalezaEgreso;
  proveedorId: string | null;
  proveedorNombre: string | null;
  /** Una SUGERENCIA: la luz no viene igual dos meses seguidos. */
  monto: number;
  moneda: string;
  frecuencia: string;
  diaVencimiento: number;
  /** 'YYYY-MM'. */
  vigenteDesde: string;
  vigenteHasta: string | null;
  gastoFijoEstructuraId: string | null;
  gastoFijoNombre: string | null;
  activo: boolean;
  ultimoPeriodoGenerado: string | null;
  egresosEmitidos: number;
};

export type LineaPresupuestado = {
  gastoFijoId: string;
  nombre: string;
  categoria: string;
  presupuestado: number;
  real: number;
  desvio: number;
  desvioPct: number | null;
  /** Sin egresos todavía: el desvío no significa nada. */
  sinRegistrar: boolean;
};

export type PresupuestadoVsReal = {
  periodo: string;
  lineas: LineaPresupuestado[];
  presupuestado: number;
  real: number;
  desvio: number;
  desvioPct: number | null;
  sinRegistrar: number;
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
