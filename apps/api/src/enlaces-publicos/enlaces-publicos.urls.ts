import { TipoEnlacePublico } from '@prisma/client';

/**
 * Prefijo de una letra por tipo de link, en la URL que ve el cliente:
 * grafoprint.com.ar/t/aB3xK9mQ2wZ7
 *
 * El mapa está completo de entrada a propósito — asignar letras de a una lleva
 * a quedarse pintado en un rincón (pago y presupuesto se pelean la `p`, por
 * eso cobro se lleva la `c`). Una letra NO se repinta: cambiarla invalida
 * links que ya viajaron por WhatsApp. Espejo de src/lib/enlaces-publicos.ts
 */
export const PREFIJO_ENLACE: Record<TipoEnlacePublico, string> = {
  SEGUIMIENTO_OT: 't',
  PRESUPUESTO: 'p',
  FACTURA: 'f',
  REMITO: 'r',
  COBRO: 'c',
  ENCUESTA: 'e',
  APROBACION_DOCUMENTAL: 'a',
};

/** La primera de FRONTEND_URL: es la que ve el cliente final. */
function baseFront(): string {
  return (
    process.env.FRONTEND_URL?.split(',')[0]?.trim() ?? 'http://localhost:3000'
  );
}

/** URL absoluta del link público, la que se manda por WhatsApp o mail. */
export function urlEnlacePublico(
  tipo: TipoEnlacePublico,
  token: string,
): string {
  return `${baseFront()}/${PREFIJO_ENLACE[tipo]}/${token}`;
}
