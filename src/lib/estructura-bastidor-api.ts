import { ApiError, apiRequest } from "@/lib/api";

/**
 * La estructura del bastidor a fabricar, tal como quedó en el snapshot del
 * ítem (con los overrides del sheet, no el default de la ruta). La usa el
 * visor 3D del tab de Producción. Espejo de `EstructuraBastidorEjecutada`.
 */
export type EstructuraBastidor = {
  /** simple = marco plano (frontlight) · doble = cajón (backlight). */
  tipoBastidor: "simple" | "doble";
  anchoM: number;
  altoM: number;
  profundidadM: number;
  /** Lado del caño del despiece; ausente en snapshots viejos (40×40). */
  perfilLadoM?: number;
  sepRefuerzoVcm: number;
  sepRefuerzoHcm: number;
  refuerzosV: number;
  refuerzosH: number;
  /** Largo de cada barra a cortar, en mm. */
  despieceMm: number[];
  puntosSoldadura: number;
};

/**
 * Estructura del bastidor de un ítem. `null` si el ítem no tiene paso de
 * bastidor (o su snapshot es anterior a que el motor la persistiera): el visor
 * simplemente no se muestra.
 */
export async function getEstructuraBastidor(
  itemId: string,
): Promise<EstructuraBastidor | null> {
  try {
    return await apiRequest<EstructuraBastidor>(
      `/produccion/estructura-bastidor/${itemId}`,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
