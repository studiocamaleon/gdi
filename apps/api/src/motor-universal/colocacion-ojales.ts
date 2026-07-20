/**
 * Etapa C — Colocación de ojales.
 *
 * La cantidad de ojales NO es un dato que cargue el comercial: se deriva del
 * perímetro de la pieza y de cada cuántos cm van los ojales, que es como se
 * calcula a mano en el taller.
 *
 * REGLA DE ORO (docs/modificaciones-fisicas-lona-diseno.md §3): se mide sobre
 * la medida VISIBLE. El ojal se coloca sobre el borde terminado, así que no
 * crece con la demasía que haya agregado un refuerzo previo. Por eso este
 * módulo NO puede leer `piezaPerimetroTotalM` —que describe el material— y
 * calcula sobre `piezasVisibles`.
 *
 * Por qué familia propia y no un `subTipo` de `modificacion_post`: necesita un
 * mecanismo de cantidad que no existía (derivado del perímetro) y parámetros
 * propios. Esconderlo tras un dropdown repetiría el error que la etapa B
 * corrigió: un enum decorativo que el motor ignora.
 */
import { ESQUINAS, largoDelLadoMm, parsearLados } from './lados-pieza';
import type { JobContext, LadoPieza } from './tipos';

export interface ParamsColocacionOjales {
  /** Separación MÁXIMA entre ojales. Se reparte pareja sin superarla. */
  separacionMaxMm: number;
  lados: LadoPieza[];
  /** Si cada esquina lleva ojal sí o sí (práctica de taller). Default true. */
  esquinasSiempre: boolean;
}

export function parsearParamsColocacionOjales(
  paramsPasoJson: unknown,
): ParamsColocacionOjales | null {
  const params = (paramsPasoJson ?? {}) as Record<string, unknown>;

  const lados = parsearLados(params.lados);
  if (lados.length === 0) return null;

  const separacionMaxMm = Number(params.separacionMaxMm ?? NaN);
  if (!Number.isFinite(separacionMaxMm) || separacionMaxMm <= 0) return null;

  return {
    separacionMaxMm,
    lados,
    esquinasSiempre: params.esquinasSiempre !== false,
  };
}

/**
 * Ojales de UNA pieza.
 *
 * Con `esquinasSiempre` (el caso normal): cada lado se divide en
 * `ceil(L / separacion)` tramos y lleva un ojal en cada punta de cada tramo,
 * o sea `tramos + 1` posiciones contando ambos extremos. Después se descuenta
 * una posición por cada esquina cuyos DOS lados adyacentes llevan ojales — si
 * no, la esquina se contaría dos veces.
 *
 * Ejemplo del diseño (1500×1000, cada 500mm, los 4 lados):
 *   horizontales: ceil(1500/500)=3 tramos → 4 posiciones c/u  →  8
 *   verticales:   ceil(1000/500)=2 tramos → 3 posiciones c/u  →  6
 *   esquinas compartidas                                       → −4
 *                                                        TOTAL = 10
 *
 * Sin `esquinasSiempre`, los lados sólo llevan los ojales intermedios
 * (`tramos − 1`) y no hay esquinas que descontar.
 */
export function calcularOjalesPorPieza(
  anchoMm: number,
  altoMm: number,
  params: ParamsColocacionOjales,
): number {
  if (anchoMm <= 0 || altoMm <= 0) return 0;

  const posiciones = params.lados.reduce((acc, lado) => {
    const largoMm = largoDelLadoMm(lado, anchoMm, altoMm);
    if (largoMm <= 0) return acc;
    const tramos = Math.ceil(largoMm / params.separacionMaxMm);
    return acc + (params.esquinasSiempre ? tramos + 1 : Math.max(tramos - 1, 0));
  }, 0);

  if (!params.esquinasSiempre) return posiciones;

  const esquinasCompartidas = ESQUINAS.filter(
    ([a, b]) => params.lados.includes(a) && params.lados.includes(b),
  ).length;

  return Math.max(posiciones - esquinasCompartidas, 0);
}

/**
 * Ojales de todo el trabajo. Es la cantidad del paso: driver del tiempo (T-2
 * en ojales/h) y del consumo del slot de material.
 */
export function calcularCantidadOjales(
  jobContext: JobContext,
  params: ParamsColocacionOjales,
): number {
  const piezas = jobContext.piezasVisibles ?? jobContext.piezas;
  if (!piezas || piezas.length === 0) return 0;

  return piezas.reduce((acc, pieza) => {
    const cantidad = Number(pieza.cantidad ?? 0);
    if (cantidad <= 0) return acc;
    const porPieza = calcularOjalesPorPieza(
      Number(pieza.anchoMm ?? 0),
      Number(pieza.altoMm ?? 0),
      params,
    );
    return acc + porPieza * cantidad;
  }, 0);
}
