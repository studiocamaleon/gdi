import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProductoPanel, TabPanel } from "@/lib/panel-api";
import { ReporteProducto } from "./reporte-producto";
import { VentasProductoTabla } from "./reporte-producto-mix";

const fila = {
  nombre: "Vinilo",
  ventas: 12345.67,
  costo: 14500,
  margenPct: -17.45,
  contribucionPct: -1.25,
  items: 10,
};
const datos: TabPanel<ProductoPanel> = {
  meta: {
    fuente: "Snapshot de cotización",
    limites: ["Consumo teórico, no stock real."],
    sinComparativa: true,
    rango: { desde: "2026-09-01", hasta: "2026-09-30" },
    rangoAnterior: { desde: "2026-08-01", hasta: "2026-08-31" },
    granularidad: "dia",
  },
  margenesVisibles: true,
  porCategoria: [{ ...fila, nombre: "Gran formato" }],
  porProducto: [fila],
  porPapel: [
    {
      material: "Papel",
      cantidad: 1.25,
      unidad: "hoja",
      formato: "SRA3",
      costo: 8765.43,
      items: 2,
    },
  ],
  consumoTintas: [
    {
      material: "Tinta",
      cantidad: 0.25,
      unidad: "ml",
      formato: null,
      costo: 0.12,
      items: 1,
    },
  ],
  medidas: {
    items: 10,
    estandar: 3,
    personalizada: 7,
    pctEstandar: 30,
    sinDato: 2,
    porProducto: [
      {
        nombre: "Vinilo",
        items: 10,
        estandar: 3,
        personalizada: 7,
        pctEstandar: 30,
      },
    ],
    topEstandar: [{ nombre: "A3", items: 3 }],
  },
  totalM2: 0.25,
  porTecnologia: [{ nombre: "UV", monto: 12345.67, pct: 100 }],
  mixEvolutivo: [
    { fecha: "2026-09-07", nombre: "Gran formato", monto: 12345.67 },
  ],
  adicionales: {
    itemsTotales: 12,
    itemsCon: 2,
    pctCon: 16.67,
    ticketItemCon: 50,
    ticketItemSin: 200,
    porAdicional: [
      { etiqueta: "Laminado", items: 2, pctItems: 16.67, ventas: 100 },
    ],
    porProducto: [{ nombre: "Vinilo", items: 10, itemsCon: 2, pctCon: 20 }],
  },
};
const render = (d = datos) =>
  renderToStaticMarkup(
    <ReporteProducto
      d={d}
      rango={{ desde: "2026-09-01", hasta: "2026-09-30" }}
    />,
  );

describe("Reporte Ventas y producto", () => {
  it("mantiene importes y consumos exactos, con gráfico incluso de un solo día", () => {
    const html = render();
    expect(html.match(/data-reporte-indicador=/g)).toHaveLength(5);
    expect(html).toContain("12.345,67");
    expect(html).toContain("1,25 hojas · SRA3");
    expect(html).toContain("0,25 ml");
    expect(html).toContain("0,25 m²");
    expect(html).toContain('data-chart="tremor-bar"');
    expect(html).toContain('aria-label="Datos de la evolución"');
    expect(html).toContain("7 de sept de 2026");
    expect(html).not.toMatch(/<details[^>]* open/);
  });
  it("respeta el permiso para margen, contribución y costos también en los datos exportables", () => {
    const visible = render();
    expect(visible).toContain("-17,45%");
    expect(visible).toContain("-1,25%");
    expect(visible).toContain('data-negative="true"');
    expect(visible).toContain("8.765,43");
    const oculto = render({ ...datos, margenesVisibles: false });
    for (const value of [
      "-17,45%",
      "-1,25%",
      "8.765,43",
      "Contribución %",
      "Margen %",
    ])
      expect(oculto).not.toContain(value);
    expect(oculto).toContain("12.345,67");
    const drill = renderToStaticMarkup(
      <VentasProductoTabla rows={[fila]} margenes={false} />,
    );
    expect(drill).not.toContain("-17,45%");
    expect(drill).not.toContain("-1,25%");
  });
  it("no recorta productos ni adicionales recibidos después de la octava fila", () => {
    const html = render({
      ...datos,
      porProducto: Array.from({ length: 20 }, (_, i) => ({
        ...fila,
        nombre: `Producto número ${i}`,
      })),
      adicionales: {
        ...datos.adicionales,
        porAdicional: Array.from({ length: 10 }, (_, i) => ({
          ...datos.adicionales.porAdicional[0],
          etiqueta: `Adicional ${i}`,
        })),
        porProducto: Array.from({ length: 12 }, (_, i) => ({
          ...datos.adicionales.porProducto[0],
          nombre: `Producto adicional ${i}`,
        })),
      },
    });
    expect(html).toContain("Producto número 19");
    expect(html).toContain("Adicional 9");
    expect(html).toContain("Producto adicional 11");
    expect(html).toContain("Hasta 20 productos");
  });
  it("conserva la comparación negativa de tickets y aclara que no es el ingreso del adicional", () => {
    const html = render();
    expect(html).toContain("-75%");
    expect(html).toContain("no al precio del adicional");
    expect(html).toContain(
      "los porcentajes y ventas de estas filas no se suman",
    );
    expect(html).toContain("no mide cuánto agrega un adicional");
    expect(html).toContain('aria-label="Ticket por grupo"');
  });
  it("distingue una cohorte ausente de un ticket cero y evita comparar contra cero", () => {
    const soloCon = render({
      ...datos,
      adicionales: {
        ...datos.adicionales,
        itemsTotales: 2,
        itemsCon: 2,
        ticketItemSin: 0,
      },
    });
    expect(soloCon).toContain("Sin base suficiente para comparar ambos grupos");
    expect(soloCon).not.toContain("-100%");
    const ceroCon = render({
      ...datos,
      adicionales: { ...datos.adicionales, ticketItemCon: 0 },
    });
    expect(ceroCon).toContain("-100%");
    const ceroSin = render({
      ...datos,
      adicionales: { ...datos.adicionales, ticketItemSin: 0 },
    });
    expect(ceroSin).toContain("Sin base suficiente");
    expect(ceroSin).not.toContain("Infinity");
  });
  it("muestra ítems sin medida aun si no hay ninguna medida conocida", () => {
    const html = render({
      ...datos,
      medidas: {
        items: 0,
        estandar: 0,
        personalizada: 0,
        pctEstandar: null,
        sinDato: 7,
        porProducto: [],
        topEstandar: [],
      },
    });
    expect(html).toContain("Sin ítems con medida identificada");
    expect(html).toContain("7 sin dato, excluidos del porcentaje");
    expect(html).toContain('aria-label="Totales de medidas"');
    expect(html).not.toContain("NaN");
  });
  it("muestra vacíos sin porcentajes ficticios ni costos ausentes como cero", () => {
    const sinCosto = render({
      ...datos,
      porPapel: [{ ...datos.porPapel[0], costo: undefined }],
    });
    expect(sinCosto).not.toContain("8.765,43");
    const html = render({
      ...datos,
      porCategoria: [],
      porProducto: [],
      porPapel: [],
      consumoTintas: [],
      mixEvolutivo: [],
      porTecnologia: [],
      medidas: {
        items: 0,
        estandar: 0,
        personalizada: 0,
        pctEstandar: null,
        sinDato: 0,
        porProducto: [],
        topEstandar: [],
      },
      totalM2: 0,
      adicionales: {
        itemsTotales: 0,
        itemsCon: 0,
        pctCon: 0,
        ticketItemCon: 0,
        ticketItemSin: 0,
        porAdicional: [],
        porProducto: [],
      },
    });
    for (const value of [
      "Sin ventas para graficar",
      "Sin tickets para comparar",
      "Sin consumo de materiales registrado",
      "Sin consumo de tintas registrado",
      "Sin ventas por tecnología",
    ])
      expect(html).toContain(value);
    expect(html).not.toContain('data-chart="tremor-bar"');
    expect(html).not.toContain("100%");
  });
});
