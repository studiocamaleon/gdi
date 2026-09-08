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
export const VERSION_POLITICA_ORIENTACION_GRAFONEST = 8 as const;

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

/**
 * Política productiva para compartir tramos rectos de corte. El ancho de
 * corte es la franja física removida por láser/fresa: dos contornos nominales
 * quedan a esa distancia y una única trayectoria pasa por el centro.
 */
export type ConfiguracionCommonLineTrabajo = {
  habilitado: boolean;
  anchoCorteMm: number;
  longitudMinimaMm: number;
  toleranciaMm: number;
};

export type ReferenciaSegmentoCommonLine = {
  piezaId: string;
  copia: number;
  indiceSegmento: number;
};

export type TramoCommonLineTrabajo = {
  id: string;
  placa: number;
  inicio: PuntoTrabajoGeometria;
  fin: PuntoTrabajoGeometria;
  longitudMm: number;
  segmentosOrigen: [ReferenciaSegmentoCommonLine, ReferenciaSegmentoCommonLine];
};

export type ResultadoCommonLineTrabajo = {
  habilitado: true;
  aplicado: boolean;
  anchoCorteMm: number;
  longitudMinimaMm: number;
  toleranciaMm: number;
  longitudCompartidaMm: number;
  ahorroRecorridoMm: number;
  tramos: TramoCommonLineTrabajo[];
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
  commonLine?: ConfiguracionCommonLineTrabajo;
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

export type ResumenPlanPatrones = {
  version: 1;
  patronesEvaluados: number;
  patronesElegidos: number;
  minimoPlacasEnCartera: boolean;
  minimoPatronesEnCartera: boolean;
  minimoGeometricoDemostrado: false;
};

export type NestingIrregularOpenNestResult = {
  planPatrones?: ResumenPlanPatrones;
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
  /** No se probó el mínimo de placas dentro del presupuesto disponible. */
  optimizacionAgotada?: boolean;
  busqueda?: {
    motivoFin: 'MINIMO_PLACAS' | 'PRESUPUESTO_AGOTADO' | 'MOTOR_NO_DISPONIBLE';
    presupuestoMs: number;
    intentos: number;
    candidatosValidos: number;
    minimoTeoricoPlacas: number;
  };
  commonLine?: ResultadoCommonLineTrabajo;
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
