import { cache } from "react";

export type PublicPlan = {
  implementacion?: { importe: number } | null;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  ofertaId?: string;
  moneda: string;
  precioMensual: number | null;
  precioAConsultar: boolean;
  registroPublico: boolean;
  recomendado: boolean;
  trialDias: number | null;
  anual?: { importe: number } | null;
  usuarioMensual?: { importe: number } | null;
  usuarioAnual?: { importe: number } | null;
  prestaciones?: { clave: string; nombre: string; grupo: string }[];
  features: Record<string, unknown>;
};

// El catálogo público no contiene credenciales ni necesita sesión del tenant.
// No conservamos un precio anterior si falla la consulta.
// Comparativa e integraciones comparten una lectura durante este render.
// React cache no conserva esta respuesta entre solicitudes de usuarios.
export const getPublicPlans = cache(async (): Promise<PublicPlan[] | null> => {
  const base =
    process.env.MARKETING_API_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3001/api"
      : null);
  if (!base) return null;
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/registro/planes`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const planes: unknown = await response.json();
    if (!Array.isArray(planes) || !planes.every(isPublicPlan)) return null;
    return planes;
  } catch {
    return null;
  }
});

function isPublicPlan(plan: unknown): plan is PublicPlan {
  if (!plan || typeof plan !== "object") return false;
  const p = plan as Record<string, unknown>;
  return (
    typeof p.codigo === "string" &&
    typeof p.nombre === "string" &&
    typeof p.moneda === "string" &&
    /^[A-Z]{3}$/.test(p.moneda) &&
    (p.descripcion === null || typeof p.descripcion === "string") &&
    (p.precioMensual === null ||
      (typeof p.precioMensual === "number" &&
        Number.isFinite(p.precioMensual) &&
        p.precioMensual > 0)) &&
    typeof p.precioAConsultar === "boolean" &&
    typeof p.registroPublico === "boolean" &&
    typeof p.recomendado === "boolean" &&
    (p.trialDias === null ||
      (typeof p.trialDias === "number" &&
        Number.isInteger(p.trialDias) &&
        p.trialDias > 0)) &&
    typeof p.features === "object" &&
    p.features !== null &&
    !Array.isArray(p.features) &&
    (p.ofertaId === undefined || typeof p.ofertaId === "string") &&
    [p.anual, p.usuarioMensual, p.usuarioAnual, p.implementacion].every(
      (v) =>
        v == null ||
        (typeof v === "object" &&
          "importe" in v &&
          typeof v.importe === "number" &&
          Number.isFinite(v.importe) &&
          v.importe > 0),
    ) &&
    (p.prestaciones === undefined ||
      (Array.isArray(p.prestaciones) &&
        p.prestaciones.every(
          (v: unknown) =>
            v !== null &&
            typeof v === "object" &&
            "clave" in v &&
            typeof v.clave === "string" &&
            "nombre" in v &&
            typeof v.nombre === "string" &&
            "grupo" in v &&
            typeof v.grupo === "string",
        )))
  );
}

export function planSignup(signup: string, plan: PublicPlan) {
  const url = new URL(signup);
  url.searchParams.set("plan", plan.codigo);
  if (plan.ofertaId) url.searchParams.set("oferta", plan.ofertaId);
  else url.searchParams.delete("oferta");
  return url.toString();
}
