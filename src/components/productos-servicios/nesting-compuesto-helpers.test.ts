import { describe, expect, it } from "vitest";

import type { ProductoRecetaComponenteInput } from "@/lib/productos-servicios-api";
import {
  actualizarExclusionNestingComponente,
  actualizarPoliticaNestingCompuesto,
  estaExcluidoDelNestingCompuesto,
  leerPoliticaNestingCompuesto,
} from "./nesting-compuesto-helpers";

function componente(
  configuracionJson: ProductoRecetaComponenteInput["configuracionJson"] = null,
): ProductoRecetaComponenteInput {
  return {
    productoComponenteId: "hijo-1",
    codigo: "H-1",
    nombre: "Componente uno",
    cantidad: 2,
    unidad: "unidad",
    configuracionJson,
  };
}

describe("política de nesting compuesto en la interfaz", () => {
  it("usa nesting independiente ante una configuración ausente o desconocida", () => {
    expect(leerPoliticaNestingCompuesto(null)).toBe("INDEPENDIENTE");
    expect(
      leerPoliticaNestingCompuesto({
        nestingCompuesto: { version: 9, politica: "OTRA" },
      }),
    ).toBe("INDEPENDIENTE");
  });

  it("actualiza la política sin eliminar otros atributos comerciales", () => {
    expect(
      actualizarPoliticaNestingCompuesto(
        { herramientas: { editorSello: true } },
        "CONSOLIDAR_COMPATIBLES",
      ),
    ).toEqual({
      herramientas: { editorSello: true },
      nestingCompuesto: {
        version: 1,
        politica: "CONSOLIDAR_COMPATIBLES",
      },
    });
  });

  it("excluye un componente preservando bindings, pricing y configuración operativa", () => {
    const resultado = actualizarExclusionNestingComponente(
      componente({
        version: 2,
        bindings: [
          {
            clave: "cantidad",
            etiqueta: "Cantidad",
            tipoDato: "number",
            requerido: true,
            origen: "FIJO",
            valor: 2,
          },
        ],
        pricing: { version: 1, modo: "HEREDAR_PADRE" },
        operacionesIncorporacion: [
          {
            codigo: "ARMAR",
            nombre: "Armado",
            modoTiempo: "FIJO",
            minutosFijos: 5,
          },
        ],
      }),
      true,
    );

    expect(resultado.configuracionJson).toMatchObject({
      version: 2,
      bindings: [expect.objectContaining({ clave: "cantidad" })],
      pricing: { version: 1, modo: "HEREDAR_PADRE" },
      operacionesIncorporacion: [{ codigo: "ARMAR" }],
      nestingCompuesto: {
        version: 1,
        excluido: true,
        motivo: "Excluido manualmente en la receta",
      },
    });
    expect(estaExcluidoDelNestingCompuesto(resultado.configuracionJson)).toBe(
      true,
    );
  });

  it("crea una configuración válida y conserva el multiplicador de un componente legacy", () => {
    const excluido = actualizarExclusionNestingComponente(componente(), true);
    expect(excluido.configuracionJson?.bindings).toEqual([
      expect.objectContaining({
        clave: "cantidad",
        regla: expect.objectContaining({ valor: 2 }),
      }),
    ]);

    const incluido = actualizarExclusionNestingComponente(excluido, false);
    expect(incluido.configuracionJson?.nestingCompuesto).toBeUndefined();
    expect(incluido.configuracionJson?.bindings).toEqual(
      excluido.configuracionJson?.bindings,
    );
  });
});
