/**
 * Administración (pagos / tesorería) — contrato de datos.
 * Espejo del módulo API `administracion`.
 * Ver docs/modulo-administracion-diseno.md
 */

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

export const PROVEEDORES_FACTURACION = ["manual", "tusfacturas"] as const;
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
