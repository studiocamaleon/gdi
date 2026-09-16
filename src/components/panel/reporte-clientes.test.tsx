import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  ClientesPanel,
  SegmentoRfmPanel,
  TabPanel,
} from "@/lib/panel-api";
import { ReporteClientes } from "./reporte-clientes";

const segmentos: SegmentoRfmPanel[] = [
  "campeones",
  "leales",
  "nuevos",
  "en_riesgo",
  "perdidos",
  "ocasionales",
];
const datos: TabPanel<ClientesPanel> = {
  meta: {
    fuente: "Órdenes emitidas (historial completo)",
    limites: ["Segmentos independientes del período."],
    sinComparativa: true,
    rango: { desde: "2026-09-01", hasta: "2026-09-30" },
    rangoAnterior: { desde: "2026-08-01", hasta: "2026-08-31" },
    granularidad: "dia",
  },
  granularidad: "dia",
  margenesVisibles: true,
  kpis: {
    activos: 10,
    nuevos: 1,
    recurrentes: 9,
    retencionPct: 0,
    frecuenciaMedianaDias: 0.74,
    concentracionTop3Pct: 67.25,
  },
  serieNuevosRecurrentes: [
    { fecha: "2026-09-04", nuevos: 12345.67, recurrentes: 456.78 },
  ],
  pareto: Array.from({ length: 10 }, (_, i) => ({
    clienteId: `c${i}`,
    cliente: `Cliente ${i + 1}`,
    ordenes: 4,
    facturado: 1234.56,
    pct: 9,
    pctAcumulado: (i + 1) * 9,
  })),
  rfm: {
    diasActivo: 30,
    segmentos: segmentos.map((segmento) => ({
      segmento,
      clientes: segmento === "en_riesgo" ? 12 : 2,
      facturado: 54321.98,
    })),
    enRiesgo: Array.from({ length: 8 }, (_, i) => ({
      clienteId: `r${i}`,
      cliente: `Inactivo ${i + 1}`,
      ordenes: 3,
      facturadoHistorico: 6789.12,
      ultimaCompra: "2026-08-01",
      diasSinComprar: 46,
    })),
  },
  margenClientes: [
    {
      clienteId: "c1",
      cliente: "Margen negativo",
      ordenes: 2,
      ventas: 9876.54,
      margen: -765.43,
      margenPct: -12.34,
      itemsSinCosto: 2,
    },
    {
      clienteId: null,
      cliente: "Sin cliente",
      ordenes: 1,
      ventas: 100,
      margen: 0,
      margenPct: null,
      itemsSinCosto: 1,
    },
  ],
};
const render = (d = datos) => renderToStaticMarkup(<ReporteClientes d={d} />);
const table = (html: string, label: string) =>
  html.match(
    new RegExp(`<table[^>]*aria-label="${label}"[\\s\\S]*?</table>`),
  )?.[0] ?? "";
const metric = (html: string, label: string) =>
  html.match(
    new RegExp(
      `data-reporte-etiqueta[^>]*>${label}</[\\s\\S]*?data-reporte-valor[^>]*>([^<]*)</strong>`,
    ),
  )?.[0] ?? "";

describe("Reporte de Clientes", () => {
  it("conserva la mediana decimal, retención cero y concentración exacta", () => {
    const html = render();
    expect(html.match(/data-reporte-indicador=/g)).toHaveLength(5);
    expect(html).toContain("0,74 días");
    expect(html).toContain("67,25%");
    expect(metric(html, "Retención")).toContain("0%");
    expect(html).not.toContain("Sin clientes en el período anterior");
    expect(html).toContain("Mediana histórica entre compras");
    const sinBase = render({
      ...datos,
      kpis: {
        ...datos.kpis,
        retencionPct: null,
        frecuenciaMedianaDias: null,
        concentracionTop3Pct: null,
      },
    });
    expect(sinBase).toContain("Sin clientes en el período anterior");
    expect(metric(sinBase, "Retención")).toContain("—");
    expect(metric(sinBase, "Recompra histórica")).not.toContain("0,74 días");
    expect(
      render({ ...datos, kpis: { ...datos.kpis, frecuenciaMedianaDias: 0 } }),
    ).toContain("0 días");
  });
  it("muestra un único punto de ventas y exporta importes completos aunque esté plegado", () => {
    const html = render();
    expect(html).toContain('data-chart="tremor-bar"');
    expect(html).not.toMatch(/<details[^>]* open/);
    const serie = table(html, "Datos de nuevos y recurrentes");
    expect(serie).toContain("4 de sept de 2026");
    expect(serie).toContain("12.345,67");
    expect(serie).toContain("456,78");
    expect(html).toContain("clientes únicos en todo el período");
  });
  it("respeta agrupación semanal y mensual sin desplazar fechas ni omitir el año", () => {
    const semana = render({ ...datos, granularidad: "semana" });
    expect(semana).toContain("Origen de las ventas por semana");
    expect(semana).toContain("Semana desde");
    const mes = render({
      ...datos,
      granularidad: "mes",
      serieNuevosRecurrentes: [
        { fecha: "2026-01-01", nuevos: 1, recurrentes: 2 },
      ],
    });
    expect(table(mes, "Datos de nuevos y recurrentes")).toContain("ene 2026");
    expect(mes).not.toContain("dic 2025");
  });
  it("incluye los diez clientes recibidos sin normalizar su acumulado al 100%", () => {
    const cartera = table(render(), "Concentración de cartera");
    for (let i = 1; i <= 10; i++) expect(cartera).toContain(`Cliente ${i}`);
    expect(cartera).toContain("90%");
    expect(cartera).not.toContain("100%");
    expect(cartera).toContain("1.234,56");
  });
  it("aplica los umbrales configurados y distingue todos los segmentos históricos", () => {
    const html = render();
    const segmentosHtml = table(html, "Segmentos actuales de cartera");
    expect(segmentosHtml.match(/<tr>/g)).toHaveLength(7);
    expect(segmentosHtml).toContain(
      "Una sola orden · compra hace 30 días o menos",
    );
    expect(segmentosHtml).toContain("sin comprar entre 31 y 90 días");
    expect(segmentosHtml).toContain("sin comprar hace más de 90 días");
    expect(segmentosHtml).toContain("54.321,98");
    expect(html).toContain("independiente del período");
    const riesgo = table(html, "Clientes actualmente en riesgo");
    expect(riesgo).toContain("Inactivo 8");
    expect(riesgo).toContain(
      'data-reporte-exportar="Inactivo 1 · 3 órdenes · última compra 1 de ago de 2026"',
    );
    expect(riesgo).toContain("46 días");
    expect(riesgo).toContain("6.789,12");
    expect(html).toMatch(/<strong>12<\/strong>/);
  });
  it("preserva margen negativo, costos faltantes y su permiso también en exportación", () => {
    const margen = table(render(), "Margen por cliente");
    expect(margen).toContain("-765,43");
    expect(margen).toContain("-12,34%");
    expect(margen).toContain('data-negative="true"');
    expect(margen).toContain(
      'data-reporte-exportar="Margen negativo · 2 ítems sin costo · fuera del margen"',
    );
    expect(margen).toContain("—");
    const oculto = render({ ...datos, margenesVisibles: false });
    expect(oculto).not.toContain("Margen por cliente");
    expect(oculto).not.toContain("765,43");
    expect(oculto).not.toContain("ítems sin costo");
    expect(oculto).toContain("Concentración de cartera");
  });
  it("mantiene el historial al consultar un período vacío", () => {
    const html = render({
      ...datos,
      serieNuevosRecurrentes: [],
      pareto: [],
      margenClientes: [],
      kpis: {
        ...datos.kpis,
        activos: 0,
        nuevos: 0,
        recurrentes: 0,
        retencionPct: null,
        concentracionTop3Pct: null,
      },
    });
    expect(html).toContain("Sin ventas con cliente en el período");
    expect(html).toContain("Sin cartera para distribuir");
    expect(html).toContain("Sin ventas para analizar margen");
    expect(html).toContain("0,74 días");
    expect(html).toContain("Inactivo 8");
    expect(html).toContain("54.321,98");
    expect(html).not.toContain("NaN");
  });
  it("distingue una cartera sin historial de una con clientes perdidos pero sin clientes en riesgo", () => {
    const vacio = render({
      ...datos,
      rfm: { diasActivo: 30, segmentos: [], enRiesgo: [] },
    });
    expect(vacio).toContain("Sin historial para segmentar");
    expect(vacio).toContain("Sin historial de clientes");
    const perdidos = render({
      ...datos,
      rfm: {
        diasActivo: 30,
        segmentos: [{ segmento: "perdidos", clientes: 4, facturado: 4567 }],
        enRiesgo: [],
      },
    });
    expect(perdidos).toContain("Sin clientes en este tramo de riesgo");
    expect(perdidos).toContain("Con más de 90 días sin comprar");
    expect(perdidos).not.toContain("Sin historial de clientes");
  });
});
