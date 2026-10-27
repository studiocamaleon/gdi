export interface IluminacionTiraEjecutada {
  unidades: number;
  anchoMm: number;
  altoMm: number;
  profundidadMm: number | null;
  orientacion: 'horizontal' | 'vertical';
  filas: number;
  largoFilaMm: number;
  separacionRealMm: number;
  retiroMm: number;
  metrosPorCartel: number;
  wattsMetro: number;
  wattsPorCartel: number;
  tensionV: number;
  margenPct: number;
  alimentacionesMinimas: number | null;
  maxAlimentacionM: number | null;
  fuentes?: {
    porCartel: number;
    capacidadW: number;
    corrienteA?: number;
    consumoMaximoPorFuenteW: number;
  };
}
