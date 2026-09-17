// Una sola implementación para API, tablero y seguimiento.
export * from "../../apps/api/src/common/progreso-produccion";

export type ProgresoLote = {
  id: string;
  nombre: string;
  productoNombre: string;
  cantidad: number;
  unidad: string;
  progreso: import("../../apps/api/src/common/progreso-produccion").ProgresoProduccion;
};
