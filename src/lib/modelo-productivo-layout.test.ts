import { describe, expect, it } from "vitest";

import {
  construirColumnasProductivas,
  insertarNodoProductivo,
  moverNodoProductivo,
  type NodoProductivoVisual,
} from "./modelo-productivo-layout";

const nodos: NodoProductivoVisual[] = [
  { clave: "componente:bastidor", tipo: "COMPONENTE", orden: 0 },
  { clave: "componente:lona", tipo: "COMPONENTE", orden: 1 },
  { clave: "ruta:ensamble", tipo: "ETAPA", orden: 2 },
  { clave: "ruta:control", tipo: "PASO", orden: 3 },
];

describe("layout del modelo productivo", () => {
  it("representa ramas paralelas y su convergencia por columnas", () => {
    const columnas = construirColumnasProductivas(nodos, [
      { desdeClave: "componente:bastidor", haciaClave: "ruta:ensamble" },
      { desdeClave: "componente:lona", haciaClave: "ruta:ensamble" },
      { desdeClave: "ruta:ensamble", haciaClave: "ruta:control" },
    ]);

    expect(
      columnas.map((columna) => columna.map((nodo) => nodo.clave)),
    ).toEqual([
      ["componente:bastidor", "componente:lona"],
      ["ruta:ensamble"],
      ["ruta:control"],
    ]);
  });

  it("mueve un nodo a una fase paralela", () => {
    expect(
      moverNodoProductivo(
        [["componente:bastidor"], ["componente:lona"], ["ruta:ensamble"]],
        "componente:lona",
        { tipo: "PARALELO", columna: 0 },
      ),
    ).toEqual([["componente:bastidor", "componente:lona"], ["ruta:ensamble"]]);
  });

  it("inserta un nodo como un momento secuencial", () => {
    expect(
      moverNodoProductivo(
        [["componente:bastidor", "componente:lona"], ["ruta:ensamble"]],
        "componente:lona",
        { tipo: "SECUENCIAL", posicion: 1 },
      ),
    ).toEqual([
      ["componente:bastidor"],
      ["componente:lona"],
      ["ruta:ensamble"],
    ]);
  });

  it("agrega un nodo nuevo entre dos momentos sin mover los existentes", () => {
    expect(
      insertarNodoProductivo(
        [["componente:bastidor", "componente:lona"], ["ruta:ensamble"]],
        "extra:control",
        { tipo: "SECUENCIAL", posicion: 1 },
      ),
    ).toEqual([
      ["componente:bastidor", "componente:lona"],
      ["extra:control"],
      ["ruta:ensamble"],
    ]);
  });

  it("agrega un nodo nuevo al mismo momento productivo", () => {
    expect(
      insertarNodoProductivo(
        [["componente:bastidor"], ["ruta:ensamble"]],
        "componente:lona",
        { tipo: "PARALELO", columna: 0 },
      ),
    ).toEqual([["componente:bastidor", "componente:lona"], ["ruta:ensamble"]]);
  });
});
