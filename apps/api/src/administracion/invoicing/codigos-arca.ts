/**
 * Códigos oficiales de ARCA. Salieron de consultarle sus propios
 * FEParamGet* el 2026-07-16, no de documentación de terceros.
 *
 * Los usa el provider (para emitir), el QR (que lleva el tipo) y el
 * comprobante impreso (el recuadro "COD. 01" es obligatorio).
 */

/** FEParamGetTiposCbte. */
export const CBTE_TIPO: Record<string, number> = {
  'factura:A': 1,
  'nota_debito:A': 2,
  'nota_credito:A': 3,
  'factura:B': 6,
  'nota_debito:B': 7,
  'nota_credito:B': 8,
  'factura:C': 11,
  'nota_debito:C': 12,
  'nota_credito:C': 13,
};

/**
 * La leyenda que reemplazó a la vieja factura M NO es un texto: es un tipo
 * de comprobante propio (RG 5762/2025). Sólo existe para "Operación Sujeta
 * a Retención"; "Pago en CBU informada" se imprime sobre una A normal.
 */
export const CBTE_TIPO_CON_RETENCION: Record<string, number> = {
  'factura:A': 51,
  'nota_debito:A': 52,
  'nota_credito:A': 53,
};

/** FEParamGetTiposIva: alícuota → Id de ARCA. */
export const IVA_ID: Record<number, number> = {
  0: 3,
  2.5: 9,
  5: 8,
  10.5: 4,
  21: 5,
  27: 6,
};

/** FEParamGetCondicionIvaReceptor — obligatorio desde la RG 5616. */
export const CONDICION_IVA_RECEPTOR: Record<string, number> = {
  RI: 1,
  monotributo: 6,
  exento: 4,
  consumidor_final: 5,
  exterior: 9,
};

/** Cómo se llama la condición del receptor EN EL COMPROBANTE (texto de ARCA). */
export const CONDICION_IVA_RECEPTOR_LABEL: Record<string, string> = {
  RI: 'IVA Responsable Inscripto',
  monotributo: 'Responsable Monotributo',
  exento: 'IVA Sujeto Exento',
  consumidor_final: 'Consumidor Final',
  exterior: 'Cliente del Exterior',
};

/** FEParamGetTiposDoc. */
export const DOC_TIPO_CUIT = 80;
export const DOC_TIPO_DNI = 96;
export const DOC_TIPO_SIN_IDENTIFICAR = 99;

/** Código que va en el recuadro de la letra: "COD. 01". */
export function codigoComprobante(
  tipo: string,
  letra: string,
  conRetencion = false,
): string {
  const clave = `${tipo}:${letra}`;
  const id =
    (conRetencion ? CBTE_TIPO_CON_RETENCION[clave] : undefined) ??
    CBTE_TIPO[clave];
  return id ? String(id).padStart(2, '0') : '—';
}

/**
 * Texto de un campo Json. Sólo acepta strings de verdad: si viniera un
 * objeto, String() lo convertiría en "[object Object]" y ese texto
 * terminaría impreso en un comprobante fiscal.
 */
export function texto(valor: unknown, porDefecto = ''): string {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : porDefecto;
}
