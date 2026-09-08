export type MatrizFabricacion = [
  number,
  number,
  number,
  number,
  number,
  number,
];
export type RolRecorrido =
  | "CORTE_EXTERIOR"
  | "CORTE_INTERIOR"
  | "HENDIDO"
  | null;
export type RecorridoFabricacion = {
  entidadId: string;
  capa: string;
  tipoEntidad: string;
  rol: RolRecorrido;
  conservar: boolean;
  color?: string;
  tipoLinea?: string;
  puntos: Array<{ x: number; y: number }>;
  cerrada: boolean;
  longitudMm: number | null;
  precisionLongitud: "EXACTA" | "APROXIMADA" | null;
  texto?: {
    contenido: string;
    x: number;
    y: number;
    altura: number;
    rotacion: number;
  };
};

/** Los recorridos permanecen en coordenadas locales. Sólo cambia la matriz
 * de la colocación; la referencia apunta a una interpretación inmutable. */
export type FabricacionVectorial = {
  version: 1;
  geometriaId: string;
  archivoHash: string;
  formato: "DXF" | "SVG";
  dxfNativo?: boolean;
  origen: { minX: number; minY: number; factorMm: number };
  transformacion: MatrizFabricacion;
  entidades: RecorridoFabricacion[];
};
