import { describe, expect, it } from "vitest";
import type { PlanRegistro } from "./registro-api";
import {
  errorCampoRegistro,
  nombrePlanRegistro,
  planInicialRegistro,
} from "./registro-presentacion";

const plan = (
  codigo: string,
  extra: Partial<PlanRegistro> = {},
): PlanRegistro => ({
  codigo,
  nombre: codigo,
  descripcion: null,
  precioMensual: 190,
  moneda: "USD",
  trialDias: 14,
  registroPublico: true,
  recomendado: false,
  precioAConsultar: false,
  features: {},
  ...extra,
});
const planes = [
  plan("taller"),
  plan("estudio", { recomendado: true }),
  plan("diamante", { registroPublico: false, precioAConsultar: true }),
];

describe("Registro: compatibilidad entre nombres comerciales y contrato existente", () => {
  it("muestra los nuevos nombres sin cambiar los códigos enviados al API", () => {
    expect(planes.map(nombrePlanRegistro)).toEqual([
      "Print",
      "Sign",
      "Industrial",
    ]);
    expect(planInicialRegistro(planes, "print")).toBe("taller");
    expect(planInicialRegistro(planes, "sign")).toBe("estudio");
    expect(planInicialRegistro(planes, "taller")).toBe("taller");
    expect(planInicialRegistro(planes, "estudio")).toBe("estudio");
  });
  it("no habilita alta automática para un plan comercial, privado o a consultar", () => {
    expect(planInicialRegistro(planes, "industrial")).toBe("estudio");
    expect(
      planInicialRegistro(
        [plan("taller", { registroPublico: false })],
        "print",
      ),
    ).toBe("");
    expect(
      planInicialRegistro(
        [plan("taller", { precioAConsultar: true })],
        "print",
      ),
    ).toBe("");
    expect(planInicialRegistro([], null)).toBe("");
  });
  it("respeta la recomendación actual y conserva nombres de otros planes", () => {
    expect(planInicialRegistro(planes, "desconocido")).toBe("estudio");
    expect(planInicialRegistro([plan("taller"), plan("estudio")], null)).toBe(
      "taller",
    );
    expect(
      nombrePlanRegistro(plan("especial", { nombre: "Edición especial" })),
    ).toBe("Edición especial");
  });
});

describe("Validación del formulario según el DTO de registro", () => {
  it("conserva el mínimo de contraseña y aplica el máximo admitido por el API", () => {
    expect(errorCampoRegistro("password", "123456789")).toBeTruthy();
    expect(errorCampoRegistro("password", "1234567890")).toBeNull();
    expect(errorCampoRegistro("password", "x".repeat(72))).toBeNull();
    expect(errorCampoRegistro("password", "x".repeat(73))).toBeTruthy();
  });
  it("rechaza nombres vacíos y longitudes que el servidor rechazaría", () => {
    expect(errorCampoRegistro("nombreCompleto", "  ")).toBeTruthy();
    expect(errorCampoRegistro("nombreCompleto", "A")).toBeTruthy();
    expect(errorCampoRegistro("nombreCompleto", "Ana Beltrán")).toBeNull();
    expect(errorCampoRegistro("nombreCompleto", "x".repeat(101))).toBeTruthy();
    expect(errorCampoRegistro("empresaNombre", "x".repeat(121))).toBeTruthy();
  });
  it("mantiene la validación del correo y su longitud máxima", () => {
    expect(errorCampoRegistro("email", "sin-arroba")).toBeTruthy();
    expect(errorCampoRegistro("email", "ana@example.com")).toBeNull();
    expect(
      errorCampoRegistro("email", `${"a".repeat(170)}@example.com`),
    ).toBeTruthy();
  });
});
