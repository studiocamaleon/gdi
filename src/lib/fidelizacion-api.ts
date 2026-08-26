import { apiRequest } from "@/lib/api";

export type FidelizacionConfig = {
  acumulacionActiva: boolean;
  porcentajeMargen: number;
  montoBase: number;
  puntosBase: number;
  activadaEl: string | null;
  conversionBloqueada: boolean;
};

export type ActualizarFidelizacionPayload = Pick<
  FidelizacionConfig,
  "acumulacionActiva" | "porcentajeMargen" | "montoBase" | "puntosBase"
>;
export type FidelizacionMovimiento = {
  id: string;
  tipo: string;
  deltaPuntos: number;
  montoEquivalente: number;
  actorNombre: string;
  motivo: string | null;
  createdAt: string;
  cliente?: { nombre: string };
};
export type FidelizacionCuenta = {
  cliente: { id: string; nombre: string };
  saldoPuntos: number;
  reservadosPuntos: number;
  disponiblesPuntos: number;
  equivalenteMonetario: number;
  movimientos: FidelizacionMovimiento[];
};
export type FidelizacionResumen = {
  config: FidelizacionConfig;
  metricas: {
    clientes: number;
    saldoPuntos: number;
    reservadosPuntos: number;
    equivalenteMonetario: number;
    emitidos: number;
    canjeados: number;
  };
  recientes: FidelizacionMovimiento[];
};

export const getFidelizacionResumen = () =>
  apiRequest<FidelizacionResumen>("/fidelizacion/resumen");
export const getFidelizacionCuenta = (clienteId: string) =>
  apiRequest<FidelizacionCuenta>(`/fidelizacion/clientes/${clienteId}`);
export const actualizarFidelizacion = (
  payload: ActualizarFidelizacionPayload,
) =>
  apiRequest<FidelizacionConfig>("/fidelizacion/configuracion", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
export const ajustarPuntos = (
  clienteId: string,
  payload: { tipo: "CREDITO" | "DEBITO"; puntos: number; motivo: string },
) =>
  apiRequest(`/fidelizacion/clientes/${clienteId}/ajustes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
export type FidelizacionSimulacion = {
  acumulacionActiva: boolean;
  saldoDisponible: number;
  saldoDisponibleMonto: number;
  puntosEstimados: number;
  puntosEstimadosMonto: number;
  maximoCanjeable: number;
  canjePuntos: number;
  canjeMonto: number;
};
export const simularFidelizacion = (
  clienteId: string,
  payload: { margen: number; total: number; canjePuntos: number },
) =>
  apiRequest<FidelizacionSimulacion>(
    `/fidelizacion/clientes/${clienteId}/simular`,
    { method: "POST", body: JSON.stringify(payload) },
  );
