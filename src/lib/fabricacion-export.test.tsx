import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { apiRequest } from "./api";
import {
  crearDxfFabricacionDePlaca,
  crearDxfDePlaca,
  crearSvgDePlaca,
} from "./nesting-vectorial-export";
import { agruparPatronesNesting } from "./nesting-patrones";
import { CapasFabricacionSelector } from "@/components/productos-servicios/capas-fabricacion-selector";
import type { FabricacionVectorial } from "./fabricacion-vectorial";
import type { NestingViewerInput } from "./productos-servicios-api";
import { completarFabricacionNesting, fabricacionDePlacement, vincularFuentesFabricacion } from "./fabricacion-export";
import { NestingPatronesView } from "@/components/nesting/nesting-patrones-view";
import { CapasFabricacionPlacement } from "@/components/nesting/capas-fabricacion-nesting";
import { obtenerPlanesFabricacion, type CotizacionFabricacion } from "./plan-fabricacion-cotizacion";

vi.mock("./api", () => ({ apiRequest: vi.fn() }));
const documento: FabricacionVectorial = {
  version: 1,
  geometriaId: "id",
  archivoHash: "hash",
  formato: "DXF",
  dxfNativo: true,
  origen: { minX: 10, minY: -80, factorMm: 1 },
  transformacion: [0, 1, -1, 0, 150, 5],
  entidades: [
    {
      entidadId: "e",
      capa: "EXTERIOR",
      tipoEntidad: "LWPOLYLINE",
      rol: "CORTE_EXTERIOR",
      conservar: true,
      puntos: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 60 },
        { x: 0, y: 60 },
      ],
      cerrada: true,
      longitudMm: 320,
      precisionLongitud: "EXACTA",
    },
    {
      entidadId: "h",
      capa: "DOBLEZ ORIGINAL",
      tipoEntidad: "LINE",
      rol: "HENDIDO",
      conservar: true,
      puntos: [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
      ],
      cerrada: false,
      longitudMm: 80,
      precisionLongitud: "EXACTA",
    },
    {
      entidadId: "r",
      capa: "GUIAS",
      tipoEntidad: "LINE",
      rol: null,
      conservar: true,
      puntos: [
        { x: 5, y: 20 },
        { x: 10, y: 20 },
      ],
      cerrada: false,
      longitudMm: 5,
      precisionLongitud: "EXACTA",
    },
    {
      entidadId: "x",
      capa: "EXCLUIDA",
      tipoEntidad: "LINE",
      rol: null,
      conservar: false,
      puntos: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      cerrada: false,
      longitudMm: 1.414,
      precisionLongitud: "EXACTA",
    },
  ],
};
function resultado(): NestingViewerInput {
  return {
    algorithm: "irregular-2d-bottom-left-v1",
    unidad: "pliegos",
    cantidadCalculada: 1,
    piezasAcomodadas: 1,
    aprovechamientoPct: 20,
    substrates: [{ kind: "sheet", count: 1, widthMm: 300, heightMm: 300 }],
    placements: [
      {
        pieceId: "pieza",
        substrateIndex: 0,
        xMm: 90,
        yMm: 5,
        widthMm: 60,
        heightMm: 100,
        rotated: true,
        meta: {
          fabricacion: documento,
          contornos: [
            {
              puntos: [
                { x: 90, y: 5 },
                { x: 150, y: 5 },
                { x: 150, y: 105 },
                { x: 90, y: 105 },
              ],
            },
          ],
        },
      },
    ],
  };
}
describe("entrega de las capas conservadas", () => {
  it("mantiene nombre, geometría y operación de una capa de corte parcial al exportar", () => {
    const r = resultado();
    const documentoParcial = structuredClone(documento);
    documentoParcial.entidades[1] = {
      ...documentoParcial.entidades[1],
      capa: "CORTE_PARCIAL original",
      rol: "CORTE_PARCIAL",
      operacion: "CORTE_PARCIAL",
      funcionGeometrica: "TRAZO",
    };
    r.placements[0].meta = {
      ...(r.placements[0].meta as object),
      fabricacion: documentoParcial,
    };
    expect(crearSvgDePlaca(r, 0)).toContain(
      'data-capa="CORTE_PARCIAL original"',
    );
    documentoParcial.dxfNativo = false; // fuente vectorial normalizada: exportador local
    const dxf = crearDxfDePlaca(r, 0);
    expect(dxf).toContain("CORTE_PARCIAL original");
    expect(documentoParcial.entidades[1].operacion).toBe("CORTE_PARCIAL");
  });
  it("exporta la fuente y las capas propias de cada componente de segundo nivel con códigos repetidos", async () => {
    const cotizacion = {
      componentesFabricados: ["izquierda", "derecha"].map((codigo) => {
        const nesting = resultado();
        const fuente = structuredClone(documento);
        fuente.geometriaId = codigo;
        fuente.archivoHash = `hash-${codigo}`;
        fuente.entidades[1].capa = `HENDIDO ${codigo}`;
        nesting.placements[0].meta = {
          ...(nesting.placements[0].meta as object),
          fabricacion: fuente,
        };
        return {
          codigo,
          productoId: "kit",
          nombre: codigo,
          componentes: [{
            codigo: "frente",
            productoId: "misma-pieza",
            nombre: "Frente",
            jobContext: { disenosVectoriales: [{ id: "pieza" }] },
            pasos: [{
              activado: true,
              rutaPasoId: "corte",
              familiaCodigo: "corte_laser",
              nestingResult: nesting,
            }],
          }],
        };
      }),
    } as unknown as CotizacionFabricacion;
    const antes = JSON.stringify(cotizacion);
    const planes = obtenerPlanesFabricacion(cotizacion);
    expect(planes).toHaveLength(2);
    expect(planes[0].id).not.toBe(planes[1].id);
    for (const [i, codigo] of ["izquierda", "derecha"].entries()) {
      const plan = planes[i];
      expect(crearSvgDePlaca(plan.result, 0)).toContain(`data-capa="HENDIDO ${codigo}"`);
      vi.mocked(apiRequest).mockResolvedValueOnce({ dxf: `CAD ${codigo}` });
      expect(await crearDxfFabricacionDePlaca(plan.result, 0)).toBe(`CAD ${codigo}`);
      const req = JSON.parse(String(vi.mocked(apiRequest).mock.calls.at(-1)![1]?.body));
      expect(req.instancias).toHaveLength(1);
      expect(req.instancias[0]).toMatchObject({
        geometriaId: codigo,
        archivoHash: `hash-${codigo}`,
        transformacion: documento.transformacion,
      });
    }
    expect(JSON.stringify(cotizacion)).toBe(antes);
  });
  function historico() {
    const r = resultado();
    const p = r.placements[0];
    p.meta = { ...(p.meta as object), fabricacion: undefined, propietario: {
      interpretacion: { geometriaId: documento.geometriaId, hash: documento.archivoHash },
    } };
    return r;
  }
  it("dibuja las capas sin operación en los patrones y en el componente del visor detallado", () => {
    const r = resultado();
    for (const html of [
      renderToStaticMarkup(<NestingPatronesView result={r} />),
      renderToStaticMarkup(<svg><CapasFabricacionPlacement placement={r.placements[0]} transform="matrix(2 0 0 2 10 10)" /></svg>),
    ]) {
      expect(html).toContain('data-capa="GUIAS"');
      expect(html).toContain('data-capa="DOBLEZ ORIGINAL"');
      expect(html).toContain("M140,15 L140,95");
      expect(html).not.toContain('data-capa="EXCLUIDA"');
    }
  });
  it("recupera una interpretación histórica una sola vez y registra las capas en cada copia girada", async () => {
    const r = historico(), antes = structuredClone(r);
    const copia = structuredClone(r.placements[0]);
    copia.xMm += 20;
    const contornos = (copia.meta as { contornos: { puntos: { x: number; y: number }[] }[] }).contornos;
    contornos[0].puntos.forEach(p => p.x += 20);
    r.placements.push(copia);
    vi.mocked(apiRequest).mockResolvedValueOnce({ documentos: [{ ...documento, transformacion: [1, 0, 0, 1, 0, 0] }] });
    const [completo, repetido] = await Promise.all([completarFabricacionNesting(r), completarFabricacionNesting(r)]);
    expect(completo).toBe(repetido);
    expect(r.placements[0]).toEqual(antes.placements[0]);
    expect(fabricacionDePlacement(completo.placements[0])!.transformacion[4]).toBeCloseTo(150);
    expect(fabricacionDePlacement(completo.placements[1])!.transformacion[4]).toBeCloseTo(170);
    expect(crearSvgDePlaca(completo, 0)).toContain('data-capa="GUIAS"');
  });
  it("rechaza capas de otro archivo o de una silueta que cambió, sin entregar el exterior solo", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ documentos: [{ ...documento, archivoHash: "otro" }] });
    await expect(crearDxfFabricacionDePlaca(historico(), 0)).rejects.toThrow(/no coinciden/);
    const r = historico();
    const meta = r.placements[0].meta as { contornos: { puntos: { x: number; y: number }[] }[] };
    meta.contornos[0].puntos[0].x += 3;
    vi.mocked(apiRequest).mockResolvedValueOnce({ documentos: [documento] });
    await expect(completarFabricacionNesting(r)).rejects.toThrow(/contorno colocado/);
  });
  it("vincula el corte histórico a la fuente de su componente antes de exportar el CAD", async () => {
    const r = resultado();
    r.placements[0].pieceId = "diseno__exterior";
    r.placements[0].meta = { ...(r.placements[0].meta as object), fabricacion: undefined, layoutHeredadoDe: "impresion" };
    const contexto = { disenosVectoriales: [{ id: "diseno", fuente: { procedencia: { geometriaId: "id", hash: "hash" } } }] };
    const vinculado = vincularFuentesFabricacion(r, contexto);
    expect(vinculado).not.toBe(r);
    expect(vincularFuentesFabricacion(r, { disenosVectoriales: [{ ...contexto.disenosVectoriales[0], id: "otra" }] })).toBe(r);
    vi.mocked(apiRequest).mockResolvedValueOnce({ documentos: [documento] }).mockResolvedValueOnce({ dxf: "CAD con capas" });
    expect(await crearDxfFabricacionDePlaca(vinculado, 0)).toBe("CAD con capas");
    const req = JSON.parse(String(vi.mocked(apiRequest).mock.calls.at(-1)![1]?.body));
    expect(req.instancias).toHaveLength(1);
    expect(req.baseDxf).not.toContain("\nLWPOLYLINE\n");
  });
  it("conserva nombres y referencias abiertas en SVG y aplica la matriz de la copia", () => {
    const svg = crearSvgDePlaca(resultado(), 0);
    expect(svg).toContain('data-capa="DOBLEZ ORIGINAL"');
    expect(svg).toContain('data-capa="GUIAS"');
    expect(svg).toContain('data-operacion="SIN_OPERACION"');
    expect(svg).toContain("M140,15 L140,95");
    expect(svg).not.toContain("EXCLUIDA");
    expect(svg).toContain('data-capa="EXTERIOR"');
  });
  it("envía sólo las referencias y transformaciones al exportador CAD, sin duplicar polígonos", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ dxf: "DXF nativo" });
    const r = resultado();
    r.placements[0].meta = { ...(r.placements[0].meta as object), label: "Componente consolidado", propietario: { piezaNombre: "Faldón" } };
    expect(await crearDxfFabricacionDePlaca(r, 0)).toBe("DXF nativo");
    const [url, opciones] = vi.mocked(apiRequest).mock.calls.at(-1)!;
    expect(url).toBe("/productos-servicios/geometrias/exportar-dxf");
    const req = JSON.parse(String(opciones?.body));
    expect(req.instancias).toEqual([
      {
        geometriaId: "id",
        archivoHash: "hash",
        nombrePieza: "Faldón",
        transformacion: [0, 1, -1, 0, 150, 5],
        soloComplementos: false,
      },
    ]);
    expect(req.baseDxf).not.toContain("\nLWPOLYLINE\n");
    expect(req.baseDxf).not.toContain("\nLINE\n");
    expect(req.baseDxf).toContain("SECTION");
    expect(() => crearDxfDePlaca(resultado(), 0)).toThrow(/capas originales/);
  });
  it("no entrega una versión simplificada si falla la lectura del original", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(
      new Error("Original no disponible"),
    );
    await expect(crearDxfFabricacionDePlaca(resultado(), 0)).rejects.toThrow(
      "Original no disponible",
    );
  });
  it("separa patrones con la misma silueta y distintos recorridos", () => {
    const r = resultado();
    r.substrates.push({ ...r.substrates[0] });
    const copia = structuredClone(r.placements[0]);
    copia.substrateIndex = 1;
    const meta = copia.meta as { fabricacion: FabricacionVectorial };
    meta.fabricacion.entidades[2].conservar = false;
    r.placements.push(copia);
    expect(agruparPatronesNesting(r)).toHaveLength(2);
  });
  it("muestra conservación y operación como controles distintos, con exterior protegido", () => {
    const html = renderToStaticMarkup(
      <CapasFabricacionSelector
        inspeccion={{
          formato: "DXF",
          unidadDeclarada: "mm",
          sugeridaId: "e",
          avisos: [],
          entidades: documento.entidades.map((e) => ({
            id: e.entidadId,
            capa: e.capa,
            puntos: e.puntos,
            cerrada: e.cerrada,
            area: e.rol === "CORTE_EXTERIOR" ? 6000 : 0,
            apertura: 0,
            ancho: 100,
            alto: 60,
          })),
        }}
        seleccion={{
          exteriorId: "e",
          unidad: "mm",
          cerrarExterior: false,
          operaciones: [],
        }}
        onChange={() => {}}
      />,
    );
    expect(html).toContain("Conservar capa GUIAS");
    expect(html).toContain("Uso de GUIAS");
    expect(html).toContain("Sin operación");
    expect(html).toContain("Corte exterior");
    expect(html).not.toContain("Ignorar");
  });
});
