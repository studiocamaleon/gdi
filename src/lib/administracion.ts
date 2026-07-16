/**
 * Administración (pagos / tesorería) — contrato de datos.
 * Espejo del módulo API `administracion`.
 * Ver docs/modulo-administracion-diseno.md
 */

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
