import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FinanzasData } from "@/lib/panel-api";
import { ReporteFinanzas } from "./reporte-finanzas";

const datos: FinanzasData = {
  meta: {
    fuente: "Comprobantes y costos",
    limites: ["Costos registrados del trabajo."],
    sinComparativa: true,
    rango: { desde: "2026-09-01", hasta: "2026-09-16" },
    rangoAnterior: { desde: "2026-08-16", hasta: "2026-08-31" },
    granularidad: "dia",
  },
  rentabilidad: {
    ventas: 80.5,
    ventasDeltaPct: null,
    costoTotal: 100.25,
    margenBruto: -19.75,
    margenBrutoPct: -24.53,
    costosVariables: 20.35,
    contribucion: 60.15,
    contribucionPct: 74.72,
    costosFijos: 30.5,
    puntoEquilibrio: 40.25,
    avancePct: 200,
    gastoPorCategoria: [{ categoria: "Estructura", monto: 30.5, pct: 100 }],
  },
  cobranza: {
    facturado: 120,
    cobrado: 80.5,
    brecha: 39.5,
    dso: 22.3,
    agingTotal: 125.75,
    vencido: 100.5,
    aging: [
      { franja: "A vencer", monto: 25.25 },
      { franja: "0-30", monto: 100.5 },
    ],
    deudores: [
      {
        clienteId: null,
        cliente: "Cliente de prueba",
        saldo: 125.75,
        diasMax: 20,
        porFranja: {
          "A vencer": 25.25,
          "0-30": 100.5,
          "31-60": 0,
          "61-90": 0,
          "+90": 0,
        },
      },
    ],
    costoCobrar: [
      {
        metodo: "Tarjeta",
        cantidad: 2,
        bruto: 80.5,
        comision: 2.42,
        neto: 78.08,
        pct: 3.01,
      },
    ],
    comisionTotal: 2.42,
    cheques: [],
    fondos: [],
  },
};
const render = (d = datos) => renderToStaticMarkup(<ReporteFinanzas d={d} />);

describe("Reporte Finanzas", () => {
  it("conserva pérdidas y precisión monetaria en los datos del resultado", () => {
    const html = render();
    expect(html).toContain("-19,75");
    expect(html).toContain("100,25");
    expect(html).toContain('aria-label="Datos del resultado financiero"');
    expect(html).toContain("Totales del período seleccionado");
    expect(html).not.toContain("serie diaria");
    expect(html.match(/data-reporte-indicador=/g)).toHaveLength(5);
    expect(html).toContain("Costos registrados del trabajo.");
  });
  it("no recorta un avance superior al 100% ni confunde la deuda actual con el rango", () => {
    const html = render();
    expect(html).toContain("200% cubierto por las ventas");
    expect(html).toContain(
      "Saldo comercial actual · independiente del período",
    );
    expect(html).toContain("DSO estimado · 22,3 días");
    expect(html).toContain("Estructura prorrateada para el rango seleccionado");
  });
  it("distingue indicadores no calculables de valores cero", () => {
    const missing = render({
      ...datos,
      rentabilidad: {
        ...datos.rentabilidad,
        puntoEquilibrio: null,
        avancePct: null,
        costoTotal: undefined,
      },
      cobranza: { ...datos.cobranza, dso: null },
    });
    expect(missing).toContain("Sin base para calcularlo");
    expect(missing).toContain("DSO no calculable en este período");
    expect(missing).not.toContain("200% cubierto");
    const zero = render({ ...datos, cobranza: { ...datos.cobranza, dso: 0 } });
    expect(zero).toContain("DSO estimado · 0 días");
    expect(zero).not.toContain("DSO no calculable");
  });
  it("expone comisiones, netos y todas las franjas de cada deudor para consultar y exportar", () => {
    const html = render();
    expect(html).toContain("78,08");
    expect(html).toContain("2,42");
    expect(html).toContain("1–30 días");
    expect(html).toContain("Más de 90 días");
    expect(html).toContain("Ver importes");
    expect(html).toContain(
      'data-reporte-exportar="A vencer: $ 25,25 · 1–30 días: $ 100,50',
    );
    expect(html).toContain("20 días");
    expect(html).toContain("La comisión incluye su IVA.");
  });
  it("muestra todas las categorías de gasto, incluso después de la octava", () => {
    const html = render({
      ...datos,
      rentabilidad: {
        ...datos.rentabilidad,
        gastoPorCategoria: Array.from({ length: 10 }, (_, i) => ({
          categoria: `Categoría ${i + 1}`,
          monto: i + 0.25,
          pct: i + 0.5,
        })),
      },
    });
    expect(html).toContain("Categoría 10");
    expect(html).toContain("9,25");
    expect(html).toContain("9,5%");
  });
  it("presenta vacíos honestos y exporta ceros aunque no dibuje barras", () => {
    const html = render({
      ...datos,
      rentabilidad: {
        ...datos.rentabilidad,
        ventas: 0,
        costoTotal: 0,
        gastoPorCategoria: [],
      },
      cobranza: {
        ...datos.cobranza,
        agingTotal: 0,
        vencido: 0,
        aging: [],
        deudores: [],
        costoCobrar: [],
        comisionTotal: 0,
      },
    });
    expect(html).toContain("Sin actividad de ventas y costos");
    expect(html).toContain("Sin deuda pendiente");
    expect(html).toContain("Sin cobros en el período");
    expect(html).toContain("Sin gastos fijos de estructura");
    expect(html).toContain("Sin deudores pendientes");
    expect(html).toContain('aria-label="Datos del resultado financiero"');
    expect(html).not.toContain('data-chart="tremor-bar"');
  });
});
