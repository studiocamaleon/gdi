/**
 * TIEMPO EXTRA DEL PASO — bloques que no dependen de la cantidad.
 *
 * Un paso de instalación cobra por m² (el run) pero además consume tiempo que
 * no escala: preparar el trabajo, el traslado de ida y vuelta. Ese tiempo es
 * del paso —lo hace la misma gente, ocupa la misma agenda— pero puede
 * tarifarse en OTRO centro de costo y con otra dotación.
 *
 * Reglas (docs/cargos-por-paso-analisis-y-plan.md §7):
 *  - los MINUTOS suman al `totalMin` del paso → la ETA los cuenta;
 *  - los PESOS se reportan aparte del costo de trabajo → el desglose los
 *    muestra bajo "Cargos", separados del tiempo del paso;
 *  - la dotación del bloque SIEMPRE multiplica (es trabajo humano por
 *    definición, no runtime de máquina).
 *
 * No confundir con `tiempoFijoMin` / `tiempoFijoOverrideMin`, que es el reloj
 * T-1 del TRABAJO del paso ("tarda 30 min sin importar la cantidad").
 */

/** Lo que declara el modelador en `paramsPasoJson.tiemposExtra`. */
export interface TiempoExtraConfig {
  /** Estable dentro del paso: los niveles pisan minutos POR id. */
  id: string;
  etiqueta: string;
  minutos: number;
  /** null = el centro del paso. */
  centroCostoId: string | null;
  /** null = la dotación del paso (1 si el paso tiene máquina). */
  dotacion: number | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numeroPositivo(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Lee los bloques declarados en el paso. Tolerante por diseño: una entrada sin
 * minutos o sin etiqueta se ignora en vez de romper la cotización — el editor
 * es la puerta que valida, el motor no cotiza basura ni explota por ella.
 */
export function leerTiemposExtra(paramsPasoJson: unknown): TiempoExtraConfig[] {
  const params = asRecord(paramsPasoJson);
  const raw = params.tiemposExtra;
  if (!Array.isArray(raw)) return [];
  const bloques: TiempoExtraConfig[] = [];
  raw.forEach((item, indice) => {
    const bloque = asRecord(item);
    const minutos = numeroPositivo(bloque.minutos);
    if (minutos == null) return;
    const etiqueta =
      typeof bloque.etiqueta === 'string' && bloque.etiqueta.trim()
        ? bloque.etiqueta.trim()
        : 'Tiempo extra';
    const id =
      typeof bloque.id === 'string' && bloque.id.trim()
        ? bloque.id.trim()
        : `extra_${indice}`;
    bloques.push({
      id,
      etiqueta,
      minutos,
      centroCostoId:
        typeof bloque.centroCostoId === 'string' && bloque.centroCostoId.trim()
          ? bloque.centroCostoId.trim()
          : null,
      dotacion: numeroPositivo(bloque.dotacion),
    });
  });
  return bloques;
}

/** Centros propios de los bloques: hay que sumarlos al mapa de tarifas o el
 *  bloque se tarifaría a 0 sin que nadie avise. */
export function centrosDeTiemposExtra(paramsPasoJson: unknown): string[] {
  return leerTiemposExtra(paramsPasoJson)
    .map((bloque) => bloque.centroCostoId)
    .filter((id): id is string => Boolean(id));
}
