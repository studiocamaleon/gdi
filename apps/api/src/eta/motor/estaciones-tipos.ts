/**
 * Espejo backend de la parte de src/lib/estaciones.ts que el motor de ETA
 * consume: la forma `Estacion` simulable y `calendarioDefault`. El calendario
 * (tipos + parse) ya vive en produccion/calendario.ts; acá sólo lo que falta.
 */

import type { CalendarioEstacion } from '../../produccion/calendario';

/** Estación tal como la lee el motor (subconjunto de lo que sirve el API). */
export type Estacion = {
  id: string;
  activo: boolean;
  /** PUESTOS simultáneos: multiplican las horas del calendario. */
  capacidadConcurrente: number;
  /** Minutos de traslado hasta la estación; null = default del tenant. */
  tiempoPreparacionMin: number | null;
  calendario: CalendarioEstacion | null;
  familias: string[];
  maquinas: Array<{ centroCostoId: string | null }>;
};

/** Default cuando una estación no tiene calendario: L–V 9:00–18:00. */
export function calendarioDefault(): CalendarioEstacion {
  const franja = { desde: '09:00', hasta: '18:00' };
  return {
    dias: {
      lun: [{ ...franja }],
      mar: [{ ...franja }],
      mie: [{ ...franja }],
      jue: [{ ...franja }],
      vie: [{ ...franja }],
      sab: null,
      dom: null,
    },
  };
}
