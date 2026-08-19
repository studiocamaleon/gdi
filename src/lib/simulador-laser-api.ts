import { apiRequest } from "@/lib/api";

/**
 * Simulador de impresión LÁSER — contrato con GET /produccion/simulador-laser.
 * Cola real: pasos `impresion_por_hoja` en FRONTERA de órdenes vivas, con
 * papel/pliego/gramaje, hojas físicas, clics, caras y modo de color desde
 * el snapshot. Ver docs/simulador-laser-diseno.md
 */

export type LaserPapel = {
  materiaPrimaId: string | null;
  varianteId: string | null;
  nombre: string;
  gramaje: number | null;
};

/** PLIEGO DE IMPRESIÓN: lo que se carga en la máquina (≠ formato de compra). */
export type LaserPliego = {
  preset: string | null;
  anchoMm: number | null;
  altoMm: number | null;
};

export type LaserJob = {
  pasoId: string;
  itemId: string;
  ordenId: string;
  codigo: string;
  cliente: string | null;
  producto: string;
  fechaEntrega: string | null;
  estado: "pendiente" | "en_curso";
  iniciadoEl: string | null;
  duracionEstimadaMin: number | null;
  centroCostoId: string | null;
  centroCostoNombre: string | null;
  configPasoId: string | null;
  /** Máquina asignada al cotizar (jobContext) o la default de la config. */
  maquinaId: string | null;
  maquinaNombre: string | null;
  papel: LaserPapel | null;
  pliego: LaserPliego | null;
  /** Pliegos de impresión que pasan por la máquina (hojas a cargar). */
  hojas: number | null;
  /** Impresiones (pliegos × caras). */
  clics: number | null;
  caras: 1 | 2 | null;
  modoColor: string | null;
  /** Pasos siguientes del item (adónde va después). */
  acabados: string[];
  /** Clave calculada por el servidor; null = no se demostró compatibilidad. */
  compatibilidadKey: string | null;
  faltantesCompatibilidad: string[];
};

export type SimuladorLaserData = { jobs: LaserJob[] };

export async function getSimuladorLaser() {
  return apiRequest<SimuladorLaserData>("/produccion/simulador-laser");
}
