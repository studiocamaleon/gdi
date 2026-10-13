import { describe, expect, it } from "vitest";
import {
  cadInicial,
  contenidoInicial,
  normalizarContenido,
} from "./centro-copiado-tarifarios-editor";
import {
  objetivosDeMatriz,
  objetivoDeTramo,
  reubicarObjetivos,
} from "./centro-copiado-objetivos-contribucion";

describe("Objetivos de contribución por rango", () => {
  it("los borradores anteriores conservan 30% sin modificar su contenido", () => {
    const c = contenidoInicial("ARS");
    expect(objetivosDeMatriz(c.hojas!)).toEqual(["30", "30", "30"]);
    expect(normalizarContenido(c)).toEqual(c);
  });
  it("normaliza porcentajes y mantiene objetivos independientes entre hojas y CAD", () => {
    const c = contenidoInicial("ARS");
    c.hojas!.objetivosContribucion = ["45,5", "40", "0"];
    c.cad = cadInicial("UNICA");
    c.cad.objetivosContribucion = ["60", "55", "50"];
    expect(normalizarContenido(c).hojas!.objetivosContribucion).toEqual([
      "45.5",
      "40",
      "0",
    ]);
    expect(normalizarContenido(c).cad!.objetivosContribucion).toEqual([
      "60",
      "55",
      "50",
    ]);
    expect(c.hojas!.objetivosContribucion[0]).toBe("45,5");
  });
  it.each(["", "100", "-1", "NaN", "1e2", "30.12345"])(
    "rechaza el objetivo %s",
    (valor) => {
      const c = contenidoInicial("ARS");
      c.hojas!.objetivosContribucion = [valor, "30", "30"];
      expect(() => normalizarContenido(c)).toThrow("contribución objetivo");
    },
  );
  it("rechaza configuraciones parciales y reubica objetivos al editar rangos", () => {
    const c = contenidoInicial("ARS");
    c.hojas!.objetivosContribucion = ["45", "40", "35"];
    expect(reubicarObjetivos(c.hojas!, [1, 50, 100, 700])).toEqual([
      "45",
      "45",
      "40",
      "35",
    ]);
    expect(reubicarObjetivos(c.hojas!, [1, 500])).toEqual(["45", "35"]);
    c.hojas!.objetivosContribucion.pop();
    expect(() => normalizarContenido(c)).toThrow("por rango general");
  });
  it("en rangos propios elige el mayor objetivo de los intervalos que cruza", () => {
    const m = contenidoInicial("ARS").hojas!;
    m.objetivosContribucion = ["35", "50", "20"];
    m.filas = [
      {
        combinacion: {
          papelMateriaPrimaId: "papel",
          gramaje: 80,
          color: "BN",
          cobertura: null,
          tamano: "A4",
          faz: 1,
        },
        rangosPropios: [1, 50, 500],
        precios: [],
      },
    ];
    expect([0, 1, 2].map((tramo) => objetivoDeTramo(m, 0, tramo))).toEqual([
      "35",
      "50",
      "20",
    ]);
    const cad = cadInicial("UNICA");
    cad.rangosGenerales = ["0", "0.3", "0.300000000001"];
    cad.objetivosContribucion = ["25", "60", "40"];
    cad.filas = [
      {
        combinacion: {
          papelMateriaPrimaId: "rollo",
          gramaje: null,
          color: "BN",
          cobertura: null,
          anchoRolloMm: 914,
        },
        rangosPropios: ["0", "0.3"],
        precios: [],
      },
    ];
    expect(objetivoDeTramo(cad, 0, 0)).toBe("25");
    expect(objetivoDeTramo(cad, 0, 1)).toBe("60");
  });
});
