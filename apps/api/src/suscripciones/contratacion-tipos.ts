import type { DiagnosticoCambioPlan } from '../plataforma/planes/comparacion-planes';
import type { diferenciasCapacidades } from './evaluador-capacidades';

export type SeleccionContratacion = {
  ofertaId: string;
  ciclo: 'mensual' | 'anual';
  adicionales: number;
};
export type RevisionContratacion = {
  actual: { nombre: string; adicionales: number };
  destino: {
    nombre: string;
    version: number;
    incluidos: number;
    adicionales: number;
    totalUsuarios: number;
    gb: number | null;
  };
  diferencias: ReturnType<typeof diferenciasCapacidades>;
  diagnostico: DiagnosticoCambioPlan;
  bloqueos: string[];
  revisiones: string[];
  ciclo: 'mensual' | 'anual';
  totalPeriodo: number;
  precioBase: number;
  implementacion?: number;
  implementacionPriceId?: string | null;
  totalInicial?: number;
  precioUsuario: number;
};
export type CobroContratacion = {
  aCobrar: number | null;
  aCredito: number;
  moneda: string;
  impuestosEnCheckout: boolean;
};
export type VistaContratacion = {
  id: string | null;
  ofertaId: string;
  tipo: 'checkout' | 'cambio';
  estado: string;
  expiraEl: string | null;
  revision: RevisionContratacion;
  cobro: CobroContratacion | null;
  transaccionId: string | null;
  detalle: string | null;
};
