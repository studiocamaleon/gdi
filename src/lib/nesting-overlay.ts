/**
 * Geometría del overlay de modificaciones físicas sobre el dibujo de nesting:
 * la franja de demasía (bolsillo / refuerzo) y la ubicación de los ojales.
 *
 * Vive separado del visor para poder testearlo: la parte que puede estar mal
 * es la geometría, no el SVG.
 *
 * Todo se expresa en MM sobre el sustrato, el mismo sistema de coordenadas que
 * usan los placements; el visor lo pasa a píxeles con `mapDisplayRect`.
 *
 * Ver `docs/modificaciones-fisicas-lona-diseno.md`.
 */
import type { DemasiaPorLado, PosicionOjalView } from "@/lib/modificaciones-fisicas";

export interface PlacementGeom {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotated: boolean;
  panelCount?: number;
}

export interface RectMm {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export interface PuntoMm {
  xMm: number;
  yMm: number;
}

/**
 * La demasía se declara sobre los lados LÓGICOS de la pieza, pero el nesting
 * puede haberla rotado 90° para que entre en el rollo. Acá se traduce a los
 * lados tal como quedan DIBUJADOS.
 *
 * Con rotación horaria: el borde lógico superior queda a la derecha y el
 * izquierdo arriba. En los casos reales —bolsillo (arriba+abajo) y refuerzo
 * (los 4)— la demasía es simétrica por eje, así que el sentido de giro no
 * cambia el dibujo; sí importaría para un caso de un solo lado.
 */
export function demasiaDibujada(
  demasia: DemasiaPorLado,
  rotated: boolean,
): DemasiaPorLado {
  if (!rotated) return demasia;
  return {
    superior: demasia.izquierdo,
    inferior: demasia.derecho,
    derecho: demasia.superior,
    izquierdo: demasia.inferior,
  };
}

/**
 * Marco de la demasía: el rectángulo del material y, dentro, el área visible.
 * El visor los pinta como UN path con `fillRule="evenodd"` para que las
 * esquinas no se superpongan y queden más oscuras.
 *
 * Devuelve null si no hay demasía, o si es tan grande que no dejaría área
 * visible (config absurda: mejor no dibujar nada que dibujar algo imposible).
 */
export function marcoDemasia(
  placement: PlacementGeom,
  demasia: DemasiaPorLado,
): { outer: RectMm; inner: RectMm } | null {
  const d = demasiaDibujada(demasia, placement.rotated);
  const total = d.superior + d.inferior + d.izquierdo + d.derecho;
  if (total <= 0) return null;

  const innerWidth = placement.widthMm - d.izquierdo - d.derecho;
  const innerHeight = placement.heightMm - d.superior - d.inferior;
  if (innerWidth <= 0 || innerHeight <= 0) return null;

  return {
    outer: {
      xMm: placement.xMm,
      yMm: placement.yMm,
      widthMm: placement.widthMm,
      heightMm: placement.heightMm,
    },
    inner: {
      xMm: placement.xMm + d.izquierdo,
      yMm: placement.yMm + d.superior,
      widthMm: innerWidth,
      heightMm: innerHeight,
    },
  };
}

/**
 * Ubicación de cada ojal sobre el sustrato.
 *
 * Las posiciones llegan del motor en coordenadas de la medida VISIBLE
 * (origen = esquina superior izquierda del área que ve el cliente), así que
 * hay que correrlas por la demasía y después rotarlas si el nesting rotó la
 * pieza.
 */
export function puntosOjales(
  placement: PlacementGeom,
  demasia: DemasiaPorLado,
  posiciones: PosicionOjalView[],
): PuntoMm[] {
  if (posiciones.length === 0) return [];

  // Coordenadas lógicas de la pieza: si está rotada, el alto dibujado es el
  // ancho lógico y viceversa.
  const altoLogicoMm = placement.rotated
    ? placement.widthMm
    : placement.heightMm;

  return posiciones.map((pos) => {
    const logicoX = demasia.izquierdo + pos.xMm;
    const logicoY = demasia.superior + pos.yMm;
    const [dibujadoX, dibujadoY] = placement.rotated
      ? [altoLogicoMm - logicoY, logicoX]
      : [logicoX, logicoY];
    return {
      xMm: placement.xMm + dibujadoX,
      yMm: placement.yMm + dibujadoY,
    };
  });
}

/**
 * El overlay describe la pieza ARMADA. Cuando el nesting la parte en paneles,
 * cada placement es una tajada y las franjas/ojales caerían sobre las líneas
 * de unión interiores, que es justo donde no van. Hasta resolver el mapeo de
 * paneles a pieza lógica, no se dibuja.
 */
export function overlayAplicable(placement: PlacementGeom): boolean {
  return (placement.panelCount ?? 1) <= 1;
}
