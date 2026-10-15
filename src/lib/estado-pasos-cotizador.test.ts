import { expect, it } from "vitest";
import { completarEstadosPasosContexto } from "./estado-pasos-cotizador";

const pasos = [
  { id: "pre", rutaPasoId: "pre-ruta", modoActivacion: "CONDICIONAL", condicionActivacionJson: { "==": [{ var: "pasoActivo_diseno" }, 0] } },
  { id: "diseno-cfg", rutaPasoId: "diseno", modoActivacion: "OPCIONAL" },
];
it("resuelve el estado efectivo sin transmitirlo ni cambiar la selección explícita", () => {
  const ctx: Record<string, unknown> = { cantidad: 12, opcionalesActivados: {} };
  completarEstadosPasosContexto(pasos, ctx, { "diseno-cfg": true });
  expect(ctx.pasoActivo_diseno).toBe(1);
  expect(ctx["pasoActivo_pre-ruta"]).toBe(0);
  expect(JSON.parse(JSON.stringify(ctx))).toEqual({ cantidad: 12, opcionalesActivados: {} });
  completarEstadosPasosContexto(pasos, ctx, {});
  expect(ctx.pasoActivo_diseno).toBe(0);
  expect(ctx["pasoActivo_pre-ruta"]).toBe(1);
});
it("no presume inactivo un paso inexistente ni recurre indefinidamente en un ciclo", () => {
  for (const ref of ["ausente", "pre-ruta"]) {
    const ctx: Record<string, unknown> = {};
    completarEstadosPasosContexto([{ ...pasos[0], condicionActivacionJson: { "==": [{ var: `pasoActivo_${ref}` }, 0] } }], ctx, {});
    expect(ctx[`pasoActivo_${ref}`]).toBeUndefined();
  }
});
