import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { EmbudoPanel, TabPanel } from "@/lib/panel-api";
import { ReporteEmbudo } from "./reporte-embudo";

const datos: TabPanel<EmbudoPanel> = {
  meta: {
    fuente: "Presupuestos emitidos (cohorte)",
    limites: ["OT directas excluidas."],
    sinComparativa: false,
    rango: { desde: "2026-09-01", hasta: "2026-09-30" },
    rangoAnterior: { desde: "2026-08-01", hasta: "2026-08-31" },
    granularidad: "dia",
  },
  sinComparativa: false,
  kpis: {
    tasaAprobacion: 50,
    tasaAprobacionDeltaPct: -12.3,
    tasaEntrega: 16.67,
    pipelineAbiertoMonto: 12345.67,
    pipelineAbiertoCantidad: 1,
    cicloPromedioDias: 2.75,
  },
  funnel: [
    {
      clave: "emitidas",
      label: "Cotizaciones emitidas",
      cantidad: 6,
      monto: 6000.12,
      sharePct: 100,
      conversionPct: null,
    },
    {
      clave: "aprobadas",
      label: "Aprobadas",
      cantidad: 3,
      monto: 4000.12,
      sharePct: 50,
      conversionPct: 50,
    },
    {
      clave: "produccion",
      label: "En producción",
      cantidad: 2,
      monto: 9000.18,
      sharePct: 33.33,
      conversionPct: 66.67,
    },
    {
      clave: "entregadas",
      label: "Entregadas",
      cantidad: 1,
      monto: 1200.25,
      sharePct: 16.67,
      conversionPct: 50,
    },
  ],
  fugas: [
    { motivo: "En gestión (sin resolver)", cantidad: 1, monto: 800.11 },
    { motivo: "Precio", cantidad: 1, monto: 500 },
    { motivo: "Vencidas", cantidad: 1, monto: 300 },
  ],
  velocidad: [
    { tramo: "Emitida → aprobada", diasPromedio: 1.67 },
    { tramo: "Aprobada → producción", diasPromedio: 0 },
    { tramo: "Producción → entrega", diasPromedio: null },
  ],
};
const render = (d = datos) => renderToStaticMarkup(<ReporteEmbudo d={d} />);
const table = (html: string, label: string) =>
  html.match(
    new RegExp(`<table[^>]*aria-label="${label}"[\\s\\S]*?</table>`),
  )?.[0] ?? "";

describe("Reporte Embudo", () => {
  it("conserva tasas, puntos porcentuales, importes exactos y precisión de tiempos", () => {
    const html = render();
    expect(html.match(/data-reporte-indicador=/g)).toHaveLength(4);
    for (const texto of [
      "50%",
      "16,67%",
      "-12,3 pts",
      "12.345,67",
      "2,75 días",
      "Presupuestos abiertos hoy",
    ])
      expect(html).toContain(texto);
    expect(html).toContain("1 presupuesto ·");
    expect(html).toContain("OT directas excluidas.");
    expect(html).toContain('aria-label="Medida del embudo"');
  });
  it("exporta cantidades y montos de todas las etapas aunque el detalle esté plegado", () => {
    const html = render();
    expect(html).not.toMatch(/<details[^>]* open/);
    const recorrido = table(html, "Datos del recorrido comercial");
    expect(recorrido.match(/<tr>/g)).toHaveLength(5);
    for (const texto of [
      "6.000,12",
      "4.000,12",
      "9.000,18",
      "1.200,25",
      "33,33%",
      "66,67%",
      "150%",
      "225%",
    ])
      expect(recorrido).toContain(texto);
    expect(html).toContain("Alcanzaron producción");
    expect(html).toContain("Incluye los que ya finalizaron o se entregaron");
  });
  it("incluye en gestión sin confundirlo con una pérdida", () => {
    const html = render();
    const fugas = table(html, "Presupuestos pendientes y pérdidas");
    for (const texto of [
      "En gestión (sin resolver)",
      "Precio",
      "Vencidas",
      "800,11",
    ])
      expect(fugas).toContain(texto);
    expect(html).toContain("sigue abierto y no es una pérdida");
    expect(html).toContain("1.600,11");
  });
  it("explica las fechas reales de los tiempos y distingue cero de ausencia de fechas", () => {
    const velocidad = table(render(), "Promedios entre etapas");
    expect(velocidad).toContain("1,67");
    expect(velocidad).toContain(">0</td>");
    expect(velocidad).toContain("Sin fechas suficientes");
    expect(velocidad).toContain(
      'data-reporte-exportar="Emisión de OT → finalización · Hasta la finalización de producción registrada en la OT."',
    );
    expect(velocidad).not.toContain("Producción → entrega");
    const html = render({
      ...datos,
      velocidad: [{ tramo: "Registro excepcional", diasPromedio: -0.25 }],
    });
    expect(html).toContain("-0,25");
    expect(html).toContain('data-negative="true"');
    expect(html).toContain("Registro excepcional");
  });
  it("no muestra éxito ni tasas sin base en un período vacío, y conserva los abiertos de hoy", () => {
    const html = render({
      ...datos,
      funnel: datos.funnel.map((e) => ({ ...e, cantidad: 0, monto: 0 })),
      fugas: [],
      velocidad: [],
      kpis: {
        ...datos.kpis,
        tasaAprobacion: 0,
        tasaEntrega: 0,
        cicloPromedioDias: null,
      },
    });
    expect(html).toContain("Sin presupuestos emitidos en el período");
    expect(html).toContain("Sin presupuestos para analizar");
    expect(html).toContain("Sin tramos registrados");
    expect(html).toContain("12.345,67");
    expect(html).not.toContain(
      "Todos los presupuestos del período se aprobaron",
    );
    expect(html).not.toContain("-12,3 pts");
    expect(html).not.toContain("NaN");
  });
  it("sigue mostrando presupuestos con importe cero y conserva el ciclo de cero días", () => {
    const html = render({
      ...datos,
      funnel: datos.funnel.map((e) => ({ ...e, monto: 0 })),
      kpis: { ...datos.kpis, cicloPromedioDias: 0 },
    });
    expect(
      table(html, "Datos del recorrido comercial").match(/<tr>/g),
    ).toHaveLength(5);
    expect(html).not.toContain("Sin presupuestos emitidos");
    expect(html).toContain("0 días");
  });
  it("distingue aprobación completa de falta de comparativa", () => {
    const html = render({
      ...datos,
      sinComparativa: true,
      fugas: [],
      kpis: {
        ...datos.kpis,
        tasaAprobacion: 100,
        tasaAprobacionDeltaPct: null,
      },
    });
    expect(html).toContain("Todos los presupuestos del período se aprobaron");
    expect(html).toContain("sin comparativa");
    expect(html).not.toContain("vs. período anterior");
  });
});
