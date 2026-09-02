import { describe, expect, it } from "vitest";

import {
  construirColumnasProductivas,
  insertarNodoProductivo,
  moverNodoProductivo,
  reducirAristasProductivas,
  reemplazarNodoProductivo,
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

  it("reemplaza un nodo conservando su momento y su rama", () => {
    expect(
      reemplazarNodoProductivo(
        [["componente:bastidor", "componente:lona"], ["ruta:ensamble"]],
        "componente:lona",
        "extra:impresion",
      ),
    ).toEqual([["componente:bastidor", "extra:impresion"], ["ruta:ensamble"]]);
  });

  it("evita duplicar un nodo que ya existía al reemplazar", () => {
    expect(
      reemplazarNodoProductivo(
        [["extra:impresion"], ["ruta:control"]],
        "ruta:control",
        "extra:impresion",
      ),
    ).toEqual([["extra:impresion"]]);
  });

  it("reconecta el flujo cuando un paso intermedio está omitido", () => {
    const aristas = reducirAristasProductivas(
      [
        { desdeClave: "diseno", haciaClave: "preprensa" },
        { desdeClave: "preprensa", haciaClave: "impresion" },
        { desdeClave: "impresion", haciaClave: "laminado" },
        { desdeClave: "laminado", haciaClave: "guillotina" },
        { desdeClave: "guillotina", haciaClave: "plotter" },
      ],
      new Set(["diseno", "preprensa", "impresion", "laminado", "plotter"]),
    );

    expect(aristas).toEqual([
      { desdeClave: "diseno", haciaClave: "preprensa" },
      { desdeClave: "preprensa", haciaClave: "impresion" },
      { desdeClave: "impresion", haciaClave: "laminado" },
      { desdeClave: "laminado", haciaClave: "plotter" },
    ]);
    expect(
      construirColumnasProductivas(
        ["diseno", "preprensa", "impresion", "laminado", "plotter"].map(
          (clave, orden) => ({
            clave,
            orden,
            tipo: "PASO" as const,
          }),
        ),
        aristas,
      ).map((columna) => columna.map((nodo) => nodo.clave)),
    ).toEqual([
      ["diseno"],
      ["preprensa"],
      ["impresion"],
      ["laminado"],
      ["plotter"],
    ]);
  });
});
