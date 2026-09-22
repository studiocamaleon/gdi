import type {
  ComparacionPlanes,
  DiagnosticoCambioPlan,
  UsoCambioPlan,
} from './comparacion-planes';

export type VistaAsignacionPlan = {
  empresa: { id: string; nombre: string };
  actual: {
    nombre: string;
    versionId: string | null;
    numero: number | null;
    revision: number;
  };
  destino: { nombre: string; versionId: string | null; numero: number | null };
  uso: UsoCambioPlan;
  diferencias: ComparacionPlanes['propuestas'][number]['diferencias'];
  diagnostico: DiagnosticoCambioPlan;
  bloqueos: string[];
  revisiones: string[];
  huella: string;
};
export type ResultadoAsignacion = {
  operacionId: string;
  tenantId: string;
  versionId: string | null;
  revision: number;
};
