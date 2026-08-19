export interface PuntoVectorial {
  x: number;
  y: number;
}

export interface ContornoVectorial {
  puntos: PuntoVectorial[];
  esHueco: boolean;
}

export interface PiezaVectorial {
  id: string;
  contornos: ContornoVectorial[];
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
  tipoEncastre: 'cola_milano';
  eje: 'vertical' | 'horizontal';
  posicionMm: number;
  largoMm: number;
  cantidadEncastres: number;
  anchoEncastreMm: number;
  profundidadEncastreMm: number;
  kerfMm: number;
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

export interface DiagnosticoSvg {
  codigo: string;
  mensaje: string;
  severidad: 'ERROR' | 'WARNING';
}

export interface PlacementVectorial {
  pieceId: string;
  copyIndex: number;
  substrateIndex: number;
  xMm: number;
  yMm: number;
  rotacion: number;
  anchoMm: number;
  altoMm: number;
  contornos: ContornoVectorial[];
  segmentacion?: PiezaVectorial['segmentacion'];
}

export interface NestingIrregularResult {
  algorithm: 'irregular-2d-bottom-left-v1';
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
}
