/**
 * Administración (pagos / tesorería) — contrato de datos.
 * Espejo del módulo API `administracion`.
 * Ver docs/modulo-administracion-diseno.md
 */

import { formatCuit } from "@/lib/clientes";

// ── Configuración fiscal del emisor (etapa C) ──────────────────────────

/** Un consumidor final no emite comprobantes. */
export const CONDICIONES_EMISOR = ["RI", "monotributo", "exento"] as const;
export type CondicionFiscalEmisor = (typeof CONDICIONES_EMISOR)[number];

export const CONDICION_EMISOR_LABELS: Record<CondicionFiscalEmisor, string> = {
  RI: "Responsable Inscripto",
  monotributo: "Monotributo",
  exento: "Exento",
};

/**
 * Leyendas que reemplazan a la vieja factura M desde la RG 5762/2025:
 * quien no acredita solvencia emite una A con leyenda, no una M.
 */
export const LEYENDAS_A = [
  "PAGO EN CBU INFORMADA",
  "OPERACIÓN SUJETA A RETENCIÓN",
] as const;
export type LeyendaA = (typeof LEYENDAS_A)[number];

export const MODALIDADES_PUNTO_VENTA = [
  "web_services",
  "portal",
  "talonario",
] as const;
export type ModalidadPuntoVenta = (typeof MODALIDADES_PUNTO_VENTA)[number];

export const MODALIDAD_PUNTO_VENTA_LABELS: Record<ModalidadPuntoVenta, string> =
  {
    web_services: "Web Services (factura electrónica por API)",
    portal: "Portal de ARCA (carga manual)",
    talonario: "Talonario preimpreso",
  };

/** "manual" = el CAE se carga a mano. "afipsdk" = se lo pedimos a ARCA. */
export const PROVEEDORES_FACTURACION = ["manual", "afipsdk"] as const;
export type ProveedorFacturacion = (typeof PROVEEDORES_FACTURACION)[number];

export type PuntoVenta = {
  id: string;
  numero: number;
  /** "0001" — como lo muestra ARCA. */
  numeroFormateado: string;
  nombre: string;
  modalidad: ModalidadPuntoVenta;
  activo: boolean;
};

export type ConfiguracionFiscal = {
  id: string;
  razonSocial: string;
  /** CUIT sin guiones (11 dígitos). */
  cuit: string;
  condicionFiscal: CondicionFiscalEmisor;
  ingresosBrutos: string | null;
  domicilioFiscal: string | null;
  /** ISO date YYYY-MM-DD. */
  inicioActividades: string | null;
  leyendaFacturaA: LeyendaA | null;
  proveedorFacturacion: ProveedorFacturacion;
  puntosVenta: PuntoVenta[];
};

export type LetraComprobante = "A" | "B" | "C" | "E";

export type LetraResultado = {
  letra: LetraComprobante;
  motivo: string;
  discriminaIva: boolean;
  exenta: boolean;
  leyenda?: LeyendaA;
};

const RECEPTOR_LABELS: Record<string, string> = {
  RI: "Responsable Inscripto",
  monotributo: "Monotributo",
  exento: "Exento",
  consumidor_final: "Consumidor Final",
  exterior: "del exterior",
};

/**
 * Espejo de apps/api/src/administracion/letra-comprobante.ts — la matriz
 * oficial de ARCA. Acá vive para que la pantalla de emisión sugiera la
 * letra en vivo al cambiar de cliente; la emisión real la revalida en el
 * backend, que es la fuente de verdad.
 *
 *            receptor →  | RI | Monotributo | Exento | Cons. final | Exterior
 *   emisor RI            | A  | A           | B      | B           | E
 *   emisor Monotributo   | C  | C           | C      | C           | E
 *   emisor Exento        | C  | C           | C      | C           | E
 *
 * La clase M ya no existe (RG 5762/2025): es una A con leyenda.
 */
export function letraComprobante(
  emisor: CondicionFiscalEmisor,
  receptor: string,
  leyendaEmisor?: LeyendaA | null,
): LetraResultado {
  if (receptor === "exterior") {
    return {
      letra: "E",
      motivo: "Operación de exportación → corresponde Factura E, sin IVA.",
      discriminaIva: false,
      exenta: true,
    };
  }

  if (emisor === "monotributo" || emisor === "exento") {
    const nombre = emisor === "monotributo" ? "Monotributo" : "Exento";
    return {
      letra: "C",
      motivo: `El emisor es ${nombre} → corresponde Factura C, sin discriminar IVA.`,
      discriminaIva: false,
      exenta: false,
    };
  }

  if (receptor === "RI" || receptor === "monotributo") {
    return {
      letra: "A",
      motivo:
        receptor === "RI"
          ? "Ambos son Responsable Inscripto → corresponde Factura A con IVA discriminado."
          : "El receptor es Monotributo → corresponde Factura A con IVA discriminado.",
      discriminaIva: true,
      exenta: false,
      ...(leyendaEmisor ? { leyenda: leyendaEmisor } : {}),
    };
  }

  return {
    letra: "B",
    motivo: `El receptor es ${RECEPTOR_LABELS[receptor] ?? receptor} → corresponde Factura B, IVA incluido en el precio.`,
    discriminaIva: false,
    exenta: false,
  };
}

// ── Aging / cuenta corriente (etapa C) ─────────────────────────────────

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

/** Color por tramo: cuanto más viejo, más rojo (como el diseño). */
export const TRAMO_AGING_COLOR: Record<TramoAging, string> = {
  a_vencer: "var(--ok)",
  d0_30: "var(--warn)",
  d31_60: "#d97706",
  d61_90: "var(--signal)",
  d90_mas: "var(--danger)",
};

export type Aging = Record<TramoAging, number>;

export type FilaDeudor = {
  /** null = fila "Mostrador / sin cliente" (sin cta. cte. navegable). */
  clienteId: string | null;
  nombre: string;
  cuit: string | null;
  aging: Aging;
  total: number;
  /** Vencido hace más de 60 días. */
  vencido: number;
  /** Eje fiscal, secundario: % de lo vendido que pasó por factura. */
  facturadoPct: number;
};

/**
 * Intensidad del heatmap: cuanto más grande el saldo dentro de su columna,
 * más saturada la celda; y cuanto más viejo el tramo, más rojo. Espejo del
 * cálculo del diseño (admin/Deudores.html).
 */
const HUE_TRAMO: Record<TramoAging, string> = {
  a_vencer: "150,60%",
  d0_30: "40,75%",
  d31_60: "32,80%",
  d61_90: "20,80%",
  d90_mas: "0,72%",
};

const ORDEN_TRAMO: Record<TramoAging, number> = {
  a_vencer: 0,
  d0_30: 1,
  d31_60: 2,
  d61_90: 3,
  d90_mas: 4,
};

export function colorCeldaAging(
  tramo: TramoAging,
  valor: number,
  maxColumna: number,
): string {
  if (valor <= 0) return "transparent";
  const idx = ORDEN_TRAMO[tramo];
  const t = maxColumna > 0 ? Math.min(1, valor / maxColumna) : 0;
  const luz = 96 - t * (idx >= 3 ? 52 : idx >= 1 ? 40 : 34);
  return `hsl(${HUE_TRAMO[tramo]},${luz}%)`;
}

export function colorTextoAging(
  tramo: TramoAging,
  valor: number,
  maxColumna: number,
): string {
  if (valor <= 0) return "var(--muted-text-2)";
  const idx = ORDEN_TRAMO[tramo];
  const t = maxColumna > 0 ? valor / maxColumna : 0;
  return t > 0.55 && idx >= 3 ? "#fff" : "var(--ink)";
}

export type MovimientoCuentaCorriente = {
  id: string;
  fecha: string;
  /** 'orden' = la OT finalizada al DEBE (deuda comercial); 'cobro' al HABER. */
  tipo: "orden" | "cobro" | "fa" | "nc" | "nd";
  sigla: string;
  descripcion: string;
  debe: number;
  haber: number;
  saldo: number;
  ordenId?: string;
  comprobanteId?: string;
  cobroId?: string;
  /** Eje fiscal del renglón de orden: cuánto pasó por factura. */
  facturado?: number;
  facturadoPct?: number;
  imputaciones?: Array<{ nombre: string; monto: number; resto?: boolean }>;
};

export type CuentaCorriente = {
  cliente: {
    id: string;
    nombre: string;
    razonSocial: string | null;
    cuit: string | null;
    condicionFiscal: string;
    limiteCredito: number | null;
    vendedor: string | null;
  };
  /** Positivo = el cliente debe. */
  saldo: number;
  comprobantesPendientes: number;
  /** null cuando no se definió límite de crédito. */
  usoLimitePct: number | null;
  excedido: boolean;
  excedente: number;
  aging: Aging;
  agingTotal: number;
  /** Del más nuevo al más viejo, con saldo corrido. */
  movimientos: MovimientoCuentaCorriente[];
};

// ── Comprobantes (etapa C) ─────────────────────────────────────────────

export const COMPROBANTE_TIPOS = [
  "factura",
  "nota_credito",
  "nota_debito",
] as const;
export type ComprobanteTipo = (typeof COMPROBANTE_TIPOS)[number];

/** Sigla del badge, como en el diseño. */
export const COMPROBANTE_TIPO_SIGLA: Record<ComprobanteTipo, string> = {
  factura: "FA",
  nota_credito: "NC",
  nota_debito: "ND",
};

export const COMPROBANTE_TIPO_LABELS: Record<ComprobanteTipo, string> = {
  factura: "Factura",
  nota_credito: "Nota de crédito",
  nota_debito: "Nota de débito",
};

export const COMPROBANTE_ESTADOS = [
  "borrador",
  "emitido",
  "rechazado",
  "anulado",
] as const;
export type ComprobanteEstado = (typeof COMPROBANTE_ESTADOS)[number];

export const COMPROBANTE_ESTADO_LABELS: Record<ComprobanteEstado, string> = {
  borrador: "Borrador",
  emitido: "Emitido",
  rechazado: "Rechazado",
  anulado: "Anulado",
};

export const CONDICIONES_VENTA = [
  "contado",
  "cuenta_corriente",
  "transferencia",
  "tarjeta",
  "otra",
] as const;
export type CondicionVenta = (typeof CONDICIONES_VENTA)[number];

export const CONDICION_VENTA_LABELS: Record<CondicionVenta, string> = {
  contado: "Contado",
  cuenta_corriente: "Cuenta corriente",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  otra: "Otra",
};

export type ComprobanteItem = {
  descripcion: string;
  cantidad: number;
  precioUnitarioSinIva: number;
  alicuotaIva: number | "exento" | "no_gravado";
  bonificacionPct?: number;
};

export type IvaPorAlicuota = {
  alicuota: number;
  base: number;
  monto: number;
};

export type Comprobante = {
  id: string;
  tipo: ComprobanteTipo;
  letra: LetraComprobante;
  puntoVentaNumero: string;
  numero: number | null;
  /** "A 0001-00000123". */
  numeroCompleto: string;
  fecha: string;
  clienteNombre: string;
  clienteCuit: string | null;
  /** Legacy: el primer vínculo. Preferir `ordenes`. */
  ordenId: string | null;
  ordenNumero: string | null;
  /** Vínculos con monto: cuánto de este comprobante aplica a cada orden. */
  ordenes: Array<{ ordenId: string; numero: string; monto: number }>;
  items: ComprobanteItem[];
  netoGravado: number;
  ivaPorAlicuota: IvaPorAlicuota[];
  ivaTotal: number;
  total: number;
  moneda: string;
  cotizacion: number | null;
  estado: ComprobanteEstado;
  cae: string | null;
  caeVencimiento: string | null;
  condicionVenta: string | null;
  vencimiento: string | null;
  leyenda: string | null;
  /** Errores de ARCA: llegan como texto libre, no hay tabla de códigos. */
  rechazo: { errores: string[] } | null;
  saldoPendiente: number;
  comprobanteOrigenId: string | null;
};

export type CobroImputado = {
  id: string;
  cobroId: string;
  fecha: string;
  metodoNombre: string;
  cuentaNombre: string;
  monto: number;
};

export type ComprobanteDetalle = Comprobante & {
  cobrosImputados: CobroImputado[];
};

// ── Facturación sobre órdenes ──────────────────────────────────────────
// La deuda es COMERCIAL (nace de la orden al finalizar); facturar es una
// acción opcional sobre la orden. Ver docs/facturacion-ordenes-deuda-comercial-diseno.md

export type OrdenFacturable = {
  ordenId: string;
  numero: string;
  estado: string;
  clienteId: string | null;
  clienteNombre: string | null;
  clienteCondicionFiscal: string | null;
  fechaFinalizada: string | null;
  total: number;
  facturado: number;
  cobrado: number;
  saldoSinFacturar: number;
};

export type ResultadoLoteFacturacion = {
  modo: "por_orden" | "agrupada";
  resultados: Array<{
    ordenId: string;
    numero: string;
    ok: boolean;
    comprobante: Comprobante | null;
    error: string | null;
  }>;
};

/** Estados derivados de una orden en sus dos ejes independientes. */
export function estadoFiscalOrden(
  total: number,
  facturado: number,
): "sin_facturar" | "parcial" | "facturada" {
  if (facturado <= 0.01) return "sin_facturar";
  return facturado >= total - 0.01 ? "facturada" : "parcial";
}

export function estadoCobranzaOrden(
  total: number,
  cobrado: number,
): "sin_cobrar" | "parcial" | "cobrada" {
  if (cobrado <= 0.01) return "sin_cobrar";
  return cobrado >= total - 0.01 ? "cobrada" : "parcial";
}

/**
 * El comprobante impreso. Su contenido lo fija la normativa, no nuestro
 * modelo: RG 1415 (datos), RG 4892 (QR), RG 5616 (condición del receptor)
 * y RG 5614 (transparencia fiscal al consumidor).
 */
export type FacturaDocumento = {
  emisor: {
    razonSocial: string;
    domicilioFiscal: string | null;
    condicionFiscal: string;
    cuit: string;
    ingresosBrutos: string | null;
    inicioActividades: string | null;
  };
  letra: LetraComprobante;
  /** El recuadro central: "COD. 01". Lo exige la norma. */
  codigoArca: string;
  tipoLabel: string;
  puntoVenta: string;
  numero: string;
  fecha: string;
  vencimientoPago: string | null;
  receptor: {
    razonSocial: string;
    cuit: string | null;
    domicilio: string | null;
    /** RG 5616: obligatorio desde 2025. */
    condicionFiscal: string;
  };
  condicionVenta: string;
  moneda: string;
  /** Sólo la A lleva columna de alícuota e IVA discriminado. */
  discriminaIva: boolean;
  items: Array<{
    codigo: string | null;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    alicuota: number | null;
    subtotal: number;
  }>;
  subtotal: number;
  ivaPorAlicuota: IvaPorAlicuota[];
  /** RG 5614: el IVA que lleva adentro un comprobante que no lo discrimina. */
  ivaContenido: number | null;
  otrosImpuestosIndirectos: number | null;
  otrosTributos: Array<{ descripcion: string; monto: number }>;
  otrosTributosTotal: number;
  total: number;
  cae: string | null;
  caeVencimiento: string | null;
  /** null mientras no haya CAE: sin autorización no hay nada que verificar. */
  qrUrl: string | null;
  leyendas: Array<{ codigo: string | null; texto: string }>;
  estado: ComprobanteEstado;
  ordenNumero: string | null;
};

export type ComprobantePendiente = {
  id: string;
  numeroCompleto: string;
  tipo: ComprobanteTipo;
  fecha: string;
  vencimiento: string | null;
  vencida: boolean;
  total: number;
  saldo: number;
};

/** CUIT con guiones, o "—" cuando el receptor no tiene (consumidor final). */
export function formatCuitODash(cuit: string | null): string {
  return cuit ? formatCuit(cuit) : "—";
}

/** "Con CAE" es distinto de "Emitido": el CAE puede cargarse después. */
export function estadoVisual(c: Pick<Comprobante, "estado" | "cae">): {
  clave: string;
  label: string;
} {
  if (c.estado === "emitido" && c.cae) return { clave: "cae", label: "Con CAE" };
  if (c.estado === "emitido") return { clave: "emitido", label: "Sin CAE" };
  return {
    clave: c.estado,
    label: COMPROBANTE_ESTADO_LABELS[c.estado] ?? c.estado,
  };
}

export const METODO_PAGO_TIPOS = [
  "efectivo",
  "transferencia",
  "billetera_qr",
  "tarjeta_debito",
  "tarjeta_credito",
  "cheque_echeq",
  "debito_automatico",
] as const;

export type MetodoPagoTipo = (typeof METODO_PAGO_TIPOS)[number];

export const METODO_PAGO_TIPO_LABELS: Record<MetodoPagoTipo, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  billetera_qr: "Billetera / QR",
  tarjeta_debito: "Tarjeta débito",
  tarjeta_credito: "Tarjeta crédito",
  cheque_echeq: "Cheque / Echeq",
  debito_automatico: "Débito automático",
};

export type MetodoPago = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: MetodoPagoTipo;
  comisionPct: number;
  ivaComisionPct: number;
  plazoAcreditacionDias: number;
  sufreRetencion: boolean;
  cuentaDestinoId: string | null;
  cuentaDestinoNombre: string | null;
  activo: boolean;
  orden: number;
};

export type CuentaFondosResumen = {
  id: string;
  nombre: string;
  tipo: string;
  moneda: string;
};

/**
 * Simulación de las cifras de un método sobre un monto base: comisión,
 * IVA sobre comisión y neto acreditado (las "3 cifras" sin retenciones,
 * que dependen de cada cobro).
 */
export function simularMetodo(
  metodo: Pick<MetodoPago, "comisionPct" | "ivaComisionPct">,
  base: number,
) {
  const comision = (base * metodo.comisionPct) / 100;
  const ivaComision = (comision * metodo.ivaComisionPct) / 100;
  return {
    base,
    comision,
    ivaComision,
    neto: base - comision - ivaComision,
  };
}

export function plazoAcreditacionLabel(dias: number): string {
  if (dias === 0) return "Inmediato";
  if (dias === 1) return "~1 día hábil";
  return `~${dias} días`;
}

// ── Tesorería ──────────────────────────────────────────────────────────

export type CuentaFondos = {
  id: string;
  tipo: string;
  nombre: string;
  banco: string | null;
  cbuAlias: string | null;
  moneda: string;
  saldo: number;
  ultimoMovimiento: string | null;
  activo: boolean;
};

export type TesoreriaKpis = {
  posicionArs: number;
  posicionUsd: number;
  efectivo: number;
  bancos: number;
  cajasActivas: number;
  cuentasArs: number;
  aAcreditar: number;
};

/** Una fila del detalle de "A acreditar": qué cobro es y cuándo entra. */
export type CobroPendienteAcreditacion = {
  id: string;
  fecha: string;
  fechaAcreditacionEstimada: string | null;
  metodoNombre: string;
  metodoTipo: string;
  cuentaDestinoNombre: string;
  clienteNombre: string | null;
  ordenId: string | null;
  ordenNumero: string | null;
  montoBruto: number;
  netoAcreditado: number;
  esCheque: boolean;
  valorEstado: string | null;
  valorNumero: string | null;
};

export type MovimientoFondos = {
  id: string;
  fecha: string;
  tipo: "entrada" | "salida";
  monto: number;
  concepto: string;
  origenTipo: "cobro" | "pago" | "transferencia" | "valor" | "ajuste_arqueo";
  ordenId: string | null;
  ordenNumero: string | null;
  saldoPosterior: number;
};

// ── Cobros ─────────────────────────────────────────────────────────────

export const RETENCION_REGIMENES = [
  "SIRCREB",
  "SIRTAC",
  "IIBB_CONVENIO",
  "SICORE_GANANCIAS",
  "IVA_RG2854",
  "PERCEPCION_IIBB",
] as const;

export const RETENCION_REGIMEN_LABELS: Record<string, string> = {
  SIRCREB: "SIRCREB",
  SIRTAC: "SIRTAC",
  IIBB_CONVENIO: "IIBB Convenio",
  SICORE_GANANCIAS: "SICORE (Ganancias)",
  IVA_RG2854: "IVA RG 2854",
  PERCEPCION_IIBB: "Percepción IIBB",
  otro: "Otro",
};

export type RetencionLinea = {
  regimen: string;
  jurisdiccion: string | null;
  base: number;
  alicuota: number;
  monto: number;
  nroComprobante: string | null;
};

export type Cobro = {
  id: string;
  fecha: string;
  ordenId: string | null;
  clienteId: string | null;
  clienteNombre: string | null;
  /** REC-AAAA-NNNN. El recibo es el documento del cobro. */
  numeroRecibo: string | null;
  /** "N° de operación" del medio de pago. */
  referencia: string | null;
  metodoNombre: string;
  metodoTipo: string;
  cuentaDestinoNombre: string;
  montoBruto: number;
  comisionPctAplicada: number;
  comisionMonto: number;
  comisionIvaMonto: number;
  netoAcreditado: number;
  retencionesTotal: number;
  disponibleReal: number;
  fechaAcreditacionEstimada: string | null;
  estadoAcreditacion: "pendiente" | "acreditado";
  notas: string | null;
  retenciones: RetencionLinea[];
  valor: { id: string; estado: string; numero: string } | null;
};
