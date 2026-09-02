import { describe, expect, it } from "vitest";

import { construirWorkflowCotizacion } from "@/lib/workflow-cotizacion";

const paso = (id: string, orden: number, nombre: string) => ({
  rutaPasoId: id,
  rutaPasoOrden: orden,
  familiaCodigo: nombre.toLowerCase().replaceAll(" ", "_"),
  nombreVisible: nombre,
  activado: true,
});

describe("construirWorkflowCotizacion", () => {
  it("respeta el DAG congelado e intercala componentes en su momento real", () => {
    const ensamblaje = paso("ensamble", 1, "Ensamblaje final");
    const control = paso("control", 2, "Control final");
    const resultado = construirWorkflowCotizacion({
      pasos: [ensamblaje, control],
      componentes: [
        {
          codigo: "BASTIDOR",
          nombre: "Bastidor",
          nodoIncorporacionClave: "ruta:ensamble",
        },
        {
          codigo: "LONA",
          nombre: "Lona",
          nodoIncorporacionClave: "ruta:ensamble",
        },
      ],
      grafoProduccion: {
        nodos: [
          { clave: "ruta:ensamble", indice: 0 },
          { clave: "ruta:control", indice: 1 },
        ],
        aristas: [{ desdeClave: "ruta:ensamble", haciaClave: "ruta:control" }],
      },
    });

    expect(
      resultado.columnas.map((columna) =>
        columna.map((nodo) => `${nodo.tipo}:${nodo.clave}`),
      ),
    ).toEqual([
      ["COMPONENTE:componente:BASTIDOR", "COMPONENTE:componente:LONA"],
      ["PASO:ruta:ensamble"],
      ["PASO:ruta:control"],
    ]);
  });

  it("mantiene una ruta lineal legible para snapshots anteriores al DAG", () => {
    const resultado = construirWorkflowCotizacion({
      pasos: [paso("impresion", 1, "Impresión"), paso("corte", 2, "Corte")],
      componentes: [],
    });

    expect(resultado.columnas.map((columna) => columna[0].clave)).toEqual([
      "ruta:impresion",
      "ruta:corte",
    ]);
  });

  it("oculta pasos desactivados sin romper el resto del recorrido", () => {
    const omitido = { ...paso("omitido", 1, "Omitido"), activado: false };
    const activo = paso("activo", 2, "Activo");
    const resultado = construirWorkflowCotizacion({
      pasos: [omitido, activo],
      componentes: [],
    });

    expect(resultado.nodos.map((nodo) => nodo.clave)).toEqual(["ruta:activo"]);
  });
});
