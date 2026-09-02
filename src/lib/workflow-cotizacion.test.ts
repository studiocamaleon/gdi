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

  it("oculta pasos desactivados sin romper ni reordenar el resto del recorrido", () => {
    const diseno = paso("diseno", 1, "Diseño gráfico");
    const preprensa = paso("preprensa", 2, "Pre-prensa");
    const impresion = paso("impresion", 3, "Impresión por hoja");
    const laminado = paso("laminado", 4, "Laminado");
    const guillotina = {
      ...paso("guillotina", 5, "Corte con guillotina"),
      activado: false,
    };
    const plotter = paso("plotter", 6, "Plotter de corte");
    const resultado = construirWorkflowCotizacion({
      pasos: [diseno, preprensa, impresion, laminado, guillotina, plotter],
      componentes: [],
      grafoProduccion: {
        nodos: [
          { clave: "ruta:diseno", indice: 0 },
          { clave: "ruta:preprensa", indice: 1 },
          { clave: "ruta:impresion", indice: 2 },
          { clave: "ruta:laminado", indice: 3 },
          { clave: "ruta:guillotina", indice: 4 },
          { clave: "ruta:plotter", indice: 5 },
        ],
        aristas: [
          { desdeClave: "ruta:diseno", haciaClave: "ruta:preprensa" },
          { desdeClave: "ruta:preprensa", haciaClave: "ruta:impresion" },
          { desdeClave: "ruta:impresion", haciaClave: "ruta:laminado" },
          { desdeClave: "ruta:laminado", haciaClave: "ruta:guillotina" },
          { desdeClave: "ruta:guillotina", haciaClave: "ruta:plotter" },
        ],
      },
    });

    expect(resultado.columnas.map((columna) => columna[0].clave)).toEqual([
      "ruta:diseno",
      "ruta:preprensa",
      "ruta:impresion",
      "ruta:laminado",
      "ruta:plotter",
    ]);
    expect(resultado.aristas).toContainEqual({
      desdeClave: "ruta:laminado",
      haciaClave: "ruta:plotter",
    });
  });
});
