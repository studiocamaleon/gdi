import { apiRequest } from "@/lib/api";

export type PlanRegistro = {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  precioMensual: number | null;
  moneda: string;
  trialDias: number | null;
  registroPublico: boolean;
  recomendado: boolean;
  precioAConsultar: boolean;
  features: Record<string, unknown>;
};

export type EstadoRegistro = {
  valido: boolean;
  vencido: boolean;
  completado: boolean;
  requiereLogin: boolean;
  email: string;
  empresa: string;
  plan: string;
};

export type RespuestaAlta = {
  requiereLogin: boolean;
  accessToken?: string | null;
};

export const listarPlanesRegistro = () =>
  apiRequest<PlanRegistro[]>("/registro/planes", undefined, { auth: false });

export const iniciarRegistro = (payload: Record<string, unknown>) =>
  apiRequest<{ ok: boolean; mensaje: string }>("/registro", {
    method: "POST",
    body: JSON.stringify(payload),
  }, { auth: false });

export const leerEstadoRegistro = (token: string) =>
  apiRequest<EstadoRegistro>(`/registro/verificar/${encodeURIComponent(token)}`, undefined, { auth: false });

export const completarRegistro = (token: string, existente = false) =>
  apiRequest<RespuestaAlta>(
    existente ? "/registro/completar-existente" : "/registro/completar",
    { method: "POST", body: JSON.stringify({ token }) },
    existente ? undefined : { auth: false },
  );

export const completarOnboarding = () =>
  apiRequest<{ ok: true }>("/registro/onboarding/completar", { method: "POST" });
