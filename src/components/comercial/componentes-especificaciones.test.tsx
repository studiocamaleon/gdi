import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ComponentesEspecificaciones } from "./componentes-especificaciones";
import { buildOrdenItemSpecs } from "./propuesta-ficha";
import type { PropuestaItem } from "@/lib/propuestas";

const material = {
  tipoLineaCosto: "MATERIAL",
  materialNombre: "Corrugado plastico",
};
const componente = {
  nombre: "Piezas de corrugado",
  cantidad: 50,
  unidad: "conjunto",
  jobContext: {
    cantidad: 50,
    disenosVectoriales: [
      {
        id: "cuerpo",
        nombre: "Cuerpo",
        cantidadPorUnidad: 1,
        fuente: {
          anchoFinalMm: 300,
          altoFinalMm: 400,
          nombreArchivo: "Cuerpo.dxf",
        },
      },
      {
        id: "estante",
        nombre: "Estante",
        cantidadPorUnidad: 4,
        fuente: {
          anchoFinalMm: 100,
          altoFinalMm: 170,
          nombreArchivo: "Estante.dxf",
        },
      },
    ],
  },
  pasos: [{ activado: true, materiales: [material] }],
};

function item(pasos: unknown[] = [], componentes: unknown[] = [componente]) {
  return {
    atributosSchema: [
      { key: "material", label: "Material", visible: true, orden: 1 },
      { key: "acabado", label: "Acabado", visible: true, orden: 2 },
    ],
    especificaciones: { material: "Polyfan (XPS)", acabado: "Mate" },
    cotizacion: { pasos, componentesFabricados: componentes },
  } as unknown as PropuestaItem;
}

describe("vista de especificaciones de la propuesta", () => {
  it("muestra el desglose accesible con cantidades por conjunto y totales", () => {
    const html = renderToStaticMarkup(
      <ComponentesEspecificaciones componentes={[componente]} />,
    );
    expect(html).toContain(
      "50 conjuntos · 2 tipos de pieza · 250 piezas en total",
    );
    expect(html).toContain("Desglose de Piezas de corrugado");
    expect(html).toContain("Por conjunto");
    expect(html).toMatch(
      /Estante[\s\S]*10 × 17 cm[\s\S]*>4<\/td>[\s\S]*>200<\/td>/,
    );
    expect(html).toContain("Corrugado plastico");
  });

  it("no presenta el material genérico del producto cuando los hijos consumen el material", () => {
    expect(buildOrdenItemSpecs(item())).toEqual([
      { lbl: "Acabado", val: "Mate" },
    ]);
  });

  it("conserva el material propio del padre cuando también tiene fabricación", () => {
    const specs = buildOrdenItemSpecs(
      item([
        {
          activado: true,
          familiaCodigo: "corte",
          materiales: [
            { ...material, slotCodigo: "sustrato", materialNombre: "Acrílico" },
          ],
        },
      ]),
    );
    expect(specs).toContainEqual({ lbl: "Material", val: "Acrílico" });
  });

  it("conserva las especificaciones históricas si no hay materiales efectivos en componentes", () => {
    expect(buildOrdenItemSpecs(item([], []))).toContainEqual({
      lbl: "Material",
      val: "Polyfan (XPS)",
    });
    expect(
      buildOrdenItemSpecs(
        item([], [{ pasos: [{ activado: false, materiales: [material] }] }]),
      ),
    ).toContainEqual({ lbl: "Material", val: "Polyfan (XPS)" });
  });
});
