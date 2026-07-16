/**
 * Contrato con el servicio que le pide el CAE a ARCA.
 *
 * La forma de esta interfaz está dictada por tres restricciones REALES que
 * salieron de investigar TusFacturasApp (16/07/2026), y que cualquier
 * proveedor que integremos va a compartir porque son de ARCA, no del
 * intermediario:
 *
 * 1. NO HAY IDEMPOTENCIA. TusFacturasApp lo dice con todas las letras: el
 *    `external_reference` "debe ser único" pero "no realiza ese control".
 *    Reintentar a ciegas tras un timeout EMITE UNA SEGUNDA FACTURA FISCAL.
 *    Por eso `emitir` recibe una `idempotencyKey` que sale de nuestro
 *    Comprobante y existe `consultarPorReferencia`: ante la duda se
 *    consulta, nunca se reintenta.
 * 2. LA EMISIÓN PUEDE SER ASINCRÓNICA. La respuesta sincrónica puede tardar
 *    más de 1m30s, y la doc recomienda encolar + webhook por resiliencia a
 *    las caídas de ARCA. Por eso el resultado contempla `en_cola`: el CAE
 *    puede no venir en la misma llamada.
 * 3. NO EXISTE "ANULAR". En Argentina un comprobante emitido se anula
 *    emitiendo una nota de crédito que lo referencia. Por eso no hay
 *    método `anular`: es otro `emitir` con `asociados`.
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
  puntoVenta: number;
  /** null → que lo asigne el provider. Con número explícito, ARCA valida duplicados. */
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
   * `consultarPorReferencia(idempotencyKey)`.
   */
  emitir(input: EmitirInput): Promise<EmitirResultado>;

  /**
   * Estado de un comprobante por nuestra clave de idempotencia. Es la
   * herramienta de reconciliación: distingue "nunca llegó" de "se emitió
   * y no me enteré".
   */
  consultarPorReferencia(
    idempotencyKey: string,
  ): Promise<EmitirResultado | null>;

  /** Último número autorizado por ARCA para (punto de venta, tipo, letra). */
  ultimoNumero(
    puntoVenta: number,
    tipo: EmitirInput['tipo'],
    letra: LetraProvider,
  ): Promise<number | null>;

  /** Condición fiscal del receptor según el padrón. null si no se puede consultar. */
  consultarPadron(cuit: string): Promise<PadronResultado>;
}
