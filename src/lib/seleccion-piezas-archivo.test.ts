import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  incorporarPiezasArchivo,
  piezasDeCapa,
  seleccionInicialArchivo,
} from "./seleccion-piezas-archivo";
import type {
  FuenteGuardada,
  InspeccionVector,
} from "./geometrias-producto-api";
import { PiezaInterpretacionPreview } from "@/components/productos-servicios/pieza-interpretacion-preview";

const inspeccion: InspeccionVector = {
  formato: "DXF",
  unidadDeclarada: "mm",
  sugeridaId: "M",
  avisos: [],
  entidades: ["P", "huecoP", "M", "gato"].map((id, i) => ({
    id,
    capa: id === "gato" ? "SIMBOLO" : "CORTE",
    puntos: [
      { x: i * 100, y: 0 },
      { x: i * 100 + 80, y: 0 },
      { x: i * 100 + 80, y: 100 },
    ],
    cerrada: true,
    apertura: 0,
    ancho: 80,
    alto: 100,
    area: 4000,
  })),
  piezas: [
    { exteriorId: "P", interioresIds: ["huecoP"] },
    { exteriorId: "M", interioresIds: [] },
    { exteriorId: "gato", interioresIds: [] },
  ],
  piezasSugeridas: ["P", "M", "gato"],
};
const fuente = (exteriorId: string) =>
  ({
    schemaVersion: 2,
    procedencia: { exteriorId, geometriaId: exteriorId },
  }) as FuenteGuardada;

describe("selección de todas las piezas del DXF", () => {
  it("selecciona las piezas de distintas capas y trata el hueco como corte interno", () => {
    const seleccion = seleccionInicialArchivo(inspeccion);
    expect(seleccion.exteriorIds).toEqual(["P", "M", "gato"]);
    expect(seleccion.operaciones).toEqual([
      { entidadId: "huecoP", tipo: "CORTE_INTERIOR" },
    ]);
    expect(piezasDeCapa(inspeccion, "CORTE").map((p) => p.exteriorId)).toEqual([
      "P",
      "M",
    ]);
    const markup = renderToStaticMarkup(
      createElement(PiezaInterpretacionPreview, {
        entidades: inspeccion.entidades,
        seleccion,
      }),
    );
    expect(markup.match(/stroke="var\(--signal\)"/g)).toHaveLength(3);
  });

  it("incorpora todas las interpretaciones con identidades distintas y preserva la fuente heredada requerida", () => {
    const iniciales = [
      { id: "principal", nombre: "Diseño principal", requerida: true },
    ];
    const resultado = incorporarPiezasArchivo(
      iniciales,
      [fuente("P"), fuente("M"), fuente("gato")],
      "logo.dxf",
      undefined,
      ["diseno_3"],
    );
    expect(resultado).toHaveLength(3);
    expect(new Set(resultado.map((f) => f.id)).size).toBe(3);
    expect(resultado[0].id).toBe("principal");
    expect(resultado.some((f) => f.id === "diseno_3")).toBe(false);
    expect(resultado.map((f) => f.nombre)).toEqual([
      "logo · Pieza 1",
      "logo · Pieza 2",
      "logo · Pieza 3",
    ]);
    expect(
      resultado.map((f) => f.predeterminada?.procedencia.exteriorId),
    ).toEqual(["P", "M", "gato"]);
    expect(iniciales).toEqual([
      { id: "principal", nombre: "Diseño principal", requerida: true },
    ]);
  });

  it("reemplaza la pieza elegida sin eliminar las otras y agrega las restantes del archivo", () => {
    const vieja = {
      id: "principal",
      nombre: "Frente",
      requerida: true,
      predeterminada: fuente("vieja"),
    };
    const otra = {
      id: "otra",
      nombre: "Dorso",
      requerida: true,
      predeterminada: fuente("dorso"),
    };
    const resultado = incorporarPiezasArchivo(
      [vieja, otra],
      [fuente("P"), fuente("M")],
      "nuevo.svg",
      vieja.id,
    );
    expect(resultado).toHaveLength(3);
    expect(resultado[0]).toMatchObject({
      id: "principal",
      nombre: "Frente",
      predeterminada: fuente("P"),
    });
    expect(resultado[1]).toBe(otra);
    expect(resultado[2].predeterminada).toEqual(fuente("M"));
  });
});
