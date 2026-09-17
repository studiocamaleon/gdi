/** Contrato de la revisión de asignación; sin dependencias de Nest ni Prisma. */
export type ContextoAsignacionPersonal = {
  pasoId: string;
  paso: string;
  trabajo: string;
  orden: string;
  estacion: string;
  zona: string;
  personasNecesarias: number;
  seleccionActual: string[];
  candidatos: Array<{ id: string; nombre: string; tieneHorario: boolean }>;
};

export type ImpactoPasoAsignacion = {
  pasoId: string;
  paso: string;
  trabajo: string;
  orden: string;
  previsto: string | null;
  actual: string | null;
  propuesto: string | null;
  desvioActualMin: number | null;
  desvioPropuestoMin: number | null;
  diferenciaMin: number | null;
  personalActual: string[];
  personalPropuesto: string[];
};

export type RevisionAsignacionPersonal = {
  token: string | null;
  venceEl: string;
  zona: string;
  viable: boolean;
  motivos: string[];
  advertencias: string[];
  paso: ImpactoPasoAsignacion;
  afectados: ImpactoPasoAsignacion[];
  entregas: Array<{
    itemId: string;
    orden: string;
    trabajo: string;
    entrega: string | null;
    entregaSugerida: string | null;
    actual: string | null;
    propuesto: string | null;
    enRiesgo: boolean;
  }>;
};
