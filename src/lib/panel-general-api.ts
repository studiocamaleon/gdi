import { apiRequest } from "@/lib/api";

export type PanelGeneralVista =
  "actual" | "jefe_produccion" | "vendedor" | "administrativo" | "operario";

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
    progresoPct: number;
  }>;
  fechaEntrega: string;
  progresoPct: number;
  riesgo: "atrasada" | "hoy" | "proxima";
  pasoActual: string | null;
  estacionActual: string | null;
  href: string;
};

export type PanelGeneralTarea = {
  pasoId: string;
  ordenId: string;
  ordenNumero: string;
  itemNombre: string;
  pasoNombre: string;
  estado: string;
  motivoBloqueo: string | null;
  activa: boolean;
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

export type PanelGeneralData = {
  generadoEl: string;
  fechaLocal: string;
  vistaActual: PanelGeneralVista;
  previsualizando: boolean;
  vistasDisponibles: Array<{
    id: PanelGeneralVista;
    etiqueta: string;
    descripcion: string;
  }>;
  kpis: PanelGeneralKpi[];
  atencion: PanelGeneralAtencion[];
  atencionTotal: number;
  proximasEntregas: PanelGeneralEntrega[];
  proximasEntregasTotal: number;
  trabajoPersonal: { tareas: PanelGeneralTarea[]; total: number };
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
  administracion: {
    cobrosVencidos: number;
    porFacturar: number;
    pagosVencidos: number;
    acreditacionesPendientes: number;
  } | null;
  vendedorSinVinculo: boolean;
  accionesRapidas: PanelGeneralAccion[];
};

export function getPanelGeneral(
  vista: PanelGeneralVista = "actual",
): Promise<PanelGeneralData> {
  const query = vista === "actual" ? "" : `?vista=${vista}`;
  return apiRequest<PanelGeneralData>(`/panel-general${query}`);
}
