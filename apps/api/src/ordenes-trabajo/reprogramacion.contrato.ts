/** Contrato compartido de la edición de fechas desde Planificación. */
export type SolicitudReprogramacion = {
  tipo: 'produccion' | 'entrega';
  alcance: 'paso' | 'item';
  fecha: string;
  hora?: string;
};
export type RevisionReprogramacion = {
  token: string | null;
  venceEl: string;
  zona: string;
  viable: boolean;
  motivos: string[];
  advertencias: string[];
  alcance: string;
  solicitado: string;
  entregaOrden: { actual: string | null; propuesta: string | null };
  pasos: Array<{
    id: string;
    orden: string;
    trabajo: string;
    paso: string;
    inicioActual: string | null;
    finActual: string | null;
    inicioPropuesto: string | null;
    finPropuesto: string | null;
    seGuarda: boolean;
  }>;
  entregas: Array<{
    id: string;
    orden: string;
    trabajo: string;
    actual: string | null;
    propuesta: string | null;
    finPropuesto: string | null;
    enRiesgo: boolean;
  }>;
};
