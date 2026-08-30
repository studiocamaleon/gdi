/**
 * Links públicos del sistema: los que se le mandan al cliente por WhatsApp.
 *
 * Un prefijo de una letra por tipo — grafoprint.com.ar/t/aB3xK9mQ2wZ7 — para
 * que el link entre entero en un mensaje sin cortarse. El mapa está completo
 * de entrada a propósito: asignar letras de a una lleva a quedarse pintado en
 * un rincón (pago y presupuesto se pelean la `p`, por eso cobro se lleva la
 * `c`). Una letra NO se repinta: cambiarla invalida links ya enviados.
 *
 * Espejo de apps/api/src/enlaces-publicos/enlaces-publicos.urls.ts — si acá se
 * agrega un tipo, allá también. Ver docs/enlaces-publicos-diseno.md
 */
export const PREFIJO_ENLACE = {
  seguimiento: "t",
  presupuesto: "p",
  factura: "f",
  remito: "r",
  cobro: "c",
  encuesta: "e",
  aprobacion_documental: "a",
} as const;

export type TipoEnlacePublico = keyof typeof PREFIJO_ENLACE;

/** Las rutas viejas y largas, que siguen redirigiendo a la corta. */
export const PREFIJOS_LEGACY: Record<string, TipoEnlacePublico> = {
  track: "seguimiento",
  presupuesto: "presupuesto",
};

/**
 * Ruta pública relativa. Da lo mismo en server y en cliente, así que es la
 * única forma segura de armar un href: con el origin metido adentro, el HTML
 * del server y el del cliente difieren y React tira hydration mismatch.
 */
export function enlacePublicoPath(
  tipo: TipoEnlacePublico,
  token: string,
): string {
  return `/${PREFIJO_ENLACE[tipo]}/${token}`;
}

/**
 * URL absoluta para compartir con el cliente (copiar al portapapeles, mandar
 * por mail). Usa window, así que sólo se puede llamar desde un handler o un
 * efecto — nunca durante el render.
 */
export function enlacePublicoUrl(
  tipo: TipoEnlacePublico,
  token: string,
): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}${enlacePublicoPath(tipo, token)}`;
}
