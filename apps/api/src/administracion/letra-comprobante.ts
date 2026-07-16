/**
 * Matriz de letra de comprobante (AR) — la regla fiscal más delicada del
 * módulo: define qué clase se emite y si el IVA va discriminado.
 *
 * Fuente: ARCA, Régimen general de facturación
 * https://www.afip.gob.ar/facturacion/regimen-general/comprobantes.asp
 *
 *            receptor →  | RI | Monotributo | Exento | Cons. final | Exterior
 *   emisor RI            | A  | A           | B      | B           | E
 *   emisor Monotributo   | C  | C           | C      | C           | E
 *   emisor Exento        | C  | C           | C      | C           | E
 *
 * La clase M fue ABROGADA por la RG 5762/2025 (vigente 01/12/2025): quien
 * no acredita solvencia patrimonial emite igual una A, pero con leyenda
 * ("PAGO EN CBU INFORMADA" u "OPERACIÓN SUJETA A RETENCIÓN"). Por eso acá
 * la leyenda es un atributo del emisor y no una letra aparte.
 */

/** Quien emite: un consumidor final no puede emitir comprobantes. */
export const CONDICIONES_EMISOR = ['RI', 'monotributo', 'exento'] as const;
export type CondicionFiscalEmisor = (typeof CONDICIONES_EMISOR)[number];

export const CONDICIONES_RECEPTOR = [
  'RI',
  'monotributo',
  'exento',
  'consumidor_final',
  'exterior',
] as const;
export type CondicionFiscalReceptor = (typeof CONDICIONES_RECEPTOR)[number];

export const LETRAS = ['A', 'B', 'C', 'E'] as const;
export type LetraComprobante = (typeof LETRAS)[number];

/** Leyendas que reemplazan a la vieja factura M (RG 5762/2025). */
export const LEYENDAS_A = [
  'PAGO EN CBU INFORMADA',
  'OPERACIÓN SUJETA A RETENCIÓN',
] as const;
export type LeyendaA = (typeof LEYENDAS_A)[number];

export type LetraResultado = {
  letra: LetraComprobante;
  /** Explicación para mostrar al usuario junto a la letra sugerida. */
  motivo: string;
  /** true → el IVA se discrimina línea por línea (sólo la A). */
  discriminaIva: boolean;
  /** true → la operación no lleva IVA (exportación). */
  exenta: boolean;
  /** Leyenda obligatoria en la A, si el emisor la tiene asignada. */
  leyenda?: LeyendaA;
};

const LABEL: Record<CondicionFiscalReceptor, string> = {
  RI: 'Responsable Inscripto',
  monotributo: 'Monotributo',
  exento: 'Exento',
  consumidor_final: 'Consumidor Final',
  exterior: 'del exterior',
};

/**
 * Devuelve la letra que corresponde emitir y por qué.
 *
 * @param emisor condición fiscal del tenant (ConfiguracionFiscal)
 * @param receptor condición fiscal del cliente
 * @param leyendaEmisor leyenda que ARCA le asignó al emisor para sus A
 */
export function letraComprobante(
  emisor: CondicionFiscalEmisor,
  receptor: CondicionFiscalReceptor,
  leyendaEmisor?: LeyendaA | null,
): LetraResultado {
  // La exportación manda sobre todo lo demás: siempre E y sin IVA.
  if (receptor === 'exterior') {
    return {
      letra: 'E',
      motivo: 'Operación de exportación → corresponde Factura E, sin IVA.',
      discriminaIva: false,
      exenta: true,
    };
  }

  if (emisor === 'monotributo' || emisor === 'exento') {
    const nombre = emisor === 'monotributo' ? 'Monotributo' : 'Exento';
    return {
      letra: 'C',
      motivo: `El emisor es ${nombre} → corresponde Factura C, sin discriminar IVA.`,
      discriminaIva: false,
      exenta: false,
    };
  }

  // Emisor RI de acá en adelante.
  if (receptor === 'RI' || receptor === 'monotributo') {
    return {
      letra: 'A',
      motivo:
        receptor === 'RI'
          ? 'Ambos son Responsable Inscripto → corresponde Factura A con IVA discriminado.'
          : 'El receptor es Monotributo → corresponde Factura A con IVA discriminado.',
      discriminaIva: true,
      exenta: false,
      ...(leyendaEmisor ? { leyenda: leyendaEmisor } : {}),
    };
  }

  return {
    letra: 'B',
    motivo: `El receptor es ${LABEL[receptor]} → corresponde Factura B, IVA incluido en el precio.`,
    discriminaIva: false,
    exenta: false,
  };
}

/**
 * Una Factura A exige CUIT del receptor: sin él ARCA rechaza la emisión.
 * Devuelve el motivo del bloqueo, o null si se puede emitir.
 */
export function bloqueoEmision(
  letra: LetraComprobante,
  receptorCuit: string | null,
): string | null {
  if (letra === 'A' && !receptorCuit) {
    return 'Una Factura A necesita el CUIT del receptor. Cargalo en la ficha del cliente.';
  }
  return null;
}
