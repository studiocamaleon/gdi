// Contrato operativo compartido; sin dependencias del servidor ni costos.
export type EleccionPersonal = { nodoClave: string; empleadoIds: string[] };
export type PasoPersonalPrevisto = {
  nodoClave: string;
  nombre: string;
  estacion: string;
  maquina: string | null;
  personasNecesarias: number;
  motivo: string | null;
  candidatos: Array<{
    id: string;
    nombre: string;
    tieneHorario: boolean;
    asignacionAutomatica: boolean;
  }>;
};
