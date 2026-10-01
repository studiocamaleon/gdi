import type { CurrentAuth } from './auth.types';

/** Sólo existe en el request del servidor; no se acepta desde headers/body.
 * Reutiliza el guard con el token original, sin prolongar su sesión. */
export const REVALIDAR_ACCESO = Symbol('revalidar-acceso');
export type RevalidarAcceso = () => Promise<CurrentAuth>;
export type RequestConRevalidacion = {
  [REVALIDAR_ACCESO]?: RevalidarAcceso;
};
