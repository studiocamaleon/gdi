import { expect, it } from "vitest";
import { normalizarTelefonoCliente } from "./telefono-cliente";
it("el formulario usa el mismo normalizador que la API", () => {
  expect(
    normalizarTelefonoCliente("54", "+54 9 341 555-1840", "AR"),
  ).toMatchObject({
    ok: true,
    telefonoCodigo: "54",
    telefonoNumero: "93415551840",
  });
  expect(normalizarTelefonoCliente("54", "123", "AR").ok).toBe(false);
});
