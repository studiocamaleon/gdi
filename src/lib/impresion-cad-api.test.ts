import { expect, it, vi } from "vitest";
const request = vi.hoisted(() => vi.fn());
vi.mock("./api", () => ({ apiRequest: request }));
import { guardarConfiguracionCad, prepararPruebaCad } from "./impresion-api";

it("guarda únicamente los campos del DTO; el margen de seguridad queda en el servidor", async () => {
  await guardarConfiguracionCad("cad-1", {
    ...{
      anchoRolloMm: 914,
      margenMm: 5,
      origenPapel: "Rollo 1",
      usarOrigenPredeterminado: false,
    },
    version: 2,
    habilitado: true,
  });
  expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({
    anchoRolloMm: 914,
    origenPapel: "Rollo 1",
    usarOrigenPredeterminado: false,
    version: 2,
    habilitado: true,
  });
  expect(request.mock.calls[0][0]).toBe("/impresion/destinos/cad-1/cad");
});
it.each(["BN", "COLOR"] as const)(
  "la prueba solicita formato, versión y color %s sin tamaños ni comandos del cliente",
  async (color) => {
    request.mockClear();
    await prepararPruebaCad("cad-1", 3, "A1", color);
    expect(request).toHaveBeenCalledExactlyOnceWith(
      "/impresion/destinos/cad-1/prueba-cad",
      {
        method: "POST",
        body: JSON.stringify({ version: 3, formato: "A1", color }),
      },
    );
  },
);
