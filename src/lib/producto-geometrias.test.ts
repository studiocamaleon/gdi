import { describe, expect, it } from "vitest";
import {
  escalarGeometriaProporcional,
  getGeometriasComerciales,
  nuevaFuenteGeometria,
  obtenerRelacionAspectoSvg,
  setGeometriasComerciales,
} from "./producto-geometrias";

describe("geometrías comerciales del producto", () => {
  it("preserva el comportamiento rectangular de productos existentes", () => {
    expect(getGeometriasComerciales(null)).toEqual({
      version: 1,
      modo: "RECTANGULAR",
      fuentes: [],
    });
  });

  it("actualiza sólo su sección dentro de atributos comerciales", () => {
    const atributos = setGeometriasComerciales(
      { nestingCompuesto: { version: 1 } },
      {
        version: 1,
        modo: "VECTORIAL",
        fuentes: [{ id: "principal", nombre: "Contorno", requerida: true }],
      },
    );
    expect(atributos.nestingCompuesto).toEqual({ version: 1 });
    expect(getGeometriasComerciales(atributos).modo).toBe("VECTORIAL");
  });

  it("genera identificadores estables sin repetir los existentes", () => {
    expect(
      nuevaFuenteGeometria([
        { id: "principal", nombre: "Principal", requerida: true },
      ]),
    ).toMatchObject({ id: "diseno_2", nombre: "Diseño 2" });
  });

  it("escala el vector desde un solo eje y conserva su proporción", () => {
    const relacion = obtenerRelacionAspectoSvg(
      '<svg viewBox="0 0 200 50"><path d="M0 0h200v50H0z"/></svg>',
    );
    expect(escalarGeometriaProporcional(relacion, "ancho", 800)).toEqual({
      anchoFinalMm: 800,
      altoFinalMm: 200,
    });
    expect(escalarGeometriaProporcional(relacion, "alto", 300)).toEqual({
      anchoFinalMm: 1200,
      altoFinalMm: 300,
    });
  });
});
