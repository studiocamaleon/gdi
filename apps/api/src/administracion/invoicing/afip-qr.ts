/**
 * Código QR de los comprobantes electrónicos (RG 4892/2020).
 *
 * ARCA no genera el QR: lo arma el emisor. Es un JSON en base64 colgado de
 * una URL de ARCA; escaneándolo, cualquiera puede verificar el comprobante
 * contra sus registros.
 *
 * La norma exige que el QR esté SIEMPRE y que no tape ningún dato
 * obligatorio del comprobante.
 * https://www.afip.gob.ar/fe/qr/especificaciones.asp
 */

export type DatosQr = {
  /** ISO YYYY-MM-DD. */
  fecha: string;
  /** CUIT del emisor, 11 dígitos. */
  cuitEmisor: string;
  puntoVenta: number;
  /** Código de ARCA del tipo de comprobante (1 = Factura A…). */
  tipoComprobante: number;
  numero: number;
  importeTotal: number;
  /** 'PES' | 'DOL'. */
  moneda: string;
  cotizacion: number;
  /** 80 = CUIT, 96 = DNI, 99 = sin identificar. */
  tipoDocReceptor?: number | null;
  nroDocReceptor?: number | null;
  cae: string;
};

/**
 * URL que codifica el QR. El payload va en base64 en el parámetro `p`.
 * Los nombres de los campos los fija ARCA: no se pueden cambiar.
 */
export function construirUrlQr(d: DatosQr): string {
  const payload: Record<string, unknown> = {
    ver: 1,
    fecha: d.fecha,
    cuit: Number(d.cuitEmisor),
    ptoVta: d.puntoVenta,
    tipoCmp: d.tipoComprobante,
    nroCmp: d.numero,
    importe: d.importeTotal,
    moneda: d.moneda,
    ctz: d.cotizacion,
    tipoCodAut: 'E', // 'E' = CAE (electrónico). 'A' sería CAEA.
    codAut: Number(d.cae),
  };
  // Los del receptor sólo van si el comprobante lo identifica.
  if (d.tipoDocReceptor && d.nroDocReceptor) {
    payload.tipoDocRec = d.tipoDocReceptor;
    payload.nroDocRec = d.nroDocReceptor;
  }
  const base64 = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64',
  );
  return `https://www.afip.gob.ar/fe/qr/?p=${base64}`;
}
