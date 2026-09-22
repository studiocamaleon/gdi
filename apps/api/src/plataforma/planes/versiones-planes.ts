import type { CapacidadPlan, ContenidoPlan } from './catalogo-planes';

export type ResumenVersionPlan = {
  id: string;
  borradorId: string;
  codigo: string;
  numero: number;
  revisionBorrador: number;
  catalogoVersion: number;
  publicadoEl: string;
  publicadoPorNombre: string;
  motivo: string;
  contenido: ContenidoPlan;
};
export type VersionPlan = ResumenVersionPlan & {
  catalogoSnapshot: {
    capacidades: CapacidadPlan[];
    grupos: Record<string, string>;
  };
};
export type HistorialPlanes = {
  versiones: ResumenVersionPlan[];
  siguiente: number | null;
};
