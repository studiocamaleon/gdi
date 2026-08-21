export type ModoRecorridoVectorial = 'CORTE';

export type PuntoRecorrido = {
  x: number;
  y: number;
  via: 'origin' | 'bridge' | 'contour';
  contourId?: string;
  bridgeId?: string;
};

export type PerfilMaquinaCorte = {
  id: string;
  nombre: string;
  postprocesador: 'HOTWIRE_TAP_V1';
  anchoUtilMm: number;
  altoUtilMm: number;
  velocidadMmMin: number;
  decimales?: number;
  origen?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  estrategiaOrigen?: 'geometry-bounds' | 'plate-corner';
  entradaMm?: number;
  strictBounds?: boolean;
};

export type SolicitudRecorridoCorte = {
  modo: 'CORTE';
  svg: string;
  nombreFuente: string;
  perfil: PerfilMaquinaCorte;
};

export type ResultadoRecorridoCorte = {
  modo: 'CORTE';
  engine: { id: string; version: string };
  postprocesador: PerfilMaquinaCorte['postprocesador'];
  perfil: PerfilMaquinaCorte;
  origenSvg: { x: number; y: number };
  recorridoSvg: PuntoRecorrido[];
  recorridoMaquina: PuntoRecorrido[];
  metricas: {
    longitudContornosMm: number;
    longitudConexionesIdaMm: number;
    longitudConexionesRecorridaMm: number;
    longitudTotalMm: number;
    tiempoEstimadoSeg: number;
    cantidadContornos: number;
    cantidadPiezas: number;
    cantidadConexiones: number;
  };
  conexiones: unknown[];
  svgVinculado: string;
  tap: string;
  informe: Record<string, unknown>;
};
