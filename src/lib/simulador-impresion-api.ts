import { apiRequest } from "@/lib/api";

/**
 * Simulador GRAN FORMATO — contrato con GET /produccion/simulador.
 * Cola real: pasos `impresion_por_area` en FRONTERA de órdenes vivas, con
 * piezas físicas (nestingResult del snapshot), sustrato cotizado y el
 * catálogo de anchos/stock por materia prima.
 * Ver docs/simulador-impresion-diseno.md
 */

export type SimuladorPieza = { anchoMm: number; altoMm: number; cantidad: number };

export type SimuladorJob = {
  pasoId: string;
  itemId: string;
  ordenId: string;
  codigo: string;
  cliente: string;
  producto: string;
  /** "YYYY-MM-DD" o null. */
  fechaEntrega: string | null;
  /** Código del catálogo de tecnologías de maquinaria (uv, dtf_textil…). */
  tecnologia: string | null;
  materiaPrimaId: string | null;
  materiaPrimaNombre: string | null;
  varianteCotizada: {
    id: string;
    sku: string;
    anchoMm: number | null;
    precioMl: number | null;
  } | null;
  /** Largo de rollo consumido al cotizar este item por separado (mm). */
  consumoCotizadoMm: number | null;
  /** [] = sin medidas (fuera del nesting, dentro del lote). */
  piezas: SimuladorPieza[];
  /** Estimado del paso (min): prellena "¿cuánto duró la tanda?" (D11). */
  duracionEstimadaMin: number | null;
};

export type SimuladorAncho = {
  varianteId: string;
  sku: string;
  anchoMm: number;
  precioMl: number | null;
  stockMl: number | null;
};

export type SimuladorMaterial = {
  materiaPrimaId: string;
  nombre: string;
  anchos: SimuladorAncho[];
};

export type SimuladorData = {
  jobs: SimuladorJob[];
  materiales: SimuladorMaterial[];
};

export async function getSimuladorImpresion() {
  return apiRequest<SimuladorData>("/produccion/simulador");
}

/* ─────────── Re-acomodo con el motor ─────────── */

/**
 * El simulador NO tiene packer propio: le pide al backend que acomode la
 * tanda con el mismo nesting que usó la cotización. Tenerlo duplicado hacía
 * que márgenes y separaciones derivaran y el ahorro saliera negativo.
 */
export type SimuladorNestingPlacement = {
  /** Paso al que pertenece la pieza (null si no se pudo mapear). */
  pasoId: string | null;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotated: boolean;
};

export type SimuladorNestingAncho = {
  anchoMm: number;
  /** null = no se pudo acomodar en este ancho. */
  consumedLengthMm: number | null;
  aprovechamientoPct: number | null;
  piezasAcomodadas: number;
  /** pasoIds cuya pieza no entra en este ancho. */
  incompatibles: string[];
  placements: SimuladorNestingPlacement[];
};

export type SimuladorNestingGrupo = {
  key: string;
  /** pasoIds sin medidas: quedan fuera del nesting, dentro del lote. */
  sinMedidas: string[];
  anchos: SimuladorNestingAncho[];
  /**
   * Bordes efectivos de la tanda en mm (margen de máquina + demasía), los
   * mismos que insetan las piezas. `null` cuando no hubo acomodo. El
   * lateral corre por los dos bordes del ancho; el longitudinal, al inicio y
   * fin del largo (una vez por tanda — de ahí el ahorro por consolidación).
   */
  margenLateralMm: number | null;
  margenLongitudinalMm: number | null;
};

export type SimuladorNestingRequest = {
  grupos: Array<{ key: string; pasoIds: string[]; anchosMm: number[] }>;
};

export async function simularNesting(body: SimuladorNestingRequest, signal?: AbortSignal) {
  return apiRequest<{ grupos: SimuladorNestingGrupo[] }>("/produccion/simulador/nesting", {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  });
}
