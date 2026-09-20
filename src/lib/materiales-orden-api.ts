import { apiRequest } from "./api";

export type OrigenNecesidadMaterial = {
  itemId: string;
  producto: string;
  documento?: string;
  pasoId: string | null;
  paso: string;
  tipo: "material" | "consumible";
  loteCompartido: boolean;
  cantidadCalculada: number | null;
  unidadCalculada: string | null;
  cantidadStock: number | null;
  unidadStock: string | null;
  observacion: string | null;
};
export type NecesidadMaterialOrden = {
  varianteId: string;
  nombre: string;
  estado: "calculada" | "revisar";
  cantidad: number | null;
  unidad: string | null;
  origenes: OrigenNecesidadMaterial[];
};
export type MaterialesOrden = {
  control?: ControlMateriales;
  ordenId: string;
  revision: string;
  necesidades: NecesidadMaterialOrden[];
  pendientes: Array<{
    itemId: string;
    producto: string;
    paso: string | null;
    motivo: string;
  }>;
  resumen: {
    variantes: number;
    calculadas: number;
    porRevisar: number;
    desgastesExcluidos: number;
  };
};

export function getMaterialesOrden(id: string, signal?: AbortSignal) {
  return apiRequest<MaterialesOrden>(`/ordenes-trabajo/${id}/materiales`, {
    signal,
  });
}

export type ControlMaterial = {
  necesidadId?: string | null;
  enCompra?: number;
  compras?: Array<{
    ordenId: string;
    numero: number;
    cantidad: number;
    fecha: string | null;
    confirmada: boolean;
    estado: string;
  }>;
  varianteId: string;
  unidad: string | null;
  cantidad: number | null;
  consumida: number;
  reservada: number;
  fisico: number;
  libre: number;
  pendiente: number | null;
  faltante: number | null;
  fuente: string;
  revisar: boolean;
  excluida: boolean;
  motivo: string | null;
  reservas: Array<{ ubicacionId: string; nombre: string; cantidad: number }>;
};
export type ControlMateriales = {
  modoReserva?: "AL_EMITIR" | "MANUAL";
  habilitado: boolean;
  iniciado: boolean;
  estadoOrden: string;
  materiales: ControlMaterial[];
};
export type OperacionMaterial = {
  clave: string;
  revision: string;
  accion: "reservar" | "liberar" | "consumir" | "definir" | "sincronizar";
  varianteId?: string;
  ubicacionId?: string;
  cantidad?: number;
  unidad?: string;
  motivo?: string;
};
export function operarMateriales(id: string, data: OperacionMaterial) {
  return apiRequest<{ ok: boolean; repetida: boolean }>(
    `/ordenes-trabajo/${id}/materiales/operaciones`,
    { method: "POST", body: JSON.stringify(data) },
  );
}
export type PoliticaReservas = {
  modo: "AL_EMITIR" | "MANUAL";
  habilitada: boolean;
  incluirConsumibles: boolean;
  version: number;
};
export function getPoliticaReservas() {
  return apiRequest<PoliticaReservas>("/inventario/reservas/configuracion");
}
export function savePoliticaReservas(data: PoliticaReservas) {
  // El GET puede incluir metadatos de persistencia. Enviar sólo el contrato
  // editable: los tipos de TypeScript no eliminan propiedades en runtime.
  return apiRequest<PoliticaReservas>("/inventario/reservas/configuracion", {
    method: "PUT",
    body: JSON.stringify({
      modo: data.modo,
      habilitada: data.habilitada,
      incluirConsumibles: data.incluirConsumibles,
      version: data.version,
    }),
  });
}
export type ReservaStock = {
  id: string;
  cantidad: string;
  necesidad: { unidad: string; orden: { id: string; numero: string } };
  ubicacion: { nombre: string; almacen: { nombre: string } };
};
export function getReservasStock(varianteId: string, ubicacionId: string) {
  return apiRequest<ReservaStock[]>(
    `/inventario/reservas/${varianteId}?ubicacionId=${ubicacionId}`,
  );
}
