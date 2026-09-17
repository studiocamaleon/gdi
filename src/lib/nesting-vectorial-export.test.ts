import { describe, expect, it } from "vitest";

import type { NestingViewerInput } from "@/lib/productos-servicios-api";
import {
  crearDxfDePlaca,
  crearSvgDePlaca,
  obtenerFuenteVectorial,
} from "@/lib/nesting-vectorial-export";

describe("exportación de nesting vectorial", () => {
  it("recupera solamente una fuente persistida válida", () => {
    expect(
      obtenerFuenteVectorial({
        disenoVectorialFuente: {
          schemaVersion: 1,
          nombreArchivo: "logo.svg",
          svg: "<svg />",
          anchoFinalMm: 1000,
        },
      })?.nombreArchivo,
    ).toBe("logo.svg");
    expect(
      obtenerFuenteVectorial({ disenoVectorialFuente: { svg: "x" } }),
    ).toBeNull();
  });

  it("recupera fuentes v2 sin perder compatibilidad con la exportación", () => {
    expect(
      obtenerFuenteVectorial({
        disenoVectorialFuente: {
          schemaVersion: 2,
          nombreArchivo: "logo-multicapa.svg",
          svg: "<svg />",
          anchoFinalMm: 1000,
        },
      })?.nombreArchivo,
    ).toBe("logo-multicapa.svg");
  });

  it("exporta sólo los contornos de la placa elegida", () => {
    const result = {
      algorithm: "irregular-2d-bottom-left-v1",
      cantidadCalculada: 2,
      unidad: "pliegos",
      aprovechamientoPct: 10,
      substrates: [
        { kind: "sheet", count: 1, widthMm: 1200, heightMm: 600 },
        { kind: "sheet", count: 1, widthMm: 1200, heightMm: 600 },
      ],
      piezasAcomodadas: 2,
      placements: [
        {
          pieceId: "P-01",
          substrateIndex: 0,
          xMm: 50,
          yMm: 50,
          widthMm: 100,
          heightMm: 100,
          rotated: false,
          meta: {
            contornos: [
              {
                puntos: [
                  { x: 50, y: 50 },
                  { x: 150, y: 50 },
                  { x: 50, y: 150 },
                ],
              },
            ],
            cortesInternos: [
              {
                puntos: [
                  { x: 75, y: 75 },
                  { x: 100, y: 75 },
                  { x: 75, y: 100 },
                ],
              },
            ],
          },
        },
        {
          pieceId: "P-02",
          substrateIndex: 1,
          xMm: 50,
          yMm: 50,
          widthMm: 80,
          heightMm: 80,
          rotated: false,
          meta: {
            contornos: [
              {
                puntos: [
                  { x: 50, y: 50 },
                  { x: 130, y: 50 },
                  { x: 50, y: 130 },
                ],
              },
            ],
          },
        },
      ],
    } satisfies NestingViewerInput;

    const svg = crearSvgDePlaca(result, 0);
    expect(svg).toContain('width="1200mm"');
    expect(svg).toContain('id="P-01-1-1"');
    expect(svg).toContain('id="P-01-1-2"');
    expect(svg).not.toContain("P-02");

    const dxf = crearDxfDePlaca(result, 0);
    expect(dxf).toContain("$INSUNITS\n70\n4");
    expect(dxf.match(/LWPOLYLINE/g)).toHaveLength(2);
    expect(dxf).toContain("8\nCORTE");
  });

  it("reemplaza los dos bordes origen por una única línea compartida", () => {
    const puntosA = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ];
    const puntosB = [
      { x: 101, y: 0 },
      { x: 201, y: 0 },
      { x: 201, y: 50 },
      { x: 101, y: 50 },
    ];
    const result = {
      algorithm: "irregular-2d-bottom-left-v1",
      cantidadCalculada: 1,
      unidad: "pliegos",
      aprovechamientoPct: 50,
      substrates: [
        { kind: "sheet", count: 1, widthMm: 300, heightMm: 100 },
      ],
      piezasAcomodadas: 2,
      placements: [
        {
          pieceId: "rectangulo",
          substrateIndex: 0,
          xMm: 0,
          yMm: 0,
          widthMm: 100,
          heightMm: 50,
          rotated: false,
          meta: { copiaIndex: 0, contornos: [{ puntos: puntosA }] },
        },
        {
          pieceId: "rectangulo",
          substrateIndex: 0,
          xMm: 101,
          yMm: 0,
          widthMm: 100,
          heightMm: 50,
          rotated: false,
          meta: { copiaIndex: 1, contornos: [{ puntos: puntosB }] },
        },
      ],
      commonLine: {
        habilitado: true,
        aplicado: true,
        anchoCorteMm: 1,
        longitudMinimaMm: 20,
        toleranciaMm: 0.1,
        longitudCompartidaMm: 50,
        ahorroRecorridoMm: 50,
        tramos: [
          {
            id: "common-line-1",
            placa: 0,
            inicio: { x: 100.5, y: 0 },
            fin: { x: 100.5, y: 50 },
            longitudMm: 50,
            segmentosOrigen: [
              { piezaId: "rectangulo", copia: 0, indiceSegmento: 1 },
              { piezaId: "rectangulo", copia: 1, indiceSegmento: 3 },
            ],
          },
        ],
      },
    } satisfies NestingViewerInput;

    const svg = crearSvgDePlaca(result, 0);
    expect(svg).toContain('data-common-line="true"');
    expect(svg.match(/<path /g)).toHaveLength(7);

    const dxf = crearDxfDePlaca(result, 0);
    expect(dxf.match(/\nLINE\n/g)).toHaveLength(7);
    expect(dxf).toContain("8\nCOMMON_LINE");
  });
});

it("exporta hendidos y cortes internos abiertos en capas distintas, sin sumar un regreso", () => {
  const result = { algorithm: "irregular-2d-bottom-left-v1", cantidadCalculada: 1, unidad: "pliegos", aprovechamientoPct: 20, piezasAcomodadas: 1,
    substrates: [{ kind: "sheet", count: 1, widthMm: 300, heightMm: 200 }],
    placements: [{ pieceId: "pieza", substrateIndex: 0, xMm: 0,yMm: 0,widthMm: 100,heightMm: 100,rotated: false,
      meta: { contornos: [{ puntos: [{x: 0,y: 0},{x: 100,y: 0},{x: 100,y: 100},{x: 0,y: 100}] }], operaciones: [
        { entidadId:"h1", tipo:"HENDIDO", capa:"HENDIDO", cerrada:false, puntos:[{x:10,y:10},{x:10,y:90}] },
        { entidadId:"c1", tipo:"CORTE_INTERIOR", capa:"CORTE_3", cerrada:false, puntos:[{x:20,y:20},{x:60,y:20}] },
      ] } }],
  } satisfies NestingViewerInput;
  const svg = crearSvgDePlaca(result,0);
  expect(svg).toContain('data-operacion="HENDIDO"');
  expect(svg).toContain('d="M10,10 L10,90"');
  expect(svg).toContain('data-operacion="CORTE_INTERIOR"');
  const dxf = crearDxfDePlaca(result,0);
  expect(dxf.match(/\nLINE\n/g)).toHaveLength(2);
  expect(dxf).toContain('8\nHENDIDO');
  expect(dxf).toContain('8\nCORTE_3');
});

it("genera la estructura CAD completa con capas, handles y propietario de cada entidad", () => {
  const result: NestingViewerInput = {
    algorithm: "irregular-2d-bottom-left-v1", cantidadCalculada: 1, unidad: "pliegos", aprovechamientoPct: 10, piezasAcomodadas: 1,
    substrates: [{ kind: "sheet", count: 1, widthMm: 300, heightMm: 200 }],
    placements: [{ pieceId: "p", xMm: 0, yMm: 0, widthMm: 10, heightMm: 10, rotated: false, meta: {
      contornos: [{ puntos: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }] }],
      operaciones: [{ tipo: "HENDIDO", puntos: [{ x: 1, y: 1 }, { x: 2, y: 2 }], cerrada: false }],
    } }],
  };
  const dxf = crearDxfDePlaca(result, 0);
  expect(dxf.startsWith("0\nSECTION\n2\nHEADER\n")).toBe(true);
  for (const section of ["TABLES", "BLOCKS", "ENTITIES", "OBJECTS"])
    expect(dxf).toContain(`0\nSECTION\n2\n${section}\n`);
  const tables = dxf.split("2\nTABLES\n")[1].split("0\nENDSEC")[0];
  expect(tables).toContain("2\nCORTE\n");
  expect(tables).toContain("2\nHENDIDO\n");
  expect(tables).toContain("2\n*Model_Space\n");
  const entities = dxf.split("2\nENTITIES\n")[1].split("0\nENDSEC")[0];
  expect(entities.match(/\n5\n[0-9A-F]+\n/g)).toHaveLength(2);
  expect(entities.match(/\n330\n[0-9A-F]+\n/g)).toHaveLength(2);
  const owners = [...entities.matchAll(/\n330\n([0-9A-F]+)\n/g)].map((m) => m[1]);
  for (const owner of owners) expect(dxf).toContain(`\n5\n${owner}\n`);
  expect(entities).not.toMatch(/\n(?:TEXT|MTEXT)\n/);
  expect(dxf).toContain("$INSUNITS\n70\n4\n");
});

it("rechaza coordenadas no finitas antes de producir un DXF dañado", () => {
  const result = { substrates: [{ kind: "sheet", count: 1, widthMm: 100, heightMm: 100 }], placements: [{ meta: { contornos: [{ puntos: [{ x: 0, y: 0 }, { x: Infinity, y: 0 }, { x: 1, y: 1 }] }] } }] } as unknown as NestingViewerInput;
  expect(() => crearDxfDePlaca(result, 0)).toThrow("coordenada inválida");
});
