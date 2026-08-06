import { describe, expect, it } from "vitest";

import {
  familiaConParamsEditables,
  etiquetaValorParam,
  paramVacio,
  patchParaEnum,
  toggleMultiEnum,
  valorBooleanoParam,
} from "@/lib/params-familia";

const LADOS = ["superior", "inferior", "izquierdo", "derecho"];

describe("familiaConParamsEditables", () => {
  it("es la familia quien lo DECLARA (editorParamsGenerico), no una lista", () => {
    expect(
      familiaConParamsEditables({ editorParamsGenerico: true }),
    ).toBe(true);
  });

  it("sin declaración (params muertos o UI a medida) no edita genérico", () => {
    expect(familiaConParamsEditables({})).toBe(false);
    expect(
      familiaConParamsEditables({ editorParamsGenerico: false }),
    ).toBe(false);
    expect(familiaConParamsEditables(undefined)).toBe(false);
  });
});

describe("patchParaEnum", () => {
  it("el preset bolsillo precarga lados horizontales y 100mm", () => {
    expect(patchParaEnum("subTipo", "bolsillo", {})).toEqual({
      subTipo: "bolsillo",
      lados: ["superior", "inferior"],
      demasiaMm: 100,
    });
  });

  it("el preset refuerzo precarga los 4 lados y 40mm", () => {
    expect(patchParaEnum("subTipo", "refuerzo", {})).toEqual({
      subTipo: "refuerzo",
      lados: ["superior", "inferior", "izquierdo", "derecho"],
      demasiaMm: 40,
    });
  });

  it("NO pisa lo que el modelador ya cargó", () => {
    expect(
      patchParaEnum("subTipo", "refuerzo", {
        lados: ["superior"],
        demasiaMm: 75,
      }),
    ).toEqual({ subTipo: "refuerzo" });
  });

  it("completa sólo los campos que están vacíos", () => {
    expect(
      patchParaEnum("subTipo", "bolsillo", { lados: [], demasiaMm: 75 }),
    ).toEqual({ subTipo: "bolsillo", lados: ["superior", "inferior"] });
  });

  it("un enum que no es subTipo no dispara presets", () => {
    expect(patchParaEnum("otroCampo", "bolsillo", {})).toEqual({
      otroCampo: "bolsillo",
    });
  });

  it("un valor vacío borra el campo", () => {
    expect(patchParaEnum("subTipo", "", {})).toEqual({ subTipo: null });
  });
});

describe("toggleMultiEnum", () => {
  it("agrega respetando el orden canónico, no el orden de clickeo", () => {
    const conDerecho = toggleMultiEnum(LADOS, [], "derecho", true);
    expect(toggleMultiEnum(LADOS, conDerecho, "superior", true)).toEqual([
      "superior",
      "derecho",
    ]);
  });

  it("quita el valor desmarcado", () => {
    expect(toggleMultiEnum(LADOS, LADOS, "izquierdo", false)).toEqual([
      "superior",
      "inferior",
      "derecho",
    ]);
  });

  it("descarta valores que no están permitidos por el schema", () => {
    expect(
      toggleMultiEnum(LADOS, ["superior", "diagonal"], "inferior", true),
    ).toEqual(["superior", "inferior"]);
  });

  it("puede quedar vacío: es config inválida y el editor la marca como error", () => {
    expect(toggleMultiEnum(LADOS, ["superior"], "superior", false)).toEqual([]);
  });
});

describe("valorBooleanoParam", () => {
  it("sin valor guardado usa el default del schema", () => {
    expect(valorBooleanoParam(undefined, true)).toBe(true);
    expect(valorBooleanoParam(undefined, false)).toBe(false);
  });

  it("sin valor ni default asume true", () => {
    expect(valorBooleanoParam(undefined, undefined)).toBe(true);
  });

  it("el valor guardado gana sobre el default", () => {
    expect(valorBooleanoParam(false, true)).toBe(false);
    expect(valorBooleanoParam(true, false)).toBe(true);
  });
});

describe("helpers de presentación", () => {
  it("traduce los valores conocidos y deja pasar los desconocidos", () => {
    expect(etiquetaValorParam("superior")).toBe("Superior");
    expect(etiquetaValorParam("algo_nuevo")).toBe("algo_nuevo");
  });

  it("paramVacio trata el array vacío como vacío", () => {
    expect(paramVacio([])).toBe(true);
    expect(paramVacio(["superior"])).toBe(false);
    expect(paramVacio(null)).toBe(true);
    expect(paramVacio(0)).toBe(false);
  });
});
