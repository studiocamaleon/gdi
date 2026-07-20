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
import { LADOS_PIEZA, largoDelLadoMm, parsearLados } from './lados-pieza';
import { demasiaAcumuladaPorLado } from './modificaciones-pre';
import type { JobContext, LadoPieza } from './tipos';

/**
 * Distancia al borde de los lados SIN refuerzo. Donde hay refuerzo manda la
 * banda: el ojal se centra en ella (ver `insetDelLado`).
 */
export const DISTANCIA_BORDE_OJAL_MM_DEFAULT = 10;

export interface ParamsColocacionOjales {
  /** Separación MÁXIMA entre ojales. Se reparte pareja sin superarla. */
  separacionMaxMm: number;
  lados: LadoPieza[];
  /** Si cada esquina lleva ojal sí o sí (práctica de taller). Default true. */
  esquinasSiempre: boolean;
  /**
   * Distancia del CENTRO del ojal al borde terminado, para los lados que NO
   * tienen refuerzo. Donde hay refuerzo, el ojal se centra en su banda.
   */
  distanciaBordeMm: number;
}

/**
 * Cuánto adentro del borde va el centro del ojal, para UN lado.
 *
 * Al doblarse hacia atrás, un refuerzo de 20 mm deja sobre la pieza terminada
 * una banda reforzada de 20 mm de ancho medida hacia adentro desde el borde.
 * El ojal se centra en esa banda: 10 mm. Así la posición sale bien sea cual
 * sea el tamaño del refuerzo, sin tener que configurar nada.
 *
 * Si el lado no tiene refuerzo no hay banda donde centrarse, y se usa la
 * distancia declarada en el paso.
 */
export function insetDelLado(
  demasiaDelLadoMm: number,
  distanciaBordeMm: number,
): number {
  return demasiaDelLadoMm > 0 ? demasiaDelLadoMm / 2 : distanciaBordeMm;
}

export function parsearParamsColocacionOjales(
  paramsPasoJson: unknown,
): ParamsColocacionOjales | null {
  const params = (paramsPasoJson ?? {}) as Record<string, unknown>;

  const lados = parsearLados(params.lados);
  if (lados.length === 0) return null;

  const separacionMaxMm = Number(params.separacionMaxMm ?? NaN);
  if (!Number.isFinite(separacionMaxMm) || separacionMaxMm <= 0) return null;

  const distanciaRaw = Number(params.distanciaBordeMm ?? NaN);
  const distanciaBordeMm =
    Number.isFinite(distanciaRaw) && distanciaRaw >= 0
      ? distanciaRaw
      : DISTANCIA_BORDE_OJAL_MM_DEFAULT;

  return {
    separacionMaxMm,
    lados,
    esquinasSiempre: params.esquinasSiempre !== false,
    distanciaBordeMm,
  };
}

/**
 * Posición de un ojal, en coordenadas de la medida VISIBLE de la pieza:
 * origen (0,0) = esquina superior izquierda del área que ve el cliente.
 *
 * El dibujo del nesting las usa para mostrar dónde van los ojales; por eso
 * salen del motor y no se recalculan en el front (si el reparto cambia, el
 * dibujo tiene que cambiar con él).
 */
export interface PosicionOjal {
  xMm: number;
  yMm: number;
  /** Lado que la generó. En una esquina compartida gana el primero en orden. */
  lado: LadoPieza;
}

/** Redondeo a 0.1mm para deduplicar esquinas sin sufrir el error de punto flotante. */
function clavePosicion(x: number, y: number): string {
  return `${Math.round(x * 10)}:${Math.round(y * 10)}`;
}

/**
 * Corre el punto desde el borde hacia adentro de la pieza.
 *
 * El sentido se deduce de QUÉ bordes toca el punto, no del lado que lo generó:
 * así una esquina —que toca dos— se corre en diagonal, en vez de quedar pegada
 * al filo perpendicular. Un ojal a mitad de lado se corre en un solo eje.
 *
 * Cada eje usa el inset de SU borde: en una lona con bolsillo arriba y refuerzo
 * al costado, el ojal de esquina se centra en la banda del bolsillo
 * verticalmente y en la del refuerzo horizontalmente.
 */
function correrHaciaAdentro(
  xMm: number,
  yMm: number,
  anchoMm: number,
  altoMm: number,
  inset: Record<LadoPieza, number>,
): { xMm: number; yMm: number } {
  return {
    xMm:
      xMm === 0
        ? inset.izquierdo
        : xMm === anchoMm
          ? anchoMm - inset.derecho
          : xMm,
    yMm:
      yMm === 0
        ? inset.superior
        : yMm === altoMm
          ? altoMm - inset.inferior
          : yMm,
  };
}

/**
 * Posiciones de los ojales de UNA pieza.
 *
 * Cada lado se divide en `ceil(L / separacion)` tramos iguales —así la
 * separación real nunca supera el máximo— y lleva un ojal en cada punta de
 * cada tramo, incluidos ambos extremos. Las posiciones de todos los lados se
 * unen y **se deduplican**: una esquina compartida por dos lados adyacentes
 * seleccionados es UN ojal, no dos.
 *
 * Ejemplo del diseño (1500×1000, cada 500mm, los 4 lados):
 *   superior:  4 posiciones (x = 0, 500, 1000, 1500)
 *   inferior:  4
 *   izquierdo: 3 posiciones (y = 0, 500, 1000)
 *   derecho:   3
 *   4 esquinas duplicadas                          → TOTAL = 10
 *
 * Sin `esquinasSiempre`, los lados llevan sólo los ojales intermedios y no hay
 * esquinas que deduplicar.
 */
export function calcularPosicionesOjales(
  anchoMm: number,
  altoMm: number,
  params: ParamsColocacionOjales,
  demasiaPorLadoMm?: Record<LadoPieza, number>,
): PosicionOjal[] {
  if (anchoMm <= 0 || altoMm <= 0) return [];

  // Cada lado se centra en SU banda de refuerzo; sin refuerzo usa la distancia
  // declarada. Y nunca más allá del centro de la pieza (lonas muy chicas).
  const inset = LADOS_PIEZA.reduce(
    (acc, lado) => {
      const crudo = insetDelLado(
        demasiaPorLadoMm?.[lado] ?? 0,
        params.distanciaBordeMm,
      );
      const eje = lado === 'superior' || lado === 'inferior' ? altoMm : anchoMm;
      acc[lado] = Math.max(0, Math.min(crudo, eje / 2));
      return acc;
    },
    {} as Record<LadoPieza, number>,
  );

  const vistas = new Set<string>();
  const posiciones: PosicionOjal[] = [];

  for (const lado of params.lados) {
    const largoMm = largoDelLadoMm(lado, anchoMm, altoMm);
    if (largoMm <= 0) continue;

    const tramos = Math.ceil(largoMm / params.separacionMaxMm);
    const desde = params.esquinasSiempre ? 0 : 1;
    const hasta = params.esquinasSiempre ? tramos : tramos - 1;

    for (let i = desde; i <= hasta; i++) {
      const avance = (largoMm * i) / tramos;
      const xMm =
        lado === 'superior' || lado === 'inferior'
          ? avance
          : lado === 'izquierdo'
            ? 0
            : anchoMm;
      const yMm =
        lado === 'izquierdo' || lado === 'derecho'
          ? avance
          : lado === 'superior'
            ? 0
            : altoMm;

      // Se deduplica por la posición SOBRE el borde: dos lados adyacentes
      // comparten la esquina antes de correrla hacia adentro.
      const clave = clavePosicion(xMm, yMm);
      if (vistas.has(clave)) continue;
      vistas.add(clave);

      const adentro = correrHaciaAdentro(xMm, yMm, anchoMm, altoMm, inset);
      posiciones.push({ ...adentro, lado });
    }
  }

  return posiciones;
}

/** Ojales de UNA pieza. La cantidad se DERIVA de las posiciones. */
export function calcularOjalesPorPieza(
  anchoMm: number,
  altoMm: number,
  params: ParamsColocacionOjales,
): number {
  return calcularPosicionesOjales(anchoMm, altoMm, params).length;
}

/**
 * Ojales de todo el trabajo. Es la cantidad del paso: driver del tiempo (T-2
 * en ojales/h) y del consumo del slot de material.
 */
export function calcularCantidadOjales(
  jobContext: JobContext,
  params: ParamsColocacionOjales,
): number {
  return calcularLayoutOjales(jobContext, params).reduce(
    (acc, pieza) => acc + pieza.posiciones.length * pieza.cantidad,
    0,
  );
}

export interface LayoutOjalesPieza {
  /** Medida VISIBLE de la pieza — el marco sobre el que van las posiciones. */
  anchoMm: number;
  altoMm: number;
  cantidad: number;
  posiciones: PosicionOjal[];
}

/**
 * Layout por pieza, para que el visor de nesting dibuje los ojales donde el
 * motor los pensó. Se calcula sobre la medida VISIBLE (regla de oro): el ojal
 * va al borde terminado, no crece con la demasía de un refuerzo previo.
 */
export function calcularLayoutOjales(
  jobContext: JobContext,
  params: ParamsColocacionOjales,
): LayoutOjalesPieza[] {
  const piezas = jobContext.piezasVisibles ?? jobContext.piezas;
  if (!piezas || piezas.length === 0) return [];

  // El refuerzo de cada lado lo dejaron los pasos PRE, que ya corrieron: el
  // ojal se centra en esa banda.
  const demasia = demasiaAcumuladaPorLado(jobContext);

  return piezas.flatMap((pieza) => {
    const cantidad = Number(pieza.cantidad ?? 0);
    const anchoMm = Number(pieza.anchoMm ?? 0);
    const altoMm = Number(pieza.altoMm ?? 0);
    if (cantidad <= 0) return [];
    const posiciones = calcularPosicionesOjales(
      anchoMm,
      altoMm,
      params,
      demasia,
    );
    if (posiciones.length === 0) return [];
    return [{ anchoMm, altoMm, cantidad, posiciones }];
  });
}
