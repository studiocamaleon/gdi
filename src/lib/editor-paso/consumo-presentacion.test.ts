import { describe, expect, it } from "vitest";

import {
  describirConsumoAutomatico,
  resumirReglaCantidad,
} from "./consumo-presentacion";

describe("presentación humana del consumo de materiales", () => {
  it("explica el nesting de un vinilo sin exponer la fórmula", () => {
    const regla = describirConsumoAutomatico({
      familiaCodigo: "impresion_por_area",
      slotCodigo: "sustrato_principal",
      formula: "por_unidad_productiva",
      materialLabel: "Vinilo Ritrama PM80",
      paramsPaso: {},
    });

    expect(regla.dato).toBe("Acomodo real de las piezas");
    expect(regla.resumen).toContain("vinilo Ritrama PM80");
    expect(regla.resumen).toContain("rollo, pliego o placa");
  });

  it("explica los pliegos de tarjetas desde la imposición", () => {
    const regla = describirConsumoAutomatico({
      familiaCodigo: "impresion_por_hoja",
      materialLabel: "Papel ilustración brillante",
    });

    expect(regla.dato).toBe("Pliegos resultantes de la imposición");
    expect(regla.resultado).toContain("pliegos");
  });

  it("convierte los broches de un talonario en una frase de negocio", () => {
    expect(
      resumirReglaCantidad({
        cantidad: 2,
        base: "cantidad_pedida",
        materialLabel: "Broches",
      }),
    ).toBe("Por cada cantidad pedida, el sistema descontará 2 broches.");
  });

  it("explica el material de montaje de un imán vehicular", () => {
    const regla = describirConsumoAutomatico({
      familiaCodigo: "montaje_sobre_sustrato",
      materialLabel: "Imán vehicular",
    });

    expect(regla.dato).toBe("Acomodo sobre el material de montaje");
    expect(regla.resumen).toContain("material de montaje");
  });

  it("usa las personalizaciones como fuente del film DTF de una remera", () => {
    const regla = describirConsumoAutomatico({
      familiaCodigo: "impresion_por_area",
      materialLabel: "Film DTF textil",
      paramsPaso: {
        fuenteMedidaPersonalizaciones: ["pecho", "espalda"],
      },
    });

    expect(regla.dato).toBe("Estampas activadas y sus medidas");
    expect(regla.resumen).toContain("medidas cargadas al cotizar");
  });
});
