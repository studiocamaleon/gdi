import type { ProgresoProduccion } from "./progreso-produccion";
import { apiRequest } from "@/lib/api";

export type PanelGeneralKpi = {
  id: string;
  etiqueta: string;
  valor: number;
  formato: "cantidad" | "moneda";
  tono: "neutro" | "ok" | "atencion" | "critico";
  detalle: string;
  href: string;
};

export type PanelGeneralAtencion = {
  id: string;
  dominio: "comercial" | "produccion" | "administracion";
  severidad: "critico" | "atencion" | "info";
  titulo: string;
  detalle: string;
  cantidad: number;
  href: string;
};

export type PanelGeneralEntrega = {
  id: string;
  numero: string;
  cliente: string | null;
  producto: string;
  productos: Array<{
    id: string;
    nombre: string;
    progresoPct: number | null;
    progreso?: ProgresoProduccion;
  }>;
  fechaEntrega: string;
  progresoPct: number | null;
  progreso?: ProgresoProduccion;
  riesgo: "atrasada" | "hoy" | "proxima";
  pasoActual: string | null;
  estacionActual: string | null;
  href: string;
};

export type PanelGeneralAccion = {
  id: string;
  etiqueta: string;
  href: string;
  icono:
    | "orden"
    | "presupuesto"
    | "produccion"
    | "estaciones"
    | "egreso"
    | "facturacion";
};

export type PanelActividad = {
  items: Array<{
    id: string;
    fecha: string;
    tipo: string;
    titulo: string;
    detalle: string;
    actor: string | null;
    href: string | null;
  }>;
  siguienteCursor: string | null;
};

export type PanelAdministrador = {
  actividad: PanelActividad;
  pasosCompletadosHoy: number | null;
  documentacionPendiente: {
    total: number;
    ordenes: Array<{
      id: string;
      numero: string;
      requisitos: number;
      href: string;
    }>;
  };
};

export function getPanelActividad(cursor?: string): Promise<PanelActividad> {
  return apiRequest(
    `/panel-general/actividad${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
  );
}

export type PanelGeneralData = {
  administrador?: PanelAdministrador | null;
  entregas: Record<
    PanelGeneralEntrega["riesgo"],
    { items: PanelGeneralEntrega[]; total: number }
  > | null;
  generadoEl: string;
  fechaLocal: string;
  kpis: PanelGeneralKpi[];
  atencion: PanelGeneralAtencion[];
  atencionTotal: number;
  taller: {
    itemsActivos: number;
    pasosEnCurso: number;
    pasosBloqueados: number;
    cuelloBotella: {
      estacion: string;
      colaMin: number;
      utilizacionPct: number;
      pasos: number;
    } | null;
  } | null;
  accionesRapidas: PanelGeneralAccion[];
};

export function getPanelGeneral(): Promise<PanelGeneralData> {
  return apiRequest<PanelGeneralData>("/panel-general");
}
