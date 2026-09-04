/**
 * Nombres y contratos compartidos entre productores y consumidores.
 *
 * Los nombres llevan versión para que un despliegue nuevo no interprete con
 * otro contrato trabajos que quedaron pendientes durante un rolling deploy.
 */
export const COLA_GEOMETRIA = 'grafo-geometry-v1';
/** Los trabajos intensivos no bloquean la cola interactiva. */
export const COLA_GEOMETRIA_INTENSIVA = 'grafo-geometry-heavy-v1';

export const TRABAJO_MEDIR_POLIGONO = 'geometry.measure-polygon.v1' as const;
export const TRABAJO_NESTING_IRREGULAR_OPENNEST =
  'geometry.nest-irregular-opennest.v1' as const;
export const VERSION_POLITICA_ORIENTACION_GRAFONEST = 4 as const;

export type PuntoTrabajoGeometria = {
  x: number;
  y: number;
};

export type MedirPoligonoData = {
  schemaVersion: 1;
  tenantId: string;
  correlationId: string;
  solicitadoEl: string;
  puntos: PuntoTrabajoGeometria[];
};

export type MedirPoligonoResult = {
  schemaVersion: 1;
  algoritmo: 'shoelace-v1';
  cantidadVertices: number;
  areaMm2: number;
  perimetroMm: number;
  limites: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    anchoMm: number;
    altoMm: number;
  };
};

export type AnilloTrabajoNesting = PuntoTrabajoGeometria[];

export type PiezaTrabajoNestingOpenNest = {
  id: string;
  cantidad: number;
  contorno: AnilloTrabajoNesting;
  huecos?: AnilloTrabajoNesting[];
  /** Cantidad de orientaciones equidistantes. 1 fija la pieza en 0 grados. */
  rotaciones: number;
};

export type NestingIrregularOpenNestData = {
  schemaVersion: 1;
  tenantId: string;
  correlationId: string;
  solicitadoEl: string;
  motor: 'collision' | 'nfp';
  placa: {
    anchoMm: number;
    altoMm: number;
    margenMm: number;
    maxPlacas: number;
  };
  separacionMm: number;
  timeoutMs: number;
  semilla: number;
  piezas: PiezaTrabajoNestingOpenNest[];
  claseComplejidad?: 'RAPIDA' | 'ESTANDAR' | 'INTENSIVA';
  pesoEstimado?: number;
};

export type PlacementTrabajoNestingOpenNest = {
  piezaId: string;
  copia: number;
  placa: number;
  rotacionGrados: number;
  traslacion: PuntoTrabajoGeometria;
  contorno: AnilloTrabajoNesting;
  huecos: AnilloTrabajoNesting[];
};

export type NestingIrregularOpenNestResult = {
  schemaVersion: 1;
  algoritmo: 'opennest-v1' | 'grafonest-baseline-v1';
  motor: NestingIrregularOpenNestData['motor'];
  versionMotor: string;
  cantidadSolicitada: number;
  cantidadColocada: number;
  placasUsadas: number;
  duracionMs: number;
  /** Estrategia menos permisiva que alcanzó el mejor consumo de placas. */
  estrategiaOrientacion?: 'uniforme' | 'cardinal' | 'libre';
  rotacionesPermitidas?: number;
  versionPoliticaOrientacion?: typeof VERSION_POLITICA_ORIENTACION_GRAFONEST;
  /** Una base segura siempre permite cotizar; el optimizador puede mejorarla. */
  calidadSolucion?: 'BASE_SEGURA' | 'OPTIMIZADA';
  /** Indica que se devolvió la base porque la mejora agotó su presupuesto. */
  optimizacionAgotada?: boolean;
  placements: PlacementTrabajoNestingOpenNest[];
  validacion: {
    completa: true;
    dentroDePlaca: true;
    sinSolapamientos: true;
    separacionRespetada: true;
  };
};

export type TrabajoGeometriaNombre =
  | typeof TRABAJO_MEDIR_POLIGONO
  | typeof TRABAJO_NESTING_IRREGULAR_OPENNEST;
export type TrabajoGeometriaData =
  | MedirPoligonoData
  | NestingIrregularOpenNestData;
export type TrabajoGeometriaResult =
  | MedirPoligonoResult
  | NestingIrregularOpenNestResult;
