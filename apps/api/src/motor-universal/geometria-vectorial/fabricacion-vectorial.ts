export type MatrizFabricacion = [
  number,
  number,
  number,
  number,
  number,
  number,
];
export type RolRecorrido =
  | 'CORTE_EXTERIOR'
  | 'CORTE_INTERIOR'
  | 'CORTE_PARCIAL'
  | 'HENDIDO'
  | null;
export type RecorridoFabricacion = {
  entidadId: string;
  capa: string;
  tipoEntidad: string;
  /** Rol legado; la intención física y función geométrica se conservan aparte. */
  rol: RolRecorrido;
  funcionGeometrica?: 'EXTERIOR' | 'INTERIOR' | 'TRAZO' | 'REFERENCIA';
  operacion?: 'CORTE_COMPLETO' | 'CORTE_PARCIAL' | 'HENDIDO' | null;
  conservar: boolean;
  color?: string;
  tipoLinea?: string;
  puntos: Array<{ x: number; y: number }>;
  cerrada: boolean;
  longitudMm: number | null;
  precisionLongitud: 'EXACTA' | 'APROXIMADA' | null;
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
  formato: 'DXF' | 'SVG';
  dxfNativo?: boolean;
  origen: { minX: number; minY: number; factorMm: number };
  transformacion: MatrizFabricacion;
  entidades: RecorridoFabricacion[];
};

export function transformarFabricacion(
  documento: FabricacionVectorial | undefined,
  angulo: number,
  traslacion: { x: number; y: number },
): FabricacionVectorial | undefined {
  if (!documento) return undefined;
  const r = (angulo * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r);
  const [a, b, d, e, x, y] = documento.transformacion;
  return {
    ...documento,
    transformacion: [
      c * a - s * b,
      s * a + c * b,
      c * d - s * e,
      s * d + c * e,
      c * x - s * y + traslacion.x,
      s * x + c * y + traslacion.y,
    ],
  };
}
