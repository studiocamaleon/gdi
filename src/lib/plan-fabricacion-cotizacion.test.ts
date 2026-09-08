import { describe, expect, it } from "vitest";
import {
  obtenerPlanesFabricacion,
  type CotizacionFabricacion,
} from "./plan-fabricacion-cotizacion";
import type { NestingViewerInput } from "./productos-servicios-api";

const resultado = (
  origen?: string,
  material = "corrugado",
): NestingViewerInput => ({
  algorithm: "grid-2d-multi",
  cantidadCalculada: 1,
  unidad: "pliegos",
  aprovechamientoPct: 70,
  piezasAcomodadas: 3,
  sustrato: { materialVarianteId: material, nombre: material },
  substrates: [{ kind: "sheet", count: 3, widthMm: 860, heightMm: 564 }],
  placements: [
    {
      pieceId: "estante",
      xMm: 5,
      yMm: 5,
      widthMm: 100,
      heightMm: 170,
      rotated: false,
      meta: origen ? { layoutHeredadoDe: origen } : {},
    },
  ],
});
const componente = (codigo = "a", origen: string | undefined = "print") => ({
  codigo,
  productoId: codigo,
  nombre: codigo,
  jobContext: { disenosVectoriales: [{}] },
  pasos: [
    {
      activado: true,
      rutaPasoId: "cut",
      nombreVisible: "Corte láser",
      familiaCodigo: "corte_laser",
      nestingResult: resultado(origen),
    },
    {
      activado: true,
      rutaPasoId: "print",
      nombreVisible: "Impresión",
      familiaCodigo: "impresion_por_area",
      nestingResult: resultado(),
    },
    {
      activado: false,
      rutaPasoId: "omitted",
      familiaCodigo: "corte_laser",
      nestingResult: resultado(),
    },
  ],
});
const cotizacion = (componentes = [componente()]) =>
  ({ componentesFabricados: componentes }) as unknown as CotizacionFabricacion;

describe("plan de fabricación de la cotización", () => {
  it("incluye las colecciones rectangulares en los planes sin exigir un DXF", () => {
    const c = cotizacion();
    c.componentesFabricados![0].jobContext = {
      cantidad: 3,
      piezas: [
        {
          nombre: "Frente",
          cantidad: 6,
          cantidadPorUnidad: 2,
          anchoMm: 300,
          altoMm: 400,
        },
      ],
    };
    const planes = obtenerPlanesFabricacion(c);
    expect(planes).toHaveLength(1);
    expect(planes[0].operaciones).toHaveLength(2);
  });
  it("une el corte con su impresión aunque aparezca primero y omite pasos desactivados", () => {
    const c = cotizacion();
    const antes = JSON.stringify(c);
    const p = obtenerPlanesFabricacion(c);
    expect(p).toHaveLength(1);
    expect(p[0].operaciones).toHaveLength(2);
    expect(p[0].result).toBe(
      c.componentesFabricados![0].pasos![1].nestingResult,
    );
    expect(JSON.stringify(c)).toBe(antes);
  });
  it("mantiene separados los componentes y ocurrencias con los mismos IDs de pasos", () => {
    const p = obtenerPlanesFabricacion(
      cotizacion([componente(), componente()]),
    );
    expect(p).toHaveLength(2);
    expect(p.every((v) => v.operaciones.length === 2)).toBe(true);
  });
  it("no oculta un corte cuyo origen falta o usa otro material", () => {
    expect(
      obtenerPlanesFabricacion(cotizacion([componente("a", "desconocido")])),
    ).toHaveLength(2);
    const c = cotizacion();
    c.componentesFabricados![0].pasos![0].nestingResult = resultado(
      "print",
      "acrilico",
    );
    expect(obtenerPlanesFabricacion(c)).toHaveLength(2);
  });
  it("une lotes consolidados y evita volver a incluir los pasos participantes", () => {
    const c = cotizacion();
    c.analisisNestingCompuesto = {
      grupos: [
        {
          aplicacion: { aplicado: true },
          participantes: [
            {
              componenteCodigo: "a",
              productoId: "a",
              rutaPasoId: "print",
              pasoNombre: "Impresión",
            },
          ],
          lote: {
            id: "lote-print",
            materialNombre: "Corrugado",
            nestingResult: resultado(),
          },
        },
        {
          aplicacion: { aplicado: true },
          participantes: [
            {
              componenteCodigo: "a",
              productoId: "a",
              rutaPasoId: "cut",
              pasoNombre: "Corte",
            },
          ],
          lote: {
            id: "lote-cut",
            layoutOrigenLoteId: "lote-print",
            materialNombre: "Corrugado",
            nestingResult: resultado(),
          },
        },
      ],
    } as CotizacionFabricacion["analisisNestingCompuesto"];
    const p = obtenerPlanesFabricacion(c);
    expect(p).toHaveLength(1);
    expect(p[0].operaciones.map((o) => o.id)).toEqual([
      "lote-print",
      "lote-cut",
    ]);
    const anidada = cotizacion([]);
    anidada.componentesFabricados = ["izquierda", "derecha"].map((codigo) => ({
      codigo,
      nombre: codigo,
      productoId: "mismo-producto",
      componentes: c.componentesFabricados,
      analisisNestingCompuesto: c.analisisNestingCompuesto,
    })) as NonNullable<CotizacionFabricacion["componentesFabricados"]>;
    const antes = JSON.stringify(anidada);
    const planes = obtenerPlanesFabricacion(anidada);
    expect(planes).toHaveLength(2);
    expect(
      new Set(planes.flatMap((v) => v.operaciones.map((o) => o.id))).size,
    ).toBe(4);
    expect(planes.every((v) => v.operaciones.length === 2)).toBe(true);
    for (const plan of planes) {
      expect(plan.operaciones[1].origenId).toBe(plan.operaciones[0].id);
      expect(plan.result.placements).toEqual(resultado().placements);
    }
    expect(JSON.stringify(anidada)).toBe(antes);
  });
});
