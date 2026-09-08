import { describe, expect, it } from "vitest";

import {
  construirColumnasProductivas,
  insertarNodoProductivo,
  moverNodoProductivo,
  reducirAristasProductivas,
  reemplazarNodoProductivo,
  separarPasosOmitidos,
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

  it("mantiene el destino al mover una columna completa hacia la derecha", () => {
    const columnas = [["diseno"], ["omitido"], ["impresion"], ["ensamble"]];
    expect(
      moverNodoProductivo(columnas, "diseno", { tipo: "PARALELO", columna: 2 }),
    ).toEqual([["omitido"], ["impresion", "diseno"], ["ensamble"]]);
    expect(
      moverNodoProductivo(columnas, "diseno", {
        tipo: "SECUENCIAL",
        posicion: 2,
      }),
    ).toEqual([["omitido"], ["diseno"], ["impresion"], ["ensamble"]]);
  });

  it("permite avanzar una columna entera o separar un nodo paralelo", () => {
    expect(
      moverNodoProductivo([["a"], ["b"], ["c"]], "a", {
        tipo: "SECUENCIAL",
        posicion: 2,
      }),
    ).toEqual([["b"], ["a"], ["c"]]);
    expect(
      moverNodoProductivo([["a", "b"], ["c"]], "a", {
        tipo: "SECUENCIAL",
        posicion: 1,
      }),
    ).toEqual([["b"], ["a"], ["c"]]);
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

describe("pasos omitidos fuera del lienzo", () => {
  const nodo = (clave: string, orden: number, omitido = false) => ({
    clave,
    orden,
    omitido,
    tipo: "PASO" as const,
  });
  const columnas = [
    [nodo("diseno", 0)],
    [nodo("corte", 1, true)],
    [nodo("pintura", 2, true)],
    [nodo("componente", 3)],
    [nodo("ensamble", 4)],
  ];

  it("quita los momentos vacíos y conserva los índices del modelo completo", () => {
    const vista = separarPasosOmitidos(columnas);
    expect(
      vista.columnasVisibles.map((columna) => columna.indiceOriginal),
    ).toEqual([0, 3, 4]);
    expect(
      vista.columnasVisibles.map((columna) =>
        columna.nodos.map((item) => item.clave),
      ),
    ).toEqual([["diseno"], ["componente"], ["ensamble"]]);
    expect(vista.omitidos.map((item) => item.clave)).toEqual([
      "corte",
      "pintura",
    ]);
    expect(
      columnas.map((columna) => columna.map((item) => item.clave)),
    ).toEqual([
      ["diseno"],
      ["corte"],
      ["pintura"],
      ["componente"],
      ["ensamble"],
    ]);
  });

  it("oculta un paso paralelo sin quitar a su compañero ni alterar la convergencia", () => {
    const modelo = [
      [nodo("diseno", 0)],
      [nodo("corte", 1, true), nodo("impresion", 2)],
      [nodo("ensamble", 3)],
    ];
    expect(
      separarPasosOmitidos(modelo).columnasVisibles.map((columna) =>
        columna.nodos.map((item) => item.clave),
      ),
    ).toEqual([["diseno"], ["impresion"], ["ensamble"]]);
  });

  it("no deja huecos al inicio o al final y admite una ruta completamente omitida", () => {
    const modelo = [
      [nodo("inicio", 0, true)],
      [nodo("activo", 1)],
      [nodo("fin", 2, true)],
    ];
    expect(
      separarPasosOmitidos(modelo).columnasVisibles.map(
        (columna) => columna.indiceOriginal,
      ),
    ).toEqual([1]);
    expect(
      separarPasosOmitidos(
        modelo.map((columna) =>
          columna.map((item) => ({ ...item, omitido: true })),
        ),
      ).columnasVisibles,
    ).toEqual([]);
    expect(separarPasosOmitidos([])).toEqual({
      columnasVisibles: [],
      omitidos: [],
    });
  });

  it("recupera la posición y configuración al volver a incluir un paso", () => {
    const pintura = { ...columnas[2][0], configuracion: { espesor: 2 } };
    const modelo = columnas.map((columna, index) =>
      index === 2 ? [pintura] : columna,
    );
    const reactivado = modelo.map((columna) =>
      columna.map((item) =>
        item.clave === "pintura" ? { ...item, omitido: false } : item,
      ),
    );
    const vista = separarPasosOmitidos(reactivado);
    expect(
      vista.columnasVisibles.map((columna) =>
        columna.nodos.map((item) => item.clave),
      ),
    ).toEqual([["diseno"], ["pintura"], ["componente"], ["ensamble"]]);
    expect(vista.columnasVisibles[1].nodos[0]).toMatchObject({
      configuracion: { espesor: 2 },
    });
    expect(vista.omitidos.map((item) => item.clave)).toEqual(["corte"]);
  });

  it("agrega junto al momento visible correcto sin eliminar los pasos ocultos", () => {
    const { indiceOriginal } =
      separarPasosOmitidos(columnas).columnasVisibles[1];
    const claves = columnas.map((columna) => columna.map((item) => item.clave));
    expect(
      insertarNodoProductivo(claves, "nuevo", {
        tipo: "PARALELO",
        columna: indiceOriginal,
      }),
    ).toEqual([
      ["diseno"],
      ["corte"],
      ["pintura"],
      ["componente", "nuevo"],
      ["ensamble"],
    ]);
    expect(
      insertarNodoProductivo(claves, "nuevo", {
        tipo: "SECUENCIAL",
        posicion: indiceOriginal,
      }),
    ).toEqual([
      ["diseno"],
      ["corte"],
      ["pintura"],
      ["nuevo"],
      ["componente"],
      ["ensamble"],
    ]);
  });
});
