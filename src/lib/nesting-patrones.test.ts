import { describe, expect, it } from "vitest";
import { agruparPatronesNesting } from "./nesting-patrones";
import type { NestingViewerInput } from "./productos-servicios-api";

const pieza = {
  pieceId: "estante",
  xMm: 5,
  yMm: 5,
  widthMm: 100,
  heightMm: 170,
  rotated: false,
};
function resultado(): NestingViewerInput {
  return {
    algorithm: "grid-2d-multi",
    cantidadCalculada: 3,
    unidad: "pliegos",
    aprovechamientoPct: 50,
    piezasAcomodadas: 3,
    substrates: Array.from({ length: 3 }, () => ({
      kind: "sheet",
      count: 1,
      widthMm: 564,
      heightMm: 860,
    })),
    placements: [
      { ...pieza, substrateIndex: 0, meta: { copiaIndex: 0, arteHash: "v1" } },
      { ...pieza, substrateIndex: 1, meta: { copiaIndex: 1, arteHash: "v1" } },
      { ...pieza, substrateIndex: 2, meta: { copiaIndex: 2, arteHash: "v2" } },
    ],
  };
}
describe("patrones visibles", () => {
  it("no agrupa cortes comunes diferentes aunque las poses sean iguales", () => {
    const r = resultado();
    r.placements[2].meta = { arteHash: 'v1' };
    r.commonLine = {habilitado:true,aplicado:true,anchoCorteMm:0,longitudMinimaMm:1,toleranciaMm:0.1,longitudCompartidaMm:10,ahorroRecorridoMm:10,tramos:[{id:'t-0',placa:0,inicio:{x:5,y:5},fin:{x:15,y:5},longitudMm:10,segmentosOrigen:[{piezaId:'estante',copia:0,indiceSegmento:0},{piezaId:'otra',copia:0,indiceSegmento:0}]}]};
    expect(agruparPatronesNesting(r).map(p=>p.repeticiones)).toEqual([2,1]);
    expect(agruparPatronesNesting(r).find(p=>p.indices.includes(0))?.indices).toEqual([0]);
    r.commonLine.tramos.push({...r.commonLine.tramos[0],id:'t-1',placa:1});
    expect(agruparPatronesNesting(r).map(p=>p.repeticiones)).toEqual([2,1]);
    expect(agruparPatronesNesting(r).find(p=>p.indices.includes(0))?.indices).toEqual([0,1]);
  });
  it("agrupa poses equivalentes y conserva separado un arte diferente", () => {
    const r = resultado(),
      antes = JSON.stringify(r);
    const p = agruparPatronesNesting(r);
    expect(p.map((x) => x.repeticiones)).toEqual([2, 1]);
    expect(p[0].indices).toEqual([0, 1]);
    expect(JSON.stringify(r)).toBe(antes);
  });
  it("la misma cantidad con otra posición o giro no constituye el mismo patrón", () => {
    const r = resultado();
    r.placements[1].xMm = 25;
    expect(agruparPatronesNesting(r)).toHaveLength(3);
    r.placements[1].xMm = 5;
    r.placements[1].meta = { arteHash: "v1", rotacionGrados: 180 };
    expect(agruparPatronesNesting(r)).toHaveLength(3);
  });
  it("respeta el multiplicador explícito de una placa y no duplica instancias", () => {
    const r = resultado();
    r.substrates = [{ kind: "sheet", count: 25, widthMm: 564, heightMm: 860 }];
    r.placements = [{ ...pieza, substrateIndex: 0 }];
    expect(agruparPatronesNesting(r)[0].repeticiones).toBe(25);
    expect(agruparPatronesNesting(r)[0].cantidades).toEqual({ estante: 1 });
  });
});
