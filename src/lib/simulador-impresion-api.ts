import { apiRequest } from "@/lib/api";

/**
 * Simulador de impresión — contrato con GET /produccion/simulador.
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
