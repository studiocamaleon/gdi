import { describe, it, expect } from "vitest";
import { agruparPiezasCotizacion } from "./piezas-cotizacion";
import type { FuenteGuardada } from "./geometrias-producto-api";
import type {
  ProductoRecetaRevision,
  CotizarResponse,
} from "./productos-servicios-api";
const fuente = (id: string) =>
  ({
    nombreArchivo: "mismo-nombre.dxf",
    procedencia: { geometriaId: id },
  }) as FuenteGuardada;
const fuentes = [
  {
    id: "shelf",
    nombre: "Diseño del producto",
    requerida: true,
    predeterminada: fuente("g-estante"),
  },
  {
    id: "otro",
    nombre: "Otro",
    requerida: true,
    predeterminada: fuente("g-otro"),
  },
];
const componente = {
  id: "c",
  codigo: "C",
  nombre: "Piezas de corrugado",
  cantidad: 1,
  formula: "por_unidad",
  configuracionJson: {
    piezas: [
      {
        id: "p",
        nombre: "Estante",
        cantidadPorUnidad: 4,
        fuente: fuente("g-estante"),
      },
    ],
  },
} as ProductoRecetaRevision["componentes"][number];

describe("piezas de la receta en la cotización", () => {
  it("resuelve por geometría y muestra 200 estantes para 50 productos", () => {
    const grupos = agruparPiezasCotizacion(fuentes, [componente], 50);
    expect(grupos[0].filas[0]).toMatchObject({
      nombre: "Estante",
      fuente: fuentes[0],
      porProducto: 4,
      total: 200,
    });
    expect(grupos[1].filas[0].fuente).toBe(fuentes[1]);
  });
  it("mantiene los usos de un diseño compartido separados por componente", () => {
    const grupos = agruparPiezasCotizacion(
      fuentes,
      [componente, { ...componente, id: "c2", codigo: "C2", cantidad: 2 }],
      10,
    );
    expect(grupos.slice(0, 2).map((g) => g.filas[0].total)).toEqual([40, 80]);
  });
  it("no inventa cantidades para fórmulas productivas o repeticiones; usa el cálculo real", () => {
    const c = { ...componente, formula: "por_unidad_productiva" };
    expect(
      agruparPiezasCotizacion(fuentes, [c], 50)[0].filas[0].total,
    ).toBeUndefined();
    const calculados = [{ codigo: "C", cantidad: 12 }] as NonNullable<
      CotizarResponse["cotizacion"]
    >["componentesFabricados"];
    expect(
      agruparPiezasCotizacion(fuentes, [c], 50, calculados)[0].filas[0],
    ).toMatchObject({ total: 48, porProducto: undefined });
  });
});
