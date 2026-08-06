import { describe, expect, it } from "vitest";

import {
  buildConfigPasoRuntime,
  getParamsComercialDeRuta,
  valorEfectivoCampo,
} from "@/lib/params-comercial";
import type { FamiliaListItem } from "@/lib/productos-servicios";

const FAMILIA_OJALES = {
  codigo: "colocacion_ojales",
  paramsPasoSchema: [
    {
      campo: "separacionMaxMm",
      etiqueta: "Separación máxima entre ojales (mm)",
      tipo: "number",
    },
    {
      campo: "lados",
      etiqueta: "Lados con ojales",
      tipo: "multi-enum",
      valoresPermitidos: ["superior", "inferior", "izquierdo", "derecho"],
    },
  ],
} as unknown as FamiliaListItem;

const familias = new Map([["colocacion_ojales", FAMILIA_OJALES]]);

function configPaso(over: Record<string, unknown> = {}) {
  return {
    id: "cfg-ojales",
    nombreVisible: "Colocación de ojales",
    modoActivacion: "OPCIONAL",
    paramsPasoJson: {
      separacionMaxMm: 500,
      lados: ["superior", "inferior", "izquierdo", "derecho"],
      camposEditablesComercial: ["separacionMaxMm", "lados"],
    },
    rutaPaso: { familiaCodigo: "colocacion_ojales" },
    ...over,
  };
}

describe("getParamsComercialDeRuta", () => {
  it("devuelve los campos abiertos con lo modelado como sugerencia", () => {
    const r = getParamsComercialDeRuta([configPaso()], familias);
    expect(r).toHaveLength(1);
    expect(r[0].nombre).toBe("Colocación de ojales");
    expect(r[0].campos.map((c) => c.campo)).toEqual([
      "separacionMaxMm",
      "lados",
    ]);
    expect(r[0].campos[0].sugerido).toBe(500);
  });

  it("sin nombre visible, humaniza el código de familia", () => {
    const r = getParamsComercialDeRuta(
      [configPaso({ nombreVisible: null })],
      familias,
    );
    expect(r[0].nombre).toBe("Colocacion ojales");
  });

  it("un paso sin campos abiertos no aparece", () => {
    const sinAbrir = configPaso({
      paramsPasoJson: { separacionMaxMm: 500, lados: ["superior"] },
    });
    expect(getParamsComercialDeRuta([sinAbrir], familias)).toEqual([]);
  });

  /** Un campo abierto que la familia no declara no tiene cómo renderizarse. */
  it("descarta campos que el schema de la familia no conoce", () => {
    const raro = configPaso({
      paramsPasoJson: {
        lados: ["superior"],
        camposEditablesComercial: ["campoInventado"],
      },
    });
    expect(getParamsComercialDeRuta([raro], familias)).toEqual([]);
  });
});

describe("valorEfectivoCampo", () => {
  const campo = {
    campo: "separacionMaxMm",
    etiqueta: "",
    tipo: "number",
    valoresPermitidos: [],
    sugerido: 500,
  };

  it("sin elección usa la sugerencia", () => {
    expect(valorEfectivoCampo(campo, undefined)).toBe(500);
    expect(valorEfectivoCampo(campo, {})).toBe(500);
  });

  it("la elección del comercial gana", () => {
    expect(valorEfectivoCampo(campo, { separacionMaxMm: 300 })).toBe(300);
  });

  it("un array vacío es una elección válida", () => {
    expect(
      valorEfectivoCampo(
        { ...campo, campo: "lados", sugerido: ["superior"] },
        { lados: [] },
      ),
    ).toEqual([]);
  });
});

describe("buildConfigPasoRuntime", () => {
  const pasos = [configPaso()];
  const activo = () => true;

  it("manda sólo lo que el comercial cambió", () => {
    expect(
      buildConfigPasoRuntime(
        pasos,
        { "cfg-ojales": { separacionMaxMm: 300 } },
        activo,
      ),
    ).toEqual({ "cfg-ojales": { separacionMaxMm: 300 } });
  });

  it("sin cambios no manda nada: el motor ya tiene la sugerencia", () => {
    expect(buildConfigPasoRuntime(pasos, {}, activo)).toEqual({});
  });

  it("un paso NO activo no manda su runtime", () => {
    expect(
      buildConfigPasoRuntime(
        pasos,
        { "cfg-ojales": { separacionMaxMm: 300 } },
        () => false,
      ),
    ).toEqual({});
  });

  it("manda todo lo tocado sin filtrar por campos abiertos: la autoridad es paramsEfectivos del motor", () => {
    // Etapa 3 derivadores: el filtro espejo client-side hacía que los campos
    // `expuestoAlComercial` de la familia viajaran como si el comercial no
    // los hubiera tocado. El motor ignora server-side lo que no corresponda.
    expect(
      buildConfigPasoRuntime(
        pasos,
        { "cfg-ojales": { demasiaMm: 5, separacionMaxMm: 300 } },
        activo,
      ),
    ).toEqual({ "cfg-ojales": { demasiaMm: 5, separacionMaxMm: 300 } });
  });
});
