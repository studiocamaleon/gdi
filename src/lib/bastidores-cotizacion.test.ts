import { describe, expect, it } from "vitest";
import { recolectarBastidoresCotizacion } from "./bastidores-cotizacion";
import type { EstructuraBastidor } from "./estructura-bastidor-api";

const estructura: EstructuraBastidor = {
  tipoBastidor: "doble",
  anchoM: 2.4,
  altoM: 1.2,
  profundidadM: 0.15,
  perfilLadoM: 0.02,
  sepRefuerzoVcm: 100,
  sepRefuerzoHcm: 0,
  refuerzosV: 2,
  refuerzosH: 0,
  despieceMm: [2400, 1160, 110],
  puntosSoldadura: 16,
};
const paso = {
  familiaCodigo: "estructura_bastidor",
  activado: true,
  estructuraBastidor: estructura,
};

describe("bastidores del producto compuesto", () => {
  it("ofrece el 3D y el despiece efectivo aunque el padre sólo tenga armado", () => {
    const fuentes = recolectarBastidoresCotizacion({
      pasos: [{ familiaCodigo: "trabajo_manual" }],
      componentesFabricados: [{ nombre: "Bastidor doble", pasos: [paso] }],
    });
    expect(fuentes).toHaveLength(1);
    expect(fuentes[0].label).toBe("Bastidor doble · Bastidor 3D");
    expect(fuentes[0].estructura).toBe(estructura);
    expect(fuentes[0].estructura?.perfilLadoM).toBe(0.02);
  });

  it("mantiene separados los bastidores de varios componentes y niveles", () => {
    const otra = { ...estructura, anchoM: 1.8 };
    const fuentes = recolectarBastidoresCotizacion({
      pasos: [paso],
      componentesFabricados: [
        {
          nombre: "Caja",
          componentes: [
            {
              nombre: "Refuerzo",
              pasos: [{ ...paso, estructuraBastidor: otra }],
            },
          ],
        },
      ],
    });
    expect(fuentes.map((f) => f.estructura?.anchoM)).toEqual([2.4, 1.8]);
    expect(new Set(fuentes.map((f) => f.key)).size).toBe(2);
    expect(fuentes[1].label).toBe("Caja › Refuerzo · Bastidor 3D");
  });

  it("ignora pasos desactivados y conserva el fallback histórico", () => {
    expect(
      recolectarBastidoresCotizacion({ pasos: [{ ...paso, activado: false }] }),
    ).toEqual([]);
    expect(
      recolectarBastidoresCotizacion({
        pasos: [{ familiaCodigo: "estructura_bastidor" }],
      })[0],
    ).toMatchObject({ label: "Bastidor 3D", estructura: null });
  });
});
