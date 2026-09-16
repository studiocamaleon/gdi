import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProgresoExplicado, ProgresoValor } from "./progreso-produccion";
import { calcularProgreso } from "@/lib/progreso-produccion";
import { progresoItem, type TableroItemData } from "@/lib/tablero-produccion";
const pasos = [
  { estado: "hecho", duracionEstimadaMin: 15 },
  { estado: "pendiente", duracionEstimadaMin: 225 },
];
describe("avance consistente y accesible", () => {
  it("tablero y explicación usan el mismo porcentaje", () => {
    const progreso = calcularProgreso(pasos);
    expect(progresoItem({ pasos } as TableroItemData)).toBe(6);
    const html = renderToStaticMarkup(
      <ProgresoExplicado progreso={progreso} />,
    );
    expect(html).toContain('aria-valuenow="6"');
    expect(html).toContain("15 de 240 minutos");
    expect(html).toContain("No representa unidades terminadas ni entregadas");
  });
  it("la explicación del porcentaje es accesible con teclado", () => {
    const html = renderToStaticMarkup(
      <ProgresoValor progreso={calcularProgreso(pasos)} />,
    );
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="6%. 15 de 240');
  });
  it("identifica lotes con cantidades previstas, sin expandir de entrada", () => {
    const progreso = calcularProgreso(pasos);
    const html = renderToStaticMarkup(
      <ProgresoExplicado
        progreso={progreso}
        lotes={[
          {
            id: "a",
            nombre: "Lote A",
            productoNombre: "Exhibidores",
            cantidad: 50,
            unidad: "unidades",
            progreso,
          },
          {
            id: "b",
            nombre: "Lote B",
            productoNombre: "Exhibidores",
            cantidad: 150,
            unidad: "unidades",
            progreso: calcularProgreso([
              { estado: "pendiente", duracionEstimadaMin: 900 },
            ]),
          },
        ]}
      />,
    );
    expect(html).toContain("Lote A");
    expect(html).toContain("150");
    expect(html).toContain("Cantidad prevista");
    expect(html).not.toMatch(/<details[^>]* open/);
    expect(html).toContain('aria-label="Avance por lote"');
  });
  it("sin operaciones no muestra una barra indeterminada ni un cero", () => {
    const html = renderToStaticMarkup(
      <ProgresoExplicado progreso={calcularProgreso([])} />,
    );
    expect(html).toContain("Sin avance calculable");
    expect(html).not.toContain("aria-valuenow");
  });
  it("ordena A, Z y AA aunque lleguen en distinto orden", () => {
    const progreso = calcularProgreso(pasos);
    const html = renderToStaticMarkup(
      <ProgresoExplicado
        progreso={progreso}
        lotes={["AA", "Z", "A"].map((n) => ({
          id: n,
          nombre: `Lote ${n}`,
          productoNombre: "Exhibidores",
          cantidad: 50,
          unidad: "u",
          progreso,
        }))}
      />,
    );
    expect(html.indexOf("<strong>Lote A</strong>")).toBeLessThan(
      html.indexOf("<strong>Lote Z</strong>"),
    );
    expect(html.indexOf("<strong>Lote Z</strong>")).toBeLessThan(
      html.indexOf("<strong>Lote AA</strong>"),
    );
  });
});
