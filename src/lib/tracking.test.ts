import { describe, expect, it } from "vitest";

import { resumenEstadoTracking } from "@/lib/tracking";

describe("resumenEstadoTracking", () => {
  it("avisa que todavía falta cuando la orden sigue en producción", () => {
    expect(resumenEstadoTracking("produccion")).toBe(
      "Te avisaremos ni bien esté listo para retirar.",
    );
  });

  it("invita a retirar una orden finalizada", () => {
    expect(resumenEstadoTracking("finalizada")).toBe(
      "Ya podés retirarlo.",
    );
  });

  it("no promete un retiro cuando la orden ya fue entregada", () => {
    expect(resumenEstadoTracking("entregada")).toBe(
      "Pedido entregado. Gracias por confiar en nosotros.",
    );
  });
});
