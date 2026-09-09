import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { agruparPatronesNesting } from "./nesting-patrones";
import {
  crearDxfDePatron,
  crearSvgDePatron,
  nombreArchivoPatron,
} from "./nesting-patrones-export";
import { crearDxfDePlaca, crearSvgDePlaca } from "./nesting-vectorial-export";
import { NestingPatronesDescargas } from "@/components/nesting/nesting-patrones-descargas";
import type { NestingViewerInput } from "./productos-servicios-api";

function exhibidor(): NestingViewerInput {
  const r: NestingViewerInput = {
    algorithm: "irregular-2d-bottom-left-v1",
    unidad: "pliegos",
    cantidadCalculada: 34,
    piezasAcomodadas: 450,
    aprovechamientoPct: 79.69,
    substrates: [],
    placements: [],
  };
  for (const [repeticiones, piezas] of [
    [25, { Cuerpo: 2, Header: 2, Faldon: 2, Costilla: 1, Soporte: 2 }],
    [5, { Estante: 20, Costilla: 5 }],
    [4, { Estante: 25 }],
  ] as Array<[number, Record<string, number>]>) {
    for (let copia = 0; copia < repeticiones; copia++) {
      const substrateIndex = r.substrates.length;
      r.substrates.push({
        kind: "sheet",
        count: 1,
        widthMm: 860,
        heightMm: 564,
      });
      let x = 5;
      for (const [pieceId, n] of Object.entries(piezas))
        for (let i = 0; i < n; i++) {
          r.placements.push({
            pieceId,
            substrateIndex,
            xMm: x,
            yMm: 5,
            widthMm: 10,
            heightMm: 10,
            rotated: false,
            meta: {
              copyIndex: copia * n + i,
              label: pieceId,
              contornos: [
                {
                  esHueco: false,
                  puntos: [
                    { x, y: 5 },
                    { x: x + 10, y: 5 },
                    { x, y: 15 },
                  ],
                },
              ],
            },
          });
          x += 12;
        }
    }
  }
  return r;
}

describe("entrega de archivos por layout", () => {
  it("reduce 34 placas a 3 archivos por formato con copias 25/5/4 y 450 piezas", () => {
    const r = exhibidor();
    const antes = JSON.stringify(r);
    const patrones = agruparPatronesNesting(r);
    expect(patrones.map((p) => p.repeticiones)).toEqual([25, 5, 4]);
    for (const p of patrones) {
      expect(nombreArchivoPatron("exhibidor", p)).toBe(
        `exhibidor-layout-${p.id}-x${p.repeticiones}`,
      );
      const svg = crearSvgDePatron(r, p.id);
      expect(svg).toContain(
        `<title>Layout ${p.id} · ${p.repeticiones} copias</title>`,
      );
      expect(svg).not.toContain("<text");
      expect(svg.replace(/<title>[^<]*<\/title>/, "")).toEqual(
        crearSvgDePlaca(r, p.indices[0]).replace(/<title>[^<]*<\/title>/, ""),
      );
      const dxf = crearDxfDePatron(r, p.id);
      expect(dxf.startsWith("0\nSECTION\n2\nHEADER\n")).toBe(true);
      expect(dxf).toContain(`999\nLayout ${p.id} - ${p.repeticiones} copias\n`);
      // Los handles del documento cambian entre descargas. La geometría no.
      const entidades = (texto: string) => texto.split("2\nENTITIES\n")[1].split("0\nENDSEC")[0].replace(/(?:^|\n)(5|330)\n[^\n]+/g, "");
      expect(entidades(dxf)).toBe(entidades(crearDxfDePlaca(r, p.indices[0])));
    }
    expect(JSON.stringify(r)).toBe(antes);
  });
  it("presenta sólo tres descargas SVG y tres DXF", () => {
    const markup = renderToStaticMarkup(
      <NestingPatronesDescargas
        result={exhibidor()}
        nombreBase="exhibidor"
        permitirDxf
      />,
    );
    expect(
      markup.match(/aria-label="Descargar layout [ABC] SVG/g) ?? [],
    ).toHaveLength(3);
    expect(
      markup.match(/aria-label="Descargar layout [ABC] DXF/g) ?? [],
    ).toHaveLength(3);
    expect(markup).not.toContain("Resumen del plan");
    expect(markup).not.toContain("Placa 34");
  });
  it("rechaza un layout inexistente sin exportar otra placa", () => {
    expect(() => crearDxfDePatron(exhibidor(), "Z")).toThrow(
      "El layout seleccionado no existe",
    );
  });
});
