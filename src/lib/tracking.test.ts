import { describe, expect, it } from "vitest";

import { copyDePaso, resumenEstadoTracking } from "@/lib/tracking";

describe("resumenEstadoTracking", () => {
  it("avisa que todavía falta cuando la orden sigue en producción", () => {
    expect(resumenEstadoTracking("produccion")).toBe(
      "Te avisaremos ni bien esté listo para retirar.",
    );
  });

  it("invita a retirar una orden finalizada", () => {
    expect(resumenEstadoTracking("finalizada")).toBe("Ya podés retirarlo.");
  });

  it("no promete un retiro cuando la orden ya fue entregada", () => {
    expect(resumenEstadoTracking("entregada")).toBe(
      "Pedido entregado. Gracias por confiar en nosotros.",
    );
  });
});

describe("nombre público de los pasos manuales", () => {
  it.each([
    { familiaCodigo: "trabajo_manual" },
    { familiaCodigo: "familia-propia", plantillaCodigo: "trabajo_manual" },
  ])("conserva el nombre real de $familiaCodigo", (familia) => {
    expect(
      copyDePaso({ ...familia, nombre: "  Encolado de talonarios  " }).simple,
    ).toBe("Encolado de talonarios");
  });

  it("mantiene un título legible si el nombre manual está vacío", () => {
    expect(
      copyDePaso({ familiaCodigo: "trabajo_manual", nombre: "  " }).simple,
    ).toBe("Trabajo manual");
  });

  it("conserva el texto de las demás familias y el respaldo para familias desconocidas", () => {
    expect(
      copyDePaso({
        familiaCodigo: "impresion_por_area",
        nombre: "Máquina interna",
      }).simple,
    ).toBe("Imprimiendo tu pedido");
    expect(
      copyDePaso({
        familiaCodigo: "familia-propia",
        plantillaCodigo: "corte_guillotina",
        nombre: "Refilado",
      }).simple,
    ).toBe("Cortamos a medida");
    expect(
      copyDePaso({ familiaCodigo: "desconocida", nombre: "Operación interna" })
        .simple,
    ).toBe("Paso de producción");
  });
});
