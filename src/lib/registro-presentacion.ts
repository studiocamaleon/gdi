import type { PlanRegistro } from "./registro-api";

// Los nombres comerciales evolucionan; los códigos de suscripción se conservan.
const NOMBRES: Record<string, string> = {
  taller: "Print",
  estudio: "Sign",
  diamante: "Industrial",
};
const ALIAS: Record<string, string> = {
  print: "taller",
  sign: "estudio",
  industrial: "diamante",
};

export function nombrePlanRegistro(
  plan: Pick<PlanRegistro, "codigo" | "nombre">,
) {
  return NOMBRES[plan.codigo] ?? plan.nombre;
}

export function planInicialRegistro(
  planes: PlanRegistro[],
  solicitado: string | null,
) {
  const elegibles = planes.filter(
    (plan) => plan.registroPublico && !plan.precioAConsultar,
  );
  const codigo = solicitado
    ? (ALIAS[solicitado.toLowerCase()] ?? solicitado)
    : null;
  return (
    elegibles.find((plan) => plan.codigo === codigo)?.codigo ??
    elegibles.find((plan) => plan.recomendado)?.codigo ??
    elegibles[0]?.codigo ??
    ""
  );
}

export type CamposRegistro = {
  nombreCompleto: string;
  empresaNombre: string;
  email: string;
  password: string;
};
export const LIMITES_REGISTRO = {
  nombreCompleto: 100,
  empresaNombre: 120,
  email: 180,
  password: 72,
} as const;

export function errorCampoRegistro(
  nombre: keyof CamposRegistro,
  valor: string,
): string | null {
  if (nombre === "password")
    return valor.length < 10
      ? "Usá al menos 10 caracteres."
      : valor.length > 72
        ? "Usá hasta 72 caracteres."
        : null;
  if (!valor.trim()) return "Completá este campo.";
  if (valor.length > LIMITES_REGISTRO[nombre])
    return `Usá hasta ${LIMITES_REGISTRO[nombre]} caracteres.`;
  if (nombre === "email")
    return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(valor.trim())
      ? null
      : "Ingresá un correo válido.";
  return valor.trim().length >= 2 ? null : "Ingresá al menos 2 caracteres.";
}

export function puntajeClaveRegistro(valor: string) {
  let puntos = 0;
  if (valor.length >= 10) puntos++;
  if (valor.length >= 14) puntos++;
  if (/[A-Z]/.test(valor) && /[a-z]/.test(valor)) puntos++;
  if (/[0-9]|[^A-Za-z0-9]/.test(valor)) puntos++;
  return Math.min(puntos, 4);
}
