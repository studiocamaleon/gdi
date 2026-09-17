import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ComponentesFabricadosCotizacion } from "./componentes-fabricados-cotizacion";
import type { ProductoRecetaRevision } from "@/lib/productos-servicios-api";

const pieza = {
  id: "frente",
  tipo: "RECTANGULAR",
  nombre: "Frente",
  cantidadPorUnidad: 2,
  medidas: { anchoMm: 300, altoMm: 400 },
};
function render(piezasEditables: boolean, values = {}) {
  const revision = {
    componentes: [
      {
        id: "vinilo",
        codigo: "VINILO",
        nombre: "Vinilos",
        configuracionJson: {
          version: 2,
          piezasEditables,
          piezas: [pieza],
          bindings: [
            {
              clave: "medidaCustomMm.anchoMm",
              etiqueta: "Ancho duplicado",
              origen: "COTIZACION",
            },
          ],
        },
      },
    ],
  } as unknown as ProductoRecetaRevision;
  return renderToStaticMarkup(
    <ComponentesFabricadosCotizacion
      revision={revision}
      cantidadProductos={5}
      values={values}
      onChange={() => {}}
    />,
  );
}
describe("piezas de un componente al cotizar", () => {
  it("muestra la colección fija aunque no haya parámetros para completar", () => {
    const html = render(false);
    expect(html).toContain("Piezas del componente");
    expect(html).toContain("Frente");
    expect(html).toContain("30 cm");
    expect(html).toContain("10 piezas");
    expect(html).not.toContain("Ancho duplicado");
    expect(html).not.toContain("Agregar pieza");
  });
  it("muestra las piezas propias de la cotización cuando la receta lo permite", () => {
    const html = render(true, {
      VINILO: {
        piezas: [{ ...pieza, nombre: "Vidriera", cantidadPorUnidad: 3 }],
      },
    });
    expect(html).toContain('value="Vidriera"');
    expect(html).toContain("15 piezas");
    expect(html).toContain("Agregar pieza");
    expect(html).not.toContain("Ancho duplicado");
  });
});
