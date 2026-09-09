import type { ResultadoCommonLineTrabajo } from '../../workers/colas';

export interface PuntoVectorial {
  x: number;
  y: number;
}

export interface ContornoVectorial {
  puntos: PuntoVectorial[];
  esHueco: boolean;
}

export interface PiezaVectorial {
  cantidadPorUnidad?: number;
  propietario?: import("./contrato-nesting").PropietarioDemandaNesting;
  operaciones?: import("./operaciones-vectoriales").OperacionVectorial[];
  fabricacion?: import("./fabricacion-vectorial").FabricacionVectorial;
  id: string;
  /** Referencia estable al objeto del SVG que originó la pieza. Permite que el
   * editor agrupe y seleccione geometría sin depender de que el archivo tenga
   * colores, ids o capas preparadas. */
  objetoFuente?: {
    id: string;
    etiqueta?: string;
    grupoRuta: string[];
    colorRelleno?: string;
    orden: number;
  };
  contornos: ContornoVectorial[];
  /** Líneas cerradas que producen piezas internas aprovechables sin consumir
   * otra ubicación de placa. No modifican la ocupación material de la pieza. */
  cortesInternos?: ContornoVectorial[];
  /** Posición de la pieza dentro de la composición completa del SVG. Los
   *  contornos siguen siendo locales para que el nesting pueda moverlos, pero
   *  estas coordenadas permiten reconstruir el negativo original. */
  origenXmm?: number;
  origenYmm?: number;
  anchoMm: number;
  altoMm: number;
  areaMm2: number;
  perimetroMm: number;
  segmentacion?: {
    piezaOrigenId: string;
    indice: number;
    total: number;
    origenXmm: number;
    origenYmm: number;
    unionesIds: string[];
  };
}

export interface UnionVectorial {
  id: string;
  piezaOrigenId: string;
  tipoEncastre: 'cola_milano' | 'recta';
  eje: 'vertical' | 'horizontal';
  posicionMm: number;
  largoMm: number;
  cantidadEncastres: number;
  anchoEncastreMm: number;
  profundidadEncastreMm: number;
  kerfMm: number;
  /** Para divisiones oblicuas. Las coordenadas pertenecen a la composición
   * original del SVG; eje/posición se conservan por compatibilidad. */
  anguloGrados?: number;
  inicio?: PuntoVectorial;
  fin?: PuntoVectorial;
}

export interface GeometriaVectorialCanonica {
  schemaVersion: 1;
  anchoMm: number;
  altoMm: number;
  piezas: PiezaVectorial[];
  areaTotalMm2: number;
  perimetroTotalMm: number;
  hashFuente: string;
}

export type ModoFabricacionObjetoVectorial = 'pieza' | 'encastre';

export interface ConfiguracionCapasVectoriales {
  schemaVersion: 1;
  niveles: Array<{
    id: string;
    nombre: string;
    orden: number;
    colorVisual: number;
  }>;
  asignaciones: Array<{
    objetoId: string;
    nivelId: string;
    modo: ModoFabricacionObjetoVectorial;
  }>;
}

export interface DiagnosticoSvg {
  codigo: string;
  mensaje: string;
  severidad: 'ERROR' | 'WARNING';
}

export interface PlacementVectorial {
  operaciones?: import("./operaciones-vectoriales").OperacionVectorial[];
  fabricacion?: import("./fabricacion-vectorial").FabricacionVectorial;
  pieceId: string;
  copyIndex: number;
  substrateIndex: number;
  xMm: number;
  yMm: number;
  rotacion: number;
  anchoMm: number;
  altoMm: number;
  contornos: ContornoVectorial[];
  cortesInternos?: ContornoVectorial[];
  segmentacion?: PiezaVectorial['segmentacion'];
}

export interface NestingIrregularResult {
  planPatrones?: import("../../workers/colas").ResumenPlanPatrones;
  algorithm: 'irregular-2d-bottom-left-v1';
  /** Solver real que originó el layout. `algorithm` se conserva como
   * discriminante compatible con snapshots y consumidores existentes. */
  motorNesting?: 'opennest-v1' | 'grafonest-baseline-v1' | 'grafonest-packingsolver-v1';
  versionMotor?: string;
  duracionMs?: number;
  estrategiaOrientacion?: 'uniforme' | 'cardinal' | 'libre';
  rotacionesPermitidas?: number;
  versionPoliticaOrientacion?: number;
  calidadSolucion?: 'BASE_SEGURA' | 'OPTIMIZADA';
  optimizacionAgotada?: boolean;
  busqueda?: {
    motivoFin: 'MINIMO_PLACAS' | 'PRESUPUESTO_AGOTADO' | 'MOTOR_NO_DISPONIBLE' | 'PLAN_REUTILIZADO';
    presupuestoMs: number;
    intentos: number;
    candidatosValidos: number;
    minimoTeoricoPlacas: number;
  };
  commonLine?: ResultadoCommonLineTrabajo;
  placas: number;
  anchoPlacaMm: number;
  altoPlacaMm: number;
  anchoUtilMm: number;
  altoUtilMm: number;
  placements: PlacementVectorial[];
  aprovechamientoPct: number;
  areaPiezasMm2: number;
  areaCompradaMm2: number;
  perimetroCorteMm: number;
  piezasOriginales: number;
  segmentos: number;
  unionesFisicas: number;
  uniones: UnionVectorial[];
  estrategiaDisposicion: 'composicion_original' | 'nesting_optimizado';
}
