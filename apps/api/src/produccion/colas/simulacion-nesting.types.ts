/** Datos de la simulación compartidos con la UI, sin dependencias del motor. */
export type PiezaSimulacion = {
  id: string;
  trabajo: number;
  etiqueta: string;
  anchoMm: number;
  altoMm: number;
  permiteRotar: boolean;
  panel: number | null;
  paneles: number | null;
  solapeInicioMm: number;
  solapeFinMm: number;
};
export type MargenesSimulacionRollo = {
  izquierda: number;
  derecha: number;
  inicio: number;
  fin: number;
};
export type UbicacionSimulacion = {
  piezaId: string;
  xMm: number;
  yMm: number;
  anchoMm: number;
  altoMm: number;
  rotada: boolean;
};
export type AlternativaRollo = {
  anchoMm: number;
  largoMm: number;
  superficieM2: number;
  aprovechamientoPct: number;
  ubicaciones: UbicacionSimulacion[];
};
export type ResultadoSimulacionRollo = {
  alternativas: AlternativaRollo[];
  descartados: Array<{ anchoMm: number; motivo: string }>;
};

/** Contrato público de consulta, sin dependencias de servicios ni DTO de Nest. */
export type SimulacionNestingCola = ResultadoSimulacionRollo & {
  materialNombre: string;
  maquina: { id: string; nombre: string; anchoMaximoMm: number };
  piezas: PiezaSimulacion[];
  trabajos: Array<{
    pasoId: string;
    itemId: string;
    referencia: string;
    piezas: number;
  }>;
  margenes: MargenesSimulacionRollo;
  separacionMm: number;
  separacionVerticalMm: number;
};
