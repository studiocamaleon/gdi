/**
 * Contrato con el servicio que le pide el CAE a ARCA.
 *
 * La forma de esta interfaz está dictada por restricciones REALES, no del
 * intermediario. Las tres primeras salieron de investigar TusFacturasApp;
 * la cuarta apareció recién al emitir de verdad contra ARCA (2026-07-16):
 *
 * 1. NO HAY IDEMPOTENCIA. Reintentar a ciegas tras un timeout EMITE UNA
 *    SEGUNDA FACTURA FISCAL. Ante la duda se consulta, nunca se reintenta.
 * 2. LA EMISIÓN PUEDE SER ASINCRÓNICA: el CAE puede no venir en la misma
 *    llamada. Por eso el resultado contempla `en_cola`.
 * 3. NO EXISTE "ANULAR". En Argentina un comprobante emitido se anula
 *    emitiendo una nota de crédito que lo referencia. Por eso no hay
 *    método `anular`: es otro `emitir` con `asociados`.
 * 4. LA NUMERACIÓN LA MANDA ARCA, no nosotros. Nuestro contador sirve
 *    mientras no hay integración, pero al emitir de verdad el número tiene
 *    que salir de `ultimoNumero() + 1` o ARCA rechaza por correlatividad.
 *    Y como ARCA no conoce nuestra clave de idempotencia, la reconciliación
 *    va por (punto de venta, tipo, número) — el dato que asignamos ANTES de
 *    llamar. De ahí `consultarEmitido`.
 */

export type LetraProvider = 'A' | 'B' | 'C' | 'E';

export type ComprobanteItemProvider = {
  descripcion: string;
  cantidad: number;
  precioUnitarioSinIva: number;
  /** 21 | 10.5 | 27 | 0 | 'exento' | 'no_gravado' — el provider mapea. */
  alicuotaIva: number | 'exento' | 'no_gravado';
  bonificacionPct?: number;
};

export type ComprobanteAsociado = {
  tipo: string;
  puntoVenta: number;
  numero: number;
  fecha: string;
  cuit?: string | null;
};

export type EmitirInput = {
  /**
   * Clave anti-duplicado. Es el id de NUESTRO Comprobante: se persiste
   * antes del POST, así que si la llamada se cae podemos consultar por
   * ella en vez de reintentar.
   */
  idempotencyKey: string;
  tipo: 'factura' | 'nota_credito' | 'nota_debito';
  letra: LetraProvider;
  /** CUIT del emisor (11 dígitos). Con delegación, es el del TENANT. */
  emisorCuit?: string | null;
  puntoVenta: number;
  /** Ya resuelto: ARCA exige correlatividad, no lo asigna el provider. */
  numero: number | null;
  fecha: string;
  receptor: {
    razonSocial: string;
    cuit: string | null;
    condicionFiscal: string;
    domicilio?: string | null;
    email?: string | null;
  };
  items: ComprobanteItemProvider[];
  moneda: 'ARS' | 'USD';
  cotizacion?: number;
  /** Ya calculados por totales-comprobante.ts: el provider no recalcula. */
  netoGravado?: number;
  ivaTotal?: number;
  /**
   * Desglose por alícuota (totales-comprobante.ts). La B lo necesita ante
   * ARCA: discrimina internamente aunque el cliente no lo vea.
   */
  ivaPorAlicuota?: Array<{ alicuota: number; base: number; monto: number }>;
  total: number;
  condicionVenta?: string;
  vencimiento?: string | null;
  leyenda?: string | null;
  /** Para NC/ND: el comprobante que se está corrigiendo. */
  asociados?: ComprobanteAsociado[];
};

export type EmitirResultado =
  | {
      estado: 'emitido';
      numero: number;
      cae: string;
      caeVencimiento: string;
      pdfUrl?: string | null;
      qrUrl?: string | null;
      /** Respuesta cruda para auditar: los códigos de ARCA llegan como texto libre. */
      raw: unknown;
    }
  | {
      /** Encolado: el CAE llega después, por webhook o consultando. */
      estado: 'en_cola';
      raw: unknown;
    }
  | {
      estado: 'rechazado';
      /**
       * Mensajes tal cual los devuelve ARCA. NO parsear por código: no hay
       * tabla pública de códigos y los rechazos llegan como texto libre.
       */
      errores: string[];
      raw: unknown;
    };

export type PadronResultado = {
  razonSocial: string;
  condicionFiscal: string;
} | null;

export interface InvoicingProvider {
  readonly codigo: string;

  /**
   * Pide el CAE. NUNCA reintentar a ciegas ante un error de red: primero
   * `consultarEmitido(...)`.
   */
  emitir(input: EmitirInput): Promise<EmitirResultado>;

  /**
   * Estado de un comprobante ya enviado. Es la herramienta de
   * reconciliación: distingue "nunca llegó" de "se emitió y no me enteré".
   * Va por número porque es lo único que ARCA conoce de nosotros: nuestra
   * clave de idempotencia no viaja.
   */
  consultarEmitido(
    puntoVenta: number,
    tipo: EmitirInput['tipo'],
    letra: LetraProvider,
    numero: number,
    cuitEmisor?: string,
  ): Promise<EmitirResultado | null>;

  /**
   * Último número autorizado por ARCA para (punto de venta, tipo, letra).
   * null = el provider no lleva numeración y manda nuestro contador.
   */
  ultimoNumero(
    puntoVenta: number,
    tipo: EmitirInput['tipo'],
    letra: LetraProvider,
    cuitEmisor?: string,
  ): Promise<number | null>;

  /** Condición fiscal del receptor según el padrón. null si no se puede consultar. */
  consultarPadron(cuit: string): Promise<PadronResultado>;
}
